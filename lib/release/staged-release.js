'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const STAGED_RELEASE_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function assertSha(value,code){
  const sha=clean(value,40);
  if(!sha||!SHA_RE.test(sha))throw new Error(code);
  return sha;
}

function normalizeCheck(check){
  if(!check||typeof check!=='object'||Array.isArray(check)){
    throw new Error('STAGED_RELEASE_CHECK_INVALID');
  }
  const id=clean(check.id,200);
  const code=clean(check.code,160);
  if(!id||!code||typeof check.passed!=='boolean'){
    throw new Error('STAGED_RELEASE_CHECK_INVALID');
  }
  return {id,passed:check.passed,code};
}

function createStagedRelease({
  mergeSimulation,
  mergeEvidence,
  currentMainSha,
  environment='staging'
}={}){
  if(!mergeSimulation||mergeSimulation.state!==STATES.MERGE_READY||mergeSimulation.status!=='merge_ready'){
    throw new Error('STAGED_RELEASE_MERGE_NOT_READY');
  }
  if(!mergeEvidence||typeof mergeEvidence!=='object'||mergeEvidence.merged!==true){
    throw new Error('STAGED_RELEASE_MERGE_EVIDENCE_REQUIRED');
  }

  const current=assertSha(currentMainSha,'STAGED_RELEASE_MAIN_SHA_INVALID');
  const mergeCommit=assertSha(mergeEvidence.merge_commit_sha,'STAGED_RELEASE_MERGE_SHA_INVALID');
  const candidateHead=assertSha(mergeEvidence.candidate_head_sha,'STAGED_RELEASE_CANDIDATE_SHA_INVALID');
  const env=clean(environment,80);

  if(env!=='staging')throw new Error('STAGED_RELEASE_ENVIRONMENT_INVALID');
  if(candidateHead!==mergeSimulation.candidate_head_sha){
    throw new Error('STAGED_RELEASE_CANDIDATE_MISMATCH');
  }
  if(current!==mergeCommit){
    throw new Error('STAGED_RELEASE_MAIN_NOT_MERGE_SHA');
  }

  const material={
    simulation_id:mergeSimulation.simulation_id,
    integration_id:mergeSimulation.integration_id,
    candidate_id:mergeSimulation.candidate_id||null,
    candidate_head_sha:candidateHead,
    merge_commit_sha:mergeCommit,
    current_main_sha:current,
    environment:env
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  return {
    version:STAGED_RELEASE_VERSION,
    release_id:'staged-'+digest.slice(0,24),
    status:'staging_required',
    state:STATES.MERGED,
    digest,
    ...material,
    policy:{
      deterministic:true,
      exact_merge_sha_required:true,
      staging_required:true,
      production_promotion:false,
      direct_production_write:false,
      execution_authorized:false,
      validation_bypass:false,
      auto_promote:false,
      auto_deploy:false
    }
  };
}

function verifyStagedRelease({
  stagedRelease,
  deployedSha,
  checks=[]
}={}){
  if(!stagedRelease||typeof stagedRelease!=='object'||stagedRelease.status!=='staging_required'){
    throw new Error('STAGED_RELEASE_MANIFEST_REQUIRED');
  }
  if(stagedRelease.policy?.staging_required!==true||
     stagedRelease.policy?.production_promotion!==false||
     stagedRelease.policy?.auto_promote!==false||
     stagedRelease.policy?.auto_deploy!==false){
    throw new Error('STAGED_RELEASE_POLICY_INVALID');
  }

  const deployed=assertSha(deployedSha,'STAGED_RELEASE_DEPLOYED_SHA_INVALID');
  if(deployed!==stagedRelease.merge_commit_sha){
    throw new Error('STAGED_RELEASE_SHA_MISMATCH');
  }

  if(!Array.isArray(checks)||!checks.length)throw new Error('STAGED_RELEASE_CHECKS_REQUIRED');
  const normalized=checks.map(normalizeCheck).sort((a,b)=>a.id.localeCompare(b.id));
  const failed=normalized.filter(check=>check.passed!==true);

  if(failed.length){
    return {
      version:STAGED_RELEASE_VERSION,
      release_id:stagedRelease.release_id,
      status:'blocked',
      state:STATES.BLOCKED,
      deployed_sha:deployed,
      checks:normalized,
      blockers:failed,
      policy:{
        production_promotion:false,
        execution_authorized:false,
        auto_promote:false,
        auto_deploy:false
      }
    };
  }

  return {
    version:STAGED_RELEASE_VERSION,
    release_id:stagedRelease.release_id,
    status:'staging_verified',
    state:STATES.MERGED,
    deployed_sha:deployed,
    checks:normalized,
    policy:{
      production_promotion:false,
      promotion_requires_next_gate:true,
      execution_authorized:false,
      auto_promote:false,
      auto_deploy:false
    }
  };
}

module.exports={
  STAGED_RELEASE_VERSION,
  createStagedRelease,
  verifyStagedRelease
};
