/**
 * Depreciation Factors API
 *
 * GET  /api/depreciation-factors?assetClass=xxx — fetch one or all records
 * POST /api/depreciation-factors — create/update a record (admin/editor only)
 */
const { getSupabase } = require('../lib/api/supabase');

const ALLOWED_ROLES = ['admin', 'editor'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { assetClass } = req.query || {};
    let query = supabase
      .from('depreciation_factors')
      .select('*')
      .order('asset_class', { ascending: true });

    if (assetClass) {
      query = query.eq('asset_class', assetClass);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
    // Verify authenticated user with admin/editor role
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const userId = userData.user.id;
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ALLOWED_ROLES);

    if (roleError || !roles || roles.length === 0) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const body = req.body || {};
    const {
      assetClass,
      nameAr,
      nameEn,
      factors,
      methods,
      notes
    } = body;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const payload = {
      asset_class: assetClass,
      name_ar: nameAr || null,
      name_en: nameEn || null,
      factors: factors || {},
      methods: methods || {},
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('depreciation_factors')
      .upsert(payload, { onConflict: 'asset_class' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
