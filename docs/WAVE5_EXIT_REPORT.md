# Wave 5 Exit Report — Calculator Experience & Cleanup

> **Program:** BONDS Product Transformation Program (PTP) — Phase 2  
> **Wave:** 5 — Calculator Experience & Cleanup  
> **Date:** 2026-07-02  
> **Status:** ✅ Completed — all quality gates green  
> **Deployment:** https://bonds-global.com

---

## 1. Objectives

1. Unify the asset stack for the most-used calculators.
2. Move inline styles out of calculator pages into shared / per-page CSS.
3. Remove / redirect duplicate and outdated calculator pages.
4. Simplify the `factory-cost-*` variant maze into a single generic page.
5. Keep all automated quality gates green.

---

## 2. What Changed

### 2.1 Shared Design System

- Extended `styles/design-system.css` with calculator primitives:
  - `.ecc-input`, `.ecc-select`, `.ecc-form-group`
  - `.ecc-section`, `.ecc-section__title`
  - `.ecc-result-card`, `.ecc-scenario-card`
- These classes are now available to every page that loads the design system.

### 2.2 Top 9 Calculators (AR + EN)

Refactored both language versions of:

- `restaurant`
- `cash-flow`
- `pricing`
- `loan`
- `creditworthiness`
- `medical-viability`
- `feasibility`
- `dish-margin`
- `menu-engineering`

For each calculator:
- Added `styles/design-system.css` to the `<head>`.
- Extracted inline `<style>` blocks into a per-page external CSS file (e.g. `calculators/restaurant.css`).
- Kept all existing scripts and calculation logic untouched.
- Left the English mirrors consistent.

### 2.3 Duplicate / Outdated Page Cleanup

| Page | Action | Destination |
|---|---|---|
| `calculator-v2.html` | redirect | `/calculator.html` |
| `en/calculator-v2.html` | redirect | `/en/calculator.html` |
| `auth.html` | redirect | `/calculators/auth/index.html` |
| `auth-v2.html` | redirect | `/calculators/auth/index.html` |
| `en/auth-v2.html` | redirect | `/en/calculators/auth/index.html` |
| `calculators/menu-engineering-simple.html` | redirect | `menu-engineering.html` |
| `en/calculators/menu-engineering-simple.html` | redirect | `menu-engineering.html` |
| `calculators/feasibility-template-backup.html` | deleted | — |
| `en/calculators/feasibility-template-backup.html` | deleted | — |

All redirect pages now carry full OG / Twitter / canonical tags so the Open Graph audit stays clean.

### 2.4 Factory-Cost Consolidation

- Generated `calculators/factory-cost-countries.js` by extracting per-country configs from the existing 21 `factory-cost-*.html` variants (AR + EN).
- Rewrote `calculators/factory-cost.html` and `en/calculators/factory-cost.html` to use:
  - `factory-cost-shared.css` / `factory-cost-shared-en.css`
  - `factory-cost-shared.js`
  - `factory-cost-countries.js`
  - A new country selector that reads `?country=XX` and dynamically loads the matching country data.
- Replaced the 21 per-country files (AR + EN) with redirect pages pointing to the generic page with the correct `country` query parameter.
- Added 42 Vercel redirects in `vercel.json`:
  - `/calculators/factory-cost-ae` → `/calculators/factory-cost?country=AE`
  - `/en/calculators/factory-cost-ae` → `/en/calculators/factory-cost?country=AE`
  - ... for all 21 country codes.

### 2.5 Navigation & Sitemap

- Removed `menu-engineering-simple` from `calculators/shared-nav.js`.
- Removed deleted/redirected URLs from `sitemap.xml`:
  - `auth.html`, `auth-v2.html`, `calculator-v2.html`
  - `menu-engineering-simple.html`
  - `feasibility-template-backup.html`
  - all `factory-cost-*.html` variants
- Updated `auth-guard.js` auth-page allowlist: replaced `/auth.html` with `/auth` and `/auth-v2`.

### 2.6 Service Worker

- Bumped `sw.js` `CACHE_VERSION` from `v2.23.4` → `v2.23.5` to invalidate cached CSS/JS assets.

---

## 3. Quality Gates

| Gate | Result |
|---|---|
| `npm test` | ✅ 690 / 690 passed |
| `npm run audit` | ✅ 0 issues |
| `npm run audit:og` | ✅ all pages complete |
| `npm run test:a11y` | ✅ no critical/serious violations |
| `npm run test:mobile` | ✅ all mobile interactions passed |

---

## 4. New / Generated Files

- `styles/design-system.css` *(extended)*
- `calculators/factory-cost-countries.js`
- `calculators/restaurant.css`, `calculators/creditworthiness.css`, `calculators/medical-viability.css`, `calculators/feasibility.css`, `calculators/menu-engineering.css`
- `en/calculators/restaurant.css`, `en/calculators/cash-flow.css`, `en/calculators/pricing.css`, `en/calculators/loan.css`, `en/calculators/creditworthiness.css`, `en/calculators/medical-viability.css`, `en/calculators/feasibility.css`, `en/calculators/dish-margin.css`, `en/calculators/menu-engineering.css`
- `scripts/extract-factory-cost-countries.js`
- `scripts/build-generic-factory-cost.py`
- `scripts/add-redirect-og-tags.py`
- `scripts/refactor-top-calculators.py`
- `docs/WAVE5_EXIT_REPORT.md`

---

## 5. Notes & Next Steps

- The calculation logic of all 9 top calculators was preserved; only asset loading and style organization changed.
- `factory-cost.html` now serves as the single entry point for all 22 supported countries.
- Visual regression baselines were not regenerated because the Wave 5 quality gates focus on audit, accessibility, and mobile interaction.
