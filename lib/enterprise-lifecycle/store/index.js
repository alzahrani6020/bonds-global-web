/**
 * Enterprise Lifecycle Store — Supabase implementation
 *
 * Persists instances, transitions, gate evaluations, approvals, tasks, events, and timeline.
 */

class SupabaseLifecycleStore {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createInstance(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_instances')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getInstance(id) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_instances')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async updateInstance(id, updates) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_instances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async createTransition(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_transitions')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listTransitions(instanceId) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_transitions')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async updateTransition(id, updates) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_transitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async createGateEvaluation(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_gate_evaluations')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async createApproval(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_approvals')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getApproval(id) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_approvals')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async updateApproval(id, updates) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_approvals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listApprovals(instanceId) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_approvals')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createTask(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_tasks')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTask(id) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  async updateTask(id, updates) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listTasks(instanceId, filters = {}) {
    let query = this.supabase
      .from('enterprise_lifecycle_tasks')
      .select('*')
      .eq('instance_id', instanceId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.stage_id) query = query.eq('stage_id', filters.stage_id);
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createEvent(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_events')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listEvents(instanceId) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_events')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createTimelineEntry(record) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_timeline')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listTimeline(instanceId) {
    const { data, error } = await this.supabase
      .from('enterprise_lifecycle_timeline')
      .select('*')
      .eq('instance_id', instanceId)
      .order('occurred_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
}

module.exports = { SupabaseLifecycleStore };
