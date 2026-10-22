/**
 * @jest-environment node
 */

const {
  validateManifest
} = require('../../scripts/compile-service-manifests');

const {
  evaluateGovernance
} = require('../../lib/capabilities/governance-gateway');

function unboundedManifest() {
  return {
    schema_version: 1,
    service_code: 'unbounded-ai-api',
    version: 1,
    enabled: true,
    governance: {
      permissions: ['unbounded.execute'],
      entitlements: ['unbounded.service'],
      feature_flags: []
    },
    security: {
      network_access: 'runtime_configured',
      privileges: {
        service_role: false,
        private_network: false,
        arbitrary_code: false,
        external_write: false,
        ai_tool_exposure: false
      }
    },
    observability: {
      health_check: true,
      audit: true,
      metrics: true
    },
    data: {
      provenance: true,
      quality: true
    },
    workflows: {
      events: []
    },
    ai: {
      exposed: false
    },
    capabilities: [
      {
        action: 'unbounded_execute',
        id: 'BONDS-CAP-UNBOUNDED-001',
        purpose: 'Exercise a provider-agnostic AI/API capability without application throughput ceilings.',
        side_effect: 'compute',
        required: ['request'],
        runtime: {
          adapter: 'unbounded_execute'
        }
      }
    ]
  };
}

describe('provider-agnostic AI/API onboarding contract', () => {
  test('service manifests may omit operational limits', () => {
    const service = validateManifest(
      unboundedManifest(),
      'unbounded-ai-api.service.json'
    );

    expect(service.limits).toEqual({
      requestsPerMinute: null,
      retryMaxAttempts: null
    });
  });

  test('governance does not impose a rate limiter when limits are omitted', async () => {
    const service = validateManifest(
      unboundedManifest(),
      'unbounded-ai-api.service.json'
    );

    const capability = {
      ...service.capabilities[0],
      active: true
    };

    const rateLimiter = {
      check: jest.fn(() => {
        throw new Error('rate limiter must not be called');
      })
    };

    const decision = await evaluateGovernance({
      service,
      capability,
      context: {
        actor: { id: 'user-1' },
        userId: 'user-1',
        governance: {
          permissions: ['unbounded.execute'],
          entitlements: ['unbounded.service']
        }
      },
      rateLimiter
    });

    expect(decision.allowed).toBe(true);
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  test('removing performance caps does not remove authorization', async () => {
    const service = validateManifest(
      unboundedManifest(),
      'unbounded-ai-api.service.json'
    );

    const capability = {
      ...service.capabilities[0],
      active: true
    };

    const decision = await evaluateGovernance({
      service,
      capability,
      context: {
        actor: { id: 'user-1' },
        userId: 'user-1',
        governance: {
          permissions: [],
          entitlements: ['unbounded.service']
        }
      }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PERMISSION_DENIED');
  });
});
