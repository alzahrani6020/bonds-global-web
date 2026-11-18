'use strict';

const {executeGovernedAction} = require('../services/service-execution-router');
const {extractContent} = require('../intelligence/content-extraction');
const {buildClaimFabric} = require('../intelligence/claim-fabric');
const {isInstitutionalDomain} = require('../intelligence/institutional-source-registry');

// A short office fact needs a live document and an explicit scoped claim,
// not a recursive crawl. Wikipedia's public summary API is already used by
// web-search; fetch it as evidence instead of depending on article HTML.
async function runOfficeResearch(plan, options, trace) {
  const started = Date.now();
  const deadline = started + 22000;
  const query = plan.selected_query;
  const sources = [];
  async function execute(action, input, timeoutMs) {
    if (Date.now() >= deadline) return {ok:false,error:{code:'OFFICE_RESEARCH_BUDGET'}};
    let execution;
    try {
      execution = await executeGovernedAction({action,input,req:options.req,user:options.user,
        supabase:options.supabase,requestId:options.requestId,
        runtimeContext:{timeoutMs,latencyAwareRouting:true}});
    } catch (_) { execution = {ok:false,error:{code:'OFFICE_TOOL_UNAVAILABLE'}}; }
    trace.push({step:trace.length + 1,action,input,execution});
    return execution;
  }
  const search = await execute('web_search',{query,limit:3,timeoutMs:8000},8000);
  const rawRows = search?.ok ? (search.result?.results || search.result?.search?.results || []) : [];
  const rows = Array.isArray(rawRows) ? rawRows : [];
  let answer = null;
  let verification = null;
  for (const [index,page] of rows.slice(0,2).entries()) {
    let url;
    try { url = new URL(page.url); } catch (_) { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
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
      } else {
        const fetched = await execute('web_fetch',{url:fetchUrl,options:{timeoutMs:3500,maxBytes:350000}},3500);
        if (!fetched?.ok || !fetched.result?.text) continue;
        if (wiki) {
          const data = JSON.parse(fetched.result.text);
          const canonical = new URL(data.content_urls?.desktop?.page);
          const pathKey = value => decodeURIComponent(value).replace(/_/gu,' ').normalize('NFKC');
          if (canonical.protocol !== 'https:' || canonical.username || canonical.password || canonical.hostname !== url.hostname || pathKey(canonical.pathname) !== pathKey(url.pathname) ||
              typeof data.extract !== 'string' || typeof data.title !== 'string' || data.type === 'disambiguation') continue;
          text = data.extract; title = data.title; url = canonical;
        } else {
          const extracted = await extractContent(fetched.result.text,fetched.result.content_type || 'text/html');
          text = extracted.text; title = extracted.title || page.title;
        }
      }
    } catch (_) { continue; }
    const institution = isInstitutionalDomain(url.toString());
    const source = {id:'office-source-' + index,url:url.toString(),title,text,
      publisher:url.hostname,kind:wiki ? 'live_api_summary' : 'fetched_page',
      authoritative_primary:Boolean(institution && institution.authority_score >= 0.95),
      authority_score:institution?.authority_score || 0};
    const fabric = buildClaimFabric({sources:[source],entityFrame:plan.entity_frame,minIndependentPublishers:1});
    const claims = fabric.fused_claims.filter(claim => claim.predicate === 'relation.holder' &&
      claim.verification_state === 'VERIFIED' && claim.temporal_state !== 'historical');
    if (new Set(claims.map(claim => claim.value_normalized)).size !== 1) continue;
    verification = await execute('evidence_verify',{topic:query,
      sources:[{...source,claims}],minIndependentPublishers:1,
      allowAuthoritativePrimary:source.authoritative_primary},1500);
    if (!verification?.ok || verification.result?.verification_state !== 'SUPPORTED') continue;
    sources.push(source);
    const scope = plan.entity.organization.value.replace(/^وزارة\s+\S+\s*/u,'').trim();
    answer = claims[0].value + ' هو ' + plan.entity.relation.value + (scope ? ' في ' + scope : '') + '.\n\n' + source.url;
    break;
  }
  return {plan,answer,decisionEligible:Boolean(answer),sourceCount:sources.length,
    elapsedMs:Date.now() - started,
    result:{decisionEligible:Boolean(answer),verification_state:answer ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE',
      verification,search,evidence:sources}};
}

module.exports = {runOfficeResearch};
