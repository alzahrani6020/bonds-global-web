'use strict';

const {
  asArray,
  authorizeServiceToken
} = require('../security/service-token-authorization');

const {
  getServiceTokenPolicy
} = require('../security/service-token-policies');

const {
  introspectServiceToken
} = require('../security/service-token-verifier');


class MemoryRateLimiter {
  constructor() {
    this.windows = new Map();
  }

  check(key, requestsPerMinute) {
    const now = Date.now();
    const minute = 60_000;

    let bucket = this.windows.get(key);

    if (!bucket || now - bucket.startedAt >= minute) {
      bucket = {
        startedAt: now,
        count: 0
      };

      this.windows.set(key, bucket);
    }

    if (bucket.count >= requestsPerMinute) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}


const defaultRateLimiter =
  new MemoryRateLimiter();


function arrayHasAll(actual, required) {
  const set = new Set(actual || []);

  return (required || []).every(
    value => set.has(value)
  );
}


async function evaluateGovernance({
  service,
  capability,
  context = {},
  rateLimiter = defaultRateLimiter,
  verifyServiceToken = introspectServiceToken
}) {

  if (!service || !service.enabled) {
    return {
      allowed: false,
      code: 'SERVICE_DISABLED'
    };
  }

  if (!capability || capability.active === false) {
    return {
      allowed: false,
      code: 'CAPABILITY_DISABLED'
    };
  }


  if (
    service.security
      .requestedSensitivePrivileges
      .length > 0
  ) {
    return {
      allowed: false,
      code: 'SENSITIVE_PRIVILEGE_NOT_APPROVED'
    };
  }


  const governance =
    context.governance || {};

  const serviceTokenRequired =
    service.security?.serviceTokenRequired === true ||
    governance.enforceServiceToken === true;

  let serviceTokenDecision = null;

  if (serviceTokenRequired) {
    const policy =
      getServiceTokenPolicy(
        service.serviceCode,
        capability.action
      );

    if (!policy) {
      return {
        allowed: false,
        code: 'TOKEN_POLICY_MISSING',
        httpStatus: 503
      };
    }

    const rawToken =
      context.auth?.serviceToken ||
      null;

    let verification;
    try {
      if (typeof verifyServiceToken !== 'function') {
        return { allowed: false, code: 'TOKEN_VERIFIER_UNAVAILABLE', httpStatus: 503 };
      }
      verification = await verifyServiceToken({ token: rawToken });
    } catch (_) {
      return { allowed: false, code: 'TOKEN_VERIFIER_UNAVAILABLE', httpStatus: 503 };
    }

    if (
      !verification ||
      verification.verified !== true ||
      !verification.claims
    ) {
      return {
        allowed: false,
        code:
          verification?.code ||
          'TOKEN_VERIFICATION_FAILED',
        httpStatus: verification?.httpStatus || (
          ['TOKEN_MISSING', 'TOKEN_INACTIVE', 'TOKEN_TYPE_INVALID']
            .includes(verification?.code) ? 403 : 503
        )
      };
    }

    serviceTokenDecision =
      authorizeServiceToken({
        claims: verification.claims,
        policy
      });

    if (!serviceTokenDecision.allowed) {
      const grantedScopes =
        asArray(
          verification.claims?.scope ||
          verification.claims?.scopes
        );

      const temporalCodes = new Set([
        'TOKEN_IAT_INVALID',
        'TOKEN_IAT_FUTURE',
        'TOKEN_TOO_OLD',
        'TOKEN_EXP_INVALID',
        'TOKEN_EXP_NOT_AFTER_IAT',
        'TOKEN_LIFETIME_EXCEEDED',
        'TOKEN_EXPIRED',
        'TOKEN_NBF_INVALID',
        'TOKEN_NOT_YET_VALID'
      ]);

      return {
        allowed: false,
        code: serviceTokenDecision.code,
        httpStatus: serviceTokenDecision.code === 'TOKEN_POLICY_INVALID' ? 503 : 403,
        missingScopes:
          serviceTokenDecision.missingScopes || [],
        missingClaims:
          serviceTokenDecision.missingClaims || [],
        audit:
          temporalCodes.has(serviceTokenDecision.code)
            ? {
                code: serviceTokenDecision.code,
                sub: String(verification.claims.sub),
                jti: String(verification.claims.jti),
                aud: verification.claims.aud,
                service: service.serviceCode,
                capability: capability.action,
                requiredScopes:
                  Array.isArray(policy.scopes)
                    ? policy.scopes.map(String)
                    : [],
                grantedScopes
              }
            : null
      };
    }
  }


  for (
    const flag of
    service.governance.featureFlags || []
  ) {
    let enabled =
      flag.defaultEnabled === true;

    if (
      typeof governance.isFeatureEnabled ===
      'function'
    ) {
      enabled = await governance
        .isFeatureEnabled(flag.key, {
          service,
          capability,
          context
        });
    }

    if (!enabled) {
      return {
        allowed: false,
        code: 'FEATURE_DISABLED',
        featureFlag: flag.key
      };
    }
  }


  if (
    typeof context.actor?.id !== 'string' || !context.actor.id ||
    context.actor.id !== context.userId ||
    !Array.isArray(governance.permissions) ||
    !Array.isArray(governance.entitlements)
  ) {
    return {
      allowed: false,
      code: 'USER_GOVERNANCE_UNAVAILABLE',
      httpStatus: 503
    };
  }

  // Manifest requirements are mandatory. A missing/false enforcement flag
  // must never downgrade the governed execution boundary.
  if (
    !arrayHasAll(
      governance.permissions,
      service.governance.permissions
    )
  ) {
    return {
      allowed: false,
      code: 'PERMISSION_DENIED'
    };
  }


  if (
    !arrayHasAll(
      governance.entitlements,
      service.governance.entitlements
    )
  ) {
    return {
      allowed: false,
      code: 'ENTITLEMENT_DENIED'
    };
  }


  const actorKey =
    context.actor.id;

  const rateKey =
    `${service.serviceCode}:${capability.action}:${actorKey}`;

  if (
    !rateLimiter.check(
      rateKey,
      service.limits.requestsPerMinute
    )
  ) {
    return {
      allowed: false,
      code: 'RATE_LIMITED'
    };
  }


  return {
    allowed: true,
    code: null,
    serviceToken:
      serviceTokenDecision
        ? {
            subject: serviceTokenDecision.subject,
            tokenId: serviceTokenDecision.tokenId,
            scopes: serviceTokenDecision.scopes
          }
        : null
  };
}


async function emitAudit({
  service,
  capability,
  context,
  status,
  detail
}) {
  if (!service.observability.audit) return;

  const audit = context?.governance?.audit;

  if (typeof audit === 'function') {
    await audit({
      service: service.serviceCode,
      capability: capability.action,
      status,
      detail,
      requestId: context.requestId || null,
      actorId: context.actor?.id || null
    });
  }
}


async function emitMetric({
  service,
  capability,
  context,
  status,
  latencyMs
}) {
  if (!service.observability.metrics) return;

  const metric = context?.governance?.metric;

  if (typeof metric === 'function') {
    await metric({
      service: service.serviceCode,
      capability: capability.action,
      status,
      latencyMs
    });
  }
}


module.exports = {
  MemoryRateLimiter,
  evaluateGovernance,
  emitAudit,
  emitMetric
};
