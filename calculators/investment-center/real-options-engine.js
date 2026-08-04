/**
 * Bonds Real Options Valuation Engine
 * Lightweight binomial-tree valuation for real options:
 *   - Expand (increase project scale)
 *   - Defer (delay investment)
 *   - Abandon (sell/exit for salvage value)
 *
 * Uses only native JavaScript math — no paid libraries.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Price a real option using a Cox-Ross-Rubinstein binomial tree.
   * @param {Object} params
   * @param {number} params.s0 - current underlying value (e.g. base NPV)
   * @param {number} params.strike - exercise price / cost
   * @param {number} params.volatility - annual volatility σ (e.g. 0.30)
   * @param {number} params.riskFreeRate - annual risk-free rate r (e.g. 0.05)
   * @param {number} params.timeToExpiry - years T (e.g. 2)
   * @param {number} params.steps - number of tree steps (default 20)
   * @param {string} params.optionType - 'expand' | 'defer' | 'abandon'
   * @param {number} params.optionMultiplier - scale multiplier for expand option (default 1.5)
   * @param {number} params.salvageValue - recovery value for abandon option (default strike)
   * @returns {Object} valuation result
   */
  function priceRealOption(params) {
    const s0 = toNumber(params.s0);
    const strike = toNumber(params.strike);
    const sigma = Math.max(0.01, toNumber(params.volatility, 0.3));
    const r = toNumber(params.riskFreeRate, 0.05);
    const T = Math.max(0.1, toNumber(params.timeToExpiry, 2));
    const steps = Math.max(3, Math.min(100, toNumber(params.steps, 20)));
    const optionType = params.optionType || 'expand';
    const multiplier = toNumber(params.optionMultiplier, 1.5);
    const salvageValue = toNumber(params.salvageValue, strike);

    const dt = T / steps;
    const u = Math.exp(sigma * Math.sqrt(dt));
    const d = 1 / u;
    const pu = (Math.exp(r * dt) - d) / (u - d);
    const pd = 1 - pu;
    const discount = Math.exp(-r * dt);

    // Build terminal underlying values
    const terminalValues = [];
    for (let i = 0; i <= steps; i++) {
      const upMoves = i;
      const downMoves = steps - i;
      const s = s0 * Math.pow(u, upMoves) * Math.pow(d, downMoves);
      terminalValues.push(s);
    }

    // Terminal option payoff
    let optionValues = terminalValues.map(s => optionPayoff(s, strike, optionType, multiplier, salvageValue));

    // Backward induction
    const earlyExercise = [];
    for (let step = steps - 1; step >= 0; step--) {
      const valuesAtStep = [];
      const exerciseAtStep = [];
      for (let i = 0; i <= step; i++) {
        const s = s0 * Math.pow(u, i) * Math.pow(d, step - i);
        const holdValue = discount * (pu * optionValues[i + 1] + pd * optionValues[i]);
        const exerciseValue = optionPayoff(s, strike, optionType, multiplier, salvageValue);
        const shouldExercise = exerciseValue >= holdValue;
        valuesAtStep.push(shouldExercise ? exerciseValue : holdValue);
        exerciseAtStep.push(shouldExercise);
      }
      optionValues = valuesAtStep;
      earlyExercise.unshift(exerciseAtStep);
    }

    const optionValue = optionValues[0];
    const intrinsicValue = optionPayoff(s0, strike, optionType, multiplier, salvageValue);
    const timeValue = optionValue - intrinsicValue;

    return {
      optionType,
      underlyingValue: round(s0),
      strike: round(strike),
      volatility: round(sigma),
      riskFreeRate: round(r),
      timeToExpiry: round(T),
      steps,
      optionValue: round(optionValue),
      intrinsicValue: round(intrinsicValue),
      timeValue: round(timeValue),
      recommendation: recommendOption(optionValue, intrinsicValue, optionType, false),
      tree: {
        upFactor: round(u),
        downFactor: round(d),
        riskNeutralUp: round(pu),
        riskNeutralDown: round(pd),
        discountFactor: round(discount),
        terminalValues: terminalValues.map(round),
        earlyExercise
      }
    };
  }

  function optionPayoff(s, strike, optionType, multiplier, salvageValue) {
    if (optionType === 'expand') {
      return Math.max(0, multiplier * s - strike);
    }
    if (optionType === 'defer') {
      // Deferring is equivalent to a call on the project value minus the delay cost
      return Math.max(0, s - strike);
    }
    if (optionType === 'abandon') {
      // Abandonment put: max(continue value, salvage - wind-down cost)
      return Math.max(0, salvageValue - s);
    }
    return Math.max(0, s - strike);
  }

  function recommendOption(optionValue, intrinsicValue, optionType, isAr = false) {
    const t = isAr ? {
      expand: 'خيار التوسعة يضيف قيمة إذا كان سعر التنفيذ أقل من القيمة المتوقعة.',
      defer: 'خيار التأجيل مفيد عندما تكون المعلومات المستقبلية قد تغير القرار.',
      abandon: 'خيار التخلي يحمي من الجانب السلبي إذا تجاوزت قيمة التخليص قيمة المشروع.',
      execute: 'نفّذ الخيار الآن (القيمة الجوهرية أعلى من القيمة الزمنية).',
      wait: 'انتظر؛ القيمة الزمنية للخيار إيجابية.',
      negligible: 'قيمة الخيار ضئيلة؛ القرار التقليدي كافٍ.'
    } : {
      expand: 'Expansion option adds value when execution cost is below expected upside.',
      defer: 'Deferral option is useful when future information may change the decision.',
      abandon: 'Abandonment option protects the downside if salvage exceeds project value.',
      execute: 'Exercise the option now (intrinsic value exceeds time value).',
      wait: 'Wait; the option still has positive time value.',
      negligible: 'Option value is negligible; traditional decision is sufficient.'
    };

    let action = t.wait;
    if (optionValue <= 0) action = t.negligible;
    else if (intrinsicValue >= optionValue * 0.7) action = t.execute;

    const typeDesc = t[optionType] || '';
    return { action, typeDescription: typeDesc };
  }

  /**
   * Quick sensitivity of option value to volatility and time.
   * @returns {Object[]} array of { volatility, timeToExpiry, optionValue }
   */
  function sensitivitySweep(params, volatilities = [0.15, 0.30, 0.45], times = [1, 2, 3]) {
    const results = [];
    volatilities.forEach(v => {
      times.forEach(t => {
        const r = priceRealOption({ ...params, volatility: v, timeToExpiry: t });
        results.push({ volatility: v, timeToExpiry: t, optionValue: r.optionValue });
      });
    });
    return results;
  }

  const RealOptionsEngine = {
    priceRealOption,
    sensitivitySweep
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealOptionsEngine;
  }
  global.RealOptionsEngine = RealOptionsEngine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
