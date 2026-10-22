/**
 * Bonds V3 — Admin API
 *
 * Simple admin endpoints protected by ADMIN_TOKEN env variable.
 * Used by the CMS admin UI.
 */

const { getSupabaseClient } = require('../lib/supabase');
const { requireAdminAccess, requireAgentInboxAccess, requireHumanApprovalAccess } = require('../lib/admin-access');
const {
  listAgentInbox,
  updateAgentInboxItem,
  listAgentAssignees
} = require('../../lib/assistant/agent-inbox-queue');
const { listHumanApprovalQueue, decideHumanApproval } = require('../../lib/assistant/human-approval');
const { calibrateCompetitorCounts } = require('../engine/data-acquisition/CompetitorCalibration');
const SourceQualityMonitor = require('../engine/data-acquisition/SourceQualityMonitor');
const { scanAssistantAnomalies } = require('../../lib/assistant/anomaly-detection');
const { buildAssistantOperationalDashboard } = require('../../lib/assistant/operational-dashboard');

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

async function requireAdmin(req) {
  return (await requireAdminAccess(req)) ? null : { error: 'Unauthorized' };
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
      code, name_ar, name_en, country_code, region, region_code,
      admin_level_2, locality_type,
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
        code, name_ar, name_en, country_code: country_code || null, region, region_code,
        admin_level_2: admin_level_2 || null,
        locality_type: locality_type || 'city',
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


async function handleAssistantOperations(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { success:false, error:'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  const url = new URL(req.url || '/api/v3/admin/assistant-operations', 'http://localhost');
  const windowHours = url.searchParams.get('window_hours') || 24;

  try {
    const dashboard = await buildAssistantOperationalDashboard({
      supabase,
      windowHours
    });
    return sendJson(res, 200, {
      success:true,
      assistant_operations:dashboard
    });
  } catch (err) {
    return sendJson(res, 503, {
      success:false,
      error:String(err?.message || 'ASSISTANT_OPERATIONAL_DASHBOARD_FAILED')
    });
  }
}

async function handleAssistantAnomalies(req, res) {
  const supabase = getSupabaseClient();
  const url = new URL(req.url || '/api/v3/admin/assistant-anomalies', 'http://localhost');
  const lookbackMinutes = url.searchParams.get('lookback_minutes') || 15;

  if (!['GET','POST'].includes(req.method)) {
    return sendJson(res, 405, { error:'Method not allowed' });
  }

  try {
    const scan = await scanAssistantAnomalies({
      supabase,
      lookbackMinutes,
      persist:req.method === 'POST'
    });
    return sendJson(res, 200, {
      success:true,
      anomaly_detection:scan
    });
  } catch (err) {
    return sendJson(res, 503, {
      success:false,
      error:String(err?.message || 'ANOMALY_SCAN_FAILED')
    });
  }
}

async function handleServiceAdmin(req, res, code) {
  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    if (code) {
      const { data: service, error } = await supabase
        .from('service_catalog')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (error || !service) return sendJson(res, 404, { error: 'Service not found' });

      const [countriesRes,sectorsRes,activitiesRes,capabilitiesRes,proceduresRes] = await Promise.all([
        supabase.from('service_country_map').select('country_code,availability_status,availability_reason_ar,availability_reason_en,priority').eq('service_id',service.id).order('priority'),
        supabase.from('service_sector_map').select('sector_code,priority').eq('service_id',service.id).order('priority'),
        supabase.from('service_activity_map').select('canonical_activity_id,priority,canonical_activities(code,name_ar,name_en)').eq('service_id',service.id).order('priority'),
        supabase.from('service_capability_map').select('capability_code,engine_route,run_order,is_required,metadata').eq('service_id',service.id).order('run_order'),
        supabase.from('service_procedures').select('*').eq('service_id',service.id).order('sort_order')
      ]);
      const failed=[countriesRes,sectorsRes,activitiesRes,capabilitiesRes,proceduresRes].find(x=>x.error);
      if(failed?.error) return sendJson(res,500,{error:failed.error.message});
      return sendJson(res,200,{
        service,
        countries:countriesRes.data||[],
        sectors:sectorsRes.data||[],
        activities:(activitiesRes.data||[]).map(row=>({
          ...row,
          code:row.canonical_activities?.code||null,
          name_ar:row.canonical_activities?.name_ar||null,
          name_en:row.canonical_activities?.name_en||null
        })),
        capabilities:capabilitiesRes.data||[],
        procedures:proceduresRes.data||[]
      });
    }

    const { data, error } = await supabase
      .from('service_catalog')
      .select('*')
      .order('sort_order');
    if (error) return sendJson(res, 500, { error: error.message });
    return sendJson(res, 200, { services: data || [] });
  }

  if (req.method === 'POST' || (req.method === 'PUT' && code)) {
    const body = await parseBody(req);
    const row = {
      code: code || body.code,
      category_code: body.category_code || null,
      name_ar: body.name_ar,
      name_en: body.name_en,
      short_description_ar: body.short_description_ar || null,
      short_description_en: body.short_description_en || null,
      delivery_type: body.delivery_type || 'advisory',
      status: body.status || 'draft',
      is_active: body.is_active !== false,
      sort_order: Number(body.sort_order || 0),
      default_route_ar: body.default_route_ar || null,
      default_route_en: body.default_route_en || null,
      metadata: body.metadata || {},
      updated_at: new Date().toISOString()
    };
    if (!row.code || !row.name_ar || !row.name_en) return sendJson(res, 400, { error: 'code, name_ar and name_en are required' });

    let result;
    if (req.method === 'POST') {
      result = await supabase.from('service_catalog').upsert(row, { onConflict: 'code' }).select().single();
    } else {
      delete row.code;
      result = await supabase.from('service_catalog').update(row).eq('code', code).select().single();
    }
    if (result.error) return sendJson(res, 400, { error: result.error.message });
    const service = result.data;

    async function replaceMap(table, rows) {
      await supabase.from(table).delete().eq('service_id', service.id);
      if (rows.length) {
        const { error } = await supabase.from(table).insert(rows);
        if (error) throw error;
      }
    }

    try {
      if (Array.isArray(body.countries)) {
        await replaceMap('service_country_map', body.countries.map(x => ({
          service_id: service.id,
          country_code: typeof x === 'string' ? x : x.country_code,
          availability_status: typeof x === 'string' ? 'available' : (x.availability_status || 'available'),
          availability_reason_ar: typeof x === 'string' ? null : (x.availability_reason_ar || null),
          availability_reason_en: typeof x === 'string' ? null : (x.availability_reason_en || null),
          priority: typeof x === 'string' ? 100 : Number(x.priority || 100)
        })));
      }
      if (Array.isArray(body.sectors)) {
        await replaceMap('service_sector_map', body.sectors.map(x => ({
          service_id: service.id,
          sector_code: typeof x === 'string' ? x : x.sector_code,
          priority: typeof x === 'string' ? 100 : Number(x.priority || 100)
        })));
      }
      if (Array.isArray(body.activities)) {
        const codes = body.activities.map(x => typeof x === 'string' ? x : x.code).filter(Boolean);
        const { data: acts, error } = codes.length
          ? await supabase.from('canonical_activities').select('id,code').in('code', codes)
          : { data: [], error: null };
        if (error) throw error;
        await replaceMap('service_activity_map', (acts || []).map(a => ({
          service_id: service.id, canonical_activity_id: a.id, priority: 100
        })));
      }
      if (Array.isArray(body.capabilities)) {
        await replaceMap('service_capability_map', body.capabilities.filter(x => x.capability_code).map(x => ({
          service_id: service.id,
          capability_code: x.capability_code,
          engine_route: x.engine_route || null,
          run_order: Number(x.run_order || 100),
          is_required: x.is_required === true
        })));
      }
      if (Array.isArray(body.procedures)) {
        await replaceMap('service_procedures', body.procedures.filter(x => x.title_ar).map((x,index) => ({
          service_id: service.id,
          country_code: x.country_code || null,
          sector_code: x.sector_code || null,
          canonical_activity_id: x.canonical_activity_id || null,
          title_ar: x.title_ar,
          title_en: x.title_en || null,
          description_ar: x.description_ar || null,
          description_en: x.description_en || null,
          procedure_type: x.procedure_type || 'manual',
          visibility: x.visibility || 'public',
          capability_code: x.capability_code || null,
          sort_order: Number(x.sort_order ?? ((index+1)*10)),
          is_required: x.is_required !== false,
          conditions: x.conditions || {},
          metadata: x.metadata || {}
        })));
      }
    } catch (mapErr) {
      return sendJson(res, 400, { error: mapErr.message, service });
    }
    return sendJson(res, req.method === 'POST' ? 201 : 200, { service });
  }

  if (req.method === 'DELETE' && code) {
    const { error } = await supabase.from('service_catalog').update({ is_active: false, status: 'archived', updated_at: new Date().toISOString() }).eq('code', code);
    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { archived: true });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

async function handleServiceFormsAdmin(req, res, serviceCode, formId, fieldId) {
  const supabase = getSupabaseClient();
  const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id').eq('code', serviceCode).maybeSingle();
  if (serviceError || !service) return sendJson(res, 404, { error: 'Service not found' });

  if (!formId) {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('service_form_definitions').select('*').eq('service_id', service.id).order('created_at');
      if (error) return sendJson(res, 500, { error: error.message });
      return sendJson(res, 200, { forms: data || [] });
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { data, error } = await supabase.from('service_form_definitions').insert({
        service_id: service.id,
        code: body.code,
        name_ar: body.name_ar,
        name_en: body.name_en,
        country_code: body.country_code || null,
        sector_code: body.sector_code || null,
        version: Number(body.version || 1),
        status: body.status || 'draft',
        is_active: body.is_active !== false,
        conditions: body.conditions || {},
        metadata: body.metadata || {}
      }).select().single();
      if (error) return sendJson(res, 400, { error: error.message });
      return sendJson(res, 201, { form: data });
    }
  }

  if (formId && !fieldId) {
    if (req.method === 'GET') {
      const [{ data: form, error: formError }, { data: fields, error: fieldsError }] = await Promise.all([
        supabase.from('service_form_definitions').select('*').eq('id', formId).eq('service_id', service.id).maybeSingle(),
        supabase.from('service_form_fields').select('*').eq('form_id', formId).order('sort_order')
      ]);
      if (formError || fieldsError || !form) return sendJson(res, 404, { error: 'Form not found' });
      return sendJson(res, 200, { form, fields: fields || [] });
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { data, error } = await supabase.from('service_form_fields').insert({
        form_id: formId,
        field_key: body.field_key,
        label_ar: body.label_ar,
        label_en: body.label_en || body.label_ar,
        field_type: body.field_type || 'text',
        is_required: body.is_required === true,
        sort_order: Number(body.sort_order || 0),
        placeholder_ar: body.placeholder_ar || null,
        placeholder_en: body.placeholder_en || null,
        options: body.options || [],
        validation: body.validation || {},
        conditions: body.conditions || {},
        metadata: body.metadata || {}
      }).select().single();
      if (error) return sendJson(res, 400, { error: error.message });
      return sendJson(res, 201, { field: data });
    }
  }

  if (fieldId && req.method === 'DELETE') {
    const { error } = await supabase.from('service_form_fields').delete().eq('id', fieldId).eq('form_id', formId);
    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, { deleted: true });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}


async function handleServicePricingAdmin(req, res, serviceCode, pricingId) {
  const supabase = getSupabaseClient();
  const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id').eq('code',serviceCode).maybeSingle();
  if(serviceError || !service) return sendJson(res,404,{error:'Service not found'});

  if(req.method==='GET'){
    const {data,error}=await supabase.from('service_pricing').select('*').eq('service_id',service.id).order('created_at',{ascending:false});
    if(error)return sendJson(res,500,{error:error.message});
    return sendJson(res,200,{pricing:data||[]});
  }
  if(req.method==='POST'){
    const body=await parseBody(req);
    const {data,error}=await supabase.from('service_pricing').insert({
      service_id:service.id,
      country_code:body.country_code||null,
      sector_code:body.sector_code||null,
      pricing_type:body.pricing_type||'quote',
      currency_code:body.currency_code||null,
      amount:body.amount===''||body.amount==null?null:Number(body.amount),
      min_amount:body.min_amount===''||body.min_amount==null?null:Number(body.min_amount),
      max_amount:body.max_amount===''||body.max_amount==null?null:Number(body.max_amount),
      conditions:body.conditions||{},
      is_active:body.is_active!==false,
      valid_from:body.valid_from||null,
      valid_to:body.valid_to||null,
      metadata:body.metadata||{}
    }).select().single();
    if(error)return sendJson(res,400,{error:error.message});
    return sendJson(res,201,{pricing:data});
  }
  if(req.method==='DELETE' && pricingId){
    const {error}=await supabase.from('service_pricing').delete().eq('id',pricingId).eq('service_id',service.id);
    if(error)return sendJson(res,400,{error:error.message});
    return sendJson(res,200,{deleted:true});
  }
  return sendJson(res,405,{error:'Method not allowed'});
}

async function handleServiceRequestsAdmin(req,res,requestId,subresource,subId){
  const supabase=getSupabaseClient();

  if(!requestId && req.method==='GET'){
    const {data,error}=await supabase
      .from('service_requests')
      .select('id,request_reference,user_id,client_id,service_id,country_code,region_name,locality_name,sector_code,status,crm_opportunity_id,funding_case_id,valuation_id,submitted_at,created_at,service_catalog(code,name_ar,name_en)')
      .order('created_at',{ascending:false})
      .limit(200);
    if(error)return sendJson(res,500,{error:error.message});
    return sendJson(res,200,{requests:data||[]});
  }

  if(requestId && !subresource && req.method==='GET'){
    const [{data:request,error},{data:values,error:valuesError},{data:quotes,error:quotesError}]=await Promise.all([
      supabase.from('service_requests').select('*,service_catalog(code,name_ar,name_en)').eq('id',requestId).maybeSingle(),
      supabase.from('service_request_values').select('*').eq('service_request_id',requestId).order('created_at'),
      supabase.from('service_quotes').select('*').eq('service_request_id',requestId).order('created_at',{ascending:false})
    ]);
    if(error||valuesError||quotesError||!request)return sendJson(res,404,{error:'Service request not found'});
    return sendJson(res,200,{request,values:values||[],quotes:quotes||[]});
  }

  if(requestId && !subresource && req.method==='PUT'){
    const body=await parseBody(req);
    const allowed=['triage','in_progress','awaiting_client','awaiting_approval','completed','cancelled'];
    if(!allowed.includes(body.status))return sendJson(res,400,{error:'Invalid status'});
    const patch={status:body.status,updated_at:new Date().toISOString()};
    if(body.status==='completed')patch.completed_at=new Date().toISOString();
    const {data,error}=await supabase.from('service_requests').update(patch).eq('id',requestId).select().single();
    if(error)return sendJson(res,400,{error:error.message});
    if(body.status==='completed'){
      await supabase.from('calculator_events').insert({
        event:'service_completed',
        calculator:'service_orchestration',
        country:data.country_code||null,
        user_id:data.user_id||null,
        action:'complete',
        properties:{service_request_id:data.id,service_id:data.service_id,sector_code:data.sector_code||null}
      });
      const {count}=await supabase.from('nps_surveys')
        .select('*',{count:'exact',head:true})
        .eq('service_request_id',data.id)
        .eq('user_id',data.user_id);
      if(!count){
        await supabase.from('nps_surveys').insert({
          user_id:data.user_id,
          service_request_id:data.id,
          status:'pending'
        });
      }
    }
    return sendJson(res,200,{request:data});
  }

  if(requestId && subresource==='quotes' && req.method==='POST'){
    const body=await parseBody(req);
    const {data:request}=await supabase.from('service_requests').select('id').eq('id',requestId).maybeSingle();
    if(!request)return sendJson(res,404,{error:'Service request not found'});
    const {data,error}=await supabase.from('service_quotes').insert({
      service_request_id:requestId,
      status:body.status||'draft',
      currency_code:body.currency_code||null,
      subtotal:body.subtotal==null?null:Number(body.subtotal),
      tax_amount:body.tax_amount==null?null:Number(body.tax_amount),
      total_amount:body.total_amount==null?null:Number(body.total_amount),
      valid_until:body.valid_until||null,
      terms:body.terms||{}
    }).select().single();
    if(error)return sendJson(res,400,{error:error.message});
    return sendJson(res,201,{quote:data});
  }

  if(requestId && subresource==='quotes' && subId && req.method==='PUT'){
    const body=await parseBody(req);
    const patch={};
    for(const key of ['status','currency_code','valid_until','finance_contract_id']) if(body[key]!==undefined) patch[key]=body[key];
    for(const key of ['subtotal','tax_amount','total_amount']) if(body[key]!==undefined) patch[key]=body[key]==null?null:Number(body[key]);
    if(body.terms!==undefined)patch.terms=body.terms;
    patch.updated_at=new Date().toISOString();
    const {data,error}=await supabase.from('service_quotes').update(patch).eq('id',subId).eq('service_request_id',requestId).select().single();
    if(error)return sendJson(res,400,{error:error.message});
    return sendJson(res,200,{quote:data});
  }

  return sendJson(res,405,{error:'Method not allowed'});
}



async function handleHumanApprovalsAdmin(req,res,parts,access){
  const supabase=getSupabaseClient();
  const approvalId=parts[2]||null;
  const subresource=parts[3]||null;

  if(!approvalId && req.method==='GET'){
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    try{
      const queue=await listHumanApprovalQueue({
        supabase,
        status:url.searchParams.get('status')||'pending',
        risk:url.searchParams.get('risk'),
        limit:url.searchParams.get('limit')||100
      });
      return sendJson(res,200,{success:true,role:access.role,human_approval_queue:queue});
    }catch(err){
      return sendJson(res,503,{success:false,error:err.message});
    }
  }

  if(approvalId && subresource==='decision' && req.method==='POST'){
    let body;
    try{body=await parseBody(req);}
    catch(_err){return sendJson(res,400,{success:false,error:'Invalid JSON body'});}
    try{
      const result=await decideHumanApproval({
        supabase,
        approvalId,
        reviewerUserId:access.user?.id||null,
        decision:body.decision,
        note:body.note
      });
      return sendJson(res,200,{success:true,...result});
    }catch(err){
      const status=err.message==='HUMAN_APPROVAL_NOT_FOUND_OR_DECIDED'?409
        : ['HUMAN_APPROVAL_ID_REQUIRED','HUMAN_APPROVAL_REVIEWER_REQUIRED','HUMAN_APPROVAL_DECISION_INVALID'].includes(err.message)?422
        : 503;
      return sendJson(res,status,{success:false,error:err.message});
    }
  }

  return sendJson(res,405,{success:false,error:'Method not allowed'});
}

async function handleAgentInboxAdmin(req, res, parts, access) {
  const supabase = getSupabaseClient();
  const itemId = parts[2] || null;
  const subresource = parts[3] || null;

  if (!itemId && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      const inbox = await listAgentInbox({
        supabase,
        status:url.searchParams.get('status'),
        priority:url.searchParams.get('priority'),
        assignedTo:url.searchParams.get('assigned_to'),
        limit:url.searchParams.get('limit') || 50
      });
      return sendJson(res, 200, {
        success:true,
        role:access.role,
        agent_inbox:inbox
      });
    } catch (err) {
      return sendJson(res, 503, { success:false, error:err.message });
    }
  }

  if (itemId === 'assignees' && req.method === 'GET') {
    try {
      const assignees = await listAgentAssignees({ supabase });
      return sendJson(res, 200, { success:true, assignees });
    } catch (err) {
      return sendJson(res, 503, { success:false, error:err.message });
    }
  }

  if (itemId && !subresource && req.method === 'PATCH') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { success:false, error:'Invalid JSON body' }); }

    try {
      const item = await updateAgentInboxItem({
        supabase,
        itemId,
        actorUserId:access.user?.id || null,
        assignedTo:Object.prototype.hasOwnProperty.call(body, 'assigned_to') ? body.assigned_to : undefined,
        status:Object.prototype.hasOwnProperty.call(body, 'status') ? body.status : undefined,
        resolutionNote:body.resolution_note
      });
      return sendJson(res, 200, { success:true, item });
    } catch (err) {
      const status = err.message === 'AGENT_INBOX_NOT_FOUND' ? 404
        : ['AGENT_INBOX_ITEM_REQUIRED','AGENT_INBOX_STATUS_INVALID'].includes(err.message) ? 422
        : 503;
      return sendJson(res, status, { success:false, error:err.message });
    }
  }

  return sendJson(res, 405, { success:false, error:'Method not allowed' });
}

