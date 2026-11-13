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
let submitting=false;
let intakeDatasetId=null;
let intakeReview=null;
let intakeMode='file';
let intakeUploadedPath=null;
const isServiceWorkspace=/\/my-bonds\/workspace\/?$/.test(location.pathname);
const FINANCIAL_WORKSPACE_SERVICES=Object.freeze([
 'financial_statements',
 'income_statement',
 'statement_financial_position',
 'cash_flow_statement',
 'changes_in_equity',
 'planning_budgeting_forecasting'
]);
const FINANCIAL_WORKSPACE_TABS=Object.freeze([
 ['financial_statements','القوائم المالية','Financial statements'],
 ['income_statement','قائمة الدخل','Income statement'],
 ['statement_financial_position','المركز المالي','Financial position'],
 ['cash_flow_statement','التدفقات النقدية','Cash flow'],
 ['changes_in_equity','التغيرات في حقوق الملكية','Changes in equity'],
 ['planning_budgeting_forecasting','الموازنات والتوقعات','Budgeting & forecast']
]);
function isFinancialWorkspaceService(){
 return isServiceWorkspace&&FINANCIAL_WORKSPACE_SERVICES.includes(serviceCode);
}
const WORKSPACE_TYPE_COPY=Object.freeze({
 accounting:{ ar:'مساحة المحاسبة', en:'Accounting workspace' },
 'financial-analysis':{ ar:'مساحة التحليل المالي', en:'Financial analysis workspace' },
 'funding-restructuring':{ ar:'مساحة التمويل', en:'Funding workspace' },
 'studies-valuation':{ ar:'مساحة الدراسات والتقييم', en:'Studies & valuation workspace' },
 'tax-compliance':{ ar:'مساحة الزكاة والضريبة', en:'Zakat & tax workspace' },
 'professional-review':{ ar:'مساحة المراجعة المهنية', en:'Professional review workspace' },
 'advisory-request':{ ar:'مساحة الطلب الاستشاري', en:'Advisory request workspace' }
});
function applyWorkspaceTypeChrome(){
 if(!isServiceWorkspace)return;
 const type=String(detail?.workspace?.type||'').trim();
 const copy=WORKSPACE_TYPE_COPY[type];
 if(!copy)return;
 document.body.dataset.workspaceType=type;
 const eyebrow=document.querySelector('.sr-eyebrow');
 if(eyebrow) eyebrow.textContent=lang==='ar'?copy.ar:copy.en;
}
function workspaceReturnTarget(){
 const value=new URLSearchParams(location.search).get('return_to')||'';
 return value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'';
}
function renderWorkspaceReturnLink(){
 if(!isServiceWorkspace)return;
 const target=workspaceReturnTarget();
 if(!target)return;
 const hero=document.querySelector('.sr-hero');
 if(!hero||document.getElementById('srWorkspaceReturn'))return;
 const link=document.createElement('a');
 link.id='srWorkspaceReturn';
 link.className='sr-secondary';
 link.href=target;
 link.textContent=lang==='ar'?'العودة إلى المشروع':'Back to project';
 hero.appendChild(link);
}
function financialWorkspaceHref(code){
 const next=new URLSearchParams(location.search);
 next.set('service',code);
 return (lang==='ar'?'/my-bonds/workspace/':'/en/my-bonds/workspace/')+'?'+next.toString();
}

