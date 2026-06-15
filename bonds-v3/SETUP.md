# Bonds V3 — Supabase Setup Guide

## 1. إنشاء مشروع Supabase

1. ادخل إلى [supabase.com](https://supabase.com)
2. أنشئ مشروعاً جديداً
3. احفظ:
   - **Project URL**
   - **anon/public key**
   - **service_role key** (سرّي)

الموقع: **Project Settings → API**

## 2. إضافة المتغيرات إلى Vercel

من داخل مجلد `bonds-v3` شغّل:

```bash
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

> ملاحظة: `SUPABASE_SERVICE_ROLE_KEY` يمنح صلاحيات كاملة، لا تشاركه أبداً في frontend.

## 3. تطبيق الـ Schema

1. افتح **Supabase SQL Editor**
2. أنشئ New query
3. افتح الملفات بالترتيب:
   ```
   bonds-v3/supabase/migrations/20260611000000_v3_master_data_v1.sql
   bonds-v3/supabase/migrations/20260613000000_v3_subscriptions.sql
   bonds-v3/supabase/migrations/20260614000000_v3_master_data_v2.sql
   bonds-v3/supabase/migrations/20260615000000_v3_data_acquisition_platform.sql
   ```
4. انسخ محتوى كل ملف والصقه
5. اضغط **Run**

أو عبر السكربت (إذا كان `SUPABASE_DB_URL` متوفراً):
```bash
cd bonds-v3
node scripts/apply-migration-direct.js 20260615000000_v3_data_acquisition_platform.sql
```

## 4. تطبيق الـ Seeds (البيانات)

### الطريقة 1: عبر السكربت (أسرع)

1. أنشئ ملف `.env.local` في `bonds-v3/`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. شغّل:
   ```bash
   cd bonds-v3
   node scripts/apply-seeds.js
   ```

### الطريقة 2: عبر SQL Editor

1. افتح ملف:
   ```
   bonds-v3/supabase/seed/all-seeds.sql
   ```
2. انسخه والصقه في Supabase SQL Editor
3. اضغط Run

## 5. إعادة نشر Vercel

بعد إضافة المتغيرات:

```bash
cd bonds-v3
npx vercel --prod
```

## 6. اختبار النظام

```bash
cd bonds-v3
node scripts/test-api.js
```

إذا نجحت جميع الاختبارات، أصبح Bonds V3 جاهزاً للعمل.

## 7. تفعيل LLM (اختياري)

```bash
npx vercel env add OPENAI_API_KEY production
npx vercel env add OPENAI_MODEL production
```

ثم أعد النشر.
