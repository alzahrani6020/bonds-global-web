# Financial Operations Core — Accounting Reporting Wave 18

## Scope

Wave 18 turns the existing `cash_flow_statement` service into a governed
accounting cash-flow statement by canonical dimension.

It reuses the cash-account and cash-flow-policy foundation already present in
the accounting schema. It does not infer classifications from account types,
create a parallel ledger, or persist a duplicate statement.

## Governed capabilities

- `accounting_cash_account_configure`
- `accounting_cash_flow_policy_configure`
- `accounting_dimension_cash_flow_statement`

## Classification

Cash accounts are explicitly designated in `accounting_cash_accounts`.

Cash-flow categories are explicitly configured by financial-event type in
`accounting_cash_flow_policies`:

- operating;
- investing;
- financing.

The report fails closed when a period cash movement lacks a configured
classification.

## Dimension basis

Supported dimensions:

- `cost_center`
- `segment`

All non-zero cash lines through the report end date must carry the selected
dimension. Missing dimensions fail closed instead of being guessed or assigned.

## Reconciliation

Per dimension, PostgreSQL computes:

- opening cash;
- operating cash flow;
- investing cash flow;
- financing cash flow;
- net cash change;
- closing cash;
- direct closing cash from posted cash-account lines;
- reconciliation delta.

The invariant is:

`closing_cash = opening_cash + operating + investing + financing`

and:

`reconciliation_delta = direct_closing_cash - closing_cash`

## Authorization

Cash-account and classification-policy configuration requires active
`owner` or `admin` membership.

Statement reads allow active:

- owner;
- admin;
- accountant;
- viewer.

The new RPCs are `SECURITY INVOKER`, direct execution is revoked from
`public`, `anon`, and `authenticated`, and execution is granted only to
`service_role`. User authorization remains in the existing server-mediated
service execution boundary.

## Service activation

The existing published `cash_flow_statement` service is promoted from
partially automated calculator-first execution to:

- `execution_status = automated`
- `execution_mode = capability_plan`
- `primary_action = accounting_dimension_cash_flow_statement`

The existing calculator and deterministic cash-flow engine mappings are not
deleted; they remain available as mapped secondary actions.

## Deferred

Outside this wave:

- consolidated group cash-flow statement;
- comparative-period presentation;
- custom statement layouts;
- foreign-currency translation of cash flows.
