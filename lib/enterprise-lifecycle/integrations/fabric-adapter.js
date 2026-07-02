/**
 * Trusted Data Fabric Integration Adapter
 *
 * Enriches context with data completeness/freshness for gate checks.
 */

let TrustedDataFabric;
try {
  ({ TrustedDataFabric } = require('../../fabric'));
} catch (err) {
  // optional dependency
}

class FabricAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ context }) {
    if (!TrustedDataFabric || !this.supabase) return context;
    try {
      const fabric = new TrustedDataFabric({ supabase: this.supabase });
      const fields = context.fabricFields || [];
      const resolved = await fabric.resolveValues({
        fields,
        context: {
          country: context.project && context.project.country_code,
          cityId: context.project && context.project.city_id
        }
      });
      return {
        ...context,
        fabric: {
          values: resolved,
          completeness: fields.length ? Object.keys(resolved).length / fields.length : 1
        }
      };
    } catch (err) {
      console.warn('[FabricAdapter] enrich failed:', err.message);
      return context;
    }
  }
}

module.exports = { FabricAdapter };
