# Bonds Global — API Inventory

> Generated from `api/*.js` (12 files) and `v3/api/*.js` (10 files) plus `vercel.json`.

## Legend

- **Auth**
  - `none` — publicly callable
  - `Bearer JWT` — Supabase user access token in `Authorization: Bearer <token>`
  - `admin Bearer` — Supabase Bearer token + `admin_roles` row (`super_admin`/`admin`/`support`)
  - `x-admin-token` — `x-admin-token` header matching `ADMIN_TOKEN` env
  - `Stripe webhook secret` — Stripe signature verified with `STRIPE_WEBHOOK_SECRET`
  - `cron secret` — `Authorization: Bearer <CRON_SECRET>` or `x-admin-token`
- **Rate limit** — categories from `lib/api/rate-limit.js`: `public` (100/min), `auth` (10/min), `ai` (20/min), `compute` (20/min), `strict` (5/min), `webhook` (1000/min). All limits are per-IP, in-memory, per-Vercel-instance.

---

## 1. Site APIs

| Route | File | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|---|
| `/api/contact` | `api/contact.js` | POST | Store a calculator/lead contact message and email admin | none | none |
| `/api/track` | `api/track.js` | POST | Store page views or session durations | none | 30 req/min per IP |
| `/api/env` | `api/env.js` | GET | Serve safe public env vars as JS (`window.__ENV`) | none | none |
| `/api/pro` | `api/pro.js` | GET, POST | Pro report/calculator + Stripe payment + auth proxy | none | none |

### `/api/contact`
- **Body**: `name*` (string), `phone*` (Saudi `05XXXXXXXX` or international `+`), `email`, `city`, `activity`, `score`, `verdict`, `monthlyProfit`, `url`, `source`, `message`
- **Success**: `{ success: true, id, demo, message: "Lead received successfully" }`

### `/api/track`
- **Body**: `page`, `section`, `url`, `referrer`, `lang`, `screen`, `duration_seconds`, `event` (`session_end` triggers `page_sessions`)
- **Success**: `{ success: true, type: "view" | "session" }`

### `/api/pro`
Action driven by `action` query/body param.
- `action=calculate` (POST): `{ sector*, activity*, capital*, revenue* }` → `{ result, ai }`
- `action=report` (GET/POST): same fields + `format` (`json` or `html`) → JSON or HTML report
- `action=stripe` (POST): `{ plan: "single" | "monthly", email }` → `{ url }`
- `action=auth` (POST): `{ action: "signup" | "login", email*, password* }` → user/tokens

---

## 2. Auth / Billing APIs

| Route | File | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|---|
| `/api/create-checkout` | `api/create-checkout.js` | POST | Create Stripe Checkout subscription session | Bearer JWT | `auth` |
| `/api/billing` | `api/billing.js` | POST | Cancel subscription or create Stripe customer portal | Bearer JWT | `auth` |
| `/api/webhook` | `api/webhook.js` | POST | Stripe webhook handler (legacy main site) | Stripe webhook secret | `webhook` |
| `/api/bank-transfer` | `api/bank-transfer.js` | POST | Submit bank-transfer/SADAD subscription request | none | `public` |
| `/api/force-reset` | `api/password.js` | POST | Force-set password for `ADMIN_EMAIL` | `ADMIN_EMAIL` check | `strict` |
| `/api/reset-password` | `api/password.js` | POST | Generate Supabase recovery link for `ADMIN_EMAIL` | `ADMIN_EMAIL` check | `strict` |
| `/api/usage` | `api/usage.js` | GET, POST | Usage settings / limit check / log usage | none | `public` |
| `/api/contact` | `api/contact.js` | POST | Store contact message | none | `public` |
| `/api/track` | `api/track.js` | POST | Analytics tracking | none | `public` |
| `/api/pro` | `api/pro.js` | POST | Pro reports / calculations | none | `public` |

### `/api/create-checkout`
- **Auth**: `Authorization: Bearer <supabase-jwt>`
- **Body**: `priceId*` (must start with `price_`), `userId` (must match token), `email` (must match token), `successUrl`, `cancelUrl`, `currency`, `vatPercent`
- **Success**: `{ sessionId, url }`

