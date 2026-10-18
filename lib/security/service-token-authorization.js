'use strict';

const DEFAULT_CLOCK_SKEW_SECONDS = 30;
const MAX_CLOCK_SKEW_SECONDS = 120;
const REQUIRED_CLAIMS = Object.freeze(['iss', 'aud', 'sub', 'exp', 'jti']);

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    return value.split(/\s+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function audienceMatches(actual, required) {
  if (!required) return true;
  const actualValues = Array.isArray(actual)
    ? actual.map(String)
    : [String(actual || '')];
  const requiredValues = Array.isArray(required)
    ? required.map(String)
    : [String(required)];
  return requiredValues.every(value => actualValues.includes(value));
}

function boundedClockSkewSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_CLOCK_SKEW_SECONDS;
  }
  return Math.min(Math.floor(parsed), MAX_CLOCK_SKEW_SECONDS);
}

function authorizeServiceToken({
  claims,
  policy = {},
  now = Math.floor(Date.now() / 1000)
} = {}) {
  if (!claims || typeof claims !== 'object') {
    return { allowed: false, code: 'TOKEN_MISSING' };
  }

  const missingClaims = REQUIRED_CLAIMS.filter(name => {
    const value = claims[name];
    return value === undefined || value === null || value === '';
  });

  if (missingClaims.length > 0) {
    return {
      allowed: false,
      code: 'TOKEN_REQUIRED_CLAIMS_MISSING',
      missingClaims
    };
  }

  if (claims.active !== true || claims.revoked === true) {
    return { allowed: false, code: 'TOKEN_INACTIVE' };
  }

  if (policy.issuer && claims.iss !== policy.issuer) {
    return { allowed: false, code: 'TOKEN_ISSUER_MISMATCH' };
  }

  if (policy.audience && !audienceMatches(claims.aud, policy.audience)) {
    return { allowed: false, code: 'TOKEN_AUDIENCE_MISMATCH' };
  }

  const skew = boundedClockSkewSeconds(policy.clockSkewSeconds);
  const exp = Number(claims.exp);

  if (!Number.isFinite(exp)) {
    return { allowed: false, code: 'TOKEN_EXP_INVALID' };
  }

  if (exp + skew <= now) {
    return { allowed: false, code: 'TOKEN_EXPIRED' };
  }

  if (claims.nbf !== undefined && claims.nbf !== null) {
    const nbf = Number(claims.nbf);

    if (!Number.isFinite(nbf)) {
      return { allowed: false, code: 'TOKEN_NBF_INVALID' };
    }

    if (nbf - skew > now) {
      return { allowed: false, code: 'TOKEN_NOT_YET_VALID' };
    }
  }

  if (Array.isArray(policy.allowedSubjects) && policy.allowedSubjects.length > 0) {
    if (!policy.allowedSubjects.includes(String(claims.sub))) {
      return { allowed: false, code: 'TOKEN_SUBJECT_MISMATCH' };
    }
  } else if (policy.subject && String(claims.sub) !== String(policy.subject)) {
    return { allowed: false, code: 'TOKEN_SUBJECT_MISMATCH' };
  } else if (policy.subjectPrefix) {
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
    subject: String(claims.sub),
    tokenId: String(claims.jti),
    scopes: grantedScopes
  };
}

module.exports = {
  DEFAULT_CLOCK_SKEW_SECONDS,
  MAX_CLOCK_SKEW_SECONDS,
  REQUIRED_CLAIMS,
  asArray,
  audienceMatches,
  boundedClockSkewSeconds,
  authorizeServiceToken
};
