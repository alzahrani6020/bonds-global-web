const { getSupabaseClient } = require('../lib/supabase');
const { loadProjectModel } = require('../engine/loader');
const { calculate, recommend } = require('../engine/calculator');
const { generateInsights } = require('../engine/ai');
const { adminRouter } = require('./admin');
const { calibrateCompetitorCounts } = require('../engine/data-acquisition/CompetitorCalibration');
const SourceQualityMonitor = require('../engine/data-acquisition/SourceQualityMonitor');
const { authRouter } = require('./auth');
const { projectsRouter } = require('./projects');
const { billingRouter } = require('./billing');
const { dataEngineRouter } = require('./data-engine');
const { getUserFromToken } = require('../lib/auth');
const { checkRateLimit } = require('../../lib/api/rate-limit');
// AI handlers from the main project are optional; V3 can be deployed standalone.
// If the files are not available, stub handlers return 503 so the rest of the API works.
function aiNotAvailable(req, res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    error: 'AI analyze service not available in standalone V3 deployment',
    hint: 'Deploy from the monorepo root or copy lib/ai/analyze-handler.js and review-handler.js into v3/lib/ai/'
  }));
}

let handleAiAnalyze = aiNotAvailable;
let handleAiReviewRequest = aiNotAvailable;
let handleValuationAnalyze = aiNotAvailable;
let handleApproveReport = aiNotAvailable;
let handleIssueCertificate = aiNotAvailable;
let handleVerifyCertificate = aiNotAvailable;
try {
  ({ handleAiAnalyze } = require('../../lib/ai/analyze-handler'));
} catch (err) {
  console.warn('[v3/api] analyze-handler not available, AI analyze endpoint disabled');
}
try {
  ({ handleAiReviewRequest } = require('../../lib/ai/review-handler'));
} catch (err) {
  console.warn('[v3/api] review-handler not available, AI request-review endpoint disabled');
}
try {
  ({ handleValuationAnalyze } = require('../../lib/ai/valuation-analyze-handler'));
} catch (err) {
  console.warn('[v3/api] valuation-analyze-handler not available, AI valuation endpoint disabled');
}
try {
  ({
    handleApproveReport,
    handleIssueCertificate,
    handleVerifyCertificate
  } = require('../../lib/ai/valuation-certificate-handler'));
} catch (err) {
  console.warn('[v3/api] valuation-certificate-handler not available, certificate endpoints disabled');
}

const { aiChatHandler } = require('./ai');
const { scenariosRouter } = require('./scenarios');
const { alertsRouter } = require('./alerts');
const { compareRouter } = require('./compare');
const { fabricRouter } = require('./fabric');
const { intelligenceRouter } = require('./intelligence');
const { investmentIntelligenceRouter } = require('./investment-intelligence');
const { enterpriseLifecycleRouter } = require('./enterprise-lifecycle');
const { eccRouter } = require('./ecc');
const { UniversalCalculationPlatform } = require('../../lib/ucp');
const { adaptToUcp, adaptFromUcp } = require('../../lib/ucp/adapters');
const { run: orchestratorRun, buildIntentForm } = require('../../lib/orchestrator/intelligence-orchestrator');
const { listIntents } = require('../../lib/intent/intent-engine');
const { setAllowedOrigin } = require('../../lib/api/cors');

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
}

function getCategory(path) {
  if (path === '/billing/webhook' || path.startsWith('/billing/webhook/')) return 'webhook';
  if (path === '/billing/checkout' || path === '/billing/subscription') return 'auth';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/admin') || path.startsWith('/cron')) return 'strict';
  if (path === '/ai/chat') return 'ai';
  if (path === '/calculate' || path.startsWith('/calculate/') || path === '/compare/cities' || path.startsWith('/ucp/') || path.startsWith('/wave4/') || path.startsWith('/orchestrate') || path.startsWith('/fabric') || path.startsWith('/intelligence') || path.startsWith('/investment-intelligence') || path.startsWith('/enterprise-lifecycle') || path.startsWith('/ecc')) return 'compute';
  return 'public';
}

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

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return url;
}

async function handleHealth(req, res) {
  sendJson(res, 200, { status: 'ok', version: 'v3.0.0-alpha' });
}