### `/api/billing`
- **Auth**: `Authorization: Bearer <supabase-jwt>`
- `action=cancel`: body `{ userId }` (must match token) → `{ success: true }`
- `action=portal`: body `{ userId }` (must match token) → `{ url }`

### `/api/usage`
- `GET ?action=settings` → `{ calc_limit, feas_limit, price_pro, price_enterprise }`
- `GET ?action=check&calculator=*&userId=` → `{ allowed, used, remaining, limit, tier, exception }`
- `POST ?action=log` body `{ calculator*, userId, country, inputs, results }` → `{ success: true }`

---

## 3. Admin APIs (Legacy — `/api/admin`)

All routes live in `api/admin.js`. Auth is **admin Bearer** (`super_admin`, `admin`, or `support`; strict endpoints require `super_admin` or `admin`). Owner email `iiffund.dev@gmail.com` is a hard-coded fallback.

| Route | Methods | Action | Description | Auth | Rate limit |
|---|---|---|---|---|---|
| `/api/admin?action=bank-transfers` | GET | — | List bank transfer requests | admin Bearer | none |
| `/api/admin?action=bank-transfers` | POST | `{ id, action: "verified" \| "rejected" }` | Verify/reject a transfer | admin Bearer | none |
| `/api/admin?action=settings` | GET | — | Read site settings | none | none |
| `/api/admin?action=settings` | POST | `{ key: value, ... }` | Upsert site settings | admin Bearer (strict) | none |
| `/api/admin?action=exceptions` | GET | — | List usage exceptions | admin Bearer (strict) | none |
| `/api/admin?action=exceptions` | POST | `{ user_id*, calculator, limit_override*, reason }` | Create exception | admin Bearer (strict) | none |
| `/api/admin?action=exceptions` | DELETE | `?id=*` | Delete exception | admin Bearer (strict) | none |
| `/api/admin?action=stats` | GET | — | Dashboard stats | admin Bearer | none |
| `/api/admin?action=messages` | GET | — | List contact messages | admin Bearer | none |
| `/api/admin?action=messages` | POST | `{ action: "mark_read" \| "delete", id }` | Update message | admin Bearer | none |
| `/api/admin?action=roles` | GET | — | List admin roles | admin Bearer (strict) | none |
| `/api/admin?action=roles` | POST | `{ action: "add" \| "remove", email, role }` or `{ id }` | Manage roles | admin Bearer (strict) | none |
| `/api/admin?action=users` | GET | — | List merged auth + profile users | admin Bearer | none |
| `/api/admin?action=users` | POST | `{ action: "update" \| "delete" \| "reset-password", id, ... }` | Manage users | admin Bearer (strict) | none |
| `/api/admin?action=subscriptions` | GET | — | Subscription stats | admin Bearer | none |
| `/api/admin?action=analytics` | GET | — | Usage/revenue analytics | admin Bearer (strict) | none |
| `/api/admin?action=page-views` | GET | — | Page view/session analytics | admin Bearer | none |
| `/api/admin?action=verify` | POST | — | Verify caller admin status & permissions | admin Bearer | none |
| `/api/admin?action=makeOwnerAdmin` | POST | — | Grant `super_admin` to owner email | admin Bearer (owner only) | none |

---

## 4. V3 APIs (`/api/v3/*`)

Entry dispatcher: `v3/api/index.js`. Sub-routers noted per group.

### 4.1 Public / Discovery

| Route | File | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|---|
| `/api/v3/health` | `v3/api/index.js` | GET | Health check | none | `public` |
| `/api/v3/sectors` | `v3/api/index.js` | GET | Full taxonomy (sectors → sub-sectors → activities → details) | none | `public` |
| `/api/v3/models` | `v3/api/index.js` | GET | List published project models | none | `public` |
| `/api/v3/models/:code` | `v3/api/index.js` | GET | Project model detail | none | `public` |
| `/api/v3/cities` | `v3/api/index.js` | GET | List cities, optional opportunity enrichment | none | `public` |
| `/api/v3/opportunities/top` | `v3/api/index.js` | GET | Top opportunities by country/activity/year | none | `public` |
| `/api/v3/cities/:code` | `v3/api/index.js` | GET | City detail + latest indicators + market data | none | `public` |
| `/api/v3/cities/:code/indicators` | `v3/api/index.js` | GET | City indicators for year | none | `public` |
| `/api/v3/cities/:code/market` | `v3/api/index.js` | GET | City market data, filterable by activity/year | none | `public` |
| `/api/v3/calculate` | `v3/api/index.js` | POST | Run financial calculation for a model/city | none | `compute` |
| `/api/v3/ai/chat` | `v3/api/ai.js` | POST | Data-driven Arabic investment assistant | none | `ai` |
| `/api/v3/compare/cities` | `v3/api/compare.js` | GET, POST | Compare 1–10 cities for an activity/model | none | `compute` |

