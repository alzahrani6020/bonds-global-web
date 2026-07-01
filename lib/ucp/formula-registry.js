/**
 * BONDS UCP Formula Registry
 *
 * Loads formulas from the canonical formula_registry table and evaluates
 * them with dependency ordering and safe expression evaluation.
 */

const { evaluateExpression, getVariables } = require('./expression-evaluator');

const STATIC_FORMULAS = [
  // Profitability
  { code: 'total_costs', expression: 'cogs + operating_expenses', category: 'profitability', sector: null, country: null },
  { code: 'net_profit', expression: 'revenue - total_costs', category: 'profitability', sector: null, country: null },
  { code: 'gross_profit', expression: 'revenue - cogs', category: 'profitability', sector: null, country: null },
  { code: 'operating_profit', expression: 'gross_profit - operating_expenses', category: 'profitability', sector: null, country: null },
  { code: 'net_profit_margin', expression: '(net_profit / revenue) * 100', category: 'profitability', sector: null, country: null },
  { code: 'gross_margin', expression: '(gross_profit / revenue) * 100', category: 'profitability', sector: null, country: null },
  { code: 'operating_margin', expression: '(operating_profit / revenue) * 100', category: 'profitability', sector: null, country: null },
  // Break-even
  { code: 'break_even_units', expression: 'fixed_costs / (unit_price - variable_cost_per_unit)', category: 'break_even', sector: null, country: null },
  { code: 'contribution_margin', expression: 'unit_price - variable_cost_per_unit', category: 'break_even', sector: null, country: null },
  { code: 'contribution_margin_ratio', expression: '(contribution_margin / unit_price) * 100', category: 'break_even', sector: null, country: null },
  { code: 'break_even_revenue', expression: 'break_even_units * unit_price', category: 'break_even', sector: null, country: null },
  // Investment / Feasibility
  { code: 'roi', expression: '((net_gain - initial_investment) / initial_investment) * 100', category: 'investment', sector: null, country: null },
  { code: 'payback_period', expression: 'initial_investment / annual_net_cash_flow', category: 'investment', sector: null, country: null },
  // Financing
  { code: 'dscr', expression: 'net_operating_income / total_debt_service', category: 'financing', sector: null, country: null },
  { code: 'ltv', expression: '(loan_amount / asset_value) * 100', category: 'financing', sector: null, country: null },
  // Retail / Restaurant
  { code: 'average_ticket', expression: 'revenue / transaction_count', category: 'retail', sector: null, country: null },
  { code: 'food_cost_percentage', expression: '(cogs / revenue) * 100', category: 'restaurant', sector: null, country: null },
  { code: 'labor_cost_percentage', expression: '(labor_cost / revenue) * 100', category: 'restaurant', sector: null, country: null },
  // Loan
  { code: 'monthly_payment', expression: 'loan_amount * ((interest_rate / 12) * pow(1 + (interest_rate / 12), loan_term_months)) / (pow(1 + (interest_rate / 12), loan_term_months) - 1)', category: 'loan', sector: null, country: null },
  { code: 'total_interest', expression: '(monthly_payment * loan_term_months) - loan_amount', category: 'loan', sector: null, country: null },
  { code: 'total_payment', expression: 'monthly_payment * loan_term_months', category: 'loan', sector: null, country: null }
];

class FormulaRegistry {
  constructor({ formulas = [], preferStatic = false } = {}) {
    this.formulas = new Map();
    if (preferStatic || formulas.length === 0) {
      for (const f of STATIC_FORMULAS) this.register(f);
    }
    for (const f of formulas) this.register(f);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('formula_registry').select('*');
    if (error) throw error;
    return new FormulaRegistry({ formulas: data || [], preferStatic: false });
  }

  register(formula) {
    if (!formula || !formula.code) throw new Error('Formula must have code');
    this.formulas.set(formula.code, formula);
  }

  get(code) { return this.formulas.get(code); }

  findBySectorCountry(sector, country) {
    const list = [];
    for (const f of this.formulas.values()) {
      if (f.sector && f.sector !== sector) continue;
      if (f.country && f.country !== country) continue;
      list.push(f);
    }
    return list;
  }

  /**
   * Evaluate a single formula given a context of inputs and already-computed values.
   */
  evaluate(code, context) {
    const formula = this.get(code);
    if (!formula) throw new Error(`Formula not found: ${code}`);
    const value = evaluateExpression(formula.expression, context);
    return { code, value, expression: formula.expression, category: formula.category };
  }

  /**
   * Evaluate a list of formulas in dependency order. Missing inputs are kept as variable names.
   */
  evaluateAll(codes, inputs = {}, options = {}) {
    const context = { ...inputs };
    const results = {};
    const trace = [];
    const order = this.resolveOrder(codes);
    for (const code of order) {
      try {
        const result = this.evaluate(code, context);
        context[code] = result.value;
        results[code] = result;
        trace.push({ code, status: 'ok', value: result.value });
      } catch (err) {
        if (options.throwOnError) throw err;
        trace.push({ code, status: 'error', message: err.message });
        results[code] = { code, value: null, error: err.message };
      }
    }
    return { results, context, trace, order };
  }

  /**
   * Topological sort of formula dependencies.
   */
  resolveOrder(codes) {
    const visited = new Set();
    const temp = new Set();
    const order = [];

    const visit = (code) => {
      if (temp.has(code)) throw new Error(`Circular dependency detected: ${code}`);
      if (visited.has(code)) return;
      const formula = this.get(code);
      if (!formula) return;
      temp.add(code);
      const deps = getVariables(formula.expression);
      for (const dep of deps) {
        if (this.formulas.has(dep)) visit(dep);
      }
      temp.delete(code);
      visited.add(code);
      order.push(code);
    };

    for (const code of codes) visit(code);
    return order;
  }

  list() {
    return Array.from(this.formulas.values());
  }
}

module.exports = { FormulaRegistry, STATIC_FORMULAS };
