'use strict';
const fs=require('node:fs');
const path=require('node:path');

describe('portable commercial client delivery status contract',()=>{
 const ui=fs.readFileSync(path.resolve(__dirname,'../../lib/portable-intelligence/commercial-ui.js'),'utf8');
 test('confirmed destination readback alone renders confirmed success',()=>{
  expect(ui).toContain('response.delivered===true && response.verified_destination_ack===true');
  expect(ui).toContain('تم تأكيد التسليم وإعادة القراءة');
 });
 test('accepted but unverified destination data remains explicitly pending reconciliation',()=>{
  expect(ui).toContain('response.requires_reconciliation===true && response.delivered===false');
  expect(ui).toContain('الحالة تتطلب مصالحة يدوية قبل إعادة الإرسال');
  expect(ui).toContain('لم يتم التحقق من التسليم');
  expect(ui).not.toContain("notice('أقر النظام المستهدف باستلام البيانات: '+response.receipt_id)");
 });
});
