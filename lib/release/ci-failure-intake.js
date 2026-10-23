'use strict';

const crypto=require('crypto');
const { EVENT_TYPES, validateEvent }=require('../dual-core/event-taxonomy');

const CI_FAILURE_INTAKE_VERSION=1;
const ALLOWED_CONCLUSIONS=new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
  'startup_failure',
  'stale'
]);

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function normalizeJob(job){
  if(!job||typeof job!=='object'||Array.isArray(job))throw new Error('CI_FAILURE_JOB_INVALID');
  const id=clean(job.id,120);
  const name=clean(job.name,240);
  const conclusion=clean(job.conclusion,80);
  if(!id||!name||!conclusion)throw new Error('CI_FAILURE_JOB_INVALID');
  return {
    id,
    name,
    conclusion,
    failed:ALLOWED_CONCLUSIONS.has(conclusion)
  };
}

function failureSignature({workflowName,headSha,jobs}){
  const failures=jobs
    .filter(job=>job.failed)
    .map(job=>job.name+'|'+job.conclusion)
    .sort();
  return crypto.createHash('sha256')
    .update([workflowName,headSha,...failures].join('\n'))
    .digest('hex');
}

function normalizeGithubCiFailure({
  repository,
  workflowRun,
  jobs=[]
}={}){
  const repo=clean(repository,240);
  if(!repo||!repo.includes('/'))throw new Error('CI_FAILURE_REPOSITORY_INVALID');
  if(!workflowRun||typeof workflowRun!=='object'||Array.isArray(workflowRun)){
    throw new Error('CI_FAILURE_WORKFLOW_RUN_REQUIRED');
  }

  const runId=clean(workflowRun.id,120);
  const workflowName=clean(workflowRun.name,240);
  const headSha=clean(workflowRun.head_sha,40);
  const status=clean(workflowRun.status,80);
  const conclusion=clean(workflowRun.conclusion,80);
  const htmlUrl=clean(workflowRun.html_url,1000);
  const event=clean(workflowRun.event,120);

  if(!runId||!workflowName||!/^[0-9a-f]{40}$/.test(String(headSha||''))){
    throw new Error('CI_FAILURE_WORKFLOW_IDENTITY_INVALID');
  }
  if(status!=='completed')throw new Error('CI_FAILURE_WORKFLOW_NOT_COMPLETED');
  if(!ALLOWED_CONCLUSIONS.has(conclusion))throw new Error('CI_FAILURE_WORKFLOW_NOT_FAILED');

  const normalizedJobs=(Array.isArray(jobs)?jobs:[]).map(normalizeJob);
  const failedJobs=normalizedJobs.filter(job=>job.failed);
  const signature=failureSignature({workflowName,headSha,jobs:normalizedJobs});

  const occurredAt=clean(workflowRun.updated_at,64)||clean(workflowRun.created_at,64)||new Date().toISOString();
  if(Number.isNaN(Date.parse(occurredAt)))throw new Error('CI_FAILURE_TIMESTAMP_INVALID');

  const ciEvent={
    id:'ci-'+crypto.createHash('sha256')
      .update(repo+'|'+runId+'|'+headSha+'|'+signature)
      .digest('hex')
      .slice(0,32),
    type:EVENT_TYPES.CI_FAILED,
    occurred_at:occurredAt,
    payload:{
      repository:repo,
      workflow_run_id:runId,
      workflow_name:workflowName,
      workflow_event:event,
      head_sha:headSha,
      conclusion,
      failed_jobs:failedJobs.map(job=>({
        id:job.id,
        name:job.name,
        conclusion:job.conclusion
      })),
      failure_signature:signature,
      run_url:htmlUrl
    },
    metadata:{
      event_type:EVENT_TYPES.CI_FAILED,
      workflow_key:workflowName,
      error_code:conclusion,
      head_sha:headSha,
      failure_signature:signature
    }
  };

  validateEvent(ciEvent);

  return {
    version:CI_FAILURE_INTAKE_VERSION,
    status:'accepted',
    event:ciEvent,
    policy:{
      deterministic:true,
      ai_inference:false,
      free_text_execution:false,
      shell_execution:false,
      execution_authorized:false,
      repair_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

async function ingestGithubCiFailure({bus,repository,workflowRun,jobs=[]}={}){
  if(!bus||typeof bus.publish!=='function')throw new Error('CI_FAILURE_BUS_REQUIRED');
  const intake=normalizeGithubCiFailure({repository,workflowRun,jobs});
  const delivery=await bus.publish(intake.event);
  return {
    ...intake,
    delivered:delivery.delivered
  };
}

module.exports={
  CI_FAILURE_INTAKE_VERSION,
  ALLOWED_CONCLUSIONS,
  normalizeJob,
  failureSignature,
  normalizeGithubCiFailure,
  ingestGithubCiFailure
};
