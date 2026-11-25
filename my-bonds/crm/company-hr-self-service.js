/* Personnel access and employee self-service in the existing Company Programs dashboard.
 * Authorization is enforced in PostgreSQL RLS and triggers, never by these controls.
 * No payroll, identity document, bank, contract or employee file is exposed to staff.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const english=document.documentElement.lang==='en';
 const t=(ar,en)=>english?en:ar;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const requireOk=result=>{if(result.error)throw result.error;return result.data;};
 let db,user,ownerLicense=false,ownerWorkspace=null,memberships=[],selectedMembership=null,requests=[];
 const notify=(message,fail=false)=>{
  const n=$('hr-self-status');n.textContent=message||'';n.hidden=!message;n.style.display=message?'block':'none';
  n.classList.toggle('error',fail);
 };
 // Preserve the fragment-only invitation token across the OAuth login round trip.
 // sessionStorage is scoped to this browser tab; never put bearer tokens in query strings.
 const inviteStorageKey='bonds_hr_pending_invite_v1';
 let inviteFromFragment=new URLSearchParams(location.hash.slice(1)).get('invite');
 if(inviteFromFragment){
  try{sessionStorage.setItem(inviteStorageKey,inviteFromFragment);}catch(_){}
 }
 const roleLabel=role=>({employee:t('موظف','Employee'),hr_manager:t('مسؤول الموارد البشرية','HR manager')}[role]||role);
 const stateLabel=state=>({pending:t('بانتظار القبول','Pending acceptance'),accepted:t('مقبولة','Accepted'),approved:t('معتمدة','Approved'),rejected:t('مرفوضة','Rejected'),revoked:t('ملغاة','Revoked'),active:t('نشطة','Active')}[state]||state);
 const requestTypeLabel=type=>({leave:t('إجازة','Leave'),attendance_correction:t('تصحيح حضور','Attendance correction'),certificate:t('شهادة وظيفية','Employment certificate'),training:t('تدريب','Training'),other:t('أخرى','Other')}[type]||type);
 const localDate=value=>value?new Intl.DateTimeFormat(english?'en-GB':'ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
 function offerAccountSwitch(){
  const target=$('hr-invite-switch');if(target)target.hidden=false;
 }
 async function switchInviteAccount(){
  const button=$('hr-invite-switch');if(button)button.disabled=true;
  try{
   // Never change authorization or mark a token accepted on behalf of another user.
   // Preserve the token in this tab and let the invited user authenticate normally.
   const inviteToken=inviteFromFragment||sessionStorage.getItem(inviteStorageKey);
   if(inviteToken)sessionStorage.setItem(inviteStorageKey,inviteToken);
   requireOk(await db.auth.signOut());
   const destination=location.origin+'/my-bonds/crm/?program=hr';
   location.assign('/calculators/auth/index.html?redirect='+encodeURIComponent(destination));
  }catch(error){notify(t('تعذر تبديل الحساب: ','Unable to switch account: ')+error.message,true);if(button)button.disabled=false;}
 }
 const activeMembership=record=>record&&record.status==='active';
 function ownerWorkspaceSelected(workspace){
  ownerWorkspace=workspace;
  $('hr-membership-admin').hidden=!ownerLicense||!workspace;
  if(ownerLicense&&workspace)loadOwnerMembers().catch(e=>notify(e.message,true));
 }
 async function loadOwnerMembers(){
  if(!ownerLicense||!ownerWorkspace)return;
  const wid=ownerWorkspace.id;
  const [memberResponse,employeeResponse,inviteResponse]=await Promise.all([
   db.from('hr_saas_memberships').select('id,employee_id,user_id,role,status,created_at').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250),
   db.from('hr_saas_employees').select('id,full_name,employee_number').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250),
   db.from('hr_saas_invitations').select('id,employee_id,invited_email,role,status,token,created_at,expires_at').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250)
  ]);
  const members=requireOk(memberResponse),staff=requireOk(employeeResponse),invites=requireOk(inviteResponse);
  if(ownerWorkspace?.id!==wid)return;
  $('hr-member-employee').innerHTML='<option value="">'+t('اختر الموظف','Select employee')+'</option>'+
   staff.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.employee_number)+' — '+esc(x.full_name)+'</option>').join('');
  $('hr-invite-employee').innerHTML=$('hr-member-employee').innerHTML;
  $('hr-invites-table').innerHTML=invites.map(inv=>{
   const name=staff.find(e=>e.id===inv.employee_id)?.full_name||'—';
   const alreadyActive=members.some(m=>m.status==='active'&&m.employee_id===inv.employee_id&&m.role===inv.role);
   const pending=!alreadyActive&&inv.status==='pending'&&new Date(inv.expires_at)>new Date();
   const state=alreadyActive?t('عضوية نشطة — الدعوة السابقة غير مطلوبة','Membership active — prior invite not needed'):
    inv.status==='pending'&&!pending?t('منتهية الصلاحية','Expired'):stateLabel(inv.status);
   return '<tr><td>'+esc(name)+'</td><td>'+esc(inv.invited_email)+'</td><td>'+esc(roleLabel(inv.role))+'</td><td>'+
    esc(t('الانضمام إلى نظام الموارد البشرية','Join the HR system'))+'</td><td>'+esc(state)+'</td><td>'+
    esc(localDate(inv.created_at))+'</td><td>'+esc(localDate(inv.expires_at))+'</td><td>'+
    (pending?'<button type="button" class="secondary" data-hr-invite-link="'+esc(inv.token)+'">'+t('نسخ الرابط','Copy link')+'</button> '+
    '<button type="button" class="secondary" data-hr-invite-send="'+esc(inv.id)+'">'+t('إرسال البريد','Send email')+'</button>':'—')+'</td></tr>';
  }).join('')||'<tr><td colspan="8">'+t('لا توجد دعوات','No invitations')+'</td></tr>';
  $('hr-members-table').innerHTML=members.map(m=>{
   const name=staff.find(e=>e.id===m.employee_id)?.full_name||m.employee_id;
   return '<tr><td>'+esc(name)+'</td><td>'+esc(m.user_id)+'</td><td>'+esc(roleLabel(m.role))+
    '</td><td>'+esc(stateLabel(m.status))+'</td><td>'+(m.status==='active'?
    '<button class="secondary" type="button" data-revoke-membership="'+esc(m.id)+'">'+
    t('إيقاف العضوية','Revoke')+'</button>':'—')+'</td></tr>';
  }).join('')||'<tr><td colspan="5">'+t('لا توجد عضويات','No memberships')+'</td></tr>';
 }
 async function sendInvitationEmail(invitationId){
  if(!ownerLicense||!ownerWorkspace)throw Error(t('غير مصرح بإرسال الدعوات','Not authorized to send invitations'));
  const session=requireOk(await db.auth.getSession())?.session;
  if(!session?.access_token)throw Error(t('انتهت الجلسة. سجّل الدخول مجددًا','Session expired. Sign in again'));
  const response=await fetch('/api/hr-invite',{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({invitation_id:invitationId})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.success!==true){
   if(payload.error==='HR_EMAIL_UNAVAILABLE'||payload.error==='HR_EMAIL_NOT_SENT')
    throw Error(t('لم تُرسل الرسالة. خدمة البريد غير مهيأة أو رفضت الإرسال؛ استخدم نسخ الرابط إلى أن تُفعّل الخدمة.','Invitation email was not sent. Email service is unavailable; use Copy link until delivery is configured.'));
   throw Error(t('تعذّر إرسال دعوة الموظف: ','Unable to send employee invitation: ')+(payload.error||response.status));
  }
  return payload;
 }
 async function sendExistingInvitation(event){
  const button=event.target.closest('[data-hr-invite-send]');
  if(!button||!ownerLicense)return;
  button.disabled=true;
  try{
   await sendInvitationEmail(button.dataset.hrInviteSend);
   notify(t('قبل مزوّد البريد رسالة الدعوة للإرسال. لم يُثبت وصولها إلى صندوق الوارد بعد.','The email provider accepted the invitation for sending. Inbox delivery is not yet confirmed.'));
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 }
 async function createInvitation(event){
  event.preventDefault();
  const formElement=event.currentTarget;
  if(!ownerLicense||!ownerWorkspace)return;
  const button=formElement.querySelector('[type="submit"]');button.disabled=true;
  try{
   const form=new FormData(formElement);
   const email=String(form.get('email')||'').trim().toLowerCase();
   const employeeId=String(form.get('employee_id')||'');
   const role=String(form.get('role')||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320)
    throw Error(t('البريد الإلكتروني غير صحيح','Invalid recipient email'));
   if(!employeeId||!['employee','hr_manager'].includes(role))
    throw Error(t('بيانات الدعوة غير مكتملة','Incomplete invitation'));
   // Never create or resend an invitation for an already active employee record.
   const active=requireOk(await db.from('hr_saas_memberships').select('id')
    .eq('workspace_id',ownerWorkspace.id).eq('employee_id',employeeId)
    .eq('status','active').limit(1));
   if(active.length)throw Error(t('عضوية هذا الموظف نشطة بالفعل؛ لا حاجة لإعادة الدعوة','Employee already has active access; no invitation needed'));
   // Reuse an existing unexpired invitation; do not generate multiple active tokens.
   const existing=requireOk(await db.from('hr_saas_invitations').select('id,expires_at')
    .eq('workspace_id',ownerWorkspace.id).eq('employee_id',employeeId)
    .eq('invited_email',email).eq('role',role).eq('status','pending')
    .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1));
   if(existing.length){
    await sendInvitationEmail(existing[0].id);
    await loadOwnerMembers();
    notify(t('أُعيد إرسال الدعوة القائمة دون إنشاء دعوة مكررة.','Existing invitation resent without creating a duplicate.'));
    return;
   }
   const result=requireOk(await db.from('hr_saas_invitations').insert({
    workspace_id:ownerWorkspace.id,employee_id:employeeId,invited_email:email,role,created_by:user.id
   }).select('id,token').single());
   if(!result?.id||!result.token)throw Error(t('لم يتم تأكيد إنشاء الدعوة','Invitation not confirmed'));
   formElement.reset();await loadOwnerMembers();
   try{
    await sendInvitationEmail(result.id);
    notify(t('أُنشئت الدعوة وقبل مزوّد البريد إرسالها. وصول الرسالة إلى صندوق الوارد لم يُثبت بعد.','Invitation created and email accepted by the provider. Inbox delivery is not yet confirmed.'));
   }catch(mailError){
    notify(t('حُفظت الدعوة ولكن البريد لم يُرسل: ','Invitation saved, but email was not sent: ')+mailError.message,true);
   }
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 }
 async function copyInvitation(event){
  const button=event.target.closest('[data-hr-invite-link]');
  if(!button||!ownerLicense)return;
  const token=button.dataset.hrInviteLink;
  if(!/^[0-9a-f-]{36}$/i.test(token))return;
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('program','hr');url.hash='invite='+encodeURIComponent(token);
  try{await navigator.clipboard.writeText(url.toString());notify(t('نُسخ رابط الدعوة','Invitation link copied'));}
  catch(error){notify(t('تعذر نسخ رابط الدعوة، تحقق من صلاحيات الحافظة','Clipboard permission required'),true);}
 }
 async function addMember(event){
  event.preventDefault();
  const formElement=event.currentTarget;
  if(!ownerLicense||!ownerWorkspace)return;
  const button=formElement.querySelector('[type="submit"]');button.disabled=true;
  try{
   const f=new FormData(formElement);
   const userId=String(f.get('user_id')||'').trim().toLowerCase();
   const employeeId=String(f.get('employee_id')||'').trim();
   const role=String(f.get('role')||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
    throw Error(t('معرّف الحساب UUID غير صحيح','Invalid user UUID'));
   if(!employeeId||!['employee','hr_manager'].includes(role))throw Error(t('بيانات العضوية غير مكتملة','Incomplete membership'));
   const existing=requireOk(await db.from('hr_saas_memberships').select('id,user_id,employee_id')
    .eq('workspace_id',ownerWorkspace.id).eq('status','active').limit(250));
   if(existing.some(m=>m.user_id===userId||m.employee_id===employeeId))
    throw Error(t('توجد عضوية نشطة للحساب أو للموظف. لا تُنشئ عضوية مكررة','Account or employee already has active membership'));
   const result=requireOk(await db.from('hr_saas_memberships').insert({
    workspace_id:ownerWorkspace.id,user_id:userId,employee_id:employeeId,role,status:'active'
   }).select('id').single());
   if(!result?.id)throw Error(t('تعذّر إثبات العضوية','Membership not confirmed'));
   formElement.reset();
   await loadOwnerMembers();notify(t('تمت إضافة العضوية','Membership created'));
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 }
 async function revokeMember(event){
  const button=event.target.closest('[data-revoke-membership]');
  if(!button||!ownerLicense||!ownerWorkspace)return;
  button.disabled=true;
  try{
   const result=requireOk(await db.from('hr_saas_memberships')
    .update({status:'revoked',updated_at:new Date().toISOString()})
    .eq('workspace_id',ownerWorkspace.id).eq('id',button.dataset.revokeMembership)
    .eq('status','active').select('id').single());
   if(!result?.id)throw Error(t('لم يُؤكّد إيقاف العضوية','Revocation not confirmed'));
   await loadOwnerMembers();notify(t('أُوقفت عضوية الوصول','Access revoked'));
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 }
 function requestRows(){
  $('hr-request-rows').innerHTML=requests.map(req=>{
   const canDecide=selectedMembership?.role==='hr_manager'&&req.status==='pending';
   const actions=canDecide?
    '<button class="secondary" type="button" data-hr-decision="approved" data-hr-request="'+esc(req.id)+'">'+t('اعتماد','Approve')+'</button> '+
    '<button class="secondary" type="button" data-hr-decision="rejected" data-hr-request="'+esc(req.id)+'">'+t('رفض','Reject')+'</button>':'—';
   return '<tr><td>'+esc(requestTypeLabel(req.request_type))+'</td><td><details><summary>'+esc(req.subject)+'</summary>'+
    '<p>'+esc(req.description||'')+'</p></details></td><td>'+esc(stateLabel(req.status))+
    '</td><td>'+esc(localDate(req.created_at))+'</td><td>'+actions+'</td></tr>';
  }).join('')||'<tr><td colspan="5">'+t('لا توجد طلبات','No requests')+'</td></tr>';
 }
 async function loadRequests(){
  if(!selectedMembership)return;
  const wid=selectedMembership.workspace_id;
  const result=await db.from('hr_saas_employee_requests')
   .select('id,request_type,subject,description,created_at,status')
   .eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250);
  if(result.error)throw result.error;
  if(selectedMembership?.workspace_id!==wid)return;
  requests=result.data||[];requestRows();
  $('hr-self-role').textContent=selectedMembership.role==='hr_manager'?
   t('مسؤول الموارد البشرية','HR manager'):t('موظف','Employee');
 }
 async function selectMembership(){
  selectedMembership=memberships.find(m=>m.id===$('hr-self-workspace').value)||null;
  $('hr-self-app').hidden=!selectedMembership;
  if(selectedMembership){notify('');await loadRequests();}
 }
 async function submitRequest(event){
  event.preventDefault();
  const formElement=event.currentTarget;
  if(!selectedMembership)return;
  const button=formElement.querySelector('[type="submit"]');button.disabled=true;
  let savedId=null;
  try{
   const data=new FormData(formElement);
   const payload={
    workspace_id:selectedMembership.workspace_id,
    employee_id:selectedMembership.employee_id,requested_by:user.id,
    request_type:String(data.get('request_type')),
    subject:String(data.get('subject')||'').trim(),
    description:String(data.get('description')||'').trim(),
    from_date:String(data.get('from_date')||'')||null,
    to_date:String(data.get('to_date')||'')||null,
    status:'pending'
   };
   if(!payload.subject||!payload.description)throw Error(t('الموضوع والوصف مطلوبان','Subject and description required'));
   if(payload.from_date&&payload.to_date&&payload.to_date<payload.from_date)
    throw Error(t('تاريخ النهاية يسبق البداية','End date before start'));
   const result=requireOk(await db.from('hr_saas_employee_requests').insert(payload).select('id').single());
   if(!result?.id)throw Error(t('لم يتم تأكيد تسجيل الطلب','Request not confirmed'));
   savedId=result.id;
   // Verify persistence under the employee's own RLS identity before clearing the form.
   const verified=requireOk(await db.from('hr_saas_employee_requests')
    .select('id,workspace_id,employee_id,requested_by,request_type,subject,description,status')
    .eq('id',savedId).eq('workspace_id',payload.workspace_id)
    .eq('requested_by',user.id).limit(1));
   if(verified.length!==1||verified[0].employee_id!==payload.employee_id||
    verified[0].status!=='pending'||verified[0].subject!==payload.subject||
    verified[0].description!==payload.description){
    throw Error(t('لم يتأكد استرجاع الطلب المحفوظ','Could not verify the saved request'));
   }
   await loadRequests();
   if(!requests.some(record=>record.id===savedId))throw Error(t('الطلب محفوظ لكن لم يظهر في القائمة بعد التحديث','Request saved but not visible after refresh'));
   formElement.reset();notify(t('تم حفظ الطلب والتحقق من استرجاعه','Request saved and successfully retrieved'));
  }catch(error){
   notify(savedId?t('حُفظ الطلب ولكن تعذر التحقق من استرجاعه. حدّث القائمة قبل محاولة إعادة الإرسال: ','Request saved, but retrieval could not be verified. Refresh before resubmitting: ')+error.message:error.message,true);
  }finally{button.disabled=false;}
 }
 async function decideRequest(event){
  const button=event.target.closest('[data-hr-decision]');
  if(!button||selectedMembership?.role!=='hr_manager')return;
  button.disabled=true;
  try{
   const result=requireOk(await db.from('hr_saas_employee_requests')
    .update({status:button.dataset.hrDecision,decision_note:String($('hr-decision-note').value||'').trim()||null,
     updated_at:new Date().toISOString()})
    .eq('workspace_id',selectedMembership.workspace_id).eq('id',button.dataset.hrRequest)
    .eq('status','pending').select('id').single());
   if(!result?.id)throw Error(t('لم يتم تأكيد القرار','Decision was not confirmed'));
   await loadRequests();notify(t('تم تسجيل القرار','Decision recorded'));
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 }
 async function bootstrap(event){
  ({db,user,ownerLicense}=event.detail||{});
  if(!db||!user)return;
  try{
   // Fragment avoids sending invitation bearer tokens in HTTP requests/referrer logs.
   const inviteToken=inviteFromFragment||(()=>{try{return sessionStorage.getItem(inviteStorageKey);}catch(_){return null;}})();
   if(inviteToken){
    const button=$('hr-invite-switch');if(button)button.hidden=true;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteToken))
     throw Error(t('رابط الدعوة غير صحيح','Invalid invitation link'));
    const acceptResult=await db.rpc('hr_saas_accept_invitation',{invite_token:inviteToken});
    if(acceptResult.error){
     if(acceptResult.error.code==='42501'){
      offerAccountSwitch();
      throw Error(t('تعذر قبول الدعوة بهذه الجلسة. استخدم زر تبديل الحساب لتسجيل الدخول بالبريد المدعو، أو تحقق من صلاحية الدعوة.','This session cannot accept the invitation. Switch to the invited account or check the invitation validity.'));
     }
     throw acceptResult.error;
    }
    const accepted=acceptResult.data;
    if(!accepted)throw Error(t('تعذر تأكيد العضوية','Membership not confirmed'));
    try{sessionStorage.removeItem(inviteStorageKey);}catch(_){}
    inviteFromFragment=null; // Avoid replaying an already accepted token on later HR ready events.
    const clean=new URL(location.href);clean.hash='';history.replaceState(null,'',clean.pathname+clean.search);
    notify(t('تم قبول الدعوة وتفعيل عضوية الموظف','Invitation accepted and staff access activated'));
   }
   memberships=requireOk(await db.from('hr_saas_memberships')
    .select('id,workspace_id,employee_id,role,status')
    .eq('user_id',user.id).eq('status','active').limit(100));
   memberships=memberships.filter(activeMembership);
   $('hr-self-section').hidden=!memberships.length;
   if(!memberships.length&&!ownerLicense){
    notify(t('لم تُعثر على عضوية موظف نشطة لهذا الحساب. لا يمكن فتح الخدمة الذاتية دون عضوية مسجلة في الشركة.','No active employee membership was found for this account. Self-service requires a registered company membership.'),true);
   }
   $('hr-self-workspace').innerHTML=memberships.map(m=>
    '<option value="'+esc(m.id)+'">'+esc(m.workspace_id.slice(0,8))+
    ' — '+esc(roleLabel(m.role))+'</option>').join('');
   if(memberships.length){
    if(!ownerLicense)$('hr-license').hidden=true;
    $('hr-self-workspace').value=memberships[0].id;
    await selectMembership();
   }
  }catch(error){notify(error.message,true);}
 }
 document.addEventListener('bonds-hr-ready',bootstrap);
 document.addEventListener('bonds-hr-owner-workspace',event=>ownerWorkspaceSelected(event.detail?.workspace||null));
 // Initialization can resolve before this deferred script registers. Restore
 // both auth and selected workspace; the event alone is not replayable.
 if(window.BondsHRContext){
  bootstrap({detail:window.BondsHRContext});
  ownerWorkspaceSelected(window.BondsHRContext.ownerWorkspace||null);
 }
 document.addEventListener('bonds-hr-employee-updated',event=>{
  if(ownerWorkspace?.id===event.detail?.workspace?.id)loadOwnerMembers().catch(e=>notify(e.message,true));
 });
 $('hr-invite-switch').addEventListener('click',switchInviteAccount);
 $('hr-invite-form').addEventListener('submit',createInvitation);
 $('hr-invites-table').addEventListener('click',copyInvitation);
 $('hr-invites-table').addEventListener('click',sendExistingInvitation);
 $('hr-member-form').addEventListener('submit',addMember);
 $('hr-members-table').addEventListener('click',revokeMember);
 $('hr-member-refresh').addEventListener('click',()=>loadOwnerMembers().catch(e=>notify(e.message,true)));
 $('hr-self-workspace').addEventListener('change',()=>selectMembership().catch(e=>notify(e.message,true)));
 $('hr-request-form').addEventListener('submit',submitRequest);
 $('hr-requests-refresh').addEventListener('click',()=>loadRequests().catch(e=>notify(e.message,true)));
 $('hr-request-rows').addEventListener('click',decideRequest);
})();
