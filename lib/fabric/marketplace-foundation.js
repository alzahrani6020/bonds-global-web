/**
 * BONDS Platform Marketplace Foundation
 *
 * Architecture-only registry for templates, connectors, reports, certificates,
 * policies, rules, formulas, validation packs, scenario packs, and plugins.
 */

class MarketplaceFoundation {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async list({ itemType, status = 'active' } = {}) {
    if (!this.supabase) return [];
    let query = this.supabase.from('fabric_marketplace_items').select('*');
    if (itemType) query = query.eq('item_type', itemType);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
  }

  async get(itemCode) {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('fabric_marketplace_items')
      .select('*')
      .eq('item_code', itemCode)
      .single();
    if (error) throw error;
    return data;
  }

  async register(item) {
    if (!this.supabase) throw new Error('Marketplace requires Supabase');
    const { data, error } = await this.supabase
      .from('fabric_marketplace_items')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async validateManifest(manifest) {
    const required = ['itemCode', 'itemType', 'name', 'version'];
    const errors = [];
    for (const key of required) {
      if (!manifest[key]) errors.push(`missing ${key}`);
    }
    const validTypes = ['template', 'connector', 'report', 'certificate', 'policy', 'rule', 'formula', 'validation_pack', 'scenario_pack', 'plugin'];
    if (manifest.itemType && !validTypes.includes(manifest.itemType)) {
      errors.push(`invalid itemType ${manifest.itemType}`);
    }
    return { valid: errors.length === 0, errors };
  }
}

module.exports = { MarketplaceFoundation };
