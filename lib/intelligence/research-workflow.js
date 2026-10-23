'use strict';

const { executeCapability } = require('../capabilities/governed-executor');

const DEFAULT_CONFIDENCE_THRESHOLD = 70;
const DEFAULT_MAX_PAGES = 8;
const DEFAULT_MAX_DEPTH = 1;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

async function runResearchWorkflow(request = {}, autoPopulate = {}, context = {}) {
  const execute = context.executeCapability || executeCapability;
  const needed = researchNeeded(request, autoPopulate);
  let seeds = collectResearchSeeds(request, autoPopulate);
  let search = null;
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
  if (!seeds.length) {
    const query = researchQuery(request);
    if (!query) {
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

    search = await execute('web_search', {
      query,
      limit: Math.max(2, Math.min(Number(research.searchLimit || 5), 10)),
      timeoutMs: research.timeoutMs
    }, context);

    if (!search?.ok) {
      return {
        status: 'search_failed',
        executed: true,
        needed: true,
        search,
        seeds: [],
        evidence: [],
        unknowns: [search?.error?.code || 'WEB_SEARCH_FAILED'],
        decisionEligible: false
      };
    }

    seeds = unique((search.result?.results || []).map(row => row?.url)).slice(0, DEFAULT_MAX_PAGES);
    if (!seeds.length) {
      return {
        status: 'search_empty',
        executed: true,
        needed: true,
        search,
        seeds: [],
        evidence: [],
        unknowns: ['WEB_SEARCH_NO_SEEDS'],
        decisionEligible: false
      };
    }
  }
  const exploration = await execute('web_explore', {
    seedUrls: seeds,
    maxPages: research.maxPages || DEFAULT_MAX_PAGES,
    maxDepth: research.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxBytesPerPage: research.maxBytesPerPage,
    timeoutMs: research.timeoutMs,
    obeyRobots: research.obeyRobots !== false,
    allowSubdomains: Boolean(research.allowSubdomains)
  }, context);

  if (!exploration.ok) {
    return {
      status: 'acquisition_failed',
      executed: true,
      needed: true,
      search,
      seeds,
      exploration,
      evidence: [],
      unknowns: ['WEB_ACQUISITION_FAILED'],
      decisionEligible: false
    };
  }

  const pages = exploration.result?.pages || [];
  const sources = pages.map((page, index) => pageToSource(page, index, request));
  const verification = await execute('evidence_verify', {
    topic: research.topic || request.input || request.intent || 'research',
    sources,
    minIndependentPublishers: research.minIndependentPublishers || 2
  }, context);

  const synthesis = await execute('research_synthesize', {
    topic: research.topic || request.input || request.intent || 'research',
    sources,
    minIndependentPublishers: research.minIndependentPublishers || 2
  }, context);

  const evidence = verification.ok ? supportedClaimsAsEvidence(verification) : [];
  const status = verification.result?.verification_state || 'INSUFFICIENT_EVIDENCE';

  return {
    status,
    executed: true,
    needed: true,
    search,
    seeds,
    exploration,
    verification,
    synthesis,
    evidence,
    unknowns: synthesis.result?.unknown || verification.result?.residual_uncertainty || [],
    contradictions: verification.result?.contradictions || [],
    decisionEligible: verification.ok === true && evidence.length > 0
  };
}

module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  researchQuery,
  collectResearchSeeds,
  researchNeeded,
  flattenJsonClaims,
  pageToSource,
  supportedClaimsAsEvidence,
  runResearchWorkflow
};
