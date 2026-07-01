/**
 * BONDS Investment Intelligence — Versioning Engine
 *
 * Creates, compares, and lists versions of an investment memorandum.
 */

function diffObjects(oldObj, newObj, path = '') {
  const changes = [];
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of keys) {
    const currentPath = path ? `${path}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    if (typeof oldVal === 'object' && typeof newVal === 'object' && !Array.isArray(oldVal)) {
      changes.push(...diffObjects(oldVal, newVal, currentPath));
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ path: currentPath, old: oldVal, new: newVal });
    }
  }
  return changes;
}

class VersioningEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createVersion(memorandumId, content, evidence, confidence, createdBy, changeSummary = '') {
    if (!this.supabase) throw new Error('Supabase client is required for versioning');

    const { data: latest, error: latestError } = await this.supabase
      .from('investment_memoranda_versions')
      .select('version_number')
      .eq('memorandum_id', memorandumId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    if (latestError && latestError.code !== 'PGRST116') throw latestError;

    const versionNumber = (latest?.version_number || 0) + 1;
    const { data, error } = await this.supabase
      .from('investment_memoranda_versions')
      .insert({
        memorandum_id: memorandumId,
        version_number: versionNumber,
        content,
        evidence_bundle: evidence,
        confidence_score: confidence,
        change_summary: changeSummary,
        created_by: createdBy
      })
      .select()
      .single();
    if (error) throw error;

    await this.supabase
      .from('investment_memoranda')
      .update({ version: versionNumber, content, evidence_bundle: evidence, confidence_score: confidence, updated_at: new Date().toISOString() })
      .eq('id', memorandumId);

    return { version: data, versionNumber };
  }

  async listVersions(memorandumId) {
    if (!this.supabase) throw new Error('Supabase client is required');
    const { data, error } = await this.supabase
      .from('investment_memoranda_versions')
      .select('*')
      .eq('memorandum_id', memorandumId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async compareVersions(memorandumId, fromVersion, toVersion) {
    if (!this.supabase) throw new Error('Supabase client is required');
    const { data: versions, error } = await this.supabase
      .from('investment_memoranda_versions')
      .select('*')
      .eq('memorandum_id', memorandumId)
      .in('version_number', [fromVersion, toVersion]);
    if (error) throw error;

    const fromContent = versions.find(v => v.version_number === fromVersion)?.content || {};
    const toContent = versions.find(v => v.version_number === toVersion)?.content || {};
    const changes = diffObjects(fromContent, toContent);
    return { fromVersion, toVersion, changes };
  }
}

module.exports = { VersioningEngine, diffObjects };
