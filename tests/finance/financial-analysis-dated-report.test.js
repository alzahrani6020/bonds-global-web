'use strict';
const {financialAnalysis}=require('../../lib/finance/engines/financial-analysis-engine');
const {render}=require('../../components/financial-analysis-report');
const inputs={revenue:1200000,current_assets:400000,current_liabilities:200000};
const metrics=financialAnalysis(inputs,{serviceCode:'financial_analysis'});
const base={
 executed:true,
 result:{engineResults:{financial_analysis:metrics}},
 dataset:{inputs_used:inputs,source:{type:'file',file_name:'statements.xlsx',file_version:'sha256:test'},
 dataset_id:'synthetic-test',field_provenance:[]},
 dataset_persistence:{status:'unverified'}
};
test('source-dated 2024-2026 table and growth only from documented year columns',()=>{
 const x={...base,dataset:{...base.dataset,field_provenance:[
  {field:'revenue',status:'extracted_multi_period',
   period:'2026',period_values:{'2024':1000000,'2025':1100000,'2026':1200000},
   source:[{row:2,column:2,period:'2026'}]},
  {field:'net_income',status:'extracted_multi_period',
   period:'2026',period_values:{'2024':100000,'2025':120000,'2026':144000},
   source:[{row:3,column:2,period:'2026'}]}
 ]}};
 const html=render(x,'ar');
 expect(html).toContain('مقارنة بنود القوائم عبر السنوات الموثقة');
 expect(html).toContain('<th>2026</th><th>2025</th><th>2024</th>');
 expect(html).toContain('1,200,000');
 expect(html).toContain('1,100,000');
 expect(html).toContain('1,000,000');
 expect(html).toContain('20%');
 expect(html).toContain('9.0909%');
 expect(html).toContain('في المستند');
 expect(html).not.toContain('تم التحقق من حفظ النتائج واسترجاعها');
});
test('cannot fabricate dated multi-year comparisons from a single-year manual input',()=>{
 const html=render(base,'ar');
 expect(html).toContain('لم يُثبت وجود سنتين ماليتين أو أكثر');
 expect(html).not.toContain('<th>2026</th><th>2025</th>');
 expect(html).toContain('غير قابل');
});
test('an unresolved source period or conflicted row does not enter the dated table',()=>{
 const x={...base,dataset:{...base.dataset,field_provenance:[
  {field:'revenue',status:'multi_period',
   period_values:{'2025':1100000,'2026':1200000}},
  {field:'net_income',status:'conflict',period_values:{'2026':144000,'2025':120000}}
 ]}};
 const html=render(x,'ar');
 expect(html).toContain('لم يُثبت وجود سنتين ماليتين أو أكثر');
 expect(html).not.toContain('<th>2026</th><th>2025</th>');
});
