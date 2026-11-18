'use strict';

const {executeGovernedAction} = require('../services/service-execution-router');
const {extractContent} = require('../intelligence/content-extraction');
const {buildClaimFabric} = require('../intelligence/claim-fabric');
const {isInstitutionalDomain} = require('../intelligence/institutional-source-registry');

// A short office fact needs a live document and an explicit scoped claim,
// not a recursive crawl. Wikipedia's public summary API is already used by
// web-search; fetch it as evidence instead of depending on article HTML.
async function runOfficeResearch(plan, options, trace, executeAction = executeGovernedAction, indexFallback = null) {
  const started = Date.now();
  const deadline = indexFallback?.deadline || started + 22000;
  const query = plan.selected_query;
  const sources = [];
  const diagnostic = {search:null,documents:[]};
  async function execute(action, input, timeoutMs) {
    if (Date.now() >= deadline) return {ok:false,error:{code:'OFFICE_RESEARCH_BUDGET'}};
    timeoutMs = Math.min(timeoutMs,Math.max(1,deadline - Date.now()));
    if (typeof input.timeoutMs === 'number') input = {...input,timeoutMs};
    if (input.options?.timeoutMs) input = {...input,options:{...input.options,timeoutMs}};
    let execution;
    try {
      execution = await executeAction({action,input,req:options.req,user:options.user,
        supabase:options.supabase,requestId:options.requestId,
        runtimeContext:{timeoutMs,latencyAwareRouting:true}});
    } catch (_) { execution = {ok:false,error:{code:'OFFICE_TOOL_UNAVAILABLE'}}; }
    trace.push({step:trace.length + 1,action,input,execution});
    return execution;
  }
  const search = await execute('web_search',{query,limit:3,timeoutMs:8000,
    ...(!indexFallback ? {disabledProviders:['searxng','bing','duckduckgo','brave','brave-api','bing-api','google-cse']} : {})},8000);
  const rawRows = search?.ok ? (search.result?.results || search.result?.search?.results || []) : [];
  const rows = Array.isArray(rawRows) ? rawRows : [];
  diagnostic.search = {ok:search?.ok === true,code:search?.error?.code || null,
    provider:search?.evidence?.search_engine || null,count:rows.length};
  let answer = null;
  let verification = null;
  for (const [index,page] of rows.slice(0,2).entries()) {
    let url;
    try { url = new URL(page.url); } catch (_) { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    const document = {host:url.hostname,reason:'NO_VERIFIED_CLAIM'};
    diagnostic.documents.push(document);
    const wiki = url.hostname === 'ar.wikipedia.org' && url.pathname.startsWith('/wiki/');
    let fetchUrl = url.toString();
    if (wiki) {
      try { fetchUrl = 'https://ar.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(decodeURIComponent(url.pathname.slice(6))); }
      catch (_) { continue; }
    }
    let text, title;
    try {
      if (wiki && search.evidence?.search_engine === 'wikipedia-summary' && page.status_code === 200) {
        // This governed provider has already fetched the live API document.
        // Ordinary index snippets cannot enter this path.
        text = page.snippet; title = page.title;
        document.mode = 'provider_summary';
      } else {
        const fetched = await execute('web_fetch',{url:fetchUrl,options:{timeoutMs:3500,maxBytes:350000}},3500);
        document.fetch = {ok:fetched?.ok === true,code:fetched?.error?.code || null,
          status:fetched?.evidence?.fetch?.status_code || null};
        if (!fetched?.ok || !fetched.result?.text) {document.reason='DOCUMENT_UNAVAILABLE';continue;}
        if (wiki) {
          const data = JSON.parse(fetched.result.text);
          const canonical = new URL(data.content_urls?.desktop?.page);
          const pathKey = value => decodeURIComponent(value).replace(/_/gu,' ').normalize('NFKC');
          if (canonical.protocol !== 'https:' || canonical.username || canonical.password || canonical.hostname !== url.hostname || pathKey(canonical.pathname) !== pathKey(url.pathname) ||
              typeof data.extract !== 'string' || typeof data.title !== 'string' || data.type === 'disambiguation') {document.reason='DOCUMENT_BINDING_FAILED';continue;}
          text = data.extract; title = data.title; url = canonical;
        } else {
          const extracted = await extractContent(fetched.result.text,fetched.result.content_type || 'text/html');
          text = extracted.text; title = extracted.title || page.title;
        }
      }
    } catch (_) { document.reason='DOCUMENT_PARSE_FAILED';continue; }
    const institution = isInstitutionalDomain(url.toString());
    const source = {id:'office-source-' + index,url:url.toString(),title,text,
      publisher:url.hostname,kind:wiki ? 'live_api_summary' : 'fetched_page',
      authoritative_primary:Boolean(institution && institution.authority_score >= 0.95),
      authority_score:institution?.authority_score || 0};
    const fabric = buildClaimFabric({sources:[source],entityFrame:plan.entity_frame,minIndependentPublishers:1});
    const claims = fabric.fused_claims.filter(claim => claim.predicate === 'relation.holder' &&
      claim.verification_state === 'VERIFIED' && claim.temporal_state !== 'historical');
    document.claims = {extracted:fabric.extracted_claim_count,holders:claims.length,state:fabric.verification_state};
    if (new Set(claims.map(claim => claim.value_normalized)).size !== 1) continue;
    verification = await execute('evidence_verify',{topic:query,
      sources:[{...source,claims}],minIndependentPublishers:1,
      allowAuthoritativePrimary:source.authoritative_primary},1500);
    document.verification = verification?.error?.code || verification?.result?.verification_state || null;
    if (!verification?.ok || verification.result?.verification_state !== 'SUPPORTED') {document.reason='EVIDENCE_NOT_SUPPORTED';continue;}
    sources.push(source);
    document.reason='SUPPORTED';
    const scope = plan.entity.organization.value.replace(/^وزارة\s+\S+\s*/u,'').trim();
    answer = claims[0].value + ' هو ' + plan.entity.relation.value + (scope ? ' في ' + scope : '') + '.\n\n' + source.url;
    break;
  }
  console.info('[assistant-office-document]',JSON.stringify({request_id:options.requestId || null,
    supported:Boolean(answer),elapsed_ms:Date.now() - started,...diagnostic}));
  // General indexes returned unrelated Arabic pages as well as English pages
  // in real release checks. Prefer the live Arabic summary provider for this
  // scoped fact. If it has no verified holder, try the index once under the
  // SAME deadline; neither route can skip document/claim verification.
  if (!answer && !indexFallback && Date.now() + 2500 < deadline) {
    const fallback = await runOfficeResearch(plan,options,trace,executeAction,{deadline});
    return {...fallback,elapsedMs:Date.now() - started};
  }
  return {plan,answer,decisionEligible:Boolean(answer),sourceCount:sources.length,
    elapsedMs:Date.now() - started,
    result:{decisionEligible:Boolean(answer),verification_state:answer ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE',
      verification,search,evidence:sources}};
}

module.exports = {runOfficeResearch};
