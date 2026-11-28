'use strict';
const {randomUUID}=require('node:crypto');
const {createHandler}=require('../../lib/api/correspondence-campaigns');
function mockDatabase(actor,owner){
 const companyA=randomUUID(),companyB=randomUUID();
 const tables={
  crm_app_workspaces:[{id:companyA,owner_user_id:owner,name:'BONDS'},{id:companyB,owner_user_id:randomUUID(),name:'Other'}],
  crm_app_members:[],correspondence_campaigns:[],correspondence_campaign_recipients:[],
  correspondence_campaign_events:[],correspondence_documents:[],correspondence_issues:[]
 };
 function builder(table,op,arg){
  const filters=[];let lim=null,columns='*';
  const q={
   select(value){columns=value;return q;},
   eq(k,v){filters.push(r=>r[k]===v);return q;},
   in(k,values){filters.push(r=>values.includes(r[k]));return q;},
   is(k,v){filters.push(r=>r[k]===v);return q;},
   order(){return q;},limit(n){lim=n;return q;},
   maybeSingle(){const r=execute();return Promise.resolve({data:r.data[0]||null,error:r.error});},
   single(){const r=execute();return Promise.resolve({data:r.data[0]||null,error:r.error});},
   then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
  };
  function execute(){
   const rows=tables[table];if(!rows)return {data:null,error:{message:'table missing'}};
   if(op==='insert'){const ins=(Array.isArray(arg)?arg:[arg]).map(r=>({id:r.id||randomUUID(),...r}));rows.push(...ins);return {data:columns==='*'?ins:ins,error:null};}
   let matches=rows.filter(r=>filters.every(fn=>fn(r)));
   if(op==='update'){matches.forEach(r=>Object.assign(r,arg));}
   if(lim!==null)matches=matches.slice(0,lim);
   return {data:matches.map(r=>({...r})),error:null};
  }
  return q;
 }
 const sb={
  auth:{getUser:async token=>({data:{user:token==='ok'?{id:actor,is_anonymous:false}:null},error:null})},
  from(table){return {
   select(cols){return builder(table,'select',null).select(cols);},
   insert(value){return builder(table,'insert',value);},
   update(value){return builder(table,'update',value);}
  }; }
 };
 return {sb,tables,companyA,companyB};
}
function response(){
 return {headers:{},statusCode:200,body:null,
 setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.statusCode=n;return this;},
 json(data){this.body=data;return this;}};
}
async function request(handler,method,body,query,token='ok'){
 const res=response();await handler({method,url:'/api/campaigns',headers:{authorization:'Bearer '+token},body,query},res);return res;
}
// Exercise two independent authenticated identities against the same persisted
// in-memory fixture. These are simulated tokens, NOT Supabase Auth sessions.
function twoTenantDatabase(){
 const userA=randomUUID(),userB=randomUUID(),companyA=randomUUID(),companyB=randomUUID();
 const tables={
  crm_app_workspaces:[
   {id:companyA,owner_user_id:userA,name:'Company A'},
   {id:companyB,owner_user_id:userB,name:'Company B'}
  ],
  crm_app_members:[],correspondence_campaigns:[],correspondence_campaign_recipients:[],
  correspondence_campaign_events:[],correspondence_documents:[],correspondence_issues:[]
 };
 function chain(table,operation,payload){
  const where=[];let limit=null;
  const query={
   select(){return query;},
   eq(key,value){where.push(row=>row[key]===value);return query;},
   in(key,values){where.push(row=>values.includes(row[key]));return query;},
   is(key,value){where.push(row=>row[key]===value);return query;},
   order(){return query;},
   limit(value){limit=value;return query;},
   maybeSingle:async()=>{const x=run();return {data:x.data[0]||null,error:x.error};},
   single:async()=>{const x=run();return {data:x.data[0]||null,error:x.error};},
   then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}
  };
  function run(){
   const rows=tables[table];if(!rows)return {data:null,error:{message:'missing table'}};
   if(operation==='insert'){
    const created=(Array.isArray(payload)?payload:[payload]).map(row=>({id:row.id||randomUUID(),...row}));
    rows.push(...created);return {data:created.map(row=>({...row})),error:null};
   }
   let data=rows.filter(row=>where.every(f=>f(row)));
   if(operation==='update')data.forEach(row=>Object.assign(row,payload));
   if(limit!==null)data=data.slice(0,limit);
   return {data:data.map(row=>({...row})),error:null};
  }
  return query;
 }
 const sb={
  auth:{getUser:async token=>({data:{user:token==='tenant-a'?{id:userA,is_anonymous:false}:
   token==='tenant-b'?{id:userB,is_anonymous:false}:null},error:null})},
  from(table){return {
   select(){return chain(table,'select');},
   insert(payload){return chain(table,'insert',payload);},
   update(payload){return chain(table,'update',payload);}
  };}
 };
 return {sb,tables,userA,userB,companyA,companyB};
}

