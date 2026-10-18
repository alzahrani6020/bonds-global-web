/**
 * @jest-environment node
 */

const {
  authorizeServiceToken
} = require('../../lib/security/service-token-authorization');

const {
  getServiceTokenPolicy
} = require('../../lib/security/service-token-policies');

const {
  introspectServiceToken
} = require('../../lib/security/service-token-verifier');

const {
  SERVICES,
  CAPABILITIES
} = require('../../lib/capabilities/bonds-capability-registry');

const {
  MemoryRateLimiter,
  evaluateGovernance
} = require('../../lib/capabilities/governance-gateway');

describe('service token authorization', () => {
  const now = 1_800_000_000;

  function verified(claims) {
    return async () => ({
      verified: true,
      claims: {
        active: true,
        iss: 'bonds-token-service',
        exp: now + 300,
        jti: 'token-123',
        ...claims
      }
    });
  }

  test('accepts verified claims with exact service identity', () => {
    const result = authorizeServiceToken({
      now,
      policy: getServiceTokenPolicy('research-intelligence'),
      claims: {
        active: true,
        iss: 'bonds-token-service',
        aud: 'research-intelligence',
        sub: 'service:orchestrator',
        scope: 'research:read',
        exp: now + 300,
        jti: 'token-123'
      }
    });

    expect(result.allowed).toBe(true);
    expect(result.tokenId).toBe('token-123');
  });

  test('requires iss aud sub exp and jti claims', () => {
    const result = authorizeServiceToken({
      now,
      policy: getServiceTokenPolicy('research-intelligence'),
      claims: {
        active: true,
        scope: 'research:read'
      }
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOKEN_REQUIRED_CLAIMS_MISSING');
    expect(result.missingClaims).toEqual(
      expect.arrayContaining(['iss', 'aud', 'sub', 'exp', 'jti'])
    );
  });

  test('uses bounded clock skew for exp and nbf', () => {
    const policy = getServiceTokenPolicy('research-intelligence');
    const base = {
      active: true,
      iss: 'bonds-token-service',
      aud: 'research-intelligence',
      sub: 'service:orchestrator',
      scope: 'research:read',
      jti: 'clock-token'
    };

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, exp: now - 10 }
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, exp: now - 31 }
    }).code).toBe('TOKEN_EXPIRED');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, exp: now + 300, nbf: now + 20 }
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, exp: now + 300, nbf: now + 31 }
    }).code).toBe('TOKEN_NOT_YET_VALID');
  });

  test('denies wrong audience scope and subject', () => {
    const policy = getServiceTokenPolicy('research-intelligence');
    const base = {
      active: true,
      iss: 'bonds-token-service',
      aud: 'research-intelligence',
      sub: 'service:orchestrator',
      scope: 'research:read',
      exp: now + 300,
      jti: 'identity-token'
    };

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, aud: 'orchestrator' }
    }).code).toBe('TOKEN_AUDIENCE_MISMATCH');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, scope: 'crawl:read' }
    }).code).toBe('TOKEN_SCOPE_DENIED');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: { ...base, sub: 'service:other' }
    }).code).toBe('TOKEN_SUBJECT_MISMATCH');
  });

  test('does not trust context claims without verifier proof', async () => {
    const verifier = jest.fn(async ({ token }) => {
      expect(token).toBeNull();
      return { verified: false, code: 'TOKEN_MISSING' };
    });

    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context: {
        auth: {
          claims: {
            active: true,
            iss: 'bonds-token-service',
            aud: 'research-intelligence',
            sub: 'service:orchestrator',
            scope: 'research:read',
            exp: now + 300,
            jti: 'forged'
          }
        },
        governance: { now }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verifier
    });

    expect(result).toMatchObject({
      allowed: false,
      code: 'TOKEN_MISSING'
    });
    expect(verifier).toHaveBeenCalledTimes(1);
  });

  test('caller cannot override the service token policy', async () => {
    const result = await evaluateGovernance({
      service: {
        ...SERVICES['web-research'],
        security: {
          ...SERVICES['web-research'].security,
          serviceTokenRequired: true
        }
      },
      capability: CAPABILITIES.web_fetch,
      context: {
        auth: { serviceToken: 'raw-token-do-not-log' },
        governance: {
          now,
          serviceTokenPolicy: {
            issuer: 'attacker',
            audience: 'evil',
            allowedSubjects: ['service:attacker'],
            scopes: []
          }
        }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verified({
        aud: 'evil',
        sub: 'service:research-intelligence',
        scope: 'research:read'
      })
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOKEN_AUDIENCE_MISMATCH');
  });

  test('registered research service enforces verifier result automatically', async () => {
    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context: {
        auth: { serviceToken: 'opaque-token' },
        governance: { now }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verified({
        aud: 'research-intelligence',
        sub: 'service:orchestrator',
        scope: 'research:read'
      })
    });

    expect(result.allowed).toBe(true);
    expect(result.serviceToken).toEqual({
      subject: 'service:orchestrator',
      tokenId: 'token-123',
      scopes: ['research:read']
    });
    expect(JSON.stringify(result)).not.toContain('opaque-token');
  });

  test('registered orchestrator enforces exact agent-runtime identity', async () => {
    const denied = await evaluateGovernance({
      service: SERVICES.orchestrator,
      capability: CAPABILITIES.orchestrator_run,
      context: {
        auth: { serviceToken: 'opaque-token' },
        governance: { now }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verified({
        aud: 'orchestrator',
        sub: 'service:research-intelligence',
        scope: 'orchestrator:dispatch'
      })
    });

    expect(denied.code).toBe('TOKEN_SUBJECT_MISMATCH');
  });

  test('introspection rejects revoked tokens', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        active: false,
        revoked: true,
        jti: 'revoked-token'
      })
    }));

    const result = await introspectServiceToken({
      token: 'opaque-token',
      url: 'http://127.0.0.1:8771/introspect',
      fetchImpl
    });

    expect(result).toEqual({
      verified: false,
      code: 'TOKEN_INACTIVE'
    });
  });

  test('introspection returns only verified claims for active token', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        active: true,
        iss: 'bonds-token-service',
        aud: 'research-intelligence',
        sub: 'service:orchestrator',
        scope: 'research:read',
        exp: now + 300,
        jti: 'live-token'
      })
    }));

    const result = await introspectServiceToken({
      token: 'opaque-token',
      url: 'http://127.0.0.1:8771/introspect',
      fetchImpl
    });

    expect(result.verified).toBe(true);
    expect(result.claims.jti).toBe('live-token');
  });
});
