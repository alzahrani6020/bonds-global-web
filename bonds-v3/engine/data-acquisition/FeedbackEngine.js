/**
 * FeedbackEngine — تحليل دقة التقديرات وتحسين النماذج.
 * يقارن القيم الفعلية بالقيم المُقدرة ويحسب عوامل التصحيح.
 */
class FeedbackEngine {
  constructor(supabaseConfig, options = {}) {
    this.supabase = null;
    if (supabaseConfig) {
      const { createClient } = require('@supabase/supabase-js');
      this.supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
    }
    this.options = {
      minFeedbackCount: options.minFeedbackCount || 3,
      maxCorrectionFactor: options.maxCorrectionFactor || 2.0,
      ...options
    };
  }

  /**
   * Submit feedback comparing estimated vs actual value.
   */
  async submitFeedback(record) {
    if (!this.supabase) throw new Error('Supabase config required');

    const { error } = await this.supabase.from('metric_feedback').insert({
      metric_code: record.metricCode,
      city_id: record.cityId,
      activity_id: record.activityId,
      year: record.year,
      estimated_value: record.estimatedValue,
      estimated_value_text: record.estimatedValueText,
      actual_value: record.actualValue,
      actual_value_text: record.actualValueText,
      project_id: record.projectId,
      source: record.source || 'user',
      confidence: record.confidence || 80,
      notes: record.notes
    });

    if (error) throw error;
    return { success: true };
  }

  /**
   * Get correction factor for a specific metric based on feedback history.
   * Returns { factor, feedbackCount, meanError, confidence }
   */
  async getCorrectionFactor(metricCode, context = {}) {
    if (!this.supabase) return { factor: 1, feedbackCount: 0, meanError: 0, confidence: 0 };

    let query = this.supabase
      .from('metric_feedback')
      .select('estimated_value, actual_value, confidence')
      .eq('metric_code', metricCode);

    if (context.cityId) query = query.eq('city_id', context.cityId);
    if (context.activityId) query = query.eq('activity_id', context.activityId);
    if (context.year) query = query.eq('year', context.year);

    const { data, error } = await query;
    if (error) throw error;

    const validItems = (data || []).filter(
      d => d.estimated_value !== null && d.actual_value !== null && d.estimated_value !== 0
    );

    if (validItems.length < this.options.minFeedbackCount) {
      return { factor: 1, feedbackCount: validItems.length, meanError: 0, confidence: 0 };
    }

    // Weighted average correction factor based on confidence
    let weightedFactorSum = 0;
    let totalWeight = 0;
    let meanErrorSum = 0;

    for (const item of validItems) {
      const weight = item.confidence || 50;
      const factor = item.actual_value / item.estimated_value;
      weightedFactorSum += factor * weight;
      meanErrorSum += (item.actual_value - item.estimated_value);
      totalWeight += weight;
    }

    const rawFactor = weightedFactorSum / totalWeight;
    // Limit correction factor to avoid extreme values
    const factor = Math.max(1 / this.options.maxCorrectionFactor, Math.min(this.options.maxCorrectionFactor, rawFactor));
    const meanError = meanErrorSum / validItems.length;
    const avgConfidence = Math.round(totalWeight / validItems.length);

    return {
      factor,
      feedbackCount: validItems.length,
      meanError,
      confidence: avgConfidence
    };
  }

  /**
   * Get accuracy summary for all metrics or a specific city/activity.
   */
  async getAccuracySummary(context = {}) {
    if (!this.supabase) return [];

    let query = this.supabase.from('metric_feedback_accuracy').select('*');
    if (context.cityId) query = query.eq('city_id', context.cityId);
    if (context.activityId) query = query.eq('activity_id', context.activityId);
    if (context.year) query = query.eq('year', context.year);
    if (context.metricCode) query = query.eq('metric_code', context.metricCode);

    const { data, error } = await query.order('feedback_count', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Apply correction factor to an estimated value.
   */
  static applyCorrection(estimatedValue, correction) {
    if (!estimatedValue || !correction || correction.factor === 1) return estimatedValue;
    return estimatedValue * correction.factor;
  }
}

module.exports = FeedbackEngine;
