'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');
const { schedule }=require('../dual-core/resource-scheduler');

const SELF_TRAINING_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;

function clean(v,max=500){
  if(v===null||v===undefined)return null;
  const s=String(v).trim();
  return s?s.slice(0,max):null;
}
function hash(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function assertSha(v,code){
  const s=clean(v,40);
  if(!s||!SHA_RE.test(s)) throw new Error(code);
  return s;
}
function normalizeStringArray(values,code){
  if(!Array.isArray(values)) throw new Error(code);
  return [...new Set(values.map(v=>clean(v,200)).filter(Boolean))].sort();
}

function registerDataset({
  name,
  source,
  purpose,
  records,
  containsPersonalData=false,
  license,
  provenance={}
}={}){
  const datasetName=clean(name,160);
  const datasetSource=clean(source,240);
  const datasetPurpose=clean(purpose,300);
  const datasetLicense=clean(license,120);
  const count=Number(records);

  if(!datasetName) throw new Error('TRAINING_DATASET_NAME_REQUIRED');
  if(!datasetSource) throw new Error('TRAINING_DATASET_SOURCE_REQUIRED');
  if(!datasetPurpose) throw new Error('TRAINING_DATASET_PURPOSE_REQUIRED');
  if(!Number.isInteger(count)||count<1) throw new Error('TRAINING_DATASET_RECORDS_INVALID');
  if(!datasetLicense) throw new Error('TRAINING_DATASET_LICENSE_REQUIRED');

  const material={
    name:datasetName,
    source:datasetSource,
    purpose:datasetPurpose,
    records:count,
    contains_personal_data:Boolean(containsPersonalData),
    license:datasetLicense,
    provenance:{
      origin:clean(provenance.origin,240),
      evidence_id:clean(provenance.evidence_id,200),
      created_by:clean(provenance.created_by,160)
    }
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    dataset_id:'dataset-'+digest.slice(0,24),
    status:containsPersonalData?'deidentification_required':'ready',
    digest,
    ...material,
    policy:{
      provenance_required:true,
      deidentification_required:Boolean(containsPersonalData),
      raw_personal_data_training:false,
      immutable_source_record:true
    }
  };
}

function deidentifyDataset({dataset,fields=[],strategy='remove'}={}){
  if(!dataset||!dataset.dataset_id) throw new Error('TRAINING_DATASET_REQUIRED');
  if(!['remove','tokenize','generalize'].includes(strategy)) throw new Error('TRAINING_DEIDENTIFICATION_STRATEGY_INVALID');

  const normalizedFields=normalizeStringArray(fields,'TRAINING_DEIDENTIFICATION_FIELDS_INVALID');
  if(dataset.contains_personal_data && !normalizedFields.length){
    throw new Error('TRAINING_DEIDENTIFICATION_FIELDS_REQUIRED');
  }

  const material={
    source_dataset_id:dataset.dataset_id,
    source_digest:dataset.digest,
    strategy,
    fields:normalizedFields
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    dataset_id:'dataset-deid-'+digest.slice(0,24),
    parent_dataset_id:dataset.dataset_id,
    status:'ready',
    records:dataset.records,
    contains_personal_data:false,
    digest,
    transformation:material,
    policy:{
      raw_personal_data_training:false,
      reversible_mapping_exposed:false,
      provenance_preserved:true
    }
  };
}

function createTrainingJob({
  dataset,
  baseModel,
  objective,
  requirements={},
  hyperparameters={}
}={}){
  if(!dataset||dataset.status!=='ready') throw new Error('TRAINING_DATASET_NOT_READY');

  const model=clean(baseModel,200);
  const goal=clean(objective,500);
  if(!model) throw new Error('TRAINING_BASE_MODEL_REQUIRED');
  if(!goal) throw new Error('TRAINING_OBJECTIVE_REQUIRED');

  const normalizedRequirements={
    min_profile:clean(requirements.min_profile,40)||'MINIMAL',
    min_free_ram_gb:Number(requirements.min_free_ram_gb||0),
    gpu_required:Boolean(requirements.gpu_required)
  };
  const material={
    dataset_id:dataset.dataset_id,
    dataset_digest:dataset.digest,
    base_model:model,
    objective:goal,
    requirements:normalizedRequirements,
    hyperparameters
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    job_id:'train-'+digest.slice(0,24),
    kind:'training',
    core:'self_evolving',
    status:'queued',
    state:STATES.APPROVED_TARGET,
    digest,
    ...material,
    policy:{
      deterministic_job_contract:true,
      production_priority_preserved:true,
      capacity_gate_required:true,
      checkpoint_required:true,
      auto_promote_model:false
    }
  };
}

function scheduleTrainingJobs({jobs=[],profile}={}){
  if(!Array.isArray(jobs)||!jobs.length) return {runnable:[],waiting_for_capacity:[],paused:[]};
  if(!profile) throw new Error('TRAINING_PROFILE_REQUIRED');

  const result=schedule(jobs,profile);
  return {
    runnable:result.runnable.map(j=>({...j,status:'runnable',state:STATES.ENGINEERING})),
    waiting_for_capacity:result.waiting_for_capacity.map(j=>({...j,status:'waiting_for_capacity',state:STATES.WAITING_FOR_CAPACITY})),
    paused:result.paused.map(j=>({...j,status:'paused',state:STATES.PAUSED}))
  };
}

function registerModelCandidate({
  trainingJob,
  artifactSha,
  modelName,
  metrics={},
  provenance={}
}={}){
  if(!trainingJob||!trainingJob.job_id) throw new Error('TRAINING_JOB_REQUIRED');
  const sha=assertSha(artifactSha,'MODEL_ARTIFACT_SHA_INVALID');
  const name=clean(modelName,200);
  if(!name) throw new Error('MODEL_NAME_REQUIRED');

  const material={
    training_job_id:trainingJob.job_id,
    artifact_sha:sha,
    model_name:name,
    metrics,
    provenance:{
      base_model:trainingJob.base_model,
      dataset_id:trainingJob.dataset_id,
      training_digest:trainingJob.digest,
      runtime_profile:clean(provenance.runtime_profile,80),
      checkpoint_id:clean(provenance.checkpoint_id,200)
    }
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    model_id:'model-'+digest.slice(0,24),
    status:'candidate',
    state:STATES.VALIDATING,
    digest,
    ...material,
    policy:{
      benchmark_required:true,
      exact_artifact_sha_required:true,
      production_activation:false,
      rollback_reference_required:true
    }
  };
}

function benchmarkCandidate({
  candidate,
  baseline,
  suites=[]
}={}){
  if(!candidate||candidate.status!=='candidate') throw new Error('MODEL_CANDIDATE_REQUIRED');
  if(!baseline||!baseline.model_id) throw new Error('MODEL_BASELINE_REQUIRED');
  if(!Array.isArray(suites)||!suites.length) throw new Error('MODEL_BENCHMARK_SUITES_REQUIRED');

  const normalized=suites.map(s=>{
    if(!s||typeof s!=='object') throw new Error('MODEL_BENCHMARK_SUITE_INVALID');
    const id=clean(s.id,160);
    const candidateScore=Number(s.candidate_score);
    const baselineScore=Number(s.baseline_score);
    const minDelta=Number(s.min_delta||0);
    const maxRegression=Number(s.max_regression||0);
    if(!id||!Number.isFinite(candidateScore)||!Number.isFinite(baselineScore)){
      throw new Error('MODEL_BENCHMARK_SUITE_INVALID');
    }
    const delta=candidateScore-baselineScore;
    const passed=delta>=minDelta && delta>=(-1*Math.abs(maxRegression));
    return {
      id,
      candidate_score:candidateScore,
      baseline_score:baselineScore,
      delta,
      min_delta:minDelta,
      max_regression:Math.abs(maxRegression),
      passed
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));

  const failed=normalized.filter(s=>!s.passed);
  const material={
    candidate_model_id:candidate.model_id,
    candidate_artifact_sha:candidate.artifact_sha,
    baseline_model_id:baseline.model_id,
    suites:normalized
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    benchmark_id:'benchmark-'+digest.slice(0,24),
    status:failed.length?'blocked':'ready_for_promotion',
    state:failed.length?STATES.BLOCKED:STATES.VERIFIED,
    digest,
    ...material,
    blockers:failed,
    policy:{
      deterministic:true,
      baseline_comparison_required:true,
      failed_suite_blocks_promotion:true,
      production_activation:false
    }
  };
}

function promoteModel({
  benchmark,
  candidate,
  currentProductionModel,
  approvedBy
}={}){
  if(!benchmark||benchmark.status!=='ready_for_promotion'||benchmark.state!==STATES.VERIFIED){
    throw new Error('MODEL_PROMOTION_BENCHMARK_NOT_VERIFIED');
  }
  if(!candidate||candidate.model_id!==benchmark.candidate_model_id){
    throw new Error('MODEL_PROMOTION_CANDIDATE_MISMATCH');
  }
  if(!currentProductionModel||!currentProductionModel.model_id){
    throw new Error('MODEL_PROMOTION_CURRENT_MODEL_REQUIRED');
  }
  const approver=clean(approvedBy,160);
  if(!approver) throw new Error('MODEL_PROMOTION_APPROVAL_REQUIRED');

  const material={
    candidate_model_id:candidate.model_id,
    candidate_artifact_sha:candidate.artifact_sha,
    previous_model_id:currentProductionModel.model_id,
    previous_artifact_sha:currentProductionModel.artifact_sha||null,
    benchmark_id:benchmark.benchmark_id,
    approved_by:approver
  };
  const digest=hash(material);

  return {
    version:SELF_TRAINING_VERSION,
    promotion_id:'model-promotion-'+digest.slice(0,24),
    status:'promotion_approved',
    state:STATES.MERGE_READY,
    digest,
    ...material,
    policy:{
      explicit_approval:true,
      benchmark_verified:true,
      direct_production_activation:false,
      deployment_gate_required:true,
      rollback_target_preserved:true
    }
  };
}

function buildModelRollback({promotion,currentModelId,reason}={}){
  if(!promotion||promotion.status!=='promotion_approved') throw new Error('MODEL_ROLLBACK_PROMOTION_REQUIRED');
  if(clean(currentModelId,200)!==promotion.candidate_model_id) throw new Error('MODEL_ROLLBACK_CURRENT_MODEL_MISMATCH');

  const rollbackReason=clean(reason,300);
  if(!rollbackReason) throw new Error('MODEL_ROLLBACK_REASON_REQUIRED');

  return {
    version:SELF_TRAINING_VERSION,
    rollback_id:'model-rollback-'+hash({
      promotion_id:promotion.promotion_id,
      current_model_id:currentModelId,
      target_model_id:promotion.previous_model_id,
      reason:rollbackReason
    }).slice(0,24),
    status:'rollback_required',
    state:STATES.ROLLED_BACK,
    current_model_id:currentModelId,
    target_model_id:promotion.previous_model_id,
    target_artifact_sha:promotion.previous_artifact_sha,
    reason:rollbackReason,
    policy:{
      previous_verified_model_only:true,
      auto_rollback:false,
      deployment_gate_required:true,
      post_rollback_benchmark_required:true
    }
  };
}

module.exports={
  SELF_TRAINING_VERSION,
  registerDataset,
  deidentifyDataset,
  createTrainingJob,
  scheduleTrainingJobs,
  registerModelCandidate,
  benchmarkCandidate,
  promoteModel,
  buildModelRollback
};
