'use strict';

const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function getConfig() {
  const propertyId = String(process.env.GA4_PROPERTY_ID || '').trim();
  const clientEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  return {
    configured: Boolean(propertyId && clientEmail && privateKey),
    propertyId,
    clientEmail,
    privateKey
  };
}

async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: config.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + claims;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(config.privateKey).toString('base64url');
  const assertion = unsigned + '.' + signature;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal: AbortSignal.timeout(10000)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error('GA4 OAuth token exchange failed: ' + (json.error_description || json.error || response.status));
  }
  return json.access_token;
}

async function gaRequest(config, endpoint, body) {
  const token = await getAccessToken(config);
  const url = DATA_BASE + '/properties/' + encodeURIComponent(config.propertyId) + ':' + endpoint;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || ('HTTP ' + response.status);
    throw new Error('GA4 Data API failed: ' + message);
  }
  return json;
}

function metric(row, index) {
  const value = row?.metricValues?.[index]?.value;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dim(row, index) {
  return row?.dimensionValues?.[index]?.value || '';
}

async function getGa4Overview() {
  const config = getConfig();
  if (!config.configured) {
    return {
      success: true,
      configured: false,
      status: 'not_configured',
      source: 'ga4',
      reason: 'GA4_PROPERTY_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are required',
      generatedAt: new Date().toISOString()
    };
  }

  try {
    const [today, realtime, acquisition, pages, geo, devices] = await Promise.all([
      gaRequest(config, 'runReport', {
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' },
          { name: 'engagedSessions' }, { name: 'averageSessionDuration' }
        ]
      }),
      gaRequest(config, 'runRealtimeReport', {
        metrics: [{ name: 'activeUsers' }]
      }),
      gaRequest(config, 'runReport', {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'engagedSessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }),
      gaRequest(config, 'runReport', {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 25
      }),
      gaRequest(config, 'runReport', {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 25
      }),
      gaRequest(config, 'runReport', {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10
      })
    ]);

    const t = today.rows?.[0];
    const rt = realtime.rows?.[0];
    return {
      success: true,
      configured: true,
      status: 'healthy',
      source: 'ga4',
      today: {
        activeUsers: metric(t, 0),
        newUsers: metric(t, 1),
        sessions: metric(t, 2),
        engagedSessions: metric(t, 3),
        averageSessionDurationSeconds: metric(t, 4)
      },
      realtime: { activeUsers: metric(rt, 0) },
      acquisition: (acquisition.rows || []).map(r => ({
        channel: dim(r, 0),
        sessions: metric(r, 0),
        activeUsers: metric(r, 1),
        engagedSessions: metric(r, 2)
      })),
      topPages: (pages.rows || []).map(r => ({
        path: dim(r, 0),
        title: dim(r, 1),
        views: metric(r, 0),
        activeUsers: metric(r, 1),
        engagementSeconds: metric(r, 2)
      })),
      geography: (geo.rows || []).map(r => ({
        country: dim(r, 0),
        city: dim(r, 1),
        activeUsers: metric(r, 0),
        sessions: metric(r, 1)
      })),
      devices: (devices.rows || []).map(r => ({
        device: dim(r, 0),
        activeUsers: metric(r, 0),
        sessions: metric(r, 1)
      })),
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: true,
      configured: true,
      status: 'degraded',
      source: 'ga4',
      error: String(error?.message || error).slice(0, 300),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { getConfig, getGa4Overview };
