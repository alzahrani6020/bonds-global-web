# Bonds Global — Routes Map

> Route map derived from HTML pages and `vercel.json` rewrites.  
> `vercel.json` uses `cleanUrls: true` and `trailingSlash: false`, so `/page.html` is also reachable as `/page`.

## Legend

| Layout | Meaning |
|---|---|
| `site-layout.js` | Injected shared header/footer via `<div id="site-header">` / `<div id="site-footer">` |
| `header-footer.css` | Static header/footer styling only (no dynamic injection) |
| `auth-shared.css` | Auth-centered minimal layout |
| `standalone` | Custom/legacy layout, no shared header/footer |
| `N/A` | API route |

| Middleware | Meaning |
|---|---|
| `none` | No access check |
| `auth-guard.js` | Header avatar/login state only (no page blocking) |
| `usage-guard.js` | Passive free-tier usage banner |
| `admin-only` | `bonds-auth-2026.js` / `admin-auth-v2.js` admin guard |
| `Stripe signature` | Webhook signature verification |

---

## 1. Marketing pages (Arabic)

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/` | `index.html` | marketing | `site-layout.js` | none | public |
| `/about.html` | `about.html` | marketing | `site-layout.js` | none | public |
| `/services.html` | `services.html` | marketing | `site-layout.js` | none | public |
| `/contact.html` | `contact.html` | marketing | `site-layout.js` | none | public |
| `/pricing.html` | `pricing.html` | marketing | `site-layout.js` | `auth-guard.js` (UI only) | public |
| `/faq.html` | `faq.html` | marketing | `site-layout.js` | none | public |
| `/methodology.html` | `methodology.html` | marketing | `site-layout.js` | none | public |
| `/terms.html` | `terms.html` | marketing | `site-layout.js` | none | public |
| `/privacy.html` | `privacy.html` | marketing | `site-layout.js` | none | public |
| `/calculator.html` | `calculator.html` | marketing | `site-layout.js` | none | public |
| `/calculator-v2.html` | `calculator-v2.html` | marketing | standalone | none | public |
| `/partner-portal-guide.html` | `partner-portal-guide.html` | marketing | standalone | none | public |
| `/suppliers-guide.html` | `suppliers-guide.html` | marketing | standalone | none | public |
| `/pitch.html` | `pitch.html` | marketing | standalone | none | public |
| `/pitch-print.html` | `pitch-print.html` | marketing | standalone | none | public |
| `/auth.html` | `auth.html` | auth | standalone | none | public (legacy) |
| `/auth-v2.html` | `auth-v2.html` | auth | standalone | none | public (legacy) |
| `/verify.html` | `verify.html` | utility | standalone | none | public |
| `/v.html` | `v.html` | utility | standalone | none | public |
| `/proof.html` | `proof.html` | utility | standalone | none | public |
| `/test.html` | `test.html` | utility | standalone | none | public |
| `/modon_home.html` | `modon_home.html` | utility | standalone | none | public |
| `/modon_eservices.html` | `modon_eservices.html` | utility | standalone | none | public |
| `/دراسة-جدوى-إحياء-الأصول-الملقحة.html` | `دراسة-جدوى-إحياء-الأصول-الملقحة.html` | marketing | standalone | none | public |

## 2. Marketing pages (English)

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/en/` | `en/index.html` | marketing | `site-layout.js` | none | public |
| `/en/about.html` | `en/about.html` | marketing | `site-layout.js` | none | public |
| `/en/services.html` | `en/services.html` | marketing | `site-layout.js` | none | public |
| `/en/contact.html` | `en/contact.html` | marketing | `site-layout.js` | none | public |
| `/en/pricing.html` | `en/pricing.html` | marketing | `site-layout.js` | `auth-guard.js` (UI only) | public |
| `/en/faq.html` | `en/faq.html` | marketing | `site-layout.js` | none | public |
| `/en/methodology.html` | `en/methodology.html` | marketing | `site-layout.js` | none | public |
| `/en/terms.html` | `en/terms.html` | marketing | `site-layout.js` | none | public |
| `/en/privacy.html` | `en/privacy.html` | marketing | `site-layout.js` | none | public |
| `/en/calculator.html` | `en/calculator.html` | marketing | `site-layout.js` | none | public |
| `/en/partner-portal-guide.html` | `en/partner-portal-guide.html` | marketing | standalone | none | public |
| `/en/suppliers-guide.html` | `en/suppliers-guide.html` | marketing | standalone | none | public |
| `/en/pitch.html` | `en/pitch.html` | marketing | standalone | none | public |
| `/en/pitch-print.html` | `en/pitch-print.html` | marketing | standalone | none | public |

