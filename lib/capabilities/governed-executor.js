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


function actionFabricMetadata(action) {
  const descriptor = getActionDescriptor(action);
  return {
    version: 1,
    action: descriptor?.action || String(action || '').trim() || null,
    action_type: descriptor?.actionType || null,
    service_code: descriptor?.serviceCode || null,
    runtime_adapter: descriptor?.runtimeAdapter || null,
    side_effect: descriptor?.sideEffect || null,
    capability_id: descriptor?.capabilityId || null,
    active: descriptor?.active === true,
    governed: true
  };
}


async function executeCapability(
  action,
  input = {},
  context = {}
) {

  const actionFabric = actionFabricMetadata(action);

  const validation =
    validateCapabilityInput(action, input);

  if (!validation.valid) {
    return {
      ok: false,
      executed: false,
      action,
      action_fabric: actionFabric,
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
      action_fabric: actionFabric,
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
      action_fabric: actionFabric,
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
        latencyMs,
        code: result?.error?.code || null,
        failure_class:
          result?.error?.failure_class ||
          result?.evidence?.fetch?.failure_class ||
          null
      }
    });

    return {
      action,
      service: service.serviceCode,
      action_fabric: actionFabric,
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
  actionFabricMetadata,
  executeCapability
};
