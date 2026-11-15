/* BONDS customer CRM — authenticated, RLS-scoped workspace; never caches customer data offline. */
(async function () {
 'use strict';
 const $ = id => document.getElementById(id);
 const english=document.documentElement.lang==='en';
 const translations={"نظرة عامة":"Overview","الشركات":"Companies","جهات الاتصال":"Contacts","الصفقات":"Deals","مسارات المبيعات":"Sales pipelines","الأنشطة والمهام":"Activities and tasks","التجديدات":"Renewals","نجاح العملاء":"Customer success","مراحل مسارات المبيعات":"Pipeline stages","اسم المسار":"Pipeline name","الوصف":"Description","مسار نشط":"Active pipeline","المسار الافتراضي":"Default pipeline","مسار المبيعات":"Sales pipeline","اسم المرحلة":"Stage name","الترتيب":"Order","مرحلة رابحة":"Won stage","مرحلة خاسرة":"Lost stage","مرحلة نشطة":"Active stage","مرحلة المسار":"Pipeline stage","محتمل":"Lead","مؤهل":"Qualified","عرض":"Proposal","تفاوض":"Negotiation","رابحة":"Won","خاسرة":"Lost","مهمة":"Task","مكالمة":"Call","اجتماع":"Meeting","بريد":"Email","ملاحظة":"Note","واتساب":"WhatsApp","رسالة":"Message","زيارة":"Visit","مفتوحة":"Open","مكتملة":"Completed","ملغاة":"Cancelled","الاسم":"Name","الاسم القانوني":"Legal name","السجل التجاري":"Commercial registration","الرقم الضريبي":"Tax number","البريد":"Email","الهاتف":"Phone","المدينة":"City","الدولة":"Country","القطاع":"Sector","الحالة":"Status","الشركة":"Company","الدور":"Role","المصدر":"Source","صاحب قرار":"Decision maker","عنوان الصفقة":"Deal title","جهة الاتصال":"Contact","المرحلة":"Stage","القيمة":"Value","العملة":"Currency","احتمال الإغلاق %":"Probability %","تاريخ الإغلاق":"Expected close date","الإجراء التالي":"Next action","موعد الإجراء":"Next action date","الموضوع":"Subject","النوع":"Type","الصفقة":"Deal","الموعد":"Scheduled date","التفاصيل":"Details","التجديد":"Renewal","تاريخ التجديد":"Renewal date","درجة المخاطر":"Risk level","ملاحظات":"Notes","مؤشر الصحة":"Health score","المراجعة المقبلة":"Next review","خطة النجاح":"Success plan","المهام المفتوحة":"Open tasks","التجديدات القادمة":"Upcoming renewals","لا توجد متابعات مجدولة":"No scheduled follow-ups","إجراءات":"Actions","تعديل":"Edit","أرشفة":"Archive","لا توجد سجلات":"No records","إضافة":"Add","لا":"No","نعم":"Yes"};
 const t=value=>english?(translations[value]||value):value;
 const tableNames = {companies:'crm_app_companies',contacts:'crm_app_contacts',deals:'crm_app_deals',activities:'crm_app_activities',renewals:'crm_app_renewals',success:'crm_app_success',pipelines:'crm_app_pipelines',stages:'crm_app_pipeline_stages'};
 const sectionTitles = {overview:'نظرة عامة',companies:'الشركات',contacts:'جهات الاتصال',deals:'الصفقات',pipeline:'مسارات المبيعات',activities:'الأنشطة والمهام',renewals:'التجديدات',success:'نجاح العملاء',stages:'مراحل مسارات المبيعات'};
 const stageLabels = {lead:'محتمل',qualified:'مؤهل',proposal:'عرض',negotiation:'تفاوض',won:'رابحة',lost:'خاسرة'};
 const kinds = {task:'مهمة',call:'مكالمة',meeting:'اجتماع',email:'بريد',note:'ملاحظة',whatsapp:'واتساب',sms:'رسالة',visit:'زيارة'};
 const statusLabels = {open:'مفتوحة',completed:'مكتملة',cancelled:'ملغاة'};
 const defs = {
  companies:[['name','الاسم','text',true],['legal_name','الاسم القانوني'],['cr_number','السجل التجاري'],['tax_number','الرقم الضريبي'],['email','البريد','email'],['phone','الهاتف','tel'],['city','المدينة'],['country','الدولة'],['sector','القطاع'],['status','الحالة','select:prospect|active|inactive|customer|archived']],
  contacts:[['name','الاسم','text',true],['company_id','الشركة','ref:companies'],['email','البريد','email'],['phone','الهاتف','tel'],['role','الدور'],['source','المصدر'],['status','الحالة','select:lead|prospect|customer|active|inactive|archived'],['is_decision_maker','صاحب قرار','checkbox']],
  deals:[['title','عنوان الصفقة','text',true],['company_id','الشركة','ref:companies'],['contact_id','جهة الاتصال','ref:contacts'],['stage','المرحلة','select:lead|qualified|proposal|negotiation|won|lost'],['pipeline_id','مسار المبيعات','ref:pipelines'],['pipeline_stage_id','مرحلة المسار','ref:stages'],['value_amount','القيمة','number'],['currency','العملة','text'],['probability','احتمال الإغلاق %','number'],['expected_close_date','تاريخ الإغلاق','date'],['next_action','الإجراء التالي'],['next_action_at','موعد الإجراء','datetime-local']],
  activities:[['subject','الموضوع','text',true],['kind','النوع','select:task|call|meeting|email|note|whatsapp|sms|visit'],['company_id','الشركة','ref:companies'],['contact_id','جهة الاتصال','ref:contacts'],['deal_id','الصفقة','ref:deals'],['status','الحالة','select:open|completed|cancelled'],['scheduled_at','الموعد','datetime-local'],['details','التفاصيل','textarea']],
  renewals:[['title','التجديد','text',true],['company_id','الشركة','ref:companies'],['contact_id','جهة الاتصال','ref:contacts'],['renewal_date','تاريخ التجديد','date',true],['value_amount','القيمة','number'],['status','الحالة','select:upcoming|contacted|negotiating|renewed|churned|cancelled'],['risk_level','درجة المخاطر','select:low|medium|high|critical'],['notes','ملاحظات','textarea']],
  pipelines:[['name','اسم المسار','text',true],['description','الوصف','textarea'],['is_active','مسار نشط','checkbox'],['is_default','المسار الافتراضي','checkbox']],
  stages:[['pipeline_id','مسار المبيعات','ref:pipelines',true],['name','اسم المرحلة','text',true],['sort_order','الترتيب','number'],['probability','احتمال الإغلاق %','number'],['is_won','مرحلة رابحة','checkbox'],['is_lost','مرحلة خاسرة','checkbox'],['is_active','مرحلة نشطة','checkbox']],
  success:[['company_id','الشركة','ref:companies'],['contact_id','جهة الاتصال','ref:contacts'],['health_score','مؤشر الصحة','number'],['risk_level','درجة المخاطر','select:low|medium|high|critical'],['lifecycle_stage','المرحلة','select:onboarding|activated|adopting|healthy|at_risk|churned'],['next_review_at','المراجعة المقبلة','datetime-local'],['success_plan','خطة النجاح','textarea']]
 };
 const columns={companies:['name','sector','city','status'],contacts:['name','email','phone','role'],deals:['title','stage','value_amount','next_action'],activities:['subject','kind','status','scheduled_at'],renewals:['title','renewal_date','status','risk_level'],success:['health_score','risk_level','lifecycle_stage','next_review_at'],pipelines:['name','description','is_active','is_default'],stages:['name','pipeline_id','sort_order','probability']};
 let sb,workspace=null,current='overview',rows={},editing=null,installPrompt=null;
 const escape = value => String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const notify=(message,error=false)=>{const n=$('status');n.textContent=t(message);n.className='notice'+(error?' error':'');n.hidden=!message;n.style.display=message?'block':'none';};
 const must = result => {if(result.error)throw result.error;return result.data;};
 const formatValue=v=>v==null?'—':typeof v==='boolean'?(v?t('نعم'):t('لا')):String(v);
 const toInputValue=(v,type)=>{
  if(v==null||v==='')return '';
  if(type!=='datetime-local')return String(v);
  const d=new Date(v);
  if(!Number.isFinite(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 };
 const normalSection=s=>s==='pipeline'?'pipelines':s;
 function showSection(name) {
  current=name; $('section-heading').textContent=t(sectionTitles[name]);
  document.querySelectorAll('#crm-nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
  $('overview').hidden=name!=='overview';
  $('records-section').hidden=name==='overview';
  $('editor').hidden=true; editing=null;
  if(name==='overview')renderOverview();else renderRecords();
 }
 function nameFor(group,id){return (rows[group]||[]).find(x=>x.id===id)?.name || (rows[group]||[]).find(x=>x.id===id)?.title || '—';}
 function renderOverview(){
  const metrics=[['الشركات',rows.companies?.length||0],['جهات الاتصال',rows.contacts?.length||0],['الصفقات',rows.deals?.length||0],['المهام المفتوحة',(rows.activities||[]).filter(r=>!r.deleted_at&&r.status==='open').length],['التجديدات القادمة',(rows.renewals||[]).filter(r=>r.status==='upcoming').length]];
  $('kpis').innerHTML=metrics.map(([k,v])=>'<div class="kpi"><b>'+v+'</b><span>'+escape(t(k))+'</span></div>').join('');
  const deals=rows.deals||[],total=Math.max(1,deals.length);
  $('pipeline-summary').innerHTML=Object.entries(stageLabels).map(([k,label])=>{const n=deals.filter(r=>r.stage===k).length;return '<div class="bar-row"><div class="bar-title"><span>'+t(label)+'</span><span>'+n+'</span></div><div class="bar-track"><div class="bar-fill" style="width:'+(n/total*100)+'%"></div></div></div>';}).join('');
  const tasks=(rows.activities||[]).filter(r=>!r.deleted_at&&r.status==='open'&&r.scheduled_at).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,8);
  $('upcoming-tasks').innerHTML=tasks.length?tasks.map(r=>'<p>'+escape(r.subject)+' — '+escape(new Date(r.scheduled_at).toLocaleDateString('ar-SA'))+'</p>').join(''):t('لا توجد متابعات مجدولة');
 }
 function renderRecords(){
  const group=normalSection(current),schema=defs[group],list=(rows[group]||[]).filter(r=>group!=='activities'||!r.deleted_at);
  const query=($('search').value||'').toLocaleLowerCase();
  const filtered=list.filter(r=>!query||Object.values(r).some(v=>String(v??'').toLocaleLowerCase().includes(query)));
  $('records-head').innerHTML='<tr>'+columns[group].map(k=>'<th>'+escape(t(schema.find(d=>d[0]===k)?.[1]||k))+'</th>').join('')+'<th>'+t('إجراءات')+'</th></tr>';
  $('records-body').innerHTML=filtered.length?filtered.map(r=>'<tr>'+columns[group].map(k=>'<td>'+escape(k.endsWith('_id')?nameFor(({company_id:'companies',contact_id:'contacts',deal_id:'deals',pipeline_id:'pipelines',pipeline_stage_id:'stages'}[k]||'contacts'),r[k]):formatValue(r[k]))+'</td>').join('')+'<td><button type="button" class="secondary" data-edit="'+escape(r.id)+'">'+t("تعديل")+'</button>'+(group==='activities'?'<button type="button" class="secondary" data-archive="'+escape(r.id)+'">'+t("أرشفة")+'</button>':'')+'</td></tr>').join(''):'<tr><td colspan="7">'+t("لا توجد سجلات")+'</td></tr>';
 }
 function buildField(def,record){
  const [key,label,spec='text',required=false]=def,value=record?.[key];
  const head='<label class="field">'+escape(t(label)),tail='</label>';
  if(spec==='checkbox')return head+'<input type="checkbox" name="'+key+'" '+(value?'checked':'')+'>'+tail;
  if(spec==='textarea')return head+'<textarea name="'+key+'" rows="3">'+escape(value||'')+'</textarea>'+tail;
  if(spec.startsWith('select:')||spec.startsWith('ref:')){
   const reference=spec.startsWith('ref:');
   const options=reference?(rows[spec.slice(4)]||[]).map(r=>[r.id,r.name||r.title]):spec.slice(7).split('|').map(x=>[x,t(stageLabels[x]||kinds[x]||statusLabels[x]||x)]);
   // An empty option is valid for nullable foreign keys, but not for NOT NULL
   // enum columns. When creating, select the first valid enum rather than NULL.
   const selected=value==null?(reference?'':(options[0]?.[0]||'')):String(value);
   return head+'<select name="'+key+'"'+(!reference||required?' required':'')+'>'+(reference?'<option value="">—</option>':'')+options.map(([id,label])=>'<option value="'+escape(id)+'" '+(String(id)===selected?' selected':'')+'>'+escape(label)+'</option>').join('')+'</select>'+tail;
  }
  return head+'<input name="'+key+'" type="'+spec+'" value="'+escape(toInputValue(value,spec))+'" '+(required?'required ':'')+(spec==='number'?'min="0" step="any"':'')+'>'+tail;
 }
 function openEditor(record=null){
  const group=normalSection(current);
  editing=record; $('editor-title').textContent=(record?t('تعديل'):t('إضافة'))+' '+t(sectionTitles[current]);
  $('editor-fields').innerHTML=defs[group].map(def=>buildField(def,record)).join('');
  $('editor').hidden=false;$('editor').scrollIntoView({block:'start',behavior:'smooth'});
 }
 async function refresh(){
  if(!workspace)return;
  const out=await Promise.all(Object.entries(tableNames).map(async([k,t])=>[k,must(await sb.from(t).select('*').eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).limit(500))]));
  rows=Object.fromEntries(out);showSection(current);
 }
 async function initialize(){
  try{
   await window.BondsAuth.ensureEnv();
   sb=window.BondsAuth.getSupabase();
   if(!sb)throw new Error('تعذّر تهيئة خدمة المصادقة');
   const result=await sb.auth.getUser(),user=result.data?.user;
   if(!user){$('auth-gate').hidden=false;return;}
   const spaces=must(await sb.from('crm_app_workspaces').select('id,name').eq('owner_user_id',user.id).limit(1));
   workspace=spaces[0]||null;
   $('onboarding').hidden=!!workspace;$('workspace-content').hidden=!workspace;
   if(workspace){$('workspace-name').textContent=workspace.name;await refresh();}
  }catch(e){notify('تعذر تحميل مساحة CRM: '+(e.message||e),true);}
 }
 $('workspace-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button');button.disabled=true;
  try{const name=String(new FormData(event.currentTarget).get('name')||'').trim();
   const user=must(await sb.auth.getUser()).user;if(!user)throw Error('انتهت جلسة تسجيل الدخول');
   workspace=must(await sb.from('crm_app_workspaces').insert({name,owner_user_id:user.id}).select('id,name').single());
   $('workspace-name').textContent=workspace.name;$('onboarding').hidden=true;$('workspace-content').hidden=false;await refresh();notify('أُنشئت مساحة العمل');
  }catch(e){notify('تعذر إنشاء مساحة العمل: '+e.message,true);}finally{button.disabled=false;}
 });
 $('crm-nav').addEventListener('click',e=>{const n=e.target.closest('[data-section]');if(n&&workspace)showSection(n.dataset.section);});
 $('refresh').addEventListener('click',()=>refresh().then(()=>notify('تم تحديث السجلات')).catch(e=>notify(e.message,true)));
 $('search').addEventListener('input',()=>renderRecords());
 $('new-record').addEventListener('click',()=>openEditor());
 $('editor-close').addEventListener('click',()=>{$('editor').hidden=true;});
 $('records-body').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit]'),archive=e.target.closest('[data-archive]'),group=normalSection(current);
  if(edit){openEditor((rows[group]||[]).find(r=>r.id===edit.dataset.edit));return;}
  if(archive&&group==='activities'&&window.confirm('أرشفة النشاط دون حذف العملاء؟')){
   try{must(await sb.from('crm_app_activities').update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('workspace_id',workspace.id).eq('id',archive.dataset.archive));await refresh();notify('تمت أرشفة النشاط');}
   catch(err){notify(err.message,true);}
  }
 });
 $('record-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('save-record');button.disabled=true;
  try{
   const group=normalSection(current),fd=new FormData(e.currentTarget),payload={workspace_id:workspace.id};
   for(const [key,,spec='text',required=false] of defs[group]){
    let val=spec==='checkbox'?fd.has(key):String(fd.get(key)||'').trim();
    if(required&&!val)throw Error('حقل مطلوب');
    // Do not send NULL for optional fields that have a database default.
    // Postgres applies DEFAULT only when a column is omitted, not when NULL is sent.
    if(!editing && val==='' && (spec.startsWith('select:') || (spec==='number' && !required)))continue;
    if(spec==='number'){val=val===''?undefined:Number(val);if(val!==undefined&&!Number.isFinite(val))throw Error('قيمة رقمية غير صحيحة');}
    if(spec==='datetime-local'&&val)val=new Date(val).toISOString();
    if(val!==undefined)payload[key]=val===''?null:val;
   }
   if(group==='stages'){
    if(payload.probability!=null&&(payload.probability<0||payload.probability>100))throw Error('الاحتمالية من 0 إلى 100');
    if(payload.is_won&&payload.is_lost)throw Error('لا يمكن أن تكون المرحلة رابحة وخاسرة معًا');
   }
   if(group==='deals'&&payload.pipeline_stage_id){
    const stage=(rows.stages||[]).find(x=>x.id===payload.pipeline_stage_id);
    if(!stage||stage.pipeline_id!==payload.pipeline_id)throw Error('مرحلة المسار لا تتبع المسار المحدد');
   }
   if(group==='activities')payload.completed_at=payload.status==='completed'?(editing?.completed_at||new Date().toISOString()):null;
   if(group==='deals'&&payload.probability!=null&&(payload.probability<0||payload.probability>100))throw Error('الاحتمالية من 0 إلى 100');
   if(group==='success'&&payload.health_score!=null&&(payload.health_score<0||payload.health_score>100))throw Error('مؤشر الصحة من 0 إلى 100');
   const t=tableNames[group],result=editing?await sb.from(t).update({...payload,updated_at:new Date().toISOString()}).eq('workspace_id',workspace.id).eq('id',editing.id).select('id').single():await sb.from(t).insert(payload).select('id').single();
   must(result);await refresh();notify('حُفظ السجل بنجاح');
  }catch(err){notify('تعذر الحفظ: '+(err.message||err),true);}finally{button.disabled=false;}
 });
 const install=$('install'),hint=$('install-hint');
 if(window.matchMedia('(display-mode: standalone)').matches){install.hidden=true;hint.textContent='التطبيق مثبت بالفعل';}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
 install.addEventListener('click',async()=>{
  if(!installPrompt){hint.textContent='من قائمة المتصفح اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية. يلزم اتصال بالإنترنت.';return;}
  const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;hint.textContent=choice.outcome==='accepted'?'تم قبول طلب التثبيت':'يمكن تثبيت التطبيق لاحقًا';
 });
 window.addEventListener('appinstalled',()=>{install.hidden=true;hint.textContent='اكتمل تثبيت التطبيق';});
 if('serviceWorker' in navigator){/* Existing site worker only; never register a caching worker for CRM records. */}
 await initialize();
})();
