# ADM1 phase 2 triage — 2026-10-20

## Safe candidates
- CONFIRMED source-link candidates: 232
- Ambiguous + unmatched reviewed: 97

## Triage of non-confirmed rows
- GRANULARITY_MISMATCH: 2
- INTERNAL_DUPLICATE: 6
- LEGACY_STRUCTURE_MISMATCH: 2
- LIKELY_NAME_VARIANT: 1
- MANUAL_NAME_REVIEW: 21
- MANUAL_REVIEW: 17
- SOURCE_ONLY_OR_DB_MISSING: 48

## Safety
- Supabase production writes: none.
- The staging validation SQL is SELECT-only.
- Fuzzy candidates are review hints only; they are not promoted to confirmed links.

## Current country-count deltas
- AE: GeoNames 7, Supabase 7, delta 0
- BH: GeoNames 4, Supabase 4, delta 0
- DJ: GeoNames 6, Supabase 6, delta 0
- DZ: GeoNames 58, Supabase 48, delta 10
- EG: GeoNames 27, Supabase 27, delta 0
- IQ: GeoNames 19, Supabase 19, delta 0
- JO: GeoNames 12, Supabase 12, delta 0
- KM: GeoNames 3, Supabase 3, delta 0
- KW: GeoNames 6, Supabase 6, delta 0
- LB: GeoNames 8, Supabase 8, delta 0
- LY: GeoNames 22, Supabase 15, delta 7
- MA: GeoNames 12, Supabase 12, delta 0
- MR: GeoNames 15, Supabase 14, delta 1
- OM: GeoNames 11, Supabase 14, delta -3
- PS: GeoNames 2, Supabase 13, delta -11
- QA: GeoNames 8, Supabase 8, delta 0
- SA: GeoNames 13, Supabase 13, delta 0
- SD: GeoNames 18, Supabase 18, delta 0
- SO: GeoNames 18, Supabase 13, delta 5
- SY: GeoNames 14, Supabase 14, delta 0
- TN: GeoNames 24, Supabase 24, delta 0
- YE: GeoNames 22, Supabase 21, delta 1
