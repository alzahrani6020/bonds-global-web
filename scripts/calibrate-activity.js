/**
 * Calibrate a single activity using real external competitor counts.
 *
 * Usage:
 *   node scripts/calibrate-activity.js <activityCode> [year]
 * Example:
 *   node scripts/calibrate-activity.js pharmacy 2026
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const CompetitorDataAdapter = require('../v3/engine/data-acquisition/adapters/CompetitorDataAdapter');
const { calibrateCompetitorCounts } = require('../v3/engine/data-acquisition/CompetitorCalibration');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

async function main() {
  const activityCode = process.argv[2];
  const year = parseInt(process.argv[3] || new Date().getFullYear(), 10);
  if (!activityCode) throw new Error('Usage: node scripts/calibrate-activity.js <activityCode> [year]');

  const env = loadEnvLocal();
  Object.assign(process.env, env); // make keys available to adapters and calibration
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase URL/key missing');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify activity exists
  const { data: activity, error: actErr } = await supabase
    .from('economic_activities')
    .select('id, code')
    .eq('code', activityCode)
    .single();
  if (actErr || !activity) throw new Error(`Activity ${activityCode} not found`);

  // Load cities
  const { data: cities, error: citiesErr } = await supabase
    .from('cities')
    .select('id, code, name_en, country_code, population')
    .order('code');
  if (citiesErr) throw citiesErr;

  const adapter = new CompetitorDataAdapter();

  // Fetch raw counts per city
  const countryPop = {};
  const countryRaw = {};
  const cityResults = [];

  console.log(`Fetching raw competitor counts for ${activityCode} (${cities.length} cities)...`);
  for (const city of cities) {
    try {
      const items = await adapter.fetch({
        cityCode: city.code,
        cityName: city.name_en,
        countryCode: city.country_code,
        population: city.population || 0,
        activityCode,
        year
      });
      const countItem = items.find(i => i.metricCode === 'competitors_count');
      const raw = countItem?.value || 0;
      cityResults.push({ city, raw });
      const cc = city.country_code;
      countryPop[cc] = (countryPop[cc] || 0) + (city.population || 0);
      countryRaw[cc] = (countryRaw[cc] || 0) + raw;
      console.log(`  ${city.code}: raw=${raw}`);
    } catch (err) {
      console.warn(`  ${city.code}: failed - ${err.message}`);
    }
  }

  // Insert/update country benchmarks based on real raw counts
  const metricCode = `competitors_per_10k_${activityCode}`;
  let inserted = 0;
  for (const cc of Object.keys(countryRaw)) {
    const pop = countryPop[cc];
    const raw = countryRaw[cc];
    if (!pop) continue;
    const benchmark = (raw / pop) * 10000;
    const { error } = await supabase
      .from('country_benchmarks')
      .upsert({
        country_code: cc,
        metric_code: metricCode,
        benchmark_value: benchmark,
        year,
        source: 'Bonds calibrated'
      }, { onConflict: 'country_code,metric_code,year' });
    if (error) {
      console.warn(`  Benchmark insert failed for ${cc}: ${error.message}`);
    } else {
      inserted++;
      console.log(`  Benchmark ${cc}: ${benchmark.toFixed(2)} per 10k`);
    }
  }
  console.log(`Inserted/updated ${inserted} country benchmarks.`);

  // Run calibration
  console.log(`Running calibration...`);
  const result = await calibrateCompetitorCounts({
    supabase,
    activityCode,
    year,
    onProgress: (cityCode, rawValue, err) => {
      if (err) console.warn(`  ${cityCode}: failed - ${err}`);
      else console.log(`  ${cityCode}: raw=${rawValue}`);
    }
  });

  console.log('Country factors:', result.countryFactor);
  console.log(`Upserted: ${result.upserted.length}`);
  console.log(`Skipped: ${result.skipped.length}${result.skipped.length ? ' (' + result.skipped.join(', ') + ')' : ''}`);

  // Refresh opportunity scores for this activity/year
  console.log('Refreshing opportunity scores...');
  const { data: rows, error: scoreErr } = await supabase
    .from('city_market_data')
    .select('city_id, activity_id, data_year')
    .eq('data_year', year)
    .eq('activity_id', activity.id);
  if (scoreErr) throw scoreErr;
  const OpportunityScoringEngine = require('../v3/engine/OpportunityScoringEngine');
  const engine = new OpportunityScoringEngine(supabase);
  let processed = 0;
  for (const row of rows) {
    try {
      await engine.calculateAndSave({ cityId: row.city_id, activityId: row.activity_id, year: row.data_year });
      processed++;
    } catch (err) {
      console.warn(`  Score failed for ${row.city_id}: ${err.message}`);
    }
  }
  await engine.recalculateRanks({ activityId: activity.id, year });
  console.log(`Refreshed ${processed}/${rows.length} opportunity scores.`);
}

main().catch(err => {
  console.error('Calibration failed:', err.message);
  process.exit(1);
});
