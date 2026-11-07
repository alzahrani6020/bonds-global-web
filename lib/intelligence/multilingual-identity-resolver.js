'use strict';

/**
 * Multilingual Identity Resolver — rule-based v1.
 *
 * Resolves a raw person-name mention (Arabic or English, possibly carrying
 * titles/honorifics or transliteration variants) against a small curated
 * seed of known entities. It performs NO network calls and adds NO
 * dependencies; every signal it emits is explainable via the returned
 * `evidence` list.
 *
 * Ambiguity discipline (v1 contract):
 * - Transliteration equivalence alone NEVER elevates a mention to VERIFIED.
 * - A name matched without distinguishing qualifiers stays
 *   INSUFFICIENT_EVIDENCE (confidence capped at 0.6).
 * - 2+ distinct known entities matching the same normalized identity yield
 *   AMBIGUOUS — entities are never merged on doubt.
 * - Qualifiers (country/role/organization/birthYear) that conflict with the
 *   matched entity's known qualifiers yield CONTRADICTED.
 * - Only consistent qualifiers elevate a unique match to VERIFIED.
 */

const IDENTITY_RESOLVER_SCHEMA_VERSION = 1;

const VERIFICATION_STATES = Object.freeze({
  VERIFIED:'VERIFIED',
  AMBIGUOUS:'AMBIGUOUS',
  CONTRADICTED:'CONTRADICTED',
  INSUFFICIENT_EVIDENCE:'INSUFFICIENT_EVIDENCE'
});

// Transliteration equivalence for common Arabic name particles/patterns.
// Keys are normalized tokens (see normalizeNameText); values are canonical
// particle ids shared by Arabic and Latin spellings, so "بن" === "bin" ===
// "ibn" === "ben" and "الدين" === "aldin" === "eldin".
const PARTICLE_EQUIVALENCE = Object.freeze({
  // Arabic particles (post-normalization forms).
  'بن':'ibn',
  'ابن':'ibn',
  'بنت':'ibn',
  'ابو':'abu',
  'عبد':'abd',
  'ال':'al',
  'الدين':'din',
  // Latin transliterations of the same particles.
  'bin':'ibn',
  'ben':'ibn',
  'ibn':'ibn',
  'ibnu':'ibn',
  'ibni':'ibn',
  'abu':'abu',
  'abou':'abu',
  'abo':'abu',
  'abd':'abd',
  'abdel':'abd',
  'abdul':'abd',
  'abdal':'abd',
  'al':'al',
  'el':'al',
  'ul':'al',
  'aldin':'din',
  'eldin':'din',
  'aldeen':'din',
  'eddin':'din',
  'din':'din',
  'deen':'din'
});

// Common Latin spelling variants of frequent given names, folded to one
// canonical token so "Mohammed" === "Mohammad" === "Muhammad".
const LATIN_NAME_VARIANTS = Object.freeze({
  'mohammed':'muhammad',
  'mohammad':'muhammad',
  'muhammed':'muhammad',
  'muhamad':'muhammad',
  'mohamed':'muhammad',
  'mohd':'muhammad'
});

// Multi-word honorific phrases removed before token-level title stripping.
// Arabic honorifics like "صاحب السمو الملكي" and English "His Royal Highness".
const HONORIFIC_PHRASES = /^(?:صاحب السمو الملكي|صاحب السمو|سمو الملكي|سمو|(?:his|her)\s+royal\s+highness|h\.?\s?r\.?\s?h\.?|h\.?\s?e\.?)\s+/iu;

// Leading tokens (normalized forms) treated as titles/honorifics and
// stripped from a mention before identity matching.
const HONORIFIC_TOKENS = new Set([
  // Arabic.
  'د','دكتور','الدكتور','دكتوره',
  'استاذ','الاستاذ','استاذه','الاستاذه',
  'بروف','بروفيسور','البروفيسور',
  'سعاده','معالي','فضيله',
  'مهندس','المهندس',
  'شيخ','الشيخ','شيخه','الشيخه',
  'امير','الامير','اميره','الاميره',
  'ملك','الملك','ملكه','الملكه',
  // English.
  'dr','doctor','mr','mrs','ms','miss','prof','professor',
  'sir','madam','sheikh','sheik','shaikh','shaykh',
  'hrh','hsh','eng','engineer',
  'prince','princess','king','queen'
]);

