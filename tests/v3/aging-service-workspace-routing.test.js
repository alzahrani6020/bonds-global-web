'use strict';

const fs = require('fs');
const path = require('path');

describe('aging services reuse existing workspaces', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(),'supabase/migrations/20261027006500_route_aging_services_to_existing_workspaces.sql'),
    'utf8'
  );

  test('fails closed unless both request-only candidates are present', () => {
    expect(migration).toContain('if candidate_count <> 2 then');
    expect(migration).toContain("p.execution_mode='request_only'");
  });

  test('routes receivables and payables to their existing Arabic and English workspaces', () => {
    expect(migration).toContain("'/client/receivables-aging.html'");
    expect(migration).toContain("'/en/client/receivables-aging.html'");
    expect(migration).toContain("'/client/payables-aging.html'");
    expect(migration).toContain("'/en/client/payables-aging.html'");
  });

  test('does not promote either service to capability_plan', () => {
    expect(migration).not.toContain("execution_mode='capability_plan'");
    expect(migration).not.toContain('service_capability_map');
    expect(migration).not.toContain('primary_action');
  });

  test('existing aging workspaces remain governed and user-owned', () => {
    const ar = fs.readFileSync(path.join(process.cwd(),'client/receivables-aging.html'),'utf8');
    const ap = fs.readFileSync(path.join(process.cwd(),'client/payables-aging.html'),'utf8');
    expect(ar).toContain("from('client_receivables_aging_reports')");
    expect(ap).toContain("from('client_payables_aging_reports')");
    expect(ar).toContain('BondsBrandedExport.exportDocument');
    expect(ap).toContain('BondsBrandedExport.exportDocument');
  });
});
