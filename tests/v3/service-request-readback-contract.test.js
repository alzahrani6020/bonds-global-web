/** @jest-environment node */
'use strict';
const fs = require('fs');
const path = require('path');
const read = name => fs.readFileSync(path.join(process.cwd(), name), 'utf8');

describe('service request persistence and readback contracts', () => {
  const api = read('v3/api/services.js');
  const client = read('components/service-request.js');

  test('GET resolves exact request reference after authenticated owner filtering', () => {
    const start = api.indexOf('async function handleServiceRequests(');
    const end = api.indexOf('function defaultRequestProfileForService(', start);
    const handler = api.slice(start, end);
    expect(handler).toContain("if (!user) return sendJson(res, 401");
    expect(handler).toContain(".eq('user_id', user.id)");
    expect(handler).toContain("query.eq('request_reference', reference).limit(1)");
    expect(handler).toContain(".eq('service_request_id', requests[0].id)");
    expect(handler).toContain("...(reference ? { values: savedValues } : {})");
    expect(handler).toContain("if (valuesError) return sendJson(res, 500");
  });

  test('client does not report success until server-side readback matches sent inputs', () => {
    expect(client).toContain('async function confirmServiceRequestReadback(reference,expected,headers,workspaceBinding=null)');
    expect(client).toContain("result.requests[0].request_reference!==reference");
    expect(client).toContain('Object.prototype.hasOwnProperty.call(saved,key)');
    expect(client).toContain('JSON.stringify(saved[key])===JSON.stringify(expected[key])');
    expect(client).toContain('if(verified){\n  clearWorkspaceDraft();\n  showStatus(T.sent+');
    expect(client).toContain('await finalizeServiceRequestCreation(d,requestBody.values,headers');
    expect(client).toContain('await finalizeServiceRequestCreation(d,values,headers)');
  });

  test('service discovery preserves vetted workflow context during workspace routing', () => {
    const discovery = read('components/service-discovery.js');
    for (const key of ['project_id','deal_id','opportunity_id','company_id','client_id','funding_case_id','request_id','return_to']) {
      expect(discovery).toContain("'"+key+"'");
    }
    expect(discovery).toContain("const incoming = new URLSearchParams(window.location.search)");
    expect(discovery).toContain("params.set(key, value)");
    expect(discovery).toContain("routeWithParams(directRoute,params)");
  });

  test('both language and workspace routes use the same cache-busted client', () => {
    for (const route of ['service-request.html','en/service-request.html','my-bonds/workspace/index.html','en/my-bonds/workspace/index.html']) {
      expect(read(route)).toContain('/components/service-request.js?v=49');
    }
    expect(read('sw.js')).toContain("'/components/service-request.js?v=49'");
  });
});

// Guided financial choices and review retain the original request contract.
{
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

}
