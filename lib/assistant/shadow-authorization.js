'use strict';

const SHADOW_AUTHORIZATION_VERSION = 1;

function hasAll(actual, required) {
  const set = new Set(Array.isArray(actual) ? actual : []);
  return (Array.isArray(required) ? required : []).every(value => set.has(value));
}

function unresolvedDimensions(service = {}) {
  const unresolved = [];
  if (service.security?.serviceTokenRequired === true) unresolved.push('service_token');
  if (Array.isArray(service.governance?.featureFlags) && service.governance.featureFlags.length) {
    unresolved.push('feature_flags');
  }
  if (Number.isInteger(service.limits?.requestsPerMinute) && service.limits.requestsPerMinute > 0) {
    unresolved.push('rate_limit');
  }
  return unresolved;
}

function baseResult(service, capability) {
  return {
    version:SHADOW_AUTHORIZATION_VERSION,
    service:service?.serviceCode || null,
    capability:capability?.action || null,
    outcome:'not_evaluated',
    code:null,
    unresolved:[],
    production_decision_affected:false,
    authorization_granted:false,
    execution_authorized:false,
    auto_execute:false
  };
}

function evaluateShadowAuthorization({service,capability,context={}}={}) {
  const result=baseResult(service,capability);

  if (!service || service.enabled !== true) {
    return {...result,outcome:'would_deny',code:'SERVICE_DISABLED'};
  }
  if (!capability || capability.active === false) {
    return {...result,outcome:'would_deny',code:'CAPABILITY_DISABLED'};
  }
  if (Array.isArray(service.security?.requestedSensitivePrivileges) &&
      service.security.requestedSensitivePrivileges.length > 0) {
    return {...result,outcome:'would_deny',code:'SENSITIVE_PRIVILEGE_NOT_APPROVED'};
  }

  const governance=context.governance || {};
  if (typeof context.actor?.id !== 'string' || !context.actor.id ||
      context.actor.id !== context.userId ||
      !Array.isArray(governance.permissions) ||
      !Array.isArray(governance.entitlements)) {
    return {
      ...result,
      outcome:'not_evaluated',
      code:'USER_GOVERNANCE_UNAVAILABLE',
      unresolved:['user_governance']
    };
  }

  if (!hasAll(governance.permissions,service.governance?.permissions)) {
    return {...result,outcome:'would_deny',code:'PERMISSION_DENIED'};
  }

  if (!hasAll(governance.entitlements,service.governance?.entitlements)) {
    return {...result,outcome:'would_deny',code:'ENTITLEMENT_DENIED'};
  }

  const unresolved=unresolvedDimensions(service);
  if (unresolved.length) {
    return {
      ...result,
      outcome:'not_evaluated',
      code:'SHADOW_AUTHORIZATION_INCOMPLETE',
      unresolved
    };
  }

  return {...result,outcome:'would_allow',code:null};
}

function compareShadowAuthorization({shadow,actual}={}) {
  const safeShadow=shadow && typeof shadow==='object' ? shadow : {
    outcome:'not_evaluated',
    code:'SHADOW_AUTHORIZATION_UNAVAILABLE',
    unresolved:['shadow_evaluator']
  };
  const actualAllowed=actual?.allowed === true;
  const definitive=['would_allow','would_deny'].includes(safeShadow.outcome);
  const shadowAllowed=safeShadow.outcome === 'would_allow';

  return {
    ...safeShadow,
    actual:{
      allowed:actualAllowed,
      code:actual?.code || null
    },
    drift:definitive ? shadowAllowed !== actualAllowed : null,
    enforcement:'production_governance_only',
    production_decision_affected:false,
    authorization_granted:false,
    execution_authorized:false,
    auto_execute:false
  };
}

module.exports={
  SHADOW_AUTHORIZATION_VERSION,
  evaluateShadowAuthorization,
  compareShadowAuthorization
};
