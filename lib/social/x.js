/**
 * Bonds Social — X / Twitter provider.
 * Read uses X API v2 Bearer token; publish uses OAuth 1.0a user context.
 */

const crypto = require('crypto');
const config = require('./config');
const { transformX } = require('./transform');

const API_BASE = 'https://api.twitter.com/2';
const WEB_BASE = config.urls.x;

function isConfiguredForRead() {
  return !!(config.x.bearerToken && (config.x.userId || config.x.username));
}

function isConfiguredForPublish() {
  return !!(config.x.apiKey && config.x.apiSecret && config.x.accessToken && config.x.accessTokenSecret);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.errors?.[0]?.message || `X API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

let cachedUserId = null;

async function resolveUserId() {
  if (config.x.userId) return config.x.userId;
  if (cachedUserId) return cachedUserId;
  if (!config.x.username) throw new Error('X_USERNAME or X_USER_ID required');
  const url = `${API_BASE}/users/by/username/${encodeURIComponent(config.x.username)}`;
  const json = await apiFetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.x.bearerToken}` },
    signal: AbortSignal.timeout(8000),
  });
  cachedUserId = json?.data?.id;
  return cachedUserId;
}

function buildMediaMap(json) {
  const map = new Map();
  const mediaArr = json?.includes?.media || [];
  for (const m of mediaArr) map.set(m.media_key, m);
  return map;
}

async function fetchLatestPosts(limit = 6) {
  if (!isConfiguredForRead()) {
    return { success: false, posts: [], error: 'X read credentials not configured' };
  }
  try {
    const userId = await resolveUserId();
    if (!userId) throw new Error('Could not resolve X user id');
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,entities',
      expansions: 'attachments.media_keys',
      'media.fields': 'url,preview_image_url,width,height',
      max_results: String(Math.min(limit, 25)),
    });
    const url = `${API_BASE}/users/${encodeURIComponent(userId)}/tweets?${params.toString()}`;
    const json = await apiFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.x.bearerToken}` },
      signal: AbortSignal.timeout(8000),
    });
    const mediaMap = buildMediaMap(json);
    const items = Array.isArray(json.data) ? json.data : [];
    const posts = items.map(tweet => {
      const media = (tweet.attachments?.media_keys || []).map(key => mediaMap.get(key) || { media_key: key });
      return transformX({ ...tweet, media }, config.x.username);
    });
    return { success: true, posts, raw: json };
  } catch (err) {
    console.error('[X] fetchLatestPosts error:', err.message);
    return { success: false, posts: [], error: err.message };
  }
}

async function testConnection() {
  if (!isConfiguredForRead()) return { ok: false, error: 'Missing X_BEARER_TOKEN and X_USERNAME/X_USER_ID' };
  try {
    await resolveUserId();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* OAuth 1.0a helpers for publishing */

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

function oauthSignatureBaseString(method, baseUrl, params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  return `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(sorted)}`;
}

function hmacSha1(key, text) {
  return crypto.createHmac('sha1', key).update(text).digest('base64');
}

function oauth1Header(method, url, bodyParams, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const parsed = new URL(url);
  const baseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
    ...bodyParams,
  };
  if (method.toUpperCase() === 'GET') {
    parsed.searchParams.forEach((value, key) => { params[key] = value; });
  }
  const baseString = oauthSignatureBaseString(method, baseUrl, params);
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  params.oauth_signature = hmacSha1(signingKey, baseString);
  return 'OAuth ' + Object.keys(params)
    .filter(k => k.startsWith('oauth_'))
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(', ');
}

async function publishPost(payload = {}) {
  if (!isConfiguredForPublish()) {
    return { success: false, error: 'X OAuth credentials not configured' };
  }
  const { text } = payload;
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'text is required for X publishing' };
  }
  try {
    const url = `${API_BASE}/tweets`;
    const body = { text: text.slice(0, 280) };
    const authHeader = oauth1Header('POST', url, {}, config.x.apiKey, config.x.apiSecret, config.x.accessToken, config.x.accessTokenSecret);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.detail || json?.errors?.[0]?.message || `X API error ${res.status}`;
      throw new Error(msg);
    }
    const id = json?.data?.id;
    return { success: true, id, permalink: id ? `${WEB_BASE}/${config.x.username || 'i'}/status/${id}` : '' };
  } catch (err) {
    console.error('[X] publishPost error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  isConfiguredForRead,
  isConfiguredForPublish,
  fetchLatestPosts,
  publishPost,
  testConnection,
};
