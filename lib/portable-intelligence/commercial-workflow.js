'use strict';
// Host-side orchestration only. The host MUST authenticate actorId and provide a
// trusted membership resolver. No production DB or outbound network calls.
const {analyzeFile}=require('./file-adapters');
const {normalizeRows}=require('./core');
const {createTenantAuthorizer}=require('./tenant-authorization');
const {createSqliteTenantStore}=require('./sqlite-store');
const {commitReviewedProposals}=require('./review-gate');
const {exportReviewedDirectory}=require('./approved-directory-export');
const {possibleDuplicates}=require('./entity-intelligence');

function createCommercialWorkflow({filename,getMembership,ocr,encryptionKey=null}={}){
 const authorize=createTenantAuthorizer({getMembership});
 const store=createSqliteTenantStore({filename,authorize,encryptionKey});
 function context(workspaceId,actorId){
  if(typeof actorId!=='string'||!actorId.trim()||typeof workspaceId!=='string'||!workspaceId.trim())
   throw Error('TRUSTED_CONTEXT_REQUIRED');
  return {workspaceId:workspaceId.toLowerCase(),actorId};
 }
 async function check(ctx,action){
  if(await authorize({...ctx,action})!==true)throw Error('TENANT_ACCESS_DENIED');
 }
 async function analyze({workspaceId,actorId,file,defaultType=null}={}){
  const ctx=context(workspaceId,actorId);
  await check(ctx,'documents.write');
  const proposal=await analyzeFile({file,workspaceId:ctx.workspaceId,defaultType,ocr});
  // File adapters never write to SQLite.
  return proposal;
 }
 // Explicit identity & review decision required for unstructured PDFs/images/Word/HTML.
 function prepareEntityReview({workspaceId,analysis,identity,entityIndex=0}={}){
  if(!analysis||analysis.workspace_id!==workspaceId?.toLowerCase()||analysis.auto_saved!==false)
   throw Error('WORKSPACE_MISMATCH');
  if(!identity||!['organization','contact'].includes(identity.type)||typeof identity.name!=='string'||!identity.name.trim())
   throw Error('IDENTITY_REVIEW_REQUIRED');
  const evidence=analysis.entity_suggestions;
  if(!evidence||evidence.records?.length!==0||evidence.auto_saved!==false)
   throw Error('SOURCE_EVIDENCE_REQUIRED');
  if(!Number.isSafeInteger(entityIndex)||entityIndex<0||entityIndex>=(evidence.items?.length||1))throw Error('INVALID_ENTITY_SELECTION');
  const selected=evidence.items?.[entityIndex]||null;
  if(selected&&selected.type!==identity.type)throw Error('ENTITY_TYPE_MISMATCH');
  const candidate=selected?.name||(identity.type==='organization'?evidence.candidates.organization_name:evidence.candidates.contact_name);
  if(candidate&&candidate!==identity.name&&!identity.identityOverrideConfirmed)
   throw Error('IDENTITY_CONFIRMATION_REQUIRED');
  const chosen={type:identity.type,name:identity.name};
  for(const field of ['email','phone']){
   if(identity[field]!=null&&identity[field]!==''){
    const observed=selected?.fields?.[field]||(evidence.items?.length===1?evidence.candidates[field]:null);
    if(identity[field]!==observed&&!identity.evidenceOverrideConfirmed)
     throw Error('EVIDENCE_MISMATCH');
    chosen[field]=identity[field];
   }
  }
  if(identity.type==='organization'){
   if(identity.sector)chosen.sector=identity.sector;
   if(identity.city)chosen.city=identity.city;
   if(identity.country)chosen.country=identity.country;
  }else if(identity.role)chosen.role=identity.role;
  const built=normalizeRows({
   rows:[chosen],workspaceId,defaultType:identity.type,
   source:{filename:analysis.source.filename,kind:analysis.source.kind}
  });
  if(built.errors.length||built.items.length!==1)throw Error('INVALID_REVIEWED_ENTITY');
  built.items[0].source.evidence=structuredClone(selected?.evidence||evidence.provenance||{});
  if(selected)built.items[0].source.entity_index=entityIndex;
  return built;
 }
 async function duplicates({workspaceId,actorId,proposal}={}){
  const ctx=context(workspaceId,actorId);
  await check(ctx,'records.read');
  if(!proposal||proposal.workspace_id!==ctx.workspaceId||!Array.isArray(proposal.items))
   throw Error('WORKSPACE_MISMATCH');
  const existing=await store.list(ctx);
  if(existing.length>1000)throw Error('DUPLICATE_REVIEW_LIMIT');
  return proposal.items.map((item,index)=>({
   index,matches:possibleDuplicates(item.record,existing.map(row=>({id:row.id,...row.record})))
  }));
 }
 async function approve({workspaceId,actorId,proposal,approvedIndices,allowDuplicates=false,duplicateOverrideReason=null}={}){
  const ctx=context(workspaceId,actorId);
  await check(ctx,'import.reviewed');
  if(!proposal||proposal.workspace_id!==ctx.workspaceId)throw Error('WORKSPACE_MISMATCH');
  if(!Array.isArray(approvedIndices)||approvedIndices.length<1)throw Error('INVALID_APPROVAL_SELECTION');
  const collision=await duplicates(ctxWithProposal(ctx,proposal));
  const hasDuplicates=collision.some(row=>approvedIndices.includes(row.index)&&row.matches.length);
  if(hasDuplicates&&!allowDuplicates)throw Error('DUPLICATE_REVIEW_REQUIRED');
  if(hasDuplicates&&allowDuplicates&&(typeof duplicateOverrideReason!=='string'||duplicateOverrideReason.trim().length<12))throw Error('DUPLICATE_OVERRIDE_REASON_REQUIRED');
  return commitReviewedProposals({
   proposal,approvedIndices,...ctx,authorize,commit:store.commit,duplicateOverrideReason:hasDuplicates?duplicateOverrideReason:null
  });
 }
 function ctxWithProposal(ctx,proposal){return {...ctx,proposal};}
 async function list({workspaceId,actorId}={}){return store.list(context(workspaceId,actorId))}
 async function search({workspaceId,actorId,query}={}){
  return store.search({...context(workspaceId,actorId),query});
 }
 async function update({workspaceId,actorId,id,changes}={}){
  return store.update({...context(workspaceId,actorId),id,changes});
 }
 async function archive({workspaceId,actorId,id}={}){return store.archive({...context(workspaceId,actorId),id})}
 async function exportDirectory({workspaceId,actorId,target,recordIds}={}){
  const ctx=context(workspaceId,actorId);
  const prepared=await exportReviewedDirectory({
   ...ctx,target,recordIds,authorize,list:store.list
  });
  // Audit the reviewed export intent only after every requested record is validated.
  // This does not authorize the receiving application to import or send anything.
  await store.recordExport({...ctx,target,count:prepared.records.length});
  return prepared;
 }
 async function backup({workspaceId,actorId,destination,passphrase,tempRoot}={}){return store.backup({...context(workspaceId,actorId),destination,passphrase,tempRoot})}
 async function audit({workspaceId,actorId}={}){return store.listAudit(context(workspaceId,actorId))}
 return {analyze,prepareEntityReview,duplicates,approve,list,search,update,archive,exportDirectory,backup,audit,close:store.close};
}
module.exports={createCommercialWorkflow};
