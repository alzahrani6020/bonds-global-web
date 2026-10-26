# Financial Operations Core — Accounting Reporting Wave 16

## Scope

This wave automates the existing published `statement_financial_position`
service for dimension-based reporting.

It reuses posted canonical journals and canonical dimensions. It does not
create a parallel ledger, persisted balance table, reporting cube, account
taxonomy, or HTTP endpoint.

## Report action

`accounting_dimension_financial_position`

Supported dimensions:

- `cost_center`
- `segment`

Optional filters:

- one dimension code;
- as-of date.

## Statement basis

Permanent balance-sheet account types are included:

- asset;
- contra_asset;
- liability;
- contra_liability;
- equity;
- contra_equity.

The database computes accounting signs as follows:

- asset = debit - credit;
- contra asset = credit - debit;
- liability = credit - debit;
- contra liability = debit - credit;
- equity = credit - debit;
- contra equity = debit - credit.

## Current-period earnings

A statement of financial position must remain balanced before year-end close.
Therefore current-period earnings are calculated from posted temporary accounts
for the selected dimension and as-of date:

`current_period_earnings = sum(credit - debit)`

over:

- revenue;
- contra_revenue;
- expense;
- contra_expense.

The result is returned as a synthetic presentation row named
`CURRENT_PERIOD_EARNINGS`. It is not persisted and does not create a new
account.

## Totals

Per dimension, PostgreSQL computes:

- gross assets;
- contra assets;
- net assets;
- gross liabilities;
- contra liabilities;
- net liabilities;
- gross equity;
- contra equity;
- current-period earnings;
- net equity;
- liabilities and equity;
- balance delta.

The balance check is:

`balance_delta = net_assets - (net_liabilities + net_equity)`

All values remain PostgreSQL `numeric`; JavaScript does not recompute the
statement.

## Canonical source

The report reads only:

- posted `accounting_journal_entries`;
- `accounting_journal_lines`;
- `accounting_accounts`;
- `accounting_dimensions`.

The existing dimension GIN index is reused.

## Authorization

Active Accounting Entity members may read the statement:

- owner;
- admin;
- accountant;
- viewer.

The database RPC is `SECURITY INVOKER`, direct execution is revoked from
`public`, `anon`, and `authenticated`, and execution is granted only to
`service_role`.

The existing `statement_financial_position` service is promoted from
request-only to `capability_plan` and continues through:

`POST /api/v3/services/execute`

## Deferred

Outside this wave:

- cash-flow statement by dimension;
- statement layout customization;
- comparative-period presentation;
- consolidation and elimination.
