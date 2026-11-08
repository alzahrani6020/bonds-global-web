'use strict';

const { resolvePublisher } = require('../intelligence/publisher-identity-resolver');

const PERSON_IDENTITY_SCHEMA_VERSION = 2;

const IDENTITY_VERIFICATION_STATES = Object.freeze({
  VERIFIED:'VERIFIED',
  OFFICIAL_PRIMARY_ONLY:'OFFICIAL_PRIMARY_ONLY',
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

const PERSON_IDENTITY_SOCIAL_HOSTS = Object.freeze([
  'linkedin.com','youtube.com','youtu.be','facebook.com','instagram.com',
  'x.com','twitter.com','tiktok.com','threads.net','snapchat.com'
]);

const PERSON_IDENTITY_EVENT_MARKERS = Object.freeze([
  'استضاف','استضافة','زار','زيارة','شارك','مشاركة','حضر','حضور','التقى','لقاء',
  'hosted','visited','visit','participated','attended','met with','meeting'
]);

const PERSON_IDENTITY_DESCRIPTOR_MARKERS = Object.freeze([
  'مستشار','خبير','اقتصادي','رئيس','مدير','مؤسس','عضو','استاذ','أستاذ','باحث',
  'مهندس','محامي','طبيب','كاتب','صحفي','وزير','سفير','advisor','adviser',
  'consultant','expert','economist','chairman','chairperson','president','director',
  'founder','member','professor','researcher','engineer','lawyer','doctor','minister',
  'ambassador','ceo'
]);

const PERSON_IDENTITY_PROFILE_MARKERS = Object.freeze([
  'profile','biography','bio','leadership','about',
  'نبذة','السيرة','السيره','القيادة','القياده'
]);

function sourceHost(source = {}) {
  try {
    return new URL(String(source?.url || '')).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function sourcePath(source = {}) {
  try {
    return new URL(String(source?.url || '')).pathname.toLowerCase();
  } catch (_) {
    return '';
  }
}

function isPersonIdentitySocialSource(source = {}) {
  const host = sourceHost(source);
  return PERSON_IDENTITY_SOCIAL_HOSTS.some(domain =>
    host === domain || host.endsWith('.' + domain)
  );
}

function isPersonIdentitySourceEligible(frame, source = {}) {
  if (!frame || frame.entity_type !== 'person') return true;
  if (isPersonIdentitySocialSource(source)) return false;

  const text = normalizeIdentityText(sourceIdentityText(source));
  if (!text) return false;

  const descriptor = PERSON_IDENTITY_DESCRIPTOR_MARKERS
    .map(normalizeIdentityText)
    .some(marker => marker && text.includes(marker));
  const eventOnly = PERSON_IDENTITY_EVENT_MARKERS
    .map(normalizeIdentityText)
    .some(marker => marker && text.includes(marker)) && !descriptor;

  // Eligibility is a source-type/content gate only. Do not re-apply name-match
  // thresholds here; candidate discovery must preserve weak/partial candidates
  // so verifyPersonIdentity() remains the sole final identity threshold.
  return !eventOnly;
}

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
  const exactNameMatch = Boolean(canonical && normalized.includes(canonical));
  const matchedNameTokens = nameTokens.filter(token => normalized.includes(token)).length;
  const nameScore = nameTokens.length
    ? (exactNameMatch ? 1 : matchedNameTokens / nameTokens.length)
    : 0;

  const rawQualifierSupport = supportScore(frame.qualifiers, normalized);
  const relationSupport = supportScore(frame.relations, normalized);
  const organizationSupport = supportScore(frame.organizations, normalized);
  const contradictions = explicitContradictions(frame, normalized);
  const qualifierSupport = contradictions.some(item => item.field === 'qualifier')
    ? 0
    : rawQualifierSupport;

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
    exact_name_match:exactNameMatch,
    qualifier_support:qualifierSupport,
    relation_support:relationSupport,
    organization_support:organizationSupport,
    contradictions,
    confidence,
    resolution_basis:resolutionBasis
  });
}

function isAuthoritativePersonPrimarySource(frame, source = {}, candidate = null) {
  if (!frame || frame.entity_type !== 'person') return false;
  const canonical = normalizeIdentityText(frame.canonical_name);
  const nameTokens = canonical.split(/\s+/).filter(Boolean);
  if (nameTokens.length < 3) return false;
  if (isPersonIdentitySocialSource(source)) return false;
  if (!isPersonIdentitySourceEligible(frame, source)) return false;

  const resolved = candidate || resolveCandidateIdentity(frame, source, 0);
  if (
    !resolved ||
    resolved.exact_name_match !== true ||
    resolved.name_score < 0.75 ||
    resolved.confidence < 0.63 ||
    (resolved.contradictions || []).length
  ) {
    return false;
  }

  const title = normalizeIdentityText(source?.title || source?.extracted?.title || '');
  const text = normalizeIdentityText(sourceIdentityText(source));
  const path = sourcePath(source);
  const titleBindsIdentity = Boolean(title && title.includes(canonical));
  const profileContext = PERSON_IDENTITY_PROFILE_MARKERS
    .map(normalizeIdentityText)
    .some(marker => marker && (text.includes(marker) || path.includes(marker)));

  return titleBindsIdentity && profileContext;
}

function verifyPersonIdentity(frame, candidates = [], options = {}) {
  const minSupportingSources = Math.max(1, Number(options.minSupportingSources) || 1);
  const officialPrimarySourceIds = new Set(
    (Array.isArray(options.authoritativePersonPrimarySourceIds)
      ? options.authoritativePersonPrimarySourceIds
      : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );
  const rows = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
  const strong = rows.filter(item =>
    item.exact_name_match === true &&
    item.name_score >= 0.75 &&
    item.confidence >= 0.63
  );
  const nonContradictoryStrong = strong.filter(item => !(item.contradictions || []).length);
  const contradictions = rows.flatMap(item => item.contradictions || []);

  const independentGroups = new Map();
  for (const item of nonContradictoryStrong) {
    const resolvedPublisher = resolvePublisher(item.source_id || '');
    const group = String(resolvedPublisher?.independenceGroup || '').trim()
      || ('source:' + String(item.source_id || 'unknown'));
    const existing = independentGroups.get(group);
    if (!existing || Number(item.confidence || 0) > Number(existing.confidence || 0)) {
      independentGroups.set(group, item);
    }
  }
  const independentStrong = [...independentGroups.values()];
  const officialPrimaryStrong = nonContradictoryStrong.filter(item =>
    officialPrimarySourceIds.has(String(item.source_id || '').trim())
  );

  let verificationState = IDENTITY_VERIFICATION_STATES.INSUFFICIENT_EVIDENCE;
  if (contradictions.length && nonContradictoryStrong.length === 0) {
    verificationState = IDENTITY_VERIFICATION_STATES.CONTRADICTED;
  } else if (frame?.ambiguity && independentStrong.length > 1) {
    verificationState = IDENTITY_VERIFICATION_STATES.AMBIGUOUS;
  } else {
    const needsOrganizationDisambiguation = Array.isArray(frame?.organizations) && frame.organizations.length > 0;
    const organizationSupported = !needsOrganizationDisambiguation ||
      independentStrong.some(item => (item.organization_support || 0) > 0);

    if (independentStrong.length >= minSupportingSources && organizationSupported) {
      verificationState = IDENTITY_VERIFICATION_STATES.VERIFIED;
    } else if (
      officialPrimaryStrong.length > 0 &&
      !frame?.ambiguity &&
      organizationSupported
    ) {
      verificationState = IDENTITY_VERIFICATION_STATES.OFFICIAL_PRIMARY_ONLY;
    } else if (
      independentStrong.length > 0 &&
      needsOrganizationDisambiguation &&
      !organizationSupported
    ) {
      verificationState = IDENTITY_VERIFICATION_STATES.AMBIGUOUS;
    }
  }

  const selectedSupporting = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? independentStrong
    : verificationState === IDENTITY_VERIFICATION_STATES.OFFICIAL_PRIMARY_ONLY
      ? officialPrimaryStrong.slice(0, 1)
      : nonContradictoryStrong;
  const supporting = selectedSupporting.map(item => item.source_id).filter(Boolean);
  const basis = [...new Set(selectedSupporting.flatMap(item => item.resolution_basis || []))];

  const verifiedQualifiers = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.qualifiers || []).filter(item =>
        independentStrong.some(candidate => (candidate.qualifier_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const verifiedRelations = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.relations || []).filter(item =>
        independentStrong.some(candidate => (candidate.relation_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const verifiedOrganizations = verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED
    ? (frame.organizations || []).filter(item =>
        independentStrong.some(candidate => (candidate.organization_support || 0) > 0)
      ).map(item => ({ ...item, source:'evidence', verified:true }))
    : [];

  const confidenceRows = selectedSupporting.length ? selectedSupporting : nonContradictoryStrong;
  const confidence = confidenceRows.length
    ? confidenceRows.reduce((sum, item) => sum + item.confidence, 0) / confidenceRows.length
    : 0;

  return deepFreeze({
    person_identity_schema_version:PERSON_IDENTITY_SCHEMA_VERSION,
    verification_state:verificationState,
    matched:verificationState === IDENTITY_VERIFICATION_STATES.VERIFIED,
    official_primary_matched:verificationState === IDENTITY_VERIFICATION_STATES.OFFICIAL_PRIMARY_ONLY,
    canonical_name:frame?.canonical_name || null,
    confidence,
    supporting_sources:supporting,
    independent_publisher_groups:[...independentGroups.keys()],
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
  isPersonIdentitySocialSource,
  isPersonIdentitySourceEligible,
  isAuthoritativePersonPrimarySource,
  resolveCandidateIdentity,
  verifyPersonIdentity
};
