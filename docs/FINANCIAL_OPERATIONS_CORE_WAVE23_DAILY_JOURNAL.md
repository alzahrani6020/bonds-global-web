# Accounting Operations Wave 23 — Daily Journal Entries

## Status
Implementation branch only until PR CI, merge, migration, release, and authenticated production verification are complete.

## Scope
- Activates the existing published `daily_journal_entries` service.
- Adds governed capability `BONDS-CAP-FIN-044 / accounting_journal_post`.
- Reuses the canonical `accounting_commit_posting(jsonb,jsonb)` RPC.
- Reuses the existing Accounting Entity, period, account, financial-event, subledger, journal-entry, and journal-line model.
- Uses the existing `/api/v3/services/execute` path.
- No new ledger, table, posting RPC, API endpoint, or parallel accounting path.

## Governance
- Runtime access: active Accounting Entity `owner`, `admin`, or `accountant`.
- Database write remains server-mediated through the existing service-role boundary.
- The production posting RPC is SECURITY INVOKER and EXECUTE remains restricted to `postgres` and `service_role`.
- Input fails closed when the journal is unbalanced, has invalid one-sided lines, lacks account codes, lacks an effective date, lacks a request key, or uses an invalid currency.
- Idempotency uses the stable request key, while the event identity includes a posting fingerprint so reusing the same request key with different journal content fails as an idempotency conflict instead of silently replaying an older posting.

## Database preflight evidence
Executed against production inside `BEGIN/ROLLBACK` before implementation:
- journal_count = 1
- line_count = 2
- debit = 125.50
- credit = 125.50
- event_status = posted
- independent post-rollback residue check = 0 for entity, period, accounts, events, and journals

## Concurrency
- Branch rebased by construction on main `c4131a94593332e2b852e3096a1b41f328164b21` after Financial Core Wave 22 (#667) merged.
- Wave 23 avoids the Wave 22 naming collision.
- FIN-044 remained unused in the current financial-engine manifest.

## Release gates
1. Migration file preflight in rollback mode.
2. PR CI.
3. Re-check latest main; reconcile without force if it moved.
4. Apply Supabase migration.
5. Verify service profile and capability mapping.
6. Production release.
7. Authenticated production smoke/verification.
8. Mark FINAL VERIFIED only after all applicable gates pass.
