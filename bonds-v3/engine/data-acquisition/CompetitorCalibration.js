/**
 * CompetitorCalibration — معايرة عدد المنافسين على مستوى المدينة.
 *
 * تجمع الأعداد الخام من Geoapify لكل مدينة، ثم تطبّق معامل معايرة
 * على مستوى الدولة بحيث يتوافق المجموع مع country_benchmarks.
 * للمدن التي لا يوجد لها تغطية خام، يتم توزيع العدد المتوقع للدولة
 * حسب نسبة السكان.
 */
const { HttpClient, createSupabaseCache } = require('./HttpClient');
const CompetitorDataAdapter = require('./adapters/CompetitorDataAdapter');

function benchmarkMetricCode(activityCode) {
  return `competitors_per_10k_${activityCode}`;
}

async function calibrateCompetitorCounts({
  supabase,
  activityCode = 'dental_clinics',
  year = new Date().getFullYear(),
  onProgress = null
}) {
  // Load activity
  const { data: activity, error: activityError } = await supabase
    .from('economic_activities')
    .select('id, code')
    .eq('code', activityCode)
    .single();
  if (activityError || !activity) throw new Error(`Activity ${activityCode} not found: ${activityError?.message}`);

  // Load cities
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, code, name_en, country_code, population')
    .order('code');
  if (citiesError) throw citiesError;

  // Load country benchmarks
  const metricCode = benchmarkMetricCode(activityCode);
  const { data: benchmarks, error: benchError } = await supabase
    .from('country_benchmarks')
    .select('country_code, benchmark_value')
    .eq('metric_code', metricCode)
    .eq('year', year);
  if (benchError) throw benchError;

  const benchmarkByCountry = {};
  for (const b of benchmarks || []) {
    benchmarkByCountry[b.country_code] = parseFloat(b.benchmark_value);
  }

  const httpClient = new HttpClient({
    timeout: 30000,
    retries: 2,
    maxConcurrency: 2,
    cache: createSupabaseCache(supabase)
  });
  const adapter = new CompetitorDataAdapter({ httpClient, googlePlacesApiKey: '' });

  const cityResults = [];
  for (const city of cities) {
    try {
      const items = await adapter.fetch({
        cityCode: city.code,
        cityName: city.name_en,
        countryCode: city.country_code,
        activityCode,
        year,
        population: city.population || 0
      });
      const countItem = items.find(i => i.metricCode === 'competitors_count');
      const rawValue = countItem?.value || 0;
      cityResults.push({ city, rawValue });
      if (onProgress) onProgress(city.code, rawValue, null);
    } catch (err) {
      cityResults.push({ city, rawValue: 0 });
      if (onProgress) onProgress(city.code, 0, err.message);
    }
  }

  // Aggregate by country
  const countryRaw = {};
  const countryExpected = {};
  const countryPopulation = {};

  for (const { city, rawValue } of cityResults) {
    const cc = city.country_code;
    const benchmark = benchmarkByCountry[cc];
    if (!benchmark) continue;

    countryRaw[cc] = (countryRaw[cc] || 0) + rawValue;
    countryExpected[cc] = (countryExpected[cc] || 0) + ((city.population || 0) * benchmark / 10000);
    countryPopulation[cc] = (countryPopulation[cc] || 0) + (city.population || 0);
  }

  const countryFactor = {};
  for (const cc of Object.keys(countryExpected)) {
    const raw = countryRaw[cc] || 0;
    const expected = countryExpected[cc];
    if (raw > 0 && expected > 0) {
      countryFactor[cc] = expected / raw;
    }
  }

  // Upsert calibrated values
  const upserted = [];
  const skipped = [];
  for (const { city, rawValue } of cityResults) {
    const cc = city.country_code;
    const factor = countryFactor[cc];
    const expected = countryExpected[cc];
    const pop = countryPopulation[cc];

    if (!expected || !pop) {
      skipped.push(city.code);
      continue;
    }

    let calibratedValue;
    let notes;
    if (factor && rawValue > 0) {
      calibratedValue = Math.max(1, Math.round(rawValue * factor));
      notes = `Raw Geoapify count scaled by country factor ${factor.toFixed(4)}`;
    } else {
      calibratedValue = Math.max(1, Math.round((city.population / pop) * expected));
      notes = 'No raw Geoapify coverage; apportioned by population share of country expected total';
    }

    const { error } = await supabase
      .from('city_competitor_calibration')
      .upsert({
        city_id: city.id,
        activity_id: activity.id,
        metric_code: 'competitors_count',
        year,
        raw_value: rawValue,
        calibrated_value: calibratedValue,
        factor: factor || null,
        source: 'geoapify_country_calibration',
        notes
      }, { onConflict: 'city_id,activity_id,metric_code,year' });

    if (error) {
      throw new Error(`${city.code} upsert failed: ${error.message}`);
    }
    upserted.push({ cityCode: city.code, rawValue, calibratedValue, factor });
  }

  return {
    activityCode,
    year,
    benchmarkByCountry,
    countryFactor,
    upserted,
    skipped
  };
}

module.exports = { calibrateCompetitorCounts, benchmarkMetricCode };
