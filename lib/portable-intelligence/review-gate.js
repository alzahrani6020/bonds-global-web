'use strict';
// Portable persistence boundary. The host supplies trusted authorization and storage.
// Never infer access from a client-supplied workspace ID.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function commitReviewedProposals({proposal,workspaceId,actorId,approvedIndices,authorize,persist,audit}={}){
 if(!UUID.test(workspaceId||''))throw Error('WORKSPACE_ID_REQUIRED');
 if(typeof actorId!=='string'||!actorId.trim())throw Error('ACTOR_REQUIRED');
 if(typeof authorize!=='function'||typeof persist!=='function'||typeof audit!=='function')throw Error('TRUSTED_ADAPTER_REQUIRED');
 if(!proposal||proposal.auto_saved!==false||proposal.requires_manual_approval!==true||!Array.isArray(proposal.items))throw Error('REVIEW_PROPOSAL_REQUIRED');
 if(!UUID.test(proposal.workspace_id||'')||proposal.workspace_id.toLowerCase()!==workspaceId.toLowerCase())throw Error('WORKSPACE_MISMATCH');
 if(!Array.isArray(approvedIndices)||!approvedIndices.length||new Set(approvedIndices).size!==approvedIndices.length||approvedIndices.some(i=>!Number.isSafeInteger(i)||i<0||i>=proposal.items.length))throw Error('INVALID_APPROVAL_SELECTION');
 const approved=approvedIndices.map(i=>proposal.items[i]);
 if(approved.some(item=>!item||item.review_status!=='pending'||item.workspace_id!==proposal.workspace_id||!item.record||typeof item.record!=='object'||Array.isArray(item.record)))throw Error('INVALID_PROPOSAL_ITEM');
 // authorize must derive actor identity and tenant permissions independently from trusted host context.
 const allowed=await authorize({workspaceId,actorId,action:'import.reviewed'});
 if(allowed!==true)throw Error('IMPORT_NOT_AUTHORIZED');
 const entries=approved.map(item=>({record:structuredClone(item.record),source:structuredClone(item.source)}));
 // The storage adapter must enforce the same tenant and audit boundary transactionally.
 const result=await persist({workspaceId,actorId,entries});
 await audit({workspaceId,actorId,action:'import.reviewed',count:entries.length});
 return {saved:entries.length,result};
}
module.exports={commitReviewedProposals};
