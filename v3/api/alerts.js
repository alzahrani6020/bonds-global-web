/**
 * Bonds V3 — Alerts API
 *
 * Admin routes for managing alert rules and running evaluation.
 * Public routes for reading alerts.
 */

const { getSupabaseClient } = require('../lib/supabase');
const AlertEngine = require('../engine/AlertEngine');

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

function requireAdmin(req) {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { error: 'ADMIN_TOKEN not configured' };
  if (!token || token !== expected) return { error: 'Unauthorized' };
  return null;
}

function requireCronOrAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = req.headers['x-admin-token'];
  const expectedAdmin = process.env.ADMIN_TOKEN;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;
  if (expectedAdmin && adminToken && adminToken === expectedAdmin) return null;

  if (!cronSecret && !expectedAdmin) return { error: 'No cron or admin auth configured' };
  return { error: 'Unauthorized' };
}

// ===== Alert Rules =====

async function handleListRules(req, res) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*, city:city_id(name_ar), activity:activity_id(name_ar)')
    .order('created_at', { ascending: false });

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { rules: data || [] });
}

async function handleCreateRule(req, res) {
  const body = await parseBody(req);
  const {
    name, description, metric_code, entity_type,
    city_id, activity_id, threshold_type, threshold_value,
    severity, check_previous_year
  } = body;

  if (!name || !metric_code || !entity_type || !threshold_type || threshold_value === undefined || !severity) {
    return sendJson(res, 400, { error: 'Missing required fields' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('alert_rules')
    .insert({
      name, description, metric_code, entity_type,
      city_id, activity_id, threshold_type, threshold_value,
      severity, check_previous_year
    })
    .select()
    .single();

  if (error) return sendJson(res, 400, { error: error.message });
  sendJson(res, 201, { rule: data });
}

async function handleUpdateRule(req, res, id) {
  const body = await parseBody(req);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('alert_rules')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return sendJson(res, 400, { error: error.message });
  sendJson(res, 200, { rule: data });
}

async function handleDeleteRule(req, res, id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('alert_rules').delete().eq('id', id);
  if (error) return sendJson(res, 400, { error: error.message });
  sendJson(res, 200, { deleted: true });
}

// ===== Evaluate =====

async function handleEvaluate(req, res) {
  const body = await parseBody(req) || {};
  const supabase = getSupabaseClient();
  const engine = new AlertEngine(supabase);

  try {
    const alerts = await engine.evaluateAll({
      dryRun: body.dryRun === true,
      metricCodes: body.metricCodes || [],
      cityIds: body.cityIds || []
    });

    if (!body.dryRun && alerts.length) {
      await engine.sendNotifications(alerts);
    }

    sendJson(res, 200, { evaluated: alerts.length, alerts });
  } catch (err) {
    console.error('[alerts evaluate]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

// ===== Alerts =====

async function handleListAlerts(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const unreadOnly = url.searchParams.get('unread_only') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const cityId = url.searchParams.get('city');
  const activityId = url.searchParams.get('activity');

  const supabase = getSupabaseClient();
  let query = supabase
    .from('alerts')
    .select('*, city:city_id(name_ar), activity:activity_id(name_ar), rule:rule_id(name, description)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false);
  if (cityId) query = query.eq('city_id', cityId);
  if (activityId) query = query.eq('activity_id', activityId);

  const { data, error } = await query;
  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { alerts: data || [], count: data?.length || 0 });
}

async function handleMarkRead(req, res, id) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return sendJson(res, 400, { error: error.message });
  sendJson(res, 200, { alert: data });
}

async function alertsRouter(req, res, path) {
  // Admin routes
  if (path === '/admin/alert-rules' && req.method === 'GET') {
    const authError = requireAdmin(req);
    if (authError) return sendJson(res, 401, authError);
    return handleListRules(req, res);
  }
  if (path === '/admin/alert-rules' && req.method === 'POST') {
    const authError = requireAdmin(req);
    if (authError) return sendJson(res, 401, authError);
    return handleCreateRule(req, res);
  }

  const ruleUpdateMatch = path.match(/^\/admin\/alert-rules\/([^\/]+)$/);
  if (ruleUpdateMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
    const authError = requireAdmin(req);
    if (authError) return sendJson(res, 401, authError);
    return handleUpdateRule(req, res, ruleUpdateMatch[1]);
  }
  if (ruleUpdateMatch && req.method === 'DELETE') {
    const authError = requireAdmin(req);
    if (authError) return sendJson(res, 401, authError);
    return handleDeleteRule(req, res, ruleUpdateMatch[1]);
  }

  if (path === '/admin/alerts/evaluate' && req.method === 'POST') {
    const authError = requireCronOrAdmin(req);
    if (authError) return sendJson(res, 401, authError);
    return handleEvaluate(req, res);
  }

  // Public routes
  if (path === '/alerts' && req.method === 'GET') {
    return handleListAlerts(req, res);
  }

  const alertReadMatch = path.match(/^\/alerts\/([^\/]+)\/read$/);
  if (alertReadMatch) {
    return handleMarkRead(req, res, alertReadMatch[1]);
  }

  sendJson(res, 404, { error: 'Not found' });
}

module.exports = { alertsRouter };
