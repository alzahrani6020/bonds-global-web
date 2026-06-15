/**
 * CompetitionEngine — محرك المنافسة.
 * يقدر عدد المنافسين ودرجة المنافسة ومؤشر التشبع.
 *
 * الآن يحاول أولاً جلب بيانات حقيقية عبر OpenStreetMap (أو Google Places إن وُجد مفتاح)،
 * ثم يسقط إلى التقديرات المحلية عند الفشل.
 */
const DataPipeline = require('../DataPipeline');
const { HttpClient, createSupabaseCache } = require('../HttpClient');
const { ManualAdapter, LLMEstimationAdapter, CompetitorDataAdapter } = require('../adapters');
const DataQualityTracker = require('../DataQualityTracker');

class CompetitionEngine {
  constructor(supabaseConfig, options = {}) {
    this.pipeline = new DataPipeline(supabaseConfig, options.pipeline);

    const httpClient = new HttpClient({
      timeout: 25000,
      retries: 2,
      cache: createSupabaseCache(this.pipeline.supabase)
    });

    this.adapters = {
      manual: new ManualAdapter(options.manual),
      competitor: new CompetitorDataAdapter({
        httpClient,
        ...options.competitor
      }),
      llm: new LLMEstimationAdapter({
        inferenceEngine: this.pipeline.inferenceEngine,
        ...options.llm
      })
    };
    this.qualityTracker = new DataQualityTracker(this.pipeline.supabase);
  }

  async run(options = {}) {
    const { cityId, cityCode, activityId, activityCode, year = new Date().getFullYear() } = options;

    if (!cityId || !cityCode) {
      throw new Error('cityId and cityCode are required');
    }

    // Clean stale external competitor data for this run
    await this._clearExternalCompetitorMetrics(cityId, activityId, year);

    // Load city name and population for external data sources
    const city = await this._getCity(cityId);
    const population = city?.population || 1000000;
    const countryPopulation = await this._getCountryPopulation(city?.country_code);

    // 1. Load country-calibrated value if it exists.
    const calibration = await this._loadCalibration(cityId, activityId, year);

    // 2. Try external competitor data (Geoapify / OSM).
    let competitorItems = await this.adapters.competitor.fetch({
      cityId,
      cityCode,
      cityName: city?.name_en,
      countryCode: city?.country_code,
      activityId,
      activityCode,
      year,
      population,
      countryPopulation
    });

    // If a calibrated value exists, override the raw competitors_count with it
    // while keeping broad-category metrics (saturation/level) from the adapter.
    if (calibration) {
      const existingCountItem = competitorItems.find(i => i.metricCode === 'competitors_count');
      if (existingCountItem) {
        existingCountItem.value = calibration.calibrated_value;
        existingCountItem.sourceMethod = 'geoapify_country_calibration';
        existingCountItem.sourceQuality = 'open_data';
        existingCountItem.confidenceReason = `Country-calibrated Geoapify count (factor ${Number(calibration.factor).toFixed(2)}) for ${city?.name_en || cityCode}`;
      } else {
        competitorItems.push({
          cityCode,
          activityCode,
          year,
          metricCode: 'competitors_count',
          value: calibration.calibrated_value,
          population,
          sourceQuality: 'open_data',
          sourceUrl: 'https://api.geoapify.com/v2/places',
          sourceMethod: 'geoapify_country_calibration',
          confidenceReason: `Country-calibrated Geoapify count (factor ${Number(calibration.factor).toFixed(2)}) for ${city?.name_en || cityCode}`
        });
      }
    }

    const heuristicCount = await this._heuristicCompetitors(cityCode, activityCode, population);
    const competitorCountItem = competitorItems.find(i => i.metricCode === 'competitors_count');
    let rawExternalCount = competitorCountItem?.value;
    let externalCount = rawExternalCount;
    let blended = false;

    if (Number.isFinite(externalCount) && externalCount > 0 && heuristicCount > 0) {
      const blendedCount = this._blendExternalCount(externalCount, heuristicCount);
      blended = blendedCount !== externalCount;
      externalCount = blendedCount;
    }

    // Apply blended/capped value to the items we will store.
    const processedCompetitorItems = competitorItems.map(item => {
      if (item.metricCode === 'competitors_count' && Number.isFinite(externalCount)) {
        return {
          ...item,
          value: externalCount,
          sourceMethod: blended ? `${item.sourceMethod}_blended` : item.sourceMethod,
          confidenceReason: blended
            ? `${item.confidenceReason} (blended with heuristic floor to avoid undercount)`
            : item.confidenceReason
        };
      }
      return item;
    });

    const useExternal = this._isExternalCountReasonable(externalCount, heuristicCount);

    if (useExternal) {
      if (blended) {
        console.warn(`[CompetitionEngine] Raw competitor count ${rawExternalCount} for ${cityCode} too low vs heuristic ${heuristicCount}; using blended ${externalCount}.`);
      }
      for (const item of processedCompetitorItems) {
        const { valid, errors } = await this.adapters.competitor.validate(item);
        if (!valid) {
          console.warn('[CompetitionEngine] Invalid competitor item:', errors);
          continue;
        }
        const transformed = await this.adapters.competitor.transform(item);
        for (const t of transformed) {
          await this.pipeline._upsertNormalizedMetric(t, {
            runId: null,
            cityId,
            activityId,
            year,
            sourceId: this.adapters.competitor.config.sourceId,
            sourceName: this.adapters.competitor.config.sourceName
          });
        }
        await this.qualityTracker.record({
          sourceId: this.adapters.competitor.config.sourceId,
          cityId,
          activityId,
          year,
          metricCode: item.metricCode,
          success: true,
          count: item.value,
          confidence: this.adapters.competitor.getConfidence(item.metricCode, item.sourceQuality),
          sourceMethod: item.sourceMethod
        });
      }
    } else if (rawExternalCount !== undefined) {
      console.warn(`[CompetitionEngine] External competitor count ${rawExternalCount} for ${cityCode} is far from heuristic ${heuristicCount}; using fallback.`);
      await this.qualityTracker.record({
        sourceId: this.adapters.competitor.config.sourceId,
        cityId,
        activityId,
        year,
        metricCode: 'competitors_count',
        success: false,
        count: rawExternalCount,
        failureReason: `Count ${rawExternalCount} not within 0.05x-10x of heuristic ${heuristicCount}`
      });
    } else {
      await this.qualityTracker.record({
        sourceId: this.adapters.competitor.config.sourceId,
        cityId,
        activityId,
        year,
        metricCode: 'competitors_count',
        success: false,
        failureReason: 'No external data returned'
      });
    }

    // 2. Fill remaining / fallback metrics via inference engine
    const llmMetrics = await this.adapters.llm.fetch({
      cityCode,
      activityCode,
      year,
      population,
      metricCodes: ['competitors_count', 'competition_level', 'market_saturation_score']
    });

    for (const metric of llmMetrics) {
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
      await this.qualityTracker.record({
        sourceId: this.adapters.llm.config.sourceId,
        cityId,
        activityId,
        year,
        metricCode: metric.metricCode,
        success: true,
        count: metric.value,
        confidence: metric.confidence,
        sourceMethod: 'inference_engine'
      });
    }

    const fused = await this.pipeline.fuseToGold({ cityId, cityCode, activityId, activityCode, year });

    return {
      engine: 'CompetitionEngine',
      cityId,
      cityCode,
      activityId,
      activityCode,
      year,
      externalCompetitorItems: competitorItems.length,
      fused
    };
  }

