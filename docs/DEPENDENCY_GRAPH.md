# Bonds Global — Dependency Graph

> Generated: 2026-06-18  
> Workspaces analyzed: `root/`, `bonds-v2/`, `v3/`  
> Source scan: `*.{js,jsx,ts,tsx}` excluding `node_modules/`, `.next/`, `.vercel/`

---

## 1. Per-Workspace Inventory

### 1.1 Root (`package.json`)

| Package | Declared | Latest (npm) | Status | Notes |
|---|---|---|---|---|
| `@sentry/node` | `^10.57.0` | `10.58.0` | ⚠️ unused | No `require`/`import` found |
| `@supabase/supabase-js` | `^2.106.2` | `2.108.2` | ✅ imported | Used in APIs + scripts |
| `nodemailer` | `^8.0.10` | `9.0.1` | ✅ imported | Runtime email helper (`lib/api/email.js`) |
| `stripe` | `^15.12.0` | `22.2.1` | ✅ imported | Billing/checkout APIs |
| `axe-core` | `^4.10.2` (dev) | `4.12.1` | ✅ imported | a11y tests |
| `jest` | `^30.4.2` (dev) | `30.4.2` | ✅ imported | Test runner |
| `pg` | `^8.21.0` (dev) | `8.21.0` | ✅ imported | Migration/setup scripts only |
| `pixelmatch` | `^5.3.0` (dev) | `7.2.0` | ✅ imported | Visual regression tests |
| `playwright` | `^1.61.0` (dev) | `1.61.0` | ✅ imported | Visual tests |
| `pngjs` | `^7.0.0` (dev) | `7.0.0` | ✅ imported | Visual tests |
| `vercel` | `latest` (dev) | `54.14.2` | 🔧 tooling | Vercel CLI; floating tag |

### 1.2 `bonds-v2/package.json`

| Package | Declared | Latest (npm) | Status | Notes |
|---|---|---|---|---|
| `@supabase/auth-helpers-nextjs` | `^0.9.0` | `0.15.0` | ✅ imported | **Deprecated** by Supabase |
| `@supabase/supabase-js` | `^2.108.1` | `2.108.2` | ✅ imported | Auth + data |
| `html2canvas` | `^1.4.1` | `1.4.1` | ⚠️ unused | Loaded via CDN in `calculators/shared-export.js` |
| `jspdf` | `^2.5.1` | `4.2.1` | ⚠️ unused | Loaded via CDN in `calculators/shared-export.js` |
| `next` | `^14.2.21` | `16.2.9` | ✅ imported | Next.js app router |
| `react` | `^18.3.1` | `19.2.7` | ✅ imported | UI runtime |
| `react-dom` | `^18.3.1` | `19.2.7` | 🔀 transitive | Required by Next.js runtime |
| `stripe` | `^22.2.0` | `22.2.1` | ✅ imported | Checkout/webhook routes |
| `autoprefixer` | `^10.4.0` (dev) | `10.5.0` | 🔧 tooling | PostCSS config |
| `jest` | `^29.7.0` (dev) | `30.4.2` | ✅ imported | Test runner |
| `postcss` | `^8.4.0` (dev) | `8.5.15` | 🔧 tooling | Build pipeline |
| `tailwindcss` | `^3.4.0` (dev) | `4.3.1` | 🔧 tooling | Styling framework |

### 1.3 `v3/package.json`

| Package | Declared | Latest (npm) | Status | Notes |
|---|---|---|---|---|
| `@supabase/supabase-js` | `^2.108.1` | `2.108.2` | ✅ imported | Engine + API |
| `nodemailer` | `^6.10.1` | `9.0.1` | ✅ imported | Alert email helper |
| `stripe` | `^22.2.1` | `22.2.1` | ✅ imported | Billing API |
| `pg` | `^8.21.0` (dev) | `8.21.0` | ✅ imported | Migration/setup scripts only |

---

## 2. Duplicate Packages Across Workspaces

| Package | Root | bonds-v2 | v3 | Issue / Recommendation |
|---|---|---|---|---|
| `@supabase/supabase-js` | `^2.106.2` | `^2.108.1` | `^2.108.1` | Root is one minor behind; unify on `^2.108.1` |
| `stripe` | `^15.12.0` | `^22.2.0` | `^22.2.1` | Root is **7 majors behind**; unify on `^22.2.x` |
| `nodemailer` | `^8.0.10` | — | `^6.10.1` | Divergent majors (8 vs 6 vs latest 9); pick one major |
| `pg` | `^8.21.0` (dev) | — | `^8.21.0` (dev) | Same version; could be hoisted to root devDeps only |
| `jest` | `^30.4.2` (dev) | `^29.7.0` (dev) | — | Different majors; unify on latest |

---

## 3. Potentially Unused / Misclassified Packages

