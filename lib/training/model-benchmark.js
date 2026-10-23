'use strict';

const crypto=require('crypto');

const MODEL_BENCHMARK_VERSION=1;
const SHA_RE=/^[0-9a-f]{64}$/;

function clean(value,max=200){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}
function assertSha(value,code){
  const sha=clean(value,64)?.toLowerCase();
  if(!sha||!SHA_RE.test(sha)) throw new Error(code);
  return sha;
}

function normalizeChecks(checks){
  if(!Array.isArray(checks)||!checks.length) throw new Error('MODEL_BENCHMARK_CHECKS_REQUIRED');
  return checks.map(check=>{
    if(!check||typeof check!=='object'||Array.isArray(check)) throw new Error('MODEL_BENCHMARK_CHECK_INVALID');
    const id=clean(check.id,160);
    const code=clean(check.code,160);
    if(!id||!code||typeof check.passed!=='boolean') throw new Error('MODEL_BENCHMARK_CHECK_INVALID');
    return {
      id,
      passed:check.passed,
      code,
      candidate_value:Number.isFinite(check.candidate_value)?Number(check.candidate_value):null,
      baseline_value:Number.isFinite(check.baseline_value)?Number(check.baseline_value):null
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));
}

function evaluateCandidateModel({candidate,baseline,checks}={}){
  const candidateSha=assertSha(candidate?.artifact_sha256,'MODEL_BENCHMARK_CANDIDATE_SHA_INVALID');
  const baselineSha=assertSha(baseline?.artifact_sha256,'MODEL_BENCHMARK_BASELINE_SHA_INVALID');
  if(candidateSha===baselineSha) throw new Error('MODEL_BENCHMARK_IDENTICAL_ARTIFACTS');

  const normalized=normalizeChecks(checks);
  const blockers=normalized.filter(check=>check.passed!==true);
  const material={
    candidate_sha256:candidateSha,
    baseline_sha256:baselineSha,
    checks:normalized
  };
  const digest=crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');

  return {
    version:MODEL_BENCHMARK_VERSION,
    benchmark_id:'model-benchmark-'+digest.slice(0,24),
    status:blockers.length?'blocked':'benchmark_passed',
    candidate_sha256:candidateSha,
    baseline_sha256:baselineSha,
    checks:normalized,
    blockers,
    policy:{
      deterministic_checks_only:true,
      ai_self_score_authoritative:false,
      all_required_checks_must_pass:true,
      promotion_eligible:blockers.length===0
    }
  };
}

module.exports={MODEL_BENCHMARK_VERSION,evaluateCandidateModel};