  async _heuristicCompetitors(cityCode, activityCode, population) {
    try {
      const result = this.pipeline.inferenceEngine.infer('competitors_count', {
        cityCode,
        activityCode,
        availableMetrics: { population: { value: population } }
      });
      return result.value || 0;
    } catch (err) {
      return 0;
    }
  }

  _isExternalCountReasonable(externalCount, heuristicCount) {
    if (!Number.isFinite(externalCount) || externalCount <= 0) return false;
    if (!heuristicCount || heuristicCount <= 0) return true; // no heuristic to compare
    const ratio = externalCount / heuristicCount;
    // Accept if within 0.05x to 10x of the heuristic estimate.
    // Extremely low raw counts are blended with a heuristic floor before this check.
    return ratio >= 0.05 && ratio <= 10;
  }

  _blendExternalCount(externalCount, heuristicCount) {
    if (!Number.isFinite(externalCount) || externalCount <= 0) return externalCount;
    if (!heuristicCount || heuristicCount <= 0) return externalCount;
    const ratio = externalCount / heuristicCount;
    if (ratio < 0.05) {
      const floor = Math.round(heuristicCount * 0.25);
      return Math.max(externalCount, floor);
    }
    if (ratio > 10) {
      return Math.round(heuristicCount * 10);
    }
    return externalCount;
  }

  async _loadCalibration(cityId, activityId, year) {
    if (!cityId || !activityId) return null;
    try {
      const { data, error } = await this.pipeline.supabase
        .from('city_competitor_calibration')
        .select('calibrated_value, factor, source')
        .eq('city_id', cityId)
        .eq('activity_id', activityId)
        .eq('metric_code', 'competitors_count')
        .eq('year', year)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (err) {
      console.warn('[CompetitionEngine] Could not load calibration:', err.message);
      return null;
    }
  }

  async _clearExternalCompetitorMetrics(cityId, activityId, year) {
    try {
      let q = this.pipeline.supabase
        .from('normalized_metrics')
        .delete()
        .eq('city_id', cityId)
        .eq('year', year)
        .eq('source_id', this.adapters.competitor.config.sourceId);
      if (activityId) q = q.eq('activity_id', activityId);
      else q = q.is('activity_id', null);
      await q;
    } catch (err) {
      console.warn('[CompetitionEngine] Could not clear stale competitor metrics:', err.message);
    }
  }

  async _getCountryPopulation(countryCode) {
    if (!countryCode) return 0;
    try {
      const { data, error } = await this.pipeline.supabase
        .from('cities')
        .select('population')
        .eq('country_code', countryCode);
      if (error) throw error;
      return (data || []).reduce((sum, c) => sum + (c.population || 0), 0);
    } catch (err) {
      console.warn('[CompetitionEngine] Could not load country population:', err.message);
      return 0;
    }
  }

  async _getCity(cityId) {
    try {
      const { data, error } = await this.pipeline.supabase
        .from('cities')
        .select('name_en, country_code, population')
        .eq('id', cityId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[CompetitionEngine] Could not load city details:', err.message);
      return null;
    }
  }
}

module.exports = CompetitionEngine;
