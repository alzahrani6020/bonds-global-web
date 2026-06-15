/**
 * CityEngine — محرك المدن.
 * يجمع المؤشرات الاقتصادية والديموغرافية للمدينة من المصادر الرسمية حسب الدولة.
 */
const DataPipeline = require('../DataPipeline');
const {
  GastatAdapter,
  SamaAdapter,
  ManualAdapter,
  UaeStatsAdapter,
  EgyptCapmasAdapter,
  QatarPlanningAdapter,
  JordanStatsAdapter
} = require('../adapters');

class CityEngine {
  constructor(supabaseConfig, options = {}) {
    this.pipeline = new DataPipeline(supabaseConfig, options.pipeline);
    this.adapters = {
      gastat: new GastatAdapter(options.gastat),
      sama: new SamaAdapter(options.sama),
      manual: new ManualAdapter(options.manual),
      uae_stats: new UaeStatsAdapter(options.uae_stats),
      egypt_capmas: new EgyptCapmasAdapter(options.egypt_capmas),
      qatar_psa: new QatarPlanningAdapter(options.qatar_psa),
      jordan_dos: new JordanStatsAdapter(options.jordan_dos)
    };
  }

  /**
   * تشغيل محرك المدن لمدينة وسنة معينة.
   * @param {Object} options — { cityId, cityCode, countryCode, year }
   */
  async run(options = {}) {
    const { cityId, cityCode, countryCode, year = new Date().getFullYear() } = options;

    if (!cityId || !cityCode) {
      throw new Error('cityId and cityCode are required');
    }

    const results = [];
    const adaptersToRun = this._selectAdapters(countryCode);

    for (const adapter of adaptersToRun) {
      results.push(await this.pipeline.runAdapter(adapter, {
        cityId, cityCode, year, runType: 'incremental'
      }));
    }

    // دمج وتحديث Gold layer
    const fused = await this.pipeline.fuseToGold({ cityId, cityCode, year });

    return {
      engine: 'CityEngine',
      cityId,
      cityCode,
      countryCode,
      year,
      adapters: results,
      fused
    };
  }

  _selectAdapters(countryCode) {
    const country = (countryCode || 'SA').toUpperCase();
    switch (country) {
      case 'SA':
        return [this.adapters.gastat, this.adapters.sama];
      case 'AE':
        return [this.adapters.uae_stats];
      case 'EG':
        return [this.adapters.egypt_capmas];
      case 'QA':
        return [this.adapters.qatar_psa];
      case 'JO':
        return [this.adapters.jordan_dos];
      default:
        return [this.adapters.manual];
    }
  }
}

module.exports = CityEngine;
