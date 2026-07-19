/**
 * Economic Life Database API
 *
 * GET  /api/economic-life?assetClass=xxx — fetch one or all records
 * POST /api/economic-life — create/update a record (admin/editor only)
 */
const getSupabase = require('../lib/api/supabase');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const { setAllowedOrigin } = require('../lib/api/cors');

const ALLOWED_ROLES = ['admin', 'editor'];

function cors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  cors(res, req);
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
    const auth = await verifyAdminOrEditor(req, supabase);
    if (!auth.authorized) {
      const status = auth.reason === 'forbidden' ? 403 : 401;
      return res.status(status).json({ success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
    }

    const body = req.body || {};
    const assetClass = body.assetClass || body.asset_class;
    const nameAr = body.nameAr || body.name_ar;
    const nameEn = body.nameEn || body.name_en;
    const economicLifeYears = body.economicLifeYears || body.economic_life_years;
    const accountingLifeYears = body.accountingLifeYears || body.accounting_life_years;
    const technicalLifeYears = body.technicalLifeYears || body.technical_life_years;
    const designLifeYears = body.designLifeYears || body.design_life_years;
    const operationalLifeYears = body.operationalLifeYears || body.operational_life_years;
    const minLifeYears = body.minLifeYears || body.min_life_years;
    const maxLifeYears = body.maxLifeYears || body.max_life_years;
    const source = body.source;
    const notes = body.notes;

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
    if (body.updated_by) upsertData.updated_by = body.updated_by;

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