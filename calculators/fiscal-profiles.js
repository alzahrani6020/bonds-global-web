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


  function calculateUae(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var threshold = 375000;
    var taxableAboveThreshold = Math.max(0, annualTaxableIncome - threshold);
    var annualIncomeTaxAmount = taxableAboveThreshold * 0.09;

    return {
      countryCode: 'AE',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      corporateIncomeTaxRate: 9,
      zeroRateThreshold: threshold,
      taxableIncomeAtZeroRate: Math.min(annualTaxableIncome, threshold),
      taxableIncomeAtStandardRate: taxableAboveThreshold,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'UAE standard corporate tax: 0% up to AED 375,000 of taxable income and 9% above the threshold.',
        'Qualifying Free Zone Person rules are not modeled automatically in this calculator.',
        'VAT remains separate from corporate income tax.'
      ]
    };
  }

  function calculateQatar(input) {
    input = input || {};
    var companyType = input.companyType || 'local_100';
    var foreignPct;
    if (companyType === 'local_100') foreignPct = 0;
    else if (companyType === 'foreign_100') foreignPct = 100;
    else foreignPct = clampPct(input.foreignOwnershipPct);

    var annualTaxableIncome = money(input.annualTaxableIncome);
    var taxableForeignShare = annualTaxableIncome * foreignPct / 100;
    var annualIncomeTaxAmount = taxableForeignShare * 0.10;

    return {
      countryCode: 'QA',
      mode: 'automatic',
      companyType: companyType,
      localOwnershipPct: 100 - foreignPct,
      foreignOwnershipPct: foreignPct,
      annualTaxableIncome: annualTaxableIncome,
      taxableForeignShare: taxableForeignShare,
      corporateIncomeTaxRate: 10,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Qatar standard income tax is 10% of taxable income.',
        'For resident legal persons, the model exempts the profit share attributable to Qatari ownership and taxes the non-Qatari share.',
        'Oil, gas, petrochemical and agreement-specific cases may be subject to special rates and are not reduced to a single automatic rate here.'
      ]
    };
  }

  function calculateOman(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var activityType = input.activityType || 'standard';
    var smallEnterprise = input.smallEnterprise === true;
    var corporateIncomeTaxRate = 15;

    if (activityType === 'oil_hydrocarbon' || activityType === 'natural_gas') {
      corporateIncomeTaxRate = 55;
    } else if (smallEnterprise) {
      corporateIncomeTaxRate = 3;
    }

    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;
    return {
      countryCode: 'OM',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      activityType: activityType,
      smallEnterprise: smallEnterprise,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Oman standard income tax is 15% of net taxable income.',
        'The 3% small-enterprise rate is applied only when the user explicitly selects the small-enterprise profile; statutory eligibility conditions must be satisfied.',
        'Oil and gas exploration is modeled at 55%, subject to the applicable concession framework.',
        'VAT remains separate from income tax.'
      ]
    };
  }

  function calculateBahrain(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var activityType = input.activityType || 'standard';
    var corporateIncomeTaxRate = activityType === 'oil_hydrocarbon' || activityType === 'natural_gas' ? 46 : 0;
    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;

    return {
      countryCode: 'BH',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      activityType: activityType,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Bahrain generally applies 0% corporate income tax outside the oil and gas sector.',
        'Oil and gas sector profits are modeled at 46%.',
        'Bahrain Pillar Two / DMTT obligations for qualifying multinational groups are not calculated from this taxable-income input.',
        'VAT remains separate from corporate income tax.'
      ]
    };
  }

  function calculateKuwait(input) {
    input = input || {};
    var companyType = input.companyType || 'local_100';
    var foreignPct;
    if (companyType === 'local_100') foreignPct = 0;
    else if (companyType === 'foreign_100') foreignPct = 100;
    else foreignPct = clampPct(input.foreignOwnershipPct);

    var annualTaxableIncome = money(input.annualTaxableIncome);
    var taxableForeignShare = annualTaxableIncome * foreignPct / 100;
    var annualIncomeTaxAmount = taxableForeignShare * 0.15;

    return {
      countryCode: 'KW',
      mode: 'automatic',
      companyType: companyType,
      localOwnershipPct: 100 - foreignPct,
      foreignOwnershipPct: foreignPct,
      annualTaxableIncome: annualTaxableIncome,
      taxableForeignShare: taxableForeignShare,
      corporateIncomeTaxRate: 15,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Kuwait income tax is modeled at 15% on taxable income attributable to the foreign corporate share.',
        'This simplified profile does not automatically calculate Kuwait Zakat, National Labour Support Tax, or other local-company levies.',
        'Kuwait DMTT for qualifying multinational groups applies under separate Pillar Two rules from fiscal years beginning on or after 1 January 2025 and is not calculated from this taxable-income input.',
        'No VAT rate is asserted by this fiscal profile.'
      ]
    };
  }

  function calculateEgypt(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var corporateIncomeTaxRate = 22.5;
    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;

    return {
      countryCode: 'EG',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Egypt standard corporate income tax for legal persons is modeled at 22.5% of taxable income.',
        'The simplified turnover-based regime available to qualifying businesses with annual turnover not exceeding EGP 20 million is not modeled because it uses turnover rather than this taxable-income input.',
        'Sector-specific and special-regime cases require separate treatment and are not reduced to this standard profile.',
        'VAT remains separate from corporate income tax.'
      ]
    };
  }

  function calculateTurkey(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var activityType = input.activityType || 'standard';
    var corporateIncomeTaxRate = activityType === 'financial_special' ? 30 : 25;
    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;

    return {
      countryCode: 'TR',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      activityType: activityType,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Türkiye 2026 standard corporate income tax is modeled at 25%.',
        'The 30% profile is limited to specified banks, financial/leasing/payment/e-money/FX/asset-management/capital-market/insurance/reinsurance/pension institutions and covered PPP/BOT project companies.',
        'Other statutory reduced rates, including qualifying export, manufacturing and eligible first-public-offering cases, are not automatically modeled in this calculator.',
        'VAT remains separate from corporate income tax.'
      ]
    };
  }


  function calculateJordan(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var activityType = input.activityType || 'standard';
    var corporateIncomeTaxRate = 20;

    if (activityType === 'industrial') corporateIncomeTaxRate = 14;
    else if (activityType === 'regulated_special') corporateIncomeTaxRate = 24;
    else if (activityType === 'bank') corporateIncomeTaxRate = 35;

    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;
    return {
      countryCode: 'JO',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      activityType: activityType,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Jordan income tax is modeled at 20% for standard legal persons, 14% for the industrial sector, 24% for specified regulated sectors, and 35% for banks.',
        'The separate National Contribution is not calculated automatically by this simplified taxable-income profile.',
        'Development-zone, Aqaba, incentive and other special regimes require separate treatment.',
        'General sales tax remains separate from income tax.'
      ]
    };
  }

  function calculateMorocco(input) {
    input = input || {};
    var annualTaxableIncome = money(input.annualTaxableIncome);
    var activityType = input.activityType || 'standard';
    var threshold = 100000000;
    var corporateIncomeTaxRate;

    if (activityType === 'financial_special') corporateIncomeTaxRate = 40;
    else corporateIncomeTaxRate = annualTaxableIncome >= threshold ? 35 : 20;

    var annualIncomeTaxAmount = annualTaxableIncome * corporateIncomeTaxRate / 100;
    return {
      countryCode: 'MA',
      mode: 'automatic',
      companyType: input.companyType || 'local_100',
      foreignOwnershipPct: clampPct(input.foreignOwnershipPct),
      annualTaxableIncome: annualTaxableIncome,
      activityType: activityType,
      corporateIncomeTaxRate: corporateIncomeTaxRate,
      highProfitThresholdMad: threshold,
      annualIncomeTaxAmount: annualIncomeTaxAmount,
      annualZakatAmount: 0,
      annualFiscalCharges: annualIncomeTaxAmount,
      notes: [
        'Morocco 2026 corporate tax is modeled at 20% below MAD 100 million of net taxable profit and 35% at or above MAD 100 million.',
        'Credit institutions and assimilated bodies, Bank Al-Maghrib, CDG, and insurance/reinsurance companies are modeled at 40%.',
        'The statutory continuity rule affecting a return from the 35% bracket to 20%, and other special regimes, are not inferred automatically.',
        'VAT remains separate from corporate income tax.'
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
    if (code === 'SA') return calculateSaudi(input);
    if (code === 'AE') return calculateUae(input);
    if (code === 'QA') return calculateQatar(input);
    if (code === 'OM') return calculateOman(input);
    if (code === 'BH') return calculateBahrain(input);
    if (code === 'KW') return calculateKuwait(input);
    if (code === 'EG') return calculateEgypt(input);
    if (code === 'TR') return calculateTurkey(input);
    if (code === 'JO') return calculateJordan(input);
    if (code === 'MA') return calculateMorocco(input);
    return calculateManual(input);
  }

  function getProfile(code) {
    code = String(code || '').toUpperCase();
    if (code === 'SA') {
      return {
        code: 'SA',
        automatic: true,
        companyTypes: ['saudi_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 20,
        standardVatRate: 15,
        ownershipAffectsTax: true,
        zakatSupported: true,
        zakatRateMethod: 'base components: 2.5% x fiscalYearDays / 354; adjusted net profit: 2.5%'
      };
    }
    if (code === 'AE') {
      return {
        code: 'AE',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 9,
        zeroRateThreshold: 375000,
        standardVatRate: 5,
        ownershipAffectsTax: false,
        zakatSupported: false
      };
    }
    if (code === 'QA') {
      return {
        code: 'QA',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 10,
        standardVatRate: null,
        ownershipAffectsTax: true,
        zakatSupported: false
      };
    }
    if (code === 'OM') {
      return {
        code: 'OM',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 15,
        smallEnterpriseCorporateIncomeTaxRate: 3,
        oilGasCorporateIncomeTaxRate: 55,
        standardVatRate: 5,
        ownershipAffectsTax: false,
        zakatSupported: false
      };
    }
    if (code === 'BH') {
      return {
        code: 'BH',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 0,
        oilGasCorporateIncomeTaxRate: 46,
        standardVatRate: 10,
        ownershipAffectsTax: false,
        zakatSupported: false,
        dmttModeled: false
      };
    }
    if (code === 'KW') {
      return {
        code: 'KW',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 15,
        standardVatRate: null,
        ownershipAffectsTax: true,
        zakatSupported: false,
        dmttModeled: false
      };
    }
    if (code === 'EG') {
      return {
        code: 'EG',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 22.5,
        standardVatRate: 14,
        ownershipAffectsTax: false,
        zakatSupported: false,
        simplifiedTurnoverRegimeModeled: false
      };
    }
    if (code === 'TR') {
      return {
        code: 'TR',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 25,
        specialCorporateIncomeTaxRate: 30,
        standardVatRate: 20,
        ownershipAffectsTax: false,
        zakatSupported: false,
        reducedRateProfilesModeled: false
      };
    }

    if (code === 'JO') {
      return {
        code: 'JO',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 20,
        industrialCorporateIncomeTaxRate: 14,
        regulatedCorporateIncomeTaxRate: 24,
        bankCorporateIncomeTaxRate: 35,
        standardVatRate: 16,
        ownershipAffectsTax: false,
        zakatSupported: false,
        nationalContributionModeled: false
      };
    }
    if (code === 'MA') {
      return {
        code: 'MA',
        automatic: true,
        companyTypes: ['local_100', 'mixed', 'foreign_100'],
        standardCorporateIncomeTaxRate: 20,
        highProfitCorporateIncomeTaxRate: 35,
        highProfitThresholdMad: 100000000,
        financialCorporateIncomeTaxRate: 40,
        standardVatRate: 20,
        ownershipAffectsTax: false,
        zakatSupported: false,
        continuityRuleModeled: false
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
    calculateUae: calculateUae,
    calculateQatar: calculateQatar,
    calculateOman: calculateOman,
    calculateBahrain: calculateBahrain,
    calculateKuwait: calculateKuwait,
    calculateEgypt: calculateEgypt,
    calculateTurkey: calculateTurkey,
    calculateJordan: calculateJordan,
    calculateMorocco: calculateMorocco,
    calculateManual: calculateManual,
    getProfile: getProfile,
    saudiDayBasedZakatRate: saudiDayBasedZakatRate,
    saudiCorporateIncomeTaxRate: saudiCorporateIncomeTaxRate
  };
}));
