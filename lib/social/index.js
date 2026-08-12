/**
 * Bonds Social — Provider factory and unified feed/publish dispatcher.
 */

const instagram = require('./instagram');
const youtube = require('./youtube');
const x = require('./x');
const cache = require('./cache');

const PROVIDERS = { instagram, youtube, x };
const PLATFORM_LABELS = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
};

function normalizePlatforms(input) {
  if (!input) return [];
  if (input === '*' || input === 'all') return Object.keys(PROVIDERS);
  if (Array.isArray(input)) return input.map(p => p.toLowerCase().trim()).filter(p => PROVIDERS[p]);
  if (typeof input === 'string') return input.split(',').map(p => p.toLowerCase().trim()).filter(p => PROVIDERS[p]);
  return [];
}

function clampLimit(limit) {
  const n = parseInt(limit, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 6;
}

async function fetchLatestPosts(platforms, limit = 6) {
  const list = normalizePlatforms(platforms);
  if (list.length === 0) return { success: true, posts: [] };

  const cacheKey = cache.getCacheKey(list.join(',') + ':' + limit);
  const cached = cache.getCached(cacheKey);
  if (cached) return { success: true, posts: cached, cached: true };

  const results = await Promise.all(list.map(async platform => {
    const provider = PROVIDERS[platform];
    try {
      return await provider.fetchLatestPosts(limit);
    } catch (err) {
      console.error(`[Social] ${platform} fetch error:`, err.message);
      return { success: false, posts: [], error: err.message };
    }
  }));

  const posts = results
    .flatMap(r => (r.success ? r.posts : []))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, clampLimit(limit));

  if (posts.length > 0) {
    cache.setCached(cacheKey, posts);
    cache.savePosts(posts).catch(() => {});
  }

  const errors = results
    .map((r, i) => ({ platform: list[i], error: r.error }))
    .filter(r => r.error);

  return { success: true, posts, errors: errors.length ? errors : undefined };
}

function isReadConfigured(provider) {
  if (typeof provider.isConfigured === 'function') return provider.isConfigured();
  if (typeof provider.isConfiguredForRead === 'function') return provider.isConfiguredForRead();
  return false;
}

function isPublishConfigured(provider) {
  if (typeof provider.isConfiguredForPublish === 'function') return provider.isConfiguredForPublish();
  return isReadConfigured(provider);
}

async function getAccountStatus() {
  return Object.entries(PROVIDERS).map(([key, provider]) => ({
    platform: key,
    label: PLATFORM_LABELS[key],
    readConfigured: isReadConfigured(provider),
    publishConfigured: isPublishConfigured(provider),
  }));
}

async function testPlatform(platform) {
  const provider = PROVIDERS[platform.toLowerCase()];
  if (!provider) return { platform, ok: false, error: 'Unknown platform' };
  return { platform, ...(await provider.testConnection()) };
}

async function publishToPlatforms(platforms, payload) {
  const list = normalizePlatforms(platforms);
  const results = await Promise.all(list.map(async platform => {
    const provider = PROVIDERS[platform];
    if (!provider) return { platform, success: false, error: 'Unknown platform' };
    try {
      return { platform, ...(await provider.publishPost(payload)) };
    } catch (err) {
      return { platform, success: false, error: err.message };
    }
  }));
  const success = results.some(r => r.success);
  return { success, results };
}

module.exports = {
  PROVIDERS,
  PLATFORM_LABELS,
  normalizePlatforms,
  fetchLatestPosts,
  getAccountStatus,
  testPlatform,
  publishToPlatforms,
};
