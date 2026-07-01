/**
 * BONDS UCP Business Formula Registry
 *
 * Business-level formulas distinct from mathematical formula_registry.
 * Can be evaluated as expressions or reference JavaScript functions by name.
 */

const { evaluateExpression, getVariables } = require('./expression-evaluator');

const DEFAULT_BUSINESS_FORMULAS = [
  { code: 'bf_recommendation', name: 'Financing Recommendation', expression: 'dscr >= 1.25 AND ltv <= 80', category: 'financing' },
  { code: 'bf_risk_flag', name: 'High Risk Flag', expression: 'dscr < 1.25 OR ltv > 80', category: 'risk' },
  { code: 'bf_break_even_status', name: 'Break-Even Status', expression: 'unit_price > variable_cost_per_unit', category: 'break_even' }
];

// Logical helpers for business expressions
function logicalAnd(...args) { return args.every(Boolean); }
function logicalOr(...args) { return args.some(Boolean); }

function evaluateBusinessExpression(expression, context) {
  // Replace AND/OR/NOT with operators parseable by expression evaluator
  const normalized = expression
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi, '||')
    .replace(/\bNOT\b/gi, '!');
  // Convert comparison context booleans to numbers for evaluator
  const numContext = {};
  for (const [k, v] of Object.entries(context)) {
    numContext[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  const result = evaluateExpression(normalized, numContext);
  return Boolean(result);
}

class BusinessFormulaRegistry {
  constructor({ formulas = [], preferStatic = false } = {}) {
    this.formulas = new Map();
    if (preferStatic || formulas.length === 0) {
      for (const f of DEFAULT_BUSINESS_FORMULAS) this.register(f);
    }
    for (const f of formulas) this.register(f);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_business_formula_registry').select('*');
    if (error) throw error;
    return new BusinessFormulaRegistry({ formulas: data || [] });
  }

  register(formula) {
    if (!formula || !formula.code) throw new Error('Business formula must have code');
    this.formulas.set(formula.code, formula);
  }

  get(code) { return this.formulas.get(code); }
  list() { return Array.from(this.formulas.values()); }

  evaluate(code, context) {
    const formula = this.get(code);
    if (!formula) throw new Error(`Business formula not found: ${code}`);
    if (formula.fn && typeof formula.fn === 'function') {
      return { code, value: formula.fn(context), expression: formula.expression || formula.fn.name };
    }
    const value = evaluateBusinessExpression(formula.expression, context);
    return { code, value, expression: formula.expression, variables: getVariables(formula.expression) };
  }

  evaluateAll(codes, context, options = {}) {
    const results = {};
    const trace = [];
    for (const code of codes) {
      try {
        const r = this.evaluate(code, context);
        results[code] = r;
        context[code] = r.value;
        trace.push({ code, status: 'ok', value: r.value });
      } catch (err) {
        if (options.throwOnError) throw err;
        trace.push({ code, status: 'error', message: err.message });
        results[code] = { code, value: null, error: err.message };
      }
    }
    return { results, context, trace };
  }
}

module.exports = {
  BusinessFormulaRegistry,
  DEFAULT_BUSINESS_FORMULAS,
  evaluateBusinessExpression
};
