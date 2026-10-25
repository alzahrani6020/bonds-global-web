'use strict';

const CLAIM_FABRIC_SCHEMA_VERSION = 1;

const ROLE_PATTERNS = Object.freeze([
  { id:'crown_prince', ar:'ولي العهد', en:'crown prince', re:/(?:ولي\s+(?:ال)?عهد|crown\s+prince)/iu },
  { id:'prime_minister', ar:'رئيس مجلس الوزراء', en:'prime minister', re:/(?:رئيس\s+مجلس\s+الوزراء|prime\s+minister)/iu },
  { id:'president', ar:'رئيس', en:'president', re:/(?:رئيس|president)/iu },
  { id:'ceo', ar:'الرئيس التنفيذي', en:'chief executive officer', re:/(?:الرئيس\s+التنفيذي|chief\s+executive(?:\s+officer)?|\bceo\b)/iu },
  { id:'chairman', ar:'رئيس مجلس الإدارة', en:'chairman', re:/(?:رئيس\s+مجلس\s+الإدارة|chairman|chairperson)/iu },
  { id:'minister', ar:'وزير', en:'minister', re:/(?:وزير|minister)/iu },
  { id:'advisor', ar:'مستشار', en:'advisor', re:/(?:مستشار|advisor|adviser)/iu },
  { id:'lawyer', ar:'محام', en:'lawyer', re:/(?:محام(?:ي|ٍ)?|lawyer|attorney)/iu },
  { id:'doctor', ar:'طبيب', en:'doctor', re:/(?:طبيب|doctor|physician)/iu },
  { id:'engineer', ar:'مهندس', en:'engineer', re:/(?:مهندس|engineer)/iu },
  { id:'founder', ar:'مؤسس', en:'founder', re:/(?:مؤسس|founder|co-founder)/iu }
]);

const METRIC_PATTERNS = Object.freeze([
  { id:'revenue', re:/(?:الإيرادات|الايرادات|revenue|sales)/iu },
  { id:'profit', re:/(?:الأرباح|الارباح|صافي\s+الربح|profit|net\s+income)/iu },
  { id:'growth', re:/(?:النمو|growth)/iu },
  { id:'market_share', re:/(?:الحصة\s+السوقية|market\s+share)/iu }
]);

