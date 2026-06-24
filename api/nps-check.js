// ============================================
// Check NPS Survey Validity
// GET /api/nps-check?id=<uuid>
// Returns { valid: boolean }
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ valid: false, error: 'Missing id' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('nps_surveys')
      .select('id, status')
      .eq('id', id)
      .in('status', ['sent', 'pending'])
      .single();

    if (error || !data) {
      return res.status(200).json({ valid: false });
    }

    res.status(200).json({ valid: true });
  } catch (err) {
    console.error('[nps-check] Error:', err);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
}

module.exports = withRateLimit('public', handler);
