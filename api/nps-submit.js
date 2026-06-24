// ============================================
// NPS Survey Submission
// POST /api/nps-submit
// Body: { surveyId, score, feedback }
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { surveyId, score, feedback } = req.body || {};
    if (!surveyId || score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ success: false, error: 'Invalid survey or score' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.from('nps_surveys').update({
      score: Number(score),
      feedback: feedback ? String(feedback).slice(0, 2000) : null,
      status: 'responded',
      responded_at: new Date().toISOString()
    }).eq('id', surveyId).eq('status', 'sent').select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found or already responded' });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[nps-submit] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit' });
  }
}

module.exports = withRateLimit('public', handler);
