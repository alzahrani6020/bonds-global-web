'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'correspondence-campaigns.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'components/correspondence-campaigns-ui.js'),'utf8');
const workspace='11111111-1111-4111-8111-111111111111';
const campaignId='22222222-2222-4222-8222-222222222222';
const apiCalls=[];
const script=String.raw`
 window.BondsAuth={getSession:async()=>({data:{session:{access_token:'fake-test'}}})};
 window.confirm=()=>true;
`;
function accountState(){
 const campaigns=[],recipients=[];
 return {
  campaigns,recipients,
  async handler(route){
   const req=route.request(),url=new URL(req.url()),method=req.method();
   if(url.pathname==='/api/campaign-mailboxes'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mailboxes:[]})});
   }
   if(url.pathname==='/api/campaign-replies'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({replies:[]})});
   }
   if(url.pathname==='/api/campaign-dispatch'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({counts:{ready:0,accepted:0,unknown:0},jobs:[]})});
   }
   if(url.pathname!=='/api/campaigns')return route.fulfill({status:404,body:'Missing mock'});
   if(method==='GET'&&url.searchParams.has('mine'))return route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({workspaces:[{id:workspace,name:'BONDS',role:'owner'}]})});
   if(method==='GET'&&url.searchParams.has('workspace_id'))return route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({campaigns})});
   if(method==='GET'&&url.searchParams.has('id'))return route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({campaign:campaigns.find(c=>c.id===url.searchParams.get('id')),recipients})});
   if(method==='POST'){
    const payload=req.postDataJSON();
    if(payload.action==='create'){
      const campaign={id:campaignId,workspace_id:workspace,title:payload.title,kind:payload.kind,description:payload.description,status:'draft',subject_template:'',body_template:''};
      campaigns.push(campaign);
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({campaign})});
    }
    if(payload.action==='update'){
      Object.assign(campaigns[0],{title:payload.title,description:payload.description,subject_template:payload.subject_template,body_template:payload.body_template});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({campaign:campaigns[0]})});
    }
    if(payload.action==='add_recipients'){
      const added=payload.recipients.map((r,i)=>({id:'33333333-3333-4333-8333-33333333333'+(i+1),...r,status:'pending'}));
      recipients.push(...added);
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({recipients:added})});
    }
    if(payload.action==='prepare_draft'){
      const recipient=recipients.find(r=>r.id===payload.recipient_id);
      if(!recipient)return route.fulfill({status:404,body:'Missing recipient'});
      Object.assign(recipient,{status:'prepared',draft_document_id:'44444444-4444-4444-8444-444444444444'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({recipient,draft_document_id:recipient.draft_document_id})});
    }
   }
   return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'MOCK_ONLY'})});
  }
 };
}
describe('BONDS campaign visual browser acceptance (mock isolated)',()=>{
 let browser;
 beforeAll(async()=>{browser=await chromium.launch({headless:true});},30000);
 afterAll(async()=>{if(browser)await browser.close();},30000);
 async function open(width,height){
  const page=await browser.newPage({viewport:{width,height}});
  const state=accountState();
  await page.addInitScript({content:script});
  await page.route('**/correspondence-campaigns.html',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.route('**/components/correspondence-campaigns-ui.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:ui}));
  await page.route('**/api/env',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/bonds-auth-2026.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/api/campaign*',route=>state.handler(route));
  await page.goto('https://bonds-ui-preview.invalid/correspondence-campaigns.html');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('المركز جاهز'));
  return {page,state};
 }
 test('desktop: loads authorized BONDS workspace and creates persistent campaign, does not send',async()=>{
  const {page,state}=await open(1440,900);
  try{
    expect(await page.locator('#company option').count()).toBe(2);
    await page.locator('#title').fill('Clix investor financing');
    await page.locator('#create').click();
    await page.getByText('Clix investor financing',{exact:true}).first().waitFor();
    expect(state.campaigns).toHaveLength(1);
    expect(state.campaigns[0].workspace_id).toBe(workspace);
    expect(await page.locator('#dispatch').isDisabled()).toBe(true);
    expect(await page.locator('#detail').isVisible()).toBe(true);
    expect(await page.locator('#dispatch-status').textContent()).toContain('معلقة:');
    await page.waitForFunction(()=>document.querySelector('#reply-summary')?.textContent.includes('ردود مثبتة: 0'));
    expect(await page.locator('#reply-summary').textContent()).toContain('ردود مثبتة: 0');
    expect(await page.locator('#sync-replies').isDisabled()).toBe(true);
  }finally{await page.close();}
 },30000);
 test('reviewed template prepares a single independently addressed official draft',async()=>{
  const {page,state}=await open(1440,900);
  try{
    await page.locator('#title').fill('Clix institutional outreach');
    await page.locator('#create').click();
    await page.locator('#detail').waitFor({state:'visible'});
    await page.locator('#subject-template').fill('دعوة للتعاون مع {{organization}}');
    await page.locator('#body-template').fill('يسرنا بحث الفرص الاستثمارية والتعاون في التسويق والتشغيل على أساس دراسة واضحة ومتطلبات تنظيمية موثقة.');
    await page.locator('#save-template').click();
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('قالب الحملة'));
    await page.locator('#recipient-lines').fill('Alpha Capital, investor@example.com');
    await page.locator('#import').click();
    await page.waitForFunction(()=>document.querySelector('#recipients')?.textContent.includes('Alpha Capital'));
    await page.locator('#prepare-drafts').click();
    await page.waitForFunction(()=>document.querySelector('#recipients')?.textContent.includes('فتح المسودة'));
    expect(state.recipients).toHaveLength(1);
    expect(state.recipients[0].status).toBe('prepared');
    const draft=page.locator('#recipients a').first();
    expect(await draft.getAttribute('href')).toContain('campaign_workspace_id='+workspace);
    expect(await page.locator('#dispatch').isDisabled()).toBe(true);
  }finally{await page.close();}
 },30000);
 test('mobile 390px: no horizontal page overflow, accessible form and buttons',async()=>{
  const {page}=await open(390,844);
  try{
    const dim=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    expect(dim.scroll).toBeLessThanOrEqual(dim.viewport+4);
    expect(await page.locator('#create').isVisible()).toBe(true);
    expect(await page.locator('#connect-mailbox').isVisible()).toBe(true);
    expect(await page.locator('#dispatch').isDisabled()).toBe(true);
  }finally{await page.close();}
 },30000);
 test('small phone 320px: action buttons do not overlap viewport',async()=>{
  const {page}=await open(320,680);
  try{
    const dim=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    expect(dim.scroll).toBeLessThanOrEqual(dim.viewport+4);
    expect(await page.locator('#import-file').isVisible()).toBe(false);
  }finally{await page.close();}
 },30000);
});
