/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const browser=fs.readFileSync(path.join(root,'my-bonds/company-programs/app.js'),'utf8');
const {MAKKIN_READ_OPERATIONS}=require('../../lib/company-programs/makkin-read-operations');
test('all audited read operations are offered in their own program and only those operations',()=>{
 const source=browser.slice(browser.indexOf('const operations=Object.freeze('),browser.indexOf('const dictionary='));
 const groups=[...source.matchAll(/^  ([a-z_]+):\[([^\]]+)\]/gm)];
 const actual=groups.flatMap(([,program,operations])=>
   [...operations.matchAll(/'([^']+)'/g)].map(x=>({program,key:x[1]})));
 expect(groups).toHaveLength(11);
 expect(actual).toHaveLength(13);
 expect(actual.map(x=>x.key).sort()).toEqual(Object.keys(MAKKIN_READ_OPERATIONS).sort());
 for(const {program,key} of actual)expect(MAKKIN_READ_OPERATIONS[key].program).toBe(program);
});
test('a late response cannot render another workspace data',()=>{
 expect(browser).toContain("$('workspace').addEventListener('change',()=>{");
 expect(browser).toContain('clearData();selected=null;');
 expect(browser).toContain("$('result').textContent='';");
 expect(browser).toContain('if(!sameWorkspace({source,id},epoch))return;');
 expect(browser).toContain('if(!sameWorkspace(workspace,epoch))return;');
 expect(browser).toContain('result.workspace?.source!==workspace.source');
 expect(browser).toContain("$('result').textContent=JSON.stringify(result.data,null,2)");
 expect(browser).not.toContain('innerHTML');
});
