/**
 * Digital Twin Integration Adapter
 *
 * Snapshots entity state before/after major lifecycle transitions.
 */

let DigitalTwin;
try {
  ({ DigitalTwin } = require('../../digital-twin/digital-twin'));
} catch (err) {
  // optional dependency
}

class DigitalTwinAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async snapshot({ instance, label }) {
    if (!DigitalTwin || !this.supabase || instance.entity_type !== 'project') return null;
    try {
      const twin = new DigitalTwin(this.supabase);
      const { snapshot, checksum } = await twin.build(instance.entity_id);
      const saved = await twin.save(instance.entity_id, {
        ...snapshot,
        lifecycle_label: label,
        lifecycle_stage: instance.current_stage,
        checksum
      });
      return saved;
    } catch (err) {
      console.warn('[DigitalTwinAdapter] snapshot failed:', err.message);
      return null;
    }
  }
}

module.exports = { DigitalTwinAdapter };
