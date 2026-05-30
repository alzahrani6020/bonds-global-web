// ============================================
// Platform Break-Even Analysis API
// POST /api/platform-break-even
// Body: { user_id, fixed_costs, menu_item_id, target_profit? }
// Returns: break-even units for each platform
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
  const { user_id, fixed_costs, menu_item_id, target_profit = 0 } = req.body || {};

  if (!user_id || fixed_costs === undefined) {
    res.status(400).json({ error: 'Missing user_id or fixed_costs' });
    return;
  }

  try {
    // Fetch user platforms
    const { data: platforms, error: pErr } = await supabase
      .from('platforms')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (pErr) throw pErr;

    // Fetch menu item cost if specified
    let itemCost = 0;
    let itemPrice = 0;
    if (menu_item_id) {
      const { data: item, error: iErr } = await supabase
        .from('menu_items')
        .select('base_price')
        .eq('id', menu_item_id)
        .single();
      if (!iErr && item) itemPrice = item.base_price;

      const { data: ings, error: ingErr } = await supabase
        .from('menu_item_ingredients')
        .select('cost_share')
        .eq('menu_item_id', menu_item_id);
      if (!ingErr && ings) itemCost = ings.reduce((s, i) => s + (i.cost_share || 0), 0);
    }

    // Calculate break-even for each platform
    const results = platforms.map(p => {
      const commission = p.commission_rate || 0;
      const serviceFee = p.service_fee_rate || 0;
      const gatewayFee = p.payment_gateway_fee || 0;
      const deliveryFee = p.delivery_fee || 0;

      // Effective margin per unit after all deductions
      const totalDeductionPct = commission + serviceFee + gatewayFee;
      const netPerUnit = itemPrice > 0
        ? (itemPrice * (1 - totalDeductionPct / 100)) - deliveryFee - itemCost
        : 0;

      const breakEvenUnits = netPerUnit > 0
        ? Math.ceil((fixed_costs + target_profit) / netPerUnit)
        : Infinity;

      return {
        platform_id: p.id,
        platform_name: p.name,
        platform_code: p.code,
        commission_rate: commission,
        service_fee_rate: serviceFee,
        payment_gateway_fee: gatewayFee,
        delivery_fee: deliveryFee,
        item_cost: itemCost,
        item_price: itemPrice,
        net_revenue_per_unit: netPerUnit.toFixed(2),
        fixed_costs: fixed_costs,
        target_profit: target_profit,
        break_even_units: breakEvenUnits === Infinity ? null : breakEvenUnits,
        break_even_formula: `(${fixed_costs} + ${target_profit}) / ${netPerUnit.toFixed(2)} = ${breakEvenUnits === Infinity ? '∞' : breakEvenUnits} units`
      };
    });

    // Sort by break-even (easiest first)
    results.sort((a, b) => (a.break_even_units || Infinity) - (b.break_even_units || Infinity));

    res.status(200).json({
      success: true,
      data: results,
      best_platform: results[0] || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