async function adminRouter(req, res, path) {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1]; // after 'admin'
  const identifier = parts[2];

  if (resource === 'human-approvals') {
    const access=await requireHumanApprovalAccess(req);
    if(!access)return sendJson(res,401,{error:'Unauthorized'});
    return handleHumanApprovalsAdmin(req,res,parts,access);
  }

  if (resource === 'agent-inbox') {
    const access = await requireAgentInboxAccess(req);
    if (!access) return sendJson(res, 401, { error:'Unauthorized' });
    return handleAgentInboxAdmin(req, res, parts, access);
  }

  const authError = await requireAdmin(req);
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
    if (resource === 'assistant-anomalies') return await handleAssistantAnomalies(req, res);
    if (resource === 'assistant-operations') return await handleAssistantOperations(req, res);
    if (resource === 'services') {
      const serviceCode = parts[2];
      if (parts[3] === 'forms') return await handleServiceFormsAdmin(req, res, serviceCode, parts[4], parts[5]);
      if (parts[3] === 'pricing') return await handleServicePricingAdmin(req, res, serviceCode, parts[4]);
      return await handleServiceAdmin(req, res, serviceCode);
    }
    if (resource === 'service-requests') {
      return await handleServiceRequestsAdmin(req,res,parts[2],parts[3],parts[4]);
    }

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
