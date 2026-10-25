# Financial Operations Core — Wave 9

## Scope

Wave 9 governs cost-center and segment dimensions for accounting journal lines.

## Reuse

- Existing ledger and posting engine remain authoritative.
- Existing `accounting_journal_lines.dimensions JSONB` is retained.
- No parallel journal, subledger, or reporting path is created.

## Canonical dimension master

`accounting_dimensions` supports:

- `cost_center`
- `segment`

Each dimension is scoped to one accounting entity and has:

- code
- name
- optional parent
- lifecycle status
- metadata
- audit timestamps

## Fail-closed validation

A database trigger validates every journal-line dimension:

- only `cost_center` and `segment` keys are accepted;
- values must be non-empty strings;
- the referenced code must exist;
- it must be active;
- it must belong to the same accounting entity.

This protects all posting paths, including the existing atomic posting RPC.

## Explicit assignment

`applyLineDimensions()` attaches dimensions to explicitly selected journal lines only. It never guesses which account or line should carry a cost center or segment.

## Security

- RLS is enabled on `accounting_dimensions`.
- Direct anon/authenticated CRUD is revoked.
- The master is server-mediated through the existing service-role boundary.

## Deferred

- mandatory dimension policies by account
- allocation rules
- profit-center hierarchy
- department/project dimensions
- dimension-based financial statements

Those remain separate future work and should not be added until Wave 9 is verified in Production.
