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
    expect(api).toContain("Approved document requires a signature record with signer name and capacity before issuance");
    expect(api).toContain("Sending correspondence requires admin permission");
    expect(api).toContain("Only issued documents can be sent");
    expect(api).toContain("action === 'verify'");
    expect(api).toContain("action === 'mark-signature'");
    expect(api).toContain("action === 'mark-stamp'");
    expect(api).toContain("Recipient must match the governed document recipient or an authorized administrative address");
    expect(api).toContain("['confidential','restricted'].includes(doc.confidentiality)");
    expect(api).toContain("confidentiality.in.(public,internal)");
    expect(api).toContain("pagination: { page, page_size: pageSize, total: Number(count || 0) }");
    expect(api).toContain("signature_data_url");
    expect(api).toContain("issued_hash");
    const atomic = read('supabase/migrations/20261112084310_correspondence_integrity_hardening.sql');
    expect(atomic).toContain('signature_image_data = null');
    expect(atomic).toContain('stamp_hash = null');
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
    expect(api).toContain("action === 'artifact-download-url'");
    expect(api).toContain('artifact_document_hash');
    expect(api).toContain('artifact_issued_hash');
    expect(api).toContain('artifact_version');
    expect(client).toContain('downloadOfficialPdf');
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

  test('public verification preview is integrity-gated and renders the official PDF with an electronic seal', () => {
    const api = read('lib/api/correspondence.js');
    const ar = read('verify-document.html');
    const en = read('en/verify-document.html');

    expect(api).toContain("action === 'official-preview'");
    expect(api).toContain('isOfficialArtifactBindingValid');
    expect(api).toContain('artifact_document_hash === doc.document_hash');
    expect(api).toContain('artifact_issued_hash === doc.issued_hash');
    expect(api).toContain('Number(doc.artifact_version || 0) === Number(doc.current_version || 0)');
    expect(api).toContain("Content-Disposition");
    expect(api).toContain("Content-Type', 'application/pdf");
    expect(api).toContain("Cache-Control', 'private, no-store, max-age=0");
    expect(api).toContain('Official PDF artifact integrity check failed');

    for (const page of [ar, en]) {
      expect(page).toContain('official_preview_url');
      expect(page).toContain('id="official-viewer"');
      expect(page).not.toContain('id="seal"');
      expect(page).toContain('id="official-viewer"');
      expect(page).toContain('stamp_verified');
      expect(page).toContain('/components/verified-pdf-viewer.js?v=1');
      expect(page).not.toContain('window.BondsOfficialSeal.create(');
      expect(page).toContain('const pdfMatches=await window.BondsVerifiedPdfViewer.render({');
      expect(page).toContain('final_pdf_verified');
      expect(page).toContain('signature_verified');
      expect(page).toContain('id="failure"');
    }
    expect(read('components/bonds-official-seal.js')).toContain('تصديق الختم الإلكتروني');
    expect(ar).toContain('BondsVerifiedPdfViewer.render({');
    expect(read('components/bonds-official-seal.js')).toContain('ELECTRONIC STAMP CERTIFICATION');
    expect(en).toContain('BondsVerifiedPdfViewer.render({');
  });

  test('letterhead footer and PDF output stay within A4 in both locales', () => {
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    const client = read('components/letterhead-correspondence.js');

    for (const page of [ar, en]) {
      expect(page).toContain('flex-wrap: wrap');
      expect(page).toContain('width: 16mm; height: 16mm');
      expect(page).toContain('flex: 0 1 auto');
      expect(page).toContain('white-space: nowrap');
      expect(page).toContain('break-inside: avoid');
      expect(page).toContain('page-break-inside: avoid');
      expect(page).toContain('pageHeightPx');
      expect(page).toContain('sliceHeight');
      expect(page).not.toContain("sheet.querySelector('.footer-qr-corner img')");
      expect(page).toContain('width: 238px');
      expect(page).toContain('height: 152px');
    }

    expect(client).toContain("row.style.marginBottom = '8mm'");
    expect(client).toContain('const pageHeightPx = Math.floor(canvas.width * 297 / 210)');
    expect(client).toContain('const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx))');
    expect(read('components/bonds-official-seal.js')).toContain('تصديق الختم الإلكتروني');
    expect(read('components/bonds-official-seal.js')).toContain('ELECTRONIC STAMP CERTIFICATION');
    expect(read('components/bonds-official-seal.js')).toContain('رقم السجل 39733');
    expect(read('components/bonds-official-seal.js')).toContain('CR 39733');
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

  test('command center enforces granular permissions, task SLA and governed delivery', () => {
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');
    const migration = read('supabase/migrations/20261111233000_correspondence_command_center.sql');
    const webhook = read('api/email-webhook.mjs');
    const email = read('lib/api/email.js');

    expect(migration).toContain('correspondence_tasks');
    expect(migration).toContain('correspondence_user_permissions');
    expect(migration).toContain('delivery_status');
    expect(migration).toContain('provider_message_id');
    expect(migration).toContain('requires_signature');
    expect(migration).toContain('requires_stamp');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.correspondence_tasks from anon, authenticated');
    expect(migration).not.toMatch(/\bdrop\s+(table|column|constraint|trigger)\b/i);
    expect(migration).not.toMatch(/\btruncate\b|\bdelete\s+from\b/i);

    expect(api).toContain('resolveCorrespondencePermissions');
    expect(api).toContain("permissionByTarget");
    expect(api).toContain("target === doc.status");
    expect(api).toContain("idempotent: true");
    expect(api).toContain("allowed_targets: allowedTargets");
    expect(api).toContain('Segregation of duties prevents the document creator');
    expect(api).toContain('A reason is required for return, rejection or cancellation');
    expect(api).toContain("doc.recipient_email");
    expect(api).toContain("delivery_status: 'accepted'");
    expect(api).toContain("action === 'summary'");
    expect(api).toContain("action === 'my-work'");
    expect(api).toContain("issued: ['archived']");
    expect(api).not.toContain("issued: ['sent', 'archived']");
    expect(api).not.toContain("sent: 'send'");
    expect(api).toContain("await completeOpenTasks(sb, doc.id, user.id, 'send')");
    expect(api).toContain("await createOpenTask(sb, doc.id, 'archive'");
    expect(api).toContain("page_size");
    expect(api).toContain("['confidential','restricted']");

    expect(client).toContain('corr-command-drawer');
    expect(client).toContain('corr-workflow-strip');
    expect(client).toContain('renderWorkflowStrip');
    expect(client).toContain('setCommandDrawer');
    expect(client).toContain('statusLabel');
    expect(client).toContain('refreshCommandCenter');
    expect(client).toContain('searchCommandCenter');
    expect(client).toContain('renderTimeline');
    expect(client).toContain('canEditCurrent');
    expect(client).toContain('state.transitionPending');
    expect(client).toContain("error?.data?.current_status");
    expect(client).toContain('The latest state has been loaded.');
    expect(client).toContain('hideLegacyGovernanceTriggers');
    expect(client).toContain('button[onclick="sendToManager()"]');
    expect(client).toContain("can('approve')");
    expect(client).toContain("visible.add('corr-stamp')");
    expect(client).toContain("can('stamp') && status === 'approved'");
    expect(client).toContain("!!doc?.requires_stamp && !doc?.stamped_by");
    expect(client).toContain("window.prompt");
    expect(client).toContain('corr-cancel');
    expect(client).toContain("isEn ? 'Send to recipient' : 'إرسال للمستلم'");
    expect(client).toContain("isEn ? 'Secure final PDF' : 'تثبيت النسخة النهائية'");

    expect(webhook).toContain("'email.delivered': 'delivered'");
    expect(webhook).toContain("'email.bounced': 'bounced'");
    expect(webhook).toContain("'email.complained': 'complained'");
    expect(webhook).toContain("event?.data?.email_id");
    expect(webhook).toContain("eq('provider_message_id', providerMessageId)");
    expect(email).toContain("provider: 'smtp'");
  });
  test('device import is distinct from cloud load and remains governed', () => {
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');

    expect(ar).toContain('id="document-import"');
    expect(en).toContain('id="document-import"');
    expect(ar).toContain("document.getElementById('document-import').click()");
    expect(en).toContain("document.getElementById('document-import').click()");
    expect(ar).toContain('من الجهاز');
    expect(en).toContain('From device');

    expect(client).toContain('window.importDocumentFromDevice');
    expect(client).toContain("api('import-device'");
    expect(client).toContain("if (!canEditCurrent())");
    expect(client).toContain("file.size > 2 * 1024 * 1024");
    expect(client).toContain("/\\.(txt|html?|docx|pdf)$/i");

    expect(api).toContain("action === 'import-device'");
    expect(api).toContain("require('mammoth')");
    expect(api).toContain("Unsupported import type. Use TXT, HTML, HTM, DOCX, or PDF");
    expect(api).toContain("require('pdf-parse/worker')");
    expect(api).toContain("const { PDFParse } = require('pdf-parse')");
    expect(api).toContain('sanitizeHtml(html)');

    expect(client).toContain('window.loadDraftsFromCloud');
    expect(ar).toContain('تحميل المراسلات من السحابة');
    expect(en).toContain('Load correspondence from cloud');
  });


  test('integrity hardening makes saves atomic, delivery idempotent and operational queries scalable', () => {
    const api = read('lib/api/correspondence.js');
    const email = read('lib/api/email.js');
    const atomic = read('supabase/migrations/20261112084310_correspondence_integrity_hardening.sql');
    const ops = read('supabase/migrations/20261112090611_correspondence_company_filter_canonical.sql');

    expect(atomic).toContain('save_correspondence_version_atomic');
    expect(atomic).toContain('for update');
    expect(atomic).toContain('security invoker');
    expect(atomic).toContain('artifact_document_hash');
    expect(atomic).toContain('send_idempotency_key');
    expect(ops).toContain('get_correspondence_summary_v2');
    expect(ops).toContain('get_correspondence_my_work_v2');
    expect(ops).toContain('security invoker');
    expect(api).toContain("sb.rpc('save_correspondence_version_atomic'");
    expect(api).toContain("sb.rpc('get_correspondence_summary_v2'");
    expect(api).toContain("sb.rpc('get_correspondence_my_work_v2'");
    expect(api).not.toContain('.limit(1000)');
    expect(api).not.toContain('.limit(200)');
    expect(api).toContain("const idempotencyKey = ('correspondence-send/'");
    expect(email).toContain('{ idempotencyKey }');
    expect(email).toContain('Idempotent delivery requires the Resend provider');
  });

  test('final PDF export rejects overflowing sheets and keeps Arabic markers RTL', () => {
    const client = read('components/letterhead-correspondence.js');
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    expect(client).toContain('canvas.height > pageHeightPx + 1');
    expect(client).toContain('onclone: clonedDocument =>');
    expect(client).toContain('contentBottom > footerTop + 1');
    expect(client).toContain('clonedSheet.scrollHeight > clonedSheet.clientHeight + 1');
    expect(client).toContain('windowWidth: Math.max(1280, window.innerWidth)');
    expect(client).toContain('const totalPages = 1');
    expect(client).toContain('overflows A4');
    expect(ar).toContain('.doc-content[dir="rtl"] ol');
    expect(ar).toContain('direction: rtl; text-align: right');
    expect(en).toContain('ol[dir="rtl"]');
  });

});
