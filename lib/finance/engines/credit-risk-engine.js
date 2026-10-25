'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function pctValue(value) {
  const n = finite(value);
  return n === null ? null : n / 100;
}

function boundedPct(value, field, required) {
  const n = finite(value);
  if (n === null) {
    required.push(field);
    return null;
  }
  if (n < 0 || n > 100) {
    required.push(`${field}_0_to_100`);
    return null;
  }
  return n;
}

function resolveEad(input, required) {
  const explicit = finite(input.ead);
  if (explicit !== null) {
    if (explicit < 0) {
      required.push('ead_non_negative');
      return null;
    }
    return {
      ead: explicit,
      method: 'explicit_ead',
      drawn_exposure: null,
      undrawn_commitment: null,
      ccf_pct: null
    };
  }

  const drawn = finite(input.drawn_exposure);
  const undrawn = finite(input.undrawn_commitment);
  const ccfPct = finite(input.ccf_pct);

  if (drawn === null) required.push('ead_or_drawn_exposure');
  if (undrawn !== null && ccfPct === null) required.push('ccf_pct_for_undrawn_commitment');
  if (drawn !== null && drawn < 0) required.push('drawn_exposure_non_negative');
  if (undrawn !== null && undrawn < 0) required.push('undrawn_commitment_non_negative');
  if (ccfPct !== null && (ccfPct < 0 || ccfPct > 100)) required.push('ccf_pct_0_to_100');

  if (required.length || drawn === null) {
    return {
      ead: null,
      method: null,
      drawn_exposure: drawn,
      undrawn_commitment: undrawn,
      ccf_pct: ccfPct
    };
  }

  const ead = drawn + (undrawn ?? 0) * ((ccfPct ?? 0) / 100);
  return {
    ead,
    method: 'drawn_plus_undrawn_times_ccf',
    drawn_exposure: drawn,
    undrawn_commitment: undrawn ?? 0,
    ccf_pct: ccfPct ?? 0
  };
}

function resolveRiskGrade(pdPct, gradeThresholds) {
  if (!Array.isArray(gradeThresholds) || gradeThresholds.length === 0) {
    return null;
  }

  const valid = gradeThresholds
    .map((row, index) => ({
      grade: String(row?.grade || '').trim(),
      max_pd_pct: finite(row?.max_pd_pct),
      index
    }))
    .filter(row => row.grade && row.max_pd_pct !== null)
    .sort((a, b) => a.max_pd_pct - b.max_pd_pct);

  if (!valid.length) return null;

  const matched = valid.find(row => pdPct <= row.max_pd_pct);
  return matched?.grade || valid[valid.length - 1].grade;
}

function creditRiskAnalysis(input = {}) {
  const required = [];

  const pdPct = boundedPct(input.pd_pct, 'pd_pct', required);
  const lgdPct = boundedPct(input.lgd_pct, 'lgd_pct', required);
  const eadResolved = resolveEad(input, required);

  const parameterSource = String(input.parameter_source || '').trim();
  if (!parameterSource) required.push('parameter_source');

  const asOfDate = String(input.as_of_date || '').trim();
  if (!asOfDate) required.push('as_of_date');

  const calibration = input.calibration && typeof input.calibration === 'object'
    ? input.calibration
    : null;

  if (parameterSource === 'model') {
    if (!calibration) {
      required.push('calibration');
    } else {
      if (!String(calibration.model_id || '').trim()) required.push('calibration.model_id');
      if (!String(calibration.model_version || '').trim()) required.push('calibration.model_version');
      if (!String(calibration.calibrated_at || '').trim()) required.push('calibration.calibrated_at');
    }
  }

  const stressPdMultiplier = finite(input.stress_pd_multiplier) ?? 1;
  const stressLgdAddonPct = finite(input.stress_lgd_addon_pct) ?? 0;

  if (stressPdMultiplier < 1) required.push('stress_pd_multiplier_gte_1');
  if (stressLgdAddonPct < 0) required.push('stress_lgd_addon_pct_non_negative');

  if (required.length) {
    return envelope('credit_risk', {}, input, {
      method: 'pd_times_lgd_times_ead',
      ead_method: eadResolved.method,
      fail_closed: true
    }, required);
  }

  const pd = pctValue(pdPct);
  const lgd = pctValue(lgdPct);
  const ead = eadResolved.ead;
  const expectedLoss = pd * lgd * ead;
  const expectedLossPctOfEad = ead > 0 ? (expectedLoss / ead) * 100 : 0;

  const stressPdPct = Math.min(100, pdPct * stressPdMultiplier);
  const stressLgdPct = Math.min(100, lgdPct + stressLgdAddonPct);
  const stressExpectedLoss = (stressPdPct / 100) * (stressLgdPct / 100) * ead;

  const collateralValue = finite(input.collateral_value);
  if (collateralValue !== null && collateralValue < 0) {
    return envelope('credit_risk', {}, input, {
      method: 'pd_times_lgd_times_ead',
      fail_closed: true
    }, ['collateral_value_non_negative']);
  }

  const collateralCoverage = collateralValue === null || ead === 0
    ? null
    : collateralValue / ead;

  const riskGrade = resolveRiskGrade(pdPct, input.grade_thresholds);

  const observedDefaultRatePct = calibration
    ? finite(calibration.observed_default_rate_pct)
    : null;
  const calibrationGapPct = observedDefaultRatePct === null
    ? null
    : pdPct - observedDefaultRatePct;

  return envelope('credit_risk', {
    pd_pct: pdPct,
    lgd_pct: lgdPct,
    ead,
    expected_loss: expectedLoss,
    expected_loss_pct_of_ead: expectedLossPctOfEad,
    risk_grade: riskGrade,
    collateral_value: collateralValue,
    collateral_coverage: collateralCoverage,
    stress_pd_pct: stressPdPct,
    stress_lgd_pct: stressLgdPct,
    stress_expected_loss: stressExpectedLoss,
    stress_expected_loss_change: stressExpectedLoss - expectedLoss,
    calibration_gap_pct: calibrationGapPct
  }, input, {
    method: 'pd_times_lgd_times_ead',
    ead_method: eadResolved.method,
    parameter_source: parameterSource,
    as_of_date: asOfDate,
    calibration: calibration ? {
      model_id: calibration.model_id || null,
      model_version: calibration.model_version || null,
      calibrated_at: calibration.calibrated_at || null,
      sample_size: finite(calibration.sample_size),
      observed_default_rate_pct: observedDefaultRatePct
    } : null,
    grade_policy_supplied: Array.isArray(input.grade_thresholds) && input.grade_thresholds.length > 0,
    fail_closed: true
  });
}

module.exports = { creditRiskAnalysis };
