'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  registerDataset,
  deidentifyDataset,
  createTrainingJob,
  scheduleTrainingJobs,
  registerModelCandidate,
  benchmarkCandidate,
  promoteModel,
  buildModelRollback
}=require('../../lib/training/self-training');

const ARTIFACT='a'.repeat(40);

function readyDataset(){
  return registerDataset({
    name:'golden-conversations',
    source:'assistant-evaluations',
    purpose:'self-training',
    records:100,
    containsPersonalData:false,
    license:'internal-approved',
    provenance:{origin:'core-b',evidence_id:'evidence-1',created_by:'system'}
  });
}

describe('Phase 6 consolidated self-training',()=>{
  test('dataset registry requires provenance inputs and flags personal data',()=>{
    const ds=registerDataset({
      name:'private-set',
      source:'assistant',
      purpose:'training',
      records:10,
      containsPersonalData:true,
      license:'internal-approved'
    });
    expect(ds.status).toBe('deidentification_required');
    expect(ds.policy.raw_personal_data_training).toBe(false);
  });

  test('de-identification produces ready child dataset without personal-data flag',()=>{
    const ds=registerDataset({
      name:'private-set',
      source:'assistant',
      purpose:'training',
      records:10,
      containsPersonalData:true,
      license:'internal-approved'
    });
    const deid=deidentifyDataset({dataset:ds,fields:['email','phone'],strategy:'remove'});
    expect(deid.status).toBe('ready');
    expect(deid.contains_personal_data).toBe(false);
    expect(deid.parent_dataset_id).toBe(ds.dataset_id);
  });

  test('training queue records WAITING_FOR_CAPACITY instead of dropping job',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'BondsNativeProvider/qwen',
      objective:'improve financial reasoning',
      requirements:{min_profile:'HIGH',gpu_required:true}
    });
    const result=scheduleTrainingJobs({
      jobs:[job],
      profile:{
        runnable:true,
        execution_profile:'MINIMAL',
        parallel_agents:1,
        snapshot:{free_ram_gb:4,gpu_available:false}
      }
    });
    expect(result.waiting_for_capacity).toHaveLength(1);
    expect(result.waiting_for_capacity[0].state).toBe(STATES.WAITING_FOR_CAPACITY);
  });

  test('production workload can pause self-training without losing the job',()=>{
    const train=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'BondsNativeProvider/qwen',
      objective:'improve financial reasoning'
    });
    const prod={id:'prod',kind:'production_user_request',core:'operational',requirements:{}};
    const result=scheduleTrainingJobs({
      jobs:[train,prod],
      profile:{
        runnable:true,
        execution_profile:'BALANCED',
        parallel_agents:1,
        snapshot:{free_ram_gb:16,gpu_available:true}
      }
    });
    expect(result.runnable[0].id).toBe('prod');
    expect(result.paused.some(j=>j.job_id===train.job_id)).toBe(true);
  });

  test('model registry binds candidate to exact artifact SHA and training provenance',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'BondsNativeProvider/qwen',
      objective:'improve financial reasoning'
    });
    const model=registerModelCandidate({
      trainingJob:job,
      artifactSha:ARTIFACT,
      modelName:'bonds-finance-candidate',
      metrics:{loss:0.21},
      provenance:{runtime_profile:'HIGH',checkpoint_id:'ckpt-1'}
    });
    expect(model.status).toBe('candidate');
    expect(model.artifact_sha).toBe(ARTIFACT);
    expect(model.provenance.dataset_id).toBe(job.dataset_id);
  });

  test('benchmark blocks candidate on regression',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'base',
      objective:'improve'
    });
    const candidate=registerModelCandidate({
      trainingJob:job,
      artifactSha:ARTIFACT,
      modelName:'candidate'
    });
    const result=benchmarkCandidate({
      candidate,
      baseline:{model_id:'baseline-1'},
      suites:[{id:'finance',candidate_score:0.80,baseline_score:0.90,max_regression:0.02}]
    });
    expect(result.status).toBe('blocked');
    expect(result.state).toBe(STATES.BLOCKED);
  });

  test('benchmark verifies candidate when all suites satisfy thresholds',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'base',
      objective:'improve'
    });
    const candidate=registerModelCandidate({
      trainingJob:job,
      artifactSha:ARTIFACT,
      modelName:'candidate'
    });
    const result=benchmarkCandidate({
      candidate,
      baseline:{model_id:'baseline-1'},
      suites:[
        {id:'finance',candidate_score:0.93,baseline_score:0.90,min_delta:0.01},
        {id:'safety',candidate_score:0.99,baseline_score:0.99,max_regression:0}
      ]
    });
    expect(result.status).toBe('ready_for_promotion');
    expect(result.state).toBe(STATES.VERIFIED);
  });

  test('promotion requires benchmark pass and explicit approval while preserving rollback target',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'base',
      objective:'improve'
    });
    const candidate=registerModelCandidate({
      trainingJob:job,
      artifactSha:ARTIFACT,
      modelName:'candidate'
    });
    const benchmark=benchmarkCandidate({
      candidate,
      baseline:{model_id:'baseline-1'},
      suites:[{id:'finance',candidate_score:0.95,baseline_score:0.90,min_delta:0.01}]
    });
    const promotion=promoteModel({
      benchmark,
      candidate,
      currentProductionModel:{model_id:'model-prod-1',artifact_sha:'b'.repeat(40)},
      approvedBy:'admin'
    });
    expect(promotion.status).toBe('promotion_approved');
    expect(promotion.previous_model_id).toBe('model-prod-1');
    expect(promotion.policy.direct_production_activation).toBe(false);
  });

  test('rollback points only to preserved previous production model',()=>{
    const job=createTrainingJob({
      dataset:readyDataset(),
      baseModel:'base',
      objective:'improve'
    });
    const candidate=registerModelCandidate({
      trainingJob:job,
      artifactSha:ARTIFACT,
      modelName:'candidate'
    });
    const benchmark=benchmarkCandidate({
      candidate,
      baseline:{model_id:'baseline-1'},
      suites:[{id:'finance',candidate_score:0.95,baseline_score:0.90,min_delta:0.01}]
    });
    const promotion=promoteModel({
      benchmark,
      candidate,
      currentProductionModel:{model_id:'model-prod-1',artifact_sha:'b'.repeat(40)},
      approvedBy:'admin'
    });
    const rollback=buildModelRollback({
      promotion,
      currentModelId:candidate.model_id,
      reason:'production regression'
    });
    expect(rollback.target_model_id).toBe('model-prod-1');
    expect(rollback.policy.auto_rollback).toBe(false);
    expect(rollback.policy.post_rollback_benchmark_required).toBe(true);
  });

  test('raw personal dataset cannot enter training queue before de-identification',()=>{
    const ds=registerDataset({
      name:'private-set',
      source:'assistant',
      purpose:'training',
      records:10,
      containsPersonalData:true,
      license:'internal-approved'
    });
    expect(()=>createTrainingJob({
      dataset:ds,
      baseModel:'base',
      objective:'improve'
    })).toThrow('TRAINING_DATASET_NOT_READY');
  });
});
