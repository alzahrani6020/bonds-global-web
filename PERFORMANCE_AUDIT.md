# Performance Audit — Bonds Global Enterprise Upgrade

## 1. Frontend

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| PERF-01 | **Critical** | Large third-party libraries loaded synchronously on many pages | Chart.js, jsPDF, html2canvas, SheetJS in calculators |
| PERF-02 | **High** | No lazy loading / code splitting | All JS/CSS loaded in `<head>` |
| PERF-03 | **High** | `innerHTML` rebuilds entire views causing layout thrashing | Admin SPA modules re-render large tables |
| PERF-04 | **High** | Chart instances not always destroyed before re-render | `admin/executive-dashboard/app.js`, `admin/ai-business-advisor/app.js` |
| PERF-05 | **Medium** | Service Worker cache version is manual | `sw.js` `CACHE_VERSION` |
| PERF-06 | **Medium** | No image optimization pipeline | Static webp/jpg files committed directly |
| PERF-07 | **Medium** | No CDN for static assets | Served from Vercel origin |
| PERF-08 | **Low** | Fonts loaded from Google Fonts without `display=swap` | Some pages use default display |

## 2. Backend / Database

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| PERF-09 | **Critical** | Admin modules fetch entire tables without pagination | `service.js` files use `.select('*')` without range |
| PERF-10 | **High** | Multiple independent Supabase queries fired in parallel but without caching | `getMetrics()` re-fetches everything on every refresh |
| PERF-11 | **High** | No query result caching layer | Every dashboard refresh hits Postgres |
| PERF-12 | **Medium** | Duplicate indexes increase write overhead | `idx_subscriptions_stripe_sub*` duplicates |
| PERF-13 | **Medium** | Missing indexes on reporting date columns | `subscriptions.current_period_start`, `moyasar_invoices.paid_at` |
| PERF-14 | **Medium** | No connection pooling configuration visible | Supabase client created with default pool |
| PERF-15 | **Low** | Vercel Hobby function limit (12) reached/near | Static + API functions; new API functions avoided by design |

## 3. Memory & Runtime

- Admin modules keep large datasets in memory.
- Event listeners attached to dynamically generated elements may accumulate.
- Realtime subscriptions not unsubscribed on view change.

## 4. Recommendations

1. **Lazy-load** Chart.js, jsPDF, html2canvas only when needed (dynamic import or conditional script injection).
2. **Paginate all list queries** with `range()` and server-side search.
3. **Cache dashboard metrics** in `localStorage` / IndexedDB with TTL; refresh in background.
4. **Destroy Chart instances** before creating new ones.
5. **Debounce** search inputs and window resize handlers.
6. **Add missing indexes** identified in DATABASE_AUDIT.md.
7. **Remove duplicate indexes**.
8. **Implement a client-side cache layer** (`BondsCache`) backed by IndexedDB.
9. **Use Vercel Edge Config or KV** for infrequently changing settings.
10. **Automate image optimization** and serve next-gen formats.
