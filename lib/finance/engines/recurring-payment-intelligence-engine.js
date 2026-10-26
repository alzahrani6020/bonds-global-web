'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const DAY_MS = 24 * 60 * 60 * 1000;
const FAILED_STATUSES = new Set(['failed', 'declined', 'unpaid', 'retry', 'rejected']);
const OUTFLOW_DIRECTIONS = new Set(['debit', 'outflow', 'expense', 'payment', 'purchase', 'charge']);
const INFLOW_DIRECTIONS = new Set(['credit', 'inflow', 'income', 'refund']);

function isoDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function dayNumber(value) {
  const date = isoDate(value);
  return date ? Math.floor(new Date(date + 'T00:00:00Z').getTime() / DAY_MS) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeMerchant(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(pos|card|visa|mastercard|payment to|purchase at|online purchase|debit)\b/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cadenceFromDays(days) {
  if (days >= 5 && days <= 9) return { code: 'weekly', target: 7, annualFactor: 52 };
  if (days >= 11 && days <= 17) return { code: 'biweekly', target: 14, annualFactor: 26 };
  if (days >= 24 && days <= 38) return { code: 'monthly', target: 30.4375, annualFactor: 12 };
  if (days >= 75 && days <= 105) return { code: 'quarterly', target: 91.3125, annualFactor: 4 };
  if (days >= 330 && days <= 400) return { code: 'annual', target: 365.25, annualFactor: 1 };
  return null;
}

function addDays(dateText, days) {
  const time = new Date(dateText + 'T00:00:00Z').getTime();
  return new Date(time + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
}

function recurringPaymentIntelligence(input = {}) {
  const transactions = Array.isArray(input.transactions) ? input.transactions : [];
  const required = [];

  if (transactions.length < 2) required.push('transactions_min_2');

  const normalized = [];
  let ignoredInflows = 0;
  let unclassifiedDirection = 0;

  transactions.forEach((transaction, index) => {
    const amount = finite(transaction?.amount);
    const date = isoDate(transaction?.date || transaction?.posted_at || transaction?.transaction_date);
    const merchantRaw = transaction?.merchant || transaction?.counterparty || transaction?.description || transaction?.memo;
    const merchant = normalizeMerchant(merchantRaw);
    const direction = String(transaction?.direction || transaction?.type || '').trim().toLowerCase();
    const status = String(transaction?.status || 'posted').trim().toLowerCase();
    const currency = String(transaction?.currency || input.currency || '').trim().toUpperCase() || null;

    if (amount === null || amount === 0) {
      required.push(`transactions[${index}].amount_non_zero_numeric`);
      return;
    }
    if (!date) {
      required.push(`transactions[${index}].date_valid`);
      return;
    }
    if (!merchant) {
      required.push(`transactions[${index}].merchant_or_description`);
      return;
    }

    let isOutflow = amount < 0;
    if (OUTFLOW_DIRECTIONS.has(direction)) isOutflow = true;
    if (INFLOW_DIRECTIONS.has(direction)) isOutflow = false;

    if (!direction && amount > 0) {
      unclassifiedDirection += 1;
      return;
    }
    if (!isOutflow) {
      ignoredInflows += 1;
      return;
    }

    normalized.push({
      index,
      date,
      day: dayNumber(date),
      merchant,
      merchant_display: String(merchantRaw || '').trim(),
      amount: Math.abs(amount),
      currency,
      status,
      failed: FAILED_STATUSES.has(status)
    });
  });

  if (required.length) {
    return envelope(
      'recurring_payment_intelligence',
      {},
      input,
      {
        method: 'deterministic_merchant_cadence_detection',
        fail_closed: true
      },
      required
    );
  }

  const groups = new Map();
  for (const row of normalized) {
    const key = `${row.merchant}::${row.currency || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const recurring = [];
  const suspected = [];
  const alerts = [];
  let failedAttemptCount = 0;

  for (const rows of groups.values()) {
    rows.sort((a, b) => a.day - b.day || a.index - b.index);
    const successful = rows.filter(row => !row.failed);
    const failed = rows.filter(row => row.failed);
    failedAttemptCount += failed.length;

    if (successful.length < 2) {
      if (failed.length) {
        alerts.push({
          type: 'failed_payment_attempt',
          merchant: rows[0].merchant_display,
          merchant_key: rows[0].merchant,
          currency: rows[0].currency,
          attempts: failed.length,
          latest_attempt: failed[failed.length - 1].date
        });
      }
      continue;
    }

    const intervals = [];
    for (let i = 1; i < successful.length; i += 1) {
      intervals.push(successful[i].day - successful[i - 1].day);
    }

    const medianInterval = median(intervals);
    const cadence = cadenceFromDays(medianInterval);
    const amounts = successful.map(row => row.amount);
    const medianAmount = median(amounts);
    const maxAmountDeviationPct = medianAmount > 0
      ? Math.max(...amounts.map(value => Math.abs(value - medianAmount) / medianAmount * 100))
      : null;
    const cadenceDeviationPct = cadence
      ? Math.abs(medianInterval - cadence.target) / cadence.target * 100
      : null;

    const confidence = cadence
      ? Math.max(
          0,
          Math.min(
            100,
            55
              + Math.min(25, (successful.length - 2) * 8)
              + Math.max(0, 10 - cadenceDeviationPct)
              + Math.max(0, 10 - Math.min(10, maxAmountDeviationPct / 2))
          )
        )
      : 0;

    const latest = successful[successful.length - 1];
    const previousMedian = successful.length > 2
      ? median(successful.slice(0, -1).map(row => row.amount))
      : successful[successful.length - 2].amount;
    const priceChangePct = previousMedian > 0
      ? (latest.amount - previousMedian) / previousMedian * 100
      : null;
    const amountIncreased = priceChangePct !== null && priceChangePct >= 5;

    const item = {
      merchant: latest.merchant_display,
      merchant_key: latest.merchant,
      currency: latest.currency,
      cadence: cadence?.code || 'irregular',
      occurrence_count: successful.length,
      failed_attempt_count: failed.length,
      median_interval_days: medianInterval,
      median_amount: medianAmount,
      latest_amount: latest.amount,
      latest_charge_date: latest.date,
      next_expected_charge_date: cadence ? addDays(latest.date, medianInterval) : null,
      annualized_cost: cadence ? medianAmount * cadence.annualFactor : null,
      monthly_equivalent_cost: cadence ? (medianAmount * cadence.annualFactor) / 12 : null,
      max_amount_deviation_pct: maxAmountDeviationPct,
      price_change_pct: priceChangePct,
      price_increase_detected: amountIncreased,
      confidence_pct: confidence
    };

    if (cadence && confidence >= 70) recurring.push(item);
    else if (cadence) suspected.push(item);

    if (amountIncreased) {
      alerts.push({
        type: 'price_increase',
        merchant: latest.merchant_display,
        merchant_key: latest.merchant,
        currency: latest.currency,
        previous_typical_amount: previousMedian,
        latest_amount: latest.amount,
        increase_pct: priceChangePct,
        latest_charge_date: latest.date
      });
    }

    if (failed.length) {
      alerts.push({
        type: 'failed_payment_attempt',
        merchant: latest.merchant_display,
        merchant_key: latest.merchant,
        currency: latest.currency,
        attempts: failed.length,
        latest_attempt: failed[failed.length - 1].date
      });
    }
  }

  recurring.sort((a, b) => (a.next_expected_charge_date || '').localeCompare(b.next_expected_charge_date || ''));
  suspected.sort((a, b) => b.confidence_pct - a.confidence_pct);

  const annualizedRecurringCost = recurring.reduce((sum, row) => sum + (row.annualized_cost || 0), 0);
  const monthlyEquivalentRecurringCost = recurring.reduce((sum, row) => sum + (row.monthly_equivalent_cost || 0), 0);

  return envelope(
    'recurring_payment_intelligence',
    {
      recurring_payments: recurring,
      suspected_recurring_payments: suspected,
      alerts,
      summary: {
        input_transaction_count: transactions.length,
        analyzed_outflow_count: normalized.length,
        ignored_inflow_count: ignoredInflows,
        unclassified_direction_count: unclassifiedDirection,
        recurring_count: recurring.length,
        suspected_count: suspected.length,
        failed_attempt_count: failedAttemptCount,
        annualized_recurring_cost: annualizedRecurringCost,
        monthly_equivalent_recurring_cost: monthlyEquivalentRecurringCost
      }
    },
    input,
    {
      method: 'deterministic_merchant_cadence_detection',
      supported_cadences: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'],
      amount_semantics: 'negative amounts are treated as outflows; positive amounts require explicit outflow direction',
      fail_closed: true
    }
  );
}

module.exports = {
  recurringPaymentIntelligence,
  normalizeMerchant,
  cadenceFromDays
};
