/**
 * @jest-environment node
 */

const {
  WORKSPACE_TYPES,
  workspaceTypeFor,
  resolveServiceWorkspace
} = require('../../lib/services/service-workspace-resolver');

describe('canonical service workspace resolver', () => {
  test('maps accounting operations to accounting workspace', () => {
    expect(workspaceTypeFor({
      category_code:'financial_advisory',
      group_code:'accounting_records'
    })).toBe(WORKSPACE_TYPES.ACCOUNTING);
  });

  test('maps financial analysis families to financial-analysis workspace', () => {
    for (const group_code of [
      'core_financial_analysis',
      'leverage_capital_debt',
      'returns_margins',
      'working_capital_cash',
      'comparative_trends',
      'risk_resilience',
      'growth_value_diagnostics'
    ]) {
      expect(workspaceTypeFor({ category_code:'financial_advisory', group_code }))
        .toBe(WORKSPACE_TYPES.FINANCIAL_ANALYSIS);
    }
  });

  test('maps tax services to tax-compliance workspace', () => {
    expect(workspaceTypeFor({
      category_code:'tax_zakat',
      group_code:'vat_services'
    })).toBe(WORKSPACE_TYPES.COMPLIANCE);
  });

  test('request-only services stay on request workflow', () => {
    expect(resolveServiceWorkspace(
      { category_code:'financial_advisory', group_code:'core_financial_analysis' },
      { execution_status:'request_only', execution_mode:'request_only', primary_action:null }
    )).toMatchObject({
      type:WORKSPACE_TYPES.ADVISORY,
      mode:'request',
      route_ar:'/service-request.html',
      route_en:'/en/service-request.html'
    });
  });

  test('capability-backed services use canonical workspace route', () => {
    expect(resolveServiceWorkspace(
      { category_code:'financial_advisory', group_code:'core_financial_analysis' },
      { execution_status:'automated', execution_mode:'capability_plan', primary_action:'financial_analysis_run' }
    )).toMatchObject({
      type:WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
      mode:'execute',
      route_ar:'/my-bonds/workspace/',
      route_en:'/en/my-bonds/workspace/'
    });
  });
});
