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
    const population = Number(city.population) || 1;
    const purchasingPower = Number(city.purchasing_power_index) || 0;
    const confidence = Number(marketRow.confidence) || 0;

    // 1. Market growth (0-30% mapped to 0-100)
    const growth = this._clamp(Number(marketRow.annual_growth_rate) || 0, 0, 30);
    const growthScore = (growth / 30) * 100;

    // 2. Per-capita market spend relative to peers or fallback benchmark
    const marketSize = Number(marketRow.market_size) || 0;
    const perCapitaSpending = Number(marketRow.per_capita_spending) || (marketSize / population);
    const peerMedian = peers.median || perCapitaSpending || 1;
    const targetPerCapita = benchmarks.per_capita_market_spend || peerMedian;
    const perCapitaRatio = targetPerCapita > 0 ? perCapitaSpending / targetPerCapita : 0;
    const perCapitaScore = this._clamp(perCapitaRatio * 50, 0, 100);

    // 3. Low saturation
    const saturation = this._clamp(Number(marketRow.market_saturation_score) || 50, 0, 100);
    const saturationScore = 100 - saturation;

    // 4. Labor availability
    const laborScore = this._clamp(Number(marketRow.labor_availability_score) || 50, 0, 100);

    // 5. Purchasing power (scale 0-150)
    const purchasingPowerScore = this._clamp((purchasingPower / 150) * 100, 0, 100);

    // 6. Rent affordability vs country benchmark
    const cityRent = Number(marketRow.avg_rent_per_sqm) || Number(city.avg_rent_per_sqm) || 0;
    const benchmarkRent = benchmarks.avg_rent_per_sqm || cityRent || 1;
    const rentRatio = benchmarkRent > 0 ? cityRent / benchmarkRent : 1;
    const rentScore = this._clamp(100 / Math.max(1, rentRatio), 0, 100);

    // 7. Low risk
    const risk = this._clamp(Number(marketRow.risk_score) || 50, 0, 100);
    const riskScore = 100 - risk;

    const weighted =
      this.weights.growth * growthScore +
      this.weights.perCapitaMarket * perCapitaScore +
      this.weights.lowSaturation * saturationScore +
      this.weights.laborAvailability * laborScore +
      this.weights.purchasingPower * purchasingPowerScore +
      this.weights.rentAffordability * rentScore +
      this.weights.lowRisk * riskScore;

    // Confidence discount: 0 confidence -> 50% of score, 100 confidence -> 100%
    const confidenceMultiplier = 0.5 + (this._clamp(confidence, 0, 100) / 200);
    const finalScore = this._clamp(weighted * confidenceMultiplier, 0, 100);

    const classification = this._classify(finalScore);

    return {
      score: this._round(finalScore),
      classification,
      breakdown: {
        growth: this._round(growthScore),
        perCapitaMarket: this._round(perCapitaScore),
        lowSaturation: this._round(saturationScore),
        laborAvailability: this._round(laborScore),
        purchasingPower: this._round(purchasingPowerScore),
        rentAffordability: this._round(rentScore),
        lowRisk: this._round(riskScore),
        confidence,
        confidenceMultiplier: this._round(confidenceMultiplier * 100),
        weights: this.weights
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

    const { data, error } = await this.supabase
      .from('country_benchmarks')
      .select('metric_code, benchmark_value')
      .eq('country_code', city.country_code || 'SA')
      .lte('year', year || new Date().getFullYear())
      .order('year', { ascending: false });

    if (error) {
      console.warn('[OpportunityScoringEngine] Could not load benchmarks:', error.message);
      return {};
    }

    const benchmarks = {};
    for (const row of data || []) {
      if (!benchmarks[row.metric_code]) {
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
        const population = Number(row.cities?.population) || 1;
        return (Number(row.market_size) || 0) / population;
      })
      .filter(v => v > 0)
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
