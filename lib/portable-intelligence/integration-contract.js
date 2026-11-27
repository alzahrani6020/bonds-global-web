'use strict';
// Tenant-neutral import intents. No database connectivity, email delivery or employee creation.
const TARGETS=new Set(['crm','hr','correspondence']);
const TYPES=new Set(['organization','contact']);
function prepareImportIntent({proposal,workspaceId,target,approvedIndices}={}){
 if(!TARGETS.has(target))throw Error('UNSUPPORTED_TARGET');
 if(!proposal||proposal.auto_saved!==false||proposal.requires_manual_approval!==true||!Array.isArray(proposal.items))throw Error('REVIEW_PROPOSAL_REQUIRED');
 if(typeof workspaceId!=='string'||!workspaceId||proposal.workspace_id!==workspaceId.toLowerCase())throw Error('WORKSPACE_MISMATCH');
 if(!Array.isArray(approvedIndices)||!approvedIndices.length||new Set(approvedIndices).size!==approvedIndices.length)throw Error('INVALID_APPROVAL_SELECTION');
 const selected=approvedIndices.map(index=>{
  if(!Number.isSafeInteger(index)||index<0||index>=proposal.items.length)throw Error('INVALID_APPROVAL_SELECTION');
  const item=proposal.items[index];
  if(!item||item.workspace_id!==proposal.workspace_id||item.review_status!=='pending'||!item.record||!TYPES.has(item.record.type))throw Error('INVALID_PROPOSAL_ITEM');
  return item;
 });
 if(target==='hr')throw Error('HR_EMPLOYEE_LINK_REVIEW_REQUIRED');
 // Correspondence contacts are directory candidates ONLY. This never generates recipients,
 // sends messages, or authorizes cross-company sharing.
 const records=selected.map(item=>({
  type:item.record.type,
  fields:structuredClone(item.record),
  evidence:structuredClone(item.source)
 }));
 return Object.freeze({schema_version:1,target,workspace_id:workspaceId.toLowerCase(),records,
  requires_manual_approval:true,auto_saved:false,send_mail:false});
}
module.exports={prepareImportIntent};
