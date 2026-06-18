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

    const city = await this._getCity(cityId);
    const cityContext = {
      population: city?.population || 1000000,
      purchasingPowerIndex: city?.purchasing_power_index || 100,
      countryCode: city?.country_code || countryCode || 'SA'
    };

    const results = [];
    const adaptersToRun = this._selectAdapters(cityContext.countryCode);

    for (const adapter of adaptersToRun) {
      results.push(await this.pipeline.runAdapter(adapter, {
        cityId, cityCode, year, runType: 'incremental', ...cityContext
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

  async _getCity(cityId) {
    const { data, error } = await this.pipeline.supabase
      .from('cities')
      .select('id, code, name_en, name_ar, country_code, population, purchasing_power_index')
      .eq('id', cityId)
      .single();
    if (error) {
      console.warn('[CityEngine] Could not load city:', error.message);
      return null;
    }
    return data;
  }
}

module.exports = CityEngine;
