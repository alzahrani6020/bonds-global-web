/** @jest-environment node */
const {chromium} = require('playwright');
const fs = require('fs');
const {resolveExecuteRequest} = require('../../lib/assistant/execute-requests');
const widget = fs.readFileSync('v3/components/ai-chat-widget.js','utf8');
let browser;
beforeAll(async () => { browser=await chromium.launch({headless:true}); },30000);
afterAll(async () => { if(browser) await browser.close(); });

test.each([false,true])('execute UI sends a local form request with stalled context=%s', async stalled => {
  const page=await browser.newPage();
  const chats=[];
  try {
    await page.route('https://assistant-fixture.test/**', async route => {
      const path=new URL(route.request().url()).pathname;
      if(path==='/') return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ar" dir="rtl"><body><main>اختبار معزول</main></body></html>'});
      if(stalled && path==='/api/v3/services/catalog') return;
      if(path==='/api/v3/ai/chat') {
        const body=route.request().postDataJSON(); chats.push(body);
        const plan=resolveExecuteRequest(body.messages.at(-1).content,body.context,{conversationMode:body.conversation_mode});
        return route.fulfill({contentType:'application/json',body:JSON.stringify({...plan,source:'bonds-assistant-form-plan',execution_completed:false})});
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify({services:[],workflow:null,workflow_key:null,checks:{},notifications:[]})});
    });
    await page.goto('https://assistant-fixture.test/');
    await page.addScriptTag({content:`window.BondsAuth={getSession:async()=>({data:{session:{access_token:'isolated-fixture-token',user:{id:'fixture-user'}}}}),checkFeatureAccess:async()=>({allowed:true})};`});
    await page.addScriptTag({content:widget});
    await page.evaluate(()=>window.BondsAIChat.mount({global:true,pagePath:'/'}));
    await page.getByRole('button',{name:'فتح مساعد بوندز',exact:true}).click();
    await page.getByRole('button',{name:'تنفيذ',exact:true}).click();
    await page.getByRole('textbox',{name:'اكتب سؤالك هنا...'}).fill('ابحث عن نموذج طلب تمويل في هذا الموقع');
    await page.getByRole('button',{name:'إرسال',exact:true}).click();
    await page.getByText('اختر النموذج المسجل الذي تريد فتحه أو حفظ مسودته. لم تُحفظ بيانات.',{exact:true}).waitFor({timeout:9000});
    expect(chats).toHaveLength(1);
    expect(chats[0].conversation_mode).toBe('execute');
    expect(await page.locator('.bonds-ai-action-card').count()).toBe(3);
    expect(await page.locator('.bonds-ai-action-card').allTextContents()).toEqual(expect.arrayContaining([
      expect.stringContaining('بيانات المنشأة'),expect.stringContaining('اعرف عميلك'),expect.stringContaining('بيانات النشاط')
    ]));
    expect(await page.getByRole('textbox',{name:'اكتب سؤالك هنا...'}).isEnabled()).toBe(true);
  } finally { await page.close(); }
},20000);
