'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const AUTOMATIC_REBASE_VERSION=1;
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

function buildAutomaticRebasePlan({
  candidate,
  currentMainSha,
  changedFiles=[],
  conflictingFiles=[]
}={}){
  if(!candidate||typeof candidate!=='object')throw new Error('AUTOREBASE_CANDIDATE_REQUIRED');

  const oldBase=assertSha(candidate.git?.base_sha,'AUTOREBASE_BASE_SHA_INVALID');
  const current=assertSha(currentMainSha,'AUTOREBASE_MAIN_SHA_INVALID');
  const files=uniqueSorted(changedFiles);
  const conflicts=uniqueSorted(conflictingFiles);

  if(oldBase===current){
    return {
      version:AUTOMATIC_REBASE_VERSION,
      status:'not_required',
      candidate_id:candidate.candidate_id||null,
      old_base_sha:oldBase,
      new_base_sha:current,
      changed_files:files,
      conflicting_files:[],
      required_state:null,
      policy:{
        deterministic:true,
        force_rebase:false,
        force_push:false,
        direct_main_write:false,
        auto_apply:false,
        revalidation_required:false,
        execution_authorized:false,
        auto_merge:false,
        auto_deploy:false
      }
    };
  }

  const digest=crypto.createHash('sha256').update(JSON.stringify({
    candidate_id:candidate.candidate_id||null,
    old_base_sha:oldBase,
    new_base_sha:current,
    changed_files:files,
    conflicting_files:conflicts
  })).digest('hex');

  return {
    version:AUTOMATIC_REBASE_VERSION,
    rebase_plan_id:'rebase-'+digest.slice(0,24),
    status:conflicts.length?'blocked':'rebuild_required',
    candidate_id:candidate.candidate_id||null,
    old_base_sha:oldBase,
    new_base_sha:current,
    changed_files:files,
    conflicting_files:conflicts,
    required_state:conflicts.length?STATES.BLOCKED:STATES.REBASING,
    next_state_after_rebuild:conflicts.length?null:STATES.REVALIDATING,
    policy:{
      deterministic:true,
      clean_latest_main_required:true,
      recreate_candidate_from_latest_main:true,
      force_rebase:false,
      force_push:false,
      direct_main_write:false,
      auto_apply:false,
      conflict_auto_resolution:false,
      revalidation_required:true,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function materializeRebasedCandidate({candidate,rebasePlan,newCandidate}={}){
  if(!rebasePlan||rebasePlan.status!=='rebuild_required'){
    throw new Error('AUTOREBASE_PLAN_NOT_READY');
  }
  if(!newCandidate||typeof newCandidate!=='object'){
    throw new Error('AUTOREBASE_NEW_CANDIDATE_REQUIRED');
  }

  const expectedBase=assertSha(rebasePlan.new_base_sha,'AUTOREBASE_PLAN_BASE_INVALID');
  const observedBase=assertSha(newCandidate.git?.base_sha,'AUTOREBASE_NEW_BASE_INVALID');
  if(expectedBase!==observedBase)throw new Error('AUTOREBASE_NEW_BASE_MISMATCH');

  if(newCandidate.target?.fingerprint!==candidate?.target?.fingerprint||
     newCandidate.target?.proposal_id!==candidate?.target?.proposal_id){
    throw new Error('AUTOREBASE_TARGET_CHANGED');
  }

  return {
    ...newCandidate,
    state:STATES.REVALIDATING,
    rebase:{
      plan_id:rebasePlan.rebase_plan_id,
      previous_candidate_id:candidate.candidate_id||null,
      previous_base_sha:rebasePlan.old_base_sha,
      current_base_sha:expectedBase
    },
    policy:{
      ...newCandidate.policy,
      revalidation_required:true,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

module.exports={
  AUTOMATIC_REBASE_VERSION,
  buildAutomaticRebasePlan,
  materializeRebasedCandidate
};
