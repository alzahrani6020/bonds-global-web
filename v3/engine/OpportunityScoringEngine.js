const { assessOpportunityRow } = require('../../lib/truth/opportunity-reliability');

/**
 * Bonds V3 — Golden Opportunity Scoring Engine
 *
 * Computes a composite 0-100 opportunity score for each (city, activity, year)
 * based on market size/growth, competition saturation, labor, purchasing power,
 * real-estate affordability, and risk.
 */

class OpportunityScoringEngine {
  constructor(supabase, options = {}) {
    this.supabase = supabase;
    this.weights = {
      growth: options.weights?.growth ?? 0.20,
      perCapitaMarket: options.weights?.perCapitaMarket ?? 0.15,
      lowSaturation: options.weights?.lowSaturation ?? 0.20,
      laborAvailability: options.weights?.laborAvailability ?? 0.15,
      purchasingPower: options.weights?.purchasingPower ?? 0.15,
      rentAffordability: options.weights?.rentAffordability ?? 0.10,
      lowRisk: options.weights?.lowRisk ?? 0.05
    };
  }

  /**
   * Calculate and save opportunity_score for a single city/activity/year.
   */
  async calculateAndSave({ cityId, activityId, year }) {
    if (!cityId || !activityId || !year) {
      throw new Error('cityId, activityId and year are required');
    }

    const [marketRow, city, benchmarks, peers] = await Promise.all([
      this._loadMarketRow(cityId, activityId, year),
      this._loadCity(cityId),
      this._loadCountryBenchmarks(cityId, year),
      this._loadPeerPerCapita(activityId, year)
    ]);

    if (!marketRow || !city) {
      console.warn('[OpportunityScoringEngine] Missing market row or city', { cityId, activityId, year });
      return null;
    }

    const scoreResult = this._computeScore(marketRow, city, benchmarks, peers);

    const { error } = await this.supabase
      .from('city_market_data')
      .update({
        opportunity_score: scoreResult.score,
        opportunity_breakdown: scoreResult.breakdown
      })
      .eq('city_id', cityId)
      .eq('activity_id', activityId)
      .eq('data_year', year);

    if (error) throw error;

    return scoreResult;
  }