async function handleSectors(req, res) {
  const supabase = getSupabaseClient();

  const { data: sectors, error } = await supabase
    .from('economic_sectors')
    .select(`
      *,
      economic_sub_sectors (
        *,
        economic_activities (
          *,
          economic_activity_details (*)
        )
      )
    `)
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[sectors]', error.message);
    return sendJson(res, 500, { error: 'Failed to load sectors' });
  }

  // Filter out inactive taxonomy rows
  const activeSectors = (sectors || []).map(sector => ({
    ...sector,
    economic_sub_sectors: (sector.economic_sub_sectors || [])
      .filter(ss => ss.is_active !== false)
      .map(ss => ({
        ...ss,
        economic_activities: (ss.economic_activities || [])
          .filter(a => a.is_active !== false)
          .map(a => ({
            ...a,
            economic_activity_details: (a.economic_activity_details || [])
              .filter(d => d.is_active !== false)
          }))
      }))
  }));

  sendJson(res, 200, { sectors: activeSectors });
}

async function handleModelDetail(req, res, path) {
  const match = path.match(/^\/models\/([^\/]+)$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const modelCode = match[1];

  try {
    const supabase = getSupabaseClient();
    const modelData = await loadProjectModel(supabase, modelCode, null);
    sendJson(res, 200, {
      model: modelData.projectModel,
      assumptions: modelData.assumptions,
      risks: modelData.risks
    });
  } catch (err) {
    console.error('[model detail]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleModels(req, res) {
  const url = getQuery(req);
  const sectorCode = url.searchParams.get('sector');
  const subSectorCode = url.searchParams.get('sub_sector');
  const activityCode = url.searchParams.get('activity');
  const cityCode = url.searchParams.get('city');

  const supabase = getSupabaseClient();

  let query = supabase
    .from('project_models')
    .select(`
      *,
      sector:sector_id (code, name_ar, name_en),
      sub_sector:sub_sector_id (code, name_ar, name_en),
      activity:activity_id (code, name_ar, name_en)
    `)
    .eq('is_published', true)
    .eq('is_active', true);

  if (sectorCode) {
    const { data: sector } = await supabase.from('economic_sectors').select('id').eq('code', sectorCode).single();
    if (sector) query = query.eq('sector_id', sector.id);
  }

  if (subSectorCode) {
    const { data: sub } = await supabase.from('economic_sub_sectors').select('id').eq('code', subSectorCode).single();
    if (sub) query = query.eq('sub_sector_id', sub.id);
  }

  if (activityCode) {
    const { data: activity } = await supabase.from('economic_activities').select('id').eq('code', activityCode).single();
    if (activity) query = query.eq('activity_id', activity.id);
  }

  const { data: models, error } = await query.order('name_ar');

  if (error) {
    console.error('[models]', error.message);
    return sendJson(res, 500, { error: 'Failed to load models' });
  }

  let city = null;
  if (cityCode) {
    const { data } = await supabase.from('cities').select('*').eq('code', cityCode).single();
    city = data;
  }

  sendJson(res, 200, { models, city, count: models?.length || 0 });
}

async function handleGeocode(req, res) {
  const url = getQuery(req);
  const q = url.searchParams.get('q');
  if (!q) return sendJson(res, 400, { error: 'Missing q parameter' });
  try {
    const query = encodeURIComponent(q);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'BondsGlobal/1.0 (contact@bonds-global.com)',
        'Accept-Language': 'ar,en'
      }
    });
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    const data = await response.json();
    if (!data || !data[0]) return sendJson(res, 404, { error: 'No results found' });
    return sendJson(res, 200, {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name
    });
  } catch (err) {
    console.error('[geocode] error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleCities(req, res) {
  const url = getQuery(req);
  const include = url.searchParams.get('include') || '';
  const countryCode = url.searchParams.get('country');
  const activityCode = url.searchParams.get('activity');
  const minScore = url.searchParams.get('min_score');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10), 2000);

  const supabase = getSupabaseClient();

  const cityTypeParam = url.searchParams.get('city_type');

  let selectFields = 'id, code, name_ar, name_en, region, country_code, population, purchasing_power_index, lat, lng, city_types';
  let query = supabase.from('cities').select(selectFields);

  if (countryCode) query = query.eq('country_code', countryCode);
  if (cityTypeParam) {
    const requestedTypes = cityTypeParam.split(',').map(t => t.trim()).filter(Boolean);
    if (requestedTypes.length > 0) {
      query = query.overlaps('city_types', requestedTypes);
    }
  }
  query = query.order('name_ar').limit(limit);

  const { data: cities, error } = await query;
  if (error) {
    console.error('[cities]', error.message);
    return sendJson(res, 500, { error: 'Failed to load cities' });
  }

  let enriched = cities || [];

  if (include.includes('opportunity') && activityCode) {
    const { data: activity, error: actError } = await supabase
      .from('economic_activities')
      .select('id')
      .eq('code', activityCode)
      .single();

    if (!actError && activity) {
      const activityId = activity.id;
      let year = parseInt(url.searchParams.get('year') || new Date().getFullYear(), 10);

      // If year=latest, resolve the most recent data_year for this activity
      if (url.searchParams.get('year') === 'latest') {
        const { data: latestRow } = await supabase
          .from('city_market_data')
          .select('data_year')
          .eq('activity_id', activityId)
          .order('data_year', { ascending: false })
          .limit(1)
          .maybeSingle();
        year = latestRow?.data_year || new Date().getFullYear();
      }

      const cityIds = enriched.map(c => c.id);

      const { data: marketRows, error: marketError } = await supabase
        .from('city_market_data')
        .select('city_id, opportunity_score, opportunity_rank, market_size, competitors_count, market_saturation_score, avg_salary, expected_demand, confidence')
        .eq('activity_id', activityId)
        .eq('data_year', year)
        .in('city_id', cityIds);

      if (!marketError && marketRows) {
        const marketMap = new Map(marketRows.map(r => [r.city_id, r]));
        enriched = enriched.map(city => {
          const market = marketMap.get(city.id) || null;
          const includeCity = minScore && market
            ? Number(market.opportunity_score) >= Number(minScore)
            : true;
          if (!includeCity) return null;
          return {
            ...city,
            opportunity: market
              ? {
                  score: market.opportunity_score,
                  rank: market.opportunity_rank,
                  marketSize: market.market_size,
                  competitorsCount: market.competitors_count,
                  saturation: market.market_saturation_score,
                  avgSalary: market.avg_salary,
                  expectedDemand: market.expected_demand,
                  confidence: market.confidence
                }
              : null
          };
        }).filter(Boolean);
      }
    }
  }

  sendJson(res, 200, { cities: enriched });
}

