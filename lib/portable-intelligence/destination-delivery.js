'use strict';
// Trust boundary between customer-owned reviewed records and external tenants.
// Remote BONDS must independently authenticate the user, authorize the target
// workspace and return a verified readback receipt. Never embed SaaS credentials.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGETS=new Set(['crm','correspondence','hr']);
async function deliverReviewedDirectory({workflow,workspaceId,actorId,target,recordIds,remoteEndpoint,allowedOrigin,bearerToken,fetchImpl=fetch}={}){
 if(!workflow||typeof workflow.exportDirectory!=='function')throw Error('TRUSTED_WORKFLOW_REQUIRED');
 if(!UUID.test(workspaceId||'')||typeof actorId!=='string'||!actorId)throw Error('INVALID_AUTH_CONTEXT');
 if(!TARGETS.has(target))throw Error('INVALID_DESTINATION');
 if(typeof remoteEndpoint!=='string'||remoteEndpoint.length>1024)throw Error('INVALID_DESTINATION');
 let url;try{url=new URL(remoteEndpoint)}catch{throw Error('INVALID_DESTINATION')}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||!url.hostname||/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname))throw Error('SECURE_DESTINATION_REQUIRED');
 if(typeof allowedOrigin!=='string'||allowedOrigin!==url.origin||!allowedOrigin.startsWith('https://'))throw Error('DESTINATION_NOT_ALLOWLISTED');
 if(typeof bearerToken!=='string'||bearerToken.length<20||bearerToken.length>8192||/[\r\n]/.test(bearerToken))throw Error('DESTINATION_AUTH_REQUIRED');
 if(typeof fetchImpl!=='function')throw Error('NETWORK_ADAPTER_REQUIRED');
 const intent=await workflow.exportDirectory({workspaceId,actorId,target,recordIds});
 if(intent.workspace_id!==workspaceId.toLowerCase()||intent.target!==target||intent.commit_destination!==false)throw Error('UNTRUSTED_EXPORT_ENVELOPE');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetchImpl(url.toString(),{
   method:'POST',redirect:'manual',signal:controller.signal,
   headers:{'Authorization':'Bearer '+bearerToken,'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({schema_version:1,target,workspace_id:intent.workspace_id,records:intent.records,approved:true,create_hr_employee:false,send_mail:false})
  });
  if(response.status>=300&&response.status<400)throw Error('DESTINATION_REDIRECT_FORBIDDEN');
  if(!response.ok)throw Error('DESTINATION_REJECTED');
  const contentType=String(response.headers?.get?.('content-type')||'');
  if(!contentType.includes('application/json'))throw Error('INVALID_DESTINATION_RECEIPT');
  const receipt=await response.json();
  if(!receipt||receipt.accepted!==true||receipt.workspace_id!==intent.workspace_id||receipt.target!==target||!Number.isSafeInteger(receipt.accepted_count)||receipt.accepted_count!==intent.records.length||typeof receipt.receipt_id!=='string'||receipt.receipt_id.length<12)throw Error('INVALID_DESTINATION_RECEIPT');
  return {delivered:true,workspace_id:intent.workspace_id,target,records:intent.records.length,receipt_id:receipt.receipt_id,verified_destination_ack:true,send_mail:false,create_hr_employee:false};
 }finally{clearTimeout(timer)}
}
module.exports={deliverReviewedDirectory};
