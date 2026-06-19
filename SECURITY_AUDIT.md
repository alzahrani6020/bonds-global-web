# Security Audit — Bonds Global Enterprise Upgrade

## 1. Perimeter & Headers

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| SEC-01 | **Critical** | CSP is `Report-Only` and allows `'unsafe-inline'` + `'unsafe-eval'` + any `https:` script | `vercel.json` Content-Security-Policy-Report-Only |
| SEC-02 | **High** | CORS `Access-Control-Allow-Origin: *` on all `/api/*` | `vercel.json` headers |
| SEC-03 | **High** | No HSTS header | Missing in `vercel.json` |
| SEC-04 | **High** | No rate-limiting or brute-force protection on auth APIs | `api/password.js`, login pages |
| SEC-05 | **Medium** | API functions lack consistent input validation | Some check `priceId`, `userId`, but many routes accept arbitrary bodies |
| SEC-06 | **Medium** | `innerHTML` used with user-controlled data in admin modules | 112 occurrences across modules |
| SEC-07 | **Medium** | RLS `is_advisory_user()` is too broad | Any advisory user can modify all records in advisory tables |
| SEC-08 | **Medium** | Admin iframe `postMessage` sends full session object | `admin/dashboard.html` sends `access_token` and `refresh_token` to child iframe |
| SEC-09 | **Low** | `X-Frame-Options: SAMEORIGIN` is set but not `frame-ancestors` CSP directive | `vercel.json` |
| SEC-10 | **Low** | No explicit `Permissions-Policy` | Missing header |

## 2. Authentication & Authorization

- Multiple auth modules increase attack surface (SYS-01).
- Owner fallback based on `ADMIN_EMAIL` env var is acceptable but should be explicit and logged.
- `initAdminGuard` had a race condition where `document.body` could be null; partially fixed but still relies on module load order.
- Roles are checked in application code; RLS is the second line but too permissive.

## 3. Data Exposure

- `api/env.js` exposes public env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`); these are intended public but `ADMIN_EMAIL` leaks owner identity.
- No server-side filtering in some API functions; client-side Supabase queries are subject to RLS.
- Storage bucket policies for `advisory-documents` allow any authenticated user to read any object within the bucket.

## 4. Input & Injection

- Supabase JS client uses parameterized queries, so SQL injection is low risk.
- No validation layer for business rules (e.g., project status transitions, duplicate client prevention).
- File uploads lack MIME-type and size enforcement at API layer.

## 5. Recommendations

1. **Enforce CSP** (not Report-Only), remove `'unsafe-eval'`, move inline scripts to external files, and use nonces if inline is unavoidable.
2. **Restrict CORS** to known origins (`https://bonds-global.com` and localhost for dev).
3. **Add HSTS, Permissions-Policy, and `frame-ancestors` CSP**.
4. **Implement rate limiting** via Vercel KV or API gateway for auth and checkout endpoints.
5. **Centralize input validation** with a shared schema library (e.g., Zod) in API functions.
6. **Sanitize HTML** output or use DOM APIs; never assign user input to `innerHTML`.
7. **Tighten RLS** to row ownership + explicit manager/admin exceptions.
8. **Reduce data sent via postMessage** to a short-lived token only.
9. **Add audit logging** for all authentication and role changes.
10. **Remove `ADMIN_EMAIL` from public env endpoint** if not strictly required by UI.
