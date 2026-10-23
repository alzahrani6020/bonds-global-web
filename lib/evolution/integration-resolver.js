'use strict';

const crypto=require('crypto');
const { assertCandidateFresh }=require('./candidate-manager');
const { validateApprovedTarget, assertApprovalFresh, approvalCovers, assertTargetUnchanged }=require('./approval-target');
const { STATES }=require('../dual-core/evolution-state-machine');

const INTEGRATION_RESOLVER_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;
const RESOLVABLE_STATES=new Set([STATES.VALIDATING,STATES.REVALIDATING,STATES.STAGING]);

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

function candidateProposal(candidate){
  return {
    proposal_id:candidate?.target?.proposal_id,
    fingerprint:candidate?.target?.fingerprint,
    problem_class:candidate?.target?.problem_class,
    target_component:candidate?.target?.target_component,
    recommended_path:candidate?.target?.recommended_path,
    risk_level:candidate?.target?.risk_level||null
  };
}

function validateDependencyResult(result,candidate,approvedTarget){
  if(!result||typeof result!=='object'||Array.isArray(result)){
    throw new Error('INTEGRATION_DEPENDENCY_RESULT_REQUIRED');
  }
  if(result.status!=='ready')throw new Error('INTEGRATION_DEPENDENCIES_NOT_READY');
  if(result.candidate_id!==candidate.candidate_id){
    throw new Error('INTEGRATION_DEPENDENCY_CANDIDATE_MISMATCH');
  }
  if(result.approved_target_id!==approvedTarget.approval_id){
    throw new Error('INTEGRATION_DEPENDENCY_APPROVAL_MISMATCH');
  }
  if(result.policy?.deterministic!==true||
     result.policy?.fail_closed!==true||
     result.policy?.execution_authorized!==false||
     result.policy?.validation_bypass!==false||
     result.policy?.auto_merge!==false||
     result.policy?.auto_deploy!==false){
    throw new Error('INTEGRATION_DEPENDENCY_POLICY_INVALID');
  }
  return result;
}

function integrationDigest(payload){
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function resolveIntegration({
  candidate,
  approvedTarget,
  dependencyResult,
  currentMainSha,
  candidateHeadSha,
  changedFiles=[]
}={}){
  if(!candidate||typeof candidate!=='object')throw new Error('INTEGRATION_CANDIDATE_REQUIRED');
  if(!RESOLVABLE_STATES.has(candidate.state))throw new Error('INTEGRATION_CANDIDATE_STATE_INVALID');

  validateApprovedTarget(approvedTarget);
  const current=assertSha(currentMainSha,'INTEGRATION_MAIN_SHA_INVALID');
  const head=assertSha(candidateHeadSha,'INTEGRATION_HEAD_SHA_INVALID');
  const files=uniqueSorted(changedFiles);

  const freshness=assertCandidateFresh(candidate,current);
  if(!freshness.fresh)throw new Error('INTEGRATION_CANDIDATE_STALE');

  const approvalFreshness=assertApprovalFresh(approvedTarget,current);
  if(!approvalFreshness.fresh)throw new Error('INTEGRATION_APPROVAL_STALE');

  const target=assertTargetUnchanged(approvedTarget,candidateProposal(candidate));
  if(!target.unchanged)throw new Error('INTEGRATION_TARGET_CHANGED');

  const scope=approvalCovers({
    approvedTarget,
    targetComponent:candidate.target?.target_component,
    changedFiles:files
  });
  if(!scope.covered)throw new Error('INTEGRATION_SCOPE_EXCEEDED');

  const deps=validateDependencyResult(dependencyResult,candidate,approvedTarget);

  const material={
    candidate_id:candidate.candidate_id,
    approved_target_id:approvedTarget.approval_id,
    approved_target_digest:approvedTarget.target_digest,
    base_sha:current,
    candidate_head_sha:head,
    target_digest:candidate.target?.digest||null,
    changed_files:files,
    dependency_status:deps.status,
    dependency_checks:(deps.checks||[]).map(check=>({
      id:check.id,
      passed:check.passed===true,
      code:check.code||null
    })).sort((a,b)=>String(a.id).localeCompare(String(b.id)))
  };
  const digest=integrationDigest(material);

  return {
    version:INTEGRATION_RESOLVER_VERSION,
    integration_id:'integration-'+digest.slice(0,24),
    state:STATES.STAGING,
    digest,
    ...material,
    policy:{
      deterministic:true,
      approval_bound:true,
      dependency_bound:true,
      sha_bound:true,
      staging_required:true,
      production_write:false,
      direct_main_write:false,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function verifyStagedIntegration({
  integration,
  stagedHeadSha,
  checks=[]
}={}){
  if(!integration||typeof integration!=='object'||Array.isArray(integration)){
    throw new Error('INTEGRATION_MANIFEST_REQUIRED');
  }
  if(integration.version!==INTEGRATION_RESOLVER_VERSION||integration.state!==STATES.STAGING){
    throw new Error('INTEGRATION_MANIFEST_STATE_INVALID');
  }
  if(integration.policy?.deterministic!==true||
     integration.policy?.staging_required!==true||
     integration.policy?.direct_main_write!==false||
     integration.policy?.execution_authorized!==false||
     integration.policy?.auto_merge!==false||
     integration.policy?.auto_deploy!==false){
    throw new Error('INTEGRATION_MANIFEST_POLICY_INVALID');
  }

  const staged=assertSha(stagedHeadSha,'INTEGRATION_STAGED_SHA_INVALID');
  if(staged!==integration.candidate_head_sha){
    throw new Error('INTEGRATION_STAGED_SHA_MISMATCH');
  }

  if(!Array.isArray(checks)||!checks.length)throw new Error('INTEGRATION_STAGING_CHECKS_REQUIRED');
  const normalized=checks.map(check=>{
    if(!check||typeof check!=='object')throw new Error('INTEGRATION_STAGING_CHECK_INVALID');
    const id=clean(check.id,200);
    const code=clean(check.code,120);
    if(!id||typeof check.passed!=='boolean'||!code){
      throw new Error('INTEGRATION_STAGING_CHECK_INVALID');
    }
    return {id,passed:check.passed,code};
  }).sort((a,b)=>a.id.localeCompare(b.id));

  const failed=normalized.filter(check=>check.passed!==true);
  if(failed.length){
    return {
      version:INTEGRATION_RESOLVER_VERSION,
      integration_id:integration.integration_id,
      state:STATES.BLOCKED,
      checks:normalized,
      blockers:failed,
      policy:{
        execution_authorized:false,
        auto_merge:false,
        auto_deploy:false
      }
    };
  }

  return {
    version:INTEGRATION_RESOLVER_VERSION,
    integration_id:integration.integration_id,
    state:STATES.INTEGRATION_VERIFIED,
    candidate_id:integration.candidate_id,
    base_sha:integration.base_sha,
    candidate_head_sha:integration.candidate_head_sha,
    checks:normalized,
    policy:{
      merge_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

module.exports={
  INTEGRATION_RESOLVER_VERSION,
  RESOLVABLE_STATES,
  candidateProposal,
  validateDependencyResult,
  integrationDigest,
  resolveIntegration,
  verifyStagedIntegration
};
