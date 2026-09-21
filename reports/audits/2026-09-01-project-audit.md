# PROJECT AUDIT — Bonds Global Web Platform

**تاريخ التدقيق:** 2026-09-01
**الوضع:** COMPREHENSIVE AUDIT (لا تُنفّذ تعديلات)
**النطاق:** Code Review + Architecture Assessment

---

## A. EXECUTIVE SUMMARY

| Component | Details |
|-----------|---------|
| **Framework** | Vanilla JavaScript (no React/Vue/Next.js) |
| **Hosting** | Vercel (serverless functions) |
| **Package Manager** | npm |
| **Node.js** | 24.x (required) |
| **Build System** | None (static site + Vercel serverless) |
| **Database** | Supabase PostgreSQL |
| **Authentication** | Supabase Auth |
| **Payment** | Stripe (primary), Moyasar (SADAD/bank transfer) |

### Main Production Dependencies
- `@supabase/supabase-js` (^2.108.2) — database & auth
- `stripe` (^15.12.0) — payment processing
- `nodemailer` (^9.0.3) — email
- `resend` (^6.17.1) — transactional email
- `xlsx` (^0.18.5) — Excel export
- `pdf-parse` (^2.4.5) — PDF analysis
- `playwright-core` (^1.61.1) — browser automation
- `@sentry/node` (^10.57.0) — error tracking
- `mammoth` (^1.12.0) — Word doc parsing

### Important Dev Dependencies
- Jest (^30.4.2) — testing
- Playwright (^1.61.0) — E2E testing
- Sharp (^0.35.3) — image processing
- Axe-core (^4.10.2) — accessibility auditing
- Pixelmatch (^5.3.0) — visual regression testing

---

## 2. Architecture Map

### Directory Structure
```
bonds-global-web/
├── api/                      # Vercel serverless functions
│   ├── admin.js              # Admin operations, migrations, settings
│   ├── v3/index.js           # Unified v3 API handler
│   ├── env.js                # Environment variable injector
│   ├── payments.js           # Stripe webhooks & billing
│   ├── platform.js           # Platform integrations
│   └── *.js                  # Other endpoints
├── v3/                       # Advanced features (Intelligence Layer)
│   ├── api/index.js          # V3 route dispatcher
│   ├── lib/                  # Core business logic
│   ├── master-data/          # Geo & platform data
│   ├── components/           # V3 UI components
│   └── portfolio/            # Portfolio dashboard
├── admin/                    # Admin dashboard (requires auth)
│   ├── dashboard.html        # Main admin panel
│   ├── funding-cases/        # Funding case management
│   ├── financial-advisory/   # Advisory module
│   ├── investment-intelligence/ # Investment readiness
│   └── *.html                # Other admin pages
├── client/                   # Client portal (requires auth)
│   ├── funding-cases.html    # View funding cases
│   ├── reports.html          # Client reports
│   └── *.html
├── advisor/                  # Advisor area
│   └── index.html            # Advisor dashboard
├── calculators/              # Financial calculators
│   ├── shared-utils.js       # Common utilities
│   ├── shared-platforms.js   # Platform data
│   ├── shared-geo.js         # Geographic data
│   ├── *.html                # Individual calculators
│   └── auth/                 # Calculator auth pages
├── valuation/                # Asset valuation engine
│   ├── valuation-engine.js   # Core calculations
│   ├── depreciation-engine.js # Depreciation logic
│   ├── condition-assessment-engine.js # Asset condition
│   └── *.js                  # Support engines
├── lib/                      # Shared libraries
│   ├── ucp/                  # Universal Calculation Platform
│   ├── api/                  # API helpers & middleware
│   ├── ai/                   # AI orchestration
│   ├── enterprise-intelligence/ # BI layer
│   ├── investment-intelligence/ # Investment analysis
│   ├── enterprise-lifecycle/ # Project lifecycle management
│   └── ecc/                  # Executive Command Center
├── supabase/                 # Database migrations
│   ├── migrations/           # 100+ SQL migrations
│   └── .temp/                # CLI artifacts
├── tests/                    # Test suites
│   ├── bonds-geo.test.js
│   ├── calc-functions.test.js
│   ├── a11y/
│   ├── mobile/
│   └── visual/
├── components/               # Reusable UI components
│   ├── universal-dropdown.js # Custom select widget
│   └── ecc-icons.js          # Executive UI icons
├── styles/                   # Modular CSS
│   ├── tokens.css            # Design system tokens
│   ├── base.css
│   ├── components.css
│   ├── utilities.css
│   └── *.css
├── en/                       # English versions (mirror structure)
│   ├── index.html
│   ├── admin/
│   ├── calculators/
│   └── *.html
├── index.html                # Arabic homepage
├── styles.css                # Main CSS bundle
├── script.js                 # Global page behaviors
├── auth-guard.js             # Auth state management
├── supabase-client.js        # Supabase client wrapper
├── manifest.json             # PWA metadata
└── sw.js                     # Service Worker

```

