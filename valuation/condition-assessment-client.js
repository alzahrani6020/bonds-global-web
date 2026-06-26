/**
 * BONDS Condition Assessment Client
 *
 * Loads asset-class-specific condition standards from Supabase (if available)
 * and falls back to the embedded defaults. Keeps a short-lived client cache.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BondsConditionAssessmentClient = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const cache = new Map();

  function getSupabase() {
    if (typeof BondsAuth !== 'undefined' && BondsAuth.getSupabase) {
      return BondsAuth.getSupabase();
    }
    if (typeof getSupabaseGlobal === 'function') {
      return getSupabaseGlobal();
    }
    if (typeof supabase !== 'undefined' && supabase.createClient && window.__ENV) {
      return supabase.createClient(window.__ENV.SUPABASE_URL, window.__ENV.SUPABASE_ANON_KEY);
    }
    return null;
  }

  function getEmbedded(assetClass) {
    if (typeof BondsConditionStandards === 'undefined') return null;
    if (BondsConditionStandards.resolveStandards) {
      return BondsConditionStandards.resolveStandards(assetClass);
    }
    return BondsConditionStandards.ASSET_STANDARDS && BondsConditionStandards.ASSET_STANDARDS[assetClass] || null;
  }

  function isStale(entry) {
    return !entry || Date.now() - entry.ts > CACHE_TTL_MS;
  }

  async function loadStandards(assetClass, force) {
    const cacheKey = 'std:' + assetClass;
    const entry = cache.get(cacheKey);
    if (!force && entry && !isStale(entry)) {
      return { success: true, data: entry.data, source: 'cache' };
    }

    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('condition_assessment_standards')
          .select('*')
          .eq('asset_class', assetClass)
          .single();

        if (!error && data && Array.isArray(data.inspection_points) && data.inspection_points.length > 0) {
          const mapped = {
            assetClass: data.asset_class,
            nameAr: data.name_ar,
            nameEn: data.name_en,
            points: data.inspection_points,
            categories: data.categories,
            gradingScale: data.grading_scale,
            criticalRules: data.critical_rules,
            criticalCap: (data.critical_rules && data.critical_rules[0] && data.critical_rules[0].cap) || 60
          };
          cache.set(cacheKey, { ts: Date.now(), data: mapped });
          return { success: true, data: mapped, source: 'supabase' };
        }
      } catch (err) {
        console.warn('[ConditionAssessmentClient] Supabase load failed:', err);
      }
    }

    const embedded = getEmbedded(assetClass);
    if (embedded) {
      cache.set(cacheKey, { ts: Date.now(), data: embedded });
      return { success: true, data: embedded, source: 'embedded' };
    }

    return { success: false, error: 'No condition assessment standards found for ' + assetClass };
  }

  async function saveStandards(assetClass, standardsPayload) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase not initialized' };

    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, error: 'Not authenticated' };

    const row = {
      asset_class: assetClass,
      name_ar: standardsPayload.nameAr,
      name_en: standardsPayload.nameEn,
      inspection_points: standardsPayload.points,
      categories: standardsPayload.categories || BondsConditionStandards.CATEGORIES,
      grading_scale: standardsPayload.gradingScale || { A: 90, B: 80, C: 70, D: 60, E: 0 },
      critical_rules: standardsPayload.criticalRules || [{ cap: standardsPayload.criticalCap || 60, appliesTo: 'any_critical_failure' }],
      version: (standardsPayload.version || 0) + 1,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb
      .from('condition_assessment_standards')
      .upsert(row, { onConflict: 'asset_class' });

    if (error) return { success: false, error: error.message };

    cache.delete('std:' + assetClass);
    return { success: true };
  }

  function clearCache() {
    cache.clear();
  }

  async function getCurrentUserId() {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data?.user?.id || null;
    } catch (e) {
      return null;
    }
  }

  function prepareAssessmentRow(assessment) {
    return {
      asset_class: assessment.assetClass,
      asset_name: assessment.assetName || null,
      asset_identifier: assessment.assetIdentifier || null,
      recovery_asset_id: assessment.recoveryAssetId || null,
      client_id: assessment.clientId || null,
      assessment_date: assessment.assessmentDate || new Date().toISOString().split('T')[0],
      answers: assessment.answers || {},
      score: assessment.score ?? 0,
      grade: assessment.grade || null,
      confidence_score: assessment.confidenceScore ?? 0,
      category_scores: assessment.categoryScores || {},
      critical_failures: assessment.criticalFailures || [],
      valuation_inputs: assessment.valuationInputs || {},
      notes: assessment.notes || null,
      status: assessment.status || 'draft'
    };
  }

  async function saveAssessment(assessment) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase not initialized' };

    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'User not authenticated' };

    const row = prepareAssessmentRow(assessment);
    row.assessed_by = userId;

    if (assessment.id) {
      const { data, error } = await sb
        .from('asset_condition_assessments')
        .update(row)
        .eq('id', assessment.id)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    const { data, error } = await sb
      .from('asset_condition_assessments')
      .insert([row])
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async function loadAssessment(id) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase not initialized' };
    const { data, error } = await sb
      .from('asset_condition_assessments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  async function loadAssessments(filters) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase not initialized' };
    filters = filters || {};

    let query = sb
      .from('asset_condition_assessments')
      .select('*')
      .order('assessment_date', { ascending: false });

    if (filters.assetClass) query = query.eq('asset_class', filters.assetClass);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.recoveryAssetId) query = query.eq('recovery_asset_id', filters.recoveryAssetId);
    if (filters.limit) query = query.limit(Math.min(1000, Math.max(1, filters.limit)));

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  }

  async function deleteAssessment(id) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase not initialized' };
    const { error } = await sb.from('asset_condition_assessments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  return {
    loadStandards,
    saveStandards,
    clearCache,
    getEmbedded,
    getSupabase,
    saveAssessment,
    loadAssessment,
    loadAssessments,
    deleteAssessment
  };
}));
