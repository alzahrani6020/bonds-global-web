/**
 * Enterprise Global Search Client — Bonds Global
 * Unified search across clients, projects, assets, studies, reports.
 */
(function (root) {
  'use strict';

  async function search(query, options = {}) {
    const sb = root.BondsAuth && root.BondsAuth.getSupabase ? root.BondsAuth.getSupabase() : null;
    if (!sb) throw new Error('Supabase client not available');

    const limit = Math.min(options.limit || 20, 100);
    const { data, error } = await sb.rpc('global_search', {
      p_query: query,
      p_limit: limit,
      p_entity_types: options.entityTypes || null
    });
    if (error) throw error;
    return data || [];
  }

  async function searchByEntityType(query, entityType, limit = 20) {
    return search(query, { entityTypes: [entityType], limit });
  }

  root.BondsSearch = { search, searchByEntityType };
})(window);
