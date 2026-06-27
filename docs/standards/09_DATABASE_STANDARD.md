# 09 — Database Standard (معيار قواعد البيانات)

## الهدف
بناء قاعدة بيانات متسقة، موثقة، آمنة، وقابلة للتطوير.

## النطاق
- جميع جداول Supabase.
- جميع الترحيلات في `supabase/migrations/`.
- جميع سياسات RLS.

---

## القواعد الإلزامية (Mandatory)

### M1 — جميع التغييرات عبر Migrations
- لا يُسمح بتعديل schema يدوياً في Supabase دون migration.
- كل migration يجب أن يكون مرقماً بترتيب زمني واضح.

### M2 — تعليقات الجداول والأعمدة
- كل جدول يجب أن يحمل `COMMENT ON TABLE`.
- كل عمود يجب أن يحمل `COMMENT ON COLUMN` يوضح الوحدة والمصدر.

### M3 — RLS مُفعّل
- كل جدول جديد يجب تفعيل RLS عليه.
- يجب أن تحتوي على سياسات واضحة للقراءة والكتابة.

### M4 — Indexes
- كل عمود أجنبي (foreign key) يجب أن يملك index.
- كل عمود يُستخدم في البحث المتكرر يجب أن يملك index.

### M5 — Naming Convention
- الجداول: snake_case، جمع (مثلاً `asset_valuations`).
- الأعمدة: snake_case.
- المفاتيح الخارجية: `table_name_id`.

### M6 — Constraints
- يجب استخدام `CHECK` للقيم المحدودة (enum).
- يجب استخدام `UNIQUE` عند الحاجة.
- يجب استخدام `NOT NULL` للحقول الإلزامية.

---

## القواعد الموصى بها (Recommended)

### R1 — Soft Deletes
- استخدام عمود `deleted_at` بدلاً من الحذف الفعلي للسجلات المهمة.

### R2 — Audit Columns
- كل جدول يحتوي على `created_at` و `updated_at`.

---

## أمثلة

### ✅ صحيح
```sql
CREATE TABLE public.asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.asset_valuations IS 'Canonical header for every valuation run';
```

### ❌ خاطئ
```sql
CREATE TABLE valuations (
  id serial PRIMARY KEY,
  name text
);
```

---

## كيفية القياس
1. `npm run audit:migrations`.
2. مراجعة كل migration لوجود RLS و indexes و comments.
3. `supabase db diff` (إذا كان CLI متصلاً).
4. فحص `supabase/migrations/` للترقيم.

## Severity عند المخالفة
- **Critical:** تغيير schema بدون migration.
- **High:** جدول بدون RLS.
- **Medium:** عمود أجنبي بدون index.
- **Low:** نقص comments.

## طريقة الإصلاح
- إنشاء migration جديد.
- إضافة RLS policies.
- إضافة indexes.
- إضافة comments.
