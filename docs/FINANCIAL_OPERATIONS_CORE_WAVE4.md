# BONDS Financial Operations Core — Wave 4

## Purpose

Add a fail-closed accounting-entity access boundary before exposing ledger-backed statements to authenticated users.

## Why a dedicated boundary is required

The existing `company_members` table belongs to the legacy `companies` domain and is not linked to `crm_organizations`.
Reusing it would create an unsafe cross-domain assumption.

Wave 4 therefore introduces membership only for accounting entities. It is not a general tenant framework.

## Access model

```text
Authenticated User
  -> auth.uid()
  -> accounting_entity_members
  -> active accounting entity
  -> governed user ledger RPC
  -> ledger balances
  -> statements / existing financial engines
```

## Roles

- owner
- admin
- accountant
- viewer

Roles are metadata for later authorization refinement. Wave 4 access is currently read-oriented and requires active membership.

## Invariants

1. Anonymous access is denied.
2. The caller cannot supply or impersonate a user id.
3. Membership is resolved from `auth.uid()` inside PostgreSQL.
4. A user cannot insert/update/delete their own membership directly.
5. Only active membership to an active accounting entity grants ledger read access.
6. Accounting tables remain server-mediated; no direct authenticated grants are added.
7. The user ledger RPC is the only authenticated ledger read surface.
8. New entities with `created_by` automatically seed that user as owner.
9. Existing entities with `created_by` are backfilled idempotently.
10. No relationship is inferred from unrelated `company_members` records.

## Added

- `accounting_entity_members`
- `accounting_user_can_access_entity(uuid)`
- `accounting_user_ledger_balances(uuid,date,date)`
- creator-owner membership trigger
- authenticated Supabase user ledger store
- regression tests

## Deferred

A broader BONDS multi-tenant framework remains a separate future architecture decision.
Wave 4 only protects Financial Operations entities.
