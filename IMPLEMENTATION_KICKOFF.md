# Bonds Global — Implementation Kickoff

> قائمة المهام الجاهزة للتنفيذ الفني. تتطلب هذه المهام تعديل الكود والإعدادات.

---

## P0 — مهام يجب تنفيذها فورًا

### 1. Rate Limiting Middleware ✅

**الملفات المُحدّثة:**
- `lib/api/rate-limit.js` (جديد)
- `api/contact.js`, `api/track.js`, `api/usage.js`, `api/pro.js`
- `api/create-checkout.js`, `api/billing.js`, `api/password.js`, `api/admin.js`, `api/webhook.js`, `api/bank-transfer.js`
- `api/v3/index.js`

**المخرجات:**
- 429 status مع `Retry-After` header.
- 100 req/min للـ public، 10 req/min للـ auth، 20 req/min للـ compute/ai، 5 req/min للـ strict، 1000 req/min للـ webhook.

### 2. JWT Validation for Billing ✅

**الملفات المُحدّثة:**
- `api/create-checkout.js`
- `api/billing.js`
- `lib/api/auth-helper.js` (جديد)
- `pricing.html` و `en/pricing.html` و `calculators/auth/subscription.html`

**المخرجات:**
- رفض الطلبات بدون Bearer token صالح.
- التأكد من أن `userId` يطابق المستخدم.

### 3. Remove Hardcoded Owner Email ✅

**الملفات المُحدّثة:**
- `api/admin.js`
- `admin/reset.html`
- `admin/force-reset.html`
- `admin-auth-v2.js`
- `bonds-auth-2026.js`

**المخرجات:**
- استخدام `ADMIN_EMAIL` / `ADMIN_EMAILS` من env.
- `.env.example` محدّث.

### 4. Fix DB Conflicts ✅

**الملفات المُحدّثة:**
- `supabase/migrations/20260618000000_reconcile_ingredients_and_subscriptions.sql`
- `calculators/menu-engineering.html`
- `en/calculators/menu-engineering.html`

**المخرجات:**
- إعادة تسمية `ingredients` (menu engineering) إلى `menu_ingredients`.
- إنشاء جداول المكونات/الوصفات للتكلفة: `ingredients`, `ingredient_prices`, `recipes`, `recipe_ingredients`.
- توحيد `subscriptions` على `tier` مع إضافة `cancel_at_period_end`, `stripe_price_id`, `current_period_start` والـ RLS الموحد.

### 5. Update `.gitignore` & `.env.example` ✅

**الملفات المُحدّثة:**
- `.gitignore`
- `.env.example`

**المخرجات:**
- منع رفع `.env*.local` و `package-lock.json`.
- توثيق جميع المتغيرات المطلوبة.

### 6. CSP & Security Headers ✅

**الملفات المُحدّثة:**
- `vercel.json`

**المخرجات:**
- `Content-Security-Policy-Report-Only`.
- `X-Content-Type-Options: nosniff`، `X-Frame-Options: DENY`، `Referrer-Policy`.

---

## P1 — مهام قصيرة المدى

1. توحيد admin auth middleware.
2. إضافة validation schemas.
3. تنظيف RLS policies.
4. تحديث `stripe` إلى `^22.2.x`.
5. إضافة CSP headers في `vercel.json`.

---

## P2 — مهام متوسطة المدى

1. بناء CRM tables.
2. بناء Credit Scoring API.
3. تفعيل V3 cache layer.
4. إضافة API tests.

---

## معايير القبول قبل الدمج

- [ ] جميع الـ P0 tests تمر.
- [ ] `npm test` يمر بدون أخطاء.
- [ ] `npm audit` لا يظهر critical issues.
- [ ] Manual smoke test على staging.

---

## ملاحظة

هذا الملف جاهز للتنفيذ.  **يتطلب التنفيذ الفعلي تعديل الكود.**  
يرجى تأكيد البدء قبل المتابعة.
