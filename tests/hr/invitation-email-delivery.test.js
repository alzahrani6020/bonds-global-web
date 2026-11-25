'use strict';
const path=require('path');
const fs=require('fs');
const vm=require('vm');

const handlerPath=path.resolve(__dirname,'../../lib/api/hr-invite.js');
const source=fs.readFileSync(handlerPath,'utf8');
const invitationId='11111111-1111-4111-8111-111111111111';
const workspaceId='22222222-2222-4222-8222-222222222222';
const employeeId='33333333-3333-4333-8333-333333333333';
const ownerId='44444444-4444-4444-8444-444444444444';
function run({mailer=true,authorized=true,invitationStatus='pending',delivery=true}={}){
 const sent=[];
 const invite={id:invitationId,workspace_id:workspaceId,employee_id:employeeId,created_by:ownerId,
   invited_email:'employee@example.com',token:'55555555-5555-4555-8555-555555555555',
   role:'employee',status:invitationStatus,expires_at:'2099-01-01T00:00:00Z'};
 const rows={
  hr_saas_invitations: authorized?invite:null,
  hr_saas_workspaces:{id:workspaceId,name:'Test Workspace',owner_user_id:ownerId},
  hr_saas_employees:{id:employeeId,full_name:'Test Employee'}
 };
 const queries=[];
 const sb={
  auth:{getUser:async()=>({data:{user:{id:ownerId}},error:null})},
  from:(table)=>{
   const q={select:()=>q,eq:(field,value)=>{queries.push({table,field,value});return q;},
     maybeSingle:async()=>({data:rows[table],error:null})};
   return q;
  }
 };
 const scope={module:{exports:{}},exports:{},require:(name)=>{
   if(name==='./supabase')return ()=>sb;
   if(name==='./email')return {
    getEmailConfigStatus:()=>({hasResend:mailer,hasSmtp:false}),
    sendEmail:async options=>{sent.push(options);return delivery?{success:true,provider:'resend'}:{success:false,reason:'provider_failed'};}
   };
   throw Error('Unexpected dependency '+name);
  },process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-key'}},console:{error:()=>{}},Date};
 vm.runInNewContext(source,scope,{filename:handlerPath});
 const req={method:'POST',headers:{authorization:'Bearer mocked-session'},
  body:{invitation_id:invitationId}};
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},
  status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
 return {handler:scope.module.exports,req,res,sent,queries};
}
describe('BONDS HR invitation mail endpoint',()=>{
 test('sends an invitation to the intended email with idempotency, without returning the token',async()=>{
  const x=run();await x.handler(x.req,x.res);
  expect(x.res.code).toBe(202);
  expect(x.sent).toHaveLength(1);
  expect(x.sent[0].to).toBe('employee@example.com');
  expect(x.sent[0].text).toContain('program=hr#invite=');
  expect(x.sent[0].idempotencyKey).toBe('hr-invite-'+invitationId);
  expect(JSON.stringify(x.res.body)).not.toContain('55555555');
  expect(x.queries).toEqual(expect.arrayContaining([
   {table:'hr_saas_invitations',field:'created_by',value:ownerId},
   {table:'hr_saas_workspaces',field:'owner_user_id',value:ownerId}
  ]));
 });
 test('refuses missing email provider and does not claim delivery',async()=>{
  const x=run({mailer:false});await x.handler(x.req,x.res);
  expect(x.res.code).toBe(503);
  expect(x.res.body.error).toBe('HR_EMAIL_UNAVAILABLE');
  expect(x.sent).toHaveLength(0);
 });
 test('refuses invitation not owned by current user',async()=>{
  const x=run({authorized:false});await x.handler(x.req,x.res);
  expect(x.res.code).toBe(403);
  expect(x.sent).toHaveLength(0);
 });
 test('refuses accepted invitation',async()=>{
  const x=run({invitationStatus:'accepted'});await x.handler(x.req,x.res);
  expect(x.res.code).toBe(409);
  expect(x.sent).toHaveLength(0);
 });
 test('mail provider rejection is reported as failure',async()=>{
  const x=run({delivery:false});await x.handler(x.req,x.res);
  expect(x.res.code).toBe(503);
  expect(x.res.body.error).toBe('HR_EMAIL_NOT_SENT');
 });
});
