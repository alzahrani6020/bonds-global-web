# Financial Operations Core — Wave 7

## Scope

Wave 7 closes the operational fixed-asset accounting gap without replacing the existing valuation depreciation engine.

Existing `valuation/depreciation-engine.js` remains an analytical/valuation capability. Accounting posting uses an explicit governed policy and deterministic straight-line method only.

## Reuse

- Canonical asset master: `public.bonds_assets`
- Accounting periods: `public.accounting_periods`
- Chart of accounts: `public.accounting_accounts`
- Financial event / subledger / journal pipeline
- Atomic posting RPC: `public.accounting_commit_posting(jsonb,jsonb)`

No parallel ledger or fixed-assets master is introduced.

## New governed layer

- `accounting_asset_depreciation_policies`
  - explicit asset/entity binding
  - straight-line accounting method
  - explicit daily-actual or full-month convention
  - explicit depreciation expense account
  - explicit accumulated-depreciation contra-asset account
  - in-service date
- `accounting_fixed_asset_depreciation_runs`
  - one posting per asset/accounting period
  - posted event/journal provenance
  - accumulated depreciation tracking
- `accounting_post_asset_depreciation(...)`
  - verifies active asset and open period
  - verifies account types and postability
  - computes deterministic accounting depreciation
  - caps accumulated depreciation at the depreciable base
  - posts through the existing atomic posting RPC
  - returns safe replay for an already-posted asset/period

## Accounting boundary

The valuation engine's economic, operational, environmental, technical, functional, maintenance and misuse depreciation dimensions are not posted to the ledger.

Only the explicit accounting depreciation policy drives journal entries.

Journal:
- Debit: configured depreciation expense account
- Credit: configured accumulated depreciation account

## Fail-closed invariants

1. Missing asset policy = reject.
2. Missing acquisition cost/useful life = reject.
3. Residual value greater than acquisition cost = reject.
4. Non-active asset = reject.
5. Non-open accounting period = reject.
6. Invalid or non-postable mapped accounts = reject.
7. Duplicate asset/period = safe replay.
8. Accumulated depreciation cannot exceed depreciable base.
9. Direct anon/authenticated CRUD is not granted.
10. No AI classification or valuation-derived accounting amount.
