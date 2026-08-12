/**
 * Social Schedule API
 * GET  /api/social-schedule        — list scheduled posts (admin)
 * POST /api/social-schedule        — schedule a post (admin)
 * DELETE /api/social-schedule?id=  — cancel a pending post (admin)
 */

const getSupabase = require('../lib/api/supabase');
const { setCors } = require('../lib/api/cors');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const { normalizePlatforms } = require('../lib/social');

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function isFutureDate(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

module.exports = async function handler(req, res) {
  setCors(res, req, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (await checkRateLimit('auth', req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return sendJson(res, 401, { success: false, error: 'Unauthorized' });

  const supabase = getSupabase();
  const auth = await verifyAdminOrEditor(req, supabase);
  if (!auth.authorized) {
    const status = auth.reason === 'forbidden' ? 403 : 401;
    return sendJson(res, status, { success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('social_scheduled_posts')
        .select('*')
        .order('scheduled_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return sendJson(res, 200, { success: true, posts: data || [] });
    } catch (err) {
      console.error('[SocialSchedule] list error:', err.message);
      return sendJson(res, 500, { success: false, error: 'Failed to list scheduled posts' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const platforms = normalizePlatforms(body.platforms);
    if (!platforms.length) {
      return sendJson(res, 400, { success: false, error: 'platforms is required' });
    }
    const content = String(body.content || '').trim();
    if (!content) {
      return sendJson(res, 400, { success: false, error: 'content is required' });
    }
    if (content.length > 2000) {
      return sendJson(res, 400, { success: false, error: 'content must be ≤ 2000 characters' });
    }
    if (!isFutureDate(body.scheduledAt)) {
      return sendJson(res, 400, { success: false, error: 'scheduledAt must be a future ISO date' });
    }
    const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : null;
    const mediaType = String(body.mediaType || 'image').toLowerCase();
    if (!['image', 'video'].includes(mediaType)) {
      return sendJson(res, 400, { success: false, error: 'mediaType must be image or video' });
    }
    try {
      const { data, error } = await supabase
        .from('social_scheduled_posts')
        .insert({
          platforms,
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          scheduled_at: body.scheduledAt,
          created_by: auth.userId,
        })
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 200, { success: true, post: data });
    } catch (err) {
      console.error('[SocialSchedule] insert error:', err.message);
      return sendJson(res, 500, { success: false, error: 'Failed to schedule post' });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) return sendJson(res, 400, { success: false, error: 'id is required' });
    try {
      const { error } = await supabase
        .from('social_scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
      return sendJson(res, 200, { success: true });
    } catch (err) {
      console.error('[SocialSchedule] cancel error:', err.message);
      return sendJson(res, 500, { success: false, error: 'Failed to cancel scheduled post' });
    }
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
};
