'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const PRODUCTION_VERIFICATION_VERSION=1;
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
    throw new Error('PRODUCTION_VERIFICATION_CHECK_INVALID');
  }
  const id=clean(check.id,200);
  const code=clean(check.code,160);
  if(!id||!code||typeof check.passed!=='boolean'){
    throw new Error('PRODUCTION_VERIFICATION_CHECK_INVALID');
  }
  return {id,passed:check.passed,code};
}

function verifyProduction({
  stagedVerification,
  expectedProductionSha,
  observedProductionSha,
  checks=[]
}={}){
  if(!stagedVerification||typeof stagedVerification!=='object'){
    throw new Error('PRODUCTION_VERIFICATION_STAGING_REQUIRED');
  }
  if(stagedVerification.status!=='staging_verified'){
    throw new Error('PRODUCTION_VERIFICATION_STAGING_NOT_VERIFIED');
  }
  if(stagedVerification.policy?.promotion_requires_next_gate!==true){
    throw new Error('PRODUCTION_VERIFICATION_STAGING_POLICY_INVALID');
  }

  const expected=assertSha(expectedProductionSha,'PRODUCTION_VERIFICATION_EXPECTED_SHA_INVALID');
  const observed=assertSha(observedProductionSha,'PRODUCTION_VERIFICATION_OBSERVED_SHA_INVALID');

  if(stagedVerification.deployed_sha!==expected){
    throw new Error('PRODUCTION_VERIFICATION_RELEASE_SHA_MISMATCH');
  }
  if(observed!==expected){
    throw new Error('PRODUCTION_VERIFICATION_PRODUCTION_SHA_MISMATCH');
  }

  if(!Array.isArray(checks)||!checks.length){
    throw new Error('PRODUCTION_VERIFICATION_CHECKS_REQUIRED');
  }
  const normalized=checks.map(normalizeCheck).sort((a,b)=>a.id.localeCompare(b.id));
  const failed=normalized.filter(check=>check.passed!==true);

  const material={
    release_id:stagedVerification.release_id,
    expected_production_sha:expected,
    observed_production_sha:observed,
    checks:normalized
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  if(failed.length){
    return {
      version:PRODUCTION_VERIFICATION_VERSION,
      verification_id:'prod-verify-'+digest.slice(0,24),
      status:'blocked',
      state:STATES.BLOCKED,
      digest,
      ...material,
      blockers:failed,
      policy:{
        deterministic:true,
        fail_closed:true,
        rollback_candidate:true,
        direct_production_write:false,
        execution_authorized:false,
        auto_rollback:false,
        auto_deploy:false
      }
    };
  }

  return {
    version:PRODUCTION_VERIFICATION_VERSION,
    verification_id:'prod-verify-'+digest.slice(0,24),
    status:'production_verified',
    state:STATES.VERIFIED,
    digest,
    ...material,
    blockers:[],
    policy:{
      deterministic:true,
      exact_sha_verified:true,
      direct_production_write:false,
      execution_authorized:false,
      auto_rollback:false,
      auto_deploy:false
    }
  };
}

function assertProductionVerified(args={}){
  const result=verifyProduction(args);
  if(result.status!=='production_verified'){
    const err=new Error('PRODUCTION_VERIFICATION_BLOCKED');
    err.result=result;
    throw err;
  }
  return result;
}

module.exports={
  PRODUCTION_VERIFICATION_VERSION,
  verifyProduction,
  assertProductionVerified
};
