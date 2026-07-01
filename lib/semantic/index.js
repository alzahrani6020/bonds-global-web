/**
 * BONDS Semantic Layer
 *
 * Resolves the meaning of a sector/activity/input into a canonical semantic profile.
 * This is the single source of truth for what concepts, fields, engines and data sources
 * belong to a given economic activity.
 */

const profiles = require('./profiles.json');

const PROFILE_MAP = new Map();
Object.keys(profiles.profiles || {}).forEach(key => {
  PROFILE_MAP.set(key, profiles.profiles[key]);
});

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, '') // remove Arabic tashkeel
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(/\s+|،|,|\//).filter(Boolean);
}

/**
 * Resolve a sector from free-form input (name, alias, keyword).
 * @param {string} input
 * @returns {{sector:string, profile:object, confidence:number}|null}
 */
function resolveSector(input) {
  if (!input) return null;
  const tokens = tokenize(input);
  const inputNorm = normalize(input);

  let best = null;
  let bestScore = 0;

  for (const [key, profile] of PROFILE_MAP) {
    const candidates = [key, profile.sector, profile.names.ar, profile.names.en, ...(profile.aliases || [])];
    let score = 0;

    for (const candidate of candidates) {
      const candNorm = normalize(candidate);
      if (!candNorm) continue;
      if (candNorm === inputNorm) {
        score = 1;
        break;
      }
      if (inputNorm.includes(candNorm) || candNorm.includes(inputNorm)) {
        score = Math.max(score, 0.8);
      }
      // token overlap
      const candTokens = tokenize(candidate);
      const overlap = candTokens.filter(t => tokens.includes(t)).length;
      if (overlap > 0) {
        score = Math.max(score, overlap / Math.max(candTokens.length, tokens.length));
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = { sector: key, profile, confidence: Math.round(score * 100) };
    }
  }

  return best && bestScore >= 0.3 ? best : null;
}

function getProfile(sector) {
  return PROFILE_MAP.get(sector) || null;
}

function listSectors() {
  return Array.from(PROFILE_MAP.keys());
}

/**
 * Infer which concepts apply for a sector/activity combination.
 * @param {string} sector
 * @param {string} [activity]
 * @returns {string[]}
 */
function inferConcepts(sector, activity) {
  const profile = getProfile(sector);
  if (!profile) return [];
  const concepts = new Set(profile.concepts || []);
  const activityNorm = normalize(activity);

  // Activity-specific concept boosts
  if (sector === 'restaurant') {
    if (activityNorm.includes('delivery') || activityNorm.includes('دليفري')) concepts.add('delivery');
    if (activityNorm.includes('cloud') || activityNorm.includes('سحابي')) concepts.add('cloud_kitchen');
    if (activityNorm.includes('cafe') || activityNorm.includes('كافيه')) concepts.add('beverage_focus');
  }
  if (sector === 'healthcare') {
    if (activityNorm.includes('hospital') || activityNorm.includes('مستشفى')) concepts.add('inpatient_care');
    if (activityNorm.includes('clinic') || activityNorm.includes('عيادة')) concepts.add('outpatient_care');
  }

  return Array.from(concepts);
}

/**
 * Return default fields enriched with semantic metadata.
 */
function getFields(sector, activity) {
  const profile = getProfile(sector);
  if (!profile) return [];
  const concepts = inferConcepts(sector, activity);
  return (profile.defaultFields || []).map(field => ({
    ...field,
    sector,
    concepts: concepts.filter(c => isConceptRelated(c, field.name)),
    category: categorizeField(field.name)
  }));
}

function isConceptRelated(concept, fieldName) {
  // Simple heuristic: concept substring appears in field name or vice versa.
  const c = normalize(concept).replace(/_/g, '');
  const f = normalize(fieldName).replace(/_/g, '');
  return c.includes(f) || f.includes(c);
}

function categorizeField(name) {
  const n = normalize(name);
  if (/revenue|profit|ebitda|income|sales/.test(n)) return 'financial';
  if (/cost|expense|rent|labor|energy|maintenance|commission/.test(n)) return 'cost';
  if (/capacity|rooms|beds|seats|students|lines|area/.test(n)) return 'capacity';
  if (/rate|percentage|occupancy|conversion|growth/.test(n)) return 'ratio';
  if (/assets|liabilities|equity|debt/.test(n)) return 'balance';
  return 'operational';
}

module.exports = {
  profiles,
  resolveSector,
  getProfile,
  listSectors,
  inferConcepts,
  getFields,
  normalize,
  tokenize
};
