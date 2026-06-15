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
  res.setHeader('Content-Type', 'application/json');
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

async function resolveActivity(supabase, activityCode) {
  const { data, error } = await supabase
    .from('economic_activities')
    .select('id, code, name_ar, name_en')
    .eq('code', activityCode)
    .single();
  if (error || !data) throw new Error(`Activity not found: ${activityCode}`);
  return data;
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

async function getLatestMarketData(supabase, cityId, activityId, year) {
  const { data, error } = await supabase
    .from('city_market_data')
    .select('*, economic_activities(code, name_ar, name_en)')
    .eq('city_id', cityId)
    .eq('activity_id', activityId)
    .lte('data_year', year)
    .order('data_year', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleCompareCities(req, res) {
  const body = req.method === 'POST' ? await parseBody(req) : {};
  const url = new URL(req.url, `http://${req.headers.host}`);

  const activityCode = body.activityCode || url.searchParams.get('activity');
  const year = parseInt(body.year || url.searchParams.get('year') || new Date().getFullYear(), 10);
  const modelCode = body.modelCode || url.searchParams.get('model');
  const cityCodes = body.cityCodes || (url.searchParams.get('cities') || '').split(',').filter(Boolean);

  if (!activityCode) {
    return sendJson(res, 400, { error: 'activityCode is required' });
  }
  if (!cityCodes.length || cityCodes.length > 10) {
    return sendJson(res, 400, { error: 'cityCodes must contain 1 to 10 cities' });
  }

  const supabase = getSupabaseClient();

  try {
    const activity = await resolveActivity(supabase, activityCode);

    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, code, name_ar, name_en, country_code, region, population, purchasing_power_index, lat, lng')
      .in('code', cityCodes);

    if (citiesError) throw citiesError;

    const results = [];
    for (const city of cities || []) {
      const [indicators, market] = await Promise.all([
        getLatestIndicator(supabase, city.id, year),
        getLatestMarketData(supabase, city.id, activity.id, year)
      ]);

      const item = {
        city,
        indicators: indicators || null,
        market: market || null,
        financial: null
      };

      if (modelCode) {
        try {
          const modelData = await loadProjectModel(supabase, modelCode, city.code);
          const calc = calculate(modelData);
          item.financial = {
            roi: calc.summary?.roi ?? null,
            irr: calc.summary?.irr ?? null,
            npv: calc.summary?.npv ?? null,
            paybackMonths: calc.summary?.paybackMonths ?? null,
            breakEven: calc.summary?.breakEven ?? null,
            riskScore: calc.risk?.score ?? null
          };
        } catch (err) {
          console.warn(`[compare] Financial calc failed for ${city.code}:`, err.message);
        }
      }

      results.push(item);
    }

    sendJson(res, 200, {
      activity,
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
