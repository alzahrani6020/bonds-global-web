'use strict';
// Loopback-only HTTP host; validates a signed customer license and derives
// actor identity solely from a trusted credential verifier and server session.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {createLicensedCommercialWorkflow}=require('./licensed-commercial-workflow');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY=8*1024*1024,MAX_PREVIEWS=64,PREVIEW_TTL=10*60*1000;
function createCommercialServer({workspaceId,databasePath,licenseToken,licensePublicKey,getMembership,verifyCredentials,ocr,encryptionKey=null,fullDatabaseEncryption=false,backupDirectory=null,destinationConfig=null,getDestinationToken=null,destinationFetch=null,host='127.0.0.1',port=0}={}){
 if(!UUID.test(workspaceId||''))throw Error('WORKSPACE_ID_REQUIRED');
 if(host!=='127.0.0.1'&&host!=='::1')throw Error('LOOPBACK_ONLY');
 if(!Number.isSafeInteger(port)||port<0||port>65535)throw Error('INVALID_PORT');
 if(backupDirectory!==null&&(typeof backupDirectory!=='string'||!path.isAbsolute(backupDirectory)||!fs.statSync(backupDirectory).isDirectory()))throw Error('INVALID_BACKUP_DIRECTORY');
 if(typeof verifyCredentials!=='function'||typeof getMembership!=='function')throw Error('TRUSTED_AUTH_PROVIDER_REQUIRED');
 const wid=workspaceId.toLowerCase();
 const workflow=createLicensedCommercialWorkflow({workspaceId:wid,filename:databasePath,licenseToken,licensePublicKey,getMembership,ocr,encryptionKey,fullDatabaseEncryption});
 if(destinationConfig!==null&&(typeof destinationConfig!=='object'||Array.isArray(destinationConfig)))throw Error('INVALID_DESTINATION_CONFIGURATION');
 const sessions=new Map(),previews=new Map(),attempts=new Map();
 const localFiles={
  '/':{name:'commercial-ui.html',mime:'text/html; charset=utf-8'},
  '/commercial-ui.js':{name:'commercial-ui.js',mime:'text/javascript; charset=utf-8'}
 };
 function respond(res,status,payload,headers={}){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});
  res.end(JSON.stringify(payload));
 }
 function rawCookie(req){const value=String(req.headers.cookie||'').match(/(?:^|;\s*)bondscommercial=([a-f0-9]{64})(?=;|$)/);return value?.[1]||'';}
 function session(req){const token=rawCookie(req);const key=crypto.createHash('sha256').update(token).digest('hex');const found=sessions.get(key);if(!found||found.expires<=Date.now()){sessions.delete(key);return null;}return found;}
 async function json(req){
  return new Promise((resolve,reject)=>{
   const chunks=[];let size=0,overflow=false,settled=false;
   const end=(e,v)=>{if(settled)return;settled=true;e?reject(e):resolve(v);};
   req.on('data',data=>{size+=data.length;if(size>MAX_BODY){overflow=true;return;}if(!overflow)chunks.push(data);});
   req.once('error',()=>end(Error('REQUEST_READ_FAILED')));
   req.once('aborted',()=>end(Error('REQUEST_ABORTED')));
   req.once('end',()=>{
    if(overflow)return end(Error('BODY_LIMIT'));
    try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw Error('INVALID_JSON');end(null,v)}catch{end(Error('INVALID_JSON'))}
   });
  });
 }
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&Object.hasOwn(localFiles,url.pathname)){
    const f=localFiles[url.pathname];res.writeHead(200,{'Content-Type':f.mime,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(path.join(__dirname,f.name)));
   }
   if(req.method==='GET'&&url.pathname==='/health')return respond(res,200,{status:'ok',mode:'customer-local',licensed:true});
   if(req.method==='POST'&&req.headers.origin&&req.headers.origin!=='http://'+host+':'+server.address().port)return respond(res,403,{error:'BAD_ORIGIN'});
   if(req.method==='POST'&&url.pathname==='/login'){
    const ip=req.socket.remoteAddress||'loopback';
    const previous=attempts.get(ip);
    const attempt=previous&&previous.until>Date.now()?previous:{count:0,until:0};
    if(attempt.count>=5&&attempt.until>Date.now())return respond(res,429,{error:'LOGIN_RATE_LIMIT'});
    const input=await json(req);
    if(typeof input.username!=='string'||typeof input.password!=='string'||input.username.length>150||input.password.length>512)return respond(res,400,{error:'INVALID_LOGIN'});
    const actor=await verifyCredentials({username:input.username,password:input.password,workspaceId:wid});
    if(typeof actor!=='string'||!actor.trim()){
     attempts.set(ip,{count:attempt.count+1,until:Date.now()+60000});
     return respond(res,401,{error:'INVALID_LOGIN'});
    }
    attempts.delete(ip);
    const membership=await getMembership({workspaceId:wid,actorId:actor});
    if(!membership||membership.active!==true||membership.workspace_id!==wid||membership.actor_id!==actor)return respond(res,403,{error:'NOT_A_WORKSPACE_MEMBER'});
    const raw=crypto.randomBytes(32).toString('hex'),key=crypto.createHash('sha256').update(raw).digest('hex');
    sessions.set(key,{actorId:actor,expires:Date.now()+30*60*1000});
    return respond(res,200,{authenticated:true,workspace_id:wid},{'Set-Cookie':'bondscommercial='+raw+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800'});
   }
   const auth=session(req);if(!auth)return respond(res,401,{error:'AUTH_REQUIRED'});
   const ctx={workspaceId:wid,actorId:auth.actorId};
   if(req.method==='POST'&&url.pathname==='/logout'){
    sessions.delete(crypto.createHash('sha256').update(rawCookie(req)).digest('hex'));
    for(const [id,p] of previews)if(p.session===rawCookie(req))previews.delete(id);
    return respond(res,200,{ok:true},{'Set-Cookie':'bondscommercial=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
   }
   if(req.method==='POST'&&url.pathname==='/analyze'){
    const input=await json(req);
    if(typeof input.filename!=='string'||typeof input.base64!=='string'||input.base64.length>7*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw Error('INVALID_FILE_INPUT');
    const buffer=Buffer.from(input.base64,'base64');
    if(buffer.toString('base64')!==input.base64)throw Error('INVALID_FILE_ENCODING');
    const analysis=await workflow.analyze({...ctx,file:{filename:input.filename,buffer},defaultType:input.defaultType||null});
    for(const [id,p] of previews)if(p.expires<Date.now())previews.delete(id);
    if(previews.size>=MAX_PREVIEWS)throw Error('PREVIEW_CAPACITY_EXCEEDED');
    const id=crypto.randomBytes(24).toString('hex');
    previews.set(id,{analysis,proposal:null,session:rawCookie(req),expires:Date.now()+PREVIEW_TTL});
    return respond(res,200,{preview_id:id,analysis});
   }
   if(req.method==='POST'&&url.pathname==='/review'){
    const input=await json(req),p=previews.get(input.preview_id);
    if(!p||p.session!==rawCookie(req)||p.expires<=Date.now())throw Error('PREVIEW_NOT_FOUND');
    if(!p.analysis.entity_suggestions)throw Error('UNSTRUCTURED_REVIEW_NOT_APPLICABLE');
    p.proposal=await workflow.prepareEntityReview({workspaceId:wid,analysis:p.analysis,identity:input.identity,entityIndex:input.entityIndex??0});
    return respond(res,200,{proposal:p.proposal,duplicates:await workflow.duplicates({...ctx,proposal:p.proposal})});
   }
   if(req.method==='POST'&&url.pathname==='/commit'){
    const input=await json(req),p=previews.get(input.preview_id);
    if(!p||p.session!==rawCookie(req)||p.expires<=Date.now())throw Error('PREVIEW_NOT_FOUND');
    if(input.approve!==true)throw Error('APPROVAL_REQUIRED');
    const proposal=p.proposal||p.analysis;
    const saved=await workflow.approve({...ctx,proposal,approvedIndices:input.approvedIndices,allowDuplicates:input.allowDuplicates===true,duplicateOverrideReason:input.duplicateOverrideReason??null});
    previews.delete(input.preview_id);
    return respond(res,200,{saved:saved.saved,ids:saved.result.ids});
   }
   if(req.method==='GET'&&url.pathname==='/records')return respond(res,200,{items:await workflow.list(ctx)});
   if(req.method==='GET'&&url.pathname==='/search')return respond(res,200,{items:await workflow.search({...ctx,query:url.searchParams.get('q')||''})});
   if(req.method==='GET'&&url.pathname==='/audit')return respond(res,200,{items:await workflow.audit(ctx)});
   if(req.method==='POST'&&url.pathname==='/update'){
    const input=await json(req);return respond(res,200,await workflow.update({...ctx,id:input.id,changes:input.changes}));
   }
   if(req.method==='POST'&&url.pathname==='/deliver'){
    const data=await json(req),target=data.target;
    if(!destinationConfig||typeof getDestinationToken!=='function'||!Object.hasOwn(destinationConfig,target))throw Error('DESTINATION_INTEGRATION_NOT_CONFIGURED');
    const destination=destinationConfig[target];
    if(!destination||typeof destination.endpoint!=='string'||typeof destination.allowedOrigin!=='string')throw Error('INVALID_DESTINATION_CONFIGURATION');
    const bearerToken=await getDestinationToken({...ctx,target});
    const {deliverReviewedDirectory}=require('./destination-delivery');
    const receipt=await deliverReviewedDirectory({workflow,...ctx,target,recordIds:data.recordIds,remoteEndpoint:destination.endpoint,allowedOrigin:destination.allowedOrigin,bearerToken,fetchImpl:destinationFetch||fetch});
    return respond(res,200,receipt);
   }
   if(req.method==='POST'&&url.pathname==='/backup'){
    if(!backupDirectory)throw Error('BACKUP_DIRECTORY_NOT_CONFIGURED');
    const input=await json(req);
    if(input.confirm!==true)throw Error('BACKUP_CONFIRMATION_REQUIRED');
    const name='bonds-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(6).toString('hex')+'.backup.enc';
    const destination=path.join(backupDirectory,name);
    const result=await workflow.backup({...ctx,destination,passphrase:input.passphrase,tempRoot:backupDirectory});
    return respond(res,200,{destination,sha256:result.sha256,mode:result.mode,encrypted:true});
   }
   if(req.method==='POST'&&url.pathname==='/archive'){
    const input=await json(req);
    if(input.confirm!==true)throw Error('ARCHIVE_CONFIRMATION_REQUIRED');
    return respond(res,200,await workflow.archive({...ctx,id:input.id}));
   }
   if(req.method==='POST'&&url.pathname==='/export'){
    const input=await json(req);
    return respond(res,200,await workflow.exportDirectory({...ctx,target:input.target,recordIds:input.recordIds}));
   }
   return respond(res,404,{error:'NOT_FOUND'});
  }catch(e){
   const message=String(e?.message||'BAD_REQUEST');
   const status=message==='BODY_LIMIT'?413:message==='TENANT_ACCESS_DENIED'||message==='EXPORT_NOT_AUTHORIZED'||message==='LICENSE_FEATURE_DENIED'?403:message.startsWith('LICENSE_')?403:400;
   return respond(res,status,{error:message});
  }
 });
 return {listen:()=>new Promise(resolve=>server.listen(port,host,()=>resolve('http://'+host+':'+server.address().port))),close:()=>new Promise((resolve,reject)=>server.close(e=>{if(e)return reject(e);workflow.close();resolve()})),server};
}
module.exports={createCommercialServer};