async function handleOpportunitiesTop(req, res) {
  const url = getQuery(req);
  const countryCode = url.searchParams.get('country');
  const activityCode = url.searchParams.get('activity');
  const minScore = url.searchParams.get('min_score');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 100);
  const requestedYear = url.searchParams.get('year');
  const isLatest = requestedYear === 'latest';
  const fallbackYear = parseInt(requestedYear || new Date().getFullYear(), 10);
  const supabase = getSupabaseClient();

  function buildOpportunitiesQuery(yearCondition, filters = {}) {
    let q = supabase
      .from('city_market_data')
      .select('*, cities!inner(*), economic_activities!inner(code, name_ar, name_en)')
      .not('opportunity_score', 'is', null);

    if (yearCondition === 'exact') {
      q = q.eq('data_year', fallbackYear);
    } else {
      q = q.lte('data_year', fallbackYear);
    }

    if (filters.countryCode) q = q.eq('cities.country_code', filters.countryCode);
    if (filters.activityCode) q = q.eq('economic_activities.code', filters.activityCode);
    if (minScore) q = q.gte('opportunity_score', Number(minScore));

    return q
      .order('data_year', { ascending: false })
      .order('opportunity_score', { ascending: false })
      .limit(limit);
  }

  async function tryQuery(filters) {
    if (isLatest) {
      const { data, error } = await buildOpportunitiesQuery('latest', filters);
      return { data, error };
    }
    let { data, error } = await buildOpportunitiesQuery('exact', filters);
    if (!error && (!data || data.length === 0)) {
      ({ data, error } = await buildOpportunitiesQuery('latest', filters));
    }
    return { data, error };
  }

  let { data, error } = await tryQuery({ countryCode, activityCode });

  if (error) {
    console.error('[opportunities/top]', error.message);
    return sendJson(res, 500, { error: 'Failed to load opportunities' });
  }

  const results = (data || []).map(row => ({
    city: row.cities,
    activity: row.economic_activities,
    score: row.opportunity_score,
    rank: row.opportunity_rank,
    breakdown: row.opportunity_breakdown,
    marketSize: row.market_size,
    competitorsCount: row.competitors_count,
    saturation: row.market_saturation_score,
    growthRate: row.annual_growth_rate,
    confidence: row.confidence,
    avgSalary: row.avg_salary,
    expectedDemand: row.expected_demand
  }));

  sendJson(res, 200, { opportunities: results, count: results.length });
}

