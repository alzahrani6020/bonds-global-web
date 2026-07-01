/**
 * BONDS UCP Template Engine
 *
 * Resolves calculation templates for sector/country and manages field schemas.
 */

const DEFAULT_TEMPLATES = [
  {
    code: 'tmp_restaurant_default',
    name: 'Restaurant Default',
    sector: 'restaurant',
    version: 1,
    schema: {
      inputs: ['revenue', 'cogs', 'operating_expenses', 'fixed_costs', 'variable_cost_per_unit', 'unit_price', 'transaction_count', 'loan_amount', 'asset_value'],
      outputs: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'break_even_units', 'food_cost_percentage', 'labor_cost_percentage', 'dscr', 'ltv']
    },
    formula_codes: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'break_even_units', 'contribution_margin', 'contribution_margin_ratio', 'food_cost_percentage', 'dscr', 'ltv'],
    validation_codes: ['val_revenue_positive', 'val_cogs_non_negative'],
    scenario_codes: ['scn_pessimistic', 'scn_expected', 'scn_optimistic'],
    rule_codes: ['rule_sector_visible', 'rule_dscr_minimum'],
    weight_codes: ['wgt_investment'],
    policy_codes: []
  },
  {
    code: 'tmp_factory_default',
    name: 'Factory Default',
    sector: 'factory',
    version: 1,
    schema: {
      inputs: ['revenue', 'cogs', 'operating_expenses', 'fixed_costs', 'variable_cost_per_unit', 'unit_price', 'initial_investment', 'annual_net_cash_flow', 'loan_amount', 'asset_value'],
      outputs: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'break_even_units', 'roi', 'payback_period', 'dscr', 'ltv']
    },
    formula_codes: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'break_even_units', 'roi', 'payback_period', 'dscr', 'ltv'],
    validation_codes: ['val_revenue_positive', 'val_cogs_non_negative'],
    scenario_codes: ['scn_pessimistic', 'scn_expected', 'scn_optimistic'],
    rule_codes: ['rule_sector_visible'],
    weight_codes: ['wgt_investment'],
    policy_codes: []
  },
  {
    code: 'tmp_retail_default',
    name: 'Retail Default',
    sector: 'retail',
    version: 1,
    schema: {
      inputs: ['revenue', 'cogs', 'operating_expenses', 'transaction_count', 'loan_amount', 'asset_value'],
      outputs: ['gross_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'average_ticket', 'dscr', 'ltv']
    },
    formula_codes: ['gross_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'average_ticket', 'dscr', 'ltv'],
    validation_codes: ['val_revenue_positive', 'val_cogs_non_negative'],
    scenario_codes: ['scn_pessimistic', 'scn_expected', 'scn_optimistic'],
    rule_codes: ['rule_sector_visible'],
    weight_codes: ['wgt_investment'],
    policy_codes: ['pol_sa_retail_vat', 'pol_uae_retail_vat']
  },
  {
    code: 'tmp_company_default',
    name: 'Company Default',
    sector: 'company',
    version: 1,
    schema: {
      inputs: ['revenue', 'cogs', 'operating_expenses', 'initial_investment', 'annual_net_cash_flow', 'loan_amount', 'asset_value'],
      outputs: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'roi', 'payback_period', 'dscr', 'ltv']
    },
    formula_codes: ['gross_profit', 'operating_profit', 'net_profit', 'gross_margin', 'net_profit_margin', 'roi', 'payback_period', 'dscr', 'ltv'],
    validation_codes: ['val_revenue_positive', 'val_cogs_non_negative'],
    scenario_codes: ['scn_pessimistic', 'scn_expected', 'scn_optimistic'],
    rule_codes: ['rule_sector_visible', 'rule_dscr_minimum', 'rule_ltv_maximum'],
    weight_codes: ['wgt_investment', 'wgt_financing'],
    policy_codes: []
  }
];

class TemplateEngine {
  constructor({ templates = [], preferStatic = false } = {}) {
    this.templates = new Map();
    if (preferStatic || templates.length === 0) {
      for (const t of DEFAULT_TEMPLATES) this.register(t);
    }
    for (const t of templates) this.register(t);
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_templates').select('*');
    if (error) throw error;
    return new TemplateEngine({ templates: data || [] });
  }

  register(template) {
    if (!template || !template.code) throw new Error('Template must have code');
    this.templates.set(template.code, template);
  }

  get(code) { return this.templates.get(code); }
  list() { return Array.from(this.templates.values()); }

  /**
   * Resolve best matching template by sector and optionally country.
   */
  resolve(sector, country) {
    const candidates = this.list()
      .filter(t => t.status !== 'archived' && t.sector === sector)
      .sort((a, b) => {
        const aCountry = a.country === country ? 2 : a.country ? 0 : 1;
        const bCountry = b.country === country ? 2 : b.country ? 0 : 1;
        return bCountry - aCountry || b.version - a.version;
      });
    return candidates[0] || null;
  }

  /**
   * Expand template schema into full field definitions with defaults.
   */
  buildFields(template) {
    const schema = template.schema || {};
    const inputs = schema.inputs || [];
    const outputs = schema.outputs || [];
    return {
      inputs: inputs.map(name => ({ name, type: 'number', required: true })),
      outputs: outputs.map(name => ({ name, type: 'number', source: 'formula' }))
    };
  }
}

module.exports = { TemplateEngine, DEFAULT_TEMPLATES };
