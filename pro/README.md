# Bonds Pro MVP

مجلد منفصل لتطبيق Bonds Pro المصغر داخل نفس الـ repo.

## ما يحتويه

- `index.html` — صفحة حاسبة Pro.
- `report.html` — عرض التقرير بعد الدفع.
- `login.html` — تسجيل دخول / إنشاء حساب.
- `styles.css` + `app.js` — الأنماط والمنطق.
- `pro-engine.js` — محرك الجدوى والذكاء الاصطناعي البسيط.

## APIs

- `POST /api/pro-calculate` — حساب الجدوى.
- `GET|POST /api/pro-report?format=html` — إنشاء HTML للتقرير.
- `POST /api/pro-stripe` — إنشاء Checkout session.
- `POST /api/pro-auth` — تسجيل دخول / إنشاء حساب.

## التشغيل محلياً

```bash
npx serve .
```

افتح `http://localhost:3000/pro/`

## الإعداد على Vercel

تأكد من وجود المتغيرات البيئية:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ENTERPRISE`
- `NEXT_PUBLIC_APP_URL`

## ملاحظة

هذا MVP يعمل فوراً ضمن `/pro/` ولا يمس الموقع الحالي.
