'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const MERGE_SIMULATION_VERSION=1;
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

function uniqueSorted(values){
  return [...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,300)).filter(Boolean))].sort();
}

function normalizeCheck(check){
  if(!check||typeof check!=='object'||Array.isArray(check)){
    throw new Error('MERGE_SIMULATION_CHECK_INVALID');
  }
  const id=clean(check.id,200);
  const code=clean(check.code,160);
  if(!id||!code||typeof check.passed!=='boolean'){
    throw new Error('MERGE_SIMULATION_CHECK_INVALID');
  }
  return {id,passed:check.passed,code};
}

function simulateMerge({
  integrationVerification,
  currentMainSha,
  candidateHeadSha,
  mergeBaseSha,
  changedFiles=[],
  conflictingFiles=[],
  checks=[]
}={}){
  if(!integrationVerification||typeof integrationVerification!=='object'){
    throw new Error('MERGE_SIMULATION_INTEGRATION_REQUIRED');
  }
  if(integrationVerification.state!==STATES.INTEGRATION_VERIFIED){
    throw new Error('MERGE_SIMULATION_INTEGRATION_NOT_VERIFIED');
  }

  const main=assertSha(currentMainSha,'MERGE_SIMULATION_MAIN_SHA_INVALID');
  const head=assertSha(candidateHeadSha,'MERGE_SIMULATION_HEAD_SHA_INVALID');
  const base=assertSha(mergeBaseSha,'MERGE_SIMULATION_BASE_SHA_INVALID');

  if(integrationVerification.base_sha!==main){
    throw new Error('MERGE_SIMULATION_MAIN_MOVED');
  }
  if(integrationVerification.candidate_head_sha!==head){
    throw new Error('MERGE_SIMULATION_HEAD_MISMATCH');
  }
  if(base!==main){
    throw new Error('MERGE_SIMULATION_BASE_MISMATCH');
  }

  const files=uniqueSorted(changedFiles);
  const conflicts=uniqueSorted(conflictingFiles);
  const normalizedChecks=(Array.isArray(checks)?checks:[]).map(normalizeCheck).sort((a,b)=>a.id.localeCompare(b.id));
  if(!normalizedChecks.length)throw new Error('MERGE_SIMULATION_CHECKS_REQUIRED');

  const failedChecks=normalizedChecks.filter(check=>check.passed!==true);
  const blocked=conflicts.length>0||failedChecks.length>0;

  const material={
    integration_id:integrationVerification.integration_id,
    candidate_id:integrationVerification.candidate_id||null,
    main_sha:main,
    candidate_head_sha:head,
    merge_base_sha:base,
    changed_files:files,
    conflicting_files:conflicts,
    checks:normalizedChecks
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  return {
    version:MERGE_SIMULATION_VERSION,
    simulation_id:'merge-sim-'+digest.slice(0,24),
    status:blocked?'blocked':'merge_ready',
    state:blocked?STATES.BLOCKED:STATES.MERGE_READY,
    digest,
    ...material,
    blockers:[
      ...conflicts.map(file=>({type:'conflict',file,code:'MERGE_CONFLICT'})),
      ...failedChecks.map(check=>({type:'check',id:check.id,code:check.code}))
    ],
    policy:{
      deterministic:true,
      simulation_only:true,
      exact_main_sha_required:true,
      exact_candidate_head_required:true,
      conflict_auto_resolution:false,
      direct_main_write:false,
      merge_execution:false,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function assertMergeReady(args={}){
  const result=simulateMerge(args);
  if(result.status!=='merge_ready'){
    const err=new Error('MERGE_SIMULATION_BLOCKED');
    err.result=result;
    throw err;
  }
  return result;
}

module.exports={
  MERGE_SIMULATION_VERSION,
  simulateMerge,
  assertMergeReady
};
