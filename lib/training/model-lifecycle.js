'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const MODEL_LIFECYCLE_VERSION=1;
const SHA_RE=/^[0-9a-f]{64}$/;

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}
function assertSha(value,code){
  const sha=clean(value,64)?.toLowerCase();
  if(!sha||!SHA_RE.test(sha)) throw new Error(code);
  return sha;
}
function normalizeChecks(checks,codePrefix){
  if(!Array.isArray(checks)||!checks.length) throw new Error(codePrefix+'_CHECKS_REQUIRED');
  return checks.map(check=>{
    if(!check||typeof check!=='object'||Array.isArray(check)) throw new Error(codePrefix+'_CHECK_INVALID');
    const id=clean(check.id,160);
    const code=clean(check.code,160);
    if(!id||!code||typeof check.passed!=='boolean') throw new Error(codePrefix+'_CHECK_INVALID');
    return {id,passed:check.passed,code};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
function idFor(prefix,material){
  return prefix+'-'+crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0,24);
}

function createModelPromotionPlan({candidate,benchmark,currentProductionModel,requestedBy}={}){
  if(!candidate||candidate.status!=='benchmarked') throw new Error('MODEL_PROMOTION_BENCHMARKED_CANDIDATE_REQUIRED');
  if(!benchmark||benchmark.status!=='benchmark_passed'||benchmark.policy?.promotion_eligible!==true){
    throw new Error('MODEL_PROMOTION_BENCHMARK_PASS_REQUIRED');
  }
  const candidateSha=assertSha(candidate.artifact_sha256,'MODEL_PROMOTION_CANDIDATE_SHA_INVALID');
  const currentSha=assertSha(currentProductionModel?.artifact_sha256,'MODEL_PROMOTION_CURRENT_SHA_INVALID');
  if(benchmark.candidate_sha256!==candidateSha) throw new Error('MODEL_PROMOTION_BENCHMARK_SHA_MISMATCH');
  if(candidateSha===currentSha) throw new Error('MODEL_PROMOTION_CANDIDATE_EQUALS_CURRENT');
  const requester=clean(requestedBy,160);
  if(!requester) throw new Error('MODEL_PROMOTION_REQUESTER_REQUIRED');

  const material={
    candidate_model_id:candidate.model_id,
    candidate_sha256:candidateSha,
    current_model_sha256:currentSha,
    benchmark_id:benchmark.benchmark_id,
    requested_by:requester
  };
  return {
    version:MODEL_LIFECYCLE_VERSION,
    promotion_id:idFor('model-promotion',material),
    status:'approval_required',
    state:STATES.BLOCKED,
    ...material,
    policy:{
      explicit_approval_required:true,
      exact_current_sha_required:true,
      exact_candidate_sha_required:true,
      execution_authorized:false,
      direct_runtime_write:false,
      auto_promote:false
    }
  };
}

function approveModelPromotion({plan,approvedBy,currentModelSha256}={}){
  if(!plan||plan.status!=='approval_required') throw new Error('MODEL_PROMOTION_PLAN_REQUIRED');
  const approver=clean(approvedBy,160);
  if(!approver) throw new Error('MODEL_PROMOTION_APPROVER_REQUIRED');
  const current=assertSha(currentModelSha256,'MODEL_PROMOTION_CURRENT_SHA_INVALID');
  if(current!==plan.current_model_sha256) throw new Error('MODEL_PROMOTION_CURRENT_SHA_MOVED');
  return {
    ...plan,
    status:'approved',
    approval:{approved_by:approver},
    policy:{...plan.policy,explicit_approval_required:false,execution_authorized:false}
  };
}

function verifyModelPromotion({approvedPlan,observedModelSha256,checks}={}){
  if(!approvedPlan||approvedPlan.status!=='approved') throw new Error('MODEL_PROMOTION_APPROVED_PLAN_REQUIRED');
  const observed=assertSha(observedModelSha256,'MODEL_PROMOTION_OBSERVED_SHA_INVALID');
  if(observed!==approvedPlan.candidate_sha256) throw new Error('MODEL_PROMOTION_OBSERVED_SHA_MISMATCH');
  const normalized=normalizeChecks(checks,'MODEL_PROMOTION');
  const blockers=normalized.filter(check=>!check.passed);
  const material={promotion_id:approvedPlan.promotion_id,observed_model_sha256:observed,checks:normalized};
  return {
    version:MODEL_LIFECYCLE_VERSION,
    verification_id:idFor('model-promotion-verification',material),
    status:blockers.length?'blocked':'model_promotion_verified',
    state:blockers.length?STATES.BLOCKED:STATES.VERIFIED,
    observed_model_sha256:observed,
    checks:normalized,
    blockers,
    policy:{
      execution_authorized:false,
      production_verified:blockers.length===0,
      rollback_candidate:blockers.length>0
    }
  };
}

function createModelRollbackPlan({currentModel,targetKnownGoodModel,reason,requestedBy}={}){
  const currentSha=assertSha(currentModel?.artifact_sha256,'MODEL_ROLLBACK_CURRENT_SHA_INVALID');
  if(!targetKnownGoodModel||targetKnownGoodModel.status!=='known_good'||targetKnownGoodModel.policy?.rollback_source_eligible!==true){
    throw new Error('MODEL_ROLLBACK_KNOWN_GOOD_TARGET_REQUIRED');
  }
  const targetSha=assertSha(targetKnownGoodModel.artifact_sha256,'MODEL_ROLLBACK_TARGET_SHA_INVALID');
  if(currentSha===targetSha) throw new Error('MODEL_ROLLBACK_TARGET_EQUALS_CURRENT');
  const reasonCode=clean(reason?.code,160);
  const requester=clean(requestedBy,160);
  if(!reasonCode) throw new Error('MODEL_ROLLBACK_REASON_REQUIRED');
  if(!requester) throw new Error('MODEL_ROLLBACK_REQUESTER_REQUIRED');

  const material={
    current_model_sha256:currentSha,
    target_model_id:targetKnownGoodModel.model_id,
    target_model_sha256:targetSha,
    reason:{code:reasonCode,detail:clean(reason?.detail,500)},
    requested_by:requester
  };
  return {
    version:MODEL_LIFECYCLE_VERSION,
    rollback_id:idFor('model-rollback',material),
    status:'approval_required',
    state:STATES.BLOCKED,
    ...material,
    policy:{
      known_good_only:true,
      explicit_approval_required:true,
      execution_authorized:false,
      direct_runtime_write:false,
      auto_rollback:false
    }
  };
}

function approveModelRollback({plan,approvedBy,currentModelSha256}={}){
  if(!plan||plan.status!=='approval_required') throw new Error('MODEL_ROLLBACK_PLAN_REQUIRED');
  const approver=clean(approvedBy,160);
  if(!approver) throw new Error('MODEL_ROLLBACK_APPROVER_REQUIRED');
  const current=assertSha(currentModelSha256,'MODEL_ROLLBACK_CURRENT_SHA_INVALID');
  if(current!==plan.current_model_sha256) throw new Error('MODEL_ROLLBACK_CURRENT_SHA_MOVED');
  return {
    ...plan,
    status:'approved',
    approval:{approved_by:approver},
    policy:{...plan.policy,explicit_approval_required:false,execution_authorized:false}
  };
}

function verifyModelRollback({approvedPlan,observedModelSha256,checks}={}){
  if(!approvedPlan||approvedPlan.status!=='approved') throw new Error('MODEL_ROLLBACK_APPROVED_PLAN_REQUIRED');
  const observed=assertSha(observedModelSha256,'MODEL_ROLLBACK_OBSERVED_SHA_INVALID');
  if(observed!==approvedPlan.target_model_sha256) throw new Error('MODEL_ROLLBACK_OBSERVED_SHA_MISMATCH');
  const normalized=normalizeChecks(checks,'MODEL_ROLLBACK');
  const blockers=normalized.filter(check=>!check.passed);
  return {
    version:MODEL_LIFECYCLE_VERSION,
    rollback_id:approvedPlan.rollback_id,
    status:blockers.length?'blocked':'model_rollback_verified',
    state:blockers.length?STATES.BLOCKED:STATES.ROLLED_BACK,
    observed_model_sha256:observed,
    checks:normalized,
    blockers,
    policy:{
      execution_authorized:false,
      production_verified:blockers.length===0,
      auto_rollback:false
    }
  };
}

module.exports={
  MODEL_LIFECYCLE_VERSION,
  createModelPromotionPlan,
  approveModelPromotion,
  verifyModelPromotion,
  createModelRollbackPlan,
  approveModelRollback,
  verifyModelRollback
};
