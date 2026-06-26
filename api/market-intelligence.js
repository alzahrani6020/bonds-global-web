/**
 * Market Intelligence API
 *
 * GET  /api/market-intelligence?assetClass=&country=&city= — fetch market data
 * POST /api/market-intelligence — create/update a record (admin/editor only)
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
    const { assetClass, country, city } = req.query || {};
    let query = supabase
      .from('market_data')
      .select('*')
      .order('updated_at', { ascending: false });

    if (assetClass) query = query.eq('asset_class', assetClass);
    if (country) query = query.eq('country', country);
    if (city) query = query.eq('city', city);

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
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
      country,
      city,
      averageSellingPrice,
      averageBuyingPrice,
      transactionCount,
      supplyIndex,
      demandIndex,
      competitorCount,
      averageSaleSpeedDays,
      inflationRate,
      interestRate,
      economicGrowthRate,
      source,
      recordedAt
    } = body;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const safeNum = (v) => Number(v) || 0;
    const payload = {
      asset_class: assetClass,
      country: country || null,
      city: city || null,
      average_selling_price: safeNum(averageSellingPrice),
      average_buying_price: safeNum(averageBuyingPrice),
      transaction_count: safeNum(transactionCount),
      supply_index: safeNum(supplyIndex),
      demand_index: safeNum(demandIndex),
      competitor_count: safeNum(competitorCount),
      average_sale_speed_days: safeNum(averageSaleSpeedDays),
      inflation_rate: safeNum(inflationRate),
      interest_rate: safeNum(interestRate),
      economic_growth_rate: safeNum(economicGrowthRate),
      source: source || null,
      recorded_at: recordedAt || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('market_data')
      .upsert(payload, { onConflict: 'asset_class, country, city' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
