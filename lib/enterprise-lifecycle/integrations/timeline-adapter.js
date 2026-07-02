/**
 * Timeline Integration Adapter
 *
 * Mirrors lifecycle events to the existing BONDS Decision Timeline.
 */

let DecisionTimeline;
try {
  ({ DecisionTimeline } = require('../../timeline/decision-timeline'));
} catch (err) {
  // optional dependency
}

class TimelineAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async emit({ instance, eventType, payload }) {
    if (!DecisionTimeline || !this.supabase) return null;
    try {
      const timeline = new DecisionTimeline(this.supabase);
      return await timeline.record(instance.entity_id, eventType, payload, {
        referenceTable: 'enterprise_lifecycle_instances',
        referenceId: instance.id
      });
    } catch (err) {
      console.warn('[TimelineAdapter] emit failed:', err.message);
      return null;
    }
  }
}

module.exports = { TimelineAdapter };
