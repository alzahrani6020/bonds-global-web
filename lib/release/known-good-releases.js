'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const KNOWN_GOOD_VERSION=1;
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
function normalizeChecks(checks){
  if(!Array.isArray(checks)||!checks.length) throw new Error('KNOWN_GOOD_CHECKS_REQUIRED');
  return checks.map(c=>{
    if(!c||typeof c!=='object'||Array.isArray(c)) throw new Error('KNOWN_GOOD_CHECK_INVALID');
    const id=clean(c.id,200);
    const code=clean(c.code,160);
    if(!id||!code||typeof c.passed!=='boolean') throw new Error('KNOWN_GOOD_CHECK_INVALID');
    return {id,passed:c.passed,code};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}

function createKnownGoodRelease({productionVerification,releaseSha,metadata={}}={}){
  if(!productionVerification||productionVerification.status!=='production_verified'||productionVerification.state!==STATES.VERIFIED){
    throw new Error('KNOWN_GOOD_PRODUCTION_NOT_VERIFIED');
  }
  if(productionVerification.policy?.known_good_eligible!==true){
    throw new Error('KNOWN_GOOD_NOT_ELIGIBLE');
  }

  const sha=assertSha(releaseSha,'KNOWN_GOOD_SHA_INVALID');
  if(productionVerification.production_sha!==sha){
    throw new Error('KNOWN_GOOD_SHA_MISMATCH');
  }

  const checks=normalizeChecks(productionVerification.checks);
  if(checks.some(c=>c.passed!==true)){
    throw new Error('KNOWN_GOOD_FAILED_CHECK_PRESENT');
  }

  const material={
    production_verification_id:productionVerification.verification_id,
    release_sha:sha,
    checks,
    metadata:{
      source:clean(metadata.source,120)||'production_verification',
      label:clean(metadata.label,160),
      notes:clean(metadata.notes,500)
    }
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  return {
    version:KNOWN_GOOD_VERSION,
    known_good_id:'known-good-'+digest.slice(0,24),
    status:'known_good',
    state:STATES.VERIFIED,
    digest,
    ...material,
    policy:{
      immutable_evidence:true,
      exact_sha_required:true,
      verified_only:true,
      rollback_source_eligible:true,
      execution_authorized:false,
      auto_promote:false,
      auto_rollback:false,
      auto_deploy:false
    }
  };
}

function selectKnownGoodRelease({releases=[],excludeSha=null}={}){
  if(!Array.isArray(releases)) throw new Error('KNOWN_GOOD_RELEASES_INVALID');
  const excluded=excludeSha?assertSha(excludeSha,'KNOWN_GOOD_EXCLUDE_SHA_INVALID'):null;

  const valid=releases
    .filter(r=>r&&r.status==='known_good'&&r.state===STATES.VERIFIED)
    .filter(r=>r.policy?.rollback_source_eligible===true)
    .filter(r=>!excluded||r.release_sha!==excluded)
    .sort((a,b)=>String(b.known_good_id).localeCompare(String(a.known_good_id)));

  return valid[0]||null;
}

module.exports={KNOWN_GOOD_VERSION,createKnownGoodRelease,selectKnownGoodRelease};
