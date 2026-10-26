const {
  ENGINE_VERSION,
  runFinancialEngine,
  listFinancialEngines
} = require('../../lib/finance/financial-engine-registry');

const { financialAnalysis } = require('../../lib/finance/engines/financial-analysis-engine');
const { cashFlowAnalysis } = require('../../lib/finance/engines/cash-flow-engine');
const { fundingReadiness, creditworthiness } = require('../../lib/finance/engines/funding-engine');
const { feasibilityAnalysis } = require('../../lib/finance/engines/feasibility-engine');
const { valuationAnalysis } = require('../../lib/finance/engines/valuation-engine');
const { riskAnalysis } = require('../../lib/finance/engines/risk-engine');
const { scenarioForecast } = require('../../lib/finance/engines/scenario-engine');
const { creditRiskAnalysis } = require('../../lib/finance/engines/credit-risk-engine');
const { treasuryLiquidityAnalysis } = require('../../lib/finance/engines/treasury-liquidity-engine');
const { profitabilityIntelligence } = require('../../lib/finance/engines/profitability-intelligence-engine');
const { unitEconomicsAnalysis } = require('../../lib/finance/engines/unit-economics-engine');
const { managementReporting } = require('../../lib/finance/engines/management-reporting-engine');
const { consolidationAnalysis } = require('../../lib/finance/engines/consolidation-engine');
const { fxTranslationAnalysis } = require('../../lib/finance/engines/fx-translation-engine');
const { planningBudgetingAnalysis } = require('../../lib/finance/engines/planning-budgeting-engine');

function stable(result) {
  return {
    ...result,
    evidence: (result.evidence || []).map(item => ({
      ...item,
      timestamp: '<dynamic>'
    }))
  };
}

