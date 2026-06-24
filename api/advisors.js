// ============================================
// Advisors API dispatcher
// Routes by ?action=list|dashboard|update-review
// ============================================

const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { checkRateLimit } = require('../lib/api/rate-limit');

const ALLOWED_STATUSES = ['under_review', 'approved', 'returned'];

async function listAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('public', req, res)) return;

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

async function dashboardAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('auth', req, res)) return;

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

async function updateReviewAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('auth', req, res)) return;

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

async function handler(req, res) {
  const action = req.query?.action || req.body?.action;
  switch (action) {
    case 'list': return listAction(req, res);
    case 'dashboard': return dashboardAction(req, res);
    case 'update-review': return updateReviewAction(req, res);
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

module.exports = handler;
