'use strict';

const fs = require('fs');
const path = require('path');

const {
  getServiceTokenPolicy,
  isValidMaxTokenAgeSeconds
} = require('../lib/security/service-token-policies');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_DIR = path.join(ROOT, 'services', 'manifests');

const REGISTRY_OUTPUT = path.join(
  ROOT,
  'lib',
  'capabilities',
  'generated-service-registry.js'
);

const GOVERNANCE_OUTPUT = path.join(
  ROOT,
  'lib',
  'capabilities',
  'generated-governance-plan.json'
);

const ACTION_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

const SIDE_EFFECTS = new Set([
  'none',
  'compute',
  'network_read',
  'network_write',
  'database_read',
  'database_write'
]);

const NETWORK_ACCESS = new Set([
  'none',
  'public_only',
  'runtime_configured'
]);

const SENSITIVE_PRIVILEGES = [
  'service_role',
  'private_network',
  'arbitrary_code',
  'external_write',
  'ai_tool_exposure'
];

function fail(message) {
  throw new Error(`SERVICE_MANIFEST_INVALID: ${message}`);
}

function uniqueStrings(value, field) {
  if (value === undefined) return [];

  if (
    !Array.isArray(value) ||
    value.some(v => typeof v !== 'string' || !v.trim())
  ) {
    fail(`${field} must be an array of non-empty strings`);
  }

  return [...new Set(value.map(v => v.trim()))].sort();
}

function validateFeatureFlags(value, field) {
  if (!Array.isArray(value)) {
    fail(`${field} must be an array`);
  }

  const seen = new Set();

  return value.map((flag, index) => {
    if (
      !flag ||
      typeof flag !== 'object' ||
      typeof flag.key !== 'string' ||
      !flag.key.trim() ||
      typeof flag.default_enabled !== 'boolean'
    ) {
      fail(`${field}[${index}] is invalid`);
    }

    if (seen.has(flag.key)) {
      fail(`${field}: duplicate flag ${flag.key}`);
    }

    seen.add(flag.key);

    return {
      key: flag.key,
      defaultEnabled: flag.default_enabled
    };
  });
}

