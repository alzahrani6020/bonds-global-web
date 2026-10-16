/**
 * Bonds Social — YouTube provider.
 * Uses the YouTube Data API v3.
 */

const config = require('./config');
const { getYouTubeAccessToken } = require('./oauth');
const { transformYouTube } = require('./transform');
const { fetchUrl } = require('../intelligence/web-acquisition');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const MAX_MULTIPART_BYTES = 16 * 1024 * 1024; // 16 MB

function isConfiguredForRead() {
  return !!(config.youtube.apiKey && config.youtube.channelId);
}

function isConfiguredForPublish() {
  return !!(config.youtube.accessToken || (config.youtube.refreshToken && config.youtube.clientId && config.youtube.clientSecret));
}

async function apiGet(path, signal) {
  const res = await fetch(`${YOUTUBE_API_BASE}${path}`, { method: 'GET', signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `YouTube API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function fetchLatestPosts(limit = 6) {
  if (!isConfiguredForRead()) {
    return { success: false, posts: [], error: 'YouTube credentials not configured' };
  }
  try {
    const path = `/search?part=snippet,id&channelId=${encodeURIComponent(config.youtube.channelId)}&type=video&order=date&maxResults=${Math.min(limit, 25)}&key=${encodeURIComponent(config.youtube.apiKey)}`;
    const json = await apiGet(path, AbortSignal.timeout(8000));
    const items = Array.isArray(json.items) ? json.items : [];
    return { success: true, posts: items.map(item => transformYouTube(item, config.youtube.channelId)), raw: json };
  } catch (err) {
    console.error('[YouTube] fetchLatestPosts error:', err.message);
    return { success: false, posts: [], error: err.message };
  }
}

async function testConnection() {
  if (!isConfiguredForRead()) return { ok: false, error: 'Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID' };
  try {
    const path = `/channels?part=id&id=${encodeURIComponent(config.youtube.channelId)}&maxResults=1&key=${encodeURIComponent(config.youtube.apiKey)}`;
    await apiGet(path, AbortSignal.timeout(8000));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function downloadMedia(url, maxBytes) {
  const result = await fetchUrl(url, {
    timeoutMs: 30000,
    maxBytes,
    maxRedirects: 5,
    allowPrivateNetworks: false,
    headers: { accept: 'video/*,application/octet-stream;q=0.9,*/*;q=0.1' }
  });
  if (!result.ok) {
    const reason = result.evidence?.blocked_reason || result.evidence?.failure_class || 'DOWNLOAD_FAILED';
    throw new Error(`Failed to download media safely: ${reason}`);
  }
  if (result.evidence?.failure_class === 'BODY_TRUNCATED') {
    throw new Error('Media file exceeds maximum allowed size');
  }
  return result.body;
}

function buildMultipartBody(metadata, fileBuffer, mimeType) {
  const boundary = 'bonds_yt_upload_' + Math.random().toString(36).slice(2);
  const crlf = '\r\n';
  const metadataPart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    '',
  ].join(crlf);
  const mediaPart = [
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
  ].join(crlf);
  const close = `${crlf}--${boundary}--${crlf}`;
  return {
    boundary,
    buffer: Buffer.concat([
      Buffer.from(metadataPart, 'utf8'),
      Buffer.from(mediaPart, 'utf8'),
      fileBuffer,
      Buffer.from(close, 'utf8'),
    ]),
  };
}

async function publishPost(payload = {}) {
  if (!isConfiguredForPublish()) {
    return { success: false, error: 'YouTube OAuth credentials not configured' };
  }
  const { text, mediaUrl, mediaType = 'video' } = payload;
  if (!text) {
    return { success: false, error: 'text (title) is required for YouTube publishing' };
  }
  if (!mediaUrl || mediaType !== 'video') {
    return { success: false, error: 'mediaUrl with a video is required for YouTube publishing' };
  }
  try {
    const accessToken = await getYouTubeAccessToken();
    const videoBuffer = await downloadMedia(mediaUrl, MAX_MULTIPART_BYTES);
    const metadata = {
      snippet: {
        title: text.slice(0, 100),
        description: text,
      },
      status: {
        privacyStatus: 'public',
      },
    };
    const { boundary, buffer } = buildMultipartBody(metadata, videoBuffer, 'video/mp4');
    const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: buffer,
      signal: AbortSignal.timeout(60000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `YouTube upload error ${res.status}`;
      throw new Error(msg);
    }
    const id = json.id;
    return { success: true, id, permalink: `https://www.youtube.com/watch?v=${id}` };
  } catch (err) {
    console.error('[YouTube] publishPost error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { isConfiguredForRead, isConfiguredForPublish, fetchLatestPosts, publishPost, testConnection };
