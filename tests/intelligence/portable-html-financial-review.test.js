'use strict';
const {htmlTables}=require('../../lib/portable-intelligence/html-table-review');
const {parseAmount}=require('../../lib/portable-intelligence/table-financial-review');
const {analyzeFile}=require('../../lib/portable-intelligence/file-adapters');
const wid='12345678-1234-4123-8123-1234567890ab';
const source='<table><tr><th rowspan="2">البند</th><th colspan="2">ريال</th></tr><tr><th>٢٠٢٥</th><th>2024</th></tr><tr><td>الإيرادات</td><td>3,737,531</td><td>(556,300)</td></tr></table>';
describe('portable financial HTML review',()=>{
 test('merged header cells preserve positions and origin',()=>{
  const r=htmlTables(source);
  expect(r.tables[0].rows[1].cells).toEqual(['البند','٢٠٢٥','2024']);
  expect(r.tables[0].rows[1].provenance[0].inherited).toBe(true);
  expect(r.financial_review[0].items[0].values.map(v=>[v.year,v.amount])).toEqual([['2025',3737531],['2024',-556300]]);
  expect(r.financial_review[0].verified).toBe(false);
 });
 test('never executes untrusted HTML',()=>{
  const r=htmlTables('<script>alert(1)</script><table><tr><td><img src=x onerror=alert(1)>OK &amp; Fine</td></tr></table>');
  expect(r.tables[0].rows[0].cells[0]).toBe('OK & Fine');
 });
 test('ambiguous financial value is rejected',()=>{
  expect(parseAmount('1.234,00')).toBeNull();
  expect(parseAmount('١٬٢٣٤٫٥٠')).toBe(1234.5);
 });
 test('duplicate years are not treated as confirmed columns',()=>{
  const r=htmlTables('<table><tr><th>البند</th><th>2025</th><th>2025</th></tr><tr><td>إيرادات</td><td>11</td><td>12</td></tr></table>');
  expect(r.financial_review[0].year_mapping_status).toBe('UNDETERMINED');
  expect(r.financial_review[0].items).toEqual([]);
 });
 test('document analysis produces no automatic record',async()=>{
  const r=await analyzeFile({workspaceId:wid,file:{filename:'financial.html',buffer:Buffer.from(source)}});
  expect(r.financial_review[0].items).toHaveLength(1);
  expect(r.items).toEqual([]);
  expect(r.auto_saved).toBe(false);
 });
});
