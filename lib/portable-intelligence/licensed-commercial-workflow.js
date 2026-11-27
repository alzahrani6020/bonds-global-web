'use strict';
// An opt-in licensed host entry point; unlike the unlicensed developer factory,
// all operations enforce a signed license, customer scope and authorized features.
const {createCommercialWorkflow}=require('./commercial-workflow');
const {verifyLicense}=require('./license-verifier');
const FEATURE_BY_METHOD=Object.freeze({
 analyze:'document-intelligence',
 prepareEntityReview:'document-intelligence',
 duplicates:'document-intelligence',
 approve:'document-intelligence',
 list:'document-intelligence',
 search:'document-intelligence',
 update:'document-intelligence',
 archive:'document-intelligence',
 backup:'backup',
 audit:'document-intelligence'
});
const TARGET_FEATURE=Object.freeze({crm:'crm.export',hr:'hr.export',correspondence:'correspondence.export'});
function createLicensedCommercialWorkflow({filename,getMembership,ocr,encryptionKey=null,licenseToken,licensePublicKey,workspaceId}={}){
 if(typeof workspaceId!=='string'||!workspaceId)throw Error('LICENSE_SCOPE_REQUIRED');
 const verify=(feature)=>{
  const data=verifyLicense({token:licenseToken,publicKey:licensePublicKey,workspaceId,now:Date.now()});
  if(!data.features.includes('document-intelligence')||!data.features.includes(feature))throw Error('LICENSE_FEATURE_DENIED');
 };
 verify('document-intelligence');
 const workflow=createCommercialWorkflow({filename,getMembership,ocr,encryptionKey});
 const licensed={};
 for(const [method,feature] of Object.entries(FEATURE_BY_METHOD)){
  licensed[method]=async args=>{
   verify(feature);
   if(!args||args.workspaceId!==workspaceId)throw Error('LICENSE_WORKSPACE_MISMATCH');
   return workflow[method](args);
  };
 }
 licensed.exportDirectory=async args=>{
  if(!args||args.workspaceId!==workspaceId)throw Error('LICENSE_WORKSPACE_MISMATCH');
  if(!Object.hasOwn(TARGET_FEATURE,args.target))throw Error('INVALID_EXPORT_TARGET');
  verify(TARGET_FEATURE[args.target]);
  return workflow.exportDirectory(args);
 };
 licensed.close=()=>workflow.close();
 return Object.freeze(licensed);
}
module.exports={createLicensedCommercialWorkflow};
