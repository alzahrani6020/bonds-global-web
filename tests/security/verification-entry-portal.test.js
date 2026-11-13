const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('Public document verification entry never invents authenticity',()=>{
 const code=read('components/verification-entry.js');
 const win={location:{origin:'https://bonds-global.com'}};
 vm.runInNewContext(code,{window:win,URL},{timeout:1000});
 const parser=win.BondsVerificationEntry.parse;
 const token='34c038fc-7313-433a-a097-c587d965a2a4';
 test('accepts exact official QR token and URL with tracking parameters',()=>{
  expect(parser(token)).toBe(token);
  expect(parser('https://bonds-global.com/verify-document?token='+token+'&utm_source=chatgpt.com')).toBe(token);
  expect(parser('https://www.bonds-global.com/en/verify-document.html?token='+token)).toBe(token);
 });
 test('denies non-token navigation, redirects, duplicate tokens, foreign domains and short refs',()=>{
  for(const input of ['','https://bonds-global.com/verify-document?utm_source=chatgpt.com',
   'OUT-2026-000004','https://evil.example/verify-document?token='+token,
   'https://bonds-global.com/verify-document?token='+token+'&token='+token,
   'https://bonds-global.com/letterhead?token='+token,
   'javascript:alert(1)']){
    expect(parser(input)).toBe(null);
  }
 });
 for(const p of ['verify-document.html','en/verify-document.html']){
  test(p+' distinguishes missing token from invalid issuer token',()=>{
   const html=read(p);
   expect(html).toContain("if(!token){");
   expect(html).toContain('BondsVerificationEntry.install');
   expect(html).toContain('id="verification-entry-form"');
   expect(html).toContain('id="official-viewer"');
   expect(html).not.toContain('id="seal"');
   expect(html.indexOf('id="viewer-wrap"')).toBeLessThan(html.indexOf('class="result"'));
  });
 }
});