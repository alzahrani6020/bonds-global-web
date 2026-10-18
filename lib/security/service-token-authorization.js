'use strict';

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    return value.split(/\s+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function audienceMatches(actual, required) {
  if (!required) return true;
  const actualValues = Array.isArray(actual) ? actual.map(String) : [String(actual || '')];
  const requiredValues = Array.isArray(required) ? required.map(String) : [String(required)];
  return requiredValues.every(value => actualValues.includes(value));
}

function authorizeServiceToken({
  claims,
  policy = {},
  now = Math.floor(Date.now() / 1000)
} = {}) {
  if (!claims || typeof claims !== 'object') {
    return { allowed: false, code: 'TOKEN_MISSING' };
  }

  if (claims.active === false || claims.revoked === true) {
    return { allowed: false, code: 'TOKEN_INACTIVE' };
  }

  if (policy.issuer && claims.iss !== policy.issuer) {
    return { allowed: false, code: 'TOKEN_ISSUER_MISMATCH' };
  }

  if (policy.audience && !audienceMatches(claims.aud, policy.audience)) {
    return { allowed: false, code: 'TOKEN_AUDIENCE_MISMATCH' };
  }

  if (claims.exp !== undefined && Number(claims.exp) <= now) {
    return { allowed: false, code: 'TOKEN_EXPIRED' };
  }

  if (claims.nbf !== undefined && Number(claims.nbf) > now) {
    return { allowed: false, code: 'TOKEN_NOT_YET_VALID' };
  }

  if (policy.subjectPrefix) {
    const subject = String(claims.sub || '');
    if (!subject.startsWith(policy.subjectPrefix)) {
      return { allowed: false, code: 'TOKEN_SUBJECT_MISMATCH' };
    }
  }

  const grantedScopes = asArray(claims.scope || claims.scopes);
  const requiredScopes = asArray(policy.scopes);
  const granted = new Set(grantedScopes);
  const missingScopes = requiredScopes.filter(scope => !granted.has(scope));

  if (missingScopes.length > 0) {
    return {
      allowed: false,
      code: 'TOKEN_SCOPE_DENIED',
      missingScopes
    };
  }

  return {
    allowed: true,
    code: null,
    subject: claims.sub || null,
    tokenId: claims.jti || null,
    scopes: grantedScopes
  };
}

module.exports = {
  asArray,
  audienceMatches,
  authorizeServiceToken
};
