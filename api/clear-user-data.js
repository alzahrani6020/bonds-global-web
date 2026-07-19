/**
 * Clear all user-generated data for the authenticated user.
 * Currently clears menu-engineering related tables.
 */

const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { setAllowedOrigin } = require('../lib/api/cors');

module.exports = async function handler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('strict', req, res)) return;

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const supabase = getSupabase();
    const userId = user.id;

    // Tables scoped to menu-engineering user data
    const tables = [
      'sales_transactions',
      'menu_item_ingredients',
      'menu_items',
      'menu_ingredients',
      'platforms'
    ];

    const results = {};
    let anyError = null;
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      results[table] = error ? { error: error.message } : { deleted: true };
      if (error && !anyError) {
        anyError = `Failed to clear ${table}: ${error.message}`;
        console.error(`[clear-user-data] Failed to clear ${table}:`, error);
      }
    }

    if (anyError) {
      return res.status(500).json({ success: false, error: anyError, cleared: results });
    }
    res.status(200).json({ success: true, cleared: results });
  } catch (err) {
    console.error('[clear-user-data] Error:', err);
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message || 'Failed to clear user data' });
  }
};