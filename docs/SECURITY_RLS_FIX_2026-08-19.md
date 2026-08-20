# إصلاح أمني عاجل: تفعيل Row Level Security (RLS)

**التاريخ:** 19 أغسطس 2026  
**الملف:** `supabase/migrations/20260819000000_emergency_rls_lockdown.sql`  
**الحالة:** ⚠️ يجب التطبيق فوراً — البيانات مكشوفة للعامة حالياً

---

## ما المشكلة؟

أرسل Supabase تنبيهاً بأن بعض الجداول في مشروع `hutxsqzplyuqgnghsrcs` مفتوحة للعامة (Public) لأن **RLS معطل** عليها. من أهمها جداول التواصل الاجتماعي الجديدة:

- `social_accounts`
- `social_posts`
- `social_scheduled_posts`

بالإضافة إلى جداول أخرى قد لا يكون RLS مفعلاً عليها بشكل كامل.

---

## ما الذي تم عمله؟

تم إنشاء migration شاملة تقوم بما يلي:

1. تفعيل RLS على **جميع جداول public**.
2. إجبار RLS على حساب `postgres` (_FORCE ROW LEVEL SECURITY_).
3. إضافة سياسة `service_role` لكل جدول (للوظائف الخادومية).
4. إadd سياسة قراءة للمسؤولين (`admin_select`) لكل جدول.
5. قفل جداول التواصل الاجتماعي بحيث لا يمكن للعامة قراءتها.
6. الحفاظ على السلوك الآمن للجداول العامة:
   - `contact_messages` → إدراج بدون تسجيل دخول فقط.
   - `calculator_leads` → إدراج بدون تسجيل دخول فقط.
   - `water_factory_market_data` / `sector_market_data` → قراءة فقط للبيانات النشطة.
   - `page_views` / `user_presence` → إدراج/تحديث بدون تسجيل دخول، لكن بدون قراءة.

---

## طريقة التطبيق (اختر إحداها)

### الطريقة 1: SQL Editor في Supabase (الأسرع)

1. افتح لوحة تحكم Supabase:  
   [https://supabase.com/dashboard/project/hutxsqzplyuqgnghsrcs](https://supabase.com/dashboard/project/hutxsqzplyuqgnghsrcs)
2. من القائمة الجانبية اختر **SQL Editor**.
3. اضغط **New query**.
4. انسخ محتوى الملف:  
   `supabase/migrations/20260819000000_emergency_rls_lockdown.sql`
5. اضغط **Run**.
6. تأكد أن نتيجة الاستعلام الأخير (التحقق) **لا تعيد أي صفوف**.

### الطريقة 2: GitHub Actions (آلي)

1. ادفع الملف إلى فرع `main`:
   ```bash
   git add supabase/migrations/20260819000000_emergency_rls_lockdown.sql
   git commit -m "security: emergency RLS lockdown for all public tables"
   git push origin main
   ```
2. سيشغّل workflow `.github/workflows/apply-migrations.yml` تلقائياً.
3. يمكنك متابعة الحالة في تبويب **Actions** في GitHub.

### الطريقة 3: تشغيل يدوي عبر API

إذا كنت تريد تطبيقه مباشرة عبر endpoint المشرف:

```bash
curl -X POST "https://bonds-global.com/api/admin?action=run-migrations&cronSecret=CRON_SECRET_HERE&migration_file=supabase/migrations/20260819000000_emergency_rls_lockdown.sql"
```

استبدل `CRON_SECRET_HERE` بالقيمة الفعلية من متغيرات البيئة.

---

## التحقق من النجاح

بعد التطبيق، شغّل هذا الاستعلام في **SQL Editor**:

```sql
SELECT c.relname AS tablename,
       NOT c.relrowsecurity AS rls_disabled,
       (SELECT COUNT(*) FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '_%'
  AND (
    NOT c.relrowsecurity
    OR NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname AND p.tablename = c.relname
    )
  )
ORDER BY c.relname;
```

**يجب أن يكون الناتج فارغاً** (صفر صفوف). إذا ظهرت جداول، فهي لا تزال غير محمية.

---

## ملاحظات مهمة

- الملف **idempotent** — يمكن تشغيله أكثر من مرة دون أخطاء.
- لا يحذف البيانات، فقط يضيف سياسات الأمان.
- الوظائف الخادومية (service_role) لن تتأثر.
- المستخدمون المسجلون سيستمرون في الوصول إلى بياناتهم الخاصة عبر السياسات السابقة.

---

## بعد التطبيق

1. ارجع إلى تنبيه Supabase واضغط **Resolve** أو **Review**.
2. إذا استمر التنبيه، انتظر بضع دقائق ثم أعد فحص التنبيه.
3. اختبر الموقع للتأكد من عدم وجود تأثيرات جانبية.
