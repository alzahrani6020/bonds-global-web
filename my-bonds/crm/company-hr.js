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
 const status=(msg,err=false)=>{const n=$('hr-status');n.textContent=msg;n.hidden=!msg;n.style.display=msg?'block':'none';n.classList.toggle('error',err);};
 let db,user,license=false,workspace=null,employees=[],payrollPeriods=[],records=[],category='employees',editing=null;
 const check=r=>{if(r.error)throw r.error;return r.data;};
 const table=()=>category==='employees'?'hr_saas_employees':category==='attendance'?'hr_saas_attendance':category==='leaves'?'hr_saas_leave_requests':category==='contracts'?'hr_saas_employment_contracts':category==='claims'?'hr_saas_entitlements':category==='payroll_runs'?'hr_saas_payroll_periods':category==='payroll'?'hr_saas_payroll_lines':'hr_saas_records';
 const activeSpecs=()=>specs[category]||specs.records;
 const isoLocal=v=>{
  const date=new Date(v);
  if(!Number.isFinite(date.getTime()))throw Error(t('وقت غير صالح','Invalid time'));
  return date.toISOString();
 };
 const localDateTime=v=>{
  if(!v)return '';
  const d=new Date(v);
  if(!Number.isFinite(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 };
 const specs={
  employees:[['employee_number','الرقم الوظيفي','Employee number','text',true],['full_name','اسم الموظف','Full name','text',true],['department','الإدارة','Department'],['job_title','المسمى الوظيفي','Job title'],['email','البريد','Email','email'],['phone','الهاتف','Phone'],['hire_date','تاريخ التعيين','Hire date','date'],['termination_date','تاريخ الانتهاء','Termination date','date'],['employment_status','الحالة','Status','enum:draft|active|on_leave|suspended|terminated'],['basic_salary','الراتب الأساسي','Basic salary','number'],['salary_currency','العملة','Currency']],
  records:[['employee_id','الموظف','Employee','employee'],['title','الموضوع','Title','text',true],['status','الحالة','Status'],['effective_date','تاريخ البداية','Start date','date'],['end_date','تاريخ النهاية','End date','date'],['amount','المبلغ','Amount','number'],['currency','العملة','Currency'],['details','تفاصيل إضافية JSON','Additional details JSON','json']],
  attendance:[['employee_id','الموظف','Employee','employee'],['work_date','تاريخ الدوام','Work date','date',true],['attendance_status','حالة الدوام','Attendance status','enum:present|absent|leave|remote|holiday'],['clock_in','الحضور','Clock in','datetime-local'],['clock_out','الانصراف','Clock out','datetime-local'],['note','ملاحظات','Notes']],
  leaves:[['employee_id','الموظف','Employee','employee'],['leave_type','نوع الإجازة','Leave type','enum:annual|sick|unpaid|maternity|paternity|emergency|bereavement|study|other'],['start_date','تاريخ البداية','Start date','date',true],['end_date','تاريخ النهاية','End date','date',true],['status','القرار','Decision','enum:pending|approved|rejected|cancelled'],['reason','السبب','Reason'],['decision_note','ملاحظات القرار','Decision notes']],
  contracts:[['employee_id','الموظف','Employee','employee'],['contract_number','رقم العقد','Contract number','text',true],['contract_type','نوع العقد','Contract type','enum:fixed_term|indefinite|part_time|temporary|other'],['status','الحالة','Status','enum:draft|active|expired|terminated|cancelled'],['start_date','تاريخ البدء','Start date','date',true],['end_date','تاريخ الانتهاء','End date','date'],['probation_end_date','نهاية التجربة','Probation end','date'],['base_salary','الأجر الأساسي','Basic pay','number',true],['currency','العملة','Currency'],['termination_reason','سبب الإنهاء','Termination reason'],['notes','ملاحظات','Notes']],
  claims:[['employee_id','الموظف','Employee','employee'],['claim_reference','رقم المستحق','Claim reference','text',true],['claim_type','نوع المستحق','Claim type','enum:expense|overtime|bonus|leave_payout|reimbursement|end_of_service|other'],['description','الوصف','Description','text',true],['amount','المبلغ','Amount','number',true],['currency','العملة','Currency'],['effective_date','تاريخ الاستحقاق','Effective date','date',true],['status','الحالة','Status','enum:draft|submitted|approved|rejected'],['decision_note','ملاحظات القرار','Decision notes']],
  payroll_runs:[['payroll_year','السنة','Year','number',true],['payroll_month','الشهر','Month','number',true],['status','المرحلة','Stage','enum:draft|reviewed|approved']],
  payroll:[['period_id','مسير الرواتب','Payroll period','payroll-period'],['employee_id','الموظف','Employee','employee'],['base_salary','الراتب الأساسي','Basic salary','number',true],['allowance_total','البدلات','Allowances','number'],['deduction_total','الخصومات','Deductions','number'],['note','ملاحظات','Notes']]
 };
 function memberField([key,ar,eng,type='text',needed=false],record={}){
  const name=t(ar,eng),value=record[key]??'';
  if(type==='payroll-period')return '<label class="field">'+name+'<select name="'+key+'" required><option value="">'+t('اختر المسير','Select payroll period')+'</option>'+
   payrollPeriods.map(p=>'<option value="'+escape(p.id)+'"'+(p.id===value?' selected':'')+'>'+p.payroll_year+'/'+String(p.payroll_month).padStart(2,'0')+' — '+escape(p.status)+'</option>').join('')+'</select></label>';
  if(type==='employee')return '<label class="field">'+name+'<select name="'+key+'"><option value="">'+t('اختر موظفًا','Select employee')+'</option>'+employees.map(e=>'<option value="'+escape(e.id)+'"'+(e.id===value?' selected':'')+'>'+escape(e.employee_number)+' — '+escape(e.full_name)+'</option>').join('')+'</select></label>';
  if(type.startsWith('enum:'))return '<label class="field">'+name+'<select name="'+key+'">'+type.slice(5).split('|').map(v=>'<option value="'+escape(v)+'"'+(v===value?' selected':'')+'>'+escape(v)+'</option>').join('')+'</select></label>';
  if(type==='json')return '<label class="field field-wide">'+name+'<textarea name="'+key+'">'+escape(JSON.stringify(record.details||{}))+'</textarea></label>';
  return '<label class="field">'+name+'<input name="'+key+'" type="'+type+'" value="'+escape(type==='datetime-local'?localDateTime(value):value)+'"'+(needed?' required':'')+(type==='number'?' min="0" step="0.01"':'')+'></label>';
 }
 function showEditor(row=null){
  if(row&&(category==='claims'&&['approved','rejected'].includes(row.status)||category==='contracts'&&['terminated','expired','cancelled'].includes(row.status)||category==='payroll_runs'&&row.status==='approved'||category==='payroll'&&payrollPeriods.some(p=>p.id===row.period_id&&p.status!=='draft'))){
   status(t('المسير المعتمد أو قيد المراجعة غير قابل للتعديل','Reviewed/approved payroll cannot be edited'),true);
   return;
  }
  editing=row;
  $('hr-editor').hidden=false;
  const fields=row&&category==='claims'?activeSpecs().filter(x=>!['employee_id','claim_reference'].includes(x[0])):row&&category==='contracts'?activeSpecs().filter(x=>!['employee_id','contract_number'].includes(x[0])):row&&category==='payroll_runs'?activeSpecs().filter(x=>x[0]==='status'):row&&category==='payroll'?activeSpecs().filter(x=>x[0]!=='employee_id'&&x[0]!=='period_id'):activeSpecs();
  $('hr-fields').innerHTML=fields.map(x=>memberField(x,row||{})).join('');
  $('hr-editor-title').textContent=(row?t('تعديل','Edit'):t('إضافة','New'))+' — '+labels[category];
 }
 function render(){
  const isEmployees=category==='employees',source=isEmployees?employees:records;
  $('hr-heading').textContent=labels[category];
  $('hr-add').hidden=category==='audit';
  const columns=isEmployees?['employee_number','full_name','department','job_title','employment_status']:category==='attendance'?['employee_id','work_date','attendance_status','clock_in','clock_out']:category==='leaves'?['employee_id','leave_type','start_date','end_date','status']:category==='contracts'?['employee_id','contract_number','contract_type','status','start_date']:category==='claims'?['employee_id','claim_reference','claim_type','amount','status']:category==='payroll_runs'?['payroll_year','payroll_month','status','approved_at']:category==='payroll'?['employee_id','period_id','base_salary','allowance_total','deduction_total','net_salary']:category==='audit'?['created_at','entity','action','changed_columns']:['employee_id','title','status','effective_date','amount'];
  const heads={employee_number:t('الرقم الوظيفي','Employee #'),full_name:t('الاسم','Name'),department:t('الإدارة','Department'),job_title:t('المسمى','Position'),employment_status:t('الحالة','Status'),employee_id:t('الموظف','Employee'),title:t('الموضوع','Title'),status:t('الحالة','Status'),effective_date:t('التاريخ','Date'),amount:t('المبلغ','Amount'),created_at:t('التاريخ','Date'),entity:t('السجل','Entity'),action:t('الإجراء','Action'),changed_columns:t('الحقول','Fields'),work_date:t('تاريخ الدوام','Work date'),attendance_status:t('حالة الدوام','Status'),clock_in:t('الحضور','Clock in'),clock_out:t('الانصراف','Clock out'),leave_type:t('الإجازة','Leave type'),start_date:t('البداية','Start'),end_date:t('النهاية','End'),payroll_year:t('السنة','Year'),payroll_month:t('الشهر','Month'),approved_at:t('الاعتماد','Approved'),period_id:t('المسير','Payroll period'),base_salary:t('الأساسي','Basic'),allowance_total:t('البدلات','Allowances'),deduction_total:t('الخصومات','Deductions'),net_salary:t('الصافي','Net'),contract_number:t('رقم العقد','Contract #'),contract_type:t('نوع العقد','Contract type'),claim_reference:t('رقم المستحق','Claim #'),claim_type:t('نوع المستحق','Claim type')};
  $('hr-head').innerHTML='<tr>'+columns.map(x=>'<th>'+heads[x]+'</th>').join('')+(category==='audit'?'':'<th>'+t('التعديل','Edit')+'</th>')+'</tr>';
  $('hr-body').innerHTML=source.map(row=>'<tr>'+columns.map(key=>{
   let value=row[key];
   if(key==='employee_id')value=employees.find(x=>x.id===value)?.full_name||'—';
   if(key==='period_id'){const p=payrollPeriods.find(x=>x.id===value);value=p?p.payroll_year+'/'+String(p.payroll_month).padStart(2,'0'):'—';}
   if(key==='changed_columns')value=Array.isArray(value)?value.join(', '):'—';
   return '<td>'+escape(value??'—')+'</td>';
  }).join('')+(category==='audit'?'':'<td><button type="button" class="secondary" data-hr-edit="'+escape(row.id)+'">'+t('تعديل','Edit')+'</button></td>')+'</tr>').join('')||'<tr><td colspan="6">'+t('لا توجد سجلات','No records')+'</td></tr>';
  $('hr-count').textContent=String(source.length);
 }
 async function load(){
  if(!workspace)return;
  const owner=workspace.id,groups=[];
  employees=check(await db.from('hr_saas_employees').select('*').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250));
  payrollPeriods=['payroll','payroll_runs'].includes(category)?
   check(await db.from('hr_saas_payroll_periods').select('*').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250)):[];
  const q=category==='employees'?null:category==='audit'?
   db.from('hr_saas_audit').select('created_at,entity,action,changed_columns').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250):
   ['attendance','leaves','contracts','claims','payroll','payroll_runs'].includes(category)?
   db.from(table()).select('*').eq('workspace_id',owner).order('created_at',{ascending:false}).limit(250):
   db.from('hr_saas_records').select('*').eq('workspace_id',owner).eq('category',category).order('created_at',{ascending:false}).limit(250);
  records=q?category==='payroll_runs'?payrollPeriods:check(await q):[];
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
   const data=new FormData(ev.target),isEmployee=category==='employees',operational=['attendance','leaves','contracts','claims','payroll','payroll_runs'].includes(category),spec=activeSpecs();
   const row={workspace_id:workspace.id};
   for(const [name,,,type='text'] of spec){
    let v=String(data.get(name)??'').trim();
    if(type==='number')row[name]=v===''?null:Number(v);
    else if(type==='datetime-local')row[name]=v?isoLocal(v):null;
    else if(type==='json'){
     const obj=v?JSON.parse(v):{};if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Invalid JSON object');
     row[name]=obj;
    }else row[name]=v||null;
   }
   if(!isEmployee){
    if(!operational){row.category=category;row.status=row.status||'draft';row.currency=row.currency||'SAR';}
    if(category!=='payroll_runs'&&!(category==='payroll'&&editing)&&!row.employee_id&&(!(!operational&&['departments','recruitment','governance'].includes(category))))throw Error(t('اختر الموظف','Select employee'));
    if(category==='attendance'){
     row.attendance_status=row.attendance_status||'present';
     if(['absent','leave','holiday'].includes(row.attendance_status)&&(row.clock_in||row.clock_out))throw Error(t('لا يجوز تسجيل حضور لحالة غياب','Absence cannot have clock times'));
     if(row.clock_out&&!row.clock_in)throw Error(t('الانصراف يتطلب وقت حضور','Clock out needs clock in'));
     if(row.clock_in&&row.clock_out&&new Date(row.clock_out)<=new Date(row.clock_in))throw Error(t('الانصراف يجب أن يلي الحضور','Clock out must follow clock in'));
    }
    if(category==='leaves'){
     row.status=row.status||'pending';
     if(row.end_date<row.start_date)throw Error(t('تاريخ النهاية يسبق البداية','End date precedes start date'));
     if(['approved','rejected'].includes(row.status))row.decided_at=editing?.decided_at||new Date().toISOString();
     else row.decided_at=null;
    }
    if(category==='contracts'){
     if(editing){delete row.employee_id;delete row.contract_number;}
     row.status=row.status||'draft';
     row.currency=row.currency||'SAR';
     if(!editing&&(!row.contract_number||!row.employee_id))throw Error(t('يجب تحديد الموظف ورقم العقد','Employee and contract number are required'));
     if(!editing&&row.status!=='draft')throw Error(t('يجب إنشاء العقد كمسودة ثم تفعيله','Create a draft before activation'));
     if(row.end_date&&row.end_date<row.start_date)throw Error(t('تاريخ انتهاء العقد غير صحيح','Invalid contract end date'));
     if(row.probation_end_date&&(row.probation_end_date<row.start_date||(row.end_date&&row.probation_end_date>row.end_date)))throw Error(t('تاريخ التجربة خارج العقد','Probation date outside contract'));
     if(row.base_salary===null&&editing)delete row.base_salary;
     if(!editing&&(!Number.isFinite(row.base_salary)||row.base_salary<0))throw Error(t('الأجر الأساسي غير صحيح','Invalid base pay'));
     if(row.status==='terminated')row.terminated_at=new Date().toISOString();
    }
    if(category==='claims'){
     if(editing){delete row.employee_id;delete row.claim_reference;}
     row.status=row.status||'draft';row.currency=row.currency||'SAR';
     if(!editing&&row.status!=='draft')throw Error(t('أنشئ المستحق كمسودة أولًا','Create claim as a draft first'));
     if(!editing&&(!row.claim_reference||!row.employee_id))throw Error(t('الرقم والموظف مطلوبان','Employee and reference required'));
     if(row.amount===null&&editing)delete row.amount;
     if(!editing&&(!Number.isFinite(row.amount)||row.amount<0))throw Error(t('المبلغ غير صالح','Invalid claim amount'));
    }
    if(category==='payroll_runs'){
     if(!editing&&(!Number.isInteger(row.payroll_year)||!Number.isInteger(row.payroll_month)||row.payroll_month<1||row.payroll_month>12))throw Error(t('شهر أو سنة غير صحيحة','Invalid payroll month/year'));
     if(editing){delete row.payroll_year;delete row.payroll_month;}
     row.status=row.status||'draft';
    }
    if(category==='payroll'){
     if(editing){delete row.employee_id;delete row.period_id;}
     if(!editing&&(!row.period_id||!payrollPeriods.some(p=>p.id===row.period_id&&p.status==='draft')))throw Error(t('اختر مسيرًا في مرحلة المسودة','Select a draft payroll period'));
     for(const name of ['base_salary','allowance_total','deduction_total']){
      if(row[name]===null)row[name]=0;
      if(!Number.isFinite(row[name])||row[name]<0)throw Error(t('مبلغ غير صالح','Invalid amount'));
     }
     if(row.deduction_total>row.base_salary+row.allowance_total)throw Error(t('الخصومات تتجاوز المستحق','Deductions exceed gross salary'));
    }
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
 // Product data/auth initialization is independent of CRM workspace readiness.
 // Waiting for a CRM-specific event can strand an HR-only subscriber.
 initialize();
})();
