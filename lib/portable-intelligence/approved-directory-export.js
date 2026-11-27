'use strict';
// Read-only, permissioned export of ALREADY approved directory records.
// Export intents never send mail, create HR employees, or mutate destination apps.
const TARGET_ACTIONS={crm:'crm.export',correspondence:'correspondence.directory.export',hr:'hr.directory.export'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function exportReviewedDirectory({workspaceId,actorId,target,recordIds,authorize,list}={}){
 if(!UUID.test(workspaceId||'')||typeof actorId!=='string'||!actorId.trim())throw Error('INVALID_AUTH_CONTEXT');
 if(!Object.hasOwn(TARGET_ACTIONS,target))throw Error('INVALID_EXPORT_TARGET');
 if(!Array.isArray(recordIds)||!recordIds.length||recordIds.length>200||recordIds.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(recordIds).size!==recordIds.length)throw Error('INVALID_RECORD_SELECTION');
 if(typeof authorize!=='function'||typeof list!=='function')throw Error('TRUSTED_ADAPTER_REQUIRED');
 const wid=workspaceId.toLowerCase(),action=TARGET_ACTIONS[target];
 if(await authorize({workspaceId:wid,actorId,action})!==true)throw Error('EXPORT_NOT_AUTHORIZED');
 // Listing must be scoped to the trusted user's workspace; verify every row again.
 const found=await list({workspaceId:wid,actorId});
 if(!Array.isArray(found))throw Error('INVALID_DIRECTORY_RESPONSE');
 const byId=new Map(found.map(row=>[row.id,row]));
 const records=recordIds.map(id=>{
  const entry=byId.get(id);
  if(!entry||entry.workspace_id!==wid||!entry.record||!['contact','organization'].includes(entry.record.type))throw Error('EXPORT_RECORD_NOT_FOUND');
  const r=entry.record;
  return {id,type:r.type,name:r.name,email:r.email||null,phone:r.phone||null,city:r.city||null,sector:r.sector||null,role:r.role||null,source:structuredClone(entry.source||{})};
 });
 return {schema_version:1,target,workspace_id:wid,records,reviewed_export:true,requires_destination_authorization:true,send_mail:false,create_hr_employee:false,commit_destination:false};
}
module.exports={exportReviewedDirectory};
