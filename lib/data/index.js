/**
 * BONDS Unified Data Layer (UDL)
 *
 * Centralized, canonical data access for BONDS entities.
 * All new engines, APIs and reports should consume data through this layer.
 */

const getSupabase = require('../api/supabase');
const objectRegistry = require('./object-registry');

const DEFAULT_USER_COLUMNS = [
  'id', 'project_number', 'user_id', 'name', 'sector', 'sub_sector', 'activity',
  'city_id', 'capital', 'revenue', 'annual_profit', 'roi_months', 'status',
  'language', 'currency', 'metadata', 'created_at', 'updated_at'
];

function getSupabaseClient() {
  return getSupabase();
}

async function writeAuditLog(supabase, {
  tableName,
  recordId,
  action,
  oldData = null,
  newData = null,
  performedBy = null
}) {
  try {
    await supabase.from('bonds_audit_logs').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      old_data: oldData,
      new_data: newData,
      performed_by: performedBy
    });
  } catch (err) {
    // Audit logging must never break the main transaction.
    // In production this should also go to a fallback logger (Sentry, system_logs, etc.)
    console.error('[UDL] Audit log failed:', err.message);
  }
}

class ProjectRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async create({ userId, name, sector, subSector, activity, cityId, capital = 0, revenue = 0, annualProfit = 0, currency = 'SAR', language = 'ar', status = 'draft', metadata = {} }) {
    const { humanId } = await objectRegistry.allocate(this.supabase, {
      prefix: 'PRJ',
      entityType: 'Project',
      userId
    });

    const insert = {
      project_number: humanId,
      user_id: userId,
      name,
      sector,
      sub_sector: subSector || null,
      activity: activity || null,
      city_id: cityId || null,
      capital,
      revenue,
      annual_profit: annualProfit,
      currency,
      language,
      status,
      metadata
    };

    const { data, error } = await this.supabase
      .from('bonds_projects')
      .insert(insert)
      .select(DEFAULT_USER_COLUMNS.join(','))
      .single();

    if (error) throw new Error(`Project create failed: ${error.message}`);
    await writeAuditLog(this.supabase, {
      tableName: 'bonds_projects',
      recordId: data.id,
      action: 'INSERT',
      newData: insert,
      performedBy: userId
    });
    return data;
  }

  async getById(id, userId) {
    const { data, error } = await this.supabase
      .from('bonds_projects')
      .select(DEFAULT_USER_COLUMNS.join(','))
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(`Project fetch failed: ${error.message}`);
    return data;
  }

  async getByNumber(projectNumber, userId) {
    const { data, error } = await this.supabase
      .from('bonds_projects')
      .select(DEFAULT_USER_COLUMNS.join(','))
      .eq('project_number', projectNumber)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(`Project fetch failed: ${error.message}`);
    return data;
  }

  async list(userId, { limit = 100, offset = 0 } = {}) {
    const { data, error } = await this.supabase
      .from('bonds_projects')
      .select(DEFAULT_USER_COLUMNS.join(','))
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Project list failed: ${error.message}`);
    return data || [];
  }

  async update(id, userId, updates) {
    const allowed = ['name', 'sector', 'sub_sector', 'activity', 'city_id', 'capital', 'revenue', 'annual_profit', 'roi_months', 'status', 'language', 'currency', 'metadata'];
    const payload = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) payload[key] = updates[key];
    }

    const { data: existing } = await this.supabase
      .from('bonds_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (!existing) throw new Error('Project not found');

    const { data, error } = await this.supabase
      .from('bonds_projects')
      .update(payload)
      .eq('id', id)
      .select(DEFAULT_USER_COLUMNS.join(','))
      .single();
    if (error) throw new Error(`Project update failed: ${error.message}`);

    await writeAuditLog(this.supabase, {
      tableName: 'bonds_projects',
      recordId: id,
      action: 'UPDATE',
      oldData: existing,
      newData: data,
      performedBy: userId
    });
    return data;
  }

  async softDelete(id, userId) {
    const { data, error } = await this.supabase
      .from('bonds_projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();
    if (error) throw new Error(`Project delete failed: ${error.message}`);
    await writeAuditLog(this.supabase, {
      tableName: 'bonds_projects',
      recordId: id,
      action: 'DELETE',
      performedBy: userId
    });
    return data;
  }
}

class UnifiedDataLayer {
  constructor(supabase) {
    this.supabase = supabase || getSupabaseClient();
    this.projects = new ProjectRepository(this.supabase);
  }

  static create() {
    return new UnifiedDataLayer(getSupabaseClient());
  }

  get registry() {
    return objectRegistry;
  }

  async healthCheck() {
    const { error } = await this.supabase.from('bonds_projects').select('id', { count: 'exact', head: true });
    return { ok: !error, error: error ? error.message : null };
  }
}

module.exports = {
  UnifiedDataLayer,
  ProjectRepository,
  getSupabaseClient,
  objectRegistry,
  writeAuditLog
};
