'use strict';

const { executeCapability } = require('../capabilities/governed-executor');
const {
  IDENTITY_VERIFICATION_STATES,
  resolveCandidateIdentity,
  verifyPersonIdentity
} = require('../assistant/person-identity');
const { resolveEntityFrame } = require('./entity-resolution');
const { routeIntelligenceRequest } = require('./intelligence-router');
const { buildClaimFabric } = require('./claim-fabric');

const DEFAULT_CONFIDENCE_THRESHOLD = 70;
const DEFAULT_MAX_PAGES = 8;
const DEFAULT_MAX_DEPTH = 1;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pageIdentity(page = {}) {
  return String(page.url || '').trim();
}

function mergeUniquePages(...groups) {
  const seen = new Set();
  const pages = [];
  for (const group of groups) {
    for (const page of Array.isArray(group) ? group : []) {
      const key = pageIdentity(page);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      pages.push(page);
    }
  }
  return pages;
}

function researchQuery(request = {}) {
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  return String(
    research.query ||
    research.topic ||
    request.query ||
    request.input ||
    request.intent ||
    ''
  ).trim().slice(0, 500);
}

function researchQueryVariants(request = {}) {
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  const raw = [
    ...(Array.isArray(research.queryVariants) ? research.queryVariants : []),
    ...(Array.isArray(request.queryVariants) ? request.queryVariants : []),
    researchQuery(request)
  ];
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    const query = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!query) continue;
    const key = query.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= 8) break;
  }
  return out;
}

function collectResearchSeeds(request = {}, autoPopulate = {}) {
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  const explicit = [
    ...(Array.isArray(request.researchUrls) ? request.researchUrls : []),
    ...(Array.isArray(request.sourceUrls) ? request.sourceUrls : []),
    ...(Array.isArray(research.urls) ? research.urls : []),
    ...(Array.isArray(research.seedUrls) ? research.seedUrls : [])
  ];

  const fromLiveData = (request.liveDataRecords || []).flatMap(record => [
    record?.source_url,
    record?.sourceUrl,
    record?.url
  ]);

  const fromAutoPopulate = (autoPopulate.populated || []).flatMap(item => [
    item?.evidence?.source_url,
    item?.evidence?.sourceUrl,
    item?.evidence?.url,
    item?.verification?.source_url,
    item?.verification?.sourceUrl
  ]);

  return unique([...explicit, ...fromLiveData, ...fromAutoPopulate]);
}

function researchNeeded(request = {}, autoPopulate = {}) {
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  if (research.enabled === false || request.disableAutomaticResearch === true) return false;
  if (research.enabled === true || request.forceResearch === true) return true;

  const threshold = Number(research.confidenceThreshold ?? request.researchConfidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD);
  const overallConfidence = Number(autoPopulate.overallConfidence || 0);
  const hasMissing = Array.isArray(autoPopulate.manual) && autoPopulate.manual.length > 0;
  return hasMissing || overallConfidence < threshold;
}

function flattenJsonClaims(value, prefix = '', out = []) {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    if (value.length <= 20 && value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      out.push({ key: prefix || 'value', value });
    }
    return out;
  }
  if (typeof value !== 'object') {
    out.push({ key: prefix || 'value', value });
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object') {
      flattenJsonClaims(child, next, out);
    } else {
      out.push({ key: next, value: child });
    }
    if (out.length >= 250) break;
  }
  return out;
}

