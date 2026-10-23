'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const { createKnownGoodRelease }=require('../../lib/release/known-good-releases');
const {
  createRollbackPlan,
  approveRollback,
  verifyRollback
}=require('../../lib/release/rollback-orchestration');

const CURRENT='11b0b3ef3fe080c808475d53641a881736f44f8b';
const OLD='1'.repeat(40);

function knownGood(){
  return createKnownGoodRelease({
    productionVerification:{
      verification_id:'prod-'+'a'.repeat(24),
      status:'production_verified',
      state:STATES.VERIFIED,
      production_sha:OLD,
      checks:[{id:'health',passed:true,code:'OK'}],
      policy:{known_good_eligible:true}
    },
    releaseSha:OLD
  });
}

describe('Phase 5 rollback orchestration',()=>{
  test('creates approval-required rollback plan to different known-good SHA',()=>{
    const plan=createRollbackPlan({
      currentProductionSha:CURRENT,
      knownGoodReleases:[knownGood()],
      reason:{code:'PRODUCTION_REGRESSION'},
      requestedBy:'owner'
    });
    expect(plan.status).toBe('approval_required');
    expect(plan.target_release_sha).toBe(OLD);
    expect(plan.policy.known_good_only).toBe(true);
    expect(plan.policy.auto_rollback).toBe(false);
    expect(plan.policy.execution_authorized).toBe(false);
  });

  test('fails closed when no prior known-good release exists',()=>{
    expect(()=>createRollbackPlan({
      currentProductionSha:CURRENT,
      knownGoodReleases:[],
      reason:{code:'PRODUCTION_REGRESSION'},
      requestedBy:'owner'
    })).toThrow('ROLLBACK_KNOWN_GOOD_TARGET_REQUIRED');
  });

  test('approval is invalidated when current production SHA moved',()=>{
    const plan=createRollbackPlan({
      currentProductionSha:CURRENT,
      knownGoodReleases:[knownGood()],
      reason:{code:'PRODUCTION_REGRESSION'},
      requestedBy:'owner'
    });
    expect(()=>approveRollback({
      plan,
      approvedBy:'owner',
      currentProductionSha:'2'.repeat(40)
    })).toThrow('ROLLBACK_CURRENT_SHA_MOVED');
  });

  test('approved rollback still grants no automatic execution authority',()=>{
    const plan=createRollbackPlan({
      currentProductionSha:CURRENT,
      knownGoodReleases:[knownGood()],
      reason:{code:'PRODUCTION_REGRESSION'},
      requestedBy:'owner'
    });
    const approved=approveRollback({
      plan,
      approvedBy:'owner',
      currentProductionSha:CURRENT
    });
    expect(approved.status).toBe('approved');
    expect(approved.state).toBe(STATES.BLOCKED);
    expect(approved.policy.execution_authorized).toBe(false);
    expect(approved.policy.post_rollback_verification_required).toBe(true);
  });

  test('verifies rollback only when deployed SHA equals known-good target and checks pass',()=>{
    const approved=approveRollback({
      plan:createRollbackPlan({
        currentProductionSha:CURRENT,
        knownGoodReleases:[knownGood()],
        reason:{code:'PRODUCTION_REGRESSION'},
        requestedBy:'owner'
      }),
      approvedBy:'owner',
      currentProductionSha:CURRENT
    });
    const result=verifyRollback({
      approvedPlan:approved,
      deployedSha:OLD,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'smoke',passed:true,code:'OK'}
      ]
    });
    expect(result.status).toBe('rollback_verified');
    expect(result.state).toBe(STATES.ROLLED_BACK);
    expect(result.policy.production_verified).toBe(true);
  });

  test('failed post-rollback check remains BLOCKED',()=>{
    const approved=approveRollback({
      plan:createRollbackPlan({
        currentProductionSha:CURRENT,
        knownGoodReleases:[knownGood()],
        reason:{code:'PRODUCTION_REGRESSION'},
        requestedBy:'owner'
      }),
      approvedBy:'owner',
      currentProductionSha:CURRENT
    });
    const result=verifyRollback({
      approvedPlan:approved,
      deployedSha:OLD,
      checks:[{id:'smoke',passed:false,code:'SMOKE_FAILED'}]
    });
    expect(result.status).toBe('blocked');
    expect(result.state).toBe(STATES.BLOCKED);
    expect(result.policy.production_verified).toBe(false);
  });
});
