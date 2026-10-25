# Financial Operations Core - Wave 7

## Scope

Wave 7 adds deterministic fixed-asset depreciation on top of the canonical bonds_assets registry introduced in Wave 6.

## Design

- bonds_assets remains the asset master.
- accounting_fixed_asset_profiles stores accounting-only depreciation policy.
- Initial supported accounting method is straight-line only.
- Depreciation expense and accumulated-depreciation account codes are explicit per asset profile.
- No AI or heuristic selects accounting accounts.
- Depreciation postings use the existing Financial Event -> Accounting Policy -> Posting Engine path.
- Event type: asset.depreciation_accrued.
- Idempotency is deterministic for entity + asset + period + amount.

## Non-goals

- tax depreciation
- component accounting
- impairment
- revaluation model
- units-of-production accounting posting
- disposal gains/losses
- cost-center allocation

The existing valuation depreciation engine remains a valuation tool and is not used as the accounting ledger authority.