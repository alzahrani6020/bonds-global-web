/**
 * Log Usage API
 * Records calculator usage for analytics and usage limits.
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
    const { user_id, calculator, country, inputs, results } = req.body || {};
    if (!calculator) return res.status(400).json({ error: 'calculator required' });

    const supabase = getSupabase();
    const { error } = await supabase.from('usage_logs').insert([{
      user_id: user_id || null,
      calculator,
      country: country || null,
      inputs: inputs || null,
      results: results || null,
    }]);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[log-usage] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log usage' });
  }
}

module.exports = withRateLimit('public', handler);
