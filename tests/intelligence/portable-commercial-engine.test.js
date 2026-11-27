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
 test('multiline PDF text remains data and can yield review-only candidates',()=>{
  const result=proposeFromText('شركة مثال\nEmail: info@example.org\nPhone: +966 50 123 4567');
  expect(result.candidates.email).toBe('info@example.org');
  expect(result.records).toEqual([]);
 });
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
 test('original spreadsheet row numbers survive blank rows',()=>{
  const rows=rowsFromMatrix([['name','type'],['First','contact'],[],['Second','contact']]);
  const result=normalizeRows({rows,workspaceId:A,source:{filename:'contacts.xlsx',kind:'spreadsheet'}});
  expect(result.items.map(item=>item.source.row)).toEqual([2,4]);
  expect(result.items.map(item=>item.source.sheet)).toEqual([null,null]);
 });
 test('spreadsheet sheet provenance remains review-only metadata',()=>{
  const result=normalizeRows({rows:[{name:'First',type:'organization',_sheet:'Sheet 2',_sourceRow:8}],workspaceId:A,source:{filename:'contacts.xlsx'}});
  expect(result.items[0].source).toMatchObject({sheet:'Sheet 2',row:8});
  expect(result.items[0].record._sheet).toBeUndefined();
  expect(result.auto_saved).toBe(false);
 });
 test('review gate rejects cross-workspace proposals before storage',async()=>{
  const {commitReviewedProposals}=require('../../lib/portable-intelligence/review-gate');
  const other='12345678-1234-4123-8123-1234567890ac';
  const proposal=normalizeRows({rows:[{type:'organization',name:'Factory'}],workspaceId:A,source:{filename:'a.csv'}});
  const commit=jest.fn(),authorize=jest.fn().mockResolvedValue(true);
  await expect(commitReviewedProposals({proposal,workspaceId:other,actorId:'actor',approvedIndices:[0],authorize,commit})).rejects.toThrow('WORKSPACE_MISMATCH');
  expect(authorize).not.toHaveBeenCalled();expect(commit).not.toHaveBeenCalled();
 });
 test('review gate requires permission and explicit selected records',async()=>{
  const {commitReviewedProposals}=require('../../lib/portable-intelligence/review-gate');
  const proposal=normalizeRows({rows:[{type:'organization',name:'Factory'}],workspaceId:A,source:{filename:'a.csv'}});
  const commit=jest.fn(),authorize=jest.fn().mockResolvedValue(false);
  const input={proposal,workspaceId:A,actorId:'actor',approvedIndices:[0],authorize,commit};
  await expect(commitReviewedProposals(input)).rejects.toThrow('IMPORT_NOT_AUTHORIZED');
  expect(commit).not.toHaveBeenCalled();
  await expect(commitReviewedProposals({...input,approvedIndices:[]})).rejects.toThrow('INVALID_APPROVAL_SELECTION');
  authorize.mockResolvedValue(true);commit.mockResolvedValue({ids:['record-1']});
  await expect(commitReviewedProposals(input)).resolves.toMatchObject({saved:1});
  expect(commit).toHaveBeenCalledWith(expect.objectContaining({workspaceId:A,action:'import.reviewed',entries:[expect.objectContaining({record:expect.objectContaining({name:'Factory'})})]}));
  expect(commit).toHaveBeenCalledTimes(1);
 });
 test('CSV quoted comma is preserved',async()=>{
  const result=await analyzeFile({file:{filename:'org.csv',buffer:Buffer.from('type,name,city\norganization,"Company, Ltd",Jeddah\n')},workspaceId:A});
  expect(result.items[0].record.name).toBe('Company, Ltd');
 });
});