function csvClaims(extracted = {}) {
  const rows = Array.isArray(extracted.rows) ? extracted.rows : [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  const claims = [];
  for (const row of rows.slice(1, 21)) {
    for (let i = 0; i < Math.min(headers.length, row.length); i++) {
      const key = String(headers[i] || '').trim();
      if (!key) continue;
      claims.push({ key, value: row[i] });
      if (claims.length >= 250) return claims;
    }
  }
  return claims;
}


function normalizeResearchText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function researchTerms(value) {
  const stop = new Set([
    '\u0645\u0646','\u0645\u0627','\u0645\u0627\u0630\u0627','\u0639\u0646','\u0647\u0648','\u0647\u064a',
    '\u0641\u064a','\u0639\u0644\u0649','\u0627\u0644\u0649','\u0625\u0644\u0649','\u0648\u0634','\u0627\u064a\u0634',
    'who','what','about','the','is','are','tell','me'
  ]);

  return [...new Set(
    normalizeResearchText(value)
      .toLocaleLowerCase('ar')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(term => term.length >= 2 && !stop.has(term))
  )].slice(0, 12);
}


function relevanceProfile(value) {
  const generic = new Set([
    '\u0633\u064a\u0631\u0629','\u0627\u0644\u0633\u064a\u0631\u0629','\u0627\u0644\u062f\u0643\u062a\u0648\u0631','\u062f\u0643\u062a\u0648\u0631',
    'biography','profile','official','about','latest','dr'
  ]);
  const terms = researchTerms(value).filter(term => !generic.has(term));
  const requiredMatches = terms.length <= 3
    ? terms.length
    : Math.max(3, Math.ceil(terms.length * 0.75));

  return {
    terms,
    requiredMatches
  };
}

function textRelevance(value, query) {
  const text = normalizeResearchText(value).toLocaleLowerCase('ar');
  const profile = relevanceProfile(query);
  if (!profile.terms.length || !text) return { score:0, matches:0, required:profile.requiredMatches, relevant:false };
  const matches = profile.terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
  return {
    score:matches / profile.terms.length,
    matches,
    required:profile.requiredMatches,
    relevant:matches >= profile.requiredMatches
  };
}

function searchResultRelevance(row = {}, query = '') {
  const combined = [row.title, row.snippet, row.url].filter(Boolean).join(' ');
  return textRelevance(combined, query);
}

function rankRelevantSearchResults(results = [], query = '') {
  return (Array.isArray(results) ? results : [])
    .map((row, index) => ({ row, index, relevance:searchResultRelevance(row, query) }))
    .filter(item => item.relevance.relevant)
    .sort((a, b) =>
      b.relevance.score - a.relevance.score ||
      b.relevance.matches - a.relevance.matches ||
      a.index - b.index
    )
    .map(item => ({
      ...item.row,
      relevance_score:item.relevance.score,
      relevance_matches:item.relevance.matches
    }));
}

function pageRelevance(page = {}, query = '') {
  const extracted = page.extracted || {};
  const combined = [
    extracted.title,
    extracted.text,
    page.url
  ].filter(Boolean).join(' ');
  return textRelevance(combined, query);
}

function filterRelevantPages(pages = [], query = '') {
  return (Array.isArray(pages) ? pages : [])
    .map(page => ({ page, relevance:pageRelevance(page, query) }))
    .filter(item => item.relevance.relevant)
    .sort((a, b) =>
      b.relevance.score - a.relevance.score ||
      b.relevance.matches - a.relevance.matches
    )
    .map(item => ({
      ...item.page,
      relevance_score:item.relevance.score,
      relevance_matches:item.relevance.matches
    }));
}

function htmlEvidenceClaims(extracted = {}, query = '') {
  if (String(extracted.format || '').toLowerCase() !== 'html') return [];

  const text = normalizeResearchText(extracted.text);
  if (!text) return [];

  const terms = researchTerms(query);
  const requiredMatches = relevanceProfile(query).requiredMatches;
  const sentences = text
    .split(/(?<=[.!?\u061f])\s+|\n+/u)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 30 && sentence.length <= 900);

  return sentences
    .map((sentence, index) => {
      const lower = sentence.toLocaleLowerCase('ar');
      const relevance = terms.reduce(
        (score, term) => score + (lower.includes(term) ? 1 : 0),
        0
      );

      return {
        text: sentence.slice(0, 700),
        relevance,
        position: index
      };
    })
    .filter(item => !terms.length || item.relevance >= requiredMatches)
    .sort((a, b) => b.relevance - a.relevance || a.position - b.position)
    .slice(0, 6);
}

function explicitClaimsForUrl(request = {}, url) {
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  const maps = [research.claimsByUrl, request.researchClaimsByUrl].filter(v => v && typeof v === 'object');
  for (const map of maps) {
    const claims = map[url];
    if (Array.isArray(claims)) return claims;
  }
  return [];
}

