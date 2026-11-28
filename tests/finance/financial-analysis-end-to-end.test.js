'use strict';

const { financialAnalysis } = require('../../lib/finance/engines/financial-analysis-engine');
const { extractFinancialFields, validateDataset, requirementsFor } = require('../../lib/finance/financial-data-intake');
const { render } = require('../../components/financial-analysis-report');

describe('BONDS governed financial analysis end-to-end boundaries',()=>{
 const base={
  revenue:1000000,cogs:600000,operating_expenses:200000,
  operating_income:200000,ebitda:270000,net_income:120000,
  current_assets:300000,current_liabilities:150000,
  total_assets:900000,total_liabilities:500000,equity:400000,
  total_debt:250000,interest_expense:50000,cash:80000
 };
 test('conventional EBIT coverage is not mislabeled EBITDA coverage',()=>{
  const r=financialAnalysis(base,{serviceCode:'financial_analysis'});
  expect(r.executed).toBe(true);
  expect(r.metrics.interest_coverage).toBeCloseTo(4,10);
  expect(r.metrics.ebitda_interest_coverage).toBeCloseTo(5.4,10);
  expect(r.metrics.debt_to_equity).toBeCloseTo(.625,10);
  expect(r.metrics.liabilities_to_equity).toBeCloseTo(1.25,10);
 });
 test('quick liquidity requires observed inventory; no zero-inventory assumption',()=>{
  const r=financialAnalysis(base,{serviceCode:'financial_analysis'});
  expect(r.metrics.current_ratio).toBeCloseTo(2,10);
  expect(r.metrics.quick_ratio).toBeNull();
  expect(financialAnalysis({...base,inventory:45000},{serviceCode:'financial_analysis'}).metrics.quick_ratio).toBeCloseTo(1.7,10);
 });
 test('comprehensive intake extracts recognized optional statement fields with row sources',()=>{
  const parsed={
   sheet_name:'Statement',
   rows:[
    ['Revenue','1000000'],['Current Assets','300000'],['Current Liabilities','150000'],
    ['Net Income','120000'],['Total Liabilities','500000'],
    ['Cost of Goods Sold','600000'],['Inventory','45000'],
    ['Interest Expense','50000']
   ]
  };
  const x=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values).toMatchObject({revenue:1000000,current_assets:300000,
   current_liabilities:150000,net_income:120000,total_liabilities:500000,
   cogs:600000,inventory:45000,interest_expense:50000});
  expect(x.validation.valid).toBe(true);
  expect(x.fields.find(f=>f.field==='inventory').source[0]).toMatchObject({row:7,column:2});
  const required=requirementsFor({primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(required.requirement_fields).toContain('net_income');
  expect(required.requirement_fields).toContain('inventory');
  expect(required.requirement_fields).not.toContain('zakat_base');
 });
 test('year preceding a value must not replace the amount',()=>{
  const x=extractFinancialFields({parsed:{text:'Revenue 2026 1000000\nCurrent Assets 300000\nCurrent Liabilities 150000'},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values.revenue).toBe(1000000);
  const ambiguous=extractFinancialFields({parsed:{text:'Revenue 2026 1000000 2025 900000\nCurrent Assets 300000\nCurrent Liabilities 150000'},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(ambiguous.values.revenue).toBeUndefined();
  expect(ambiguous.validation.valid).toBe(false);
 });
 test('Arabic comparative text carries year and SAR table heading into extracted candidates',()=>{
  const parsed={text:[
   'البيان ديسمبر 2025 سبتمبر 2026',
   'ريال سعودي',
   '100 200 مجموع الالتزامات',
   '300 400 مجموع الموجودات',
   '200 200 مجموع حقوق الملكية',
   '500 1000 الإيرادات'
  ].join('\n')};
  const x=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values.total_liabilities).toBe(200);
  expect(x.values.total_assets).toBe(400);
  expect(x.values.revenue).toBe(1000);
  expect(x.values.prior_revenue).toBe(500);
  const revenue=x.fields.find(f=>f.field==='revenue');
  expect(revenue.period).toBe('2026');
  expect(revenue.currency).toBe('SAR');
  expect(revenue.candidates.map(c=>c.period)).toEqual(expect.arrayContaining(['2025','2026']));
 });
 test('three-statement Arabic PDF-shaped text preserves subtotals, evidence and incompatible comparison',()=>{
  const {qualityStatus}=require('../../lib/finance/financial-data-intake');
  const parsed={text:[
   'قائمة المركز المالي',
   'البيان ديسمبر 2025 سبتمبر 2026',
   'ريال سعودي',
   '1000 2250 مجموع الموجودات',
   '120 900 مجموع الالتزامات',
   '880 1350 مجموع حقوق الملكية',
   'قائمة الدخل والدخل الشامل',
   'عن فترة التسعة أشهر المنتهية في 30 سبتمبر 2026 مقارنة بالسنة المنتهية في 31 ديسمبر 2025',
   'البيان ديسمبر 2025 سبتمبر 2026',
   'ريال سعودي',
   '3737 4668 الإيرادات',
   '2160 3600 تكلفة الإيرادات',
   '550 390 المصروفات العمومية والإدارية',
   '560 415 مجموع المصروفات العمومية والإدارية',
   '995 636 صافي الربح بعد الزكاة',
   'قائمة التدفقات النقدية',
   'البيان ديسمبر 2025 سبتمبر 2026',
   'ريال سعودي',
   '995 636 صافي ربح السنة / الفترة بعد الزكاة',
   'أرقام عام 2026 مبنية على افتراضات غير مثبتة ولا تمثل قوائم مالية معتمدة'
  ].join('\n')};
  const result=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(result.values.revenue).toBe(4668);
  expect(result.values.operating_expenses).toBe(415);
  expect(result.values.net_income).toBe(636);
  expect(result.values.cash_flow_net_income).toBe(636);
  expect(result.values.prior_revenue).toBeUndefined();
  expect(result.values.prior_net_income).toBeUndefined();
  expect(result.fields.find(f=>f.field==='prior_revenue')).toMatchObject({
   status:'not_comparable',period:'2025',comparison_excluded:true
  });
  expect(result.validation.warnings.map(w=>w.code)).toEqual(expect.arrayContaining([
   'FINANCIAL_SOURCE_UNVERIFIED','COMPARATIVE_PERIOD_DURATION_MISMATCH'
  ]));
  expect(qualityStatus({validation:{valid:true,missing:[],unresolved:[]},
   fields:result.fields,reviewed:true,serviceCode:'financial_analysis',values:result.values})).toBe('unverified');
  expect(result.fields.find(f=>f.field==='revenue').currency).toBe('SAR');
 });
 test('currency and thousand-unit Excel headings scale amounts exactly once',()=>{
  const parsed={sheets:[{name:'Financials',rows:[
   ['البيان','2025','2026'],
   ['العملة','ريال سعودي','ريال سعودي'],
   ['وحدة العرض','بالألف','بالألف'],
   ['الإيرادات',100,200],
   ['مجموع الموجودات',300,400],
   ['مجموع الالتزامات',100,150],
   ['مجموع حقوق الملكية',200,250]
  ]}]};
  const r=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(r.values.revenue).toBe(200000);
  expect(r.values.total_assets).toBe(400000);
  expect(r.fields.find(f=>f.field==='revenue').currency).toBe('SAR');
  expect(r.fields.find(f=>f.field==='revenue').period).toBe('2026');
 });
 test('PDF text heading with explicit thousands scales its rows once',()=>{
  const parsed={text:[
   'البيان ديسمبر 2025 سبتمبر 2026',
   'المبالغ بالألف ريال سعودي',
   '100 200 الإيرادات',
   '200 400 مجموع الموجودات'
  ].join('\n')};
  const r=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(r.values.revenue).toBe(200000);
  expect(r.values.total_assets).toBe(400000);
  expect(r.fields.find(f=>f.field==='revenue').currency).toBe('SAR');
 });
 test('Arabic الفترة cannot create an implicit thousand multiplier',()=>{
  const parsed={text:[
   'البيان ديسمبر 2025 سبتمبر 2026',
   'ريال سعودي',
   '100 200 النقد وما في حكمه أول الفترة',
   '30 45 صافي ربح السنة / الفترة بعد الزكاة',
   'قائمة التدفقات النقدية',
   'البيان ديسمبر 2025 سبتمبر 2026',
   '30 45 صافي ربح السنة / الفترة بعد الزكاة'
  ].join('\n')};
  const r=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(r.values.opening_balance).toBe(200);
  expect(r.values.cash_flow_net_income).toBe(45);
 });
 test('RTL-reversed comparative headers keep annual and interim figures incomparable',()=>{
  const text=[
   'قائمة الدخل',
   '2025 ديسمبر 31 في المنتهية بالسنة مقارنة 2026 سبتمبر 30 في المنتهية أشهر التسعة فترة عن',
   'البيان',
   '30 2026 سبتمبر',
   '31 2025 ديسمبر',
   'سعودي ريال',
   'الإيرادات',
   '4668',
   '3737',
   'معتمدة مالية قوائم تمثل لا ، المنشأة بدفاتر مثبتة غير افتراضات على مبنية 2026 عام أرقام'
  ].join('\n');
  const parsed={text};
  const x=extractFinancialFields({parsed,primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  expect(x.values.revenue).toBe(4668);
  expect(x.values.prior_revenue).toBeUndefined();
  expect(x.fields.find(item=>item.field==='revenue').currency).toBe('SAR');
  expect(x.fields.find(item=>item.field==='prior_revenue')).toMatchObject({
   period:'2025',status:'not_comparable',comparison_excluded:true
  });
  expect(x.validation.warnings.map(item=>item.code)).toEqual(expect.arrayContaining([
   'FINANCIAL_SOURCE_UNVERIFIED','COMPARATIVE_PERIOD_DURATION_MISMATCH'
  ]));
 });
 test('original-PDF-shaped RTL three statements reconcile without uploading private document to GitHub',()=>{
  // Anonymous test numbers. Structure mimics the user's three-page, per-line
  // right-to-left PDF extraction, not a copy of their confidential statement.
  const rows=[
   'المالي المركز قائمة',
   'البيان','30 2026 سبتمبر','31 2025 ديسمبر','سعودي ريال',
   'حكمه في وما النقد','920,000.00','410,000.00',
   'المتداولة الموجودات مجموع','1,600,000.00','980,000.00',
   'الموجودات مجموع','2,400,000.00','1,800,000.00',
   'المتداولة الالتزامات مجموع','800,000.00','320,000.00',
   'الالتزامات مجموع','960,000.00','500,000.00',
   'الملكية حقوق مجموع','1,440,000.00','1,300,000.00',
   'الشامل والدخل الدخل قائمة',
   '2025 ديسمبر 31 في المنتهية بالسنة مقارنة 2026 سبتمبر 30 في المنتهية أشهر التسعة فترة عن',
   'البيان','30 2026 سبتمبر','31 2025 ديسمبر','سعودي ريال',
   'الإيرادات','5,000,000.00','4,200,000.00',
   'الإيرادات تكلفة','(3,500,000.00)','(2,700,000.00)',
   'إدارية والعمومية المصروفات','(380,000.00)','(440,000.00)',
   'والمعدات الممتلكات اك ل وإه اك ل استه','(20,000.00)','(10,000.00)',
   'إدارية والعمومية المصروفات مجموع','(400,000.00)','(450,000.00)',
   'الزكاة بعد الربح صافي','1,050,000.00','950,000.00',
   'النقدية التدفقات قائمة',
   '2025 ديسمبر 31 في المنتهية بالسنة مقارنة 2026 سبتمبر 30 في المنتهية أشهر التسعة فترة عن',
   'البيان','30 2026 سبتمبر','31 2025 ديسمبر','سعودي ريال',
   'الزكاة بعد الفترة السنة ربح صافي','1,050,000.00','950,000.00',
   'والمعدات الممتلكات اك ل وإه اك ل استه','20,000.00','10,000.00',
   'التشغيلية الأنشطة من الناتج النقد صافي','900,000.00','650,000.00',
   'الاستثمارية الأنشطة من الناتج النقد صافي','150,000.00','(300,000.00)',
   'التمويلية الأنشطة من الناتج النقد صافي','(540,000.00)','200,000.00',
   'الفترة أول حكمه في وما النقد','410,000.00','190,000.00',
   'الفترة آخر حكمه في وما النقد','920,000.00','740,000.00',
   'معتمدة مالية قوائم تمثل لا المنشأة بدفاتر مثبتة غير افتراضات على مبنية 2026 عام أرقام'
  ];
  const {deriveFinancialInputs}=require('../../lib/finance/financial-data-intake');
  const x=extractFinancialFields({parsed:{text:rows.join('\n')},
    primaryAction:'financial_analysis_run',serviceCode:'financial_analysis'});
  const expected={
   total_assets:2400000,total_liabilities:960000,equity:1440000,
   current_assets:1600000,current_liabilities:800000,cash:920000,
   revenue:5000000,cogs:3500000,operating_expenses:400000,net_income:1050000,
   depreciation_amortization:20000,cash_flow_net_income:1050000,
   opening_balance:410000,ending_cash:920000,
   operating_cash_flow:900000,investing_cash_flow:150000,financing_cash_flow:-540000
  };
  for(const [field,value] of Object.entries(expected))
    expect(x.values[field]).toBe(value);
  expect(x.values.prior_revenue).toBeUndefined();
  expect(x.fields.find(item=>item.field==='prior_revenue')).toMatchObject({
   status:'not_comparable',comparison_excluded:true
  });
  expect(x.validation.errors).toEqual([]);
  expect(x.validation.warnings.map(w=>w.code)).toEqual(expect.arrayContaining([
   'FINANCIAL_SOURCE_UNVERIFIED','COMPARATIVE_PERIOD_DURATION_MISMATCH'
  ]));
  const derived=deriveFinancialInputs(x.values,x.fields);
  expect(derived.values.operating_income).toBe(1100000);
  expect(derived.values.ebitda).toBe(1120000);
  expect(x.fields.find(item=>item.field==='financing_cash_flow').currency).toBe('SAR');
 });
 test('traditional interest coverage requires EBIT, not only EBITDA',()=>{
  const report=financialAnalysis({ebitda:250000,interest_expense:50000},{serviceCode:'interest_coverage_analysis'});
  expect(report.executed).toBe(false);
  expect(report.required_inputs).toContain('operating_income');
 });
 test('missing core inputs remain fail closed',()=>{
  const validation=validateDataset({primaryAction:'financial_analysis_run',
    serviceCode:'financial_analysis',values:{net_income:120000},fields:[]});
  expect(validation.valid).toBe(false);
  expect(validation.missing).toEqual(expect.arrayContaining(['revenue','current_assets','current_liabilities']));
 });
 test('report contains only real execution metrics, escaped Arabic input and evidence status',()=>{
  const calculated=financialAnalysis(base,{serviceCode:'financial_analysis'});
  const p={executed:true,result:{engineResults:{financial_analysis:calculated}},dataset:{
   dataset_id:'test-1',dataset_version:1,input_hash:'hash',
   inputs_used:{revenue:1000000,project_name:'<svg onload=alert(1)>'},
   source:{file_name:'القوائم المالية 2026.xlsx',file_version:'sha256:abc'},
   field_provenance:[{field:'revenue',value:1000000,status:'extracted',source:[{sheet:'2026',row:3,column:2}]}]
  },dataset_persistence:{status:'saved',verified:true,dataset_id:'test-1'}};
  const html=render(p,'ar');
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('القوائم المالية 2026.xlsx');
  expect(html).toContain('التحليل المالي');
  expect(html).toContain('4</td>');
  expect(html).toContain('&lt;svg onload=alert(1)&gt;');
  expect(html).not.toContain('<svg onload=alert(1)>');
  expect(html).toContain('تم التحقق من حفظ النتائج');
  p.dataset.field_provenance=[{
   field:'revenue',value:1000000,document_disclaimer:'source_figures_unverified',
   source:[{sheet:'Statement',row:4}]
  },{
   field:'prior_revenue',value:800000,comparison_excluded:true,
   comparison_reason:'unequal_reporting_duration',source:[{sheet:'Statement',row:4}]
  }];
  const cautioned=render(p,'ar');
  expect(cautioned).toContain('الأرقام مبنية على افتراضات');
  expect(cautioned).toContain('فترة التقرير تسعة أشهر');
  const english=render(p,'en');
  expect(english).toContain('Financial Analysis Report');
  p.dataset_persistence={status:'unverified'};
  expect(render(p,'ar')).toContain('الحفظ غير مؤكد');
  expect(()=>render({executed:false,result:{metrics:{revenue:100}}})).toThrow(/REQUIRES_EXECUTED_METRICS/);
 });
 test('financial analysis UI cannot label an unverified update as saved',()=>{
  const fs=require('fs'),path=require('path');
  const client=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
  const api=fs.readFileSync(path.join(__dirname,'../../v3/api/services.js'),'utf8');
  expect(client).toContain("if(serviceCode==='financial_analysis')");
  expect(client).toContain("id=\"srPrintFinancialAnalysis\"");
  expect(client).toContain("BondsFinancialAnalysisReport.render(payload,lang)");
  expect(api).toContain("FINANCIAL_DATASET_SAVE_UNCONFIRMED");
  expect(api).toContain("FINANCIAL_DATASET_READBACK_MISMATCH");
  expect(api).toContain("readback.input_hash!==inputHash");
  expect(api).toContain('result.body?.result?.engineResults?.[targetProfile?.requirements?.engine_code]?.metrics');
 });
});
