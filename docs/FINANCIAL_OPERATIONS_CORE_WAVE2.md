# BONDS Financial Operations Core — Wave 2

## Scope

Wave 2 strengthens the existing BONDS financial engines by deriving verified accounting statements from the governed ledger built in Wave 1.

It does **not** create a second financial-analysis engine.

## Implemented flow

```text
Posted Journal Lines
  -> Governed Ledger Balances RPC
  -> Trial Balance Verification
  -> Balance Sheet
  -> Income Statement
  -> Canonical Financial Mapping
  -> Existing Financial Engine Registry
```

## New capabilities

- deterministic cumulative and period trial balances;
- double-entry balance verification before statement generation;
- contra-account handling;
- accounting-equation verification;
- balance sheet totals;
- income statement revenue / expenses / net income;
- explicit canonical mapping for fields such as cash, receivables, inventory,
  current assets, current liabilities, debt, COGS, operating expenses and interest;
- mapping provenance down to the source ledger account;
- ledger-backed execution through `financial-engine-registry`;
- service-role-only Supabase reporting RPC.

## Fail-closed rules

1. Unbalanced cumulative ledger data is rejected.
2. Unbalanced period ledger data is rejected.
3. A failed accounting equation is rejected.
4. Unsupported account types are rejected.
5. Canonical fields are never inferred from account names.
6. Current/non-current and debt classifications require explicit mapping.
7. Reporting RPC accepts only an active accounting entity.
8. Invalid reporting date ranges are rejected.
9. Reporting RPC is SECURITY INVOKER and executable only by service_role.
10. No public Service Execution route is exposed until accounting-entity ownership / tenant isolation is implemented.

## Existing engines reused

The downstream computation remains:

- `financial_analysis`
- `cash_flow_analysis`
- `funding_readiness`
- `creditworthiness`
- `feasibility`
- `valuation`
- `risk_analysis`
- `scenario_forecast`

The new ledger bridge supplies verified normalized inputs; it does not replace these engines.

## Intentionally not inferred

### Cash-flow statement classification

Debit/credit movements alone cannot prove whether cash movement is:

- operating;
- investing; or
- financing.

Therefore Wave 2 does not manufacture a cash-flow statement from account prefixes or account names.

A later governed classification layer should derive cash-flow categories from the Financial Event Bus and explicit accounting policy metadata.

### User-facing ledger execution

The database RPC is server-only. Exposing an `accounting_entity_id` through the public service-execution endpoint is deferred until entity ownership and fail-closed tenant isolation are enforced end-to-end.

This is a deliberate security boundary, not an unfinished public route.
