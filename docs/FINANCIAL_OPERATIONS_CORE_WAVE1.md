# BONDS Financial Operations Core — Wave 1

## Purpose

Introduce the missing accounting foundation without duplicating existing BONDS CRM, approvals, tasks, alerts, analytics, documents, aging, or Native AI.

## Reuse boundary

The following existing engines remain authoritative and MUST NOT be duplicated:

- CRM / opportunity pipeline
- Enterprise Approval Engine
- Enterprise Task Engine
- Receivables / Payables Aging
- Financial Analysis Engine Registry
- Service Execution Router
- Assistant / Lifecycle Audit
- Notification / Alert infrastructure
- Document processing and client documents
- BONDS Native AI

## New accounting foundation

```text
Business Event
  -> Financial Event Contract
  -> Subledger
  -> Accounting Policy / Mapping
  -> Double-entry Posting
  -> Financial Period Control
  -> General Ledger storage
  -> Financial Statements (next wave)
  -> Financial Normalization
  -> Existing BONDS Financial Engines
```

## Wave 1 invariants

1. Missing accounting entity fails closed.
2. Unsupported financial event fails closed.
3. Every accepted event has a stable idempotency key.
4. Posting is double-entry and balanced.
5. Debit and credit cannot use the same account in one mapping rule.
6. A posting can only enter an `open` accounting period.
7. Database writes for event + subledger + journal + lines are atomic.
8. Duplicate idempotency keys replay safely; conflicting keys fail closed.
9. Accounting tables are server-mediated with RLS enabled and no direct anon/authenticated access.
10. No SCC security, AI, tenant helper, or mock government integration is copied.

## Implemented candidate files

- `lib/finance/accounting/financial-event.js`
- `lib/finance/accounting/accounting-policy.js`
- `lib/finance/accounting/posting-engine.js`
- `lib/finance/accounting/supabase-posting-store.js`
- `supabase/migrations/20261025203000_financial_operations_core.sql`
- `supabase/migrations/20261025204500_financial_posting_rpc.sql`
- `tests/finance/financial-operations-core.test.js`

## Deferred until this wave is verified

- financial statements generation from the ledger
- accounting normalization from ledger balances
- cost-center dimensions
- fixed assets / depreciation
- collateral registry
- operational financial alerts
- executive accounting analytics
- fail-closed multi-tenant boundary
- ZATCA / Ejar production connectors

These are intentionally deferred to avoid parallel engines and unverified production writes.
