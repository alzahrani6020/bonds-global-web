const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Dynamic letterhead correspondence architecture', () => {
  test('migration creates governed correspondence tables with RLS and service-role-only access', () => {
    const sql = read('supabase/migrations/20261111193000_letterhead_dynamic_correspondence.sql');
    for (const name of [
      'correspondence_sequences',
      'correspondence_documents',
      'correspondence_versions',
      'correspondence_events'
    ]) {
      expect(sql).toContain('public.' + name);
      expect(sql).toContain('alter table public.' + name + ' enable row level security');
    }
    expect(sql).toContain('revoke all on public.correspondence_sequences');
    expect(sql).toContain('grant all on public.correspondence_sequences');
    expect(sql).toContain('next_correspondence_reference');
    expect(sql).toContain("return 'BDS-' || y::text || '-' || lpad(n::text,6,'0')");
    expect(sql).toContain('verification_token uuid unique');
    expect(sql).toContain('checksum_sha256 text not null');
    expect(sql).toContain('signed_by uuid');
    expect(sql).toContain('stamped_by uuid');
    expect(sql).toContain('company_id uuid references public.companies');
    expect(sql).toContain('signature_image_data text');
    expect(sql).toContain('signature_hash text');
    expect(sql).toContain('stamp_hash text');
    expect(sql).toContain('issued_hash text');
  });

  test('server correspondence service enforces workflow, RBAC, immutable issuance and verification', () => {
    const api = read('lib/api/correspondence.js');
    expect(api).toContain("const EDITABLE_STATUSES = new Set(['draft', 'returned'])");
    expect(api).toContain("const ADMIN_ROLES = new Set(['super_admin', 'admin'])");
    expect(api).toContain("Only the document owner can edit the draft");
    expect(api).toContain("Issued or workflow-controlled documents are immutable");
    expect(api).toContain("Approved document must be signed before issuance");
    expect(api).toContain("Sending correspondence requires admin permission");
    expect(api).toContain("Only issued documents can be sent");
    expect(api).toContain("action === 'verify'");
    expect(api).toContain("action === 'mark-signature'");
    expect(api).toContain("action === 'mark-stamp'");
    expect(api).toContain("Recipient is not authorized for correspondence");
    expect(api).toContain("doc.confidentiality === 'restricted'");
    expect(api).toContain("signature_data_url");
    expect(api).toContain("issued_hash");
    expect(api).toContain("signature_image_data: null");
    expect(api).toContain("stamp_hash: null");
  });

  test('rich HTML is bounded and stripped of active content server-side', () => {
    const api = require('../../lib/api/correspondence');
    expect(api.sanitizeHtml('<p onclick="x()">A</p><script>alert(1)</script>'))
      .toBe('<p>A</p>');
    expect(api.sanitizeHtml('<img src="javascript:alert(1)" onerror="x()">'))
      .not.toMatch(/javascript:|onerror/i);
    expect(() => api.sanitizePages([])).toThrow();
    expect(() => api.sanitizePages(new Array(51).fill('<p>x</p>'))).toThrow();
  });

  test('dynamic client replaces local governance with server-backed actions', () => {
    const client = read('components/letterhead-correspondence.js');
    new Function(client);
    expect(client).toContain("fetch('/api/correspondence?'");
    expect(client).toContain("api('save-version'");
    expect(client).toContain("api('transition'");
    expect(client).toContain("mark('mark-signature'");
    expect(client).toContain("mark('mark-stamp'");
    expect(client).toContain("api('send'");
    expect(client).toContain("verification_token");
    expect(client).toContain("Import legacy drafts");
    expect(client).toContain("for (let i = 0; i < sheets.length; i++)");
    expect(client).toContain("renderGovernanceArtifacts");
    expect(client).toContain("signature_data_url");
    expect(client).toContain("Word-compatible .doc");
  });

  test('final PDF artifact is private, hashed and required before sending', () => {
    const migration = read('supabase/migrations/20261111221000_correspondence_final_artifacts.sql');
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');

    expect(migration).toContain("'correspondence-artifacts'");
    expect(migration).toContain('false');
    expect(migration).toContain("array['application/pdf']");
    expect(migration).toContain('artifact_hash');
    expect(api).toContain("action === 'artifact-upload-url'");
    expect(api).toContain("action === 'artifact-finalize'");
    expect(api).toContain('Final PDF artifact is required before sending');
    expect(api).toContain('Final PDF artifact integrity check failed');
    expect(api).toContain("contentType: 'application/pdf'");
    expect(client).toContain("uploadToSignedUrl");
    expect(client).toContain("api('artifact-finalize'");
    expect(client).toContain("!!doc?.artifact_hash");
  });

  test('browser QR is same-origin and external QR service is server-proxied only', () => {
    const client = read('components/letterhead-correspondence.js');
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    const api = read('lib/api/correspondence.js');

    expect(client).toContain("'/api/correspondence?action=qr&token='");
    expect(client).not.toContain('https://api.qrserver.com');
    expect(ar).not.toContain('https://api.qrserver.com');
    expect(en).not.toContain('https://api.qrserver.com');
    expect(api).toContain("action === 'qr'");
    expect(api).toContain('https://api.qrserver.com');
  });

  test('verification pages expose document and final PDF integrity evidence', () => {
    for (const rel of ['verify-document.html', 'en/verify-document.html']) {
      const page = read(rel);
      expect(page).toContain('noindex,nofollow');
      expect(page).toContain('/api/correspondence?action=verify');
      expect(page).toContain('checksum_sha256');
      expect(page).toContain('artifact_hash');
      expect(page).toContain('final_pdf_verified');
      expect(page).not.toContain('SUPABASE');
    }
  });

  test('letterhead does not retain executable legacy issuance or stamp fallback', () => {
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    expect(ar).not.toContain("counter.last++");
    expect(en).not.toContain("counter.last++");
    expect(ar).not.toContain('موثّق رقمياً');
    expect(en).not.toContain('Digitally Certified');
    expect(ar).toContain('/components/letterhead-correspondence.js');
    expect(en).toContain('/components/letterhead-correspondence.js');
  });
});