const SOURCE_NOISE = /(?:انتقل إلى المحتوى|القائمة الرئيسة|تسجيل دخول|إنشاء حساب|ويكيميديا|ويكي بيانات|طباعة\/تصدير|href\s*=|class\s*=|data-[a-z-]+\s*=)/iu;
const SOURCE_TITLE_PREFIX = /^[\s"'“”‘’«»↑↓•·*#()\[\]{}<>]*(?:لقاء|مقابلة|حديث|تصريحات|تصريح|خبر|فيديو|صورة|صفحة|سيرة|interview|video|photo|profile|biography|news)(?=\s|$)/iu;

function clean(value, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value, 2000)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function languageOf(value) {
  return /[\u0600-\u06FF]/u.test(String(value || '')) ? 'ar' : 'en';
}

function temporalState(sentence) {
  const text = normalize(sentence);
  if (/(?:سابق|سابقا|سابقًا|former|previously|formerly)/iu.test(text)) return 'historical';
  if (/(?:حاليا|حالياً|الحالي|الحالية|current|currently|now)/iu.test(text)) return 'current';
  return 'unspecified';
}

function referenceYear(sentence) {
  const match = String(sentence || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function candidateSentences(source = {}) {
  const candidates = [];
  for (const item of Array.isArray(source.candidate_claims) ? source.candidate_claims : []) {
    const text = clean(item?.text);
    if (text) candidates.push({ text, origin:'candidate_claim' });
  }

  if (!candidates.length) {
    const text = clean(source.text, 10000);
    for (const sentence of text.split(/(?<=[.!?\u061f])\s+|\n+/u).slice(0, 80)) {
      const value = clean(sentence);
      if (value.length >= 20 && value.length <= 900) candidates.push({ text:value, origin:'source_text' });
    }
  }
  return candidates.slice(0, 16);
}

function sourcePublisher(source = {}) {
  return clean(source.publisher || source.source_name || source.url || source.id, 500);
}

function claimBase({ key, subject, predicate, value, sentence, source, origin, confidence = 0.82 }) {
  const year = referenceYear(sentence);
  return {
    key,
    subject,
    predicate,
    value,
    value_normalized: normalize(value),
    temporal_state: temporalState(sentence),
    reference_year: year,
    observed_at: source.observed_at || null,
    source_id: source.id || null,
    publisher: sourcePublisher(source),
    source_url: source.url || null,
    confidence,
    provenance: {
      extraction: 'deterministic',
      origin,
      sentence: clean(sentence, 700)
    }
  };
}

function extractPersonClaims(sentence, source, entityFrame, origin) {
  const canonical = clean(entityFrame?.canonical_name, 300);
  const normalizedSentence = normalize(sentence);
  if (!canonical || !normalizedSentence.includes(normalize(canonical))) return [];

  const lang = languageOf(sentence);
  const claims = [];
  for (const role of ROLE_PATTERNS) {
    if (!role.re.test(sentence)) continue;
    const value = lang === 'ar' ? role.ar : role.en;
    claims.push(claimBase({
      key:'person.role.' + role.id,
      subject:canonical,
      predicate:'person.role',
      value,
      sentence,
      source,
      origin,
      confidence:0.9
    }));
  }

  const born = sentence.match(/(?:ولد(?:ت)?|born)(?:\s+في|\s+on|\s+in)?[^\d]{0,24}\b((?:19|20)\d{2})\b/iu);
  if (born) {
    claims.push(claimBase({
      key:'person.birth_year',
      subject:canonical,
      predicate:'person.birth_year',
      value:Number(born[1]),
      sentence,
      source,
      origin,
      confidence:0.9
    }));
  }
  return claims;
}

function extractOrganizationClaims(sentence, source, entityFrame, origin) {
  const canonical = clean(entityFrame?.canonical_name, 300);
  if (!canonical || !normalize(sentence).includes(normalize(canonical))) return [];
  const claims = [];

  const founded = sentence.match(/(?:تأسست|تاسست|founded|established)[^\d]{0,32}\b((?:18|19|20)\d{2})\b/iu);
  if (founded) {
    claims.push(claimBase({
      key:'organization.founded_year',
      subject:canonical,
      predicate:'organization.founded_year',
      value:Number(founded[1]),
      sentence,
      source,
      origin,
      confidence:0.9
    }));
  }
  return claims;
}

function extractMetricClaims(sentence, source, entityFrame, origin) {
  const claims = [];
  const year = referenceYear(sentence);
  const numerics = [...String(sentence || '').matchAll(/(?:SAR|ر\.س|ريال|USD|دولار|%|٪)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(%|٪|مليون|مليار|million|billion|SAR|USD|ريال|دولار)?/giu)]
    .map(match => ({
      raw:match[0],
      number:match[1],
      unit:match[2] || null
    }))
    .filter(item => !(year && Number(String(item.number).replace(/,/g, '')) === year));

  if (!numerics.length) return claims;
  const numeric = numerics[numerics.length - 1];

  for (const metric of METRIC_PATTERNS) {
    if (!metric.re.test(sentence)) continue;
    const value = [numeric.number, numeric.unit].filter(Boolean).join(' ');
    const suffix = year ? '.' + year : '';
    claims.push(claimBase({
      key:'metric.' + metric.id + suffix,
      subject:clean(entityFrame?.canonical_name || 'research_topic', 300),
      predicate:'metric.' + metric.id,
      value,
      sentence,
      source,
      origin,
      confidence:0.76
    }));
  }
  return claims;
}

function extractStructuredClaims(source = {}, entityFrame = null) {
  const claims = [];
  for (const candidate of candidateSentences(source)) {
    const sentence = candidate.text;
    if (!sentence || SOURCE_NOISE.test(sentence) || SOURCE_TITLE_PREFIX.test(sentence)) continue;

    if (entityFrame?.entity_type === 'person') {
      claims.push(...extractPersonClaims(sentence, source, entityFrame, candidate.origin));
    } else if (entityFrame?.entity_type === 'company' || entityFrame?.entity_type === 'organization') {
      claims.push(...extractOrganizationClaims(sentence, source, entityFrame, candidate.origin));
    }
    claims.push(...extractMetricClaims(sentence, source, entityFrame, candidate.origin));
  }

  const seen = new Set();
  return claims.filter(claim => {
    const key = claim.key + '|' + claim.value_normalized + '|' + claim.source_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 32);
}

function enrichSourcesWithStructuredClaims(sources = [], entityFrame = null) {
  return (Array.isArray(sources) ? sources : []).map(source => {
    const explicit = Array.isArray(source.claims) ? source.claims : [];
    const extracted = extractStructuredClaims(source, entityFrame);
    return {
      ...source,
      explicit_claims:explicit,
      claims: explicit.length ? explicit : extracted,
      structured_claims: extracted
    };
  });
}

function claimSignature(claim) {
  return String(claim.key || '') + '|' + String(claim.value_normalized ?? normalize(claim.value));
}

function isSingleValuedPredicate(predicate) {
  return [
    'person.birth_year',
    'organization.founded_year'
  ].includes(String(predicate || '')) || String(predicate || '').startsWith('metric.');
}

function verifyStructuredClaims(sources = [], minIndependentPublishers = 2) {
  const groups = new Map();
  for (const source of sources || []) {
    for (const claim of source.structured_claims || []) {
      const sig = claimSignature(claim);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(claim);
    }
  }

  const verified = [];
  const supported = [];
  for (const items of groups.values()) {
    const publishers = new Set(items.map(item => normalize(item.publisher)).filter(Boolean));
    const base = items[0];
    const row = {
      ...base,
      supporting_sources:[...new Set(items.map(item => item.source_id).filter(Boolean))],
      independent_publishers:publishers.size,
      verification_state:publishers.size >= Math.max(1, Number(minIndependentPublishers) || 1)
        ? 'VERIFIED'
        : 'SUPPORTED',
      confidence:Math.min(0.99, Number(base.confidence || 0.7) + Math.min(0.18, publishers.size * 0.06))
    };
    if (row.verification_state === 'VERIFIED') verified.push(row);
    else supported.push(row);
  }

  return { verified, supported };
}

function detectClaimContradictions(claims = []) {
  const groups = new Map();
  for (const claim of claims || []) {
    if (!isSingleValuedPredicate(claim.predicate)) continue;
    const timeKey = claim.reference_year || claim.temporal_state || 'unspecified';
    const key = [claim.subject, claim.predicate, timeKey].map(normalize).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(claim);
  }

  const contradictions = [];
  for (const items of groups.values()) {
    const values = new Map();
    for (const item of items) {
      const key = item.value_normalized || normalize(item.value);
      if (!values.has(key)) values.set(key, []);
      values.get(key).push(item);
    }
    if (values.size <= 1) continue;
    contradictions.push({
      subject:items[0]?.subject || null,
      predicate:items[0]?.predicate || null,
      reference_year:items[0]?.reference_year || null,
      values:[...values.entries()].map(([value, rows]) => ({
        value,
        sources:[...new Set(rows.flatMap(row => row.supporting_sources || [row.source_id]).filter(Boolean))]
      }))
    });
  }
  return contradictions;
}

function buildClaimFabric({ sources = [], entityFrame = null, minIndependentPublishers = 2 } = {}) {
  const enrichedSources = enrichSourcesWithStructuredClaims(sources, entityFrame);
  const verification = verifyStructuredClaims(enrichedSources, minIndependentPublishers);
  const contradictions = detectClaimContradictions([
    ...verification.verified,
    ...verification.supported
  ]);
  const contradictedPredicates = new Set(contradictions.map(item => normalize(item.predicate)));
  const fusedClaims = verification.verified
    .filter(claim => !contradictedPredicates.has(normalize(claim.predicate)))
    .sort((a, b) =>
      Number(b.independent_publishers || 0) - Number(a.independent_publishers || 0) ||
      Number(b.confidence || 0) - Number(a.confidence || 0)
    );

  const verifiedSignatures = new Set(
    fusedClaims.map(claim => claimSignature(claim))
  );

  const verificationSources = enrichedSources.map(source => ({
    ...source,
    claims:(source.explicit_claims || []).length
      ? source.explicit_claims
      : (source.structured_claims || []).filter(claim =>
          verifiedSignatures.has(claimSignature(claim))
        )
  }));

  return {
    claim_fabric_schema_version: CLAIM_FABRIC_SCHEMA_VERSION,
    sources: enrichedSources,
    verification_sources:verificationSources,
    extracted_claim_count: enrichedSources.reduce((sum, source) => sum + (source.structured_claims || []).length, 0),
    verified_claims: verification.verified,
    supported_claims: verification.supported,
    contradictions,
    fused_claims: fusedClaims,
    verification_state: contradictions.length
      ? 'CONTESTED'
      : fusedClaims.length ? 'VERIFIED'
        : verification.supported.length ? 'SUPPORTED'
          : 'NO_STRUCTURED_CLAIMS'
  };
}

module.exports = {
  CLAIM_FABRIC_SCHEMA_VERSION,
  ROLE_PATTERNS,
  METRIC_PATTERNS,
  extractStructuredClaims,
  enrichSourcesWithStructuredClaims,
  verifyStructuredClaims,
  detectClaimContradictions,
  buildClaimFabric
};
