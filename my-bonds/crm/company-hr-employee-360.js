/* Employee 360: read-only, tenant-scoped view of existing HR records.
 * Does not grant access: PostgreSQL RLS remains the final authority.
 * Excludes salary, identity documents, private notes and bank details.
 */
(()=>{'use strict';
const root=document.getElementById('hr-section'),rows=document.getElementById('hr-body');
if(!root||!rows)return;
const en=document.documentElement.lang==='en';
const label=(ar,english)=>en?english:ar;
const pane=document.createElement('section');
pane.id='hr-employee-360';
pane.hidden=true;
pane.className='panel';
pane.setAttribute('aria-labelledby','hr-employee-360-heading');
pane.style.cssText='margin-block:1rem;padding:1rem;max-width:100%;overflow-wrap:anywhere';
const head=document.createElement('div');
head.style.cssText='display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap';
const title=document.createElement('h3');
title.id='hr-employee-360-heading';title.textContent=label('الملف الموحد للموظف','Employee 360 profile');
const close=document.createElement('button');
close.type='button';close.className='secondary';close.textContent=label('إغلاق الملف','Close profile');
head.append(title,close);
const note=document.createElement('p');note.className='muted';
note.textContent=label('عرض للقراءة فقط للسجلات المصرح بها في هذه الشركة. لا يتضمن الرواتب أو المستندات الحساسة.','Read-only authorized records for this company. No salaries or sensitive documents.');
const body=document.createElement('div');
body.id='hr-employee-360-body';body.setAttribute('aria-live','polite');
pane.append(head,note,body);
const table=document.getElementById('hr-count');
if(table&&table.parentElement)table.parentElement.insertAdjacentElement('afterend',pane);
else root.append(pane);
let revision=0;
function clear(){revision++;pane.hidden=true;body.replaceChildren();}
close.addEventListener('click',clear);
function cell(parent,text){
 const node=document.createElement('span');node.textContent=text==null||text===''?'—':String(text);
 parent.append(node);
}
function group(titleText,records,columns){
 const section=document.createElement('section');
 const heading=document.createElement('h4');heading.textContent=titleText;section.append(heading);
 if(records===null){
  const note=document.createElement('p');note.textContent=label('البيانات غير متاحة بالصلاحيات الحالية','Data unavailable under current permissions');section.append(note);
 }else if(!records.length){
  const note=document.createElement('p');note.textContent=label('لا توجد سجلات','No records');section.append(note);
 }else{
  const list=document.createElement('ul');
  for(const item of records){
   const li=document.createElement('li');
   li.style.cssText='display:flex;gap:.8rem;flex-wrap:wrap;border-bottom:1px solid #e5e7eb;padding:.35rem';
   for(const field of columns)cell(li,item[field]);
   list.append(li);
  }
  section.append(list);
 }
 body.append(section);
}
const sections=[
 {table:'hr_saas_employment_contracts',fields:'id,contract_number,contract_type,status,start_date,end_date',sort:'start_date',title:label('العقود','Contracts'),view:['contract_number','contract_type','status','start_date','end_date']},
 {table:'hr_saas_leave_requests',fields:'id,leave_type,status,start_date,end_date',sort:'start_date',title:label('الإجازات','Leave requests'),view:['leave_type','status','start_date','end_date']},
 {table:'hr_saas_attendance',fields:'id,work_date,attendance_status,review_status',sort:'work_date',title:label('الحضور','Attendance'),view:['work_date','attendance_status','review_status']},
 {table:'hr_saas_records',fields:'id,category,title,status,effective_date',sort:'created_at',title:label('المسار الوظيفي والتدريب والأداء','Career, training and performance records'),view:['category','title','status','effective_date']}
];
async function open(employeeId){
 const context=window.BondsHRContext;
 const wid=context?.ownerWorkspace?.id;
 if(!context?.ownerLicense||!context?.db||!context?.user||!wid)return;
 const run=++revision;
 pane.hidden=false;
 title.textContent=label('الملف الموحد للموظف','Employee 360 profile');
 body.textContent=label('جارٍ تحميل السجلات المصرح بها…','Loading authorized records…');
 // A server-side tenant filter and RLS both apply to the selected employee.
 const response=await context.db.from('hr_saas_employees')
  .select('id,employee_number,full_name,employment_status,hire_date')
  .eq('workspace_id',wid).eq('id',employeeId).limit(1).maybeSingle();
 if(run!==revision||window.BondsHRContext?.ownerWorkspace?.id!==wid)return;
 if(response.error||!response.data||response.data.id!==employeeId){
  body.textContent=label('تعذر التحقق من ملف الموظف أو صلاحية الوصول','Employee record or permission not verified');
  return;
 }
 const employee=response.data;
 title.textContent=label('الملف الموحد: ','360 profile: ')+employee.full_name;
 body.replaceChildren();
 group(label('بيانات الوظيفة','Employment details'),[employee],['employee_number','employment_status','hire_date']);
 const results=await Promise.allSettled(sections.map(async item=>{
  const res=await context.db.from(item.table).select(item.fields)
   .eq('workspace_id',wid).eq('employee_id',employeeId)
   .order(item.sort,{ascending:false}).limit(20);
  if(res.error)throw res.error;
  return res.data||[];
 }));
 if(run!==revision||window.BondsHRContext?.ownerWorkspace?.id!==wid)return;
 for(let i=0;i<sections.length;i++){
  const outcome=results[i];
  group(sections[i].title,outcome.status==='fulfilled'?outcome.value:null,sections[i].view);
 }
 const footer=document.createElement('p');footer.className='muted';
 footer.textContent=label('يعرض أحدث 20 سجلًا في كل قسم؛ لا يشكّل كشفًا تاريخيًا كاملًا أو سجل تدقيق غير قابل للتغيير.','Latest 20 records per category. This is not a complete historical or immutable audit ledger.');
 body.append(footer);
 pane.scrollIntoView({block:'nearest',behavior:'smooth'});
}
rows.addEventListener('click',event=>{
 const button=event.target.closest('[data-hr-employee-360]');
 if(!button||!rows.contains(button))return;
 const id=button.dataset.hrEmployee360;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id||''))return;
 open(id).catch(()=>{body.textContent=label('تعذر تحميل الملف؛ أعد المحاولة','Unable to load profile; retry');});
});
document.addEventListener('bonds-hr-owner-workspace',clear);
document.addEventListener('bonds-hr-ready',clear);
})();
