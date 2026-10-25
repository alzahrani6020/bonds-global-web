# BONDS Financial Operations Core — Wave 6

## Purpose

Turn Fixed Assets and Cost Centers from service-level concepts into governed accounting capabilities without duplicating BONDS valuation assets.

## Existing capability reused

`bonds_assets` remains the canonical BONDS asset registry for valuation / market intelligence.

The existing `valuation/depreciation-engine.js` remains a valuation engine with multiple economic, technical, operational and condition dimensions.

Wave 6 does **not** replace either component.

## New accounting layer

### accounting_cost_centers

First-class accounting cost-center hierarchy scoped to an accounting entity.

Journal lines gain a validated `cost_center_id` while preserving the existing `dimensions` JSON contract.

### accounting_fixed_assets

Accounting-only fixed asset profile linked optionally to `bonds_assets`.

It stores:

- acquisition and in-service dates;
- acquisition cost and residual value;
- useful life in months;
- straight-line accounting method;
- full-month convention;
- explicit asset / accumulated depreciation / depreciation expense account links;
- optional cost-center link.

### accounting_asset_depreciation_schedule

Period-bound deterministic depreciation schedule linked to existing accounting periods, financial events and journal entries.

## Posting flow

```text
bonds_assets (optional valuation reference)
      ↓
accounting_fixed_assets
      ↓
straight-line deterministic schedule
      ↓
asset.depreciation.recorded Financial Event
      ↓
existing accounting_commit_posting
      ↓
depreciation expense Dr
accumulated depreciation Cr
      ↓
cost center dimension
```

## Invariants

1. No second generic asset registry is created.
2. Market/economic depreciation does not automatically create accounting journal entries.
3. Wave 6 supports straight-line accounting depreciation only.
4. Residual value can never exceed acquisition cost.
5. Book value cannot fall below residual value.
6. Depreciation cannot be posted to a non-open accounting period.
7. Asset and all mapped accounts must belong to the same accounting entity.
8. Cost center must belong to the same accounting entity and be active.
9. Depreciation posting reuses the existing atomic posting engine.
10. A depreciation schedule can be posted only once; replay is idempotent.
11. Cost-center ledger reports show unassigned movement instead of dropping it.
12. No AI inference participates in accounting depreciation.

## Cost-center analysis

The deterministic cost-center engine calculates:

- revenue;
- expenses;
- operating result;
- debit / credit movement;
- unassigned movement ratio.

The underlying ledger RPC is internal/service-role only in this wave.

## Deferred

- declining-balance accounting depreciation;
- units-of-production accounting depreciation;
- asset disposal accounting;
- impairment accounting;
- collateral registry and lien priority;
- user-facing cost-center reporting route.

These require separate governed rules and should not be inferred from valuation factors.
