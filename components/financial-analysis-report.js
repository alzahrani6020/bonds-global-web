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
  revenue_expense_surplus_margin_pct:'هامش الفائض %'
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
  const html='<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="utf-8"><title>'+
    escape(heading)+'</title><style>@page{size:A4;margin:17mm}body{font:13px/1.7 Arial,Tahoma,sans-serif;color:#12233b;max-width:960px;margin:25px auto}header{border-bottom:3px solid #b28c49;padding-bottom:12px}h1{font-size:23px;margin:5px 0}h2{font-size:17px;margin:20px 0 8px}section{break-inside:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:7px 0 15px}th,td{padding:6px 9px;border:1px solid #c8d0dd;text-align:start;overflow-wrap:anywhere;vertical-align:top}th{background:#eef2f6;font-weight:600}tr{break-inside:avoid}.notice{border:1px solid #989898;padding:10px;background:#fafafa}small{color:#52627a}footer{border-top:1px solid #bec6d0;margin-top:20px;padding-top:10px}@media print{body{margin:0;max-width:none}}</style></head><body>'+
    '<header><small>BONDS Global · '+escape(tr('تحليل مالي موثق بالمدخلات','Input-attributed financial analysis'))+'</small><h1>'+escape(heading)+'</h1></header>'+
    '<p class="notice">'+escape(state)+'</p>'+
    section(tr('هوية الدراسة والتوثيق','Study identity and evidence'),'<table>'+tableRows(summary)+'</table>')+
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