**Query/body examples**
- `GET /api/v3/models?sector=X&sub_sector=Y&activity=Z&city=C`
- `GET /api/v3/cities?country=SA&include=opportunity&activity=...&min_score=50&limit=200`
- `GET /api/v3/opportunities/top?country=SA&activity=...&limit=10&year=2026`
- `POST /api/v3/calculate` `{ projectModelCode*, cityCode, assumptions: {revenue,capex}, projectionYears }`
- `POST /api/v3/ai/chat` `{ messages: [{role,content}], context: {cityCode,activityCode} }`
- `GET/POST /api/v3/compare/cities` `{ activityCode*, cityCodes[], modelCode, year }`

### 4.2 Auth (`v3/api/auth.js`)

| Route | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|
| `/api/v3/auth/register` | POST | Create confirmed Supabase user | none | `auth` |
| `/api/v3/auth/login` | POST | Sign in, return tokens | none | `auth` |
| `/api/v3/auth/me` | GET | Current user | Bearer JWT | `auth` |

- **Register/login body**: `{ email*, password* }`
- **Success login**: `{ user: {id,email}, session: {access_token,refresh_token,expires_at} }`

### 4.3 Billing (`v3/api/billing.js`)

| Route | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|
| `/api/v3/billing/plans` | GET | List Pro/Enterprise plans | none | `public` |
| `/api/v3/billing/checkout` | POST | Create Stripe Checkout session | none | `auth` |
| `/api/v3/billing/webhook` | POST | Stripe webhook handler (V3) | Stripe webhook secret | `webhook` |
| `/api/v3/billing/subscription` | GET | Current user subscription | Bearer JWT | `auth` |

- **Checkout body**: `{ priceId*, email* }` → `{ url }`

### 4.4 Projects (`v3/api/projects.js`)

All require **Bearer JWT**.

| Route | Methods | Description |
|---|---|---|
| `/api/v3/projects` | GET | List current user’s projects |
| `/api/v3/projects` | POST | Create and calculate a new saved project |
| `/api/v3/projects/:id` | GET | Get a single project |
| `/api/v3/projects/:id` | DELETE | Delete a project |

- **Create body**: `{ projectModelCode*, cityCode, name*, assumptions: {}, projectionYears }`
- **Success**: `{ project, calculation }`

### 4.5 Scenarios (`v3/api/scenarios.js`)

| Route | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|
| `/api/v3/calculate/scenarios` | POST | Compute baseline + scenario shocks | none | `compute` |
| `/api/v3/scenarios` | GET | List saved scenarios | Bearer JWT | `auth` |
| `/api/v3/scenarios/:id` | GET | Get saved scenario | Bearer JWT | `auth` |
| `/api/v3/scenarios/:id` | DELETE | Delete saved scenario | Bearer JWT | `auth` |

- **Calculate body**: `{ projectModelCode*, cityCode, assumptions, scenarios[], save, projectId, description }`
- `save=true` requires Bearer JWT.

### 4.6 Compare

See 4.1 Public / Discovery (`/api/v3/compare/cities`).

### 4.7 Alerts (`v3/api/alerts.js`)

| Route | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|
| `/api/v3/admin/alert-rules` | GET | List alert rules | x-admin-token | `strict` |
| `/api/v3/admin/alert-rules` | POST | Create alert rule | x-admin-token | `strict` |
| `/api/v3/admin/alert-rules/:id` | PUT, PATCH | Update rule | x-admin-token | `strict` |
| `/api/v3/admin/alert-rules/:id` | DELETE | Delete rule | x-admin-token | `strict` |
| `/api/v3/admin/alerts/evaluate` | POST | Evaluate rules, optionally send notifications | cron secret or x-admin-token | `strict` |
| `/api/v3/alerts` | GET | List public alerts | none | `public` |
| `/api/v3/alerts/:id/read` | POST, PUT | Mark alert as read | none | `public` |

