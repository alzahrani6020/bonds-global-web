/**
 * Social Publish API
 * POST /api/social-publish
 * Body: { platforms: ['instagram','x'], text, mediaUrl, mediaType }
 * Admin endpoint to publish a post to selected social platforms.
 */

const getSupabase = require('../lib/api/supabase');
const { setCors } = require('../lib/api/cors');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const { publishToPlatforms, normalizePlatforms } = require('../lib/social');

const MAX_TEXT_LENGTH = 2000;

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function isValidUrl(value) {
  if (!value) return true; // optional
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

async function checkAuth(req, supabase) {
  return verifyAdminOrEditor(req, supabase);
}

module.exports = async function handler(req, res) {
  setCors(res, req, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });

  if (await checkRateLimit('strict', req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return sendJson(res, 401, { success: false, error: 'Unauthorized' });

  const supabase = getSupabase();
  const auth = await checkAuth(req, supabase);
  if (!auth.authorized) {
    const status = auth.reason === 'forbidden' ? 403 : 401;
    return sendJson(res, status, { success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
  }

  const body = req.body || {};
  const platforms = normalizePlatforms(body.platforms);
  if (!platforms.length) {
    return sendJson(res, 400, { success: false, error: 'platforms is required' });
  }

  const text = String(body.text || '').trim();
  if (!text) {
    return sendJson(res, 400, { success: false, error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return sendJson(res, 400, { success: false, error: `text must be ≤ ${MAX_TEXT_LENGTH} characters` });
  }

  const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : undefined;
  if (mediaUrl && !isValidUrl(mediaUrl)) {
    return sendJson(res, 400, { success: false, error: 'mediaUrl must be a valid http(s) URL' });
  }

  const mediaType = String(body.mediaType || 'image').toLowerCase();
  if (!['image', 'video'].includes(mediaType)) {
    return sendJson(res, 400, { success: false, error: 'mediaType must be image or video' });
  }

  try {
    const result = await publishToPlatforms(platforms, { text, mediaUrl, mediaType });
    const statusCode = result.success ? 200 : 207;
    return sendJson(res, statusCode, { success: result.success, results: result.results });
  } catch (err) {
    console.error('[SocialPublish] error:', err.message);
    return sendJson(res, 500, { success: false, error: 'Failed to publish post' });
  }
};
