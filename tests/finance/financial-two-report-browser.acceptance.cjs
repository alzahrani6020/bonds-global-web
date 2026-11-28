/**
 * Isolated financial two-report browser acceptance: no credentials or DB access.
 * Exercises the actual browser report/history functions with synthetic rows.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
function extract(begin,end){
 const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
 assert(a>=0&&b>a,'Missing real source function '+begin);
 return source.slice(a,b);
}
const productionFunctions=[
 extract('async function ensureSavedFinancialReport(', 'async function restoreSavedFinancialResult('),
 extract('async function restoreSavedFinancialResult(', 'async function loadFinancialReportHistory('),
 extract('async function loadFinancialReportHistory(', 'async function reprocessLatestSavedFinancialFile(')
].join('\n');
const A='11111111-1111-4111-8111-111111111111',B='33333333-3333-4333-8333-333333333333';
const OWNER='22222222-2222-4222-8222-222222222222',OTHER='99999999-9999-4999-8999-999999999999';
const rows=[
 {id:A,user_id:OWNER,service_code:'financial_analysis',status:'executed',approval_status:'approved',project_id:null,client_id:null,deleted_at:null,dataset_version:1,source_file_name:'synthetic-A.csv',last_executed_at:'2026-11-20T09:00:00Z',quality_status:'unverified',execution_result:{executed:true,metrics:{revenue:120000},dataset:{}},reviewed_values:{revenue:120000}},
 {id:B,user_id:OWNER,service_code:'financial_analysis',status:'executed',approval_status:'approved',project_id:null,client_id:null,deleted_at:null,dataset_version:2,source_file_name:'synthetic-B.csv',last_executed_at:'2026-11-21T09:00:00Z',quality_status:'unverified',execution_result:{executed:true,metrics:{revenue:240000},dataset:{}},reviewed_values:{revenue:240000}}
];
const htmlFor=id=>'<html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><h1>تقرير اختبار اصطناعي غير معتمد</h1><p>DATASET='+id+'</p><p>REVENUE='+(id===A?120000:240000)+'</p></body></html>';
const fixtureSetup=[
 "const $=s=>document.querySelector(s),lang='ar',serviceCode='financial_analysis',params=new URLSearchParams(),T={login:'LOGIN_REQUIRED'};",
 "let financialNewReportGeneration=0,intakeDatasetId=null;",
 "const rows=window.__rows,userId=window.__userId,requestLog=window.__requestLog=[];",
 "const sb={auth:{getSession:async()=>({data:{session:{access_token:'SYNTHETIC_TOKEN'}}})},from(table){",
 " if(table!=='financial_datasets')throw Error('Wrong table');const f=[];const q={",
 " select(){return q;},eq(k,v){f.push([k,v]);return q;},is(k,v){f.push([k,v]);return q;},order(){return q;},",
 " limit(n){q._limit=n;return q;},",
 " then(resolve,reject){const x=rows.filter(r=>f.every(([k,v])=>r[k]===v)).sort((a,b)=>b.last_executed_at.localeCompare(a.last_executed_at));return Promise.resolve({data:x.slice(0,q._limit||x.length),error:null}).then(resolve,reject);},",
 " async maybeSingle(){return {data:rows.find(r=>f.every(([k,v])=>r[k]===v))||null,error:null};}",
 " };return q;}};",
 "window.BondsAuth={ensureEnv:async()=>{},getUser:async()=>({data:{user:{id:userId}}}),getSupabase:()=>sb};",
 "window.fetch=async(url,options)=>{const id=String(url).match(/\\/datasets\\/([^/]+)\\/report/)?.[1];requestLog.push({id,method:options?.method,authorization:options?.headers?.Authorization});",
 " const row=rows.find(r=>r.id===id&&r.user_id===userId);return row?{ok:true,json:async()=>({report:{dataset_id:id,html:window.__reportHtml[id]}})}:{ok:false,json:async()=>({error:{code:'NOT_FOUND'}})};};",
 "function escapeHtml(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');}",
 "function showStatus(s){document.querySelector('#srStatus').textContent=s;}",
 "function renderExecutionResult(payload){document.querySelector('#srExecutionResult')?.remove();const host=document.createElement('section');host.id='srExecutionResult';",
 "const title=document.createElement('h2');title.textContent='التحليل المالي';const metric=document.createElement('p');metric.id='testRevenue';metric.textContent='REVENUE='+payload.metrics.revenue;host.append(title,metric);document.body.append(host);}"
].join('\n');
async function prepare(page,who=OWNER){
 await page.setContent('<html lang="ar"><body><button id="srBrowseFinancialReports">سجل التقارير المالية</button><div id="srFinancialReportHistory"></div><div id="srStatus"></div></body></html>');
 await page.evaluate(data=>{window.__rows=data.rows;window.__userId=data.who;window.__reportHtml=data.html;},{rows,who,html:{[A]:htmlFor(A),[B]:htmlFor(B)}});
 await page.addScriptTag({content:fixtureSetup+'\n'+productionFunctions+"\ndocument.querySelector('#srBrowseFinancialReports').addEventListener('click',loadFinancialReportHistory);"});
 await page.locator('#srBrowseFinancialReports').click();
}
async function check(page,id,revenue){
 await page.locator('#srFinancialReportHistorySelect').selectOption(id);
 await page.getByRole('button',{name:'فتح التقرير المحدد'}).click();
 const frame=page.locator('#srPersistedFinancialReport iframe');
 await frame.waitFor();
 assert.equal(await page.locator('#testRevenue').textContent(),'REVENUE='+revenue);
 assert((await frame.getAttribute('srcdoc')).includes('DATASET='+id),'Wrong report in iframe');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'تنزيل التقرير المحفوظ HTML'}).click()]);
 assert.equal(download.suggestedFilename(),'bonds-financial-report-'+id+'.html');
 const stream=await download.createReadStream(),buffers=[];
 for await(const c of stream)buffers.push(c);
 const exported=Buffer.concat(buffers).toString('utf8');
 assert(exported.includes('DATASET='+id)&&exported.includes('REVENUE='+revenue),'HTML content mismatch');
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('button',{name:'طباعة التقرير / حفظ PDF'}).click()]);
 await popup.waitForLoadState('domcontentloaded');
 assert((await popup.content()).includes('DATASET='+id),'Wrong printable document');
 const pdf=await popup.pdf({format:'A4',printBackground:true});
 assert(pdf.subarray(0,4).toString('ascii')==='%PDF'&&pdf.length>1000,'Invalid/empty printable PDF');
 await popup.close();
 return {id,htmlBytes:Buffer.byteLength(exported),pdfBytes:pdf.length};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({acceptDownloads:true});
  await prepare(page);
  assert.equal(await page.locator('#srFinancialReportHistorySelect option').count(),2);
  const first=await check(page,B,240000),second=await check(page,A,120000);
  const log=await page.evaluate(()=>window.__requestLog);
  assert.deepEqual(log.map(x=>x.id),[B,A]);
  assert(log.every(x=>x.method==='POST'&&x.authorization==='Bearer SYNTHETIC_TOKEN'));
  await page.close();
  // Fresh document and JS context: proves history can reopen after a new visit.
  const reopened=await browser.newPage({acceptDownloads:true});
  await prepare(reopened);
  const third=await check(reopened,A,120000),fourth=await check(reopened,B,240000);
  await reopened.close();
  const other=await browser.newPage();await prepare(other,OTHER);
  await other.getByText('لا توجد تقارير مالية محفوظة في مساحة العمل الحالية.').waitFor();
  assert.equal(await other.locator('#srFinancialReportHistorySelect').count(),0);
  await other.close();
  console.log('PASS SYNTHETIC_TWO_REPORT_BROWSER',JSON.stringify({first,second,third,fourth,otherTenant:'isolated',productionWrites:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL SYNTHETIC_TWO_REPORT_BROWSER',e);process.exitCode=1;});
