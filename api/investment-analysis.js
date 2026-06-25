/**
 * Investment Analysis API
 * Saves and retrieves user investment analyses from Supabase.
 */

const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('investment_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, analyses: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { sector, inputs, results, recommendation } = body;

      if (!sector) return res.status(400).json({ success: false, error: 'sector is required' });

      const { data, error } = await supabase
        .from('investment_analyses')
        .insert([{
          user_id: user.id,
          sector,
          inputs: inputs || {},
          results: results || {},
          recommendation: recommendation || {}
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, analysis: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[investment-analysis] Error:', err);
    return res.status(err.status || 500).json({ success: false, error: err.message || 'Failed' });
  }
}

module.exports = withRateLimit('auth', handler);
