'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const PRODUCTION_VERIFICATION_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;

function clean(v,max=300){
  if(v===null||v===undefined)return null;
  const s=String(v).trim();
  return s?s.slice(0,max):null;
}
function assertSha(v,code){
  const s=clean(v,40);
  if(!s||!SHA_RE.test(s)) throw new Error(code);
  return s;
}
function normalizeCheck(check){
  if(!check||typeof check!=='object'||Array.isArray(check)) throw new Error('PRODUCTION_CHECK_INVALID');
  const id=clean(check.id,200);
  const code=clean(check.code,160);
  if(!id||!code||typeof check.passed!=='boolean') throw new Error('PRODUCTION_CHECK_INVALID');
  return {id,passed:check.passed,code};
}
function verifyProduction({
  stagedVerification,
  productionSha,
  expectedReleaseSha,
  checks=[]
}={}){
  if(!stagedVerification||stagedVerification.status!=='staging_verified'){
    throw new Error('PRODUCTION_STAGING_NOT_VERIFIED');
  }
  const prod=assertSha(productionSha,'PRODUCTION_SHA_INVALID');
  const expected=assertSha(expectedReleaseSha,'PRODUCTION_EXPECTED_SHA_INVALID');
  if(prod!==expected) throw new Error('PRODUCTION_SHA_MISMATCH');
  if(stagedVerification.deployed_sha!==expected) throw new Error('PRODUCTION_STAGING_SHA_MISMATCH');
  if(!Array.isArray(checks)||!checks.length) throw new Error('PRODUCTION_CHECKS_REQUIRED');

  const normalized=checks.map(normalizeCheck).sort((a,b)=>a.id.localeCompare(b.id));
  const failed=normalized.filter(c=>c.passed!==true);
  const material={
    release_id:stagedVerification.release_id,
    production_sha:prod,
    checks:normalized
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  if(failed.length){
    return {
      version:PRODUCTION_VERIFICATION_VERSION,
      verification_id:'prod-'+digest.slice(0,24),
      status:'blocked',
      state:STATES.BLOCKED,
      ...material,
      blockers:failed,
      policy:{rollback_required:true,known_good_eligible:false,auto_rollback:false,auto_promote:false}
    };
  }

  return {
    version:PRODUCTION_VERIFICATION_VERSION,
    verification_id:'prod-'+digest.slice(0,24),
    status:'production_verified',
    state:STATES.VERIFIED,
    ...material,
    blockers:[],
    policy:{rollback_required:false,known_good_eligible:true,auto_rollback:false,auto_promote:false}
  };
}

module.exports={PRODUCTION_VERIFICATION_VERSION,verifyProduction};
