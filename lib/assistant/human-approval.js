'use strict';

const crypto = require('crypto');
const { loadWorkflowState } = require('./workflow-state');
const { actionSnapshot, actionFingerprint } = require('./confirmation-engine');

const HUMAN_APPROVAL_VERSION = 1;
const APPROVAL_PERMISSION = 'assistant.human_approval';
const APPROVAL_STATUSES = Object.freeze(['pending','approved','rejected','cancelled']);
const DECISIONS = Object.freeze(['approved','rejected']);
const APPROVAL_RISKS = Object.freeze(['high','critical']);

function clean(value,max=500){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function normalizeIdempotencyKey(value){
  const key=clean(value,160);
  if(!key||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(key)){
    throw new Error('HUMAN_APPROVAL_IDEMPOTENCY_KEY_INVALID');
  }
  return key;
}

function approvalRequestKey({userId,workflowKey,idempotencyKey}){
  return 'human-approval:'+crypto.createHash('sha256')
    .update([userId,workflowKey,idempotencyKey].join('|'))
    .digest('hex').slice(0,40);
}

function firstDecision(row){
  return Array.isArray(row?.approvals)&&row.approvals.length?row.approvals[0]:null;
}

function publicApproval(row,replayed=false){
  if(!row)return null;
  const payload=row.payload&&typeof row.payload==='object'?row.payload:{};
  const decision=firstDecision(row);
  return {
    id:row.id||null,
    workflow_key:clean(row.workflow_key||row.target_id,160),
    boundary:clean(row.boundary||payload.boundary,500),
    workflow_version:Number.isFinite(Number(row.workflow_version??payload.workflow_version))
      ?Number(row.workflow_version??payload.workflow_version):null,
    action_id:clean(payload.action_id,160),
    action_type:clean(row.action_type,100),
    action_target:clean(payload.action_target,160),
    action_fingerprint:clean(row.action_fingerprint||payload.action_fingerprint,64),
    risk:clean(row.risk||payload.risk,30),
    status:clean(row.status,30),
    requested_at:row.created_at||null,
    reviewed_at:decision?.reviewed_at||null,
    replayed:Boolean(replayed),
    execution_authorized:false,
    auto_execute:false
  };
}

function staffApproval(row,replayed=false){
  const out=publicApproval(row,replayed);
  if(!out)return null;
  const decision=firstDecision(row);
  return {
    ...out,
    decision_note:clean(decision?.note,1000)
  };
}

const SELECT_FIELDS='id,request_key,requested_by,permission,action_type,target_type,target_id,payload,status,required_approvals,approvals,created_at,updated_at,workflow_key,boundary,workflow_version,action_fingerprint,risk';

async function findApprovalByKey({supabase,requestKey,userId}){
  const {data,error}=await supabase
    .from('admin_approval_requests')
    .select(SELECT_FIELDS)
    .eq('request_key',requestKey)
    .eq('requested_by',userId)
    .eq('permission',APPROVAL_PERMISSION)
    .maybeSingle();
  if(error)throw new Error('HUMAN_APPROVAL_LOOKUP_FAILED');
  return data||null;
}

async function requestHumanApproval({
  supabase,userId,workflowKey,boundary,expectedVersion,action,idempotencyKey
}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('HUMAN_APPROVAL_UNAVAILABLE');
  if(!userId)throw new Error('HUMAN_APPROVAL_USER_REQUIRED');
  const safeBoundary=clean(boundary,500);
  if(!safeBoundary)throw new Error('HUMAN_APPROVAL_BOUNDARY_REQUIRED');
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)throw new Error('HUMAN_APPROVAL_VERSION_REQUIRED');

  const workflow=await loadWorkflowState({supabase,userId,workflowKey});
  if(!workflow)throw new Error('WORKFLOW_NOT_FOUND');
  if(workflow.boundary!==safeBoundary)throw new Error('HUMAN_APPROVAL_BOUNDARY_CONFLICT');
  if(workflow.version!==expectedVersion)throw new Error('WORKFLOW_VERSION_CONFLICT');
  if(!['active','paused'].includes(workflow.status))throw new Error('HUMAN_APPROVAL_WORKFLOW_STATUS_BLOCKED');

  const snapshot=actionSnapshot(action);
  if(snapshot.requires_confirmation!==true)throw new Error('HUMAN_APPROVAL_CONFIRMATION_REQUIRED');
  if(!APPROVAL_RISKS.includes(snapshot.risk))throw new Error('HUMAN_APPROVAL_RISK_NOT_ELIGIBLE');

  const fingerprint=actionFingerprint(action);
  const key=normalizeIdempotencyKey(idempotencyKey);
  const requestKey=approvalRequestKey({userId,workflowKey:workflow.workflow_key,idempotencyKey:key});
  const existing=await findApprovalByKey({supabase,requestKey,userId});
  if(existing){
    if(existing.action_fingerprint!==fingerprint)throw new Error('HUMAN_APPROVAL_IDEMPOTENCY_CONFLICT');
    return {
      version:HUMAN_APPROVAL_VERSION,
      approval:publicApproval(existing,true),
      created:false,replayed:true,execution_authorized:false
    };
  }

  const payload={
    origin:'assistant_human_approval',
    boundary:workflow.boundary,
    workflow_version:workflow.version,
    action_id:snapshot.id,
    action_target:snapshot.target||snapshot.capability||null,
    action_fingerprint:fingerprint,
    risk:snapshot.risk,
    action_snapshot:snapshot,
    execution_authorized:false
  };
  const row={
    request_key:requestKey,
    requested_by:userId,
    permission:APPROVAL_PERMISSION,
    action_type:snapshot.type,
    target_type:'assistant_workflow',
    target_id:workflow.workflow_key,
    payload,
    status:'pending',
    required_approvals:1,
    approvals:[],
    workflow_key:workflow.workflow_key,
    boundary:workflow.boundary,
    workflow_version:workflow.version,
    action_fingerprint:fingerprint,
    risk:snapshot.risk
  };

  const {data,error}=await supabase
    .from('admin_approval_requests')
    .insert(row)
    .select(SELECT_FIELDS)
    .single();
  if(error)throw new Error('HUMAN_APPROVAL_CREATE_FAILED');

  return {
    version:HUMAN_APPROVAL_VERSION,
    approval:publicApproval(data,false),
    created:true,replayed:false,execution_authorized:false
  };
}

