'use strict';

const crypto=require('crypto');

const ENGINEERING_MEMORY_VERSION=1;
const MAX_RECORDS_PER_QUERY=8;
const OUTCOMES=new Set(['validated','blocked']);

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function uniqueSorted(values){
  return [...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,240)).filter(Boolean))].sort();
}

function sha256(value){
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function exactKeys(value,allowed,code){
  for(const key of Object.keys(value||{})){
    if(!allowed.has(key))throw new Error(code);
  }
}

function canonicalAttempt(attempt){
  if(!attempt||typeof attempt!=='object'||Array.isArray(attempt)){
    throw new Error('ENGINEERING_MEMORY_ATTEMPT_INVALID');
  }

  const validation=attempt.validation;
  if(!validation||typeof validation!=='object'||!Array.isArray(validation.checks)){
    throw new Error('ENGINEERING_MEMORY_VALIDATION_INVALID');
  }

  const failedCodes=validation.checks
    .filter(check=>check&&check.status==='failed')
    .map(check=>clean(check.code,160))
    .filter(Boolean);

  return {
    attempt:Number(attempt.attempt)||0,
    proposal_digest:clean(attempt.proposal_digest,64),
    failure_signature:clean(attempt.failure_signature,64),
    changed_files:uniqueSorted(attempt.changed_files),
    impacted_surfaces:uniqueSorted(attempt.impact?.impacted_surfaces),
    protected_surfaces:uniqueSorted(attempt.impact?.protected_surfaces),
    failed_codes:uniqueSorted(failedCodes),
    passed:validation.passed===true
  };
}

function buildEngineeringMemoryRecord({candidate,repairResult}={}){
  if(!candidate||typeof candidate!=='object')throw new Error('ENGINEERING_MEMORY_CANDIDATE_REQUIRED');
  if(!repairResult||typeof repairResult!=='object')throw new Error('ENGINEERING_MEMORY_RESULT_REQUIRED');
  if(!OUTCOMES.has(repairResult.status))throw new Error('ENGINEERING_MEMORY_OUTCOME_INVALID');

  const attempts=(Array.isArray(repairResult.attempts)?repairResult.attempts:[]).map(canonicalAttempt);
  if(!attempts.length)throw new Error('ENGINEERING_MEMORY_ATTEMPTS_REQUIRED');

  const target={
    problem_class:clean(candidate.target?.problem_class,120),
    target_component:clean(candidate.target?.target_component,120),
    recommended_path:clean(candidate.target?.recommended_path,120)
  };
  if(!target.problem_class||!target.target_component){
    throw new Error('ENGINEERING_MEMORY_TARGET_INVALID');
  }

  const failureSignatures=uniqueSorted(attempts.map(a=>a.failure_signature));
  const proposalDigests=uniqueSorted(attempts.map(a=>a.proposal_digest));
  const impactedSurfaces=uniqueSorted(attempts.flatMap(a=>a.impacted_surfaces));
  const protectedSurfaces=uniqueSorted(attempts.flatMap(a=>a.protected_surfaces));
  const failedCodes=uniqueSorted(attempts.flatMap(a=>a.failed_codes));

  const fingerprint=sha256(JSON.stringify({
    target,
    failure_signatures:failureSignatures,
    impacted_surfaces:impactedSurfaces,
    protected_surfaces:protectedSurfaces
  }));

  const record={
    version:ENGINEERING_MEMORY_VERSION,
    memory_id:'engmem-'+fingerprint.slice(0,24),
    fingerprint,
    candidate_id:clean(candidate.candidate_id,80),
    target,
    outcome:repairResult.status,
    blocked_reason:clean(repairResult.blocked_reason,120),
    attempt_count:attempts.length,
    failure_signatures:failureSignatures,
    proposal_digests:proposalDigests,
    impacted_surfaces:impactedSurfaces,
    protected_surfaces:protectedSurfaces,
    failed_codes:failedCodes,
    attempts:attempts.map(a=>({
      attempt:a.attempt,
      proposal_digest:a.proposal_digest,
      failure_signature:a.failure_signature,
      impacted_surfaces:a.impacted_surfaces,
      protected_surfaces:a.protected_surfaces,
      failed_codes:a.failed_codes,
      passed:a.passed
    })),
    policy:{
      advisory_only:true,
      raw_source_stored:false,
      raw_diff_stored:false,
      secrets_stored:false,
      shell_commands_stored:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };

  return record;
}

function validateEngineeringMemoryRecord(record){
  if(!record||typeof record!=='object'||Array.isArray(record)){
    throw new Error('ENGINEERING_MEMORY_RECORD_INVALID');
  }
  exactKeys(record,new Set([
    'version','memory_id','fingerprint','candidate_id','target','outcome','blocked_reason',
    'attempt_count','failure_signatures','proposal_digests','impacted_surfaces',
    'protected_surfaces','failed_codes','attempts','policy'
  ]),'ENGINEERING_MEMORY_RECORD_FIELD_FORBIDDEN');

  if(record.version!==ENGINEERING_MEMORY_VERSION)throw new Error('ENGINEERING_MEMORY_VERSION_INVALID');
  if(!/^engmem-[0-9a-f]{24}$/.test(String(record.memory_id||'')))throw new Error('ENGINEERING_MEMORY_ID_INVALID');
  if(!/^[0-9a-f]{64}$/.test(String(record.fingerprint||'')))throw new Error('ENGINEERING_MEMORY_FINGERPRINT_INVALID');
  if(!OUTCOMES.has(record.outcome))throw new Error('ENGINEERING_MEMORY_OUTCOME_INVALID');
  if(record.policy?.advisory_only!==true||
     record.policy?.raw_source_stored!==false||
     record.policy?.raw_diff_stored!==false||
     record.policy?.secrets_stored!==false||
     record.policy?.shell_commands_stored!==false||
     record.policy?.execution_authorized!==false||
     record.policy?.auto_merge!==false||
     record.policy?.auto_deploy!==false){
    throw new Error('ENGINEERING_MEMORY_POLICY_INVALID');
  }

  return record;
}

function matchScore(record,query){
  let score=0;
  if(query.problem_class&&record.target.problem_class===query.problem_class)score+=4;
  if(query.target_component&&record.target.target_component===query.target_component)score+=4;
  if(query.failure_signature&&record.failure_signatures.includes(query.failure_signature))score+=6;
  for(const surface of query.impacted_surfaces||[]){
    if(record.impacted_surfaces.includes(surface))score+=1;
  }
  return score;
}

function normalizeQuery(query={}){
  return {
    problem_class:clean(query.problem_class,120),
    target_component:clean(query.target_component,120),
    failure_signature:clean(query.failure_signature,64),
    impacted_surfaces:uniqueSorted(query.impacted_surfaces)
  };
}

class EngineeringMemoryStore{
  constructor({maxRecords=500}={}){
    const value=Number(maxRecords);
    if(!Number.isInteger(value)||value<1||value>10000){
      throw new Error('ENGINEERING_MEMORY_MAX_RECORDS_INVALID');
    }
    this.maxRecords=value;
    this.records=new Map();
  }

  put(record){
    const validated=validateEngineeringMemoryRecord(record);
    this.records.set(validated.memory_id,JSON.parse(JSON.stringify(validated)));
    if(this.records.size>this.maxRecords){
      const first=this.records.keys().next().value;
      this.records.delete(first);
    }
    return validated.memory_id;
  }

  query(query={},limit=MAX_RECORDS_PER_QUERY){
    const normalized=normalizeQuery(query);
    const max=Math.max(1,Math.min(Number(limit)||MAX_RECORDS_PER_QUERY,MAX_RECORDS_PER_QUERY));
    return [...this.records.values()]
      .map(record=>({record,score:matchScore(record,normalized)}))
      .filter(item=>item.score>0)
      .sort((a,b)=>b.score-a.score||a.record.memory_id.localeCompare(b.record.memory_id))
      .slice(0,max)
      .map(item=>JSON.parse(JSON.stringify(item.record)));
  }

  size(){
    return this.records.size;
  }
}

function buildEngineeringMemoryContext(records){
  const input=Array.isArray(records)?records:[];
  const validated=input.slice(0,MAX_RECORDS_PER_QUERY).map(validateEngineeringMemoryRecord);
  return {
    version:ENGINEERING_MEMORY_VERSION,
    advisory_only:true,
    records:validated.map(record=>({
      memory_id:record.memory_id,
      outcome:record.outcome,
      blocked_reason:record.blocked_reason,
      attempt_count:record.attempt_count,
      target:record.target,
      failure_signatures:record.failure_signatures,
      proposal_digests:record.proposal_digests,
      impacted_surfaces:record.impacted_surfaces,
      protected_surfaces:record.protected_surfaces,
      failed_codes:record.failed_codes
    })),
    policy:{
      execute_from_memory:false,
      trust_as_verified_code:false,
      bypass_validation:false,
      execution_authorized:false
    }
  };
}

module.exports={
  ENGINEERING_MEMORY_VERSION,
  MAX_RECORDS_PER_QUERY,
  OUTCOMES,
  sha256,
  canonicalAttempt,
  buildEngineeringMemoryRecord,
  validateEngineeringMemoryRecord,
  normalizeQuery,
  matchScore,
  EngineeringMemoryStore,
  buildEngineeringMemoryContext
};
