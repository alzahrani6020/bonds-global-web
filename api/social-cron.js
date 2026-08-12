/**
 * Social Cron API
 * GET /api/social-cron?cronSecret=...
 * Publishes scheduled posts that are due.
 */

const getSupabase = require('../lib/api/supabase');
const { setCors } = require('../lib/api/cors');
const { publishToPlatforms } = require('../lib/social');

const BATCH_LIMIT = 10;

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function verifyCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.query?.cronSecret || req.headers['x-cron-secret'];
  return provided === secret;
}

module.exports = async function handler(req, res) {
  setCors(res, req, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  if (!verifyCron(req)) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const results = [];

  try {
    const { data: duePosts, error } = await supabase
      .from('social_scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw error;

    for (const post of duePosts || []) {
      const payload = {
        text: post.content,
        mediaUrl: post.media_url,
        mediaType: post.media_type,
      };
      try {
        const pub = await publishToPlatforms(post.platforms, payload);
        const allSucceeded = pub.results.every(r => r.success);
        const status = allSucceeded ? 'published' : 'failed';
        await supabase
          .from('social_scheduled_posts')
          .update({ status, published_at: new Date().toISOString(), results: pub.results })
          .eq('id', post.id);
        results.push({ id: post.id, status, results: pub.results });
      } catch (err) {
        await supabase
          .from('social_scheduled_posts')
          .update({ status: 'failed', published_at: new Date().toISOString(), results: { error: err.message } })
          .eq('id', post.id);
        results.push({ id: post.id, status: 'failed', error: err.message });
      }
    }

    return sendJson(res, 200, { success: true, processed: results.length, results });
  } catch (err) {
    console.error('[SocialCron] error:', err.message);
    return sendJson(res, 500, { success: false, error: 'Cron failed' });
  }
};
