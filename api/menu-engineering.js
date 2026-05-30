// ============================================
// Menu Engineering Matrix API
// GET /api/menu-engineering?user_id=xxx
// Returns: Stars, Plowhorses, Puzzles, Dogs
// ============================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase environment variables missing' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET: Return engineering matrix for a user
  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) {
      res.status(400).json({ error: 'Missing user_id' });
      return;
    }

    try {
      // Refresh scores first
      await supabase.rpc('refresh_engineering_scores', { p_user_id: user_id });

      // Fetch classified items with menu details
      const { data, error } = await supabase
        .from('menu_engineering_scores')
        .select(`
          *,
          menu_item:menu_item_id(name, name_en, category, base_price),
          platform:platform_id(name, commission_rate)
        `)
        .eq('user_id', user_id)
        .order('gross_profit', { ascending: false });

      if (error) throw error;

      // Group by category
      const matrix = {
        stars: data.filter(i => i.category === 'star'),
        plowhorses: data.filter(i => i.category === 'plowhorse'),
        puzzles: data.filter(i => i.category === 'puzzle'),
        dogs: data.filter(i => i.category === 'dog'),
        unclassified: data.filter(i => i.category === 'unclassified'),
        summary: {
          total_items: data.length,
          avg_margin: data.length ? (data.reduce((s, i) => s + (i.profit_margin_pct || 0), 0) / data.length).toFixed(2) : 0,
          total_profit: data.reduce((s, i) => s + (i.gross_profit || 0), 0).toFixed(2)
        }
      };

      res.status(200).json({ success: true, data: matrix });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // POST: Record a new sale and refresh scores
  if (req.method === 'POST') {
    const { user_id, menu_item_id, platform_id, quantity, unit_price, commission_deduction, service_fee_deduction, net_revenue } = req.body || {};

    if (!user_id || !menu_item_id || !quantity || !unit_price) {
      res.status(400).json({ error: 'Missing required fields: user_id, menu_item_id, quantity, unit_price' });
      return;
    }

    try {
      const { error } = await supabase.from('sales_transactions').insert({
        user_id,
        menu_item_id,
        platform_id: platform_id || null,
        quantity,
        unit_price,
        commission_deduction: commission_deduction || 0,
        service_fee_deduction: service_fee_deduction || 0,
        net_revenue: net_revenue || (quantity * unit_price - (commission_deduction || 0) - (service_fee_deduction || 0))
      });

      if (error) throw error;

      // Refresh engineering scores
      await supabase.rpc('refresh_engineering_scores', { p_user_id: user_id });

      res.status(200).json({ success: true, message: 'Sale recorded and scores refreshed' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
