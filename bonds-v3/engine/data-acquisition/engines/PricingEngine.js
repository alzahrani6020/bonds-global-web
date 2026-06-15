/**
 * PricingEngine — محرك الأسعار.
 * يقدر تكاليف البناء والمعدات والتشغيل حسب النشاط والحجم.
 */
const DataPipeline = require('../DataPipeline');
const { ManualAdapter, LLMEstimationAdapter } = require('../adapters');

class PricingEngine {
  constructor(supabaseConfig, options = {}) {
    this.pipeline = new DataPipeline(supabaseConfig, options.pipeline);
    this.adapters = {
      manual: new ManualAdapter(options.manual),
      llm: new LLMEstimationAdapter({
        inferenceEngine: this.pipeline.inferenceEngine,
        ...options.llm
      })
    };
  }

  async run(options = {}) {
    const { cityId, cityCode, activityId, activityCode, year = new Date().getFullYear() } = options;

    if (!cityId || !cityCode) {
      throw new Error('cityId and cityCode are required');
    }

    const metrics = await this.adapters.llm.fetch({
      cityCode,
      activityCode,
      year,
      metricCodes: [
        'construction_cost_per_sqm',
        'equipment_cost_min',
        'equipment_cost_avg',
        'equipment_cost_max'
      ]
    });

    for (const metric of metrics) {
      const transformed = await this.adapters.llm.transform(metric);
      for (const t of transformed) {
        await this.pipeline._upsertNormalizedMetric(t, {
          runId: null,
          cityId,
          activityId,
          year,
          sourceId: this.adapters.llm.config.sourceId,
          sourceName: this.adapters.llm.config.sourceName
        });
      }
    }

    const fused = await this.pipeline.fuseToGold({ cityId, cityCode, activityId, activityCode, year });

    return {
      engine: 'PricingEngine',
      cityId,
      cityCode,
      activityId,
      activityCode,
      year,
      fused
    };
  }
}

module.exports = PricingEngine;
