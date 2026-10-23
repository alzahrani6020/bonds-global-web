'use strict';

const crypto=require('crypto');
const { STATES }=require('../dual-core/evolution-state-machine');

const APPROVAL_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;
const APPROVAL_MODES=new Set(['full','partial']);

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function uniqueSorted(values,max=240){
  if(values===undefined||values===null)return [];
  if(!Array.isArray(values))throw new Error('APPROVED_TARGET_SCOPE_INVALID');
  return [...new Set(values.map(v=>clean(v,max)).filter(Boolean))].sort();
}

function sha256(value){
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function assertSha(value,code){
  const sha=clean(value,40);
  if(!sha||!SHA_RE.test(sha))throw new Error(code);
  return sha;
}

function normalizeProposal(proposal){
  if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)){
    throw new Error('APPROVED_TARGET_PROPOSAL_REQUIRED');
  }
  const normalized={
    proposal_id:clean(proposal.proposal_id,100),
    fingerprint:clean(proposal.fingerprint,64),
    problem_class:clean(proposal.problem_class,120),
    target_component:clean(proposal.target_component,120),
    recommended_path:clean(proposal.recommended_path,120),
    risk_level:clean(proposal.risk_level,40)
  };
  if(!normalized.proposal_id||!/^[0-9a-f]{64}$/i.test(String(normalized.fingerprint||''))){
    throw new Error('APPROVED_TARGET_PROPOSAL_IDENTITY_INVALID');
  }
  if(!normalized.problem_class||!normalized.target_component||!normalized.recommended_path){
    throw new Error('APPROVED_TARGET_PROPOSAL_SCOPE_INVALID');
  }
  normalized.fingerprint=normalized.fingerprint.toLowerCase();
  return normalized;
}

function normalizeScope(scope={}){
  if(!scope||typeof scope!=='object'||Array.isArray(scope)){
    throw new Error('APPROVED_TARGET_SCOPE_INVALID');
  }
  const mode=clean(scope.mode,20)||'full';
  if(!APPROVAL_MODES.has(mode))throw new Error('APPROVED_TARGET_MODE_INVALID');
  const allowedPaths=uniqueSorted(scope.allowed_paths,300);
  const allowedComponents=uniqueSorted(scope.allowed_components,120);

  if(mode==='full'&&(allowedPaths.length||allowedComponents.length)){
    throw new Error('APPROVED_TARGET_FULL_SCOPE_MUST_BE_UNBOUNDED');
  }
  if(mode==='partial'&&!allowedPaths.length&&!allowedComponents.length){
    throw new Error('APPROVED_TARGET_PARTIAL_SCOPE_REQUIRED');
  }
  return {
    mode,
    allowed_paths:allowedPaths,
    allowed_components:allowedComponents
  };
}

function targetDigest({proposal,baseSha,scope}){
  return sha256(JSON.stringify({
    proposal:normalizeProposal(proposal),
    base_sha:assertSha(baseSha,'APPROVED_TARGET_BASE_SHA_INVALID'),
    scope:normalizeScope(scope)
  }));
}