function pageToSource(page, index, request = {}) {
  const extracted = page.extracted || {};
  let claims = explicitClaimsForUrl(request, page.url);

  if (!claims.length && extracted.format === 'json' && extracted.data && typeof extracted.data === 'object') {
    claims = flattenJsonClaims(extracted.data);
  } else if (!claims.length && extracted.format === 'csv') {
    claims = csvClaims(extracted);
  }

  const publisher = (() => {
    try { return new URL(page.url).hostname; } catch (_) { return page.url || `source-${index + 1}`; }
  })();

  return {
    id: `web-source-${index + 1}`,
    title: extracted.title || null,
    publisher,
    url: page.url,
    kind: page.evidence?.content_type || extracted.format || 'web',
    observed_at: page.evidence?.headers?.['last-modified'] || null,
    retrieved_at: new Date().toISOString(),
    confidence: null,
    claims,
    candidate_claims: htmlEvidenceClaims(
      extracted,
      researchQuery(request)
    ),
    text: extracted.text || ''
  };
}

function supportedClaimsAsEvidence(verification = {}) {
  const sourceRows = verification.result?.sources || [];
  const sources = new Map(sourceRows.map(source => [source.id, source]));
  const evidence = [];
  for (const claim of verification.result?.supported_claims || []) {
    for (const sourceId of claim.sources || []) {
      const source = sources.get(sourceId);
      if (!source) continue;
      evidence.push({
        source: source.publisher || source.url || sourceId,
        source_url: source.url || null,
        source_type: 'VERIFIED_EXTERNAL',
        evidence_type: 'research_claim',
        evidence_code: claim.claim,
        value: claim.value,
        confidence: source.confidence ?? 80,
        observation_at: source.observed_at || null,
        retrieved_at: source.retrieved_at || null,
        validation_status: 'verified',
        metadata: {
          research_source_id: sourceId,
          independent_publishers: claim.independent_publishers,
          verification_state: verification.result.verification_state
        }
      });
    }
  }

  // Generic HTML research often has trustworthy extracted text but no structured
  // key/value claims. Preserve those independently verified sources as evidence
  // instead of discarding the entire research turn.
  if (!evidence.length && verification.ok === true) {
    for (const source of sourceRows) {
      const text = String(source?.text || '').trim();
      if (!text || !source?.url) continue;
      evidence.push({
        source: source.publisher || source.url || source.id,
        source_url: source.url,
        source_type: 'VERIFIED_EXTERNAL',
        evidence_type: 'research_source',
        evidence_code: 'source_content',
        value: text.slice(0, 5000),
        confidence: source.confidence ?? null,
        observation_at: source.observed_at || null,
        retrieved_at: source.retrieved_at || null,
        validation_status: 'source_verified',
        metadata: {
          research_source_id: source.id,
          verification_state: verification.result.verification_state,
          structured_claim: false
        }
      });
    }
  }
  return evidence;
}

function retryableSearchFailure(search = {}) {
  if (search?.ok === true) return false;
  const attempts = Array.isArray(search?.error?.attempts)
    ? search.error.attempts
    : Array.isArray(search?.evidence?.attempts)
      ? search.evidence.attempts
      : [];
  if (!attempts.length) return false;

  const transient = attempts.filter(item => {
    const status = Number(item?.status_code || 0);
    const failure = String(item?.failure_class || '');
    return status === 429 ||
      (status >= 500 && status <= 599) ||
      ['TIMEOUT', 'CONNECT_OR_DNS_FAILURE', 'READ_FAILURE'].includes(failure);
  });
  const hardNoResult = attempts.some(item => item?.code === 'SEARCH_NO_RESULTS' && Number(item?.status_code || 0) === 200);
  return transient.length > 0 && !hardNoResult;
}

