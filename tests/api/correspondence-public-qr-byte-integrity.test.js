/** @jest-environment node */
'use strict';

// Behavioral, isolated tests of the public QR verification and PDF retrieval API.
// All storage/DB objects are synthetic; no production issuance or mutation.
const crypto = require('crypto');
const mockSb = { from: jest.fn(), storage: { from: jest.fn() } };
jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSb));
jest.mock('../../lib/api/email', () => ({ sendEmail: jest.fn() }));
const { handler } = require('../../lib/api/correspondence');

const TOKEN = '11111111-2222-4333-8444-555555555555';
const DOC_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const goodPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'utf8');
const hash = crypto.createHash('sha256').update(goodPdf).digest('hex');

function res() {
  return {
    statusCode: 200, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }
  };
}

function query(result) {
  const q = {
    select: () => q, eq: () => q, order: () => q, limit: () => q,
    maybeSingle: async () => ({ data: result, error: null }),
    then(resolve, reject) { return Promise.resolve({ data: result, error: null }).then(resolve, reject); }
  };
  return q;
}

function fixture(bytes, downloadError = null) {
  const doc = {
    id: DOC_ID, title: 'وثيقة اختبارية', subject: 'وثيقة اختبارية',
    status: 'issued', current_version: 1,
    document_hash: 'document-hash', issued_hash: 'issue-hash',
    artifact_path: 'synthetic/' + DOC_ID + '/v1/test.pdf',
    artifact_hash: hash, artifact_document_hash: 'document-hash',
    artifact_issued_hash: 'issue-hash', artifact_version: 1
  };
  const issue = {
    id: 'fake-issue-id', document_id: DOC_ID,
    verification_token: TOKEN, issue_version: 1, issue_number: 'TEST-ONLY',
    state: 'active', pdf_hash: hash, document_hash: 'document-hash',
    issued_hash: 'issue-hash', verification_count: 0
  };
  mockSb.from.mockImplementation(table => {
    if (table === 'correspondence_issues') {
      return {
        select: () => query(issue),
        update: () => ({ eq: async () => ({ data: null, error: null }) })
      };
    }
    if (table === 'correspondence_documents') return query(doc);
    throw new Error('Unexpected synthetic query ' + table);
  });
  mockSb.storage.from.mockReturnValue({
    download: jest.fn(async () => downloadError
      ? { data: null, error: downloadError }
      : { data: { arrayBuffer: async () => bytes }, error: null })
  });
}

async function call(action) {
  const req = {
    method: 'GET', headers: { host: 'localhost' },
    query: { action, token: TOKEN },
    url: '/api/correspondence?action=' + action + '&token=' + TOKEN
  };
  const response = res();
  await handler(req, response);
  return response;
}

describe('QR verification: stored bytes, not database assertion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('matching stored PDF exposes verified preview and serves identical bytes', async () => {
    fixture(goodPdf);
    const verification = await call('verify');
    expect(verification.statusCode).toBe(200);
    expect(verification.body.final_pdf_verified).toBe(true);
    expect(verification.body.artifact_hash).toBe(hash);
    expect(verification.body.official_preview_url).toContain('official-preview');

    const download = await call('official-preview');
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(Buffer.isBuffer(download.body)).toBe(true);
    expect(download.body.equals(goodPdf)).toBe(true);
    expect(crypto.createHash('sha256').update(download.body).digest('hex')).toBe(hash);
  });

  test('modified PDF bytes never receive verified status or preview URL', async () => {
    fixture(Buffer.from('%PDF-1.4\nTAMPERED\n%%EOF'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const verification = await call('verify');
      expect(verification.statusCode).toBe(200);
      expect(verification.body.verified).toBe(true); // issue exists, but PDF is invalid
      expect(verification.body.final_pdf_verified).toBe(false);
      expect(verification.body.official_preview_url).toBeNull();
      expect(verification.body.official_pdf_url).toBeNull();
      const preview = await call('official-preview');
      expect(preview.statusCode).toBe(409);
      expect(preview.body.error).toMatch(/integrity/i);
    } finally { spy.mockRestore(); }
  });

  test('missing archived object is not represented as verified PDF', async () => {
    fixture(null, new Error('Object not found'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const verification = await call('verify');
      expect(verification.statusCode).toBe(200);
      expect(verification.body.final_pdf_verified).toBe(false);
      expect(verification.body.official_preview_url).toBeNull();
      expect(verification.body.official_pdf_url).toBeNull();
    } finally { spy.mockRestore(); }
  });
});
