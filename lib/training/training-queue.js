'use strict';

const { schedule }=require('../dual-core/resource-scheduler');

const TRAINING_QUEUE_VERSION=1;
const SHA_RE=/^[0-9a-f]{64}$/;

function clean(value,max=200){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function createTrainingJob({
  jobId,
  dataset,
  baseModel,
  approvedTargetId,
  requirements={}
}={}){
  const id=clean(jobId,160);
  if(!id) throw new Error('TRAINING_JOB_ID_REQUIRED');
  if(!dataset||dataset.status!=='registered'||dataset.policy?.deidentified_only!==true||dataset.policy?.training_eligible!==true){
    throw new Error('TRAINING_DATASET_NOT_ELIGIBLE');
  }
  const baseSha=clean(baseModel?.artifact_sha256,64);
  if(!baseSha||!SHA_RE.test(baseSha)) throw new Error('TRAINING_BASE_MODEL_SHA_INVALID');
  const targetId=clean(approvedTargetId,160);
  if(!targetId) throw new Error('TRAINING_APPROVED_TARGET_REQUIRED');

  return {
    version:TRAINING_QUEUE_VERSION,
    id,
    kind:'training',
    core:'self_evolving',
    status:'QUEUED',
    dataset_id:dataset.dataset_id,
    dataset_digest:dataset.dataset_digest,
    base_model_id:clean(baseModel?.model_id,160)||null,
    base_model_sha256:baseSha,
    approved_target_id:targetId,
    requirements:{
      min_profile:requirements.min_profile||'BALANCED',
      min_free_ram_gb:Number.isFinite(requirements.min_free_ram_gb)?Number(requirements.min_free_ram_gb):8,
      gpu_required:Boolean(requirements.gpu_required)
    },
    policy:{
      production_preempts_training:true,
      execution_authorized:false,
      auto_train:false,
      approved_target_required:true,
      deidentified_dataset_required:true
    }
  };
}

function evaluateTrainingQueue({jobs=[],profile}={}){
  if(!Array.isArray(jobs)) throw new Error('TRAINING_JOBS_INVALID');
  if(!profile||typeof profile!=='object') throw new Error('TRAINING_CAPABILITY_PROFILE_REQUIRED');

  const result=schedule(jobs,profile);
  const stateById=new Map();
  for(const job of result.runnable) stateById.set(job.id,'RUNNABLE');
  for(const job of result.waiting_for_capacity) stateById.set(job.id,'WAITING_FOR_CAPACITY');
  for(const job of result.paused) stateById.set(job.id,'PAUSED');

  return {
    version:TRAINING_QUEUE_VERSION,
    jobs:jobs.map(job=>({
      id:job.id,
      state:stateById.get(job.id)||'PAUSED'
    })),
    runnable:result.runnable.map(job=>job.id),
    waiting_for_capacity:result.waiting_for_capacity.map(job=>job.id),
    paused:result.paused.map(job=>job.id),
    policy:{
      production_priority_preserved:true,
      no_quality_gate_reduction:true,
      no_auto_training:true
    }
  };
}

module.exports={TRAINING_QUEUE_VERSION,createTrainingJob,evaluateTrainingQueue};
