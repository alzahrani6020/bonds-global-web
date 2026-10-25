(function(){
'use strict';
const $=s=>document.querySelector(s);
const lang=(document.documentElement.lang||'ar').startsWith('en')?'en':'ar';
const T=lang==='ar'?{
 loading:'جاري تحميل الخدمة...', procedures:'الإجراءات', requirements:'المتطلبات', deliverables:'المخرجات', dependencies:'خدمات مرتبطة', pricing:'التسعير', form:'بيانات الطلب', submit:'ابدأ التنفيذ', details:'تفاصيل الخدمة', login:'سجّل الدخول لتنفيذ الخدمة', noForm:'لا توجد بيانات إضافية مطلوبة حاليًا. ابدأ التنفيذ لتحديد المتطلبات تلقائيًا.', custom:'حسب عرض سعر', required:'مطلوب', optional:'اختياري', sent:'تم إنشاء طلب الخدمة بنجاح', executed:'تم تنفيذ الخدمة بنجاح', moreInputs:'أدخل البيانات المطلوبة لإكمال التنفيذ', unavailable:'هذه الخدمة غير متاحة حاليًا لهذا الاختيار.', failed:'تعذر تنفيذ الطلب', files:'سيتم رفع المستندات المطلوبة من بوابة العميل بعد إنشاء الطلب.', intake:'مصدر البيانات المالية', upload:'رفع ملف', manual:'إدخال يدوي', chooseFile:'اختر PDF أو XLSX أو XLS أو CSV', review:'راجع البيانات المستخرجة قبل التنفيذ', approveExecute:'اعتماد وتشغيل التحليل', missing:'مفقود', conflict:'متعارض', source:'المصدر', value:'القيمة', currency:'العملة', period:'الفترة', original:'الأصلية', correction:'القيمة المعتمدة'
}:{
 loading:'Loading service...', procedures:'Procedures', requirements:'Requirements', deliverables:'Deliverables', dependencies:'Related services', pricing:'Pricing', form:'Service inputs', submit:'Start execution', details:'Service details', login:'Sign in to execute the service', noForm:'No additional information is required yet. Start execution to resolve requirements automatically.', custom:'By quote', required:'Required', optional:'Optional', sent:'Service request created successfully', executed:'Service executed successfully', moreInputs:'Enter the required data to complete execution', unavailable:'This service is currently unavailable for this selection.', failed:'Request failed', files:'Required documents can be uploaded from the client portal after creating the request.', intake:'Financial data source', upload:'Upload file', manual:'Manual input', chooseFile:'Choose PDF, XLSX, XLS or CSV', review:'Review extracted data before execution', approveExecute:'Approve and run analysis', missing:'Missing', conflict:'Conflict', source:'Source', value:'Value', currency:'Currency', period:'Period', original:'Original', correction:'Approved value'
};
const params=new URLSearchParams(location.search);
const serviceCode=params.get('service')||'';
let detail=null;
let formTouched=false;
let submitted=false;
let intakeDatasetId=null;
let intakeReview=null;
let intakeMode='file';
let intakeUploadedPath=null;
function text(row,ar='name_ar',en='name_en'){return lang==='ar'?(row?.[ar]||row?.[en]||''):(row?.[en]||row?.[ar]||'')}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function json(url,opts){const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}
function showStatus(msg,ok){const e=$('#srStatus');e.textContent=msg;e.className='sr-status show '+(ok?'ok':'err')}
function contextQuery(){const p=new URLSearchParams();for(const k of ['country','sector','activity']){const v=params.get(k);if(v)p.set(k,v)}return p.toString()}
function renderList(id,items,fn){const el=$(id);if(!el)return;el.innerHTML=items.length?'<ul class="sr-list">'+items.map(fn).join('')+'</ul>':'<div class="sr-empty">—</div>'}
function renderField(field){
 const key=escapeHtml(field.field_key),label=escapeHtml(text(field,'label_ar','label_en')),req=field.is_required?' required':'',reqLabel=field.is_required?T.required:T.optional;
 if(field.field_type==='section')return '<div class="sr-field full"><h3>'+label+'</h3></div>';
 if(field.field_type==='instruction')return '<div class="sr-field full sr-field-info">'+label+'</div>';
 if(field.field_type==='file')return '<div class="sr-field full"><label>'+label+' <small>('+reqLabel+')</small></label><input type="file" data-file-field="'+key+'"'+req+'><div class="sr-muted">'+T.files+'</div></div>';
 if(field.field_type==='textarea')return '<div class="sr-field full"><label>'+label+' <small>('+reqLabel+')</small></label><textarea name="'+key+'"'+req+' placeholder="'+escapeHtml(lang==='ar'?field.placeholder_ar:field.placeholder_en)+'"></textarea></div>';
 if(field.field_type==='select'||field.field_type==='multiselect'){
   const options=(field.options||[]).map(o=>{const value=typeof o==='string'?o:(o.value??o.code??'');const lab=typeof o==='string'?o:(lang==='ar'?(o.label_ar||o.label||value):(o.label_en||o.label||value));return '<option value="'+escapeHtml(value)+'">'+escapeHtml(lab)+'</option>'}).join('');
   return '<div class="sr-field"><label>'+label+' <small>('+reqLabel+')</small></label><select name="'+key+'"'+(field.field_type==='multiselect'?' multiple':'')+req+'><option value=""></option>'+options+'</select></div>';
 }
 if(field.field_type==='checkbox')return '<div class="sr-field"><label class="sr-check"><input type="checkbox" name="'+key+'"> '+label+'</label></div>';
 const type={number:'number',money:'number',percentage:'number',date:'date'}[field.field_type]||'text';
 return '<div class="sr-field"><label>'+label+' <small>('+reqLabel+')</small></label><input type="'+type+'" name="'+key+'"'+req+' placeholder="'+escapeHtml(lang==='ar'?field.placeholder_ar:field.placeholder_en)+'"></div>';
}
function render(){
 const s=detail.service;
 $('#srTitle').textContent=text(s);
 $('#srDesc').textContent=text(s,'short_description_ar','short_description_en');
 $('#srDelivery').textContent=s.delivery_type||'';
 const detailsHref=lang==='ar'?s.default_route_ar:s.default_route_en;
 if(detailsHref){$('#srDetails').href=detailsHref;$('#srDetails').hidden=false}
 if(detail.availability){
   $('#srAvailability').textContent=detail.availability.availability_status;
   if(detail.availability.availability_status==='unavailable'){
     $('#srAvailabilityWarning').textContent=T.unavailable;$('#srAvailabilityWarning').hidden=false;$('#srSubmit').disabled=true;
   }
 }
 renderList('#srProcedures',detail.procedures||[],(x,i)=>'<li><strong>'+escapeHtml(text(x,'title_ar','title_en'))+'</strong>'+(text(x,'description_ar','description_en')?'<div class="sr-muted">'+escapeHtml(text(x,'description_ar','description_en'))+'</div>':'')+'</li>');
 renderList('#srRequirements',detail.requirements||[],x=>'<li>'+escapeHtml(text(x,'label_ar','label_en'))+(x.is_required?' <strong>('+T.required+')</strong>':'')+'</li>');
 renderList('#srDeliverables',detail.deliverables||[],x=>'<li>'+escapeHtml(text(x))+'</li>');
 renderList('#srDependencies',detail.dependencies||[],x=>'<li>'+escapeHtml(text(x.service))+' <span class="sr-muted">('+escapeHtml(x.dependency_type)+')</span></li>');
 const pricing=detail.pricing||[];
 $('#srPricing').innerHTML=pricing.length?pricing.map(x=>{if(x.pricing_type==='quote')return '<div class="sr-price">'+T.custom+'</div>';const amount=x.amount??x.min_amount;return '<div class="sr-price">'+(amount!=null?Number(amount).toLocaleString(lang==='ar'?'ar-SA':'en-US'):'')+' '+escapeHtml(x.currency_code||'')+'</div><div class="sr-muted">'+escapeHtml(x.pricing_type)+'</div>'}).join(''):'<div class="sr-muted">'+T.custom+'</div>';
 const form=detail.form;
 $('#srFormTitle').textContent=form?text(form):T.form;
 $('#srDynamicFields').innerHTML=form?.fields?.length?form.fields.map(renderField).join(''):'<div class="sr-empty">'+T.noForm+'</div>';
 renderFinancialIntake();
}
const FINANCIAL_ACTIONS=new Set([
 'financial_analysis_run','cash_flow_analysis_run','funding_readiness_run','creditworthiness_run',
 'feasibility_run','valuation_run','risk_analysis_run','scenario_forecast_run'
]);
function isFinancialIntakeService(){
 if(detail?.intake?.supported===true)return true;
 return (detail?.capabilities||[]).some(item=>FINANCIAL_ACTIONS.has(item.capability_code));
}
function isRequestOnlyIntakeService(){
 return detail?.intake?.supported===true &&
   detail?.intake?.execution_mode==='request_only';
}
function renderFinancialIntake(){
 if(!isFinancialIntakeService())return;
 const host=$('#srDynamicFields');
 if(!host||$('#srFinancialIntake'))return;
 const panel=document.createElement('div');
 panel.id='srFinancialIntake';
 panel.className='sr-intake full';
 panel.innerHTML='<h3>'+escapeHtml(T.intake)+'</h3>'+
   '<div class="sr-intake-modes">'+
     '<label><input type="radio" name="__intake_mode" value="file" checked> '+escapeHtml(T.upload)+'</label>'+
     '<label><input type="radio" name="__intake_mode" value="manual"> '+escapeHtml(T.manual)+'</label>'+
   '</div>'+
   '<div id="srIntakeFileWrap"><input id="srIntakeFile" type="file" accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"><div class="sr-muted">'+escapeHtml(T.chooseFile)+'</div></div>'+
   '<div id="srIntakeReview"></div>';
 host.prepend(panel);
 panel.querySelectorAll('input[name="__intake_mode"]').forEach(radio=>radio.addEventListener('change',()=>{
   intakeMode=radio.value;
   $('#srIntakeFileWrap').hidden=intakeMode!=='file';
 }));
}
function inferFinancialMime(file){
 const type=String(file?.type||'').toLowerCase();
 const allowed=new Set([
   'application/pdf',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'application/vnd.ms-excel',
   'text/csv',
   'application/csv'
 ]);
 if(allowed.has(type))return type==='application/csv'?'text/csv':type;
 const name=String(file?.name||'').toLowerCase();
 if(name.endsWith('.pdf'))return 'application/pdf';
 if(name.endsWith('.xlsx'))return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 if(name.endsWith('.xls'))return 'application/vnd.ms-excel';
 if(name.endsWith('.csv'))return 'text/csv';
 return null;
}
function intakeSourceLabel(field){
 const sources=Array.isArray(field?.source)?field.source:[];
 if(!sources.length)return intakeReview?.source?.file_name||T.manual;
 const src=sources[0]||{};
 const parts=[];
 if(intakeReview?.source?.file_name)parts.push(intakeReview.source.file_name);
 if(src.sheet)parts.push((lang==='ar'?'ورقة ':'Sheet ')+src.sheet);
 if(src.row)parts.push((lang==='ar'?'صف ':'Row ')+src.row);
 if(src.column)parts.push((lang==='ar'?'عمود ':'Column ')+src.column);
 if(src.line)parts.push((lang==='ar'?'سطر ':'Line ')+src.line);
 if(src.extraction_method==='manual_input')parts.push(T.manual);
 return parts.join(' · ')||T.manual;
}
function renderIntakeReview(payload){
 intakeReview=payload;
 const host=$('#srIntakeReview');
 if(!host)return;
 const fields=Array.isArray(payload?.fields)?payload.fields:[];
 host.innerHTML='<div class="sr-intake-review-title">'+escapeHtml(T.review)+'</div>'+
   '<div class="sr-intake-table">'+fields.map(field=>{
     const status=field.status==='missing'?T.missing:(field.status==='conflict'?T.conflict:field.status||'');
     const current=field.value??'';
     const candidates=Array.isArray(field.candidates)&&field.candidates.length?' ['+field.candidates.join(' / ')+']':'';
     return '<div class="sr-intake-row">'+
       '<div><strong>'+escapeHtml(humanizeKey(field.field))+'</strong><small>'+escapeHtml(status)+escapeHtml(candidates)+'</small></div>'+
       '<div><label>'+escapeHtml(T.correction)+'</label><input type="number" step="any" data-intake-field="'+escapeHtml(field.field)+'" value="'+escapeHtml(current)+'"></div>'+
       '<div><label>'+escapeHtml(T.currency)+'</label><span>'+escapeHtml(field.currency||'—')+'</span></div>'+
       '<div><label>'+escapeHtml(T.period)+'</label><span>'+escapeHtml(field.period||'—')+'</span></div>'+
       '<div class="sr-intake-source"><label>'+escapeHtml(T.source)+'</label><span>'+escapeHtml(intakeSourceLabel(field))+'</span></div>'+
     '</div>';
   }).join('')+'</div>';
 $('#srSubmit').textContent=T.approveExecute;
}
function collectIntakeCorrections(){
 const out={};
 document.querySelectorAll('[data-intake-field]').forEach(input=>{
   if(input.value!=='')out[input.dataset.intakeField]=input.value;
 });
 return out;
}
async function uploadIntakeFile(sb,user){
 const file=$('#srIntakeFile')?.files?.[0];
 if(!file)throw new Error(T.chooseFile);
 const mime=inferFinancialMime(file);
 if(!mime)throw new Error(T.chooseFile);
 if(file.size>10*1024*1024)throw new Error('10 MB');
 const ext={ 'application/pdf':'pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','application/vnd.ms-excel':'xls','text/csv':'csv' }[mime];
 const id=(window.crypto?.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
 const path='financial-intake/'+user.id+'/'+id+'.'+ext;
 const {error}=await sb.storage.from('client-documents').upload(path,file,{contentType:mime,upsert:false});
 if(error)throw error;
 intakeUploadedPath=path;
 return {storage_path:path,file_name:file.name,mime_type:mime,size_bytes:file.size};
}
async function prepareFinancialIntake({sb,user,headers,values}){
 let source={manual_values:values};
 if(intakeMode==='file')source=await uploadIntakeFile(sb,user);
 try{
   const response=await fetch('/api/v3/services/intake/prepare',{
     method:'POST',
     headers,
     body:JSON.stringify({
       service_code:serviceCode,
       project_id:params.get('project_id')||null,
       ...source
     })
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload?.error?.code||payload?.error||('HTTP '+response.status));
   intakeDatasetId=payload.dataset_id;
   renderIntakeReview(payload);
   showStatus(T.review,true);
 }catch(error){
   if(intakeUploadedPath){
     await sb.storage.from('client-documents').remove([intakeUploadedPath]).catch(()=>{});
     intakeUploadedPath=null;
   }
   throw error;
 }
}
async function approveFinancialIntake(headers){
 const response=await fetch('/api/v3/services/intake/approve',{
   method:'POST',
   headers,
   body:JSON.stringify({
     dataset_id:intakeDatasetId,
     corrections:collectIntakeCorrections()
   })
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok){
   if(payload?.fields)renderIntakeReview(payload);
   const missing=payload?.missing_fields||[];
   throw new Error(missing.length?T.moreInputs+': '+missing.map(humanizeKey).join(', '):(payload?.error?.code||'HTTP '+response.status));
 }
 intakeReview=payload;
 return payload;
}
function humanizeKey(key){
 const labels={
  total_debt:lang==='ar'?'إجمالي الدين':'Total debt',
  equity:lang==='ar'?'حقوق الملكية':'Equity',
  total_assets:lang==='ar'?'إجمالي الأصول':'Total assets',
  total_liabilities:lang==='ar'?'إجمالي الالتزامات':'Total liabilities',
  current_assets:lang==='ar'?'الأصول المتداولة':'Current assets',
  current_liabilities:lang==='ar'?'الالتزامات المتداولة':'Current liabilities',
  cash:lang==='ar'?'النقد وما في حكمه':'Cash',
  revenue:lang==='ar'?'الإيرادات':'Revenue',
  cogs:lang==='ar'?'تكلفة المبيعات':'Cost of goods sold',
  operating_expenses:lang==='ar'?'المصروفات التشغيلية':'Operating expenses',
  operating_income:lang==='ar'?'الربح التشغيلي':'Operating income',
  net_income:lang==='ar'?'صافي الربح':'Net income',
  ebitda:lang==='ar'?'EBITDA':'EBITDA',
  interest_expense:lang==='ar'?'مصروف الفوائد':'Interest expense',
  inventory:lang==='ar'?'المخزون':'Inventory',
  receivables:lang==='ar'?'الذمم المدينة':'Receivables',
  prior_revenue:lang==='ar'?'إيرادات الفترة السابقة':'Prior revenue',
  prior_net_income:lang==='ar'?'صافي ربح الفترة السابقة':'Prior net income',
  cost_of_equity_pct:lang==='ar'?'تكلفة حقوق الملكية %':'Cost of equity %',
  cost_of_debt_pct:lang==='ar'?'تكلفة الدين %':'Cost of debt %',
  tax_rate_pct:lang==='ar'?'معدل الضريبة %':'Tax rate %'
 };
 return labels[key]||String(key||'').replace(/_/g,' ');
}
function normalizeRequiredInputs(items){
 const out=[];
 for(const raw of Array.isArray(items)?items:[]){
  const key=String(raw||'');
  if(!key)continue;
  if(key==='equity_or_total_assets_and_total_liabilities'){
   out.push('equity');
   continue;
  }
  if(key==='ebitda_or_revenue_cogs_operating_expenses'){
   out.push('ebitda');
   continue;
  }
  if(key==='cost_of_debt_pct_or_interest_expense'){
   out.push('cost_of_debt_pct');
   continue;
  }
  if(key.startsWith('non_zero_')||key.startsWith('non_negative_')||key==='positive_total_capital')continue;
  out.push(key);
 }
 return [...new Set(out)];
}
function ensureExecutionFields(requiredInputs){
 const container=$('#srDynamicFields');
 const keys=normalizeRequiredInputs(requiredInputs);
 if(!container||!keys.length)return false;
 for(const key of keys){
  if(container.querySelector('[name="'+CSS.escape(key)+'"]'))continue;
  const wrap=document.createElement('div');
  wrap.className='sr-field';
  wrap.innerHTML='<label>'+escapeHtml(humanizeKey(key))+' <small>('+T.required+')</small></label>'+
    '<input type="number" step="any" name="'+escapeHtml(key)+'" required>';
  container.appendChild(wrap);
 }
 $('#srFormTitle').textContent=T.moreInputs;
 return true;
}
function renderExecutionResult(payload){
 let box=$('#srExecutionResult');
 if(!box){
  box=document.createElement('section');
  box.id='srExecutionResult';
  box.className='sr-card';
  $('#srRequestForm').insertAdjacentElement('afterend',box);
 }
 const result=payload?.result||{};
 const metrics=result.metrics||payload?.metrics||{};
 const entries=Object.entries(metrics).filter(([,v])=>v!==null&&v!==undefined);
 box.innerHTML='<h2>'+escapeHtml(T.executed)+'</h2>'+
  (entries.length?'<div class="sr-list"><ul>'+entries.map(([k,v])=>'<li><strong>'+escapeHtml(humanizeKey(k))+'</strong>: '+escapeHtml(typeof v==='number'?Number(v).toLocaleString(lang==='ar'?'ar-SA':'en-US',{maximumFractionDigits:4}):v)+'</li>').join('')+'</ul></div>':
  '<pre style="white-space:pre-wrap;overflow:auto">'+escapeHtml(JSON.stringify(result,null,2))+'</pre>');
}

function track(event,properties={}){
 try{
  fetch('/api/log-usage',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   credentials:'same-origin',
   keepalive:true,
   body:JSON.stringify({
    event,
    calculator:'service_request',
    country:params.get('country')||null,
    lang,
    action:'service',
    properties:{service_code:serviceCode,sector_code:params.get('sector')||null,activity_code:params.get('activity')||null,...properties},
    url:location.href
   })
  }).catch(()=>{});
 }catch(_){}
}
function collectValues(){
 const values={};const form=$('#srRequestForm');
 form.querySelectorAll('[name]').forEach(el=>{
   if(el.type==='file')return;
   if(el.type==='checkbox')values[el.name]=el.checked;
   else if(el.multiple)values[el.name]=Array.from(el.selectedOptions).map(o=>o.value);
   else values[el.name]=el.type==='number'&&el.value!==''?Number(el.value):el.value;
 });
 return values;
}
async function submit(e){
 e.preventDefault();
 try{
  await window.BondsAuth.ensureEnv();
  const u=await window.BondsAuth.getUser();const user=u.data?.user;
  if(!user){location.href='/calculators/auth/index.html?redirect='+encodeURIComponent(location.pathname+location.search);return}
  const sb=window.BondsAuth.getSupabase();const session=(await sb.auth.getSession()).data.session;
  if(!session?.access_token)throw new Error(T.login);
  const values=collectValues();
  const context={
    country:params.get('country')||null,
    region:params.get('region')||null,
    locality:params.get('locality')||null,
    sector:params.get('sector')||null,
    activity:params.get('activity')||null
  };
  const headers={'Content-Type':'application/json','Authorization':'Bearer '+session.access_token};

  if(isFinancialIntakeService()){
    if(!intakeDatasetId){
      await prepareFinancialIntake({sb,user,headers,values});
      return;
    }
    await approveFinancialIntake(headers);

    if(isRequestOnlyIntakeService()){
      const requestBody={
        service_code:serviceCode,
        country_code:params.get('country')||null,
        region_code:params.get('region')||null,
        region_name:params.get('region_name')||null,
        locality_code:params.get('locality')||null,
        locality_name:params.get('locality_name')||null,
        sector_code:params.get('sector')||null,
        activity_code:params.get('activity')||null,
        values:{},
        form_version:detail.form?.version||null,
        lang,
        url:location.href,
        source:'service_request_page',
        metadata:{financial_dataset_id:intakeDatasetId,intake_mode:intakeMode}
      };
      const d=await json('/api/v3/services/requests',{method:'POST',headers,body:JSON.stringify(requestBody)});
      submitted=true;
      track('service_converted',{request_reference:d.request.request_reference,dataset_id:intakeDatasetId});
      showStatus(T.sent+' — '+d.request.request_reference,true);
      $('#srSubmit').disabled=true;
      $('#srSuccessLink').href=lang==='ar'?'/my-bonds/':'/en/my-bonds/';
      $('#srSuccessLink').hidden=false;
      return;
    }

    const executionResponse=await fetch('/api/v3/services/execute',{
      method:'POST',
      headers,
      body:JSON.stringify({
        service_code:serviceCode,
        dataset_id:intakeDatasetId,
        country_code:context.country,
        sector:context.sector,
        activity:context.activity,
        language:lang,
        context,
        source:'service_request_page'
      })
    });
    const execution=await executionResponse.json().catch(()=>({}));
    if(!executionResponse.ok||execution.executed!==true){
      throw new Error(execution?.error?.code||execution?.status||('HTTP '+executionResponse.status));
    }
    submitted=true;
    track('service_executed',{action:execution.action||null,execution_status:execution.execution_status||null,dataset_id:intakeDatasetId});
    showStatus(T.executed,true);
    renderExecutionResult(execution);
    $('#srSubmit').disabled=true;
    return;
  }

  const executionResponse=await fetch('/api/v3/services/execute',{
    method:'POST',
    headers,
    body:JSON.stringify({
      service_code:serviceCode,
      inputs:values,
      values,
      country_code:context.country,
      sector:context.sector,
      activity:context.activity,
      language:lang,
      context,
      source:'service_request_page'
    })
  });
  const execution=await executionResponse.json().catch(()=>({}));

  if(executionResponse.ok&&execution.executed===true){
    submitted=true;
    track('service_executed',{action:execution.action||null,execution_status:execution.execution_status||null});
    showStatus(T.executed,true);
    renderExecutionResult(execution);
    $('#srSubmit').disabled=true;
    return;
  }

  const requiredInputs=execution.required_inputs||execution.result?.required_inputs||execution.error?.missing||[];
  if(ensureExecutionFields(requiredInputs)){
    showStatus(T.moreInputs,false);
    return;
  }

  const manualFallback=executionResponse.status===409&&execution?.error?.code==='SERVICE_EXECUTION_NOT_AUTOMATED';
  if(!manualFallback){
    const code=execution?.error?.code||execution?.status||('HTTP '+executionResponse.status);
    throw new Error(code);
  }

  const body={
    service_code:serviceCode,
    country_code:params.get('country')||null,
    region_code:params.get('region')||null,
    region_name:params.get('region_name')||null,
    locality_code:params.get('locality')||null,
    locality_name:params.get('locality_name')||null,
    sector_code:params.get('sector')||null,
    activity_code:params.get('activity')||null,
    values,
    form_version:detail.form?.version||null,
    lang,
    url:location.href,
    source:'service_request_page'
  };
  const d=await json('/api/v3/services/requests',{method:'POST',headers,body:JSON.stringify(body)});
  submitted=true;
  track('service_converted',{request_reference:d.request.request_reference});
  showStatus(T.sent+' — '+d.request.request_reference,true);
  $('#srSubmit').disabled=true;
  $('#srSuccessLink').href=lang==='ar'?'/my-bonds/':'/en/my-bonds/';$('#srSuccessLink').hidden=false;
 }catch(err){showStatus(T.failed+': '+err.message,false)}
}
async function init(){
 if(!serviceCode){showStatus(T.failed+': service',false);return}
 $('#srLoading').textContent=T.loading;
 try{
  detail=await json('/api/v3/services/'+encodeURIComponent(serviceCode)+'?'+contextQuery());
  $('#srLoading').hidden=true;$('#srContent').hidden=false;render();
  const requestForm=$('#srRequestForm');
  $('#srSubmit').textContent=T.submit;
  requestForm.addEventListener('submit',submit);
  requestForm.addEventListener('input',()=>{formTouched=true},{passive:true});
  requestForm.addEventListener('change',()=>{formTouched=true},{passive:true});
  track('service_request_viewed',{delivery_type:detail.service?.delivery_type||null});
 }catch(err){showStatus(T.failed+': '+err.message,false)}
}
window.addEventListener('pagehide',()=>{
 if(formTouched && !submitted) track('form_abandoned',{form_version:detail?.form?.version||null});
},{capture:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();