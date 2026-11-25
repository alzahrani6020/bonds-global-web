'use strict';

// A read-only, source-attributed report for actual financial_analysis executions.
// The browser's print dialog produces a Unicode/RTL PDF; no pseudo-Arabic PDF
// with '?' replacement is presented as a professional report.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BondsFinancialAnalysisReport=api;
})(typeof window==='undefined'?null:window,function(){
 const escape=v=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 const fmt=v=>numeric(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'—';
 const metricNames={
  revenue:'الإيرادات',gross_profit:'مجمل الربح',gross_margin_pct:'هامش مجمل الربح %',
  total_expenses:'إجمالي المصروفات',net_margin_pct:'هامش صافي الربح %',
  ebitda:'الربح قبل الفوائد والضرائب والإهلاك والإطفاء',
  ebitda_margin_pct:'هامش EBITDA %',operating_margin_pct:'هامش التشغيل %',
  current_ratio:'نسبة التداول',quick_ratio:'نسبة السيولة السريعة',
  cash_ratio:'نسبة النقدية',working_capital:'رأس المال العامل',
  interest_coverage:'تغطية الفوائد من الربح التشغيلي (EBIT)',
  ebitda_interest_coverage:'تغطية الفوائد من EBITDA',
  debt_to_equity:'إجمالي الدين / حقوق الملكية',
  liabilities_to_equity:'إجمالي الالتزامات / حقوق الملكية',
  liabilities_to_assets:'إجمالي الالتزامات / إجمالي الأصول',
  debt_to_assets:'إجمالي الدين / إجمالي الأصول',
  roa_pct:'العائد على الأصول %',roe_pct:'العائد على حقوق الملكية %',
  wacc_pct:'المتوسط المرجح لتكلفة رأس المال %',
  net_debt:'صافي الدين',net_debt_to_ebitda:'صافي الدين / EBITDA',
  asset_turnover:'دوران الأصول',receivables_turnover:'دوران الذمم المدينة',
  inventory_turnover:'دوران المخزون',revenue_growth_pct:'نمو الإيرادات %',
  earnings_growth_pct:'نمو الأرباح %',cost_of_debt_pct:'تكلفة الدين %',
  revenue_expense_surplus:'فائض الإيرادات بعد المصروفات',
  expense_to_revenue_pct:'المصروفات / الإيرادات %',
  revenue_expense_surplus_margin_pct:'هامش الفائض %',
  operating_cash_flow:'التدفق التشغيلي',investing_cash_flow:'التدفق الاستثماري',financing_cash_flow:'التدفق التمويلي',
  net_cash_flow:'صافي التدفقات النقدية',ending_cash_from_flow:'النقد الختامي من التدفقات',
  depreciation_amortization:'الإهلاك والإطفاء',dscr:'نسبة تغطية خدمة الدين',
  operating_cash_flow_margin_pct:'هامش التدفق التشغيلي %',operating_cash_to_net_income:'النقد التشغيلي / صافي الربح',
  adjusted_net_income_excluding_one_off:'صافي الربح المستبعد منه الدخل غير المتكرر',
  cash_conversion_cycle_days:'دورة التحويل النقدي - أيام (رصيد ختامي)',
  days_sales_outstanding:'أيام التحصيل (رصيد ختامي)',days_inventory_outstanding:'أيام المخزون (رصيد ختامي)',
  days_payables_outstanding:'أيام السداد (رصيد ختامي)',
  cost_of_sales_pct:'تكلفة المبيعات / الإيرادات %',operating_expenses_pct:'المصاريف التشغيلية / الإيرادات %'
 };
 function render(payload,lang='ar'){
  const ar=lang!=='en';
  const tr=(arText,enText)=>ar?arText:enText;
  const result=payload&&payload.result||{};
  const engine=result.engineResults&&result.engineResults.financial_analysis;
  const metrics=(engine&&engine.metrics)||(result.metrics)||(payload&&payload.metrics);
  if(payload?.executed!==true || !metrics||typeof metrics!=='object' ||
     !Object.values(metrics).some(numeric)){
   throw new Error('FINANCIAL_REPORT_REQUIRES_EXECUTED_METRICS');
  }
  const evidence=payload.dataset||{};
  const source=evidence.source||{};
  const persistence=payload.dataset_persistence||{};
  const stored=persistence.status==='saved'&&persistence.verified===true;
  const inputs=evidence.inputs_used&&typeof evidence.inputs_used==='object'?evidence.inputs_used:{};
  const existing=Object.entries(metrics).filter(row=>numeric(row[1]));
  // Revenue is a reported source input, not a computed output; do not
  // mislabel an available input as an unavailable ratio in the PDF.
  const missing=Object.keys(metricNames).filter(key=>!numeric(metrics[key])&&!numeric(inputs[key]));
  const fieldSources=Array.isArray(evidence.field_provenance)?evidence.field_provenance:[];
  const heading=tr('BONDS Global — تقرير التحليل المالي','BONDS Global — Financial Analysis Report');
  const state=stored?tr('تم التحقق من حفظ النتائج واسترجاعها','Persistence verified by readback'):
    tr('الحفظ غير مؤكد — نسخة نتائج للمراجعة','Persistence not verified — review copy');
  const tableRows=(entries)=>entries.map(pair=>'<tr><th>'+escape(pair[0])+'</th><td>'+escape(pair[1])+'</td></tr>').join('');
  const section=(title,html)=>'<section><h2>'+escape(title)+'</h2>'+html+'</section>';
  const summary=[
    [tr('الخدمة','Service'),'financial_analysis'],
    [tr('معرف مجموعة البيانات','Dataset ID'),evidence.dataset_id||'—'],
    [tr('إصدار البيانات','Dataset version'),evidence.dataset_version||'—'],
    [tr('ملف المصدر','Source file'),source.file_name||tr('مدخلات يدوية أو غير محدد','Manual or unspecified')],
    [tr('بصمة الملف','Source version'),source.file_version||'—'],
    [tr('بصمة المدخلات','Input hash'),evidence.input_hash||'—'],
    [tr('حالة الحفظ','Persistence'),state]
  ];
  const values=existing.map(([key,value])=>[ar?(metricNames[key]||key.replace(/_/g,' ')):key.replace(/_/g,' '),fmt(value)]);
  const inputsTable=Object.entries(inputs).filter(([,v])=>typeof v==='string'||numeric(v))
    .map(([k,v])=>[ar?(metricNames[k]||k.replace(/_/g,' ')):k.replace(/_/g,' '),numeric(v)?fmt(v):v]);
  const sourceRows=fieldSources.filter(f=>f&&f.value!==null&&f.value!==undefined)
    .map(f=>[f.field||'—',f.status||'—',(f.source||[]).map(x=>
      [x.sheet,x.row,x.column,x.line,x.extraction_method].filter(x=>x!==null&&x!==undefined).join(' / ')).join(' ; ')||'—']);
  const provenanceHtml=sourceRows.length?
    '<table><thead><tr><th>'+tr('الحقل','Field')+'</th><th>'+tr('حالة المصدر','Source status')+'</th><th>'+tr('موضع المصدر','Source reference')+'</th></tr></thead><tbody>'+
    sourceRows.map(r=>'<tr>'+r.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':
    '<p>'+tr('لا تتوفر مراجع مصدر تفصيلية.','No detailed field provenance available.')+'</p>';
  const gaps=missing.length?tr('مؤشرات غير قابلة للحساب بالمدخلات المتاحة: ','Metrics unavailable from current inputs: ')+
    missing.map(k=>ar?metricNames[k]:k).join('، '):
    tr('لا توجد فجوات في قائمة المؤشرات المعرفة بالقالب.','No missing values in the report template.');
  const present=k=>numeric(metrics[k]);
  const metricText=k=>present(k)?fmt(metrics[k]):tr('لا تتوفر مدخلات كافية','Insufficient data');
  const metricTable=keys=>'<table>'+tableRows(keys.map(key=>[
   ar?(metricNames[key]||key):key.replace(/_/g,' '),metricText(key)
  ]))+'</table>';
  const statementKeys=[
   ['total_assets',tr('الأصول','Total assets')],['total_liabilities',tr('الالتزامات','Liabilities')],
   ['equity',tr('حقوق الملكية','Equity')],['revenue',tr('الإيرادات','Revenue')],
   ['cogs',tr('تكلفة المبيعات','COGS')],['operating_income',tr('الربح التشغيلي','EBIT')],
   ['net_income',tr('صافي الربح','Net income')]
  ];
  const sourceStatement='<table>'+tableRows(statementKeys.map(([key,name])=>[
   name,numeric(inputs[key])?fmt(inputs[key]):'—'
  ]))+'</table>';
  const prior=[];
  if(numeric(inputs.prior_revenue)&&numeric(inputs.revenue))prior.push([
   tr('نمو الإيرادات','Revenue growth'),metricText('revenue_growth_pct')]);
  if(numeric(inputs.prior_net_income)&&numeric(inputs.net_income))prior.push([
   tr('نمو صافي الربح','Net income growth'),metricText('earnings_growth_pct')]);
  const reconciliation=[
   [tr('فرق توازن المركز المالي','Balance sheet difference'),
    ['total_assets','total_liabilities','equity'].every(k=>numeric(inputs[k]))?
    fmt(inputs.total_assets-inputs.total_liabilities-inputs.equity):'—'],
   [tr('فرق تسوية النقد','Cash-flow roll-forward difference'),
    numeric(inputs.ending_cash)&&present('ending_cash_from_flow')?
    fmt(inputs.ending_cash-metrics.ending_cash_from_flow):'—'],
   [tr('فرق صافي الربح بين القائمتين','Net income statement difference'),
    numeric(inputs.cash_flow_net_income)&&numeric(inputs.net_income)?
    fmt(inputs.net_income-inputs.cash_flow_net_income):'—']
  ];
  const risks=[];
  if(present('dscr')&&metrics.dscr<1)risks.push(tr('تغطية خدمة الدين أقل من مرة','DSCR below 1'));
  if(present('current_ratio')&&metrics.current_ratio<1)risks.push(tr('التزامات متداولة أعلى من الأصول المتداولة','Current liabilities exceed current assets'));
  if(present('operating_cash_flow')&&metrics.operating_cash_flow<0)risks.push(tr('تدفق نقدي تشغيلي سالب','Negative operating cash flow'));
  const recommendations=[];
  if(present('dscr')&&metrics.dscr<1)recommendations.push(tr(
    'مراجعة جدول خدمة الدين وتوقيتاته مقابل النقد المتاح، مع توثيق استحقاقات الأصل والفوائد.',
    'Review debt-service timing against evidenced cash available and document principal/interest maturities.'));
  if(present('current_ratio')&&metrics.current_ratio<1)recommendations.push(tr(
    'إعداد خطة لرأس المال العامل ومراجعة مواعيد الاستحقاقات قصيرة الأجل.',
    'Prepare a working-capital plan and review short-term liabilities.'));
  if(present('operating_cash_flow')&&metrics.operating_cash_flow<0)recommendations.push(tr(
    'تحديد أسباب التدفق التشغيلي السالب، بما يشمل التحصيل والمخزون والدائنين.',
    'Investigate negative operating cash flow, including collections, stock and payables.'));
  if(!recommendations.length)recommendations.push(tr(
    'استكمال البيانات والمستندات وتفسير الاتجاهات قبل إصدار استنتاج مهني نهائي.',
    'Complete source evidence and comparative trends before a final professional conclusion.'));
  const riskText=risks.length?risks.join('؛ '):tr('لا تنبيهات وفق القواعد المحدودة؛ لا يمثل ذلك اعتمادًا ائتمانيًا.',
   'No triggers under limited rules; not credit approval.');
  const groupRequirements={
   income_statement:['revenue','cogs','operating_expenses','net_income'],
   financial_position:['total_assets','total_liabilities','equity','current_assets','current_liabilities'],
   cash_flow:['opening_balance','operating_cash_flow','investing_cash_flow','financing_cash_flow','ending_cash','cash']
  };
  const groupNames={
   income_statement:tr('قائمة الدخل','Income statement'),
   financial_position:tr('قائمة المركز المالي','Financial position'),
   cash_flow:tr('قائمة التدفقات النقدية','Cash-flow statement')
  };
  const statementCoverage=Object.entries(groupRequirements).map(([group,keys])=>{
   const missingFields=keys.filter(key=>!numeric(inputs[key]));
   return [groupNames[group],missingFields.length?
    tr('جزئي — بنود ناقصة: ','Partial — missing: ')+missingFields.join(', '):
    tr('مكتمل حسابيًا','Numerically complete')];
  });
  const coverage=[
    ...statementCoverage,
    [tr('عدد المؤشرات المحسوبة','Computed metrics'),String(existing.length)],
    [tr('عدد المؤشرات غير المتاحة','Unavailable metrics'),String(missing.length)],
    [tr('فحص مصدر البيانات المستقل','Independent source assurance'),tr('غير مثبت','Unverified')],
    [tr('المقارنة القطاعية','Sector benchmark'),tr('غير مطبقة: مصدر معتمد غير متاح','Not applied: no verified source')]
  ];
  const html='<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="utf-8"><title>'+
    escape(heading)+'</title><style>@page{size:A4;margin:17mm}body{font:13px/1.7 Arial,Tahoma,sans-serif;color:#12233b;max-width:960px;margin:25px auto}header{border-bottom:3px solid #b28c49;padding-bottom:12px}h1{font-size:23px;margin:5px 0}h2{font-size:17px;margin:20px 0 8px}section{break-inside:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:7px 0 15px}th,td{padding:6px 9px;border:1px solid #c8d0dd;text-align:start;overflow-wrap:anywhere;vertical-align:top}th{background:#eef2f6;font-weight:600}tr{break-inside:avoid}.notice{border:1px solid #989898;padding:10px;background:#fafafa}small{color:#52627a}footer{border-top:1px solid #bec6d0;margin-top:20px;padding-top:10px}@media print{body{margin:0;max-width:none}}</style></head><body>'+
    '<header><small>BONDS Global · '+escape(tr('تحليل مالي موثق بالمدخلات','Input-attributed financial analysis'))+'</small><h1>'+escape(heading)+'</h1></header>'+
    '<p class="notice">'+escape(state)+'</p>'+
    section(tr('هوية الدراسة والتوثيق','Study identity and evidence'),'<table>'+tableRows(summary)+'</table>')+
    section(tr('مستوى اكتمال التحليل','Analysis completeness'),'<table>'+tableRows(coverage)+'</table>')+
    section(tr('مقتطف القوائم المالية','Financial statement excerpt'),sourceStatement)+
    section(tr('مطابقة القوائم','Statement reconciliation'),'<table>'+tableRows(reconciliation)+'</table>')+
    section(tr('التحليل الرأسي','Common-size analysis'),
      metricTable(['gross_margin_pct','operating_margin_pct','net_margin_pct','cost_of_sales_pct','operating_expenses_pct']))+
    section(tr('المقارنة بالفترة السابقة','Prior-period comparison'),
      prior.length?'<table>'+tableRows(prior)+'</table>':'<p>'+tr('بيانات المقارنة غير متاحة','Comparison inputs unavailable')+'</p>')+
    section(tr('تحليل التدفقات النقدية','Cash-flow analysis'),
      metricTable(['operating_cash_flow','investing_cash_flow','financing_cash_flow','net_cash_flow','ending_cash_from_flow']))+
    section(tr('جودة الأرباح','Earnings quality'),
      metricTable(['operating_cash_to_net_income','adjusted_net_income_excluding_one_off']))+
    section(tr('الملاءة وخدمة الدين ورأس المال العامل','Credit and working capital'),
      metricTable(['dscr','interest_coverage','debt_to_equity','liabilities_to_equity','cash_conversion_cycle_days',
        'days_sales_outstanding','days_inventory_outstanding','days_payables_outstanding'])+
      '<p>'+escape(tr('تتطلب تغطية الدين CFADS والاستحقاق الفعلي. أيام رأس المال العامل تعتمد على الأرصدة الختامية، لا المتوسطات.',
        'DSCR requires reported CFADS and scheduled service; working-capital days use closing balances, not averages.'))+'</p>')+
    section(tr('إشارات المخاطر','Risk indicators'),'<p>'+escape(riskText)+'</p>')+
    section(tr('إجراءات المراجعة المقترحة آليًا','Automated review actions'),'<p>'+escape(recommendations.join('؛ '))+'</p>')+
    section(tr('المؤشرات المحسوبة','Computed indicators'),'<table>'+tableRows(values)+'</table>')+
    section(tr('المدخلات المستخدمة','Execution inputs'),inputsTable.length?'<table>'+tableRows(inputsTable)+'</table>':'<p>—</p>')+
    section(tr('مصادر بنود القوائم','Field provenance'),provenanceHtml)+
    section(tr('حدود التحليل','Analysis limitations'),'<p>'+escape(gaps)+'</p><p>'+
      escape(tr('الأرقام ناتجة عن محرك حسابي، وليست توثيقًا مستقلًا لصحة البيانات المصدرية أو اعتمادًا ائتمانيًا. لا تُنشأ قوائم مالية أو توقعات غير مقدمة.',
        'Figures are computed by a deterministic engine, not independent verification of source financial statements or a credit approval. No unsupported statements or forecasts are invented.'))+'</p>')+
    '<footer>'+escape(tr('نسخة قابلة للطباعة والحفظ PDF عبر المتصفح؛ لا تغيّر قاعدة البيانات.',
      'Browser-printable PDF copy; does not modify stored financial records.'))+'</footer></body></html>';
  return html;
 }
 return {render};
});
