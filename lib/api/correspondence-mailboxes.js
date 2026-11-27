'use strict';
const {randomBytes,createHash}=require('node:crypto');
const getSupabase=require('./supabase');
const {buildAuthorizeUrl,exchangeCode,verifiedAccount}=require('./correspondence-zoho-oauth');
const {encryptToken}=require('./correspondence-mailbox-crypto');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function fail(reason,status=400){const e=new Error(reason);e.status=status;throw e;}
function reply(res,status,body){res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function uuid(v){if(!UUID.test(String(v||'')))fail('INVALID_ID');return String(v).toLowerCase();}
function configs(){
 const clientId=process.env.ZOHO_OAUTH_CLIENT_ID,clientSecret=process.env.ZOHO_OAUTH_CLIENT_SECRET,
 redirectUri=process.env.BONDS_ZOHO_REDIRECT_URI,key=process.env.BONDS_MAILBOX_ENCRYPTION_KEY;
 if(!clientId||!clientSecret||!redirectUri||!key||Buffer.from(key,'base64').length!==32)fail('ZOHO_OAUTH_NOT_CONFIGURED',503);
 return {clientId,clientSecret,redirectUri};
}
async function checked(r){if(r.error)throw r.error;return r.data;}
async function userFromBearer(sb,req){
 const auth=String(req.headers?.authorization||'');
 if(!/^Bearer [^\s]+$/.test(auth))fail('AUTH_REQUIRED',401);
 const {data,error}=await sb.auth.getUser(auth.slice(7));
 if(error||!data?.user||data.user.is_anonymous)fail('AUTH_REQUIRED',401);
 return data.user;
}
async function ownerOrAdmin(sb,workspaceId,userId){
 const company=await checked(await sb.from('crm_app_workspaces').select('id,owner_user_id').eq('id',workspaceId).maybeSingle());
 if(!company)fail('WORKSPACE_NOT_FOUND',404);
 if(company.owner_user_id===userId)return;
 const member=await checked(await sb.from('crm_app_members').select('role').eq('workspace_id',workspaceId).eq('member_user_id',userId).eq('active',true).maybeSingle());
 if(!member||member.role!=='admin')fail('MAILBOX_PERMISSION_DENIED',403);
}
function redirect(res,success){
 res.statusCode=303;res.setHeader('Location','/correspondence-campaigns.html?zoho_'+(success?'connected=1':'error=connection_failed'));
 res.setHeader('Cache-Control','no-store');res.end();
}
async function handler(req,res,makeClient=getSupabase){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'MAILBOX_BACKEND_NOT_CONFIGURED'});
 try{
  const sb=makeClient();
  const url=new URL(req.url||'/', 'https://bonds-global.com');
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(req.method==='GET'&&state){
   if(!code||code.length>1024||state.length>256)fail('INVALID_OAUTH_RESPONSE');
   const settings=configs(),hash=createHash('sha256').update(state).digest('hex'),now=new Date().toISOString();
   const request=await checked(await sb.from('correspondence_mailbox_oauth_states').update({consumed_at:now})
    .eq('state_hash',hash).is('consumed_at',null).gt('expires_at',now).select('*').maybeSingle());
   if(!request)fail('OAUTH_STATE_EXPIRED_OR_REUSED',403);
   await ownerOrAdmin(sb,request.workspace_id,request.actor_user_id);
   const tokens=await exchangeCode({...settings,region:request.region,code});
   if(!tokens.refresh_token)fail('ZOHO_REFRESH_TOKEN_NOT_GRANTED',409);
   const account=await verifiedAccount({region:request.region,address:request.requested_address,accessToken:tokens.access_token});
   const encryptedRefresh=encryptToken(tokens.refresh_token);
   const existing=await checked(await sb.from('correspondence_mailboxes').select('id')
    .eq('workspace_id',request.workspace_id).ilike('address',account.address).maybeSingle());
   const changes={workspace_id:request.workspace_id,provider:'zoho',address:account.address,
    region:account.region,account_id:account.accountId,encrypted_refresh_token:encryptedRefresh,
    verified_at:new Date().toISOString(),enabled:true,connected_by:request.actor_user_id,updated_at:new Date().toISOString()};
   if(existing){
    await checked(await sb.from('correspondence_mailboxes').update(changes).eq('id',existing.id).eq('workspace_id',request.workspace_id));
   } else {
    await checked(await sb.from('correspondence_mailboxes').insert(changes));
   }
   return redirect(res,true);
  }
  const user=await userFromBearer(sb,req);
  if(req.method==='GET'){
   const id=uuid(url.searchParams.get('workspace_id')||req.query?.workspace_id);
   await ownerOrAdmin(sb,id,user.id);
   const list=await checked(await sb.from('correspondence_mailboxes')
    .select('id,address,provider,region,enabled,verified_at').eq('workspace_id',id).order('created_at',{ascending:false}).limit(30));
   return reply(res,200,{workspace_id:id,mailboxes:list||[]});
  }
  if(req.method!=='POST')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  const input=req.body||{},workspaceId=uuid(input.workspace_id);
  await ownerOrAdmin(sb,workspaceId,user.id);
  if(input.action==='connect'){
   const settings=configs();
   const address=String(input.address||'').trim().toLowerCase(),region=String(input.region||'com');
   if(address.length>320||!EMAIL.test(address))fail('INVALID_SENDER_ADDRESS');
   const secretState=randomBytes(32).toString('base64url');
   const stateHash=createHash('sha256').update(secretState).digest('hex');
   await checked(await sb.from('correspondence_mailbox_oauth_states').insert({
    state_hash:stateHash,workspace_id:workspaceId,actor_user_id:user.id,requested_address:address,region,
    expires_at:new Date(Date.now()+10*60*1000).toISOString()
   }));
   const consentUrl=buildAuthorizeUrl({region,clientId:settings.clientId,redirectUri:settings.redirectUri,state:secretState});
   return reply(res,200,{authorization_url:consentUrl});
  }
  if(input.action==='disable'){
   const mailboxId=uuid(input.mailbox_id);
   const item=await checked(await sb.from('correspondence_mailboxes')
    .update({enabled:false,updated_at:new Date().toISOString()})
    .eq('id',mailboxId).eq('workspace_id',workspaceId).select('id,address,enabled').maybeSingle());
   if(!item)fail('MAILBOX_NOT_FOUND',404);
   return reply(res,200,{mailbox:item});
  }
  return reply(res,400,{error:'UNKNOWN_MAILBOX_ACTION'});
 }catch(e){
  // Callback errors must never leak provider codes or tokens into redirects.
  if(req.method==='GET'&&new URL(req.url||'/', 'https://bonds-global.com').searchParams.get('state'))
   return redirect(res,false);
  return reply(res,e.status||503,{error:e.status?e.message:'MAILBOX_SERVICE_UNAVAILABLE'});
 }
}
module.exports=handler;
module.exports.createHandler=makeClient=>(req,res)=>handler(req,res,makeClient);
