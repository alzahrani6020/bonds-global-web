// ============================================
// Advisor Update Review Request
// POST /api/advisor-update-review
// Authorization: Bearer <jwt>
// Body: { reviewRequestId, status, notes? }
// Allowed statuses: under_review, approved, returned
// ============================================

const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { withRateLimit } = require('../lib/api/rate-limit');

const ALLOWED_STATUSES = ['under_review', 'approved', 'returned'];

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { reviewRequestId, status, notes } = req.body || {};
    if (!reviewRequestId || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const supabase = getSupabase();

    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!advisor) return res.status(404).json({ error: 'Advisor profile not found' });

    const update = {
      status,
      advisor_notes: notes ? String(notes).slice(0, 2000) : null,
      updated_at: new Date().toISOString()
    };
    if (status === 'approved') {
      update.completed_at = new Date().toISOString();
      update.reviewed_by = user.id;
    }

    const { data, error } = await supabase
      .from('ai_review_requests')
      .update(update)
      .eq('id', reviewRequestId)
      .eq('advisor_id', advisor.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Review request not found or not assigned to you' });

    res.status(200).json({ success: true, review: data });
  } catch (err) {
    console.error('[advisor-update-review] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
}

module.exports = withRateLimit('auth', handler);
