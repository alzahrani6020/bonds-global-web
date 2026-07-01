const { adaptToUcp, adaptFromUcp, breakEvenToUcp, loanToUcp, cashFlowToUcp } = require('../../lib/ucp/adapters');

describe('UCP Backward-Compatibility Adapters', () => {
  test('adapts break-even inputs', () => {
    const { sector, inputs } = adaptToUcp('break-even', { fixedCosts: 10000, variableCostPerUnit: 20, unitPrice: 60 });
    expect(sector).toBe('company');
    expect(inputs.fixed_costs).toBe(10000);
  });

  test('adapts loan inputs', () => {
    const { inputs } = adaptToUcp('loan', { amount: 100000, rate: 5, termMonths: 60 });
    expect(inputs.loan_amount).toBe(100000);
    expect(inputs.interest_rate).toBe(0.05);
  });

  test('adapts cash-flow inputs', () => {
    const { inputs } = adaptToUcp('cash-flow', { revenue: 100000, operatingExpenses: 30000 });
    expect(inputs.revenue).toBe(100000);
    expect(inputs.operating_expenses).toBe(30000);
  });

  test('maps UCP outputs back to legacy shape', () => {
    const legacy = adaptFromUcp('loan', {
      monthly_payment: { value: 1887.12 },
      total_interest: { value: 13227 },
      total_payment: { value: 113227 }
    });
    expect(legacy.monthlyPayment).toBe(1887.12);
  });
});