## 3. Blog

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/blog/` | `blog/index.html` | blog | `header-footer.css` | none | public |
| `/blog/break-even-explained.html` | `blog/break-even-explained.html` | blog | standalone | none | public |
| `/blog/cash-flow-mistakes.html` | `blog/cash-flow-mistakes.html` | blog | standalone | none | public |
| `/blog/financial-kpis.html` | `blog/financial-kpis.html` | blog | standalone | none | public |
| `/blog/pricing-strategy.html` | `blog/pricing-strategy.html` | blog | standalone | none | public |
| `/blog/tax-zakat-sme.html` | `blog/tax-zakat-sme.html` | blog | standalone | none | public |
| `/blog/en/` | `blog/en/index.html` | blog | standalone | none | public |
| `/blog/en/*.html` | `blog/en/*.html` | blog | standalone | none | public |
| `/break-even-explained.html` | → `/blog/break-even-explained.html` | blog | — | none | public |
| `/cash-flow-mistakes.html` | → `/blog/cash-flow-mistakes.html` | blog | — | none | public |
| `/financial-kpis.html` | → `/blog/financial-kpis.html` | blog | — | none | public |
| `/pricing-strategy.html` | → `/blog/pricing-strategy.html` | blog | — | none | public |
| `/tax-zakat-sme.html` | → `/blog/tax-zakat-sme.html` | blog | — | none | public |

## 4. Sector guides

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/sectors/manufacturing.html` | `sectors/manufacturing.html` | sector | `site-layout.js` | none | public |
| `/sectors/manufacturing-*.html` | `sectors/manufacturing-*.html` | sector | `site-layout.js` | none | public |
| `/en/sectors/manufacturing.html` | `en/sectors/manufacturing.html` | sector | `site-layout.js` | none | public |
| `/en/sectors/manufacturing-*.html` | `en/sectors/manufacturing-*.html` | sector | `site-layout.js` | none | public |

## 5. Calculators (Arabic)

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/calculators/cash-flow.html` | `calculators/cash-flow.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/dashboard.html` | `calculators/dashboard.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/dish-margin.html` | `calculators/dish-margin.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/loan.html` | `calculators/loan.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/pricing.html` | `calculators/pricing.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/medical-viability.html` | `calculators/medical-viability.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/menu-engineering-simple.html` | `calculators/menu-engineering-simple.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/menu-engineering.html` | `calculators/menu-engineering.html` | calculator | `site-layout.js` | `auth-guard.js` + `usage-guard.js` | public (features gated) |
| `/calculators/restaurant.html` | `calculators/restaurant.html` | calculator | `site-layout.js` | `auth-guard.js` + `usage-guard.js` | public (features gated) |
| `/calculators/feasibility.html` | `calculators/feasibility.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/feasibility-template.html` | `calculators/feasibility-template.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/feasibility-template-real-estate.html` | `calculators/feasibility-template-real-estate.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/feasibility-template-backup.html` | `calculators/feasibility-template-backup.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/invoice-analyzer.html` | `calculators/invoice-analyzer.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/factory-cost.html` | `calculators/factory-cost.html` | calculator | `site-layout.js` | `usage-guard.js` | public (features gated) |
| `/calculators/factory-cost-ae.html` … `/calculators/factory-cost-ye.html` | `calculators/factory-cost-*.html` | calculator | `site-layout.js` / `header-footer.css` | `usage-guard.js` / none | public |
| `/calculators/factory-cost-{dj,km,mr,ps,so}.html` | `calculators/factory-cost-*.html` | calculator | `header-footer.css` | none | public |

> The light English-style factory-cost pages (`dj, km, mr, ps, so`) use only `header-footer.css` and do not load `usage-guard.js`.

## 6. Calculators (English)

Same structure as Arabic calculators under `/en/calculators/`, with the same layout/middleware/permission rules.

## 7. Auth pages

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/calculators/auth/` | `calculators/auth/index.html` | auth | `auth-shared.css` | none | public |
| `/calculators/auth/login.html` | `calculators/auth/login.html` | auth | standalone | none | public (redirects to index) |
| `/calculators/auth/onboarding.html` | `calculators/auth/onboarding.html` | auth | `auth-shared.css` | none | authenticated |
| `/calculators/auth/profile.html` | `calculators/auth/profile.html` | auth | `auth-shared.css` | none | authenticated |
| `/calculators/auth/account.html` | `calculators/auth/account.html` | auth | `auth-shared.css` | none | authenticated |
| `/calculators/auth/subscription.html` | `calculators/auth/subscription.html` | auth | standalone | none | authenticated |
| `/calculators/auth/reset.html` | `calculators/auth/reset.html` | auth | `auth-shared.css` | none | public |
| `/calculators/auth/verify-email.html` | `calculators/auth/verify-email.html` | auth | standalone | none | public |
| `/calculators/auth/verify-otp.html` | `calculators/auth/verify-otp.html` | auth | `auth-shared.css` | none | public |
| `/calculators/auth/confirmed.html` | `calculators/auth/confirmed.html` | auth | standalone | none | public |
| `/calculators/auth/debug.html` | `calculators/auth/debug.html` | auth | standalone | none | authenticated (dev tool) |
| `/calculators/auth/diagnose.html` | `calculators/auth/diagnose.html` | auth | standalone | none | authenticated (dev tool) |

Same pages mirrored under `/en/calculators/auth/`.

## 8. Admin pages

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/admin/dashboard.html` | `admin/dashboard.html` | admin | standalone | `admin-only` (`initAdminGuard`) | admin |
| `/admin/analytics.html` | `admin/analytics.html` | admin | standalone | `admin-only` | admin |
| `/admin/users.html` | `admin/users.html` | admin | standalone | `admin-only` | admin |
| `/admin/subscriptions.html` | `admin/subscriptions.html` | admin | standalone | `admin-only` | admin |
| `/admin/messages.html` | `admin/messages.html` | admin | standalone | `admin-only` | admin |
| `/admin/roles.html` | `admin/roles.html` | admin | standalone | `admin-only` | admin |
| `/admin/exceptions.html` | `admin/exceptions.html` | admin | standalone | `admin-only` | admin |
| `/admin/bank-transfers.html` | `admin/bank-transfers.html` | admin | standalone | `admin-only` | admin |
| `/admin/settings.html` | `admin/settings.html` | admin | standalone | `admin-only` | admin |
| `/admin/reset.html` | `admin/reset.html` | admin | standalone | none | public page; API owner-only |
| `/admin/force-reset.html` | `admin/force-reset.html` | admin | standalone | none | public page; API owner-only |
| `/en/admin/dashboard.html` | `en/admin/dashboard.html` | admin | standalone | `admin-only` | admin |
| `/en/admin/analytics.html` | `en/admin/analytics.html` | admin | standalone | `admin-only` | admin |
| `/en/admin/messages.html` | `en/admin/messages.html` | admin | standalone | `admin-only` | admin |
| `/en/admin/roles.html` | `en/admin/roles.html` | admin | standalone | `admin-only` | admin |
| `/en/admin/subscriptions.html` | `en/admin/subscriptions.html` | admin | standalone | `admin-only` | admin |
| `/en/admin/users.html` | `en/admin/users.html` | admin | standalone | `admin-only` | admin |

## 9. Pro pages

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/pro` (rewrite) | `pro/index.html` | pro | standalone (`styles.css`) | none | public |
| `/pro/index.html` | `pro/index.html` | pro | standalone | none | public |
| `/pro/login.html` | `pro/login.html` | pro | standalone | none | public |
| `/pro/report.html` | `pro/report.html` | pro | standalone | none | paid (checks `paid` param) |

## 10. Reports

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/reports/validation.html` | `reports/validation.html` | report | standalone | none | public |
| `/reports/en/validation.html` | `reports/en/validation.html` | report | standalone | none | public |

## 11. V3 (Economic Intelligence)

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/v3/index.html` | `v3/index.html` | v3 | `site-layout.js` | none | public |
| `/v3/city-intelligence.html` | `v3/city-intelligence.html` | v3 | `site-layout.js` | none | public |
| `/v3/city-comparison.html` | `v3/city-comparison.html` | v3 | `site-layout.js` | none | public |
| `/v3/investment-map.html` | `v3/investment-map.html` | v3 | `site-layout.js` | none | public |
| `/v3/project-readiness.html` | `v3/project-readiness.html` | v3 | `site-layout.js` | none | public |
| `/v3/opportunity-bank.html` | `v3/opportunity-bank.html` | v3 | `site-layout.js` | none | public |
| `/v3/scenarios.html` | `v3/scenarios.html` | v3 | `site-layout.js` | none | public |
| `/v3/alerts.html` | `v3/alerts.html` | v3 | `site-layout.js` | none | public |
| `/v3/project` | `v3/project/index.html` | v3-project | standalone | auth-guard.js (UI only) | authenticated |
| `/v3/admin` (rewrite) | `v3/admin/index.html` | v3-admin | `site-layout.js` | admin token login | admin |
| `/v3/admin/*` (rewrite) | `v3/admin/index.html` | v3-admin | `site-layout.js` | admin token login | admin |
| `/wave4/` | `wave4/index.html` | v3-intent | standalone | none | public |

## 12. API routes

| Route URL | Source file | Type | Layout | Middleware | Permission |
|---|---|---|---|---|---|
| `/api/env` | `api/env.js` | api | N/A | none | public |
| `/api/contact` | `api/contact.js` | api | N/A | none | public |
| `/api/track` | `api/track.js` | api | N/A | IP rate limit | public |
| `/api/usage` | `api/usage.js` | api | N/A | none | public |
| `/api/pro` | `api/pro.js` | api | N/A | none | public (`calculate`); paid (`report`/`stripe`) |
| `/api/create-checkout` | `api/create-checkout.js` | api | N/A | input validation | authenticated |
| `/api/billing` | `api/billing.js` | api | N/A | none | authenticated |
| `/api/bank-transfer` | `api/bank-transfer.js` | api | N/A | none | public |
| `/api/password` | `api/password.js` | api | N/A | none | owner (`ADMIN_EMAIL`) |
| `/api/force-reset` | → `/api/password` | api | N/A | none | owner |
| `/api/reset-password` | → `/api/password` | api | N/A | none | owner |
| `/api/webhook` | `api/webhook.js` | api | N/A | Stripe signature | Stripe only |
| `/api/admin` | `api/admin.js` | api | N/A | Bearer + `admin_roles` | admin / super_admin / owner fallback |
| `/api/v3/*` | `api/v3/index.js` → `v3/api/index.js` | api | N/A | per-endpoint auth | public / auth / admin |
| `/api/{name}` | `api/{name}.js` | api | N/A | — | — |

### `/api/v3/*` endpoint groups

| Group | Endpoints | Permission |
|---|---|---|
| Public data | `GET /health`, `/sectors`, `/models`, `/models/:code`, `/cities`, `/cities/:code`, `/cities/:code/indicators`, `/cities/:code/market`, `/opportunities/top`, `POST /calculate`, `POST /calculate/scenarios` (compute only) | public |
| Authenticated | `POST /calculate/scenarios?save=true`, `/scenarios`, `/scenarios/:id`, `DELETE /scenarios/:id`, `/projects/*`, `/billing/subscription` | authenticated |
| Admin / cron | `/admin/*`, `/cron/*`, `/alerts/*`, `/admin/alerts/evaluate` | admin / cron secret |
| Auth helpers | `/auth/*` | varies |
| Orchestrator (Wave 4) | `GET /orchestrate/intents`, `POST /orchestrate/form`, `POST /orchestrate` | public (compute rate limit) |
| Trusted Data Fabric (Wave 4.2) | `/fabric/connectors`, `/fabric/connectors/health`, `/fabric/connectors/:code/*`, `/fabric/sources`, `/fabric/sources/:code/rank`, `/fabric/resolve`, `/fabric/quality`, `/fabric/provenance/:id`, `/fabric/override`, `/fabric/impact`, `/fabric/monitoring/summary`, `/fabric/marketplace`, `/fabric/plugins`, `/fabric/plugins/validate` | public / auth (compute rate limit) |
| Enterprise Intelligence (Wave 4.3) | `/intelligence/engines`, `/intelligence/engines/:code`, `/intelligence/run`, `/intelligence/adapt`, `/intelligence/synthesize` | public (compute rate limit) |
| Investment Intelligence (Phase D.1) | `/investment-intelligence/engines`, `/investment-intelligence/readiness/:projectId`, `/investment-intelligence/memorandum`, `/investment-intelligence/memorandum/:id`, `/investment-intelligence/memorandum/:id/html`, `/investment-intelligence/memorandum/:id/review`, `/investment-intelligence/memorandum/:id/versions`, `/investment-intelligence/memorandum/:id/version` | authenticated (compute rate limit) |
| Enterprise Lifecycle (Phase D.1.5) | `/enterprise-lifecycle/definitions`, `/enterprise-lifecycle/definitions/:entityType`, `/enterprise-lifecycle/instances`, `/enterprise-lifecycle/instances/:id`, `/enterprise-lifecycle/instances/:id/state`, `/enterprise-lifecycle/instances/:id/history`, `/enterprise-lifecycle/instances/:id/timeline`, `/enterprise-lifecycle/instances/:id/tasks`, `/enterprise-lifecycle/instances/:id/transition`, `/enterprise-lifecycle/instances/:id/validate`, `/enterprise-lifecycle/instances/:id/gates/:gateId/evaluate`, `/enterprise-lifecycle/instances/:id/approvals`, `/enterprise-lifecycle/instances/:id/approvals/:approvalId/decision`, `/enterprise-lifecycle/instances/:id/events` | authenticated (compute rate limit) |
| Executive Command Center (Phase E.0) | `/ecc/project-status`, `/ecc/advisor` | authenticated (compute rate limit) |
