# Wave 6 Exit Report — Auth Cleanup & Client Portal Entry Consolidation

> **Program:** BONDS Product Transformation Program (PTP) — Phase 2  
> **Wave:** 6 — Auth Cleanup & Client Portal Entry Consolidation  
> **Date:** 2026-07-02  
> **Status:** ✅ Completed — all quality gates green  
> **Deployment:** https://bonds-global.com  
> **Deployment URL:** https://bonds-global-4nifzs5nq-dr-talal.vercel.app

---

## 1. Objectives

1. Unify the client authentication stack.
2. Fix broken login/entry points.
3. Remove exposed credentials.
4. Improve the onboarding experience.
5. Consolidate the logged-in client journey around `/v3/portfolio`.
6. Keep all quality gates green.

---

## 2. What Changed

### 2.1 Auth Stack Unification

- Removed `supabase-client.js` from pages that were loading it alongside `bonds-auth-2026.js`:
  - `v3/project/index.html` (AR + EN)
  - `v3/portfolio/index.html` (AR + EN)
  - `calculators/restaurant.html` (AR + EN)
  - `calculators/menu-engineering.html` (AR + EN) — migrated from `supabase-client.js` to `bonds-auth-2026.js`
  - `pricing.html` (AR + EN)
- `site-layout.js` now points the header "Client Portal" link to `/v3/portfolio` (AR) and `/en/v3/portfolio` (EN).

### 2.2 Broken Entry Points Fixed

| Page | Fix |
|---|---|
| `/pro/login.html` | `api/platform.js` now routes `signin`/`signup` actions to the `proAuth` handler (was only accepting `auth`). |
| `/verify.html` | Replaced the debug page that exposed `SUPABASE_URL`/`SUPABASE_KEY` with a redirect to `/calculators/auth/index.html`. |
| `/calculators/auth/login.html` | Already a redirect to `index.html`; left unchanged with full OG tags. |

### 2.3 Onboarding Improved

- Added a **"Skip for now / تخطي الآن"** button to:
  - `calculators/auth/onboarding.html`
  - `en/calculators/auth/onboarding.html`
- Skip saves a minimal profile and stores `bonds_onboarding_skipped` in `sessionStorage`.
- `auth-guard.js` now allows skipping onboarding for **24 hours**.
- Default post-onboarding redirect changed from `/calculators/dashboard.html` to `/v3/portfolio`.

### 2.4 Client Portal Consolidation

- `/client/index.html` and `/en/client/index.html` now redirect to `/v3/portfolio` unless opened with `?wizard=1`.
- `/client/login.html` and `/en/client/login.html` redirect to the unified auth page with a return URL to the portfolio.
- `/client/reports.html`, `/client/report.html`, and their EN mirrors redirect to `/v3/portfolio`.
- `/client/project.html` kept as a redirect to `/v3/project?id=...`.
- `client/portal.js` now opens the new-project wizard automatically when `?wizard=1` is present.
- `/v3/portfolio/portfolio-dashboard.js` "Create project" button now opens `/client/index.html?wizard=1` (AR) or `/en/client/index.html?wizard=1` (EN).
- Added an auth guard to `/v3/portfolio/index.html` and `/en/v3/portfolio/index.html` so anonymous users are redirected to login.

### 2.5 Homepage & Navigation Links

- Replaced all `client/index.html` links in:
  - `index.html` → `/v3/portfolio`
  - `en/index.html` → `/en/v3/portfolio`
  - `advisors.html` → `/v3/portfolio`
  - `en/advisors.html` → `/en/v3/portfolio`
  - `advisor/index.html` login link → `/calculators/auth/index.html?redirect=/v3/portfolio`
  - `en/advisor/index.html` login link → `/en/calculators/auth/index.html?redirect=/en/v3/portfolio`
  - `calculators/creditworthiness.html` CTA → `/calculators/auth/index.html?redirect=/v3/portfolio`
  - `en/calculators/creditworthiness.html` CTA → `/en/calculators/auth/index.html?redirect=/en/v3/portfolio`
- Removed `/verify.html` from `sitemap.xml`.

### 2.6 Service Worker

- Bumped `sw.js` `CACHE_VERSION` from `v2.23.5` → `v2.23.6`.

---

## 3. Quality Gates

| Gate | Result |
|---|---|
| `npm test` | ✅ 690 / 690 passed |
| `npm run audit` | ✅ 0 issues |
| `npm run audit:og` | ✅ all pages complete |
| `npm run test:a11y` | ✅ no critical/serious violations |
| `npm run test:mobile` | ✅ all interactions passed |

---

## 4. Key Files Changed

- `api/platform.js`
- `verify.html`
- `client/index.html`, `client/login.html`, `client/reports.html`, `client/report.html`
- `en/client/index.html`, `en/client/login.html`, `en/client/reports.html`, `en/client/report.html`
- `client/portal.js`
- `v3/portfolio/index.html`, `v3/portfolio/portfolio-dashboard.js`
- `en/v3/portfolio/index.html`
- `calculators/auth/onboarding.html`, `en/calculators/auth/onboarding.html`
- `auth-guard.js`
- `site-layout.js`
- `index.html`, `en/index.html`
- `advisors.html`, `en/advisors.html`, `advisor/index.html`, `en/advisor/index.html`
- `calculators/creditworthiness.html`, `en/calculators/creditworthiness.html`
- `calculators/menu-engineering.html`, `en/calculators/menu-engineering.html`
- `calculators/restaurant.html`, `en/calculators/restaurant.html`
- `pricing.html`, `en/pricing.html`
- `v3/project/index.html`, `en/v3/project/index.html`
- `sw.js`
- `sitemap.xml`
- `docs/WAVE6_EXIT_REPORT.md`

---

## 5. Notes

- The old `/client/` portal is preserved only as a host for the new-project wizard (`?wizard=1`).
- `/pro/` now uses the same `proAuth` endpoint correctly.
- Visual regression baselines were not regenerated; the Wave 6 gates focus on audit, accessibility, and mobile interaction.
