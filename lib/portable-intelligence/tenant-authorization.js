'use strict';
// Authorization boundary: membership MUST be loaded by the trusted host, never from request payload.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED={
 owner:new Set(['records.read','records.write','import.reviewed','audit.read','directory.export','crm.export','correspondence.directory.export','hr.directory.export','documents.read','documents.write']),
 admin:new Set(['records.read','records.write','import.reviewed','audit.read','directory.export','crm.export','correspondence.directory.export','hr.directory.export','documents.read','documents.write']),
 reviewer:new Set(['records.read','import.reviewed','documents.read','documents.write']),
 viewer:new Set(['records.read','documents.read'])
};
function createTenantAuthorizer({getMembership}={}){
 if(typeof getMembership!=='function')throw Error('TRUSTED_MEMBERSHIP_PROVIDER_REQUIRED');
 return async function authorize({workspaceId,actorId,action}={}){
  if(typeof workspaceId!=='string'||!UUID.test(workspaceId)||typeof actorId!=='string'||!actorId.trim())throw Error('INVALID_AUTH_CONTEXT');
  if(typeof action!=='string'||!action||action.length>100)throw Error('INVALID_AUTH_ACTION');
  // getMembership must authenticate the actor independently and scope retrieval by workspace.
  const wid=workspaceId.toLowerCase();
  const membership=await getMembership({workspaceId:wid,actorId});
  if(!membership||membership.active!==true||membership.workspace_id!==wid||membership.actor_id!==actorId)return false;
  return Boolean(ALLOWED[membership.role]?.has(action));
 };
}
module.exports={createTenantAuthorizer};
