/**
 * BONDS UCP Input & Output Definition Registry
 *
 * Central metadata describing every calculation input and output.
 */

const DEFAULT_INPUTS = [
  { code: 'revenue', name: 'Revenue', data_type: 'number', unit_code: 'currency', required: true, validation_codes: ['val_positive'], source: 'user' },
  { code: 'cogs', name: 'Cost of Goods Sold', data_type: 'number', unit_code: 'currency', required: true, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'operating_expenses', name: 'Operating Expenses', data_type: 'number', unit_code: 'currency', required: true, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'fixed_costs', name: 'Fixed Costs', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'variable_cost_per_unit', name: 'Variable Cost per Unit', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'unit_price', name: 'Unit Price', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_positive'], source: 'user' },
  { code: 'loan_amount', name: 'Loan Amount', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'asset_value', name: 'Asset Value', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_positive'], source: 'user' },
  { code: 'interest_rate', name: 'Annual Interest Rate', data_type: 'number', unit_code: 'percent', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'loan_term_months', name: 'Loan Term (Months)', data_type: 'integer', unit_code: 'month', required: false, validation_codes: ['val_loan_term_months'], source: 'user' },
  { code: 'initial_investment', name: 'Initial Investment', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_positive'], source: 'user' },
  { code: 'annual_net_cash_flow', name: 'Annual Net Cash Flow', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'net_operating_income', name: 'Net Operating Income', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'total_debt_service', name: 'Total Debt Service', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'transaction_count', name: 'Transaction Count', data_type: 'integer', unit_code: 'transaction', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'labor_cost', name: 'Labor Cost', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' },
  { code: 'net_gain', name: 'Net Gain', data_type: 'number', unit_code: 'currency', required: false, validation_codes: ['val_non_negative'], source: 'user' }
];

const DEFAULT_OUTPUTS = [
  { code: 'net_profit', name: 'Net Profit', data_type: 'number', unit_code: 'currency', formula_codes: ['net_profit'] },
  { code: 'gross_profit', name: 'Gross Profit', data_type: 'number', unit_code: 'currency', formula_codes: ['gross_profit'] },
  { code: 'operating_profit', name: 'Operating Profit', data_type: 'number', unit_code: 'currency', formula_codes: ['operating_profit'] },
  { code: 'net_profit_margin', name: 'Net Profit Margin', data_type: 'number', unit_code: 'percent', formula_codes: ['net_profit_margin'] },
  { code: 'gross_margin', name: 'Gross Margin', data_type: 'number', unit_code: 'percent', formula_codes: ['gross_margin'] },
  { code: 'operating_margin', name: 'Operating Margin', data_type: 'number', unit_code: 'percent', formula_codes: ['operating_margin'] },
  { code: 'break_even_units', name: 'Break-Even Units', data_type: 'number', unit_code: 'unit', formula_codes: ['break_even_units'] },
  { code: 'contribution_margin', name: 'Contribution Margin', data_type: 'number', unit_code: 'currency', formula_codes: ['contribution_margin'] },
  { code: 'contribution_margin_ratio', name: 'Contribution Margin Ratio', data_type: 'number', unit_code: 'percent', formula_codes: ['contribution_margin_ratio'] },
  { code: 'break_even_revenue', name: 'Break-Even Revenue', data_type: 'number', unit_code: 'currency', formula_codes: ['break_even_revenue'] },
  { code: 'roi', name: 'Return on Investment', data_type: 'number', unit_code: 'percent', formula_codes: ['roi'] },
  { code: 'payback_period', name: 'Payback Period', data_type: 'number', unit_code: 'year', formula_codes: ['payback_period'] },
  { code: 'dscr', name: 'DSCR', data_type: 'number', unit_code: 'ratio', formula_codes: ['dscr'] },
  { code: 'ltv', name: 'Loan-to-Value', data_type: 'number', unit_code: 'percent', formula_codes: ['ltv'] },
  { code: 'monthly_payment', name: 'Monthly Payment', data_type: 'number', unit_code: 'currency', formula_codes: ['monthly_payment'] },
  { code: 'total_interest', name: 'Total Interest', data_type: 'number', unit_code: 'currency', formula_codes: ['total_interest'] },
  { code: 'total_payment', name: 'Total Payment', data_type: 'number', unit_code: 'currency', formula_codes: ['total_payment'] },
  { code: 'average_ticket', name: 'Average Ticket', data_type: 'number', unit_code: 'currency', formula_codes: ['average_ticket'] },
  { code: 'food_cost_percentage', name: 'Food Cost %', data_type: 'number', unit_code: 'percent', formula_codes: ['food_cost_percentage'] },
  { code: 'labor_cost_percentage', name: 'Labor Cost %', data_type: 'number', unit_code: 'percent', formula_codes: ['labor_cost_percentage'] }
];

class InputDefinitionRegistry {
  constructor({ inputs = [], preferStatic = false } = {}) {
    this.inputs = new Map();
    if (preferStatic || inputs.length === 0) {
      for (const i of DEFAULT_INPUTS) this.register(i);
    }
    for (const i of inputs) this.register(i);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_input_definitions').select('*');
    if (error) throw error;
    return new InputDefinitionRegistry({ inputs: data || [] });
  }

  register(input) {
    if (!input || !input.code) throw new Error('Input definition must have code');
    this.inputs.set(input.code, input);
  }

  get(code) { return this.inputs.get(code); }
  list() { return Array.from(this.inputs.values()); }

  findBySectorCountry(sector, country) {
    return this.list().filter(i => {
      if (i.sector && i.sector !== sector) return false;
      if (i.country && i.country !== country) return false;
      return true;
    });
  }
}

class OutputDefinitionRegistry {
  constructor({ outputs = [], preferStatic = false } = {}) {
    this.outputs = new Map();
    if (preferStatic || outputs.length === 0) {
      for (const o of DEFAULT_OUTPUTS) this.register(o);
    }
    for (const o of outputs) this.register(o);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_output_definitions').select('*');
    if (error) throw error;
    return new OutputDefinitionRegistry({ outputs: data || [] });
  }

  register(output) {
    if (!output || !output.code) throw new Error('Output definition must have code');
    this.outputs.set(output.code, output);
  }

  get(code) { return this.outputs.get(code); }
  list() { return Array.from(this.outputs.values()); }

  findBySectorCountry(sector, country) {
    return this.list().filter(o => {
      if (o.sector && o.sector !== sector) return false;
      if (o.country && o.country !== country) return false;
      return true;
    });
  }
}

module.exports = {
  InputDefinitionRegistry,
  OutputDefinitionRegistry,
  DEFAULT_INPUTS,
  DEFAULT_OUTPUTS
};