// Approximate Latin initials for Arabic letters, used only for
// abbreviation matching (e.g. MBS -> محمد بن سلمان).
const ARABIC_TOKEN_INITIALS = Object.freeze({
  'ا':'a','ب':'b','ت':'t','ث':'t','ج':'j','ح':'h','خ':'k','د':'d','ذ':'d',
  'ر':'r','ز':'z','س':'s','ش':'s','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a',
  'غ':'g','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
  'ي':'y','پ':'p','چ':'c','گ':'g'
});

// Country spellings (normalized lowercase) accepted in qualifiers.
const COUNTRY_ALIASES = Object.freeze({
  'SA':['sa','ksa','saudi','saudi arabia','السعوديه','الملكه العربيه السعوديه'],
  'AE':['ae','uae','emirates','united arab emirates','الامارات','الامارات العربيه المتحده'],
  'EG':['eg','egypt','مصر'],
  'JO':['jo','jordan','الاردن'],
  'KW':['kw','kuwait','الكويت'],
  'BH':['bh','bahrain','البحرين'],
  'QA':['qa','qatar','قطر'],
  'OM':['om','oman','عمان'],
  'PS':['ps','palestine','فلسطين'],
  'IQ':['iq','iraq','العراق'],
  'YE':['ye','yemen','اليمن'],
  'LB':['lb','lebanon','لبنان'],
  'SY':['sy','syria','سوريا'],
  'SD':['sd','sudan','السودان'],
  'LY':['ly','libya','ليبيا'],
  'TN':['tn','tunisia','تونس'],
  'DZ':['dz','algeria','الجزائر'],
  'MA':['ma','morocco','المغرب'],
  'MR':['mr','mauritania','موريتانيا'],
  'SO':['so','somalia','الصومال'],
  'DJ':['dj','djibouti','جيبوتي'],
  'KM':['km','comoros','جزر القمر'],
  'US':['us','usa','united states','امريكا','الولايات المتحده'],
  'GB':['gb','uk','united kingdom','britain','بريطانيا','انجلترا'],
  'BD':['bd','bangladesh','بنغلاديش','بنجلاديش'],
  'FR':['fr','france','فرنسا'],
  'DE':['de','germany','المانيا'],
  'CN':['cn','china','الصين'],
  'RU':['ru','russia','روسيا'],
  'JP':['jp','japan','اليابان']
});

// Canonical role ids with their accepted Arabic/English labels (normalized).
const ROLE_EQUIVALENCE = Object.freeze([
  { id:'crown_prince', labels:['ولي العهد','ولي عهد','crown prince','crown prince of saudi arabia'] },
  { id:'cricketer', labels:['cricketer','لاعب كريكت','لاعب الكريكت','لاعب الكريكيت','لاعب كريكات'] },
  { id:'minister', labels:['minister','وزير','وزير الدفاع','وزير الخارجيه','minister of defense','minister of defence','foreign minister'] },
  { id:'president', labels:['president','رئيس','الرئيس'] },
  { id:'prime_minister', labels:['prime minister','رئيس الوزراء','رئيس مجلس الوزراء'] },
  { id:'governor', labels:['governor','محافظ'] }
]);

// Curated seed of known entities. Each alias carries its own provenance via
// the entity-level `provenance` value echoed into match evidence.
const KNOWN_ENTITIES = Object.freeze([
  {
    id:'mohammed-bin-salman',
    canonicalName:'Mohammed bin Salman',
    canonicalNameAr:'محمد بن سلمان',
    aliases:['محمد بن سلمان','محمد سلمان','Mohammed bin Salman','Mohammad bin Salman','Mohammed Salman','Mohammad Salman','MBS'],
    qualifiers:{ country:'SA', role:'crown_prince', organization:null, birthYear:1985 },
    provenance:'seed:known-entities:v1'
  },
  {
    id:'mohammad-salman-cricketer',
    canonicalName:'Mohammad Salman',
    canonicalNameAr:'محمد سلمان',
    aliases:['محمد سلمان','Mohammad Salman','Mohammed Salman'],
    qualifiers:{ country:'BD', role:'cricketer', organization:null, birthYear:1983 },
    provenance:'seed:known-entities:v1'
  }
]);

