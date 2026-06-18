/**
 * Data Engine API — نقاط نهاية منصة جمع البيانات.
 */
const { getSupabaseClient } = require('../lib/supabase');
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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
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

function requireAdminToken(req) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return false;
  }
  return true;
}

// ===== Handlers =====

async function handleListSources(req, res) {
  const sources = [
    { id: 'gastat', name: 'الهيئة العامة للإحصاء (SA)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'sama', name: 'البنك المركزي السعودي (SA)', engine: 'CityEngine', metrics: ['growth_rate', 'inflation_rate', 'business_ease_index'] },
    { id: 'uae_stats', name: 'المركز الاتحادي للتنافسية والإحصاء (AE)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'egypt_capmas', name: 'الجهاز المركزي للإحصاء (EG)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'qatar_psa', name: 'هيئة التخطيط والإحصاء (QA)', engine: 'CityEngine', metrics: ['population', 'household_income', 'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate'] },
    { id: 'manual', name: 'إدخال يدوي', engine: 'all', metrics: ['all'] },
    { id: 'llm_estimation', name: 'تقدير ذكي', engine: 'all', metrics: ['market_size', 'competitors_count', 'expected_demand'] }
  ];
  sendJson(res, 200, { sources });
}

async function handleFetchSource(req, res, path) {
  if (!requireAdminToken(req)) {
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
  if (!requireAdminToken(req)) {
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

// Public feedback submission (no admin token) with basic validation
async function handleSubmitPublicFeedback(req, res) {
  const body = await parseBody(req);
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();

  // Required fields
  if (!body.city_code || !body.metric_code || body.suggested_value === undefined) {
    return sendJson(res, 400, { error: 'city_code, metric_code and suggested_value are required' });
  }

  try {
    const city = await resolveCity(supabase, body.city_code);
    let activityId = body.activity_id || null;
    if (body.activity_code && !activityId) {
      const activity = await resolveActivity(supabase, body.activity_code);
      activityId = activity.id;
    }

    const year = body.year || new Date().getFullYear();

    const { error } = await supabase.from('metric_feedback').insert({
      metric_code: body.metric_code,
      city_id: city.id,
      activity_id: activityId,
      year,
      estimated_value: body.current_value || null,
      actual_value: body.suggested_value,
      source: 'user',
      confidence: body.confidence || 80,
      notes: body.reason || null
    });

    if (error) throw error;
    sendJson(res, 200, { success: true, message: 'شكراً لك، تم استلام التصحيح وسيتم مراجعته.' });
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

async function handleAutoFill(req, res) {
  if (!requireAdminToken(req)) {
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
    // تشغيل جميع المحركات
    const cityEngine = new CityEngine(config);
    results.city = await cityEngine.run({ cityId, cityCode, countryCode: city.country_code, year });

    if (activityId || activityCode) {
      const engines = [
        new RealEstateEngine(config),
        new LaborEngine(config),
        new CompetitionEngine(config),
        new MarketEngine(config),
        new PricingEngine(config)
      ];

      for (const engine of engines) {
        const r = await engine.run({ cityId, cityCode, activityId, activityCode, year });
        results[r.engine] = r;
      }
    }

    sendJson(res, 200, { success: true, results });
  } catch (err) {
    console.error('[data-engine auto-fill]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleTrainML(req, res) {
  if (!requireAdminToken(req)) {
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

module.exports = { dataEngineRouter };
