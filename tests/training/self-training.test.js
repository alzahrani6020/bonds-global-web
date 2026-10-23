/** @jest-environment node */

const canonicalModel=require('../../services/bonds_native_inference/canonical-model.json');
const { createTrainingDataset }=require('../../lib/training/dataset-registry');
const { createTrainingJob,evaluateTrainingQueue }=require('../../lib/training/training-queue');
const { createModelRecord,markModelBenchmarked,markModelKnownGood }=require('../../lib/training/model-registry');
const { evaluateCandidateModel }=require('../../lib/training/model-benchmark');
const {
  createModelPromotionPlan,
  approveModelPromotion,
  verifyModelPromotion,
  createModelRollbackPlan,
  approveModelRollback,
  verifyModelRollback
}=require('../../lib/training/model-lifecycle');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');

const BASE_SHA=canonicalModel.sha256;
const CANDIDATE_SHA='1'.repeat(64);

function dataset(){
  return createTrainingDataset({
    datasetId:'assistant-corrections-v1',
    examples:[{
      input:'Contact me at person@example.com or +966501234567',
      target:'safe answer',
      email:'person@example.com',
      national_id:'1234567890',
      metadata:{language:'ar'}
    }],
    provenance:{
      source:'assistant_outcomes',
      source_type:'verified_corrections',
      language:'ar',
      domain:'financial_assistant',
      task_type:'correction',
      consent_basis:'approved_deidentified_only'
    }
  });
}

function baseModel(status='production'){
  return createModelRecord({
    modelId:'bonds-canonical-v1',
    artifactSha256:BASE_SHA,
    sourceRepository:canonicalModel.source_repository,
    sourceRevision:canonicalModel.source_revision,
    license:canonicalModel.license,
    status
  });
}

function candidateModel(){
  return createModelRecord({
    modelId:'bonds-candidate-v2',
    artifactSha256:CANDIDATE_SHA,
    parentModelId:'bonds-canonical-v1',
    datasetDigest:dataset().dataset_digest,
    trainingJobId:'train-1',
    sourceRepository:'local-training',
    sourceRevision:'candidate-v2',
    license:'Apache-2.0',
    status:'candidate'
  });
}

function passingBenchmark(candidate=candidateModel()){
  return evaluateCandidateModel({
    candidate,
    baseline:baseModel(),
    checks:[
      {id:'safety',passed:true,code:'OK',candidate_value:0,baseline_value:0},
      {id:'quality',passed:true,code:'OK',candidate_value:0.92,baseline_value:0.89},
      {id:'financial_determinism',passed:true,code:'OK',candidate_value:0,baseline_value:0}
    ]
  });
}

