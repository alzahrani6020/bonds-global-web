/**
 * Populate real competitor data for all supported V3 activity tags.
 *
 * Usage:
 *   node scripts/populate-all-competitors.js [year]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const CompetitorDataAdapter = require('../v3/engine/data-acquisition/adapters/CompetitorDataAdapter');
const { calibrateCompetitorCounts } = require('../v3/engine/data-acquisition/CompetitorCalibration');
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

const TAGS = [
  {
    tag: 'restaurant',
    targets: ['restaurant', 'burger_restaurant', 'food_industries_restaurants_activity', 'food_beverage_restaurants_activity'],
    template: { baseCompetitors: 100, baseRent: 1800, baseSalary: 7500, saturation: 70, baseMarketSize: 5000000 }
  },
  {
    tag: 'cafe',
    targets: ['cafe', 'coffee_shop', 'food_industries_cafes_activity', 'food_beverage_cafes_activity'],
    template: { baseCompetitors: 80, baseRent: 1600, baseSalary: 7000, saturation: 65, baseMarketSize: 3500000 }
  },
  {
    tag: 'retail',
    targets: ['retail', 'small_supermarket', 'commerce_retail_activity', 'ecommerce_retail_activity'],
    template: { baseCompetitors: 40, baseRent: 1400, baseSalary: 6500, saturation: 55, baseMarketSize: 8000000 }
  },
  {
    tag: 'gym',
    targets: ['gym'],
    template: { baseCompetitors: 30, baseRent: 1200, baseSalary: 7000, saturation: 50, baseMarketSize: 2500000 }
  },
  {
    tag: 'beauty',
    targets: ['beauty'],
    template: { baseCompetitors: 50, baseRent: 1300, baseSalary: 6500, saturation: 60, baseMarketSize: 3000000 }
  }
];

function tierFromPopulation(pop) {
  if (pop >= 2000000) return 1;
  if (pop >= 800000) return 2;
  return 3;
}

function cityFactor(tier, ppi) {
  const tierFactor = tier === 1 ? 1.0 : tier === 2 ? 0.75 : 0.55;
  const ppiFactor = (ppi || 100) / 100;
  return { tierFactor, ppiFactor };
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

async function ensureActivities(supabase) {
  console.log('Ensuring economic activities exist...');
  const { data: subSector } = await supabase
    .from('economic_sub_sectors')
    .select('id,sector_id')
    .limit(1)
    .single();
  const subSectorId = subSector?.id;
  const sectorId = subSector?.sector_id;
  if (!subSectorId || !sectorId) throw new Error('No sub_sectors found');

  const needed = TAGS.flatMap(t => t.targets);
  const unique = [...new Set(needed)];
  const { data: existing } = await supabase.from('economic_activities').select('code,id').in('code', unique);
  const existingCodes = new Set((existing || []).map(e => e.code));
  const missing = unique.filter(c => !existingCodes.has(c));

  for (const code of missing) {
    const nameAr = code.includes('restaurant') ? 'مطاعم' : code.includes('cafe') || code.includes('coffee') ? 'مقاهي' : code.includes('retail') || code.includes('supermarket') ? 'تجزئة' : code === 'gym' ? 'صالات رياضية' : 'صالونات تجميل';
    await supabase.from('economic_activities').insert({
      code,
      name_ar: nameAr,
      name_en: code,
      sector_id: sectorId,
      sub_sector_id: subSectorId,
      is_active: true
    });
    console.log(`  Created activity: ${code}`);
  }

  const { data: all } = await supabase.from('economic_activities').select('code,id').in('code', unique);
  const map = {};
  for (const a of all || []) map[a.code] = a.id;
  return map;
}

async function generateBaseMarketRows(supabase, year, activityMap) {
  console.log(`Generating base market rows for ${year}...`);
  const { data: cities, error } = await supabase.from('cities').select('*').eq('is_active', true).order('code');
  if (error) throw error;

  let inserted = 0;
  for (const tagConfig of TAGS) {
    const template = tagConfig.template;
    for (const targetCode of tagConfig.targets) {
      const activityId = activityMap[targetCode];
      if (!activityId) continue;

      for (const city of cities) {
        const tier = tierFromPopulation(city.population || 0);
        const { tierFactor, ppiFactor } = cityFactor(tier, city.purchasing_power_index);
        const pop = city.population || 1;

        const competitors = Math.max(3, Math.round(template.baseCompetitors * tierFactor * (pop / 5000000)));
        const avgMarketShare = Math.max(1, Math.round((100 / competitors) * 1.5 * 100) / 100);
        const avgRent = Math.round(template.baseRent * tierFactor);
        const avgLandPrice = Math.round(avgRent * 6.5);
        const avgSalary = Math.round(template.baseSalary * ppiFactor);
        const laborAvailability = clamp(Math.round(80 - tier * 5), 30, 95);
        const marketSaturation = clamp(Math.round(template.saturation * tierFactor), 20, 95);
        const marketSize = Math.round(template.baseMarketSize * tierFactor * (pop / 5000000));

        const { error: upsertError } = await supabase.from('city_market_data').insert({
          city_id: city.id,
          activity_id: activityId,
          competitors_count: competitors,
          avg_market_share: avgMarketShare,
          avg_rent_per_sqm: avgRent,
          avg_land_price_per_sqm: avgLandPrice,
          avg_salary: avgSalary,
          labor_availability_score: laborAvailability,
          market_saturation_score: marketSaturation,
          market_size: marketSize,
          annual_growth_rate: 3.0,
          per_capita_spending: Math.max(1, Math.round(marketSize / pop)),
          expected_demand: marketSize > 5000000 ? 'high' : marketSize > 1500000 ? 'medium' : 'low',
          profit_margin_min: 10,
          profit_margin_avg: 20,
          profit_margin_max: 35,
          risk_score: 50,
          confidence: 70,
          data_year: year,
          source: 'Bonds generated'
        }, { onConflict: 'city_id,activity_id,data_year' });

        if (upsertError && upsertError.code !== '23505') {
          console.warn(`  Insert failed ${targetCode}/${city.code}: ${upsertError.message}`);
        } else {
          inserted++;
        }
      }
    }
  }
  console.log(`  Inserted/updated ${inserted} base rows.`);
}

async function calibrateTag(supabase, tag, year) {
  console.log(`\nCalibrating tag: ${tag}`);
  const { data: activity } = await supabase.from('economic_activities').select('id,code').eq('code', tag).single();
  if (!activity) throw new Error(`Tag activity ${tag} not found`);

  const { data: cities } = await supabase.from('cities').select('*').eq('is_active', true).order('code');
  const adapter = new CompetitorDataAdapter();

  const countryPop = {};
  const countryRaw = {};

  for (const city of cities) {
    try {
      const items = await adapter.fetch({
        cityCode: city.code,
        cityName: city.name_en,
        countryCode: city.country_code,
        population: city.population || 0,
        activityCode: tag,
        year
      });
      const countItem = items.find(i => i.metricCode === 'competitors_count');
      const raw = countItem?.value || 0;
      const cc = city.country_code;
      countryPop[cc] = (countryPop[cc] || 0) + (city.population || 0);
      countryRaw[cc] = (countryRaw[cc] || 0) + raw;
      console.log(`  ${city.code}: raw=${raw}`);
    } catch (err) {
      console.warn(`  ${city.code}: failed - ${err.message}`);
    }
  }

  const metricCode = `competitors_per_10k_${tag}`;
  for (const cc of Object.keys(countryRaw)) {
    const pop = countryPop[cc];
    const raw = countryRaw[cc];
    if (!pop) continue;
    const benchmark = (raw / pop) * 10000;
    await supabase.from('country_benchmarks').upsert({
      country_code: cc,
      metric_code: metricCode,
      benchmark_value: benchmark,
      year,
      source: 'Bonds calibrated'
    }, { onConflict: 'country_code,metric_code,year' });
    console.log(`  Benchmark ${cc}: ${benchmark.toFixed(2)} per 10k`);
  }

  const result = await calibrateCompetitorCounts({
    supabase,
    activityCode: tag,
    year,
    onProgress: (cityCode, rawValue, err) => {
      if (err) console.warn(`  Cal ${cityCode}: ${err}`);
      else console.log(`  Cal ${cityCode}: raw=${rawValue}`);
    }
  });

  console.log(`  Upserted: ${result.upserted.length}, Skipped: ${result.skipped.length}`);
  return result;
}

async function syncTagToTargets(supabase, tag, targetCodes, activityMap, year) {
  const tagActivityId = activityMap[tag];
  if (!tagActivityId) return;

  const { data: calibrations } = await supabase
    .from('city_competitor_calibration')
    .select('city_id, calibrated_value')
    .eq('activity_id', tagActivityId)
    .eq('year', year);
  if (!calibrations?.length) {
    console.log(`  No calibrations for ${tag}`);
    return;
  }
  const calMap = new Map(calibrations.map(c => [c.city_id, c.calibrated_value]));

  const engine = new OpportunityScoringEngine(supabase);
  for (const targetCode of targetCodes) {
    const targetId = activityMap[targetCode];
    if (!targetId) continue;

    let updated = 0;
    for (const [cityId, calibratedValue] of calMap) {
      const { error } = await supabase
        .from('city_market_data')
        .update({ competitors_count: Math.round(calibratedValue) })
        .eq('city_id', cityId)
        .eq('activity_id', targetId)
        .eq('data_year', year);
      if (!error) updated++;
    }
    console.log(`  Synced ${updated} rows to ${targetCode}`);

    const { data: rows } = await supabase
      .from('city_market_data')
      .select('city_id, activity_id, data_year')
      .eq('activity_id', targetId)
      .eq('data_year', year);
    let processed = 0;
    for (const row of rows || []) {
      try {
        await engine.calculateAndSave({ cityId: row.city_id, activityId: row.activity_id, year: row.data_year });
        processed++;
      } catch (err) {
        console.warn(`    Score failed ${row.city_id}: ${err.message}`);
      }
    }
    await engine.recalculateRanks({ activityId: targetId, year });
    console.log(`  Scored ${processed}/${rows?.length || 0} for ${targetCode}`);
  }
}

async function main() {
  const env = loadEnvLocal();
  Object.assign(process.env, env);
  const year = parseInt(process.argv[2] || new Date().getFullYear(), 10);
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY);

  const activityMap = await ensureActivities(supabase);
  await generateBaseMarketRows(supabase, year, activityMap);

  for (const config of TAGS) {
    await calibrateTag(supabase, config.tag, year);
    await syncTagToTargets(supabase, config.tag, config.targets, activityMap, year);
  }

  console.log('\n✅ All competitor data populated.');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
