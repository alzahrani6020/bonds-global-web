/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

describe('workspace chooser click opens header picker without immediately closing it',()=>{
 const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
 test('stopPropagation prevents discovery outside-click handler from closing the picker',()=>{
  const start=ui.indexOf("action.addEventListener('click',event=>{");
  const end=ui.indexOf("\n   });",start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const snippet=ui.slice(start,end+"\n   });".length);
  let onActionClick;
  const action={addEventListener:(name,callback)=>{if(name==='click')onActionClick=callback}};
  let open=false;
  let scrollCount=0;
  const selector={
   scrollIntoView:()=>{scrollCount++},
   click:()=>{open=true}
  };
  const document={querySelector:sel=>sel==='#bondsServiceTrigger'?selector:null};
  vm.runInNewContext(snippet,{action,document,location:{},lang:'ar'});
  expect(typeof onActionClick).toBe('function');
  const originalClick={stopped:false,stopPropagation(){this.stopped=true}};
  onActionClick(originalClick);
  // Actual discovery has a document-level click handler that closes when
  // the event target is outside #bondsServicePicker.
  if(!originalClick.stopped)open=false;
  expect(scrollCount).toBe(1);
  expect(originalClick.stopped).toBe(true);
  expect(open).toBe(true);
 });
 test('Arabic and English direct workspace use versioned fixed script',()=>{
  for(const p of ['my-bonds/workspace/index.html','en/my-bonds/workspace/index.html']){
   expect(fs.readFileSync(p,'utf8')).toContain('/components/service-request.js?v=21');
  }
  expect(fs.readFileSync('sw.js','utf8')).toContain("const CACHE_VERSION = 'v3.0.295';");
 });
});
