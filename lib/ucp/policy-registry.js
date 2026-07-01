/**
 * BONDS UCP Policy Registry
 *
 * Loads country/sector policies and evaluates them as rule sets.
 */

const DEFAULT_POLICIES = [
  { code: 'pol_sa_retail_vat', name: 'Saudi Retail VAT', category: 'tax', country: 'SA', sector: 'retail', rules: [{ field: 'vat_rate', op: 'eq', value: 15 }] },
  { code: 'pol_uae_retail_vat', name: 'UAE Retail VAT', category: 'tax', country: 'AE', sector: 'retail', rules: [{ field: 'vat_rate', op: 'eq', value: 5 }] },
  { code: 'pol_sa_financing_ltv', name: 'Saudi Financing LTV Limit', category: 'financing', country: 'SA', rules: [{ field: 'ltv', op: 'lte', value: 80 }] }
];

function evaluateCondition(condition, context) {
  const field = condition.field;
  const actual = context[field];
  const expected = condition.value;
  switch (condition.op) {
    case 'eq': return actual == expected;
    case 'neq': return actual != expected;
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'oneOf': return Array.isArray(expected) && expected.includes(actual);
    default: return false;
  }
}

class PolicyRegistry {
  constructor({ policies = [], preferStatic = false } = {}) {
    this.policies = new Map();
    if (preferStatic || policies.length === 0) {
      for (const p of DEFAULT_POLICIES) this.register(p);
    }
    for (const p of policies) this.register(p);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_policy_registry').select('*');
    if (error) throw error;
    return new PolicyRegistry({ policies: data || [] });
  }

  register(policy) {
    if (!policy || !policy.code) throw new Error('Policy must have code');
    this.policies.set(policy.code, policy);
  }

  get(code) { return this.policies.get(code); }
  list() { return Array.from(this.policies.values()); }

  findBySectorCountry(sector, country, category) {
    return this.list().filter(p => {
      if (category && p.category !== category) return false;
      if (p.sector && p.sector !== sector) return false;
      if (p.country && p.country !== country) return false;
      return true;
    });
  }

  /**
   * Evaluate policy codes against context. Returns pass/fail per policy.
   */
  evaluate(codes, context) {
    const results = [];
    for (const code of codes) {
      const policy = this.get(code);
      if (!policy) {
        results.push({ code, status: 'not_found' });
        continue;
      }
      const rules = policy.rules || [];
      const ruleResults = rules.map(r => ({ ...r, pass: evaluateCondition(r, context) }));
      const passed = ruleResults.length === 0 || ruleResults.every(r => r.pass);
      results.push({ code, status: passed ? 'pass' : 'fail', ruleResults, category: policy.category });
    }
    const allPassed = results.every(r => r.status !== 'fail');
    return { valid: allPassed, results };
  }
}

module.exports = { PolicyRegistry, DEFAULT_POLICIES, evaluateCondition };
