/**
 * Funding Sources Directory API
 * GET  /api/funding-sources            — list active sources (public)
 * POST /api/funding-sources            — create source (admin)
 * PUT  /api/funding-sources?id=<uuid>  — update source (admin)
 * DELETE /api/funding-sources?id=<uuid> — delete source (admin)
 */

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearer } = require('../lib/api/auth-helper');

const VALID_TYPES = ['bank', 'fund', 'investor', 'government_program'];

async function isAdmin(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('admin_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['super_admin', 'admin'])
    .single();
  return !!data;
}

async function listSources(req, res) {
  const sb = getSupabase();
  const {
    country_code,
    type,
    sector,
    search,
    limit = '50',
    offset = '0'
  } = req.query || {};

  let query = sb.from('funding_sources').select('*').eq('is_active', true);

  if (country_code) query = query.eq('country_code', country_code.toUpperCase());
  if (type) query = query.eq('type', type);
  if (sector) query = query.ilike('sector', `%${sector}%`);
  if (search) {
    query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const maxLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const skip = Math.max(parseInt(offset, 10) || 0, 0);

  query = query.order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true })
    .range(skip, skip + maxLimit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('[funding-sources] list error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data: data || [], count });
}

async function createSource(req, res) {
  const body = req.body || {};
  if (!VALID_TYPES.includes(body.type)) {
    return res.status(400).json({ error: 'Invalid or missing type' });
  }
  if (!body.name_ar) {
    return res.status(400).json({ error: 'name_ar is required' });
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('funding_sources').insert([body]).select().single();
  if (error) {
    console.error('[funding-sources] create error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(201).json({ data });
}

async function updateSource(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id query param required' });

  const body = req.body || {};
  const sb = getSupabase();
  const { data, error } = await sb.from('funding_sources').update(body).eq('id', id).select().single();
  if (error) {
    console.error('[funding-sources] update error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ data });
}

async function deleteSource(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id query param required' });

  const sb = getSupabase();
  const { error } = await sb.from('funding_sources').delete().eq('id', id);
  if (error) {
    console.error('[funding-sources] delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ success: true });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return listSources(req, res);

  // Mutations require admin auth
  let user;
  try {
    user = await verifyBearer(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const admin = await isAdmin(user.id);
  if (!admin) return res.status(403).json({ error: 'Admin required' });

  if (req.method === 'POST') return createSource(req, res);
  if (req.method === 'PUT') return updateSource(req, res);
  if (req.method === 'DELETE') return deleteSource(req, res);

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = withRateLimit('public', handler);
