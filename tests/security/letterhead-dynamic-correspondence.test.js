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
    expect(client).toContain("api('mark-signature'");
    expect(client).toContain("api('mark-stamp'");
    expect(client).toContain("api('send'");
    expect(client).toContain("verification_token");
    expect(client).toContain("Import legacy drafts");
    expect(client).toContain("for (let i = 0; i < sheets.length; i++)");
  });

  test('verification page is public-read only and noindex', () => {
    const page = read('verify-document.html');
    expect(page).toContain('noindex,nofollow');
    expect(page).toContain('/api/correspondence?action=verify');
    expect(page).toContain('checksum_sha256');
    expect(page).not.toContain('SUPABASE');
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
