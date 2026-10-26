# Accounting Operations Wave 22 — Daily Journal Entries

## Status
Implementation branch only until PR CI, merge, migration, release, and authenticated production smoke are complete.

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
- The production posting RPC is SECURITY INVOKER and its EXECUTE grant remains limited to `postgres` and `service_role`.
- Input fails closed when the journal is unbalanced, has invalid one-sided lines, lacks account codes, lacks an effective date, lacks a request key, or uses an invalid currency.

## Database preflight evidence
Executed against production inside `BEGIN/ROLLBACK` before branch creation:
- journal_count = 1
- line_count = 2
- debit = 125.50
- credit = 125.50
- event_status = posted
- independent post-rollback residue check = 0 for entity, period, accounts, events, and journals

## Release gates
1. PR CI.
2. Re-check latest main and reconcile without force if it moved.
3. Apply Supabase migration.
4. Verify service profile and capability mapping.
5. Production release only when the accumulated change set justifies deployment.
6. Authenticated production smoke.
7. Mark FINAL VERIFIED only after all gates pass.
