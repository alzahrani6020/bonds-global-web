/**
 * Omnichannel Calculator API
 * Compares selling through a delivery platform vs direct sales.
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
    const { menu_item_id, platform_id, direct_cac, direct_delivery_fee, monthly_ad_budget } = body;

    if (!menu_item_id || !platform_id || typeof direct_cac !== 'number' || typeof direct_delivery_fee !== 'number' || typeof monthly_ad_budget !== 'number') {
      return res.status(400).json({ success: false, error: 'menu_item_id, platform_id, direct_cac, direct_delivery_fee, and monthly_ad_budget are required' });
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

    // Fetch ingredient costs
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
      console.warn('[omnichannel-calculator] Could not load ingredient costs:', ingErr.message);
    }

    const itemPrice = parseFloat(item.base_price) || 0;

    // Platform channel calculations
    const commissionRate = parseFloat(platform.commission_rate) || 0;
    const serviceFeeRate = parseFloat(platform.service_fee_rate) || 0;
    const gatewayFeeRate = parseFloat(platform.payment_gateway_fee) || 0;

    const platformCommission = itemPrice * (commissionRate / 100);
    const platformServiceFee = itemPrice * (serviceFeeRate / 100);
    const platformGatewayFee = itemPrice * (gatewayFeeRate / 100);
    const platformDeliveryFee = parseFloat(platform.delivery_fee) || parseFloat(direct_delivery_fee) || 0;
    const platformTotalFees = platformCommission + platformServiceFee + platformGatewayFee;
    const platformNetRevenue = itemPrice - ingredientCost - platformTotalFees - platformDeliveryFee;

    // Direct channel calculations (assumes customer pays delivery fee, business pays CAC + ad share)
    const directAdCostPerOrder = monthly_ad_budget / 100; // rough estimate per 100 orders
    const directTotalCost = ingredientCost + direct_cac + direct_delivery_fee + directAdCostPerOrder;
    const directNetRevenue = itemPrice - directTotalCost;

    const diff = directNetRevenue - platformNetRevenue;
    const betterChannel = diff > 0 ? 'direct' : 'platform';
    const recommendation = diff > 0
      ? `البيع المباشر أفضل بمقدار ${Math.abs(diff).toFixed(2)} ر.س لكل قطعة`
      : `المنصة أفضل بمقدار ${Math.abs(diff).toFixed(2)} ر.س لكل قطعة`;

    return res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        item_price: parseFloat(itemPrice.toFixed(2)),
        ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
        platform: {
          name: platform.name,
          commission: parseFloat(platformCommission.toFixed(2)),
          service_fee: parseFloat(platformServiceFee.toFixed(2)),
          gateway_fee: parseFloat(platformGatewayFee.toFixed(2)),
          delivery_fee: parseFloat(platformDeliveryFee.toFixed(2)),
          net_revenue: parseFloat(platformNetRevenue.toFixed(2))
        },
        direct: {
          cac: parseFloat(direct_cac.toFixed(2)),
          delivery_fee: parseFloat(direct_delivery_fee.toFixed(2)),
          ad_cost_per_order: parseFloat(directAdCostPerOrder.toFixed(2)),
          net_revenue: parseFloat(directNetRevenue.toFixed(2))
        },
        comparison: {
          difference: parseFloat(diff.toFixed(2)),
          better_channel: betterChannel,
          recommendation
        }
      }
    });
  } catch (err) {
    console.error('[omnichannel-calculator] Error:', err);
    return res.status(500).json({ success: false, error: 'Calculation failed' });
  }
}

module.exports = withRateLimit('auth', handler);
