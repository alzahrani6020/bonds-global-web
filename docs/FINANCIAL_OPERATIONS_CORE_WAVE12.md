# Financial Operations Core — Wave 12

## Scope

Wave 12 adds deterministic governed cost allocation on top of the existing accounting core.

It does **not** create a parallel ledger, journal, account master, dimension master, or accounting endpoint.

## Canonical posting path

Every allocation execution ends in the existing atomic posting RPC:

`accounting_commit_posting(event, posting)`

Therefore allocations inherit:

- active accounting-entity validation;
- open-period enforcement;
- SHA-256 idempotency;
- postable account validation;
- debit/credit balancing;
- financial-event creation;
- subledger creation;
- journal entry and journal-line creation;
- Wave 11 mandatory-dimension validation.

## Rule model

Canonical tables:

- `accounting_allocation_rules`
- `accounting_allocation_targets`

Version 1 supports one explicit method:

`fixed_percentage`

Weights use integer basis points:

`10000 = 100%`

A rule cannot be saved unless all target weights total exactly 10000.

## Accounting semantics

The source and all targets must be active postable expense accounts in the same Accounting Entity.

Execution creates:

- one credit line for the source;
- one debit line per target.

The last target absorbs any cent-level rounding residual, so total target debits always equal the source credit exactly.

A rule that produces no dimensional/accounting change is rejected.

## Dimensions

Source and target dimensions are validated during configuration and again during execution.

Validation uses the same canonical helper used by journal lines:

`accounting_assert_account_dimensions(...)`

This preserves:

- supported keys only: `cost_center`, `segment`;
- active canonical dimension lookup;
- same-entity enforcement;
- mandatory dimension policies from Wave 11.

## Service execution

Two governed actions are added to the existing `accounting_operations` service:

- `accounting_allocation_rule_configure`
- `accounting_allocation_execute`

Both remain behind:

`POST /api/v3/services/execute`

No allocation-specific HTTP endpoint is introduced.

## Runtime authorization

The existing accounting membership boundary is reused.

Allowed roles:

- owner
- admin
- accountant

The authenticated user context is the actor source. User-supplied role or actor identifiers are not trusted.

## Deferred

Outside Wave 12:

- allocation bases derived automatically from headcount/revenue/area/usage;
- recurring allocation schedules;
- profit-center hierarchy;
- department/project dimensions;
- dimension-based financial statements;
- year-end retained earnings close.
