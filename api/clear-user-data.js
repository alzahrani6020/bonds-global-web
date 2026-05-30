// DELETE /api/clear-user-data
// Body: { user_id }
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { user_id } = req.body || {};
  if (!user_id) { res.status(400).json({ error: 'Missing user_id' }); return; }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Delete in correct order (respect foreign keys)
    await supabase.from('sales_transactions').delete().eq('user_id', user_id);
    await supabase.from('menu_engineering_scores').delete().eq('user_id', user_id);
    await supabase.from('promo_campaigns').delete().eq('user_id', user_id);
    await supabase.from('menu_platform_prices').delete().in('menu_item_id', 
      (await supabase.from('menu_items').select('id').eq('user_id', user_id)).data?.map(m => m.id) || []);
    await supabase.from('menu_item_ingredients').delete().in('menu_item_id',
      (await supabase.from('menu_items').select('id').eq('user_id', user_id)).data?.map(m => m.id) || []);
    await supabase.from('menu_items').delete().eq('user_id', user_id);
    await supabase.from('ingredients').delete().eq('user_id', user_id);
    await supabase.from('platforms').delete().eq('user_id', user_id);

    res.status(200).json({ success: true, message: 'All data cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