| Package | Workspace | Declared As | Verdict | Evidence |
|---|---|---|---|---|
| `@sentry/node` | root | dependency | ❌ unused | No source import; remove or instrument APIs |
| `html2canvas` | bonds-v2 | dependency | ❌ unused as module | Only loaded from CDN in `calculators/shared-export.js` |
| `jspdf` | bonds-v2 | dependency | ❌ unused as module | Only loaded from CDN in `calculators/shared-export.js` |
| `react-dom` | bonds-v2 | dependency | 🔀 transitive | Not imported in source; peer/runtime requirement of Next.js |
| `autoprefixer` / `postcss` / `tailwindcss` | bonds-v2 | devDependencies | 🔧 tooling | Used by config files, not imported in JS |

---

## 4. Missing Declared Dependencies

| Package | Used In | Suggested Action |
|---|---|---|
| `puppeteer` | `scripts/debug-pdf.js`<br>`scripts/generate-report.js`<br>`scripts/generate-study-pdf.js`<br>`scripts/html-to-pdf.js` | Add `puppeteer` to **root devDependencies**<br>or delete the unused PDF scripts |

---

## 5. Outdated / Risky Versions

| Package | Workspace | Declared | Latest | Risk Level | Notes |
|---|---|---|---|---|---|
| `vercel` | root | `latest` | `54.14.2` | 🔴 high | Non-reproducible installs; pin to `^54.14.2` |
| `stripe` | root | `^15.12.0` | `22.2.1` | 🔴 high | Very outdated; API & security fixes missed |
| `next` | bonds-v2 | `^14.2.21` | `16.2.9` | 🟡 medium | 2 majors behind |
| `react` / `react-dom` | bonds-v2 | `^18.3.1` | `19.2.7` | 🟡 medium | Keep aligned with Next upgrade |
| `jspdf` | bonds-v2 | `^2.5.1` | `4.2.1` | 🟡 medium | 2 majors behind |
| `@supabase/auth-helpers-nextjs` | bonds-v2 | `^0.9.0` | `0.15.0` | 🟡 medium | Package is **deprecated**; migrate to `@supabase/ssr` |
| `tailwindcss` | bonds-v2 | `^3.4.0` | `4.3.1` | 🟡 medium | v4 has breaking changes; plan migration or stay on v3 LTS |
| `jest` | bonds-v2 | `^29.7.0` | `30.4.2` | 🟢 low | Test runner only |
| `pixelmatch` | root | `^5.3.0` | `7.2.0` | 🟢 low | Visual tests only |
| `axe-core` | root | `^4.10.2` | `4.12.1` | 🟢 low | Minor update |
| `@sentry/node` | root | `^10.57.0` | `10.58.0` | 🟢 low | Minor update |

---

## 6. Dev vs Prod Mismatches

| Package | Workspace | Current Classification | Issue |
|---|---|---|---|
| `@sentry/node` | root | `dependencies` | Listed as prod but never imported |
| `html2canvas` | bonds-v2 | `dependencies` | Listed as prod but not used as a module |
| `jspdf` | bonds-v2 | `dependencies` | Listed as prod but not used as a module |
| `puppeteer` | root | *missing* | Used by scripts but not declared anywhere |
| `pg` | root / v3 | `devDependencies` | Only used by one-off scripts; acceptable, but document CI usage |

---

## 7. Recommendations

1. **Remove dead dependencies**  
   - Delete `@sentry/node` from root, or actually instrument the APIs with Sentry.  
   - Remove `html2canvas` and `jspdf` from `bonds-v2` unless they will be imported there; the root site loads them from CDN.

2. **Unify duplicate packages**  
   - `stripe`: bump root to `^22.2.1` and align all workspaces.  
   - `@supabase/supabase-js`: use `^2.108.1` everywhere.  
   - `nodemailer`: choose a single major (test `^9.0.1` or standardize on `^6.10.1` for stability).  
   - `jest`: upgrade `bonds-v2` to `^30.4.2` to match root.

3. **Pin floating versions**  
   - Replace `vercel: "latest"` with a pinned caret range, e.g. `^54.14.2`.

4. **Fix missing dependency**  
   - Add `puppeteer` to root devDependencies or remove the four PDF-generation scripts.

5. **Address deprecated / major upgrades**  
   - Replace `@supabase/auth-helpers-nextjs` with `@supabase/ssr`.  
   - Plan a Next.js 15/16 + React 19 upgrade for `bonds-v2`; until then, keep Next 14 + React 18.

6. **Update low-risk dev tools**  
   - `axe-core`, `pixelmatch`, `tailwindcss` (or migrate to Tailwind v4 when ready).

7. **Document workspace boundaries**  
   - Root = static site + Vercel serverless APIs.  
   - `bonds-v2` = Next.js Pro dashboard.  
   - `v3` = economic-intelligence API engine.  
   Keep shared deps (Supabase, Stripe) in sync across all three.
