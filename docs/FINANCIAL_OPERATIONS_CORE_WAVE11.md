# Financial Operations Core — Wave 11

## Scope

Wave 11 adds mandatory accounting dimension policies by account.

It extends the verified Wave 9 dimension model and the Wave 10 service execution boundary. It does not create a parallel journal, ledger, account master, or accounting API.

## Canonical model

The existing sources remain authoritative:

- `accounting_accounts`
- `accounting_dimensions`
- `accounting_journal_lines.dimensions`
- `accounting_validate_journal_dimensions()`
- `POST /api/v3/services/execute`
- service code `accounting_operations`

Wave 11 adds one policy table:

`accounting_account_dimension_policies`

A policy is scoped by:

- accounting entity
- account
- dimension type: `cost_center` or `segment`

The composite foreign key to `accounting_accounts(accounting_entity_id,id)` prevents cross-entity account policy configuration.

## Fail-closed posting rule

The existing journal dimension validator is extended.

For every active required policy on the journal line account:

- the required dimension key must exist;
- its value must be a non-empty string;
- the referenced dimension must already exist in `accounting_dimensions`;
- the dimension must be active;
- the dimension must belong to the same accounting entity.

A missing mandatory dimension raises:

`ACCOUNTING_REQUIRED_DIMENSION_MISSING`

The trigger also fires when `account_id` changes so an existing line cannot bypass a different account policy.

## Service execution

New governed action:

`accounting_dimension_policy_configure`

It is mapped to the existing:

`accounting_operations`

service and remains behind the same authenticated membership boundary.

No new endpoint is introduced.

## Security

- RLS is enabled on the policy table.
- Direct `anon` and `authenticated` table access is revoked.
- Database writes are server-mediated.
- Runtime authorization uses the authenticated user context and active `accounting_entity_members`.
- User supplied role, actor id, or user id is not trusted.

## Deferred

Still outside Wave 11:

- cost allocation rules
- profit-center hierarchy
- department/project dimensions
- dimension-based financial statements
- year-end retained earnings closing entries
