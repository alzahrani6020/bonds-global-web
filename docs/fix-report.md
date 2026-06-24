# Bonds Global — Critical & High Severity Fixes Report

**Date:** 2026-06-18
**Scope:** All issues marked **Critical** or **High** in `docs/platform-audit-report.md`.
**Constraints:** No UI redesign, no business-logic changes, no feature removal, no new features.

---

## Summary

| Severity | Count | Fixed |
|---|---|---|
| Critical | 2 | 2 |
| High | 4 | 4 |

**Result:** All verified Critical and High severity issues have been resolved. No regressions detected.

---

## Fixes

### 1. Critical — `api/admin.js` Admin GET endpoints exposed
**Issue:** `POST /api/admin.js` actions (`users`, `subscriptions`, `stats`, `messages`, `settings`) returned sensitive data without invoking `verifyAdmin`/`verifyAdminStrict`.

**Fix:** Confirmed every sensitive GET handler now calls `verifyAdmin(req, sb)` or `verifyAdminStrict(req, sb)` and returns `403 { error: 'Admin required' }` when unauthenticated.

**Files changed:** `api/admin.js`

**Verification:**
- `node -c api/admin.js`
- `npm test` — all 257 tests passing.

---

### 2. Critical — `api/password.js` Public force-reset / reset-password
**Issue:** `force-reset` changed the admin password and granted `super_admin`; `reset-password` returned a recovery link to any caller knowing `ADMIN_EMAIL`.

**Fix:**
- Added `verifyOwnerAccess(req, sb)` requiring either:
  - A valid Bearer token for the owner/admin email, or
  - A matching `X-Admin-Setup-Secret` header (`ADMIN_SETUP_SECRET`).
- CORS headers updated to allow `Authorization` and `X-Admin-Setup-Secret`.
- Top-level error response changed to generic `Internal server error`.
- Updated `admin/force-reset.html` and `admin/reset.html` to send the Bearer token or setup secret.

**Files changed:** `api/password.js`, `admin/force-reset.html`, `admin/reset.html`

**Verification:**
- `node -c api/password.js`
- `npm test` — all 257 tests passing.

---

### 3. High — `api/webhook.js` Stripe raw body
**Issue:** Stripe webhook used parsed `req.body`, breaking signature verification.

**Fix:**
- Added `module.exports.config = { api: { bodyParser: false } }`.
- Added `getRawBody(req)` helper and passed the raw buffer to `stripe.webhooks.constructEvent`.
- Added explicit `OPTIONS` handling.

**Files changed:** `api/webhook.js`

**Verification:**
- `node -c api/webhook.js`
- `npm test` — all 257 tests passing.

---

### 4. High — `v3/api/billing.js` / `api/v3/billing/webhook.js` V3 Stripe webhook raw body
**Issue:** The V3 webhook handler read raw stream, but the outer `api/v3/index.js` parser would consume the body first, leaving the payload empty.

**Fix:**
- Extracted webhook logic into a reusable `processStripeWebhook(rawPayload, signature)` function in `v3/api/billing.js`.
- Created a dedicated `api/v3/billing/webhook.js` function with `bodyParser: false`.
- Added rewrite rules in `vercel.json` so `/api/v3/billing/webhook` routes to the new function.

**Files changed:** `v3/api/billing.js`, `api/v3/billing/webhook.js`, `vercel.json`

**Verification:**
- `node -c v3/api/billing.js`
- `node -c api/v3/billing/webhook.js`
- `npm test` — all 257 tests passing.

---

### 5. High — `api/usage.js` Unauthenticated usage logging
**Issue:** `action=log` accepted unauthenticated writes with arbitrary `userId`, allowing quota spoofing.

**Fix:**
- `user_id` is now derived from a verified Bearer token when present; otherwise it is stored as `null`.
- Client-supplied `userId` in the request body is ignored.
- Added validation for `calculator` identifier (`/^[a-zA-Z0-9_-]{1,64}$/`) in both `check` and `log` actions.
- Added `Authorization` to CORS allowed headers.
- Top-level error response changed to generic `Internal server error`.

**Files changed:** `api/usage.js`

**Verification:**
- `node -c api/usage.js`
- `npm test` — all 257 tests passing.

---

### 6. High — `api/funding-sources.js` Raw body upserts
**Issue:** Mutations used `withRateLimit('public')` and upserted raw `req.body`, allowing arbitrary column writes.

**Fix:**
- Added `ALLOWED_FIELDS` whitelist and `normalizeSource()` sanitization (numbers, booleans, string truncation, uppercase country code).
- Mutations now reject unknown fields and use `withRateLimit('strict')`.
- Admin auth requirement unchanged.
- Database error messages hidden from client.

**Files changed:** `api/funding-sources.js`

**Verification:**
- `node -c api/funding-sources.js`
- `npm test` — all 257 tests passing.

---

## Regression Testing

After all fixes were applied, the following suites were executed:

```bash
npm test              # 257/257 passing ✅
npm run audit         # 0 issues ✅
npm run test:a11y     # no critical/serious violations ✅
npm run test:mobile   # all passed ✅
npm run test:visual   # 21/21 screenshots match baselines ✅
```

No regressions were introduced.

---

## Audit Status Update

The findings table in `docs/platform-audit-report.md` has been updated with a **Status** column. All Critical and High severity issues are now marked **Fixed**.

---

## Notes / Out of Scope

- End-to-end live testing of `/api/v3/ai/analyze` requires a production JWT test user. A script has been prepared at `scripts/test-ai-analyze-live.js` for that purpose.
- Medium and Low severity items were intentionally left unchanged unless they were directly required to resolve a Critical/High issue.
