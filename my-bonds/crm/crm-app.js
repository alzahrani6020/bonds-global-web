/* BONDS customer CRM — authenticated, RLS-scoped workspace; never caches customer data offline. */
(async function () {
 'use strict';
 const $ = id => document.getElementById(id);
 const english=document.documentElement.lang==='en';
 const translations={"نظرة عامة":"Overview","الشركات":"Companies","جهات الاتصال":"Contacts","الصفقات":"Deals","مسارات المبيعات":"Sales pipelines","الأنشطة والمهام":"Activities and tasks","التجديدات":"Renewals","نجاح العملاء":"Customer success","مراحل مسارات المبيعات":"Pipeline stages","فريق العمل والصلاحيات":"Team and permissions","سجل التدقيق":"Audit log","اسم المسار":"Pipeline name","الوصف":"Description","مسار نشط":"Active pipeline","المسار الافتراضي":"Default pipeline","مسار المبيعات":"Sales pipeline","اسم المرحلة":"Stage name","الترتيب":"Order","مرحلة رابحة":"Won stage","مرحلة خاسرة":"Lost stage","مرحلة نشطة":"Active stage","مرحلة المسار":"Pipeline stage","محتمل":"Lead","مؤهل":"Qualified","عرض":"Proposal","تفاوض":"Negotiation","رابحة":"Won","خاسرة":"Lost","مهمة":"Task","مكالمة":"Call","اجتماع":"Meeting","بريد":"Email","ملاحظة":"Note","واتساب":"WhatsApp","رسالة":"Message","زيارة":"Visit","مفتوحة":"Open","مكتملة":"Completed","ملغاة":"Cancelled","الاسم":"Name","الاسم القانوني":"Legal name","السجل التجاري":"Commercial registration","الرقم الضريبي":"Tax number","البريد":"Email","الهاتف":"Phone","المدينة":"City","الدولة":"Country","القطاع":"Sector","الحالة":"Status","الشركة":"Company","الدور":"Role","المصدر":"Source","صاحب قرار":"Decision maker","عنوان الصفقة":"Deal title","جهة الاتصال":"Contact","المرحلة":"Stage","القيمة":"Value","العملة":"Currency","احتمال الإغلاق %":"Probability %","تاريخ الإغلاق":"Expected close date","الإجراء التالي":"Next action","موعد الإجراء":"Next action date","الموضوع":"Subject","النوع":"Type","الصفقة":"Deal","الموعد":"Scheduled date","التفاصيل":"Details","التجديد":"Renewal","تاريخ التجديد":"Renewal date","درجة المخاطر":"Risk level","ملاحظات":"Notes","مؤشر الصحة":"Health score","المراجعة المقبلة":"Next review","خطة النجاح":"Success plan","المهام المفتوحة":"Open tasks","التجديدات القادمة":"Upcoming renewals","لا توجد متابعات مجدولة":"No scheduled follow-ups","إجراءات":"Actions","تعديل":"Edit","أرشفة":"Archive","لا توجد سجلات":"No records","إضافة":"Add","لا":"No","نعم":"Yes"};
 const t=value=>english?(translations[value]||value):value;
 const tableNames = {companies:'crm_app_companies',contacts:'crm_app_contacts',deals:'crm_app_deals',activities:'crm_app_activities',renewals:'crm_app_renewals',success:'crm_app_success',pipelines:'crm_app_pipelines',stages:'crm_app_pipeline_stages'};
 const sectionTitles = {overview:'نظرة عامة',companies:'الشركات',contacts:'جهات الاتصال',deals:'الصفقات',pipeline:'مسارات المبيعات',activities:'الأنشطة والمهام',renewals:'التجديدات',success:'نجاح العملاء',stages:'مراحل مسارات المبيعات',members:'فريق العمل والصلاحيات',audit:'سجل التدقيق'};
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
 let sb,workspace=null,current='overview',rows={},editing=null,installPrompt=null,currentUser=null,currentRole=null,availableWorkspaces=[],lookupRows={},page=0,pageTotal=0,pageSize=50,searchTimer=null,requestSequence=0,overviewTotals={},overviewStageCounts={};
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
 // Port the internal CRM's evidence-based commercial scoring to tenant-scoped
 // records without using /api/admin or exposing Bonds service-request data.
 // The result is advisory only and is never persisted as a conversion forecast.
 const commercialScore=(items)=>{
  const known=items.filter(item=>item!==null);
  const coverage=items.length?Math.round(known.length*100/items.length):0;
  const score=known.length?Math.round(known.reduce((sum,n)=>sum+n,0)/known.length*10)/10:null;
  return {score,coverage,confidence:coverage>=80?'HIGH':coverage>=60?'MEDIUM':coverage>0?'LOW':'UNKNOWN'};
 };
 const present=v=>v!==null&&v!==undefined&&String(v).trim().length>0;
 const scoreContact=record=>commercialScore([
  present(record.email)||present(record.phone)?100:0,
  record.company_id?100:null,
  record.is_decision_maker===true?100:record.is_decision_maker===false?0:null,
  present(record.role)?100:null,
  present(record.source)?100:null
 ]);
 const scoreDeal=record=>{
  const stages={lead:20,qualified:40,proposal:60,negotiation:80,won:100,lost:0};
  const probability=record.probability===null||record.probability===undefined?null:Number(record.probability);
  return commercialScore([
   Number.isFinite(probability)?Math.max(0,Math.min(100,probability)):null,
   Object.hasOwn(stages,record.stage)?stages[record.stage]:null,
   Number(record.value_amount)>0?100:null,
   present(record.expected_close_date)?100:null,
   present(record.next_action)&&present(record.next_action_at)?100:present(record.next_action)||present(record.next_action_at)?60:null
  ]);
 };
 const commercialCell=record=>{
  const result=normalSection(current)==='contacts'?scoreContact(record):scoreDeal(record);
  return (result.score===null?'UNKNOWN':result.score+'/100')+' · '+result.confidence+' · '+result.coverage+'%';
 };

 // CSV import is deliberately one bounded, atomic database INSERT. Never store
 // customer files in browser storage or submit tenant identifiers from CSV.
 const contactCsvFields=['name','email','phone','role','source','status','is_decision_maker'];
 function parseCsv(text){
  const records=[];let row=[],field='',quoted=false;
  const source=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){
   const c=source[i];
   if(quoted){
    if(c==='"'&&source[i+1]==='"'){field+='"';i++;}
    else if(c==='"')quoted=false;
    else field+=c;
   }else if(c==='"'&&field==='')quoted=true;
   else if(c===','){row.push(field);field='';}
   else if(c==='\n'||c==='\r'){
    if(c==='\r'&&source[i+1]==='\n')i++;
    row.push(field);field='';
    if(row.some(x=>x.trim()!==''))records.push(row);
    row=[];
   }else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quotation');
  row.push(field);
  if(row.some(x=>x.trim()!==''))records.push(row);
  return records;
 }
 function csvCell(value){
  let v=String(value==null?'':value);
  // Neutralize spreadsheet formula evaluation when files are opened in Excel.
  if(/^\s*[=+@\-\t\r]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
 }
 async function exportContacts(){
  const out=[];const batchSize=250;const cap=10000;
  for(let start=0;start<cap;start+=batchSize){
   const records=must(await sb.from('crm_app_contacts').select(contactCsvFields.join(','))
     .eq('workspace_id',workspace.id).order('created_at',{ascending:true})
     .order('id',{ascending:true}).range(start,start+batchSize-1));
   out.push(...records);
   if(records.length<batchSize)break;
  }
  if(out.length===cap)throw Error('Export exceeds 10,000 records. Use smaller batches via the CRM administrator.');
  const data='\uFEFF'+contactCsvFields.join(',')+'\r\n'+out.map(item=>contactCsvFields.map(key=>csvCell(item[key])).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
  try{
   const a=document.createElement('a');
   a.href=url;a.download='bonds-crm-contacts-'+new Date().toISOString().slice(0,10)+'.csv';
   document.body.appendChild(a);a.click();a.remove();
  }finally{URL.revokeObjectURL(url);}
  notify((english?'Exported contacts: ':'تم تصدير جهات الاتصال: ')+out.length);
 }
 async function importContacts(file){
  if(!file) return;
  if(file.size>262144)throw Error(english?'Maximum CSV size: 256 KB':'الحد الأقصى لملف CSV هو 256 كيلوبايت');
  const records=parseCsv(await file.text());
  if(records.length<2)throw Error(english?'CSV has no contact rows':'ملف CSV لا يحتوي على جهات اتصال');
  const headers=records.shift().map(x=>x.trim().toLowerCase());
  if(new Set(headers).size!==headers.length||!headers.includes('name')||
      headers.some(x=>!contactCsvFields.includes(x)))throw Error(english?'Invalid CSV headers':'أعمدة CSV غير صحيحة');
  if(records.length>100)throw Error(english?'Maximum 100 contacts per import':'الحد الأقصى 100 جهة اتصال في الاستيراد الواحد');
  const seen=new Set(),payload=[];
  for(let i=0;i<records.length;i++){
   const values=records[i];
   if(values.length!==headers.length)throw Error('CSV row '+(i+2)+' has invalid column count');
   const entry=Object.fromEntries(headers.map((k,j)=>[k,values[j].trim()]));
   if(!entry.name||entry.name.length>240)throw Error('CSV row '+(i+2)+': invalid name');
   if(entry.email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)||entry.email.length>254))throw Error('CSV row '+(i+2)+': invalid email');
   const status=entry.status||'lead';
   if(!['lead','prospect','customer','active','inactive','archived'].includes(status))throw Error('CSV row '+(i+2)+': invalid status');
   const email=entry.email?.toLowerCase();
   if(email){
    const identity=entry.name.toLowerCase()+'\\u0000'+email;
    if(seen.has(identity))throw Error('CSV row '+(i+2)+': repeated contact');
    seen.add(identity);
   }
   const yes=String(entry.is_decision_maker||'').toLowerCase();
   if(yes&&!['true','false','1','0','yes','no'].includes(yes))throw Error('CSV row '+(i+2)+': invalid boolean');
   const row={workspace_id:workspace.id,name:entry.name,status,
     is_decision_maker:['true','1','yes'].includes(yes)};
   for(const k of ['email','phone','role','source']){
    if(entry[k]){
     if(entry[k].length>(k==='email'?254:160))throw Error('CSV row '+(i+2)+': field too long');
     row[k]=entry[k];
    }
   }
   payload.push(row);
  }
  if(!window.confirm((english?'Import ':'استيراد ')+payload.length+(english?' contacts into your CRM?':' جهة اتصال إلى مساحة CRM؟')))return;
  // A single PostgREST insert runs in one transaction: any constraint failure
  // rejects the complete batch, including workspace-boundary violations.
  must(await sb.from('crm_app_contacts').insert(payload).select('id'));
  await refresh();
  notify((english?'Imported contacts: ':'تم استيراد جهات الاتصال: ')+payload.length);
 }

 function showSection(name) {
  if(name==='members'||name==='audit'){
   if(currentRole!=='owner'){notify(english?'Owner access required':'هذه الصفحة للمالك فقط',true);return;}
  }
  current=name; $('section-heading').textContent=t(sectionTitles[name]);
  document.querySelectorAll('#crm-nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
  $('csv-export').hidden=name!=='contacts';
  $('csv-import').hidden=name!=='contacts';
  $('new-record').hidden=currentRole==='viewer'||name==='members'||name==='audit';
  if(currentRole==='viewer')$('csv-import').hidden=true;
  $('overview').hidden=name!=='overview';
  $('records-section').hidden=name==='overview'||name==='members'||name==='audit';
  $('membership-section').hidden=name!=='members';
  $('audit-section').hidden=name!=='audit';
  $('editor').hidden=true; editing=null;
  if(name==='overview')loadOverview().then(renderOverview).catch(err=>notify(err.message,true));
  else if(name==='members')renderMembers().catch(err=>notify(err.message,true));
  else if(name==='audit')renderAudit().catch(err=>notify(err.message,true));
  else {page=0;(name==='stages'?loadLookups('stages').then(loadPage):loadPage()).catch(err=>notify(err.message,true));}
 }
 function nameFor(group,id){return (lookupRows[group]||[]).find(x=>x.id===id)?.name || (lookupRows[group]||[]).find(x=>x.id===id)?.title || '—';}
 function renderOverview(){
  const metrics=[['الشركات',overviewTotals.companies||0],['جهات الاتصال',overviewTotals.contacts||0],['الصفقات',overviewTotals.deals||0],['المهام المفتوحة',overviewTotals.openTasks||0],['التجديدات القادمة',overviewTotals.upcomingRenewals||0]];
  $('kpis').innerHTML=metrics.map(([k,v])=>'<div class="kpi"><b>'+v+'</b><span>'+escape(t(k))+'</span></div>').join('');
  const total=Math.max(1,overviewTotals.deals||0);
  $('pipeline-summary').innerHTML=Object.entries(stageLabels).map(([k,label])=>{const n=overviewStageCounts[k]||0;return '<div class="bar-row"><div class="bar-title"><span>'+t(label)+'</span><span>'+n+'</span></div><div class="bar-track"><div class="bar-fill" style="width:'+(n/total*100)+'%"></div></div></div>';}).join('');
  const tasks=(rows.activities||[]).filter(r=>!r.deleted_at&&r.status==='open'&&r.scheduled_at).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,8);
  $('upcoming-tasks').innerHTML=tasks.length?tasks.map(r=>'<p>'+escape(r.subject)+' — '+escape(new Date(r.scheduled_at).toLocaleDateString('ar-SA'))+'</p>').join(''):t('لا توجد متابعات مجدولة');
 }
 function renderRecords(){
  const group=normalSection(current),schema=defs[group],list=(rows[group]||[]).filter(r=>group!=='activities'||!r.deleted_at);
  // Search is applied by PostgREST before pagination, never to a truncated browser cache.
  const filtered=list;
  $('page-info').textContent=(pageTotal===0?'0':String(page*pageSize+1))+'–'+String(Math.min((page+1)*pageSize,pageTotal))+' / '+pageTotal;
  $('page-prev').disabled=page===0;
  $('page-next').disabled=(page+1)*pageSize>=pageTotal;
  $('records-head').innerHTML='<tr>'+columns[group].map(k=>'<th>'+escape(t(schema.find(d=>d[0]===k)?.[1]||k))+'</th>').join('')+(group==='contacts'||group==='deals'?'<th>'+(english?'Commercial score':'التقييم التجاري')+'</th>':'')+'<th>'+t('إجراءات')+'</th></tr>';
  $('records-body').innerHTML=filtered.length?filtered.map(r=>'<tr>'+columns[group].map(k=>'<td>'+escape(k.endsWith('_id')?nameFor(({company_id:'companies',contact_id:'contacts',deal_id:'deals',pipeline_id:'pipelines',pipeline_stage_id:'stages'}[k]||'contacts'),r[k]):formatValue(r[k]))+'</td>').join('')+((group==='contacts'||group==='deals')?'<td>'+escape(commercialCell(r))+'</td>':'')+'<td><button type="button" class="secondary" data-edit="'+escape(r.id)+'">'+t("تعديل")+'</button>'+(group==='activities'?'<button type="button" class="secondary" data-archive="'+escape(r.id)+'">'+t("أرشفة")+'</button>':'')+'</td></tr>').join(''):'<tr><td colspan="7">'+t("لا توجد سجلات")+'</td></tr>';
 }
 function buildField(def,record){
  const [key,label,spec='text',required=false]=def,value=record?.[key];
  const head='<label class="field">'+escape(t(label)),tail='</label>';
  if(spec==='checkbox')return head+'<input type="checkbox" name="'+key+'" '+((record?Boolean(value):key==='is_active')?'checked':'')+'>'+tail;
  if(spec==='textarea')return head+'<textarea name="'+key+'" rows="3">'+escape(value||'')+'</textarea>'+tail;
  if(spec.startsWith('select:')||spec.startsWith('ref:')){
   const reference=spec.startsWith('ref:');
   const options=reference?(lookupRows[spec.slice(4)]||[]).map(r=>[r.id,r.name||r.title]):spec.slice(7).split('|').map(x=>[x,t(stageLabels[x]||kinds[x]||statusLabels[x]||x)]);
   // An empty option is valid for nullable foreign keys, but not for NOT NULL
   // enum columns. When creating, select the first valid enum rather than NULL.
   const selected=value==null?(reference?'':(options[0]?.[0]||'')):String(value);
   return head+'<select name="'+key+'"'+(!reference||required?' required':'')+'>'+(reference?'<option value="">—</option>':'')+options.map(([id,label])=>'<option value="'+escape(id)+'" '+(String(id)===selected?' selected':'')+'>'+escape(label)+'</option>').join('')+'</select>'+tail;
  }
  return head+'<input name="'+key+'" type="'+spec+'" value="'+escape(toInputValue(value,spec))+'" '+(required?'required ':'')+(spec==='number'?'min="0" step="any"':'')+'>'+tail;
 }
 function updatePipelineStageOptions(){
  if(normalSection(current)!=='deals')return;
  const pipeline=$('record-form').querySelector('[name="pipeline_id"]');
  const stage=$('record-form').querySelector('[name="pipeline_stage_id"]');
  if(!pipeline||!stage)return;
  const selected=stage.value;
  const stages=(lookupRows.stages||[]).filter(item=>item.pipeline_id===pipeline.value&&item.is_active);
  stage.innerHTML='<option value="">—</option>'+stages.map(item=>
   '<option value="'+escape(item.id)+'">'+escape(item.name)+'</option>').join('');
  if(stages.some(item=>item.id===selected))stage.value=selected;
 }
 async function openEditor(record=null){
  const group=normalSection(current);
  await loadLookups(group);
  editing=record; $('editor-title').textContent=(record?t('تعديل'):t('إضافة'))+' '+t(sectionTitles[current]);
  $('editor-fields').innerHTML=defs[group].map(def=>buildField(def,record)).join('');
  updatePipelineStageOptions();
  $('editor').hidden=false;$('editor').scrollIntoView({block:'start',behavior:'smooth'});
 }
 const searchColumns={
  companies:['name','legal_name','email','cr_number'],
  contacts:['name','email','phone'],deals:['title','next_action'],
  activities:['subject','details'],renewals:['title','notes'],
  success:['success_plan'],pipelines:['name','description'],stages:['name']
 };
 function searchFilter(builder,group,term){
  const clean=term.trim().slice(0,100);
  if(!clean)return builder;
  // PostgREST OR syntax cannot safely interpolate arbitrary punctuation.
  // Reject grammar and wildcard characters rather than risk a filter injection.
  if(/[,()%"'*\\]/.test(clean))throw Error(english?'Search contains unsupported characters':'البحث يحتوي على رموز غير مدعومة');
  return builder.or(searchColumns[group].map(k=>k+'.ilike.*'+clean+'*').join(','));
 }
 async function loadPage(){
  if(!workspace||!tableNames[normalSection(current)])return;
  const seq=++requestSequence,group=normalSection(current),wid=workspace.id;
  let query=sb.from(tableNames[group]).select('*',{count:'exact'}).eq('workspace_id',wid);
  if(group==='activities')query=query.is('deleted_at',null);
  query=searchFilter(query,group,$('search').value||'');
  const result=await query.order('updated_at',{ascending:false}).order('id',{ascending:false}).range(page*pageSize,(page+1)*pageSize-1);
  if(result.error)throw result.error;
  if(seq!==requestSequence||workspace?.id!==wid||normalSection(current)!==group)return;
  rows[group]=result.data||[];
  pageTotal=result.count??0;
  if(page>0&&page*pageSize>=pageTotal){page=Math.max(0,Math.ceil(pageTotal/pageSize)-1);return loadPage();}
  renderRecords();
 }
 async function loadOverview(){
  const wid=workspace.id;
  const groups=['companies','contacts','deals'];
  const counts=await Promise.all(groups.map(async key=>{
   const r=await sb.from(tableNames[key]).select('id',{count:'exact',head:true}).eq('workspace_id',wid);
   if(r.error)throw r.error;return [key,r.count??0];
  }));
  const tasks=await sb.from(tableNames.activities).select('id',{count:'exact',head:true}).eq('workspace_id',wid).eq('status','open').is('deleted_at',null);
  const renewals=await sb.from(tableNames.renewals).select('id',{count:'exact',head:true}).eq('workspace_id',wid).eq('status','upcoming');
  if(tasks.error)throw tasks.error;if(renewals.error)throw renewals.error;
  overviewTotals={...Object.fromEntries(counts),openTasks:tasks.count??0,upcomingRenewals:renewals.count??0};
  const stages=await Promise.all(Object.keys(stageLabels).map(async stage=>{
   const result=await sb.from(tableNames.deals).select('id',{count:'exact',head:true}).eq('workspace_id',wid).eq('stage',stage);
   if(result.error)throw result.error;return [stage,result.count??0];
  }));
  overviewStageCounts=Object.fromEntries(stages);
  const followups=await sb.from(tableNames.activities).select('subject,scheduled_at').eq('workspace_id',wid).eq('status','open').is('deleted_at',null).not('scheduled_at','is',null).order('scheduled_at',{ascending:true}).limit(8);
  if(followups.error)throw followups.error;
  rows.activities=followups.data||[];
 }
 async function loadLookups(group){
  const wid=workspace.id;
  const fields={companies:'id,name',contacts:'id,name',deals:'id,title',pipelines:'id,name',stages:'id,name,pipeline_id,is_active'};
  const keys=[...new Set((defs[group]||[]).filter(d=>String(d[2]||'').startsWith('ref:')).map(d=>d[2].slice(4)))];
  if(group==='stages'&&!keys.includes('pipelines'))keys.push('pipelines');
  const result=await Promise.all(keys.map(async key=>{
   const columns=fields[key];
   const items=[],size=250;
   for(let offset=0;offset<10000;offset+=size){
    const response=await sb.from(tableNames[key]).select(columns).eq('workspace_id',wid)
      .order('id',{ascending:true}).range(offset,offset+size-1);
    if(response.error)throw response.error;
    items.push(...(response.data||[]));
    if((response.data||[]).length<size)break;
    if(offset+size===10000)throw Error(english?'Too many linked records; narrow the data set':'عدد السجلات المرجعية يتجاوز الحد المدعوم');
   }
   return [key,items];
  }));
  if(workspace?.id===wid)Object.assign(lookupRows,Object.fromEntries(result));
 }
 async function refresh(){
  if(!workspace)return;
  if(current==='stages')await loadLookups('stages');
  if(current==='overview'){await loadOverview();renderOverview();}
  else if(current==='members')await renderMembers();
  else if(current==='audit')await renderAudit();
  else await loadPage();
 }
 async function renderMembers(){
  if(!workspace||currentRole!=='owner')return;
  const list=must(await sb.from('crm_app_members').select('id,member_user_id,role,active,updated_at')
   .eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).limit(250));
  $('members-head').innerHTML='<tr><th>'+(english?'Member UUID':'معرف الموظف')+'</th><th>'+(english?'Role':'الدور')+'</th><th>'+(english?'Status':'الحالة')+'</th><th>'+(english?'Action':'الإجراء')+'</th></tr>';
  $('members-body').innerHTML=list.length?list.map(m=>'<tr><td>'+escape(m.member_user_id)+'</td><td><select data-member-role="'+escape(m.id)+'"><option value="viewer" '+(m.role==='viewer'?'selected':'')+'>Viewer</option><option value="editor" '+(m.role==='editor'?'selected':'')+'>Editor</option><option value="admin" '+(m.role==='admin'?'selected':'')+'>Admin</option></select></td><td>'+(m.active?(english?'Active':'نشط'):(english?'Revoked':'ملغي'))+'</td><td><button class="secondary" type="button" data-member="'+escape(m.id)+'" data-active="'+m.active+'">'+(m.active?(english?'Revoke':'إلغاء الصلاحية'):(english?'Restore':'استعادة الصلاحية'))+'</button></td></tr>').join('')
   :'<tr><td colspan="4">'+(english?'No staff members':'لا يوجد أعضاء')+'</td></tr>';
 }
 async function renderAudit(){
  if(!workspace||currentRole!=='owner')return;
  const list=must(await sb.from('crm_app_audit').select('created_at,actor_user_id,entity,entity_id,action,changed_columns')
   .eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(250));
  $('audit-head').innerHTML='<tr><th>'+(english?'Time':'الوقت')+'</th><th>'+(english?'Actor':'المنفذ')+'</th><th>'+(english?'Object':'السجل')+'</th><th>'+(english?'Action':'الإجراء')+'</th><th>'+(english?'Changed columns':'الحقول المتغيرة')+'</th></tr>';
  $('audit-body').innerHTML=list.length?list.map(x=>'<tr><td>'+escape(new Date(x.created_at).toLocaleString(english?'en-US':'ar-SA'))+'</td><td>'+escape(x.actor_user_id||'system')+'</td><td>'+escape(x.entity)+' '+escape(x.entity_id)+'</td><td>'+escape(x.action)+'</td><td>'+escape((x.changed_columns||[]).join(', '))+'</td></tr>').join('')
   :'<tr><td colspan="5">'+(english?'No audit events':'لا يوجد سجل تغييرات')+'</td></tr>';
 }
 async function activateWorkspace(w){
  workspace=w;
  lookupRows={};rows={};requestSequence++;
  currentRole=w.owner_user_id===currentUser?.id?'owner':null;
  if(!currentRole){
   const members=must(await sb.from('crm_app_members').select('role').eq('workspace_id',w.id)
    .eq('member_user_id',currentUser.id).eq('active',true).limit(1));
   currentRole=members[0]?.role||null;
  }
  if(!currentRole)throw Error(english?'Workspace access revoked':'أُلغيت صلاحية مساحة العمل');
  $('workspace-name').textContent=w.name;
  $('workspace-select').value=w.id;
  document.querySelectorAll('#crm-nav [data-section="members"],#crm-nav [data-section="audit"]')
   .forEach(el=>el.hidden=currentRole!=='owner');
  $('search').value='';
  current='overview';
  await refresh();
 }
 async function initialize(){
  try{
   await window.BondsAuth.ensureEnv();
   sb=window.BondsAuth.getSupabase();
   if(!sb)throw new Error('تعذّر تهيئة خدمة المصادقة');
   const result=await sb.auth.getUser(),user=result.data?.user;
   const invitedToken=new URLSearchParams(window.location.search).get('invite');
   // Never leave a bearer invitation token in browser history or referrer URLs.
   if(invitedToken)window.history.replaceState(null,'',window.location.pathname);
   if(!user){
    $('auth-gate').hidden=false;
    if(invitedToken)notify(english?'Sign in with the invited email, then reopen the invitation link from your mailbox.':'سجّل الدخول بالبريد المدعو ثم افتح رابط الدعوة من بريدك مجددًا.',true);
    return;
   }
   currentUser=user;
   let acceptedWorkspaceId=null;
   if(invitedToken){
    try{
     if(invitedToken.length<32||invitedToken.length>128)throw Error('Invalid invite token');
     const result=await sb.rpc('crm_app_accept_invite',{invite_token:invitedToken});
     acceptedWorkspaceId=must(result);
     notify(english?'Invitation accepted successfully':'تم قبول الدعوة وربط مساحة العمل');
    }catch(error){notify((english?'Invitation was not accepted: ':'لم يتم قبول الدعوة: ')+(error.message||error),true);}
   }
   // RLS makes owned and assigned workspaces visible; never trust browser role claims.
   const spaces=must(await sb.from('crm_app_workspaces').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(100));
   availableWorkspaces=spaces;
   const requestedWorkspaceId=new URLSearchParams(window.location.search).get('workspace_id');
   const chosen=spaces.find(w=>w.id===acceptedWorkspaceId)||spaces.find(w=>w.id===requestedWorkspaceId)||spaces.find(w=>w.owner_user_id===user.id)||spaces[0]||null;
   $('workspace-select').innerHTML=spaces.map(w=>'<option value="'+escape(w.id)+'">'+escape(w.name)+'</option>').join('');
   $('workspace-switch-label').hidden=spaces.length===0;
   $('workspace-create-open').hidden=false;
   $('workspace-create-cancel').hidden=!chosen;
   $('onboarding').hidden=!!chosen;$('workspace-content').hidden=!chosen;
   if(chosen)await activateWorkspace(chosen);

  }catch(e){notify('تعذر تحميل مساحة CRM: '+(e.message||e),true);}
 }
 $('workspace-create-open').addEventListener('click',()=>{
  if(!currentUser)return;
  $('onboarding').hidden=false;
  $('workspace-create-cancel').hidden=!workspace;
  $('onboarding').scrollIntoView({block:'start',behavior:'smooth'});
 });
 $('workspace-create-cancel').addEventListener('click',()=>{
  $('onboarding').hidden=true;
 });
 $('workspace-select').addEventListener('change',async event=>{
  const selected=availableWorkspaces.find(w=>w.id===event.target.value);
  if(!selected)return;
  try{await activateWorkspace(selected);}catch(err){notify(err.message,true);event.target.value=workspace?.id||'';}
 });
 $('workspace-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button');button.disabled=true;
  try{const name=String(new FormData(event.currentTarget).get('name')||'').trim();
   const user=must(await sb.auth.getUser()).user;if(!user)throw Error('انتهت جلسة تسجيل الدخول');
   workspace=must(await sb.from('crm_app_workspaces').insert({name,owner_user_id:user.id}).select('id,name').single());
   workspace.owner_user_id=user.id;
   availableWorkspaces.push(workspace);currentUser=user;currentRole='owner';
   $('workspace-select').innerHTML=availableWorkspaces.map(w=>'<option value="'+escape(w.id)+'">'+escape(w.name)+'</option>').join('');
   $('workspace-switch-label').hidden=false;
   $('workspace-create-open').hidden=false;
   $('workspace-create-cancel').hidden=false;
   $('workspace-name').textContent=workspace.name;$('onboarding').hidden=true;$('workspace-content').hidden=false;
   await activateWorkspace(workspace);notify(english?'Workspace created successfully':'أُنشئت مساحة العمل');
  }catch(e){notify('تعذر إنشاء مساحة العمل: '+e.message,true);}finally{button.disabled=false;}
 });
 $('crm-nav').addEventListener('click',e=>{const n=e.target.closest('[data-section]');if(n&&workspace)showSection(n.dataset.section);});
 $('refresh').addEventListener('click',()=>refresh().then(()=>notify('تم تحديث السجلات')).catch(e=>notify(e.message,true)));
 $('search').addEventListener('input',()=>{clearTimeout(searchTimer);page=0;searchTimer=setTimeout(()=>loadPage().catch(e=>notify(e.message,true)),250);});
 $('page-prev').addEventListener('click',()=>{if(page>0){page--;loadPage().catch(e=>notify(e.message,true));}});
 $('page-next').addEventListener('click',()=>{if((page+1)*pageSize<pageTotal){page++;loadPage().catch(e=>notify(e.message,true));}});
 $('new-record').addEventListener('click',()=>{if(currentRole==='viewer')return notify(english?'Read-only access':'صلاحية العرض فقط',true);openEditor().catch(err=>notify(err.message,true));});
 $('csv-export').addEventListener('click',async()=>{
  const button=$('csv-export');button.disabled=true;
  try{await exportContacts();}catch(err){notify((english?'Export failed: ':'تعذر التصدير: ')+err.message,true);}
  finally{button.disabled=false;}
 });
 $('csv-import').addEventListener('click',()=>{$('csv-file').click();});
 $('csv-file').addEventListener('change',async(event)=>{
  const file=event.target.files?.[0];
  if(!file)return;
  $('csv-import').disabled=true;
  try{await importContacts(file);}catch(err){notify((english?'Import failed: ':'تعذر الاستيراد: ')+err.message,true);}
  finally{event.target.value='';$('csv-import').disabled=false;}
 });
 $('editor-close').addEventListener('click',()=>{$('editor').hidden=true;});
 $('record-form').addEventListener('change',event=>{
  if(event.target.name==='pipeline_id')updatePipelineStageOptions();
 });
 $('records-body').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit]'),archive=e.target.closest('[data-archive]'),group=normalSection(current);
  if(edit){if(currentRole==='viewer')return notify(english?'Read-only access':'صلاحية العرض فقط',true);openEditor((rows[group]||[]).find(r=>r.id===edit.dataset.edit)).catch(err=>notify(err.message,true));return;}
  if(archive&&currentRole==='viewer')return notify(english?'Read-only access':'صلاحية العرض فقط',true);
  if(archive&&group==='activities'&&window.confirm('أرشفة النشاط دون حذف العملاء؟')){
   try{must(await sb.from('crm_app_activities').update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('workspace_id',workspace.id).eq('id',archive.dataset.archive));await refresh();notify('تمت أرشفة النشاط');}
   catch(err){notify(err.message,true);}
  }
 });
 $('invite-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(currentRole!=='owner'||!workspace)return notify(english?'Owner access required':'هذه العملية للمالك فقط',true);
  const fd=new FormData(event.currentTarget);
  const email=String(fd.get('email')||'').trim().toLowerCase();
  const role=String(fd.get('role')||'');
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!['viewer','editor','admin'].includes(role))
   return notify(english?'Invalid invitation data':'بيانات الدعوة غير صحيحة',true);
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   const response=await window.BondsAuth.authenticatedFetch('/api/crm-invite',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({workspace_id:workspace.id,email,role}),redirectOnAuth:false
   });
   const result=await response.json();
   if(!response.ok||result?.success!==true)throw Error(result?.error||'INVITATION_FAILED');
   notify(english?'Email provider accepted the invitation request.':'قبل مزود البريد طلب إرسال الدعوة.');
   event.currentTarget.reset();
  }catch(err){notify((english?'Could not send invitation: ':'تعذّر إرسال الدعوة: ')+(err.message||err),true);}
  finally{button.disabled=false;}
 });
 $('member-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(currentRole!=='owner'||!workspace)return notify(english?'Owner access required':'هذه العملية للمالك فقط',true);
  const fd=new FormData(event.currentTarget),member=String(fd.get('member_user_id')||'').trim();
  const role=String(fd.get('role')||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member)||
    !['admin','editor','viewer'].includes(role)||member===currentUser?.id){
   return notify(english?'Invalid employee UUID or role':'معرف الموظف أو الدور غير صحيح',true);
  }
  const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
  try{
   must(await sb.from('crm_app_members').insert({workspace_id:workspace.id,member_user_id:member,role}).select('id'));
   await renderMembers();event.currentTarget.reset();
   notify(english?'Membership granted':'تم منح صلاحية العضو');
  }catch(err){notify(err.message,true);}finally{button.disabled=false;}
 });
 $('members-body').addEventListener('change',async event=>{
  const control=event.target.closest('[data-member-role]');
  if(!control||currentRole!=='owner'||!workspace)return;
  const role=control.value;
  if(!['viewer','editor','admin'].includes(role))return;
  control.disabled=true;
  try{
   must(await sb.from('crm_app_members').update({role,updated_at:new Date().toISOString()})
    .eq('workspace_id',workspace.id).eq('id',control.dataset.memberRole).select('id'));
   await renderMembers();
   notify(english?'Member role updated':'تم تحديث صلاحية العضو');
  }catch(err){notify(err.message,true);await renderMembers();}finally{control.disabled=false;}
 });
 $('members-body').addEventListener('click',async event=>{
  const button=event.target.closest('[data-member]');
  if(!button||currentRole!=='owner'||!workspace)return;
  const active=button.dataset.active==='true';
  if(!window.confirm(active?(english?'Revoke this employee?':'إلغاء صلاحية هذا الموظف؟'):(english?'Restore this employee?':'استعادة صلاحية هذا الموظف؟')))return;
  button.disabled=true;
  try{
   must(await sb.from('crm_app_members').update({active:!active,updated_at:new Date().toISOString()})
    .eq('workspace_id',workspace.id).eq('id',button.dataset.member).select('id'));
   await renderMembers();
  }catch(err){notify(err.message,true);}finally{button.disabled=false;}
 });
 $('record-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('save-record');button.disabled=true;
  try{
   if(!['owner','admin','editor'].includes(currentRole))throw Error(english?'Read-only access':'صلاحية العرض فقط');
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
   // A blank currency must not override the database NOT NULL default.
   if(group==='deals' && !payload.currency) {
    if(editing && editing.currency) payload.currency=editing.currency;
    else delete payload.currency;
   }
   if(group==='stages'){
    if(payload.probability!=null&&(payload.probability<0||payload.probability>100))throw Error('الاحتمالية من 0 إلى 100');
    if(payload.is_won&&payload.is_lost)throw Error('لا يمكن أن تكون المرحلة رابحة وخاسرة معًا');
   }
   if(group==='deals'&&payload.pipeline_stage_id){
    const stage=(lookupRows.stages||[]).find(x=>x.id===payload.pipeline_stage_id);
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
 try { await initialize(); } finally {
  document.dispatchEvent(new Event('bonds-crm-workspace-initialized'));
 }
})();