function validateManifest(manifest, filename) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail(`${filename}: root must be an object`);
  }

  if (manifest.schema_version !== 1) {
    fail(`${filename}: schema_version must equal 1`);
  }

  if (
    typeof manifest.service_code !== 'string' ||
    !ACTION_RE.test(manifest.service_code)
  ) {
    fail(`${filename}: invalid service_code`);
  }

  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    fail(`${filename}: invalid version`);
  }

  if (typeof manifest.enabled !== 'boolean') {
    fail(`${filename}: enabled must be boolean`);
  }

  if (!manifest.governance || typeof manifest.governance !== 'object') {
    fail(`${filename}: governance is required`);
  }

  if (!manifest.security || typeof manifest.security !== 'object') {
    fail(`${filename}: security is required`);
  }

  if (!NETWORK_ACCESS.has(manifest.security.network_access)) {
    fail(`${filename}: unsupported network_access`);
  }

  if (
    manifest.security.service_token_required !== undefined &&
    typeof manifest.security.service_token_required !== 'boolean'
  ) {
    fail(`${filename}: security.service_token_required must be boolean`);
  }

  const privileges = manifest.security.privileges;

  if (!privileges || typeof privileges !== 'object') {
    fail(`${filename}: security.privileges is required`);
  }

  for (const privilege of SENSITIVE_PRIVILEGES) {
    if (typeof privileges[privilege] !== 'boolean') {
      fail(`${filename}: privilege ${privilege} must be boolean`);
    }
  }

  const requestedSensitivePrivileges =
    SENSITIVE_PRIVILEGES.filter(name => privileges[name] === true);

  const limits = manifest.limits || {};

  const rpm = limits.rate_limit?.requests_per_minute;
  if (!Number.isInteger(rpm) || rpm < 1) {
    fail(`${filename}: requests_per_minute must be positive`);
  }

  const maxAttempts = limits.retry?.max_attempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 10) {
    fail(`${filename}: retry.max_attempts is invalid`);
  }

  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    fail(`${filename}: capabilities must be non-empty`);
  }

  const capabilities = manifest.capabilities.map((capability, index) => {
    const prefix = `${filename}: capabilities[${index}]`;

    if (!capability || typeof capability !== 'object') {
      fail(`${prefix} must be an object`);
    }

    if (
      typeof capability.action !== 'string' ||
      !ACTION_RE.test(capability.action)
    ) {
      fail(`${prefix}.action is invalid`);
    }

    if (typeof capability.id !== 'string' || !capability.id.trim()) {
      fail(`${prefix}.id is required`);
    }

    if (typeof capability.purpose !== 'string' || !capability.purpose.trim()) {
      fail(`${prefix}.purpose is required`);
    }

    if (!SIDE_EFFECTS.has(capability.side_effect)) {
      fail(`${prefix}.side_effect is invalid`);
    }

    if (
      !capability.runtime ||
      typeof capability.runtime.adapter !== 'string' ||
      !ACTION_RE.test(capability.runtime.adapter)
    ) {
      fail(`${prefix}.runtime.adapter is required`);
    }

    const required = uniqueStrings(
      capability.required,
      `${prefix}.required`
    );

    const requiredAny = capability.required_any || [];

    if (
      !Array.isArray(requiredAny) ||
      requiredAny.some(group =>
        !Array.isArray(group) ||
        group.length === 0 ||
        group.some(v => typeof v !== 'string' || !v.trim())
      )
    ) {
      fail(`${prefix}.required_any is invalid`);
    }

    return {
      action: capability.action,
      id: capability.id,
      purpose: capability.purpose,
      sideEffect: capability.side_effect,
      required,
      requiredAny,
      runtime: {
        adapter: capability.runtime.adapter
      },
      serviceCode: manifest.service_code
    };
  });

  const aiExposed = manifest.ai?.exposed === true;

  if (aiExposed !== privileges.ai_tool_exposure) {
    fail(
      `${filename}: ai.exposed and security.privileges.ai_tool_exposure must agree`
    );
  }

  return {
    schemaVersion: 1,
    serviceCode: manifest.service_code,
    version: manifest.version,
    enabled: manifest.enabled,

    governance: {
      permissions: uniqueStrings(
        manifest.governance.permissions,
        `${filename}: governance.permissions`
      ),
      entitlements: uniqueStrings(
        manifest.governance.entitlements,
        `${filename}: governance.entitlements`
      ),
      featureFlags: validateFeatureFlags(
        manifest.governance.feature_flags,
        `${filename}: governance.feature_flags`
      )
    },

    security: {
      networkAccess: manifest.security.network_access,
      serviceTokenRequired:
        manifest.security.service_token_required === true,
      privileges,
      requestedSensitivePrivileges
    },

    limits: {
      requestsPerMinute: rpm,
      retryMaxAttempts: maxAttempts
    },

    observability: {
      healthCheck: manifest.observability?.health_check === true,
      audit: manifest.observability?.audit === true,
      metrics: manifest.observability?.metrics === true
    },

    data: {
      provenance: manifest.data?.provenance === true,
      quality: manifest.data?.quality === true
    },

    workflows: {
      events: uniqueStrings(
        manifest.workflows?.events,
        `${filename}: workflows.events`
      )
    },

    ai: {
      exposed: aiExposed
    },

    capabilities
  };
}

function loadManifests() {
  const filenames = fs
    .readdirSync(MANIFEST_DIR)
    .filter(name => name.endsWith('.service.json'))
    .sort();

  if (filenames.length === 0) {
    fail('no service manifests found');
  }

  return filenames.map(filename => {
    const fullPath = path.join(MANIFEST_DIR, filename);

    const raw = fs
      .readFileSync(fullPath, 'utf8')
      .replace(/^\uFEFF/, '');

    return validateManifest(JSON.parse(raw), filename);
  });
}

