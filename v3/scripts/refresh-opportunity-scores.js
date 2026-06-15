/**
 * Bonds V3 — Refresh opportunity scores for existing city_market_data rows.
 *
 * Usage:
 *   node scripts/refresh-opportunity-scores.js [year] [activity_code]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpportunityScoringEngine = require('../engine/OpportunityScoringEngine');

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
  const env = loadEnvLocal();
  const year = parseInt(process.argv[2] || new Date().getFullYear(), 10);
  const activityCode = process.argv[3] || null;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const engine = new OpportunityScoringEngine(supabase);

  let activityId = null;
  if (activityCode) {
    const { data: activity, error } = await supabase
      .from('economic_activities')
      .select('id')
      .eq('code', activityCode)
      .single();
    if (error || !activity) throw new Error(`Activity not found: ${activityCode}`);
    activityId = activity.id;
  }

  let query = supabase
    .from('city_market_data')
    .select('city_id, activity_id, data_year')
    .eq('data_year', year);
  if (activityId) query = query.eq('activity_id', activityId);

  const { data: rows, error } = await query;
  if (error) throw error;

  console.log(`Refreshing opportunity scores for ${rows.length} rows (year=${year})...`);

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await engine.calculateAndSave({
        cityId: row.city_id,
        activityId: row.activity_id,
        year: row.data_year
      });
      processed++;
      if (processed % 10 === 0) {
        console.log(`  ${processed}/${rows.length} processed...`);
      }
    } catch (err) {
      console.error(`  [${row.city_id}/${row.activity_id}] FAILED: ${err.message}`);
      failed++;
    }
  }

  // Recalculate ranks per affected activity
  const activityIds = [...new Set(rows.map(r => r.activity_id))];
  for (const actId of activityIds) {
    try {
      const result = await engine.recalculateRanks({ activityId: actId, year });
      console.log(`  Ranks updated for activity ${actId}: ${result.updated} rows`);
    } catch (err) {
      console.error(`  Rank update failed for activity ${actId}:`, err.message);
    }
  }

  console.log(`\nDone. Processed: ${processed}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Refresh failed:', err.message);
  process.exit(1);
});
