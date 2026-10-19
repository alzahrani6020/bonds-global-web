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

  const allServiceIds=(services||[]).map(row=>row.id);

  if (filters.country && allServiceIds.length) {
    const { data, error: mapError } = await supabase
      .from('service_country_map')
      .select('service_id,country_code,availability_status')
      .eq('country_code', filters.country)
      .in('service_id', allServiceIds);
    if (mapError) throw mapError;
    const unavailable=new Set((data||[]).filter(row=>row.availability_status==='unavailable').map(row=>row.service_id));
    allowed=new Set([...allowed].filter(id=>!unavailable.has(id)));
  }

  if (filters.sector && allServiceIds.length) {
    const { data, error: mapError } = await supabase
      .from('service_sector_map')
      .select('service_id,sector_code')
      .in('service_id', allServiceIds);
    if (mapError) throw mapError;
    const mapped=new Set((data||[]).map(row=>row.service_id));
    const matching=new Set((data||[]).filter(row=>row.sector_code===filters.sector).map(row=>row.service_id));
    allowed=new Set([...allowed].filter(id=>!mapped.has(id)||matching.has(id)));
  }

  if (filters.activity && allServiceIds.length) {
    const { data: activity, error: activityError } = await supabase
      .from('canonical_activities')
      .select('id')
      .eq('code', filters.activity)
      .maybeSingle();
    if (activityError) throw activityError;
    if (activity?.id) {
      const { data, error: mapError } = await supabase
        .from('service_activity_map')
        .select('service_id,canonical_activity_id')
        .in('service_id', allServiceIds);
      if (mapError) throw mapError;
      const mapped=new Set((data||[]).map(row=>row.service_id));
      const matching=new Set((data||[]).filter(row=>row.canonical_activity_id===activity.id).map(row=>row.service_id));
      allowed=new Set([...allowed].filter(id=>!mapped.has(id)||matching.has(id)));
    }
  }

  const selected = (services || []).filter(row => allowed.has(row.id));
  const ids = selected.map(row => row.id);
  if (!ids.length) return [];

  const [capRes, goalRes, countryRes] = await Promise.all([
    supabase.from('service_capability_map').select('service_id,capability_code,run_order,is_required').in('service_id', ids).order('run_order'),
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
    country: country.get(row.id) || (filters.country ? {
      country_code: filters.country,
      availability_status: 'unknown',
      availability_reason_ar: null,
      availability_reason_en: null,
      priority: 100
    } : null)
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

  if (body.values && typeof body.values === 'object' && !Array.isArray(body.values)) {
    const valueRows = Object.entries(body.values).map(([field_key,value]) => ({
      service_request_id: requestRowOut.id,
      field_key,
      value,
      form_version: body.form_version || null
    }));
    if (valueRows.length) {
      const { error: valuesError } = await supabase.from('service_request_values').insert(valueRows);
      if (valuesError) return sendJson(res, 400, { error: valuesError.message, request: requestRowOut });
    }
  }

  await supabase.from('calculator_events').insert({
    event:'service_requested',
    calculator:'service_discovery',
    country:body.country_code || null,
    lang:body.lang || null,
    user_id:user.id,
    action:'request',
    properties:{service_code:serviceCode,sector_code:body.sector_code||null,activity_code:body.activity_code||null},
    url:body.url || null
  });

  let opportunity = null;
  if (client?.id) {
    const { data } = await supabase
      .from('crm_opportunities')
      .insert({
        organization_id: client.organization_id || null,
        client_id: client.id,
        title: service.name_ar,
        stage: 'lead',
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


function rowMatchesContext(row, filters) {
  if (row.country_code && filters.country && row.country_code !== filters.country) return false;
  if (row.country_code && !filters.country) return false;
  if (row.sector_code && filters.sector && row.sector_code !== filters.sector) return false;
  if (row.sector_code && !filters.sector) return false;
  return true;
}

async function handleServiceDetail(req, res, supabase, code) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const filters = {
    country: (url.searchParams.get('country') || '').toUpperCase() || null,
    sector: url.searchParams.get('sector') || null,
    activity: url.searchParams.get('activity') || null
  };

  const { data: service, error } = await supabase
    .from('service_catalog')
    .select('id,code,category_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,sort_order,default_route_ar,default_route_en,metadata')
    .eq('code', code)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (error || !service) return sendJson(res, 404, { error: 'Service not found' });

  let activityId = null;
  if (filters.activity) {
    const { data: activity } = await supabase.from('canonical_activities').select('id').eq('code', filters.activity).maybeSingle();
    activityId = activity?.id || null;
  }

  const [capRes,procRes,reqRes,delRes,depRes,formRes,pricingRes,countryRes] = await Promise.all([
    supabase.from('service_capability_map').select('capability_code,run_order,is_required').eq('service_id',service.id).order('run_order'),
    supabase.from('service_procedures').select('id,country_code,sector_code,canonical_activity_id,title_ar,title_en,description_ar,description_en,procedure_type,visibility,capability_code,sort_order,is_required,conditions,metadata').eq('service_id',service.id).eq('visibility','public').order('sort_order'),
    supabase.from('service_requirements').select('id,country_code,sector_code,requirement_type,label_ar,label_en,is_required,sort_order,conditions,metadata').eq('service_id',service.id).order('sort_order'),
    supabase.from('service_deliverables').select('id,code,name_ar,name_en,deliverable_type,sort_order,metadata').eq('service_id',service.id).order('sort_order'),
    supabase.from('service_dependencies').select('depends_on_service_id,dependency_type,conditions,metadata').eq('service_id',service.id),
    supabase.from('service_form_definitions').select('id,code,name_ar,name_en,country_code,sector_code,version,status,conditions,metadata').eq('service_id',service.id).eq('status','published').eq('is_active',true),
    supabase.from('service_pricing').select('id,country_code,sector_code,pricing_type,currency_code,amount,min_amount,max_amount,conditions,valid_from,valid_to,metadata').eq('service_id',service.id).eq('is_active',true),
    filters.country
      ? supabase.from('service_country_map').select('country_code,availability_status,availability_reason_ar,availability_reason_en,priority,metadata').eq('service_id',service.id).eq('country_code',filters.country).maybeSingle()
      : Promise.resolve({data:null,error:null})
  ]);
  const failed=[capRes,procRes,reqRes,delRes,depRes,formRes,pricingRes,countryRes].find(x=>x.error);
  if(failed?.error) return sendJson(res,500,{error:'Failed to load service details'});

  const procedures=(procRes.data||[]).filter(row=>{
    if(!rowMatchesContext(row,filters)) return false;
    if(row.canonical_activity_id && activityId && row.canonical_activity_id!==activityId) return false;
    if(row.canonical_activity_id && !activityId) return false;
    return true;
  });
  const requirements=(reqRes.data||[]).filter(row=>rowMatchesContext(row,filters));
  const pricing=(pricingRes.data||[]).filter(row=>rowMatchesContext(row,filters)).filter(row=>{
    const today=new Date().toISOString().slice(0,10);
    return (!row.valid_from || row.valid_from<=today) && (!row.valid_to || row.valid_to>=today);
  });

  const candidates=(formRes.data||[]).filter(row=>rowMatchesContext(row,filters)).sort((a,b)=>{
    const score=x=>(x.country_code?2:0)+(x.sector_code?1:0);
    return score(b)-score(a) || Number(b.version||0)-Number(a.version||0);
  });
  const form=candidates[0]||null;
  let fields=[];
  if(form){
    const {data,error:fieldsError}=await supabase.from('service_form_fields').select('*').eq('form_id',form.id).order('sort_order');
    if(fieldsError) return sendJson(res,500,{error:'Failed to load service form'});
    fields=data||[];
  }

  const dependencyIds=(depRes.data||[]).map(x=>x.depends_on_service_id);
  let dependencyServices=[];
  if(dependencyIds.length){
    const {data}=await supabase.from('service_catalog').select('id,code,name_ar,name_en,default_route_ar,default_route_en').in('id',dependencyIds);
    dependencyServices=data||[];
  }
  const dependencies=(depRes.data||[]).map(row=>({
    ...row,
    service:dependencyServices.find(x=>x.id===row.depends_on_service_id)||null
  }));

  return sendJson(res,200,{
    service,
    filters,
    availability:countryRes.data||null,
    capabilities:capRes.data||[],
    procedures,
    requirements,
    deliverables:delRes.data||[],
    dependencies,
    pricing,
    form:form?{...form,fields}:null
  });
}

async function servicesRouter(req, res, path, supabase, user) {
  if (path === '/services' || path === '/services/catalog') return handleServiceCatalog(req, res, supabase);
  if (path === '/services/goals') return handleServiceGoals(req, res, supabase);
  if (path === '/services/packages') return handleServicePackages(req, res, supabase);
  if (path === '/services/requests') return handleCreateServiceRequest(req, res, supabase, user);
  const detailMatch=path.match(/^\/services\/([^/]+)$/);
  if (detailMatch) return handleServiceDetail(req,res,supabase,decodeURIComponent(detailMatch[1]));
  return sendJson(res, 404, { error: 'Service resource not found' });
}

module.exports = { servicesRouter, listPublishedServices };
