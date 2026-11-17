/* Standalone Human Resources program inside the Company Programs shell.
 * Its workspaces, employee data, entitlements and permissions are NOT CRM data.
 * A salary entry is a draft record; it does not issue a payment or statutory filing.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const en=document.documentElement.lang==='en';
 const t=(ar,english)=>en?english:ar;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const modules=[
 ['employees','الموظفون والملفات الوظيفية','Employees and personnel'],
 ['departments','الإدارات والهيكل الوظيفي','Departments and positions'],
 ['recruitment','التوظيف والتعيين','Recruitment and onboarding'],
 ['contracts','عقود العمل وفترات التجربة','Employment contracts and probation'],
 ['attendance','الحضور والانصراف','Attendance and departures'],
 ['shifts','الورديات والجداول','Shifts and scheduling'],
 ['leaves','الإجازات والغياب','Leave and absence'],
 ['leave_balances','أرصدة الإجازات','Leave balances'],
 ['payroll','الرواتب','Payroll'],
 ['payroll_runs','مسيرات الرواتب','Payroll runs'],
 ['benefits','المزايا والتأمينات','Benefits and insurance'],
 ['allowances','البدلات والمكافآت','Allowances and bonuses'],
 ['deductions','الخصومات والجزاءات','Deductions and penalties'],
 ['claims','مستحقات وحقوق الموظفين','Employee entitlements and rights'],
 ['loans','السلف والقروض','Advances and loans'],
 ['settlements','نهاية الخدمة والمخالصات','End-of-service settlements'],
 ['performance','تقييم الأداء','Performance evaluation'],
 ['training','التدريب والتطوير','Training and development'],
 ['documents','المستندات والتنبيهات','Documents and expiry alerts'],
 ['employee_requests','طلبات الموظفين','Employee requests'],
 ['assets','العهد والأصول','Asset custody'],
 ['governance','السياسات والامتثال','Policies and compliance'],
 ['lifecycle','الترقيات والنقل وإنهاء الخدمة','Career lifecycle'],
 ['audit','سجل التدقيق','Audit log']
 ];
 const labels=Object.fromEntries(modules.map(([id,ar,eng])=>[id,t(ar,eng)]));
 const status=(msg,err=false)=>{const n=$('hr-status');n.textContent=msg;n.hidden=!msg;n.classList.toggle('error',err);};
 let db,user,license=false,workspace=null,employees=[],records=[],category='employees',editing=null;
 const check=r=>{if(r.error)throw r.error;return r.data;};
 const table=()=>category==='employees'?'hr_saas_employees':'hr_saas_records';
 const specs={
  employees:[['employee_number','الرقم الوظيفي','Employee number','text',true],['full_name','اسم الموظف','Full name','text',true],['department','الإدارة','Department'],['job_title','المسمى الوظيفي','Job title'],['email','البريد','Email','email'],['phone','الهاتف','Phone'],['hire_date','تاريخ التعيين','Hire date','date'],['termination_date','تاريخ الانتهاء','Termination date','date'],['employment_status','الحالة','Status','enum:draft|active|on_leave|suspended|terminated'],['basic_salary','الراتب الأساسي','Basic salary','number'],['salary_currency','العملة','Currency']],
  records:[['employee_id','الموظف','Employee','employee'],['title','الموضوع','Title','text',true],['status','الحالة','Status'],['effective_date','تاريخ البداية','Start date','date'],['end_date','تاريخ النهاية','End date','date'],['amount','المبلغ','Amount','number'],['currency','العملة','Currency'],['details','تفاصيل إضافية JSON','Additional details JSON','json']]
 };
 function memberField([key,ar,eng,type='text',needed=false],record={}){
  const name=t(ar,eng),value=record[key]??'';
  if(type==='employee')return '<label class="field">'+name+'<select name="'+key+'"><option value="">'+t('اختر موظفًا','Select employee')+'</option>'+employees.map(e=>'<option value="'+escape(e.id)+'"'+(e.id===value?' selected':'')+'>'+escape(e.employee_number)+' — '+escape(e.full_name)+'</option>').join('')+'</select></label>';
  if(type.startsWith('enum:'))return '<label class="field">'+name+'<select name="'+key+'">'+type.slice(5).split('|').map(v=>'<option value="'+escape(v)+'"'+(v===value?' selected':'')+'>'+escape(v)+'</option>').join('')+'</select></label>';
  if(type==='json')return '<label class="field field-wide">'+name+'<textarea name="'+key+'">'+escape(JSON.stringify(record.details||{}))+'</textarea></label>';
  return '<label class="field">'+name+'<input name="'+key+'" type="'+type+'" value="'+escape(value)+'"'+(needed?' required':'')+(type==='number'?' min="0" step="0.01"':'')+'></label>';
 }
 function showEditor(row=null){
  editing=row;
  $('hr-editor').hidden=false;
  $('hr-fields').innerHTML=(category==='employees'?specs.employees:specs.records).map(x=>memberField(x,row||{})).join('');
  $('hr-editor-title').textContent=(row?t('تعديل','Edit'):t('إضافة','New'))+' — '+labels[category];
 }
 function render(){
  const isEmployees=category==='employees',source=isEmployees?employees:records;
  $('hr-heading').textContent=labels[category];
  $('hr-add').hidden=category==='audit';
  const columns=isEmployees?['employee_number','full_name','department','job_title','employment_status']:category==='audit'?['created_at','entity','action','changed_columns']:['employee_id','title','status','effective_date','amount'];
  const heads={employee_number:t('الرقم الوظيفي','Employee #'),full_name:t('الاسم','Name'),department:t('الإدارة','Department'),job_title:t('المسمى','Position'),employment_status:t('الحالة','Status'),employee_id:t('الموظف','Employee'),title:t('الموضوع','Title'),status:t('الحالة','Status'),effective_date:t('التاريخ','Date'),amount:t('المبلغ','Amount'),created_at:t('التاريخ','Date'),entity:t('السجل','Entity'),action:t('الإجراء','Action'),changed_columns:t('الحقول','Fields')};
  $('hr-head').innerHTML='<tr>'+columns.map(x=>'<th>'+heads[x]+'</th>').join('')+(category==='audit'?'':'<th>'+t('التعديل','Edit')+'</th>')+'</tr>';
  $('hr-body').innerHTML=source.map(row=>'<tr>'+columns.map(key=>{
   let value=row[key];
   if(key==='employee_id')value=employees.find(x=>x.id===value)?.full_name||'—';
   if(key==='changed_columns')value=Array.isArray(value)?value.join(', '):'—';
   return '<td>'+escape(value??'—')+'</td>';
  }).join('')+(category==='audit'?'':'<td><button type="button" class="secondary" data-hr-edit="'+escape(row.id)+'">'+t('تعديل','Edit')+'</button></td>')+'</tr>').join('')||'<tr><td colspan="6">'+t('لا توجد سجلات','No records')+'</td></tr>';
  $('hr-count').textContent=String(source.length);
 }
 async function load(){
  if(!workspace)return;
  const owner=workspace.id,groups=[];
  employees=check(await db.from('hr_saas_employees').select('*').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250));
  const q=category==='employees'?null:category==='audit'?
   db.from('hr_saas_audit').select('created_at,entity,action,changed_columns').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250):
   db.from('hr_saas_records').select('*').eq('workspace_id',owner).eq('category',category).order('created_at',{ascending:false}).limit(250);
  records=q?check(await q):[];
  render();
 }
 async function changeCategory(next){
  if(!labels[next])return;
  category=next;editing=null;$('hr-editor').hidden=true;
  document.querySelectorAll('[data-hr-category]').forEach(x=>x.classList.toggle('active',x.dataset.hrCategory===category));
  try{status('');await load();}catch(e){status(e.message,true);}
 }
 async function save(ev){
  ev.preventDefault();
  if(!license||!workspace)return;
  const btn=$('hr-save');btn.disabled=true;
  try{
   const data=new FormData(ev.target),isEmployee=category==='employees',spec=isEmployee?specs.employees:specs.records;
   const row={workspace_id:workspace.id};
   for(const [name,,,type='text'] of spec){
    let v=String(data.get(name)??'').trim();
    if(type==='number')row[name]=v===''?null:Number(v);
    else if(type==='json'){
     const obj=v?JSON.parse(v):{};if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Invalid JSON object');
     row[name]=obj;
    }else row[name]=v||null;
   }
   if(!isEmployee){
    row.category=category;row.status=row.status||'draft';row.currency=row.currency||'SAR';
    if(!row.employee_id&&!['departments','recruitment','governance','payroll_runs'].includes(category))throw Error(t('اختر الموظف','Select employee'));
   }else{row.employment_status=row.employment_status||'active';row.salary_currency=row.salary_currency||'SAR';}
   const q=editing?db.from(table()).update({...row,updated_at:new Date().toISOString()}).eq('workspace_id',workspace.id).eq('id',editing.id):
    db.from(table()).insert(row);
   const result=check(await q.select('id').single());
   if(!result?.id)throw Error('Save not confirmed');
   editing=null;$('hr-editor').hidden=true;
   await load();status(t('حُفظ السجل بنجاح','Record saved'));
  }catch(e){status(e.message,true);}finally{btn.disabled=false;}
 }
 async function initialize(){
  try{
   await window.BondsAuth.ensureEnv();db=window.BondsAuth.getSupabase();
   user=check(await db.auth.getUser())?.user;
   if(!user){
    $('hr-auth').hidden=false;
    if(new URLSearchParams(location.search).get('program')==='hr')toggleProduct('hr');
    return;
   }
   const valid=check(await db.from('company_program_entitlements').select('product_code,status,starts_at,ends_at').in('product_code',['hr','suite']).eq('owner_user_id',user.id));
   license=valid.some(x=>['active','trial'].includes(x.status)&&new Date(x.starts_at)<=new Date()&&(!x.ends_at||new Date(x.ends_at)>new Date()));
   $('hr-license').hidden=license;
   if(new URLSearchParams(location.search).get('program')==='hr')toggleProduct('hr');
   if(!license)return;
   $('hr-setup').hidden=false;
   const workspaces=check(await db.from('hr_saas_workspaces').select('id,name,owner_user_id').order('created_at',{ascending:true}));
   const select=$('hr-workspace');
   select.innerHTML=workspaces.map(w=>'<option value="'+escape(w.id)+'">'+escape(w.name)+'</option>').join('');
   if(workspaces.length){workspace=workspaces[0];$('hr-app').hidden=false;await changeCategory(category);}
   select.addEventListener('change',async()=>{workspace=workspaces.find(w=>w.id===select.value)||null;await changeCategory(category);});

  }catch(e){status(t('تعذر فتح الموارد البشرية: ','Cannot open HR: ')+e.message,true);}
 }
 // CRM workspace initialization is asynchronous. Preserve its state on every switch.
 function toggleProduct(name){
  const hr=name==='hr';
  if(hr){
   $('workspace-content').dataset.programPrevious=$('workspace-content').hidden?'hidden':'visible';
   $('onboarding').dataset.programPrevious=$('onboarding').hidden?'hidden':'visible';
  }
  if(hr){$('internal-crm-panel').dataset.programPrevious=$('internal-crm-panel').hidden?'hidden':'visible';$('internal-crm-panel').hidden=true;}
  else $('internal-crm-panel').hidden=$('internal-crm-panel').dataset.programPrevious!=='visible';
  // Do not expose CRM-only controls or its login prompt when HR is selected.
  for(const id of ['auth-gate','refresh','install','install-hint','status','internal-crm-open']){
   const element=$(id);
   if(hr){element.dataset.programPrevious=element.hidden?'hidden':'visible';element.hidden=true;}
   else element.hidden=element.dataset.programPrevious!=='visible';
  }
  $('hr-section').hidden=!hr;$('hr-nav').hidden=!hr;
  $('crm-nav').hidden=hr;$('hr-page-heading').hidden=!hr;$('crm-main-heading').hidden=hr;
  $('workspace-content').hidden=hr?true:$('workspace-content').dataset.programPrevious!=='visible';
  $('onboarding').hidden=hr?true:$('onboarding').dataset.programPrevious!=='visible';
  $('hr-product-tab').classList.toggle('active',hr);
  $('crm-product-tab').classList.toggle('active',!hr);
 }
 $('crm-product-tab').addEventListener('click',()=>toggleProduct('crm'));
 $('hr-product-tab').addEventListener('click',()=>toggleProduct('hr'));
 document.querySelectorAll('[data-hr-category]').forEach(x=>x.addEventListener('click',()=>changeCategory(x.dataset.hrCategory)));
 $('hr-add').addEventListener('click',()=>showEditor());
 $('hr-close').addEventListener('click',()=>{$('hr-editor').hidden=true;});
 $('hr-save-form').addEventListener('submit',save);
 $('hr-refresh').addEventListener('click',()=>load().catch(e=>status(e.message,true)));
 $('hr-body').addEventListener('click',event=>{
  const button=event.target.closest('[data-hr-edit]');if(!button)return;
  const row=(category==='employees'?employees:records).find(x=>x.id===button.dataset.hrEdit);
  if(row)showEditor(row);
 });
 $('hr-create-workspace').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!license||!user)return;
  const btn=ev.target.querySelector('button');btn.disabled=true;
  try{
   const name=String(new FormData(ev.target).get('name')||'').trim();
   const row=check(await db.from('hr_saas_workspaces').insert({name,owner_user_id:user.id}).select('id,name,owner_user_id').single());
   workspace=row;$('hr-workspace').add(new Option(row.name,row.id));$('hr-workspace').value=row.id;
   $('hr-app').hidden=false;ev.target.reset();await changeCategory('employees');status(t('أُنشئت مساحة الموارد البشرية','HR workspace created'));
  }catch(e){status(e.message,true);}finally{btn.disabled=false;}
 });
 document.addEventListener('bonds-crm-workspace-initialized',initialize,{once:true});
})();
