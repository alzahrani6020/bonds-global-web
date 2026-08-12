/**
 * Bonds Social — Lightweight cache with optional Supabase persistence.
 */

const getSupabase = require('../api/supabase');

const memory = new Map();

function getTtlMs() {
  const env = process.env.SOCIAL_FEED_CACHE_TTL_SECONDS;
  const seconds = parseInt(env, 10);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 900) * 1000;
}

function getCacheKey(platformsKey) {
  return `social-feed:${platformsKey || 'all'}`;
}

function getCached(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  memory.set(key, { value, expiresAt: Date.now() + getTtlMs() });
}

async function loadFromDatabase(platforms, limit) {
  try {
    const sb = getSupabase();
    let query = sb
      .from('social_posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (platforms && platforms.length > 0) {
      query = query.in('platform', platforms);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(row => ({
      id: `${row.platform}_${row.external_id}`,
      platform: row.platform,
      type: row.platform === 'youtube' ? 'video' : row.platform === 'x' ? 'tweet' : 'image',
      title: row.content ? row.content.split(/\n|\./)[0].slice(0, 80) : '',
      excerpt: row.content || '',
      mediaUrl: row.media_url || '',
      permalink: row.permalink || '',
      publishedAt: row.published_at,
      cachedAt: row.fetched_at,
    }));
  } catch (e) {
    return [];
  }
}

async function savePosts(posts) {
  if (!posts || posts.length === 0) return;
  try {
    const sb = getSupabase();
    const rows = posts.map(p => ({
      platform: p.platform,
      external_id: String(p.id).replace(`${p.platform}_`, ''),
      content: p.excerpt || p.title || '',
      media_url: p.mediaUrl || '',
      permalink: p.permalink || '',
      published_at: p.publishedAt || new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    }));
    await sb.from('social_posts').upsert(rows, { onConflict: 'platform,external_id' });
  } catch (e) {
    // Non-blocking: cache failure should not break the feed.
    console.error('[SocialCache] savePosts failed:', e.message);
  }
}

module.exports = { getCached, setCached, loadFromDatabase, savePosts, getCacheKey };
