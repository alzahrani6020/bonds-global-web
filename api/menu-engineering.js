// ============================================
// Menu Engineering Matrix API
// GET /api/menu-engineering?user_id=xxx
// Returns: Stars (النجوم), Engine (المحرك), Treasure (المكنوز), Stalled (المتعثرة)
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
      // 1. Aggregate sales by menu_item
      const { data: salesAgg, error: sErr } = await supabase
        .from('sales_transactions')
        .select('menu_item_id, quantity, unit_price, net_revenue')
        .eq('user_id', user_id);

      if (sErr) throw sErr;

      // Group by menu_item
      const byItem = {};
      for (const s of (salesAgg || [])) {
        const key = s.menu_item_id;
        if (!byItem[key]) byItem[key] = { total_sales: 0, total_revenue: 0, total_net: 0 };
        byItem[key].total_sales += s.quantity;
        byItem[key].total_revenue += (s.quantity * s.unit_price);
        byItem[key].total_net += (s.net_revenue || s.quantity * s.unit_price);
      }

      // 2. Fetch menu items
      const menuItemIds = Object.keys(byItem);
      let menuMap = {};
      if (menuItemIds.length > 0) {
        const { data: menuData } = await supabase.from('menu_items').select('id, name, base_price').in('id', menuItemIds);
        for (const m of (menuData || [])) menuMap[m.id] = m;
      }

      // 3. Fetch real costs from ingredients
      let costMap = {};
      if (menuItemIds.length > 0) {
        const { data: costData } = await supabase
          .from('menu_item_ingredients')
          .select('menu_item_id, cost_share')
          .in('menu_item_id', menuItemIds);
        for (const c of (costData || [])) {
          if (!costMap[c.menu_item_id]) costMap[c.menu_item_id] = 0;
          costMap[c.menu_item_id] += (c.cost_share || 0);
        }
      }

      // 4. Build scores with REAL costs
      const scores = [];
      for (const [mid, agg] of Object.entries(byItem)) {
        const menu = menuMap[mid] || {};
        const revenue = agg.total_revenue;
        const netRevenue = agg.total_net;
        const costPerUnit = costMap[mid] || (revenue * 0.35); // fallback 35% if no ingredients
        const totalCost = costPerUnit * agg.total_sales;
        const profit = netRevenue - totalCost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        scores.push({
          menu_item_id: mid,
          menu_item: menu,
          total_sales_count: agg.total_sales,
          total_revenue: revenue,
          total_net_revenue: netRevenue,
          total_cost: totalCost,
          gross_profit: profit,
          profit_margin_pct: margin,
          cost_per_unit: costPerUnit
        });
      }

      // 5. Classify
      const avgSales = scores.length ? scores.reduce((s, i) => s + i.total_sales_count, 0) / scores.length : 0;
      const avgProfit = scores.length ? scores.reduce((s, i) => s + i.gross_profit, 0) / scores.length : 0;

      for (const s of scores) {
        if (s.total_sales_count >= avgSales && s.gross_profit >= avgProfit) {
          s.category = 'star';
          s.recommendation = 'حافظ عليها ودعمها تسويقياً';
        } else if (s.total_sales_count >= avgSales && s.gross_profit < avgProfit) {
          s.category = 'engine';
          s.recommendation = 'قلل الكميات أو ارفع السعر 5%';
        } else if (s.total_sales_count < avgSales && s.gross_profit >= avgProfit) {
          s.category = 'treasure';
          s.recommendation = 'أعد تسميتها أو روج لها في التطبيقات';
        } else {
          s.category = 'stalled';
          s.recommendation = 'حذفها أو طورها فوراً';
        }
      }

      // 6. Build matrix with enhanced stats
      const totalRevenue = scores.reduce((s, i) => s + i.total_revenue, 0);
      const totalNet = scores.reduce((s, i) => s + i.total_net_revenue, 0);
      const totalCost = scores.reduce((s, i) => s + i.total_cost, 0);
      const totalProfit = scores.reduce((s, i) => s + i.gross_profit, 0);

      const matrix = {
        stars: scores.filter(i => i.category === 'star'),
        engines: scores.filter(i => i.category === 'engine'),
        treasures: scores.filter(i => i.category === 'treasure'),
        stalled: scores.filter(i => i.category === 'stalled'),
        unclassified: [],
        summary: {
          total_items: scores.length,
          total_revenue: totalRevenue.toFixed(2),
          total_net_revenue: totalNet.toFixed(2),
          total_cost: totalCost.toFixed(2),
          total_profit: totalProfit.toFixed(2),
          avg_margin: scores.length ? (scores.reduce((s, i) => s + i.profit_margin_pct, 0) / scores.length).toFixed(2) : 0,
          platform_fees: (totalRevenue - totalNet).toFixed(2)
        }
      };

      res.status(200).json({ success: true, data: matrix });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // POST: Record a new sale
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
      res.status(200).json({ success: true, message: 'Sale recorded' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
