'use strict';
const {createCommercialDirectoryReceiver,stableId}=require('../../lib/api/commercial-portable-destination');
const WID='12345678-1234-4123-8123-1234567890ab',OTHER='12345678-1234-4123-8123-1234567890ac';
function stub({role='owner',loggedIn=true,dbReject=false,existing=false}={}){
 const inserted=[];
 const client={
  auth:{getUser:jest.fn(async()=>loggedIn?{data:{user:{id:'alice',is_anonymous:false}},error:null}:{data:{user:null},error:{message:'unauthed'}})},
  from:jest.fn(table=>{
   const state={table,filters:[],mode:'read',rows:[]};
   const q={
    select:jest.fn((fields)=>{state.select=fields;return q}),
    eq:jest.fn((field,value)=>{state.filters.push([field,value]);return q}),
    maybeSingle:jest.fn(async()=>table==='crm_app_workspaces'?{data:{id:WID,owner_user_id:role==='owner'?'alice':'other-user'},error:null}:{data:null,error:null}),
    limit:jest.fn(async()=>table==='crm_app_members'?{data:[{role}],error:null}:{data:existing?[{id:'existing'}]:[],error:null}),
    insert:jest.fn(rows=>{state.rows=rows;inserted.push({table,rows});return q})
   };
   if(table.startsWith('crm_app_companies')||table.startsWith('crm_app_contacts')){
    q.select=jest.fn((columns)=>{
     if(state.rows.length)return Promise.resolve(dbReject?{data:null,error:{code:'42501'}}:{data:state.rows.map(r=>({id:r.id,workspace_id:r.workspace_id})),error:null});
     state.select=columns;return q;
    });
   }
   return q;
  })
 };
 return {client,inserted};
}
function mockRes(){
 return {statusCode:null,payload:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(s){this.statusCode=s;return this},json(p){this.payload=p;return this}};
}
const request=(overrides={})=>({method:'POST',headers:{authorization:'Bearer signed-supabase-user-jwt'},body:{schema_version:1,target:'crm',workspace_id:WID,approved:true,send_mail:false,create_hr_employee:false,records:[{type:'organization',name:'شركة أطلس',email:'info@atlas.example'}]},...overrides});
describe('RLS enforced SaaS commercial directory receiver',()=>{
 test('owner imports reviewed company into exact workspace, verifies readback receipt',async()=>{
  const db=stub(),res=mockRes();
  const handler=createCommercialDirectoryReceiver({clientFactory:()=>db.client});
  await handler(request(),res);
  expect(res.statusCode).toBe(200);
  expect(res.payload).toMatchObject({accepted:true,target:'crm',workspace_id:WID,accepted_count:1,send_mail:false,create_hr_employee:false});
  expect(db.inserted[0].table).toBe('crm_app_companies');
  expect(db.inserted[0].rows[0]).toMatchObject({workspace_id:WID,name:'شركة أطلس'});
  expect(db.inserted[0].rows[0].id).toBe(stableId(WID,{type:'organization',name:'شركة أطلس',email:'info@atlas.example'}));
 });
 test('viewer and outsider roles cannot write to other company directory',async()=>{
  const db=stub({role:'viewer'}),res=mockRes();
  await createCommercialDirectoryReceiver({clientFactory:()=>db.client})(request(),res);
  expect(res.statusCode).toBe(403);expect(db.inserted).toHaveLength(0);
 });
 test('rejects unverified JWT, external HR employee creation and forged approval',async()=>{
  const unauth=stub({loggedIn:false}),res=mockRes();
  await createCommercialDirectoryReceiver({clientFactory:()=>unauth.client})(request(),res);
  expect(res.statusCode).toBe(401);expect(unauth.inserted).toHaveLength(0);
  const hr=mockRes();await createCommercialDirectoryReceiver({clientFactory:()=>stub().client})(request({body:{...request().body,target:'hr'}}),hr);
  expect(hr.statusCode).toBe(422);
  const unapproved=mockRes();await createCommercialDirectoryReceiver({clientFactory:()=>stub().client})(request({body:{...request().body,approved:false}}),unapproved);
  expect(unapproved.statusCode).toBe(400);
 });
 test('existing record, mixed batch and database permission errors fail closed',async()=>{
  const existing=stub({existing:true}),res=mockRes();
  await createCommercialDirectoryReceiver({clientFactory:()=>existing.client})(request(),res);
  expect(res.statusCode).toBe(409);expect(existing.inserted).toHaveLength(0);
  const mixed=mockRes();await createCommercialDirectoryReceiver({clientFactory:()=>stub().client})(request({body:{...request().body,records:[request().body.records[0],{type:'contact',name:'Ahmed'}]}}),mixed);
  expect(mixed.statusCode).toBe(400);
  const denied=stub({dbReject:true}),failed=mockRes();await createCommercialDirectoryReceiver({clientFactory:()=>denied.client})(request(),failed);
  expect(failed.statusCode).toBe(503);
 });
 test('normalized stable identity makes repeated attempted imports deterministic',()=>{
  const base={type:'organization',name:'شركة الأفق',email:'INFO@AFaq.EXAMPLE'};
  expect(stableId(WID,base)).toBe(stableId(WID,{...base,name:'شركة الافق',email:'info@afaq.example'}));
  expect(stableId(WID,base)).not.toBe(stableId(OTHER,base));
 });
});
