/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/company-hr-self-service.js'),'utf8');
const htmlAr=fs.readFileSync(path.resolve(__dirname,'../../my-bonds/crm/index.html'),'utf8');
const htmlEn=fs.readFileSync(path.resolve(__dirname,'../../en/my-bonds/crm/index.html'),'utf8');
describe('HR invitation form async lifecycle',()=>{
 for(const functionName of ['createInvitation','addMember','submitRequest']){
  test(functionName+' keeps the form element across awaits',()=>{
   const begin=source.indexOf('async function '+functionName+'(event){');
   const next=source.indexOf('\n async function ',begin+1);
   const chunk=source.slice(begin,next===-1?undefined:next);
   expect(begin).toBeGreaterThan(-1);
   expect(chunk).toContain('const formElement=event.currentTarget;');
   expect(chunk).toContain('new FormData(formElement)');
   expect(chunk).toContain('formElement.reset()');
   expect(chunk).not.toContain('event.currentTarget.reset()');
  });
 }
 test('Arabic and English pages load corrected script',()=>{
  expect(htmlAr).toContain('company-hr-self-service.js?v=6');
  expect(htmlEn).toContain('company-hr-self-service.js?v=6');
 });
});
