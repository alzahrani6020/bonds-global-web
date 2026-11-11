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

  test('request-only marketing routes do not become workspaces implicitly', () => {
    expect(resolveServiceWorkspace(
      {
        category_code:'financial_advisory',
        group_code:'planning_cashflow',
        default_route_ar:'/services#strategy',
        default_route_en:'/en/services#strategy'
      },
      { execution_status:'request_only', execution_mode:'request_only', primary_action:null }
    )).toMatchObject({
      type:WORKSPACE_TYPES.ADVISORY,
      mode:'request',
      dedicated:false,
      route_ar:'/service-request.html',
      route_en:'/en/service-request.html'
    });
  });

  test('explicitly tagged request workspaces preserve their dedicated routes', () => {
    expect(resolveServiceWorkspace(
      {
        category_code:'financial_advisory',
        group_code:'working_capital_cash',
        default_route_ar:'/client/receivables-aging.html',
        default_route_en:'/en/client/receivables-aging.html',
        metadata:{workspace_route_source:'existing_client_aging_workspace'}
      },
      { execution_status:'request_only', execution_mode:'request_only', primary_action:null }
    )).toMatchObject({
      type:WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
      mode:'request',
      dedicated:true,
      route_ar:'/client/receivables-aging.html',
      route_en:'/en/client/receivables-aging.html',
      reason:'explicit_request_workspace'
    });
  });

  test('valuation keeps its dedicated product route while remaining executable', () => {
    expect(resolveServiceWorkspace(
      {
        code:'asset_company_valuation',
        category_code:'studies_valuation',
        group_code:'studies_valuation',
        default_route_ar:'/valuation/',
        default_route_en:'/en/valuation/'
      },
      { execution_status:'fully_orchestrated', execution_mode:'capability_plan', primary_action:'orchestrator_run' }
    )).toMatchObject({
      type:WORKSPACE_TYPES.STUDIES_VALUATION,
      mode:'execute',
      dedicated:true,
      route_ar:'/valuation/',
      route_en:'/en/valuation/',
      reason:'dedicated_execute_route'
    });
  });

  test('scientific research stays in the studies workspace', () => {
    expect(workspaceTypeFor({
      category_code:'business_market',
      group_code:'business_market'
    })).toBe(WORKSPACE_TYPES.STUDIES_VALUATION);
    expect(resolveServiceWorkspace(
      {
        code:'scientific_research',
        category_code:'business_market',
        group_code:'business_market'
      },
      { execution_status:'fully_orchestrated', execution_mode:'capability_plan', primary_action:'orchestrator_run' }
    )).toMatchObject({
      type:WORKSPACE_TYPES.STUDIES_VALUATION,
      mode:'execute',
      route_ar:'/my-bonds/workspace/?service=scientific_research',
      route_en:'/en/my-bonds/workspace/?service=scientific_research'
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
