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

function concentrationRows(exposures, keyName, totalEad) {
  const totals = new Map();
  for (const exposure of exposures) {
    const key = String(exposure[keyName] || 'UNSPECIFIED').trim() || 'UNSPECIFIED';
    totals.set(key, (totals.get(key) || 0) + exposure.ead);
  }

  return [...totals.entries()]
    .map(([key, ead]) => ({
      key,
      ead,
      concentration_pct: totalEad > 0 ? (ead / totalEad) * 100 : 0
    }))
    .sort((a, b) => b.ead - a.ead);
}

function portfolioCreditRiskAnalysis(input = {}) {
  const required = [];
  const portfolio = Array.isArray(input.portfolio_exposures)
    ? input.portfolio_exposures
    : [];

  if (!portfolio.length) required.push('portfolio_exposures');

  const parameterSourceDefault = String(input.parameter_source || '').trim();
  const asOfDate = String(input.as_of_date || '').trim();
  if (!asOfDate) required.push('as_of_date');

  const stressPdMultiplier = finite(input.stress_pd_multiplier) ?? 1;
  const stressLgdAddonPct = finite(input.stress_lgd_addon_pct) ?? 0;
  if (stressPdMultiplier < 1) required.push('stress_pd_multiplier_gte_1');
  if (stressLgdAddonPct < 0) required.push('stress_lgd_addon_pct_non_negative');

  const normalized = portfolio.map((row, index) => {
    const scoped = [];
    const obligorId = String(row?.obligor_id || row?.counterparty_id || '').trim();
    if (!obligorId) scoped.push(`portfolio_exposures[${index}].obligor_id`);

    const pdPct = boundedPct(
      row?.pd_pct,
      `portfolio_exposures[${index}].pd_pct`,
      scoped
    );
    const lgdPct = boundedPct(
      row?.lgd_pct,
      `portfolio_exposures[${index}].lgd_pct`,
      scoped
    );

    const eadInput = {
      ead: row?.ead,
      drawn_exposure: row?.drawn_exposure,
      undrawn_commitment: row?.undrawn_commitment,
      ccf_pct: row?.ccf_pct
    };
    const eadErrors = [];
    const eadResolved = resolveEad(eadInput, eadErrors);
    for (const error of eadErrors) {
      scoped.push(`portfolio_exposures[${index}].${error}`);
    }

    const parameterSource = String(
      row?.parameter_source || parameterSourceDefault
    ).trim();
    if (!parameterSource) {
      scoped.push(`portfolio_exposures[${index}].parameter_source`);
    }

    const calibration =
      row?.calibration && typeof row.calibration === 'object'
        ? row.calibration
        : null;

    if (parameterSource === 'model') {
      if (!calibration) {
        scoped.push(`portfolio_exposures[${index}].calibration`);
      } else {
        if (!String(calibration.model_id || '').trim()) {
          scoped.push(`portfolio_exposures[${index}].calibration.model_id`);
        }
        if (!String(calibration.model_version || '').trim()) {
          scoped.push(`portfolio_exposures[${index}].calibration.model_version`);
        }
        if (!String(calibration.calibrated_at || '').trim()) {
          scoped.push(`portfolio_exposures[${index}].calibration.calibrated_at`);
        }
      }
    }

    required.push(...scoped);

    if (scoped.length || pdPct === null || lgdPct === null || eadResolved.ead === null) {
      return null;
    }

    const ead = eadResolved.ead;
    const expectedLoss = pctValue(pdPct) * pctValue(lgdPct) * ead;
    const stressPdPct = Math.min(100, pdPct * stressPdMultiplier);
    const stressLgdPct = Math.min(100, lgdPct + stressLgdAddonPct);
    const stressExpectedLoss =
      (stressPdPct / 100) * (stressLgdPct / 100) * ead;

    return {
      exposure_id: String(row?.exposure_id || row?.id || `exposure_${index + 1}`),
      obligor_id: obligorId,
      sector: String(row?.sector || 'UNSPECIFIED').trim() || 'UNSPECIFIED',
      geography: String(row?.geography || 'UNSPECIFIED').trim() || 'UNSPECIFIED',
      pd_pct: pdPct,
      lgd_pct: lgdPct,
      ead,
      expected_loss: expectedLoss,
      stress_expected_loss: stressExpectedLoss,
      risk_grade: resolveRiskGrade(pdPct, input.grade_thresholds),
      parameter_source: parameterSource,
      ead_method: eadResolved.method
    };
  }).filter(Boolean);

  const limits =
    input.portfolio_limits &&
    typeof input.portfolio_limits === 'object' &&
    !Array.isArray(input.portfolio_limits)
      ? input.portfolio_limits
      : {};

  const maxObligorConcentration = finite(limits.max_obligor_concentration_pct);
  if (
    maxObligorConcentration !== null &&
    (maxObligorConcentration < 0 || maxObligorConcentration > 100)
  ) {
    required.push('portfolio_limits.max_obligor_concentration_pct_0_to_100');
  }

  const maxSectorConcentration = finite(limits.max_sector_concentration_pct);
  if (
    maxSectorConcentration !== null &&
    (maxSectorConcentration < 0 || maxSectorConcentration > 100)
  ) {
    required.push('portfolio_limits.max_sector_concentration_pct_0_to_100');
  }

  if (required.length) {
    return envelope(
      'credit_risk',
      {},
      input,
      {
        method: 'portfolio_pd_lgd_ead_concentration',
        fail_closed: true
      },
      required
    );
  }

  const totalEad = normalized.reduce((sum, row) => sum + row.ead, 0);
  const totalExpectedLoss = normalized.reduce(
    (sum, row) => sum + row.expected_loss,
    0
  );
  const totalStressExpectedLoss = normalized.reduce(
    (sum, row) => sum + row.stress_expected_loss,
    0
  );

  const weightedAveragePdPct = totalEad > 0
    ? normalized.reduce((sum, row) => sum + row.pd_pct * row.ead, 0) / totalEad
    : 0;
  const weightedAverageLgdPct = totalEad > 0
    ? normalized.reduce((sum, row) => sum + row.lgd_pct * row.ead, 0) / totalEad
    : 0;

  const obligorConcentrations = concentrationRows(
    normalized,
    'obligor_id',
    totalEad
  );
  const sectorConcentrations = concentrationRows(
    normalized,
    'sector',
    totalEad
  );
  const geographyConcentrations = concentrationRows(
    normalized,
    'geography',
    totalEad
  );

  const obligorHhi = obligorConcentrations.reduce(
    (sum, row) => sum + Math.pow(row.concentration_pct / 100, 2),
    0
  );

  const limitChecks = [];
  const topObligor = obligorConcentrations[0] || null;
  const topSector = sectorConcentrations[0] || null;

  if (maxObligorConcentration !== null) {
    const actual = topObligor?.concentration_pct ?? 0;
    limitChecks.push({
      limit: 'max_obligor_concentration_pct',
      actual,
      threshold: maxObligorConcentration,
      compliant: actual <= maxObligorConcentration,
      headroom: maxObligorConcentration - actual
    });
  }

  if (maxSectorConcentration !== null) {
    const actual = topSector?.concentration_pct ?? 0;
    limitChecks.push({
      limit: 'max_sector_concentration_pct',
      actual,
      threshold: maxSectorConcentration,
      compliant: actual <= maxSectorConcentration,
      headroom: maxSectorConcentration - actual
    });
  }

  const breaches = limitChecks.filter(row => !row.compliant);

  return envelope(
    'credit_risk',
    {
      portfolio_exposure_count: normalized.length,
      total_ead: totalEad,
      total_expected_loss: totalExpectedLoss,
      expected_loss_pct_of_ead:
        totalEad > 0 ? (totalExpectedLoss / totalEad) * 100 : 0,
      stress_expected_loss: totalStressExpectedLoss,
      stress_expected_loss_change:
        totalStressExpectedLoss - totalExpectedLoss,
      weighted_average_pd_pct: weightedAveragePdPct,
      weighted_average_lgd_pct: weightedAverageLgdPct,
      obligor_concentration_hhi: obligorHhi,
      top_obligor: topObligor,
      top_sector: topSector,
      obligor_concentrations: obligorConcentrations,
      sector_concentrations: sectorConcentrations,
      geography_concentrations: geographyConcentrations,
      limit_breach_count: breaches.length,
      limits_status: breaches.length ? 'breach' : 'compliant',
      limit_checks: limitChecks,
      exposures: normalized
    },
    input,
    {
      method: 'portfolio_pd_lgd_ead_concentration',
      as_of_date: asOfDate,
      parameter_source_default: parameterSourceDefault || null,
      fail_closed: true
    }
  );
}

function creditRiskAnalysis(input = {}) {
  if (
    Array.isArray(input.portfolio_exposures) &&
    input.portfolio_exposures.length > 0
  ) {
    return portfolioCreditRiskAnalysis(input);
  }

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
