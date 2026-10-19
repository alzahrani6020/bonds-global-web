# Saudi Arabia Readiness Baseline

Saudi Arabia is the reference market for Bonds V3. The platform must not mark Saudi Arabia complete until every gate below is satisfied or explicitly classified as non-applicable.

## Completion gates

### 1. Country profile
- country_profiles contains SA
- currency is SAR
- fallback_policy is no_cross_country_fallback
- status: PASS when all conditions hold

### 2. Cities
- Saudi cities are present and active
- city records are scoped to SA
- status: PASS when city coverage exists and no cross-country leakage is detected

### 3. Market data
- currency provenance must be explicit
- local Saudi market values must use SAR
- records with missing currency are not usable as monetary evidence
- source must be present for evidence-backed use
- modeled/estimated values remain labeled as such
- status: PASS when monetary rows used in decisions have currency and provenance

### 4. City indicators
- currency-bearing indicators use SAR
- confidence is recorded
- source/evidence quality remains visible
- status: PASS when monetary indicator provenance is complete

### 5. Macro context
- country-level indicators are source-backed
- freshness is measured per metric
- stale data remains visible as stale
- status: PASS when minimum macro coverage is present

### 6. Economic activities
- canonical Bonds activity identity is retained
- Saudi applicability/classification must be mapped to an official Saudi classification source
- unknown does not imply available or unavailable
- status: BLOCKED until Saudi activity mappings are source-backed

Primary official reference:
- GASTAT National Classification of Economic Activities (ISIC Rev.4)

### 7. Financial models
- estimated models may be used only as estimated
- verified status requires source-backed Saudi assumptions
- tax, financing, inflation, rent, salary, utilities and other overrides must not be invented
- status: BLOCKED until required model inputs are source-backed and verification criteria are met

### 8. Regulation
- regulatory requirements must be country-scoped
- official source URL and issuing authority are required
- legacy unscoped regulatory rows are not promoted automatically
- status: BLOCKED until Saudi requirements are rebuilt from official sources

### 9. Calculation gate
- verified/local calculations must reject unverified country financial models
- exploratory analysis may use estimated inputs only when disclosed
- status: PASS only when calculation mode matches model verification status

## Exit rule

Saudi Arabia is COMPLETE only when:
- country profile: PASS
- cities: PASS
- market data: PASS
- city indicators: PASS
- macro context: PASS
- activities: PASS
- financial models: PASS
- regulation: PASS
- calculation gate: PASS

No other country should be declared complete using Saudi data, Saudi currency labels, or Saudi regulatory assumptions.
