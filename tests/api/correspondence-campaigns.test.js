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
 test('rejects invalid issuer and anonymous provider credentials',async()=>{
  const owner=randomUUID(),db=mockDatabase(owner,owner),handler=createHandler(()=>db.sb);
  const r=await request(handler,'POST',{action:'create',workspace_id:db.companyA,title:'Clix',kind:'investment'},undefined,'bad');
  expect(r.statusCode).toBe(401);
  expect(db.tables.correspondence_campaigns).toHaveLength(0);
 });
});
