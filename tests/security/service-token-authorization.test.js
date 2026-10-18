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
  SERVICES,
  CAPABILITIES
} = require('../../lib/capabilities/bonds-capability-registry');

const {
  MemoryRateLimiter,
  evaluateGovernance
} = require('../../lib/capabilities/governance-gateway');

describe('service token authorization', () => {
  const now = 1_800_000_000;

  test('accepts a valid scoped service token', () => {
    const result = authorizeServiceToken({
      now,
      policy: {
        issuer: 'bonds-token-service',
        audience: 'research-intelligence',
        subjectPrefix: 'service:',
        scopes: ['research:read']
      },
      claims: {
        active: true,
        iss: 'bonds-token-service',
        aud: 'research-intelligence',
        sub: 'service:research-worker-01',
        scope: 'research:read crawl:read',
        exp: now + 300,
        jti: 'token-123'
      }
    });

    expect(result.allowed).toBe(true);
    expect(result.tokenId).toBe('token-123');
  });

  test('denies wrong audience', () => {
    const result = authorizeServiceToken({
      now,
      policy: {
        issuer: 'bonds-token-service',
        audience: 'agent-runtime',
        scopes: ['agent:execute']
      },
      claims: {
        active: true,
        iss: 'bonds-token-service',
        aud: 'orchestrator',
        scope: 'agent:execute',
        exp: now + 300
      }
    });

    expect(result).toMatchObject({
      allowed: false,
      code: 'TOKEN_AUDIENCE_MISMATCH'
    });
  });

  test('denies missing scopes', () => {
    const result = authorizeServiceToken({
      now,
      policy: {
        scopes: ['marketing:write']
      },
      claims: {
        active: true,
        scope: 'marketing:read',
        exp: now + 300
      }
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOKEN_SCOPE_DENIED');
    expect(result.missingScopes).toEqual(['marketing:write']);
  });

  test('denies expired, not-yet-valid and revoked tokens', () => {
    expect(authorizeServiceToken({
      now,
      claims: { exp: now }
    }).code).toBe('TOKEN_EXPIRED');

    expect(authorizeServiceToken({
      now,
      claims: { nbf: now + 1 }
    }).code).toBe('TOKEN_NOT_YET_VALID');

    expect(authorizeServiceToken({
      now,
      claims: { active: false }
    }).code).toBe('TOKEN_INACTIVE');
  });

  test('denies unexpected service identity', () => {
    const result = authorizeServiceToken({
      now,
      policy: {
        subjectPrefix: 'service:'
      },
      claims: {
        sub: 'user:123',
        exp: now + 300
      }
    });

    expect(result.code).toBe('TOKEN_SUBJECT_MISMATCH');
  });

  test('defines least-privilege policies for target engines', () => {
    expect(getServiceTokenPolicy('research-intelligence')).toMatchObject({
      audience: 'research-intelligence',
      scopes: ['research:read']
    });

    expect(getServiceTokenPolicy('orchestrator')).toMatchObject({
      audience: 'orchestrator',
      scopes: ['orchestrator:dispatch']
    });

    expect(getServiceTokenPolicy('agent-runtime')).toMatchObject({
      audience: 'agent-runtime',
      scopes: ['agent:execute']
    });
  });
  test('governance gateway denies a web-research token with the wrong audience', async () => {
    const result = await evaluateGovernance({
      service: SERVICES['web-research'],
      capability: CAPABILITIES.web_fetch,
      context: {
        governance: {
          enforceServiceToken: true,
          now,
          tokenClaims: {
            active: true,
            iss: 'bonds-token-service',
            aud: 'orchestrator',
            sub: 'service:orchestrator',
            scope: 'research:read',
            exp: now + 300
          }
        }
      },
      rateLimiter: new MemoryRateLimiter()
    });

    expect(result).toMatchObject({
      allowed: false,
      code: 'TOKEN_AUDIENCE_MISMATCH'
    });
  });

  test('governance gateway accepts a correctly scoped web-research token', async () => {
    const result = await evaluateGovernance({
      service: SERVICES['web-research'],
      capability: CAPABILITIES.web_fetch,
      context: {
        governance: {
          enforceServiceToken: true,
          now,
          tokenClaims: {
            active: true,
            iss: 'bonds-token-service',
            aud: 'web-research',
            sub: 'service:research-intelligence',
            scope: 'research:read crawl:read',
            exp: now + 300,
            jti: 'research-token-1'
          }
        }
      },
      rateLimiter: new MemoryRateLimiter()
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBeNull();
  });

});
