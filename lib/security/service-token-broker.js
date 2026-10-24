'use strict';

const tokenContract = require('../../services/bonds_token_runtime/contract.json');

const DEFAULT_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_MS = 10000;

function unavailable(code, httpStatus = 503) {
  return { ok: false, code, httpStatus };
}

function resolveBrokerChannel({
  issueUrl = process.env.BONDS_TOKEN_BROKER_URL,
  introspectionUrl = process.env.BONDS_TOKEN_INTROSPECTION_URL,
  brokerSecret = process.env.BONDS_TOKEN_BROKER_SECRET
} = {}) {
  const rawIssueUrl = String(issueUrl || '').trim();
  const rawIntrospectionUrl = String(introspectionUrl || '').trim();
  if (!rawIssueUrl || !rawIntrospectionUrl) {
    return unavailable('TOKEN_BROKER_UNCONFIGURED');
  }

  let issue;
  let introspection;
  try {
    issue = new URL(rawIssueUrl);
    introspection = new URL(rawIntrospectionUrl);
  } catch (_) {
    return unavailable('TOKEN_BROKER_INVALID_CONFIGURATION');
  }

  const localLoopbackHttp = target =>
    String(process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP || '').trim() === '1' &&
    String(process.env.VERCEL_ENV || '').trim().toLowerCase() !== 'production' &&
    target.protocol === 'http:' &&
    target.hostname === '127.0.0.1' &&
    target.port === '8771';

  const invalidUrl = target =>
    (!localLoopbackHttp(target) && target.protocol !== 'https:') ||
    target.username ||
    target.password ||
    target.search ||
    target.hash;

  if (
    invalidUrl(issue) ||
    invalidUrl(introspection) ||
    issue.pathname !== tokenContract.broker?.issuePath ||
    introspection.pathname !== '/introspect' ||
    issue.origin !== introspection.origin
  ) {
    return unavailable('TOKEN_BROKER_INVALID_CONFIGURATION');
  }

  const secret = typeof brokerSecret === 'string' ? brokerSecret.trim() : '';
  if (
    !/^[\x21-\x7e]{32,4096}$/.test(secret) ||
    secret.startsWith('bonds_') ||
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret)
  ) {
    return unavailable(secret ? 'TOKEN_BROKER_INVALID_CONFIGURATION' : 'TOKEN_BROKER_UNCONFIGURED');
  }

  return {
    ok: true,
    issueUrl: issue.toString(),
    revokeUrl: new URL(tokenContract.broker.revokePath, issue.origin).toString(),
    origin: issue.origin,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-Bonds-Broker': secret
    }
  };
}

async function requestBroker({
  url,
  channel,
  body,
  fetchImpl = global.fetch,
  timeoutMs = Number(process.env.BONDS_TOKEN_BROKER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
}) {
  if (!channel?.ok) return channel || unavailable('TOKEN_BROKER_UNCONFIGURED');
  if (typeof fetchImpl !== 'function') return unavailable('TOKEN_BROKER_UNAVAILABLE');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    return unavailable('TOKEN_BROKER_INVALID_CONFIGURATION');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: channel.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store'
    });

    if (response.redirected || !response.ok) {
      if ([401, 403].includes(response.status)) {
        return unavailable('TOKEN_BROKER_REJECTED');
      }
      return unavailable('TOKEN_BROKER_FAILED');
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return unavailable('TOKEN_BROKER_INVALID_RESPONSE');
    }

    return { ok: true, payload };
  } catch (_) {
    return unavailable('TOKEN_BROKER_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

async function issueBrokerServiceToken({
  audience,
  fetchImpl = global.fetch,
  issueUrl = process.env.BONDS_TOKEN_BROKER_URL,
  introspectionUrl = process.env.BONDS_TOKEN_INTROSPECTION_URL,
  brokerSecret = process.env.BONDS_TOKEN_BROKER_SECRET,
  timeoutMs
} = {}) {
  const serviceAudience = String(audience || '').trim();
  if (!serviceAudience) {
    return unavailable('TOKEN_BROKER_AUDIENCE_REQUIRED', 500);
  }

  const channel = resolveBrokerChannel({ issueUrl, introspectionUrl, brokerSecret });
  if (!channel.ok) return channel;

  const response = await requestBroker({
    url: channel.issueUrl,
    channel,
    body: { audience: serviceAudience },
    fetchImpl,
    timeoutMs
  });
  if (!response.ok) return response;

  const payload = response.payload;
  if (
    payload.status !== 'issued' ||
    payload.audience !== serviceAudience ||
    payload.one_time !== true ||
    typeof payload.token !== 'string' ||
    !payload.token.startsWith('bonds_') ||
    payload.token.length < 32
  ) {
    return unavailable('TOKEN_BROKER_INVALID_RESPONSE');
  }

  return {
    ok: true,
    token: payload.token,
    audience: serviceAudience,
    oneTime: true
  };
}

async function revokeBrokerServiceToken({
  token,
  fetchImpl = global.fetch,
  issueUrl = process.env.BONDS_TOKEN_BROKER_URL,
  introspectionUrl = process.env.BONDS_TOKEN_INTROSPECTION_URL,
  brokerSecret = process.env.BONDS_TOKEN_BROKER_SECRET,
  timeoutMs
} = {}) {
  if (typeof token !== 'string' || !token.startsWith('bonds_')) {
    return { ok: true, revoked: false };
  }

  const channel = resolveBrokerChannel({ issueUrl, introspectionUrl, brokerSecret });
  if (!channel.ok) return channel;

  const response = await requestBroker({
    url: channel.revokeUrl,
    channel,
    body: { token },
    fetchImpl,
    timeoutMs
  });
  if (!response.ok) return response;

  if (typeof response.payload.revoked !== 'boolean') {
    return unavailable('TOKEN_BROKER_INVALID_RESPONSE');
  }
  return { ok: true, revoked: response.payload.revoked };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  resolveBrokerChannel,
  issueBrokerServiceToken,
  revokeBrokerServiceToken
};
