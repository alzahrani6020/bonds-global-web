# Financial Operations Core — Accounting Reporting Wave 14

## Scope

This wave adds governed ledger reporting by canonical accounting dimensions.

It does not create a parallel ledger, reporting warehouse, dimension master,
journal model, or HTTP endpoint.

## Existing service

The existing published service is reused:

`general_ledger`

It is promoted from request-only to the existing governed capability-plan
execution mode.

The execution path remains:

`POST /api/v3/services/execute`

## Report action

`accounting_dimension_ledger_report`

Supported dimension types:

- `cost_center`
- `segment`

Inputs:

- accounting entity;
- dimension type;
- optional dimension code;
- optional from date;
- optional to date.

## Canonical source

The report reads only:

- `accounting_journal_entries` with status `posted`;
- `accounting_journal_lines`;
- `accounting_accounts`;
- `accounting_dimensions`.

No balances are persisted or duplicated.

## Output grain

Rows are grouped by:

- dimension type;
- dimension code and name;
- account code/name/type.

Measures:

- debit;
- credit;
- net balance = debit - credit.

Historical reporting keeps valid historical dimension codes even if the
dimension is later inactive. The report therefore validates existence, not
current active status, when a specific dimension code is requested.

## Authorization

The runtime reuses active `accounting_entity_members`.

Read access is allowed to:

- owner
- admin
- accountant
- viewer

The service-role RPC itself has no user-supplied actor or role input; the
application runtime establishes membership before calling it.

## Deferred

Outside this wave:

- statement-layout mapping by dimension;
- comparative dimension income statements;
- consolidated/group reporting;
- elimination entries;
- persisted reporting cubes.
