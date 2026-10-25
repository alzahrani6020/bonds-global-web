# BONDS Financial Operations Core — Wave 3

## Purpose

Strengthen weak operational alerts and executive analytics without creating parallel alert, notification, or analytics platforms.

## Reused foundations

- existing assistant Notification Engine;
- existing `admin_metric_snapshots` executive analytics storage;
- existing ledger-backed financial statements;
- existing BONDS financial-analysis engines;
- existing receivables/payables aging reports.

## Financial operational intelligence

The deterministic evaluator can surface:

- PAYMENT_OVERDUE
- OBLIGATION_OVERDUE
- LIQUIDITY_PRESSURE
- CURRENT_RATIO_LOW
- LEVERAGE_HIGH
- FINANCING_DOCUMENT_MISSING
- BANK_STATEMENT_STALE
- APPLICATION_STUCK
- CONTRACT_EXPIRING
- EVIDENCE_CONTRADICTION

Alerts are informational only and never authorize automatic execution.

## Executive metrics

The metrics builder reuses existing outputs to derive:

- revenue / net income;
- assets / liabilities / equity;
- working capital / current ratio / debt-to-equity;
- receivables and payables overdue ratios;
- pipeline and weighted pipeline values;
- CRM conversion rate;
- average processing hours;
- completed / rejected counts.

Numeric snapshots can be persisted into the existing `admin_metric_snapshots` table with the `financial.` namespace.

## Safety

1. No new alerts table.
2. No new notification delivery system.
3. No new analytics storage.
4. No AI prediction is presented as deterministic operational fact.
5. Alerts do not auto-execute actions.
6. Missing denominators produce null ratios rather than fabricated values.
7. Evidence contradictions are critical and explicitly require review.
