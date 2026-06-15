/**
 * DataQualityTracker — تتبع موثوقية مصادر البيانات الخارجية.
 * يسجل نجاح/فشل كل مصدر لكل مدينة/نشاط/مؤشر/سنة.
 */
class DataQualityTracker {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * تسجيل محاولة جلب بيانات.
   * @param {Object} params
   * @param {string} params.sourceId
   * @param {string} params.cityId
   * @param {string} params.activityId
   * @param {number} params.year
   * @param {string} params.metricCode
   * @param {boolean} params.success
   * @param {number} [params.count]
   * @param {number} [params.confidence]
   * @param {string} [params.sourceMethod]
   * @param {string} [params.failureReason]
   */
  async record(params) {
    if (!this.supabase) return;

    const {
      sourceId,
      cityId,
      activityId,
      year,
      metricCode,
      success,
      count,
      confidence,
      sourceMethod,
      failureReason
    } = params;

    try {
      // Get current row to increment counters
      const { data: existing } = await this.supabase
        .from('data_source_quality')
        .select('attempts, successes')
        .eq('source_id', sourceId)
        .eq('city_id', cityId)
        .eq('activity_id', activityId || '')
        .eq('year', year)
        .eq('metric_code', metricCode)
        .maybeSingle();

      const attempts = (existing?.attempts || 0) + 1;
      const successes = (existing?.successes || 0) + (success ? 1 : 0);

      const record = {
        source_id: sourceId,
        city_id: cityId,
        activity_id: activityId || null,
        year,
        metric_code: metricCode,
        success,
        count: count ?? null,
        confidence: confidence ?? null,
        source_method: sourceMethod || null,
        failure_reason: failureReason || null,
        attempts,
        successes,
        last_attempted_at: new Date().toISOString(),
        last_success_at: success ? new Date().toISOString() : undefined
      };

      const { error } = await this.supabase
        .from('data_source_quality')
        .upsert(record, {
          onConflict: 'source_id, city_id, activity_id, year, metric_code'
        });

      if (error) throw error;
    } catch (err) {
      console.warn('[DataQualityTracker] Failed to record quality:', err.message);
    }
  }

  /**
   * الحصول على مصادر ناجحة لمدينة/نشاط/سنة معينة.
   */
  async getSuccessfulSources(cityId, activityId, year, metricCode) {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('data_source_quality')
      .select('*')
      .eq('city_id', cityId)
      .eq('activity_id', activityId || '')
      .eq('year', year)
      .eq('metric_code', metricCode)
      .eq('success', true)
      .order('last_success_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

module.exports = DataQualityTracker;
