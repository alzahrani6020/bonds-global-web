/**
 * BONDS Decision Timeline
 *
 * Records chronological events for each project with full auditability.
 */

class DecisionTimeline {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async record(projectId, eventType, payload = {}, options = {}) {
    if (!this.supabase) {
      // In-memory fallback for tests and local usage.
      return { id: 'local-' + Date.now(), project_id: projectId, event_type: eventType, payload };
    }
    const { data, error } = await this.supabase
      .from('bonds_project_timeline_events')
      .insert({
        project_id: projectId,
        event_type: eventType,
        actor: options.actor || null,
        reference_table: options.referenceTable || null,
        reference_id: options.referenceId || null,
        payload
      })
      .select('*')
      .single();
    if (error) throw new Error(`Timeline record failed: ${error.message}`);
    return data;
  }

  async getTimeline(projectId, { limit = 100, eventType } = {}) {
    if (!this.supabase) return [];
    let query = this.supabase
      .from('bonds_project_timeline_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (eventType) query = query.eq('event_type', eventType);
    const { data, error } = await query;
    if (error) throw new Error(`Timeline fetch failed: ${error.message}`);
    return data || [];
  }

  async getMilestones(projectId) {
    const events = await this.getTimeline(projectId, { limit: 1000 });
    const milestoneTypes = ['project_created', 'valuation', 'financing', 'report_generated', 'certificate_issued', 'scenario_created'];
    return events.filter(e => milestoneTypes.includes(e.event_type));
  }
}

module.exports = { DecisionTimeline };
