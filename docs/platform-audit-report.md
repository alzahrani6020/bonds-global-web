# Bonds Global — Platform Audit Report

**Date:** 2026-06-18  
**Scope:** Full platform audit covering public site, calculators, blog, admin portal, client/pro portal, v3 modules, and serverless APIs.  
**Methodology:**
- Static analysis of 234 HTML files for links, assets, forms, labels, alt text, and language attributes.
- Automated test suites: accessibility (`npm run test:a11y`), mobile interactions (`npm run test:mobile`), visual regression (`npm run test:visual`), site audit (`npm run audit`), unit tests (`npm test`).
- Security and logic review of `api/`, `api/v3/`, `v3/api/`, and `lib/ai/` handlers.
- Translation parity check between Arabic and English mirrors.
- Duplicate-content hash comparison across all HTML files.

**Overall Results:**
- Unit tests: **257/257 passing**
- Site audit: **0 issues**
- Accessibility: **no critical/serious violations**
- Mobile interactions: **all passed**
- Visual regression: **6 index-page screenshots differed** (expected after homepage redesign; baselines need updating)

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Security hole or broken core flow; fix immediately. |
| **High** | Likely to cause user-facing failure, data corruption, or compliance issue. |
| **Medium** | Degraded UX, maintainability risk, or potential failure under edge cases. |
| **Low** | Cosmetic, minor, or low-probability issue. |

---

## 1. API Security & Reliability Findings

| Severity | Page / Endpoint | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Critical | `POST /api/admin.js` (`users`, `subscriptions`, `stats`, `messages`, `settings`) | Admin GET actions | Sensitive data returned without invoking `verifyAdmin`/`verifyAdminStrict`. | Require admin verification on every sensitive action. |
| Critical | `POST /api/password.js` (`force-reset`, `reset-password`) | Password reset handler | `force-reset` changes admin password and grants `super_admin`; `reset-password` returns recovery link to caller without authentication. | Require a valid admin bearer token or secure signed secret; never return recovery links. |
| High | `POST /api/webhook.js` | Stripe webhook | Uses `req.body` parsed as JSON; Stripe signature verification needs raw body. | Disable body parsing for webhook route and pass raw buffer to `constructEvent`. |
| High | `POST /v3/api/billing.js` (`handleWebhook`) | Stripe webhook | Reads raw stream but outer handler already consumed/parsed body, so payload is empty. | Ensure raw Stripe payload reaches handler (disable body parsing on webhook paths). |
| High | `POST /api/usage.js` (`action=log`) | Usage logger | Accepts unauthenticated writes with arbitrary `userId`, allowing quota spoofing. | Require authenticated session or signed token before logging usage. |
| High | `POST /api/funding-sources.js` | Funding-source mutations | Uses `withRateLimit('public')` and upserts raw `req.body`, allowing arbitrary column writes. | Move mutations to stricter rate limit, whitelist fields, sanitize values. |
| Medium | `POST /api/admin.js` (`updateSettings`) | Site settings | Upserts every `req.body` key/value into `site_settings`. | Whitelist allowed setting keys and validate/sanitize values. |
| Medium | `POST /api/usage.js` | Calculator filter | Concatenates user input into PostgREST `.or('calculator.eq.' + calculator + ...)` filter string. | Use structured Supabase filters or validate/escape `calculator`. |
| Medium | `POST /api/bank-transfer.js` | Transfer request | Public endpoint stores requests without authentication; admin email HTML interpolates raw fields. | Add rate-limited auth or CAPTCHA; escape all values in HTML/email. |
| Medium | `POST /v3/api/index.js` (`/analyze-document`) | Document analysis | Returns before shared `checkRateLimit`, leaving it unrate-limited. | Move rate-limit check before the `/analyze-document` branch. |
| Medium | `POST /v3/api/billing.js` (`handleCheckout`) | Checkout | Requires no authentication and does not validate `priceId` format. | Require bearer auth and verify `priceId` starts with `price_`. |
| Medium | `POST /v3/api/auth.js` (`handleRegister`) | Registration | Publicly creates email-confirmed Supabase users via admin client. | Disable public registration or require email verification/admin approval. |
| Medium | `POST /api/pro.js` | Pro auth/stripe | Signup and Stripe actions are publicly accessible. | Require authentication for account creation and checkout. |
| Medium | `POST /v3/api/data-engine.js` (`handleSubmitPublicFeedback`) | Public feedback | Allows unauthenticated inserts into `metric_feedback`. | Require authentication or signed captcha token. |
| Medium | `v3/api/index.js`, `api/admin.js`, others | Error handling | Top-level `catch` returns `err.message`, potentially leaking internal details. | Return generic client message and log details server-side. |
| Medium | `POST /api/admin.js` (`deleteUser`) | User deletion | Only deletes `profiles` row, leaving Supabase auth user orphaned. | Also delete/soft-delete auth user or document behavior. |
| Medium | `POST /api/contact.js` | Contact form | No email format validation; admin email HTML interpolates raw `message`. | Validate email and escape HTML in email bodies. |
| Low | `GET /v3/api/compare.js` (`/compare/cities`) | City comparison | Public endpoint can trigger heavy calculations with `modelCode`. | Require auth or stronger rate limits for model-based comparisons. |
| Low | `POST /v3/api/scenarios.js` (`/calculate/scenarios`) | Scenario calculator | Compute is public; only saving requires auth. | Require auth or tighten compute rate limits. |
| Low | `GET /api/env.js` | Public env | Exposes `ADMIN_EMAIL` and `SENTRY_DSN` to any origin. | Remove non-public values from exposed env object. |
| Low | `v3/api/admin.js` | Admin token check | `requireAdmin` response reveals whether `ADMIN_TOKEN` is configured. | Return uniform `Unauthorized` regardless of config. |
| Low | `api/admin.js` | Duplicate branch | Two handlers for `action === 'subscriptions'`. | Remove duplicate branch. |
| Low | `api/pro.js` | CORS headers | `setCors` omits `Authorization` from allowed headers. | Align local CORS headers with `vercel.json`. |
| Low | `api/webhook.js` | Webhook CORS | No explicit OPTIONS/method handling. | Add explicit OPTIONS handling for clarity. |
| Low | `v3/api/billing.js` (`handlePlans`) | Plan listing | Exposes Stripe price IDs publicly. | Acceptable if IDs are public; otherwise restrict to authenticated users. |
| Low | `v3/api/index.js` (`/billing/subscription`) | Billing router | Passes `user` but `billingRouter` re-authenticates. | Pass authenticated user into router and avoid double verification. |

