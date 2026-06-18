/**
 * LaborEngine — محرك العمالة.
 * يقدر توفر العمالة والرواتب حسب المدينة والنشاط.
 */
const DataPipeline = require('../DataPipeline');
const { ManualAdapter, LLMEstimationAdapter, BenchmarkAdapter } = require('../adapters');

class LaborEngine {
  constructor(supabaseConfig, options = {}) {
    this.pipeline = new DataPipeline(supabaseConfig, options.pipeline);
    this.adapters = {
      manual: new ManualAdapter(options.manual),
      benchmark: new BenchmarkAdapter(options.benchmark),
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

    const city = await this._getCity(cityId);
    const population = city?.population || 1000000;

    try {
      await this.pipeline.runAdapter(this.adapters.benchmark, {
        cityId, cityCode, activityId, activityCode, year, population, runType: 'incremental'
      });
    } catch (err) {
      console.warn('[LaborEngine] Benchmark adapter failed:', err.message);
    }

    const metrics = await this.adapters.llm.fetch({
      cityCode,
      activityCode,
      year,
      population,
      metricCodes: ['specialists_count', 'avg_salary', 'labor_availability_score', 'saudization_rate']
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
      engine: 'LaborEngine',
      cityId,
      cityCode,
      activityId,
      activityCode,
      year,
      fused
    };
  }

  async _getCity(cityId) {
    const { data, error } = await this.pipeline.supabase
      .from('cities')
      .select('id, code, name_en, name_ar, country_code, population')
      .eq('id', cityId)
      .single();
    if (error) {
      console.warn('[LaborEngine] Could not load city:', error.message);
      return null;
    }
    return data;
  }
}

module.exports = LaborEngine;
