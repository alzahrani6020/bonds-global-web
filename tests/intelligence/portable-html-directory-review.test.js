'use strict';
const {htmlTables}=require('../../lib/portable-intelligence/html-table-review');
const {analyzeFile}=require('../../lib/portable-intelligence/file-adapters');
const WID='12345678-1234-4123-8123-1234567890ab';
describe('review-only HTML institutional contact table imports',()=>{
 test('preserves merged column provenance without executing untrusted scripts',()=>{
  const r=htmlTables('<script>throw Error("EXECUTED")</script><table><tr><th rowspan="2">name</th><th>email</th></tr><tr><td>info@example.org</td></tr></table>');
  expect(r.tables[0].rows[1].cells[0]).toBe('name');
  expect(r.tables[0].rows[1].provenance[0].inherited).toBe(true);
  expect(r.auto_saved).toBe(false);
  expect(r).not.toHaveProperty('financial_review');
 });
 test('structured organization and contact rows need approval before SQLite writes',async()=>{
  const html='<table><tr><th>type</th><th>name</th><th>email</th><th>city</th></tr>'+
   '<tr><td>organization</td><td>شركة ألف</td><td>one@example.org</td><td>جدة</td></tr>'+
   '<tr><td>contact</td><td>ليلى حسن</td><td>leila@example.org</td><td>الرياض</td></tr></table>';
  const result=await analyzeFile({workspaceId:WID,file:{filename:'directory.html',buffer:Buffer.from(html)}});
  expect(result.items).toHaveLength(2);
  expect(result.items.map(i=>i.record.type)).toEqual(['organization','contact']);
  expect(result.items[0].record.email).toBe('one@example.org');
  expect(result.items[1].record.name).toBe('ليلى حسن');
  expect(result.items[1].source.sheet).toBe('HTML table 1');
  expect(result.auto_saved).toBe(false);
  expect(result.requires_manual_approval).toBe(true);
 });
 test('unknown tables fail closed into review warnings, no guessed identities',async()=>{
  const html='<table><tr><th>Year</th><th>Value</th></tr><tr><td>2025</td><td>500</td></tr></table>';
  const result=await analyzeFile({workspaceId:WID,file:{filename:'unknown.html',buffer:Buffer.from(html)}});
  expect(result.items).toHaveLength(0);
  expect(result.errors[0].code).toBe('TABLE_STRUCTURE_REVIEW_REQUIRED');
  expect(result.auto_saved).toBe(false);
 });
});
