const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../components/service-request.js'),'utf8');
const start=source.indexOf('function financialFriendlyField(');
const end=source.indexOf('function renderRequestProfileField(',start);
const fn=source.slice(start,end);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,match=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[match]));
const run=(field,locale='ar',service='financial_analysis')=>{
 const context={serviceCode:service,lang:locale,escapeHtml,Date};
 vm.createContext(context);
 vm.runInContext(fn,context);
 return context.financialFriendlyField(field,field.label_ar||field.label_en,'Required');
};
describe('guided financial intake fields',()=>{
 test('uses the existing period key and an editable year suggestion list',()=>{
  const html=run({field_key:'analysis_period',field_type:'text',label_ar:'الفترة محل التحليل',is_required:true});
  expect(html).toContain('name="analysis_period"');
  expect(html).toContain('<datalist ');
  expect(html).toContain('required');
  expect(html).toContain('ما الفترة التي تريد تحليلها؟');
 });
 test('uses the existing analysis goal key and localized accessible choices',()=>{
  const html=run({field_key:'analysis_objective',label_ar:'هدف التحليل',is_required:true});
  expect(html).toContain('name="analysis_objective"');
  expect(html).toContain('تحليل مالي شامل');
  expect(html).toContain('list="srFriendlyOptions_analysis_objective"');
  const en=run({field_key:'analysis_objective',label_en:'Analysis objective'},'en');
  expect(en).toContain('Comprehensive financial analysis');
 });
 test('keeps optional notes in an editable disclosure',()=>{
  const html=run({field_key:'additional_notes',label_ar:'ملاحظات إضافية',is_required:false});
  expect(html).toContain('<details ');
  expect(html).toContain('name="additional_notes"');
  expect(html).toContain('<textarea ');
 });
 test('does not modify unrelated or other-service fields',()=>{
  expect(run({field_key:'company_name',label_ar:'اسم الشركة'})).toBeNull();
  expect(run({field_key:'analysis_period',label_ar:'الفترة محل التحليل'},'ar','feasibility_studies')).toBeNull();
 });
 test('review groups preserve source, candidate, and correction field rendering',()=>{
  expect(source).toContain('renderIntakeReviewField(field)');
  expect(source).toContain('data-intake-field=');
  expect(source).toContain('sr-review-group');
  expect(source).toContain('confirmed.map(field=>renderIntakeReviewField(field))');
  expect(source).toContain('unresolved.map(field=>renderIntakeReviewField(field))');
 });
});
