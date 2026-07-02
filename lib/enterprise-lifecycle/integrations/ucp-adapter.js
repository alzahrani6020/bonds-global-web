/**
 * UCP Integration Adapter
 *
 * Runs Universal Calculation Platform when financial thresholds are needed.
 */

let UniversalCalculationPlatform;
try {
  ({ UniversalCalculationPlatform } = require('../../ucp'));
} catch (err) {
  // optional dependency
}

class UcpAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!UniversalCalculationPlatform || !this.supabase) return context;
    try {
      const ucp = await UniversalCalculationPlatform.create({ supabase: this.supabase, preferStatic: true });
      const sector = context.project && context.project.sector;
      const country = context.project && context.project.country_code;
      if (!sector || !country) return context;
      const result = await ucp.calculate({
        sector,
        country,
        inputs: context.inputs || {},
        requestId: context.requestId,
        userId: context.userId,
        projectId: (context.project && context.project.id) || (instance && instance.entity_id)
      });
      return {
        ...context,
        ucp: {
          confidence: result.confidence,
          outputs: result.outputs,
          scenarios: result.scenarios
        }
      };
    } catch (err) {
      console.warn('[UcpAdapter] enrich failed:', err.message);
      return context;
    }
  }
}

module.exports = { UcpAdapter };
