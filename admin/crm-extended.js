/* BONDS CRM extended workflows: additive to the existing CRM overview.
 * Existing company/pipeline/renewal/customer-success panels remain intact.
 * Only the authenticated admin API is used; never persist customer data locally. */
(function(){
'use strict';
const root=document.getElementById('bonds-crm-extensions');
if(!root)return;
const e=value=>window.BondsAdminCommon.escapeHtml(value==null?'':String(value));
const fmtDate=value=>value?new Date(value).toLocaleDateString('ar-SA'):'—';
const states=[['active','نشط'],['inactive','غير نشط'],['prospect','محتمل'],['lead','عميل محتمل'],['customer','عميل'],['archived','مؤرشف']];
const phases=[['lead','محتمل'],['qualified','مؤهل'],['proposal','عرض'],['negotiation','تفاوض'],['won','رابحة'],['lost','خاسرة']];
const types=[['task','مهمة'],['call','مكالمة'],['meeting','اجتماع'],['email','بريد'],['note','ملاحظة'],['whatsapp','واتساب'],['sms','رسالة نصية'],['visit','زيارة']];
const statuses=[['open','مفتوحة'],['completed','مكتملة'],['cancelled','ملغاة']];
function localTimeInput(iso){if(!iso)return '';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes());}
const selectOptions=(items,selected)=>items.map(item=>'<option value="'+e(item[0])+'"'+(String(selected)==String(item[0])?' selected':'')+'>'+e(item[1])+'</option>').join('');
let data=null;
let installPrompt=null;
let standalone=window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
root.innerHTML=[
 '<div class="card span-12 crm-extended-heading">',
 '<div class="crm-extended-title"><div><h2>إدارة علاقات العملاء — وظائف مكين وبوندز</h2><p class="muted">جهات الاتصال، الشركات، الصفقات، المتابعات والأنشطة مع الاحتفاظ بوظائف بوندز الأساسية.</p></div>',
 '<div><button type="button" class="btn btn2" id="crm-install" aria-label="تثبيت برنامج CRM">تثبيت CRM على الجهاز</button><p id="crm-install-hint" class="muted" role="status"></p></div></div></div>',
 '<section class="card span-12" aria-labelledby="crm-clients-title"><h2 id="crm-clients-title">جهات الاتصال والعملاء</h2>',
 '<div class="crm-extended-actions"><button class="btn" type="button" data-action="new-client">إضافة عميل / جهة اتصال</button>',
 '<input id="crm-client-search" type="search" placeholder="بحث في العملاء" aria-label="البحث في جهات الاتصال"></div>',
 '<div class="scroll"><table><thead><tr><th>الاسم</th><th>الشركة</th><th>الهاتف</th><th>البريد</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="crm-client-list"></tbody></table></div></section>',
 '<section class="card span-12" aria-labelledby="crm-organizations-title"><h2 id="crm-organizations-title">إدارة الشركات والمؤسسات</h2>',
 '<div class="scroll"><table><thead><tr><th>المؤسسة</th><th>القطاع</th><th>الدولة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="crm-org-list"></tbody></table></div></section>',
 '<section class="card span-12" aria-labelledby="crm-opportunities-title"><h2 id="crm-opportunities-title">إدارة الصفقات والمتابعات</h2>',
 '<p class="muted">تحديث مرحلة الصفقة وقيمتها واحتمالية الفوز وإجراء المتابعة القادم دون حذف البيانات.</p>',
 '<div class="scroll"><table><thead><tr><th>الصفقة</th><th>الشركة</th><th>المرحلة</th><th>القيمة</th><th>المتابعة القادمة</th><th>إجراء</th></tr></thead><tbody id="crm-deals-list"></tbody></table></div></section>',
 '<section class="card span-12" aria-labelledby="crm-activities-title"><h2 id="crm-activities-title">الأنشطة والمهام</h2>',
 '<div class="crm-extended-actions"><button class="btn" type="button" data-action="new-activity">إضافة نشاط / مهمة</button>',
 '<select id="crm-activity-filter" aria-label="تصفية الأنشطة"><option value="all">جميع الحالات</option>'+selectOptions(statuses,'')+'</select></div>',
 '<div class="scroll"><table><thead><tr><th>الموضوع</th><th>النوع</th><th>العميل / الشركة</th><th>الموعد</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="crm-activity-list"></tbody></table></div></section>',
 '<section class="card span-12" aria-labelledby="crm-edit-title" id="crm-editor-section" hidden>',
 '<h2 id="crm-edit-title">إضافة / تعديل</h2><form id="crm-edit-form"><div class="crm-form-fields" id="crm-edit-fields"></div>',
 '<div class="crm-extended-actions"><button class="btn" type="submit" id="crm-save">حفظ البيانات</button><button class="btn btn2" type="button" data-action="cancel">إلغاء</button></div></form></section>',
 '<div id="crm-extension-status" role="status" aria-live="polite" class="status"></div>'
].join('');
const $=id=>document.getElementById(id);
function setMessage(message,isError){
 const node=$('crm-extension-status');
 node.style.display=message?'block':'none';
 node.textContent=message||'';
 node.style.color=isError?'#fecaca':'#bbf7d0';
 node.style.background=isError?'rgba(127,29,29,.23)':'rgba(6,78,59,.23)';
 node.style.borderColor=isError?'rgba(239,68,68,.38)':'rgba(52,211,153,.38)';
}
async function call(action,body){
 const response=await window.BondsAuth.authenticatedFetch('/api/admin?action='+encodeURIComponent(action),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),returnTo:location.pathname+location.search
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok || !payload.success) throw Error(payload.error||'HTTP '+response.status);
 return payload;
}
function choices(rows,idProp,nameProp,blankText){
 const array=[['',blankText]];
 for(const row of rows||[])array.push([row[idProp],row[nameProp]||row[idProp]]);
 return array;
}
function relationName(item){
 const org=(data.organizations||[]).find(x=>x.id===item.organization_id);
 const client=(data.clients||[]).find(x=>x.id===item.client_id);
 return (client&&client.name)||(org&&org.name)||'—';
}
function field(label,key,value,type='text',required=false){
 return '<label class="crm-field">'+e(label)+'<input name="'+e(key)+'" type="'+e(type)+'" value="'+e(value==null?'':value)+'"'+(required?' required':'')+'></label>';
}
function sel(label,key,options,value){
 return '<label class="crm-field">'+e(label)+'<select name="'+e(key)+'">'+selectOptions(options,value)+'</select></label>';
}
function render(current){
 data=current;
 const query=($('crm-client-search').value||'').toLocaleLowerCase('ar');
 const clients=(data.clients||[]).filter(x=>!query||[x.name,x.email,x.phone,x.company_name].some(y=>String(y||'').toLocaleLowerCase('ar').includes(query)));
 $('crm-client-list').innerHTML=clients.map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.company_name||'—')+'</td><td dir="ltr">'+e(x.phone||'—')+'</td><td dir="ltr">'+e(x.email||'—')+'</td><td>'+e(x.status||'—')+'</td><td><button class="btn btn2" type="button" data-action="edit-client" data-id="'+e(x.id)+'">تعديل</button></td></tr>').join('')||'<tr><td colspan="6">لا توجد جهات اتصال مطابقة</td></tr>';
 $('crm-org-list').innerHTML=(data.organizations||[]).map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.sector||'—')+'</td><td>'+e(x.country||'—')+'</td><td>'+e(x.status||'—')+'</td><td><button class="btn btn2" data-action="edit-organization" data-id="'+e(x.id)+'" type="button">تعديل</button></td></tr>').join('')||'<tr><td colspan="5">لا توجد مؤسسات</td></tr>';
 $('crm-deals-list').innerHTML=(data.opportunities||[]).map(x=>'<tr><td>'+e(x.title)+'</td><td>'+e(relationName(x))+'</td><td>'+e(x.stage)+'</td><td>'+Number(x.value_amount||0).toLocaleString('ar-SA')+' '+e(x.currency||'SAR')+'</td><td>'+e(x.next_action||'—')+'</td><td><button class="btn btn2" type="button" data-action="edit-deal" data-id="'+e(x.id)+'">تعديل / متابعة</button></td></tr>').join('')||'<tr><td colspan="6">لا توجد فرص حالياً</td></tr>';
 const filtered=($('crm-activity-filter').value==='all')?(data.activities||[]):(data.activities||[]).filter(x=>x.status===$('crm-activity-filter').value);
 $('crm-activity-list').innerHTML=filtered.map(x=>'<tr><td>'+e(x.subject)+'</td><td>'+e(types.find(t=>t[0]===x.activity_type)?.[1]||x.activity_type)+'</td><td>'+e(relationName(x))+'</td><td>'+e(fmtDate(x.scheduled_at))+'</td><td>'+e(statuses.find(t=>t[0]===x.status)?.[1]||x.status)+'</td><td><button class="btn btn2" type="button" data-action="edit-activity" data-id="'+e(x.id)+'">تعديل</button></td></tr>').join('')||'<tr><td colspan="6">لا توجد أنشطة مطابقة</td></tr>';
}
function edit(kind,record){
 setMessage('',false);
 const editing=!!record;
 const form=$('crm-edit-form');
 form.dataset.kind=kind;
 form.dataset.id=record?.id||'';
 const fields=$('crm-edit-fields');
 const r=record||{};
 if(kind==='client'){
  $('crm-edit-title').textContent=editing?'تعديل بيانات العميل':'إضافة عميل / جهة اتصال';
  fields.innerHTML=field('الاسم','name',r.name,'text',true)+field('البريد','email',r.email,'email')+
   field('الهاتف','phone',r.phone,'tel')+field('الشركة','company_name',r.company_name)+
   sel('الحالة','status',states,r.status||'active')+
   sel('المؤسسة المرتبطة','organization_id',choices(data.organizations,'id','name','بدون مؤسسة'),r.organization_id||'')+
   field('مصدر العميل','source',r.source)+field('الدور في القرار','relationship_role',r.relationship_role)+
   '<label class="crm-field crm-checkbox"><input name="is_decision_maker" type="checkbox"'+(r.is_decision_maker?' checked':'')+'>صاحب قرار</label>';
 }else if(kind==='organization'){
  $('crm-edit-title').textContent='تعديل بيانات المؤسسة';
  fields.innerHTML=field('اسم المؤسسة','name',r.name,'text',true)+field('الاسم القانوني','legal_name',r.legal_name)+
   field('القطاع','sector',r.sector)+field('الدولة','country',r.country)+field('المدينة','city',r.city)+
   field('الموقع / النطاق','domain',r.domain)+field('الرقم الضريبي','tax_number',r.tax_number)+
   sel('حالة المؤسسة','status',[['prospect','محتملة'],['active','نشطة'],['inactive','غير نشطة'],['customer','عميل'],['archived','مؤرشفة']],r.status||'prospect');
 }else if(kind==='deal'){
  $('crm-edit-title').textContent='تعديل الصفقة والمتابعة القادمة';
  fields.innerHTML=field('عنوان الصفقة','title',r.title,'text',true)+
   sel('المرحلة','stage',phases,r.stage||'lead')+
   field('القيمة','value_amount',r.value_amount,'number')+
   field('الاحتمالية %','probability',r.probability,'number')+
   field('الإجراء القادم','next_action',r.next_action)+
   field('موعد المتابعة','next_action_at',localTimeInput(r.next_action_at),'datetime-local')+
   field('تاريخ الإغلاق المتوقع','expected_close_date',r.expected_close_date||'','date');
  fields.querySelector('[name=probability]').min='0';
  fields.querySelector('[name=probability]').max='100';
  fields.querySelector('[name=value_amount]').min='0';
 }else if(kind==='activity'){
  $('crm-edit-title').textContent=editing?'تعديل النشاط / المهمة':'إنشاء نشاط / مهمة';
  fields.innerHTML=field('الموضوع','subject',r.subject,'text',true)+
   sel('النوع','activity_type',types,r.activity_type||'task')+
   sel('الحالة','status',statuses,r.status||'open')+
   sel('العميل المرتبط','client_id',choices(data.clients,'id','name','بدون عميل'),r.client_id||'')+
   sel('المؤسسة المرتبطة','organization_id',choices(data.organizations,'id','name','بدون مؤسسة'),r.organization_id||'')+
   sel('الفرصة المرتبطة','opportunity_id',choices(data.opportunities,'id','title','بدون فرصة'),r.opportunity_id||'')+
   field('الموعد','scheduled_at',localTimeInput(r.scheduled_at),'datetime-local')+
   '<label class="crm-field crm-field-wide">التفاصيل<textarea name="details" maxlength="8000" rows="3">'+e(r.details||'')+'</textarea></label>';
 }
 $('crm-editor-section').hidden=false;
 $('crm-editor-section').scrollIntoView({behavior:'smooth',block:'start'});
}
function formValue(fd,key){return String(fd.get(key)||'').trim();}
async function submit(ev){
 ev.preventDefault();
 const form=ev.currentTarget;
 const id=form.dataset.id;
 const type=form.dataset.kind;
 const fd=new FormData(form);
 const body={};
 let action;
 if(type==='client'){
  action=id?'crm-client-update':'crm-client-create';
  for(const k of ['name','email','phone','company_name','status','organization_id','source','relationship_role'])
   body[k]=formValue(fd,k)||null;
  body.is_decision_maker=fd.has('is_decision_maker');
 }else if(type==='organization'){
  action='crm-organization-update';
  for(const k of ['name','legal_name','sector','country','city','domain','tax_number','status'])body[k]=formValue(fd,k)||null;
 }else if(type==='deal'){
  action='crm-opportunity-update';
  for(const k of ['stage','next_action','expected_close_date'])
   body[k]=formValue(fd,k)||null;
  body.value_amount=Number(formValue(fd,'value_amount')||0);
  body.probability=Number(formValue(fd,'probability')||0);
  const due=formValue(fd,'next_action_at');
  body.next_action_at=due?new Date(due).toISOString():null;
  if(!Number.isFinite(body.value_amount)||body.value_amount<0||!Number.isFinite(body.probability)||body.probability<0||body.probability>100)throw Error('قيمة الصفقة أو الاحتمالية غير صحيحة');
 }else if(type==='activity'){
  action=id?'crm-activity-update':'crm-activity-create';
  for(const k of ['subject','activity_type','status','client_id','organization_id','opportunity_id','details'])
   body[k]=formValue(fd,k)||null;
  const due=formValue(fd,'scheduled_at');
  body.scheduled_at=due?new Date(due).toISOString():null;
 }else return;
 if(id)body.id=id;
 const save=$('crm-save');
 save.disabled=true;
 try{
  await call(action,body);
  $('crm-editor-section').hidden=true;
  setMessage('حُفظ التعديل في CRM بنجاح',false);
  if(typeof window.loadCrm==='function')await window.loadCrm();
 }catch(err){setMessage('تعذر الحفظ: '+String(err.message||err),true)}
 finally{save.disabled=false}
}
root.addEventListener('click',ev=>{
 const button=ev.target.closest('[data-action]');
 if(!button)return;
 const action=button.dataset.action;
 if(action==='cancel'){$('crm-editor-section').hidden=true;return}
 if(action==='new-client')return edit('client');
 if(action==='new-activity')return edit('activity');
 const lookup={ 'edit-client':['clients','client'],'edit-organization':['organizations','organization'],'edit-deal':['opportunities','deal'],'edit-activity':['activities','activity'] };
 const cfg=lookup[action];
 if(!cfg || !data)return;
 const record=(data[cfg[0]]||[]).find(x=>String(x.id)===button.dataset.id);
 if(record)edit(cfg[1],record);
});
$('crm-client-search').addEventListener('input',()=>{if(data)render(data)});
$('crm-activity-filter').addEventListener('change',()=>{if(data)render(data)});
$('crm-edit-form').addEventListener('submit',ev=>{
 submit(ev).catch(err=>setMessage('تعذر الحفظ: '+String(err.message||err),true));
});
const install=$('crm-install'), hint=$('crm-install-hint');
if(standalone){install.hidden=true;hint.textContent='برنامج CRM مثبت';}
else {
 window.addEventListener('beforeinstallprompt',ev=>{
  ev.preventDefault();installPrompt=ev;install.textContent='تثبيت برنامج CRM';
 });
 window.addEventListener('appinstalled',()=>{
  installPrompt=null;install.hidden=true;hint.textContent='تم تثبيت برنامج CRM';
 });
 install.addEventListener('click',async()=>{
  if(installPrompt){
    const p=installPrompt;installPrompt=null;
    try{await p.prompt();const choice=await p.userChoice;
      hint.textContent=choice?.outcome==='accepted'?'تم قبول التثبيت':'لم يتم قبول التثبيت';
    }catch(err){hint.textContent='تعذر فتح طلب التثبيت. استخدم قائمة المتصفح.'}
  }else {
    hint.textContent='للتثبيت: Chrome أو Edge ← قائمة المتصفح ← تثبيت التطبيق. في iPhone: مشاركة ← إضافة إلى الشاشة الرئيسية. يتطلب CRM اتصالاً بالشبكة.';
  }
 });
}
if('serviceWorker' in navigator){
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw.js').catch(()=>{
   hint.textContent='يمكن فتح CRM عبر المتصفح، لكن تعذر تسجيل خدمة التثبيت.';
  });
 },{once:true});
}
window.BondsCrmExtra=Object.freeze({render});
try{if(typeof crm!=='undefined' && crm)render(crm);}catch(_error){}
})();
