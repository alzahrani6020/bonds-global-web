/** @jest-environment node */

const {
  evaluateShadowAuthorization,
  compareShadowAuthorization
}=require('../../lib/assistant/shadow-authorization');

function service(overrides={}){
  return {
    serviceCode:'svc',
    enabled:true,
    security:{
      requestedSensitivePrivileges:[],
      serviceTokenRequired:false
    },
    governance:{
      permissions:[],
      entitlements:[],
      featureFlags:[]
    },
    limits:{},
    ...overrides
  };
}
function capability(overrides={}){
  return {action:'run',active:true,...overrides};
}
function context(overrides={}){
  return {
    actor:{id:'u1'},
    userId:'u1',
    governance:{permissions:[],entitlements:[]},
    ...overrides
  };
}

describe('Shadow Authorization',()=>{
  test('would allow only when all shadow-evaluable requirements pass',()=>{
    const out=evaluateShadowAuthorization({
      service:service(),
      capability:capability(),
      context:context()
    });
    expect(out).toEqual(expect.objectContaining({
      outcome:'would_allow',
      code:null,
      production_decision_affected:false,
      authorization_granted:false,
      execution_authorized:false
    }));
  });

  test('would deny missing permission without exposing permission names',()=>{
    const out=evaluateShadowAuthorization({
      service:service({
        governance:{permissions:['sensitive.permission'],entitlements:[],featureFlags:[]}
      }),
      capability:capability(),
      context:context()
    });
    expect(out.outcome).toBe('would_deny');
    expect(out.code).toBe('PERMISSION_DENIED');
    expect(JSON.stringify(out)).not.toContain('sensitive.permission');
  });

  test('would deny missing entitlement without exposing entitlement names',()=>{
    const out=evaluateShadowAuthorization({
      service:service({
        governance:{permissions:[],entitlements:['private.entitlement'],featureFlags:[]}
      }),
      capability:capability(),
      context:context()
    });
    expect(out.outcome).toBe('would_deny');
    expect(out.code).toBe('ENTITLEMENT_DENIED');
    expect(JSON.stringify(out)).not.toContain('private.entitlement');
  });

  test('marks token, feature flag and rate limit dimensions not evaluated',()=>{
    const out=evaluateShadowAuthorization({
      service:service({
        security:{requestedSensitivePrivileges:[],serviceTokenRequired:true},
        governance:{permissions:[],entitlements:[],featureFlags:[{key:'x'}]},
        limits:{requestsPerMinute:10}
      }),
      capability:capability(),
      context:context()
    });
    expect(out.outcome).toBe('not_evaluated');
    expect(out.code).toBe('SHADOW_AUTHORIZATION_INCOMPLETE');
    expect(out.unresolved).toEqual(['service_token','feature_flags','rate_limit']);
  });

  test('comparison detects drift but grants no authority',()=>{
    const out=compareShadowAuthorization({
      shadow:evaluateShadowAuthorization({
        service:service(),capability:capability(),context:context()
      }),
      actual:{allowed:false,code:'RATE_LIMITED'}
    });
    expect(out.outcome).toBe('would_allow');
    expect(out.actual).toEqual({allowed:false,code:'RATE_LIMITED'});
    expect(out.drift).toBe(true);
    expect(out.enforcement).toBe('production_governance_only');
    expect(out.production_decision_affected).toBe(false);
    expect(out.authorization_granted).toBe(false);
  });

  test('incomplete shadow outcome never claims drift',()=>{
    const out=compareShadowAuthorization({
      shadow:{
        outcome:'not_evaluated',
        code:'SHADOW_AUTHORIZATION_INCOMPLETE',
        unresolved:['service_token']
      },
      actual:{allowed:true,code:null}
    });
    expect(out.drift).toBeNull();
  });
});
