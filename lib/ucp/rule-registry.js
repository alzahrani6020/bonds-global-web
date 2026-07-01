/**
 * BONDS UCP Rule Registry
 *
 * Thin wrapper around the canonical business rules engine and registry table.
 */

const { evaluateAll } = require('../rules/business-rules-engine');

class RuleRegistry {
  constructor({ rules = [], preferStatic = false } = {}) {
    this.rules = new Map();
    const defaults = [
      { code: 'rule_sector_visible', name: 'Sector Visible', type: 'sector_visibility', condition: { field: 'status', op: 'eq', value: 'active' } },
      { code: 'rule_valuation_method_allowed', name: 'Valuation Method Allowed', type: 'valuation_methodology', condition: { field: 'method', op: 'oneOf', values: ['income', 'market', 'cost'] } },
      { code: 'rule_dscr_minimum', name: 'DSCR Minimum', type: 'dscr_ltv', condition: { field: 'dscr', op: 'gte', value: 1.25 } },
      { code: 'rule_ltv_maximum', name: 'LTV Maximum', type: 'dscr_ltv', condition: { field: 'ltv', op: 'lte', value: 75 } }
    ];
    if (preferStatic || rules.length === 0) {
      for (const r of defaults) this.register(r);
    }
    for (const r of rules) this.register(r);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('business_rules_registry').select('*');
    if (error) throw error;
    return new RuleRegistry({ rules: data || [] });
  }

  register(rule) {
    if (!rule || !rule.code) throw new Error('Rule must have code');
    this.rules.set(rule.code, rule);
  }

  get(code) { return this.rules.get(code); }
  list() { return Array.from(this.rules.values()); }

  findBySectorCountry(sector, country) {
    return this.list().filter(r => {
      if (r.sector && r.sector !== sector) return false;
      if (r.country && r.country !== country) return false;
      return true;
    });
  }

  /**
   * Evaluate a list of business rule codes against a context.
   */
  evaluate(codes, context) {
    const selected = codes.map(c => this.get(c)).filter(Boolean);
    return evaluateAll(selected, context);
  }

  /**
   * Pass-through for raw rule evaluation.
   */
  evaluateRaw(rule, context) {
    const { evaluate } = require('../rules/business-rules-engine');
    return evaluate(rule, context);
  }
}

module.exports = { RuleRegistry };
