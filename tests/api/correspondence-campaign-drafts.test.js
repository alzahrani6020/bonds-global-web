'use strict';
const {randomUUID}=require('node:crypto');
jest.mock('../../lib/api/correspondence',()=>({
 createDocument:jest.fn(async(sb,user,body)=>{
  const row={id:require('node:crypto').randomUUID(),owner_user_id:user.id,recipient_email:body.recipient_email,
   status:'draft',current_version:0,workspace_context:body.workspace_context};
  const result=await sb.from('correspondence_documents').insert(row).select('*').single();
  if(result.error)throw result.error;
  return result.data;
 }),
 saveVersion:jest.fn(async(sb,doc,user,body)=>{
  const result=await sb.from('correspondence_documents').update({current_version:1})
    .eq('id',doc.id).select('*').single();
  if(result.error)throw result.error;
  return {document:result.data};
 })
}));
const {createDocument,saveVersion}=require('../../lib/api/correspondence');
const {createHandler}=require('../../lib/api/correspondence-campaigns');
function database(owner){
 const space=randomUUID();
 const tables={crm_app_workspaces:[{id:space,owner_user_id:owner,name:'BONDS'}],
  crm_app_members:[],correspondence_campaigns:[],correspondence_campaign_recipients:[],
  correspondence_campaign_events:[],correspondence_documents:[]};
 function query(table,type,arg){
  const filters=[],rows=tables[table];
  const q={
   eq(k,v){filters.push(x=>x[k]===v);return q;},
   is(k,v){filters.push(x=>x[k]===v);return q;},
   contains(k,v){filters.push(x=>Object.entries(v).every(([key,value])=>x[k]?.[key]===value));return q;},
   order(){return q;},limit(){return q;},select(){return q;},
   single(){const r=execute();return Promise.resolve({data:r.data[0]||null,error:r.error});},
   maybeSingle(){const r=execute();return Promise.resolve({data:r.data[0]||null,error:r.error});},
   then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
  };
  function execute(){
   if(!rows)return {data:null,error:new Error('Unknown table '+table)};
   if(type==='insert'){
    const incoming=(Array.isArray(arg)?arg:[arg]).map(item=>({id:randomUUID(),...item}));
    rows.push(...incoming);
    return {data:incoming.map(item=>({...item})),error:null};
   }
   let matched=rows.filter(x=>filters.every(fn=>fn(x)));
   if(type==='update')matched.forEach(x=>Object.assign(x,arg));
   return {data:matched.map(x=>({...x})),error:null};
  }
  return q;
 }
 return {space,tables,sb:{
  auth:{getUser:async token=>({data:{user:token==='fake'?{id:owner,is_anonymous:false}:null},error:null})},
  from(t){return {select(){return query(t,'select');},insert(v){return query(t,'insert',v);},update(v){return query(t,'update',v)}};}
 }};
}
async function request(handler,body){
 const res={headers:{},code:0,body:null,
  setHeader(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},
  json(value){this.body=value;return this;}};
 await handler({method:'POST',url:'/api/campaigns',headers:{authorization:'Bearer fake'},body},res);
 return res;
}
describe('Campaign personalized draft creation API integration',()=>{
 let old;
 beforeAll(()=>{old=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';});
 afterAll(()=>{if(old===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old;});
 beforeEach(()=>{createDocument.mockClear();saveVersion.mockClear();});
 test('creates one draft per campaign recipient and reuses it on a repeated request',async()=>{
  const owner=randomUUID(),db=database(owner),handler=createHandler(()=>db.sb);
  const created=await request(handler,{action:'create',workspace_id:db.space,title:'Clix investment cooperation',kind:'investment'});
  expect(created.code).toBe(201);
  const id=created.body.campaign.id;
  const recipients=await request(handler,{action:'add_recipients',id,recipients:[{organization:'Alpha Capital',email:'investor@example.com'}]});
  expect(recipients.code).toBe(201);
  const recipientId=recipients.body.recipients[0].id;
  const updated=await request(handler,{action:'update',id,title:'Clix investment cooperation',description:'',
   subject_template:'دعوة للتعاون مع {{organization}}',
   body_template:'يسرنا بحث فرص التعاون في تمويل التسويق والتشغيل للمشروع، وفق المعلومات المعتمدة وبعد إجراء العناية الواجبة مع {{organization}}.'});
  expect(updated.code).toBe(200);
  const first=await request(handler,{action:'prepare_draft',id,recipient_id:recipientId});
  expect(first.code).toBe(200);
  expect(first.body.review_url).toContain('campaign_workspace_id='+db.space);
  expect(createDocument).toHaveBeenCalledTimes(1);
  expect(saveVersion).toHaveBeenCalledTimes(1);
  expect(db.tables.correspondence_documents).toHaveLength(1);
  const second=await request(handler,{action:'prepare_draft',id,recipient_id:recipientId});
  expect(second.code).toBe(200);
  expect(createDocument).toHaveBeenCalledTimes(1);
  expect(saveVersion).toHaveBeenCalledTimes(1);
  expect(second.body.draft_document_id).toBe(first.body.draft_document_id);
  expect(db.tables.correspondence_campaign_recipients[0].status).toBe('prepared');
 });
 test('rejects missing reviewed template before creating any official document',async()=>{
  const owner=randomUUID(),db=database(owner),handler=createHandler(()=>db.sb);
  const created=await request(handler,{action:'create',workspace_id:db.space,title:'Any campaign',kind:'investment'});
  const id=created.body.campaign.id;
  const added=await request(handler,{action:'add_recipients',id,recipients:[{organization:'One',email:'one@example.com'}]});
  const result=await request(handler,{action:'prepare_draft',id,recipient_id:added.body.recipients[0].id});
  expect(result.code).toBe(409);
  expect(createDocument).not.toHaveBeenCalled();
 });
});