describe('modular financial engine architecture parity', () => {
  test('preserves engine version and registry surface', () => {
    expect(ENGINE_VERSION).toBe('1.11.0');
    expect(listFinancialEngines().map(item => item.code)).toEqual([
      'financial_analysis',
      'cash_flow_analysis',
      'funding_readiness',
      'creditworthiness',
      'feasibility',
      'valuation',
      'risk_analysis',
      'scenario_forecast',
      'debt_schedule',
      'covenant_monitoring',
      'credit_risk',
      'treasury_liquidity',
      'profitability_intelligence',
      'unit_economics',
      'management_reporting',
      'consolidation',
      'fx_translation',
      'planning_budgeting'
    ]);
  });

  test.each([
    [
      'financial_analysis',
      financialAnalysis,
      {
        revenue: 1200,
        cogs: 500,
        operating_expenses: 300,
        net_income: 180,
        current_assets: 600,
        current_liabilities: 300,
        cash: 120,
        inventory: 150,
        total_assets: 1500,
        total_liabilities: 600,
        total_debt: 450,
        interest_expense: 45
      },
      {}
    ],
    [
      'cash_flow_analysis',
      cashFlowAnalysis,
      {
        opening_balance: 100,
        periods: [
          { period: 1, inflows: { sales: 300 }, outflows: { payroll: 120 } },
          { period: 2, inflows: { sales: 200 }, outflows: { payroll: 130, rent: 50 } }
        ]
      },
      {}
    ],
    [
      'funding_readiness',
      fundingReadiness,
      {
        ebitda: 300,
        operating_cash_flow: 280,
        annual_debt_service: 140,
        current_assets: 500,
        current_liabilities: 250,
        total_debt: 300,
        equity: 600,
        requested_amount: 500
      },
      {}
    ],
    [
      'creditworthiness',
      creditworthiness,
      {
        ebitda: 300,
        operating_cash_flow: 280,
        annual_debt_service: 140,
        current_assets: 500,
        current_liabilities: 250,
        total_debt: 300,
        equity: 600,
        requested_amount: 500,
        revenue: 1000,
        net_income: 150
      },
      {}
    ],
    [
      'feasibility',
      feasibilityAnalysis,
      {
        initial_investment: 1000,
        cash_flows: [300, 350, 400, 450],
        discount_rate: 0.10
      },
      {}
    ],
    [
      'valuation',
      valuationAnalysis,
      {
        free_cash_flows: [100, 110, 120, 130, 140],
        discount_rate: 0.12,
        terminal_growth_rate: 0.03,
        net_debt: 200
      },
      {}
    ],
    [
      'risk_analysis',
      riskAnalysis,
      {
        current_assets: 400,
        current_liabilities: 300,
        total_debt: 500,
        equity: 400,
        operating_cash_flow: 180,
        annual_debt_service: 160,
        customer_concentration_pct: 45,
        cash_buffer_months: 2
      },
      {}
    ],
    [
      'scenario_forecast',
      scenarioForecast,
      {
        revenue: 1000,
        costs: 700,
        growth_rate: 0.05,
        cost_growth_rate: 0.03,
        years: 3,
        initial_investment: 900,
        annual_net_cash_flow: 250,
        discount_rate: 0.10,
        simulation_config: { iterations: 200, seed: 42 }
      },
      {}
    ],
    [
      'credit_risk',
      creditRiskAnalysis,
      {
        pd_pct: 2,
        lgd_pct: 40,
        ead: 1000000,
        parameter_source: 'policy',
        as_of_date: '2026-10-26'
      },
      {}
    ],
    [
      'treasury_liquidity',
      treasuryLiquidityAnalysis,
      {
        accounts: [{ id: 'A1', bank: 'Bank A', balance: 1000 }],
        minimum_liquidity_buffer: 100
      },
      {}
    ],
    [
      'profitability_intelligence',
      profitabilityIntelligence,
      {
        units: [{
          id: 'P1',
          scope_type: 'product',
          revenue: 1000,
          variable_cost: 400,
          direct_fixed_cost: 100,
          allocated_cost: 120
        }]
      },
      {}
    ],
    [
      'unit_economics',
      unitEconomicsAnalysis,
      {
        acquisition_spend: 10000,
        new_customers: 100,
        active_customers: 500,
        revenue: 100000,
        gross_profit: 40000,
        ltv: 1500
      },
      {}
    ],
    [
      'management_reporting',
      managementReporting,
      {
        pack_type: 'cfo',
        period: '2026-10',
        actual: {
          revenue: 1200,
          operating_profit: 240
        },
        budget: {
          revenue: 1000,
          operating_profit: 260
        },
        prior: {
          revenue: 900,
          operating_profit: 200
        }
      },
      {}
    ],
    [
      'consolidation',
      consolidationAnalysis,
      {
        entities: [
          {
            id: 'PARENT',
            role: 'parent',
            balance_rows: [
              { account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 100, credit: 0 },
              { account_code: '3100', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 100 }
            ],
            period_rows: [
              { account_code: '4100', account_name: 'Revenue', account_type: 'revenue', debit: 0, credit: 100 },
              { account_code: '5100', account_name: 'Expense', account_type: 'expense', debit: 100, credit: 0 }
            ]
          },
          {
            id: 'SUB',
            role: 'subsidiary',
            ownership_pct: 100,
            balance_rows: [
              { account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 50, credit: 0 },
              { account_code: '3100', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 50 }
            ],
            period_rows: [
              { account_code: '4100', account_name: 'Revenue', account_type: 'revenue', debit: 0, credit: 50 },
              { account_code: '5100', account_name: 'Expense', account_type: 'expense', debit: 50, credit: 0 }
            ]
          }
        ]
      },
      {}
    ],
    [
      'fx_translation',
      fxTranslationAnalysis,
      {
        functional_currency: 'USD',
        presentation_currency: 'SAR',
        balance_rows: [
          { account_code: '1010', account_name: 'Cash', account_type: 'asset', debit: 100, credit: 0 },
          { account_code: '3100', account_name: 'Equity', account_type: 'equity', debit: 0, credit: 100 }
        ],
        period_rows: [],
        rates: {
          closing: { rate: 3.75 },
          historical: { '3100': { rate: 3.50 } }
        }
      },
      {}
    ],
    [
      'planning_budgeting',
      planningBudgetingAnalysis,
      {
        periods: [
          { period: 'P1', status: 'actual', actual: { revenue: 100 }, budget: { revenue: 90 } },
          { period: 'P2', status: 'forecast', budget: { revenue: 110 }, forecast: { revenue: 115 } }
        ]
      },
      {}
    ]
  ])('%s registry dispatch preserves direct-engine result', (code, direct, input, options) => {
    expect(stable(runFinancialEngine(code, input, options))).toEqual(
      stable(direct(input, options))
    );
  });

  test('preserves scoped financial-analysis behavior through modular boundary', () => {
    const input = {
      total_debt: 400,
      equity: 600,
      cost_of_equity_pct: 12,
      cost_of_debt_pct: 6,
      tax_rate_pct: 20
    };
    const options = { serviceCode: 'wacc_analysis' };

    expect(stable(runFinancialEngine('financial_analysis', input, options))).toEqual(
      stable(financialAnalysis(input, options))
    );
    expect(runFinancialEngine('financial_analysis', input, options).metrics.wacc_pct)
      .toBeCloseTo(9.12, 8);
  });

  test('preserves fail-closed behavior through modular boundary', () => {
    const result = runFinancialEngine(
      'financial_analysis',
      { revenue: 1000 },
      { serviceCode: 'gross_margin_analysis' }
    );

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.status).toBe('insufficient_inputs');
    expect(result.metrics.gross_margin_pct).toBeNull();
    expect(result.required_inputs).toContain('cogs');
  });
});
