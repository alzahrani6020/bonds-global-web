/**
 * BONDS Enterprise Source Registry
 *
 * CRUD and discovery for trusted data sources.
 * Wraps the public.data_sources table extended in Wave 4.2.
 */

class SourceRegistry {
  constructor(supabase) {
    this.supabase = supabase;
  }

  _query() {
    if (!this.supabase) {
      throw new Error('SourceRegistry requires a Supabase client');
    }
    return this.supabase.from('data_sources');
  }

  async list(filters = {}) {
    let query = this._query().select('*');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.country) query = query.contains('supported_countries', [filters.country]);
    if (filters.connectorCode) query = query.eq('connector_code', filters.connectorCode);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
  }

  async get(id) {
    const { data, error } = await this._query().select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async getByCode(sourceCode) {
    const { data, error } = await this._query().select('*').eq('source_code', sourceCode).single();
    if (error) throw error;
    return data;
  }

  async create(record) {
    const { data, error } = await this._query().insert(record).select().single();
    if (error) throw error;
    return data;
  }

  async update(id, record) {
    const { data, error } = await this._query().update(record).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async setStatus(id, status) {
    return this.update(id, { status });
  }

  async delete(id) {
    const { error } = await this._query().delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async findForContext({ country, industry, operation, metricCode }) {
    let query = this._query().select('*').eq('status', 'active');
    if (country) query = query.contains('supported_countries', [country]);
    if (industry) query = query.contains('supported_industries', [industry]);
    if (operation) query = query.contains('supported_operations', [operation]);
    const { data, error } = await query.order('name');
    if (error) throw error;
    let sources = data || [];
    if (metricCode) {
      sources = sources.filter(s =>
        !s.metadata?.supportedMetrics || s.metadata.supportedMetrics.includes(metricCode)
      );
    }
    return sources;
  }
}

module.exports = { SourceRegistry };
