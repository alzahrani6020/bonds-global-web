/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { scannerConfig, QUARANTINE_BUCKET, APPROVED_BUCKET } = require('../../lib/security/file-security');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('secure file gateway contract', () => {
  test('uses a separate private quarantine namespace before approved storage', () => {
    expect(QUARANTINE_BUCKET).toBe('client-documents-quarantine');
    expect(APPROVED_BUCKET).toBe('client-documents');
  });

  test('scanner is fail-closed when runtime configuration is absent', () => {
    const previousUrl = process.env.BONDS_FILE_SECURITY_REMOTE_URL;
    const previousToken = process.env.BONDS_FILE_SECURITY_TOKEN;
    delete process.env.BONDS_FILE_SECURITY_REMOTE_URL;
    delete process.env.BONDS_FILE_SECURITY_TOKEN;
    expect(scannerConfig()).toEqual({ baseUrl:'', token:'' });
    if (previousUrl !== undefined) process.env.BONDS_FILE_SECURITY_REMOTE_URL = previousUrl;
    if (previousToken !== undefined) process.env.BONDS_FILE_SECURITY_TOKEN = previousToken;
  });

  test('file security capability is registered as a governed adapter', () => {
    expect(getRuntimeAdapter('assistant_file_security_scan')).toEqual(expect.any(Function));
  });

  test('document processing and legacy analysis both fail closed on security approval', () => {
    const processing = fs.readFileSync(path.join(__dirname,'..','..','lib','assistant','document-processing.js'),'utf8');
    const legacy = fs.readFileSync(path.join(__dirname,'..','..','lib','api','analyze-document.js'),'utf8');
    expect(processing).toContain("doc.security_status !== 'clean'");
    expect(processing).toContain("doc.security_verdict !== 'clean'");
    expect(legacy).toContain("doc.security_status !== 'clean'");
    expect(legacy).toContain("doc.security_verdict !== 'clean'");
  });

  test('assistant uploads to quarantine and asks the governed scan before parsing', () => {
    const widget = fs.readFileSync(path.join(__dirname,'..','..','v3','components','ai-chat-widget.js'),'utf8');
    expect(widget).toContain(".from(CLIENT_DOCUMENTS_QUARANTINE_BUCKET)");
    expect(widget).toContain("executeAttachmentCapability('file_security_scan'");
    expect(widget.indexOf("executeAttachmentCapability('file_security_scan'"))
      .toBeLessThan(widget.indexOf("executeAttachmentCapability('document_analyze'"));
  });
});
