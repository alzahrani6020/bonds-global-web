# Bonds Global — Authorization Map

## Roles

| Role | Source |
|---|---|
| `free` | `subscriptions`/`profiles` table; no active paid sub |
| `pro` | Active Pro subscription |
| `enterprise` | Active Enterprise subscription |
| `viewer` | `admin_roles` table |
| `support` | `admin_roles` table |
| `admin` | `admin_roles` table |
| `super_admin` | `admin_roles` table |
| Owner fallback | Hard-coded email `iiffund.dev@gmail.com` treated as `super_admin` |

---

## Feature limits (from `supabase-client.js` / `bonds-auth-2026.js`)

| Feature | free | pro | enterprise |
|---|---|---|---|
| Max scenarios | 3 | unlimited | unlimited |
| Countries | 5 | 22 | 22 |
| PDF export | ❌ | ✅ | ✅ |
| Health history | ❌ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ |
| Email parser | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

Admins bypass all feature checks in `bonds-auth-2026.js`.

---

## Admin role permissions

Defined in `api/admin.js` and client guards (`admin-auth-v2.js`, `bonds-auth-2026.js`):

| Permission | super_admin | admin | support | viewer |
|---|---|---|---|---|
| `users` (read) | ✅ | ✅ | ✅ | ❌ |
| `users_write` | ✅ | ✅ | ❌ | ❌ |
| `subscriptions` | ✅ | ✅ | ❌ | ❌ |
| `messages` | ✅ | ✅ | ✅ | ❌ |
| `roles` | ✅ | ❌ | ❌ | ❌ |
| `analytics` | ✅ | ✅ | ✅ | ✅ |
| `export` | ✅ | ✅ | ❌ | ❌ |

---

## Role definitions

### `free`
- Can browse all public marketing, blog, sector, and calculator pages.
- Calculator usage is limited: 3 scenarios, 5 countries, Excel export only, no PDF.
- Can create/manage an account and view `/calculators/auth/profile.html`, `/account.html`, `/subscription.html`.
- Can call public APIs (`/api/contact`, `/api/track`, `/api/usage`, `/api/pro?action=calculate`, public `/api/v3/*` data endpoints).
- Cannot access paid features (`pdf_export`, `apiAccess`) or admin pages.

### `pro`
- Everything in `free`, plus:
- Unlimited scenarios, 22 countries, PDF export, health history, API access.
- Can call `/api/create-checkout`, `/api/billing`, `/api/pro?action=report`, authenticated `/api/v3/*` endpoints.
- Can view `/pro/report.html` after payment.

### `enterprise`
- Everything in `pro`, plus:
- Webhooks, email parser, priority support.
- Same API/page access as `pro`.

### `viewer` (admin role)
- Can access admin pages but sidebar hides everything except analytics.
- Permissions: `['analytics']`.

### `support` (admin role)
- Can access admin users (read-only), messages, and analytics.
- Permissions: `['users', 'messages', 'analytics']`.

### `admin`
- Can manage users (read+write), subscriptions, messages, analytics, and export.
- Permissions: `['users', 'subscriptions', 'messages', 'analytics', 'users_write', 'export']`.
- Cannot manage roles.

### `super_admin`
- Full admin access including roles management, exceptions, site settings, and owner escalation.
- Permissions: `['users', 'subscriptions', 'messages', 'roles', 'analytics', 'users_write', 'export']`.

### Owner fallback
- Email `iiffund.dev@gmail.com` is treated as `super_admin` in:
  - `api/admin.js` (`verifyAdmin`, `verifyAdminStrict`, `verifyAdminUser`)
  - `bonds-auth-2026.js` (`initAdminGuard`)
  - `admin-auth-v2.js`

---

## Admin verification

`api/admin.js` verifies admins like this:

1. Reads `Authorization: Bearer <token>` header.
2. Calls `supabase.auth.getUser(token)` to validate the Supabase session.
3. Looks up `admin_roles.role` for the user.
4. Accepts `super_admin`, `admin`, or `support` depending on the endpoint (`verifyAdminStrict` requires `super_admin` or `admin`).
5. Falls back to owner email `iiffund.dev@gmail.com` → `super_admin`.

Client-side admin guards (`bonds-auth-2026.js`, `admin-auth-v2.js`) mirror this logic.

---

## Access matrix

| Page / API | Public | free | pro | enterprise | viewer | support | admin | super_admin |
|---|---|---|---|---|---|---|---|---|
| Marketing pages (`/`, `/about`, `/services`, `/contact`, `/pricing`, `/faq`, `/blog`, `/sectors`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calculators (page load) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calculator PDF export / 22 countries | ❌ | ❌ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* |
| `/calculators/auth/` (login/signup) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/calculators/auth/onboarding`, `profile`, `account`, `subscription` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/pro/index.html`, `/pro/login.html` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/pro/report.html` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/*` | ❌ | ❌ | ❌ | ❌ | ✅ (analytics only) | ✅ (limited) | ✅ | ✅ |
| `/v3/*` public pages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/v3/admin/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/api/env`, `/api/contact`, `/api/track`, `/api/usage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/pro?action=calculate` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/pro?action=report\|stripe` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/create-checkout`, `/api/billing` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/bank-transfer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/password` (force/reset) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (owner) |
| `/api/webhook` | Stripe only | — | — | — | — | — | — | — |
| `/api/admin` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/api/v3` public data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/v3` authenticated endpoints | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/v3` admin/cron endpoints | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

\* Admins bypass feature checks.
