'use strict';

const COUNTRY_NAMES = {
  DZ: { ar: 'الجزائر', en: 'Algeria' },
  BH: { ar: 'البحرين', en: 'Bahrain' },
  KM: { ar: 'جزر القمر', en: 'Comoros' },
  DJ: { ar: 'جيبوتي', en: 'Djibouti' },
  EG: { ar: 'مصر', en: 'Egypt' },
  IQ: { ar: 'العراق', en: 'Iraq' },
  JO: { ar: 'الأردن', en: 'Jordan' },
  KW: { ar: 'الكويت', en: 'Kuwait' },
  LB: { ar: 'لبنان', en: 'Lebanon' },
  LY: { ar: 'ليبيا', en: 'Libya' },
  MR: { ar: 'موريتانيا', en: 'Mauritania' },
  MA: { ar: 'المغرب', en: 'Morocco' },
  OM: { ar: 'عُمان', en: 'Oman' },
  PS: { ar: 'فلسطين', en: 'Palestine' },
  QA: { ar: 'قطر', en: 'Qatar' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  SO: { ar: 'الصومال', en: 'Somalia' },
  SD: { ar: 'السودان', en: 'Sudan' },
  SY: { ar: 'سوريا', en: 'Syria' },
  TN: { ar: 'تونس', en: 'Tunisia' },
  AE: { ar: 'الإمارات', en: 'United Arab Emirates' },
  YE: { ar: 'اليمن', en: 'Yemen' }
};

function cleanText(value) {
  return String(value || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeActivityName(value) {
  return cleanText(value)
    .replace(/^نشاط\s+/i, '')
    .replace(/\s+activity$/i, '')
    .replace(/^activity\s+/i, '')
    .trim();
}

function cityCompleteness(city) {
  let score = 0;
  if (city.code && !String(city.code).includes('-98-')) score += 5;
  if (Number(city.population) > 0) score += 3;
  if (city.name_ar) score += 1;
  if (city.name_en) score += 1;
  if (city.region) score += 1;
  if (Number.isFinite(Number(city.purchasing_power_index))) score += 1;
  if (Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lng))) score += 1;
  return score;
}

function canonicalizeCities(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    if (!row || !row.country_code) continue;
    const nameKey = normalizeKey(row.name_en) || normalizeKey(row.name_ar) || normalizeKey(row.code);
    if (!nameKey) continue;
    const key = `${row.country_code}:${nameKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.values()].map(group => {
    const ranked = group.slice().sort((a, b) => cityCompleteness(b) - cityCompleteness(a));
    const canonical = ranked[0];
    const aliases = ranked.slice(1).map(item => ({
      id: item.id,
      code: item.code,
      name_ar: item.name_ar,
      name_en: item.name_en,
      region: item.region
    }));
    const warnings = [];
    if (aliases.length) warnings.push('duplicate_city_aliases');
    if (!canonical.name_ar || !canonical.name_en) warnings.push('missing_city_name');
    if (!Number(canonical.population)) warnings.push('population_missing_or_zero');
    if (!canonical.region) warnings.push('region_missing');

    return {
      ...canonical,
      canonical_code: canonical.code,
      aliases,
      alias_codes: aliases.map(a => a.code).filter(Boolean),
      completeness: cityCompleteness(canonical),
      recordStatus: warnings.length ? 'incomplete' : 'complete',
      warnings
    };
  }).sort((a, b) =>
    cleanText(a.name_ar).localeCompare(cleanText(b.name_ar), 'ar')
  );
}

function activityCompleteness(activity) {
  let score = 0;
  if (activity.code) score += 2;
  if (activity.name_ar) score += 2;
  if (activity.name_en) score += 2;
  if (activity.sector_code) score += 1;
  if (activity.sub_sector_code) score += 1;
  if (activity.is_active !== false) score += 1;
  return score;
}

function canonicalizeActivities(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    if (!row || row.is_active === false) continue;
    const ar = normalizeActivityName(row.name_ar);
    const en = normalizeActivityName(row.name_en);
    const semantic = normalizeKey(ar) || normalizeKey(en) || normalizeKey(row.code);
    if (!semantic) continue;
    if (!groups.has(semantic)) groups.set(semantic, []);
    groups.get(semantic).push({ ...row, normalized_name_ar: ar, normalized_name_en: en });
  }

  return [...groups.values()].map(group => {
    const ranked = group.slice().sort((a, b) => activityCompleteness(b) - activityCompleteness(a));
    const canonical = ranked[0];
    const aliases = ranked.map(item => item.code).filter(Boolean);
    const sectorCodes = [...new Set(ranked.map(item => item.sector_code).filter(Boolean))];
    const warnings = [];
    if (aliases.length > 1) warnings.push('duplicate_activity_aliases');
    if (!canonical.name_ar || !canonical.name_en) warnings.push('missing_activity_name');

    return {
      code: canonical.code,
      canonical_code: canonical.code,
      name_ar: canonical.normalized_name_ar || canonical.name_ar,
      name_en: canonical.normalized_name_en || canonical.name_en,
      aliases,
      sector_codes: sectorCodes,
      alias_count: Math.max(0, aliases.length - 1),
      completeness: activityCompleteness(canonical),
      recordStatus: warnings.length && warnings.some(w => w === 'missing_activity_name') ? 'incomplete' : 'complete',
      warnings
    };
  }).sort((a, b) => cleanText(a.name_ar).localeCompare(cleanText(b.name_ar), 'ar'));
}

function buildCountryCatalog(cityRows = []) {
  const counts = {};
  for (const city of canonicalizeCities(cityRows)) {
    counts[city.country_code] = (counts[city.country_code] || 0) + 1;
  }
  return Object.entries(COUNTRY_NAMES).map(([code, names]) => ({
    code,
    name_ar: names.ar,
    name_en: names.en,
    cityCount: counts[code] || 0,
    recordStatus: counts[code] ? 'available' : 'no_cities'
  })).sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
}

module.exports = {
  COUNTRY_NAMES,
  cleanText,
  normalizeKey,
  normalizeActivityName,
  canonicalizeCities,
  canonicalizeActivities,
  buildCountryCatalog
};