  /**
   * Recalculate opportunity_rank for all rows of an activity/year.
   * Rank = position when ordered by opportunity_score DESC (1 = best).
   */
  async recalculateRanks({ activityId, year }) {
    const { data: rows, error } = await this.supabase
      .from('city_market_data')
      .select('id, opportunity_score')
      .eq('activity_id', activityId)
      .eq('data_year', year)
      .order('opportunity_score', { ascending: false });

    if (error) throw error;
    if (!rows?.length) return { updated: 0 };

    let rank = 0;
    let previousScore = null;
    const updates = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.opportunity_score !== previousScore) {
        rank = i + 1;
        previousScore = row.opportunity_score;
      }
      updates.push({ id: row.id, opportunity_rank: rank });
    }

    // Update ranks one by one to avoid upsert/insert issues with not-null columns
    let updated = 0;
    for (const u of updates) {
      const { error: updateError } = await this.supabase
        .from('city_market_data')
        .update({ opportunity_rank: u.opportunity_rank })
        .eq('id', u.id);
      if (updateError) throw updateError;
      updated++;
    }

    return { updated };
  }

  _computeScore(marketRow, city, benchmarks, peers) {
    const confidence = Number.isFinite(Number(marketRow.confidence))
      ? Number(marketRow.confidence)
      : 0;

    const components = {};
    const missingComponents = [];

    const addComponent = (name, score, metadata = {}) => {
      const hasScore = score !== null && score !== undefined && score !== '' && Number.isFinite(Number(score));
      if (hasScore) {
        components[name] = {
          score: this._clamp(Number(score), 0, 100),
          weight: this.weights[name],
          ...metadata
        };
      } else {
        missingComponents.push(name);
      }
    };

    // 1. Market growth (0-30% mapped to 0-100)
    const hasGrowth = marketRow.annual_growth_rate !== null &&
      marketRow.annual_growth_rate !== undefined &&
      Number.isFinite(Number(marketRow.annual_growth_rate));
    addComponent(
      'growth',
      hasGrowth
        ? (this._clamp(Number(marketRow.annual_growth_rate), 0, 30) / 30) * 100
        : null,
      { sourceField: 'annual_growth_rate' }
    );

    // 2. Per-capita market spend relative to benchmark or peer median.
    const population = Number(city.population);
    const validPopulation = Number.isFinite(population) && population > 0;
    const marketSize = Number(marketRow.market_size);
    const explicitPerCapita = Number(marketRow.per_capita_spending);
    const perCapitaSpending = Number.isFinite(explicitPerCapita) && explicitPerCapita > 0
      ? explicitPerCapita
      : (validPopulation && Number.isFinite(marketSize) && marketSize > 0 ? marketSize / population : null);
    const benchmarkPerCapita = Number(benchmarks.per_capita_market_spend);
    const peerMedian = Number(peers.median);
    const targetPerCapita = Number.isFinite(benchmarkPerCapita) && benchmarkPerCapita > 0
      ? benchmarkPerCapita
      : (Number.isFinite(peerMedian) && peerMedian > 0 ? peerMedian : null);
    addComponent(
      'perCapitaMarket',
      perCapitaSpending !== null && targetPerCapita !== null
        ? this._clamp((perCapitaSpending / targetPerCapita) * 50, 0, 100)
        : null,
      {
        sourceField: Number.isFinite(explicitPerCapita) && explicitPerCapita > 0
          ? 'per_capita_spending'
          : 'market_size/population',
        reference: Number.isFinite(benchmarkPerCapita) && benchmarkPerCapita > 0
          ? 'country_benchmark'
          : (Number.isFinite(peerMedian) && peerMedian > 0 ? 'peer_median' : null)
      }
    );

    // 3. Low saturation
    const hasSaturation = marketRow.market_saturation_score !== null &&
      marketRow.market_saturation_score !== undefined &&
      Number.isFinite(Number(marketRow.market_saturation_score));
    addComponent(
      'lowSaturation',
      hasSaturation ? 100 - this._clamp(Number(marketRow.market_saturation_score), 0, 100) : null,
      { sourceField: 'market_saturation_score' }
    );

    // 4. Labor availability
    const hasLabor = marketRow.labor_availability_score !== null &&
      marketRow.labor_availability_score !== undefined &&
      Number.isFinite(Number(marketRow.labor_availability_score));
    addComponent(
      'laborAvailability',
      hasLabor ? this._clamp(Number(marketRow.labor_availability_score), 0, 100) : null,
      { sourceField: 'labor_availability_score' }
    );

    // 5. Purchasing power (scale 0-150)
    const purchasingPower = Number(city.purchasing_power_index);
    addComponent(
      'purchasingPower',
      Number.isFinite(purchasingPower) && purchasingPower > 0
        ? this._clamp((purchasingPower / 150) * 100, 0, 100)
        : null,
      { sourceField: 'cities.purchasing_power_index' }
    );

    // 6. Rent affordability vs country benchmark
    const marketRent = Number(marketRow.avg_rent_per_sqm);
    const cityRent = Number.isFinite(marketRent) && marketRent > 0
      ? marketRent
      : null;
    const benchmarkRentValue = Number(benchmarks.avg_rent_per_sqm);
    const benchmarkRent = Number.isFinite(benchmarkRentValue) && benchmarkRentValue > 0
      ? benchmarkRentValue
      : null;
    addComponent(
      'rentAffordability',
      cityRent !== null && benchmarkRent !== null
        ? this._clamp(100 / Math.max(1, cityRent / benchmarkRent), 0, 100)
        : null,
      {
        sourceField: Number.isFinite(marketRent) && marketRent > 0
          ? 'avg_rent_per_sqm'
          : null,
        reference: benchmarkRent !== null ? 'country_benchmark' : null
      }
    );

    // 7. Low risk
    const hasRisk = marketRow.risk_score !== null &&
      marketRow.risk_score !== undefined &&
      Number.isFinite(Number(marketRow.risk_score));
    addComponent(
      'lowRisk',
      hasRisk ? 100 - this._clamp(Number(marketRow.risk_score), 0, 100) : null,
      { sourceField: 'risk_score' }
    );

    // Renormalize only across dimensions the engine can actually calculate.
    // Missing evidence is handled by reliability, not by fabricated neutral scores.
    const availableEntries = Object.entries(components);
    const availableWeight = availableEntries.reduce((sum, [, component]) => sum + component.weight, 0);
    const weighted = availableWeight > 0
      ? availableEntries.reduce((sum, [, component]) => sum + component.weight * component.score, 0) / availableWeight
      : 0;
    const totalWeight = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    const metricCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

    const rawPotential = this._clamp(weighted, 0, 100);
    const metricBreakdown = {
      growth: components.growth ? this._round(components.growth.score) : null,
      perCapitaMarket: components.perCapitaMarket ? this._round(components.perCapitaMarket.score) : null,
      lowSaturation: components.lowSaturation ? this._round(components.lowSaturation.score) : null,
      laborAvailability: components.laborAvailability ? this._round(components.laborAvailability.score) : null,
      purchasingPower: components.purchasingPower ? this._round(components.purchasingPower.score) : null,
      rentAffordability: components.rentAffordability ? this._round(components.rentAffordability.score) : null,
      lowRisk: components.lowRisk ? this._round(components.lowRisk.score) : null,
      confidence,
      weights: this.weights,
      effectiveWeights: Object.fromEntries(
        availableEntries.map(([name, component]) => [
          name,
          availableWeight > 0 ? Math.round((component.weight / availableWeight) * 1000) / 1000 : 0
        ])
      ),
      metricCoverage: this._round(metricCoverage * 100),
      missingComponents,
      componentProvenance: Object.fromEntries(
        availableEntries.map(([name, component]) => [
          name,
          {
            sourceField: component.sourceField || null,
            reference: component.reference || null
          }
        ])
      )
    };

    const reliability = assessOpportunityRow({
      ...marketRow,
      opportunity_score: rawPotential,
      opportunity_breakdown: metricBreakdown,
      cities: city
    });

    return {
      score: this._round(rawPotential),
      classification: this._classify(rawPotential),
      decisionScore: reliability.decisionScore,
      decisionClassification: this._classify(reliability.decisionScore),
      reliability: reliability.reliability,
      reliabilityBand: reliability.reliabilityBand,
      decisionStatus: reliability.decisionStatus,
      uncertainty: reliability.uncertainty,
      breakdown: {
        ...metricBreakdown,
        rawPotential: this._round(rawPotential),
        reliability: reliability.reliability,
        reliabilityBand: reliability.reliabilityBand,
        decisionScore: reliability.decisionScore,
        decisionStatus: reliability.decisionStatus,
        coverage: reliability.coverage,
        sourceType: reliability.sourceType,
        freshnessDays: reliability.freshnessDays,
        uncertainty: reliability.uncertainty,
        warnings: reliability.warnings
      }
    };
  }

  async _loadMarketRow(cityId, activityId, year) {
    const { data, error } = await this.supabase
      .from('city_market_data')
      .select('*')
      .eq('city_id', cityId)
      .eq('activity_id', activityId)
      .eq('data_year', year)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async _loadCity(cityId) {
    const { data, error } = await this.supabase
      .from('cities')
      .select('id, code, country_code, population, purchasing_power_index, lat, lng')
      .eq('id', cityId)
      .single();
    if (error) throw error;
    return data;
  }

  async _loadCountryBenchmarks(cityId, year) {
    const { data: city, error: cityError } = await this.supabase
      .from('cities')
      .select('country_code')
      .eq('id', cityId)
      .single();
    if (cityError || !city) return {};

    if (!city.country_code) return {};

    const { data, error } = await this.supabase
      .from('country_benchmarks')
      .select('metric_code, benchmark_value')
      .eq('country_code', city.country_code)
      .lte('year', year || new Date().getFullYear())
      .order('year', { ascending: false });

    if (error) {
      console.warn('[OpportunityScoringEngine] Could not load benchmarks:', error.message);
      return {};
    }

    const benchmarks = {};
    for (const row of data || []) {
      if (benchmarks[row.metric_code] === undefined) {
        benchmarks[row.metric_code] = Number(row.benchmark_value);
      }
    }
    return benchmarks;
  }

  async _loadPeerPerCapita(activityId, year) {
    const { data, error } = await this.supabase
      .from('city_market_data')
      .select('market_size, cities!inner(population)')
      .eq('activity_id', activityId)
      .eq('data_year', year)
      .not('market_size', 'is', null);

    if (error) {
      console.warn('[OpportunityScoringEngine] Could not load peers:', error.message);
      return { median: 0, count: 0 };
    }

    const values = (data || [])
      .map(row => {
        const population = Number(row.cities?.population);
        const marketSize = Number(row.market_size);
        if (!Number.isFinite(population) || population <= 0) return null;
        if (!Number.isFinite(marketSize) || marketSize <= 0) return null;
        return marketSize / population;
      })
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) return { median: 0, count: 0 };

    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];

    return { median, count: values.length };
  }

  _classify(score) {
    if (score >= 80) return 'hot';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'weak';
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  _round(value) {
    return Math.round(value * 10) / 10;
  }
}

module.exports = OpportunityScoringEngine;
