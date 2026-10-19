/**
 * Bonds V3 — City Comparison API
 *
 * Compares multiple cities for a given activity and optionally a project model.
 */
const { getSupabaseClient } = require('../lib/supabase');
const { loadProjectModel } = require('../engine/loader');
const { calculate } = require('../engine/calculator');

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

async function resolveActivities(supabase, activityCodes) {
  const codes = [...new Set((activityCodes || []).filter(Boolean))];
  if (!codes.length) return [];
  const { data, error } = await supabase
    .from('economic_activities')
    .select('id, code, name_ar, name_en')
    .in('code', codes);
  if (error) throw error;
  return data || [];
}

async function getLatestIndicator(supabase, cityId, year) {
  const { data, error } = await supabase
    .from('city_indicators')
    .select('*')
    .eq('city_id', cityId)
    .lte('year', year)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getLatestMarketData(supabase, cityId, activityIds, year) {
  if (!activityIds.length) return null;
  const { data, error } = await supabase
    .from('city_market_data')
    .select('*, economic_activities(code, name_ar, name_en)')
    .eq('city_id', cityId)
    .in('activity_id', activityIds)
    .lte('data_year', year)
    .order('data_year', { ascending: false })
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleCompareCities(req, res) {
  const body = req.method === 'POST' ? await parseBody(req) : {};
  const url = new URL(req.url, `http://${req.headers.host}`);

  const activityCode = body.activityCode || url.searchParams.get('activity');
  const activityCodesParam = body.activityCodes || (url.searchParams.get('activity_codes') || '').split(',').filter(Boolean);
  const activityCodes = [...new Set([
    ...(Array.isArray(activityCodesParam) ? activityCodesParam : []),
    ...(activityCode ? [activityCode] : [])
  ])];
  const year = parseInt(body.year || url.searchParams.get('year') || new Date().getFullYear(), 10);
  const modelCode = body.modelCode || url.searchParams.get('model');
  const cityCodes = body.cityCodes || (url.searchParams.get('cities') || '').split(',').filter(Boolean);

  if (!cityCodes.length || cityCodes.length > 10) {
    return sendJson(res, 400, { error: 'cityCodes must contain 1 to 10 cities' });
  }

  const supabase = getSupabaseClient();

  try {
    const activities = await resolveActivities(supabase, activityCodes);
    const activityIds = activities.map(activity => activity.id);
    const activity = activities.find(item => item.code === activityCode) || activities[0] || null;

    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, code, name_ar, name_en, country_code, region, population, purchasing_power_index, lat, lng')
      .in('code', cityCodes);

    if (citiesError) throw citiesError;

    const results = [];
    for (const city of cities || []) {
      const [indicators, market] = await Promise.all([
        getLatestIndicator(supabase, city.id, year),
        activityIds.length ? getLatestMarketData(supabase, city.id, activityIds, year) : Promise.resolve(null)
      ]);

      const item = {
        city,
        indicators: indicators || null,
        market: market || null,
        financial: null
      };

      if (modelCode) {
        try {
          const modelData = await loadProjectModel(supabase, modelCode, city.code, city.country_code);
          if (modelData.countryContext?.localized === true) {
            const calc = calculate(modelData);
            item.financial = {
              roi: calc.summary?.roi ?? null,
              irr: calc.summary?.irr ?? null,
              npv: calc.summary?.npv ?? null,
              paybackMonths: calc.summary?.paybackMonths ?? null,
              breakEven: calc.summary?.breakEven ?? null,
              riskScore: calc.risk?.score ?? null,
              currency: modelData.projectModel?.default_currency || modelData.countryContext?.currency_code || null
            };
            item.financial_status = modelData.countryContext?.model_status || 'localized';
          } else {
            item.financial_status = 'country_model_unverified';
          }
        } catch (err) {
          item.financial_status = 'calculation_failed';
          console.warn(`[compare] Financial calc failed for ${city.code}:`, err.message);
        }
      }

      results.push(item);
    }

    sendJson(res, 200, {
      activity,
      activityAliases: activities.map(item => item.code),
      year,
      modelCode: modelCode || null,
      count: results.length,
      cities: results
    });
  } catch (err) {
    console.error('[compare]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function compareRouter(req, res, path) {
  if (path === '/compare/cities' && (req.method === 'POST' || req.method === 'GET')) {
    return handleCompareCities(req, res);
  }

  sendJson(res, 404, { error: 'Not found' });
}

module.exports = { compareRouter };
