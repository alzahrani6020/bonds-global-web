/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('funding file architecture', () => {
  test('funding pages render the journey from a dynamic registry container', () => {
    for (const file of ['funding-extraction.html', 'en/funding-extraction.html']) {
      const page = read(file);
      expect(page).toContain('data-funding-file');
      expect(page).toContain('data-funding-file-grid');
      expect(page).toContain('data-funding-file-summary');
      expect(page).toContain('data-funding-file-progress');
      expect(page).toContain('funding-file-status.js?v=1');
      expect(page).toContain('funding-case-context.js?v=1');
      expect(page).not.toContain('data-funding-file-item=');
    }
  });

  test('status loader reads registry and per-case submissions instead of hardcoded form tables', () => {
    const script = read('scripts/funding-file-status.js');
    expect(script).toContain("from('funding_file_stages')");
    expect(script).toContain("from('funding_file_requirements')");
    expect(script).toContain("from('funding_case_submissions')");
    expect(script).toContain("eq('case_id', caseId)");
    expect(script).toContain('completion_statuses');
    expect(script).not.toContain('const ITEMS = [');
    expect(script).not.toContain("client_kyc_cases");
    expect(script).not.toContain("client_credit_consents");
  });

  test('form context resolves a funding case owned by the signed-in user', () => {
    const helper = read('lib/forms/funding-case-context.js');
    expect(helper).toContain("from('funding_cases')");
    expect(helper).toContain(".eq('id', caseId)");
    expect(helper).toContain(".eq('user_id', user.id)");
    expect(helper).toContain("url.searchParams.set('case', caseId)");
  });

  test('migration anchors requirements and submissions on funding_cases', () => {
    const migration = read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain('create table if not exists public.funding_file_stages');
    expect(migration).toContain('create table if not exists public.funding_file_requirements');
    expect(migration).toContain('create table if not exists public.funding_case_submissions');
    expect(migration).toContain('case_id uuid not null references public.funding_cases(id) on delete cascade');
    expect(migration).toContain('constraint funding_case_submissions_case_requirement_key unique (case_id, requirement_id)');
    expect(migration).toContain("check (data_scope in ('account','case'))");
    expect(migration).toContain("'account'");
    expect(migration).toContain("'case'");
    expect(migration).toContain('add column if not exists notes text');
  });

  test('all eight existing requirements are seeded with reusable account data and case-specific reports', () => {
    const migration = read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    for (const code of [
      "'kyc'","'establishment'","'activity'","'cash_flow'",
      "'receivables'","'payables'","'credit_business'","'credit_individual'"
    ]) {
      expect(migration).toContain(code);
    }
    expect(migration).toContain("'client_kyc_cases','{}'::jsonb,'account'");
    expect(migration).toContain("'client_establishment_profiles','{}'::jsonb,'account'");
    expect(migration).toContain("'client_business_activity_profiles','{}'::jsonb,'account'");
    expect(migration).toContain("'client_cash_flow_reports','{}'::jsonb,'case'");
    expect(migration).toContain("'client_credit_consents','{\"subject_type\":\"business\"}'::jsonb,'case'");
    expect(migration).not.toContain('client_kyc_cases add column if not exists funding_case_id');
    expect(migration).not.toContain('client_establishment_profiles add column if not exists funding_case_id');
  });

  test('database derives submission status from the owned source record', () => {
    const migration = read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain('create or replace function public.validate_funding_case_submission_source()');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('v_source_user is distinct from auth.uid()');
    expect(migration).toContain("v_requirement.source_filter <> '{}'::jsonb");
    expect(migration).toContain("v_requirement.data_scope = 'case'");
    expect(migration).toContain('new.status := v_source_status');
    expect(migration).toContain('new.submitted_at := v_source_submitted_at');
  });

  test('source status changes propagate to every attached funding case', () => {
    const migration = read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain('create or replace function public.propagate_funding_submission_source_state()');
    expect(migration).toContain('after update of status, submitted_at on public.client_kyc_cases');
    expect(migration).toContain('after update of status, submitted_at on public.client_cash_flow_reports');
    expect(migration).toContain('after update of status, submitted_at on public.client_credit_consents');
    expect(migration).toContain('s.source_record_id = new.id');
    expect(migration).toContain('r.source_table = tg_table_name');
  });

  test('shared context synchronizes any requirement without hardcoding source tables', () => {
    const helper = read('lib/forms/funding-case-context.js');
    expect(helper).toContain("from('funding_file_requirements')");
    expect(helper).toContain("from('funding_case_submissions')");
    expect(helper).toContain("onConflict: 'case_id,requirement_id'");
    expect(helper).toContain('requirementCode');
  });
});
