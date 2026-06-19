# System Audit — Bonds Global Enterprise Upgrade

## 1. Architecture Overview

- **Stack**: Static HTML/CSS/JS frontend hosted on Vercel + Vercel Serverless API functions + Supabase (Postgres + Auth + Storage).
- **Admin modules**: SPA-style pages loaded inside an iframe in `admin/dashboard.html`.
- **Mirrors**: Arabic root (`/`) and English mirror (`/en/`) maintained manually.
- **PWA**: Service Worker caches core assets manually via `CACHE_VERSION`.

## 2. Critical Findings

| ID | Severity | Issue | Location / Evidence |
|----|----------|-------|---------------------|
| SYS-01 | **Critical** | Multiple competing authentication modules | `bonds-auth.js`, `bonds-auth-2026.js`, `admin-auth.js`, `admin-auth-v2.js`, `auth-guard.js` |
| SYS-02 | **Critical** | No centralized input validation / business-rules layer | All `api/*.js` and admin SPA modules validate ad-hoc |
| SYS-03 | **High** | Manual Arabic/English mirroring (226 HTML files) | `calculators/*.html` ↔ `en/calculators/*.html`, root ↔ `en/` |
| SYS-04 | **High** | Heavy use of `innerHTML` with dynamic content (112 occurrences) | `admin/financial-advisory/app.js`, `admin/city-intelligence/app.js`, `admin/distressed-recovery/app.js`, etc. |
| SYS-05 | **High** | `console.log` left in production code (444 occurrences across 94 files) | Frontend calculators, admin modules, APIs |
| SYS-06 | **High** | No centralized error handling or user-facing error boundaries | Each module handles errors independently |
| SYS-07 | **Medium** | Service Worker cache version is manual and error-prone | `sw.js` `CACHE_VERSION` |
| SYS-08 | **Medium** | Multiple Supabase client initializations | `supabase-client.js`, `bonds-auth-2026.js`, module service files |
| SYS-09 | **Medium** | No test coverage for admin modules, API functions, or workflows | Only `bonds-geo.test.js` and `calc-functions.test.js` |
| SYS-10 | **Medium** | Hardcoded business constants (prices, margins, tiers) scattered in code | `api/pro.js`, dashboard, AI advisor settings |
| SYS-11 | **Low** | No TypeScript / strict typing | Entire codebase is vanilla JS |
| SYS-12 | **Low** | No API documentation or OpenAPI spec | `api/` folder lacks docs |

## 3. Bottlenecks

- **226 HTML files** and **288 JS files** create a large deploy footprint and slow cache warming.
- Every calculator loads Chart.js, jsPDF, html2canvas, SheetJS even when not used.
- Admin modules fetch entire tables (e.g., all clients, all projects) without pagination.
- Real-time Supabase subscriptions are not always cleaned up, risking memory leaks.

## 4. Technical Debt

- Duplicated UI patterns: sidebars, navs, forms repeated per module.
- Legacy `api-old/` folder still exists and may be referenced.
- `v3/` and root code share similar concepts (funding sources, intelligence) but are not unified.
- Scripts in `scripts/` are mostly one-off setup utilities with overlapping responsibilities.

## 5. Compatibility Risks

- `admin/dashboard.html` iframe communication relies on `postMessage` with session objects; modules vary in how they consume the session.
- Module CSS classes differ (`fa-*`, `ai-*`, city-intelligence uses its own) making global embed styles fragile.
- `?embed=1` detection is inconsistent across modules.

## 6. Recommendations

1. Consolidate auth into a single module (`bonds-auth-2026.js`) and deprecate others.
2. Introduce a shared `BondsValidation` and `BondsError` library used by all modules/APIs.
3. Replace `innerHTML` with DOM APIs or a minimal templating function with escaping.
4. Strip `console.log` from production builds via pre-commit lint.
5. Add Jest tests for API functions and admin modules.
6. Introduce pagination and search for all list views.
7. Move business constants to `site_settings` DB table or env-driven config.
8. Automate cache-busting via build hash instead of manual `CACHE_VERSION`.