---

## 2. Static Site — Links, Assets & Navigation

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Medium | `/calculators/menu-engineering.html`<br>`/calculators/restaurant.html`<br>`/en/calculators/menu-engineering.html`<br>`/en/calculators/restaurant.html` | Auth redirect links | Links to `/calculators/auth/?redirect=...` point to a directory without an explicit `index.html` fallback in the markup. | Use explicit `/calculators/auth/index.html?redirect=...` or verify server rewrite. |
| Medium | `/modon_eservices.html`<br>`/modon_home.html` | External snapshot pages | These files appear to be saved copies of `modon.gov.sa`; hundreds of internal links point to `/Style Library/...`, `/_layouts/...`, `/ar/...`, etc., which do not exist locally. | Remove from production or convert into an iframe/external link; do not host broken third-party snapshots. |
| Low | `/admin/ai-business-advisor/index.html`<br>`/admin/data-quality-center/index.html`<br>`/admin/distressed-recovery/index.html`<br>`/admin/executive-dashboard/index.html`<br>`/admin/financial-advisory/index.html`<br>`/calculators/auth/index.html`<br>`/calculators/auth/profile.html`<br>`/calculators/dashboard.html`<br>`/blog/*.html` | Sidebar/nav/blog links | Multiple `href="#"` placeholders used for JavaScript-driven navigation. | Add `role="button"`, `aria-label`, and keyboard handlers, or use real fragment URLs. |
| Low | `/admin/reset.html` | Reset link | Uses template literal `${data.resetLink}` in static HTML, so the resolved link is invalid. | Ensure template is rendered server-side or replaced by JS before DOM insertion. |
| Low | `/calculators/auth/debug.html` | Avatar/blob images | Uses `${avatarUrl}` and `${blobUrl}` inside static HTML. | Render URLs dynamically or remove debug-only markup from production. |
| Low | `/templates/supabase-email-templates.html` | Email template page | Missing `lang` attribute on `<html>`. | Add `lang="ar" dir="rtl"` (or appropriate language). |

**Note:** `/api/env` and `/_vercel/insights/script.js` are reported as missing static files but are dynamic Vercel endpoints, so they are **not broken**.