async function handleCityDetail(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('*')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  // If no specific year requested, resolve the latest year that has data
  if (!targetYear) {
    const { data: latestIndicator } = await supabase
      .from('city_indicators')
      .select('year')
      .eq('city_id', city.id)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: latestMarket } = await supabase
      .from('city_market_data')
      .select('data_year')
      .eq('city_id', city.id)
      .order('data_year', { ascending: false })
      .limit(1)
      .maybeSingle();
    const indicatorYear = latestIndicator?.year || 0;
    const marketYear = latestMarket?.data_year || 0;
    targetYear = Math.max(indicatorYear, marketYear) || new Date().getFullYear();
  }

  const [{ data: indicators }, { data: marketData }] = await Promise.all([
    supabase
      .from('city_indicators')
      .select('*')
      .eq('city_id', city.id)
      .eq('year', targetYear)
      .maybeSingle(),
    supabase
      .from('city_market_data')
      .select('*, economic_activities(code, name_ar, name_en)')
      .eq('city_id', city.id)
      .eq('data_year', targetYear)
  ]);

  sendJson(res, 200, {
    city,
    indicators: indicators || null,
    marketData: marketData || [],
    year: targetYear
  });
}

async function handleCityIndicators(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)\/indicators$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  if (!targetYear) {
    const { data: latest } = await supabase
      .from('city_indicators')
      .select('year')
      .eq('city_id', city.id)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    targetYear = latest?.year || new Date().getFullYear();
  }

  const { data, error } = await supabase
    .from('city_indicators')
    .select('*')
    .eq('city_id', city.id)
    .eq('year', targetYear)
    .maybeSingle();

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { indicators: data || null, year: targetYear });
}

async function handleCityMarket(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)\/market$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const activityCode = url.searchParams.get('activity');
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  if (!targetYear) {
    let q = supabase
      .from('city_market_data')
      .select('data_year')
      .eq('city_id', city.id)
      .order('data_year', { ascending: false })
      .limit(1);
    if (activityCode) {
      const { data: activity } = await supabase
        .from('economic_activities')
        .select('id')
        .eq('code', activityCode)
        .single();
      if (activity) q = q.eq('activity_id', activity.id);
    }
    const { data: latest } = await q.maybeSingle();
    targetYear = latest?.data_year || new Date().getFullYear();
  }

  let query = supabase
    .from('city_market_data')
    .select('*, economic_activities(code, name_ar, name_en)')
    .eq('city_id', city.id)
    .eq('data_year', targetYear);

  if (activityCode) {
    const { data: activity } = await supabase
      .from('economic_activities')
      .select('id')
      .eq('code', activityCode)
      .single();
    if (activity) query = query.eq('activity_id', activity.id);
  }

  const { data, error } = await query;
  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { marketData: data || [], year: targetYear });
}

