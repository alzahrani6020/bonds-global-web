/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('funding file journey status', () => {
  test('Arabic and English funding pages expose all eight status-aware form links', () => {
    for (const file of ['funding-extraction.html', 'en/funding-extraction.html']) {
      const page = read(file);
      expect(page).toContain('data-funding-file');
      expect(page).toContain('data-funding-file-summary');
      expect(page).toContain('data-funding-file-progress');
      for (const key of [
        'kyc','establishment','activity','cash_flow',
        'receivables','payables','credit_business','credit_individual'
      ]) {
        expect(page).toContain(`data-funding-file-item="${key}"`);
      }
      expect(page).toContain('funding-file-status.js?v=1');
      expect(page).toContain('funding-file-status.css?v=1');
    }
  });

  test('status loader reads the seven canonical client tables under the signed-in user', () => {
    const script = read('scripts/funding-file-status.js');
    for (const table of [
      'client_kyc_cases',
      'client_establishment_profiles',
      'client_business_activity_profiles',
      'client_cash_flow_reports',
      'client_receivables_aging_reports',
      'client_payables_aging_reports',
      'client_credit_consents'
    ]) {
      expect(script).toContain(table);
    }
    expect(script).toContain(".eq('user_id', userId)");
    expect(script).toContain("subjectType: 'business'");
    expect(script).toContain("subjectType: 'individual'");
    expect(script).toContain('window.BondsAuth.getUser()');
    expect(script).toContain('window.BondsAuth.getSupabase()');
  });

  test('completion only counts submitted or review/approval states', () => {
    const script = read('scripts/funding-file-status.js');
    expect(script).toContain("new Set(['submitted', 'reviewed', 'under_review', 'approved'])");
    expect(script).toContain("'additional_information_required'");
    expect(script).toContain("'revoked'");
    expect(script).toContain("'rejected'");
  });
});