function clean(value, max = 500) {
  const text = String(value === null || value === undefined ? '' : value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

// Shared normalization for both scripts: Arabic folding (diacritics,
// أإآ->ا, ى->ي, ة->ه heuristic, ء/ئ/ؤ->ا heuristic) plus Latin folding
// (NFKD accents, case, punctuation). Kept as explicit unicode escapes so
// the ranges stay reviewable in any editor/terminal.
function normalizeNameText(value) {
  return clean(value, 1000)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0625\u0623\u0622\u0671]/g, 'ا')
    .replace(/\u0649/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0621\u0626\u0624]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArabicName(value) {
  return normalizeNameText(value);
}

function normalizeLatinName(value) {
  return normalizeNameText(value);
}

function isArabicText(value) {
  return /[؀-ۿ]/u.test(String(value || ''));
}

// Removes leading honorifics (both languages) and returns the stripped name
// plus the removed tokens for the evidence trail.
function stripHonorifics(value) {
  let text = clean(value, 1000);
  const stripped = [];
  let guard = 0;
  while (guard < 6) {
    guard += 1;
    const phraseMatch = text.match(HONORIFIC_PHRASES);
    if (phraseMatch) {
      stripped.push(clean(phraseMatch[0], 120));
      text = text.slice(phraseMatch[0].length).trim();
      continue;
    }
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) break;
    const first = normalizeNameText(tokens[0]);
    if (first && HONORIFIC_TOKENS.has(first)) {
      stripped.push(tokens[0]);
      text = tokens.slice(1).join(' ').trim();
      continue;
    }
    break;
  }
  return { name:text, stripped };
}

// Folds a name into normalized tokens; particles resolve to their canonical
// id so Arabic and Latin spellings share one token space.
function foldNameTokens(value) {
  const normalized = normalizeNameText(value);
  if (!normalized) return [];
  return normalized.split(' ').map(token => {
    const isParticle = Object.prototype.hasOwnProperty.call(PARTICLE_EQUIVALENCE, token);
    const canonical = (!isParticle && Object.prototype.hasOwnProperty.call(LATIN_NAME_VARIANTS, token))
      ? LATIN_NAME_VARIANTS[token]
      : token;
    return isParticle
      ? { token, canonical:token, particle:PARTICLE_EQUIVALENCE[token] }
      : { token, canonical, particle:null };
  });
}

function tokenInitial(token) {
  const first = token.slice(0, 1);
  return ARABIC_TOKEN_INITIALS[first] || first;
}

function aliasInitials(aliasFolded) {
  return aliasFolded.map(item => tokenInitial(item.canonical)).join('');
}

// Matches a folded mention against a folded alias. Core (non-particle)
// tokens must be exactly equal — "Mohammad Salim" never matches an entity
// whose alias core is "muhammad+salman". Particle mismatches (dropped or
// added "bin"/"بن") match with reduced strength.
function matchAlias(mentionFolded, aliasFolded) {
  const mentionCores = mentionFolded.filter(item => !item.particle).map(item => item.canonical);
  const aliasCores = aliasFolded.filter(item => !item.particle).map(item => item.canonical);
  if (!mentionCores.length || !aliasCores.length) return null;
  if (mentionCores.length !== aliasCores.length) return null;
  const aliasSet = new Set(aliasCores);
  if (!mentionCores.every(token => aliasSet.has(token))) return null;
  const mentionParticles = mentionFolded.filter(item => item.particle).map(item => item.particle).sort();
  const aliasParticles = aliasFolded.filter(item => item.particle).map(item => item.particle).sort();
  const sameParticles = mentionParticles.length === aliasParticles.length &&
    mentionParticles.every((particle, index) => particle === aliasParticles[index]);
  if (sameParticles) return { strength:1, exact:true };
  return { strength:0.7, exact:false };
}

function normalizeCountryCode(value) {
  const normalized = normalizeNameText(value);
  if (!normalized) return null;
  for (const [code, labels] of Object.entries(COUNTRY_ALIASES)) {
    if (labels.some(label => normalizeNameText(label) === normalized)) return code;
  }
  return null;
}

