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

  test('approved Excel exports retain field provenance and comparability warnings',()=>{
    expect(api).toContain("'Field Provenance'");
    expect(api).toContain("'Validation Warnings'");
    expect(api).toContain('comparison_excluded:row.comparison_excluded===true');
    expect(api).toContain('source_disclaimer:row.document_disclaimer||');
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
      expect(read(route)).toContain('/components/service-request.js?v=51');
    }
    expect(read('sw.js')).toContain("'/components/service-request.js?v=51'");
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
  expect(html).toContain('data-financial-choice-for="analysis_period"');
  expect(html).toContain('إدخال قيمة أخرى يدويًا');
  expect(html).toContain('required');
  expect(html).toContain('ما الفترة التي تريد تحليلها؟');
 });
 test('uses the existing analysis goal key and localized accessible choices',()=>{
  const html=run({field_key:'analysis_objective',label_ar:'هدف التحليل',is_required:true});
  expect(html).toContain('name="analysis_objective"');
  expect(html).toContain('تحليل مالي شامل');
  expect(html).toContain('data-financial-choice-for="analysis_objective"');
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
 test('supports actionable financial candidates and guarded derived suggestions',()=>{
  expect(source).toContain('selections:collectIntakeSelections()');
  expect(source).toContain('input.dataset.candidateIndex=select.value');
  expect(source).toContain('delete input.dataset.candidateIndex');
  expect(source).toContain('data-intake-candidate=');
  expect(source).toContain('data-intake-suggest=');
  expect(source).toContain("currencies.some(v=>!v)");
  expect(source).toContain("periods.some(v=>!v)");
  expect(source).toContain('const candidate=Array.isArray(record?.candidates)?record.candidates[Number(select.value)]:null');
  expect(source).toContain("total_expenses:lang==='ar'?'إجمالي المصروفات'");
  expect(source).toContain("payables:lang==='ar'?'الذمم الدائنة'");
 });
 test('financial derivation is blocked across reporting periods and preserves a valid period',()=>{
  const {deriveFinancialInputs}=require('../../lib/finance/financial-data-intake');
  const values={total_assets:300,total_liabilities:100};
  expect(deriveFinancialInputs(values).values.equity).toBe(200);
  const rows=[
   {field:'total_assets',value:300,status:'extracted',currency:'SAR',period:'2026'},
   {field:'total_liabilities',value:100,status:'extracted',currency:'SAR',period:'2025'}
  ];
  const conflicting=deriveFinancialInputs(values,rows);
  expect(conflicting.values.equity).toBeUndefined();
  rows[1].period='2026';
  const matching=deriveFinancialInputs(values,rows);
  expect(matching.values.equity).toBe(200);
  const equity=matching.fields.find(row=>row.field==='equity');
  expect(equity.period).toBe('2026');
  expect(equity.currency).toBe('SAR');
  rows[1].currency='USD';
  expect(deriveFinancialInputs(values,rows).values.equity).toBeUndefined();
 });
 test('approval verifies candidate index, value and source dimensions',()=>{
  const approval=read('v3/api/services.js');
  expect(approval).toContain('FINANCIAL_CANDIDATE_INDEX_INVALID');
  expect(approval).toContain('FINANCIAL_CANDIDATE_VALUE_MISMATCH');
  expect(approval).toContain("current.status = selectedCandidate ? 'selected_from_source' : 'corrected'");
  expect(approval).toContain("FINANCIAL_SELECTED_PERIOD_MISMATCH");
  expect(approval).toContain("method:'candidate_selection'");
 });
 test('unchanged source values are never recast as manual corrections',()=>{
  const vm=require('node:vm');
  const start=source.indexOf('function collectIntakeCorrections(){');
  const end=source.indexOf('async function uploadIntakeFile(',start);
  expect(start).toBeGreaterThan(-1);
  const inputs=[
   {dataset:{intakeField:'revenue'},value:'100'},
   {dataset:{intakeField:'current_assets'},value:'210'},
   {dataset:{intakeField:'cash'},value:''}
  ];
  const ctx={
   intakeReview:{fields:[
    {field:'revenue',value:100,status:'extracted'},
    {field:'current_assets',value:200,status:'extracted'},
    {field:'cash',value:50,status:'extracted'}
   ]},
   document:{querySelectorAll:()=>inputs}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start,end),ctx);
  const changed=ctx.collectIntakeCorrections();
  expect(changed.revenue).toBeUndefined();
  expect(changed.current_assets).toBe('210');
  expect(changed.cash).toBeNull();
 });
 test('saved financial PDF reanalysis uses authenticated owner, tenant scope and new dataset version',async()=>{
  const vm=require('node:vm');
  const start=source.indexOf('async function reprocessLatestSavedFinancialFile(){');
  const end=source.indexOf('async function prepareFinancialIntake(',start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const filters=[],button={disabled:false};
  const query={
   select(){return this;},eq(key,value){filters.push(['eq',key,value]);return this;},
   is(key,value){filters.push(['is',key,value]);return this;},
   order(){return this;},limit(){return this;},
   async maybeSingle(){return {data:{
    id:'source-dataset',source_file_name:'test.pdf',source_storage_path:'financial-intake/test-user/doc.pdf',
    source_mime_type:'application/pdf'
   }};}
  };
  const sb={
   from:table=>{expect(table).toBe('financial_datasets');return query;},
   auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}
  };
  let sent=null,shown=null;
  const ctx={
   serviceCode:'financial_analysis',submitting:false,lang:'ar',T:{login:'Login'},
   '
  expect(source).toContain("if(serviceCode==='financial_analysis'){");
  expect(source).toContain("document.body.classList.add('financial-review-wide')");
  expect(source).toContain('body.financial-review-wide .sr-grid{grid-template-columns:minmax(0,1fr)}');
 });
 test('review groups preserve source, candidate, and correction field rendering',()=>{
  expect(source).toContain('renderIntakeReviewField(field,fields)');
  expect(source).toContain('data-intake-field=');
  expect(source).toContain('sr-review-group');
  expect(source).toContain('confirmed.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('critical.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('supplemental.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('المطلوب لإكمال التحليل');
 });
});

}
:()=>button,params:{get:()=>null},intakeDatasetId:null,intakeMode:'manual',
   window:{BondsAuth:{
    ensureEnv:async()=>{},getUser:async()=>({data:{user:{id:'test-user'}}}),
    getSupabase:()=>sb
   }},
   fetch:async(url,options)=>{
    sent={url,options,body:JSON.parse(options.body)};
    return {ok:true,json:async()=>({dataset_id:'next-dataset',fields:[]})};
   },
   renderIntakeReview:payload=>{shown=payload;},
   showStatus:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start,end),ctx);
  await ctx.reprocessLatestSavedFinancialFile();
  expect(filters).toEqual(expect.arrayContaining([
   ['eq','user_id','test-user'],
   ['eq','service_code','financial_analysis'],
   ['is','project_id',null],
   ['is','client_id',null]
  ]));
  expect(sent.url).toBe('/api/v3/services/intake/prepare');
  expect(sent.body.parent_dataset_id).toBe('source-dataset');
  expect(sent.body.storage_path).toBe('financial-intake/test-user/doc.pdf');
  expect(ctx.intakeDatasetId).toBe('next-dataset');
  expect(shown.dataset_id).toBe('next-dataset');
  expect(button.disabled).toBe(false);
 });
 test('financial analysis uses a full-width review without altering other workspaces',()=>{
  expect(source).toContain("if(serviceCode==='financial_analysis'){");
  expect(source).toContain("document.body.classList.add('financial-review-wide')");
  expect(source).toContain('body.financial-review-wide .sr-grid{grid-template-columns:minmax(0,1fr)}');
 });
 test('review groups preserve source, candidate, and correction field rendering',()=>{
  expect(source).toContain('renderIntakeReviewField(field,fields)');
  expect(source).toContain('data-intake-field=');
  expect(source).toContain('sr-review-group');
  expect(source).toContain('confirmed.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('critical.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('supplemental.map(field=>renderIntakeReviewField(field,fields))');
  expect(source).toContain('المطلوب لإكمال التحليل');
 });
});

}
