# ADM1 reconciliation report — 2026-10-20

Read-only comparison of the uploaded GeoNames ADM1 source against `public.geo_admin_areas` (`admin_level=1`) in Supabase project `hutxsqzplyuqgnghsrcs`.

## Result

- GeoNames rows: 329
- Supabase ADM1 rows: 319
- CONFIRMED: 232
- AMBIGUOUS: 6
- UNMATCHED: 91
- Production writes: **none**

## Classification rule

- **CONFIRMED**: exactly one Supabase row in the same country has an English name equal after conservative normalization (Unicode accent removal, punctuation spacing, and removal of generic administrative suffixes).
- **AMBIGUOUS**: more than one Supabase row has that same normalized English name.
- **UNMATCHED**: no exact normalized English-name match. Up to three fuzzy review candidates are included in the CSV, but they are **not** treated as confirmed evidence.

This deliberately avoids promoting fuzzy or semantic similarity to a confirmed source link.

## By country

| Country | GeoNames | Confirmed | Ambiguous | Unmatched |
|---|---:|---:|---:|---:|
| AE | 7 | 7 | 0 | 0 |
| BH | 4 | 3 | 0 | 1 |
| DJ | 6 | 6 | 0 | 0 |
| DZ | 58 | 42 | 3 | 13 |
| EG | 27 | 24 | 0 | 3 |
| IQ | 19 | 15 | 1 | 3 |
| JO | 12 | 11 | 0 | 1 |
| KM | 3 | 3 | 0 | 0 |
| KW | 6 | 1 | 0 | 5 |
| LB | 8 | 7 | 0 | 1 |
| LY | 22 | 5 | 0 | 17 |
| MA | 12 | 11 | 0 | 1 |
| MR | 15 | 10 | 0 | 5 |
| OM | 11 | 8 | 1 | 2 |
| PS | 2 | 0 | 0 | 2 |
| QA | 8 | 4 | 0 | 4 |
| SA | 13 | 9 | 0 | 4 |
| SD | 18 | 12 | 0 | 6 |
| SO | 18 | 6 | 0 | 12 |
| SY | 14 | 13 | 0 | 1 |
| TN | 24 | 21 | 1 | 2 |
| YE | 22 | 14 | 0 | 8 |

## Known ambiguous source rows

- DZ.25 / 2491188 / Laghouat: BG-ADM1-DZ-14, BG-ADM1-DZ-32
- DZ.42 / 2498541 / El Bayadh: BG-ADM1-DZ-40, BG-ADM1-DZ-41
- DZ.38 / 2505525 / Bechar: BG-ADM1-DZ-13, BG-ADM1-DZ-38
- IQ.17 / 98862 / Najaf: BG-ADM1-IQ-13, BG-ADM1-IQ-19
- OM.03 / 411737 / Al Wusta Governorate: BG-ADM1-OM-06, BG-ADM1-OM-14
- TN.02 / 2473460 / Kasserine Governorate: BG-ADM1-TN-13, BG-ADM1-TN-15

## Safety

No INSERT, UPDATE, DELETE, DDL, source-link creation, or promotion was executed against Supabase.
