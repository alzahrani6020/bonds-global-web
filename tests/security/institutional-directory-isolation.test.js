'use strict';
const { createHandler, parseRequest } = require('../../lib/api/institutional-directory');
const A='12345678-1234-4123-8123-1234567890ab';
const B='22345678-1234-4123-8123-1234567890ab';
const actor='32345678-1234-4123-8123-1234567890ab';
const other='42345678-1234-4123-8123-1234567890ab';

function mockSupabase({owner=actor, member=null, actorId=actor, rows=[{id:'one',name:'Test Entity'}]}={}){
 const log=[];
 function chain(table){
   const constraints=[];
   const q={
     select(cols){constraints.push(['select',cols]);return q;},
     eq(k,v){constraints.push(['eq',k,v]);return q;},
     order(k,opts){constraints.push(['order',k,opts]);return q;},
     ilike(k,v){constraints.push(['ilike',k,v]);return q;},
     limit(n){constraints.push(['limit',n]);return Promise.resolve({data:table==='crm_app_members'?(member?[{id:'member',role:member}]:[]):rows,error:null});},
     maybeSingle(){return Promise.resolve({data:owner?{id:A,owner_user_id:owner}:null,error:null});}
   };
   log.push({table,constraints});
   return q;
 }
 return {log,sb:{auth:{getUser:async()=>({data:{user:{id:actorId,is_anonymous:false}}})},from:chain}};
}
function req({workspace=A,type='organizations',q='',authorization='Bearer valid-token',limit=10,method='GET'}={}){
 return {method,url:'/api/institutional-directory',headers:{authorization},query:{workspace_id:workspace,type,q,limit:String(limit)}};
}
async function invoke(options,request){
 const {sb,log}=mockSupabase(options);
 const h=createHandler(()=>sb);
 const res={code:null,payload:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(c){this.code=c;return this;},
  json(obj){this.payload=obj;return this;}};
 await h(request,res);
 return {code:res.code,payload:res.payload,headers:res.headers,log};
}
describe('Institutional directory: server-enforced workspace isolation and no outbound messages',()=>{
 const prior=process.env.SUPABASE_SERVICE_ROLE_KEY;
 beforeEach(()=>{process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-only-key';});
 afterAll(()=>{if(prior===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=prior;});
 test('rejects missing auth before touching the backend',async()=>{
  const r=await invoke({},req({authorization:''}));
  expect(r.code).toBe(401);expect(r.log).toHaveLength(0);
 });
 test('fails closed without secured backend',async()=>{
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await invoke({},req());
  expect(r.code).toBe(503);expect(r.log).toHaveLength(0);
 });
 test('owner may read only requested tenant companies, including its email',async()=>{
  const r=await invoke({rows:[{id:'c1',name:'Acme',email:'acme@example.org'}]},req());
  expect(r.code).toBe(200);expect(r.payload.items).toHaveLength(1);
  const query=r.log.find(v=>v.table==='crm_app_companies');
  expect(query.constraints).toContainEqual(['eq','workspace_id',A]);
  expect(query.constraints.find(v=>v[0]==='select')[1]).toContain('email');
 });
 test('inactive or absent membership yields 404 with no contact query',async()=>{
  const r=await invoke({owner:other},req({type:'contacts'}));
  expect(r.code).toBe(404);
  expect(r.log.some(v=>v.table==='crm_app_contacts')).toBe(false);
 });
 test('viewer has no email or phone in contact selection',async()=>{
  const r=await invoke({owner:other,member:'viewer'},req({type:'contacts'}));
  expect(r.code).toBe(200);
  const query=r.log.find(v=>v.table==='crm_app_contacts');
  const selected=query.constraints.find(v=>v[0]==='select')[1];
  expect(selected).not.toContain('email');
  expect(selected).not.toContain('phone');
  expect(query.constraints).toContainEqual(['eq','workspace_id',A]);
 });
 test('editor may read contact details within the same workspace',async()=>{
  const r=await invoke({owner:other,member:'editor'},req({type:'contacts',q:'Acme'}));
  expect(r.code).toBe(200);
  const query=r.log.find(v=>v.table==='crm_app_contacts');
  expect(query.constraints.find(v=>v[0]==='select')[1]).toContain('email');
  expect(query.constraints).toContainEqual(['ilike','name','%Acme%']);
 });
 test('viewer organizations exclude tax and private mailbox fields',async()=>{
  const r=await invoke({owner:other,member:'viewer'},req());
  const selected=r.log.find(v=>v.table==='crm_app_companies').constraints.find(v=>v[0]==='select')[1];
  expect(selected).not.toContain('tax_number');expect(selected).not.toContain('email');
  expect(r.code).toBe(200);
 });
 test('fails closed for malformed tenant, wildcard enumeration, invalid page size, and POST',async()=>{
  for(const options of [{workspace:'bad'},{q:'%'},{limit:51}]){
   const r=await invoke({},req(options));expect(r.code).toBe(400);expect(r.log).toHaveLength(0);
  }
  const r=await invoke({},req({method:'POST'}));expect(r.code).toBe(405);expect(r.log).toHaveLength(0);
 });
 test('no workspace context or provider mail is inferred from browser values',()=>{
  expect(parseRequest(req({workspace:B})).workspaceId).toBe(B);
  expect(parseRequest(req({q:'جهة حكومية'})).q).toBe('جهة حكومية');
 });
});
