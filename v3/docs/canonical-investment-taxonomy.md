# Bonds V3 Canonical Investment Taxonomy

This layer is additive. It does not replace or delete the legacy economic taxonomy.

## Hierarchy

Country
→ Canonical Investment Sector
→ Canonical Investment Subsector
→ Canonical Activity
→ Project Model
→ Project Size
→ Business Form
→ Opportunity Type
→ Country Localization / Regulation / Market Evidence / Financial Model

## Current canonical dimensions

- 40 investment sectors
- 122 investment subsectors
- Active canonical activities are the user-facing catalog; inactive duplicates remain as aliases (`canonical_activity_code_aliases`) and are not deleted
- Article-only Arabic variants (`مقاهي` / `المقاهي`) and English plurals (`cafe` / `cafes`) consolidate onto one survivor
- 6 project sizes
- 12 business forms
- 18 opportunity types
- Published project models are classified in `project_model_canonical_reconciliation` as mapped / unmapped / ambiguous / inactive / unpublished
- 69 legacy economic sectors mapped to canonical investment sectors
- 13 Saudi productive-family candidates stored as country-scoped, unverified business-form eligibility

## Productive families

Productive Family is a business form, not a sector.

It may be attached to suitable activities under the relevant sector, for example:
- food manufacturing
- agriculture
- trade / e-commerce
- creative economy
- selected digital activities

Country-specific regulatory verification is required before treating productive-family eligibility as verified.

## Safety rules

- no legacy sector/activity/model rows are deleted
- duplicate canonical identities are deactivated and aliased, not dropped
- canonical mappings are additive
- taxonomy mappings do not imply regulatory availability
- business-form eligibility does not imply licensing approval
- country-specific verification remains authoritative
