'use strict';

const generated =
  require('./generated-service-registry');

const CAPABILITIES =
  Object.freeze(generated.capabilities);

const SERVICES =
  Object.freeze(generated.services);

const GOVERNANCE =
  Object.freeze(generated.governance);


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
  getCapability,
  getService,
  listCapabilities,
  listServices,
  validateCapabilityInput
};
