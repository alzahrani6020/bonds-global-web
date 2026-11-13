/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const read=file=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('workspace direct entry uses existing service catalog',()=>{
 const ui=read('components/service-request.js');
 test('missing service redirects without displaying a redundant chooser',()=>{
  const start=ui.indexOf('async function init(){');
  const end=ui.indexOf("$('#srLoading').textContent=T.loading;",start);
  const guard=ui.slice(start,end);
  expect(guard).toContain('if(!serviceCode){');
  expect(guard).toContain("location.replace(lang==='ar'?'/services.html':'/en/services.html')");
  expect(guard).not.toContain('document.createElement');
  expect(guard).not.toContain('اختر الخدمة لفتح مساحة العمل');
 });
 test('qualified requests keep the existing execution flow',()=>{
  expect(ui).toContain("detail=await json('/api/v3/services/'+encodeURIComponent(serviceCode)");
  expect(ui).toContain("if(isServiceWorkspace&&detail?.workspace?.mode!=='execute')");
 });
 test('changed script invalidates cached client assets in both languages',()=>{
  for(const file of ['my-bonds/workspace/index.html','en/my-bonds/workspace/index.html','service-request.html','en/service-request.html']){
   expect(read(file)).toContain('/components/service-request.js?v=22');
  }
  expect(read('sw.js')).toContain("const CACHE_VERSION = 'v3.0.296';");
  expect(read('sw.js')).toContain("'/components/service-request.js?v=22'");
 });
});