/**
 * @jest-environment node
 */

const {
  compile,
  loadManifests
} = require('../../scripts/compile-service-manifests');

const {
  MAX_SERVICE_TOKEN_AGE_SECONDS,
  SERVICE_TOKEN_POLICIES,
  isValidMaxTokenAgeSeconds
} = require('../../lib/security/service-token-policies');

describe('protected service token policy compilation', () => {
  const validPolicy = Object.freeze({
    issuer: 'bonds-token-service',
    audience: 'test-service',
    allowedSubjects: ['service:test'],
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    scopes: ['test:read']
  });

  test('compile fails when a protected service has no policy', () => {
    expect(() => compile(loadManifests(), {
      getTokenPolicy: () => null
    })).toThrow(
      /protected service requires a service token policy/
    );
  });

  test.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_SERVICE_TOKEN_AGE_SECONDS + 1
  ])('compile fails for invalid maxTokenAgeSeconds: %p', value => {
    expect(() => compile(loadManifests(), {
      getTokenPolicy: () => ({
        ...validPolicy,
        maxTokenAgeSeconds: value
      })
    })).toThrow(
      /maxTokenAgeSeconds must be a positive bounded integer/
    );
  });

  test('compile accepts protected services when max age is positive and bounded', () => {
    expect(() => compile(loadManifests(), {
      getTokenPolicy: serviceCode => ({
        ...validPolicy,
        audience: serviceCode
      })
    })).not.toThrow();
  });

  test('every protected service has a policy with matching audience', () => {
    const protectedServices = loadManifests()
      .filter(service => service.security.serviceTokenRequired);

    expect(protectedServices.length).toBeGreaterThan(0);

    for (const service of protectedServices) {
      const policy = SERVICE_TOKEN_POLICIES[service.serviceCode];
      expect(policy).toBeDefined();
      expect(policy.audience).toBe(service.serviceCode);
    }
  });

  test('current production policies fail closed while contract TTL is unknown', () => {
    expect(() => compile(loadManifests())).toThrow(
      /maxTokenAgeSeconds must be a positive bounded integer/
    );
  });

  test('internal max age bound rejects values above the ceiling', () => {
    expect(isValidMaxTokenAgeSeconds(
      MAX_SERVICE_TOKEN_AGE_SECONDS
    )).toBe(true);

    expect(isValidMaxTokenAgeSeconds(
      MAX_SERVICE_TOKEN_AGE_SECONDS + 1
    )).toBe(false);
  });
});
