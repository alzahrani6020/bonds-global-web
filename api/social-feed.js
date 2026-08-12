/**
 * Social Feed API
 * GET /api/social-feed?limit=6&platforms=instagram,youtube,x
 * Public endpoint returning the latest posts from configured social accounts.
 */

const { setCors } = require('../lib/api/cors');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { fetchLatestPosts } = require('../lib/social');

const MAX_LIMIT = 20;
const ALLOWED_PLATFORMS = ['instagram', 'youtube', 'x', 'all'];

function sendJson(res, status, body) {
  res.status(status).json(body);
}

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

module.exports = async function handler(req, res) {
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
};
