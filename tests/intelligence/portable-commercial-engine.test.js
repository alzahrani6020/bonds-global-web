'use strict';
const {normalizeRows,rowsFromMatrix,proposeFromText}=require('../../lib/portable-intelligence/core');
const {analyzeFile}=require('../../lib/portable-intelligence/file-adapters');
const A='12345678-1234-4123-8123-1234567890ab';
describe('portable commercial intelligence engine',()=>{
 test('Arabic Excel columns convert to review-only CRM proposals',()=>{
  const rows=rowsFromMatrix([['الاسم','البريد الإلكتروني','المدينة'],['مصنع جدة','factory@example.org','جدة']]);
  const r=normalizeRows({rows,workspaceId:A,defaultType:'organization',source:{filename:'contacts.xlsx',kind:'spreadsheet'}});
  expect(r.items[0].record).toMatchObject({name:'مصنع جدة',city:'جدة'});expect(r.auto_saved).toBe(false);expect(r.requires_manual_approval).toBe(true);
 });
 test('workspace cannot come from source rows',()=>{
  const r=normalizeRows({rows:[{type:'contact',name:'Person',workspace_id:'other'}],workspaceId:A,source:{filename:'a.csv'}});
  expect(r.items[0].workspace_id).toBe(A);expect(r.items[0].record.workspace_id).toBeUndefined();
 });
 test('missing authorized tenant context fails closed',()=>expect(()=>normalizeRows({rows:[],source:{filename:'x.csv'}})).toThrow('WORKSPACE_ID_REQUIRED'));
 test('unverified PDF evidence never becomes a saved contact',()=>expect(proposeFromText('info@example.com').records).toEqual([]));
 test('images require an explicit local or authorized OCR adapter',async()=>await expect(analyzeFile({file:{filename:'card.png',buffer:Buffer.from('image')},workspaceId:A})).rejects.toThrow('OCR_ADAPTER_REQUIRED'));
 test('rejects malformed records rather than inventing data',()=>{
  const r=normalizeRows({rows:[{name:'Missing type'}],workspaceId:A,source:{filename:'a.csv'}});
  expect(r.items).toHaveLength(0);expect(r.errors[0].code).toBe('TYPE_REVIEW_REQUIRED');
 });
 test('standalone manifest and adapters do not depend on BONDS production services',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const root=path.resolve(__dirname,'../../lib/portable-intelligence');
  const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const adapter=fs.readFileSync(path.join(root,'file-adapters.js'),'utf8');
  const cli=fs.readFileSync(path.join(root,'cli.js'),'utf8');
  expect(packageJson.bin['bonds-document-intelligence']).toBe('./cli.js');
  expect(packageJson.dependencies).toHaveProperty('pdf-parse');
  expect(adapter).not.toMatch(/supabase|service.role|\/api\/|correspondence|\.insert\(|\.upsert\(/i);
  expect(adapter).not.toContain("require('../intelligence/content-extraction')");
  expect(cli).not.toMatch(/https?:\/\/|fetch\(|http\.request|https\.request/i);
 });
 test('CSV quoted comma is preserved',async()=>{
  const result=await analyzeFile({file:{filename:'org.csv',buffer:Buffer.from('type,name,city\norganization,"Company, Ltd",Jeddah\n')},workspaceId:A});
  expect(result.items[0].record.name).toBe('Company, Ltd');
 });
});