function canonicalRoleId(value) {
  const normalized = normalizeNameText(value);
  if (!normalized) return null;
  for (const role of ROLE_EQUIVALENCE) {
    const hit = role.labels.some(label => {
      const folded = normalizeNameText(label);
      return folded === normalized || normalized.includes(folded) || folded.includes(normalized);
    });
    if (hit) return role.id;
  }
  return null;
}

function roundConfidence(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function baseResult({ rawMention, evidence }) {
  return {
    rawMention:clean(rawMention, 500),
    canonicalName:null,
    canonicalNameAr:null,
    entityType:'person',
    aliases:[],
    qualifiers:{ country:null, role:null, organization:null },
    verificationState:VERIFICATION_STATES.INSUFFICIENT_EVIDENCE,
    confidence:0,
    evidence
  };
}

// Compares one context qualifier set against a known entity. A qualifier is
// 'supporting' when consistent, 'conflicting' when it contradicts the
// entity's known facts; unknown/underspecified values stay neutral.
function qualifierAssessment(entity, context) {
  const evidence = [];
  let supports = 0;
  let conflicts = 0;

  const country = normalizeCountryCode(context?.country);
  if (country) {
    if (entity.qualifiers.country === country) {
      supports += 1;
      evidence.push({ type:'qualifier_support', field:'country', value:country });
    } else {
      conflicts += 1;
      evidence.push({ type:'qualifier_conflict', field:'country', value:country, expected:entity.qualifiers.country });
    }
  }

  const roleText = clean(context?.role, 160);
  if (roleText) {
    const roleId = canonicalRoleId(roleText);
    if (roleId) {
      if (entity.qualifiers.role === roleId) {
        supports += 1;
        evidence.push({ type:'qualifier_support', field:'role', value:roleText });
      } else {
        conflicts += 1;
        evidence.push({ type:'qualifier_conflict', field:'role', value:roleText, expected:entity.qualifiers.role });
      }
    }
  }

  const organization = clean(context?.organization, 200);
  if (organization && entity.qualifiers.organization) {
    const foldedOrg = normalizeNameText(organization);
    const foldedKnown = normalizeNameText(entity.qualifiers.organization);
    if (foldedOrg && foldedKnown && (foldedOrg.includes(foldedKnown) || foldedKnown.includes(foldedOrg))) {
      supports += 1;
      evidence.push({ type:'qualifier_support', field:'organization', value:organization });
    }
  }

  const birthYear = Number(context?.birthYear);
  if (Number.isFinite(birthYear) && birthYear > 1850 && entity.qualifiers.birthYear) {
    if (Number(entity.qualifiers.birthYear) === birthYear) {
      supports += 1;
      evidence.push({ type:'qualifier_support', field:'birthYear', value:birthYear });
    } else {
      conflicts += 1;
      evidence.push({ type:'qualifier_conflict', field:'birthYear', value:birthYear, expected:entity.qualifiers.birthYear });
    }
  }

  return { supports, conflicts, evidence };
}

function resolveIdentity(rawMention, context = {}) {
  const evidence = [];
  const raw = clean(rawMention, 500);
  if (!raw) {
    return { ...baseResult({ rawMention:raw, evidence }), confidence:0 };
  }

  const stripped = stripHonorifics(raw);
  if (stripped.stripped.length) {
    evidence.push({ type:'honorific_stripped', tokens:stripped.stripped.slice(0, 6) });
  }
  const mentionText = stripped.name || raw;
  const folded = foldNameTokens(mentionText);
  if (!folded.length) {
    return { ...baseResult({ rawMention:raw, evidence }), confidence:0 };
  }

  const isAbbreviation = /^[A-Za-z]{2,6}$/.test(mentionText) && mentionText === mentionText.toUpperCase();

  // Collect candidate entities.
  const candidates = [];
  for (const entity of KNOWN_ENTITIES) {
    let best = null;
    for (const alias of entity.aliases) {
      const aliasFolded = foldNameTokens(alias);
      let match = null;
      if (isAbbreviation) {
        const initials = aliasInitials(aliasFolded);
        if (initials && initials === mentionText.toLowerCase()) {
          match = { strength:0.65, exact:false, abbreviation:true, alias };
        }
      } else {
        const aliasMatch = matchAlias(folded, aliasFolded);
        if (aliasMatch) match = { ...aliasMatch, abbreviation:false, alias };
      }
      if (match && (!best || match.strength > best.strength)) best = match;
    }
    if (best) {
      candidates.push({ entity, strength:best.strength, exact:best.exact, abbreviation:best.abbreviation, alias:best.alias });
    }
  }

  if (!candidates.length) {
    evidence.push({ type:'no_known_entity', normalizedMention:folded.map(item => item.canonical).join(' ') });
    const arabic = isArabicText(mentionText);
    return {
      ...baseResult({ rawMention:raw, evidence }),
      canonicalName:mentionText,
      canonicalNameAr:arabic ? mentionText : null,
      confidence:0.15
    };
  }

  for (const candidate of candidates) {
    evidence.push({
      type: candidate.abbreviation ? 'abbreviation_match' : 'known_entity_match',
      entityId: candidate.entity.id,
      alias: candidate.alias,
      matchStrength: candidate.strength,
      provenance: candidate.entity.provenance
    });
  }

  const assessed = candidates.map(candidate => ({
    ...candidate,
    assessment: qualifierAssessment(candidate.entity, context)
  }));
  const consistent = assessed.filter(candidate => candidate.assessment.conflicts === 0);
  const conflicted = assessed.filter(candidate => candidate.assessment.conflicts > 0);
  for (const candidate of conflicted) {
    evidence.push(...candidate.assessment.evidence.filter(item => item.type === 'qualifier_conflict'));
  }

  const qualifiers = {
    country: normalizeCountryCode(context?.country),
    role: clean(context?.role, 160) || null,
    organization: clean(context?.organization, 200) || null
  };

  // 2+ consistent distinct known entities: never merge.
  if (consistent.length >= 2) {
    return {
      ...baseResult({ rawMention:raw, evidence }),
      qualifiers,
      verificationState:VERIFICATION_STATES.AMBIGUOUS,
      confidence:roundConfidence(Math.min(0.5, 0.3 + 0.2 * Math.max(...consistent.map(candidate => candidate.strength)))),
      evidence:[...evidence, { type:'ambiguity', candidates: consistent.map(candidate => candidate.entity.id) }]
    };
  }

  // 0 consistent entities: the qualifiers contradict every name candidate.
  if (consistent.length === 0) {
    return {
      ...baseResult({ rawMention:raw, evidence }),
      qualifiers,
      verificationState:VERIFICATION_STATES.CONTRADICTED,
      confidence:0.3
    };
  }

  const candidate = consistent[0];
  const { entity, strength, abbreviation } = candidate;
  const { supports } = candidate.assessment;
  const supportEvidence = candidate.assessment.evidence.filter(item => item.type === 'qualifier_support');
  const result = {
    ...baseResult({ rawMention:raw, evidence:[] }),
    canonicalName: entity.canonicalName,
    canonicalNameAr: entity.canonicalNameAr,
    aliases: entity.aliases.filter((alias, index) => entity.aliases.indexOf(alias) === index),
    qualifiers,
    evidence:[...evidence, ...supportEvidence]
  };

  // Transliteration/abbreviation equivalence alone never reaches VERIFIED:
  // at least one consistent qualifier must confirm the identity.
  if (supports === 0) {
    return {
      ...result,
      verificationState:VERIFICATION_STATES.INSUFFICIENT_EVIDENCE,
      confidence:roundConfidence(Math.min(0.6, 0.4 + 0.2 * strength)),
      evidence:[...result.evidence, { type:'missing_qualifiers', detail:'name match without confirming qualifiers' }]
    };
  }

  const supportBonus = supports >= 2 ? 0.15 : 0.1;
  const abbreviationCap = abbreviation ? 0.9 : 1;
  return {
    ...result,
    verificationState:VERIFICATION_STATES.VERIFIED,
    confidence:roundConfidence(Math.min(0.95 * abbreviationCap, 0.55 + 0.3 * strength + supportBonus))
  };
}

module.exports = {
  IDENTITY_RESOLVER_SCHEMA_VERSION,
  VERIFICATION_STATES,
  PARTICLE_EQUIVALENCE,
  LATIN_NAME_VARIANTS,
  HONORIFIC_TOKENS,
  KNOWN_ENTITIES,
  normalizeArabicName,
  normalizeLatinName,
  normalizeNameText,
  stripHonorifics,
  foldNameTokens,
  resolveIdentity
};
