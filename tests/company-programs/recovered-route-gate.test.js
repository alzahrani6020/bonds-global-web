/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const platform=fs.readFileSync(path.join(root,'api/platform.js'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const handler=fs.readFileSync(path.join(root,'lib/api/company-programs.js'),'utf8');
const writes=fs.readFileSync(path.join(root,'lib/company-programs/makkin-write-operations.js'),'utf8');
test('company programs route is uniquely routed through existing platform API',()=>{
 expect((platform.match(/const companyProgramsHandler = require\('\.\.\/lib\/api\/company-programs'\);/g)||[])).toHaveLength(1);
 expect((platform.match(/pathname === '\/api\/company-programs'/g)||[])).toHaveLength(1);
 for(const url of ['/api/company-programs','/api/company-programs/']){
  expect(vercel.rewrites.filter(r=>r.source===url)).toEqual([{source:url,destination:'/api/platform'}]);
 }
});
test('unauthorized or non-preview writes stay closed',()=>{
 expect(handler).toContain("process.env.VERCEL_ENV!=='preview'");
 expect(handler).toContain("process.env.BONDS_MAKKIN_STAGING_WRITES_ENABLED!=='true'");
 expect(handler).toContain('accessToSourceWorkspace(sb,user,workspaceType,workspaceId)');
 expect(handler).toContain('verifyBearer(req)');
 expect(writes).toContain('Experimental write bridge');
});
test('source parity gate cannot silently pass on incomplete routes',()=>{
 const matrix=JSON.parse(fs.readFileSync(path.join(root,'docs/makkin-route-transfer-matrix.json'),'utf8'));
 expect(matrix.routes).toHaveLength(74);
 expect(matrix.routes.some(r=>r.transferStatus!=='VERIFIED')).toBe(true);
});
