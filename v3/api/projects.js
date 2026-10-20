const { getSupabaseClient } = require('../lib/supabase');
const { resolveGeoContext } = require('../../lib/geo/resolve-context');
const { LifecycleEngine } = require('../../lib/enterprise-lifecycle');
const { getUserRole, can } = require('../../lib/ecc/role-guard');
// Note: project write/delete authorization is enforced by Supabase RLS (user_id scoped).

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

async function listProjects(req, res, user) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('bonds_projects')
    .select(`
      id, name, project_number, sector, sub_sector, activity,
      city_id, geo_place_id, geo_snapshot, currency, status, capital, revenue, annual_profit,
      language, metadata, created_at, updated_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { projects: data });
}

async function resolveCityContext(supabase, cityCode) {
  if (!cityCode) return { cityId: null, geoPlaceId: null, geoSnapshot: {} };

  const { data: city, error } = await supabase
    .from('cities')
    .select('id,code,country_code,name_ar,name_en,geo_place_id')
    .eq('code', cityCode)
    .maybeSingle();
  if (error) throw error;

  let geo = { place: null, snapshot: {} };
  try {
    geo = await resolveGeoContext(supabase, {
      canonicalCode: cityCode,
      cityCode,
      countryCode: city?.country_code || null,
      localityName: city?.name_ar || city?.name_en || null
    });
  } catch (geoError) {
    console.warn('[projects/create] geo resolve failed:', geoError.message);
  }

  return {
    cityId: city?.id || null,
    geoPlaceId: geo.place?.id || city?.geo_place_id || null,
    geoSnapshot: geo.snapshot || {}
  };
}

async function createProject(req, res, user) {
  const supabase = getSupabaseClient();
  // RLS policies already enforce that users can only create projects for themselves.
  // Role guard is reserved for shared/team assets in the Executive Command Center.
  const body = await parseBody(req);
  const {
    name,
    sector,
    activity,
    cityCode,
    currency,
    capital,
    revenue,
    annualProfit,
    language,
    metadata
  } = body;

  if (!name || !sector) {
    return sendJson(res, 400, { error: 'name and sector are required' });
  }

  try {
    const cityContext = await resolveCityContext(supabase, cityCode);

    const insertPayload = {
      project_number: 'PRJ-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      user_id: user.id,
      name,
      sector,
      activity: activity || sector,
      city_id: cityContext.cityId,
      geo_place_id: cityContext.geoPlaceId,
      geo_snapshot: cityContext.geoSnapshot,
      currency: currency || 'SAR',
      capital: capital || 0,
      revenue: revenue || 0,
      annual_profit: annualProfit || 0,
      language: language || 'ar',
      status: 'active',
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
    };

    const { data: project, error: insertError } = await supabase
      .from('bonds_projects')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[projects/create] insert failed:', insertError.message);
      return sendJson(res, 400, { error: insertError.message });
    }

    // Initialize lifecycle instance so the project appears in ECC/V3 journey.
    try {
      const engine = await new LifecycleEngine({ supabase }).initialize();
      await engine.createInstance({
        entityType: 'project',
        entityId: project.id,
        userId: user.id
      });
    } catch (lifecycleErr) {
      console.warn('[projects/create] lifecycle init failed:', lifecycleErr.message);
      // Non-fatal: project exists; lifecycle can be created lazily on first status load.
    }

    sendJson(res, 201, { project });
  } catch (err) {
    console.error('[projects/create]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function getProject(req, res, user, projectId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('bonds_projects')
    .select(`
      id, name, project_number, sector, sub_sector, activity,
      city_id, geo_place_id, geo_snapshot, currency, status, capital, revenue, annual_profit,
      language, metadata, created_at, updated_at
    `)
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return sendJson(res, 404, { error: 'Project not found' });
  sendJson(res, 200, { project: data });
}

async function deleteProject(req, res, user, projectId) {
  const supabase = getSupabaseClient();
  // RLS policies already enforce user-scoped deletes.
  const { error } = await supabase
    .from('bonds_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id);

  if (error) return sendJson(res, 400, { error: error.message });
  sendJson(res, 200, { deleted: true });
}

async function projectsRouter(req, res, path, user) {
  const parts = path.split('/').filter(Boolean);
  const id = parts[1];

  try {
    if (!id && req.method === 'GET') return await listProjects(req, res, user);
    if (!id && req.method === 'POST') return await createProject(req, res, user);
    if (id && req.method === 'GET') return await getProject(req, res, user, id);
    if (id && req.method === 'DELETE') return await deleteProject(req, res, user, id);

    return sendJson(res, 404, { error: 'Project endpoint not found' });
  } catch (err) {
    console.error('[projects]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { projectsRouter };
