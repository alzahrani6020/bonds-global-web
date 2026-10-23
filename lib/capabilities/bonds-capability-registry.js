'use strict';

const generated =
  require('./generated-service-registry');

const CAPABILITIES =
  Object.freeze(generated.capabilities);

const SERVICES =
  Object.freeze(generated.services);

const GOVERNANCE =
  Object.freeze(generated.governance);


const ACTION_TYPES = Object.freeze([
  'token',
  'ai',
  'api',
  'engine',
  'data',
  'workflow',
  'human',
  'capability'
]);

function inferActionType(action, spec = null) {
  const explicit = String(spec?.actionType || '').trim().toLowerCase();
  if (ACTION_TYPES.includes(explicit)) return explicit;
  if (spec?.sideEffect === 'network_read' || spec?.sideEffect === 'network_write') return 'api';
  if (spec?.sideEffect === 'database_read' || spec?.sideEffect === 'database_write') return 'data';
  if (spec?.sideEffect === 'compute') return 'engine';
  return 'capability';
}

function getActionDescriptor(action) {
  const key = String(action || '').trim();
  const spec = getCapability(key);
  if (!spec) return null;
  return {
    action: key,
    actionType: inferActionType(key, spec),
    serviceCode: spec.serviceCode || null,
    runtimeAdapter: spec.runtime?.adapter || null,
    sideEffect: spec.sideEffect || 'none',
    capabilityId: spec.id || null,
    active: spec.active !== false
  };
}

function listActions() {
  return Object.keys(CAPABILITIES)
    .sort()
    .map(action => getActionDescriptor(action));
}


function getCapability(action) {
  return CAPABILITIES[
    String(action || '').trim()
  ] || null;
}


function getService(serviceCode) {
  return SERVICES[
    String(serviceCode || '').trim()
  ] || null;
}


function listCapabilities() {
  return Object.entries(CAPABILITIES)
    .map(([action, spec]) => ({
      action,
      ...spec
    }));
}


function listServices() {
  return Object.values(SERVICES);
}


function validateCapabilityInput(
  action,
  input = {}
) {
  const spec = getCapability(action);

  if (!spec) {
    return {
      valid: false,
      code: 'UNKNOWN_CAPABILITY',
      missing: []
    };
  }

  if (spec.active === false) {
    return {
      valid: false,
      code: 'CAPABILITY_DISABLED',
      missing: [],
      spec
    };
  }

  const missing =
    (spec.required || []).filter(
      key =>
        input[key] === undefined ||
        input[key] === null ||
        input[key] === ''
    );

  for (const group of spec.requiredAny || []) {
    if (
      !group.some(
        key =>
          input[key] !== undefined &&
          input[key] !== null &&
          input[key] !== ''
      )
    ) {
      missing.push(group.join('|'));
    }
  }

  return {
    valid: missing.length === 0,
    code:
      missing.length > 0
        ? 'MISSING_INPUTS'
        : null,
    missing,
    spec
  };
}


module.exports = {
  CAPABILITIES,
  SERVICES,
  GOVERNANCE,
  ACTION_TYPES,
  inferActionType,
  getActionDescriptor,
  listActions,
  getCapability,
  getService,
  listCapabilities,
  listServices,
  validateCapabilityInput
};