async function handleUcpCalculate(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const body = await parseBody(req);
  const {
    sector, country, templateCode, inputs = {}, scenarioCodes, weightCode,
    policyCodes, businessFormulaCodes, context = {}, asset, legacyAdapter
  } = body;

  try {
    const supabase = getSupabaseClient();
    const ucp = await UniversalCalculationPlatform.create({ supabase, preferStatic: true });

    let ucpInputs = inputs;
    let resolvedSector = sector;
    if (legacyAdapter) {
      const adapted = adaptToUcp(legacyAdapter, inputs);
      resolvedSector = adapted.sector;
      ucpInputs = adapted.inputs;
    }

    const result = await ucp.calculate({
      templateCode,
      sector: resolvedSector,
      country,
      inputs: ucpInputs,
      scenarioCodes,
      weightCode,
      policyCodes,
      businessFormulaCodes,
      context,
      asset
    });

    if (legacyAdapter) {
      result.legacyOutputs = adaptFromUcp(legacyAdapter, result.outputs);
    }

    sendJson(res, 200, result);
  } catch (err) {
    console.error('[ucp/calculate]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

async function handleUcpTemplates(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const sector = url.searchParams.get('sector');
  const country = url.searchParams.get('country');

  try {
    const ucp = await UniversalCalculationPlatform.create({ preferStatic: true });
    const template = ucp.resolveTemplate({ sector, country });
    const all = ucp.templates.list();
    sendJson(res, 200, { template, all, count: all.length });
  } catch (err) {
    console.error('[ucp/templates]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleWave4Intents(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    sendJson(res, 200, { intents: listIntents() });
  } catch (err) {
    console.error('[wave4/intents]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleWave4Intent(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await parseBody(req);
    const { result, trace } = await buildIntentForm(body);
    sendJson(res, 200, { ...result, trace });
  } catch (err) {
    console.error('[wave4/intent]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

async function handleWave4Run(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await parseBody(req);
    const { result, trace } = await orchestratorRun(body);
    sendJson(res, 200, { ...result, trace });
  } catch (err) {
    console.error('[wave4/run]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

async function handleCalculate(req, res) {
  const body = await parseBody(req);
  const { projectModelCode, cityCode, assumptions: customAssumptions = {}, projectionYears = 5 } = body;

  if (!projectModelCode) {
    return sendJson(res, 400, { error: 'projectModelCode is required' });
  }

  try {
    const supabase = getSupabaseClient();
    const modelData = await loadProjectModel(supabase, projectModelCode, cityCode);
    const result = calculate(modelData, {
      revenue: customAssumptions.revenue,
      capex: customAssumptions.capex,
      projectionYears
    });

    const recommendation = recommend(result, modelData.marketData || {});
    const ai = await generateInsights(
      result,
      modelData.marketData || null,
      modelData.marketData?.city?.name_ar || cityCode
    );

    sendJson(res, 200, {
      ...result,
      recommendation,
      ai,
      marketData: modelData.marketData || null
    });
  } catch (err) {
    console.error('[calculate]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

function requireCronOrAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = req.headers['x-admin-token'];
  const expectedAdmin = process.env.ADMIN_TOKEN;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;
  if (expectedAdmin && adminToken && adminToken === expectedAdmin) return null;

  if (!cronSecret && !expectedAdmin) {
    return { error: 'No cron or admin auth configured' };
  }
  return { error: 'Unauthorized' };
}

async function handleCronCalibrate(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const authError = requireCronOrAdmin(req);
  if (authError) return sendJson(res, 401, authError);

  const body = await parseBody(req);
  const activityCodes = body.activity_codes || ['dental_clinics'];
  const year = parseInt(body.year || new Date().getFullYear(), 10);
  const supabase = getSupabaseClient();

  const results = [];
  for (const activityCode of activityCodes) {
    try {
      const result = await calibrateCompetitorCounts({ supabase, activityCode, year });
      results.push({ activityCode, status: 'ok', result: { upserted: result.upserted.length, skipped: result.skipped.length } });
    } catch (err) {
      results.push({ activityCode, status: 'error', error: err.message });
    }
  }

  sendJson(res, 200, { cron: 'calibrate-competitors', results });
}

async function handleCronCheckQuality(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const authError = requireCronOrAdmin(req);
  if (authError) return sendJson(res, 401, authError);

  const url = getQuery(req);
  const minSuccessRate = parseFloat(url.searchParams.get('min_success_rate') || '0.5');
  const recentDays = parseInt(url.searchParams.get('recent_days') || '7', 10);

  const supabase = getSupabaseClient();
  const monitor = new SourceQualityMonitor(supabase);
  const alerts = await monitor.checkAlerts({ minSuccessRate, recentDays });
  const [webhookResult, emailResult] = await Promise.all([
    monitor.sendWebhook(alerts),
    monitor.sendEmailAlerts(alerts)
  ]);

  sendJson(res, 200, { cron: 'check-source-quality', alerts, webhookResult, emailResult });
}

module.exports = async function handler(req, res) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  // Support both /api/v3/... (production under main site) and /api/... (standalone dev)
  const path = url.pathname.replace(/^\/api\/v3/, '').replace(/^\/api/, '') || '/';

  // Legacy analyze-document proxy (previously handled by api/v3/index.js wrapper)
  if (path === '/analyze-document' || path === '/analyze-document/') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    return require('../../lib/api/analyze-document')(req, res);
  }

  const category = getCategory(path);
  if (await checkRateLimit(category, req, res)) {
    return;
  }

  // Support both /api/v3/... (production under main site) and /api/... (standalone dev)
  // `path` already computed above before rate limiting.

  try {
    if (path === '/health' || path === '/') return await handleHealth(req, res);
    if (path === '/sectors' && req.method === 'GET') return await handleSectors(req, res);
    if (path === '/models' && req.method === 'GET') return await handleModels(req, res);
    if (path.match(/^\/models\/[^\/]+$/) && req.method === 'GET') return await handleModelDetail(req, res, path);
    if (path === '/cities' && req.method === 'GET') return await handleCities(req, res);
    if (path === '/geocode' && req.method === 'GET') return await handleGeocode(req, res);
    if (path === '/opportunities/top' && req.method === 'GET') return await handleOpportunitiesTop(req, res);
    if (path.match(/^\/cities\/[^\/]+\/indicators$/) && req.method === 'GET') return await handleCityIndicators(req, res, path);
    if (path.match(/^\/cities\/[^\/]+\/market$/) && req.method === 'GET') return await handleCityMarket(req, res, path);
    if (path.match(/^\/cities\/[^\/]+$/) && req.method === 'GET') return await handleCityDetail(req, res, path);
    if (path === '/calculate' && req.method === 'POST') return await handleCalculate(req, res);
    if (path === '/ucp/calculate' && req.method === 'POST') return await handleUcpCalculate(req, res);
    if (path === '/ucp/templates' && req.method === 'GET') return await handleUcpTemplates(req, res);
    if (path === '/wave4/intents' && req.method === 'GET') return await handleWave4Intents(req, res);
    if (path === '/wave4/intent' && req.method === 'POST') return await handleWave4Intent(req, res);
    if (path === '/wave4/run' && req.method === 'POST') return await handleWave4Run(req, res);
    if (path === '/orchestrate/intents' && req.method === 'GET') return await handleWave4Intents(req, res);
    if (path === '/orchestrate/form' && req.method === 'POST') return await handleWave4Intent(req, res);
    if (path === '/orchestrate' && req.method === 'POST') return await handleWave4Run(req, res);
    if (path.startsWith('/calculate/scenarios')) return await scenariosRouter(req, res, path);
    if (path === '/ai/chat' && req.method === 'POST') return await aiChatHandler(req, res);
    if (path === '/ai/analyze' && req.method === 'POST') return await handleAiAnalyze(req, res);
    if (path === '/ai/valuate' && req.method === 'POST') return await handleValuationAnalyze(req, res);
    if (path.match(/^\/ai\/valuate\/[^/]+\/approve$/) && req.method === 'POST') return await handleApproveReport(req, res, path);
    if (path === '/ai/request-review' && req.method === 'POST') return await handleAiReviewRequest(req, res);
    if (path.match(/^\/valuations\/[^/]+\/certificate$/) && req.method === 'POST') return await handleIssueCertificate(req, res, path);
    if (path.match(/^\/certificates\/[^/]+\/verify$/) && req.method === 'GET') return await handleVerifyCertificate(req, res, path);
    if (path.startsWith('/scenarios')) return await scenariosRouter(req, res, path);
    if (path.startsWith('/admin/alert-rules') || path.startsWith('/admin/alerts') || path.startsWith('/alerts')) {
      return await alertsRouter(req, res, path);
    }
    if (path === '/compare/cities') return await compareRouter(req, res, path);
    if (path.startsWith('/fabric')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      return await fabricRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/intelligence')) {
      const supabase = getSupabaseClient();
      return await intelligenceRouter(req, res, path, supabase);
    }
    if (path.startsWith('/investment-intelligence')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await investmentIntelligenceRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/enterprise-lifecycle')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await enterpriseLifecycleRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/ecc')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await eccRouter(req, res, path, supabase, user);
    }
    if (path === '/cron/calibrate-competitors') return await handleCronCalibrate(req, res);
    if (path === '/cron/check-source-quality') return await handleCronCheckQuality(req, res);

    if (path.startsWith('/admin')) {
      return await adminRouter(req, res, path);
    }

    if (path.startsWith('/auth')) {
      return await authRouter(req, res, path);
    }

    if (path.startsWith('/projects')) {
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await projectsRouter(req, res, path, user);
    }

    if (path.startsWith('/data')) {
      return await dataEngineRouter(req, res, path);
    }

    if (path.startsWith('/billing')) {
      if (path === '/billing/subscription') {
        const user = await getUserFromToken(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        return await billingRouter(req, res, path, user);
      }
      return await billingRouter(req, res, path);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[api]', err.message);
    sendJson(res, 500, { error: err.message });
  }
};