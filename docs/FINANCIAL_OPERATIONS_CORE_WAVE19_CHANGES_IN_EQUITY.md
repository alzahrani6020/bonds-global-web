# Financial Operations Core — Accounting Reporting Wave 19

## Scope

Wave 19 automates the existing published `changes_in_equity` service using
canonical posted accounting journals and explicit equity-movement policies.

It does not infer owner-equity movement categories from account type alone and
does not create a parallel ledger or persisted statement table.

## Governed capabilities

- `accounting_equity_movement_policy_configure`
- `accounting_changes_in_equity_statement`

## Classification

Explicit policy maps a financial-event type to one of:

- `capital_contribution`
- `distribution`
- `other_equity`

Period equity postings without a policy fail closed with
`EQUITY_MOVEMENT_CLASSIFICATION_REQUIRED`.

## Statement logic

The statement reports:

- opening equity;
- capital contributions;
- distributions;
- other equity movements;
- current-period earnings;
- closing equity;
- direct closing equity from the canonical ledger;
- reconciliation delta.

Current-period earnings are derived from posted revenue/expense account types.
Year-end closing entries from `accounting_year_end` are excluded from movement
classification and earnings so the statement does not double-count profit after
a year-end close.

## Reconciliation

`closing_equity = opening_equity + capital_contributions + distributions + other_equity_movements + current_period_earnings`

`reconciliation_delta = direct_closing_equity - closing_equity`

All arithmetic remains PostgreSQL numeric.

## Authorization

Policy configuration requires active owner/admin membership.

Statement reads allow active:

- owner;
- admin;
- accountant;
- viewer.

The RPCs are `SECURITY INVOKER`, direct execution is revoked from
`public`, `anon`, and `authenticated`, and execution is granted only to
`service_role`.

## Service activation

The existing `changes_in_equity` service is promoted to:

- `execution_status = automated`
- `execution_mode = capability_plan`
- `primary_action = accounting_changes_in_equity_statement`

Execution remains on the existing `POST /api/v3/services/execute` path.

## Deferred

Outside this wave:

- consolidated group changes in equity;
- comparative-period presentation;
- custom statement layouts;
- automated narrative disclosures.
