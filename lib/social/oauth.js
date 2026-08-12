/**
 * Bonds Social — OAuth / token refresh helpers.
 */

const config = require('./config');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.error?.message || json?.error_description || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Refresh a Google OAuth2 access token using a refresh token.
 */
async function refreshGoogleAccessToken(refreshToken, clientId, clientSecret) {
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Missing Google refresh credentials');
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const json = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

/**
 * Refresh an Instagram long-lived token (60-day extension).
 * Requires app id/secret only if exchanging a short-lived token.
 * For extending an existing long-lived token, only the token is needed.
 */
async function refreshInstagramLongLivedToken(accessToken) {
  if (!accessToken) throw new Error('Missing Instagram access token');
  const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(config.instagram.appId)}&client_secret=${encodeURIComponent(config.instagram.appSecret)}&fb_exchange_token=${encodeURIComponent(accessToken)}`;
  const json = await fetchJson(url, { signal: AbortSignal.timeout(15000) });
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}

async function getYouTubeAccessToken() {
  const { accessToken, refreshToken, clientId, clientSecret } = config.youtube;
  if (accessToken) return accessToken;
  if (refreshToken && clientId && clientSecret) {
    const refreshed = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
    return refreshed.accessToken;
  }
  throw new Error('YouTube access token or refresh credentials not configured');
}

async function getInstagramAccessToken() {
  const { accessToken, appId, appSecret } = config.instagram;
  if (!accessToken) throw new Error('Instagram access token not configured');
  if (appId && appSecret) {
    try {
      const refreshed = await refreshInstagramLongLivedToken(accessToken);
      return refreshed.accessToken;
    } catch (err) {
      // Fall back to the existing token if refresh fails.
      console.warn('[SocialOAuth] Instagram token refresh failed:', err.message);
    }
  }
  return accessToken;
}

module.exports = {
  refreshGoogleAccessToken,
  refreshInstagramLongLivedToken,
  getYouTubeAccessToken,
  getInstagramAccessToken,
};