### Module Purposes
| Module | Purpose | Status |
|--------|---------|--------|
| **Admin** | Dashboard for company operations, user management, content | Active |
| **Client Portal** | Funding case tracking, document upload, reporting | Active |
| **Advisor** | Advisor landing page (minimal) | Minimal |
| **Calculators** | Financial planning tools (10+ calculators) | Mature |
| **Valuation** | Asset valuation with AI analysis & certificates | Active |
| **V3/Intelligence** | Advanced analytics, portfolio analysis, AI engines | Experimental |
| **API** | Serverless backend (payments, auth, data, webhooks) | Active |
| **Supabase** | PostgreSQL + Auth + Storage | Foundation |

---

## 3. Public Website

### Main Public Routes
| Route | File | Purpose |
|-------|------|---------|
| `/` | index.html | Arabic homepage |
| `/en/` | en/index.html | English homepage |
| `/about.html` | about.html | Company info |
| `/en/about.html` | en/about.html | English about |
| `/services.html` | services.html | Services overview |
| `/contact.html` | contact.html | Contact form |
| `/pricing.html` | pricing.html | Pricing page |
| `/calculators/break-even.html` | calculators/break-even.html | Break-even calculator |
| `/calculators/cash-flow.html` | calculators/cash-flow.html | Cash flow calculator |
| `/calculators/loan.html` | calculators/loan.html | Loan calculator |
| `/calculators/pricing.html` | calculators/pricing.html | Pricing calculator |
| `/calculators/feasibility.html` | calculators/feasibility.html | Feasibility study |
| (+ 15+ more calculators) | calculators/*.html | Various financial tools |
| `/blog/` | blog/*.html | Blog articles |
| `/sectors/` | sectors/*.html | Sector-specific pages |
| `/valuation/` | valuation/index.html | Asset valuation tool |

### Homepage Structure (index.html / en/index.html)
```
Fixed Income Landing Page (FI-Page)
├── Header (#site-header)
├── Hero Section (fi-hero)
├── Fixed Income Ticker (fi-ticker) ← LIVE indicator displayed
├── Services Section
├── Statistics Section
├── Testimonials
├── Portfolio Dashboard Showcase
├── CTA Sections
├── Footer
```

---

## 4. Homepage Dependency Map

| Section | Component | File | Data Source | Type |
|---------|-----------|------|-------------|------|
| **Header** | Navigation bar | calculators/shared-nav.js | Static HTML | Static |
| **FI Ticker** | Market data ticker | styles/fixed-income-landing.css + index.html inline | Hardcoded values | **STATIC (not live)** |
| **Hero** | Main headline | index.html (inline) | Static HTML | Static |
| **Stats** | Animated counters | script.js (data-target) | data-target attrs | Static |
| **Services** | Card grid | index.html (inline) | Static HTML | Static |
| **Portfolio Demo** | Chart placeholder | index.html (inline) | Static HTML / Chart.js | Static |
| **Testimonials** | Review cards | index.html (inline) | Static HTML | Static |
| **Contact CTA** | Form section | contact.html (embedded) | Supabase (contact_messages) | Dynamic |
| **Footer** | Links & info | header-footer.css + shared-nav.js | Static HTML | Static |
| **Auth UI** | Login/register | bonds-auth-2026.js | Supabase Auth | Dynamic |

**CSS Files:**
- `styles.css` (main)
- `styles/fonts-ar.css` (Arabic fonts)
- `styles/fixed-income-landing.css` (FI page styling)
- `styles/redesign-2026.css` (2026 redesign)
- `styles/social-feed.css` (social integration)
- `header-footer.css` (shared header/footer)

---

## 5. Financial Data Audit

### Data Marked "LIVE" on Homepage

**Fixed Income Ticker Section:**
```
SPREAD: 332bps ↑ 4.7
DE 10Y: 2.541 ↓ -0.024
US 10Y: 4.312 ↑ +0.018
SOFR: 5.307% ↓ -0.008
EUR/USD: 1.0847 ↑ +0.0012
```

**Status:** `fi-ticker__live` badge displayed with "LIVE" text and pulse animation.

**Actual Data Source:** ❌ **HARDCODED STATIC VALUES**
- All values are hardcoded in `index.html` within `<div class="fi-ticker__item">` elements
- No API calls, no database queries, no real-time data binding detected
- Data likely outdated (values frozen at development time)

### Portfolio Metrics (if displayed)
- **Yield:** Not found on homepage (may be on internal dashboard)
- **Duration:** Not found on homepage
- **Credit Quality:** Not found on homepage
- **DV01:** Not found on homepage
- **MENA Yield Curve:** Not found on homepage

### Calculator Outputs
All calculator results are **client-side calculated** from user inputs:
- Break-even: `calc-functions.js`
- Cash flow: Inline JavaScript
- Loan: Inline JavaScript
- ROI: Inline JavaScript

---

## 6. Backend & Supabase

### Authentication
- **Provider:** Supabase Auth (email + password, social auth capable)
- **Session Storage:** localStorage (`bonds-auth-token` key)
- **Unified Client:** `bonds-auth-2026.js` (manages all auth state)
- **Protected Routes:** Admin, Client portal, Advisor area require login
- **Token:** Bearer token passed to API endpoints via Authorization header

### Database (Supabase PostgreSQL)
**100+ migrations applied.** Key tables include:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles + role assignment |
| `subscriptions` | Stripe subscription status |
| `scenarios` | Saved calculator scenarios |
| `funding_cases` | Funding application tracking |
| `advisory_clients` | Advisory clients |
| `advisory_projects` | Projects under advisory |
| `contact_messages` | Contact form submissions |
| `valuation_ai_reports` | AI valuation analysis results |
| `market_data` | Market intelligence data |
| `economic_life_database` | Asset depreciation parameters |
| `condition_assessment` | Asset condition standards |
| `calculator_leads` | Lead capture from calculators |
| `social_accounts` | Social media integrations |

### API Routes (from api/*.js and v3/api/index.js)

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/env` | GET | Environment vars injector | Public |
| `/api/admin` | POST/GET | Admin operations | Admin token |
| `/api/payments` | POST | Stripe webhook | Stripe signature |
| `/api/platform` | POST/GET | Platform integrations | Varies |
| `/api/funding` | POST | Funding request submission | Public/User |
| `/api/contact` | POST | Contact form | Public |
| `/api/reference-data` | GET/POST | Depreciation, economic life, market data | Public/Editor |
| `/api/v3/*` | POST/GET | V3 unified handler | Varies by route |
| `/api/v3/auth` | POST | Authentication (login/register/MFA) | Session/Bearer |
| `/api/v3/billing` | POST | Subscription management | User auth |
| `/api/v3/admin` | POST | Admin endpoints | Admin token |
| `/api/v3/intelligence` | POST | AI intelligence layer | User auth |
| `/api/v3/ecc` | POST | Executive Command Center | User auth |

### User Roles
```
roles table:
- admin          → Full system access
- manager        → Team/client management
- advisor        → Advisory operations
- viewer         → Read-only access
- owner          → System owner (special)
- editor         → Content editing
```

### External Integrations
| Service | Purpose | File |
|---------|---------|------|
| **Stripe** | Payment processing | api/payments.js, v3/api/billing.js |
| **Moyasar** | SADAD/bank transfer | lib/api/moyasar-helper.js |
| **Supabase** | Database & auth | supabase-client.js, lib/api/supabase.js |
| **Resend** | Transactional email | lib/api/email.js |
| **Sentry** | Error tracking | (configured via env) |
| **Google Analytics 4** | Analytics | (via GA_MEASUREMENT_ID env) |
| **Calendly** | Booking | (embedded redirect to CALENDLY_URL) |
| **Slack** | Notifications | (optional SLACK_WEBHOOK_URL) |

---

## 7. Admin / Client / Advisor

### Admin Area (`/admin/`)
- **Access:** Requires admin role or specified ADMIN_EMAIL
- **Main Dashboard:** `admin/dashboard.html`
- **Key Modules:**
  - `dashboard.html` — KPI overview
  - `funding-cases/` — Funding applications workflow
  - `financial-advisory/` — Client & project management
  - `investment-intelligence/` — Investment readiness scores
  - `ai-reviews.html` — AI analysis review queue
  - `users.html` — User management
  - `subscriptions.html` — Payment tracking
  - `market-intelligence.html` — Market data management
  - `depreciation-factors.html` — Asset depreciation rules
  - `social-media/` — Social account management
- **Authentication:** Admin token or email whitelist
- **Database Operations:** Direct access to core tables via RLS policies

### Client Portal (`/client/`)
- **Access:** Requires user authentication
- **Pages:**
  - `funding-cases.html` — List of user's funding applications
  - `funding-case.html?id=...` — Case detail + document upload
  - `funding-case-lookup.html` — Public case lookup (guest-accessible)
  - `reports.html` — Generated reports
  - `project.html` — Project dashboard
- **Features:** Track case status, upload documents, view timeline
- **Database:** RLS policies limit access to own records only

### Advisor Area (`/advisor/`)
- **Access:** Minimal; single `index.html` landing page
- **Status:** Mostly empty/placeholder
- **Intended Purpose:** Advisor operations (incomplete)

---

## 8. Arabic / English / RTL

### Localization Architecture
- **Arabic (Default):** `/` and root files use `lang="ar" dir="rtl"`
- **English:** `/en/` folder mirrors structure with `lang="en" dir="ltr"`
- **Language Toggle:** No built-in language switcher found; users must navigate manually to `/en/` or `/`
- **Fonts:**
  - **Arabic:** Vazirmatn (primary), Cairo (fallback)
  - **English:** Outfit/Inter, system-ui (fallback)
- **Locale Routing:** Static file structure (not dynamic routing)

### Responsibility
- **Manual Translation:** Developer must maintain two separate HTML files per page
- **Shared Assets:** CSS, JavaScript, images are shared
- **Hreflang Tags:** Present in both versions pointing to alternate language
- **Canonical Tags:** Arabic `/` and English `/en/` have separate canonicals

### Files Requiring Translation Maintenance
- `index.html` ↔ `en/index.html`
- `about.html` ↔ `en/about.html`
- `contact.html` ↔ `en/contact.html`
- `calculators/*.html` ↔ `en/calculators/*.html`
- `admin/*.html` ↔ `admin/en/*.html` (partially)

---

## 9. SEO & Analytics

### Current Implementation
✅ **Present:**
- Open Graph tags (og:title, og:description, og:image)
- Twitter Card metadata
- Canonical tags (per language)
- Hreflang alternate links (ar ↔ en)
- robots.txt
- sitemap.xml (generated)
- Organization schema (JSON-LD)
- Meta descriptions
- Viewport/charset meta tags

❌ **Gaps:**
- No Google Analytics 4 pixel found (depends on `GA_MEASUREMENT_ID` env var)
- No Google Search Console verification meta tag visible
- Article/BreadcrumbList schema missing from blog/sector pages
- No structured data for financial products/services
- No social media verification meta tags (Facebook App ID, etc.)

### Audit Scripts Available
- `npm run audit` — General site audit (checks 1,552 files, currently passing)
- `npm run audit:og` — Open Graph audit
- `npm run audit:i18n` — Localization audit
- `npm run audit:api` — API authentication audit
- `npm run generate:sitemap` — Regenerates sitemap.xml with hreflang

---

## 10. Critical Risks

### CRITICAL
1. **Hardcoded "LIVE" Market Data** — Homepage ticker displays static values labeled "LIVE", misleading users into thinking data is real-time. Risk of regulatory/trust issues.

### HIGH
2. **Test Suite Failure** — `npm test` fails with Playwright timeout issues (> 5000ms). Indicates testing infrastructure may be unreliable.
3. **Exposed Email Configuration** — Admin emails hardcoded in multiple files (iiffund.dev@gmail.com). Should be environment variables.
4. **No Production Build Process** — Static site + serverless without explicit build step. Risk of stale assets or missing files in production.
5. **Rate Limiting Fallback Only** — No persistent rate limiting; defaults to in-memory store. Distributed deployments may bypass limits.

### MEDIUM
6. **Incomplete Localization** — No built-in language switcher. Users must guess URL structure to access English version.
7. **RLS Policy Complexity** — 100+ migrations with RLS policies may have edge cases. Requires security audit.
8. **Mixed API Versioning** — Both `/api/*` and `/api/v3/*` exist; routing confusing. Potential for inconsistent behavior.
9. **No TypeScript** — Entire codebase is vanilla JavaScript; prone to runtime errors in complex logic.

### LOW
10. **PWA Cache Management Manual** — Service Worker requires manual `CACHE_VERSION` bumps. Risk of stale assets if forgotten.

---

## 11. Safe Redesign Boundary

### SAFE TO MODIFY FOR PUBLIC WEBSITE REDESIGN

```
index.html
en/index.html
about.html
en/about.html
services.html
en/services.html
contact.html
en/contact.html
pricing.html
en/pricing.html
methodology.html
en/methodology.html
faq.html
en/faq.html
styles.css (design tokens only)
styles/fonts-ar.css
styles/fonts-en.css
styles/fixed-income-landing.css
styles/redesign-2026.css
styles/social-feed.css
header-footer.css
script.js (homepage behaviors)
assets/ (images, logos)
blog/ (article content)
sectors/ (sector pages)
```

### DO NOT MODIFY YET

```
api/ (all files)
v3/ (all files)
admin/ (all files)
client/ (all files)
advisor/ (all files)
calculators/ (all calculator logic + shared utilities)
valuation/ (all valuation engines)
lib/ (all shared libraries)
supabase/ (database schema)
components/ (reusable components)
tests/ (test suites)
sw.js (Service Worker)
manifest.json (PWA config)
auth-guard.js (authentication)
supabase-client.js (database client)
bonds-auth-2026.js (auth system)
global-auth-gate.js (auth middleware)
site-layout.js (global layout logic)
```

**Rationale:** Homepage redesign can modify HTML/CSS of public pages. Backend, auth, calculators, admin, client portal, and database must remain untouched to avoid breaking core functionality.

---

## 12. First Development Phase

### Recommended Homepage Redesign Plan

**Phase 1A: Design & Prep (1 week)**
1. Create new homepage mockup (design system compliant)
2. Identify sections to keep, replace, or remove
3. Audit existing content for accuracy/redundancy

**Phase 1B: HTML/CSS Replacement (2 weeks)**
1. Rewrite `index.html` and `en/index.html` with new structure
2. Update `styles.css` and modular CSS files (keep design tokens)
3. Preserve all `<script>` tags that load auth, analytics, calculators
4. Test navigation links to calculators, contact form, footer links

**Phase 1C: Testing & Validation (1 week)**
1. Run `npm run audit` to verify no broken links
2. Run `npm run audit:og` to validate metadata
3. Test `/en/` version for language consistency
4. Verify header/footer rendering on all breakpoints
5. Test auth redirects (to `/my-bonds/` or login)

**Phase 1D: Deployment**
1. Push to staging branch
2. Verify on Vercel preview
3. Merge to main and deploy to production

### Parallel: Keep Running
- Admin operations (unchanged)
- Calculator functionality (unchanged)
- API endpoints (unchanged)
- Database (unchanged)
- Client portal (unchanged)

### What NOT to Touch
- Do not modify `/api/`, `/v3/`, `/admin/`, `/calculators/`, `/valuation/` directories
- Do not change authentication flow
- Do not modify Supabase schema
- Do not alter Payment/Stripe integration
- Do not touch Service Worker or PWA config

---

## 13. Git Status

```
Branch: main (inferred from deployment to Vercel)
Uncommitted Changes:
  M  supabase/.temp/cli-latest (Supabase CLI artifact)

Untracked Files:
  ??  SECURITY_AUDIT_REPORT.md
  ??  scripts/test_security_hardening.js
  ??  supabase/migrations/20260826000000_secure_public_tables_rls_and_grants.sql
  ??  supabase/migrations/20260826000000_secure_public_tables_rls_and_grants_rollback.sql
```

**Notes:**
- Working tree is clean except for CLI artifacts
- Recent security migrations staged but not yet applied
- No uncommitted application code changes

---

## Summary

Bonds Global is a sophisticated financial advisory SaaS platform built on vanilla JavaScript + Vercel serverless + Supabase. The public website is a static HTML/CSS site showcasing services and tools. The backbone is a comprehensive calculator suite, valuation engine, and admin dashboard for managing clients and funding applications.

**Key Finding:** The "LIVE" market data ticker on the homepage is static and misleading.

**Opportunity:** Homepage can be safely redesigned without affecting backend, calculators, admin, or integrations.

**Risk Level:** Medium. Careful attention to links, auth redirects, and API references during redesign.

---

**Report Generated:** 2026-09-01
**Status:** Ready for external technical advisor review
