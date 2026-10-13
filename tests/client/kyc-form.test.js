/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('client KYC intake', () => {
  test('client form covers core KYC and EDD intake sections', () => {
    const page = read('client/kyc.html');
    expect(page).toContain('اعرف عميلك (KYC) والعناية الواجبة');
    expect(page).toContain('المستفيد الحقيقي (UBO)');
    expect(page).toContain('مصدر الأموال والثروة');
    expect(page).toContain('صفة PEP');
    expect(page).toContain('الموافقة على التحقق');
    expect(page).toContain("from('client_kyc_cases')");
  });

  test('client data and internal compliance review are separated', () => {
    const migration = read('supabase/migrations/20261013183000_client_kyc.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.client_kyc_cases');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.client_kyc_reviews');
    expect(migration).toContain('REVOKE ALL ON public.client_kyc_reviews FROM anon, authenticated');
    expect(migration).toContain('user_id = auth.uid()');
  });

  test('authenticated account menu exposes KYC intake', () => {
    const auth = read('bonds-auth-2026.js');
    expect(auth).toContain("const kycUrl = '/client/kyc.html'");
    expect(auth).toContain("اعرف عميلك (KYC)");
  });
});
