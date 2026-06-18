/**
 * Test a single city/activity through all V3 data engines.
 */
const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('../lib/supabase');
const {
  CityEngine, RealEstateEngine, LaborEngine, CompetitionEngine, MarketEngine, PricingEngine
} = require('../engine/data-acquisition/engines');

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

async function resolveCity(supabase, cityCode) {
  const { data, error } = await supabase.from('cities').select('id, code, country_code').eq('code', cityCode).single();
  if (error || !data) throw new Error(`City not found: ${cityCode}`);
  return data;
}

async function resolveActivity(supabase, activityCode) {
  const { data, error } = await supabase.from('economic_activities').select('id, code').eq('code', activityCode).single();
  if (error || !data) throw new Error(`Activity not found: ${activityCode}`);
  return data;
}

async function main() {
  const env = loadEnvLocal();
  process.env.SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const cityCode = process.argv[2] || 'riyadh';
  const activityCode = process.argv[3] || 'restaurant';
  const year = parseInt(process.argv[4] || '2026', 10);

  const supabase = getSupabaseClient();
  const city = await resolveCity(supabase, cityCode);
  const activity = await resolveActivity(supabase, activityCode);

  const config = {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  console.log(`\n=== Testing engines for ${cityCode}/${activityCode}/${year} ===\n`);
  const results = {};

  for (const Engine of [CityEngine, RealEstateEngine, LaborEngine, CompetitionEngine, MarketEngine, PricingEngine]) {
    const engineName = Engine.name;
    try {
      const engine = new Engine(config);
      const result = await engine.run({
        cityId: city.id,
        cityCode: city.code,
        countryCode: city.country_code,
        activityId: activity.id,
        activityCode: activity.code,
        year
      });
      results[engineName] = result;
      console.log(`${engineName}: OK`, Object.keys(result).slice(0,5));
    } catch (err) {
      console.error(`${engineName}: FAILED — ${err.message}`);
      results[engineName] = { error: err.message };
    }
  }

  // Verify city_market_data row
  const { data, error } = await supabase
    .from('city_market_data')
    .select('*')
    .eq('city_id', city.id)
    .eq('activity_id', activity.id)
    .eq('data_year', year)
    .single();
  console.log('\n=== city_market_data row ===');
  if (error) console.error('Could not fetch:', error.message);
  else console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
