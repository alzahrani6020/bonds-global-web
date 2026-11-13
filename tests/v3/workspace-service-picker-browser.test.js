/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const { chromium }=require('playwright');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
function handler(source,needle,closing){
 const start=source.indexOf(needle);
 if(start<0)throw new Error('handler missing: '+needle);
 const end=source.indexOf(closing,start);
 if(end<0)throw new Error('handler terminator missing: '+needle);
 return source.slice(start,end+closing.length);
}

describe('service picker real browser event propagation',()=>{
 test('real click remains visibly open and original event does not reclose picker',async()=>{
  const ui=read('components/service-request.js');
  const discovery=read('components/service-discovery.js');
  const actionHandler=handler(ui,"action.addEventListener('click',event=>{","\n   });");
  const triggerHandler=handler(discovery,"q('#bondsServiceTrigger').addEventListener('click',e=>{","\n    });");
  const closeHandler=handler(discovery,"document.addEventListener('click',e=>{","\n    });");
  const browser=await chromium.launch({headless:true});
  try{
   const page=await browser.newPage();
   await page.setContent('<section id="bondsServicePicker"><button id="bondsServiceTrigger">Choose service</button><div class="sd-service-panel">Choices</div></section><button id="action">اختيار الخدمة</button>');
   await page.evaluate(({actionHandler,triggerHandler,closeHandler})=>{
    const q=s=>document.querySelector(s);
    const picker=q('#bondsServicePicker');
    const openServicePicker=()=>picker.classList.add('is-open');
    const closeServicePicker=()=>picker.classList.remove('is-open');
    const action=q('#action');
    new Function('q','openServicePicker','closeServicePicker',triggerHandler)(q,openServicePicker,closeServicePicker);
    new Function('q','openServicePicker','closeServicePicker',closeHandler)(q,openServicePicker,closeServicePicker);
    new Function('action','document','location','lang',actionHandler)(action,document,window.location,'ar');
   },{actionHandler,triggerHandler,closeHandler});
   await page.locator('#action').click();
   const state=await page.locator('#bondsServicePicker').evaluate(el=>({open:el.classList.contains('is-open')}));
   expect(state.open).toBe(true);
   await page.locator('#action').click();
   expect(await page.locator('#bondsServicePicker').evaluate(el=>el.classList.contains('is-open'))).toBe(false);
  }finally{await browser.close();}
 },30000);
});
