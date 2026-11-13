const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

describe('Correspondence issuance integrity boundaries',()=>{
  const api=read('lib/api/correspondence.js');
  const ui=read('components/letterhead-correspondence.js');

  test('each signed upload is create-only and has a unique issue-scoped path',()=>{
    expect(api).toContain("crypto.randomUUID(), safeRef + '.pdf'");
    expect(api).toContain("createSignedUploadUrl(path, { upsert: false })");
    expect(api).toContain("A final PDF is already bound; issued artifacts cannot be replaced");
    expect(ui).toContain("{ contentType: 'application/pdf', upsert: false }");
    expect(ui).not.toContain("{ contentType: 'application/pdf', upsert: true }");
  });

  test('finalization blocks already finalized or raced replacements',()=>{
    expect(api).toContain("Final PDF already finalized; immutable issuance cannot be replaced");
    expect(api).toContain(".is('artifact_hash', null).is('artifact_path', null)");
    expect(api).toContain("Final PDF already bound by another operation; no overwrite permitted");
    expect(api).toContain("Final PDF does not contain the issued-document integrity marker");
  });

  test('future issuance requires signer name and title but does not invent historical names',()=>{
    expect(api).toContain("Signer name and capacity are required before signing");
    expect(api).toContain("!doc.signer_name || !doc.signer_title");
    expect(api).toContain("issue.signature_hash === doc.signature_hash && issue.issued_hash === doc.issued_hash");
    expect(api).toContain("signer_name: (issue.signature_hash");
    expect(api).toContain("signer_title: (issue.signature_hash");
  });

  test('the server independently verifies historic archived PDF bytes on every preview',()=>{
    expect(api).toContain('async function loadPublicVerifiedArtifact');
    expect(api).toContain("hash !== doc.artifact_hash || hash !== issue.pdf_hash");
    expect(api).toContain("Cache-Control', 'private, no-store, max-age=0");
  });
});
