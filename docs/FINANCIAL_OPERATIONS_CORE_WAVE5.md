# BONDS Financial Operations Core — Wave 5

## Purpose

Build a real cash-flow statement from posted accounting data without prefix heuristics or account-name guessing.

## Architecture

```text
Financial Event
  -> Posted Journal
  -> Explicit Cash Account Mapping
  -> Explicit Event Cash-Flow Policy
  -> Cash Movement
  -> Operating / Investing / Financing
  -> Opening + Net Change + Closing Cash
  -> Existing cash_flow_analysis engine
```

## Explicit policy objects

### accounting_cash_accounts

Marks which ledger accounts are cash or cash-equivalent accounts for the accounting entity.

No account is treated as cash merely because its code or name looks like cash.

### accounting_cash_flow_policies

Maps a financial event type to exactly one category:

- operating
- investing
- financing

No event type is classified by prefixes, source-system naming or account descriptions.

## Fail-closed behavior

1. A caller must be authenticated.
2. The caller must have active membership to the active accounting entity.
3. Only explicitly marked cash accounts contribute to cash movement.
4. Only posted journal entries are considered.
5. A non-zero cash movement with no active event classification raises `CASH_FLOW_CLASSIFICATION_REQUIRED`.
6. Invalid date ranges are rejected.
7. Opening cash is calculated separately from period activity.
8. Report provenance retains financial event id/key/type and category.
9. No AI inference participates in classification or arithmetic.
10. Existing `cash_flow_analysis` remains the downstream liquidity engine.

## Output

The statement exposes:

- opening_cash
- operating activities: inflows, outflows, net
- investing activities: inflows, outflows, net
- financing activities: inflows, outflows, net
- net_change_in_cash
- closing_cash
- event-level provenance
- daily period inputs for the existing cash-flow analysis engine

## Deliberately excluded

The following are not inferred automatically:

- whether an invoice is collected;
- whether an approved expense was actually paid;
- whether financing approval created a cash receipt;
- whether an account is cash based on its code/name.

Only actual posted cash-account journal movement plus explicit policy creates cash-flow activity.
