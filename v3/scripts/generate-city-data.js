/**
 * Generate v3/master-data/cities.csv and a Supabase seed migration
 * from v3/master-data/countries-governorates-cities.js
 */
const fs = require('fs');
const path = require('path');

const { ARAB_COUNTRIES_GEO } = require('../master-data/countries-governorates-cities.js');

const rows = [];
const sqlValues = [];

for (const countryCode in ARAB_COUNTRIES_GEO) {
  const country = ARAB_COUNTRIES_GEO[countryCode];
  for (const gov of country.governorates) {
    for (const city of gov.cities) {
      rows.push({
        code: city.code,
        name_ar: city.name,
        name_en: city.nameEn,
        region: gov.name,
        country_code: countryCode,
        population: '',
        avg_household_income: '',
        purchasing_power_index: ''
      });
      sqlValues.push(
        `('${city.code}', '${city.name.replace(/'/g, "''")}', '${city.nameEn.replace(/'/g, "''")}', '${gov.name.replace(/'/g, "''")}', '${countryCode}', 0, 0, 0, 100)`
      );
    }
  }
}

// Write CSV
const csvHeader = 'code,name_ar,name_en,region,population,avg_household_income,purchasing_power_index';
const csvLines = rows.map(r =>
  `${r.code},${r.name_ar},${r.name_en},${r.region},${r.population},${r.avg_household_income},${r.purchasing_power_index}`
);
const csvPath = path.join(__dirname, '..', 'master-data', 'cities.csv');
fs.writeFileSync(csvPath, [csvHeader, ...csvLines].join('\n') + '\n', 'utf8');
console.log(`Wrote ${rows.length} cities to ${csvPath}`);

// Write SQL migration
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260617000001_add_all_arab_cities.sql');
const migrationSql = `-- Bonds V3 — Seed all Arab countries, governorates, and major cities
-- Generated automatically from countries-governorates-cities.js

INSERT INTO public.cities (
  code, name_ar, name_en, region, country_code,
  population, population_growth_rate, avg_household_income, purchasing_power_index
) VALUES
${sqlValues.join(',\n')}
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  region = EXCLUDED.region,
  country_code = EXCLUDED.country_code,
  population = EXCLUDED.population,
  population_growth_rate = EXCLUDED.population_growth_rate,
  avg_household_income = EXCLUDED.avg_household_income,
  purchasing_power_index = EXCLUDED.purchasing_power_index;
`;
fs.writeFileSync(migrationPath, migrationSql, 'utf8');
console.log(`Wrote migration to ${migrationPath}`);
