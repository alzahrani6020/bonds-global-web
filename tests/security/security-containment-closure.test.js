const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const MIGRATION = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20261017073239_security_containment_closure.sql'),
  'utf8'
);
const PRIVATE_HELPER_MIGRATION = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20261017073325_move_recovery_access_helper_private.sql'),
  'utf8'
);
const PAYMENTS = fs.readFileSync(path.join(ROOT, 'api/payments.js'), 'utf8');
const RECOVERY = fs.readFileSync(path.join(ROOT, 'admin/distressed-recovery/service.js'), 'utf8');
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const RELEASE = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-vercel.yml'), 'utf8');

describe('security containment closure', () => {
  test('avatars mutations are owner_id scoped', () => {
    expect(MIGRATION).toMatch(/avatars_authenticated_update[\s\S]*owner_id = auth\.uid\(\)::text[\s\S]*WITH CHECK[\s\S]*owner_id = auth\.uid\(\)::text/i);
    expect(MIGRATION).toMatch(/avatars_authenticated_delete[\s\S]*owner_id = auth\.uid\(\)::text/i);
  });

  test('social media direct authenticated upload is removed', () => {
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS "Social media authenticated upload"/i);
    expect(MIGRATION).not.toMatch(/CREATE POLICY "Social media authenticated upload"/i);
  });

  test('advisory reports bucket is private and client reads stay authorized', () => {
    expect(MIGRATION).toMatch(/UPDATE storage\.buckets[\s\S]*SET public = false[\s\S]*advisory-reports/i);
    expect(MIGRATION).toMatch(/advisory_reports_storage_select[\s\S]*is_advisory_user\(\)[\s\S]*advisory_clients[\s\S]*auth_user_id = auth\.uid\(\)/i);
  });

  test('recovery reads and audit writes are authorized', () => {
    for (const policy of [
      'recovery_assets_select','recovery_valuations_select','recovery_costs_select',
      'recovery_documents_select','recovery_investors_select','recovery_offers_select',
      'recovery_notes_select','recovery_plans_select','recovery_logs_select'
    ]) expect(MIGRATION).toContain(policy);
    expect(MIGRATION).not.toMatch(/recovery_(assets|valuations|costs|documents|investors|offers|notes|plans|logs)_select[\s\S]{0,180}USING \(true\)/i);
    expect(MIGRATION).toMatch(/recovery_logs_write[\s\S]*recovery_is_manager_or_admin\(auth\.uid\(\)\)[\s\S]*created_by = auth\.uid\(\)/i);
    expect(MIGRATION).toMatch(/city_logs_write[\s\S]*city_is_manager_or_admin\(auth\.uid\(\)\)[\s\S]*created_by = auth\.uid\(\)/i);
  });

  test('recovery authorization helper is moved out of the exposed public schema', () => {
    expect(PRIVATE_HELPER_MIGRATION).toMatch(/CREATE SCHEMA IF NOT EXISTS private/i);
    expect(PRIVATE_HELPER_MIGRATION).toMatch(/FUNCTION private\.recovery_can_access\(user_uuid uuid\)/i);
    expect(PRIVATE_HELPER_MIGRATION).toMatch(/DROP FUNCTION IF EXISTS public\.recovery_can_access\(uuid\)/i);
    expect(PRIVATE_HELPER_MIGRATION).toMatch(/private\.recovery_can_access\(auth\.uid\(\)\)/i);
  });

  test('one-off fulfillment is delegated to atomic database RPC', () => {
    expect(MIGRATION).toContain('fulfill_oneoff_purchase_atomic');
    expect(PAYMENTS).toMatch(/\.rpc\(\s*'fulfill_oneoff_purchase_atomic'/);
    expect(PAYMENTS).not.toMatch(/select\('oneoff_credits'\)[\s\S]*credits\[product\]/);
  });

  test('private recovery documents use signed URLs only', () => {
    expect(RECOVERY).toMatch(/createSignedUrl\(doc\.storage_path,\s*900\)/);
    expect(RECOVERY).not.toMatch(/from\('recovery-documents'\)[\s\S]*getPublicUrl\(/);
  });

  test('production release is gated on successful CI and promotes the exact staged deployment', () => {
    const deploymentEnabled = VERCEL.git?.deploymentEnabled;
    const autoDeployDisabled = deploymentEnabled === false
      || (deploymentEnabled && deploymentEnabled.main === false && deploymentEnabled['**'] === false);
    expect(autoDeployDisabled).toBe(true);
    expect(RELEASE).toMatch(/workflow_run:/);
    expect(RELEASE).toMatch(/conclusion == 'success'/);
    expect(RELEASE).toMatch(/github\.event\.workflow_run\.head_sha/);
    expect(RELEASE).toMatch(/vercel deploy (?:--prebuilt )?--prod --skip-domain/);
    expect(RELEASE).toMatch(/Smoke test staged deployment/);
    expect(RELEASE).toMatch(/(?:vercel promote|\/v10\/projects\/\$VERCEL_PROJECT_ID\/promote\/\$deployment_id)/);
    expect(RELEASE).toMatch(/Verify Production SHA/);
  });
});
