/**
 * Valuation Integration Adapter
 *
 * Enriches lifecycle context with the latest canonical valuation for a project
 * or asset so that valuation-confidence gates can evaluate correctly.
 */

class ValuationAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!this.supabase) return context;

    let valuation = null;

    if (instance.entity_type === 'project') {
      valuation = await this._fetchBondsValuation({ projectId: instance.entity_id });
    } else if (instance.entity_type === 'asset') {
      valuation = await this._fetchBondsValuation({ assetId: instance.entity_id });
      if (!valuation) {
        valuation = await this._fetchAssetValuation({ assetId: instance.entity_id });
      }
    }

    if (!valuation) return context;

    return {
      ...context,
      valuation: {
        id: valuation.id,
        value: valuation.value,
        confidence: valuation.confidence_score,
        dataQuality: valuation.data_quality_score,
        method: valuation.method,
        status: valuation.status,
        date: valuation.valuation_date || valuation.created_at
      }
    };
  }

  async _fetchBondsValuation({ projectId, assetId }) {
    try {
      let query = this.supabase
        .from('bonds_valuations')
        .select('id, value, confidence_score, data_quality_score, method, status, valuation_date, created_at');

      if (projectId) query = query.eq('project_id', projectId);
      else if (assetId) query = query.eq('asset_id', assetId);
      else return null;

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data && data[0] ? data[0] : null;
    } catch (err) {
      console.warn('[ValuationAdapter] bonds_valuations fetch failed:', err.message);
      return null;
    }
  }

  async _fetchAssetValuation({ assetId }) {
    try {
      const { data, error } = await this.supabase
        .from('asset_valuations')
        .select('id, results, confidence_score, data_quality_score, status, created_at')
        .eq('recovery_asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || !data[0]) return null;
      const row = data[0];
      return {
        id: row.id,
        value: row.results && row.results.fair_value,
        confidence_score: row.confidence_score,
        data_quality_score: row.data_quality_score,
        method: row.results && row.results.method,
        status: row.status,
        created_at: row.created_at
      };
    } catch (err) {
      console.warn('[ValuationAdapter] asset_valuations fetch failed:', err.message);
      return null;
    }
  }
}

module.exports = { ValuationAdapter };