- **Create rule body**: `{ name*, metric_code*, entity_type*, threshold_type*, threshold_value*, severity*, city_id, activity_id, check_previous_year, description }`
- **Evaluate body**: `{ dryRun, metricCodes: [], cityIds: [] }`

### 4.8 Admin (`v3/api/admin.js`)

All routes require **`x-admin-token`** header matching `ADMIN_TOKEN`.

| Route | Methods | Description |
|---|---|---|
| `/api/v3/admin/models` | GET, POST | List / create project models |
| `/api/v3/admin/models/:code` | PUT, DELETE | Update / delete model |
| `/api/v3/admin/cities` | GET, POST | List / upsert cities |
| `/api/v3/admin/market-data` | POST | Upsert city market data |
| `/api/v3/admin/reference` | GET | Load all reference tables |
| `/api/v3/admin/competitor-calibration` | GET, POST | List / manual upsert calibrations |
| `/api/v3/admin/competitor-calibration/run` | POST | Run auto-calibration |
| `/api/v3/admin/source-quality-alerts` | GET | Source quality alerts |
| `/api/v3/admin/sectors` | GET, POST, PUT, DELETE | Master data CRUD |
| `/api/v3/admin/sub-sectors` | GET, POST, PUT, DELETE | Master data CRUD |
| `/api/v3/admin/activities` | GET, POST, PUT, DELETE | Master data CRUD |
| `/api/v3/admin/activity-details` | GET, POST, PUT, DELETE | Master data CRUD |
| `/api/v3/admin/assumptions` | GET, POST, PUT, DELETE | Master data CRUD |
| `/api/v3/admin/risk-factors` | GET, POST, PUT, DELETE | Master data CRUD |

### 4.9 Data Engine (`v3/api/data-engine.js`)

| Route | Methods | Description | Auth | Rate limit |
|---|---|---|---|---|
| `/api/v3/data/sources` | GET | List configured data sources | none | `public` |
| `/api/v3/data/sources/:sourceId/fetch` | POST | Run a source/engine fetch | x-admin-token | `strict` |
| `/api/v3/data/runs/:id` | GET | Get a pipeline run record | none | `public` |
| `/api/v3/data/metrics` | GET | List normalized metrics | none | `public` |
| `/api/v3/data/indicators` | GET | City indicators + market data + metrics | none | `public` |
| `/api/v3/data/auto-fill` | POST | Run all engines for city/activity | x-admin-token | `strict` |
| `/api/v3/data/feedback` | POST | Submit admin feedback | x-admin-token | `strict` |
| `/api/v3/data/feedback/public` | POST | Public metric correction/feedback | none | `public` |
| `/api/v3/data/feedback/accuracy` | GET | Feedback accuracy summary | none | `public` |
| `/api/v3/data/ml/train` | POST | Train regression models | x-admin-token | `strict` |
| `/api/v3/data/ml/models` | GET | List trained ML models | none | `public` |

**Sources/engines**: `gastat`, `sama`, `city`, `real_estate`, `labor`, `competition`, `market`, `pricing`.

### 4.10 Cron (`v3/api/index.js`)

| Route | Methods | Description | Auth | Schedule |
|---|---|---|---|---|
| `/api/v3/cron/calibrate-competitors` | POST | Auto-calibrate competitor counts | cron secret or x-admin-token | Sundays 03:00 |
| `/api/v3/cron/check-source-quality` | GET, POST | Check source quality and alert | cron secret or x-admin-token | Daily 09:00 |

---

## Notes

- No centralized rate-limiting middleware exists; limits are ad-hoc in-memory per handler.
- `/api/webhook` (legacy) and `/api/v3/billing/webhook` both process Stripe events but use different logic and tables.
- Several V3 read endpoints (`/data/runs/:id`, `/data/ml/models`) do not enforce auth even though they are primarily admin-facing.
