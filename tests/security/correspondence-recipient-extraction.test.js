'use strict';
const {candidatesFromRows,candidatesFromText,extractRecipients}=require('../../lib/api/correspondence-recipient-extraction');
describe('Investor directory import: review before adding',()=>{
 test('extracts standalone emails and organization from spreadsheet rows, without storing data',()=>{
  const r=candidatesFromRows([
   ['اسم الجهة','البريد الإلكتروني'],['المستثمر الأول','investor1@example.com'],
   ['المستثمر الثاني','investor2@example.com'],
   ['المستثمر الثالث','INVESTOR1@example.com'],
   ['Empty','']
  ]);
  expect(r.candidates).toHaveLength(2);
  expect(r.candidates[0]).toMatchObject({organization:'المستثمر الأول',email:'investor1@example.com',review_required:true});
  expect(r.rejected.some(x=>x.reason==='DUPLICATE_EMAIL')).toBe(true);
 });
 test('multiple addresses in one row are held for manual review',()=>{
  const r=candidatesFromRows([['Unknown','a@example.com','b@example.com']]);
  expect(r.candidates).toHaveLength(0);
  expect(r.rejected[0].reason).toBe('AMBIGUOUS_EMAIL');
 });
 test('PDF text is low confidence and never auto-approved',()=>{
  const r=candidatesFromText('المستثمر الأول investor1@example.com\ninvestor2@example.com');
  expect(r.candidates).toHaveLength(1);
  expect(r.candidates[0].confidence).toBe('low');
  expect(r.candidates[0].review_required).toBe(true);
  expect(r.rejected).toHaveLength(1);
 });
 test('missing organization is not invented',()=>{
  const r=candidatesFromRows([['email','hello@example.com']]);
  expect(r.candidates).toHaveLength(0);
  expect(r.rejected[0].reason).toBe('ORGANIZATION_MISSING');
 });
 test('the extracted representation requires review even when valid',()=>{
  const r=extractRecipients({rows:[['Investor','a@example.com']],text:'ignored'});
  expect(r.requires_review).toBe(true);
  expect(r.total_candidates).toBe(1);
 });
});
