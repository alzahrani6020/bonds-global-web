'use strict';
// HR can consume the *approved CRM institutional directory* only when the
// authenticated user owns both the linked CRM and active HR workspaces.
// No contacts become employees, and no mailbox delivery is triggered.
const {createClient}=require('@supabase/supabase-js');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS={organizations:'id,name,legal_name,city,country,sector',contacts:'id,company_id,name,role'};
function reply(res,status,data){res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');return res.status(status).json(data)}
function createHrCommercialDirectory({clientFactory}={}){
 return async function hrDirectory(req,res){
  if(req.method!=='GET')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  const auth=String(req.headers?.authorization||'').match(/^Bearer ([^\s]+)$/)?.[1];
  if(!auth)return reply(res,401,{error:'AUTH_REQUIRED'});
  const url=new URL(req.url,'https://bonds-global.com');
  const wid=req.query?.workspace_id||url.searchParams.get('workspace_id');
  const kind=req.query?.type||url.searchParams.get('type')||'organizations';
  const q=String(req.query?.q??url.searchParams.get('q')??'').trim();
  if(!UUID.test(wid||''))return reply(res,400,{error:'INVALID_WORKSPACE'});
  if(!Object.hasOwn(FIELDS,kind))return reply(res,400,{error:'INVALID_DIRECTORY_TYPE'});
  if(q.length>80||/[^\p{L}\p{N}\s._-]/u.test(q))return reply(res,400,{error:'INVALID_SEARCH'});
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
  const api=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  if(!clientFactory&&(!key||!api))return reply(res,503,{error:'DIRECTORY_UNAVAILABLE'});
  const db=clientFactory?clientFactory(auth):createClient(api,key,{global:{headers:{Authorization:'Bearer '+auth}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
   const {data:login,error:loginErr}=await db.auth.getUser(auth);
   const user=login?.user;
   if(loginErr||!user||user.is_anonymous)return reply(res,401,{error:'AUTH_REQUIRED'});
   const {data:crm,error:crmErr}=await db.from('crm_app_workspaces').select('id,owner_user_id').eq('id',wid).maybeSingle();
   if(crmErr)throw crmErr;
   if(!crm||crm.owner_user_id!==user.id)return reply(res,404,{error:'WORKSPACE_NOT_FOUND'});
   // HR workspace RLS additionally verifies a live HR/suite entitlement.
   const {data:hr,error:hrErr}=await db.from('hr_saas_workspaces').select('id,crm_workspace_id').eq('crm_workspace_id',wid).eq('owner_user_id',user.id).limit(1);
   if(hrErr)throw hrErr;
   if(!hr?.length)return reply(res,403,{error:'HR_WORKSPACE_NOT_ENTITLED'});
   const table=kind==='organizations'?'crm_app_companies':'crm_app_contacts';
   let query=db.from(table).select(FIELDS[kind]).eq('workspace_id',wid).order('name',{ascending:true});
   if(q)query=query.ilike('name','%'+q+'%');
   const {data,error}=await query.limit(50);
   if(error)throw error;
   return reply(res,200,{workspace_id:wid,hr_workspace_id:hr[0].id,type:kind,items:data||[],read_only:true,create_employee:false,send_mail:false});
  }catch{return reply(res,503,{error:'DIRECTORY_READ_UNVERIFIED'})}
 };
}
module.exports={createHrCommercialDirectory};
