'use strict';

const { money } = require('../accounting/ledger-report-engine');
const { envelope } = require('../shared/result-envelope');

const CURRENCY_RE = /^[A-Z]{3}$/;
const CLOSING_TYPES = new Set([
  'asset','liability','contra_asset','contra_liability'
]);
const HISTORICAL_TYPES = new Set(['equity','contra_equity']);
const PERIOD_TYPES = new Set(['revenue','expense','contra_revenue','contra_expense']);

function currency(value) {
  return String(value || '').trim().toUpperCase();
}

function positiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function nonNegative(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rateRecord(value) {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'string') {
    const rate = positiveRate(value);
    return rate === null ? null : { rate, source:null, as_of:null };
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const rate = positiveRate(value.rate);
  if (rate === null) return null;
  return {
    rate,
    source:String(value.source || '').trim() || null,
    as_of:String(value.as_of || value.date || '').trim() || null
  };
}

function accountRate(row, rates, required, scope, index) {
  const accountType = String(row?.account_type || '').trim();
  const accountCode = String(row?.account_code || '').trim();
  const path = `${scope}[${index}]`;

  if (CLOSING_TYPES.has(accountType)) {
    const record = rateRecord(rates.closing);
    if (!record) required.push('rates.closing');
    return record;
  }

  if (HISTORICAL_TYPES.has(accountType)) {
    const historical = rates.historical && typeof rates.historical === 'object'
      ? rates.historical[accountCode]
      : null;
    const record = rateRecord(row?.translation_rate || historical);
    if (!record) required.push(`rates.historical.${accountCode || path}`);
    return record;
  }

  if (PERIOD_TYPES.has(accountType)) {
    const transaction = rates.transaction && typeof rates.transaction === 'object'
      ? rates.transaction[accountCode]
      : null;
    const direct = rateRecord(row?.translation_rate || transaction);
    if (direct) return direct;

    const average = rateRecord(rates.average);
    const averageAppropriate =
      rates.average && typeof rates.average === 'object'
        ? rates.average.appropriate === true
        : false;

    if (!average || !averageAppropriate) {
      required.push(`rates.transaction.${accountCode || path}_or_appropriate_average`);
      return null;
    }
    return average;
  }

  required.push(`${path}.account_type_supported`);
  return null;
}

function translateRows(rows, rates, required, scope) {
  if (!Array.isArray(rows)) {
    required.push(scope);
    return [];
  }

  return rows.map((row, index) => {
    const debit = Number(row?.debit || 0);
    const credit = Number(row?.credit || 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      required.push(`${scope}[${index}].debit_credit_numeric`);
    }

    const record = accountRate(row, rates, required, scope, index);
    const rate = record?.rate ?? 0;

    return {
      account_code:String(row?.account_code || '').trim(),
      account_name:String(row?.account_name || '').trim(),
      account_type:String(row?.account_type || '').trim(),
      debit:money((Number.isFinite(debit) ? debit : 0) * rate),
      credit:money((Number.isFinite(credit) ? credit : 0) * rate),
      translation_rate:record?.rate ?? null,
      translation_rate_source:record?.source ?? null,
      translation_rate_as_of:record?.as_of ?? null
    };
  });
}

function addCta(rows, input = {}) {
  const debit = money(rows.reduce((sum,row)=>sum + Number(row.debit || 0),0));
  const credit = money(rows.reduce((sum,row)=>sum + Number(row.credit || 0),0));
  const difference = money(debit - credit);

  if (difference === 0) {
    return {
      rows,
      cta:{ amount:0, debit:0, credit:0 }
    };
  }

  const cta = {
    account_code:String(input.cta_account_code || 'FX-CTA').trim() || 'FX-CTA',
    account_name:String(input.cta_account_name || 'Foreign Currency Translation Reserve (OCI)').trim(),
    account_type:'equity',
    debit:difference < 0 ? money(Math.abs(difference)) : 0,
    credit:difference > 0 ? money(difference) : 0,
    translation_rate:null,
    translation_rate_source:'derived_balancing_oci',
    translation_rate_as_of:null
  };

  return {
    rows:[...rows,cta],
    cta:{
      amount:money(Math.abs(difference)),
      debit:cta.debit,
      credit:cta.credit,
      account_code:cta.account_code
    }
  };
}

function fxExposureRiskAnalysis(input = {}, required = []) {
  const exposureProvided = Object.prototype.hasOwnProperty.call(input, 'currency_exposures');
  const shockRequested = Object.prototype.hasOwnProperty.call(input, 'fx_shock_pct');

  if (!exposureProvided && !shockRequested) return null;

  const exposures = Array.isArray(input.currency_exposures)
    ? input.currency_exposures
    : [];
  const shockPct = shockRequested ? finiteNumber(input.fx_shock_pct) : null;

  if (!Array.isArray(input.currency_exposures) || !exposures.length) {
    required.push('currency_exposures_non_empty');
  }
  if (shockRequested && shockPct === null) {
    required.push('fx_shock_pct_numeric');
  }

  const rows = exposures.map((row, index) => {
    const code = currency(row?.currency);
    const asset = nonNegative(row?.asset_exposure_foreign ?? 0);
    const liability = nonNegative(row?.liability_exposure_foreign ?? 0);
    const hedge = nonNegative(row?.hedge_amount_foreign ?? 0);
    const rate = positiveRate(row?.current_rate_to_presentation);
    const path = `currency_exposures[${index}]`;

    if (!CURRENCY_RE.test(code)) required.push(`${path}.currency`);
    if (asset === null) required.push(`${path}.asset_exposure_foreign_non_negative`);
    if (liability === null) required.push(`${path}.liability_exposure_foreign_non_negative`);
    if (hedge === null) required.push(`${path}.hedge_amount_foreign_non_negative`);
    if (rate === null) required.push(`${path}.current_rate_to_presentation_positive`);

    const safeAsset = asset ?? 0;
    const safeLiability = liability ?? 0;
    const safeHedge = hedge ?? 0;
    const safeRate = rate ?? 0;
    const netForeign = safeAsset - safeLiability;
    const absoluteNetForeign = Math.abs(netForeign);

    if (safeAsset === 0 && safeLiability === 0) {
      required.push(`${path}.asset_or_liability_exposure_positive`);
    }
    if (safeHedge > absoluteNetForeign) {
      required.push(`${path}.hedge_amount_lte_absolute_net_exposure`);
    }

    const unhedgedAbsoluteForeign = Math.max(0, absoluteNetForeign - safeHedge);
    const direction = netForeign === 0 ? 0 : netForeign > 0 ? 1 : -1;
    const unhedgedNetForeign = direction * unhedgedAbsoluteForeign;
    const netPresentation = money(netForeign * safeRate);
    const absoluteNetPresentation = money(absoluteNetForeign * safeRate);
    const hedgedPresentation = money(safeHedge * safeRate);
    const unhedgedPresentation = money(unhedgedNetForeign * safeRate);
    const unhedgedAbsolutePresentation = money(unhedgedAbsoluteForeign * safeRate);
    const shockImpactPresentation =
      shockPct === null ? null : money(unhedgedNetForeign * safeRate * (shockPct / 100));

    return {
      currency:code,
      asset_exposure_foreign:safeAsset,
      liability_exposure_foreign:safeLiability,
      net_exposure_foreign:netForeign,
      hedge_amount_foreign:safeHedge,
      unhedged_net_exposure_foreign:unhedgedNetForeign,
      current_rate_to_presentation:safeRate,
      net_exposure_presentation:netPresentation,
      absolute_net_exposure_presentation:absoluteNetPresentation,
      hedged_exposure_presentation:hedgedPresentation,
      unhedged_exposure_presentation:unhedgedPresentation,
      unhedged_absolute_exposure_presentation:unhedgedAbsolutePresentation,
      hedge_coverage_pct:
        absoluteNetForeign > 0 ? (safeHedge / absoluteNetForeign) * 100 : null,
      shock_impact_presentation:shockImpactPresentation
    };
  });

  if (required.length) return null;

  const totalAbsoluteNet = rows.reduce(
    (sum,row)=>sum + row.absolute_net_exposure_presentation,
    0
  );
  const totalHedged = rows.reduce(
    (sum,row)=>sum + row.hedged_exposure_presentation,
    0
  );
  const totalUnhedgedAbsolute = rows.reduce(
    (sum,row)=>sum + row.unhedged_absolute_exposure_presentation,
    0
  );
  const totalNet = rows.reduce(
    (sum,row)=>sum + row.net_exposure_presentation,
    0
  );
  const totalShockImpact = shockPct === null
    ? null
    : money(rows.reduce(
      (sum,row)=>sum + Number(row.shock_impact_presentation || 0),
      0
    ));
  const largestUnhedged = rows.reduce(
    (best,row)=>
      !best ||
      row.unhedged_absolute_exposure_presentation >
        best.unhedged_absolute_exposure_presentation
        ? row
        : best,
    null
  );

  return {
    exposure_count:rows.length,
    fx_shock_pct:shockPct,
    net_exposure_presentation:money(totalNet),
    absolute_net_exposure_presentation:money(totalAbsoluteNet),
    hedged_exposure_presentation:money(totalHedged),
    unhedged_absolute_exposure_presentation:money(totalUnhedgedAbsolute),
    hedge_coverage_pct:
      totalAbsoluteNet > 0 ? (totalHedged / totalAbsoluteNet) * 100 : null,
    shock_impact_presentation:totalShockImpact,
    largest_unhedged_currency:largestUnhedged?.currency || null,
    largest_unhedged_exposure_presentation:
      largestUnhedged?.unhedged_absolute_exposure_presentation ?? null,
    exposures:rows
  };
}

function fxTranslationAnalysis(input = {}) {
  const required = [];
  const functionalCurrency = currency(input.functional_currency);
  const presentationCurrency = currency(input.presentation_currency);

  if (!CURRENCY_RE.test(functionalCurrency)) required.push('functional_currency');
  if (!CURRENCY_RE.test(presentationCurrency)) required.push('presentation_currency');

  if (input.hyperinflationary === true) {
    required.push('ias29_restatement_before_translation');
  }

  if (input.exchangeable === false) {
    required.push('exchangeability_resolution_before_translation');
  }

  const fxExposureRisk = fxExposureRiskAnalysis(input,required);

  const balanceRows = Array.isArray(input.balance_rows) ? input.balance_rows : [];
  const periodRows = Array.isArray(input.period_rows) ? input.period_rows : [];

  if (!Array.isArray(input.balance_rows)) required.push('balance_rows');
  if (!Array.isArray(input.period_rows)) required.push('period_rows');

  if (required.length) {
    return envelope(
      'fx_translation',
      {},
      input,
      {
        method:'ias21_deterministic_translation',
        fail_closed:true,
        rate_convention:'presentation_currency_units_per_functional_currency_unit'
      },
      required
    );
  }

  if (functionalCurrency === presentationCurrency) {
    return envelope(
      'fx_translation',
      {
        functional_currency:functionalCurrency,
        presentation_currency:presentationCurrency,
        balance_rows:balanceRows.map(row=>({...row,translation_rate:1})),
        period_rows:periodRows.map(row=>({...row,translation_rate:1})),
        cta:{ amount:0, debit:0, credit:0 },
        fx_exposure_risk:fxExposureRisk
      },
      input,
      {
        method:'same_currency_identity',
        fail_closed:true,
        rate_convention:'presentation_currency_units_per_functional_currency_unit'
      }
    );
  }

  const rates = input.rates && typeof input.rates === 'object' && !Array.isArray(input.rates)
    ? input.rates
    : {};

  const translatedBalance = translateRows(balanceRows,rates,required,'balance_rows');
  const translatedPeriod = translateRows(periodRows,rates,required,'period_rows');

  if (required.length) {
    return envelope(
      'fx_translation',
      {},
      input,
      {
        method:'ias21_deterministic_translation',
        fail_closed:true,
        rate_convention:'presentation_currency_units_per_functional_currency_unit'
      },
      required
    );
  }

  const balanced = addCta(translatedBalance,input);

  return envelope(
    'fx_translation',
    {
      functional_currency:functionalCurrency,
      presentation_currency:presentationCurrency,
      balance_rows:balanced.rows,
      period_rows:translatedPeriod,
      cta:balanced.cta,
      fx_exposure_risk:fxExposureRisk
    },
    input,
    {
      method:'ias21_deterministic_translation',
      closing_rate_policy:'assets_liabilities',
      income_expense_rate_policy:'transaction_or_appropriate_average',
      equity_rate_policy:'explicit_historical',
      translation_difference_presentation:'oci_equity_reserve',
      rate_convention:'presentation_currency_units_per_functional_currency_unit',
      exposure_rate_convention:'presentation_currency_units_per_exposure_currency_unit',
      fx_exposure_method:
        fxExposureRisk ? 'net_exposure_less_explicit_hedges_with_optional_parallel_shock' : null,
      fail_closed:true
    }
  );
}

module.exports = {
  CLOSING_TYPES,
  HISTORICAL_TYPES,
  PERIOD_TYPES,
  fxTranslationAnalysis
};
