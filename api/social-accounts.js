/**
 * Social Accounts API
 * GET  /api/social-accounts          — connection status (admin)
 * POST /api/social-accounts/test     — test a platform token (admin)
 */

const getSupabase = require('../lib/api/supabase');
const { setCors } = require('../lib/api/cors');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const { getAccountStatus, testPlatform, normalizePlatforms } = require('../lib/social');

function sendJson(res, status, body) {
  res.status(status).json(body);
}

async function checkAuth(req, supabase) {
  return verifyAdminOrEditor(req, supabase);
}

module.exports = async function handler(req, res) {
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
};
