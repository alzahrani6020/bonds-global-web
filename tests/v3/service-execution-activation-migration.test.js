'use strict';

const fs = require('fs');
const path = require('path');

describe('mapped request-only activation migration', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261026013000_activate_mapped_request_only_services.sql'),
    'utf8'
  );

  test('fails closed on the verified candidate count', () => {
    expect(sql).toContain('if candidate_count <> 36 then');
  });

  test('activates only services with exactly one mapped capability', () => {
    expect((sql.match(/having count\(\*\) = 1/g) || []).length).toBe(2);
    expect(sql).toContain('bool_and(m.capability_code in (');
  });

  test('allows only existing governed deterministic actions', () => {
    for (const action of [
      'financial_analysis_run',
      'risk_analysis_run',
      'funding_readiness_run',
      'cash_flow_analysis_run',
      'scenario_forecast_run'
    ]) {
      expect(sql).toContain("'"+action+"'");
    }
    expect(sql).not.toContain("'orchestrator_run'");
  });

  test('preserves request-only services without a verified capability mapping', () => {
    expect(sql).toContain("p.execution_mode = 'request_only'");
    expect(sql).toContain('p.primary_action is null');
    expect(sql).toContain("execution_status = 'partially_automated'");
    expect(sql).toContain("execution_mode = 'capability_plan'");
  });

  test('records activation provenance and bumps profile version', () => {
    expect(sql).toContain('version = p.version + 1');
    expect(sql).toContain("'activation_source', 'existing_governed_capability_map'");
    expect(sql).toContain("'activation_wave', 'workspace_activation_2026_10_26'");
  });
});
