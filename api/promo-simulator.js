/**
 * Promo Simulator API
 * Calculates the impact of a discount on a menu item sold via a delivery platform.
 */

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { user_id: bodyUserId, menu_item_id, platform_id, discount_pct, current_daily_sales } = body;

    if (!menu_item_id || !platform_id || typeof discount_pct !== 'number' || typeof current_daily_sales !== 'number') {
      return res.status(400).json({ success: false, error: 'menu_item_id, platform_id, discount_pct, and current_daily_sales are required' });
    }

    const supabase = getSupabase();

    // Fetch menu item
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', menu_item_id)
      .single();
    if (itemError || !item) return res.status(404).json({ success: false, error: 'Menu item not found' });

    // Fetch platform
    const { data: platform, error: platError } = await supabase
      .from('platforms')
      .select('*')
      .eq('id', platform_id)
      .single();
    if (platError || !platform) return res.status(404).json({ success: false, error: 'Platform not found' });

    // Fetch ingredient costs for this menu item
    let ingredientCost = 0;
    try {
      const { data: itemIngredients } = await supabase
        .from('menu_item_ingredients')
        .select('ingredient_id, quantity_needed')
        .eq('menu_item_id', menu_item_id);

      if (itemIngredients?.length) {
        const ingredientIds = itemIngredients.map(r => r.ingredient_id);
        const { data: prices } = await supabase
          .from('menu_ingredients')
          .select('id, current_price')
          .in('id', ingredientIds);

        const priceMap = new Map((prices || []).map(p => [p.id, p.current_price]));
        for (const row of itemIngredients) {
          const price = priceMap.get(row.ingredient_id) || 0;
          ingredientCost += (row.quantity_needed || 0) * price;
        }
      }
    } catch (ingErr) {
      console.warn('[promo-simulator] Could not load ingredient costs:', ingErr.message);
    }

    const originalPrice = parseFloat(item.base_price) || 0;
    const discountedPrice = originalPrice * (1 - discount_pct / 100);

    // Platform fees on the discounted price
    const commissionRate = parseFloat(platform.commission_rate) || 0;
    const serviceFeeRate = parseFloat(platform.service_fee_rate) || 0;
    const gatewayFeeRate = parseFloat(platform.payment_gateway_fee) || 0;

    const originalCommission = originalPrice * (commissionRate / 100);
    const originalServiceFee = originalPrice * (serviceFeeRate / 100);
    const originalGatewayFee = originalPrice * (gatewayFeeRate / 100);
    const originalPlatformFees = originalCommission + originalServiceFee + originalGatewayFee;
    const originalNet = originalPrice - ingredientCost - originalPlatformFees;
    const originalMarginPct = originalPrice > 0 ? (originalNet / originalPrice) * 100 : 0;

    const discountedCommission = discountedPrice * (commissionRate / 100);
    const discountedServiceFee = discountedPrice * (serviceFeeRate / 100);
    const discountedGatewayFee = discountedPrice * (gatewayFeeRate / 100);
    const discountedPlatformFees = discountedCommission + discountedServiceFee + discountedGatewayFee;
    const discountedNet = discountedPrice - ingredientCost - discountedPlatformFees;
    const newMarginPct = discountedPrice > 0 ? (discountedNet / discountedPrice) * 100 : 0;

    const isProfitable = discountedNet > 0;
    const dailyOriginalNet = originalNet * current_daily_sales;
    const dailyDiscountedNet = discountedNet * current_daily_sales;
    const dailyDifference = dailyDiscountedNet - dailyOriginalNet;

    let verdict;
    if (!isProfitable) {
      verdict = `⚠️ الخصم ${discount_pct}% يجعل الوجبة خاسرة بمقدار ${Math.abs(discountedNet).toFixed(2)} ر.س لكل قطعة`;
    } else if (dailyDifference >= 0) {
      verdict = `✅ الخصم مربح: زيادة يومية متوقعة بـ ${dailyDifference.toFixed(2)} ر.س`;
    } else {
      verdict = `⚠️ الخصم يقلل الربح اليومي بـ ${Math.abs(dailyDifference).toFixed(2)} ر.س`;
    }

    return res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        original_price: parseFloat(originalPrice.toFixed(2)),
        discounted_price: parseFloat(discountedPrice.toFixed(2)),
        ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
        original_margin_pct: parseFloat(originalMarginPct.toFixed(1)),
        new_margin_pct: parseFloat(newMarginPct.toFixed(1)),
        original_net_per_unit: parseFloat(originalNet.toFixed(2)),
        new_net_per_unit: parseFloat(discountedNet.toFixed(2)),
        daily_original_net: parseFloat(dailyOriginalNet.toFixed(2)),
        daily_discounted_net: parseFloat(dailyDiscountedNet.toFixed(2)),
        daily_difference: parseFloat(dailyDifference.toFixed(2)),
        is_profitable: isProfitable,
        verdict
      }
    });
  } catch (err) {
    console.error('[promo-simulator] Error:', err);
    return res.status(500).json({ success: false, error: 'Simulation failed' });
  }
}

module.exports = withRateLimit('auth', handler);
