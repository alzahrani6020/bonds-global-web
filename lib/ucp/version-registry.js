/**
 * BONDS UCP Version Registry
 *
 * Tracks versions, effective dates and approval status for all registry items.
 */

function isActive(item, asOf = new Date()) {
  const date = asOf instanceof Date ? asOf : new Date(asOf);
  if (item.status && item.status !== 'active' && item.status !== 'approved') return false;
  if (item.approval_status && item.approval_status !== 'approved') return false;
  if (item.effective_from && new Date(item.effective_from) > date) return false;
  if (item.effective_to && new Date(item.effective_to) < date) return false;
  return true;
}

class VersionRegistry {
  constructor({ versions = [] } = {}) {
    this.versions = versions;
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_versions').select('*');
    if (error) throw error;
    return new VersionRegistry({ versions: data || [] });
  }

  find(entityType, entityCode, asOf = new Date()) {
    const candidates = this.versions.filter(v =>
      v.entity_type === entityType &&
      v.entity_code === entityCode &&
      isActive(v, asOf)
    );
    return candidates.sort((a, b) => b.version - a.version)[0] || null;
  }

  latest(entityType, entityCode) {
    const candidates = this.versions.filter(v => v.entity_type === entityType && v.entity_code === entityCode);
    return candidates.sort((a, b) => b.version - a.version)[0] || null;
  }
}

module.exports = { VersionRegistry, isActive };
