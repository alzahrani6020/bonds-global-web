'use strict';
// Experimental write bridge: DISABLED unless explicitly enabled on an isolated
// environment. Preserve SCC DTO validation and scoped server-side JWT checks.
// No financial posting, contract approval, arbitrary mutation, or URL proxy.
const operations=Object.freeze({
  'projects.tasks.create': Object.freeze({program:'projects',path:'/projects/tasks'})
});
function validateMakkinWriteOperation(program, operation, payload) {
  if(program!=='projects' || operation!=='projects.tasks.create' ||
      !Object.prototype.hasOwnProperty.call(operations,operation))return null;
  if(!payload || typeof payload!=='object' || Array.isArray(payload))return null;
  if(Object.keys(payload).some(key=>!['title','description'].includes(key)))return null;
  if(typeof payload.title!=='string' || !payload.title.trim() || payload.title.length>160)return null;
  if(payload.description!==undefined &&
      (typeof payload.description!=='string' || payload.description.length>2000))return null;
  return {operation:operations[operation],
    data:{title:payload.title.trim(),...(payload.description!==undefined?{description:payload.description}:{})}};
}
module.exports={validateMakkinWriteOperation};
