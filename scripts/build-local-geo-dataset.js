#!/usr/bin/env node
'use strict';

/**
 * Build a local Arab geography dataset from GeoNames dump files.
 * No runtime API, AI provider, API key or provider token is used.
 *
 * Required local files:
 *   .tmp-geo/allCountries.txt
 * Optional:
 *   .tmp-geo/alternateNames.txt
 *
 * Output:
 *   .tmp-geo/arab-localities.ndjson
 *   .tmp-geo/arab-localities-manifest.json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const GEO_DIR = path.join(ROOT, '.tmp-geo');
const INPUT = path.join(GEO_DIR, 'allCountries.txt');
const ALT_INPUT = path.join(GEO_DIR, 'alternateNames.txt');
const OUTPUT = path.join(GEO_DIR, 'arab-localities.ndjson');
const MANIFEST = path.join(GEO_DIR, 'arab-localities-manifest.json');

const ARAB_CODES = new Set([
  'DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR',
  'MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'
]);

const FEATURE_TO_TYPE = {
  PPLC: 'city',
  PPLA: 'city',
  PPLA2: 'town',
  PPLA3: 'town',
  PPLA4: 'town',
  PPL: 'settlement',
  PPLF: 'village',
  PPLG: 'village',
  PPLL: 'village',
  PPLR: 'village',
  PPLS: 'village',
  PPLX: 'district',
  STLMT: 'settlement'
};

function parseGeoLine(line) {
  const p = line.split('\t');
  return {
    geonameid: p[0],
    name: p[1],
    ascii_name: p[2],
    alternate_names: p[3],
    lat: Number(p[4]),
    lng: Number(p[5]),
    feature_class: p[6],
    feature_code: p[7],
    country_code: p[8],
    admin1_code: p[10] || null,
    admin2_code: p[11] || null,
    admin3_code: p[12] || null,
    admin4_code: p[13] || null,
    population: Number(p[14]) || null,
    elevation_m: p[15] ? Number(p[15]) : null,
    timezone: p[17] || null,
    modified_on: p[18] || null
  };
}

function normalizeArabic(value) {
  return String(value || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function classifyPlace(row) {
  if (FEATURE_TO_TYPE[row.feature_code]) return FEATURE_TO_TYPE[row.feature_code];
  if (/^PPL/.test(row.feature_code || '')) return 'settlement';
  return 'other';
}

async function loadArabicAliases(ids) {
  const map = new Map();
  if (!fs.existsSync(ALT_INPUT) || ids.size === 0) return map;

  const rl = readline.createInterface({
    input: fs.createReadStream(ALT_INPUT),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    const geonameid = p[1];
    const lang = p[2];
    const value = p[3];
    if (!ids.has(geonameid) || !value) continue;
    if (lang !== 'ar' && lang !== 'en') continue;

    if (!map.has(geonameid)) map.set(geonameid, { ar: [], en: [] });
    const bucket = map.get(geonameid)[lang];
    if (!bucket.includes(value)) bucket.push(value);
  }
  return map;
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error('Missing .tmp-geo/allCountries.txt. Download the GeoNames dump locally first.');
  }

  fs.mkdirSync(GEO_DIR, { recursive: true });

  const rows = [];
  const ids = new Set();
  const counts = {};
  const featureCounts = {};

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const row = parseGeoLine(line);
    if (!ARAB_CODES.has(row.country_code)) continue;
    if (row.feature_class !== 'P') continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;

    rows.push(row);
    ids.add(row.geonameid);
    counts[row.country_code] = (counts[row.country_code] || 0) + 1;
    featureCounts[row.feature_code] = (featureCounts[row.feature_code] || 0) + 1;
  }

  const aliases = await loadArabicAliases(ids);
  const out = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });

  for (const row of rows) {
    const alt = aliases.get(row.geonameid) || { ar: [], en: [] };
    const nameAr = alt.ar[0] || null;
    const nameEn = alt.en[0] || row.name || row.ascii_name || null;
    const payload = {
      canonical_code: 'GN-' + row.geonameid,
      country_code: row.country_code,
      name_ar: nameAr,
      name_en: nameEn,
      canonical_name: nameAr || nameEn || row.name,
      normalized_name_ar: normalizeArabic(nameAr),
      place_type: classifyPlace(row),
      lat: row.lat,
      lng: row.lng,
      population: row.population,
      elevation_m: Number.isFinite(row.elevation_m) ? row.elevation_m : null,
      source_code: 'geonames_dump',
      source_id: row.geonameid,
      source_updated_at: row.modified_on || null,
      confidence: nameAr ? 88 : 80,
      aliases: [
        ...alt.ar.map(value => ({ alias: value, language: 'ar', alias_type: 'source' })),
        ...alt.en.map(value => ({ alias: value, language: 'en', alias_type: 'source' }))
      ],
      metadata: {
        feature_code: row.feature_code,
        admin1_code: row.admin1_code,
        admin2_code: row.admin2_code,
        admin3_code: row.admin3_code,
        admin4_code: row.admin4_code,
        timezone: row.timezone,
        original_name: row.name,
        ascii_name: row.ascii_name
      }
    };
    out.write(JSON.stringify(payload) + '\n');
  }

  out.end();

  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'GeoNames local dump',
    runtime_api_required: false,
    api_key_required: false,
    countries: counts,
    total_places: rows.length,
    feature_codes: featureCounts
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
