/**
 * Generate city_market_data for a given activity across all cities using inference.
 * Usage: node scripts/generate-activity-data.js <activityCode> [year]
 */
const fs = require('fs');
const path = require('path');
const DataPipeline = require('../engine/data-acquisition/DataPipeline');
const { getSupabaseClient } = require('../lib/supabase');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim().replace(/\r$/, '');
  });
  return env;
}

async function main() {
  Object.assign(process.env, loadEnvLocal());

  const activityCode = process.argv[2];
  const year = parseInt(process.argv[3] || new Date().getFullYear(), 10);

  if (!activityCode) {
    console.error('Usage: node scripts/generate-activity-data.js <activityCode> [year]');
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  const { data: activity, error: actError } = await supabase
    .from('economic_activities')
    .select('id, code, name_ar')
    .eq('code', activityCode)
    .single();

  if (actError || !activity) {
    console.error('Activity not found:', activityCode);
    process.exit(1);
  }

  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, code, name_ar, country_code')
    .eq('is_active', true)
    .order('name_ar');

  if (citiesError) throw citiesError;

  const config = {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const pipeline = new DataPipeline(config);

  let success = 0;
  let failed = 0;

  for (const city of cities || []) {
    try {
      await pipeline.fuseToGold({
        cityId: city.id,
        cityCode: city.code,
        activityId: activity.id,
        activityCode: activity.code,
        year
      });
      success++;
      console.log(`✅ ${city.name_ar} (${city.code})`);
    } catch (err) {
      failed++;
      console.warn(`❌ ${city.name_ar} (${city.code}):`, err.message);
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
