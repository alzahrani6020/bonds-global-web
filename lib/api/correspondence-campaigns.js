'use strict';

// Authenticated and company-scoped campaign CRUD. Delivery is intentionally
// separate: this endpoint never invokes SMTP, Resend or Zoho.
const { randomUUID, createHash } = require('node:crypto');
const getSupabase = require('./supabase');
const { campaignDefinition, transitionCampaign } = require('./correspondence-campaign-workflow');
const { parseDocument } = require('./document-parser');
const { extractRecipients } = require('./correspondence-recipient-extraction');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const CAN_EDIT=new Set(['owner','admin','manager']);
const CAN_READ=new Set(['owner','admin','manager','editor']);
const MAX_RECIPIENTS=250;
const pick=(value,length)=>typeof value==='string'?value.trim().slice(0,length):'';
function fail(error,status=400){const e=new Error(error);e.status=status;throw e;}
function reply(res,status,data){res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data);}
function query(req,name){const u=new URL(req.url||'/', 'https://bonds-global.com');return req.query?.[name]||u.searchParams.get(name);}
function validId(v){if(!UUID.test(String(v||'')))fail('INVALID_ID');return String(v).toLowerCase();}
function emailAddress(v){const e=pick(v,321).toLowerCase();if(e.length>320||!EMAIL.test(e)||/[\r\n]/.test(e))fail('INVALID_RECIPIENT_EMAIL');return e;}
async function checked(result){if(result.error)throw result.error;return result.data;}
async function membership(sb,workspaceId,user){
  const company=await checked(await sb.from('crm_app_workspaces').select('id,owner_user_id').eq('id',workspaceId).maybeSingle());
  if(!company)fail('WORKSPACE_NOT_FOUND',404);
  if(company.owner_user_id===user.id)return {workspaceId,role:'owner',canWrite:true};
  const row=await checked(await sb.from('crm_app_members').select('role').eq('workspace_id',workspaceId).eq('member_user_id',user.id).eq('active',true).maybeSingle());
  if(!row)fail('WORKSPACE_NOT_FOUND',404);
  return {workspaceId,role:row.role,canWrite:CAN_EDIT.has(row.role)};
}
async function auth(req,sb){
  const header=String(req.headers?.authorization||'');
  if(!/^Bearer [^\s]+$/.test(header))fail('AUTH_REQUIRED',401);
  const {data,error}=await sb.auth.getUser(header.slice(7));
  if(error||!data?.user||data.user.is_anonymous)fail('AUTH_REQUIRED',401);
  return data.user;
}
async function loadCampaign(sb,id){
  return checked(await sb.from('correspondence_campaigns').select('*').eq('id',id).maybeSingle());
}
async function getContext(sb,id,user,write=false){
  const campaign=await loadCampaign(sb,id);
  if(!campaign)fail('CAMPAIGN_NOT_FOUND',404);
  const member=await membership(sb,campaign.workspace_id,user);
  if(!CAN_READ.has(member.role))fail('CAMPAIGN_READ_FORBIDDEN',403);
  if(write&&!member.canWrite)fail('CAMPAIGN_WRITE_FORBIDDEN',403);
  return {campaign,member};
}
async function event(sb,id,user,action,details={}){
  await checked(await sb.from('correspondence_campaign_events').insert({
    campaign_id:id,actor_user_id:user.id,action,details
  }));
}
async function handle(req,res,makeClient=getSupabase){
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'CAMPAIGN_BACKEND_NOT_CONFIGURED'});
  if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  try{
    const sb=makeClient();const user=await auth(req,sb);
    if(req.method==='GET'){
      if(query(req,'mine')==='1'){
        const owned=await checked(await sb.from('crm_app_workspaces').select('id,name').eq('owner_user_id',user.id).limit(100));
        const memberships=await checked(await sb.from('crm_app_members').select('workspace_id,role').eq('member_user_id',user.id).eq('active',true).limit(100));
        const ownedIds=new Set((owned||[]).map(x=>x.id));
        const extraIds=[...new Set((memberships||[]).map(x=>x.workspace_id).filter(id=>id&&!ownedIds.has(id)))];
        const other=extraIds.length
          ? await checked(await sb.from('crm_app_workspaces').select('id,name').in('id',extraIds).limit(100))
          : [];
        const workspaces=[...(owned||[]).map(c=>({...c,role:'owner'})),...(other||[]).map(c=>({...c,role:memberships.find(m=>m.workspace_id===c.id)?.role||'member'}))];
        return reply(res,200,{workspaces});
      }
      if(query(req,'id')){
        const {campaign}=await getContext(sb,validId(query(req,'id')),user);
        const recipients=await checked(await sb.from('correspondence_campaign_recipients').select('id,organization,name,email,status,document_id,provider_message_id').eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).order('created_at',{ascending:true}).limit(500));
        return reply(res,200,{campaign,recipients:recipients||[]});
      }
      const workspaceId=validId(query(req,'workspace_id'));
      const member=await membership(sb,workspaceId,user);
      if(!CAN_READ.has(member.role))fail('CAMPAIGN_READ_FORBIDDEN',403);
      const campaigns=await checked(await sb.from('correspondence_campaigns').select('id,title,kind,status,description,created_at,updated_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100));
      return reply(res,200,{workspace_id:workspaceId,campaigns:campaigns||[]});
    }
    const body=req.body||{};if(typeof body!=='object'||Array.isArray(body))fail('INVALID_PAYLOAD');
    const action=String(body.action||'');
    if(action==='preview_import'){
      const workspaceId=validId(body.workspace_id);
      const member=await membership(sb,workspaceId,user);
      if(!member.canWrite)fail('CAMPAIGN_WRITE_FORBIDDEN',403);
      const mime=String(body.mime||'');
      const allowed=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv']);
      if(!allowed.has(mime))fail('UNSUPPORTED_IMPORT_TYPE',415);
      const raw=String(body.file_base64||'');
      if(raw.length<8||raw.length>2_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))fail('IMPORT_FILE_LIMIT',413);
      const buffer=Buffer.from(raw,'base64');
      if(!buffer.length||buffer.length>2*1024*1024)fail('IMPORT_FILE_LIMIT',413);
      let parsed;
      try {
        parsed=await parseDocument({buffer,mime,filename:pick(body.filename,180)},{timeoutMs:10000});
      }catch(err){
        if(err?.name==='DocumentParserError')fail(err.code||'IMPORT_PARSE_FAILED',422);
        throw err;
      }
      return reply(res,200,{...extractRecipients(parsed),workspace_id:workspaceId,source_type:mime});
    }
    if(action==='create'){
      const workspaceId=validId(body.workspace_id);
      const member=await membership(sb,workspaceId,user);
      if(!member.canWrite)fail('CAMPAIGN_WRITE_FORBIDDEN',403);
      const definition=campaignDefinition({id:randomUUID(),tenantId:workspaceId,kind:body.kind,title:body.title,status:'draft'});
      const campaign=await checked(await sb.from('correspondence_campaigns').insert({
        id:definition.id,workspace_id:workspaceId,created_by:user.id,kind:definition.kind,
        title:definition.title,status:'draft',description:pick(body.description,2000)
      }).select('*').single());
      await event(sb,campaign.id,user,'created');return reply(res,201,{campaign});
    }
    const id=validId(body.id);const {campaign,member}=await getContext(sb,id,user,true);
    if(action==='update'){
      if(campaign.status!=='draft')fail('CAMPAIGN_NOT_EDITABLE',409);
      const title=pick(body.title,181);if(title.length<3||title.length>180)fail('INVALID_TITLE');
      const update={title,description:pick(body.description,2000),updated_at:new Date().toISOString()};
      const item=await checked(await sb.from('correspondence_campaigns').update(update).eq('id',id).eq('workspace_id',member.workspaceId).eq('status','draft').select('*').maybeSingle());
      if(!item)fail('CAMPAIGN_CHANGED',409);
      await event(sb,id,user,'updated');return reply(res,200,{campaign:item});
    }
    if(action==='add_recipients'){
      if(campaign.status!=='draft')fail('CAMPAIGN_NOT_EDITABLE',409);
      if(!Array.isArray(body.recipients)||!body.recipients.length||body.recipients.length>MAX_RECIPIENTS)fail('INVALID_RECIPIENT_BATCH');
      const seen=new Set();
      const recipients=body.recipients.map(r=>{
        if(!r||typeof r!=='object'||Array.isArray(r))fail('INVALID_RECIPIENT');
        const email=emailAddress(r.email);
        if(seen.has(email))fail('DUPLICATE_RECIPIENT');seen.add(email);
        const organization=pick(r.organization,180),name=pick(r.name,180);
        if(!organization&&!name)fail('RECIPIENT_NAME_REQUIRED');
        return {campaign_id:id,workspace_id:member.workspaceId,organization,name,email,status:'pending'};
      });
      const existing=await checked(await sb.from('correspondence_campaign_recipients').select('email').eq('campaign_id',id).eq('workspace_id',member.workspaceId).limit(500));
      if((existing||[]).length+recipients.length>MAX_RECIPIENTS)fail('CAMPAIGN_RECIPIENT_LIMIT');
      const existingEmails=new Set((existing||[]).map(x=>String(x.email).toLowerCase()));
      if(recipients.some(x=>existingEmails.has(x.email)))fail('DUPLICATE_RECIPIENT');
      const records=await checked(await sb.from('correspondence_campaign_recipients').insert(recipients).select('id,organization,name,email,status'));
      await event(sb,id,user,'recipients_added',{count:records.length});
      return reply(res,201,{recipients:records});
    }
    if(action==='bind_issued_letter'){
      if(!['draft','review','approved'].includes(campaign.status))fail('CAMPAIGN_NOT_BINDABLE',409);
      const recipientId=validId(body.recipient_id),documentId=validId(body.document_id);
      const recipient=await checked(await sb.from('correspondence_campaign_recipients').select('*').eq('id',recipientId).eq('campaign_id',id).eq('workspace_id',member.workspaceId).maybeSingle());
      if(!recipient||recipient.document_id)fail('RECIPIENT_NOT_AVAILABLE',409);
      const doc=await checked(await sb.from('correspondence_documents').select('id,company_id,workspace_context,status,recipient_email,artifact_path,artifact_hash,issued_hash,stamp_hash,verification_token').eq('id',documentId).maybeSingle());
      if(!doc||doc.workspace_context?.campaign_workspace_id!==member.workspaceId||!['issued','sent'].includes(doc.status)||doc.recipient_email?.toLowerCase()!==recipient.email||!doc.artifact_hash||!doc.issued_hash||!doc.stamp_hash||!doc.verification_token||!doc.artifact_path)fail('ISSUED_DOCUMENT_NOT_VERIFIED',409);
      const issue=await checked(await sb.from('correspondence_issues').select('id,verification_token,pdf_hash,issued_hash,stamp_hash,state').eq('document_id',documentId).eq('state','active').order('issue_version',{ascending:false}).limit(1).maybeSingle());
      if(!issue||issue.pdf_hash!==doc.artifact_hash||issue.issued_hash!==doc.issued_hash||issue.stamp_hash!==doc.stamp_hash||issue.verification_token!==doc.verification_token)fail('ISSUE_BINDING_MISMATCH',409);
      const {data:blob,error:storageError}=await sb.storage.from('correspondence-artifacts').download(doc.artifact_path);
      if(storageError||!blob)fail('ISSUED_PDF_UNAVAILABLE',409);
      const digest=createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
      if(digest!==doc.artifact_hash)fail('ISSUED_PDF_HASH_MISMATCH',409);
      const updated=await checked(await sb.from('correspondence_campaign_recipients').update({document_id:documentId,status:'issued',updated_at:new Date().toISOString()}).eq('id',recipientId).eq('campaign_id',id).eq('workspace_id',member.workspaceId).is('document_id',null).select('id,document_id,status').maybeSingle());
      if(!updated)fail('RECIPIENT_CHANGED',409);
      await event(sb,id,user,'issued_letter_bound',{recipient_id:recipientId,document_id:documentId});
      return reply(res,200,{recipient:updated});
    }
    if(['submit','approve','return','cancel','pause','start','complete'].includes(action)){
      // No transition to running without a persisted tenant-verified mailbox,
      // transactional dispatch queue and independently tested delivery.
      if(action==='start'||action==='complete')fail('AUTOMATED_DELIVERY_NOT_CONFIGURED',409);
      if(action==='approve'&&member.role!=='owner'&&member.role!=='admin')fail('APPROVAL_FORBIDDEN',403);
      const next=transitionCampaign({id,tenantId:member.workspaceId,status:campaign.status},action,{
        authorization:'verified-server-side',actorTenantId:member.workspaceId,actorId:user.id,canApprove:member.role==='owner'||member.role==='admin'
      });
      const changed=await checked(await sb.from('correspondence_campaigns').update({
        status:next.status,updated_at:new Date().toISOString(),
        ...(action==='approve'?{approved_by:user.id,approved_at:new Date().toISOString()}:{})
      }).eq('id',id).eq('workspace_id',member.workspaceId).eq('status',campaign.status).select('*').maybeSingle());
      if(!changed)fail('CAMPAIGN_CHANGED',409);
      await event(sb,id,user,action);return reply(res,200,{campaign:changed});
    }
    return reply(res,400,{error:'UNKNOWN_ACTION'});
  }catch(e){return reply(res,e.status||503,{error:e.status?e.message:'CAMPAIGN_BACKEND_UNAVAILABLE'});}
}
module.exports=handle;
module.exports.createHandler=makeClient=>(req,res)=>handle(req,res,makeClient);
