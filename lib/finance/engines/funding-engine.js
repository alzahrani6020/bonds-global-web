'use strict';

const { finite, clamp, safeDiv, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function fundingReadiness(input = {}) {
  const ebitda = finite(input.ebitda);
  const annualDebtService = finite(input.annual_debt_service);
  const currentAssets = finite(input.current_assets);
  const currentLiabilities = finite(input.current_liabilities);
  const debt = finite(input.total_debt);
  const equity = finite(input.equity);
  const operatingCashFlow = finite(input.operating_cash_flow);
  const requestedAmount = finite(input.requested_amount);
  const capacityRequested = Object.prototype.hasOwnProperty.call(input, 'minimum_dscr');
  const minimumDscr = finite(input.minimum_dscr);
  const loanSizingRequested =
    Object.prototype.hasOwnProperty.call(input, 'borrowing_annual_rate_pct') ||
    Object.prototype.hasOwnProperty.call(input, 'borrowing_term_years') ||
    Object.prototype.hasOwnProperty.call(input, 'borrowing_payments_per_year');
  const borrowingAnnualRatePct = finite(input.borrowing_annual_rate_pct);
  const borrowingTermYears = finite(input.borrowing_term_years);
  const borrowingPaymentsPerYear = finite(input.borrowing_payments_per_year);
  const collateralRequested =
    Object.prototype.hasOwnProperty.call(input, 'collateral_value') ||
    Object.prototype.hasOwnProperty.call(input, 'maximum_ltv_pct') ||
    Object.prototype.hasOwnProperty.call(input, 'existing_secured_debt');
  const collateralValue = finite(input.collateral_value);
  const maximumLtvPct = finite(input.maximum_ltv_pct);
  const existingSecuredDebt = finite(input.existing_secured_debt);
  const leverageCapacityRequested =
    Object.prototype.hasOwnProperty.call(input, 'cash_and_equivalents') ||
    Object.prototype.hasOwnProperty.call(input, 'maximum_net_leverage');
  const cashAndEquivalents = finite(input.cash_and_equivalents);
  const maximumNetLeverage = finite(input.maximum_net_leverage);
  const interestCoverageRequested =
    Object.prototype.hasOwnProperty.call(input, 'annual_interest_expense') ||
    Object.prototype.hasOwnProperty.call(input, 'minimum_interest_coverage') ||
    Object.prototype.hasOwnProperty.call(input, 'interest_coverage_incremental_rate_pct');
  const annualInterestExpense = finite(input.annual_interest_expense);
  const minimumInterestCoverage = finite(input.minimum_interest_coverage);
  const interestCoverageIncrementalRatePct =
    finite(input.interest_coverage_incremental_rate_pct);
  const debtYieldRequested =
    Object.prototype.hasOwnProperty.call(input, 'net_operating_income') ||
    Object.prototype.hasOwnProperty.call(input, 'debt_yield_debt_balance') ||
    Object.prototype.hasOwnProperty.call(input, 'minimum_debt_yield_pct');
  const netOperatingIncome = finite(input.net_operating_income);
  const debtYieldDebtBalance = finite(input.debt_yield_debt_balance);
  const minimumDebtYieldPct = finite(input.minimum_debt_yield_pct);

  const dscr = safeDiv(operatingCashFlow ?? ebitda, annualDebtService);
  const currentRatio = safeDiv(currentAssets, currentLiabilities);
  const leverage = safeDiv(debt, equity);
  const amountToCashFlow = safeDiv(requestedAmount, operatingCashFlow ?? ebitda);

  const components = [];
  if (dscr !== null) components.push({ key: 'dscr', weight: 0.40, score: clamp((dscr / 1.5) * 100, 0, 100) });
  if (currentRatio !== null) components.push({ key: 'liquidity', weight: 0.25, score: clamp((currentRatio / 1.5) * 100, 0, 100) });
  if (leverage !== null) components.push({ key: 'leverage', weight: 0.25, score: clamp(100 - leverage * 25, 0, 100) });
  if (amountToCashFlow !== null) components.push({ key: 'requested_amount', weight: 0.10, score: clamp(100 - amountToCashFlow * 12, 0, 100) });

  const totalWeight = components.reduce((s, row) => s + row.weight, 0);
  const score = totalWeight
    ? Math.round(components.reduce((s, row) => s + row.score * row.weight, 0) / totalWeight)
    : null;

  const cashFlowBasis = operatingCashFlow ?? ebitda;
  const debtServiceCapacity =
    capacityRequested && minimumDscr !== null && minimumDscr > 0 && cashFlowBasis !== null && annualDebtService !== null
      ? (() => {
        const maximumAnnualDebtService = cashFlowBasis / minimumDscr;
        const signedHeadroom = maximumAnnualDebtService - annualDebtService;
        return {
          minimum_dscr: minimumDscr,
          cash_flow_basis: cashFlowBasis,
          current_annual_debt_service: annualDebtService,
          maximum_annual_debt_service: maximumAnnualDebtService,
          annual_debt_service_headroom: Math.max(0, signedHeadroom),
          annual_debt_service_excess: Math.max(0, -signedHeadroom),
          status: signedHeadroom >= 0 ? 'capacity_available' : 'capacity_exceeded'
        };
      })()
      : null;

  const loanSizing =
    loanSizingRequested &&
    debtServiceCapacity &&
    minimumDscr !== null &&
    minimumDscr > 0 &&
    borrowingAnnualRatePct !== null &&
    borrowingAnnualRatePct >= 0 &&
    borrowingTermYears !== null &&
    borrowingTermYears > 0 &&
    borrowingPaymentsPerYear !== null &&
    Number.isInteger(borrowingPaymentsPerYear) &&
    borrowingPaymentsPerYear > 0
      ? (() => {
        const annualHeadroom = debtServiceCapacity.annual_debt_service_headroom;
        const periodicPaymentCapacity = annualHeadroom / borrowingPaymentsPerYear;
        const periodicRate = (borrowingAnnualRatePct / 100) / borrowingPaymentsPerYear;
        const paymentCount = borrowingTermYears * borrowingPaymentsPerYear;
        const maximumAdditionalDebt =
          periodicRate === 0
            ? periodicPaymentCapacity * paymentCount
            : periodicPaymentCapacity *
              (1 - Math.pow(1 + periodicRate, -paymentCount)) /
              periodicRate;

        return {
          annual_rate_pct: borrowingAnnualRatePct,
          term_years: borrowingTermYears,
          payments_per_year: borrowingPaymentsPerYear,
          payment_count: paymentCount,
          annual_debt_service_headroom: annualHeadroom,
          periodic_payment_capacity: periodicPaymentCapacity,
          maximum_additional_debt: maximumAdditionalDebt,
          requested_amount: requestedAmount,
          requested_amount_headroom:
            requestedAmount === null ? null : maximumAdditionalDebt - requestedAmount,
          requested_amount_status:
            requestedAmount === null
              ? null
              : requestedAmount <= maximumAdditionalDebt
                ? 'within_capacity'
                : 'exceeds_capacity'
        };
      })()
      : null;

  const collateralCapacity =
    collateralRequested &&
    collateralValue !== null &&
    collateralValue >= 0 &&
    maximumLtvPct !== null &&
    maximumLtvPct >= 0 &&
    maximumLtvPct <= 100 &&
    existingSecuredDebt !== null &&
    existingSecuredDebt >= 0
      ? (() => {
        const maximumSecuredDebt = collateralValue * (maximumLtvPct / 100);
        const signedHeadroom = maximumSecuredDebt - existingSecuredDebt;
        return {
          collateral_value: collateralValue,
          maximum_ltv_pct: maximumLtvPct,
          existing_secured_debt: existingSecuredDebt,
          maximum_secured_debt: maximumSecuredDebt,
          collateral_headroom: Math.max(0, signedHeadroom),
          collateral_excess: Math.max(0, -signedHeadroom),
          current_ltv_pct:
            collateralValue > 0 ? (existingSecuredDebt / collateralValue) * 100 : null,
          status: signedHeadroom >= 0 ? 'collateral_capacity_available' : 'collateral_capacity_exceeded'
        };
      })()
      : null;

  const leverageCapacity =
    leverageCapacityRequested &&
    debt !== null &&
    debt >= 0 &&
    cashAndEquivalents !== null &&
    cashAndEquivalents >= 0 &&
    ebitda !== null &&
    ebitda > 0 &&
    maximumNetLeverage !== null &&
    maximumNetLeverage >= 0
      ? (() => {
        const netDebt = debt - cashAndEquivalents;
        const netDebtToEbitda = netDebt / ebitda;
        const maximumNetDebt = ebitda * maximumNetLeverage;
        const maximumTotalDebt = maximumNetDebt + cashAndEquivalents;
        const signedHeadroom = maximumTotalDebt - debt;

        return {
          total_debt: debt,
          cash_and_equivalents: cashAndEquivalents,
          net_debt: netDebt,
          ebitda,
          net_debt_to_ebitda: netDebtToEbitda,
          maximum_net_leverage: maximumNetLeverage,
          maximum_net_debt: maximumNetDebt,
          maximum_total_debt: maximumTotalDebt,
          leverage_headroom: Math.max(0, signedHeadroom),
          leverage_excess: Math.max(0, -signedHeadroom),
          status: signedHeadroom >= 0 ? 'leverage_capacity_available' : 'leverage_capacity_exceeded'
        };
      })()
      : null;

  const interestCoverageCapacity =
    interestCoverageRequested &&
    ebitda !== null &&
    ebitda > 0 &&
    annualInterestExpense !== null &&
    annualInterestExpense >= 0 &&
    minimumInterestCoverage !== null &&
    minimumInterestCoverage > 0 &&
    (
      interestCoverageIncrementalRatePct === null ||
      interestCoverageIncrementalRatePct >= 0
    )
      ? (() => {
        const currentInterestCoverage =
          annualInterestExpense > 0 ? ebitda / annualInterestExpense : null;
        const maximumAnnualInterest = ebitda / minimumInterestCoverage;
        const signedInterestHeadroom = maximumAnnualInterest - annualInterestExpense;
        const annualInterestHeadroom = Math.max(0, signedInterestHeadroom);
        const annualInterestExcess = Math.max(0, -signedInterestHeadroom);
        const incrementalDebtLimit =
          interestCoverageIncrementalRatePct !== null &&
          interestCoverageIncrementalRatePct > 0
            ? annualInterestHeadroom / (interestCoverageIncrementalRatePct / 100)
            : null;

        return {
          ebitda,
          annual_interest_expense: annualInterestExpense,
          interest_coverage_ratio: currentInterestCoverage,
          minimum_interest_coverage: minimumInterestCoverage,
          maximum_annual_interest: maximumAnnualInterest,
          annual_interest_headroom: annualInterestHeadroom,
          annual_interest_excess: annualInterestExcess,
          incremental_rate_pct: interestCoverageIncrementalRatePct,
          maximum_additional_debt_from_interest:
            incrementalDebtLimit,
          status:
            signedInterestHeadroom >= 0
              ? 'interest_coverage_capacity_available'
              : 'interest_coverage_capacity_exceeded'
        };
      })()
      : null;

  const debtYieldCapacity =
    debtYieldRequested &&
    netOperatingIncome !== null &&
    netOperatingIncome >= 0 &&
    debtYieldDebtBalance !== null &&
    debtYieldDebtBalance >= 0 &&
    minimumDebtYieldPct !== null &&
    minimumDebtYieldPct > 0
      ? (() => {
        const currentDebtYieldPct =
          debtYieldDebtBalance > 0
            ? (netOperatingIncome / debtYieldDebtBalance) * 100
            : null;
        const maximumDebtAtMinimumYield =
          netOperatingIncome / (minimumDebtYieldPct / 100);
        const signedHeadroom =
          maximumDebtAtMinimumYield - debtYieldDebtBalance;

        return {
          net_operating_income: netOperatingIncome,
          debt_balance: debtYieldDebtBalance,
          debt_yield_pct: currentDebtYieldPct,
          minimum_debt_yield_pct: minimumDebtYieldPct,
          maximum_debt_at_minimum_yield: maximumDebtAtMinimumYield,
          debt_yield_headroom: Math.max(0, signedHeadroom),
          debt_yield_excess: Math.max(0, -signedHeadroom),
          status:
            signedHeadroom >= 0
              ? 'debt_yield_capacity_available'
              : 'debt_yield_capacity_exceeded'
        };
      })()
      : null;

  const borrowingCapacity = (() => {
    const constraints = [];
    if (loanSizing) constraints.push({
      key: 'debt_service',
      limit: loanSizing.maximum_additional_debt
    });
    if (collateralCapacity) constraints.push({
      key: 'collateral',
      limit: collateralCapacity.collateral_headroom
    });
    if (leverageCapacity) constraints.push({
      key: 'net_leverage',
      limit: leverageCapacity.leverage_headroom
    });
    if (
      interestCoverageCapacity &&
      interestCoverageCapacity.maximum_additional_debt_from_interest !== null
    ) {
      constraints.push({
        key: 'interest_coverage',
        limit: interestCoverageCapacity.maximum_additional_debt_from_interest
      });
    }
    if (debtYieldCapacity) {
      constraints.push({
        key: 'debt_yield',
        limit: debtYieldCapacity.debt_yield_headroom
      });
    }

    if (constraints.length < 2) return null;

    const maximumAdditionalDebt = Math.min(...constraints.map(item => item.limit));
    const bindingConstraints = constraints
      .filter(item => Math.abs(item.limit - maximumAdditionalDebt) < 1e-9)
      .map(item => item.key);

    return {
      debt_service_limit: loanSizing ? loanSizing.maximum_additional_debt : null,
      collateral_limit: collateralCapacity ? collateralCapacity.collateral_headroom : null,
      net_leverage_limit: leverageCapacity ? leverageCapacity.leverage_headroom : null,
      interest_coverage_limit:
        interestCoverageCapacity
          ? interestCoverageCapacity.maximum_additional_debt_from_interest
          : null,
      debt_yield_limit:
        debtYieldCapacity ? debtYieldCapacity.debt_yield_headroom : null,
      maximum_additional_debt: maximumAdditionalDebt,
      binding_constraint:
        bindingConstraints.length === 1 ? bindingConstraints[0] : bindingConstraints.join('+'),
      requested_amount: requestedAmount,
      requested_amount_headroom:
        requestedAmount === null ? null : maximumAdditionalDebt - requestedAmount,
      requested_amount_status:
        requestedAmount === null
          ? null
          : requestedAmount <= maximumAdditionalDebt
            ? 'within_capacity'
            : 'exceeds_capacity'
    };
  })();

  const metrics = {
    readiness_score: score,
    readiness_band: score === null ? 'unknown' : score >= 80 ? 'strong' : score >= 65 ? 'moderate' : score >= 50 ? 'weak' : 'not_ready',
    dscr,
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    requested_amount_to_cash_flow: amountToCashFlow,
    debt_service_capacity: debtServiceCapacity,
    loan_sizing: loanSizing,
    collateral_capacity: collateralCapacity,
    leverage_capacity: leverageCapacity,
    interest_coverage_capacity: interestCoverageCapacity,
    debt_yield_capacity: debtYieldCapacity,
    borrowing_capacity: borrowingCapacity,
    components
  };

  const required = [];
  if (ebitda === null && operatingCashFlow === null) required.push('ebitda_or_operating_cash_flow');
  if (annualDebtService === null) required.push('annual_debt_service');
  if ((capacityRequested || loanSizingRequested) && (minimumDscr === null || minimumDscr <= 0)) {
    required.push('minimum_dscr_positive');
  }
  if (loanSizingRequested) {
    if (borrowingAnnualRatePct === null || borrowingAnnualRatePct < 0) {
      required.push('borrowing_annual_rate_pct_non_negative');
    }
    if (borrowingTermYears === null || borrowingTermYears <= 0) {
      required.push('borrowing_term_years_positive');
    }
    if (
      borrowingPaymentsPerYear === null ||
      !Number.isInteger(borrowingPaymentsPerYear) ||
      borrowingPaymentsPerYear <= 0
    ) {
      required.push('borrowing_payments_per_year_positive_integer');
    }
  }
  if (collateralRequested) {
    if (collateralValue === null || collateralValue < 0) {
      required.push('collateral_value_non_negative');
    }
    if (maximumLtvPct === null || maximumLtvPct < 0 || maximumLtvPct > 100) {
      required.push('maximum_ltv_pct_between_0_and_100');
    }
    if (existingSecuredDebt === null || existingSecuredDebt < 0) {
      required.push('existing_secured_debt_non_negative');
    }
  }
  if (leverageCapacityRequested) {
    if (debt === null || debt < 0) {
      required.push('total_debt_non_negative');
    }
    if (cashAndEquivalents === null || cashAndEquivalents < 0) {
      required.push('cash_and_equivalents_non_negative');
    }
    if (ebitda === null || ebitda <= 0) {
      required.push('ebitda_positive_for_net_leverage');
    }
    if (maximumNetLeverage === null || maximumNetLeverage < 0) {
      required.push('maximum_net_leverage_non_negative');
    }
  }
  if (interestCoverageRequested) {
    if (ebitda === null || ebitda <= 0) {
      required.push('ebitda_positive_for_interest_coverage');
    }
    if (annualInterestExpense === null || annualInterestExpense < 0) {
      required.push('annual_interest_expense_non_negative');
    }
    if (minimumInterestCoverage === null || minimumInterestCoverage <= 0) {
      required.push('minimum_interest_coverage_positive');
    }
    if (
      interestCoverageIncrementalRatePct !== null &&
      interestCoverageIncrementalRatePct < 0
    ) {
      required.push('interest_coverage_incremental_rate_pct_non_negative');
    }
  }
  if (debtYieldRequested) {
    if (netOperatingIncome === null || netOperatingIncome < 0) {
      required.push('net_operating_income_non_negative');
    }
    if (debtYieldDebtBalance === null || debtYieldDebtBalance < 0) {
      required.push('debt_yield_debt_balance_non_negative');
    }
    if (minimumDebtYieldPct === null || minimumDebtYieldPct <= 0) {
      required.push('minimum_debt_yield_pct_positive');
    }
  }

  return envelope('funding_readiness', metrics, input, {
    debt_service_capacity_method:
      capacityRequested || loanSizingRequested
        ? 'cash_flow_basis_divided_by_minimum_dscr_less_current_debt_service'
        : null,
    loan_sizing_method:
      loanSizingRequested ? 'level_payment_annuity_from_annual_debt_service_headroom' : null,
    collateral_capacity_method:
      collateralRequested ? 'collateral_value_times_maximum_ltv_less_existing_secured_debt' : null,
    leverage_capacity_method:
      leverageCapacityRequested
        ? 'maximum_net_leverage_times_ebitda_plus_cash_less_total_debt'
        : null,
    interest_coverage_capacity_method:
      interestCoverageRequested
        ? 'ebitda_over_interest_with_minimum_coverage_headroom'
        : null,
    debt_yield_capacity_method:
      debtYieldRequested
        ? 'net_operating_income_over_debt_with_minimum_debt_yield_headroom'
        : null,
    borrowing_capacity_method:
      debtYieldCapacity && borrowingCapacity
        ? 'minimum_of_available_debt_service_collateral_net_leverage_interest_coverage_and_debt_yield_limits'
        : interestCoverageCapacity &&
          interestCoverageCapacity.maximum_additional_debt_from_interest !== null &&
          borrowingCapacity
          ? 'minimum_of_available_debt_service_collateral_net_leverage_and_interest_coverage_limits'
          : leverageCapacity && borrowingCapacity
            ? 'minimum_of_available_debt_service_collateral_and_net_leverage_limits'
            : loanSizing && collateralCapacity
              ? 'minimum_of_debt_service_limit_and_collateral_headroom'
              : null
  }, required);
}

function creditworthiness(input = {}) {
  const readiness = fundingReadiness(input);
  const netIncome = finite(input.net_income);
  const revenue = finite(input.revenue);
  const profitability = revenue && netIncome !== null ? netIncome / revenue : null;

  let score = readiness.metrics.readiness_score;
  if (score !== null && profitability !== null) {
    score = Math.round(clamp(score * 0.85 + clamp((profitability + 0.05) / 0.25 * 100, 0, 100) * 0.15, 0, 100));
  }

  const metrics = {
    credit_score: score,
    rating_band: score === null ? 'unrated' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'E',
    risk_band: score === null ? 'unknown' : score >= 75 ? 'low' : score >= 60 ? 'moderate' : score >= 45 ? 'high' : 'very_high',
    dscr: readiness.metrics.dscr,
    current_ratio: readiness.metrics.current_ratio,
    debt_to_equity: readiness.metrics.debt_to_equity,
    net_margin_pct: profitability === null ? null : pct(profitability)
  };

  return envelope('creditworthiness', metrics, input, {}, readiness.required_inputs);
}

module.exports = { fundingReadiness, creditworthiness };
