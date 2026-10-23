'use strict';

const crypto=require('crypto');
const { applyPatchProposal }=require('./patch-engine');
const { STATES }=require('../dual-core/evolution-state-machine');

const REPAIR_LOOP_VERSION=1;
const DEFAULT_MAX_ATTEMPTS=4;
const DEFAULT_STUCK_THRESHOLD=3;
const ALLOWED_START_STATES=new Set([STATES.ENGINEERING,STATES.REPAIRING]);
const CHECK_STATUSES=new Set(['passed','failed','skipped']);

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function exactKeys(value,allowed,code){
  for(const key of Object.keys(value||{})){
    if(!allowed.has(key))throw new Error(code);
  }
}

function normalizeValidationResult(value){
  if(!value||typeof value!=='object'||Array.isArray(value)){
    throw new Error('REPAIR_LOOP_VALIDATION_RESULT_INVALID');
  }
  exactKeys(value,new Set(['passed','checks']),'REPAIR_LOOP_VALIDATION_FIELD_FORBIDDEN');
  if(typeof value.passed!=='boolean'||!Array.isArray(value.checks)||value.checks.length<1||value.checks.length>200){
    throw new Error('REPAIR_LOOP_VALIDATION_RESULT_INVALID');
  }

  const checks=value.checks.map(check=>{
    if(!check||typeof check!=='object'||Array.isArray(check)){
      throw new Error('REPAIR_LOOP_VALIDATION_CHECK_INVALID');
    }
    exactKeys(check,new Set(['id','status','code']),'REPAIR_LOOP_VALIDATION_CHECK_FIELD_FORBIDDEN');
    const id=clean(check.id,240);
    const status=clean(check.status,20);
    const code=clean(check.code,160);
    if(!id||!CHECK_STATUSES.has(status)||!code){
      throw new Error('REPAIR_LOOP_VALIDATION_CHECK_INVALID');
    }
    return {id,status,code};
  });

  const hasFailure=checks.some(check=>check.status==='failed');
  if(value.passed===hasFailure){
    throw new Error('REPAIR_LOOP_VALIDATION_CONTRADICTION');
  }

  return {passed:value.passed,checks};
}

function deterministicFailureSignature(validation){
  const normalized=normalizeValidationResult(validation);
  if(normalized.passed)throw new Error('REPAIR_LOOP_FAILURE_SIGNATURE_NOT_APPLICABLE');
  const failures=normalized.checks
    .filter(check=>check.status==='failed')
    .map(check=>check.id+'|'+check.code)
    .sort();
  return crypto.createHash('sha256').update(failures.join('\n')).digest('hex');
}

