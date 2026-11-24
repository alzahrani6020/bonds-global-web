/* HR company overview. Read-only operational statistics; no cross-tenant queries. */
(()=>{'use strict';
const ar=document.documentElement.lang!=='en';
const word=(a,b)=>ar?a:b;
const root=document.getElementById('hr-section');
if(!root)return;
const entity=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=(module)=>location.pathname+(location.search?'?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)),program:'hr',hr_module:module}):'?program=hr&hr_module='+encodeURIComponent(module))+'#hr-app';
const groups=[
 [word('الأفراد والهيكل','People & structure'),[['employees',word('الملفات الوظيفية','Employees')],['departments',word('الإدارات','Departments')],['positions',word('الوظائف والدرجات','Positions & grades')],['recruitment',word('التوظيف','Recruitment')],['lifecycle',word('الترقيات والنقل','Employee lifecycle')]]],
 [word('الجداول والحضور والإجازات','Schedules, attendance & leave'),[['shifts',word('الورديات والجداول','Shifts & scheduling')],['attendance',word('الحضور والانصراف','Attendance')],['attendance_corrections',word('تصحيحات الحضور','Attendance corrections')],['leaves',word('طلبات الإجازة','Leave requests')],['leave_balances',word('أرصدة الإجازات','Leave balances')]]],
 [word('الأجور والالتزامات','Pay & obligations'),[['contracts',word('العقود','Contracts')],['payroll',word('تفاصيل الرواتب','Payroll lines')],['payroll_runs',word('مسيرات الرواتب','Payroll periods')],['allowances',word('البدلات','Allowances')],['deductions',word('الخصومات','Deductions')],['benefits',word('المزايا','Benefits')],['claims',word('المستحقات','Claims')],['loans',word('السلف','Advances')],['settlements',word('نهاية الخدمة','Settlements')]]],
 [word('إدارة الموظفين والحوكمة','Employee management & governance'),[['performance',word('الأداء','Performance')],['training',word('التدريب','Training')],['documents',word('المستندات','Documents')],['employee_requests',word('الطلبات الذاتية','Employee requests')],['assets',word('العهد','Assets')],['governance',word('السياسات','Governance')],['audit',word('سجل التدقيق','Audit')]]]
];
const section=document.createElement('section');section.id='hr-company-overview';section.className='panel hr-company-overview';section.hidden=true;
section.innerHTML='<div class="section-actions"><div><h2>'+word('لوحة تشغيل الموارد البشرية','Human resources operations overview')+'</h2><p id="hr-overview-company" class="muted"></p></div><button type="button" class="secondary" id="hr-overview-refresh">'+word('تحديث المؤشرات','Refresh indicators')+'</button></div><label class="hr-overview-size">'+word('طريقة عرض الوحدات حسب حجم الشركة','Company-size workspace view')+' <select id="hr-overview-size"><option value="small">'+word('شركة صغيرة','Small business')+'</option><option value="medium">'+word('شركة متوسطة','Medium business')+'</option><option value="large">'+word('شركة كبيرة','Large enterprise')+'</option><option value="giant">'+word('مجموعة أو شركة عملاقة','Enterprise group')+'</option></select></label><p class="muted">'+word('حجم الشركة هنا تفضيل لتنظيم العرض فقط؛ لا يغيّر الترخيص أو الأدوار أو حدود الوصول. جميع الوحدات متاحة أدناه.','Size is a display preference only; it does not change licensing, roles or access. All modules remain listed below.')+'</p><div class="hr-overview-stats" id="hr-overview-stats" aria-live="polite"></div><p class="muted" id="hr-overview-error" role="status"></p><div id="hr-overview-directory" class="hr-overview-directory"></div>';
const before=document.getElementById('hr-app')||document.getElementById('hr-setup');before.parentNode.insertBefore(section,before);
const sizes=['small','medium','large','giant'];
const stats=[['hr_saas_employees',word('الموظفون','Employees')],['hr_saas_departments',word('الإدارات','Departments')],['hr_saas_positions',word('الوظائف','Positions')],['hr_saas_attendance',word('سجلات الحضور','Attendance')],['hr_saas_leave_requests',word('الإجازات','Leave requests')],['hr_saas_payroll_periods',word('فترات الرواتب','Payroll periods')]];
let current=null,revision=0;
function storeKey(context){return 'bonds-hr-view:'+context.user.id+':'+context.ownerWorkspace.id;}
function order(size){return size==='small'?[0,1,2,3]:size==='medium'?[0,1,2,3]:size==='large'?[0,2,1,3]:[3,0,2,1];}
function renderGroups(size){
 const directory=document.getElementById('hr-overview-directory');
 directory.replaceChildren();
 for(const index of order(size)){
  const group=groups[index],card=document.createElement('section');card.className='hr-overview-group';
  const title=document.createElement('h3');title.textContent=group[0];card.append(title);
  const links=document.createElement('div');links.className='hr-overview-links';
  for(const [id,label] of group[1]){const a=document.createElement('a');a.href=route(id);a.textContent=label;links.append(a);}
  card.append(links);directory.append(card);
 }
}
function countRows(db,table,workspaceId){
 return db.from(table).select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).then(res=>{
  if(res.error)throw res.error;
  if(!Number.isInteger(res.count))throw Error(word('تعذر توثيق العدد','Count unavailable'));
  return res.count;
 });
}
async function refresh(){
 const context=current;if(!context||!context.ownerLicense||!context.ownerWorkspace)return;
 const run=++revision;
 const box=document.getElementById('hr-overview-stats'),err=document.getElementById('hr-overview-error');
 box.textContent=word('تحميل الأعداد من قاعدة الشركة…','Loading counts from company database…');err.textContent='';
 const outcomes=await Promise.allSettled(stats.map(([table])=>countRows(context.db,table,context.ownerWorkspace.id)));
 if(run!==revision||current!==context)return;
 box.replaceChildren();
 for(let i=0;i<stats.length;i++){
  const card=document.createElement('div');card.className='hr-overview-stat';
  const val=document.createElement('strong');val.textContent=outcomes[i].status==='fulfilled'?String(outcomes[i].value):'—';
  const label=document.createElement('span');label.textContent=stats[i][1];card.append(val,label);box.append(card);
 }
 const bad=outcomes.filter(x=>x.status==='rejected').length;
 if(bad)err.textContent=word('تعذر تحميل '+bad+' من المؤشرات؛ لم تُستبدل الأخطاء بأصفار.','Failed to load '+bad+' metric(s); failures are not displayed as zero.');
}
function enter(context){
 if(!context?.ownerLicense||!context?.ownerWorkspace||!context?.db||!context?.user){++revision;section.hidden=true;current=null;return;}
 current={...context};const name=context.ownerWorkspace.name;
 document.getElementById('hr-overview-company').textContent=name;
 let size='small';try{const saved=localStorage.getItem(storeKey(context));if(sizes.includes(saved))size=saved;}catch(_){}
 document.getElementById('hr-overview-size').value=size;renderGroups(size);
 section.hidden=false;refresh().catch(()=>{document.getElementById('hr-overview-error').textContent=word('تعذر جلب المؤشرات','Could not load indicators');});
}
document.getElementById('hr-overview-size').addEventListener('change',event=>{
 const size=event.target.value;if(!sizes.includes(size)||!current)return;
 try{localStorage.setItem(storeKey(current),size);}catch(_){}
 renderGroups(size);
});
document.getElementById('hr-overview-refresh').addEventListener('click',()=>refresh());
document.addEventListener('bonds-hr-owner-workspace',event=>enter({...window.BondsHRContext,ownerWorkspace:event.detail?.workspace}));
document.addEventListener('bonds-hr-ready',()=>{if(window.BondsHRContext?.ownerWorkspace)enter(window.BondsHRContext);});
if(window.BondsHRContext?.ownerWorkspace)enter(window.BondsHRContext);
})();
