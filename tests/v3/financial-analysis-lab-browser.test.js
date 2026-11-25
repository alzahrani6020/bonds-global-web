/** @jest-environment node */
'use strict';
const {chromium}=require('playwright');
const {scenarioResult}=require('../../lib/finance/financial-analysis-lab');
const {resolveBaseUrl,stopSpawnedServer}=require('../helpers/local-dev-server');
jest.setTimeout(150000);
let browser,baseUrl;
beforeAll(async()=>{baseUrl=await resolveBaseUrl();browser=await chromium.launch({headless:true});});
afterAll(async()=>{await browser?.close();stopSpawnedServer();});
async function openLab(mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
 await context.addInitScript(()=>{
  const user={id:'synthetic-lab-test',email:'test@example.invalid'};
  window.BondsAuth={
   ensureEnv:async()=>{},
   getUser:async()=>({data:{user}}),
   getSupabase:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-fixture-token'}}})}})
  };
 });
 const page=await context.newPage();
 const writes=[];
 page.on('request',request=>{
  if(request.method()!=='GET'&&/\/api\/v3\/services\/(?:intake|execute|requests)/.test(request.url())){
   writes.push({method:request.method(),url:request.url()});
  }
 });
 await page.route('**/bonds-auth-2026.js*',route=>route.abort());
 await page.route('**/api/v3/services/financial_analysis*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({
   service:{code:'financial_analysis',name_ar:'التحليل المالي',name_en:'Financial analysis',delivery_type:'automated'},
   workspace:{type:'financial-analysis',mode:'execute',ready:true},
   intake:{supported:true,execution_mode:'automated'},capabilities:[{capability_code:'financial_analysis_run'}],
   procedures:[],requirements:[],deliverables:[],dependencies:[],pricing:[],form:null
  })
 }));
 await page.route('**/api/v3/services/financial-analysis/demo?*',route=>{
  const url=new URL(route.request().url());
  return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify(scenarioResult(url.searchParams.get('scenario')||'healthy'))});
 });
 await page.route('**/api/v3/catalog/countries*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({countries:[{code:'SA',name_ar:'السعودية',name_en:'Saudi Arabia'}]})
 }));
 await page.route('**/api/v3/catalog/cities*',route=>route.fulfill({
  status:200,contentType:'application/json',body:'{"cities":[]}'
 }));
 await page.route('**/api/v3/investment-taxonomy*',route=>route.fulfill({
  status:200,contentType:'application/json',body:'{"sectors":[],"activities":[]}'
 }));
 await page.goto(new URL('/my-bonds/workspace/?service=financial_analysis&country=SA',baseUrl).toString(),{waitUntil:'domcontentloaded'});
 await page.locator('#srFinanceLabRun').waitFor({state:'visible',timeout:20000});
 return {context,page,writes};
}
describe('financial-analysis isolated demo browser acceptance',()=>{
 test('visible on desktop, displays real synthetic figures, clean clear, never writes',async()=>{
  const {context,page,writes}=await openLab();
  await page.locator('#srFinanceLabRun').click();
  await page.locator('#srFinanceLabResults input[readonly]').first().waitFor({state:'visible'});
  expect(await page.locator('#srFinanceLabResults input[readonly]').count()).toBeGreaterThan(10);
  expect(await page.locator('#srFinanceLabResults').innerText()).toContain('2,545');
  expect(await page.locator('#srFinanceLabPrint').isVisible()).toBe(true);
  expect(writes).toHaveLength(0);
  await page.locator('#srFinanceLabClear').click();
  expect(await page.locator('#srFinanceLabResults').isVisible()).toBe(false);
  expect(writes).toHaveLength(0);
  await context.close();
 });
 test('mobile contradiction scenario is rejected visibly without saving',async()=>{
  const {context,page,writes}=await openLab(true);
  await page.locator('#srFinanceLabScenario').selectOption('inconsistent');
  await page.locator('#srFinanceLabRun').click();
  const result=page.locator('#srFinanceLabResults');
  await result.waitFor({state:'visible'});
  expect(await result.innerText()).toContain('REJECTED');
  expect(await result.getByRole('alert').count()).toBe(1);
  expect(writes).toHaveLength(0);
  await context.close();
 });
});
