/**
 * Calibrate city-level competitor counts using Geoapify raw counts and
 * country-level benchmarks. Stores calibrated values in
 * public.city_competitor_calibration for the CompetitionEngine to use.
 *
 * Usage:
 *   node scripts/calibrate-competitor-counts.js [activityCode] [year]
 *   node scripts/calibrate-competitor-counts.js dental_clinics 2025
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { calibrateCompetitorCounts } = require('../engine/data-acquisition/CompetitorCalibration');

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

async function main() {
  const activityCode = process.argv[2] || 'dental_clinics';
  const year = parseInt(process.argv[3] || '2025', 10);

  const env = loadEnvLocal();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Calibrating ${activityCode} for year ${year}...`);

  const result = await calibrateCompetitorCounts({
    supabase,
    activityCode,
    year,
    onProgress: (cityCode, rawValue, err) => {
      if (err) {
        console.warn(`  ${cityCode}: failed - ${err}`);
      } else {
        console.log(`  ${cityCode}: raw=${rawValue}`);
      }
    }
  });

  console.log('\nCountry factors:', result.countryFactor);
  console.log(`Upserted: ${result.upserted.length}`);
  console.log(`Skipped: ${result.skipped.length}${result.skipped.length ? ' (' + result.skipped.join(', ') + ')' : ''}`);
}

main().catch(err => {
  console.error('Calibration failed:', err.message);
  process.exit(1);
});
