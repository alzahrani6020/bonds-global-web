/**
 * Social API handlers — unified dispatch for all /api/social-* endpoints.
 *
 * This module is consumed by the V3 router (api/v3/index.js) so the social
 * endpoints do not each count as a separate Vercel Serverless Function.
 */

const path = require('path');
const getSupabase = require('../api/supabase');
const { setCors } = require('../api/cors');
const { checkRateLimit } = require('../api/rate-limit');
const { verifyAdminOrEditor } = require('../api/admin-auth');
const {
  fetchLatestPosts,
  getAccountStatus,
  testPlatform,
  normalizePlatforms,
  publishToPlatforms,
} = require('./index');
const config = require('./config');

function sendJson(res, status, body) {
  res.status(status).json(body);
}

/* ---------- Feed ---------- */
const MAX_LIMIT = 20;
const ALLOWED_PLATFORMS = ['instagram', 'youtube', 'x', 'all'];

function parseLimit(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_LIMIT) : 6;
}

function parsePlatforms(raw) {
  if (!raw || raw === 'all') return ['all'];
  const list = String(raw)
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(p => ALLOWED_PLATFORMS.includes(p));
  return list.length ? list : ['all'];
}

async function handleFeed(req, res) {
  setCors(res, req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return sendJson(res, 405, { success: false, error: 'Method not allowed' });

  if (await checkRateLimit('public', req, res)) return;

  if (process.env.SOCIAL_FEED_ENABLED !== 'true') {
    return sendJson(res, 200, { success: true, posts: [], disabled: true });
  }

  const { limit, platforms } = req.query || {};
  const parsedLimit = parseLimit(limit);
  const platformList = parsePlatforms(platforms);

  try {
    const result = await fetchLatestPosts(platformList.join(','), parsedLimit);
    return sendJson(res, 200, result);
  } catch (err) {
    console.error('[SocialFeed] error:', err.message);
    return sendJson(res, 500, { success: false, error: 'Failed to load social feed' });
  }
}

/* ---------- Accounts ---------- */
async function checkAuth(req, supabase) {
  return verifyAdminOrEditor(req, supabase);
}

async function handleAccounts(req, res) {
  setCors(res, req, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (await checkRateLimit('auth', req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return sendJson(res, 401, { success: false, error: 'Unauthorized' });

  const supabase = getSupabase();
  const auth = await checkAuth(req, supabase);
  if (!auth.authorized) {
    const status = auth.reason === 'forbidden' ? 403 : 401;
    return sendJson(res, status, { success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const accounts = await getAccountStatus();
      return sendJson(res, 200, { success: true, accounts });
    } catch (err) {
      console.error('[SocialAccounts] status error:', err.message);
      return sendJson(res, 500, { success: false, error: 'Failed to read account status' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '').toLowerCase().trim();
    if (action === 'test') {
      const platform = String(body.platform || '').toLowerCase().trim();
      if (!normalizePlatforms(platform).length) {
        return sendJson(res, 400, { success: false, error: 'platform is required' });
      }
      try {
        const result = await testPlatform(platform);
        return sendJson(res, 200, { success: result.ok, result });
      } catch (err) {
        console.error('[SocialAccounts] test error:', err.message);
        return sendJson(res, 500, { success: false, error: 'Failed to test platform connection' });
      }
    }
    return sendJson(res, 400, { success: false, error: 'action is required' });
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

/* ---------- Publish ---------- */
const MAX_TEXT_LENGTH = 2000;

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

async function handlePublish(req, res) {
  setCors(res, req, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });

  if (await checkRateLimit('strict', req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return sendJson(res, 401, { success: false, error: 'Unauthorized' });

  const supabase = getSupabase();
  const auth = await verifyAdminOrEditor(req, supabase);
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
}

/* ---------- Schedule ---------- */
function isFutureDate(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

async function handleSchedule(req, res) {
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
}

/* ---------- Upload ---------- */
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
];
const MAX_BYTES = config.upload.maxBytes;

function sanitizeFilename(name) {
  const base = String(name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const ext = path.extname(base) || '.bin';
  const stem = path.basename(base, ext) || 'file';
  return `${stem}_${Date.now()}${ext}`;
}

async function handleUpload(req, res) {
  setCors(res, req, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });

  if (await checkRateLimit('strict', req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return sendJson(res, 401, { success: false, error: 'Unauthorized' });

  const supabase = getSupabase();
  const auth = await verifyAdminOrEditor(req, supabase);
  if (!auth.authorized) {
    const status = auth.reason === 'forbidden' ? 403 : 401;
    return sendJson(res, status, { success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
  }

  const body = req.body || {};
  const filename = sanitizeFilename(body.filename);
  const contentType = String(body.contentType || '').toLowerCase();
  const base64 = String(body.base64 || '');

  if (!ALLOWED_TYPES.includes(contentType)) {
    return sendJson(res, 400, { success: false, error: 'Unsupported content type' });
  }
  if (!base64) {
    return sendJson(res, 400, { success: false, error: 'base64 data is required' });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid base64 data' });
  }
  if (buffer.length > MAX_BYTES) {
    return sendJson(res, 400, { success: false, error: `File exceeds ${MAX_BYTES} bytes limit` });
  }

  try {
    const storagePath = `${auth.userId || 'admin'}/${filename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(config.upload.bucket)
      .upload(storagePath, buffer, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(config.upload.bucket).getPublicUrl(storagePath);
    return sendJson(res, 200, {
      success: true,
      url: urlData?.publicUrl || '',
      path: storagePath,
    });
  } catch (err) {
    console.error('[SocialUpload] error:', err.message);
    return sendJson(res, 500, { success: false, error: 'Upload failed' });
  }
}

/* ---------- Cron ---------- */
const BATCH_LIMIT = 10;

function verifyCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.query?.cronSecret || req.headers['x-cron-secret'];
  return provided === secret;
}

async function handleCron(req, res) {
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
}

/* ---------- Dispatch ---------- */
module.exports = async function socialHandler(req, res, route) {
  switch (route) {
    case 'social-feed': return handleFeed(req, res);
    case 'social-accounts': return handleAccounts(req, res);
    case 'social-publish': return handlePublish(req, res);
    case 'social-schedule': return handleSchedule(req, res);
    case 'social-upload': return handleUpload(req, res);
    case 'social-cron': return handleCron(req, res);
    default: return sendJson(res, 404, { success: false, error: 'Not found' });
  }
};
