// DELETE /api/clear-user-data
// Body: { user_id }
const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { user_id } = req.body || {};
  if (!user_id) { res.status(400).json({ error: 'Missing user_id' }); return; }

  const supabase = getSupabase();

  try {
    // Fetch menu item IDs once for dependent deletes
    const { data: menuItems } = await supabase.from('menu_items').select('id').eq('user_id', user_id);
    const menuIds = menuItems?.map(m => m.id) || [];

    // Parallel delete (respect foreign keys: children first)
    await Promise.all([
      supabase.from('sales_transactions').delete().eq('user_id', user_id),
      supabase.from('menu_engineering_scores').delete().eq('user_id', user_id),
      supabase.from('promo_campaigns').delete().eq('user_id', user_id),
      menuIds.length > 0 ? supabase.from('menu_platform_prices').delete().in('menu_item_id', menuIds) : Promise.resolve(),
      menuIds.length > 0 ? supabase.from('menu_item_ingredients').delete().in('menu_item_id', menuIds) : Promise.resolve(),
      supabase.from('menu_items').delete().eq('user_id', user_id),
      supabase.from('ingredients').delete().eq('user_id', user_id),
      supabase.from('platforms').delete().eq('user_id', user_id)
    ]);

    res.status(200).json({ success: true, message: 'All data cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
