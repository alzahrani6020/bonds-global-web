'use strict';

const DEFAULT_TIMEOUT_MS = 2000;

function getIntrospectionUrl() {
  return String(process.env.BONDS_TOKEN_INTROSPECTION_URL || '').trim();
}

async function introspectServiceToken({
  token,
  fetchImpl = global.fetch,
  url = getIntrospectionUrl(),
  timeoutMs = Number(process.env.BONDS_TOKEN_INTROSPECTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
} = {}) {
  if (!token || typeof token !== 'string') {
    return { verified: false, code: 'TOKEN_MISSING' };
  }

  if (!url) {
    return { verified: false, code: 'TOKEN_VERIFIER_UNCONFIGURED' };
  }

  if (typeof fetchImpl !== 'function') {
    return { verified: false, code: 'TOKEN_VERIFIER_UNAVAILABLE' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ token }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { verified: false, code: 'TOKEN_INTROSPECTION_FAILED' };
    }

    const payload = await response.json();
    const claims =
      payload && typeof payload.claims === 'object'
        ? payload.claims
        : payload;

    if (
      !claims ||
      typeof claims !== 'object' ||
      claims.active !== true ||
      claims.revoked === true
    ) {
      return { verified: false, code: 'TOKEN_INACTIVE' };
    }

    return {
      verified: true,
      code: null,
      claims: {
        ...claims,
        active: true
      }
    };
  } catch (_error) {
    return { verified: false, code: 'TOKEN_INTROSPECTION_FAILED' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  getIntrospectionUrl,
  introspectServiceToken
};
