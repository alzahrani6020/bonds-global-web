/**
 * Economic Life Database API
 *
 * GET  /api/economic-life?assetClass=xxx — fetch one or all records
 * POST /api/economic-life — create/update a record (admin/editor only)
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
      .from('economic_life_database')
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
      economicLifeYears,
      accountingLifeYears,
      technicalLifeYears,
      designLifeYears,
      operationalLifeYears,
      minLifeYears,
      maxLifeYears,
      source,
      notes
    } = body;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const upsertData = {
      asset_class: assetClass,
      name_ar: nameAr,
      name_en: nameEn,
      economic_life_years: Number(economicLifeYears) || 0,
      accounting_life_years: Number(accountingLifeYears) || 0,
      technical_life_years: Number(technicalLifeYears) || 0,
      design_life_years: Number(designLifeYears) || 0,
      operational_life_years: Number(operationalLifeYears) || 0,
      min_life_years: Number(minLifeYears) || 0,
      max_life_years: Number(maxLifeYears) || 0,
      source: source || 'BONDS Valuation Standards',
      notes: notes || '',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('economic_life_database')
      .upsert(upsertData, { onConflict: 'asset_class' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
