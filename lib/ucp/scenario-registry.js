/**
 * BONDS UCP Scenario Registry
 *
 * Loads scenario definitions and applies them to base inputs.
 */

const DEFAULT_SCENARIOS = [
  { code: 'scn_pessimistic', name: 'Pessimistic', scenario_type: 'pessimistic', modifiers: { revenue: '*0.8', cogs: '*1.1' } },
  { code: 'scn_expected', name: 'Expected', scenario_type: 'expected', modifiers: {} },
  { code: 'scn_optimistic', name: 'Optimistic', scenario_type: 'optimistic', modifiers: { revenue: '*1.2', cogs: '*0.95' } }
];

function applyModifier(base, modifier) {
  if (modifier === undefined || modifier === null) return base;
  if (typeof modifier === 'number') return modifier;
  const str = String(modifier).trim();
  const op = str[0];
  const val = parseFloat(str.slice(1));
  if (Number.isNaN(val)) return base;
  const baseNum = Number(base);
  switch (op) {
    case '*': return baseNum * val;
    case '+': return baseNum + val;
    case '-': return baseNum - val;
    case '/': return val === 0 ? baseNum : baseNum / val;
    default: return parseFloat(str);
  }
}

class ScenarioRegistry {
  constructor({ scenarios = [], preferStatic = false } = {}) {
    this.scenarios = new Map();
    if (preferStatic || scenarios.length === 0) {
      for (const s of DEFAULT_SCENARIOS) this.register(s);
    }
    for (const s of scenarios) this.register(s);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_scenario_registry').select('*');
    if (error) throw error;
    return new ScenarioRegistry({ scenarios: data || [] });
  }

  register(scenario) {
    if (!scenario || !scenario.code) throw new Error('Scenario must have code');
    this.scenarios.set(scenario.code, scenario);
  }

  get(code) { return this.scenarios.get(code); }
  list() { return Array.from(this.scenarios.values()); }

  findBySectorCountry(sector, country) {
    return this.list().filter(s => {
      if (s.sector && s.sector !== sector) return false;
      if (s.country && s.country !== country) return false;
      return true;
    });
  }

  /**
   * Apply scenario modifiers to base inputs.
   * @returns {{scenario, inputs: Object}}
   */
  apply(code, baseInputs) {
    const scenario = this.get(code);
    if (!scenario) throw new Error(`Scenario not found: ${code}`);
    const modifiers = scenario.modifiers || {};
    const inputs = { ...baseInputs };
    for (const [key, modifier] of Object.entries(modifiers)) {
      inputs[key] = applyModifier(inputs[key], modifier);
    }
    return { scenario, inputs };
  }

  /**
   * Apply multiple scenarios and return an array.
   */
  applyAll(codes, baseInputs) {
    return codes.map(code => ({ code, ...this.apply(code, baseInputs) }));
  }
}

module.exports = { ScenarioRegistry, DEFAULT_SCENARIOS, applyModifier };
