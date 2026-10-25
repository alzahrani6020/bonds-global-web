# Financial Operations Core — Wave 7

## Scope

Wave 7 adds accounting depreciation and cost-center analysis on top of the governed Asset / Collateral Registry introduced in Wave 6.

## Canonical asset rule

`public.bonds_assets` remains the only asset master.

Wave 7 does **not** create `accounting_fixed_assets` or another generic asset registry.

The canonical asset supplies:

- accounting entity;
- acquisition date;
- acquisition cost;
- currency;
- useful life;
- residual value;
- lifecycle status.

## Accounting-only extension

`accounting_asset_depreciation_profiles` stores only accounting policy:

- in-service date;
- straight-line method;
- full-month convention;
- asset account;
- accumulated depreciation account;
- depreciation expense account;
- optional cost center;
- accounting depreciation status.

## Depreciation schedule

`accounting_asset_depreciation_schedule` is period-bound and references:

- canonical `bonds_assets`;
- depreciation profile;
- accounting period;
- financial event;
- journal entry.

## Posting flow

```text
bonds_assets
    +
depreciation profile
    ↓
deterministic monthly schedule
    ↓
asset.depreciation.recorded
    ↓
existing accounting_commit_posting
    ↓
Depreciation Expense Dr
Accumulated Depreciation Cr
    ↓
optional Cost Center
```

## Cost centers

Wave 7 adds first-class `accounting_cost_centers` and a validated `cost_center_id` on journal lines.

The deterministic cost-center ledger reports:

- revenue;
- expenses;
- operating result;
- debit / credit movement;
- unassigned movement.

Unassigned journal movement is surfaced, never silently discarded.

## Invariants

1. No duplicate asset master.
2. Valuation depreciation does not create accounting entries automatically.
3. Straight-line/full-month is the only accounting depreciation method in this wave.
4. Canonical asset must be active and contain acquisition cost, residual value, useful life, date and currency.
5. Profile and asset must belong to the same accounting entity.
6. Residual value is inherited from canonical `bonds_assets`.
7. Closed periods cannot receive depreciation postings.
8. Cost centers must be active and belong to the same accounting entity.
9. Depreciation posting reuses `accounting_commit_posting`; no second posting engine exists.
10. Schedule/event/profile/asset/period/amount references must match.
11. Replay is idempotent.
12. No AI participates in depreciation arithmetic or accounting classification.

## Migration ordering

Wave 6 Asset / Collateral Registry uses migration version `20261026013000`.

Wave 7 uses `20261026020000` to avoid migration-version collision.

## Deferred

- impairment accounting;
- disposal accounting;
- declining balance;
- units of production;
- authenticated cost-center UI;
- property evidence/document workflow;
- ZATCA / Ejar.