function correspondenceWorkspaceHref(){
 const next=new URLSearchParams();
 const live=new URLSearchParams(location.search);
 const allowed=['service','company_id','project_id','client_id','funding_case_id','request_id'];
 allowed.forEach(key=>{const value=live.get(key);if(value)next.set(key,value)});
 const workspaceType=String(detail?.workspace?.type||'').trim();
 if(workspaceType)next.set('workspace',workspaceType);
 next.set('return_to',location.pathname+location.search);
 const base=lang==='ar'?'/letterhead.html':'/en/letterhead.html';
 return base+'?'+next.toString();
}
function renderCorrespondenceWorkspaceLink(){
 if(!isServiceWorkspace)return;
 const hero=document.querySelector('.sr-hero');
 if(!hero||document.getElementById('srCorrespondence'))return;
 const link=document.createElement('a');
 link.id='srCorrespondence';
 link.className='sr-secondary';
 link.href=correspondenceWorkspaceHref();
 link.textContent=lang==='ar'?'فتح المراسلات':'Open correspondence';
 hero.appendChild(link);
}
const STUDIES_WORKSPACE_SERVICES=Object.freeze([
 'market_research',
 'scientific_research',
 'feasibility_studies',
 'risk_analysis'
]);
const STUDIES_WORKSPACE_TABS=Object.freeze([
 ['market_research','البحوث السوقية','Market research'],
 ['scientific_research','البحث العلمي','Scientific research'],
 ['feasibility_studies','دراسات الجدوى','Feasibility'],
 ['risk_analysis','تحليل المخاطر','Risk analysis']
]);
function isStudiesWorkspaceService(){
 return isServiceWorkspace&&STUDIES_WORKSPACE_SERVICES.includes(serviceCode);
}
function readServiceIntent(){
 try{return JSON.parse(sessionStorage.getItem('bonds_service_intent')||'null')}catch(_){return null}
}
function liveParams(){
 try{return new URLSearchParams(location.search)}catch(_){return params}
}
function studiesWorkspaceHref(code){
 const next=new URLSearchParams(location.search);
 next.set('service',code);
 return (lang==='ar'?'/my-bonds/workspace/':'/en/my-bonds/workspace/')+'?'+next.toString();
}
function studiesToolHref(path){
 const next=new URLSearchParams(location.search);
 next.delete('service');
 if(!next.get('city') && next.get('locality')) next.set('city', next.get('locality'));
 const qs=next.toString();
 return path+(qs?'?'+qs:'');
}
function studiesContextChips(){
 const intent=readServiceIntent()||{};
 const live=liveParams();
 const chips=[
  live.get('country')||intent.country_code,
  live.get('region_name')||intent.region_name||live.get('region')||intent.region_code,
  live.get('locality_name')||intent.locality_name||live.get('locality')||intent.locality_code,
  $('#studiesSectorName')?.value||intent.sector_name||live.get('sector'),
  $('#studiesActivityName')?.value||intent.activity_name||live.get('activity')
 ].map(v=>String(v||'').trim()).filter(Boolean);
 if(!chips.length)return '';
 return '<div class="studies-workspace-context">'+chips.map(v=>'<span>'+escapeHtml(v)+'</span>').join('')+'</div>';
}
function renderStudiesWorkspaceShell(){
 if(!isStudiesWorkspaceService())return;
 document.body.classList.add('studies-workspace-mode');
 if($('#studiesWorkspaceNav'))return;
 const grid=document.querySelector('.sr-grid');
 if(!grid)return;
 const detailsBtn=$('#srDetails');
 if(detailsBtn) detailsBtn.hidden=true;
 const shell=document.createElement('section');
 shell.id='studiesWorkspaceNav';
 shell.className='financial-workspace-shell studies-workspace-shell';
 const title=lang==='ar'?'مساحة الدراسات والسوق':'Studies & market workspace';
 const desc=lang==='ar'
  ?'أدخل موجز الدراسة، شغّل التحليل، ثم انتقل إلى مؤشرات المدينة أو الخريطة الاستثمارية أو دراسة الجدوى من نفس السياق.'
  :'Enter the study brief, run the analysis, then continue to city indicators, the investment map, or feasibility using the same context.';
  const tools=studiesBindings()?.studiesToolHrefs(lang)||{};
  const cityHref=studiesToolHref(tools.cityIntelligence||'/v3/city-intelligence.html');
  const mapHref=studiesToolHref(tools.investmentMap||'/v3/investment-map.html');
  const feasibilityHref=studiesWorkspaceHref('feasibility_studies');
  const fundingHref=studiesToolHref(tools.fundingSources||(lang==='ar'?'/funding-sources.html':'/en/funding-sources.html'));
 shell.innerHTML='<div class="financial-workspace-head"><div><span class="financial-workspace-kicker">'+
  (lang==='ar'?'تنفيذ دراسات مباشر':'Direct studies execution')+
  '</span><h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(desc)+'</p>'+studiesContextChips()+'</div>'+
  '<span class="financial-workspace-state">'+(lang==='ar'?'الخدمة الحالية':'Current service')+': '+escapeHtml(text(detail?.service))+'</span></div>'+
  '<nav class="financial-workspace-tabs studies-workspace-tabs" aria-label="'+escapeHtml(title)+'">'+
  STUDIES_WORKSPACE_TABS.map(([code,ar,en])=>'<a class="financial-workspace-tab'+(serviceCode===code?' active':'')+'" href="'+
   escapeHtml(studiesWorkspaceHref(code))+'"'+(serviceCode===code?' aria-current="page"':'')+'>'+escapeHtml(lang==='ar'?ar:en)+'</a>').join('')+
  '</nav>'+
  '<div class="financial-workspace-shortcuts">'+
   '<a href="'+escapeHtml(cityHref)+'">'+(lang==='ar'?'مؤشرات المدينة':'City indicators')+'</a>'+
   '<a href="'+escapeHtml(mapHref)+'">'+(lang==='ar'?'الخريطة الاستثمارية':'Investment map')+'</a>'+
   '<a href="'+escapeHtml(feasibilityHref)+'">'+(lang==='ar'?'دراسة الجدوى':'Feasibility study')+'</a>'+
   '<a href="'+escapeHtml(fundingHref)+'">'+(lang==='ar'?'مصادر التمويل':'Funding sources')+'</a>'+
  '</div>';
 grid.insertAdjacentElement('beforebegin',shell);
}
function studiesBindings(){
 return window.BondsStudiesBindings||null;
}
function studiesParamMap(){
 const intent=readServiceIntent()||{};
 const live=liveParams();
 return {
  country:live.get('country')||intent.country_code||'',
  region:live.get('region')||intent.region_code||'',
  region_name:live.get('region_name')||intent.region_name||'',
  locality:live.get('locality')||intent.locality_code||'',
  locality_name:live.get('locality_name')||intent.locality_name||'',
  city:live.get('locality_name')||intent.locality_name||live.get('locality')||'',
  sector:live.get('sector')||intent.sector_code||'',
  activity:live.get('activity')||intent.activity_code||''
 };
}
function studiesRuntimeFromValues(values){
 const bindings=studiesBindings();
 const query=studiesParamMap();
 const geo=bindings?bindings.studiesGeoFrom(values,query):{
  country:values.country_code||query.country||null,
  city:values.locality_name||query.locality_name||query.locality||null,
  sector:values.sector_code||query.sector||null,
  activity:values.activity_code||query.activity||null
 };
 const packet=bindings?bindings.studiesResearchPacket(serviceCode,values,geo):null;
 return {geo,packet,input:packet&&packet.query||null};
}
function syncStudiesAssistantContext(){
 if(!isStudiesWorkspaceService())return;
 const bindings=studiesBindings();
 const values=typeof collectValues==='function'?collectValues():{};
 const payload=bindings
  ?bindings.studiesAssistantContext(serviceCode,values,studiesParamMap(),lang,text(detail?.service))
  :{version:1,source:'service_workspace',serviceCode,language:lang,executionInputs:values};
 try{sessionStorage.setItem('bonds_service_assistant_context_v1',JSON.stringify(payload))}catch(_){}
}
function studiesPrefill(key,intentKey){
 const intent=readServiceIntent()||{};
 const live=liveParams();
 return live.get(key)||intent[intentKey]||live.get(intentKey)||params.get(key)||'';
}
function studiesSelectMarkup(id,name,placeholder,prefill){
 const seeded=prefill?'<option value="'+escapeHtml(prefill)+'" selected>'+escapeHtml(prefill)+'</option>':'';
 return '<select id="'+id+'" name="'+name+'" data-ud-placeholder="'+escapeHtml(placeholder)+'">'+
  '<option value="">'+escapeHtml(placeholder)+'</option>'+seeded+'</select>';
}
function studiesLocationFieldsHtml(){
 const opt=' <small>('+T.optional+')</small>';
 const country=studiesPrefill('country','country_code');
 const region=studiesPrefill('region','region_code')||studiesPrefill('region_name','region_name');
 const locality=studiesPrefill('locality','locality_code');
 const localityName=studiesPrefill('locality_name','locality_name');
 const sector=studiesPrefill('sector','sector_code');
 const activity=studiesPrefill('activity','activity_code');
 const L=lang==='ar'?{
  country:'الدولة',region:'المنطقة / المحافظة',locality:'المدينة / الموقع',sector:'القطاع',activity:'النشاط',
  countryPh:'اختر الدولة',regionPh:'اختر المنطقة',localityPh:'اختر المدينة',sectorPh:'اختر القطاع',activityPh:'اختر النشاط'
 }:{
  country:'Country',region:'Region / province',locality:'City / location',sector:'Sector',activity:'Activity',
  countryPh:'Choose country',regionPh:'Choose region',localityPh:'Choose city',sectorPh:'Choose sector',activityPh:'Choose activity'
 };
 return '<div class="sr-field"><label for="studiesCountry">'+L.country+opt+'</label>'+studiesSelectMarkup('studiesCountry','country_code',L.countryPh,country)+'</div>'+
  '<div class="sr-field"><label for="studiesRegion">'+L.region+opt+'</label>'+studiesSelectMarkup('studiesRegion','region_code',L.regionPh,region)+'</div>'+
  '<div class="sr-field"><label for="studiesLocality">'+L.locality+opt+'</label>'+studiesSelectMarkup('studiesLocality','locality_code',L.localityPh,locality||localityName)+'</div>'+
  '<div class="sr-field"><label for="studiesSector">'+L.sector+opt+'</label>'+studiesSelectMarkup('studiesSector','sector_code',L.sectorPh,sector)+'</div>'+
  '<div class="sr-field"><label for="studiesActivity">'+L.activity+opt+'</label>'+studiesSelectMarkup('studiesActivity','activity_code',L.activityPh,activity)+'</div>'+
  '<input type="hidden" name="region_name" id="studiesRegionName" value="'+escapeHtml(studiesPrefill('region_name','region_name')||region)+'">'+
  '<input type="hidden" name="locality_name" id="studiesLocalityName" value="'+escapeHtml(localityName)+'">'+
  '<input type="hidden" name="sector_name" id="studiesSectorName">'+
  '<input type="hidden" name="activity_name" id="studiesActivityName">';
}
const studiesCatalog={countries:[],cities:[],sectors:[],activities:[]};
const studiesDropdowns={};
let studiesCatalogLock=false;
let studiesCatalogBound=false;
function studiesCatalogLabel(row){
 return lang==='en'?(row.name_en||row.name_ar||row.code):(row.name_ar||row.name_en||row.code);
}
function studiesLocalityLabel(row){
 const types=lang==='ar'?{city:'مدينة',town:'بلدة',village:'قرية',hijra:'هجرة',hamlet:'نجع',oasis:'واحة',district:'حي',settlement:'تجمع',other:'أخرى'}:{city:'City',town:'Town',village:'Village',hijra:'Hijra',hamlet:'Hamlet',oasis:'Oasis',district:'District',settlement:'Settlement',other:'Other'};
 const base=studiesCatalogLabel(row);
 const type=row.locality_type&&types[row.locality_type]?types[row.locality_type]:'';
 return type?base+' — '+type:base;
}
function studiesDestroyDropdown(el){
 if(!el?.id)return;
 if(studiesDropdowns[el.id]){
  try{studiesDropdowns[el.id].destroy()}catch(_){}
  studiesDropdowns[el.id]=null;
 }
}
function studiesEnhanceSelect(el,searchPlaceholder,virtualize){
 if(!el||!window.UniversalDropdown)return;
 studiesDestroyDropdown(el);
 studiesDropdowns[el.id]=window.UniversalDropdown.fromSelect(el,{
  search:true,
  searchPlaceholder:searchPlaceholder||(lang==='ar'?'بحث...':'Search...'),
  placeholder:el.getAttribute('data-ud-placeholder')||el.options[0]?.textContent||'',
  sort:false,
  deduplicate:true,
  removeEmpty:false,
  maxResults:0,
  debounce:80,
  virtualize:!!virtualize,
  virtualThreshold:40,
  theme:'light',
  fixed:true
 });
}
function studiesFillSelect(el,rows,valueKey,labelFn,placeholder,selected){
 if(!el)return;
 const current=selected!=null&&selected!==''?String(selected):el.value;
 el.innerHTML='';
 const first=document.createElement('option');
 first.value='';
 first.textContent=placeholder;
 el.appendChild(first);
 (rows||[]).forEach(row=>{
  const option=document.createElement('option');
  option.value=String(row[valueKey]||'');
  option.textContent=labelFn(row);
  if(row.name_ar||row.name_en) option.dataset.name=studiesCatalogLabel(row);
  if(row.flag) option.dataset.icon=row.flag;
  el.appendChild(option);
 });
 if([...el.options].some(o=>o.value===current)) el.value=current;
 else if(current){
  const byName=[...el.options].find(o=>o.value===current||o.textContent===current||o.dataset.name===current);
  if(byName) el.value=byName.value;
  else{
   const extra=document.createElement('option');
   extra.value=current;
   extra.textContent=current;
   extra.dataset.name=current;
   extra.selected=true;
   el.appendChild(extra);
   el.value=current;
  }
 }
 studiesEnhanceSelect(el,placeholder,true);
}
function studiesSelectedName(el){
 if(!el)return '';
 const option=el.options[el.selectedIndex];
 if(!option||!option.value)return '';
 return option.dataset.name||option.textContent||'';
}
function studiesSyncHiddenNames(){
 const region=$('#studiesRegion');
 const locality=$('#studiesLocality');
 const sector=$('#studiesSector');
 const activity=$('#studiesActivity');
 const regionName=$('#studiesRegionName');
 const localityName=$('#studiesLocalityName');
 const sectorName=$('#studiesSectorName');
 const activityName=$('#studiesActivityName');
 if(regionName) regionName.value=studiesSelectedName(region)||region?.value||'';
 if(localityName) localityName.value=studiesSelectedName(locality)||'';
 if(sectorName) sectorName.value=studiesSelectedName(sector)||'';
 if(activityName) activityName.value=studiesSelectedName(activity)||'';
}
function studiesWriteLocationToUrl(){
 studiesSyncHiddenNames();
 const url=new URL(location.href);
 const mapping=[
  ['country',$('#studiesCountry')?.value],
  ['region',$('#studiesRegion')?.value],
  ['region_name',$('#studiesRegionName')?.value],
  ['locality',$('#studiesLocality')?.value],
  ['locality_name',$('#studiesLocalityName')?.value],
  ['sector',$('#studiesSector')?.value],
  ['activity',$('#studiesActivity')?.value]
 ];
 mapping.forEach(([key,value])=>{
  if(value) url.searchParams.set(key,value);
  else url.searchParams.delete(key);
 });
 history.replaceState({},'',url);
 studiesRefreshContextChrome();
 syncStudiesAssistantContext();
 if(studiesCatalogBound) saveWorkspaceDraft();
}
function studiesRefreshContextChrome(){
 const head=document.querySelector('#studiesWorkspaceNav .financial-workspace-head > div');
 if(head){
  const existing=head.querySelector('.studies-workspace-context');
  const html=studiesContextChips();
  if(existing) existing.outerHTML=html||'';
  else if(html) head.insertAdjacentHTML('beforeend',html);
 }
 const shortcuts=document.querySelector('#studiesWorkspaceNav .financial-workspace-shortcuts');
 if(shortcuts){
  const tools=studiesBindings()?.studiesToolHrefs(lang)||{};
  const cityHref=studiesToolHref(tools.cityIntelligence||'/v3/city-intelligence.html');
  const mapHref=studiesToolHref(tools.investmentMap||'/v3/investment-map.html');
  const feasibilityHref=studiesWorkspaceHref('feasibility_studies');
  const fundingHref=studiesToolHref(tools.fundingSources||(lang==='ar'?'/funding-sources.html':'/en/funding-sources.html'));
  shortcuts.innerHTML=
   '<a href="'+escapeHtml(cityHref)+'">'+(lang==='ar'?'مؤشرات المدينة':'City indicators')+'</a>'+
   '<a href="'+escapeHtml(mapHref)+'">'+(lang==='ar'?'الخريطة الاستثمارية':'Investment map')+'</a>'+
   '<a href="'+escapeHtml(feasibilityHref)+'">'+(lang==='ar'?'دراسة الجدوى':'Feasibility study')+'</a>'+
   '<a href="'+escapeHtml(fundingHref)+'">'+(lang==='ar'?'مصادر التمويل':'Funding sources')+'</a>';
 }
 document.querySelectorAll('#studiesWorkspaceNav .studies-workspace-tabs a').forEach(a=>{
  try{
   const code=new URL(a.getAttribute('href'),location.origin).searchParams.get('service');
   if(code) a.setAttribute('href',studiesWorkspaceHref(code));
  }catch(_){}
 });
}
async function studiesCatalogJson(url){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok) throw new Error('HTTP '+response.status);
 return response.json();
}
function studiesLooseMatch(value,token){
 const hay=String(value||'').replace(/^منطقة\s+/,'');
 const needle=String(token||'').replace(/^منطقة\s+/,'');
 return hay===needle||hay.includes(needle)||needle.includes(hay);
}
function studiesMatchRegion(regions,wanted){
 const token=String(wanted||'').trim();
 if(!token) return '';
 const exact=regions.find(row=>row.code===token||row.name_ar===token||row.name_en===token);
 if(exact) return exact.code;
 const loose=regions.find(row=>studiesLooseMatch(row.code,token)||studiesLooseMatch(row.name_ar,token)||studiesLooseMatch(row.name_en,token));
 return loose?loose.code:'';
}
function studiesMatchCity(cities,code,name,region){
 if(code&&cities.some(c=>c.code===code)) return code;
 const label=String(name||'').trim();
 if(label){
  const hit=cities.find(c=>c.code===label||c.name_ar===label||c.name_en===label||studiesLooseMatch(c.name_ar,label));
  if(hit) return hit.code;
 }
 const regionLabel=String(region||'').trim();
 if(regionLabel){
  const hit=cities.find(c=>c.region===regionLabel||c.name_ar===regionLabel||studiesLooseMatch(c.region,regionLabel));
  if(hit) return hit.code;
 }
 return '';
}
async function studiesOnCountry(){
 const countryEl=$('#studiesCountry');
 const country=countryEl?.value||'';
 if(!country){
  studiesFillSelect($('#studiesRegion'),[],'code',studiesCatalogLabel,lang==='ar'?'اختر المنطقة':'Choose region','');
  studiesFillSelect($('#studiesLocality'),[],'code',studiesLocalityLabel,lang==='ar'?'اختر المدينة':'Choose city','');
  studiesFillSelect($('#studiesSector'),[],'code',studiesCatalogLabel,lang==='ar'?'اختر القطاع':'Choose sector','');
  studiesFillSelect($('#studiesActivity'),[],'code',studiesCatalogLabel,lang==='ar'?'اختر النشاط':'Choose activity','');
  studiesWriteLocationToUrl();
  return;
 }
 try{localStorage.setItem('bonds_selected_country',country)}catch(_){}
 const [cityData,taxData]=await Promise.all([
  studiesCatalogJson('/api/v3/catalog/cities?country='+encodeURIComponent(country)),
  studiesCatalogJson('/api/v3/investment-taxonomy?country='+encodeURIComponent(country)+'&include=activities&depth=subsector')
 ]);
 studiesCatalog.cities=cityData.cities||[];
 studiesCatalog.sectors=taxData.sectors||[];
 studiesCatalog.activities=taxData.activities||[];
 const regions=[...new Map(
  studiesCatalog.cities.filter(x=>x.region).map(x=>[x.region,{code:x.region,name_ar:x.region,name_en:x.region_en||x.region}])
 ).values()];
 const wantedRegion=studiesMatchRegion(regions,liveParams().get('region')||liveParams().get('region_name')||$('#studiesRegion')?.value||'');
 const wantedLocality=studiesMatchCity(
  studiesCatalog.cities,
  liveParams().get('locality')||$('#studiesLocality')?.value||'',
  liveParams().get('locality_name')||$('#studiesLocalityName')?.value||'',
  wantedRegion
 );
 const wantedSector=liveParams().get('sector')||$('#studiesSector')?.value||'';
 const wantedActivity=liveParams().get('activity')||$('#studiesActivity')?.value||'';
 studiesFillSelect($('#studiesRegion'),regions,'code',studiesCatalogLabel,lang==='ar'?'اختر المنطقة':'Choose region',wantedRegion);
 studiesFillSelect($('#studiesLocality'),studiesCatalog.cities,'code',studiesLocalityLabel,lang==='ar'?'اختر المدينة':'Choose city',wantedLocality);
 studiesFillSelect($('#studiesSector'),studiesCatalog.sectors,'code',studiesCatalogLabel,lang==='ar'?'اختر القطاع':'Choose sector',wantedSector);
 studiesFillSelect($('#studiesActivity'),studiesCatalog.activities,'code',studiesCatalogLabel,lang==='ar'?'اختر النشاط':'Choose activity',wantedActivity);
 if(wantedRegion && studiesCatalog.cities.some(city=>city.region===wantedRegion)){
  studiesFilterLocalities(wantedRegion,wantedLocality);
 }
 if(wantedSector && studiesCatalog.sectors.some(row=>row.code===wantedSector)) await studiesOnSector(true);
 studiesWriteLocationToUrl();
}
function studiesFilterLocalities(region,selected){
 const matched=region?studiesCatalog.cities.filter(x=>x.region===region||studiesLooseMatch(x.region,region)):studiesCatalog.cities;
 const rows=matched.length?matched:studiesCatalog.cities;
 studiesFillSelect($('#studiesLocality'),rows,'code',studiesLocalityLabel,lang==='ar'?'اختر المدينة':'Choose city',selected||'');
}
async function studiesOnSector(skipUrl){
 const sector=$('#studiesSector')?.value||'';
 const country=$('#studiesCountry')?.value||'';
 if(!sector||!country){
  studiesFillSelect($('#studiesActivity'),studiesCatalog.activities,'code',studiesCatalogLabel,lang==='ar'?'اختر النشاط':'Choose activity',$('#studiesActivity')?.value||'');
  if(!skipUrl) studiesWriteLocationToUrl();
  return;
 }
 const data=await studiesCatalogJson('/api/v3/investment-taxonomy?country='+encodeURIComponent(country)+'&sector='+encodeURIComponent(sector)+'&include=activities&depth=subsector');
 studiesFillSelect($('#studiesActivity'),data.activities||[],'code',studiesCatalogLabel,lang==='ar'?'اختر النشاط':'Choose activity',liveParams().get('activity')||$('#studiesActivity')?.value||'');
 if(!skipUrl) studiesWriteLocationToUrl();
}
function studiesBindCatalogEvents(){
 const country=$('#studiesCountry');
 const region=$('#studiesRegion');
 const locality=$('#studiesLocality');
 const sector=$('#studiesSector');
 const activity=$('#studiesActivity');
 if(!country||country.dataset.studiesBound==='1')return;
 country.dataset.studiesBound='1';
 country.addEventListener('change',()=>{studiesOnCountry().catch(()=>{})});
 region?.addEventListener('change',()=>{
  studiesFilterLocalities(region.value,$('#studiesLocality')?.value||'');
  studiesWriteLocationToUrl();
 });
 locality?.addEventListener('change',studiesWriteLocationToUrl);
 sector?.addEventListener('change',()=>{studiesOnSector(false).catch(()=>{})});
 activity?.addEventListener('change',studiesWriteLocationToUrl);
}
function studiesPullDiscovery(){
 if(studiesCatalogLock)return;
 const country=$('#bondsCountry')?.value||'';
 const studiesCountry=$('#studiesCountry');
 if(!studiesCountry||!country)return;
 studiesCatalogLock=true;
 const apply=async()=>{
  try{
   if(studiesCountry.value!==country){
    studiesCountry.value=country;
    studiesEnhanceSelect(studiesCountry,lang==='ar'?'اختر الدولة':'Choose country',true);
    await studiesOnCountry();
   }
   const region=$('#bondsRegion')?.value||'';
   const locality=$('#bondsLocality')?.value||'';
   const sector=$('#bondsSector')?.value||'';
   const activity=$('#bondsActivity')?.value||'';
   if(region&&$('#studiesRegion')){
    $('#studiesRegion').value=region;
    studiesFilterLocalities(region,locality);
   }
   if(locality&&$('#studiesLocality')) $('#studiesLocality').value=locality;
   if(sector&&$('#studiesSector')&&$('#studiesSector').value!==sector){
    $('#studiesSector').value=sector;
    await studiesOnSector(true);
   }
   if(activity&&$('#studiesActivity')) $('#studiesActivity').value=activity;
   studiesWriteLocationToUrl();
  }finally{studiesCatalogLock=false}
 };
 apply().catch(()=>{studiesCatalogLock=false});
}
function studiesListenDiscovery(){
 ['bondsCountry','bondsRegion','bondsLocality','bondsSector','bondsActivity'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el||el.dataset.studiesBridge==='1')return;
  el.dataset.studiesBridge='1';
  el.addEventListener('change',studiesPullDiscovery);
 });
}
function enhanceStudiesStaticSelects(){
 const host=$('#srDynamicFields');
 if(!host)return;
 host.querySelectorAll('select[name="research_type"],select[name="methodology"],select[name="time_horizon"],select[name="risk_scope"]').forEach(el=>{
  if(!el.id) el.id='studiesField_'+el.name;
  studiesEnhanceSelect(el,el.options[0]?.textContent||'',false);
 });
}
function bindStudiesCatalogDropdowns(){
 if(!isStudiesWorkspaceService()||!$('#studiesCountry'))return;
 studiesBindCatalogEvents();
 studiesListenDiscovery();
 enhanceStudiesStaticSelects();
 const start=async()=>{
  try{
   const data=await studiesCatalogJson('/api/v3/catalog/countries');
   studiesCatalog.countries=data.countries||[];
   const wanted=liveParams().get('country')||$('#studiesCountry').value||localStorage.getItem('bonds_selected_country')||'SA';
   studiesFillSelect($('#studiesCountry'),studiesCatalog.countries,'code',studiesCatalogLabel,lang==='ar'?'اختر الدولة':'Choose country',wanted);
   await studiesOnCountry();
   studiesCatalogBound=true;
   studiesListenDiscovery();
  }catch(_){
   enhanceStudiesStaticSelects();
  }
 };
 if(window.UniversalDropdown) start();
 else{
  const existing=document.querySelector('script[src*="universal-dropdown.js"]');
  if(existing) existing.addEventListener('load',start,{once:true});
  else{
   const wait=setInterval(()=>{
    if(!window.UniversalDropdown)return;
    clearInterval(wait);
    start();
   },50);
   setTimeout(()=>clearInterval(wait),8000);
  }
 }
}
function applyStudiesSubmitLabel(){
 const btn=$('#srSubmit');
 if(!btn||!isStudiesWorkspaceService())return;
 const labels={
  market_research:[ 'شغّل تحليل السوق','Run market analysis'],
  scientific_research:['شغّل البحث العلمي','Run scientific research'],
  feasibility_studies:['شغّل دراسة الجدوى','Run feasibility study'],
  risk_analysis:['شغّل تحليل المخاطر','Run risk analysis']
 };
 const pair=labels[serviceCode];
 if(pair) btn.textContent=lang==='ar'?pair[0]:pair[1];
}
function renderStudiesOperationalInputs(){
 if(!isStudiesWorkspaceService())return false;
 const host=$('#srDynamicFields');
 if(!host)return false;
 if(host.querySelector('[name="research_question"],[name="research_problem"],[name="project_brief"],[name="risk_question"]')){
  applyStudiesSubmitLabel();
  return false;
 }
 const req=' <small>('+T.required+')</small>';
 const opt=' <small>('+T.optional+')</small>';
 const locationFields=studiesLocationFieldsHtml();
 if(serviceCode==='market_research'){
  $('#srFormTitle').textContent=lang==='ar'?'موجز الدراسة السوقية':'Market research brief';
  host.innerHTML=locationFields+
   '<div class="sr-field full"><label>'+(lang==='ar'?'سؤال الدراسة / السوق المستهدف':'Research question / target market')+req+'</label><textarea name="research_question" required placeholder="'+escapeHtml(lang==='ar'?'مثال: حجم الطلب والمنافسة لمطعم وجبات سريعة في هذا الموقع':'e.g. demand and competition for a QSR restaurant in this location')+'"></textarea></div>'+
   '<div class="sr-field"><label>'+(lang==='ar'?'العميل المستهدف':'Target customer')+opt+'</label><input type="text" name="target_customer" placeholder="'+escapeHtml(lang==='ar'?'أسر، شركات، سياح...':'families, corporates, tourists...')+'"></div>'+
   '<div class="sr-field"><label>'+(lang==='ar'?'أفق الدراسة':'Time horizon')+opt+'</label><select name="time_horizon"><option value="12">'+(lang==='ar'?'12 شهر':'12 months')+'</option><option value="36" selected>'+(lang==='ar'?'3 سنوات':'3 years')+'</option><option value="60">'+(lang==='ar'?'5 سنوات':'5 years')+'</option></select></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'المنافسون المعروفون':'Known competitors')+opt+'</label><textarea name="competitors" placeholder="'+escapeHtml(lang==='ar'?'أسماء المنافسين أو نوعهم':'competitor names or types')+'"></textarea></div>';
 }
 else if(serviceCode==='scientific_research'){
  $('#srFormTitle').textContent=lang==='ar'?'موجز البحث العلمي':'Scientific research brief';
  host.innerHTML=
   '<div class="sr-field full"><label>'+(lang==='ar'?'عنوان البحث':'Research title')+req+'</label><input type="text" name="research_title" required placeholder="'+escapeHtml(lang==='ar'?'عنوان واضح لمشكلة البحث':'a clear title for the research problem')+'"></div>'+
   locationFields+
   '<div class="sr-field"><label>'+(lang==='ar'?'نوع البحث':'Research type')+req+'</label><select name="research_type" required>'+
    '<option value="applied">'+(lang==='ar'?'تطبيقي':'Applied')+'</option>'+
    '<option value="descriptive">'+(lang==='ar'?'وصفي':'Descriptive')+'</option>'+
    '<option value="experimental">'+(lang==='ar'?'تجريبي':'Experimental')+'</option>'+
    '<option value="literature">'+(lang==='ar'?'مراجعة أدبية':'Literature review')+'</option>'+
    '<option value="mixed" selected>'+(lang==='ar'?'مختلط':'Mixed')+'</option>'+
   '</select></div>'+
   '<div class="sr-field"><label>'+(lang==='ar'?'المنهجية':'Methodology')+req+'</label><select name="methodology" required>'+
    '<option value="quantitative">'+(lang==='ar'?'كمية':'Quantitative')+'</option>'+
    '<option value="qualitative">'+(lang==='ar'?'نوعية':'Qualitative')+'</option>'+
    '<option value="mixed" selected>'+(lang==='ar'?'مختلطة':'Mixed')+'</option>'+
   '</select></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'مشكلة البحث / الأسئلة':'Research problem / questions')+req+'</label><textarea name="research_problem" required placeholder="'+escapeHtml(lang==='ar'?'ما السؤال العلمي وما حدود الدراسة؟':'What is the scientific question and the study boundary?')+'"></textarea></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'الفرضية':'Hypothesis')+opt+'</label><textarea name="hypothesis" placeholder="'+escapeHtml(lang==='ar'?'الفرضية الرئيسية إن وجدت':'the main hypothesis if any')+'"></textarea></div>'+
   '<div class="sr-field"><label>'+(lang==='ar'?'المجتمع والعينة':'Population & sample')+opt+'</label><input type="text" name="population_sample"></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'مصادر البيانات والأدلة':'Data sources & evidence')+opt+'</label><textarea name="data_sources" placeholder="'+escapeHtml(lang==='ar'?'دراسات سابقة، بيانات رسمية، تجارب، مقابلات...':'prior studies, official data, experiments, interviews...')+'"></textarea></div>';
 }
 else if(serviceCode==='feasibility_studies'){
  $('#srFormTitle').textContent=lang==='ar'?'مدخلات دراسة الجدوى':'Feasibility study inputs';
  host.innerHTML=
   '<div class="sr-field"><label>'+(lang==='ar'?'اسم المشروع':'Project name')+req+'</label><input type="text" name="project_name" required></div>'+
   locationFields+
   '<div class="sr-field"><label>'+(lang==='ar'?'حجم الاستثمار المتوقع':'Expected investment')+opt+'</label><input type="number" name="investment_amount" min="0" step="any"></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'وصف المشروع':'Project brief')+req+'</label><textarea name="project_brief" required></textarea></div>';
 }
 else if(serviceCode==='risk_analysis'){
  $('#srFormTitle').textContent=lang==='ar'?'نطاق تحليل المخاطر':'Risk analysis scope';
  host.innerHTML=locationFields+
   '<div class="sr-field"><label>'+(lang==='ar'?'نطاق المخاطر':'Risk scope')+req+'</label><select name="risk_scope" required><option value="market">'+(lang==='ar'?'سوقية':'Market')+'</option><option value="operational">'+(lang==='ar'?'تشغيلية':'Operational')+'</option><option value="financial">'+(lang==='ar'?'مالية':'Financial')+'</option><option value="combined" selected>'+(lang==='ar'?'متكاملة':'Combined')+'</option></select></div>'+
   '<div class="sr-field"><label>'+(lang==='ar'?'أفق التحليل':'Time horizon')+opt+'</label><select name="time_horizon"><option value="12">'+(lang==='ar'?'12 شهر':'12 months')+'</option><option value="36" selected>'+(lang==='ar'?'3 سنوات':'3 years')+'</option><option value="60">'+(lang==='ar'?'5 سنوات':'5 years')+'</option></select></div>'+
   '<div class="sr-field full"><label>'+(lang==='ar'?'سؤال المخاطر':'Risk question')+req+'</label><textarea name="risk_question" required></textarea></div>';
 }
 applyStudiesSubmitLabel();
 return true;
}
function renderStudiesExecution(result){
 if(!isStudiesWorkspaceService()||!result||typeof result!=='object')return '';
 const summary=result.summary||result.executive_summary||result.narrative||result.analysis;
 const findings=result.findings||result.insights||result.recommendations||result.competitors;
 const parts=[];
 if(typeof summary==='string'&&summary.trim()){
  parts.push('<section class="financial-result-section"><h3>'+(lang==='ar'?'ملخص الدراسة':'Study summary')+'</h3><div class="studies-result-copy">'+escapeHtml(summary)+'</div></section>');
 }
 if(Array.isArray(findings)&&findings.length){
  if(typeof findings[0]==='string'){
   parts.push('<section class="financial-result-section"><h3>'+(lang==='ar'?'النتائج':'Findings')+'</h3><ul class="sr-list">'+findings.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></section>');
  }else if(typeof findings[0]==='object'){
   parts.push('<section class="financial-result-section"><h3>'+(lang==='ar'?'النتائج':'Findings')+'</h3>'+renderFinancialRows(findings)+'</section>');
  }
 }
 return parts.length?'<div class="financial-result-stack studies-result-stack">'+parts.join('')+'</div>':'';
}
function renderFinancialWorkspaceShell(){
 if(!isFinancialWorkspaceService())return;
 document.body.classList.add('financial-workspace-mode');
 if($('#financialWorkspaceNav'))return;
 const grid=document.querySelector('.sr-grid');
 if(!grid)return;
 const shell=document.createElement('section');
 shell.id='financialWorkspaceNav';
 shell.className='financial-workspace-shell';
 const title=lang==='ar'?'مساحة العمل المالية والمحاسبية':'Financial & Accounting Workspace';
 const desc=lang==='ar'
  ?'إعداد الموازنات والقوائم المالية والتوقعات من مساحة تنفيذ واحدة، مع إبقاء كل خدمة مرتبطة بمحركها المعتمد.'
  :'Prepare budgets, financial statements and forecasts in one execution workspace while preserving each governed service engine.';
 const actualBudget=lang==='ar'?'الفعلي مقابل الموازنة':'Actual vs budget';
 const forecast=lang==='ar'?'التوقع المالي':'Forecast';
 shell.innerHTML='<div class="financial-workspace-head"><div><span class="financial-workspace-kicker">'+
  (lang==='ar'?'تنفيذ مالي مباشر':'Direct financial execution')+
  '</span><h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(desc)+'</p></div>'+
  '<span class="financial-workspace-state">'+(lang==='ar'?'الخدمة الحالية':'Current service')+': '+escapeHtml(text(detail?.service))+'</span></div>'+
  '<nav class="financial-workspace-tabs" aria-label="'+escapeHtml(title)+'">'+
  FINANCIAL_WORKSPACE_TABS.map(([code,ar,en])=>'<a class="financial-workspace-tab'+(serviceCode===code?' active':'')+'" href="'+
   escapeHtml(financialWorkspaceHref(code))+'"'+(serviceCode===code?' aria-current="page"':'')+'>'+escapeHtml(lang==='ar'?ar:en)+'</a>').join('')+
  '</nav>'+
  '<div class="financial-workspace-shortcuts">'+
   '<a href="'+escapeHtml(financialWorkspaceHref('planning_budgeting_forecasting'))+'">'+escapeHtml(actualBudget)+'</a>'+
   '<a href="'+escapeHtml(financialWorkspaceHref('planning_budgeting_forecasting'))+'">'+escapeHtml(forecast)+'</a>'+
  '</div>';
 grid.insertAdjacentElement('beforebegin',shell);
}
const ACCOUNTING_REPORT_WORKSPACE_SERVICES=new Set([
 'financial_statements','income_statement','statement_financial_position',
 'cash_flow_statement','changes_in_equity'
]);
function financialFieldLabel(key){
 const labels={
  accounting_entity_id:lang==='ar'?'الكيان المحاسبي':'Accounting entity',
  from:lang==='ar'?'من تاريخ':'From',
  to:lang==='ar'?'إلى تاريخ':'To',
  as_of:lang==='ar'?'كما في تاريخ':'As of',
  dimension_type:lang==='ar'?'نوع البعد التحليلي':'Analysis dimension',
  dimension_code:lang==='ar'?'رمز البعد':'Dimension code',
  fiscal_year:lang==='ar'?'السنة المالية':'Fiscal year',
  currency:lang==='ar'?'العملة':'Currency',
  materiality_pct:lang==='ar'?'حد الأهمية النسبية %':'Materiality threshold %'
 };
 return labels[key]||humanizeKey(key);
}
function accountingReportNeedsDimension(){
 return ['income_statement','statement_financial_position','cash_flow_statement'].includes(serviceCode);
}
function accountingReportNeedsRange(){
 return ['financial_statements','cash_flow_statement','changes_in_equity'].includes(serviceCode);
}
function renderAccountingReportInputs(){
 const host=$('#srDynamicFields');
 if(!host||!ACCOUNTING_REPORT_WORKSPACE_SERVICES.has(serviceCode))return false;
 const dimension=accountingReportNeedsDimension();
 const range=accountingReportNeedsRange();
 const asOf=serviceCode==='statement_financial_position';
 host.innerHTML=
  '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('accounting_entity_id'))+' <small>('+T.required+')</small></label>'+
   '<select name="accounting_entity_id" id="financialAccountingEntity" required><option value="">'+
   escapeHtml(lang==='ar'?'جاري تحميل الكيانات...':'Loading entities...')+'</option></select></div>'+
  (dimension?'<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('dimension_type'))+' <small>('+T.required+')</small></label>'+
   '<select name="dimension_type" required><option value="cost_center">'+(lang==='ar'?'مركز تكلفة':'Cost center')+'</option>'+
   '<option value="segment">'+(lang==='ar'?'قطاع / شريحة':'Segment')+'</option></select></div>'+
   '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('dimension_code'))+' <small>('+T.optional+')</small></label>'+
   '<input type="text" name="dimension_code" placeholder="'+escapeHtml(lang==='ar'?'اتركه فارغًا لإظهار جميع الأبعاد':'Leave blank for all dimensions')+'"></div>':'')+
  (range?'<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('from'))+' <small>('+T.required+')</small></label><input type="date" name="from" required></div>'+
   '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('to'))+' <small>('+T.required+')</small></label><input type="date" name="to" required></div>':'')+
  (asOf?'<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('as_of'))+' <small>('+T.optional+')</small></label><input type="date" name="as_of"></div>':'');
 $('#srFormTitle').textContent=lang==='ar'?'بيانات إعداد القائمة المالية':'Financial statement inputs';
 return true;
}
function budgetMetricRow(data={}){
 const status=String(data.status||'actual');
 return '<div class="financial-budget-row" data-budget-row>'+
  '<input data-budget-period type="month" value="'+escapeHtml(data.period||'')+'" aria-label="'+escapeHtml(lang==='ar'?'الفترة':'Period')+'" required>'+
  '<select data-budget-status aria-label="'+escapeHtml(lang==='ar'?'الحالة':'Status')+'"><option value="actual"'+(status==='actual'?' selected':'')+'>'+(lang==='ar'?'فعلي':'Actual')+'</option><option value="forecast"'+(status==='forecast'?' selected':'')+'>'+(lang==='ar'?'توقع':'Forecast')+'</option></select>'+
  '<input data-budget-metric type="text" value="'+escapeHtml(data.metric||'revenue')+'" aria-label="'+escapeHtml(lang==='ar'?'البند':'Metric')+'" required>'+
  '<input data-budget-actual type="number" step="any" value="'+escapeHtml(data.actual||'')+'" placeholder="'+escapeHtml(lang==='ar'?'الفعلي':'Actual')+'">'+
  '<input data-budget-budget type="number" step="any" value="'+escapeHtml(data.budget||'')+'" placeholder="'+escapeHtml(lang==='ar'?'الموازنة':'Budget')+'">'+
  '<input data-budget-forecast type="number" step="any" value="'+escapeHtml(data.forecast||'')+'" placeholder="'+escapeHtml(lang==='ar'?'التوقع':'Forecast')+'">'+
  '<button type="button" class="financial-budget-remove" data-budget-remove aria-label="'+escapeHtml(lang==='ar'?'حذف الصف':'Remove row')+'">×</button>'+
 '</div>';
}
let budgetReference=null;
let governedBudgetPlanId=null;
let governedBudgetVersionId=null;
function governedBudgetRequestKey(action){
 const id=window.crypto?.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
 return 'budget:'+action+':'+id;
}
function governedBudgetLineRow(data={}){
 const periods=budgetReference?.periods||[];
 const accounts=budgetReference?.accounts||[];
 const dimensions=budgetReference?.dimensions||[];
 const periodOptions=periods.map(p=>'<option value="'+escapeHtml(p.id)+'"'+(data.period_id===p.id?' selected':'')+'>'+escapeHtml(p.period_code)+' · '+escapeHtml(p.starts_on)+' — '+escapeHtml(p.ends_on)+'</option>').join('');
 const accountOptions=accounts.map(a=>'<option value="'+escapeHtml(a.id)+'"'+(data.account_id===a.id?' selected':'')+'>'+escapeHtml(a.code)+' — '+escapeHtml(a.name)+'</option>').join('');
 const costCenters=dimensions.filter(d=>d.dimension_type==='cost_center').map(d=>'<option value="'+escapeHtml(d.code)+'"'+(data.cost_center===d.code?' selected':'')+'>'+escapeHtml(d.code)+' — '+escapeHtml(d.name)+'</option>').join('');
 const segments=dimensions.filter(d=>d.dimension_type==='segment').map(d=>'<option value="'+escapeHtml(d.code)+'"'+(data.segment===d.code?' selected':'')+'>'+escapeHtml(d.code)+' — '+escapeHtml(d.name)+'</option>').join('');
 return '<div class="financial-governance-line" data-governance-line>'+
  '<select data-governance-period required><option value="">'+escapeHtml(lang==='ar'?'الفترة':'Period')+'</option>'+periodOptions+'</select>'+
  '<select data-governance-account required><option value="">'+escapeHtml(lang==='ar'?'الحساب':'Account')+'</option>'+accountOptions+'</select>'+
  '<input data-governance-amount type="number" step="0.01" value="'+escapeHtml(data.amount||'')+'" placeholder="'+escapeHtml(lang==='ar'?'المبلغ':'Amount')+'" required>'+
  '<select data-governance-cost-center><option value="">'+escapeHtml(lang==='ar'?'مركز التكلفة (اختياري)':'Cost center (optional)')+'</option>'+costCenters+'</select>'+
  '<select data-governance-segment><option value="">'+escapeHtml(lang==='ar'?'القطاع (اختياري)':'Segment (optional)')+'</option>'+segments+'</select>'+
  '<button type="button" class="financial-budget-remove" data-governance-remove aria-label="'+escapeHtml(lang==='ar'?'حذف السطر':'Remove line')+'">×</button>'+
 '</div>';
}
function setGovernedBudgetState(payload={}){
 if(payload.budget_plan_id)governedBudgetPlanId=payload.budget_plan_id;
 if(payload.budget_version_id)governedBudgetVersionId=payload.budget_version_id;
 const planContext=$('#financialBudgetPlanIdContext');
 const versionContext=$('#financialBudgetVersionIdContext');
 if(planContext)planContext.value=governedBudgetPlanId||'';
 if(versionContext)versionContext.value=governedBudgetVersionId||'';
 const status=$('#financialBudgetGovernanceStatus');
 if(status){
  const state=payload.status||payload.state||'—';
  status.textContent=(lang==='ar'?'الحالة: ':'Status: ')+state+
   (governedBudgetPlanId?' · '+(lang==='ar'?'الخطة ':'Plan ')+governedBudgetPlanId.slice(0,8):'')+
   (governedBudgetVersionId?' · '+(lang==='ar'?'النسخة ':'Version ')+governedBudgetVersionId.slice(0,8):'');
 }
 saveWorkspaceDraft();
}
async function governedCapability(action,input){
 await window.BondsAuth.ensureEnv();
 const sb=window.BondsAuth.getSupabase();
 const session=(await sb.auth.getSession()).data.session;
 if(!session?.access_token)throw new Error(T.login);
 const response=await fetch('/api/v3/capabilities/execute',{
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action,input})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload.ok!==true)throw new Error(payload?.error?.code||payload?.code||('HTTP '+response.status));
 return payload.result||payload;
}
function collectGovernedBudgetLines(){
 const policies=budgetReference?.dimension_policies||[];
 const lines=[];
 document.querySelectorAll('[data-governance-line]').forEach(row=>{
  const period_id=row.querySelector('[data-governance-period]')?.value||'';
  const account_id=row.querySelector('[data-governance-account]')?.value||'';
  const amountRaw=row.querySelector('[data-governance-amount]')?.value;
  if(!period_id&&!account_id&&amountRaw==='')return;
  if(!period_id||!account_id||amountRaw==='')throw new Error(lang==='ar'?'أكمل الفترة والحساب والمبلغ لكل سطر':'Complete period, account and amount for each line');
  const dimensions={};
  const costCenter=row.querySelector('[data-governance-cost-center]')?.value||'';
  const segment=row.querySelector('[data-governance-segment]')?.value||'';
  if(costCenter)dimensions.cost_center=costCenter;
  if(segment)dimensions.segment=segment;
  for(const policy of policies.filter(p=>p.account_id===account_id&&p.required===true)){
   if(!dimensions[policy.dimension_type]){
    throw new Error((lang==='ar'?'البعد الإلزامي غير محدد: ':'Required dimension missing: ')+policy.dimension_type);
   }
  }
  lines.push({period_id,account_id,amount:Number(amountRaw),dimensions});
 });
 if(!lines.length)throw new Error(lang==='ar'?'أضف سطر موازنة واحدًا على الأقل':'Add at least one budget line');
 return lines;
}
async function loadBudgetReference(accountingEntityId){
 if(!accountingEntityId)return;
 await window.BondsAuth.ensureEnv();
 const sb=window.BondsAuth.getSupabase();
 const session=(await sb.auth.getSession()).data.session;
 if(!session?.access_token)throw new Error(T.login);
 const response=await fetch('/api/v3/services/accounting/budget-reference?accounting_entity_id='+encodeURIComponent(accountingEntityId),{
  headers:{'Authorization':'Bearer '+session.access_token}
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload.ok!==true)throw new Error(payload?.error?.code||('HTTP '+response.status));
 budgetReference=payload;
 const currency=$('#financialBudgetCurrency');
 if(currency&&payload.accounting_entity?.base_currency)currency.value=payload.accounting_entity.base_currency;
 const rows=$('#financialGovernanceLines');
 const periodInit=$('#financialPeriodInitialize');
 const yearPolicy=payload.year_end_policy||null;
 const retainedSelect=$('#financialRetainedEarningsAccount');
 if(retainedSelect){
  const equity=(payload.accounts||[]).filter(a=>a.account_type==='equity'&&a.is_active!==false&&a.is_postable!==false);
  retainedSelect.innerHTML='<option value="">'+escapeHtml(lang==='ar'?'اختر حساب الأرباح المبقاة':'Select retained earnings account')+'</option>'+
   equity.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.code+' — '+a.name)+'</option>').join('');
  if(yearPolicy?.retained_earnings_account_id)retainedSelect.value=yearPolicy.retained_earnings_account_id;
 }
 if(periodInit)periodInit.hidden=!yearPolicy;
 if(rows)rows.innerHTML=(payload.periods||[]).length?governedBudgetLineRow():'<div class="sr-muted">'+escapeHtml(lang==='ar'?'لا توجد فترات محاسبية. حدد بداية ونهاية السنة ثم هيئ الفترات الشهرية.':'No accounting periods exist. Set fiscal start/end and initialize monthly periods.')+'</div>';
 const role=payload.accounting_entity?.role;
 document.querySelectorAll('[data-budget-transition="approve"],[data-budget-transition="reject"]').forEach(btn=>{btn.disabled=!['owner','admin'].includes(role)});
 const range=payload.periods||[];
 if(range.length){
  const first=range[0],last=range[range.length-1];
  const starts=$('#financialFiscalStart'),ends=$('#financialFiscalEnd'),actual=$('#financialActualThrough');
  if(starts&&!starts.value)starts.value=first.starts_on||'';
  if(ends&&!ends.value)ends.value=last.ends_on||'';
  if(actual&&!actual.value)actual.value=last.ends_on||'';
 }
}
async function createRetainedEarningsAccount(){
 const entityId=$('#financialAccountingEntity')?.value||'';
 const code=String($('#financialEquityAccountCode')?.value||'').trim();
 const name=String($('#financialEquityAccountName')?.value||'').trim();
 if(!entityId)throw new Error(lang==='ar'?'اختر الكيان المحاسبي':'Select an accounting entity');
 if(!code||!name)throw new Error(lang==='ar'?'أدخل رمز واسم حساب حقوق الملكية':'Enter the equity account code and name');
 const result=await governedCapability('accounting_account_create',{
  accounting_entity_id:entityId,
  code,
  name,
  account_type:'equity',
  is_postable:true,
  is_active:true
 });
 await loadBudgetReference(entityId);
 if(result?.account?.id&&$('#financialRetainedEarningsAccount'))$('#financialRetainedEarningsAccount').value=result.account.id;
 showStatus(lang==='ar'?'تم إنشاء حساب حقوق الملكية':'Equity account created',true);
}

async function saveFiscalYearPolicy(){
 const entityId=$('#financialAccountingEntity')?.value||'';
 const retainedId=$('#financialRetainedEarningsAccount')?.value||'';
 const endsOn=$('#financialFiscalEnd')?.value||'';
 if(!entityId)throw new Error(lang==='ar'?'اختر الكيان المحاسبي':'Select an accounting entity');
 if(!retainedId)throw new Error(lang==='ar'?'اختر حساب الأرباح المبقاة':'Select retained earnings account');
 if(!endsOn)throw new Error(lang==='ar'?'حدد نهاية السنة المالية':'Set fiscal year end');
 const end=new Date(endsOn+'T00:00:00Z');
 if(Number.isNaN(end.getTime()))throw new Error(lang==='ar'?'تاريخ نهاية السنة غير صالح':'Invalid fiscal year end');
 await governedCapability('accounting_year_end_policy_configure',{
  accounting_entity_id:entityId,
  retained_earnings_account_id:retainedId,
  fiscal_year_end_month:end.getUTCMonth()+1,
  fiscal_year_end_day:end.getUTCDate(),
  status:'active',
  metadata:{source:'planning_budgeting_workspace'}
 });
 await loadBudgetReference(entityId);
 showStatus(lang==='ar'?'تم حفظ سياسة السنة المالية':'Fiscal year policy saved',true);
}

async function initializeAccountingPeriods(){
 const entityId=$('#financialAccountingEntity')?.value||'';
 const startsOn=$('#financialFiscalStart')?.value||'';
 const endsOn=$('#financialFiscalEnd')?.value||'';
 if(!entityId)throw new Error(lang==='ar'?'اختر الكيان المحاسبي':'Select an accounting entity');
 if(!startsOn||!endsOn)throw new Error(lang==='ar'?'حدد بداية ونهاية السنة المالية':'Set fiscal year start and end');
 const policy=budgetReference?.year_end_policy;
 if(!policy)throw new Error(lang==='ar'?'احفظ سياسة السنة المالية أولًا':'Save the fiscal year policy first');
 const end=new Date(endsOn+'T00:00:00Z');
 if(end.getUTCMonth()+1!==Number(policy.fiscal_year_end_month)||end.getUTCDate()!==Number(policy.fiscal_year_end_day)){
  throw new Error(lang==='ar'?'نهاية السنة لا تطابق السياسة المحفوظة':'Fiscal year end does not match the saved policy');
 }
 const result=await governedCapability('accounting_period_initialize_monthly',{
  accounting_entity_id:entityId,
  starts_on:startsOn,
  ends_on:endsOn
 });
 await loadBudgetReference(entityId);
 showStatus((lang==='ar'?'تمت تهيئة الفترات المحاسبية: ':'Accounting periods initialized: ')+(result.period_count||0),true);
}

async function handleBudgetGovernanceAction(action){
 const entityId=$('#financialAccountingEntity')?.value||'';
 if(!entityId)throw new Error(lang==='ar'?'اختر الكيان المحاسبي':'Select an accounting entity');
 if(action==='create'){
  const result=await governedCapability('accounting_budget_plan_create',{
   accounting_entity_id:entityId,
   code:String($('#financialBudgetPlanCode')?.value||'').trim(),
   name:String($('#financialBudgetPlanName')?.value||'').trim(),
   plan_type:$('#financialBudgetPlanType')?.value||'budget',
   fiscal_year_start:$('#financialFiscalStart')?.value||'',
   fiscal_year_end:$('#financialFiscalEnd')?.value||'',
   currency:String($('#financialBudgetCurrency')?.value||'').trim().toUpperCase(),
   request_key:governedBudgetRequestKey('create')
  });
  setGovernedBudgetState(result);
  showStatus(lang==='ar'?'تم إنشاء خطة الموازنة كمسودة':'Budget plan created as draft',true);
  return;
 }
 if(action==='save'){
  if(!governedBudgetVersionId)throw new Error(lang==='ar'?'أنشئ الخطة أولًا':'Create the plan first');
  const result=await governedCapability('accounting_budget_draft_save',{
   accounting_entity_id:entityId,
   budget_version_id:governedBudgetVersionId,
   lines:collectGovernedBudgetLines(),
   request_key:governedBudgetRequestKey('save')
  });
  setGovernedBudgetState(result);
  showStatus(lang==='ar'?'تم حفظ مسودة الموازنة':'Budget draft saved',true);
  return;
 }
 if(action==='analyze'){
  if(!governedBudgetPlanId)throw new Error(lang==='ar'?'لا توجد خطة موازنة محددة':'No budget plan selected');
  const result=await governedCapability('accounting_budget_analysis',{
   accounting_entity_id:entityId,
   budget_plan_id:governedBudgetPlanId,
   actual_through:$('#financialActualThrough')?.value||'',
   use_budget_as_forecast:$('#financialUseBudgetForecast')?.checked===true,
   materiality_pct:Number($('#financialBudgetMateriality')?.value||0),
   metric_directions:{}
  });
  renderExecutionResult({result:result.analysis||result});
  showStatus(lang==='ar'?'تم تحليل الفعلي مقابل الموازنة':'Actual vs budget analysis completed',true);
  return;
 }
 if(!governedBudgetVersionId)throw new Error(lang==='ar'?'لا توجد نسخة موازنة محددة':'No budget version selected');
 const reason=String($('#financialBudgetReason')?.value||'').trim()||null;
 const result=await governedCapability('accounting_budget_version_transition',{
  accounting_entity_id:entityId,
  budget_version_id:governedBudgetVersionId,
  action,
  reason,
  request_key:governedBudgetRequestKey(action)
 });
 setGovernedBudgetState(result);
 showStatus((lang==='ar'?'تم تنفيذ إجراء الموازنة: ':'Budget action completed: ')+action,true);
}
function renderPlanningBudgetInputs(){
 const host=$('#srDynamicFields');
 if(!host||serviceCode!=='planning_budgeting_forecasting')return false;
 const year=new Date().getFullYear();
 host.innerHTML=
  '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('accounting_entity_id'))+' <small>('+T.required+')</small></label><select name="accounting_entity_id" id="financialAccountingEntity" required><option value="">'+escapeHtml(lang==='ar'?'جاري تحميل الكيانات...':'Loading entities...')+'</option></select></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'رمز الخطة':'Plan code')+' <small>('+T.required+')</small></label><input id="financialBudgetPlanCode" type="text" value="BUDGET-'+year+'" maxlength="64"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'اسم الخطة':'Plan name')+' <small>('+T.required+')</small></label><input id="financialBudgetPlanName" type="text" value="'+escapeHtml(lang==='ar'?'موازنة '+year:'Budget '+year)+'" maxlength="200"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'نوع الخطة':'Plan type')+'</label><select id="financialBudgetPlanType"><option value="budget">'+(lang==='ar'?'موازنة':'Budget')+'</option><option value="forecast">'+(lang==='ar'?'توقع':'Forecast')+'</option></select></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'بداية السنة المالية':'Fiscal year start')+' <small>('+T.required+')</small></label><input id="financialFiscalStart" type="date"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'نهاية السنة المالية':'Fiscal year end')+' <small>('+T.required+')</small></label><input id="financialFiscalEnd" type="date"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('currency'))+' <small>('+T.required+')</small></label><input id="financialBudgetCurrency" type="text" name="currency" value="SAR" maxlength="3" readonly></div>'+
  '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('materiality_pct'))+' <small>('+T.optional+')</small></label><input id="financialBudgetMateriality" type="number" min="0" step="0.1" name="materiality_pct" value="5"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'الفترة الفعلية حتى':'Actual through')+'</label><input id="financialActualThrough" type="date"></div>'+
  '<input id="financialBudgetPlanIdContext" type="hidden" value="">'+
  '<input id="financialBudgetVersionIdContext" type="hidden" value="">'+
  '<div class="sr-field"><label class="sr-check"><input id="financialUseBudgetForecast" type="checkbox" name="use_budget_as_forecast"> '+escapeHtml(lang==='ar'?'استخدم الموازنة كتوقع عند غياب توقع معتمد':'Use budget as forecast when no approved forecast exists')+'</label></div>'+
  '<div class="sr-field full financial-governance-panel"><div class="financial-budget-builder-head"><div><h3>'+escapeHtml(lang==='ar'?'حوكمة الموازنة':'Budget governance')+'</h3><p>'+escapeHtml(lang==='ar'?'خطة محكومة مرتبطة بالفترات والحسابات الفعلية في دفتر الأستاذ.':'Governed plan linked to real accounting periods and ledger accounts.')+'</p></div><strong id="financialBudgetGovernanceStatus">'+escapeHtml(lang==='ar'?'الحالة: لم تُنشأ خطة':'Status: no plan created')+'</strong></div>'+
  '<div class="sr-field full"><h4>'+escapeHtml(lang==='ar'?'إعداد السنة المالية':'Fiscal year setup')+'</h4></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'حساب الأرباح المبقاة':'Retained earnings account')+'</label><select id="financialRetainedEarningsAccount"><option value="">'+escapeHtml(lang==='ar'?'اختر الحساب':'Select account')+'</option></select></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'رمز حساب حقوق ملكية جديد':'New equity account code')+'</label><input id="financialEquityAccountCode" type="text" maxlength="64" placeholder="3200"></div>'+
  '<div class="sr-field"><label>'+escapeHtml(lang==='ar'?'اسم حساب حقوق ملكية جديد':'New equity account name')+'</label><input id="financialEquityAccountName" type="text" maxlength="200" placeholder="'+escapeHtml(lang==='ar'?'الأرباح المبقاة':'Retained Earnings')+'"></div>'+
  '<div class="financial-governance-actions"><button type="button" id="financialEquityAccountCreate">'+escapeHtml(lang==='ar'?'إنشاء حساب حقوق ملكية':'Create equity account')+'</button><button type="button" id="financialYearEndPolicySave">'+escapeHtml(lang==='ar'?'حفظ سياسة السنة المالية':'Save fiscal year policy')+'</button><button type="button" id="financialPeriodInitialize" hidden>'+escapeHtml(lang==='ar'?'تهيئة الفترات الشهرية':'Initialize monthly periods')+'</button><button type="button" data-budget-governance="create">'+escapeHtml(lang==='ar'?'إنشاء خطة':'Create plan')+'</button><button type="button" data-budget-governance="save">'+escapeHtml(lang==='ar'?'حفظ المسودة':'Save draft')+'</button><button type="button" data-budget-transition="submit">'+escapeHtml(lang==='ar'?'إرسال للاعتماد':'Submit')+'</button><button type="button" data-budget-transition="approve">'+escapeHtml(lang==='ar'?'اعتماد':'Approve')+'</button><button type="button" data-budget-transition="reject">'+escapeHtml(lang==='ar'?'رفض':'Reject')+'</button><button type="button" data-budget-transition="revise">'+escapeHtml(lang==='ar'?'إنشاء مراجعة':'Revise')+'</button><button type="button" data-budget-governance="analyze">'+escapeHtml(lang==='ar'?'تحليل الفعلي مقابل الموازنة':'Analyze actual vs budget')+'</button></div>'+
  '<div class="sr-field full"><label>'+escapeHtml(lang==='ar'?'سبب الرفض/المراجعة':'Reject/revise reason')+' <small>('+T.optional+')</small></label><input id="financialBudgetReason" type="text"></div>'+
  '<div class="financial-governance-columns" aria-hidden="true"><span>'+(lang==='ar'?'الفترة':'Period')+'</span><span>'+(lang==='ar'?'الحساب':'Account')+'</span><span>'+(lang==='ar'?'المبلغ':'Amount')+'</span><span>'+(lang==='ar'?'مركز التكلفة':'Cost center')+'</span><span>'+(lang==='ar'?'القطاع':'Segment')+'</span><span></span></div>'+
  '<div id="financialGovernanceLines"><div class="sr-muted">'+escapeHtml(lang==='ar'?'اختر الكيان المحاسبي لتحميل الفترات والحسابات.':'Select an accounting entity to load periods and accounts.')+'</div></div>'+
  '<button type="button" id="financialGovernanceAddLine" class="sr-secondary">'+escapeHtml(lang==='ar'?'إضافة سطر موازنة':'Add budget line')+'</button></div>'+
  '<div class="sr-field"><label>'+escapeHtml(financialFieldLabel('fiscal_year'))+' <small>('+T.required+')</small></label><input type="number" min="2000" max="2200" name="fiscal_year" value="'+year+'" required></div>'+
  '<div class="sr-field full financial-budget-builder"><div class="financial-budget-builder-head"><div><h3>'+escapeHtml(lang==='ar'?'تحليل سريع فعلي / موازنة / توقع':'Quick actual / budget / forecast analysis')+'</h3><p>'+escapeHtml(lang==='ar'?'محرك حتمي للتحليل السريع؛ لا يولد قيمًا افتراضية.':'Deterministic quick analysis; it does not invent financial values.')+'</p></div><button type="button" id="financialBudgetAddRow" class="sr-secondary">'+escapeHtml(lang==='ar'?'إضافة صف':'Add row')+'</button></div>'+
  '<div class="financial-budget-columns" aria-hidden="true"><span>'+(lang==='ar'?'الفترة':'Period')+'</span><span>'+(lang==='ar'?'الحالة':'Status')+'</span><span>'+(lang==='ar'?'البند':'Metric')+'</span><span>'+(lang==='ar'?'الفعلي':'Actual')+'</span><span>'+(lang==='ar'?'الموازنة':'Budget')+'</span><span>'+(lang==='ar'?'التوقع':'Forecast')+'</span><span></span></div>'+
  '<div id="financialBudgetRows">'+budgetMetricRow()+'</div></div>';
 $('#srFormTitle').textContent=lang==='ar'?'الموازنة والتوقع والحوكمة':'Budget, forecast & governance';
 const rows=$('#financialBudgetRows');
 $('#financialBudgetAddRow')?.addEventListener('click',()=>{rows.insertAdjacentHTML('beforeend',budgetMetricRow());saveWorkspaceDraft()});
 rows?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-budget-remove]');
  if(!btn)return;
  const all=rows.querySelectorAll('[data-budget-row]');
  if(all.length<=1)return;
  btn.closest('[data-budget-row]')?.remove();
  saveWorkspaceDraft();
 });
 $('#financialGovernanceAddLine')?.addEventListener('click',()=>{
  if(!budgetReference)return showStatus(lang==='ar'?'اختر الكيان المحاسبي أولًا':'Select an accounting entity first',false);
  $('#financialGovernanceLines')?.insertAdjacentHTML('beforeend',governedBudgetLineRow());
 });
 $('#financialGovernanceLines')?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-governance-remove]');
  if(btn)btn.closest('[data-governance-line]')?.remove();
 });
 $('#financialEquityAccountCreate')?.addEventListener('click',async()=>{
  const btn=$('#financialEquityAccountCreate');btn.disabled=true;
  try{await createRetainedEarningsAccount()}catch(error){showStatus(T.failed+': '+error.message,false)}
  finally{btn.disabled=false}
 });
 $('#financialYearEndPolicySave')?.addEventListener('click',async()=>{
  const btn=$('#financialYearEndPolicySave');btn.disabled=true;
  try{await saveFiscalYearPolicy()}catch(error){showStatus(T.failed+': '+error.message,false)}
  finally{btn.disabled=false}
 });
 $('#financialPeriodInitialize')?.addEventListener('click',async()=>{
  const btn=$('#financialPeriodInitialize');
  btn.disabled=true;
  try{await initializeAccountingPeriods()}
  catch(error){showStatus(T.failed+': '+error.message,false)}
  finally{btn.disabled=false}
 });
 document.querySelectorAll('[data-budget-governance]').forEach(btn=>btn.addEventListener('click',async()=>{
  btn.disabled=true;
  try{await handleBudgetGovernanceAction(btn.dataset.budgetGovernance)}
  catch(error){showStatus(T.failed+': '+error.message,false)}
  finally{btn.disabled=false}
 }));
 document.querySelectorAll('[data-budget-transition]').forEach(btn=>btn.addEventListener('click',async()=>{
  btn.disabled=true;
  try{await handleBudgetGovernanceAction(btn.dataset.budgetTransition)}
  catch(error){showStatus(T.failed+': '+error.message,false)}
  finally{btn.disabled=false}
 }));
 return true;
}
function renderFinancialOperationalInputs(){
 if(!isFinancialWorkspaceService())return false;
 if(serviceCode==='planning_budgeting_forecasting')return renderPlanningBudgetInputs();
 return renderAccountingReportInputs();
}
async function hydrateAccountingEntities(){
 if(!(ACCOUNTING_REPORT_WORKSPACE_SERVICES.has(serviceCode)||serviceCode==='planning_budgeting_forecasting'))return;
 const select=$('#financialAccountingEntity');
 if(!select)return;
 try{
  await window.BondsAuth.ensureEnv();
  const u=await window.BondsAuth.getUser();
  const user=u.data?.user;
  if(!user){
   select.innerHTML='<option value="">'+escapeHtml(lang==='ar'?'سجّل الدخول لاختيار الكيان':'Sign in to select an entity')+'</option>';
   return;
  }
  const sb=window.BondsAuth.getSupabase();
  const session=(await sb.auth.getSession()).data.session;
  if(!session?.access_token)throw new Error(T.login);
  const response=await fetch('/api/v3/services/accounting/entities',{headers:{'Authorization':'Bearer '+session.access_token}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload?.error?.code||payload?.error||('HTTP '+response.status));
  const entities=Array.isArray(payload.entities)?payload.entities:[];
  select.innerHTML='<option value="">'+escapeHtml(lang==='ar'?'اختر الكيان المحاسبي':'Select accounting entity')+'</option>'+
   entities.map(entity=>'<option value="'+escapeHtml(entity.id)+'" data-role="'+escapeHtml(entity.role||'')+'">'+escapeHtml(entity.name||entity.id)+(entity.base_currency?' — '+escapeHtml(entity.base_currency):'')+'</option>').join('');
  if(entities.length===1)select.value=entities[0].id;
  restoreWorkspaceDraft();
  if(!select.value&&entities.length===1)select.value=entities[0].id;
  if(serviceCode==='planning_budgeting_forecasting'){
   select.addEventListener('change',async()=>{
    budgetReference=null;
    governedBudgetPlanId=null;
    governedBudgetVersionId=null;
    if($('#financialBudgetPlanIdContext'))$('#financialBudgetPlanIdContext').value='';
    if($('#financialBudgetVersionIdContext'))$('#financialBudgetVersionIdContext').value='';
    try{await loadBudgetReference(select.value)}
    catch(error){showStatus(T.failed+': '+error.message,false)}
   });
   if(select.value)await loadBudgetReference(select.value);
  }
 }catch(error){
  select.innerHTML='<option value="">'+escapeHtml(lang==='ar'?'تعذر تحميل الكيانات':'Could not load entities')+'</option>';
  showStatus(T.failed+': '+error.message,false);
 }
}
function collectPlanningBudgetValues(){
 const form=$('#srRequestForm');
 const fiscalYear=String(form.elements.namedItem('fiscal_year')?.value||'').trim();
 const currency=String(form.elements.namedItem('currency')?.value||'').trim().toUpperCase();
 const materialityRaw=form.elements.namedItem('materiality_pct')?.value;
 const useBudget=form.elements.namedItem('use_budget_as_forecast')?.checked===true;
 const grouped=new Map();
 document.querySelectorAll('[data-budget-row]').forEach(row=>{
  const period=String(row.querySelector('[data-budget-period]')?.value||'').trim();
  const status=String(row.querySelector('[data-budget-status]')?.value||'actual').trim();
  const metric=String(row.querySelector('[data-budget-metric]')?.value||'').trim();
  if(!period||!metric)return;
  if(!grouped.has(period))grouped.set(period,{period,status,actual:{},budget:{},forecast:{}});
  const item=grouped.get(period);
  item.status=status;
  const assign=(selector,target)=>{
   const raw=row.querySelector(selector)?.value;
   if(raw!==''&&raw!==undefined&&raw!==null){
    const n=Number(raw);
    if(Number.isFinite(n))item[target][metric]=n;
   }
  };
  assign('[data-budget-actual]','actual');
  assign('[data-budget-budget]','budget');
  assign('[data-budget-forecast]','forecast');
 });
 return {
  fiscal_year:fiscalYear,
  currency,
  materiality_pct:materialityRaw===''?0:Number(materialityRaw),
  use_budget_as_forecast:useBudget,
  periods:[...grouped.values()].sort((a,b)=>a.period.localeCompare(b.period))
 };
}

// Scope drafts to their owning workflow; never restore a draft from a different project.
const workspaceDraftScope=['project_id','deal_id','opportunity_id']
 .map(key=>{const id=params.get(key);return id?key+':'+id:null})
 .filter(Boolean).join('|')||'unassigned';
let workspaceDraftKey=null;
const workspaceDraftStorage=workspaceDraftScope==='unassigned'?sessionStorage:localStorage;
let workspaceDirty=false;
function saveWorkspaceDraft(){
 if(!isServiceWorkspace||!workspaceDraftKey)return;
 const form=$('#srRequestForm');if(!form)return;
 const values={};
 form.querySelectorAll('[name]').forEach(el=>{
   if(el.type==='file'||el.name==='__intake_mode')return;
   if(el.type==='checkbox')values[el.name]=el.checked;
   else if(el.multiple)values[el.name]=Array.from(el.selectedOptions).map(o=>o.value);
   else values[el.name]=el.value;
 });
 const budget_rows=serviceCode==='planning_budgeting_forecasting'?[...document.querySelectorAll('[data-budget-row]')].map(row=>({period:row.querySelector('[data-budget-period]')?.value||'',status:row.querySelector('[data-budget-status]')?.value||'actual',metric:row.querySelector('[data-budget-metric]')?.value||'',actual:row.querySelector('[data-budget-actual]')?.value||'',budget:row.querySelector('[data-budget-budget]')?.value||'',forecast:row.querySelector('[data-budget-forecast]')?.value||''})):null;
 try{
  workspaceDraftStorage.setItem(workspaceDraftKey,JSON.stringify({version:1,service_code:serviceCode,values,budget_rows,updated_at:new Date().toISOString()}));
  workspaceDirty=false;
 }catch(_){workspaceDirty=true}
 syncStudiesAssistantContext();
}
function restoreWorkspaceDraft(){
 if(!isServiceWorkspace||!workspaceDraftKey)return;
 let saved=null;
 try{saved=JSON.parse(workspaceDraftStorage.getItem(workspaceDraftKey)||'null')}catch(_){}
 if(!saved?.values||saved.service_code!==serviceCode)return;
 const form=$('#srRequestForm');if(!form)return;
 Object.entries(saved.values).forEach(([key,value])=>{
   const el=form.elements.namedItem(key);if(!el||el.type==='file')return;
   if(el.type==='checkbox')el.checked=Boolean(value);
   else if(el.multiple&&Array.isArray(value))Array.from(el.options).forEach(o=>{o.selected=value.includes(o.value)});
   else el.value=value??'';
 });
 if(serviceCode==='planning_budgeting_forecasting'&&Array.isArray(saved.budget_rows)&&saved.budget_rows.length){
   const rows=$('#financialBudgetRows');
   if(rows)rows.innerHTML=saved.budget_rows.map(row=>budgetMetricRow(row)).join('');
 }
 workspaceDirty=false;
}
function bindWorkspaceDraft(){
 if(!isServiceWorkspace||!workspaceDraftKey)return;
 const form=$('#srRequestForm');if(!form)return;
 form.addEventListener('input',saveWorkspaceDraft);
 form.addEventListener('change',saveWorkspaceDraft);
}
function clearWorkspaceDraft(){
 if(!isServiceWorkspace||!workspaceDraftKey)return;
 try{workspaceDraftStorage.removeItem(workspaceDraftKey);workspaceDirty=false}
 catch(_){workspaceDirty=true}
}
window.addEventListener('beforeunload',e=>{
 if(!isServiceWorkspace||!workspaceDirty)return;
 e.preventDefault();
 e.returnValue='';
});
function text(row,ar='name_ar',en='name_en'){return lang==='ar'?(row?.[ar]||row?.[en]||''):(row?.[en]||row?.[ar]||'')}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function json(url,opts){const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}
function showStatus(msg,ok){const e=$('#srStatus');e.textContent=msg;e.className='sr-status show '+(ok?'ok':'err')}
function contextQuery(){const p=new URLSearchParams();for(const k of ['country','sector','activity']){const v=params.get(k);if(v)p.set(k,v)}return p.toString()}
function renderList(id,items,fn){const el=$(id);if(!el)return;el.innerHTML=items.length?'<ul class="sr-list">'+items.map(fn).join('')+'</ul>':'<div class="sr-empty">—</div>'}
function renderRequestProfileField(field){
 const key=escapeHtml(field.field_key),label=escapeHtml(lang==='ar'?(field.label_ar||field.label_en||field.field_key):(field.label_en||field.label_ar||field.field_key));
 const req=field.is_required?' required':'';
 const reqLabel=field.is_required?T.required:T.optional;
 const placeholder=escapeHtml(lang==='ar'?(field.placeholder_ar||''):(field.placeholder_en||''));
 if(field.field_type==='textarea')return '<div class="sr-field full"><label>'+label+' <small>('+reqLabel+')</small></label><textarea name="'+key+'"'+req+' placeholder="'+placeholder+'"></textarea></div>';
 return '<div class="sr-field"><label>'+label+' <small>('+reqLabel+')</small></label><input type="text" name="'+key+'"'+req+' placeholder="'+placeholder+'"></div>';
}
function renderRequestProfile(){
 const profile=detail?.request_profile;
 if(!profile)return false;
 const formTitle=lang==='ar'?(profile.form_title_ar||T.form):(profile.form_title_en||T.form);
 $('#srFormTitle').textContent=formTitle;
 $('#srDynamicFields').innerHTML=(profile.fields||[]).map(renderRequestProfileField).join('');
 if((detail.procedures||[]).length===0){
   renderList('#srProcedures',(lang==='ar'?profile.procedures_ar:profile.procedures_en)||[],x=>'<li>'+escapeHtml(x)+'</li>');
 }
 if((detail.requirements||[]).length===0){
   renderList('#srRequirements',(lang==='ar'?profile.requirements_ar:profile.requirements_en)||[],x=>'<li>'+escapeHtml(x)+' <strong>('+T.required+')</strong></li>');
 }
 if((detail.deliverables||[]).length===0){
   renderList('#srDeliverables',(lang==='ar'?profile.deliverables_ar:profile.deliverables_en)||[],x=>'<li>'+escapeHtml(x)+'</li>');
 }
 return true;
}

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
 if(!form?.fields?.length&&!isStudiesWorkspaceService())renderRequestProfile();
 renderFinancialWorkspaceShell();
 renderStudiesWorkspaceShell();
 applyWorkspaceTypeChrome();
 renderWorkspaceReturnLink();
 renderCorrespondenceWorkspaceLink();
 renderFinancialOperationalInputs();
 renderStudiesOperationalInputs();
 renderFinancialIntake();
 restoreWorkspaceDraft();
 bindWorkspaceDraft();
 applyStudiesSubmitLabel();
 bindStudiesCatalogDropdowns();
 syncStudiesAssistantContext();
}
const FINANCIAL_ACTIONS=new Set([
 'financial_analysis_run','cash_flow_analysis_run','funding_readiness_run','creditworthiness_run',
 'feasibility_run','valuation_run','risk_analysis_run','scenario_forecast_run'
]);
function isFinancialIntakeService(){
 if(isFinancialWorkspaceService())return false;
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
function formatFinancialValue(value){
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='boolean')return value?(lang==='ar'?'نعم':'Yes'):(lang==='ar'?'لا':'No');
 if(typeof value==='number')return Number(value).toLocaleString(lang==='ar'?'ar-SA':'en-US',{maximumFractionDigits:2});
 if(typeof value==='object')return escapeHtml(JSON.stringify(value));
 return escapeHtml(value);
}
function financialLabel(key){
 const labels={
  period:lang==='ar'?'الفترة':'Period',
  status:lang==='ar'?'الحالة':'Status',
  metric:lang==='ar'?'البند':'Metric',
  actual:lang==='ar'?'الفعلي':'Actual',
  budget:lang==='ar'?'الموازنة':'Budget',
  forecast:lang==='ar'?'التوقع':'Forecast',
  rolling_forecast:lang==='ar'?'التوقع المتجدد':'Rolling forecast',
  actual_vs_budget_variance:lang==='ar'?'انحراف الفعلي عن الموازنة':'Actual vs budget variance',
  actual_vs_budget_variance_pct:lang==='ar'?'الانحراف %':'Variance %',
  forecast_vs_budget_variance:lang==='ar'?'انحراف التوقع عن الموازنة':'Forecast vs budget variance',
  forecast_vs_budget_variance_pct:lang==='ar'?'انحراف التوقع %':'Forecast variance %',
  total_assets:lang==='ar'?'إجمالي الأصول':'Total assets',
  total_liabilities:lang==='ar'?'إجمالي الالتزامات':'Total liabilities',
  total_equity:lang==='ar'?'إجمالي حقوق الملكية':'Total equity',
  base_equity:lang==='ar'?'حقوق الملكية الأساسية':'Base equity',
  cumulative_earnings:lang==='ar'?'الأرباح المتراكمة':'Cumulative earnings',
  accounting_difference:lang==='ar'?'فرق المعادلة المحاسبية':'Accounting difference',
  revenue:lang==='ar'?'الإيرادات':'Revenue',
  expenses:lang==='ar'?'المصروفات':'Expenses',
  net_income:lang==='ar'?'صافي الربح':'Net income',
  total_debit:lang==='ar'?'إجمالي المدين':'Total debit',
  total_credit:lang==='ar'?'إجمالي الدائن':'Total credit',
  difference:lang==='ar'?'الفرق':'Difference'
 };
 return labels[key]||humanizeKey(key);
}
function renderFinancialRows(rows){
 if(!Array.isArray(rows)||!rows.length)return '<div class="sr-empty">—</div>';
 const preferred=['period','status','metric','account_code','account_name','dimension_code','actual','budget','forecast','rolling_forecast','actual_vs_budget_variance','actual_vs_budget_variance_pct','balance','debit','credit','amount','total'];
 const keys=[...new Set(rows.flatMap(row=>Object.keys(row||{})).filter(key=>!['metadata','provenance'].includes(key)))];
 keys.sort((a,b)=>{
  const ai=preferred.indexOf(a),bi=preferred.indexOf(b);
  return (ai<0?999:ai)-(bi<0?999:bi);
 });
 const visible=keys.slice(0,12);
 return '<div class="financial-result-table-wrap"><table class="financial-result-table"><thead><tr>'+
  visible.map(key=>'<th>'+escapeHtml(financialLabel(key))+'</th>').join('')+
  '</tr></thead><tbody>'+
  rows.map(row=>'<tr>'+visible.map(key=>'<td>'+formatFinancialValue(row?.[key])+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div>';
}
function renderFinancialObject(title,obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return '';
 const entries=Object.entries(obj).filter(([,v])=>['string','number','boolean'].includes(typeof v)||v===null);
 if(!entries.length)return '';
 return '<section class="financial-result-section"><h3>'+escapeHtml(title)+'</h3><div class="financial-result-kpis">'+
  entries.map(([key,value])=>'<div><span>'+escapeHtml(financialLabel(key))+'</span><strong>'+formatFinancialValue(value)+'</strong></div>').join('')+
  '</div></section>';
}
function renderFinancialExecution(result,metrics){
 if(result?.financial_statements){
  const fs=result.financial_statements;
  return '<div class="financial-result-stack">'+
   renderFinancialObject(lang==='ar'?'قائمة المركز المالي':'Statement of financial position',fs.balance_sheet)+
   renderFinancialObject(lang==='ar'?'قائمة الدخل':'Income statement',fs.income_statement)+
   renderFinancialObject(lang==='ar'?'ميزان المراجعة — الفترة':'Trial balance — period',fs.trial_balance?.period)+
   '</div>';
 }
 if(Array.isArray(result?.rows)){
  return '<div class="financial-result-stack"><section class="financial-result-section"><h3>'+
   escapeHtml(text(detail?.service))+'</h3>'+renderFinancialRows(result.rows)+'</section></div>';
 }
 if(Array.isArray(metrics?.rows)){
  const summary=metrics.summary&&typeof metrics.summary==='object'?metrics.summary:{};
  const summaryRows=Object.entries(summary).map(([metric,row])=>({metric,...(row||{})}));
  return '<div class="financial-result-stack">'+
   renderFinancialObject(lang==='ar'?'ملخص الموازنة والتوقع':'Budget & forecast summary',metrics)+
   '<section class="financial-result-section"><h3>'+(lang==='ar'?'ملخص البنود':'Metric summary')+'</h3>'+renderFinancialRows(summaryRows)+'</section>'+
   '<section class="financial-result-section"><h3>'+(lang==='ar'?'التفاصيل الدورية':'Period detail')+'</h3>'+renderFinancialRows(metrics.rows)+'</section>'+
   '</div>';
 }
 return '';
}
function showExecutionPersistenceStatus(execution){
 const projectId=params.get('project_id');
 const requiresArtifact=projectId&&['feasibility_studies','risk_analysis'].includes(serviceCode);
 const persistence=execution?.artifact_persistence;
 if(!requiresArtifact){showStatus(T.executed,true);return true;}
 if(persistence?.status==='saved'&&persistence.artifact_id){
  showStatus(T.executed+' — '+(lang==='ar'?'حُفظ المخرج في المشروع':'Artifact saved to project'),true);
  return true;
 }
 showStatus(T.executed+' — '+(lang==='ar'?'تعذّر تأكيد حفظ المخرج في المشروع. احتفظ بنسخة من النتائج.':'Project artifact persistence was not confirmed. Keep a copy of the results.'),false);
 return false;
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
 const financial=renderFinancialExecution(result,metrics);
 const studies=renderStudiesExecution(result);
 const entries=Object.entries(metrics).filter(([,v])=>v!==null&&v!==undefined&&typeof v!=='object');
 box.innerHTML='<h2>'+escapeHtml(T.executed)+'</h2>'+
  (financial||studies||(
   entries.length?'<div class="sr-list"><ul>'+entries.map(([k,v])=>'<li><strong>'+escapeHtml(humanizeKey(k))+'</strong>: '+formatFinancialValue(v)+'</li>').join('')+'</ul></div>':
   '<pre style="white-space:pre-wrap;overflow:auto">'+escapeHtml(JSON.stringify(result,null,2))+'</pre>'
  ));
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
 if(serviceCode==='planning_budgeting_forecasting'&&isFinancialWorkspaceService())return collectPlanningBudgetValues();
 const values={};const form=$('#srRequestForm');
 form.querySelectorAll('[name]').forEach(el=>{
   if(el.type==='file')return;
   if(el.type==='checkbox')values[el.name]=el.checked;
   else if(el.multiple)values[el.name]=Array.from(el.selectedOptions).map(o=>o.value);
   else values[el.name]=el.type==='number'&&el.value!==''?Number(el.value):el.value;
 });
 return values;
}
// Never claim a saved request until its owner can read back the persisted fields.
async function confirmServiceRequestReadback(reference,expected,headers){
 if(!reference)return false;
 try{
  const result=await json('/api/v3/services/requests?reference='+encodeURIComponent(reference),{headers,credentials:'same-origin',cache:'no-store'});
  if(!Array.isArray(result.requests)||result.requests.length!==1||
     result.requests[0].request_reference!==reference||!result.values||
     typeof result.values!=='object'||Array.isArray(result.values))return false;
  const saved=result.values;
  const keys=Object.keys(expected);
  return Object.keys(saved).length===keys.length&&
   keys.every(key=>Object.prototype.hasOwnProperty.call(saved,key)&&
    JSON.stringify(saved[key])===JSON.stringify(expected[key]));
 }catch(_){return false}
}
async function finalizeServiceRequestCreation(response,expected,headers,extra={}){
 const reference=response?.request?.request_reference;
 // POST may have already inserted a record; a failed readback must not create a duplicate.
 submitted=true;
 if(!reference){
  showStatus(lang==='ar'?'تعذر تأكيد رقم الطلب؛ تحقق من طلباتك قبل إعادة الإرسال.':'Request reference was not confirmed; check your requests before resubmitting.',false);
  return;
 }
 const verified=await confirmServiceRequestReadback(reference,expected,headers);
 track('service_converted',{request_reference:reference,...extra,readback_verified:verified});
 if(verified){
  clearWorkspaceDraft();
  showStatus(T.sent+' — '+reference,true);
 }else{
  showStatus((lang==='ar'?'تم استلام الطلب رقم ':'Request received: ')+reference+
   (lang==='ar'?'، لكن لم يتم تأكيد استرجاع البيانات المحفوظة. لا تعد إرسال الطلب قبل المراجعة.':'. Saved fields could not be verified. Do not resubmit until reviewed.'),false);
 }
 const successLink=$('#srSuccessLink');
 if(successLink)successLink.hidden=true;
}
async function submit(e){
 e.preventDefault();
 if(submitting||submitted)return;
 submitting=true;
 const submitButton=$('#srSubmit');
 if(submitButton)submitButton.disabled=true;
 try{
  await window.BondsAuth.ensureEnv();
  const u=await window.BondsAuth.getUser();const user=u.data?.user;
  if(!user){location.href='/calculators/auth/index.html?redirect='+encodeURIComponent(location.pathname+location.search);return}
  const sb=window.BondsAuth.getSupabase();const session=(await sb.auth.getSession()).data.session;
  if(!session?.access_token)throw new Error(T.login);
  const values=collectValues();
  const runtime=studiesRuntimeFromValues(values);
  const context={
    country:runtime.geo.country||params.get('country')||null,
    region:params.get('region')||null,
    locality:params.get('locality')||null,
    locality_name:runtime.geo.city||params.get('locality_name')||null,
    sector:runtime.geo.sector||params.get('sector')||null,
    activity:runtime.geo.activity||params.get('activity')||null,
    studies_brief:runtime.input||null
  };
  syncStudiesAssistantContext();
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
        metadata:{
          financial_dataset_id:intakeDatasetId,
          intake_mode:intakeMode,
          project_id:params.get('project_id')||null,
          deal_id:params.get('deal_id')||null,
          opportunity_id:params.get('opportunity_id')||null
        }
      };
      const d=await json('/api/v3/services/requests',{method:'POST',headers,body:JSON.stringify(requestBody)});
      await finalizeServiceRequestCreation(d,requestBody.values,headers,{dataset_id:intakeDatasetId});
      return;
    }

    const executionResponse=await fetch('/api/v3/services/execute',{
      method:'POST',
      headers,
      body:JSON.stringify({
        service_code:serviceCode,
        dataset_id:intakeDatasetId,
        project_id:params.get('project_id')||null,
        deal_id:params.get('deal_id')||null,
        opportunity_id:params.get('opportunity_id')||null,
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
    const artifactSaved=showExecutionPersistenceStatus(execution);
    renderExecutionResult(execution);
    if(artifactSaved)clearWorkspaceDraft();
    $('#srSubmit').disabled=true;
    return;
  }

  const executionResponse=await fetch('/api/v3/services/execute',{
    method:'POST',
    headers,
    body:JSON.stringify({
      service_code:serviceCode,
      project_id:params.get('project_id')||null,
      deal_id:params.get('deal_id')||null,
      opportunity_id:params.get('opportunity_id')||null,
      source_url:location.href,
      inputs:values,
      values,
      input:runtime.input||undefined,
      research:runtime.packet||undefined,
      country_code:context.country,
      sector:context.sector,
      activity:context.activity,
      city:context.locality_name,
      language:lang,
      context,
      source:'service_request_page'
    })
  });
  const execution=await executionResponse.json().catch(()=>({}));

  if(executionResponse.ok&&execution.executed===true){
    submitted=true;
    track('service_executed',{action:execution.action||null,execution_status:execution.execution_status||null});
    const artifactSaved=showExecutionPersistenceStatus(execution);
    renderExecutionResult(execution);
    if(artifactSaved)clearWorkspaceDraft();
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
    source:'service_request_page',
    metadata:{
      project_id:params.get('project_id')||null,
      deal_id:params.get('deal_id')||null,
      opportunity_id:params.get('opportunity_id')||null
    }
  };
  const d=await json('/api/v3/services/requests',{method:'POST',headers,body:JSON.stringify(body)});
  await finalizeServiceRequestCreation(d,values,headers);
 }catch(err){showStatus(T.failed+': '+err.message,false)}
 finally{
  submitting=false;
  if(submitButton&&!submitted)submitButton.disabled=false;
 }
}
function studiesFallbackDetail(){
 if(serviceCode!=='scientific_research')return null;
 return {
  service:{
   code:'scientific_research',
   category_code:'business_market',
   group_code:'business_market',
   name_ar:'البحث العلمي',
   name_en:'Scientific Research',
   short_description_ar:'تصميم وتنفيذ بحث علمي بمنهجية وفرضية ومصادر أدلة، مستقل عن دراسة السوق التجارية.',
   short_description_en:'Design and run scientific research with methodology, hypothesis and evidence sources, separate from commercial market studies.',
   delivery_type:'hybrid',
   default_route_ar:'/my-bonds/workspace/?service=scientific_research',
   default_route_en:'/en/my-bonds/workspace/?service=scientific_research'
  },
  workspace:{type:'studies-valuation',mode:'execute',ready:true},
  procedures:[
   {title_ar:'تحديد مشكلة البحث والفرضية',title_en:'Define the research problem and hypothesis'},
   {title_ar:'اختيار المنهجية والعينة',title_en:'Select methodology and sample'},
   {title_ar:'جمع الأدلة وتحليلها',title_en:'Collect and analyze evidence'},
   {title_ar:'صياغة النتائج والتوصيات',title_en:'Draft findings and recommendations'}
  ],
  requirements:[
   {label_ar:'مشكلة بحث واضحة',label_en:'A clear research problem',is_required:true},
   {label_ar:'المنهجية المقترحة',label_en:'Proposed methodology',is_required:true}
  ],
  deliverables:[
   {name_ar:'موجز البحث العلمي',name_en:'Scientific research brief'},
   {name_ar:'مذكرة المنهجية والأدلة',name_en:'Methodology and evidence note'}
  ],
  dependencies:[],
  pricing:[],
  form:null,
  capabilities:[]
 };
}
async function init(){
 if(!serviceCode){
  // Use the existing service catalog; do not duplicate its chooser.
  location.replace(lang==='ar'?'/services.html':'/en/services.html');
  return;
 }
 $('#srLoading').textContent=T.loading;
 try{
  try{
   detail=await json('/api/v3/services/'+encodeURIComponent(serviceCode)+'?'+contextQuery());
  }catch(loadErr){
   detail=studiesFallbackDetail();
   if(!detail) throw loadErr;
  }
  if(isServiceWorkspace&&detail?.workspace?.mode!=='execute'){
    location.replace((lang==='ar'?'/service-request.html':'/en/service-request.html')+location.search);
    return;
  }
  if(isServiceWorkspace){
   // Never restore a draft without tying it to the authenticated user.
   await window.BondsAuth.ensureEnv();
   const identity=await window.BondsAuth.getUser();
   const draftOwner=identity?.data?.user?.id||null;
   if(draftOwner)workspaceDraftKey='bonds_service_workspace_draft_v3:'+draftOwner+':'+serviceCode+':'+workspaceDraftScope;
  }
  $('#srLoading').hidden=true;$('#srContent').hidden=false;render();
  await hydrateAccountingEntities();
  const requestForm=$('#srRequestForm');
  if(isStudiesWorkspaceService()) applyStudiesSubmitLabel();
  else $('#srSubmit').textContent=T.submit;
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