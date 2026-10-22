/**
 * @jest-environment node
 */

const {
  authorizeServiceToken
} = require('../../lib/security/service-token-authorization');

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

  const policy = Object.freeze({
    issuer: 'bonds-token-service',
    audience: 'research-intelligence',
    allowedSubjects: ['service:orchestrator'],
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    scopes: ['research:read']
  });

  function claims(overrides = {}) {
    return {
      active: true,
      iss: 'bonds-token-service',
      aud: 'research-intelligence',
      sub: 'service:orchestrator',
      scope: 'research:read',
      iat: now - 10,
      exp: now + 120,
      jti: 'token-123',
      ...overrides
    };
  }

  test('accepts verified claims with exact service identity', () => {
    const result = authorizeServiceToken({
      now,
      policy,
      claims: claims()
    });

    expect(result.allowed).toBe(true);
    expect(result.tokenId).toBe('token-123');
  });

  test('requires iat with the other mandatory claims', () => {
    const input = claims();
    delete input.iat;

    const result = authorizeServiceToken({
      now,
      policy,
      claims: input
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOKEN_REQUIRED_CLAIMS_MISSING');
    expect(result.missingClaims).toContain('iat');
  });

  test.each([
    ['string', String(now)],
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY]
  ])('rejects malformed numeric iat: %s', (_label, iat) => {
    const result = authorizeServiceToken({
      now,
      policy,
      claims: claims({ iat })
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOKEN_IAT_INVALID');
  });

  test('allows future iat inside skew and rejects it outside skew', () => {
    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ iat: now + 30, exp: now + 120 })
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ iat: now + 31, exp: now + 120 })
    }).code).toBe('TOKEN_IAT_FUTURE');
  });

  test('allows token age at the bound and rejects above max age plus skew', () => {
    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({
        iat: now - 330,
        exp: now
      })
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({
        iat: now - 331,
        exp: now + 1
      })
    }).code).toBe('TOKEN_TOO_OLD');
  });

  test('rejects exp less than or equal to iat', () => {
    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({
        iat: now - 10,
        exp: now - 10
      })
    }).code).toBe('TOKEN_EXP_NOT_AFTER_IAT');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({
        iat: now - 10,
        exp: now - 11
      })
    }).code).toBe('TOKEN_EXP_NOT_AFTER_IAT');
  });

  test('rejects lifetime above max age plus skew', () => {
    const result = authorizeServiceToken({
      now,
      policy,
      claims: claims({
        iat: now - 10,
        exp: now + 321
      })
    });

    expect(result.code).toBe('TOKEN_LIFETIME_EXCEEDED');
  });

  test('uses bounded clock skew for exp and nbf', () => {
    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ iat: now - 100, exp: now - 10 })
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ iat: now - 100, exp: now - 31 })
    }).code).toBe('TOKEN_EXPIRED');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ nbf: now + 20 })
    }).allowed).toBe(true);

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ nbf: now + 31 })
    }).code).toBe('TOKEN_NOT_YET_VALID');
  });

  test('denies wrong audience scope and subject', () => {
    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ aud: 'orchestrator' })
    }).code).toBe('TOKEN_AUDIENCE_MISMATCH');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ scope: 'crawl:read' })
    }).code).toBe('TOKEN_SCOPE_DENIED');

    expect(authorizeServiceToken({
      now,
      policy,
      claims: claims({ sub: 'service:other' })
    }).code).toBe('TOKEN_SUBJECT_MISMATCH');
  });

  test('does not trust raw claims from context', async () => {
    const verifier = jest.fn(async ({ token }) => {
      expect(token).toBeNull();
      return { verified: false, code: 'TOKEN_MISSING' };
    });

    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context: {
        auth: {
          claims: claims({ jti: 'forged' })
        }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verifier
    });

    expect(result).toMatchObject({
      allowed: false,
      code: 'TOKEN_MISSING'
    });
  });

  test.each([
    [
      'context.auth.token',
      { auth: { token: 'legacy-token' } }
    ],
    [
      'governance.serviceToken',
      { governance: { serviceToken: 'governance-token' } }
    ]
  ])('does not trust token from %s', async (_label, context) => {
    const verifier = jest.fn(async ({ token }) => {
      expect(token).toBeNull();
      return { verified: false, code: 'TOKEN_MISSING' };
    });

    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context,
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verifier
    });

    expect(result.code).toBe('TOKEN_MISSING');
    expect(verifier).toHaveBeenCalledTimes(1);
  });

  test('passes only context.auth.serviceToken to introspection', async () => {
    const verifier = jest.fn(async ({ token }) => {
      expect(token).toBe('trusted-service-token');
      return { verified: false, code: 'TOKEN_TEST_STOP' };
    });

    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context: {
        auth: {
          serviceToken: 'trusted-service-token',
          token: 'legacy-token'
        },
        governance: {
          serviceToken: 'governance-token'
        }
      },
      rateLimiter: new MemoryRateLimiter(),
      verifyServiceToken: verifier
    });

    expect(result.code).toBe('TOKEN_TEST_STOP');
    expect(verifier).toHaveBeenCalledTimes(1);
  });

  test('governance.now cannot change production time decisions', async () => {
    jest.resetModules();
    jest.doMock('../../lib/security/service-token-policies', () => ({
      getServiceTokenPolicy: () => policy
    }));

    const isolatedGateway =
      require('../../lib/capabilities/governance-gateway');

    const dateSpy =
      jest.spyOn(Date, 'now').mockReturnValue(now * 1000);

    try {
      const verifier = jest.fn(async () => ({
        verified: true,
        claims: claims({
          iat: now + 31,
          exp: now + 120
        })
      }));

      const result =
        await isolatedGateway.evaluateGovernance({
          service: SERVICES['research-intelligence'],
          capability:
            CAPABILITIES.research_intelligence_verify,
          context: {
            auth: { serviceToken: 'opaque-token' },
            governance: {
              now: now + 10_000
            }
          },
          rateLimiter:
            new isolatedGateway.MemoryRateLimiter(),
          verifyServiceToken: verifier
        });

      expect(result.code).toBe('TOKEN_IAT_FUTURE');
    } finally {
      dateSpy.mockRestore();
      jest.dontMock('../../lib/security/service-token-policies');
      jest.resetModules();
    }
  });

  test('caller cannot override the service token policy', async () => {
    jest.resetModules();
    jest.doMock('../../lib/security/service-token-policies', () => ({
      getServiceTokenPolicy: () => policy
    }));

    const isolatedGateway =
      require('../../lib/capabilities/governance-gateway');

    try {
      const result =
        await isolatedGateway.evaluateGovernance({
          service: SERVICES['research-intelligence'],
          capability:
            CAPABILITIES.research_intelligence_verify,
          context: {
            auth: { serviceToken: 'opaque-token' },
            governance: {
              serviceTokenPolicy: {
                issuer: 'attacker',
                audience: 'evil',
                allowedSubjects: ['service:attacker'],
                scopes: []
              }
            }
          },
          rateLimiter:
            new isolatedGateway.MemoryRateLimiter(),
          verifyServiceToken: async () => ({
            verified: true,
            claims: claims({ aud: 'evil' })
          })
        });

      expect(result.code).toBe('TOKEN_AUDIENCE_MISMATCH');
    } finally {
      jest.dontMock('../../lib/security/service-token-policies');
      jest.resetModules();
    }
  });

  test('temporal denial audit contains only verified claim metadata', async () => {
    jest.resetModules();
    jest.doMock('../../lib/security/service-token-policies', () => ({
      getServiceTokenPolicy: () => policy
    }));

    const isolatedGateway =
      require('../../lib/capabilities/governance-gateway');

    const dateSpy =
      jest.spyOn(Date, 'now').mockReturnValue(now * 1000);

    try {
      const result =
        await isolatedGateway.evaluateGovernance({
          service: SERVICES['research-intelligence'],
          capability:
            CAPABILITIES.research_intelligence_verify,
          context: {
            auth: { serviceToken: 'raw-token-do-not-log' }
          },
          rateLimiter:
            new isolatedGateway.MemoryRateLimiter(),
          verifyServiceToken: async () => ({
            verified: true,
            claims: claims({
              iat: now + 31,
              jti: 'verified-jti'
            })
          })
        });

      expect(result.audit).toEqual({
        code: 'TOKEN_IAT_FUTURE',
        sub: 'service:orchestrator',
        jti: 'verified-jti',
        aud: 'research-intelligence',
        service: 'research-intelligence',
        capability: 'research_intelligence_verify',
        requiredScopes: ['research:read'],
        grantedScopes: ['research:read']
      });
      expect(result).not.toHaveProperty('serviceToken');
      expect(JSON.stringify(result.audit))
        .not.toContain('raw-token-do-not-log');
    } finally {
      dateSpy.mockRestore();
      jest.dontMock('../../lib/security/service-token-policies');
      jest.resetModules();
    }
  });

  test('audit scope parsing matches authorization for scopes string', async () => {
    jest.resetModules();
    jest.doMock('../../lib/security/service-token-policies', () => ({
      getServiceTokenPolicy: () => policy
    }));

    const isolatedGateway =
      require('../../lib/capabilities/governance-gateway');

    const dateSpy =
      jest.spyOn(Date, 'now').mockReturnValue(now * 1000);

    try {
      const result =
        await isolatedGateway.evaluateGovernance({
          service: SERVICES['research-intelligence'],
          capability:
            CAPABILITIES.research_intelligence_verify,
          context: {
            auth: { serviceToken: 'opaque-token' }
          },
          rateLimiter:
            new isolatedGateway.MemoryRateLimiter(),
          verifyServiceToken: async () => ({
            verified: true,
            claims: {
              ...claims({
                iat: now + 31
              }),
              scope: undefined,
              scopes: 'research:read extra:scope'
            }
          })
        });

      expect(result.audit.grantedScopes).toEqual([
        'research:read',
        'extra:scope'
      ]);
    } finally {
      dateSpy.mockRestore();
      jest.dontMock('../../lib/security/service-token-policies');
      jest.resetModules();
    }
  });

  test('introspection rejects revoked tokens', async () => {
    const runtime = {
      status: 'ok', service: 'bonds-token-service', issuer: 'bonds-token-service',
      contract_version: 2, schema_version: 3, service_token_ttl_seconds: 3600,
      build_commit: 'a'.repeat(40), channel_auth: 'required',
      broker_auth: 'required', broker_mode: 'one_time_service_tokens'
    };
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        runtime,
        claims: { active: false, revoked: true, jti: 'revoked-token' }
      })
    }));

    const result = await introspectServiceToken({
      token: 'opaque-token',
      url: 'https://runtime.example.test/introspect',
      channelSecret: 'isolated-verifier-channel-credential-123456789',
      expectedBuildCommit: runtime.build_commit,
      fetchImpl
    });

    expect(result).toEqual({
      verified: false,
      code: 'TOKEN_INACTIVE',
      httpStatus: 403
    });
  });

  test('introspection returns only verified claims for active token', async () => {
    const runtime = {
      status: 'ok', service: 'bonds-token-service', issuer: 'bonds-token-service',
      contract_version: 2, schema_version: 3, service_token_ttl_seconds: 3600,
      build_commit: 'a'.repeat(40), channel_auth: 'required',
      broker_auth: 'required', broker_mode: 'one_time_service_tokens'
    };
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        runtime,
        claims: claims({ jti: 'live-token', revoked: false, token_type: 'service' })
      })
    }));

    const result = await introspectServiceToken({
      token: 'opaque-token',
      url: 'https://runtime.example.test/introspect',
      channelSecret: 'isolated-verifier-channel-credential-123456789',
      expectedBuildCommit: runtime.build_commit,
      fetchImpl
    });

    expect(result.verified).toBe(true);
    expect(result.claims.jti).toBe('live-token');
  });
});
