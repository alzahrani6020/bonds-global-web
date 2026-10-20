# ADM1 unresolved root-cause assessment — 2026-10-20

This assessment starts **after** 232 strict matches and 48 high-confidence alias-review pairs. It does not modify production.

## Bahrain (1)
- GeoNames `BH.16 Manama` vs internal `Capital Governorate`.
- Root cause: **semantic naming difference**.
- Action: require explicit alias evidence before promotion.

## Algeria (16)
- Ambiguous due internal duplicates:
  - `DZ.25 Laghouat` -> two internal Laghouat rows.
  - `DZ.42 El Bayadh` -> two internal El Bayadh rows; one has Arabic name for Saida, indicating a data-quality defect.
  - `DZ.38 Bechar` -> two internal Bechar rows.
- Source rows with no remaining internal counterpart include `Tebessa`, `Bouira`, `Blida` and ten newer provinces: Bordj Badji Mokhtar, Timimoun, Beni Abbes, In Guezzam, In Salah, Djanet, El Menia, Touggourt, El Mghair, Ouled Djellal.
- Root cause: **internal duplicates + incomplete/outdated ADM1 coverage**.
- Action: repair duplicate legacy rows first, then add missing provinces through a separately reviewed data migration.

## Iraq (2)
- `IQ.17 Najaf`: two internal Najaf rows.
- `IQ.19 Halabja`: no internal counterpart remains.
- Root cause: **internal duplicate + missing ADM1**.
- Action: deduplicate Najaf; separately review adding Halabja.

## Kuwait (1)
- `KW.02 Al Asimah` vs internal `Capital Governorate` / Arabic `محافظة العاصمة`.
- Root cause: **semantic/translation naming difference**.
- Action: manual alias approval.

## Libya (11)
- Remaining GeoNames rows: Al Marj, Surt, Nalut, Wadi ash Shati, Al Jufrah, An Nuqat al Khams, Al Butnan, Jabal al Gharbi, Al Marqab, Al Wahat, Wadi al Hayat.
- Remaining internal rows include Bayda, Al Khums, Ubari, Tarhuna.
- Root cause: **legacy territorial model vs current source coverage**.
- Action: country-level reconciliation; do not create one-off links until the Libya ADM1 model is selected.

## Mauritania (1)
- `MR.11 Tiris Zemmour` has no internal counterpart after alias reconciliation.
- Root cause: **missing ADM1**.
- Action: review addition as a canonical internal area.

## Oman (3)
- `OM.03 Al Wusta` maps to two internal Al Wusta rows.
- `Southeastern Governorate` / `Northeastern Governorate` coexist with internal legacy `Ash Sharqiyah` plus North/South split rows.
- Internal also retains legacy `Al Batinah Governorate` alongside split governorates.
- Root cause: **legacy + split administrative structures and duplicate rows**.
- Action: define canonical current structure, then retire/link legacy rows explicitly.

## Palestine (2)
- GeoNames source has `Gaza Strip` and `West Bank`; internal data has 13 governorates.
- Root cause: **granularity mismatch**.
- Action: do not link these records directly to governorates. Treat them as a different administrative/territorial layer.

## Qatar (1)
- `QA.04 Al Khor` vs internal `Al Khor and Al Thakhira Municipality`.
- Root cause: **name/scope evolution**.
- Action: require explicit source-history evidence before alias promotion.

## Somalia (8)
- Remaining source regions do not map one-to-one to internal macro/combined rows such as `Puntland`, `Somaliland`, and `Bay and Bakool`.
- Root cause: **mixed granularity / regional aggregation model**.
- Action: choose whether internal ADM1 is federal-region level or product macro-region level before linking.

## Tunisia (2)
- `TN.02 Kasserine`: two internal Kasserine rows.
- `TN.29 Gabes`: no remaining internal counterpart because the duplicate Kasserine occupies the corresponding internal slot.
- Root cause: **internal duplicate causing missing governorate coverage**.
- Action: repair the duplicated Kasserine/Gabes data pair before source linking.

## Yemen (1)
- `YE.26 Amanat Alasimah` remains with no internal counterpart.
- Root cause: **missing/distinct capital-municipality ADM1 representation**.
- Action: review whether Amanat Al Asimah should be a separate canonical ADM1 from Sana'a Governorate.

## Recommended remediation order
1. Repair internal duplicates: Algeria, Iraq, Oman, Tunisia.
2. Decide granularity/model policy: Palestine, Somalia, Libya, Oman.
3. Review missing canonical ADM1 additions: Algeria, Iraq/Halabja, Mauritania, Tunisia/Gabes, Yemen.
4. Approve semantic aliases separately: Bahrain, Kuwait, Qatar.
