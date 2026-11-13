const fs=require('fs'),path=require('path'),root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('BONDS seal provenance and original PDF integrity',()=>{
 const source=read('components/bonds-official-seal.js');
 test('correspondence uses canonical component for newly rendered documents',()=>{
  expect(read('components/letterhead-correspondence.js')).toContain('window.BondsOfficialSeal.create(');
  expect(source).toContain('بوندز للاستشارات المالية والإدارية');
 });
 for(const page of ['verify-document.html','en/verify-document.html']){
  test(page+' never regenerates the historical stamp',()=>{
   const html=read(page);
   expect(html).not.toContain('window.BondsOfficialSeal.create(');
   expect(html).not.toContain('/components/bonds-official-seal.js?v=1');
   expect(html).toContain('id="seal"');
   expect(html).toContain("document.getElementById('seal').hidden=!(pdfMatches && d.stamp_verified)");
   expect(html).toContain('/components/verified-pdf-viewer.js?v=1');
   expect(html).toContain('const pdfMatches=await window.BondsVerifiedPdfViewer.render({');
   expect(html).toContain('pdfCheck.classList.toggle(\'bad\',!pdfMatches)');
   expect(html).toContain('expectedHash:d.artifact_hash');
   expect(html).not.toContain('document.getElementById(\'official-viewer\').src=preview');
  });
 }
 test('certificate distinguishes the original embedded seal from metadata',()=>{
  expect(read('verify-document.html')).toContain('الختم الرسمي المعتمد هو الختم الموجود داخل ملف PDF الأصلي');
  expect(read('en/verify-document.html')).toContain('authentic issuance seal is the one embedded');
 });
});
