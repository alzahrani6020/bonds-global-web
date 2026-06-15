const { getSupabaseClient } = require('../lib/supabase');
const { calculate, recommend } = require('../engine/calculator');
const { generateInsights } = require('../engine/ai');
const { loadProjectModel } = require('../engine/loader');

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

async function listProjects(req, res, user) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_projects')
    .select(`
      *,
      project_model:project_model_id (code, name_ar),
      city:city_id (code, name_ar)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { projects: data });
}

async function createProject(req, res, user) {
  const body = await parseBody(req);
  const { projectModelCode, cityCode, name, assumptions = {}, projectionYears = 5 } = body;

  if (!projectModelCode || !name) {
    return sendJson(res, 400, { error: 'projectModelCode and name are required' });
  }

  const supabase = getSupabaseClient();

  try {
    const modelData = await loadProjectModel(supabase, projectModelCode, cityCode);
    const result = calculate(modelData, {
      revenue: assumptions.revenue,
      capex: assumptions.capex,
      projectionYears
    });

    const recommendation = recommend(result, modelData.marketData || {});
    const ai = await generateInsights(
      result,
      modelData.marketData || null,
      modelData.marketData?.city?.name_ar || cityCode
    );

    const { data, error } = await supabase
      .from('user_projects')
      .insert({
        user_id: user.id,
        project_model_id: modelData.projectModel.id,
        city_id: modelData.marketData?.city_id || null,
        name,
        status: 'completed',
        assumptions,
        financial_results: result.summary,
        risk_results: result.risk,
        ai_insights: { recommendation, ai }
      })
      .select()
      .single();

    if (error) return sendJson(res, 400, { error: error.message });

    sendJson(res, 201, { project: data, calculation: result });
  } catch (err) {
    console.error('[projects/create]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function getProject(req, res, user, projectId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_projects')
    .select(`
      *,
      project_model:project_model_id (code, name_ar),
      city:city_id (code, name_ar)
    `)
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return sendJson(res, 404, { error: 'Project not found' });
  sendJson(res, 200, { project: data });
}

async function deleteProject(req, res, user, projectId) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('user_projects')
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
