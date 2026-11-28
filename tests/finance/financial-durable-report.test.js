/** @jest-environment node */
'use strict';
const crypto=require('node:crypto');
const {servicesRouter}=require('../../v3/api/services');
const ID='11111111-1111-4111-8111-111111111111';
const OWNER='22222222-2222-4222-8222-222222222222';
function fixture(){
 return {
  id:ID,user_id:OWNER,service_code:'financial_analysis',
  status:'executed',approval_status:'approved',quality_status:'unverified',
  is_stale:false,dataset_version:3,source_file_name:'source.pdf',input_hash:'stable-hash',
  reviewed_values:{revenue:4668768.78,total_assets:2250000,total_liabilities:900000,equity:1350000},
  field_provenance:{fields:[{field:'revenue',value:4668768.78,document_disclaimer:'source_figures_unverified'}]},
  validation:{valid:true,warnings:[{code:'FINANCIAL_SOURCE_UNVERIFIED'}]},
  execution_result:{
   executed:true,execution_status:'automated',
   metrics:{gross_margin_pct:22.891876,net_margin_pct:13.639124,current_ratio:2.214285,
    operating_cash_flow:1001532.44,net_cash_flow:573101.26},
   dataset:{source:{file_name:'source.pdf'},inputs_used:{revenue:4668768.78},field_provenance:[
    {field:'revenue',value:4668768.78,document_disclaimer:'source_figures_unverified'}]}
  }
 };
}
function harness(row=fixture()){
 let writes=0;
 const query=()=>({
  filters:[],patch:null,
  select(){return this;},
  update(patch){this.patch=patch;return this;},
  eq(key,value){this.filters.push([key,value]);return this;},
  is(key,value){this.filters.push([key,value]);return this;},
  async maybeSingle(){
   if(this.filters.some(([key,val])=>key==='user_id'&&val!==row.user_id)||
      this.filters.some(([key,val])=>key==='id'&&val!==row.id))
    return {data:null,error:null};
   if(this.patch){writes++;Object.assign(row,this.patch);return {data:{id:row.id},error:null};}
   return {data:row,error:null};
  }
 });
 const supabase={from:table=>{expect(table).toBe('financial_datasets');return query();}};
 function response(){
  const headers={};
  return {statusCode:200,headers,body:'',
   setHeader(k,v){headers[k]=v;},
   end(value){this.body=value;},
   json(){return JSON.parse(this.body);}
  };
 }
 async function call(method='POST',user={id:OWNER}){
  const res=response();
  await servicesRouter({method,url:'/api/v3/services/intake/datasets/'+ID+'/report',
   headers:{host:'localhost'}},res,'/services/intake/datasets/'+ID+'/report',supabase,user);
  return res;
 }
 return {row,call,getWrites:()=>writes};
}
describe('durable financial report contract',()=>{
 test('owner report creation persists actual Arabic HTML and verifies exact readback',async()=>{
  const h=harness();
  const res=await h.call();
  expect(res.statusCode).toBe(200);
  const payload=res.json();
  expect(payload.saved).toBe(true);
  expect(payload.report.format).toBe('html');
  expect(payload.report.dataset_id).toBe(ID);
  expect(payload.report.source_quality).toBe('unverified');
  expect(payload.report.html).toContain('تقرير التحليل المالي');
  expect(payload.report.html).toContain('المؤشرات المحسوبة');
  expect(payload.report.html).toContain('22.8919');
  expect(payload.report.sha256).toBe(crypto.createHash('sha256').update(payload.report.html).digest('hex'));
  expect(h.row.execution_result.report_artifact.sha256).toBe(payload.report.sha256);
  expect(h.getWrites()).toBe(1);
  const fetched=await h.call('GET');
  expect(fetched.statusCode).toBe(200);
  expect(fetched.json().report.html).toBe(payload.report.html);
  const reused=await h.call('POST');
  expect(reused.statusCode).toBe(200);
  expect(reused.json().reused).toBe(true);
  expect(h.getWrites()).toBe(1);
 });
 test('source provenance displays localized field/status and readable coordinates without changing raw values',async()=>{
  const h=harness();
  h.row.execution_result.dataset.field_provenance=[{
   field:'revenue',value:4668768.78,status:'extracted_multi_period',
   source:[{sheet:'text_parser',page:2,row:57,column:1,extraction_method:'text_parser'}]
  }];
  const before=JSON.stringify(h.row.reviewed_values);
  const response=await h.call();
  expect(response.statusCode).toBe(200);
  const html=response.json().report.html;
  expect(html).toContain('مستخرج من فترات متعددة');
  expect(html).toContain('طريقة القراءة: استخراج نصي');
  expect(html).toContain('الصفحة: 2');
  expect(html).toContain('النص المستخرج');
  expect(html).toContain('الإيرادات');
  expect(html).not.toContain('extracted_multi_period');
  expect(html).not.toContain('text_parser');
  expect(JSON.stringify(h.row.reviewed_values)).toBe(before);
 });
 test('financial result uses responsive cards with localized keys and unit markers',()=>{
  const fs=require('node:fs');
  const ui=fs.readFileSync('components/service-request.js','utf8');
  const css=fs.readFileSync('components/service-request.css','utf8');
  expect(ui).toContain("gross_margin_pct:lang==='ar'?'هامش مجمل الربح %'");
  expect(ui).toContain("roa_pct:lang==='ar'?'العائد على الأصول %'");
  expect(ui).toContain("typeof value==='number'&&/_pct$/.test(key)?' %':'')");
  expect(css).toContain('#srExecutionResult .financial-result-kpis{display:grid');
  expect(css).toContain('@media(max-width:600px)');
  for(const path of ['service-request.html','en/service-request.html',
    'my-bonds/workspace/index.html','en/my-bonds/workspace/index.html']){
    const html=fs.readFileSync(path,'utf8');
    expect(html).toContain('/components/service-request.css?v=3');
    expect(html).toContain('/components/service-request.js?v=55');
  }
 });
 test('owner is mandatory; other owner cannot create or read the report',async()=>{
  const h=harness();
  expect((await h.call('POST',null)).statusCode).toBe(401);
  expect((await h.call('POST',{id:'other-user'})).statusCode).toBe(404);
  expect((await h.call('GET',{id:'other-user'})).statusCode).toBe(404);
  expect(h.getWrites()).toBe(0);
 });
 test('unapproved or stale data cannot be represented as a report',async()=>{
  const h=harness({...fixture(),approval_status:'draft'});
  const first=await h.call();
  expect(first.statusCode).toBe(409);
  expect(first.json().error.code).toBe('FINANCIAL_REPORT_REQUIRES_VERIFIED_EXECUTION');
  expect(h.getWrites()).toBe(0);
  const stale=harness({...fixture(),is_stale:true});
  expect((await stale.call()).statusCode).toBe(409);
  expect(stale.getWrites()).toBe(0);
 });
 test('before generation GET does not create or pretend that a report exists',async()=>{
  const h=harness();
  const res=await h.call('GET');
  expect(res.statusCode).toBe(404);
  expect(res.json().error.code).toBe('FINANCIAL_REPORT_NOT_GENERATED');
  expect(h.getWrites()).toBe(0);
 });
 test('corrupted stored HTML is rejected on GET and POST without rewriting data',async()=>{
  const h=harness();
  expect((await h.call()).statusCode).toBe(200);
  const original=h.row.execution_result.report_artifact;
  h.row.execution_result.report_artifact={...original,html:original.html+'<p>tampered</p>'};
  const readsBefore=h.getWrites();
  for(const method of ['GET','POST']){
   const response=await h.call(method);
   expect(response.statusCode).toBe(409);
   expect(response.json().error.code).toBe('FINANCIAL_REPORT_INTEGRITY_FAILED');
  }
  expect(h.getWrites()).toBe(readsBefore);
 });
 test('stale artifact version is rejected rather than silently reused',async()=>{
  const h=harness();
  expect((await h.call()).statusCode).toBe(200);
  h.row.dataset_version+=1;
  for(const method of ['GET','POST']){
   const response=await h.call(method);
   expect(response.statusCode).toBe(409);
   expect(response.json().error.code).toBe('FINANCIAL_REPORT_INTEGRITY_FAILED');
  }
  expect(h.getWrites()).toBe(1);
 });
 test('generation failure is explicitly fail-closed in the execution endpoint',()=>{
  const fs=require('node:fs');
  const api=fs.readFileSync('v3/api/services.js','utf8');
  expect(api).toContain("error:{code:'FINANCIAL_REPORT_GENERATION_FAILED'}");
  expect(api).toContain("throw new Error('FINANCIAL_REPORT_INVALID_HTML')");
 });
 test('restoration result reflects actual report persistence, not metrics readback alone',async()=>{
  const fs=require('node:fs');
  const vm=require('node:vm');
  const source=fs.readFileSync('components/service-request.js','utf8');
  const start=source.indexOf('async function restoreSavedFinancialResult(');
  const end=source.indexOf('async function reprocessLatestSavedFinancialFile(',start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const query={select(){return this;},eq(){return this;},is(){return this;},
   order(){return this;},limit(){return this;},async maybeSingle(){return {data:{
    id:ID,dataset_version:3,source_file_name:'source.pdf',quality_status:'unverified',
    reviewed_values:{revenue:100},execution_result:{executed:true,metrics:{gross_margin_pct:20},dataset:{}}
   },error:null};}};
  let rendered=0;
  for(const reportReady of [false,true]){
   const context={serviceCode:'financial_analysis',intakeDatasetId:null,lang:'en',
    params:{get:()=>null},T:{login:'Sign in'},
    window:{BondsAuth:{ensureEnv:async()=>{},getUser:async()=>({data:{user:{id:OWNER}}}),
     getSupabase:()=>({from:()=>query})}},
    $:()=>null,renderExecutionResult:()=>{rendered++;},
    ensureSavedFinancialReport:async()=>reportReady,showStatus:()=>{},escapeHtml:value=>value};
   const restore=vm.runInNewContext('('+source.slice(start,end).trim()+')',context);
   expect(await restore({scroll:false,silent:false})).toBe(reportReady);
  }
  expect(rendered).toBe(2);
 });
 test('front-end embeds saved report and offers PDF print only after verified save',()=>{
  const fs=require('node:fs');
  const source=fs.readFileSync('components/service-request.js','utf8');
  const api=fs.readFileSync('v3/api/services.js','utf8');
  expect(source).toContain('async function ensureSavedFinancialReport(');
  expect(source).toContain("renderExecutionResult(payload);\n  const reportReady=await ensureSavedFinancialReport(data.id,scroll);");
  expect(source).toContain('return reportReady;');
  expect(source).not.toContain("renderExecutionResult(payload);\n  await ensureSavedFinancialReport(data.id,scroll);");
  expect(source).toContain("frame.srcdoc=result.report.html");
  expect(source).toContain("frame.setAttribute('sandbox','allow-modals')");
  expect(source).toContain("await ensureSavedFinancialReport(intakeDatasetId,true)");
  expect(api).toContain('execution_result: executionToPersist');
  expect(api).toContain('report_artifact:artifact');
 });
});