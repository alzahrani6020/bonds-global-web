'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');
const { selectKnownGoodRelease }=require('./known-good-releases');

const ROLLBACK_ORCHESTRATION_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;

function clean(v,max=300){
  if(v===null||v===undefined)return null;
  const s=String(v).trim();
  return s?s.slice(0,max):null;
}
function assertSha(v,code){
  const s=clean(v,40);
  if(!s||!SHA_RE.test(s)) throw new Error(code);
  return s;
}
function normalizeReason(reason){
  const code=clean(reason?.code,160);
  const detail=clean(reason?.detail,500);
  if(!code) throw new Error('ROLLBACK_REASON_REQUIRED');
  return {code,detail};
}

function createRollbackPlan({
  currentProductionSha,
  knownGoodReleases=[],
  reason,
  requestedBy
}={}){
  const current=assertSha(currentProductionSha,'ROLLBACK_CURRENT_SHA_INVALID');
  const requester=clean(requestedBy,160);
  if(!requester) throw new Error('ROLLBACK_REQUESTER_REQUIRED');
  const rollbackReason=normalizeReason(reason);

  const target=selectKnownGoodRelease({
    releases:knownGoodReleases,
    excludeSha:current
  });
  if(!target) throw new Error('ROLLBACK_KNOWN_GOOD_TARGET_REQUIRED');

  const targetSha=assertSha(target.release_sha,'ROLLBACK_TARGET_SHA_INVALID');
  if(targetSha===current) throw new Error('ROLLBACK_TARGET_EQUALS_CURRENT');

  const material={
    current_production_sha:current,
    target_known_good_id:target.known_good_id,
    target_release_sha:targetSha,
    reason:rollbackReason,
    requested_by:requester
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  return {
    version:ROLLBACK_ORCHESTRATION_VERSION,
    rollback_id:'rollback-'+digest.slice(0,24),
    status:'approval_required',
    state:STATES.BLOCKED,
    digest,
    ...material,
    policy:{
      deterministic:true,
      known_good_only:true,
      exact_current_sha_required:true,
      exact_target_sha_required:true,
      approval_required:true,
      execution_authorized:false,
      auto_rollback:false,
      auto_deploy:false,
      post_rollback_verification_required:true
    }
  };
}

function approveRollback({plan,approvedBy,currentProductionSha}={}){
  if(!plan||plan.status!=='approval_required') throw new Error('ROLLBACK_PLAN_REQUIRED');
  const approver=clean(approvedBy,160);
  if(!approver) throw new Error('ROLLBACK_APPROVER_REQUIRED');
  const current=assertSha(currentProductionSha,'ROLLBACK_CURRENT_SHA_INVALID');
  if(current!==plan.current_production_sha) throw new Error('ROLLBACK_CURRENT_SHA_MOVED');

  return {
    ...plan,
    status:'approved',
    state:STATES.ROLLED_BACK,
    approval:{approved_by:approver},
    policy:{
      ...plan.policy,
      approval_required:false,
      execution_authorized:false,
      auto_rollback:false,
      auto_deploy:false,
      post_rollback_verification_required:true
    }
  };
}

function verifyRollback({approvedPlan,deployedSha,checks=[]}={}){
  if(!approvedPlan||approvedPlan.status!=='approved') throw new Error('ROLLBACK_APPROVED_PLAN_REQUIRED');
  const deployed=assertSha(deployedSha,'ROLLBACK_DEPLOYED_SHA_INVALID');
  if(deployed!==approvedPlan.target_release_sha) throw new Error('ROLLBACK_DEPLOYED_SHA_MISMATCH');
  if(!Array.isArray(checks)||!checks.length) throw new Error('ROLLBACK_CHECKS_REQUIRED');

  const normalized=checks.map(c=>{
    if(!c||typeof c!=='object'||Array.isArray(c)) throw new Error('ROLLBACK_CHECK_INVALID');
    const id=clean(c.id,200);
    const code=clean(c.code,160);
    if(!id||!code||typeof c.passed!=='boolean') throw new Error('ROLLBACK_CHECK_INVALID');
    return {id,passed:c.passed,code};
  }).sort((a,b)=>a.id.localeCompare(b.id));

  const failed=normalized.filter(c=>c.passed!==true);

  return {
    version:ROLLBACK_ORCHESTRATION_VERSION,
    rollback_id:approvedPlan.rollback_id,
    status:failed.length?'blocked':'rollback_verified',
    state:failed.length?STATES.BLOCKED:STATES.VERIFIED,
    deployed_sha:deployed,
    checks:normalized,
    blockers:failed,
    policy:{
      execution_authorized:false,
      auto_rollback:false,
      auto_deploy:false,
      production_verified:failed.length===0
    }
  };
}

module.exports={
  ROLLBACK_ORCHESTRATION_VERSION,
  createRollbackPlan,
  approveRollback,
  verifyRollback
};
