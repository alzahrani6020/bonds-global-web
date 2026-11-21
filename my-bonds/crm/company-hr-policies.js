/* Company-reviewed jurisdiction policy management and persisted draft calculations.
 * Isolated from CRM. RLS governs reads/writes; server recalculates all drafts.
 * Neither this module nor its API issues payroll or statutory submissions.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const en=document.documentElement.lang==='en';
 const t=(ar,english)=>en?english:ar;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ok=r=>{if(r.error)throw r.error;return r.data;};
 let db,user,ownerLicense=false,workspace=null,policies=[],staff=[],requestId=0;
 const note=(value,error=false)=>{
  const node=$('hr-policy-status');node.textContent=value||'';
  node.hidden=!value;node.classList.toggle('error',error);
 };
 async function load(){
  const current=workspace?.id,serial=++requestId;
  if(!ownerLicense||!current){$('hr-policy-panel').hidden=true;return;}
  $('hr-policy-panel').hidden=false;
  const [rules,employees]=await Promise.all([
   db.from('hr_saas_rule_sets').select('id,jurisdiction,effective_from,effective_to,status').eq('workspace_id',current).order('effective_from',{ascending:false}).limit(250),
   db.from('hr_saas_employees').select('id,employee_number,full_name').eq('workspace_id',current).order('created_at',{ascending:false}).limit(250)
  ]);
  const loadedRules=ok(rules),loadedEmployees=ok(employees);
  if(serial!==requestId||workspace?.id!==current)return;
  policies=loadedRules;staff=loadedEmployees;
  $('hr-policy-rows').innerHTML=policies.map(p=>'<tr><td>'+esc(p.jurisdiction)+'</td><td>'+esc(p.effective_from)+
   '</td><td>'+esc(p.status)+'</td><td>'+(p.status==='draft'?
   '<button type="button" class="secondary" data-hr-policy-approve="'+esc(p.id)+'">'+t('اعتماد سياسة الشركة','Approve company policy')+'</button>':'—')+
   '</td></tr>').join('')||'<tr><td colspan="4">'+t('لا توجد سياسات','No policies')+'</td></tr>';
  $('hr-calc-employee').innerHTML='<option value="">'+t('اختر الموظف','Select employee')+'</option>'+staff.map(e=>
   '<option value="'+esc(e.id)+'">'+esc(e.employee_number)+' — '+esc(e.full_name)+'</option>').join('');
  $('hr-calc-policy').innerHTML='<option value="">'+t('اختر سياسة معتمدة','Select approved policy')+'</option>'+
   policies.filter(p=>p.status==='approved').map(p=>'<option value="'+esc(p.id)+'">'+esc(p.jurisdiction)+' — '+esc(p.effective_from)+'</option>').join('');
 }
 function validateTiers(value){
  const tiers=JSON.parse(value);
  if(!Array.isArray(tiers)||!tiers.length||tiers.length>100)throw Error(t('شرائح الاستحقاق غير صالحة','Invalid service tiers'));
  let previous=0;
  for(const tier of tiers){
   if(!Number.isInteger(tier?.through_days)||tier.through_days<=previous||
    typeof tier.wage_days_per_service_day!=='number'||!Number.isFinite(tier.wage_days_per_service_day)||
    tier.wage_days_per_service_day<0||tier.wage_days_per_service_day>365)
    throw Error(t('شرائح الاستحقاق غير مرتبة أو غير صالحة','Invalid or unordered service tiers'));
   previous=tier.through_days;
  }
  return tiers;
 }
 async function createPolicy(event){
  event.preventDefault();
  if(!ownerLicense||!workspace)return;
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   const f=new FormData(event.currentTarget),jurisdiction=String(f.get('jurisdiction')||'').trim().toUpperCase();
   if(!/^[A-Z]{2}$/.test(jurisdiction))throw Error(t('رمز دولة غير صالح','Invalid country code'));
   const annualDays=Number(f.get('annual_leave_days')),yearDays=Number(f.get('accrual_year_days'));
   if(!Number.isFinite(annualDays)||annualDays<0||annualDays>366||
    !Number.isInteger(yearDays)||yearDays<1||yearDays>366)
    throw Error(t('قواعد احتساب غير صالحة','Invalid accrual rules'));
   const current=workspace.id;
   const record=ok(await db.from('hr_saas_rule_sets').insert({
    workspace_id:current,jurisdiction,effective_from:String(f.get('effective_from')),
    effective_to:String(f.get('effective_to'))||null,
    annual_leave_days:annualDays,accrual_year_days:yearDays,
    service_tiers:validateTiers(String(f.get('service_tiers')||'')),
    status:'draft',created_by:user.id
   }).select('id').single());
   if(!record?.id)throw Error(t('تعذر إثبات الحفظ','Policy save not confirmed'));
   event.currentTarget.reset();await load();
   note(t('حُفظت السياسة كمسودة. الاعتماد مسؤولية الشركة بعد المراجعة القانونية.','Draft policy stored. Company approval requires legal review.'));
  }catch(error){note(error.message,true);}finally{button.disabled=false;}
 }
 async function approve(event){
  const button=event.target.closest('[data-hr-policy-approve]');
  if(!button||!ownerLicense||!workspace)return;
  const policy=policies.find(p=>p.id===button.dataset.hrPolicyApprove&&p.status==='draft');
  if(!policy)return;
  button.disabled=true;
  try{
   const saved=ok(await db.from('hr_saas_rule_sets').update({status:'approved',updated_at:new Date().toISOString()})
    .eq('workspace_id',workspace.id).eq('id',policy.id).eq('status','draft').select('id').single());
   if(!saved?.id)throw Error(t('تعذر تأكيد الاعتماد','Approval not confirmed'));
   await load();note(t('اعتمدت الشركة السياسة وأصبحت غير قابلة للتعديل','Company policy approved and locked'));
  }catch(error){note(error.message,true);}finally{button.disabled=false;}
 }
 async function calculate(event){
  event.preventDefault();
  if(!ownerLicense||!workspace)return;
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   const f=new FormData(event.currentTarget);
   const policy_id=String(f.get('policy_id')||''),employee_id=String(f.get('employee_id')||''),
    kind=String(f.get('kind')||'');
   if(!policies.some(p=>p.id===policy_id&&p.status==='approved')||
    !staff.some(e=>e.id===employee_id))throw Error(t('اختر موظفًا وسياسة معتمدة','Select employee and approved policy'));
   const inputs=kind==='leave_accrual'?{
    as_of:String(f.get('as_of')||''),eligible_days:Number(f.get('eligible_days'))
   }:{
    start_date:String(f.get('start_date')||''),end_date:String(f.get('end_date')||''),
    eligible_daily_wage:Number(f.get('eligible_daily_wage')),currency:String(f.get('currency')||'').toUpperCase()
   };
   if(kind==='leave_accrual'&&(!f.get('eligible_days')||!inputs.as_of)||
      kind==='end_of_service'&&(!f.get('eligible_daily_wage')||!inputs.start_date||!inputs.end_date||!inputs.currency))
    throw Error(t('بيانات الحساب غير مكتملة','Missing calculation fields'));
   const session=ok(await db.auth.getSession())?.session;
   if(!session?.access_token||session.user?.id!==user.id)throw Error(t('سجّل الدخول مجددًا','Sign in again'));
   const response=await fetch('/api/hr-calculations',{method:'POST',headers:{
    'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify({workspace_id:workspace.id,employee_id,policy_id,kind,inputs})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.id||result.status!=='draft')throw Error(t('تعذر تأكيد حفظ المسودة','Draft was not confirmed'));
   $('hr-calculation-result').textContent=JSON.stringify(result,null,2);
   $('hr-calculation-result').hidden=false;
   note(t('حُفظت مسودة الاستحقاق للمراجعة، دون أي صرف مالي','Review draft saved. No payment issued.'));
  }catch(error){note(error.message,true);}finally{button.disabled=false;}
 }
 document.addEventListener('bonds-hr-ready',event=>{
  ({db,user,ownerLicense}=event.detail||{});
 });
 if(window.BondsHRContext)({db,user,ownerLicense}=window.BondsHRContext);
 document.addEventListener('bonds-hr-owner-workspace',event=>{
  workspace=event.detail?.workspace||null;load().catch(e=>note(e.message,true));
 });
 $('hr-policy-form').addEventListener('submit',createPolicy);
 $('hr-policy-rows').addEventListener('click',approve);
 $('hr-calculation-form').addEventListener('submit',calculate);
})();
