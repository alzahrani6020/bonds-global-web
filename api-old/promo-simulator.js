// ============================================
// Promo Campaign ROI Simulator API
// POST /api/promo-simulator
// Body: { user_id, menu_item_id, platform_id, discount_pct, current_daily_sales, campaign_days? }
// Returns: required sales lift, new margin, break-even
// ============================================

const getSupabase = require('./lib/supabase');

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

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    res.status(500).json({ error: e.message });
    return;
  }
  const {
    user_id,
    menu_item_id,
    platform_id,
    discount_pct,
    current_daily_sales,
    campaign_days = 7
  } = req.body || {};

  if (!user_id || !menu_item_id || discount_pct === undefined || !current_daily_sales) {
    res.status(400).json({
      error: 'Missing required fields: user_id, menu_item_id, discount_pct, current_daily_sales'
    });
    return;
  }

  try {
    // Fetch menu item
    const { data: item, error: itemErr } = await supabase
      .from('menu_items')
      .select('base_price, name')
      .eq('id', menu_item_id)
      .eq('user_id', user_id)
      .single();

    if (itemErr || !item) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    // Fetch ingredients cost
    const { data: ings, error: ingErr } = await supabase
      .from('menu_item_ingredients')
      .select('cost_share')
      .eq('menu_item_id', menu_item_id);

    const itemCost = ingErr || !ings ? 0 : ings.reduce((s, i) => s + (i.cost_share || 0), 0);

    // Fetch platform fees
    let commission = 25; let serviceFee = 2; let gatewayFee = 1.75; let deliveryFee = 0;
    if (platform_id) {
      const { data: plat, error: platErr } = await supabase
        .from('platforms')
        .select('commission_rate, service_fee_rate, payment_gateway_fee, delivery_fee')
        .eq('id', platform_id)
        .single();
      if (!platErr && plat) {
        commission = plat.commission_rate || 0;
        serviceFee = plat.service_fee_rate || 0;
        gatewayFee = plat.payment_gateway_fee || 0;
        deliveryFee = plat.delivery_fee || 0;
      }
    }

    const originalPrice = item.base_price;
    const discountedPrice = originalPrice * (1 - discount_pct / 100);

    // Original scenario
    const originalTotalDeductionPct = commission + serviceFee + gatewayFee;
    const originalNetPerUnit = (originalPrice * (1 - originalTotalDeductionPct / 100)) - deliveryFee - itemCost;
    const originalDailyProfit = originalNetPerUnit * current_daily_sales;
    const originalMargin = originalPrice > 0 ? (originalNetPerUnit / originalPrice) * 100 : 0;

    // New scenario with discount
    const newNetPerUnit = (discountedPrice * (1 - originalTotalDeductionPct / 100)) - deliveryFee - itemCost;
    const newMargin = discountedPrice > 0 ? (newNetPerUnit / discountedPrice) * 100 : 0;

    // Required volume lift to maintain same profit
    let requiredSalesLift = 0;
    let requiredDailySales = 0;
    if (newNetPerUnit > 0) {
      requiredDailySales = Math.ceil(originalDailyProfit / newNetPerUnit);
      requiredSalesLift = ((requiredDailySales - current_daily_sales) / current_daily_sales) * 100;
    }

    const isProfitable = newNetPerUnit > 0 && requiredSalesLift < 200; // arbitrary sanity check

    // Save simulation
    await supabase.from('promo_campaigns').insert({
      user_id,
      name: `حملة خصم ${discount_pct}% - ${item.name}`,
      platform_id: platform_id || null,
      menu_item_id,
      discount_pct,
      target_sales_lift_pct: requiredSalesLift,
      campaign_days,
      original_margin: originalMargin,
      new_margin: newMargin,
      required_volume_lift: requiredSalesLift,
      break_even_daily_sales: requiredDailySales,
      is_profitable: isProfitable
    });

    res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        original_price: originalPrice,
        discounted_price: discountedPrice.toFixed(2),
        discount_pct: discount_pct,
        original_margin_pct: originalMargin.toFixed(2),
        new_margin_pct: newMargin.toFixed(2),
        original_daily_profit: originalDailyProfit.toFixed(2),
        current_daily_sales: current_daily_sales,
        required_daily_sales: requiredDailySales,
        required_sales_lift_pct: requiredSalesLift.toFixed(2),
        is_profitable: isProfitable,
        verdict: isProfitable
          ? `للحفاظ على نفس ربحك اليومي، يجب أن ترتفع مبيعاتك من ${current_daily_sales} إلى ${requiredDailySales} وجبة/يوم (+${requiredSalesLift.toFixed(0)}%)`
          : `هذا الخصم خطير. هامش ربحك الجديد ${newMargin.toFixed(1)}% قد لا يغطي تكاليفك. فكر في خصم أقل أو رفع السعر الأساسي.`
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
