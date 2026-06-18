/**
 * v3-backfill-2026.js
 *
 * تشغيل محركات Bonds V3 Data Engine لكل المدن والأنشطة لسنة 2026،
 * ثم إعادة حساب مؤشرات الفرصة والترتيب.
 *
 * Usage:
 *   node scripts/v3-backfill-2026.js [year]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  CityEngine,
  RealEstateEngine,
  LaborEngine,
  CompetitionEngine,
  MarketEngine,
  PricingEngine
} = require('../v3/engine/data-acquisition/engines');
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

function getSupabaseConfig() {
  const env = loadEnvLocal();
  return {
    url: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

async function main() {
  const year = parseInt(process.argv[2] || new Date().getFullYear(), 10);
  const config = getSupabaseConfig();
  const supabase = createClient(config.url, config.serviceRoleKey);
  const scoring = new OpportunityScoringEngine(supabase);

  console.log(`Loading cities and activities for ${year}...`);
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, code, name_ar, country_code, population, purchasing_power_index')
    .eq('is_active', true)
    .order('code');
  if (citiesError) throw citiesError;

  const { data: activities, error: activitiesError } = await supabase
    .from('economic_activities')
    .select('id, code, name_ar')
    .eq('is_active', true)
    .order('code');
  if (activitiesError) throw activitiesError;

  console.log(`Found ${cities.length} cities and ${activities.length} activities.`);

  // 1. City-level indicators
  console.log('\n=== Running CityEngine ===');
  let cityProcessed = 0;
  for (const city of cities) {
    try {
      const engine = new CityEngine(config);
      await engine.run({
        cityId: city.id,
        cityCode: city.code,
        countryCode: city.country_code,
        year
      });
      cityProcessed++;
      if (cityProcessed % 5 === 0) {
        console.log(`  ${cityProcessed}/${cities.length} cities processed`);
      }
    } catch (err) {
      console.warn(`  CityEngine failed for ${city.code}: ${err.message}`);
    }
  }
  console.log(`CityEngine completed: ${cityProcessed}/${cities.length}`);

  // 2. Activity-level engines for each city
  console.log('\n=== Running activity engines ===');
  let pairIndex = 0;
  const totalPairs = cities.length * activities.length;

  for (const city of cities) {
    for (const activity of activities) {
      pairIndex++;
      try {
        const common = { cityId: city.id, cityCode: city.code, activityId: activity.id, activityCode: activity.code, year };
        const engines = [
          new RealEstateEngine(config),
          new LaborEngine(config),
          new CompetitionEngine(config),
          new MarketEngine(config),
          new PricingEngine(config)
        ];
        for (const engine of engines) {
          await engine.run(common);
        }
        if (pairIndex % 100 === 0) {
          console.log(`  ${pairIndex}/${totalPairs} city/activity pairs processed`);
        }
      } catch (err) {
        console.warn(`  Activity engines failed for ${city.code}/${activity.code}: ${err.message}`);
      }
    }
  }
  console.log(`Activity engines completed: ${pairIndex}/${totalPairs}`);

  // 3. Recalculate opportunity scores and ranks per activity
  console.log('\n=== Recalculating opportunity scores ===');
  let scored = 0;
  for (const activity of activities) {
    const { data: rows, error } = await supabase
      .from('city_market_data')
      .select('city_id, activity_id, data_year')
      .eq('activity_id', activity.id)
      .eq('data_year', year);
    if (error) {
      console.warn(`  Failed to query rows for ${activity.code}: ${error.message}`);
      continue;
    }
    for (const row of rows || []) {
      try {
        await scoring.calculateAndSave({
          cityId: row.city_id,
          activityId: row.activity_id,
          year: row.data_year
        });
        scored++;
      } catch (err) {
        console.warn(`  Scoring failed for ${activity.code}: ${err.message}`);
      }
    }
    try {
      await scoring.recalculateRanks({ activityId: activity.id, year });
    } catch (err) {
      console.warn(`  Rank recalculation failed for ${activity.code}: ${err.message}`);
    }
    console.log(`  ${activity.code}: ${rows?.length || 0} rows scored`);
  }
  console.log(`Opportunity scoring completed: ${scored} rows`);

  console.log('\n✅ Backfill finished.');
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
