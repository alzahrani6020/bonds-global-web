'use strict';
const fs=require('node:fs'),path=require('node:path');
describe('commercial directory uses existing Vercel API budget and approved routing',()=>{
 const root=path.resolve(__dirname,'../..');
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 const router=fs.readFileSync(path.join(root,'api/platform.js'),'utf8');
 const methods=['commercial-directory-import','commercial-directory-hr'];
 test('both API URLs and trailing-slash variants use one established platform function',()=>{
  for(const name of methods)for(const slash of ['','/']){
   const source='/api/'+name+slash;
   expect(config.rewrites.filter(x=>x.source===source)).toEqual([{source,destination:'/api/platform'}]);
   expect(router).toContain("pathname === '"+source+"'");
  }
 });
 test('no new Vercel functions introduced by portable routes',()=>{
  for(const name of methods)expect(fs.existsSync(path.join(root,'api',name+'.js'))).toBe(false);
 });
 test('both handlers use shared route rate limits and tenant-aware adapters',()=>{
  expect(router).toContain("createCommercialDirectoryReceiver()");
  expect(router).toContain("createHrCommercialDirectory()");
  expect(router).toContain("checkRateLimit('auth', req, res)");
  expect(router).toContain("checkRateLimit('admin_read', req, res)");
 });
});
