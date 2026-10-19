'use strict';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function getQuery(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

async function listPublishedServices(supabase, filters = {}) {
  const { data: services, error } = await supabase
    .from('service_catalog')
    .select('id,code,category_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,sort_order,default_route_ar,default_route_en,metadata')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;

  let allowed = new Set((services || []).map(row => row.id));
  const intersect = ids => {
    const next = new Set(ids || []);
    allowed = new Set([...allowed].filter(id => next.has(id)));
  };

  if (filters.goal) {
    const { data, error: mapError } = await supabase.from('service_goal_map').select('service_id').eq('goal_code', filters.goal);
    if (mapError) throw mapError;
    intersect((data || []).map(row => row.service_id));
  }

  if (filters.country) {
    const { data, error: mapError } = await supabase
      .from('service_country_map')
      .select('service_id,availability_status,availability_reason_ar,availability_reason_en,priority')
      .eq('country_code', filters.country)
      .neq('availability_status', 'unavailable');
    if (mapError) throw mapError;
    if ((data || []).length) intersect(data.map(row => row.service_id));
  }

  if (filters.sector) {
    const { data, error: mapError } = await supabase.from('service_sector_map').select('service_id').eq('sector_code', filters.sector);
    if (mapError) throw mapError;
    if ((data || []).length) intersect(data.map(row => row.service_id));
  }

  if (filters.activity) {
    const { data: activity, error: activityError } = await supabase
      .from('canonical_activities')
      .select('id')
      .eq('code', filters.activity)
      .maybeSingle();
    if (activityError) throw activityError;
    if (activity?.id) {
      const { data, error: mapError } = await supabase
        .from('service_activity_map')
        .select('service_id')
        .eq('canonical_activity_id', activity.id);
      if (mapError) throw mapError;
      if ((data || []).length) intersect(data.map(row => row.service_id));
    }
  }

  const selected = (services || []).filter(row => allowed.has(row.id));
  const ids = selected.map(row => row.id);
  if (!ids.length) return [];

  const [capRes, goalRes, countryRes] = await Promise.all([
    supabase.from('service_capability_map').select('service_id,capability_code,engine_route,run_order,is_required').in('service_id', ids).order('run_order'),
    supabase.from('service_goal_map').select('service_id,goal_code,priority').in('service_id', ids),
    filters.country
      ? supabase.from('service_country_map').select('service_id,country_code,availability_status,availability_reason_ar,availability_reason_en,priority').eq('country_code', filters.country).in('service_id', ids)
      : Promise.resolve({ data: [], error: null })
  ]);
  const failed = [capRes, goalRes, countryRes].find(x => x.error);
  if (failed?.error) throw failed.error;

  const caps = new Map();
  for (const row of capRes.data || []) {
    if (!caps.has(row.service_id)) caps.set(row.service_id, []);
    caps.get(row.service_id).push(row);
  }
  const goals = new Map();
  for (const row of goalRes.data || []) {
    if (!goals.has(row.service_id)) goals.set(row.service_id, []);
    goals.get(row.service_id).push(row);
  }
  const country = new Map((countryRes.data || []).map(row => [row.service_id, row]));

  return selected.map(row => ({
    ...row,
    goals: goals.get(row.id) || [],
    capabilities: caps.get(row.id) || [],
    country: country.get(row.id) || null
  }));
}

async function handleServiceCatalog(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const filters = {
    country: (url.searchParams.get('country') || '').toUpperCase() || null,
    sector: url.searchParams.get('sector') || null,
    activity: url.searchParams.get('activity') || null,
    goal: url.searchParams.get('goal') || null
  };
  try {
    const services = await listPublishedServices(supabase, filters);
    return sendJson(res, 200, { services, filters, count: services.length });
  } catch (err) {
    console.error('[services/catalog]', err.message);
    return sendJson(res, 500, { error: 'Failed to load services' });
  }
}

async function handleServiceGoals(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const { data, error } = await supabase
    .from('service_goals')
    .select('code,name_ar,name_en,description,sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return sendJson(res, 500, { error: 'Failed to load service goals' });
  return sendJson(res, 200, { goals: data || [], count: (data || []).length });
}

async function handleServicePackages(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const { data: packages, error } = await supabase
    .from('service_packages')
    .select('id,code,name_ar,name_en,description_ar,description_en,sort_order')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return sendJson(res, 500, { error: 'Failed to load service packages' });
  const ids = (packages || []).map(row => row.id);
  let items = [];
  if (ids.length) {
    const { data, error: itemsError } = await supabase
      .from('service_package_items')
      .select('package_id,service_id,sort_order,is_required')
      .in('package_id', ids)
      .order('sort_order');
    if (itemsError) return sendJson(res, 500, { error: 'Failed to load package items' });
    items = data || [];
  }
  return sendJson(res, 200, {
    packages: (packages || []).map(pkg => ({ ...pkg, items: items.filter(item => item.package_id === pkg.id) }))
  });
}

async function handleCreateServiceRequest(req, res, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  let body = {};
  try {
    body = await new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
      });
    });
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const serviceCode = body.service_code;
  if (!serviceCode) return sendJson(res, 400, { error: 'service_code is required' });

  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id,code,name_ar,name_en,category_code')
    .eq('code', serviceCode)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (serviceError || !service) return sendJson(res, 400, { error: 'Service not found' });

  let canonicalActivityId = null;
  if (body.activity_code) {
    const { data: activity } = await supabase.from('canonical_activities').select('id').eq('code', body.activity_code).maybeSingle();
    canonicalActivityId = activity?.id || null;
  }

  const { data: client } = await supabase
    .from('advisory_clients')
    .select('id,organization_id')
    .eq('auth_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  const requestRow = {
    user_id: user.id,
    client_id: client?.id || null,
    service_id: service.id,
    package_id: body.package_id || null,
    goal_code: body.goal_code || null,
    country_code: body.country_code || null,
    region_code: body.region_code || null,
    region_name: body.region_name || null,
    locality_code: body.locality_code || null,
    locality_name: body.locality_name || null,
    sector_code: body.sector_code || null,
    canonical_activity_id: canonicalActivityId,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    metadata: { source: body.source || 'service_discovery', ...(body.metadata || {}) }
  };

  const { data: requestRowOut, error: requestError } = await supabase
    .from('service_requests')
    .insert(requestRow)
    .select('id,request_reference,status,created_at')
    .single();
  if (requestError) return sendJson(res, 400, { error: requestError.message });

  let opportunity = null;
  if (client?.id) {
    const { data } = await supabase
      .from('crm_opportunities')
      .insert({
        organization_id: client.organization_id || null,
        client_id: client.id,
        title: service.name_ar,
        stage: 'new',
        probability: 10,
        source: 'service_request',
        service_request_id: requestRowOut.id,
        created_by: user.id
      })
      .select('id')
      .maybeSingle();
    opportunity = data || null;
    if (opportunity?.id) {
      await supabase.from('service_requests').update({ crm_opportunity_id: opportunity.id }).eq('id', requestRowOut.id);
    }
  }

  return sendJson(res, 201, { request: requestRowOut, crm_opportunity_id: opportunity?.id || null });
}

async function servicesRouter(req, res, path, supabase, user) {
  if (path === '/services' || path === '/services/catalog') return handleServiceCatalog(req, res, supabase);
  if (path === '/services/goals') return handleServiceGoals(req, res, supabase);
  if (path === '/services/packages') return handleServicePackages(req, res, supabase);
  if (path === '/services/requests') return handleCreateServiceRequest(req, res, supabase, user);
  return sendJson(res, 404, { error: 'Service resource not found' });
}

module.exports = { servicesRouter, listPublishedServices };
