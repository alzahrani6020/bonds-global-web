(function(root){
'use strict';
// Isolated synthetic financial lab. NEVER submits to /execute or /intake.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
const cases={healthy:['شركة رابحة','Profitable business'],stressed:['شركة متعثرة','Distressed business'],inconsistent:['بيانات متناقضة','Accounting contradictions']};
const labels={
 revenue:['الإيرادات','Revenue'],cogs:['تكلفة المبيعات','Cost of sales'],
 operating_expenses:['المصروفات التشغيلية','Operating expenses'],
 operating_income:['الربح التشغيلي EBIT','Operating income EBIT'],ebitda:['EBITDA','EBITDA'],
 net_income:['صافي الربح','Net income'],total_assets:['إجمالي الأصول','Total assets'],
 total_liabilities:['إجمالي الالتزامات','Total liabilities'],equity:['حقوق الملكية','Equity'],
 cash:['النقد','Cash'],inventory:['المخزون','Inventory'],
 receivables:['الذمم المدينة','Receivables'],payables:['الذمم الدائنة','Payables'],
 current_assets:['الأصول المتداولة','Current assets'],current_liabilities:['الالتزامات المتداولة','Current liabilities'],
 total_debt:['الدين','Debt'],interest_expense:['مصروف الفوائد','Interest expense'],
 operating_cash_flow:['التدفقات التشغيلية','Operating cash flow'],
 investing_cash_flow:['التدفقات الاستثمارية','Investing cash flow'],
 financing_cash_flow:['التدفقات التمويلية','Financing cash flow'],
 opening_cash:['النقد أول الفترة','Opening cash'],ending_cash:['النقد آخر الفترة','Closing cash'],
 scheduled_debt_service:['خدمة الدين المطلوبة','Debt service'],
 cash_available_for_debt_service:['النقد المتاح لخدمة الدين','CFADS'],
 one_off_income:['دخل غير متكرر','Non-recurring income'],
 depreciation_amortization:['إهلاك وإطفاء','Depreciation and amortization'],
 current_ratio:['نسبة التداول','Current ratio'],quick_ratio:['السيولة السريعة','Quick ratio'],
 debt_to_equity:['الدين / حقوق الملكية','Debt/equity'],
 interest_coverage:['تغطية الفوائد EBIT','EBIT interest coverage'],
 net_margin_pct:['هامش صافي الربح %','Net margin %'],
 revenue_growth_pct:['نمو الإيرادات %','Revenue growth %']
};
const controlNames={
 BALANCE_SHEET:['توازن المركز المالي','Balance sheet'],
 CASH_ROLL_FORWARD:['تسوية النقد','Cash roll-forward'],
 EBIT_RECONCILIATION:['مطابقة الربح التشغيلي','Operating income reconciliation'],
 CASH_FLOW_NET_INCOME:['مطابقة صافي الربح','Net income reconciliation'],
 EBITDA_BRIDGE:['مطابقة EBITDA','EBITDA reconciliation'],
 CASH_TO_BALANCE_SHEET:['مطابقة النقد بالمركز المالي','Cash balance reconciliation']
};
const tr=(ar,en,english)=>english?en:ar;
const name=(code,en)=>labels[code]?.[en?1:0]||String(code).replace(/_/g,' ');
const tab=(headers,rows)=>'<table style="width:100%;border-collapse:collapse;margin:8px 0 15px;font-size:13px"><thead><tr>'+
 headers.map(h=>'<th style="border:1px solid #bdc8d4;padding:7px;background:#eef2f6;text-align:start">'+escape(h)+'</th>').join('')+
 '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td style="border:1px solid #bdc8d4;padding:7px;text-align:start;overflow-wrap:anywhere">'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
function report(data,en){
 const years=data.periods.map(p=>String(p.year));
 const lines=(keys)=>tab([tr('البند','Line item',en),...years],
   keys.map(key=>[name(key,en),...data.periods.map(p=>num(p.inputs[key]??p.metrics[key]))]));
 const checks=tab([tr('الاختبار','Control',en),...years],data.periods[0].audit.map((c,i)=>[
  tr(...(controlNames[c.code]||[c.code,c.code]),en),...data.periods.map(p=>p.audit[i].status+(p.audit[i].status==='FAIL'?' ('+num(p.audit[i].difference)+')':''))
 ]));
 const horizontal=tab([tr('المقارنة','Comparison',en),tr('نمو الإيرادات %','Revenue growth %',en),tr('نمو الأصول %','Asset growth %',en),
  tr('تغير صافي الربح','Net income change',en)],data.horizontal.map(x=>[
   x.from+'–'+x.to,num(x.revenue_growth_pct),num(x.assets_growth_pct),num(x.net_income_change)
 ]));
 const vertical=tab([tr('السنة','Year',en),tr('تكلفة المبيعات %','COGS %',en),
  tr('المصروفات التشغيلية %','Operating expenses %',en),tr('هامش الربح الصافي %','Net margin %',en)],
  data.periods.map(p=>[String(p.year),num(p.vertical.cogs_pct),num(p.vertical.operating_expenses_pct),num(p.vertical.net_margin_pct)]));
 const liquidity=tab([tr('السنة','Year',en),tr('دورة التحويل النقدي بالأيام','Cash conversion cycle (days)',en),
  tr('نقد التشغيل','Operating cash flow',en),tr('CFADS','CFADS',en),
  tr('خدمة الدين','Debt service',en),tr('DSCR','DSCR',en)],
  data.periods.map(p=>[String(p.year),num(p.working_capital.cash_conversion_cycle_days),num(p.cash_flow.operating),
   num(p.credit.cfads),num(p.credit.scheduled_debt_service),num(p.credit.dscr)]));
 const sens=data.sensitivity;
 const sensitivity=tab([tr('الافتراض','Scenario',en),tr('EBIT','EBIT',en)],[
  [tr('الحالة الأساسية','Baseline',en),num(sens.baseline_ebit)],
  [tr('الإيرادات -10%','Revenue -10%',en),num(sens.revenue_minus_10_pct)],
  [tr('الإيرادات +10%','Revenue +10%',en),num(sens.revenue_plus_10_pct)],
  [tr('تكلفة المبيعات +10%','COGS +10%',en),num(sens.cogs_plus_10_pct)]
 ]);
 const risks=escape(data.risk_codes.join('، ')||tr('لا توجد إشارات مخاطرة من القواعد المتاحة','No rule-based risk flags',en));
 const missing=escape(data.completeness.missing_indicators.join(', ')||'—');
 const summary='<p><strong>'+escape(tr('حالة اكتمال التحليل','Analysis status',en))+': </strong>'+
  escape(data.completeness.analysis_status)+'</p><p><strong>'+escape(tr('المخاطر','Risk signals',en))+': </strong>'+risks+'</p>'+
  '<p><strong>'+escape(tr('المؤشرات الناقصة','Unavailable indicators',en))+': </strong>'+missing+'</p>'+
  '<p><strong>'+escape(tr('القياس المرجعي القطاعي','Sector benchmark',en))+': </strong>'+
  escape(tr('غير مطبق؛ لا يوجد مصدر قطاعي موثق','Not applied; no verified sector source',en))+'</p>';
 const heading=(t)=>'<h2 style="font-size:17px;margin-top:22px">'+escape(t)+'</h2>';
 const provenance=tab([tr('السنة','Year',en),tr('الحقل','Field',en),tr('نوع المصدر','Provenance',en),tr('الصيغة','Formula',en)],
  data.periods.flatMap(p=>p.provenance.map(v=>[String(p.year),name(v.field,en),v.origin,v.formula||'—'])));
 return '<!doctype html><html lang="'+(en?'en':'ar')+'" dir="'+(en?'ltr':'rtl')+'"><head><meta charset="utf-8"><title>'+
  escape(tr('تقرير التحليل المالي التجريبي','Synthetic financial-analysis report',en))+'</title>'+
  '<style>@page{size:A4;margin:16mm}body{font:14px/1.65 Arial,Tahoma,sans-serif;color:#192b40;max-width:960px;margin:24px auto;padding:0 12px}h1{font-size:23px}h2{break-after:avoid}tr{break-inside:avoid}.stamp{border:2px solid #b25d4c;padding:14px;background:#fff6f4;font-weight:700}.meta{font-size:11px;color:#56606e;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}}</style></head><body>'+
  '<h1>BONDS Global — '+escape(tr('تقرير المختبر المالي','Financial Lab Report',en))+'</h1>'+
  '<div class="stamp">'+escape(tr('تقرير تجريبي — غير معتمد — بيانات اصطناعية فقط','TEST REPORT — NOT APPROVED — SYNTHETIC DATA ONLY',en))+'</div>'+
  '<p>'+escape(tr(...cases[data.scenario],en))+' | 2024–2026 | SAR</p>'+summary+
  heading(tr('قائمة الدخل (مقتطف محاكاة)','Income statement (simulation excerpt)',en))+
  lines(['revenue','cogs','operating_expenses','operating_income','ebitda','net_income'])+
  heading(tr('المركز المالي (مقتطف محاكاة)','Financial position (simulation excerpt)',en))+
  lines(['total_assets','total_liabilities','equity','current_assets','current_liabilities','cash','total_debt'])+
  heading(tr('التدفقات النقدية','Cash flows',en))+
  lines(['opening_cash','operating_cash_flow','investing_cash_flow','financing_cash_flow','ending_cash'])+
  heading(tr('تسويات القوائم الثلاث','Cross-statement reconciliation',en))+checks+
  heading(tr('التحليل الأفقي','Horizontal trends',en))+horizontal+
  heading(tr('التحليل الرأسي','Common-size analysis',en))+vertical+
  heading(tr('رأس المال العامل وخدمة الدين','Working capital and debt service',en))+liquidity+
  heading(tr('الحساسية التشغيلية','Operating sensitivity',en))+sensitivity+
  heading(tr('توثيق الحقول والاشتقاقات','Input provenance and derivations',en))+provenance+
  '<p class="meta">Fixture: '+escape(data.audit.fixture_id)+' | Fingerprint: '+escape(data.audit.fingerprint)+
  ' | Database writes: '+num(data.audit.database_writes)+'</p>'+
  '<p>'+escape(tr('هذا المحاكي ليس قوائم مالية مدققة أو دراسة ائتمانية. الفترات والبيانات اصطناعية، وبيانات أيام رأس المال العامل تعتمد على الأرصدة الختامية بدل المتوسطات. لا توجد معايير قطاعية معتمدة.',
   'This simulation is neither audited financial statements nor credit approval. Periods and values are synthetic; working capital days use closing-balance proxies. No verified sector benchmarks.',en))+'</p>'+
  '</body></html>';
}
function mount(host,lang){
 if(!host || host.dataset.labMounted==='1')return;
 host.dataset.labMounted='1';
 const en=String(lang).startsWith('en');
 const options=Object.entries(cases).map(([k,l])=>'<option value="'+k+'">'+escape(l[en?1:0])+'</option>').join('');
 host.innerHTML='<section class="sr-card" style="border:1px solid #c8a66e;padding:18px;border-radius:12px;margin-top:12px">'+
  '<h3>'+escape(tr('مختبر التحليل المالي — بيانات افتراضية فقط','Financial Analysis Lab — synthetic only',en))+'</h3>'+
  '<p>'+escape(tr('تجربة منفصلة عن الطلبات والحسابات والملفات والحفظ والمدفوعات. تستخدم المحرك المالي نفسه مع ثلاثة أعوام اصطناعية.',
  'Isolated from requests, accounts, uploaded files, saving and payment. Runs the same financial engine on three synthetic periods.',en))+'</p>'+
  '<div class="sr-field"><label for="srFinanceLabScenario">'+escape(tr('حالة التجربة','Scenario',en))+'</label><select id="srFinanceLabScenario">'+options+'</select></div>'+
  '<fieldset id="srFinanceLabAdjustments" style="border:1px solid #d9e1eb;border-radius:12px;padding:12px;margin:16px 0"><legend>'+escape(tr('تغيير افتراضات عام 2026 — تعليمي فقط','2026 synthetic assumptions only',en))+'</legend><div class="sr-intake-table">'+
  [['revenue','الإيرادات','Revenue'],['cogs','تكلفة المبيعات','Cost of sales'],['operating_expenses','المصروفات التشغيلية','Operating expenses'],['total_debt','إجمالي الدين','Total debt']].map(([key,ar,label])=>
   '<label class="sr-field"><span>'+escape(tr(ar,label,en))+'</span><select data-demo-adjust="'+key+'">'+
    [-20,-15,-10,-5,0,5,10,15,20].map(n=>'<option value="'+n+'"'+(n===0?' selected':'')+'>'+((n>0?'+':'')+n)+'%</option>').join('')+
   '</select></label>').join('')+'</div><small>'+escape(tr('تُحسب التغييرات على بيانات افتراضية فقط؛ قد تظهر تسويات مرفوضة عند تغيير الافتراضات.','Synthetic data only; accounting reconciliations may reject inconsistent assumptions.',en))+'</small></fieldset>'+
  '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">'+
  '<button type="button" id="srFinanceLabRun">'+escape(tr('جرّب التحليل المالي','Run financial-analysis demo',en))+'</button>'+
  '<button type="button" id="srFinanceLabPrint" hidden>'+escape(tr('عرض التقرير التجريبي / حفظ PDF','Print synthetic report / PDF',en))+'</button>'+
  '<button type="button" id="srFinanceLabClear" class="sr-secondary">'+escape(tr('إنهاء التجربة','Clear demo',en))+'</button></div>'+
  '<div id="srFinanceLabMessage" role="status" aria-live="polite"></div>'+
  '<div id="srFinanceLabResults" style="overflow-x:auto" hidden></div></section>';
 const choose=host.querySelector('#srFinanceLabScenario');
 const run=host.querySelector('#srFinanceLabRun'),print=host.querySelector('#srFinanceLabPrint');
 const clear=host.querySelector('#srFinanceLabClear');
 const msg=host.querySelector('#srFinanceLabMessage'),result=host.querySelector('#srFinanceLabResults');
 let data=null;
 choose.addEventListener('change',()=>{data=null;result.replaceChildren();result.hidden=true;print.hidden=true;msg.textContent='';});
 clear.addEventListener('click',()=>{host.querySelectorAll('[data-demo-adjust]').forEach(el=>{el.value='0';});data=null;choose.value='healthy';result.replaceChildren();result.hidden=true;print.hidden=true;msg.textContent=tr('تم مسح العرض التجريبي محليًا؛ لم يُنشأ سجل أو تقرير محفوظ.','Demo cleared locally; no saved record or report was created.',en);});
 run.addEventListener('click',async()=>{
  data=null;print.hidden=true;result.hidden=true;
  run.disabled=true;msg.textContent=tr('جاري فحص القوائم والمحرك المالي...','Checking the statements and financial engine...',en);
  try{
   const parameters=new URLSearchParams({scenario:choose.value});
   host.querySelectorAll('[data-demo-adjust]').forEach(control=>{if(Number(control.value)!==0)parameters.set(control.dataset.demoAdjust,control.value);});
   const response=await fetch('/api/v3/services/financial-analysis/demo?'+parameters.toString(),{
    method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
    headers:{'Accept':'application/json'}
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
   const value=await response.json();
   if(value.mode!=='LOCAL_SYNTHETIC_SIMULATION'||value.non_persistent!==true||
      value.saved!==false||value.audit?.database_writes!==0||value.scenario!==choose.value||
      !Array.isArray(value.periods)||value.periods.length!==3)throw new Error('INVALID_LAB_RESPONSE');
   data=value;
   msg.textContent=tr('نجحت عملية المحاكاة. البيانات التجريبية لم تُحفظ.','Simulation calculated. Synthetic data was not saved.',en);
   const last=value.periods[2],checks=last.audit.map(a=>[
    tr(...(controlNames[a.code]||[a.code,a.code]),en),a.status,
    a.difference===null?'—':num(a.difference)]);
   const showcase=['revenue','cogs','operating_expenses','operating_income','ebitda','net_income','total_assets',
    'total_liabilities','equity','current_assets','current_liabilities','cash','total_debt'];
   const fields=showcase.map(key=>'<label class="sr-field"><span>'+escape(name(key,en))+'</span>'+
    '<input type="text" value="'+escape(num(last.inputs[key]))+'" readonly aria-label="'+escape(name(key,en))+'"></label>').join('');
   const ratios=['current_ratio','quick_ratio','debt_to_equity','interest_coverage','net_margin_pct','revenue_growth_pct'];
   const ratiosTable=tab([tr('المؤشر','Metric',en),tr('النتيجة','Value',en)],
    ratios.map(key=>[name(key,en),num(last.metrics[key])]));
   const danger=value.completeness.consistency==='REJECTED';
   result.innerHTML='<h4>'+escape(tr(...cases[value.scenario],en))+'</h4>'+
    '<p><strong>'+escape(tr('النتيجة: ','Result: ',en))+'</strong>'+
    escape(value.completeness.consistency)+' — '+escape(value.completeness.analysis_status)+'</p>'+
    '<h4>'+escape(tr('القيم التجريبية لعام 2026 (قراءة فقط)','2026 sample values (read-only)',en))+'</h4>'+
    '<div class="sr-intake-table">'+fields+'</div>'+
    '<h4>'+escape(tr('المؤشرات المحسوبة','Computed ratios',en))+'</h4>'+ratiosTable+
    '<h4>'+escape(tr('فحص الاتساق بين القوائم','Cross-statement controls',en))+'</h4>'+
    tab([tr('الاختبار','Control',en),tr('النتيجة','Status',en),tr('الفرق','Difference',en)],checks)+
    '<p>'+escape(tr('تحليل ثلاثة أعوام، مقارنة زمنية، التدفق النقدي وجودة الأرباح، خدمة الدين والحساسية متاحة في التقرير التجريبي.','Three-year comparisons, cash flow, earnings quality, debt service and sensitivity appear in the sample report.',en))+'</p>'+
    (danger?'<p role="alert" style="font-weight:bold;color:#a63b3b">'+
      escape(tr('رفض الاعتماد بسبب اختلافات محاسبية: ','Approval rejected due to accounting conflicts: ',en))+
      escape(value.periods.flatMap(p=>p.validation.errors.map(e=>e.code)).filter((v,i,a)=>a.indexOf(v)===i).join('، '))+'</p>':'')+
    '<p style="font-size:12px">'+escape(tr('إيضاح: هذه محاكاة لا تُرفع كبيانات عميل ولا تُرسل إلى مسار الحفظ.','Disclosure: synthetic results are never posted to customer storage or execution.',en))+'</p>';
   result.hidden=false;print.hidden=false;
  }catch(error){
   msg.textContent=tr('تعذر تشغيل المختبر: ','Lab failed: ',en)+error.message;
  }finally{run.disabled=false;}
 });
 print.addEventListener('click',()=>{
  if(!data)return;
  const w=root.open('','_blank');
  if(!w){msg.textContent=tr('اسمح بفتح نافذة التقرير','Allow the report window',en);return;}
  w.document.open();w.document.write(report(data,en));w.document.close();w.focus();w.print();
 });
}
root.BondsFinancialAnalysisLab={mount,renderReport:report};
})(window);
