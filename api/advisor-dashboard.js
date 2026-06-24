// ============================================
// Advisor Dashboard Data
// GET /api/advisor-dashboard
// Authorization: Bearer <jwt>
// Returns assignments, stats, and earnings for the logged-in advisor
// ============================================

const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getSupabase();

    const { data: advisor, error: advisorError } = await supabase
      .from('advisors')
      .select('id, name, title, bio, status, commission_rate, is_public')
      .eq('user_id', user.id)
      .single();

    if (advisorError || !advisor) {
      return res.status(404).json({ error: 'Advisor profile not found' });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from('ai_review_requests')
      .select('id, status, note, preferred_by_client, created_at, updated_at, ai_requests!inner(id, type)')
      .eq('advisor_id', advisor.id)
      .order('created_at', { ascending: false });

    if (assignmentsError) throw assignmentsError;

    const { data: earnings, error: earningsError } = await supabase
      .from('advisor_earnings')
      .select('id, description, gross_amount, commission_amount, net_amount, status, paid_at, created_at')
      .eq('advisor_id', advisor.id)
      .order('created_at', { ascending: false });

    if (earningsError) throw earningsError;

    const pending = (assignments || []).filter(a => ['assigned', 'under_review'].includes(a.status)).length;
    const completed = (assignments || []).filter(a => a.status === 'approved').length;
    const totalEarnings = (earnings || []).reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0);
    const paidEarnings = (earnings || []).filter(e => e.status === 'paid').reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0);

    res.status(200).json({
      success: true,
      advisor,
      assignments: assignments || [],
      earnings: earnings || [],
      stats: { pending, completed, totalEarnings, paidEarnings }
    });
  } catch (err) {
    console.error('[advisor-dashboard] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
}

module.exports = withRateLimit('auth', handler);
