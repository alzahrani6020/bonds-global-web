# Financial Operations Core — Accounting Reporting Wave 15

## Scope

This wave automates the existing published `income_statement` service for
dimension-based reporting.

It reuses posted canonical journals and does not create a parallel statement
ledger, reporting cube, account taxonomy, or HTTP endpoint.

## Report action

`accounting_dimension_income_statement`

Supported dimensions:

- `cost_center`
- `segment`

Optional filters:

- one dimension code;
- from date;
- to date.

## Statement basis

Only temporary income-statement account types are included:

- revenue;
- contra_revenue;
- expense;
- contra_expense.

The database computes amounts using accounting sign conventions:

- revenue = credit - debit;
- contra revenue = debit - credit;
- expense = debit - credit;
- contra expense = credit - debit.

Per dimension, PostgreSQL also computes:

- gross revenue;
- contra revenue;
- net revenue;
- gross expense;
- contra expense;
- net expense;
- net income.

All totals remain PostgreSQL `numeric`; they are not recalculated in
JavaScript.

## Canonical source

The report reads:

- posted `accounting_journal_entries`;
- `accounting_journal_lines`;
- `accounting_accounts`;
- `accounting_dimensions`.

The GIN index created in Accounting Reporting Wave 14 is reused.

## Authorization

Active Accounting Entity members may read the statement:

- owner;
- admin;
- accountant;
- viewer.

The existing `income_statement` service is promoted from request-only to
`capability_plan` and continues through:

`POST /api/v3/services/execute`

## Deferred

Outside this wave:

- balance sheet by dimension;
- cash-flow statement by dimension;
- statement layout customization;
- comparative-period presentation;
- consolidation/elimination.
