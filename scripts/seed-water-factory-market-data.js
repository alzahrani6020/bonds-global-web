/**
 * Seed script for water_factory_market_data table.
 * Usage:
 *   ADMIN_API_TOKEN=xxx API_BASE=https://bonds-global.com node scripts/seed-water-factory-market-data.js
 *
 * This pushes the local market benchmarks from
 * calculators/investment-center/water-factory-data.js into Supabase via the
 * /api/v3/water-factory-data admin endpoint so the calculator can serve
 * dynamic updates.
 */

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const API_BASE = (process.env.API_BASE || 'http://localhost:3000').replace(/\/$/, '');

if (!ADMIN_API_TOKEN) {
  console.error('Missing required env var: ADMIN_API_TOKEN');
  process.exit(1);
}

// Provide a minimal window shim so the IIFE data file runs in Node.
global.window = {};
require('../calculators/investment-center/water-factory-data.js');

const dataApi = global.window.WaterFactoryData;
if (!dataApi) {
  console.error('Could not load WaterFactoryData');
  process.exit(1);
}

const countries = dataApi.getAllCountries();

async function upsertCountry(code) {
  const country = dataApi.getCountryData(code);
  const meta = dataApi.getCountryMeta(code);
  const payload = {
    country_code: code,
    country_name_ar: country.nameAr || null,
    country_name_en: country.nameEn || null,
    data: stripMeta(country),
    meta: meta || {}
  };

  const res = await fetch(`${API_BASE}/api/v3/water-factory-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_API_TOKEN
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upsert ${code}: ${res.status} ${text}`);
  }
  const result = await res.json().catch(() => ({}));
  console.log(`Upserted ${code} - ${country.nameEn || country.nameAr} (${result.saved ? 'ok' : 'unknown'})`);
}

function stripMeta(country) {
  const copy = { ...country };
  delete copy.meta;
  return copy;
}

async function main() {
  for (const { code } of countries) {
    try {
      await upsertCountry(code);
    } catch (err) {
      console.error(err.message);
    }
  }
  console.log('Seed complete.');
}

main();
