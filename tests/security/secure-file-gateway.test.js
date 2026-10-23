/** @jest-environment node */

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
});
