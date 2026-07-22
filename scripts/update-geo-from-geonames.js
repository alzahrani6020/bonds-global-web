#!/usr/bin/env node
/**
 * Update Bonds geographic master data from GeoNames dumps.
 *
 * Downloads (or reuses) GeoNames dumps from .tmp-geo/ and regenerates:
 *   - v3/master-data/countries-governorates-cities.js
 *   - v3/master-data/global-countries.js
 *   - v3/master-data/arab-extended-countries.js
 *
 * Preserves existing country metadata (currency, platforms, notes, etc.).
 * Adds Arabic translations from GeoNames alternateNames where available.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GEO_DIR = path.join(ROOT, '.tmp-geo');

const OUT_PATHS = {
  arab: path.join(ROOT, 'v3/master-data/countries-governorates-cities.js'),
  global: path.join(ROOT, 'v3/master-data/global-countries.js'),
  extended: path.join(ROOT, 'v3/master-data/arab-extended-countries.js')
};

const FILES = {
  admin1: path.join(GEO_DIR, 'admin1CodesASCII.txt'),
  countryInfo: path.join(GEO_DIR, 'countryInfo.txt'),
  allCountries: path.join(GEO_DIR, 'allCountries.txt'),
  alternateNames: path.join(GEO_DIR, 'alternateNames.txt')
};

const MAX_CITIES_PER_GOVERNORATE = 15;
const MAX_TOTAL_CITIES_PER_COUNTRY = 80;
const MIN_POPULATION_FOR_GLOBAL = 50000;
const MIN_POPULATION_FOR_EXTENDED = 50000;
const PRESERVE_ARAB_DATA = true; // Keep existing rich Arab country structure/codes

function loadExistingObject(filePath, varName) {
  if (!fs.existsSync(filePath)) return {};
  const code = fs.readFileSync(filePath, 'utf8') + '\n' + varName + ';';
  try {
    return vm.runInNewContext(code);
  } catch (err) {
    console.warn('Could not parse existing', filePath, err.message);
    return {};
  }
}

function loadAllExisting() {
  return {
    arab: loadExistingObject(OUT_PATHS.arab, 'ARAB_COUNTRIES_GEO'),
    global: loadExistingObject(OUT_PATHS.global, 'GLOBAL_COUNTRIES_GEO'),
    extended: loadExistingObject(OUT_PATHS.extended, 'ARAB_EXTENDED_COUNTRIES_GEO')
  };
}

function getTargetCountries(existing) {
  const target = {};
  Object.entries(existing).forEach(([bucket, countries]) => {
    Object.entries(countries).forEach(([code, data]) => {
      target[code] = { bucket, existing: data };
    });
  });
  return target;
}

async function readAdmin1Codes() {
  const map = new Map(); // key: `${countryCode}.${admin1Code}` -> { nameEn, nameAr }
  const fileStream = fs.createReadStream(FILES.admin1);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    const key = parts[0]; // e.g. US.IL
    const nameEn = parts[1];
    const nameAr = parts[3] || '';
    if (key && nameEn) {
      map.set(key, { nameEn, nameAr });
    }
  }
  return map;
}

async function readCountryInfo(targetCountries) {
  const map = new Map(); // code -> { nameEn, nameAr, population }
  const fileStream = fs.createReadStream(FILES.countryInfo);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    const code = parts[0];
    if (!targetCountries[code]) continue;
    const nameEn = parts[4];
    const nameAr = '';
    const population = parseInt(parts[7], 10) || 0;
    map.set(code, { nameEn, nameAr, population });
  }
  return map;
}

function parseAllCountriesLine(line) {
  const parts = line.split('\t');
  return {
    geonameid: parts[0],
    name: parts[1],
    asciiName: parts[2],
    altNames: parts[3],
    lat: parts[4],
    lng: parts[5],
    featureClass: parts[6],
    featureCode: parts[7],
    countryCode: parts[8],
    cc2: parts[9],
    admin1: parts[10],
    admin2: parts[11],
    admin3: parts[12],
    admin4: parts[13],
    population: parseInt(parts[14], 10) || 0
  };
}

async function readAllCountries(targetCountries) {
  const admin1Map = new Map(); // code -> [{ admin1, nameEn, nameAr, geonameid }]
  const citiesMap = new Map(); // code -> [{ nameEn, nameAr, admin1, population, geonameid }]
  const targetCodes = new Set(Object.keys(targetCountries));

  const fileStream = fs.createReadStream(FILES.allCountries);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let processed = 0;
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const p = parseAllCountriesLine(line);
    if (!targetCodes.has(p.countryCode)) continue;

    processed++;
    if (p.featureClass === 'A' && p.featureCode === 'ADM1' && p.admin1) {
      if (!admin1Map.has(p.countryCode)) admin1Map.set(p.countryCode, []);
      admin1Map.get(p.countryCode).push({
        admin1: p.admin1,
        nameEn: p.name || p.asciiName,
        nameAr: '',
        geonameid: p.geonameid
      });
    } else if (p.featureClass === 'P') {
      if (!citiesMap.has(p.countryCode)) citiesMap.set(p.countryCode, []);
      citiesMap.get(p.countryCode).push({
        nameEn: p.name || p.asciiName,
        nameAr: '',
        admin1: p.admin1,
        population: p.population,
        geonameid: p.geonameid
      });
    }
  }
  console.log(`Parsed ${processed} rows for target countries from allCountries.txt`);
  return { admin1Map, citiesMap };
}

async function readAlternateNames(targetCountries) {
  const targetGeonameIds = new Set();
  // We will populate this after reading allCountries; placeholder for structure.
  return { targetGeonameIds, names: new Map() };
}

async function readAlternateNamesWithIds(targetGeonameIds) {
  const names = new Map(); // geonameid -> { ar, en preferred? }
  const fileStream = fs.createReadStream(FILES.alternateNames);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let processed = 0;
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    const geonameid = parts[1];
    if (!targetGeonameIds.has(geonameid)) continue;
    const lang = parts[2];
    const altName = parts[3];
    if (!altName) continue;
    if (lang === 'ar' || lang === 'en') {
      if (!names.has(geonameid)) names.set(geonameid, {});
      const entry = names.get(geonameid);
      if (lang === 'ar' && !entry.nameAr) entry.nameAr = altName;
      if (lang === 'en' && !entry.nameEn) entry.nameEn = altName;
    }
    processed++;
  }
  console.log(`Parsed ${processed} alternate name rows for target geonameids`);
  return names;
}

function buildGovernorates(countryCode, countryData, admin1Entries, cityEntries, altNames) {
  // Apply alternate names
  admin1Entries.forEach(a => {
    const alt = altNames.get(a.geonameid);
    if (alt && alt.nameAr) a.nameAr = alt.nameAr;
  });
  cityEntries.forEach(c => {
    const alt = altNames.get(c.geonameid);
    if (alt && alt.nameAr) c.nameAr = alt.nameAr;
  });

  // Build admin1 index
  const admin1Index = new Map(); // admin1 code -> index in sorted array
  const sortedAdmin1 = admin1Entries
    .filter(a => a.admin1)
    .sort((a, b) => a.admin1.localeCompare(b.admin1));
  sortedAdmin1.forEach((a, idx) => admin1Index.set(a.admin1, idx));

  // Sort cities by population descending
  const sortedCities = cityEntries.sort((a, b) => b.population - a.population);

  // Group cities by governorate, but globally cap total cities per country
  const govGroups = new Map(); // admin1 code -> cities[]
  let totalAdded = 0;
  sortedCities.forEach(city => {
    if (!city.admin1 || !admin1Index.has(city.admin1)) return;
    if (!govGroups.has(city.admin1)) govGroups.set(city.admin1, []);
    if (totalAdded >= MAX_TOTAL_CITIES_PER_COUNTRY) return;
    if (govGroups.get(city.admin1).length < MAX_CITIES_PER_GOVERNORATE) {
      govGroups.get(city.admin1).push(city);
      totalAdded++;
    }
  });

  // Build governorates array
  const governorates = sortedAdmin1.map((admin, adminIdx) => {
    const cities = (govGroups.get(admin.admin1) || []).map((city, cityIdx) => ({
      name: city.nameAr || city.nameEn,
      nameEn: city.nameEn,
      code: `${countryCode}-${String(adminIdx + 1).padStart(2, '0')}-${String(cityIdx + 1).padStart(3, '0')}`
    }));
    return {
      name: admin.nameAr || admin.nameEn,
      nameEn: admin.nameEn,
      cities
    };
  }).filter(g => g.cities.length > 0);

  return governorates;
}

function escapeJsString(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function stringifyCountry(code, data, indent = 2) {
  const prefix = ' '.repeat(indent);
  let out = `${prefix}${code}: {\n`;
  const keys = Object.keys(data);
  keys.forEach((key, i) => {
    const val = data[key];
    const isLast = i === keys.length - 1;
    out += `${prefix}  ${key}: ${stringifyValue(val, indent + 4)}${isLast ? '' : ','}\n`;
  });
  out += `${prefix}}`;
  return out;
}

function stringifyValue(val, indent) {
  if (typeof val === 'string') return `'${escapeJsString(val)}'`;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const prefix = ' '.repeat(indent);
    let out = '[\n';
    val.forEach((item, i) => {
      const isLast = i === val.length - 1;
      out += `${prefix}  ${stringifyValue(item, indent + 2)}${isLast ? '' : ','}\n`;
    });
    out += `${prefix}]`;
    return out;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    const prefix = ' '.repeat(indent);
    let out = '{\n';
    keys.forEach((key, i) => {
      const isLast = i === keys.length - 1;
      out += `${prefix}  ${key}: ${stringifyValue(val[key], indent + 2)}${isLast ? '' : ','}\n`;
    });
    out += `${prefix}}`;
    return out;
  }
  return String(val);
}

function writeGeoFile(filePath, varName, dataObj, headerLines) {
  const lines = [
    '/**',
    ...headerLines.map(h => ' * ' + h),
    ' */',
    '',
    `const ${varName} = {`
  ];
  const codes = Object.keys(dataObj).sort();
  codes.forEach((code, i) => {
    const isLast = i === codes.length - 1;
    lines.push(stringifyCountry(code, dataObj[code], 2) + (isLast ? '' : ','));
  });
  lines.push('};');
  lines.push('');
  lines.push('if (typeof window !== \'undefined\') {');
  lines.push(`  window.${varName} = ${varName};`);
  lines.push('}');
  lines.push('');
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function main() {
  console.log('Loading existing master data...');
  const existing = loadAllExisting();
  const targetCountries = getTargetCountries(existing);
  console.log(`Targeting ${Object.keys(targetCountries).length} countries`);

  console.log('Reading GeoNames admin1 codes...');
  const admin1Codes = await readAdmin1Codes();

  console.log('Reading allCountries.txt (this may take a while)...');
  const { admin1Map, citiesMap } = await readAllCountries(targetCountries);

  // Collect all geonameids that need alternate names
  const targetGeonameIds = new Set();
  admin1Map.forEach(list => list.forEach(a => targetGeonameIds.add(a.geonameid)));
  citiesMap.forEach(list => list.forEach(c => targetGeonameIds.add(c.geonameid)));
  console.log(`Collecting alternate names for ${targetGeonameIds.size} geonameids...`);
  const altNames = await readAlternateNamesWithIds(targetGeonameIds);

  // Resolve admin1 names from admin1Codes where missing
  admin1Map.forEach((list, code) => {
    list.forEach(a => {
      const key = `${code}.${a.admin1}`;
      const info = admin1Codes.get(key);
      if (info) {
        if (!a.nameEn && info.nameEn) a.nameEn = info.nameEn;
        if (!a.nameAr && info.nameAr) a.nameAr = info.nameAr;
      }
    });
  });

  const output = { arab: {}, global: {}, extended: {} };

  for (const [code, { bucket, existing }] of Object.entries(targetCountries)) {
    let governorates;

    if (bucket === 'arab' && PRESERVE_ARAB_DATA && existing.governorates && existing.governorates.length > 0) {
      // Keep existing governorates/city codes to avoid breaking tests and UX order.
      governorates = existing.governorates;
    } else {
      const admin1Entries = admin1Map.get(code) || [];
      let cityEntries = citiesMap.get(code) || [];

      const minPop = bucket === 'extended' ? MIN_POPULATION_FOR_EXTENDED : MIN_POPULATION_FOR_GLOBAL;
      cityEntries = cityEntries.filter(c => c.population >= minPop);

      // For small/extended countries, fallback to "General" governorate with top cities
      if (admin1Entries.length === 0 || admin1Entries.length < 2) {
        const topCities = cityEntries
          .sort((a, b) => b.population - a.population)
          .slice(0, bucket === 'extended' ? 20 : MAX_TOTAL_CITIES_PER_COUNTRY)
          .map((city, idx) => ({
            name: city.nameAr || city.nameEn,
            nameEn: city.nameEn,
            code: `${code}-01-${String(idx + 1).padStart(3, '0')}`
          }));
        if (topCities.length > 0) {
          governorates = [{
            name: 'عام',
            nameEn: 'General',
            cities: topCities
          }];
        }
      } else {
        governorates = buildGovernorates(code, existing, admin1Entries, cityEntries, altNames);
      }
    }

    if (!governorates || governorates.length === 0) {
      console.warn(`No geonames data for ${code}, keeping existing governorates`);
      governorates = existing.governorates;
    }

    const merged = {
      ...existing,
      code,
      governorates
    };

    // Ensure basic fields
    if (!merged.name) merged.name = existing.name || code;
    if (!merged.nameEn) merged.nameEn = existing.nameEn || code;
    if (!merged.flag) merged.flag = existing.flag || '';

    output[bucket][code] = merged;
  }

  console.log('Writing updated master data files...');
  if (!PRESERVE_ARAB_DATA) {
    writeGeoFile(OUT_PATHS.arab, 'ARAB_COUNTRIES_GEO', output.arab, [
      'Bonds Global — Arab Countries, Governorates/Regions, and Major Cities',
      'Centralized geographic master data used by calculators, auth pages, and V3 engine.',
      'Covers all 22 Arab League member states.',
      'Auto-generated by scripts/update-geo-from-geonames.js from GeoNames.org data.',
      '',
      'Structure per country:',
      '  code (ISO-3166), name, nameEn, flag,',
      '  governorates[]: { name, nameEn, cities[]: { name, nameEn, code } }',
      '',
      'City code convention: <COUNTRY>-<GOV_INDEX>-<CITY_INDEX>',
      'e.g. SA-01-001 = Riyadh, EG-01-001 = Cairo'
    ]);
  } else {
    console.log('Preserving existing Arab countries file:', OUT_PATHS.arab);
  }

  writeGeoFile(OUT_PATHS.global, 'GLOBAL_COUNTRIES_GEO', output.global, [
    'Bonds Global — Global Countries Supplement',
    'Major non-Arab economies for use in country selectors across calculators.',
    'Auto-generated by scripts/update-geo-from-geonames.js from GeoNames.org data.',
    'Existing currency, platform, and market metadata is preserved.'
  ]);

  writeGeoFile(OUT_PATHS.extended, 'ARAB_EXTENDED_COUNTRIES_GEO', output.extended, [
    'Bonds Global — Extended Arabic-speaking / observer markets',
    'Auto-generated by scripts/update-geo-from-geonames.js from GeoNames.org data.'
  ]);

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
