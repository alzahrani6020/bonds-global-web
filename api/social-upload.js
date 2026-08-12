/**
 * Social Media Upload API
 * POST /api/social-upload
 * Body: { filename, contentType, base64 }
 * Uploads a base64 file to Supabase Storage and returns a public URL.
 * Requires admin Bearer token.
 */

const path = require('path');
const getSupabase = require('../lib/api/supabase');
const { setCors } = require('../lib/api/cors');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const config = require('../lib/social/config');

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
];
const MAX_BYTES = config.upload.maxBytes;

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function sanitizeFilename(name) {
  const base = String(name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const ext = path.extname(base) || '.bin';
  const stem = path.basename(base, ext) || 'file';
  return `${stem}_${Date.now()}${ext}`;
}

module.exports = async function handler(req, res) {
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
};
