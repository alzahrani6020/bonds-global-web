const fs=require('fs'),path=require('path'),root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('single canonical BONDS seal',()=>{
 const source=read('components/bonds-official-seal.js');
 test('Arabic is not drawn with curved SVG textPath',()=>{
  expect(source).toContain('بوندز للاستشارات المالية والإدارية');
  expect(source).toContain('تصديق الختم الإلكتروني');
  expect(source).toContain('رقم السجل 39733');
  expect(source).not.toContain("element('textPath'");
 });
 for(const p of ['verify-document.html','en/verify-document.html','letterhead.html','en/letterhead.html']){
  test(p+' loads canonical seal',()=>{
    const html=read(p);
    expect(html).toContain('/components/bonds-official-seal.js?v=1');
    expect(html).not.toContain('<textPath');
  });
 }
 for(const p of ['verify-document.html','en/verify-document.html']){
   test(p+' renders live data and canonical logo',()=>{
    const html=read(p);
    expect(html).toContain('window.BondsOfficialSeal.create(');
    expect(html).toContain('/assets/bonds-logo-2026-v2-sm.webp');
    expect(html).toContain('max-width:100%');
   });
 }
});
