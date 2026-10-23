'use strict';

const {
  validateCapabilityInput,
  getService,
  getActionDescriptor
} = require('./bonds-capability-registry');

const {
  getRuntimeAdapter
} = require('./runtime-adapters');

const {
  evaluateGovernance,
  emitAudit,
  emitMetric
} = require('./governance-gateway');

const {
  evaluateShadowAuthorization,
  compareShadowAuthorization
} = require('../assistant/shadow-authorization');


async function executeCapability(
  action,
  input = {},
  context = {}
) {

  const validation =
    validateCapabilityInput(action, input);

  if (!validation.valid) {
    return {
      ok: false,
      executed: false,
      action,
      error: {
        code: validation.code,
        missing: validation.missing
      },
      httpStatus:
        validation.code === 'UNKNOWN_CAPABILITY'
          ? 404
          : validation.code === 'CAPABILITY_DISABLED'
            ? 403
            : 400
    };
  }


  const capability = validation.spec;

  const service =
    getService(capability.serviceCode);

  const governance =
    await evaluateGovernance({
      service,
      capability,
      context
    });

  const shadowAuthorization =
    compareShadowAuthorization({
      shadow: evaluateShadowAuthorization({
        service,
        capability,
        context
      }),
      actual: governance
    });


  if (!governance.allowed) {
    await emitAudit({
      service,
      capability,
      context,
      status: 'denied',
      detail:
        governance.audit ||
        { code: governance.code }
    });

    return {
      ok: false,
      executed: false,
      action,
      shadow_authorization: shadowAuthorization,
      error: {
        code: governance.code
      },
      httpStatus:
        governance.httpStatus || (governance.code === 'RATE_LIMITED'
          ? 429
          : 403)
    };
  }


  const adapterName =
    capability.runtime?.adapter;

  const adapter =
    getRuntimeAdapter(adapterName);


  if (!adapter) {
    return {
      ok: false,
      executed: false,
      action,
      error: {
        code: 'RUNTIME_ADAPTER_UNAVAILABLE',
        adapter: adapterName || null
      },
      httpStatus: 500
    };
  }


  const startedAt = Date.now();

  await emitAudit({
    service,
    capability,
    context,
    status: 'started',
    detail: {
      serviceToken:
        governance.serviceToken || null
    }
  });


  try {
    const result =
      await adapter(input, context);

    const latencyMs =
      Date.now() - startedAt;

    await emitMetric({
      service,
      capability,
      context,
      status: result.ok === false
        ? 'failed'
        : 'succeeded',
      latencyMs
    });

    await emitAudit({
      service,
      capability,
      context,
      status: result.ok === false
        ? 'failed'
        : 'succeeded',
      detail: {
        latencyMs
      }
    });

    return {
      action,
      service: service.serviceCode,
      action_fabric: {
        version: 1,
        ...(getActionDescriptor(action) || {}),
        governed: true
      },
      governance: {
        enforced: true
      },
      ...result,
      shadow_authorization: shadowAuthorization
    };
  }
  catch (error) {
    const latencyMs =
      Date.now() - startedAt;

    await emitMetric({
      service,
      capability,
      context,
      status: 'failed',
      latencyMs
    });

    await emitAudit({
      service,
      capability,
      context,
      status: 'failed',
      detail: {
        latencyMs,
        error:
          error && error.message
            ? error.message
            : String(error)
      }
    });

    throw error;
  }
}


module.exports = {
  executeCapability
};
