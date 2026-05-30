// ============================================
// Omnichannel Margin Calculator API
// POST /api/omnichannel-calculator
// Body: { user_id, menu_item_id, platform_id, direct_cac, direct_delivery_fee, monthly_ad_budget }
// Returns: platform vs direct margin comparison
// ============================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase environment variables missing' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const {
    user_id,
    menu_item_id,
    platform_id,
    direct_cac = 5,           // تكلفة استحواذ العميل (ريال)
    direct_delivery_fee = 15, // تكلفة توصيل ذاتية
    monthly_ad_budget = 3000  // ميزانية إعلانات شهرية
  } = req.body || {};

  if (!user_id || !menu_item_id || !platform_id) {
    res.status(400).json({ error: 'Missing user_id, menu_item_id, or platform_id' });
    return;
  }

  try {
    // Fetch menu item
    const { data: item, error: itemErr } = await supabase
      .from('menu_items').select('*').eq('id', menu_item_id).eq('user_id', user_id).single();
    if (itemErr || !item) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    // Fetch platform
    const { data: plat, error: platErr } = await supabase
      .from('platforms').select('*').eq('id', platform_id).eq('user_id', user_id).single();
    if (platErr || !plat) {
      res.status(404).json({ error: 'Platform not found' });
      return;
    }

    const price = item.base_price;

    // PLATFORM SCENARIO
    const platCommission = price * (plat.commission_rate || 0) / 100;
    const platService = price * (plat.service_fee_rate || 0) / 100;
    const platGateway = price * (plat.payment_gateway_fee || 0) / 100;
    const platDelivery = plat.delivery_fee || 0;
    const platTotalCost = platCommission + platService + platGateway + platDelivery;
    const platNet = price - platTotalCost;
    const platMargin = price > 0 ? (platNet / price) * 100 : 0;

    // DIRECT SCENARIO
    const directGateway = price * 0.0175; // بوابة الدفع ~1.75%
    const directTotalCost = direct_cac + direct_delivery_fee + directGateway;
    const directNet = price - directTotalCost;
    const directMargin = price > 0 ? (directNet / price) * 100 : 0;

    // BREAK-EVEN ANALYSIS
    const savingsPerOrder = platNet - directNet; // سالب = توفير
    const ordersToBreakEvenAd = (monthly_ad_budget / (platTotalCost - directTotalCost)).toFixed(0);

    // MAX CAC before platform becomes cheaper
    const maxCAC = platTotalCost - direct_delivery_fee - directGateway;

    res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        item_price: price,
        platform: {
          name: plat.name,
          commission: platCommission.toFixed(2),
          service_fee: platService.toFixed(2),
          gateway_fee: platGateway.toFixed(2),
          delivery_fee: platDelivery.toFixed(2),
          total_cost: platTotalCost.toFixed(2),
          net_revenue: platNet.toFixed(2),
          margin_pct: platMargin.toFixed(2)
        },
        direct: {
          cac: direct_cac.toFixed(2),
          delivery_fee: direct_delivery_fee.toFixed(2),
          gateway_fee: directGateway.toFixed(2),
          total_cost: directTotalCost.toFixed(2),
          net_revenue: directNet.toFixed(2),
          margin_pct: directMargin.toFixed(2)
        },
        comparison: {
          savings_per_order: (platTotalCost - directTotalCost).toFixed(2),
          margin_lift_pct: (directMargin - platMargin).toFixed(2),
          break_even_orders_for_ad_budget: parseInt(ordersToBreakEvenAd),
          max_profitable_cac: maxCAC.toFixed(2),
          verdict: directNet > platNet
            ? `البيع المباشر أوفر بـ ${(directNet - platNet).toFixed(2)} ر.س للطلبة الواحدة`
            : `المنصة أوفر حالياً بـ ${(platNet - directNet).toFixed(2)} ر.س للطلبة الواحدة`
        }
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
