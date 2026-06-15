/**
 * Bonds V3 — Scenario Engine API
 *
 * Endpoints:
 *   POST /api/calculate/scenarios  → compute baseline + scenarios
 *   GET  /api/scenarios            → list saved scenarios for current user
 *   GET  /api/scenarios/:id        → get a saved scenario
 *   DELETE /api/scenarios/:id      → delete a saved scenario
 */

const { getSupabaseClient } = require('../lib/supabase');
const { loadProjectModel } = require('../engine/loader');
const ScenarioEngine = require('../engine/ScenarioEngine');
const { getUserFromToken } = require('../lib/auth');

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

// Simple in-memory rate limit for scenario computation
const rateLimiter = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;
  const entries = rateLimiter.get(ip) || [];
  const fresh = entries.filter(t => now - t < windowMs);
  if (fresh.length >= limit) return false;
  fresh.push(now);
  rateLimiter.set(ip, fresh);
  return true;
}

async function handleCalculateScenarios(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { projectModelCode, cityCode, assumptions = {}, scenarios = [], save = false } = body;

  if (!projectModelCode) {
    return sendJson(res, 400, { error: 'projectModelCode is required' });
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return sendJson(res, 400, { error: 'scenarios array is required' });
  }
  if (scenarios.length > 10) {
    return sendJson(res, 400, { error: 'Maximum 10 scenarios per request' });
  }

  try {
    const supabase = getSupabaseClient();
    const modelData = await loadProjectModel(supabase, projectModelCode, cityCode);

    const baseOptions = {
      revenue: assumptions.revenue,
      capex: assumptions.capex,
      projectionYears: assumptions.projectionYears || 5
    };

    const normalizedScenarios = scenarios.map(ScenarioEngine.normalizeScenario);
    const results = ScenarioEngine.runScenarios(modelData, baseOptions, normalizedScenarios);

    // Save scenarios if requested and user is authenticated
    let saved = [];
    if (save) {
      const user = await getUserFromToken(req);
      if (!user) {
        return sendJson(res, 401, { error: 'Authentication required to save scenarios' });
      }

      const records = results.scenarios.map(s => ({
        user_id: user.id,
        project_id: body.projectId || null,
        name: s.name,
        description: body.description || null,
        project_model_code: projectModelCode,
        city_code: cityCode || null,
        baseline_assumptions: assumptions,
        shocks: s.shocks,
        results: {
          baselineSummary: results.baseline.summary,
          scenarioSummary: s.result.summary,
          comparison: s.comparison
        },
        is_saved: true
      }));

      const { data, error } = await supabase
        .from('project_scenarios')
        .insert(records)
        .select('id, name, created_at');

      if (error) {
        console.error('[scenarios save]', error.message);
        return sendJson(res, 500, { error: 'Failed to save scenarios' });
      }
      saved = data || [];
    }

    sendJson(res, 200, { ...results, saved });
  } catch (err) {
    console.error('[calculate/scenarios]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleListScenarios(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('project_scenarios')
    .select('id, name, description, project_model_code, city_code, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('is_saved', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[scenarios list]', error.message);
    return sendJson(res, 500, { error: 'Failed to load scenarios' });
  }

  sendJson(res, 200, { scenarios: data || [] });
}

async function handleGetScenario(req, res, id) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('project_scenarios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return sendJson(res, 404, { error: 'Scenario not found' });
  }

  sendJson(res, 200, { scenario: data });
}

async function handleDeleteScenario(req, res, id) {
  if (req.method !== 'DELETE') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('project_scenarios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[scenarios delete]', error.message);
    return sendJson(res, 500, { error: 'Failed to delete scenario' });
  }

  sendJson(res, 200, { deleted: true });
}

async function scenariosRouter(req, res, path) {
  if (path === '/calculate/scenarios' && req.method === 'POST') {
    return handleCalculateScenarios(req, res);
  }

  if (path === '/scenarios' && req.method === 'GET') {
    return handleListScenarios(req, res);
  }

  const getMatch = path.match(/^\/scenarios\/([^\/]+)$/);
  if (getMatch && req.method === 'GET') {
    return handleGetScenario(req, res, getMatch[1]);
  }

  const deleteMatch = path.match(/^\/scenarios\/([^\/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    return handleDeleteScenario(req, res, deleteMatch[1]);
  }

  sendJson(res, 404, { error: 'Not found' });
}

module.exports = { scenariosRouter };