---

## 3. Forms, Validation & Accessibility

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| High | `/calculator-v2.html`<br>`/calculator.html`<br>`/contact.html`<br>`/calculators/cash-flow.html`<br>`/calculators/loan.html`<br>`/calculators/pricing.html`<br>`/en/calculator.html`<br>`/en/calculators/cash-flow.html`<br>`/en/calculators/loan.html`<br>`/en/calculators/pricing.html` | Contact/lead-capture forms | `name`, `email`, `phone` inputs lack `<label>` elements and rely only on placeholders. | Add `<label for="id">` or `aria-label`/`aria-labelledby`. |
| Medium | `/admin/funding-sources.html` | Funding-source form | Fields such as `f_name_en`, `f_sector`, `f_financing_type`, etc. are not marked `required` even though they appear mandatory. | Add `required` attributes and client-side validation; align with server rules. |
| Medium | `/calculators/auth/verify-otp.html` | OTP inputs | Six single-character OTP inputs are not grouped or labeled for screen readers. | Wrap in a `<fieldset>` with `<legend>` and add `aria-label` to each input. |
| Medium | `/calculators/cash-flow.html`<br>`/calculators/creditworthiness.html`<br>`/en/calculators/cash-flow.html`<br>`/en/calculators/creditworthiness.html` | Calculator inputs | Many numeric inputs lack `required` attributes and explicit labels. | Add labels, `required` where applicable, and `inputmode`/`pattern` for numeric fields. |
| Medium | `/calculators/auth/profile.html` | Profile form | `avatarFile`, `avatarUrl`, `email`, `neighborhood`, `district` inputs lack labels or required attributes. | Add labels and mark required fields; ensure avatar upload has accessible button text. |
| Low | Many pages across `admin/`, `calculators/`, `client/`, `pro/` | Images | A large number of decorative/functional `<img>` and `<svg>` elements are missing `alt` text. | Add descriptive `alt` for informative images and empty `alt=""` for purely decorative ones. |

**Automated accessibility tests (`axe-core`) reported no critical/serious violations on the main public pages,** but the static analysis above shows label and alt gaps that are not always caught by axe on placeholder-only inputs.

---

## 4. Translation & Language Parity

| Severity | Page URL / Area | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Medium | `/calculators/auth/debug.html`<br>`/calculators/auth/diagnose.html`<br>`/calculators/auth/login.html`<br>`/calculators/feasibility-template-backup.html` | Calculators (Arabic only) | These calculator pages exist only in Arabic; there is no `en/calculators/` mirror. | Create English mirrors under `en/calculators/` following the project’s translation rules. |
| Medium | `/auth.html`<br>`/auth-v2.html`<br>`/calculator-v2.html`<br>`/verify.html` | Root pages | Pages in the site root lack English equivalents in `en/`. | Add English versions in `en/` or mark as intentionally internal-only. |
| Low | `/modon_eservices.html`<br>`/modon_home.html`<br>`/proof.html`<br>`/test.html`<br>`/v.html`<br>`/distressed-recovery-study.html` | Root pages | No English mirror, but many are external snapshots or test pages. | Either translate required pages or exclude non-production pages from deployment. |
| Low | `/blog/en/*.html` vs `/blog/*.html` | Blog | Blog is explicitly noted as supplementary and not fully translated. | Decide whether blog needs full translation; if yes, translate remaining posts. |

**Positive finding:** No exact duplicate HTML files were found across the entire platform, so content is not unintentionally duplicated.

---

## 5. Visual / UI Regression

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Low | `/index.html` (AR & EN)<br>Desktop / Tablet / Mobile | Homepage hero and sections | Visual regression screenshots differ by 35–73% from baselines. | Update visual baselines (`npm run test:visual:update`) after the intentional redesign is approved. |

---

