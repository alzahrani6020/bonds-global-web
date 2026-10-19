(function(){
'use strict';
const $=s=>document.querySelector(s);
const lang=(document.documentElement.lang||'ar').startsWith('en')?'en':'ar';
const T=lang==='ar'?{
 loading:'جاري تحميل الخدمة...', procedures:'الإجراءات', requirements:'المتطلبات', deliverables:'المخرجات', dependencies:'خدمات مرتبطة', pricing:'التسعير', form:'بيانات الطلب', submit:'إرسال طلب الخدمة', details:'تفاصيل الخدمة', login:'سجّل الدخول لإرسال الطلب', noForm:'لا توجد بيانات إضافية مطلوبة حاليًا. يمكنك إنشاء الطلب مباشرة.', custom:'حسب عرض سعر', required:'مطلوب', optional:'اختياري', sent:'تم إنشاء طلب الخدمة بنجاح', unavailable:'هذه الخدمة غير متاحة حاليًا لهذا الاختيار.', failed:'تعذر تنفيذ الطلب', files:'سيتم رفع المستندات المطلوبة من بوابة العميل بعد إنشاء الطلب.'
}:{
 loading:'Loading service...', procedures:'Procedures', requirements:'Requirements', deliverables:'Deliverables', dependencies:'Related services', pricing:'Pricing', form:'Request information', submit:'Submit service request', details:'Service details', login:'Sign in to submit the request', noForm:'No additional information is required now. You can create the request directly.', custom:'By quote', required:'Required', optional:'Optional', sent:'Service request created successfully', unavailable:'This service is currently unavailable for this selection.', failed:'Request failed', files:'Required documents can be uploaded from the client portal after creating the request.'
};
const params=new URLSearchParams(location.search);
const serviceCode=params.get('service')||'';
let detail=null;
let formTouched=false;
let submitted=false;
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
  const body={
    service_code:serviceCode,
    country_code:params.get('country')||null,
    region_code:params.get('region')||null,
    region_name:params.get('region_name')||null,
    locality_code:params.get('locality')||null,
    locality_name:params.get('locality_name')||null,
    sector_code:params.get('sector')||null,
    activity_code:params.get('activity')||null,
    values:collectValues(),
    form_version:detail.form?.version||null,
    lang,
    url:location.href,
    source:'service_request_page'
  };
  const d=await json('/api/v3/services/requests',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify(body)});
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