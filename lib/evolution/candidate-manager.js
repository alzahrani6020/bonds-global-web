'use strict';

const crypto=require('crypto');
const path=require('path');
const { analyzeImpact }=require('./impact-analyzer');
const { STATES }=require('../dual-core/evolution-state-machine');

const SHA_RE=/^[0-9a-f]{40}$/;
const CANDIDATE_BRANCH_RE=/^evolution\/candidate\/[a-z0-9][a-z0-9._-]{7,79}$/;

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

function stableTargetDigest(target){
  if(!target||typeof target!=='object'||Array.isArray(target))throw new Error('CANDIDATE_TARGET_REQUIRED');
  const allowed={
    proposal_id:clean(target.proposal_id,100),
    fingerprint:clean(target.fingerprint,64),
    problem_class:clean(target.problem_class,120),
    target_component:clean(target.target_component,120),
    recommended_path:clean(target.recommended_path,120)
  };
  if(!allowed.proposal_id||!allowed.fingerprint)throw new Error('CANDIDATE_TARGET_IDENTITY_REQUIRED');
  return crypto.createHash('sha256').update(JSON.stringify(allowed)).digest('hex');
}

function candidateId({baseSha,targetDigest}){
  return 'cand-'+crypto.createHash('sha256')
    .update(baseSha+'|'+targetDigest)
    .digest('hex')
    .slice(0,24);
}

function candidateBranch(id){
  const branch='evolution/candidate/'+id;
  if(!CANDIDATE_BRANCH_RE.test(branch))throw new Error('CANDIDATE_BRANCH_INVALID');
  return branch;
}

function workspaceDescriptor(id){
  return {
    root_key:'BONDS_EVOLUTION_WORKSPACE_ROOT',
    relative_path:path.posix.join('candidates',id),
    isolated:true,
    clean_base_required:true,
    dirty_repo_reuse:false
  };
}

function createCandidate({
  baseSha,
  observedMainSha,
  target,
  proposedChangedFiles=[]
}={}){
  const base=assertSha(baseSha,'CANDIDATE_BASE_SHA_INVALID');
  const observed=assertSha(observedMainSha,'CANDIDATE_MAIN_SHA_INVALID');
  if(base!==observed)throw new Error('CANDIDATE_BASE_STALE');

  const targetDigest=stableTargetDigest(target);
  const id=candidateId({baseSha:base,targetDigest});
  const branch=candidateBranch(id);
  if(branch==='main'||branch==='master')throw new Error('CANDIDATE_PROTECTED_BRANCH');

  const impact=analyzeImpact({changedFiles:proposedChangedFiles});

  return {
    version:1,
    candidate_id:id,
    target:{
      proposal_id:clean(target.proposal_id,100),
      fingerprint:clean(target.fingerprint,64),
      digest:targetDigest,
      problem_class:clean(target.problem_class,120),
      target_component:clean(target.target_component,120),
      recommended_path:clean(target.recommended_path,120)
    },
    git:{
      base_sha:base,
      observed_main_sha:observed,
      branch,
      base_ref:'origin/main',
      direct_main_write:false,
      force_push:false
    },
    workspace:workspaceDescriptor(id),
    state:STATES.ENGINEERING,
    impact,
    policy:{
      exact_base_sha_required:true,
      clean_isolated_workspace_required:true,
      revalidate_main_before_merge:true,
      shell_command_generation:false,
      free_text_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function assertCandidateFresh(candidate,currentMainSha){
  if(!candidate||typeof candidate!=='object')throw new Error('CANDIDATE_REQUIRED');
  const current=assertSha(currentMainSha,'CANDIDATE_MAIN_SHA_INVALID');
  const base=assertSha(candidate.git?.base_sha,'CANDIDATE_BASE_SHA_INVALID');
  if(base!==current){
    return {
      fresh:false,
      code:'CANDIDATE_BASE_STALE',
      required_state:STATES.REBASING,
      current_main_sha:current,
      candidate_base_sha:base
    };
  }
  return {
    fresh:true,
    code:null,
    required_state:null,
    current_main_sha:current,
    candidate_base_sha:base
  };
}

function updateCandidateImpact(candidate,changedFiles){
  if(!candidate||typeof candidate!=='object')throw new Error('CANDIDATE_REQUIRED');
  return {
    ...candidate,
    impact:analyzeImpact({changedFiles}),
    policy:{...candidate.policy,execution_authorized:false}
  };
}

module.exports={
  SHA_RE,
  CANDIDATE_BRANCH_RE,
  stableTargetDigest,
  candidateId,
  candidateBranch,
  workspaceDescriptor,
  createCandidate,
  assertCandidateFresh,
  updateCandidateImpact
};