describe('Phase 6 Self-Training',()=>{
  test('dataset registry de-identifies sensitive fields and string patterns before eligibility',()=>{
    const d=dataset();
    expect(d.status).toBe('registered');
    expect(d.policy.deidentified_only).toBe(true);
    expect(d.policy.raw_sensitive_data_allowed).toBe(false);
    expect(d.examples[0].email).toBeUndefined();
    expect(d.examples[0].national_id).toBeUndefined();
    expect(d.examples[0].input).toContain('[REDACTED_EMAIL]');
    expect(d.examples[0].input).toContain('[REDACTED_PHONE]');
    expect(d.deidentification.removed_field_count).toBeGreaterThanOrEqual(2);
    expect(d.deidentification.pattern_redaction_count).toBeGreaterThanOrEqual(2);
  });

  test('dataset digest is deterministic for identical sanitized material',()=>{
    const first=dataset();
    const second=dataset();
    expect(second.dataset_digest).toBe(first.dataset_digest);
  });

  test('training queue respects hardware capacity and production-priority scheduler semantics',()=>{
    const d=dataset();
    const job=createTrainingJob({
      jobId:'train-1',
      dataset:d,
      baseModel:baseModel(),
      approvedTargetId:'approved-target-1'
    });

    const minimal=evaluateTrainingQueue({
      jobs:[job],
      profile:{
        runnable:true,
        execution_profile:'MINIMAL',
        parallel_agents:1,
        snapshot:{free_ram_gb:12,gpu_available:false}
      }
    });
    expect(minimal.waiting_for_capacity).toEqual(['train-1']);

    const balanced=evaluateTrainingQueue({
      jobs:[job],
      profile:{
        runnable:true,
        execution_profile:'BALANCED',
        parallel_agents:2,
        snapshot:{free_ram_gb:16,gpu_available:false}
      }
    });
    expect(balanced.runnable).toEqual(['train-1']);
    expect(job.policy.auto_train).toBe(false);
    expect(job.policy.execution_authorized).toBe(false);
  });

  test('candidate model benchmark fails closed if any deterministic check fails',()=>{
    const result=evaluateCandidateModel({
      candidate:candidateModel(),
      baseline:baseModel(),
      checks:[
        {id:'quality',passed:true,code:'OK'},
        {id:'safety',passed:false,code:'SAFETY_REGRESSION'}
      ]
    });
    expect(result.status).toBe('blocked');
    expect(result.policy.promotion_eligible).toBe(false);
    expect(result.blockers).toHaveLength(1);
  });

  test('model promotion requires benchmark, explicit approval, exact current SHA and post-promotion verification',()=>{
    const candidate=candidateModel();
    const benchmark=passingBenchmark(candidate);
    const benchmarked=markModelBenchmarked({model:candidate,benchmark});
    const current=baseModel();

    const plan=createModelPromotionPlan({
      candidate:benchmarked,
      benchmark,
      currentProductionModel:current,
      requestedBy:'owner'
    });
    expect(plan.status).toBe('approval_required');
    expect(plan.policy.auto_promote).toBe(false);
    expect(plan.policy.execution_authorized).toBe(false);

    expect(()=>approveModelPromotion({
      plan,
      approvedBy:'owner',
      currentModelSha256:'2'.repeat(64)
    })).toThrow('MODEL_PROMOTION_CURRENT_SHA_MOVED');

    const approved=approveModelPromotion({
      plan,
      approvedBy:'owner',
      currentModelSha256:BASE_SHA
    });
    expect(approved.status).toBe('approved');
    expect(approved.policy.execution_authorized).toBe(false);

    const verification=verifyModelPromotion({
      approvedPlan:approved,
      observedModelSha256:CANDIDATE_SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'native_smoke',passed:true,code:'OK'}
      ]
    });
    expect(verification.status).toBe('model_promotion_verified');
    expect(verification.state).toBe(STATES.VERIFIED);
    expect(verification.policy.production_verified).toBe(true);

    const knownGood=markModelKnownGood({
      model:benchmarked,
      promotionVerification:verification
    });
    expect(knownGood.status).toBe('known_good');
    expect(knownGood.policy.rollback_source_eligible).toBe(true);
  });

  test('model rollback accepts only explicit known-good target and marks rolled back only after verification',()=>{
    const candidate=candidateModel();
    const benchmark=passingBenchmark(candidate);
    const benchmarked=markModelBenchmarked({model:candidate,benchmark});
    const promotionPlan=createModelPromotionPlan({
      candidate:benchmarked,
      benchmark,
      currentProductionModel:baseModel(),
      requestedBy:'owner'
    });
    const approvedPromotion=approveModelPromotion({
      plan:promotionPlan,
      approvedBy:'owner',
      currentModelSha256:BASE_SHA
    });
    const promotionVerification=verifyModelPromotion({
      approvedPlan:approvedPromotion,
      observedModelSha256:CANDIDATE_SHA,
      checks:[{id:'health',passed:true,code:'OK'}]
    });
    const promotedKnownGood=markModelKnownGood({
      model:benchmarked,
      promotionVerification
    });

    const priorKnownGood=createModelRecord({
      modelId:'bonds-canonical-known-good',
      artifactSha256:BASE_SHA,
      sourceRepository:canonicalModel.source_repository,
      sourceRevision:canonicalModel.source_revision,
      license:canonicalModel.license,
      status:'known_good'
    });
    priorKnownGood.policy.rollback_source_eligible=true;

    expect(()=>createModelRollbackPlan({
      currentModel:promotedKnownGood,
      targetKnownGoodModel:baseModel(),
      reason:{code:'MODEL_REGRESSION'},
      requestedBy:'owner'
    })).toThrow('MODEL_ROLLBACK_KNOWN_GOOD_TARGET_REQUIRED');

    const plan=createModelRollbackPlan({
      currentModel:promotedKnownGood,
      targetKnownGoodModel:priorKnownGood,
      reason:{code:'MODEL_REGRESSION'},
      requestedBy:'owner'
    });
    expect(plan.status).toBe('approval_required');
    expect(plan.state).toBe(STATES.BLOCKED);
    expect(plan.policy.auto_rollback).toBe(false);

    const approved=approveModelRollback({
      plan,
      approvedBy:'owner',
      currentModelSha256:CANDIDATE_SHA
    });
    expect(approved.status).toBe('approved');
    expect(approved.state).toBe(STATES.BLOCKED);

    const verified=verifyModelRollback({
      approvedPlan:approved,
      observedModelSha256:BASE_SHA,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'native_smoke',passed:true,code:'OK'}
      ]
    });
    expect(verified.status).toBe('model_rollback_verified');
    expect(verified.state).toBe(STATES.ROLLED_BACK);
    expect(verified.policy.production_verified).toBe(true);
  });
});
