# GeoNames ADM1 final reconciliation ledger — 2026-10-20

## Final accounting

- Source GeoNames ADM1 rows: **329**
- Production links: **327**
- Explicit granularity exclusions: **2**
- Unaccounted rows: **0**
- Accounted total: **329/329**

## Production state

- Canonical ADM1 rows: **355**
- Geo places: **1,362**
- GeoNames source links: **327**
- Link orphans: **0**
- Link country/admin-level mismatches: **0**
- Duplicate GeoNames links to the same admin area: **0**

## Explicit exclusions

- **PS.GZ / 281132 / Gaza Strip** — blocked because the GeoNames record is broader than the internal 13-governorate model.
- **PS.WE / 285153 / West Bank** — blocked for the same granularity reason.

These are deliberate exclusions, not failed matches.

## Model notes

### Algeria
The reconciled GeoNames source uses the GeoNames 58-wilaya model. Thirteen GeoNames ADM1 rows added during reconciliation are marked `stale_vs_official_69=true` because the current Algerian legal model has moved beyond this source model. They remain valid as GeoNames source identities, not as a claim that the source is the current legal administrative reference.

### Libya
Eleven GeoNames ADM1 rows were added as a parallel `geonames_adm1_model`. Existing legacy Bayda / Al Khums / Ubari / Tarhuna rows were not deleted or deactivated by this rollout.

### Somalia
Eight GeoNames regions were added as a parallel `geonames_region_model`. Existing macro-region rows such as Puntland, Somaliland, and Bay and Bakool were intentionally retained.

### Palestine
No forced links were created from Gaza Strip or West Bank to individual governorates.

## Hierarchy corrections performed separately

Four existing places were reparented to newly established current ADM1 rows without changing their place identity:
- Halabja → Halabja Governorate
- Zouerate → Tiris Zemmour
- Gabes → Gabes Governorate
- Sanaa → Amanat Alasimah

## Safety

Every production write batch used:
1. read-only preflight,
2. a rollback simulation when the batch introduced new matching logic,
3. in-transaction assertions,
4. external verification after commit.

No fuzzy-only candidate was promoted directly.
