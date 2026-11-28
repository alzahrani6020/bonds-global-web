'use strict';
// Authenticated RLS-enforced receiver for approved customer-owned directory
// records. No service_role, SMTP/Zoho, HR employees, or cross-workspace copying.
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function normalize(s){return String(s||'').normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي')}
function stableId(wid,row){
 const key=wid+'|'+row.type+'|'+normalize(row.name)+'|'+normalize(row.email);
 const bytes=crypto.createHash('sha256').update(key).digest().subarray(0,16);
 bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
 const h=bytes.toString('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function sanitize(record){
 if(!record||typeof record!=='object'||Array.isArray(record)||!['organization','contact'].includes(record.type))throw Error('INVALID_DIRECTORY_RECORD');
 const name=String(record.name||'').trim();
 if(!name||name.length>240||/[\u0000-\u001f]/.test(name))throw Error('INVALID_DIRECTORY_NAME');
 const optional=(key,limit=200)=>{
  const v=record[key];
  if(v===undefined||v===null||v==='')return null;
  if(typeof v!=='string'||v.length>limit||/[\u0000-\u001f]/.test(v))throw Error('INVALID_DIRECTORY_FIELD');
  return v.trim()||null;
 };
 const email=optional('email',254)?.toLowerCase()||null;
 if(email&&!EMAIL.test(email))throw Error('INVALID_DIRECTORY_EMAIL');
 const phone=optional('phone',40);
 if(phone&&!/^[+()0-9 .-]{3,40}$/.test(phone))throw Error('INVALID_DIRECTORY_PHONE');
 const common={type:record.type,name,email,phone};
 return record.type==='organization'
  ? {...common,city:optional('city',100),country:optional('country',100),sector:optional('sector',80),legal_name:optional('legal_name',240)}
  : {...common,role:optional('role',120)};
}
function response(res,status,payload){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Authorization');return res.status(status).json(payload);
}
function createCommercialDirectoryReceiver({clientFactory}={}){
 return async function receive(req,res){
  if(req.method!=='POST')return response(res,405,{error:'METHOD_NOT_ALLOWED'});
  const token=String(req.headers?.authorization||'').match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token)return response(res,401,{error:'AUTH_REQUIRED'});
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||body.schema_version!==1||body.approved!==true||body.send_mail!==false||body.create_hr_employee!==false)return response(res,400,{error:'INVALID_REVIEW_ENVELOPE'});
  const wid=body.workspace_id;
  if(typeof wid!=='string'||!UUID.test(wid))return response(res,400,{error:'INVALID_WORKSPACE_ID'});
  if(!['crm','correspondence','hr'].includes(body.target))return response(res,400,{error:'INVALID_TARGET'});
  // A commercial directory is not proof of an employment relationship.
  // HR must link explicitly to existing employees and company memberships.
  if(body.target==='hr')return response(res,422,{error:'HR_EMPLOYMENT_LINK_REVIEW_REQUIRED'});
  if(!Array.isArray(body.records)||!body.records.length||body.records.length>25)return response(res,400,{error:'INVALID_DIRECTORY_BATCH'});
  let records;
  try{records=body.records.map(sanitize)}catch{return response(res,400,{error:'INVALID_DIRECTORY_RECORD'})}
  if(new Set(records.map(x=>x.type)).size!==1)return response(res,400,{error:'SINGLE_ENTITY_TYPE_PER_BATCH_REQUIRED'});
  const configUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
  if(typeof clientFactory!=='function'&&(!configUrl||!anonKey))return response(res,503,{error:'DIRECTORY_BACKEND_UNAVAILABLE'});
  const makeClient=clientFactory||((token)=>createClient(configUrl,anonKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}}));
  try{
   const db=makeClient(token);
   const {data:authenticated,error:authError}=await db.auth.getUser(token);
   const user=authenticated?.user;
   if(authError||!user||user.is_anonymous)return response(res,401,{error:'AUTH_REQUIRED'});
   const {data:ws,error:wsError}=await db.from('crm_app_workspaces').select('id,owner_user_id').eq('id',wid).maybeSingle();
   if(wsError)throw wsError;
   if(!ws)return response(res,404,{error:'WORKSPACE_NOT_FOUND'});
   if(ws.owner_user_id!==user.id){
    const {data:membership,error:memberError}=await db.from('crm_app_members').select('role').eq('workspace_id',wid).eq('member_user_id',user.id).eq('active',true).limit(1);
    if(memberError)throw memberError;
    if(!['admin','editor'].includes(membership?.[0]?.role))return response(res,403,{error:'IMPORT_NOT_AUTHORIZED'});
   }
   const type=records[0].type;
   const table=type==='organization'?'crm_app_companies':'crm_app_contacts';
   const ids=records.map(row=>stableId(wid,row));
   if(new Set(ids).size!==ids.length)return response(res,409,{error:'DUPLICATE_IN_BATCH'});
   // Preflight existing company/contact names; SQL primary keys handle concurrent
   // same-source imports, and database RLS independently authorizes the INSERT.
   for(const row of records){
    const {data:existing,error:findError}=await db.from(table).select('id').eq('workspace_id',wid).eq('name',row.name).limit(1);
    if(findError)throw findError;
    if(existing?.length)return response(res,409,{error:'DUPLICATE_REVIEW_REQUIRED'});
   }
   const entries=records.map((r,i)=>type==='organization'
    ? {id:ids[i],workspace_id:wid,name:r.name,legal_name:r.legal_name,email:r.email,phone:r.phone,city:r.city,country:r.country,sector:r.sector}
    : {id:ids[i],workspace_id:wid,name:r.name,email:r.email,phone:r.phone,role:r.role,source:'portable-intelligence-reviewed'});
   // One PostgREST INSERT of one entity type is all-or-nothing in PostgreSQL.
   const {data:inserted,error:insertError}=await db.from(table).insert(entries).select('id,workspace_id');
   if(insertError){
    if(insertError.code==='23505')return response(res,409,{error:'DUPLICATE_REVIEW_REQUIRED'});
    throw insertError;
   }
   // INSERT ... RETURNING is not an independent destination read. A committed
   // insert must never be reported as rolled back when a later read fails.
   if(!Array.isArray(inserted)||inserted.length!==entries.length||inserted.some(x=>x.workspace_id!==wid)){
    return response(res,202,{accepted:true,verified:false,workspace_id:wid,target:body.target,error:'INSERT_RETURNING_UNVERIFIED',send_mail:false,create_hr_employee:false});
   }
   const receiptId=crypto.randomUUID();
   let verified=false;
   try{
    // Use the same authenticated/RLS-scoped client, with a fresh SELECT query.
    const {data:readback,error:readError}=await db.from(table).select('id,workspace_id,name').eq('workspace_id',wid).in('id',ids);
    verified=!readError&&Array.isArray(readback)&&readback.length===entries.length
      &&new Set(readback.map(x=>x.id)).size===ids.length
      &&readback.every(x=>x.workspace_id===wid&&ids.includes(x.id)&&entries.some(e=>e.id===x.id&&e.name===x.name));
   }catch{verified=false}
   if(!verified){
    return response(res,202,{accepted:true,verified:false,workspace_id:wid,target:body.target,accepted_count:inserted.length,receipt_id:receiptId,error:'DESTINATION_READBACK_UNVERIFIED',send_mail:false,create_hr_employee:false});
   }
   return response(res,200,{accepted:true,verified:true,workspace_id:wid,target:body.target,accepted_count:inserted.length,receipt_id:receiptId,send_mail:false,create_hr_employee:false});
  }catch{
   return response(res,503,{error:'DIRECTORY_WRITE_UNVERIFIED'});
  }
 };
}
module.exports={createCommercialDirectoryReceiver,stableId,sanitize};
