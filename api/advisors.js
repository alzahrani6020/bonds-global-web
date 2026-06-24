// ============================================
// Public Advisors Listing
// GET /api/advisors?status=approved
// Returns approved public advisors
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabase();
    const { data: advisors, error } = await supabase.from('advisors')
      .select('id, name, title, bio, avatar_url, specializations, languages, years_experience, certifications, commission_rate, hourly_rate, sort_order')
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, advisors: advisors || [] });
  } catch (err) {
    console.error('[advisors] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load advisors' });
  }
}

module.exports = withRateLimit('public', handler);
