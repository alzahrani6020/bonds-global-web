# ADM1 production rollout — 2026-10-20

## Production result

GeoNames ADM1 source identity is now linked to canonical Bonds ADM1 records using the canonical provider contract:

- source_code: `geonames`
- source_admin_code: full provider code such as `AE.07`
- source_id: GeoNames geoname_id

### Linked rows

- Strict confirmed: **232**
- Safe alias/transliteration batch: **44**
- Externally verified alias batch: **4**
- **Total production links: 280**

### Remaining unlinked

- Manual / structural review: **49**
- Confirmed remaining-manual rows accidentally linked: **0**

## Integrity verification

Post-rollout production checks:

- distinct linked admin areas: **280**
- distinct GeoNames admin codes: **280**
- distinct GeoNames IDs: **280**
- orphan source links: **0**
- country/admin-level scope mismatches: **0**
- duplicate GeoNames links to the same canonical admin area: **0**
- canonical ADM1 rows remain: **319**
- canonical geo_places remain: **1,362**

## Provider compatibility

- canonical provider `geonames`: present
- legacy provider `geonames_dump`: retained
- runtime ADM1 linker is fixed to `source_code=geonames`
- runtime linker upserts the canonical GeoNames provider inside the same write transaction

## Staging validation

Isolated Supabase staging project used for rollout validation:

- project: `bonds-global-adm1-staging`
- project ref: `gjwppwtgsecwmqlsmbmq`
- copied ADM1 rows: **319 / 22 countries**
- strict preflight: **232/232 valid**
- strict missing rows: **0**
- strict collisions: **0**
- rollback test: **232 inserted, then 0 after rollback**
- committed staging test: **232**
- idempotency test: second run remained **232**
- production-state simulation: provider recreated + **232** links + **0** orphan rows, then rolled back

## Alias rollout policy

The 48 high-confidence alias candidates were deliberately split:

- 44 mechanically safe aliases:
  - TRANSLITERATION
  - ARTICLE_VARIANT
  - DIRECTIONAL_VARIANT
  - TRANSLATION_VARIANT
  - ARTICLE_TRANSLITERATION
- 4 semantic/name-form aliases were held until independent verification:
  - LB.09 / GeoNames 278297
  - QA.01 / GeoNames 389470
  - QA.06 / GeoNames 389469
  - QA.08 / GeoNames 389462

Those four were verified against current GeoNames ADM1 records; the Lebanese mapping was additionally cross-checked against an official Lebanese government directory before rollout.

## Safety boundary

No automatic link was created for the remaining 49 rows. These require canonical-data remediation, duplicate cleanup, administrative-granularity decisions, or explicit missing-area additions rather than fuzzy matching.
