/**
 * Bonds V3 — Geocode cities using Geoapify and update lat/lng.
 *
 * Usage:
 *   node scripts/geocode-cities.js [--dry-run] [--country=SA]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

function parseArgs() {
  return {
    dryRun: process.argv.includes('--dry-run'),
    country: process.argv.find(a => a.startsWith('--country='))?.split('=')[1] || null
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeCity(nameEn, countryCode, apiKey) {
  const q = encodeURIComponent(`${nameEn}, ${countryCode}`);
  const url = `https://api.geoapify.com/v1/geocode/search?text=${q}&limit=1&apiKey=${apiKey}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Geoapify HTTP ${res.status}`);
  }
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng };
}

async function main() {
  const args = parseArgs();
  const env = loadEnvLocal();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  if (!env.GEOAPIFY_API_KEY) {
    throw new Error('GEOAPIFY_API_KEY required');
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('cities')
    .select('id, code, name_en, country_code, lat, lng');
  if (args.country) query = query.eq('country_code', args.country);

  const { data: cities, error } = await query.order('name_ar');
  if (error) throw error;

  console.log(`Found ${cities.length} cities to geocode`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const city of cities) {
    if (city.lat && city.lng) {
      console.log(`  [${city.code}] already has coordinates, skipping`);
      skipped++;
      continue;
    }

    try {
      const coords = await geocodeCity(city.name_en, city.country_code, env.GEOAPIFY_API_KEY);
      if (!coords) {
        console.warn(`  [${city.code}] no results for ${city.name_en}`);
        failed++;
        continue;
      }

      console.log(`  [${city.code}] ${city.name_en} -> lat=${coords.lat}, lng=${coords.lng}`);

      if (!args.dryRun) {
        const { error: updateError } = await supabase
          .from('cities')
          .update({ lat: coords.lat, lng: coords.lng })
          .eq('id', city.id);
        if (updateError) throw updateError;
      }
      updated++;
    } catch (err) {
      console.error(`  [${city.code}] FAILED: ${err.message}`);
      failed++;
    }

    // Respect Geoapify rate limits (~5 req/sec on free tier)
    await sleep(250);
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (args.dryRun) console.log('(Dry run — no changes saved)');
}

main().catch(err => {
  console.error('Geocoding failed:', err.message);
  process.exit(1);
});
