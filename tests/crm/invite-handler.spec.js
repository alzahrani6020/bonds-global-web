'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');

let mailEnabled=true,deliveryOk=true,ownerAllowed=true,authValid=true,rows=[],sent=[],deletions=[];
const supPath=require.resolve('../../lib/api/supabase');
const mailPath=require.resolve('../../lib/api/email');
const originalSup=require.cache[supPath],originalMail=require.cache[mailPath];

const fakeSupabase={
 auth:{getUser:async()=>authValid?{data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null}:{data:{user:null},error:{message:'bad JWT'}}},
 from(table){
  let action='read',payload=null,filterEmail=null;
  const q={
   select(){return q;},
   eq(k,v){if(k==='invited_email')filterEmail=v;return q;},
   gte(){return q;},is(){return q;},limit(){return q;},
   insert(v){action='insert';payload=v;return q;},
   delete(){action='delete';return q;},
   async maybeSingle(){return {data:ownerAllowed?{id:'22222222-2222-4222-8222-222222222222',name:'Test Company'}:null,error:null};},
   async single(){
    if(action==='insert'){rows.push(payload);return {data:{id:'33333333-3333-4333-8333-333333333333'},error:null};}
    return {data:null,error:null};
   },
   then(ok,bad){
    let result;
    if(action==='delete'){deletions.push(table);result={data:[],error:null};}
    else if(table==='crm_app_invitations'&&filterEmail){result={data:[],error:null};}
    else result={count:0,data:[],error:null};
    return Promise.resolve(result).then(ok,bad);
   }
  };
  return q;
 }
};
require.cache[supPath]={id:supPath,filename:supPath,loaded:true,exports:()=>fakeSupabase};
require.cache[mailPath]={id:mailPath,filename:mailPath,loaded:true,exports:{
 getEmailConfigStatus:()=>({hasResend:mailEnabled,hasSmtp:false}),
 sendEmail:async args=>{sent.push(args);return {success:deliveryOk};}
}};
const handler=require('../../api/crm-invite');
const key='SUPABASE_SERVICE_ROLE_KEY',saved=process.env[key];
process.env[key]='ci-fake-key-not-a-real-secret';
const input={workspace_id:'22222222-2222-4222-8222-222222222222',email:'User@Example.com',role:'editor'};
function request(body=input,auth='Bearer access-test'){return {method:'POST',headers:{authorization:auth},body};}
function response(){return {code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
function reset(){mailEnabled=true;deliveryOk=true;ownerAllowed=true;authValid=true;rows=[];sent=[];deletions=[];}

test('CRM invite validates server role, provider, JWT, owner and role',async()=>{
 reset();delete process.env[key];let res=response();await handler(request(),res);assert.equal(res.code,503);assert.equal(sent.length,0);
 process.env[key]='ci-fake-key-not-a-real-secret';
 mailEnabled=false;res=response();await handler(request(),res);assert.equal(res.code,503);
 mailEnabled=true;res=response();await handler(request({...input,role:'owner'}),res);assert.equal(res.code,400);
 authValid=false;res=response();await handler(request(),res);assert.equal(res.code,401);
 authValid=true;ownerAllowed=false;res=response();await handler(request(),res);assert.equal(res.code,403);
 assert.equal(rows.length,0);
});

test('CRM invitation is emailed only and never discloses secret in API JSON or DB row',async()=>{
 reset();const res=response();await handler(request(),res);
 assert.equal(res.code,202);assert.equal(res.body.success,true);
 assert.equal(res.body.delivery,'accepted_by_provider');
 assert.equal(rows.length,1);assert.equal(sent.length,1);
 assert.equal(rows[0].invited_email,'user@example.com');assert.equal(rows[0].invited_role,'editor');
 assert.match(rows[0].token_hash,/^[0-9a-f]{64}$/);
 assert.ok(!JSON.stringify(res.body).includes('invite='));
 assert.ok(sent[0].text.includes('invite='));
 assert.ok(!sent[0].text.includes(rows[0].token_hash));
});

test('Failed email is not reported delivered and pending invitation is cleaned up',async()=>{
 reset();deliveryOk=false;const res=response();await handler(request(),res);
 assert.equal(res.code,503);assert.equal(res.body.error,'INVITATION_NOT_DELIVERED');
 assert.deepEqual(deletions,['crm_app_invitations']);
});

process.on('exit',()=>{if(saved===undefined)delete process.env[key];else process.env[key]=saved;
 if(originalSup)require.cache[supPath]=originalSup;else delete require.cache[supPath];
 if(originalMail)require.cache[mailPath]=originalMail;else delete require.cache[mailPath];});
