/**
 * RealEstateEngine — محرك العقار.
 * يقدر الإيجارات والأسعار العقارية حسب المدينة والنشاط.
 */
const DataPipeline = require('../DataPipeline');
const { ManualAdapter, LLMEstimationAdapter } = require('../adapters');

class RealEstateEngine {
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

    // TODO: إضافة محول عقاري حقيقي عند توفر API/CSV
    // حالياً نستخدم Inference Engine لتقدير القيم
    const metrics = await this.adapters.llm.fetch({
      cityCode,
      activityCode,
      year,
      metricCodes: ['avg_rent_per_sqm', 'avg_land_price_per_sqm']
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
      engine: 'RealEstateEngine',
      cityId,
      cityCode,
      activityId,
      activityCode,
      year,
      fused
    };
  }
}

module.exports = RealEstateEngine;
