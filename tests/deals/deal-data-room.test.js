'use strict';

const fs = require('fs');
const path = require('path');
const {
  DATA_ROOM_BUCKET,
  MAX_FILE_BYTES,
  normalizeUploadSpec,
  normalizeDocumentPatch,
  normalizeGrant,
  normalizeDocumentRequest,
  normalizeDocumentRequestPatch,
  normalizeDueDiligencePatch,
  buildStoragePath,
  memberCanSeeDocument,
  memberCanUploadRequest
} = require('../../lib/deals/deal-data-room');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('F.2 secure data-room domain', () => {
  test('accepts supported files and rejects oversized or executable content', () => {
    expect(normalizeUploadSpec({
      file_name:'قوائم 2026.pdf',
      content_type:'application/pdf',
      size_bytes:1024
    })).toMatchObject({ file_name:'قوائم 2026.pdf', content_type:'application/pdf', size_bytes:1024 });
    expect(() => normalizeUploadSpec({ file_name:'x.exe', content_type:'application/x-msdownload', size_bytes:1 })).toThrow('UPLOAD_CONTENT_TYPE_NOT_ALLOWED');
    expect(() => normalizeUploadSpec({ file_name:'x.pdf', content_type:'application/pdf', size_bytes:MAX_FILE_BYTES + 1 })).toThrow('UPLOAD_SIZE_INVALID');
  });

  test('storage paths are deal/document/version scoped and path-safe', () => {
    const pathValue=buildStoragePath('deal-a','doc-b',3,'../board/minutes.pdf');
    expect(pathValue).toMatch(/^deal-a\/doc-b\/v3\//);
    expect(pathValue).not.toContain('../');
    expect(pathValue).not.toContain('/board/');
  });

  test('counterparty access requires NDA, non-restricted visibility and optional grant', () => {
    const member={ id:'m1', side:'counterparty', nda_status:'signed' };
    expect(memberCanSeeDocument({ visibility:'counterparty', confidentiality:'confidential' },member,[])).toBe(true);
    expect(memberCanSeeDocument({ visibility:'team', confidentiality:'standard' },member,[])).toBe(false);
    expect(memberCanSeeDocument({ visibility:'selected', confidentiality:'standard' },member,[{member_id:'m1',status:'active'}])).toBe(true);
    expect(memberCanSeeDocument({ visibility:'selected', confidentiality:'restricted' },member,[{member_id:'m1',status:'active'}])).toBe(false);
  });

  test('requested-document upload is limited to the assigned NDA-signed counterparty', () => {
    const member={ id:'m1', side:'counterparty', nda_status:'signed' };
    expect(memberCanUploadRequest({ requested_from_member_id:'m1', status:'open' },member)).toBe(true);
    expect(memberCanUploadRequest({ requested_from_member_id:'m2', status:'open' },member)).toBe(false);
    expect(memberCanUploadRequest({ requested_from_member_id:'m1', status:'fulfilled' },member)).toBe(false);
  });

  test('normalizers reject unsupported workflow state', () => {
    expect(normalizeDocumentPatch({ visibility:'selected' })).toEqual({ visibility:'selected' });
    expect(() => normalizeDocumentPatch({ visibility:'public' })).toThrow('DOCUMENT_VISIBILITY_INVALID');
    expect(normalizeGrant({ member_id:'11111111-1111-4111-8111-111111111111' }).status).toBe('active');
    expect(normalizeDocumentRequest({ title:'Tax certificates' }).status).toBeUndefined();
    expect(normalizeDocumentRequestPatch({ status:'fulfilled' })).toEqual({ status:'fulfilled' });
    expect(normalizeDueDiligencePatch({ status:'complete', risk_rating:'high' })).toEqual({ status:'complete', risk_rating:'high' });
  });

  test('migration creates a private bucket, append-only access log and no public storage policy', () => {
    const sql=read('supabase/migrations/20261112120500_secure_deal_data_room.sql');
    expect(sql).toContain("'deal-data-room'");
    expect(sql).toMatch(/false,\s*52428800/i);
    expect(sql).toContain('create table if not exists public.bonds_deal_document_versions');
    expect(sql).toContain('create table if not exists public.bonds_deal_document_requests');
    expect(sql).toContain('create table if not exists public.bonds_deal_document_access_log');
    expect(sql).toMatch(/before update or delete on public\.bonds_deal_document_access_log/i);
    expect(sql).not.toMatch(/create policy[\s\S]*storage\.objects/i);
    expect(sql).not.toMatch(/grant[\s\S]*storage\.objects/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  test('bucket constant matches migration', () => {
    expect(DATA_ROOM_BUCKET).toBe('deal-data-room');
  });
});
