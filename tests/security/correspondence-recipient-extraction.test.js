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
 test('imports real BONDS investor workbook layout without extracting the BONDS sender address',()=>{
  const rows=[
   ['رقم المصدر','اسم الجهة','البريد الإلكتروني','مستوى توثيق المصدر','نص الرسالة','حالة الإرسال'],
   [3,'اكسس بريدج فينتريس','hello@access-bridge.com','قناة منشورة بمصدر','تفضلوا بقبول التحية info@bonds-global.com','مسودة — لم ترسل'],
   [7,'مجموعة النفيعي للاستثمار','csu@nefaie.com','متحقق: صفحة رسمية','المراسلات info@bonds-global.com','مسودة — لم ترسل']
  ];
  const r=candidatesFromRows(rows);
  expect(r.candidates).toHaveLength(2);
  expect(r.candidates.map(x=>x.email)).toEqual(['hello@access-bridge.com','csu@nefaie.com']);
  expect(r.candidates.every(x=>x.review_required)).toBe(true);
  expect(r.candidates.every(x=>x.email!=='info@bonds-global.com')).toBe(true);
  expect(r.recognized_contact_columns).toBe(true);
 });
 test('selects contact worksheet over financial/operating summary selected by generic parser',()=>{
  const summary=[['المؤشر','القيمة'],['إجمالي الجهات',264],['الحساب','account']];
  const contacts=[
   ['م','اسم الشركة / الجهة','البريد الإلكتروني','نص الرسالة'],
   [1,'شركة استثمارية أولى','one@example.com','رد عبر info@bonds-global.com'],
   [2,'شركة استثمارية ثانية','two@example.com','أرسل على info@bonds-global.com'],
   [3,'جهة بدون بريد','','']
  ];
  const result=extractRecipients({
   rows:summary,text:'account — 264 companies',
   sheets:[{name:'ملخص التشغيل',rows:summary},{name:'جميع الشركات - صف لكل شركة',rows:contacts}]
  });
  expect(result.candidates.map(x=>x.email)).toEqual(['one@example.com','two@example.com']);
  expect(result.source_sheet).toBe('جميع الشركات - صف لكل شركة');
  expect(result.requires_review).toBe(true);
 });
 test('rejects a suspicious email column rather than trying other addresses in the letter body',()=>{
  const r=candidatesFromRows([
   ['اسم الجهة','البريد الإلكتروني','نص الرسالة'],
   ['Investor A','a@example.com, b@example.com','info@bonds-global.com'],
   ['Investor B','a@example.com','info@bonds-global.com']
  ]);
  expect(r.candidates).toHaveLength(1);
  expect(r.candidates[0].email).toBe('a@example.com');
  expect(r.rejected[0].reason).toBe('INVALID_EMAIL_COLUMN');
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
