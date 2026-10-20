/**
 * Bonds Global — Fiscal Profiles
 *
 * Purpose:
 * - Keep indirect tax (VAT/GST), corporate income tax, and Zakat separate.
 * - Provide a country-specific fiscal layer without hard-coding one global tax rule.
 * - Saudi Arabia is the first verified automatic profile.
 *
 * IMPORTANT:
 * This calculator is an estimation aid, not a tax return engine.
 * Taxable income and Zakat base remain explicit accounting inputs.
 */
(function (global) {
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

  function saudiEffectiveZakatRate(financialYearDays) {
    return 2.5 * normalizeDays(financialYearDays) / 354;
  }

  function resolveSaudiOwnership(companyType, foreignOwnershipPct) {
    if (companyType === 'saudi_100') {
      return { saudiPct: 100, foreignPct: 0 };
    }
    if (companyType === 'foreign_100') {
      return { saudiPct: 0, foreignPct: 100 };
    }
    var foreignPct = clampPct(foreignOwnershipPct);
    return { saudiPct: 100 - foreignPct, foreignPct: foreignPct };
  }

  function calculateSaudi(input) {
    input = input || {};
    var ownership = resolveSaudiOwnership(input.companyType || 'saudi_100', input.foreignOwnershipPct);
    var financialYearDays = normalizeDays(input.financialYearDays);
    var effectiveZakatRate = saudiEffectiveZakatRate(financialYearDays);
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var annualZakatBase = money(input.annualZakatBase);

    // Standard Saudi income-tax rate for the non-Saudi share of a resident capital company.
    // Sector-specific regimes (for example certain oil/hydrocarbon activities) are intentionally excluded.
    var corporateIncomeTaxRate = 20;
    var foreignTaxableIncome = annualTaxableIncome * ownership.foreignPct / 100;
    var annualIncomeTaxAmount = foreignTaxableIncome * corporateIncomeTaxRate / 100;

    var zakatEligibleBase = annualZakatBase * ownership.saudiPct / 100;
    var annualZakatAmount = zakatEligibleBase * effectiveZakatRate / 100;

    return {
      countryCode: 'SA',
      mode: 'automatic',
      companyType: input.companyType || 'saudi_100',
      saudiOwnershipPct: ownership.saudiPct,
      foreignOwnershipPct: ownership.foreignPct,
      financialYearDays: financialYearDays,
      effectiveZakatRate: effectiveZakatRate,
      annualTaxableIncome: annualTaxableIncome,
      foreignTaxableIncome: foreignTaxableIncome,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatBase: annualZakatBase,
      zakatEligibleBase: zakatEligibleBase,
      annualZakatAmount: annualZakatAmount,
      annualFiscalCharges: annualIncomeTaxAmount + annualZakatAmount,
      notes: [
        'Income tax and Zakat use separate bases.',
        'Saudi/GCC-eligible ownership is modeled for Zakat; non-Saudi ownership is modeled for income tax.',
        'Taxable income and Zakat base must be supplied from the accounting/tax model.'
      ]
    };
  }

  function calculateManual(input) {
    input = input || {};
    var corporateIncomeTaxRate = clampPct(input.corporateIncomeTaxRate);
    var annualTaxableIncome = money(input.annualTaxableIncome);
    return {
      countryCode: String(input.countryCode || '').toUpperCase(),
      mode: 'manual',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualTaxableIncome: annualTaxableIncome,
      annualIncomeTaxAmount: annualTaxableIncome * corporateIncomeTaxRate / 100,
      annualZakatAmount: 0,
      annualFiscalCharges: annualTaxableIncome * corporateIncomeTaxRate / 100,
      notes: [
        'No automatic country income-tax profile is verified for this country yet.',
        'Use the current local corporate-tax rate and taxable-income base from the applicable jurisdiction.'
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
        corporateIncomeTaxRate: 20,
        zakatSupported: true,
        zakatRateMethod: '2.5% x financialYearDays / 354'
      };
    }
    return {
      code: code,
      automatic: false,
      companyTypes: ['local_100', 'mixed', 'foreign_100'],
      zakatSupported: false
    };
  }

  global.BondsFiscal = {
    calculate: calculate,
    calculateSaudi: calculateSaudi,
    calculateManual: calculateManual,
    getProfile: getProfile,
    saudiEffectiveZakatRate: saudiEffectiveZakatRate
  };
})(window);