async function runResearchWorkflow(request = {}, autoPopulate = {}, context = {}) {
  const execute = context.executeCapability || executeCapability;
  const researchTimings = {
    search_ms:0,
    explore_ms:0,
    verify_ms:0,
    synthesize_ms:0
  };

  async function timedExecute(action, input, timingKey) {
    const started = Date.now();
    try {
      return await execute(action, input, context);
    } finally {
      if (timingKey) {
        researchTimings[timingKey] += Date.now() - started;
      }
    }
  }
  const needed = researchNeeded(request, autoPopulate);
  let seeds = collectResearchSeeds(request, autoPopulate);
  const queryLedResearch = seeds.length === 0;
  let search = null;
  let searchAttempts = [];
  if (!needed) {
    return {
      status: 'not_required',
      executed: false,
      needed: false,
      seeds,
      evidence: [],
      decisionEligible: true
    };
  }
  const research = request.research && typeof request.research === 'object' ? request.research : {};
  const personEntityFrame =
    research.personEntityFrame ||
    request.personEntityFrame ||
    null;
  const entityFrame =
    research.entityFrame ||
    request.entityFrame ||
    (personEntityFrame
      ? resolveEntityFrame({
          type:'person',
          text:personEntityFrame.canonical_name,
          confidence:personEntityFrame.confidence,
          person_entity_frame:personEntityFrame
        }, { rawMention:personEntityFrame.raw_mention })
      : null);
  const intelligenceRoute = routeIntelligenceRequest({
    intent:research.intent || request.intent || 'research',
    entityFrame
  });
  if (!seeds.length) {
    const queries = researchQueryVariants(request);
    if (!queries.length) {
      return {
        status: 'insufficient_inputs',
        executed: false,
        needed: true,
        seeds: [],
        evidence: [],
        unknowns: ['NO_RESEARCH_QUERY_OR_SEEDS'],
        decisionEligible: false
      };
    }

    let selectedQuery = null;
    let anySearchSucceeded = false;
    const rankedCandidates = [];
    const relevanceQueries = [];

    for (const query of queries) {
      const searchInput = {
        query,
        limit: Math.max(2, Math.min(Number(research.searchLimit || 5), 10)),
        timeoutMs: research.timeoutMs
      };
      let attempt = await timedExecute('web_search', searchInput, 'search_ms');
      const attemptRecord = { query, execution:attempt };
      searchAttempts.push(attemptRecord);

      if (!attempt?.ok && retryableSearchFailure(attempt)) {
        const retry = await timedExecute('web_search', searchInput, 'search_ms');
        searchAttempts.push({ query, execution:retry, retry:true });
        attempt = retry;
      }

      if (!attempt?.ok) {
        search = attempt;
        continue;
      }

      anySearchSucceeded = true;
      const relevantResults = personEntityFrame
        ? (attempt.result?.results || [])
            .map((row, index) => {
              const candidateIdentity = resolveCandidateIdentity(personEntityFrame, row, index);
              if (!candidateIdentity || candidateIdentity.name_score < 0.75) return null;
              return {
                ...row,
                candidate_identity:candidateIdentity,
                relevance_score:candidateIdentity.confidence,
                relevance_matches:Math.round(candidateIdentity.name_score * 100)
              };
            })
            .filter(Boolean)
            .sort((a, b) =>
              Number(b.candidate_identity?.confidence || 0) -
              Number(a.candidate_identity?.confidence || 0)
            )
        : rankRelevantSearchResults(
            attempt.result?.results || [],
            query
          );

      attemptRecord.relevance_checked = true;
      attemptRecord.relevant_result_count = relevantResults.length;

      if (!relevantResults.length) {
        search = attempt;
        continue;
      }

      if (!selectedQuery) selectedQuery = query;
      relevanceQueries.push(query);
      rankedCandidates.push(...relevantResults.map(row => ({ ...row, query })));
    }

    if (!rankedCandidates.length) {
      if (!anySearchSucceeded) {
        return {
          status:'search_failed',
          executed:true,
          needed:true,
          search,
          selected_query:null,
          attempted_queries:queries,
          search_attempts:searchAttempts,
          seeds:[],
          evidence:[],
          unknowns:[search?.error?.code || 'WEB_SEARCH_FAILED'],
          decisionEligible:false
        };
      }

      return {
        status:'search_low_relevance',
        executed:true,
        needed:true,
        search,
        selected_query:null,
        attempted_queries:queries,
        search_attempts:searchAttempts,
        seeds:[],
        evidence:[],
        unknowns:['SEARCH_LOW_RELEVANCE'],
        decisionEligible:false
      };
    }

    const seenUrls = new Set();
    const mergedResults = rankedCandidates
      .sort((a, b) =>
        Number(b.relevance_score || 0) - Number(a.relevance_score || 0) ||
        Number(b.relevance_matches || 0) - Number(a.relevance_matches || 0)
      )
      .filter(row => {
        const url = String(row?.url || '').trim();
        if (!url || seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      })
      .slice(0, DEFAULT_MAX_PAGES);

    search = {
      ok:true,
      executed:true,
      result:{
        query:selectedQuery,
        results:mergedResults,
        result_count:mergedResults.length
      }
    };

    seeds = mergedResults.map(row => row.url);
    research.selectedQuery = selectedQuery;
    research.relevanceQueries = relevanceQueries;
  }
  let explorationStartedAt = Date.now();
  let exploration = await execute('web_explore', {
    seedUrls: seeds,
    maxPages: research.maxPages || DEFAULT_MAX_PAGES,
    maxDepth: research.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxBytesPerPage: research.maxBytesPerPage,
    timeoutMs: research.timeoutMs,
    obeyRobots: research.obeyRobots !== false,
    allowSubdomains: Boolean(research.allowSubdomains)
  }, context);

  researchTimings.explore_ms += Date.now() - explorationStartedAt;

  if (!exploration.ok) {
    return {
      status: 'acquisition_failed',
      executed: true,
      needed: true,
      search,
      selected_query:research.selectedQuery || null,
      attempted_queries:researchQueryVariants(request),
      search_attempts:searchAttempts,
      seeds,
      exploration,
      evidence: [],
      unknowns: ['WEB_ACQUISITION_FAILED'],
      decisionEligible: false
    };
  }

  let pages = exploration.result?.pages || [];
  const minPublishers = research.minIndependentPublishers || 2;

  // A batch crawl can return fewer usable pages than the search returned
  // because one seed redirects, blocks traversal, or fails independently.
  // Recover only from the original verified search seeds: retry missing seeds
  // one-by-one and merge unique acquired pages. Search snippets themselves are
  // never promoted to evidence, and the independent-source threshold remains.
  if (pages.length < minPublishers && seeds.length > pages.length) {
    const acquired = new Set(pages.map(pageIdentity).filter(Boolean));
    const retrySeeds = seeds.filter(seed => !acquired.has(String(seed || '').trim()));
    const recoveryAttempts = [];

    for (const seed of retrySeeds) {
      if (pages.length >= minPublishers) break;
      const recoveryStartedAt = Date.now();
      const recovery = await execute('web_explore', {
        seedUrls:[seed],
        maxPages:1,
        maxDepth:0,
        maxBytesPerPage:research.maxBytesPerPage,
        timeoutMs:research.timeoutMs,
        obeyRobots:research.obeyRobots !== false,
        allowSubdomains:Boolean(research.allowSubdomains)
      }, context);
      researchTimings.explore_ms += Date.now() - recoveryStartedAt;
      recoveryAttempts.push({ seed, execution:recovery });
      if (recovery?.ok) {
        pages = mergeUniquePages(pages, recovery.result?.pages || []);
      }
    }

    exploration = {
      ...exploration,
      result:{
        ...(exploration.result || {}),
        pages,
        recovery_attempts:recoveryAttempts
      }
    };
  }
  if (queryLedResearch) {
    const relevanceQueries = Array.isArray(research.relevanceQueries) && research.relevanceQueries.length
      ? research.relevanceQueries
      : researchQueryVariants(request);

    const relevantPages = (Array.isArray(pages) ? pages : [])
      .map((page, pageIndex) => {
        if (personEntityFrame) {
          const candidateIdentity = resolveCandidateIdentity(personEntityFrame, page, pageIndex);
          if (!candidateIdentity || candidateIdentity.name_score < 0.75) return null;
          return {
            ...page,
            candidate_identity:candidateIdentity,
            relevance_score:candidateIdentity.confidence,
            relevance_matches:Math.round(candidateIdentity.name_score * 100),
            relevance_query:personEntityFrame.canonical_name
          };
        }

        const matches = relevanceQueries
          .map(query => ({ query, relevance:pageRelevance(page, query) }))
          .filter(item => item.relevance.relevant)
          .sort((a, b) =>
            b.relevance.score - a.relevance.score ||
            b.relevance.matches - a.relevance.matches
          );
        return matches.length
          ? {
              ...page,
              relevance_score:matches[0].relevance.score,
              relevance_matches:matches[0].relevance.matches,
              relevance_query:matches[0].query
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) =>
        Number(b.relevance_score || 0) - Number(a.relevance_score || 0) ||
        Number(b.relevance_matches || 0) - Number(a.relevance_matches || 0)
      );

    if (relevantPages.length < Math.max(1, minPublishers)) {
      return {
        status:'insufficient_relevant_evidence',
        executed:true,
        needed:true,
        search,
        selected_query:research.selectedQuery || null,
        attempted_queries:researchQueryVariants(request),
        search_attempts:searchAttempts,
        seeds,
        exploration:{
          ...exploration,
          result:{
            ...(exploration.result || {}),
            pages,
            relevant_pages:relevantPages
          }
        },
        evidence:[],
        unknowns:['INSUFFICIENT_RELEVANT_EVIDENCE'],
        contradictions:[],
        timings:researchTimings,
        decisionEligible:false
      };
    }

    pages = relevantPages;
  }

  const candidateIdentities = personEntityFrame
    ? pages.map((page, index) =>
        page.candidate_identity || resolveCandidateIdentity(personEntityFrame, page, index)
      ).filter(Boolean)
    : [];

  const verifiedIdentity = personEntityFrame
    ? verifyPersonIdentity(personEntityFrame, candidateIdentities, {
        minSupportingSources:Math.max(1, minPublishers)
      })
    : null;

  if (
    personEntityFrame &&
    verifiedIdentity?.verification_state !== IDENTITY_VERIFICATION_STATES.VERIFIED
  ) {
    return {
      status:'identity_unverified',
      executed:true,
      needed:true,
      search,
      selected_query:research.selectedQuery || null,
      attempted_queries:researchQueryVariants(request),
      search_attempts:searchAttempts,
      seeds,
      exploration,
      person_entity_frame:personEntityFrame,
      candidate_identities:candidateIdentities,
      verified_identity:verifiedIdentity,
      evidence:[],
      unknowns:['PERSON_IDENTITY_' + String(
        verifiedIdentity?.verification_state || IDENTITY_VERIFICATION_STATES.INSUFFICIENT_EVIDENCE
      )],
      contradictions:verifiedIdentity?.unresolved_conflicts || [],
      timings:researchTimings,
      decisionEligible:false
    };
  }

  const rawSources = pages.map((page, index) => pageToSource(page, index, request));
  const claimFabric = buildClaimFabric({
    sources:rawSources,
    entityFrame,
    minIndependentPublishers:minPublishers
  });
  const sources = claimFabric.sources;

  const verificationStartedAt = Date.now();
  const verification = await execute('evidence_verify', {
    topic: research.topic || request.input || request.intent || 'research',
    sources,
    minIndependentPublishers: minPublishers
  }, context);

  researchTimings.verify_ms += Date.now() - verificationStartedAt;

  const synthesisStartedAt = Date.now();
  const synthesis = await execute('research_synthesize', {
    topic: research.topic || request.input || request.intent || 'research',
    sources,
    minIndependentPublishers: minPublishers
  }, context);

  researchTimings.synthesize_ms += Date.now() - synthesisStartedAt;

  const evidence = verification.ok ? supportedClaimsAsEvidence(verification) : [];
  const status = verification.result?.verification_state || 'INSUFFICIENT_EVIDENCE';

  return {
    status,
    executed: true,
    needed: true,
    search,
    selected_query:research.selectedQuery || null,
    attempted_queries:researchQueryVariants(request),
    search_attempts:searchAttempts,
    seeds,
    exploration,
    entity_frame:entityFrame,
    intelligence_route:intelligenceRoute,
    person_entity_frame:personEntityFrame,
    candidate_identities:candidateIdentities,
    verified_identity:verifiedIdentity,
    claim_fabric:claimFabric,
    verification,
    synthesis,
    evidence,
    timings:researchTimings,
    unknowns: synthesis.result?.unknown || verification.result?.residual_uncertainty || [],
    contradictions:[
      ...(claimFabric?.contradictions || []),
      ...(verification.result?.contradictions || [])
    ],
    decisionEligible:
      verification.ok === true &&
      evidence.length > 0 &&
      (!personEntityFrame || verifiedIdentity?.verification_state === IDENTITY_VERIFICATION_STATES.VERIFIED)
  };
}

module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  researchQuery,
  researchQueryVariants,
  mergeUniquePages,
  retryableSearchFailure,
  collectResearchSeeds,
  researchNeeded,
  flattenJsonClaims,
  relevanceProfile,
  textRelevance,
  searchResultRelevance,
  rankRelevantSearchResults,
  pageRelevance,
  filterRelevantPages,
  htmlEvidenceClaims,
  pageToSource,
  supportedClaimsAsEvidence,
  runResearchWorkflow
};
