const fs = require('fs');
const path = require('path');

function migration() {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261026223000_financial_core_wave12_credit_risk.sql'
    ),
    'utf8'
  );
}

describe('Financial core wave 12 credit risk execution contract', () => {
  test('publishes a governed expected-loss service on the existing execution path', () => {
    const sql = migration();

    expect(sql).toContain("'credit_risk_expected_loss'");
    expect(sql).toContain("'credit_risk_run'");
    expect(sql).toContain("'automated'");
    expect(sql).toContain("'capability_plan'");
    expect(sql).toContain("'none'");
    expect(sql).toContain("'requires_governed_parameters'");
    expect(sql).toContain("'does_not_infer_pd_lgd_from_score'");
  });

  test('maps exactly the credit-risk capability without introducing a parallel route', () => {
    const sql = migration();

    expect(sql).toContain("service_capability_map");
    expect(sql).toContain("'credit_risk_run'");
    expect(sql).not.toContain("'creditworthiness_run'");
    expect(sql).not.toContain("'orchestrator_run'");
  });
});
