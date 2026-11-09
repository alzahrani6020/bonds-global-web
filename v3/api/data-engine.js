/**
 * Data Engine API — نقاط نهاية منصة جمع البيانات.
 */
const { getSupabaseClient } = require('../lib/supabase');
const { requireAdminAccess } = require('../lib/admin-access');
const {
  CityEngine,
  RealEstateEngine,
  LaborEngine,
  CompetitionEngine,
  MarketEngine,
  PricingEngine
} = require('../engine/data-acquisition/engines');
const FeedbackEngine = require('../engine/data-acquisition/FeedbackEngine');
const RegressionEstimator = require('../engine/ml/RegressionEstimator');
const { CountryIndicatorEngine } = require('../../lib/data/country-indicator-engine');
const {
  liveAdapterIdsForCountry,
  LIVE_CRON_CITY_CODES
} = require('../engine/data-acquisition/source-capability-registry');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
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

// ===== Handlers =====

async function handleListSources(req, res) {
  const sources = [
    { id: 'gastat', name: 'الهيئة العامة للإحصاء (SA)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'sama', name: 'البنك المركزي السعودي (SA)', engine: 'CityEngine', metrics: ['growth_rate', 'inflation_rate', 'business_ease_index'] },
    { id: 'uae_stats', name: 'المركز الاتحادي للتنافسية والإحصاء (AE)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'egypt_capmas', name: 'الجهاز المركزي للإحصاء (EG)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'qatar_psa', name: 'هيئة التخطيط والإحصاء (QA)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'world_bank_country', name: 'World Bank Open Data (22 Arab countries)', engine: 'CountryIndicatorEngine', scope: 'country', metrics: ['inflation_rate', 'economic_growth_rate', 'unemployment_rate', 'population_total', 'gdp_per_capita_usd', 'fdi_net_inflows_pct_gdp'] },
    { id: 'manual', name: 'إدخال يدوي', engine: 'all', metrics: ['all'] },
    { id: 'llm_estimation', name: 'تقدير ذكي', engine: 'all', metrics: ['market_size', 'competitors_count', 'expected_demand'] }
  ];
  sendJson(res, 200, { sources });
}

async function handleFetchSource(req, res, path) {
  if (!(await requireAdminAccess(req))) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const match = path.match(/^\/data\/sources\/([^\/]+)\/fetch$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const sourceId = match[1];

  const body = await parseBody(req);
  const { cityId: rawCityId, cityCode, activityId: rawActivityId, activityCode, year = new Date().getFullYear() } = body;

  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();

  let cityId = rawCityId;
  let activityId = rawActivityId;
  let city = null;
  if (cityCode && !cityId) {
    city = await resolveCity(supabase, cityCode);
    cityId = city.id;
  }
  if (activityCode && !activityId) {
    const activity = await resolveActivity(supabase, activityCode);
    activityId = activity.id;
  }

  try {
    let result;

    switch (sourceId) {
      case 'gastat':
      case 'sama': {
        const { GastatAdapter, SamaAdapter } = require('../engine/data-acquisition/adapters');
        const { DataPipeline } = require('../engine/data-acquisition');
        const pipeline = new DataPipeline(config);
        const Adapter = sourceId === 'gastat' ? GastatAdapter : SamaAdapter;
        const adapter = new Adapter();
        result = await pipeline.runAdapter(adapter, { cityId, cityCode, year, runType: 'manual' });
        await pipeline.fuseToGold({ cityId, year });
        break;
      }
      case 'city': {
        const engine = new CityEngine(config);
        result = await engine.run({ cityId, cityCode, countryCode: city?.country_code, year });
        break;
      }
      case 'real_estate': {
        const engine = new RealEstateEngine(config);
        result = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        break;
      }
      case 'labor': {
        const engine = new LaborEngine(config);
        result = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        break;
      }
      case 'competition': {
        const engine = new CompetitionEngine(config);
        result = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        break;
      }
      case 'market': {
        const engine = new MarketEngine(config);
        result = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        break;
      }
      case 'pricing': {
        const engine = new PricingEngine(config);
        result = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        break;
      }
      default:
        return sendJson(res, 400, { error: `Unknown source or engine: ${sourceId}` });
    }

    sendJson(res, 200, { success: true, result });
  } catch (err) {
    console.error('[data-engine fetch]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleGetRun(req, res, path) {
  const match = path.match(/^\/data\/runs\/([^\/]+)$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const runId = match[1];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('data_source_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { run: data });
}

async function handleListMetrics(req, res, path) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cityId = url.searchParams.get('city');
  const activityId = url.searchParams.get('activity');
  const year = url.searchParams.get('year');
  const metricCode = url.searchParams.get('metric');

  const supabase = getSupabaseClient();
  let query = supabase.from('normalized_metrics').select('*');

  if (cityId) query = query.eq('city_id', cityId);
  if (activityId) query = query.eq('activity_id', activityId);
  if (year) query = query.eq('year', parseInt(year));
  if (metricCode) query = query.eq('metric_code', metricCode);

  const { data, error } = await query.order('fetched_at', { ascending: false });
  if (error) return sendJson(res, 500, { error: error.message });

  sendJson(res, 200, { metrics: data, count: data?.length || 0 });
}

async function handleGetIndicators(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cityId = url.searchParams.get('city');
  const activityId = url.searchParams.get('activity');
  const year = url.searchParams.get('year') || new Date().getFullYear().toString();

  if (!cityId) return sendJson(res, 400, { error: 'city is required' });

  const supabase = getSupabaseClient();

  // City indicators
  const { data: cityIndicators, error: cityError } = await supabase
    .from('city_indicators')
    .select('*')
    .eq('city_id', cityId)
    .eq('year', parseInt(year))
    .maybeSingle();

  if (cityError) return sendJson(res, 500, { error: cityError.message });

  // City market data
  let marketDataQuery = supabase
    .from('city_market_data')
    .select('*')
    .eq('city_id', cityId)
    .eq('data_year', parseInt(year));
  if (activityId) marketDataQuery = marketDataQuery.eq('activity_id', activityId);

  const { data: marketData, error: marketError } = await marketDataQuery;
  if (marketError) return sendJson(res, 500, { error: marketError.message });

  // Normalized metrics with confidence
  let metricsQuery = supabase
    .from('normalized_metrics')
    .select('*, metric_definitions(name_ar, name_en, unit, data_type)')
    .eq('city_id', cityId)
    .eq('year', parseInt(year));
  if (activityId) metricsQuery = metricsQuery.eq('activity_id', activityId);

  const { data: metrics, error: metricsError } = await metricsQuery;
  if (metricsError) return sendJson(res, 500, { error: metricsError.message });

  sendJson(res, 200, {
    cityIndicators: cityIndicators || null,
    marketData: marketData || [],
    metrics: metrics || []
  });
}

async function handleSubmitFeedback(req, res) {
  if (!(await requireAdminAccess(req))) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const body = await parseBody(req);
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const feedback = new FeedbackEngine(config);

  try {
    let cityId = body.city_id;
    let activityId = body.activity_id;

    if (body.city_code && !cityId) {
      const city = await resolveCity(supabase, body.city_code);
      cityId = city.id;
    }
    if (body.activity_code && !activityId) {
      const activity = await resolveActivity(supabase, body.activity_code);
      activityId = activity.id;
    }

    await feedback.submitFeedback({
      metricCode: body.metric_code,
      cityId,
      activityId,
      year: body.year,
      estimatedValue: body.estimated_value,
      estimatedValueText: body.estimated_value_text,
      actualValue: body.actual_value,
      actualValueText: body.actual_value_text,
      projectId: body.project_id,
      source: body.source || 'admin',
      confidence: body.confidence,
      notes: body.notes
    });
    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error('[data-engine feedback]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

// Public corrections are quarantined in the review queue. They must never be
// written directly into metric_feedback because that table feeds automatic
// correction factors used by inference.
async function handleSubmitPublicFeedback(req, res) {
  const body = await parseBody(req);
  const supabase = getSupabaseClient();

  if (!body.city_code || !body.metric_code || body.suggested_value === undefined) {
    return sendJson(res, 400, { error: 'city_code, metric_code and suggested_value are required' });
  }

  const suggestedValue = Number(body.suggested_value);
  const currentValue = body.current_value === undefined || body.current_value === null || body.current_value === ''
    ? null
    : Number(body.current_value);
  const year = Number(body.year || new Date().getFullYear());

  if (!Number.isFinite(suggestedValue)) {
    return sendJson(res, 400, { error: 'suggested_value must be a finite number' });
  }
  if (currentValue !== null && !Number.isFinite(currentValue)) {
    return sendJson(res, 400, { error: 'current_value must be a finite number when provided' });
  }
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
    return sendJson(res, 400, { error: 'year is invalid' });
  }

  try {
    const city = await resolveCity(supabase, body.city_code);
    let activityId = body.activity_id || null;
    if (body.activity_code && !activityId) {
      const activity = await resolveActivity(supabase, body.activity_code);
      activityId = activity.id;
    }

    const { error } = await supabase.from('data_feedback').insert({
      city_id: city.id,
      activity_id: activityId,
      year,
      metric_code: String(body.metric_code).slice(0, 120),
      current_value: currentValue,
      suggested_value: suggestedValue,
      reason: body.reason ? String(body.reason).slice(0, 2000) : null,
      source_url: body.source_url ? String(body.source_url).slice(0, 2000) : null,
      status: 'pending'
    });

    if (error) throw error;
    sendJson(res, 200, {
      success: true,
      status: 'pending',
      message: 'شكراً لك، تم استلام التصحيح وسيتم مراجعته قبل استخدامه في النماذج.'
    });
  } catch (err) {
    console.error('[data-engine public feedback]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleFeedbackAccuracy(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cityId = url.searchParams.get('city');
  const activityId = url.searchParams.get('activity');
  const year = url.searchParams.get('year');
  const metricCode = url.searchParams.get('metric');

  const config = getSupabaseConfig();
  const feedback = new FeedbackEngine(config);

  try {
    const summary = await feedback.getAccuracySummary({
      cityId,
      activityId,
      year: year ? parseInt(year) : null,
      metricCode
    });
    sendJson(res, 200, { summary });
  } catch (err) {
    console.error('[data-engine accuracy]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

const LIVE_REFRESH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function handleLiveCityRefresh(req, res) {
  const body = await parseBody(req);
  const cityCode = String(body.cityCode || '').trim();
  const force = body.force === true;

  if (!cityCode) {
    return sendJson(res, 400, { error: 'cityCode is required' });
  }

  const supabase = getSupabaseClient();
  let city;
  try {
    city = await resolveCity(supabase, cityCode);
  } catch (err) {
    return sendJson(res, 404, { error: err.message });
  }

  if (!force) {
    const since = new Date(Date.now() - LIVE_REFRESH_MAX_AGE_MS).toISOString();
    const { data: recentRuns } = await supabase
      .from('data_source_runs')
      .select('id,source_id,status,finished_at,metadata')
      .in('source_id', ['gastat', 'sama', 'world_bank_country'])
      .eq('status', 'success')
      .gte('finished_at', since)
      .order('finished_at', { ascending: false })
      .limit(20);
    const cached = (recentRuns || []).find(run =>
      ['gastat', 'sama'].includes(run.source_id) && run.metadata?.cityCode === cityCode
    );
    if (cached) {
      return sendJson(res, 200, {
        success: true,
        cached: true,
        liveOnly: true,
        city: { code: city.code, country_code: city.country_code },
        lastFetchedAt: cached.finished_at,
        message: 'تم الجلب الحي خلال ست ساعات. لن يُعاد الطلب من المصدر إلا بالجلب الإجباري.'
      });
    }
  }

  const config = getSupabaseConfig();

  try {
    const { cityResult, countryIndicators } = await refreshLiveCity(supabase, config, cityCode);
    sendJson(res, 200, {
      success: true,
      cached: false,
      liveOnly: true,
      city: { code: city.code, country_code: city.country_code },
      adapters: cityResult?.adapters || [],
      countryIndicators,
      year: cityResult?.year || null
    });
  } catch (err) {
    console.error('[data-engine live-refresh]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleAutoFill(req, res) {
  if (!(await requireAdminAccess(req))) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const body = await parseBody(req);
  const { cityId: rawCityId, cityCode, activityId: rawActivityId, activityCode, year = new Date().getFullYear() } = body;

  if (!cityCode) {
    return sendJson(res, 400, { error: 'cityCode is required' });
  }

  const supabase = getSupabaseClient();
  const city = await resolveCity(supabase, cityCode);
  const cityId = city.id;

  let activityId = rawActivityId;
  if (activityCode && !activityId) {
    const activity = await resolveActivity(supabase, activityCode);
    activityId = activity.id;
  }

  const config = getSupabaseConfig();
  const results = {};

  try {
    // Update city-level official/open sources first. "latest" is resolved by CityEngine
    // to the actual observed source year before Gold fusion.
    const cityEngine = new CityEngine(config);
    results.city = await cityEngine.run({ cityId, cityCode, countryCode: city.country_code, year });

    // Instant refresh also updates the latest sourced national context for the
    // selected city's country. This is stored separately from city facts.
    try {
      const countryEngine = new CountryIndicatorEngine();
      results.countryIndicators = await countryEngine.refresh(supabase, {
        countryCodes: [city.country_code]
      });
    } catch (countryErr) {
      results.countryIndicators = {
        updated: 0,
        failed: 1,
        errors: [countryErr.message]
      };
    }

    const effectiveYear = Number(results.city?.year) ||
      (Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear());

    if (activityId || activityCode) {
      const engines = [
        new RealEstateEngine(config),
        new LaborEngine(config),
        new CompetitionEngine(config),
        new MarketEngine(config),
        new PricingEngine(config)
      ];

      for (const engine of engines) {
        const r = await engine.run({ cityId, cityCode, activityId, activityCode, year: effectiveYear });
        results[r.engine] = r;
      }
    }

    results.requestedYear = year;
    results.effectiveYear = effectiveYear;

    sendJson(res, 200, { success: true, results });
  } catch (err) {
    console.error('[data-engine auto-fill]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleTrainML(req, res) {
  if (!(await requireAdminAccess(req))) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  const body = await parseBody(req);
  const countryCode = body.country_code || null;
  const targetMetrics = body.metrics || ['market_size', 'competitors_count'];

  const featureMap = {
    market_size: ['population', 'household_income', 'purchasing_power_index', 'growth_rate', 'unemployment_rate'],
    competitors_count: ['population', 'market_size', 'avg_salary', 'market_saturation_score']
  };

  try {
    // Load training data: city_market_data joined with cities (demographic features)
    // and city_indicators (economic features).
    let query = supabase
      .from('city_market_data')
      .select(`
        *,
        city:city_id!inner (
          id,
          country_code,
          population,
          avg_household_income,
          purchasing_power_index,
          city_indicators!left (*)
        )
      `);
    if (countryCode) query = query.eq('city.country_code', countryCode);

    const { data: rows, error } = await query;
    if (error) throw error;

    const trained = [];
    for (const metricCode of targetMetrics) {
      const featureKeys = featureMap[metricCode] || body.features || ['population'];
      const dataset = [];
      for (const row of rows || []) {
        const target = row[metricCode];
        const city = row.city;
        const indicators = city?.city_indicators?.[0] || {};
        if (!Number.isFinite(target) || !city) continue;
        dataset.push({
          features: {
            population: Number(city.population),
            household_income: Number(city.avg_household_income),
            purchasing_power_index: Number(city.purchasing_power_index),
            growth_rate: Number(indicators.growth_rate),
            unemployment_rate: Number(indicators.unemployment_rate),
            market_size: Number(row.market_size),
            avg_salary: Number(row.avg_salary),
            market_saturation_score: Number(row.market_saturation_score)
          },
          target: Number(target)
        });
      }

      const model = RegressionEstimator.train(metricCode, dataset, featureKeys, { minSamples: 5, testRatio: 0.2 });
      if (model) {
        await RegressionEstimator.saveModel(supabase, model, countryCode);
        trained.push({
          metricCode,
          featureKeys: model.featureKeys,
          rSquared: model.rSquared,
          rmse: model.rmse,
          mape: model.mape,
          sampleCount: model.sampleCount
        });
      }
    }

    sendJson(res, 200, { success: true, trained });
  } catch (err) {
    console.error('[data-engine ml/train]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleListMLModels(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const metricCode = url.searchParams.get('metric');
  const countryCode = url.searchParams.get('country');

  try {
    const supabase = getSupabaseClient();
    const models = await RegressionEstimator.loadModels(supabase, metricCode, countryCode);
    sendJson(res, 200, { models });
  } catch (err) {
    console.error('[data-engine ml/models]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

// ===== Router =====

async function dataEngineRouter(req, res, path) {
  if (path === '/data/sources' && req.method === 'GET') {
    return handleListSources(req, res);
  }

  if (path.match(/^\/data\/sources\/[^\/]+\/fetch$/) && req.method === 'POST') {
    return handleFetchSource(req, res, path);
  }

  if (path.match(/^\/data\/runs\/[^\/]+$/) && req.method === 'GET') {
    return handleGetRun(req, res, path);
  }

  if (path === '/data/metrics' && req.method === 'GET') {
    return handleListMetrics(req, res, path);
  }

  if (path === '/data/indicators' && req.method === 'GET') {
    return handleGetIndicators(req, res);
  }

  if (path === '/data/live-refresh' && req.method === 'POST') {
    return handleLiveCityRefresh(req, res);
  }

  if (path === '/data/auto-fill' && req.method === 'POST') {
    return handleAutoFill(req, res);
  }

  if (path === '/data/feedback' && req.method === 'POST') {
    return handleSubmitFeedback(req, res);
  }

  if (path === '/data/feedback/public' && req.method === 'POST') {
    return handleSubmitPublicFeedback(req, res);
  }

  if (path === '/data/feedback/accuracy' && req.method === 'GET') {
    return handleFeedbackAccuracy(req, res);
  }

  if (path === '/data/ml/train' && req.method === 'POST') {
    return handleTrainML(req, res);
  }

  if (path === '/data/ml/models' && req.method === 'GET') {
    return handleListMLModels(req, res);
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function refreshLiveCity(supabase, config, cityCode, { refreshCountry = true } = {}) {
  const city = await resolveCity(supabase, cityCode);
  const cityEngine = new CityEngine(config, {
    pipeline: { persistModeledGold: false, inferMissing: false }
  });
  const cityResult = await cityEngine.run({
    cityId: city.id,
    cityCode,
    countryCode: city.country_code,
    year: 'latest',
    liveOnly: true,
    updateGold: false
  });

  let countryIndicators = null;
  if (refreshCountry) {
    try {
      const countryEngine = new CountryIndicatorEngine({ timeoutMs: 12000 });
      countryIndicators = await countryEngine.refresh(supabase, {
        countryCodes: [city.country_code]
      });
    } catch (countryErr) {
      countryIndicators = {
        updated: 0,
        failed: 1,
        errors: [countryErr.message]
      };
    }
  }

  return { city, cityResult, countryIndicators };
}

async function runScheduledLiveRefresh() {
  const supabase = getSupabaseClient();
  const config = getSupabaseConfig();
  let countryIndicators;
  try {
    const countryEngine = new CountryIndicatorEngine({ timeoutMs: 12000 });
    countryIndicators = await countryEngine.refresh(supabase);
  } catch (err) {
    countryIndicators = { updated: 0, failed: 1, errors: [err.message] };
  }

  const cities = [];
  for (const cityCode of LIVE_CRON_CITY_CODES) {
    try {
      const city = await resolveCity(supabase, cityCode);
      if (!liveAdapterIdsForCountry(city.country_code).length) {
        cities.push({ cityCode, skipped: true, reason: 'no_live_adapters' });
        continue;
      }
      const { cityResult } = await refreshLiveCity(supabase, config, cityCode, {
        refreshCountry: false
      });
      cities.push({
        cityCode,
        status: 'ok',
        year: cityResult.year,
        adapters: cityResult.adapters
      });
    } catch (err) {
      cities.push({ cityCode, status: 'error', error: err.message });
    }
  }

  return {
    liveOnly: true,
    updateGold: false,
    countryIndicators,
    cities
  };
}

async function handleCronLiveSourceRefresh(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const result = await runScheduledLiveRefresh();
    sendJson(res, 200, { cron: 'live-source-refresh', ...result });
  } catch (err) {
    console.error('[data-engine cron live-source-refresh]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { dataEngineRouter, handleCronLiveSourceRefresh };
