'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const { verifyProduction }=require('../../lib/release/production-verification');

const SHA='e44a1cd3f52b0da8be1c56e2720ef6de1bb77bed';

function staged(){
  return {release_id:'staged-'+'a'.repeat(24),status:'staging_verified',deployed_sha:SHA};
}

describe('Phase 5 production verification',()=>{
  test('verifies production only on exact SHA and passing checks',()=>{
    const r=verifyProduction({
      stagedVerification:staged(),
      productionSha:SHA,
      expectedReleaseSha:SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'readiness',passed:true,code:'OK'},
        {id:'smoke',passed:true,code:'OK'}
      ]
    });
    expect(r.status).toBe('production_verified');
    expect(r.state).toBe(STATES.VERIFIED);
    expect(r.policy.known_good_eligible).toBe(true);
    expect(r.policy.auto_rollback).toBe(false);
  });

  test('rejects production SHA mismatch',()=>{
    expect(()=>verifyProduction({
      stagedVerification:staged(),
      productionSha:'1'.repeat(40),
      expectedReleaseSha:SHA,
      checks:[{id:'health',passed:true,code:'OK'}]
    })).toThrow('PRODUCTION_SHA_MISMATCH');
  });

  test('blocks failed production checks and requires rollback decision',()=>{
    const r=verifyProduction({
      stagedVerification:staged(),
      productionSha:SHA,
      expectedReleaseSha:SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'smoke',passed:false,code:'SMOKE_FAILED'}
      ]
    });
    expect(r.status).toBe('blocked');
    expect(r.state).toBe(STATES.BLOCKED);
    expect(r.policy.rollback_required).toBe(true);
    expect(r.policy.known_good_eligible).toBe(false);
  });

  test('requires staging verification first',()=>{
    expect(()=>verifyProduction({
      stagedVerification:{status:'staging_required',deployed_sha:SHA},
      productionSha:SHA,
      expectedReleaseSha:SHA,
      checks:[{id:'health',passed:true,code:'OK'}]
    })).toThrow('PRODUCTION_STAGING_NOT_VERIFIED');
  });
});
