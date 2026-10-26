'use strict';

const crypto = require('crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function normalizeSource(source = {}, index = 0) {
  return {
    id: String(source.id || `source-${index + 1}`),
    title: source.title || null,
    publisher: source.publisher || source.source_name || source.source || null,
    url: source.url || source.source_url || null,
    kind: source.kind || source.source_type || 'unknown',
    observed_at: source.observed_at || source.observation_at || source.period || null,
    retrieved_at: source.retrieved_at || source.fetched_at || null,
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
    authoritative_primary:Boolean(source.authoritative_primary),
    authority_score:Number.isFinite(Number(source.authority_score)) ? Number(source.authority_score) : null,
    institutional_source_id:source.institutional_source_id || null,
    claims: Array.isArray(source.claims) ? source.claims.map(claim => typeof claim === 'string' ? { claim } : { ...claim }) : [],
    text: String(source.text || '').trim(),
    relevance_score: Number.isFinite(Number(source.relevance_score)) ? Number(source.relevance_score) : undefined,
    relevance_matches: Number.isFinite(Number(source.relevance_matches)) ? Number(source.relevance_matches) : undefined
  };
}

function claimKey(claim) {
  return String(claim.key || claim.metric || claim.claim || '').trim().toLowerCase();
}

function claimValue(claim) {
  return claim.value !== undefined ? claim.value : claim.claim;
}

function verifyEvidence({
  topic,
  sources = [],
  minIndependentPublishers = 2,
  allowAuthoritativePrimary = false,
  allowAuthoritativePrimaryEvidence = false
} = {}) {
  const normalized = sources.map(normalizeSource);
  const publisherSet = new Set(normalized.map(s => String(s.publisher || '').trim().toLowerCase()).filter(Boolean));
  const claimGroups = new Map();

  for (const source of normalized) {
    for (const claim of source.claims) {
      const key = claimKey(claim);
      if (!key) continue;
      if (!claimGroups.has(key)) claimGroups.set(key, []);
      claimGroups.get(key).push({ source, claim, value: claimValue(claim) });
    }
  }

  const contradictions = [];
  const supportedClaims = [];
  for (const [key, items] of claimGroups.entries()) {
    const signatures = new Set(items.map(item => JSON.stringify(item.value)));
    const publishers = new Set(items.map(item => item.source.publisher).filter(Boolean));
    if (signatures.size > 1 && publishers.size > 1) {
      contradictions.push({
        claim: key,
        values: items.map(item => ({ source_id: item.source.id, publisher: item.source.publisher, value: item.value }))
      });
    } else {
      supportedClaims.push({
        claim: key,
        value: items[0]?.value,
        sources: items.map(item => item.source.id),
        independent_publishers: publishers.size
      });
    }
  }

  const hasStructuredClaims = claimGroups.size > 0;
  const hasRelevantSourceEvidence = normalized.length > 0 &&
    normalized.every(source => source.relevance_score === undefined || Number(source.relevance_score) > 0);

  const authoritativePrimaryClaim = allowAuthoritativePrimary &&
    [...claimGroups.values()].some(items =>
      items.some(item =>
        item?.source?.authoritative_primary === true &&
        Number(item?.source?.authority_score || 0) >= 0.95 &&
        String(item?.claim?.predicate || '') === 'relation.holder'
      )
    );

  const authoritativePrimaryEvidence = allowAuthoritativePrimaryEvidence &&
    normalized.some(source =>
      source?.authoritative_primary === true &&
      Number(source?.authority_score || 0) >= 0.95 &&
      (source.relevance_score === undefined || Number(source.relevance_score) > 0)
    );

  const independentPublisherReady =
    publisherSet.size >= Math.max(1, Number(minIndependentPublishers));

  const ready = normalized.length > 0 &&
    (independentPublisherReady || authoritativePrimaryClaim || authoritativePrimaryEvidence) &&
    contradictions.length === 0 &&
    (hasStructuredClaims || hasRelevantSourceEvidence);

  const verificationState = !normalized.length
    ? 'INSUFFICIENT_EVIDENCE'
    : contradictions.length
      ? 'CONTESTED'
      : ready ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE';

  const coverage = claimGroups.size
    ? supportedClaims.length / claimGroups.size
    : (normalized.length ? 0.5 : 0);

  const result = {
    topic: String(topic || '').trim(),
    verification_state: verificationState,
    source_count: normalized.length,
    independent_publisher_count: publisherSet.size,
    supported_claims: supportedClaims,
    contradictions,
    coverage,
    authoritative_primary_used:authoritativePrimaryClaim || authoritativePrimaryEvidence,
    authoritative_primary_evidence_used:authoritativePrimaryEvidence,
    residual_uncertainty: [
      ...(!independentPublisherReady && !authoritativePrimaryClaim && !authoritativePrimaryEvidence ? ['INSUFFICIENT_INDEPENDENT_SOURCES'] : []),
      ...(!claimGroups.size ? ['NO_STRUCTURED_CLAIMS'] : [])
    ],
    sources: normalized
  };
  return {
    ok: verificationState === 'SUPPORTED',
    executed: true,
    result,
    verification_digest: digest(result),
    claim_promotion_allowed: verificationState === 'SUPPORTED'
  };
}

function synthesizeResearch({
  topic,
  sources = [],
  minIndependentPublishers = 2,
  allowAuthoritativePrimary = false,
  allowAuthoritativePrimaryEvidence = false
} = {}) {
  const verification = verifyEvidence({
    topic,
    sources,
    minIndependentPublishers,
    allowAuthoritativePrimary,
    allowAuthoritativePrimaryEvidence
  });
  const known = verification.result.supported_claims.map(item => ({
    claim: item.claim,
    value: item.value,
    source_ids: item.sources
  }));
  const synthesis = {
    topic: verification.result.topic,
    known,
    unknown: verification.result.residual_uncertainty,
    contradictions: verification.result.contradictions,
    evidence_map: known.flatMap(item => item.source_ids.map(sourceId => ({ claim: item.claim, source_id: sourceId }))),
    coverage: verification.result.coverage,
    verification_state: verification.result.verification_state,
    knowledge_update_candidate: verification.ok,
    automatic_persistence: false
  };
  return {
    ok: verification.ok,
    executed: true,
    result: synthesis,
    synthesis_digest: digest(synthesis),
    provenance_preserved: true,
    uncertainty_preserved: true
  };
}

module.exports = { normalizeSource, verifyEvidence, synthesizeResearch };
