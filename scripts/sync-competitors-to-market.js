/**
 * Sync calibrated competitor counts into city_market_data and refresh opportunity scores.
 *
 * Usage:
 *   node scripts/sync-competitors-to-market.js [year]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpportunityScoringEngine = require('../v3/engine/OpportunityScoringEngine');

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
  const env = loadEnvLocal();
  const year = parseInt(process.argv[2] || new Date().getFullYear(), 10);
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase credentials missing');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const engine = new OpportunityScoringEngine(supabase);

  // Pull all calibrations for the year with market rows
  const { data: calibrations, error: calError } = await supabase
    .from('city_competitor_calibration')
    .select('city_id, activity_id, calibrated_value')
    .eq('year', year);
  if (calError) throw calError;

  console.log(`Syncing ${calibrations.length} calibrated competitor counts for ${year}...`);
  let updated = 0;
  for (const c of calibrations) {
    const { error } = await supabase
      .from('city_market_data')
      .update({ competitors_count: Math.round(c.calibrated_value) })
      .eq('city_id', c.city_id)
      .eq('activity_id', c.activity_id)
      .eq('data_year', year);
    if (error) {
      console.warn(`  Update failed ${c.city_id}/${c.activity_id}: ${error.message}`);
    } else {
      updated++;
    }
  }
  console.log(`  Updated ${updated} rows.`);

  // Refresh opportunity scores for affected activities
  const activityIds = [...new Set(calibrations.map(c => c.activity_id))];
  console.log(`Refreshing opportunity scores for ${activityIds.length} activities...`);
  for (const activityId of activityIds) {
    const { data: rows, error } = await supabase
      .from('city_market_data')
      .select('city_id, activity_id, data_year')
      .eq('data_year', year)
      .eq('activity_id', activityId);
    if (error) {
      console.warn(`  Query failed for ${activityId}: ${error.message}`);
      continue;
    }
    let processed = 0;
    for (const row of rows) {
      try {
        await engine.calculateAndSave({
          cityId: row.city_id,
          activityId: row.activity_id,
          year: row.data_year
        });
        processed++;
      } catch (err) {
        console.warn(`  Score failed ${row.city_id}: ${err.message}`);
      }
    }
    await engine.recalculateRanks({ activityId, year });
    console.log(`  Activity ${activityId}: ${processed}/${rows.length} scored`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
