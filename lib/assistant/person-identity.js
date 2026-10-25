'use strict';

const PERSON_IDENTITY_SCHEMA_VERSION = 1;

const IDENTITY_VERIFICATION_STATES = Object.freeze({
  VERIFIED:'VERIFIED',
  AMBIGUOUS:'AMBIGUOUS',
  CONTRADICTED:'CONTRADICTED',
  INSUFFICIENT_EVIDENCE:'INSUFFICIENT_EVIDENCE'
});

const ORGANIZATION_MARKERS = Object.freeze([
  'شركة','مؤسسة','بنك','مصرف','وزارة','هيئة','جامعة','صندوق','منظمة','مجلس','معهد','نادي','فريق',
  'company','firm','bank','ministry','authority','university','fund','organization','organisation','council','institute','club','team'
]);

// Compatibility hints only. They are not the identity contract and never
// become verified facts without source evidence.
const FALLBACK_DESCRIPTOR_PHRASES = Object.freeze([
  ['صاحب','السمو','الملكي'],
  ['صاحب','السمو'],
  ['المستشار','المالي'],
  ['رجل','الأعمال'],
  ['سيدة','الأعمال'],
  ['الرئيس','التنفيذي'],
  ['المدير','التنفيذي'],
  ['رئيس','مجلس','الإدارة'],
  ['دكتور'],['الدكتور'],['الشيخ'],['الأمير'],['الامير'],['الأستاذ'],['الاستاذ'],
  ['المهندس'],['المحامي'],['السفير'],['الوزير'],['المستشار'],['الطبيب'],['طبيب'],
  ['المحاسب'],['الخبير'],['الباحث'],['الكاتب'],['الصحفي'],['رئيس'],['مدير'],['مؤسس'],
  ['مستشار'],['محامي'],['مهندس'],['طبيب'],['خبير'],['باحث'],['كاتب'],['صحفي'],
  ['doctor'],['dr'],['advisor'],['adviser'],['lawyer'],['engineer'],['professor'],
  ['minister'],['ambassador'],['president'],['chairman'],['chairperson'],['ceo'],['founder']
]);

const HONORIFIC_HINTS = new Set([
  'صاحب السمو الملكي','صاحب السمو','سمو','معالي','سعادة','فضيلة',
  'دكتور','الدكتور','الشيخ','الأمير','الامير','الأستاذ','الاستاذ',
  'doctor','dr','professor'
].map(normalizeIdentityText));

