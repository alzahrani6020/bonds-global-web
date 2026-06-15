/**
 * DataPipeline — 编排数据获取流程：
 * fetch → validate → transform → store raw → store normalized → fuse → update gold
 */
const { createClient } = require('@supabase/supabase-js');
const FusionCore = require('./FusionCore');
const InferenceEngine = require('./InferenceEngine');
const FeedbackEngine = require('./FeedbackEngine');
const RegressionEstimator = require('../ml/RegressionEstimator');
const OpportunityScoringEngine = require('../OpportunityScoringEngine');

class DataPipeline {
  constructor(supabaseConfig, options = {}) {
    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey
    );
    this.fusionCore = new FusionCore(options.fusion);
    this.inferenceEngine = new InferenceEngine(options.inferenceBaseData);
    this.feedbackEngine = options.feedbackEngine || (supabaseConfig ? new FeedbackEngine(supabaseConfig) : null);
    this.opportunityEngine = new OpportunityScoringEngine(this.supabase, options.opportunity);
    this.options = {
      batchSize: options.batchSize || 500,
      storeRaw: options.storeRaw !== false,
      inferMissing: options.inferMissing !== false,
      useFeedback: options.useFeedback !== false,
      ...options
    };
  }

  /**
   * 运行单个适配器。
   * @param {BaseAdapter} adapter
   * @param {Object} options — { cityId, cityCode, activityId, activityCode, year, runType }
   * @returns {Promise<Object>} — run summary
   */
  async runAdapter(adapter, options = {}) {
    const { cityId, cityCode, activityId, activityCode, year, runType = 'manual' } = options;

    // 1. 创建 run 记录
    const { data: run, error: runError } = await this.supabase
      .from('data_source_runs')
      .insert({
        source_id: adapter.config.sourceId,
        run_type: runType,
        status: 'running',
        metadata: { cityId, cityCode, activityId, activityCode, year }
      })
      .select()
      .single();

    if (runError) throw runError;

    let recordsFetched = 0;
    let recordsValid = 0;
    let recordsImported = 0;
    const errors = [];

    try {
      // 2. 获取原始数据
      const rawItems = await adapter.fetch({ cityId, cityCode, activityId, activityCode, year });
      recordsFetched = rawItems.length;

      // 3. 处理每条数据
      for (const rawItem of rawItems) {
        const { valid, errors: validationErrors } = await adapter.validate(rawItem);
        if (!valid) {
          errors.push({ item: rawItem, errors: validationErrors });
          continue;
        }
        recordsValid++;

        // 4. 存储原始数据
        if (this.options.storeRaw) {
          await this.supabase.from('raw_data').insert({
            run_id: run.id,
            source_id: adapter.config.sourceId,
            external_id: rawItem.externalId || rawItem.id,
            raw_payload: rawItem
          });
        }

        // 5. 转换并存储 normalized metrics
        const metrics = await adapter.transform(rawItem);
        for (const metric of metrics) {
          await this._upsertNormalizedMetric(metric, {
            runId: run.id,
            cityId: cityId || rawItem.cityId,
            activityId: activityId || rawItem.activityId,
            year: year || rawItem.year,
            sourceId: adapter.config.sourceId,
            sourceName: adapter.config.sourceName
          });
          recordsImported++;
        }
      }

      // 6. 更新 run 状态
      await this.supabase
        .from('data_source_runs')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          records_fetched: recordsFetched,
          records_valid: recordsValid,
          records_imported: recordsImported,
          errors: errors.slice(0, 50) // 限制错误数量
        })
        .eq('id', run.id);

      return {
        runId: run.id,
        sourceId: adapter.config.sourceId,
        status: errors.length > 0 ? 'partial' : 'success',
        recordsFetched,
        recordsValid,
        recordsImported,
        errors: errors.length
      };
    } catch (err) {
      await this.supabase
        .from('data_source_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          records_fetched: recordsFetched,
          records_valid: recordsValid,
          records_imported: recordsImported,
          errors: [{ message: err.message, stack: err.stack }]
        })
        .eq('id', run.id);
      throw err;
    }
  }

  /**
   * 融合并更新 Gold layer 指标。
   * @param {Object} options — { cityId, cityCode, activityId, activityCode, year }
   */
  async fuseToGold(options = {}) {
    const { cityId, cityCode, activityId, activityCode, year } = options;

    // Load country benchmarks and trained ML models for inference engine
    if (cityId) {
      try {
        const benchmarks = await this._loadCountryBenchmarks(cityId, year);
        this.inferenceEngine.baseData.countryBenchmarks = benchmarks;
      } catch (err) {
        console.warn('[DataPipeline] Could not load country benchmarks:', err.message);
      }

      try {
        const countryCode = await this._getCityCountryCode(cityId);
        const models = await RegressionEstimator.loadModels(this.supabase, null, countryCode);
        this.inferenceEngine.baseData.regressionModels = models;
      } catch (err) {
        console.warn('[DataPipeline] Could not load ML models:', err.message);
      }
    }

    // 获取所有相关 normalized metrics
    let query = this.supabase.from('normalized_metrics').select('*');
    if (cityId) query = query.eq('city_id', cityId);
    if (activityId) query = query.eq('activity_id', activityId);
    if (year) query = query.eq('year', year);

    const { data: metrics, error } = await query;
    if (error) throw error;

    // 按 metric_code 分组
    const grouped = {};
    for (const m of metrics || []) {
      if (!grouped[m.metric_code]) grouped[m.metric_code] = [];
      grouped[m.metric_code].push({
        value: m.value,
        valueText: m.value_text,
        sourceId: m.source_id,
        confidence: m.confidence,
        fetchedAt: m.fetched_at,
        isOverride: m.is_override
      });
    }

    // 获取 metric definitions 以确定 data_type
    const { data: definitions } = await this.supabase
      .from('metric_definitions')
      .select('*');
    const defMap = {};
    for (const d of definitions || []) defMap[d.code] = d;

    // 融合每个指标
    const fused = {};
    for (const [code, items] of Object.entries(grouped)) {
      const def = defMap[code];
      fused[code] = this.fusionCore.fuse(items, def?.data_type || 'number');
    }

    // 推断缺失指标
    if (this.options.inferMissing) {
      const availableMetrics = {};
      for (const [code, result] of Object.entries(fused)) {
        if (result.value !== null || result.valueText !== null) {
          availableMetrics[code] = result;
        }
      }

      // Load feedback corrections
      let corrections = {};
      if (this.options.useFeedback && this.feedbackEngine) {
        try {
          const correctionPromises = Object.keys(defMap).map(async code => {
            const correction = await this.feedbackEngine.getCorrectionFactor(code, {
              cityId,
              activityId,
              year
            });
            return { code, correction };
          });
          const correctionResults = await Promise.all(correctionPromises);
          for (const { code, correction } of correctionResults) {
            if (correction.feedbackCount >= this.feedbackEngine.options.minFeedbackCount) {
              corrections[code] = correction;
            }
          }
        } catch (err) {
          console.warn('[DataPipeline] Failed to load feedback corrections:', err.message);
        }
      }

      const allCodes = Object.keys(defMap);
      for (const code of allCodes) {
        if (fused[code] && (fused[code].value !== null || fused[code].valueText !== null)) continue;
        const inferred = this.inferenceEngine.infer(code, {
          cityId,
          cityCode,
          activityId,
          activityCode,
          year,
          availableMetrics
        }, corrections);
        if (inferred.value !== null || inferred.valueText !== null) {
          fused[code] = {
            value: inferred.value,
            valueText: inferred.valueText,
            confidence: inferred.confidence,
            sources: [{ sourceId: 'inference_engine', confidence: inferred.confidence }],
            method: 'inference',
            isEstimated: true,
            confidenceReason: inferred.confidenceReason
          };
        }
      }
    }

    // 更新 Gold layer
    await this._updateCityIndicators(cityId, year, fused);
    await this._updateCityMarketData(cityId, activityId, year, fused);

    // Compute Golden Opportunity Score for this city/activity/year
    if (cityId && activityId && year) {
      try {
        await this.opportunityEngine.calculateAndSave({ cityId, activityId, year });
        await this.opportunityEngine.recalculateRanks({ activityId, year });
      } catch (err) {
        console.warn('[DataPipeline] Opportunity scoring failed:', err.message);
      }
    }

    return fused;
  }

  async _upsertNormalizedMetric(metric, context) {
    const { runId, cityId, activityId, year, sourceId, sourceName } = context;
    const record = {
      metric_code: metric.metricCode,
      city_id: cityId || null,
      activity_id: activityId || null,
      year: year || metric.year || new Date().getFullYear(),
      value: metric.value,
      value_text: metric.valueText,
      source_id: sourceId,
      source_name: sourceName,
      source_url: metric.sourceUrl,
      confidence: metric.confidence,
      confidence_reason: metric.confidenceReason,
      fetched_at: new Date().toISOString(),
      valid_from: metric.validFrom,
      valid_until: metric.validUntil,
      is_override: metric.isOverride || false,
      metadata: {
        runId,
        ...metric.metadata
      }
    };

    // Delete existing row first to handle NULL activity_id correctly in upsert
    let deleteQuery = this.supabase
      .from('normalized_metrics')
      .delete()
      .eq('metric_code', record.metric_code)
      .eq('city_id', record.city_id)
      .eq('year', record.year)
      .eq('source_id', record.source_id);

    if (record.activity_id) {
      deleteQuery = deleteQuery.eq('activity_id', record.activity_id);
    } else {
      deleteQuery = deleteQuery.is('activity_id', null);
    }

    await deleteQuery;

    const { error } = await this.supabase
      .from('normalized_metrics')
      .insert(record);

    if (error) throw error;
  }

  async _updateCityIndicators(cityId, year, fused) {
    if (!cityId || !year) return;

    const map = {
      gdp_city: 'gdp_city',
      growth_rate: 'growth_rate',
      unemployment_rate: 'unemployment_rate',
      establishments_count: 'establishments_count',
      inflation_rate: 'inflation_rate',
      business_ease_index: 'business_ease_index',
      avg_rent_per_sqm: 'avg_rent_per_sqm',
      avg_land_price_per_sqm: 'avg_land_price_per_sqm',
      warehouse_rent_per_sqm: 'warehouse_rent_per_sqm',
      factory_rent_per_sqm: 'factory_rent_per_sqm'
    };
    const integerColumns = ['establishments_count', 'new_licenses_count'];

    const update = { city_id: cityId, year };
    let confidences = [];

    for (const [metricCode, column] of Object.entries(map)) {
      if (fused[metricCode] && fused[metricCode].value !== null) {
        let value = fused[metricCode].value;
        if (integerColumns.includes(column)) value = Math.round(value);
        update[column] = value;
        confidences.push(fused[metricCode].confidence);
      }
    }

    update.overall_confidence = confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

    const { error } = await this.supabase
      .from('city_indicators')
      .upsert(update, { onConflict: 'city_id,year' });

    if (error) throw error;
  }

  async _updateCityMarketData(cityId, activityId, year, fused) {
    if (!cityId || !activityId || !year) return;

    const map = {
      competitors_count: 'competitors_count',
      market_saturation_score: 'market_saturation_score',
      avg_rent_per_sqm: 'avg_rent_per_sqm',
      avg_salary: 'avg_salary',
      labor_availability_score: 'labor_availability_score',
      market_size: 'market_size',
      annual_growth_rate: 'annual_growth_rate',
      per_capita_spending: 'per_capita_spending',
      expected_demand: 'expected_demand',
      saudization_rate: 'saudization_rate',
      specialists_count: 'specialists_count',
      profit_margin_min: 'profit_margin_min',
      profit_margin_avg: 'profit_margin_avg',
      profit_margin_max: 'profit_margin_max',
      risk_score: 'risk_score'
    };
    const integerColumns = ['competitors_count', 'specialists_count', 'labor_availability_score', 'market_saturation_score', 'saudization_rate'];

    const update = { city_id: cityId, activity_id: activityId, data_year: year };
    let confidences = [];

    for (const [metricCode, column] of Object.entries(map)) {
      if (fused[metricCode]) {
        if (fused[metricCode].value !== null) {
          let value = fused[metricCode].value;
          if (integerColumns.includes(column)) value = Math.round(value);
          update[column] = value;
        }
        if (fused[metricCode].valueText !== null) update[column] = fused[metricCode].valueText;
        confidences.push(fused[metricCode].confidence);
      }
    }

    update.confidence = confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

    const { error } = await this.supabase
      .from('city_market_data')
      .upsert(update, { onConflict: 'city_id,activity_id,data_year' });

    if (error) throw error;
  }

  async _loadCountryBenchmarks(cityId, year) {
    const countryCode = await this._getCityCountryCode(cityId);

    const { data: rows } = await this.supabase
      .from('country_benchmarks')
      .select('metric_code, benchmark_value')
      .eq('country_code', countryCode)
      .lte('year', year || new Date().getFullYear())
      .order('year', { ascending: false });

    const benchmarks = {};
    for (const row of rows || []) {
      if (!benchmarks[row.metric_code]) {
        benchmarks[row.metric_code] = Number(row.benchmark_value);
      }
    }
    return benchmarks;
  }

  async _getCityCountryCode(cityId) {
    const { data: city, error } = await this.supabase
      .from('cities')
      .select('country_code')
      .eq('id', cityId)
      .single();
    if (error || !city) throw new Error('City not found');
    return city.country_code || 'SA';
  }
}

module.exports = DataPipeline;