describe('BONDS campaign API authorization and readback',()=>{
 let saved;
 beforeAll(()=>{saved=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';});
 afterAll(()=>{if(saved===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=saved;});
 test('rejects anonymous access',async()=>{
  const db=mockDatabase(randomUUID(),randomUUID()),handler=createHandler(()=>db.sb);
  expect((await request(handler,'GET',null,{mine:'1'},'bad')).statusCode).toBe(401);
 });
 test('separates crm_app_workspaces and never sends mail',async()=>{
  const owner=randomUUID(),db=mockDatabase(owner,owner),handler=createHandler(()=>db.sb);
  let r=await request(handler,'POST',{action:'create',workspace_id:db.companyB,title:'Wrong tenant',kind:'investment'});
  expect(r.statusCode).toBe(404);
  r=await request(handler,'POST',{action:'create',workspace_id:db.companyA,title:'Clix investor outreach',kind:'investment'});
  expect(r.statusCode).toBe(201);
  const id=r.body.campaign.id;
  const mine=await request(handler,'GET',null,{mine:'1'});
  expect(mine.body.workspaces).toHaveLength(1);
  expect(mine.body.workspaces[0].id).toBe(db.companyA);
  let list=await request(handler,'GET',null,{workspace_id:db.companyA});
  expect(list.body.campaigns.map(x=>x.id)).toEqual([id]);
  r=await request(handler,'POST',{action:'add_recipients',id,recipients:[
    {organization:'Alpha',email:'a@example.com'},{organization:'Beta',email:'b@example.com'}]});
  expect(r.statusCode).toBe(201);
  const opened=await request(handler,'GET',null,{id});
  expect(opened.body.recipients).toHaveLength(2);
  expect(opened.body.recipients.map(x=>x.email)).toEqual(['a@example.com','b@example.com']);
  expect(db.tables.correspondence_campaign_events.map(x=>x.action)).toEqual(['created','recipients_added']);
  const duplicate=await request(handler,'POST',{action:'add_recipients',id,recipients:[{organization:'Repeat',email:'A@example.com'}]});
  expect(duplicate.statusCode).toBe(400);
  const forged=await request(handler,'POST',{action:'bind_issued_letter',id,recipient_id:opened.body.recipients[0].id,document_id:randomUUID()});
  expect(forged.statusCode).toBe(409);
  const start=await request(handler,'POST',{action:'start',id});
  expect(start.statusCode).toBe(409);
  expect(db.tables.correspondence_campaigns[0].status).toBe('draft');
 });
 test('two independent identities: 27 recipients persist and cross-tenant reads/writes are denied',async()=>{
  const db=twoTenantDatabase(),handler=createHandler(()=>db.sb);
  const call=(token,method,body,query)=>request(handler,method,body,query,token);
  const mineA=await call('tenant-a','GET',null,{mine:'1'});
  const mineB=await call('tenant-b','GET',null,{mine:'1'});
  expect(mineA.statusCode).toBe(200);
  expect(mineB.statusCode).toBe(200);
  expect(mineA.body.workspaces.map(x=>x.id)).toEqual([db.companyA]);
  expect(mineB.body.workspaces.map(x=>x.id)).toEqual([db.companyB]);

  const created=await call('tenant-a','POST',{
   action:'create',workspace_id:db.companyA,title:'Clix 27 independent drafts',kind:'investment'
  });
  expect(created.statusCode).toBe(201);
  const campaignId=created.body.campaign.id;
  const recipients=Array.from({length:27},(_,i)=>({
   organization:'Institution '+String(i+1).padStart(2,'0'),
   email:'tenant-a-contact-'+String(i+1).padStart(2,'0')+'@example.test'
  }));
  const imported=await call('tenant-a','POST',{action:'add_recipients',id:campaignId,recipients});
  expect(imported.statusCode).toBe(201);
  expect(imported.body.recipients).toHaveLength(27);
  const reopened=await call('tenant-a','GET',null,{id:campaignId});
  expect(reopened.statusCode).toBe(200);
  expect(reopened.body.recipients.map(x=>x.email)).toEqual(recipients.map(x=>x.email));
  expect(new Set(reopened.body.recipients.map(x=>x.id)).size).toBe(27);

  const foreignRead=await call('tenant-b','GET',null,{id:campaignId});
  expect(foreignRead.statusCode).toBe(404);
  const foreignList=await call('tenant-b','GET',null,{workspace_id:db.companyA});
  expect(foreignList.statusCode).toBe(404);
  const foreignInsert=await call('tenant-b','POST',{
   action:'add_recipients',id:campaignId,recipients:[{organization:'Injected',email:'injected@example.test'}]
  });
  expect(foreignInsert.statusCode).toBe(404);
  const foreignUpdate=await call('tenant-b','POST',{
   action:'update',id:campaignId,title:'Tampered',description:'cross-tenant'
  });
  expect(foreignUpdate.statusCode).toBe(404);
  const companyBCreate=await call('tenant-b','POST',{
   action:'create',workspace_id:db.companyB,title:'Other company campaign',kind:'partnership'
  });
  expect(companyBCreate.statusCode).toBe(201);
  const companyBId=companyBCreate.body.campaign.id;
  expect((await call('tenant-a','GET',null,{id:companyBId})).statusCode).toBe(404);
  expect((await call('tenant-b','GET',null,{id:companyBId})).statusCode).toBe(200);
  expect(db.tables.correspondence_campaign_recipients).toHaveLength(27);
  expect(db.tables.correspondence_campaigns.find(x=>x.id===campaignId).title)
   .toBe('Clix 27 independent drafts');
  expect(db.tables.correspondence_campaign_events
   .filter(x=>x.campaign_id===campaignId).map(x=>x.action))
   .toEqual(['created','recipients_added']);
 });
 test('rejects invalid issuer and anonymous provider credentials',async()=>{
  const owner=randomUUID(),db=mockDatabase(owner,owner),handler=createHandler(()=>db.sb);
  const r=await request(handler,'POST',{action:'create',workspace_id:db.companyA,title:'Clix',kind:'investment'},undefined,'bad');
  expect(r.statusCode).toBe(401);
  expect(db.tables.correspondence_campaigns).toHaveLength(0);
 });
});