function compile(
  manifests,
  {
    getTokenPolicy = getServiceTokenPolicy,
    validateMaxTokenAge = isValidMaxTokenAgeSeconds
  } = {}
) {
  const services = {};
  const capabilities = {};

  const governance = {
    permissions: new Set(),
    entitlements: new Set(),
    featureFlags: new Map(),
    workflowEvents: new Set()
  };

  for (const service of manifests) {
    if (services[service.serviceCode]) {
      fail(`duplicate service_code ${service.serviceCode}`);
    }

    if (service.security.serviceTokenRequired) {
      const tokenPolicy =
        getTokenPolicy(service.serviceCode);

      if (!tokenPolicy) {
        fail(
          `${service.serviceCode}: protected service requires a service token policy`
        );
      }

      if (!validateMaxTokenAge(tokenPolicy.maxTokenAgeSeconds)) {
        fail(
          `${service.serviceCode}: service token policy maxTokenAgeSeconds must be a positive bounded integer`
        );
      }
    }

    services[service.serviceCode] = {
      schemaVersion: service.schemaVersion,
      serviceCode: service.serviceCode,
      version: service.version,
      enabled: service.enabled,
      governance: service.governance,
      security: service.security,
      limits: service.limits,
      observability: service.observability,
      data: service.data,
      workflows: service.workflows,
      ai: service.ai
    };

    service.governance.permissions.forEach(value =>
      governance.permissions.add(value)
    );

    service.governance.entitlements.forEach(value =>
      governance.entitlements.add(value)
    );

    service.governance.featureFlags.forEach(flag => {
      const existing = governance.featureFlags.get(flag.key);

      if (
        existing &&
        existing.defaultEnabled !== flag.defaultEnabled
      ) {
        fail(`conflicting defaults for feature flag ${flag.key}`);
      }

      governance.featureFlags.set(flag.key, flag);
    });

    service.workflows.events.forEach(value =>
      governance.workflowEvents.add(value)
    );

    for (const capability of service.capabilities) {
      if (capabilities[capability.action]) {
        fail(`duplicate capability action ${capability.action}`);
      }

      capabilities[capability.action] = {
        ...capability,
        active:
          service.enabled &&
          service.security.requestedSensitivePrivileges.length === 0
      };
    }
  }

  return {
    services,
    capabilities,
    governance: {
      permissions: [...governance.permissions].sort(),
      entitlements: [...governance.entitlements].sort(),
      featureFlags: [...governance.featureFlags.values()]
        .sort((a, b) => a.key.localeCompare(b.key)),
      workflowEvents: [...governance.workflowEvents].sort()
    }
  };
}

function renderRegistry(compiled) {
  return `'use strict';

module.exports = Object.freeze(${JSON.stringify(compiled, null, 2)});
`;
}

function main() {
  const compiled = compile(loadManifests());

  const registry = renderRegistry(compiled);

  const governancePlan = JSON.stringify(
    compiled.governance,
    null,
    2
  ) + '\n';

  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    if (
      !fs.existsSync(REGISTRY_OUTPUT) ||
      !fs.existsSync(GOVERNANCE_OUTPUT)
    ) {
      console.error('Generated service artifacts are missing.');
      process.exit(1);
    }

    if (
      fs.readFileSync(REGISTRY_OUTPUT, 'utf8') !== registry ||
      fs.readFileSync(GOVERNANCE_OUTPUT, 'utf8') !== governancePlan
    ) {
      console.error(
        'Generated service artifacts are stale. Run npm run services:compile'
      );
      process.exit(1);
    }

    console.log(
      `Service manifests valid: ` +
      `${Object.keys(compiled.services).length} services, ` +
      `${Object.keys(compiled.capabilities).length} capabilities.`
    );

    return;
  }

  fs.writeFileSync(REGISTRY_OUTPUT, registry, 'utf8');
  fs.writeFileSync(GOVERNANCE_OUTPUT, governancePlan, 'utf8');

  console.log(
    `Compiled ` +
    `${Object.keys(compiled.services).length} services and ` +
    `${Object.keys(compiled.capabilities).length} capabilities.`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  validateManifest,
  loadManifests,
  compile,
  renderRegistry
};
