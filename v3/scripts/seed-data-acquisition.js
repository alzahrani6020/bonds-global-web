/**
 * Seed Data Acquisition metrics for all cities.
 * Runs CityEngine for every city, then activity-specific engines for a sample activity.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const {
  engines: {
    CityEngine,
    RealEstateEngine,
    LaborEngine,
    CompetitionEngine,
    MarketEngine,
    PricingEngine
  }
} = require('../engine/data-acquisition');

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
  const config = {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };

  const supabase = createClient(config.url, config.serviceRoleKey);
  const year = 2025;

  // Get all cities
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, code, name_ar, country_code')
    .order('name_ar');

  if (citiesError) throw citiesError;
  console.log(`Found ${cities.length} cities`);

  // Get a sample activity
  const { data: activity, error: activityError } = await supabase
    .from('economic_activities')
    .select('id, code, name_ar')
    .eq('code', 'dental_clinics')
    .single();

  if (activityError || !activity) {
    console.warn('Sample activity dental_clinics not found, skipping activity-specific engines');
  }

  // Run CityEngine for all cities
  console.log('\n=== Running CityEngine for all cities ===');
  const cityEngine = new CityEngine(config);
  for (const city of cities) {
    try {
      const result = await cityEngine.run({
        cityId: city.id,
        cityCode: city.code,
        countryCode: city.country_code,
        year
      });
      const totalImported = result.adapters.reduce((sum, a) => sum + a.recordsImported, 0);
      console.log(` ${city.name_ar} (${city.code}): ${totalImported} metrics`);
    } catch (err) {
      console.error(` ${city.name_ar} (${city.code}): ${err.message}`);
    }
  }

  // Run activity-specific engines for all cities
  if (activity) {
    console.log(`\n=== Running activity engines for ${activity.name_ar} ===`);
    const engines = [
      new RealEstateEngine(config),
      new LaborEngine(config),
      new CompetitionEngine(config),
      new MarketEngine(config),
      new PricingEngine(config)
    ];

    for (const city of cities) {
      try {
        for (const engine of engines) {
          await engine.run({
            cityId: city.id,
            cityCode: city.code,
            countryCode: city.country_code,
            activityId: activity.id,
            activityCode: activity.code,
            year
          });
        }
        console.log(` ${city.name_ar}: activity engines complete`);
      } catch (err) {
        console.error(` ${city.name_ar}: ${err.message}`);
      }
    }
  }

  console.log('\n=== Seeding complete ===');
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