## 6. Admin Portal, Client Portal & Pro Portal

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| High | `/admin/ai-business-advisor/index.html`<br>`/admin/city-intelligence/index.html`<br>`/admin/distressed-recovery/index.html` | AI Analyze integration (newly added) | AI analysis relies on `/api/v3/ai/analyze`, which requires a valid JWT; if the user's Supabase session expires mid-use, the call fails without a clear re-login path. | Add a session-expired handler that redirects to login with a return URL. |
| Medium | `/admin/city-intelligence/index.html` | City detail AI tab | Sector input defaults to "التجزئة" and is free-text; no validation against supported sectors. | Add a dropdown of supported sectors or validate the sector string server-side. |
| Medium | `/admin/distressed-recovery/index.html` | Asset AI tab | Distress reasons are pulled from existing records; if no reasons are recorded, the prompt receives `["غير محدد"]`, lowering analysis quality. | Show a warning when reasons are missing and guide the user to add them first. |
| Medium | `/client/*.html` and `/pro/*.html` | Client/Pro portal | Pages depend on `window.__ENV` and Supabase; there is no visible offline/fallback state if Supabase is unreachable. | Add offline/error state UI and retry logic. |
| Low | `/admin/*.html` | Sidebars and menus | Several sidebars use `href="#"` anchors that are handled by JS; without ARIA roles they appear as broken links to crawlers and screen readers. | Add `role="button"`, `tabindex="0"`, keyboard handlers, and `aria-expanded`. |
| Low | `/admin/*.html` | Loading states | Many admin views show only a spinner with no progress message. | Add descriptive loading text and skeleton screens for heavy views. |

---

## 7. Empty States, Success & Error Messages

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Medium | `/admin/city-intelligence/index.html` | Cities / Districts / Projects lists | Empty tables show "لا توجد ..." but do not explain how to add the first item. | Add a CTA button inside empty states. |
| Medium | `/admin/distressed-recovery/index.html` | Assets / Plans / Costs / Offers | Empty sections show plain text like "لا توجد خطط" without guidance. | Add empty-state illustrations and primary action buttons. |
| Medium | `/admin/ai-business-advisor/index.html` | Reports / Opportunities | If data fails to load, the UI shows a generic error but no retry action. | Add "إعادة المحاولة" button and contact-support link. |
| Low | `/calculators/*.html` | Calculator results | Some calculators show "—" for missing metrics without explaining why. | Add tooltips or helper text describing required inputs to compute the metric. |

---

## 8. Charts, Tables & Modals

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Low | `/admin/ai-business-advisor/index.html`<br>`/admin/city-intelligence/index.html` | Chart.js canvases | Charts are canvas-based and lack text alternatives or data tables. | Provide a hidden data table or `aria-label` summarizing chart data. |
| Low | `/admin/ai-business-advisor/index.html`<br>`/admin/city-intelligence/index.html`<br>`/admin/distressed-recovery/index.html` | Modals | Modal markup is injected dynamically; focus management and `aria-modal` are not consistently applied. | Ensure focus is trapped inside modals, returned on close, and `aria-modal="true"` is set. |
| Low | `/admin/distressed-recovery/index.html` | Data tables | Tables lack `scope` attributes on `<th>` and do not use `<caption>`. | Add `scope="col"`/`scope="row"` and captions for complex tables. |

---

## 9. Mobile & Responsive

| Severity | Page URL | Component | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Low | `/index.html` (AR & EN) | Homepage | Visual regression shows 63–73% difference on mobile; new sections may need fine-tuning. | Manually review the redesigned homepage on real devices and adjust spacing/font sizes. |

**Automated mobile interaction tests passed** (dropdowns open/close, no horizontal overflow on tested pages).

---

## 10. Recommended Priority Order

1. **Fix Critical API security issues** (`api/admin.js`, `api/password.js`, webhook raw-body handling).
2. **Add authentication/validation** to public write endpoints (`usage`, `funding-sources`, `bank-transfer`, `data-engine`, `billing`).
3. **Improve form accessibility** across calculators and contact forms (labels, required attributes, OTP grouping).
4. **Complete English translations** for calculator auth and main calculator pages.
5. **Clean up or remove external snapshot pages** (`modon_eservices.html`, `modon_home.html`).
6. **Update visual baselines** and finalize responsive homepage styling.
7. **Add empty-state CTAs, retry buttons, and loading messages** in admin portals.
8. **Enhance modal/chart accessibility** with ARIA and focus management.

---

## 11. Appendix — Test Run Summaries

| Test | Result |
|---|---|
| `npm test` | 257/257 passing |
| `npm run audit` | 0 issues |
| `npm run test:a11y` | No critical/serious violations |
| `npm run test:mobile` | All passed |
| `npm run test:visual` | 6 index-page diffs (expected after redesign) |
| Duplicate HTML check | 0 exact duplicates |
| Static HTML files checked | 234 |

---

*End of report.*
