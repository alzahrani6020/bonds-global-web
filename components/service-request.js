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
function financialWorkspaceHref(code){
 const next=new URLSearchParams(location.search);
 next.set('service',code);
 return (lang==='ar'?'/my-bonds/workspace/':'/en/my-bonds/workspace/')+'?'+next.toString();
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
 if(periodInit)periodInit.hidden=(payload.periods||[]).length>0||!yearPolicy;
 if(rows)rows.innerHTML=(payload.periods||[]).length?governedBudgetLineRow():'<div class="sr-muted">'+escapeHtml(lang==='ar'?'لا توجد فترات محاسبية. حدد بداية ونهاية السنة ثم هيئ الفترات الشهرية.':'No accounting periods exist. Set fiscal start/end and initialize monthly periods.')+'</div>';
 const role=payload.accounting_entity?.role;
 document.querySelectorAll('[data-budget-transition="approve"],[data-budget-transition="reject"]').forEach(btn=>{btn.disabled=!['owner','admin'].includes(role)});
 const range=payload.periods||[];
 if(range.length){
  const first=range[0],last=range[range.length-1];
  const starts=$('#financialFiscalStart'),ends=$('#financialFiscalEnd'),actual=$('#financialActualThrough');
  if(starts)starts.value=first.starts_on||'';
  if(ends)ends.value=last.ends_on||'';
  if(actual)actual.value=last.ends_on||'';
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

const workspaceDraftKey='bonds_service_workspace_draft_v1:'+serviceCode;
let workspaceDirty=false;
function saveWorkspaceDraft(){
 if(!isServiceWorkspace)return;
 const form=$('#srRequestForm');if(!form)return;
 const values={};
 form.querySelectorAll('[name]').forEach(el=>{
   if(el.type==='file'||el.name==='__intake_mode')return;
   if(el.type==='checkbox')values[el.name]=el.checked;
   else if(el.multiple)values[el.name]=Array.from(el.selectedOptions).map(o=>o.value);
   else values[el.name]=el.value;
 });
 const budget_rows=serviceCode==='planning_budgeting_forecasting'?[...document.querySelectorAll('[data-budget-row]')].map(row=>({period:row.querySelector('[data-budget-period]')?.value||'',status:row.querySelector('[data-budget-status]')?.value||'actual',metric:row.querySelector('[data-budget-metric]')?.value||'',actual:row.querySelector('[data-budget-actual]')?.value||'',budget:row.querySelector('[data-budget-budget]')?.value||'',forecast:row.querySelector('[data-budget-forecast]')?.value||''})):null;
 localStorage.setItem(workspaceDraftKey,JSON.stringify({version:1,service_code:serviceCode,values,budget_rows,updated_at:new Date().toISOString()}));
 workspaceDirty=true;
}
function restoreWorkspaceDraft(){
 if(!isServiceWorkspace)return;
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(workspaceDraftKey)||'null')}catch(_){}
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
 if(!isServiceWorkspace)return;
 const form=$('#srRequestForm');if(!form)return;
 form.addEventListener('input',saveWorkspaceDraft);
 form.addEventListener('change',saveWorkspaceDraft);
}
function clearWorkspaceDraft(){
 if(!isServiceWorkspace)return;
 localStorage.removeItem(workspaceDraftKey);
 workspaceDirty=false;
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
 if(!form?.fields?.length)renderRequestProfile();
 renderFinancialWorkspaceShell();
 renderFinancialOperationalInputs();
 renderFinancialIntake();
 restoreWorkspaceDraft();
 bindWorkspaceDraft();
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
 const entries=Object.entries(metrics).filter(([,v])=>v!==null&&v!==undefined&&typeof v!=='object');
 box.innerHTML='<h2>'+escapeHtml(T.executed)+'</h2>'+
  (financial||(
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
      $('#srSuccessLink').hidden=true;
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
    clearWorkspaceDraft();
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
    clearWorkspaceDraft();
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
  $('#srSuccessLink').hidden=true;
 }catch(err){showStatus(T.failed+': '+err.message,false)}
}
async function init(){
 if(!serviceCode){showStatus(T.failed+': service',false);return}
 $('#srLoading').textContent=T.loading;
 try{
  detail=await json('/api/v3/services/'+encodeURIComponent(serviceCode)+'?'+contextQuery());
  if(isServiceWorkspace&&detail?.workspace?.mode!=='execute'){
    location.replace((lang==='ar'?'/service-request.html':'/en/service-request.html')+location.search);
    return;
  }
  $('#srLoading').hidden=true;$('#srContent').hidden=false;render();
  await hydrateAccountingEntities();
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