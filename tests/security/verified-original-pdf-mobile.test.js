const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('Official original PDF mobile presentation',()=>{
 const viewer=read('components/verified-pdf-viewer.js');
 const api=read('lib/api/correspondence.js');
 test('issued PDF is hash-gated before streaming, same bytes served inline or downloaded',()=>{
  expect(api).toContain('await loadPublicVerifiedArtifact(sb, doc, issue)');
  expect(api).toContain("crypto.createHash('sha256').update(buffer).digest('hex')");
  expect(api).toContain("Content-Type', 'application/pdf'");
  expect(api).toContain("(download ? 'attachment' : 'inline')");
  expect(api).toContain("'private, no-store, max-age=0'");
 });
 test('viewer downloads same-origin official artifact bytes and checks SHA-256 before rendering',()=>{
  const a=viewer.indexOf('const actual=await sha256(bytes)');
  const b=viewer.indexOf('const pdfjs=await import(');
  expect(a).toBeGreaterThan(0);
  expect(b).toBeGreaterThan(a);
  expect(viewer).toContain('actual.toLowerCase()!==expectedHash.toLowerCase()');
  expect(viewer).toContain('page.render({canvasContext:ctx,viewport');
  expect(viewer).toContain('canvas.style.width=');
  expect(viewer).toContain('pdf.numPages');
  expect(viewer).not.toContain('html2canvas');
  expect(viewer).not.toContain('jsPDF');
 });
 for(const p of ['verify-document.html','en/verify-document.html']){
  test(p+' shows actual PDF pages, fallback original file actions and no iframe',()=>{
   const html=read(p);
   expect(html).toContain('id="official-viewer" class="verified-pdf-pages"');
   expect(html).toContain('BondsVerifiedPdfViewer.render(');
   expect(html).toContain('expectedHash:d.artifact_hash');
   expect(html).toContain('id="open-pdf"');
   expect(html).toContain('id="download-pdf"');
   expect(html).toContain('verified-pdf-page');
   expect(html).not.toContain('<iframe id="official-viewer"');
   expect(html).not.toContain("document.getElementById('official-viewer').src=preview");
  });
 }
 test('viewer rejects other origins, untrusted endpoints and missing verification tokens',()=>{
  const win={location:{origin:'https://bonds-global.com'}};
  vm.runInNewContext(viewer,{window:win,URL,console},{timeout:1000});
  const allowed='/api/correspondence?action=official-preview&token=34c038fc-7313-433a-a097-c587d965a2a4';
  expect(win.BondsVerifiedPdfViewer.sameOriginOfficialUrl(allowed)).toBe(true);
  expect(win.BondsVerifiedPdfViewer.sameOriginOfficialUrl('https://evil.example/api/correspondence?action=official-preview&token=34c038fc-7313-433a-a097-c587d965a2a4')).toBe(false);
  expect(win.BondsVerifiedPdfViewer.sameOriginOfficialUrl('/api/correspondence?action=send&token=34c038fc-7313-433a-a097-c587d965a2a4')).toBe(false);
 });
 test('invalid fingerprint fails closed without fetching any PDF',async()=>{
  const win={location:{origin:'https://bonds-global.com'},console};
  vm.runInNewContext(viewer,{window:win,URL,console},{timeout:1000});
  const feedback={textContent:''},container={replaceChildren:()=>{throw Error('should not fetch')}};
  const ok=await win.BondsVerifiedPdfViewer.render({url:'/api/correspondence?action=official-preview&token=34c038fc-7313-433a-a097-c587d965a2a4',expectedHash:'invalid',container,feedback});
  expect(ok).toBe(false);
  expect(feedback.textContent).toContain('تعذر');
 });
});