async function listUserHumanApprovals({supabase,userId,limit=25}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('HUMAN_APPROVAL_UNAVAILABLE');
  if(!userId)throw new Error('HUMAN_APPROVAL_USER_REQUIRED');
  const safeLimit=Math.max(1,Math.min(Number(limit)||25,100));
  const {data,error}=await supabase
    .from('admin_approval_requests')
    .select(SELECT_FIELDS)
    .eq('requested_by',userId)
    .eq('permission',APPROVAL_PERMISSION)
    .order('created_at',{ascending:false})
    .limit(safeLimit);
  if(error)throw new Error('HUMAN_APPROVAL_LIST_FAILED');
  return (data||[]).map(row=>publicApproval(row,false));
}

async function listHumanApprovalQueue({supabase,status='pending',risk=null,limit=100}){
  const safeStatus=APPROVAL_STATUSES.includes(clean(status,30))?clean(status,30):'pending';
  const safeRisk=APPROVAL_RISKS.includes(clean(risk,30))?clean(risk,30):null;
  const safeLimit=Math.max(1,Math.min(Number(limit)||100,200));
  let query=supabase
    .from('admin_approval_requests')
    .select(SELECT_FIELDS)
    .eq('permission',APPROVAL_PERMISSION)
    .eq('status',safeStatus)
    .order('created_at',{ascending:false})
    .limit(safeLimit);
  if(safeRisk)query=query.eq('risk',safeRisk);
  const {data,error}=await query;
  if(error)throw new Error('HUMAN_APPROVAL_QUEUE_FAILED');
  return {
    version:HUMAN_APPROVAL_VERSION,
    items:(data||[]).map(row=>staffApproval(row,false)),
    policy:{human_decision_required:true,execution_authorized:false,auto_execute:false}
  };
}

async function decideHumanApproval({
  supabase,approvalId,reviewerUserId,decision,note
}){
  const id=clean(approvalId,100);
  if(!id)throw new Error('HUMAN_APPROVAL_ID_REQUIRED');
  if(!reviewerUserId)throw new Error('HUMAN_APPROVAL_REVIEWER_REQUIRED');
  const safeDecision=clean(decision,30);
  if(!DECISIONS.includes(safeDecision))throw new Error('HUMAN_APPROVAL_DECISION_INVALID');
  const now=new Date().toISOString();
  const review=[{
    reviewer_user_id:reviewerUserId,
    decision:safeDecision,
    note:clean(note,1000),
    reviewed_at:now,
    execution_authorized:false
  }];
  const {data,error}=await supabase
    .from('admin_approval_requests')
    .update({status:safeDecision,approvals:review,updated_at:now})
    .eq('id',id)
    .eq('permission',APPROVAL_PERMISSION)
    .eq('status','pending')
    .select(SELECT_FIELDS)
    .maybeSingle();
  if(error)throw new Error('HUMAN_APPROVAL_DECISION_FAILED');
  if(!data)throw new Error('HUMAN_APPROVAL_NOT_FOUND_OR_DECIDED');
  return {
    approval:staffApproval(data,false),
    reviewer_user_id:reviewerUserId,
    execution_authorized:false,
    auto_execute:false
  };
}

module.exports={
  HUMAN_APPROVAL_VERSION,
  APPROVAL_PERMISSION,
  APPROVAL_STATUSES,
  DECISIONS,
  APPROVAL_RISKS,
  normalizeIdempotencyKey,
  approvalRequestKey,
  publicApproval,
  staffApproval,
  requestHumanApproval,
  listUserHumanApprovals,
  listHumanApprovalQueue,
  decideHumanApproval
};
