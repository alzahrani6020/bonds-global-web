/**
 * Bonds V3 — Admin API
 *
 * Simple admin endpoints protected by ADMIN_TOKEN env variable.
 * Used by the CMS admin UI.
 */

const { getSupabaseClient } = require('../lib/supabase');
const { calibrateCompetitorCounts } = require('../engine/data-acquisition/CompetitorCalibration');
const SourceQualityMonitor = require('../engine/data-acquisition/SourceQualityMonitor');

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

function requireAdmin(req) {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return { error: 'ADMIN_TOKEN not configured on server' };
  }

  if (!token || token !== expected) {
    return { error: 'Unauthorized' };
  }

  return null;
}

async function handleModels(req, res) {
  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('project_models')
      .select(`
        *,
        sector:sector_id (code, name_ar),
        sub_sector:sub_sector_id (code, name_ar),
        activity:activity_id (code, name_ar)
      `)
      .order('name_ar');

    if (error) return sendJson(res, 500, { error: error.message });
    return sendJson(res, 200, { models: data });
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const {
      code, name_ar, name_en, activity_code,
      size_category = 'small', model_type = 'greenfield',
      capex_min, capex_max, revenue_min, revenue_max,
      employee_count_min, employee_count_max, typical_roi_months,
      tags = [], is_published = false
    } = body;

    if (!code || !name_ar || !name_en || !activity_code) {
      return sendJson(res, 400, { error: 'Missing required fields' });
    }

    const { data: activity, error: activityError } = await supabase
      .from('economic_activities')
      .select('id, sub_sector_id, sector_id')
      .eq('code', activity_code)
      .single();

    if (activityError || !activity) {
      return sendJson(res, 400, { error: 'Activity not found' });
    }

    const { data, error } = await supabase
      .from('project_models')
      .insert({
        code,
        name_ar,
        name_en,
        activity_id: activity.id,
        sub_sector_id: activity.sub_sector_id,
        sector_id: activity.sector_id,
        size_category,
        model_type,
        capex_min,
        capex_max,
        revenue_min,
        revenue_max,
        employee_count_min,
        employee_count_max,
        typical_roi_months,
        tags,
        is_published
      })
      .select()
      .single();

    if (error) return sendJson(res, 400, { error: error.message });

    // Link to all default assumptions and risk factors
    const [{ data: assumptions }, { data: riskFactors }] = await Promise.all([
      supabase.from('financial_assumptions').select('id'),
      supabase.from('risk_factors').select('id,default_score')
    ]);

    if (assumptions?.length) {
      await supabase.from('project_model_assumptions').insert(
        assumptions.map(a => ({ project_model_id: data.id, assumption_id: a.id, value: 0 }))
      );
    }

    if (riskFactors?.length) {
      await supabase.from('project_model_risks').insert(
        riskFactors.map(rf => ({ project_model_id: data.id, risk_factor_id: rf.id, score: rf.default_score }))
      );
    }

    return sendJson(res, 201, { model: data });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleModelDetail(req, res, code) {
  const supabase = getSupabaseClient();

  if (req.method === 'PUT') {
    const body = await parseBody(req);
    const { data, error } = await supabase
      .from('project_models')
      .update(body)
      .eq('code', code)
      .select()
      .single();

    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { model: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('project_models').delete().eq('code', code);
    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { deleted: true });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleCities(req, res) {
  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('cities').select('*').order('name_ar');
    if (error) return sendJson(res, 500, { error: error.message });
    return sendJson(res, 200, { cities: data });
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const {
      code, name_ar, name_en, region, region_code,
      population, avg_household_income, purchasing_power_index,
      gdp_city, growth_rate, unemployment_rate,
      establishments_count, inflation_rate, business_ease_index
    } = body;

    if (!code || !name_ar || !name_en) {
      return sendJson(res, 400, { error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('cities')
      .upsert({
        code, name_ar, name_en, region, region_code,
        population, avg_household_income, purchasing_power_index,
        gdp_city, growth_rate, unemployment_rate,
        establishments_count, inflation_rate, business_ease_index
      }, { onConflict: 'code' })
      .select()
      .single();

    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { city: data });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleMarketData(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const body = await parseBody(req);
  const {
    city_code, activity_code,
    competitors_count, avg_market_share, avg_rent_per_sqm,
    avg_land_price_per_sqm, avg_salary,
    labor_availability_score, market_saturation_score,
    market_size, annual_growth_rate, per_capita_spending,
    expected_demand, profit_margin_min, profit_margin_avg,
    profit_margin_max, risk_score, confidence,
    data_year = new Date().getFullYear()
  } = body;

  if (!city_code || !activity_code) {
    return sendJson(res, 400, { error: 'city_code and activity_code are required' });
  }

  const supabase = getSupabaseClient();

  const [{ data: city }, { data: activity }] = await Promise.all([
    supabase.from('cities').select('id').eq('code', city_code).single(),
    supabase.from('economic_activities').select('id').eq('code', activity_code).single()
  ]);

  if (!city || !activity) {
    return sendJson(res, 400, { error: 'City or activity not found' });
  }

  const { data, error } = await supabase
    .from('city_market_data')
    .upsert({
      city_id: city.id,
      activity_id: activity.id,
      competitors_count,
      avg_market_share,
      avg_rent_per_sqm,
      avg_land_price_per_sqm,
      avg_salary,
      labor_availability_score,
      market_saturation_score,
      market_size,
      annual_growth_rate,
      per_capita_spending,
      expected_demand,
      profit_margin_min,
      profit_margin_avg,
      profit_margin_max,
      risk_score,
      confidence,
      data_year
    }, { onConflict: 'city_id,activity_id,data_year' })
    .select()
    .single();

  if (error) return sendJson(res, 400, { error: error.message });
  return sendJson(res, 200, { marketData: data });
}

async function handleReferenceData(req, res) {
  const supabase = getSupabaseClient();

  const [sectors, subSectors, activities, activityDetails, models, assumptions, risks, requirements] = await Promise.all([
    supabase.from('economic_sectors').select('*').order('sort_order'),
    supabase.from('economic_sub_sectors').select('*').order('name_ar'),
    supabase.from('economic_activities').select('*').order('name_ar'),
    supabase.from('economic_activity_details').select('*').order('name_ar'),
    supabase.from('project_models').select('*').order('name_ar'),
    supabase.from('financial_assumptions').select('*').order('category'),
    supabase.from('risk_factors').select('*').order('category'),
    supabase.from('regulatory_requirements').select('*').order('requirement_name_ar')
  ]);

  if ([sectors, subSectors, activities, activityDetails, models, assumptions, risks, requirements]
    .some(r => r.error)) {
    return sendJson(res, 500, { error: 'Failed to load reference data' });
  }

  sendJson(res, 200, {
    sectors: sectors.data,
    sub_sectors: subSectors.data,
    activities: activities.data,
    activity_details: activityDetails.data,
    project_models: models.data,
    assumptions: assumptions.data,
    risk_factors: risks.data,
    regulatory_requirements: requirements.data
  });
}

// ---------- Master Data CRUD helpers ----------

async function resolveParent(supabase, type, code) {
  if (!code) return null;
  let table, fields;
  if (type === 'sub-sectors') { table = 'economic_sectors'; fields = 'id'; }
  else if (type === 'activities') { table = 'economic_sub_sectors'; fields = 'id, sector_id'; }
  else if (type === 'activity-details') { table = 'economic_activities'; fields = 'id'; }
  else return null;

  const { data, error } = await supabase.from(table).select(fields).eq('code', code).single();
  if (error || !data) return null;
  return data;
}

async function handleMasterList(supabase, type) {
  const config = {
    sectors: { table: 'economic_sectors', order: 'sort_order', select: '*' },
    'sub-sectors': { table: 'economic_sub_sectors', order: 'name_ar', select: '*, sector:sector_id (code, name_ar)' },
    activities: { table: 'economic_activities', order: 'name_ar', select: '*, sub_sector:sub_sector_id (code, name_ar), sector:sector_id (code, name_ar)' },
    'activity-details': { table: 'economic_activity_details', order: 'name_ar', select: '*, activity:activity_id (code, name_ar)' },
    assumptions: { table: 'financial_assumptions', order: 'category', select: '*' },
    'risk-factors': { table: 'risk_factors', order: 'category', select: '*' }
  };
  const cfg = config[type];
  if (!cfg) throw new Error('Unknown type');
  const { data, error } = await supabase.from(cfg.table).select(cfg.select).order(cfg.order);
  if (error) throw error;
  return data;
}

async function handleMasterCreate(supabase, type, body) {
  const { code, name_ar, name_en, description, sort_order, ...rest } = body;
  if (!code || !name_ar || !name_en) throw new Error('Missing required fields');

  let insert = { code, name_ar, name_en, description, sort_order };

  if (type === 'sectors') {
    insert.risk_category = body.risk_category || 'medium';
    insert.is_active = body.is_active !== undefined ? body.is_active : true;
  }

  if (type === 'sub-sectors') {
    const sector = await resolveParent(supabase, type, body.sector_code);
    if (!sector) throw new Error('Sector not found');
    insert.sector_id = sector.id;
  }

  if (type === 'activities') {
    const sub = await resolveParent(supabase, type, body.sub_sector_code);
    if (!sub) throw new Error('Sub-sector not found');
    insert.sub_sector_id = sub.id;
    insert.sector_id = sub.sector_id;
  }

  if (type === 'activity-details') {
    const activity = await resolveParent(supabase, type, body.activity_code);
    if (!activity) throw new Error('Activity not found');
    insert.activity_id = activity.id;
  }

  if (type === 'assumptions') {
    insert = {
      code, name_ar, name_en,
      category: body.category,
      unit_type: body.unit_type,
      description,
      default_value: body.default_value || 0,
      min_value: body.min_value || null,
      max_value: body.max_value || null,
      is_active: body.is_active !== undefined ? body.is_active : true
    };
  }

  if (type === 'risk-factors') {
    insert = {
      code, name_ar, name_en,
      category: body.category,
      default_score: body.default_score || 50,
      weight: body.weight || 1,
      description,
      is_active: body.is_active !== undefined ? body.is_active : true
    };
  }

  const table = type === 'sub-sectors' ? 'economic_sub_sectors'
    : type === 'activities' ? 'economic_activities'
    : type === 'activity-details' ? 'economic_activity_details'
    : type === 'assumptions' ? 'financial_assumptions'
    : type === 'risk-factors' ? 'risk_factors'
    : 'economic_sectors';

  const { data, error } = await supabase.from(table).insert(insert).select().single();
  if (error) throw error;
  return data;
}

async function handleMasterUpdate(supabase, type, code, body) {
  const table = type === 'sub-sectors' ? 'economic_sub_sectors'
    : type === 'activities' ? 'economic_activities'
    : type === 'activity-details' ? 'economic_activity_details'
    : type === 'assumptions' ? 'financial_assumptions'
    : type === 'risk-factors' ? 'risk_factors'
    : 'economic_sectors';

  // Don't allow changing parent codes via update
  delete body.sector_code;
  delete body.sub_sector_code;
  delete body.activity_code;

  const { data, error } = await supabase.from(table).update(body).eq('code', code).select().single();
  if (error) throw error;
  return data;
}

async function handleMasterDelete(supabase, type, code) {
  const table = type === 'sub-sectors' ? 'economic_sub_sectors'
    : type === 'activities' ? 'economic_activities'
    : type === 'activity-details' ? 'economic_activity_details'
    : type === 'assumptions' ? 'financial_assumptions'
    : type === 'risk-factors' ? 'risk_factors'
    : 'economic_sectors';

  const { error } = await supabase.from(table).delete().eq('code', code);
  if (error) throw error;
  return { deleted: true };
}

async function handleMasterData(req, res, type, identifier) {
  const supabase = getSupabaseClient();

  try {
    if (req.method === 'GET') {
      const data = await handleMasterList(supabase, type);
      return sendJson(res, 200, { [type.replace(/-/g, '_')]: data });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const data = await handleMasterCreate(supabase, type, body);
      return sendJson(res, 201, { [type.replace(/-/g, '_').replace(/s$/, '')]: data });
    }

    if (req.method === 'PUT' && identifier) {
      const body = await parseBody(req);
      const data = await handleMasterUpdate(supabase, type, identifier, body);
      return sendJson(res, 200, { [type.replace(/-/g, '_').replace(/s$/, '')]: data });
    }

    if (req.method === 'DELETE' && identifier) {
      const result = await handleMasterDelete(supabase, type, identifier);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(`[master-data:${type}]`, err.message);
    return sendJson(res, 400, { error: err.message });
  }
}

async function handleCompetitorCalibration(req, res, path) {
  const supabase = getSupabaseClient();
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET') {
    const activityCode = url.searchParams.get('activity_code') || 'dental_clinics';
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear(), 10);

    const { data: activity, error: activityError } = await supabase
      .from('economic_activities')
      .select('id, code, name_ar')
      .eq('code', activityCode)
      .single();
    if (activityError || !activity) return sendJson(res, 400, { error: 'Activity not found' });

    const { data, error } = await supabase
      .from('city_competitor_calibration')
      .select(`
        *,
        city:city_id (id, code, name_ar, country_code, population),
        activity:activity_id (id, code, name_ar)
      `)
      .eq('activity_id', activity.id)
      .eq('year', year)
      .order('created_at', { ascending: false });

    if (error) return sendJson(res, 500, { error: error.message });
    return sendJson(res, 200, { activity, year, calibrations: data });
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);

    // Run auto-calibration endpoint: /api/admin/competitor-calibration/run
    if (path === '/admin/competitor-calibration/run' || body.run) {
      const activityCode = body.activity_code || 'dental_clinics';
      const year = parseInt(body.year || new Date().getFullYear(), 10);
      try {
        const result = await calibrateCompetitorCounts({ supabase, activityCode, year });
        return sendJson(res, 200, { success: true, result });
      } catch (err) {
        console.error('[calibration-run]', err.message);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // Manual upsert (accepts either UUIDs or codes)
    const {
      city_id, activity_id, city_code, activity_code,
      year = new Date().getFullYear(),
      calibrated_value, raw_value, factor, source, notes
    } = body;

    if (calibrated_value === undefined) {
      return sendJson(res, 400, { error: 'calibrated_value is required' });
    }

    let cityId = city_id;
    let activityId = activity_id;

    if (!cityId && city_code) {
      const { data } = await supabase.from('cities').select('id').eq('code', city_code).single();
      cityId = data?.id;
    }
    if (!activityId && activity_code) {
      const { data } = await supabase.from('economic_activities').select('id').eq('code', activity_code).single();
      activityId = data?.id;
    }

    if (!cityId || !activityId) {
      return sendJson(res, 400, { error: 'City and activity IDs/codes are required' });
    }

    const { data, error } = await supabase
      .from('city_competitor_calibration')
      .upsert({
        city_id: cityId,
        activity_id: activityId,
        metric_code: 'competitors_count',
        year,
        raw_value: raw_value ?? null,
        calibrated_value,
        factor: factor ?? null,
        source: source || 'manual',
        notes: notes || null
      }, { onConflict: 'city_id,activity_id,metric_code,year' })
      .select()
      .single();

    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { calibration: data });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleSourceQualityAlerts(req, res) {
  const supabase = getSupabaseClient();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const minSuccessRate = parseFloat(url.searchParams.get('min_success_rate') || '0.5');
  const recentDays = parseInt(url.searchParams.get('recent_days') || '7', 10);

  const monitor = new SourceQualityMonitor(supabase);
  try {
    const alerts = await monitor.checkAlerts({ minSuccessRate, recentDays });
    return sendJson(res, 200, { alerts, count: alerts.length });
  } catch (err) {
    console.error('[source-quality-alerts]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

async function adminRouter(req, res, path) {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1]; // after 'admin'
  const identifier = parts[2];

  const authError = requireAdmin(req);
  if (authError) return sendJson(res, 401, authError);

  try {
    if (resource === 'models') {
      if (identifier) return await handleModelDetail(req, res, identifier);
      return await handleModels(req, res);
    }
    if (resource === 'cities') return await handleCities(req, res);
    if (resource === 'market-data') return await handleMarketData(req, res);
    if (resource === 'reference') return await handleReferenceData(req, res);
    if (resource === 'competitor-calibration') return await handleCompetitorCalibration(req, res, path);
    if (resource === 'source-quality-alerts') return await handleSourceQualityAlerts(req, res);

    const masterTypes = ['sectors', 'sub-sectors', 'activities', 'activity-details', 'assumptions', 'risk-factors'];
    if (masterTypes.includes(resource)) {
      return await handleMasterData(req, res, resource, identifier);
    }

    return sendJson(res, 404, { error: 'Admin resource not found' });
  } catch (err) {
    console.error('[admin]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { adminRouter, requireAdmin };
