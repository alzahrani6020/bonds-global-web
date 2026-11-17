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
 const activeMembership=record=>record&&record.status==='active';
 function ownerWorkspaceSelected(workspace){
  ownerWorkspace=workspace;
  $('hr-membership-admin').hidden=!ownerLicense||!workspace;
  if(ownerLicense&&workspace)loadOwnerMembers().catch(e=>notify(e.message,true));
 }
 async function loadOwnerMembers(){
  if(!ownerLicense||!ownerWorkspace)return;
  const wid=ownerWorkspace.id;
  const [memberResponse,employeeResponse]=await Promise.all([
   db.from('hr_saas_memberships').select('id,employee_id,user_id,role,status,created_at').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250),
   db.from('hr_saas_employees').select('id,full_name,employee_number').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250)
  ]);
  const members=requireOk(memberResponse),staff=requireOk(employeeResponse);
  if(ownerWorkspace?.id!==wid)return;
  $('hr-member-employee').innerHTML='<option value="">'+t('اختر الموظف','Select employee')+'</option>'+
   staff.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.employee_number)+' — '+esc(x.full_name)+'</option>').join('');
  $('hr-members-table').innerHTML=members.map(m=>{
   const name=staff.find(e=>e.id===m.employee_id)?.full_name||m.employee_id;
   return '<tr><td>'+esc(name)+'</td><td>'+esc(m.user_id)+'</td><td>'+esc(m.role)+
    '</td><td>'+esc(m.status)+'</td><td>'+(m.status==='active'?
    '<button class="secondary" type="button" data-revoke-membership="'+esc(m.id)+'">'+
    t('إيقاف العضوية','Revoke')+'</button>':'—')+'</td></tr>';
  }).join('')||'<tr><td colspan="5">'+t('لا توجد عضويات','No memberships')+'</td></tr>';
 }
 async function addMember(event){
  event.preventDefault();
  if(!ownerLicense||!ownerWorkspace)return;
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   const f=new FormData(event.currentTarget);
   const userId=String(f.get('user_id')||'').trim().toLowerCase();
   const employeeId=String(f.get('employee_id')||'').trim();
   const role=String(f.get('role')||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
    throw Error(t('معرّف الحساب UUID غير صحيح','Invalid user UUID'));
   if(!employeeId||!['employee','hr_manager'].includes(role))throw Error(t('بيانات العضوية غير مكتملة','Incomplete membership'));
   const result=requireOk(await db.from('hr_saas_memberships').insert({
    workspace_id:ownerWorkspace.id,user_id:userId,employee_id:employeeId,role,status:'active'
   }).select('id').single());
   if(!result?.id)throw Error(t('تعذّر إثبات العضوية','Membership not confirmed'));
   event.currentTarget.reset();
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
   return '<tr><td>'+esc(req.request_type)+'</td><td>'+esc(req.subject)+'</td><td>'+esc(req.status)+
    '</td><td>'+esc(req.created_at?.slice(0,10))+'</td><td>'+actions+'</td></tr>';
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
  if(!selectedMembership)return;
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   const data=new FormData(event.currentTarget);
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
   event.currentTarget.reset();await loadRequests();notify(t('سُجل الطلب للمراجعة','Request submitted'));
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
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
   memberships=requireOk(await db.from('hr_saas_memberships')
    .select('id,workspace_id,employee_id,role,status')
    .eq('user_id',user.id).eq('status','active').limit(100));
   memberships=memberships.filter(activeMembership);
   $('hr-self-section').hidden=!memberships.length;
   $('hr-self-workspace').innerHTML=memberships.map(m=>
    '<option value="'+esc(m.id)+'">'+esc(m.workspace_id.slice(0,8))+
    ' — '+esc(m.role)+'</option>').join('');
   if(memberships.length){
    if(!ownerLicense)$('hr-license').hidden=true;
    $('hr-self-workspace').value=memberships[0].id;
    await selectMembership();
   }
  }catch(error){notify(error.message,true);}
 }
 document.addEventListener('bonds-hr-ready',bootstrap);
 if(window.BondsHRContext)bootstrap({detail:window.BondsHRContext});
 document.addEventListener('bonds-hr-owner-workspace',event=>ownerWorkspaceSelected(event.detail?.workspace||null));
 $('hr-member-form').addEventListener('submit',addMember);
 $('hr-members-table').addEventListener('click',revokeMember);
 $('hr-member-refresh').addEventListener('click',()=>loadOwnerMembers().catch(e=>notify(e.message,true)));
 $('hr-self-workspace').addEventListener('change',()=>selectMembership().catch(e=>notify(e.message,true)));
 $('hr-request-form').addEventListener('submit',submitRequest);
 $('hr-requests-refresh').addEventListener('click',()=>loadRequests().catch(e=>notify(e.message,true)));
 $('hr-request-rows').addEventListener('click',decideRequest);
})();
