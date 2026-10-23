'use strict';

const crypto=require('crypto');

const MODEL_REGISTRY_VERSION=1;
const SHA_RE=/^[0-9a-f]{64}$/;
const STATUSES=new Set(['candidate','benchmarked','production','rolled_back']);

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
function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  }
  return value;
}
function recordDigest(value){
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function createModelRecord({
  modelId,
  artifactSha256,
  parentModelId=null,
  datasetDigest=null,
  trainingJobId=null,
  sourceRepository=null,
  sourceRevision=null,
  license=null,
  status='candidate'
}={}){
  const id=clean(modelId,160);
  if(!id) throw new Error('MODEL_ID_REQUIRED');
  if(!STATUSES.has(status)) throw new Error('MODEL_STATUS_INVALID');
  const sha=assertSha(artifactSha256,'MODEL_ARTIFACT_SHA_INVALID');
  const sourceRepo=clean(sourceRepository,300);
  const modelLicense=clean(license,120);
  if(!sourceRepo||!modelLicense) throw new Error('MODEL_PROVENANCE_REQUIRED');

  const material={
    model_id:id,
    artifact_sha256:sha,
    parent_model_id:clean(parentModelId,160),
    dataset_digest:clean(datasetDigest,64),
    training_job_id:clean(trainingJobId,160),
    source_repository:sourceRepo,
    source_revision:clean(sourceRevision,120),
    license:modelLicense,
    status
  };

  return {
    version:MODEL_REGISTRY_VERSION,
    registry_id:'model-'+recordDigest(material).slice(0,24),
    ...material,
    policy:{
      artifact_sha_required:true,
      provenance_required:true,
      direct_runtime_write:false,
      auto_promote:false,
      auto_rollback:false
    }
  };
}

function markModelBenchmarked({model,benchmark}={}){
  if(!model||model.status!=='candidate') throw new Error('MODEL_CANDIDATE_REQUIRED');
  if(!benchmark||benchmark.status!=='benchmark_passed') throw new Error('MODEL_BENCHMARK_PASS_REQUIRED');
  if(benchmark.candidate_sha256!==model.artifact_sha256) throw new Error('MODEL_BENCHMARK_SHA_MISMATCH');
  return {
    ...model,
    status:'benchmarked',
    benchmark_id:benchmark.benchmark_id
  };
}

function markModelKnownGood({model,promotionVerification}={}){
  if(!model||!['benchmarked','production'].includes(model.status)) throw new Error('MODEL_PROMOTED_RECORD_REQUIRED');
  if(!promotionVerification||promotionVerification.status!=='model_promotion_verified'){
    throw new Error('MODEL_PROMOTION_VERIFICATION_REQUIRED');
  }
  if(promotionVerification.observed_model_sha256!==model.artifact_sha256){
    throw new Error('MODEL_PROMOTION_VERIFICATION_SHA_MISMATCH');
  }
  return {
    ...model,
    status:'known_good',
    promotion_verification_id:promotionVerification.verification_id,
    policy:{
      ...model.policy,
      rollback_source_eligible:true
    }
  };
}

module.exports={
  MODEL_REGISTRY_VERSION,
  STATUSES,
  createModelRecord,
  markModelBenchmarked,
  markModelKnownGood
};
