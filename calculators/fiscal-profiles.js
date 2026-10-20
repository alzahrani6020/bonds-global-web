/**
 * Bonds Global — Fiscal Profiles
 *
 * Country-specific fiscal estimation layer.
 * Taxable income and Zakat bases are explicit accounting inputs; this file does not
 * attempt to derive a tax return or a Zakat base from accounting profit.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BondsFiscal = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampPct(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }

  function money(value) {
    var n = Number(value);
    return isFinite(n) ? Math.max(0, n) : 0;
  }

  function normalizeDays(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 354;
    return n;
  }

  function saudiDayBasedZakatRate(financialYearDays) {
    return 2.5 * normalizeDays(financialYearDays) / 354;
  }

  function resolveSaudiOwnership(companyType, foreignOwnershipPct) {
    if (companyType === 'saudi_100') return { saudiPct: 100, foreignPct: 0 };
    if (companyType === 'foreign_100') return { saudiPct: 0, foreignPct: 100 };
    var foreignPct = clampPct(foreignOwnershipPct);
    return { saudiPct: 100 - foreignPct, foreignPct: foreignPct };
  }

  function saudiCorporateIncomeTaxRate(activityType, capitalInvestmentSar) {
    if (activityType === 'natural_gas') return 20;
    if (activityType !== 'oil_hydrocarbon') return 20;

    var capital = money(capitalInvestmentSar);
    if (capital > 375000000000) return 50;
    if (capital > 300000000000) return 65;
    if (capital > 225000000000) return 75;
    return 85;
  }

  function calculateSaudi(input) {
    input = input || {};
    var companyType = input.companyType || 'saudi_100';
    var ownership = resolveSaudiOwnership(companyType, input.foreignOwnershipPct);
    var financialYearDays = normalizeDays(input.financialYearDays);
    var dayBasedZakatRate = saudiDayBasedZakatRate(financialYearDays);

    var annualTaxableIncome = money(input.annualTaxableIncome);
    var annualZakatBase = money(input.annualZakatBase);
    var adjustedNetProfit = Math.min(annualZakatBase, money(input.adjustedNetProfit));
    var zakatBaseExcludingAdjustedProfit = Math.max(0, annualZakatBase - adjustedNetProfit);

    var activityType = input.activityType || 'standard';
    var corporateIncomeTaxRate = saudiCorporateIncomeTaxRate(activityType, input.capitalInvestmentSar);
    var foreignTaxableIncome = annualTaxableIncome * ownership.foreignPct / 100;
    var annualIncomeTaxAmount = foreignTaxableIncome * corporateIncomeTaxRate / 100;

    var eligibleShare = ownership.saudiPct / 100;
    var eligibleBaseExcludingAdjustedProfit = zakatBaseExcludingAdjustedProfit * eligibleShare;
    var eligibleAdjustedNetProfit = adjustedNetProfit * eligibleShare;

    // ZATCA treatment:
    // - Zakat-base components other than adjusted net profit use the day-based rate.
    // - Adjusted net profit is subject to 2.5%.
    var zakatOnBaseComponents = eligibleBaseExcludingAdjustedProfit * dayBasedZakatRate / 100;
    var zakatOnAdjustedNetProfit = eligibleAdjustedNetProfit * 2.5 / 100;
    var annualZakatAmount = zakatOnBaseComponents + zakatOnAdjustedNetProfit;

    return {
      countryCode: 'SA',
      mode: 'automatic',
      companyType: companyType,
      saudiOwnershipPct: ownership.saudiPct,
      foreignOwnershipPct: ownership.foreignPct,
      financialYearDays: financialYearDays,
      dayBasedZakatRate: dayBasedZakatRate,
      effectiveZakatRate: annualZakatBase > 0 ? annualZakatAmount / (annualZakatBase * eligibleShare || 1) * 100 : 0,
      annualTaxableIncome: annualTaxableIncome,
      foreignTaxableIncome: foreignTaxableIncome,
      activityType: activityType,
      capitalInvestmentSar: money(input.capitalInvestmentSar),
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatBase: annualZakatBase,
      adjustedNetProfit: adjustedNetProfit,
      zakatBaseExcludingAdjustedProfit: zakatBaseExcludingAdjustedProfit,
      zakatEligibleBase: annualZakatBase * eligibleShare,
      zakatOnBaseComponents: zakatOnBaseComponents,
      zakatOnAdjustedNetProfit: zakatOnAdjustedNetProfit,
      annualZakatAmount: annualZakatAmount,
      annualFiscalCharges: annualIncomeTaxAmount + annualZakatAmount,
      notes: [
        'Income tax and Zakat use separate bases.',
        'Income tax applies to taxable income attributable to the non-Saudi share.',
        'Zakat is allocated to the Saudi/eligible ownership share.',
        'Adjusted net profit is kept separate from the day-based Zakat component.'
      ]
    };
  }

  function calculateManual(input) {
    input = input || {};
    var corporateIncomeTaxRate = clampPct(input.corporateIncomeTaxRate);
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;
    return {
      countryCode: String(input.countryCode || '').toUpperCase(),
      mode: 'manual',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualTaxableIncome: annualTaxableIncome,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Automatic corporate-tax rules are not verified for this country yet.',
        'The local tax rate and taxable-income base must be entered manually.'
      ]
    };
  }

  function calculate(input) {
    input = input || {};
    var code = String(input.countryCode || 'SA').toUpperCase();
    return code === 'SA' ? calculateSaudi(input) : calculateManual(input);
  }

  function getProfile(code) {
    code = String(code || '').toUpperCase();
    if (code === 'SA') {
      return {
        code: 'SA',
        automatic: true,
        companyTypes: ['saudi_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 20,
        zakatSupported: true,
        zakatRateMethod: 'base components: 2.5% x fiscalYearDays / 354; adjusted net profit: 2.5%'
      };
    }
    return {
      code: code,
      automatic: false,
      companyTypes: ['local_100', 'mixed', 'foreign_100'],
      zakatSupported: false
    };
  }

  return {
    calculate: calculate,
    calculateSaudi: calculateSaudi,
    calculateManual: calculateManual,
    getProfile: getProfile,
    saudiDayBasedZakatRate: saudiDayBasedZakatRate,
    saudiCorporateIncomeTaxRate: saudiCorporateIncomeTaxRate
  };
}));