function createApprovedTarget({
  proposal,
  baseSha,
  approvedBy,
  scope={mode:'full'},
  rationale=null,
  approvedAt=null
}={}){
  const normalizedProposal=normalizeProposal(proposal);
  const base=assertSha(baseSha,'APPROVED_TARGET_BASE_SHA_INVALID');
  const approver=clean(approvedBy,160);
  if(!approver)throw new Error('APPROVED_TARGET_APPROVER_REQUIRED');
  const normalizedScope=normalizeScope(scope);
  const digest=targetDigest({proposal:normalizedProposal,baseSha:base,scope:normalizedScope});

  return {
    version:APPROVAL_VERSION,
    approval_id:'approval-'+digest.slice(0,24),
    state:STATES.APPROVED_TARGET,
    target_digest:digest,
    base_sha:base,
    proposal:normalizedProposal,
    scope:normalizedScope,
    approval:{
      approved_by:approver,
      approved_at:clean(approvedAt,64)||new Date().toISOString(),
      rationale:clean(rationale,1000)
    },
    policy:{
      sha_bound:true,
      scope_bound:true,
      approval_required_for_scope_change:true,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}


function proposalFromEvolutionRow(row){
  if(!row||typeof row!=='object'||Array.isArray(row)){
    throw new Error('APPROVED_TARGET_ROW_INVALID');
  }
  const analysis=row.metadata&&typeof row.metadata==='object'?row.metadata.learning_analysis:null;
  const diagnosis=analysis&&typeof analysis==='object'?analysis.diagnosis:null;
  const risk=analysis&&typeof analysis==='object'?analysis.risk:null;
  return normalizeProposal({
    proposal_id:row.id,
    fingerprint:row.fingerprint,
    problem_class:diagnosis?.problem_class,
    target_component:diagnosis?.target_component,
    recommended_path:diagnosis?.recommended_path,
    risk_level:risk?.risk_class||row.severity
  });
}

async function approveEvolutionProposalTarget({
  supabase,
  proposalId,
  currentMainSha,
  approvedBy,
  scope={mode:'full'},
  rationale=null,
  approvedAt=null
}={}){
  if(!supabase||typeof supabase.from!=='function'){
    throw new Error('APPROVED_TARGET_STORE_UNAVAILABLE');
  }
  const id=clean(proposalId,100);
  if(!id)throw new Error('APPROVED_TARGET_PROPOSAL_ID_REQUIRED');

  const read=await supabase
    .from('evolution_proposals')
    .select('id,fingerprint,severity,status,metadata,execution_authorized,auto_execute')
    .eq('id',id)
    .eq('status','proposed')
    .eq('execution_authorized',false)
    .limit(1);

  if(read.error)throw new Error('APPROVED_TARGET_READ_FAILED');
  const row=Array.isArray(read.data)?read.data[0]:null;
  if(!row)throw new Error('APPROVED_TARGET_PROPOSAL_NOT_APPROVABLE');
  if(row.auto_execute===true)throw new Error('APPROVED_TARGET_AUTO_EXECUTE_FORBIDDEN');

  const approvedTarget=createApprovedTarget({
    proposal:proposalFromEvolutionRow(row),
    baseSha:currentMainSha,
    approvedBy,
    scope,
    rationale,
    approvedAt
  });

  const metadata={
    ...(row.metadata||{}),
    approved_target:approvedTarget,
    approved_target_version:APPROVAL_VERSION
  };

  const update=await supabase
    .from('evolution_proposals')
    .update({
      status:'approved',
      metadata,
      execution_authorized:false,
      auto_execute:false
    })
    .eq('id',id)
    .eq('status','proposed')
    .eq('execution_authorized',false);

  if(update.error)throw new Error('APPROVED_TARGET_PERSIST_FAILED');

  return {
    version:APPROVAL_VERSION,
    proposal_id:id,
    status:'approved',
    approved_target:approvedTarget,
    policy:{
      human_approval_evidence:true,
      execution_authorized:false,
      auto_execute:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function validateApprovedTarget(value){
  if(!value||typeof value!=='object'||Array.isArray(value)){
    throw new Error('APPROVED_TARGET_INVALID');
  }
  if(value.version!==APPROVAL_VERSION||value.state!==STATES.APPROVED_TARGET){
    throw new Error('APPROVED_TARGET_VERSION_OR_STATE_INVALID');
  }
  if(!/^approval-[0-9a-f]{24}$/.test(String(value.approval_id||''))){
    throw new Error('APPROVED_TARGET_ID_INVALID');
  }
  const proposal=normalizeProposal(value.proposal);
  const base=assertSha(value.base_sha,'APPROVED_TARGET_BASE_SHA_INVALID');
  const scope=normalizeScope(value.scope);
  const expected=targetDigest({proposal,baseSha:base,scope});
  if(value.target_digest!==expected||value.approval_id!=='approval-'+expected.slice(0,24)){
    throw new Error('APPROVED_TARGET_DIGEST_MISMATCH');
  }
  if(!clean(value.approval?.approved_by,160)||!clean(value.approval?.approved_at,64)){
    throw new Error('APPROVED_TARGET_APPROVAL_METADATA_INVALID');
  }
  if(
    value.policy?.sha_bound!==true||
    value.policy?.scope_bound!==true||
    value.policy?.approval_required_for_scope_change!==true||
    value.policy?.execution_authorized!==false||
    value.policy?.validation_bypass!==false||
    value.policy?.auto_merge!==false||
    value.policy?.auto_deploy!==false
  ){
    throw new Error('APPROVED_TARGET_POLICY_INVALID');
  }
  return value;
}

function assertApprovalFresh(approvedTarget,currentMainSha){
  const target=validateApprovedTarget(approvedTarget);
  const current=assertSha(currentMainSha,'APPROVED_TARGET_CURRENT_MAIN_SHA_INVALID');
  if(target.base_sha!==current){
    return {
      fresh:false,
      code:'APPROVED_TARGET_BASE_STALE',
      approved_base_sha:target.base_sha,
      current_main_sha:current
    };
  }
  return {
    fresh:true,
    code:null,
    approved_base_sha:target.base_sha,
    current_main_sha:current
  };
}

function approvalCovers({approvedTarget,targetComponent,changedFiles=[]}={}){
  const target=validateApprovedTarget(approvedTarget);
  const component=clean(targetComponent,120);
  const files=uniqueSorted(changedFiles,300);

  if(target.scope.mode==='full'){
    return {covered:true,code:null,unapproved_paths:[],component_covered:true};
  }

  const componentCovered=!target.scope.allowed_components.length||
    (component&&target.scope.allowed_components.includes(component));
  const unapprovedPaths=target.scope.allowed_paths.length
    ? files.filter(file=>!target.scope.allowed_paths.some(prefix=>file===prefix||file.startsWith(prefix.endsWith('/')?prefix:prefix+'/')))
    : [];

  return {
    covered:Boolean(componentCovered&&unapprovedPaths.length===0),
    code:componentCovered&&unapprovedPaths.length===0?null:'APPROVED_TARGET_SCOPE_EXCEEDED',
    unapproved_paths:unapprovedPaths,
    component_covered:Boolean(componentCovered)
  };
}

function assertTargetUnchanged(approvedTarget,proposal){
  const target=validateApprovedTarget(approvedTarget);
  const normalized=normalizeProposal(proposal);
  const same=JSON.stringify(normalized)===JSON.stringify(target.proposal);
  return {
    unchanged:same,
    code:same?null:'APPROVED_TARGET_SCOPE_CHANGED',
    approved_fingerprint:target.proposal.fingerprint,
    observed_fingerprint:normalized.fingerprint
  };
}

module.exports={
  APPROVAL_VERSION,
  APPROVAL_MODES,
  SHA_RE,
  normalizeProposal,
  normalizeScope,
  targetDigest,
  createApprovedTarget,
  validateApprovedTarget,
  assertApprovalFresh,
  approvalCovers,
  assertTargetUnchanged,
  proposalFromEvolutionRow,
  approveEvolutionProposalTarget
};
