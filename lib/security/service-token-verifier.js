'use strict';

const tokenContract = require('../../services/bonds_token_runtime/contract.json');
const DEFAULT_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_MS = 10000;

function getIntrospectionUrl() {
  return String(process.env.BONDS_TOKEN_INTROSPECTION_URL || '').trim();
}

function unavailable(code) {
  return { ok: false, code, httpStatus: 503 };
}

function resolveRuntimeIdentityExpectation(expectedBuildCommit = process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT) {
  const buildCommit = typeof expectedBuildCommit === 'string' ? expectedBuildCommit.trim() : '';
  if (!buildCommit) return unavailable('TOKEN_RUNTIME_BUILD_UNCONFIGURED');
  if (!/^[0-9a-f]{40}$/.test(buildCommit) ||
      (process.env.BONDS_TOKEN_ISSUER && process.env.BONDS_TOKEN_ISSUER !== tokenContract.issuer)) {
    return unavailable('TOKEN_RUNTIME_INVALID_CONFIGURATION');
  }
  return { ok: true, buildCommit };
}

function matchesRuntimeIdentity(payload, expectedBuildCommit) {
  const base = Boolean(
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    payload.status === 'ok' &&
    payload.service === tokenContract.issuer &&
    payload.issuer === tokenContract.issuer &&
    payload.contract_version === tokenContract.contractVersion &&
    payload.schema_version === tokenContract.schemaVersion &&
    payload.service_token_ttl_seconds === tokenContract.serviceTokenTtlSeconds &&
    payload.build_commit === expectedBuildCommit &&
    payload.channel_auth === 'required'
  );
  if (!base) return false;

  if (tokenContract.broker) {
    return (
      payload.broker_auth === tokenContract.broker.auth &&
      payload.broker_mode === tokenContract.broker.mode
    );
  }
  return true;
}

// The channel credential is server configuration. Neither the user's
// Authorization header nor the inspected service token supplies it.
function resolveTokenRuntimeChannel({
  url = getIntrospectionUrl(),
  path = '/introspect',
  channelSecret = process.env.BONDS_TOKEN_CHANNEL_SECRET
} = {}) {
  if (!url) return unavailable('TOKEN_VERIFIER_UNCONFIGURED');

  let target;
  try {
    target = new URL(url);
    const localLoopbackHttp =
      String(process.env.BONDS_TOKEN_ALLOW_LOCAL_HTTP || '').trim() === '1' &&
      String(process.env.VERCEL_ENV || '').trim().toLowerCase() !== 'production' &&
      target.protocol === 'http:' &&
      target.hostname === '127.0.0.1' &&
      target.port === '8771';

    if ((!localLoopbackHttp && target.protocol !== 'https:') || target.username || target.password ||
        target.search || target.hash || target.pathname !== path ||
        !['/health', '/introspect'].includes(path)) {
      return unavailable('TOKEN_VERIFIER_INVALID_CONFIGURATION');
    }
  } catch (_) {
    return unavailable('TOKEN_VERIFIER_INVALID_CONFIGURATION');
  }

  const secret = typeof channelSecret === 'string' ? channelSecret.trim() : '';
  if (!secret) return unavailable('TOKEN_CHANNEL_UNCONFIGURED');
  if (!/^[\x21-\x7e]{32,4096}$/.test(secret) || secret.startsWith('bonds_') ||
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret)) {
    return unavailable('TOKEN_CHANNEL_INVALID_CONFIGURATION');
  }

  return {
    ok: true,
    url: target.toString(),
    origin: target.origin,
    headers: { accept: 'application/json', 'X-Bonds-Channel': secret }
  };
}

async function requestTokenRuntime({
  channel,
  method = 'POST',
  body,
  fetchImpl = global.fetch,
  timeoutMs = Number(process.env.BONDS_TOKEN_INTROSPECTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
}) {
  if (!channel?.ok) return channel || unavailable('TOKEN_CHANNEL_UNCONFIGURED');
  if (typeof fetchImpl !== 'function') return unavailable('TOKEN_VERIFIER_UNAVAILABLE');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    return unavailable('TOKEN_VERIFIER_INVALID_CONFIGURATION');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(channel.url, {
      method,
      headers: {
        ...channel.headers,
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store'
    });
    if (response.redirected || !response.ok) {
      return unavailable([401, 403].includes(response.status)
        ? 'TOKEN_CHANNEL_REJECTED'
        : 'TOKEN_INTROSPECTION_FAILED');
    }
    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return unavailable('TOKEN_RUNTIME_INVALID_RESPONSE');
    }
    return { ok: true, payload };
  } catch (_) {
    return unavailable('TOKEN_INTROSPECTION_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

function readIntrospectionClaims(payload) {
  const claims = payload?.claims;
  if (!claims || typeof claims !== 'object' || Array.isArray(claims) ||
      typeof claims.active !== 'boolean') return null;
  return claims;
}

async function introspectServiceToken({
  token,
  fetchImpl = global.fetch,
  url = getIntrospectionUrl(),
  channelSecret = process.env.BONDS_TOKEN_CHANNEL_SECRET,
  expectedBuildCommit = process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT,
  timeoutMs = Number(process.env.BONDS_TOKEN_INTROSPECTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
} = {}) {
  if (typeof token !== 'string' || !token.trim()) {
    return { verified: false, code: 'TOKEN_MISSING', httpStatus: 403 };
  }

  const channel = resolveTokenRuntimeChannel({ url, channelSecret });
  if (!channel.ok) return { verified: false, code: channel.code, httpStatus: channel.httpStatus };
  if (channel.ok && channel.headers['X-Bonds-Channel'] === token) {
    return { verified: false, code: 'TOKEN_CREDENTIALS_NOT_SEPARATE', httpStatus: 503 };
  }
  const identity = resolveRuntimeIdentityExpectation(expectedBuildCommit);
  if (!identity.ok) return { verified: false, code: identity.code, httpStatus: identity.httpStatus };
  const response = await requestTokenRuntime({ channel, body: { token }, fetchImpl, timeoutMs });
  if (!response.ok) {
    return { verified: false, code: response.code, httpStatus: response.httpStatus };
  }

  if (!matchesRuntimeIdentity(response.payload.runtime, identity.buildCommit)) {
    return { verified: false, code: 'TOKEN_RUNTIME_CONTRACT_MISMATCH', httpStatus: 503 };
  }

  const claims = readIntrospectionClaims(response.payload);
  if (!claims) return { verified: false, code: 'TOKEN_RUNTIME_INVALID_RESPONSE', httpStatus: 503 };
  if (!claims.active || claims.revoked === true) {
    return { verified: false, code: 'TOKEN_INACTIVE', httpStatus: 403 };
  }
  if (claims.revoked !== false) {
    return { verified: false, code: 'TOKEN_RUNTIME_INVALID_RESPONSE', httpStatus: 503 };
  }
  if (claims.token_type !== 'service') {
    return { verified: false, code: 'TOKEN_TYPE_INVALID', httpStatus: 403 };
  }

  return { verified: true, code: null, claims };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  getIntrospectionUrl,
  resolveRuntimeIdentityExpectation,
  matchesRuntimeIdentity,
  resolveTokenRuntimeChannel,
  requestTokenRuntime,
  readIntrospectionClaims,
  introspectServiceToken
};
