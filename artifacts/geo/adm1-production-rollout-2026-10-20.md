# ADM1 production rollout — final — 2026-10-20

## Source accounting

- GeoNames ADM1 source rows: **329**
- Production GeoNames links: **327**
- Explicit granularity exclusions: **2**
- Unaccounted rows: **0**
- Reconciliation coverage: **329/329 accounted**

## Production geography

- Canonical ADM1 rows: **355**
- Canonical geo_places: **1,362**
- GeoNames-linked ADM1 rows: **327**
- Link orphans: **0**
- Country/admin-level scope mismatches: **0**
- Duplicate GeoNames links to the same internal admin area: **0**

## Rollout classes

Production links were introduced in controlled batches:

- strict normalized-name matches
- mechanically safe transliteration/article/directional/translation aliases
- externally verified semantic aliases
- duplicate-keeper selections
- new current canonical ADM1 additions
- Oman split-governorate mappings
- Libya GeoNames ADM1 parallel model
- Somalia GeoNames region parallel model
- Algeria GeoNames 58-wilaya source model, explicitly marked stale against the current official 69-wilaya model

## Explicitly excluded source rows

### PS.GZ — Gaza Strip — GeoNames 281132
No direct source link was created. GeoNames models this as a broad ADM1 territorial unit while Bonds stores individual Palestinian governorates.

### PS.WE — West Bank — GeoNames 285153
No direct source link was created for the same granularity reason.

The two exclusions are recorded in `public.geo_data_sources.metadata.adm1_reconciliation`.

## New canonical ADM1 rows added during remediation

Current/additive rows were introduced only when the existing internal model lacked a source-level unit and the addition passed rollback simulation and in-transaction assertions.

Notable additions include:
- Halabja Governorate
- Tiris Zemmour Region
- Gabes Governorate
- Amanat Alasimah
- 11 Libya GeoNames ADM1 units as a parallel source model
- 8 Somalia GeoNames regions as a parallel source model
- 13 Algeria GeoNames 58-model wilayas marked `stale_vs_official_69=true`

## Place hierarchy corrections

The following existing place identities were retained and only `admin1_id` was corrected:
- Halabja → Halabja Governorate
- Zouerate → Tiris Zemmour
- Gabes → Gabes Governorate
- Sanaa → Amanat Alasimah

## Legacy coexistence

The rollout deliberately did **not** delete legacy canonical rows in cases where cleanup has wider downstream implications.

Examples:
- Libya: Bayda / Al Khums / Ubari / Tarhuna remain for later cleanup.
- Somalia: Puntland / Somaliland / Bay and Bakool remain as macro-region records.
- Oman: legacy combined Ash Sharqiyah / Al Batinah rows remain alongside split governorates.
- Duplicate legacy rows in Algeria, Iraq, Oman, and Tunisia remain for a separate canonical-cleanup migration even where GeoNames source links now point to selected keepers.

## Safety controls

Every production mutation batch used:
1. read-only preflight,
2. rollback simulation for new matching/remediation logic,
3. in-transaction assertions,
4. post-commit verification.

The runtime ingestion pipeline is additionally fail-closed and requires explicit write opt-ins.
