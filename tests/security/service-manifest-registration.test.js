/**
 * @jest-environment node
 */

const {
  CAPABILITIES,
  SERVICES,
  GOVERNANCE,
  validateCapabilityInput
} = require(
  '../../lib/capabilities/bonds-capability-registry'
);

const {
  RUNTIME_ADAPTERS
} = require(
  '../../lib/capabilities/runtime-adapters'
);

const {
  MemoryRateLimiter,
  evaluateGovernance
} = require(
  '../../lib/capabilities/governance-gateway'
);


describe(
  'Unified service capability registration',
  () => {

    test(
      'current services are generated',
      () => {
        expect(
          SERVICES['web-research']
        ).toBeDefined();

        expect(
          SERVICES['native-inference']
        ).toBeDefined();
      }
    );


    test(
      'all existing capabilities remain registered',
      () => {
        expect(
          Object.keys(CAPABILITIES).sort()
        ).toEqual([
          'evidence_verify',
          'native_generate',
          'native_health',
          'research_synthesize',
          'web_crawl',
          'web_explore',
          'web_fetch'
        ]);
      }
    );


    test(
      'all active capabilities have approved adapters',
      () => {
        for (
          const capability of
          Object.values(CAPABILITIES)
        ) {
          if (!capability.active) continue;

          expect(
            typeof RUNTIME_ADAPTERS[
              capability.runtime.adapter
            ]
          ).toBe('function');
        }
      }
    );


    test(
      'unknown capabilities fail closed',
      () => {
        expect(
          validateCapabilityInput(
            'unknown_capability',
            {}
          )
        ).toEqual({
          valid: false,
          code: 'UNKNOWN_CAPABILITY',
          missing: []
        });
      }
    );


    test(
      'required inputs remain enforced',
      () => {
        const result =
          validateCapabilityInput(
            'web_fetch',
            {}
          );

        expect(result.valid).toBe(false);
        expect(result.code)
          .toBe('MISSING_INPUTS');

        expect(result.missing)
          .toContain('url');
      }
    );


    test(
      'governance catalog is generated',
      () => {
        expect(
          GOVERNANCE.permissions
        ).toContain(
          'research.web.read'
        );

        expect(
          GOVERNANCE.entitlements
        ).toContain(
          'ai.native'
        );

        expect(
          GOVERNANCE.featureFlags
            .map(flag => flag.key)
        ).toContain(
          'service.web-research.enabled'
        );
      }
    );


    test(
      'sensitive privilege inheritance is denied',
      () => {
        for (
          const service of
          Object.values(SERVICES)
        ) {
          expect(
            service.security
              .requestedSensitivePrivileges
          ).toEqual([]);
        }
      }
    );


    test(
      'AI exposure has one consistent decision',
      () => {
        const service =
          SERVICES['native-inference'];

        expect(
          service.ai.exposed
        ).toBe(false);

        expect(
          service.security
            .privileges
            .ai_tool_exposure
        ).toBe(false);
      }
    );


    test(
      'permissions can be enforced by gateway',
      async () => {
        const service =
          SERVICES['web-research'];

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              governance: {
                enforcePermissions: true,
                permissions: []
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('PERMISSION_DENIED');
      }
    );


    test(
      'entitlements can be enforced by gateway',
      async () => {
        const service =
          SERVICES['web-research'];

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              governance: {
                enforceEntitlements: true,
                entitlements: []
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('ENTITLEMENT_DENIED');
      }
    );


    test(
      'feature flag failure denies capability',
      async () => {
        const service =
          SERVICES['web-research'];

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              governance: {
                isFeatureEnabled:
                  async () => false
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('FEATURE_DISABLED');
      }
    );


    test(
      'rate limit is enforced',
      async () => {
        const service = {
          ...SERVICES['web-research'],
          limits: {
            ...SERVICES['web-research'].limits,
            requestsPerMinute: 1
          }
        };

        const capability =
          CAPABILITIES.web_fetch;

        const limiter =
          new MemoryRateLimiter();

        const context = {
          actor: {
            id: 'rate-test'
          }
        };

        const first =
          await evaluateGovernance({
            service,
            capability,
            context,
            rateLimiter: limiter
          });

        const second =
          await evaluateGovernance({
            service,
            capability,
            context,
            rateLimiter: limiter
          });

        expect(first.allowed)
          .toBe(true);

        expect(second.allowed)
          .toBe(false);

        expect(second.code)
          .toBe('RATE_LIMITED');
      }
    );
  }
);
