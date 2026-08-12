/**
 * Bonds Social — Instagram provider.
 * Uses the Instagram Graph API (Facebook Graph).
 */

const config = require('./config');
const { getInstagramAccessToken } = require('./oauth');
const { transformInstagram } = require('./transform');

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

function isConfigured() {
  return !!(config.instagram.accessToken && config.instagram.accountId);
}

async function graphApiGet(path, accessToken, signal) {
  const url = `${GRAPH_API_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { method: 'GET', signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Instagram API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function graphApiPost(path, body, accessToken, signal) {
  const url = `${GRAPH_API_BASE}${path}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) params.append(k, v);
  }
  params.append('access_token', accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Instagram API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function fetchLatestPosts(limit = 6) {
  if (!isConfigured()) {
    return { success: false, posts: [], error: 'Instagram credentials not configured' };
  }
  try {
    const token = await getInstagramAccessToken();
    const fields = 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count';
    const path = `/${encodeURIComponent(config.instagram.accountId)}/media?fields=${fields}&limit=${Math.min(limit, 25)}`;
    const json = await graphApiGet(path, token, AbortSignal.timeout(8000));
    const items = Array.isArray(json.data) ? json.data : [];
    return { success: true, posts: items.map(transformInstagram), raw: json };
  } catch (err) {
    console.error('[Instagram] fetchLatestPosts error:', err.message);
    return { success: false, posts: [], error: err.message };
  }
}

async function testConnection() {
  if (!isConfigured()) return { ok: false, error: 'Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID' };
  try {
    const token = await getInstagramAccessToken();
    const path = `/${encodeURIComponent(config.instagram.accountId)}?fields=id,username`;
    await graphApiGet(path, token, AbortSignal.timeout(8000));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function publishPost(payload = {}) {
  if (!isConfigured()) {
    return { success: false, error: 'Instagram credentials not configured' };
  }
  const { text, mediaUrl, mediaType = 'image' } = payload;
  if (!mediaUrl) {
    return { success: false, error: 'mediaUrl is required for Instagram publishing' };
  }
  try {
    const token = await getInstagramAccessToken();
    const createBody = {
      caption: text || '',
      [mediaType === 'video' ? 'video_url' : 'image_url']: mediaUrl,
      media_type: mediaType === 'video' ? 'VIDEO' : undefined,
    };
    const created = await graphApiPost(
      `/${encodeURIComponent(config.instagram.accountId)}/media`,
      createBody,
      token,
      AbortSignal.timeout(15000)
    );
    const creationId = created.id;
    if (!creationId) throw new Error('Instagram did not return a media container id');
    const published = await graphApiPost(
      `/${encodeURIComponent(config.instagram.accountId)}/media_publish`,
      { creation_id: creationId },
      token,
      AbortSignal.timeout(15000)
    );
    return { success: true, id: published.id, permalink: `https://instagram.com/p/${published.id}` };
  } catch (err) {
    console.error('[Instagram] publishPost error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { isConfigured, fetchLatestPosts, publishPost, testConnection };
