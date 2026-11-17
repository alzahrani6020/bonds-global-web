/* HR operations inside the existing CRM workspace.
 * Owner only. Every query is scoped to the active workspace and protected by
 * PostgreSQL RLS. No bank transfer, WPS, government or payroll posting occurs.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const en=document.documentElement.lang==='en';
 const text=(ar,english)=>en?english:ar;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections={
  employees:['الموظفون والملفات الوظيفية','Employees and personnel records'],
  departments:['الإدارات والوظائف','Departments and positions'],
  recruitment:['التوظيف والتعيين','Recruitment and onboarding'],
  contracts:['العقود وفترات التجربة','Employment contracts and probation'],
  attendance:['الحضور والانصراف','Attendance and check-out'],
  shifts:['الورديات والجداول','Shifts and schedules'],
  leaves:['الإجازات والغياب','Leave and absence'],
  leave_balances:['أرصدة الإجازات','Leave balances'],
  payroll:['الرواتب ومسيرات الموظفين','Employee payroll'],
  payroll_runs:['اعتماد مسيرات الرواتب','Payroll runs and approval'],
  benefits:['المزايا والتأمينات','Benefits and insurance'],
  allowances:['البدلات والمكافآت','Allowances and bonuses'],
  deductions:['الخصومات والجزاءات','Deductions and penalties'],
  claims:['المستحقات والحقوق المالية','Employee entitlements and claims'],
  loans:['السلف والقروض','Employee loans and advances'],
  settlements:['نهاية الخدمة والمخالصات','End-of-service and settlements'],
  performance:['تقييم الأداء','Performance reviews'],
  training:['التدريب والتطوير','Learning and development'],
  documents:['وثائق الموظفين والتجديد','Employee documents and expiry'],
  employee_requests:['الطلبات والخدمة الذاتية','Employee requests'],
  assets:['العهد والأصول المسلمة','Employee assets and custody'],
  governance:['السياسات والامتثال','Policies and compliance'],
  lifecycle:['الترقيات والنقل وإنهاء الخدمة','Promotions, transfer and offboarding'],
  audit:['سجل تدقيق شؤون الموظفين','HR audit trail']
 };
 const fieldLabels={
  employee_number:['الرقم الوظيفي','Employee number'],full_name:['الاسم الكامل','Full name'],
  department:['الإدارة','Department'],job_title:['المسمى الوظيفي','Job title'],
  email:['البريد الإلكتروني','Email'],phone:['الهاتف','Phone'],
  national_id_ref:['مرجع الهوية','Identity reference'],hire_date:['تاريخ الالتحاق','Start date'],
  termination_date:['تاريخ انتهاء العمل','Termination date'],employment_status:['الحالة','Status'],
  basic_salary:['الراتب الأساسي','Base salary'],salary_currency:['عملة الراتب','Salary currency'],
  bank_reference:['مرجع الحساب البنكي','Bank reference'],notes:['ملاحظات','Notes'],
  employee_id:['الموظف المرتبط','Related employee'],title:['الموضوع','Title'],
  status:['الحالة','Status'],effective_date:['تاريخ البداية','Effective date'],
  end_date:['تاريخ النهاية','End date'],amount:['المبلغ','Amount'],
  currency:['العملة','Currency'],details:['تفاصيل إضافية (JSON)','Additional details (JSON)']
 };
 const dateKeys=new Set(['hire_date','termination_date','effective_date','end_date']);
 const sensitiveCategories=new Set(['payroll','payroll_runs','benefits','allowances','deductions','claims','loans','settlements']);
 const $notice=()=> $('hr-status');
 let api=null, activeWorkspace=null,employees=[],records=[],editing=null,section='employees',loadSeq=0;
 function notice(message,error=false){const n=$notice();n.textContent=message;n.className='notice'+(error?' error':'');n.hidden=!message;n.style.display=message?'block':'none';}
 const required=() => { if(!api||!activeWorkspace)throw Error(text('اختر مساحة عمل أولًا','Select a workspace first')); };
 const must=r=>{if(r.error)throw r.error;return r.data;};
 const label=k=>text(...(fieldLabels[k]||[k,k]));
 const statusLabels={draft:['مسودة','Draft'],active:['نشط','Active'],on_leave:['في إجازة','On leave'],suspended:['موقوف','Suspended'],terminated:['منتهية خدمته','Terminated']};
 const fieldsEmployee=[
  ['employee_number','text',true],['full_name','text',true],['department','text'],['job_title','text'],
  ['email','email'],['phone','tel'],['national_id_ref','text'],['hire_date','date'],
  ['termination_date','date'],['employment_status','enum:draft|active|on_leave|suspended|terminated'],
  ['basic_salary','number'],['salary_currency','text'],['bank_reference','text'],['notes','textarea']
 ];
 const fieldsRecord=[
  ['employee_id','employee'],['title','text',true],['status','text',true],
  ['effective_date','date'],['end_date','date'],['amount','number'],['currency','text'],['details','json']
 ];
 function inputField([key,type,req],row){
  const value=row?.[key]??'';
  const caption=esc(label(key));const requiredAttr=req?' required':'';
  if(type==='employee'){
   return '<label class="field">'+caption+'<select name="'+key+'"><option value="">'+text('بدون موظف','No employee')+'</option>'+
   employees.map(emp=>'<option value="'+esc(emp.id)+'"'+(value===emp.id?' selected':'')+'>'+esc(emp.employee_number)+' — '+esc(emp.full_name)+'</option>').join('')+'</select></label>';
  }
  if(type.startsWith('enum:'))return '<label class="field">'+caption+'<select name="'+key+'"'+requiredAttr+'>'+
   type.slice(5).split('|').map(v=>'<option value="'+esc(v)+'"'+(value===v?' selected':'')+'>'+esc(text(...(statusLabels[v]||[v,v])))+'</option>').join('')+'</select></label>';
  if(type==='textarea'||type==='json'){
   let val=type==='json'?(row?.details?JSON.stringify(row.details,null,2):'{}'):value;
   return '<label class="field field-wide">'+caption+'<textarea name="'+key+'" rows="4">'+esc(val)+'</textarea></label>';
  }
  return '<label class="field">'+caption+'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'"'+requiredAttr+(type==='number'?' min="0" step="0.01"':'')+'></label>';
 }
 function editorOpen(row=null){
  editing=row;
  const isEmployee=section==='employees';
  $('hr-form-title').textContent=(row?text('تعديل','Edit'):text('إضافة','Add'))+' '+(isEmployee?text('موظف','employee'):text(...sections[section]));
  $('hr-fields').innerHTML=(isEmployee?fieldsEmployee:fieldsRecord).map(f=>inputField(f,row)).join('');
  $('hr-editor').hidden=false;
  $('hr-editor').scrollIntoView({block:'start'});
 }
 function columnValue(rec,key){
  if(key==='employee_id')return employees.find(x=>x.id===rec.employee_id)?.full_name||'—';
  return rec[key]??'—';
 }
 function render(){
  const isEmployee=section==='employees';
  const columns=isEmployee?['employee_number','full_name','department','job_title','employment_status']:['employee_id','title','status','effective_date','amount'];
  const source=isEmployee?employees:records;
  $('hr-table-head').innerHTML='<tr>'+columns.map(key=>'<th>'+esc(label(key))+'</th>').join('')+'<th>'+text('الإجراء','Action')+'</th></tr>';
  $('hr-table-body').innerHTML=source.length?source.map(item=>'<tr>'+columns.map(key=>'<td>'+esc(columnValue(item,key))+'</td>').join('')+
    '<td><button type="button" class="secondary" data-hr-edit="'+esc(item.id)+'">'+text('تعديل','Edit')+'</button></td></tr>').join(''):
    '<tr><td colspan="6">'+text('لا توجد سجلات','No records')+'</td></tr>';
  $('hr-total').textContent=String(source.length);
 }
 async function load(){
  if(!activeWorkspace)return;
  required();
  const seq=++loadSeq,wid=activeWorkspace.id;
  const people=[],all=[];
  // Page server-side, bounded independently for each workspace. No cross-tenant read.
  for(let start=0;start<10000;start+=250){
   const result=await api.from('hr_app_employees').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).range(start,start+249);
   if(result.error)throw result.error;
   people.push(...(result.data||[]));
   if((result.data||[]).length<250)break;
  }
  if(section!=='employees'&&section!=='audit'){
   for(let start=0;start<10000;start+=250){
    const result=await api.from('hr_app_records').select('*').eq('workspace_id',wid).eq('category',section).order('created_at',{ascending:false}).range(start,start+249);
    if(result.error)throw result.error;
    all.push(...(result.data||[]));
    if((result.data||[]).length<250)break;
   }
  }
  if(seq!==loadSeq||activeWorkspace?.id!==wid)return;
  employees=people;records=all;
  if(section==='audit'){
   const result=await api.from('hr_app_audit').select('created_at,entity,entity_id,action,changed_columns').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(250);
   if(result.error)throw result.error;
   $('hr-table-head').innerHTML='<tr><th>'+text('التاريخ','Date')+'</th><th>'+text('الكيان','Entity')+'</th><th>'+text('الإجراء','Action')+'</th><th>'+text('الحقول المتغيرة','Changed columns')+'</th></tr>';
   $('hr-table-body').innerHTML=(result.data||[]).map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString(en?'en-US':'ar-SA'))+'</td><td>'+esc(x.entity)+'</td><td>'+esc(x.action)+'</td><td>'+esc((x.changed_columns||[]).join(', '))+'</td></tr>').join('');
   $('hr-total').textContent=String(result.data?.length||0);
   $('hr-add').hidden=true;
  }else{
   $('hr-add').hidden=false;render();
  }
 }
 function selectSection(name){
  if(!sections[name]||!activeWorkspace)return;
  section=name;editing=null;$('hr-editor').hidden=true;
  $('hr-section-heading').textContent=text(...sections[name]);
  document.querySelectorAll('[data-hr-section]').forEach(button=>button.classList.toggle('active',button.dataset.hrSection===name));
  notice('');load().catch(error=>notice(error.message,true));
 }
 async function selectWorkspace(w){
  loadSeq++;
  activeWorkspace=w;
  if(!w){$('hr-panel').hidden=true;return;}
  await window.BondsAuth.ensureEnv();
  api=window.BondsAuth.getSupabase();
  const me=must(await api.auth.getUser())?.user;
  // This pre-check is for UX only. Every actual read/write is denied by RLS for non-owners.
  if(!me||me.id!==w.owner_user_id){$('hr-panel').hidden=true;activeWorkspace=null;return;}
  $('hr-panel').hidden=false;
  selectSection(section);
 }
 async function save(event){
  event.preventDefault();
  try{
   required();const form=new FormData(event.currentTarget);
   const isEmployee=section==='employees';
   const fieldset=isEmployee?fieldsEmployee:fieldsRecord;
   const payload={workspace_id:activeWorkspace.id};
   for(const [key,type] of fieldset){
    let value=String(form.get(key)??'').trim();
    if(type==='number')payload[key]=value===''?null:Number(value);
    else if(type==='json'){
     let details={};
     try{details=value?JSON.parse(value):{};}catch(_){throw Error(text('صيغة التفاصيل JSON غير صحيحة','Invalid details JSON'));}
     if(!details||Array.isArray(details)||typeof details!=='object')throw Error(text('التفاصيل يجب أن تكون كائن JSON','Details must be a JSON object'));
     payload[key]=details;
    }else payload[key]=value||null;
   }
   if(!isEmployee){
    payload.category=section;
    if(!payload.status)payload.status='draft';
    if(!payload.currency)payload.currency='SAR';
    if(!payload.employee_id&&!new Set(['departments','recruitment','governance','payroll_runs']).has(section))throw Error(text('اختر الموظف','Select an employee'));
   }else{
    if(!payload.employment_status)payload.employment_status='active';
    if(!payload.salary_currency)payload.salary_currency='SAR';
   }
   for(const key of (isEmployee?['hire_date','termination_date']:['effective_date','end_date'])){
    if(payload[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(payload[key]))throw Error(text('تاريخ غير صحيح','Invalid date'));
   }
   const table=isEmployee?'hr_app_employees':'hr_app_records';
   const action=api.from(table);
   const button=$('hr-save');button.disabled=true;
   try{
    const result=editing?await action.update({...payload,updated_at:new Date().toISOString()}).eq('workspace_id',activeWorkspace.id).eq('id',editing.id).select('id').single():
      await action.insert(payload).select('id').single();
    if(result.error)throw result.error;
    if(!result.data?.id)throw Error(text('تعذر إثبات الحفظ','Save was not confirmed'));
    $('hr-editor').hidden=true;editing=null;
    await load();notice(text('حُفظ السجل بنجاح','Record saved'));
   }finally{button.disabled=false;}
  }catch(error){notice((error.code||'')+' '+error.message,true);}
 }
 function initialize(){
  document.querySelectorAll('[data-hr-section]').forEach(button=>button.addEventListener('click',()=>selectSection(button.dataset.hrSection)));
  $('hr-form').addEventListener('submit',save);
  $('hr-add').addEventListener('click',()=>editorOpen());
  $('hr-close').addEventListener('click',()=>{$('hr-editor').hidden=true;});
  $('hr-refresh').addEventListener('click',()=>load().catch(err=>notice(err.message,true)));
  $('hr-table-body').addEventListener('click',ev=>{
   const button=ev.target.closest('[data-hr-edit]');if(!button)return;
   const row=(section==='employees'?employees:records).find(x=>x.id===button.dataset.hrEdit);
   if(row)editorOpen(row);
  });
  document.addEventListener('bonds-crm-workspace-activated',ev=>{
   selectWorkspace(ev.detail?.workspace||null).catch(err=>notice(err.message,true));
  });
 }
 initialize();
})();