function clean(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function normalizeIdentityText(value) {
  return clean(value, 2000)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[“”"'؟?!.,،:;؛()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function uniqueObjects(values, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of values || []) {
    if (!item) continue;
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function tokenize(value) {
  return clean(value, 1200)
    .replace(/[؟?!.,،:;؛()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function descriptorMatches(tokens, start = 0) {
  const matches = [];
  let index = start;
  const normalizedTokens = tokens.map(normalizeIdentityText);

  while (index < tokens.length) {
    let best = null;
    for (const phrase of FALLBACK_DESCRIPTOR_PHRASES) {
      const normalized = phrase.map(normalizeIdentityText);
      if (index + normalized.length > normalizedTokens.length) continue;
      const slice = normalizedTokens.slice(index, index + normalized.length);
      if (slice.every((value, offset) => value === normalized[offset])) {
        if (!best || normalized.length > best.length) {
          best = { length:normalized.length, text:tokens.slice(index, index + normalized.length).join(' ') };
        }
      }
    }
    if (!best) break;
    matches.push(best.text);
    index += best.length;
  }

  return { matches, nextIndex:index };
}

function classifyQualifier(text) {
  const normalized = normalizeIdentityText(text);
  return {
    type:HONORIFIC_HINTS.has(normalized) ? 'honorific' : 'descriptor',
    value:clean(text, 160),
    source:'user',
    verified:false
  };
}

function deriveNameBoundary(tokens) {
  if (!tokens.length) return { start:0, confidence:0, structural:false };

  const normalizedTokens = tokens.map(normalizeIdentityText);
  const organizationMarkerIndex = normalizedTokens.findIndex(token =>
    ORGANIZATION_MARKERS.some(marker => normalizeIdentityText(marker) === token)
  );

  if (organizationMarkerIndex >= 0) {
    const tailLength = tokens.length - organizationMarkerIndex - 1;
    if (tailLength >= 3) {
      const nameLength = Math.min(3, Math.max(2, tailLength - 1));
      return {
        start:tokens.length - nameLength,
        confidence:0.94,
        structural:true,
        descriptorMatches:[]
      };
    }
  }

  const leading = descriptorMatches(tokens, 0);
  if (leading.nextIndex > 0 && leading.nextIndex < tokens.length) {
    return {
      start:leading.nextIndex,
      confidence:0.96,
      structural:true,
      descriptorMatches:leading.matches
    };
  }

  if (tokens.length <= 3) {
    return { start:0, confidence:0.93, structural:true, descriptorMatches:[] };
  }

  // Generic structural fallback: long descriptive mentions normally end with
  // the person's proper-name span. This is intentionally conservative and
  // marks the result ambiguous when no structural descriptors were recognized.
  let start = Math.max(0, tokens.length - 3);
  const connector = normalizeIdentityText(tokens[start - 1] || '');
  if (['بن','ابن','بنت','ال','آل','ال'].includes(connector)) start = Math.max(0, start - 1);

  return {
    start,
    confidence:0.72,
    structural:false,
    descriptorMatches:[]
  };
}

function parseOrganizationAndRelation(prefixTokens) {
  if (!Array.isArray(prefixTokens) || !prefixTokens.length) {
    return { qualifiers:[], relations:[], organizations:[] };
  }

  const normalized = prefixTokens.map(normalizeIdentityText);
  const markerIndex = normalized.findIndex(token =>
    ORGANIZATION_MARKERS.some(marker => normalizeIdentityText(marker) === token)
  );

  if (markerIndex >= 0) {
    const relationText = prefixTokens.slice(0, markerIndex).join(' ').trim();
    const organizationText = prefixTokens.slice(markerIndex).join(' ').trim();

    return {
      qualifiers:[],
      relations:relationText ? [{
        type:'role_relation',
        value:relationText,
        source:'user',
        verified:false
      }] : [],
      organizations:organizationText ? [{
        value:organizationText,
        source:'user',
        verified:false
      }] : []
    };
  }

  const leading = descriptorMatches(prefixTokens, 0);
  const qualifiers = leading.matches.map(classifyQualifier);
  const remainder = prefixTokens.slice(leading.nextIndex).join(' ').trim();
  if (remainder) qualifiers.push(classifyQualifier(remainder));

  return { qualifiers, relations:[], organizations:[] };
}

function createPersonEntityFrame({
  rawMention,
  canonicalName,
  qualifiers = [],
  relations = [],
  organizations = [],
  confidence = 0,
  ambiguity = false,
  provenance = null
} = {}) {
  const frame = {
    person_identity_schema_version:PERSON_IDENTITY_SCHEMA_VERSION,
    entity_type:'person',
    raw_mention:clean(rawMention, 500),
    canonical_name:clean(canonicalName, 300),
    qualifiers:uniqueObjects(qualifiers, item => normalizeIdentityText(item?.type + ' ' + item?.value)),
    relations:uniqueObjects(relations, item => normalizeIdentityText(item?.type + ' ' + item?.value)),
    organizations:uniqueObjects(organizations, item => normalizeIdentityText(item?.value)),
    confidence:Math.max(0, Math.min(1, Number(confidence) || 0)),
    ambiguity:Boolean(ambiguity),
    provenance:provenance || { source:'user_text', immutable:true }
  };
  return deepFreeze(frame);
}

function buildPersonEntityFrame(rawMention) {
  const raw = clean(rawMention, 500)
    .replace(/\s+[0-9٠-٩]+\s*$/u, '')
    .trim();
  if (!raw) return null;

  const tokens = tokenize(raw);
  if (!tokens.length) return null;

  const boundary = deriveNameBoundary(tokens);
  const canonicalTokens = tokens.slice(boundary.start);
  const prefixTokens = tokens.slice(0, boundary.start);
  const canonicalName = canonicalTokens.join(' ').trim();
  if (!canonicalName) return null;

  const parsedPrefix = parseOrganizationAndRelation(prefixTokens);
  const ambiguity = !boundary.structural && prefixTokens.length > 0;

  return createPersonEntityFrame({
    rawMention:raw,
    canonicalName,
    qualifiers:parsedPrefix.qualifiers,
    relations:parsedPrefix.relations,
    organizations:parsedPrefix.organizations,
    confidence:boundary.confidence,
    ambiguity,
    provenance:{
      source:'user_text',
      parser:boundary.structural ? 'structural' : 'structural_fallback',
      immutable:true
    }
  });
}

function hasPersonDescriptorSignals(frame) {
  return Boolean(
    frame &&
    (
      (frame.qualifiers && frame.qualifiers.length) ||
      (frame.relations && frame.relations.length) ||
      (frame.organizations && frame.organizations.length)
    )
  );
}

function sourceIdentityText(source = {}) {
  const candidateClaims = Array.isArray(source?.candidate_claims)
    ? source.candidate_claims.map(item => item?.text || '').filter(Boolean)
    : [];
  const extracted = source?.extracted && typeof source.extracted === 'object'
    ? [source.extracted.title, source.extracted.text]
    : [];
  return [
    source?.title,
    source?.snippet,
    source?.text,
    source?.publisher,
    source?.url,
    ...candidateClaims,
    ...extracted
  ].filter(Boolean).join(' ');
}

function supportScore(items, normalizedText) {
  if (!Array.isArray(items) || !items.length) return null;
  let supported = 0;
  for (const item of items) {
    const value = normalizeIdentityText(item?.value);
    if (value && normalizedText.includes(value)) supported += 1;
  }
  return supported / items.length;
}

function explicitContradictions(frame, normalizedText) {
  const contradictions = [];
  for (const qualifier of frame?.qualifiers || []) {
    const value = normalizeIdentityText(qualifier?.value);
    if (!value) continue;
    const patterns = [
      'ليس ' + value,
      'ليست ' + value,
      'not ' + value,
      'never ' + value
    ];
    if (patterns.some(pattern => normalizedText.includes(pattern))) {
      contradictions.push({
        field:'qualifier',
        value:qualifier.value,
        reason:'explicit_negation'
      });
    }
  }
  return contradictions;
}

function resolveCandidateIdentity(frame, source = {}, index = 0) {
  if (!frame || frame.entity_type !== 'person') return null;

  const combined = sourceIdentityText(source);
  const normalized = normalizeIdentityText(combined);
  const canonical = normalizeIdentityText(frame.canonical_name);
  const nameTokens = canonical.split(/\s+/).filter(Boolean);
  const matchedNameTokens = nameTokens.filter(token => normalized.includes(token)).length;
  const nameScore = nameTokens.length
    ? (normalized.includes(canonical) ? 1 : matchedNameTokens / nameTokens.length)
    : 0;

  const qualifierSupport = supportScore(frame.qualifiers, normalized);
  const relationSupport = supportScore(frame.relations, normalized);
  const organizationSupport = supportScore(frame.organizations, normalized);
  const contradictions = explicitContradictions(frame, normalized);

  const optionalScores = [qualifierSupport, relationSupport, organizationSupport]
    .filter(value => typeof value === 'number');
  const optionalSupport = optionalScores.length
    ? optionalScores.reduce((sum, value) => sum + value, 0) / optionalScores.length
    : 0;

  const confidence = Math.max(
    0,
    Math.min(1, (nameScore * 0.84) + (optionalSupport * 0.16) - (contradictions.length ? 0.25 : 0))
  );

  const resolutionBasis = ['name'];
  if ((organizationSupport || 0) > 0) resolutionBasis.push('organization');
  if ((relationSupport || 0) > 0) resolutionBasis.push('relation');
  if ((qualifierSupport || 0) > 0) resolutionBasis.push('qualifier');

  return deepFreeze({
    person_identity_schema_version:PERSON_IDENTITY_SCHEMA_VERSION,
    source_id:clean(source?.id || source?.url || ('candidate-' + index), 500),
    candidate_id:'person-candidate-' + index,
    canonical_name:frame.canonical_name,
    name_score:nameScore,
    qualifier_support:qualifierSupport,
    relation_support:relationSupport,
    organization_support:organizationSupport,
    contradictions,
    confidence,
    resolution_basis:resolutionBasis
  });
}

function verifyPersonIdentity(frame, candidates = [], options = {}) {
  const minSupportingSources = Math.max(1, Number(options.minSupportingSources) || 1);
  const rows = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
  const strong = rows.filter(item => item.name_score >= 0.75 && item.confidence >= 0.63);
  const contradictions = rows.flatMap(item => item.contradictions || []);

  let verificationState = IDENTITY_VERIFICATION_STATES.INSUFFICIENT_EVIDENCE;
  if (contradictions.length && strong.length === 0) {
    verificationState = IDENTITY_VERIFICATION_STATES.CONTRADICTED;
  } else if (frame?.ambiguity && strong.length > 1) {
    verificationState = IDENTITY_VERIFICATION_STATES.AMBIGUOUS;
  } else {
    const needsOrganizationDisambiguation = Array.isArray(frame?.organizations) && frame.organizations.length > 0;
    const organizationSupported = !needsOrganizationDisambiguation ||
      strong.some(item => (item.organization_support || 0) > 0);

    if (strong.length >= minSupportingSources && organizationSupported) {
      verificationState = IDENTITY_VERIFICATION_STATES.VERIFIED;
    } else if (strong.length > 0 && needsOrganizationDisambiguation && !organizationSupported) {
      verificationState = IDENTITY_VERIFICATION_STATES.AMBIGUOUS;
    }
  }

  const supporting = strong.map(item => item.source_id).filter(Boolean);
  const basis = [...new Set(strong.flatMap(item => item.resolution_basis || []))];
  const verifiedQualifiers = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.qualifiers || []).filter(item =>
        strong.some(candidate => (candidate.qualifier_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const verifiedRelations = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.relations || []).filter(item =>
        strong.some(candidate => (candidate.relation_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const verifiedOrganizations = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.organizations || []).filter(item =>
        strong.some(candidate => (candidate.organization_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const confidence = strong.length
    ? strong.reduce((sum, item) => sum + item.confidence, 0) / strong.length
    : 0;

  return deepFreeze({
    person_identity_schema_version:PERSON_IDENTITY_SCHEMA_VERSION,
    verification_state:verificationState,
    matched:verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED,
    canonical_name:frame?.canonical_name || null,
    confidence,
    supporting_sources:supporting,
    verified_qualifiers:verifiedQualifiers,
    verified_relations:verifiedRelations,
    verified_organizations:verifiedOrganizations,
    unresolved_conflicts:contradictions,
    resolution_basis:basis
  });
}

module.exports = {
  PERSON_IDENTITY_SCHEMA_VERSION,
  IDENTITY_VERIFICATION_STATES,
  ORGANIZATION_MARKERS,
  FALLBACK_DESCRIPTOR_PHRASES,
  normalizeIdentityText,
  createPersonEntityFrame,
  buildPersonEntityFrame,
  hasPersonDescriptorSignals,
  resolveCandidateIdentity,
  verifyPersonIdentity
};