function proposalDigest(codeProviderResult){
  const proposal=codeProviderResult?.proposal;
  if(!proposal||!Array.isArray(proposal.patches))throw new Error('REPAIR_LOOP_PROPOSAL_INVALID');
  const normalized=proposal.patches.map(patch=>({
    path:String(patch.path||''),
    operation:String(patch.operation||''),
    unified_diff:String(patch.unified_diff||'')
  })).sort((a,b)=>a.path.localeCompare(b.path));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

class StuckLoopDetector{
  constructor({threshold=DEFAULT_STUCK_THRESHOLD}={}){
    const value=Number(threshold);
    if(!Number.isInteger(value)||value<2||value>20)throw new Error('REPAIR_LOOP_STUCK_THRESHOLD_INVALID');
    this.threshold=value;
    this.history=[];
  }

  observe({failureSignature,proposalHash}={}){
    const failure=clean(failureSignature,64);
    const proposal=clean(proposalHash,64);
    if(!failure||!proposal)throw new Error('REPAIR_LOOP_STUCK_OBSERVATION_INVALID');

    this.history.push({failure_signature:failure,proposal_digest:proposal});
    const sameFailure=this.history.filter(item=>item.failure_signature===failure).length;
    const samePair=this.history.filter(item=>item.failure_signature===failure&&item.proposal_digest===proposal).length;
    return {
      stuck:samePair>=2||sameFailure>=this.threshold,
      same_failure_count:sameFailure,
      same_pair_count:samePair
    };
  }
}

function repairCandidate(candidate){
  return {
    ...candidate,
    state:STATES.REPAIRING,
    policy:{...candidate.policy,execution_authorized:false,auto_merge:false,auto_deploy:false}
  };
}

function validatingCandidate(candidate){
  return {
    ...candidate,
    state:STATES.VALIDATING,
    policy:{...candidate.policy,execution_authorized:false,auto_merge:false,auto_deploy:false}
  };
}

async function loadRepairSources(sourceLoader,context){
  if(sourceLoader===undefined||sourceLoader===null)return [];
  if(typeof sourceLoader!=='function')throw new Error('REPAIR_LOOP_SOURCE_LOADER_INVALID');
  const sources=await sourceLoader(context);
  if(!Array.isArray(sources))throw new Error('REPAIR_LOOP_SOURCE_RESULT_INVALID');
  return sources;
}

async function runValidation(validationRunner,context){
  if(typeof validationRunner!=='function')throw new Error('REPAIR_LOOP_VALIDATION_RUNNER_REQUIRED');
  const result=await validationRunner(context);
  return normalizeValidationResult(result);
}

async function runRepairLoop({
  candidate,
  currentMainSha,
  workspaceRoot,
  initialCodeProviderResult,
  codeProvider,
  validationRunner,
  sourceLoader=null,
  maxAttempts=DEFAULT_MAX_ATTEMPTS,
  stuckThreshold=DEFAULT_STUCK_THRESHOLD
}={}){
  if(!candidate||typeof candidate!=='object')throw new Error('REPAIR_LOOP_CANDIDATE_REQUIRED');
  if(!ALLOWED_START_STATES.has(candidate.state))throw new Error('REPAIR_LOOP_CANDIDATE_STATE_INVALID');
  if(!initialCodeProviderResult||typeof initialCodeProviderResult!=='object'){
    throw new Error('REPAIR_LOOP_INITIAL_PROPOSAL_REQUIRED');
  }
  if(!codeProvider||typeof codeProvider.propose!=='function'){
    throw new Error('REPAIR_LOOP_CODE_PROVIDER_REQUIRED');
  }

  const attemptsLimit=Number(maxAttempts);
  if(!Number.isInteger(attemptsLimit)||attemptsLimit<1||attemptsLimit>20){
    throw new Error('REPAIR_LOOP_MAX_ATTEMPTS_INVALID');
  }

  const detector=new StuckLoopDetector({threshold:stuckThreshold});
  const attempts=[];
  let workingCandidate=candidate;
  let proposalResult=initialCodeProviderResult;

  for(let attempt=1;attempt<=attemptsLimit;attempt+=1){
    const patchReceipt=applyPatchProposal({
      candidate:workingCandidate,
      currentMainSha,
      workspaceRoot,
      codeProviderResult:proposalResult
    });

    const validation=await runValidation(validationRunner,{
      attempt,
      candidate:workingCandidate,
      patch_receipt:patchReceipt
    });

    const record={
      attempt,
      proposal_digest:proposalDigest(proposalResult),
      transaction_id:patchReceipt.transaction_id,
      changed_files:patchReceipt.changed_files,
      impact:patchReceipt.impact,
      validation
    };

    if(validation.passed){
      attempts.push(record);
      return {
        version:REPAIR_LOOP_VERSION,
        status:'validated',
        candidate:validatingCandidate(workingCandidate),
        attempts,
        final_validation:validation,
        blocked_reason:null,
        policy:{
          bounded_attempts:true,
          structured_validation_only:true,
          shell_execution:false,
          free_text_execution:false,
          direct_main_write:false,
          execution_authorized:false,
          auto_merge:false,
          auto_deploy:false
        }
      };
    }

    const failureSignature=deterministicFailureSignature(validation);
    record.failure_signature=failureSignature;
    const stuck=detector.observe({
      failureSignature,
      proposalHash:record.proposal_digest
    });
    record.stuck=stuck;
    attempts.push(record);

    if(stuck.stuck){
      return {
        version:REPAIR_LOOP_VERSION,
        status:'blocked',
        candidate:{...repairCandidate(workingCandidate),state:STATES.BLOCKED},
        attempts,
        final_validation:validation,
        blocked_reason:'REPAIR_LOOP_STUCK',
        policy:{
          bounded_attempts:true,
          structured_validation_only:true,
          shell_execution:false,
          free_text_execution:false,
          direct_main_write:false,
          execution_authorized:false,
          auto_merge:false,
          auto_deploy:false
        }
      };
    }

    if(attempt===attemptsLimit){
      return {
        version:REPAIR_LOOP_VERSION,
        status:'blocked',
        candidate:{...repairCandidate(workingCandidate),state:STATES.BLOCKED},
        attempts,
        final_validation:validation,
        blocked_reason:'REPAIR_LOOP_ATTEMPTS_EXHAUSTED',
        policy:{
          bounded_attempts:true,
          structured_validation_only:true,
          shell_execution:false,
          free_text_execution:false,
          direct_main_write:false,
          execution_authorized:false,
          auto_merge:false,
          auto_deploy:false
        }
      };
    }

    workingCandidate=repairCandidate(workingCandidate);
    const sourceFiles=await loadRepairSources(sourceLoader,{
      attempt:attempt+1,
      candidate:workingCandidate,
      previous_validation:validation,
      previous_failure_signature:failureSignature,
      previous_patch_receipt:patchReceipt
    });
    proposalResult=await codeProvider.propose({
      candidate:workingCandidate,
      currentMainSha,
      sourceFiles
    });
  }

  throw new Error('REPAIR_LOOP_UNREACHABLE');
}

module.exports={
  REPAIR_LOOP_VERSION,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_STUCK_THRESHOLD,
  ALLOWED_START_STATES,
  CHECK_STATUSES,
  normalizeValidationResult,
  deterministicFailureSignature,
  proposalDigest,
  StuckLoopDetector,
  repairCandidate,
  validatingCandidate,
  loadRepairSources,
  runRepairLoop
};
