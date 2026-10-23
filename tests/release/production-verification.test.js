'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  verifyProduction,
  assertProductionVerified
}=require('../../lib/release/production-verification');

const SHA='f9554f88253cd27089b0321ca54997f21a83a117';

function staged(overrides={}){
  return {
    release_id:'staged-'+'a'.repeat(24),
    status:'staging_verified',
    state:STATES.MERGED,
    deployed_sha:SHA,
    policy:{
      production_promotion:false,
      promotion_requires_next_gate:true,
      execution_authorized:false,
      auto_promote:false,
      auto_deploy:false
    },
    ...overrides
  };
}

describe('Phase 5 deterministic production verification',()=>{
  test('returns VERIFIED only when exact production SHA and all checks pass',()=>{
    const result=verifyProduction({
      stagedVerification:staged(),
      expectedProductionSha:SHA,
      observedProductionSha:SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'readiness',passed:true,code:'OK'},
        {id:'authenticated-smoke',passed:true,code:'OK'},
        {id:'synthetic-journeys',passed:true,code:'OK'}
      ]
    });

    expect(result.status).toBe('production_verified');
    expect(result.state).toBe(STATES.VERIFIED);
    expect(result.expected_production_sha).toBe(SHA);
    expect(result.observed_production_sha).toBe(SHA);
    expect(result.blockers).toEqual([]);
    expect(result.policy).toEqual({
      deterministic:true,
      exact_sha_verified:true,
      direct_production_write:false,
      execution_authorized:false,
      auto_rollback:false,
      auto_deploy:false
    });
  });

  test('rejects staging evidence that is not verified',()=>{
    expect(()=>verifyProduction({
      stagedVerification:staged({status:'blocked'}),
      expectedProductionSha:SHA,
      observedProductionSha:SHA,
      checks:[{id:'health',passed:true,code:'OK'}]
    })).toThrow('PRODUCTION_VERIFICATION_STAGING_NOT_VERIFIED');
  });

  test('rejects production SHA mismatch',()=>{
    expect(()=>verifyProduction({
      stagedVerification:staged(),
      expectedProductionSha:SHA,
      observedProductionSha:'1'.repeat(40),
      checks:[{id:'health',passed:true,code:'OK'}]
    })).toThrow('PRODUCTION_VERIFICATION_PRODUCTION_SHA_MISMATCH');
  });

  test('fails closed when any production check fails',()=>{
    const result=verifyProduction({
      stagedVerification:staged(),
      expectedProductionSha:SHA,
      observedProductionSha:SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'readiness',passed:false,code:'READINESS_FAILED'}
      ]
    });

    expect(result.status).toBe('blocked');
    expect(result.state).toBe(STATES.BLOCKED);
    expect(result.blockers).toEqual([
      {id:'readiness',passed:false,code:'READINESS_FAILED'}
    ]);
    expect(result.policy.rollback_candidate).toBe(true);
    expect(result.policy.auto_rollback).toBe(false);
  });

  test('assert helper fails closed with structured result',()=>{
    expect(()=>assertProductionVerified({
      stagedVerification:staged(),
      expectedProductionSha:SHA,
      observedProductionSha:SHA,
      checks:[{id:'smoke',passed:false,code:'SMOKE_FAILED'}]
    })).toThrow('PRODUCTION_VERIFICATION_BLOCKED');
  });
});
