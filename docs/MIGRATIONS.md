# دليل ترحيل قاعدة بيانات بوندز (Supabase Migrations)

هذا الدليل يشرح كيفية تطبيق ترحيلات Supabase على قاعدة البيانات الفعلية.

## الملفات الموجودة

- `supabase/migrations/` — ملفات SQL الترحيلية.
- `.github/workflows/apply-migrations.yml` — GitHub Actions workflow لتطبيق الترحيلات تلقائياً.
- `supabase/migrations/20260708000000_economic_life_database.sql` — جدول `economic_life_database`.
- `supabase/migrations/20260709000000_depreciation_factors.sql` — جدول `depreciation_factors`.
- `supabase/migrations/20260710000000_market_intelligence.sql` — جدول `market_data`.
- `supabase/migrations/20260711000000_market_intelligence_v2.sql` — التوسعة الكاملة للذكاء السوقي (تاريخ، رؤى، جغرافيا، مصادر).
- `supabase/migrations/20260712000000_market_intelligence_sources.sql` — مصادر بيانات خارجية موثوقة جاهزة للعمل (KAPSARC + World Bank) للسعودية.
- `supabase/migrations/20260713000000_market_intelligence_arab_sources.sql` — مؤشرات ماكرو اقتصادية (تضخم + نمو ناتج محلي) لجميع الدول العربية الـ 22.
- `supabase/migrations/20260714000000_condition_assessment.sql` — جدول `condition_assessment_standards` + معايير 35 فئة أصل.
- `supabase/migrations/20260715000000_asset_condition_assessments.sql` — جدول حفظ التقييمات الفردية `asset_condition_assessments`.
- `supabase/migrations/20260716000000_assessment_due_date.sql` — تتبع `next_assessment_due` + view `assets_due_for_reassessment`.
- `supabase/migrations/20260725000000_enterprise_lifecycle_engine.sql` — جداول محرك دورة الحياة المؤسسية (instances, transitions, approvals, tasks, events, timeline).
- `supabase/migrations/20260726000000_enterprise_lifecycle_multi_user_rls.sql` — سياسات RLS متعددة المستخدمين للـ Enterprise Lifecycle (للقراءة من المشاركين والموافقات).
- `supabase/apply-cae-migrations.sql` — ملف مجمع للتطبيق اليدوي السريع لترحيلات Condition Assessment.

## الخطوة 1: إضافة الأسرار في GitHub

1. افتح الريبو: `https://github.com/alzahrani6020/bonds-global-web`
2. اذهب إلى: **Settings → Secrets and variables → Actions → New repository secret**
3. أضف السرين التاليين:

| الاسم | القيمة | من أين تحصل عليه |
|-------|--------|------------------|
| `SUPABASE_ACCESS_TOKEN` | توكن الوصول الشخصي | Supabase Dashboard → Account → Access Tokens → New token |
| `SUPABASE_PROJECT_REF` | رمز المشروع | Supabase Project Settings → General → Reference ID (مثل `abcdefgh12345678`) |

## الخطوة 2: التطبيق التلقائي

بعد إضافة الأسرار، أي `push` إلى فرع `main` يتضمن تعديلاً في `supabase/migrations/` سيطبّق `supabase db push` تلقائياً.

## الخطوة 3: التطبيق اليدوي (اختياري)

إذا أردت تطبيق الترحيلات يدوياً من جهازك:

```bash
# 1. تثبيت Supabase CLI
npm install -g supabase

# 2. ربط المشروع
supabase link --project-ref <SUPABASE_PROJECT_REF>

# 3. تطبيق الترحيلات
supabase db push
```

أو باستخدام Docker:

```bash
npx supabase link --project-ref <SUPABASE_PROJECT_REF>
npx supabase db push
```

## التحقق من التطبيق

بعد التطبيق، تأكد من وجود الجداول في Supabase Studio:

- `public.economic_life_database`
- `public.depreciation_factors`
- `public.market_data`
- `public.market_data_history`
- `public.market_data_sources`
- `public.condition_assessment_standards`
- `public.asset_condition_assessments`
- `public.assets_due_for_reassessment` (view)

وأن بيانات 35 فئة الأصل موجودة في كليهما.

## تحديث البيانات بعد التطبيق

### Economic Life Database

يمكن التعديل من لوحة الإدارة:

```
/admin/economic-life.html
```

أو مباشرة من Supabase Studio → Table Editor → `economic_life_database`.

### Depreciation Factors

يمكن التعديل من لوحة الإدارة:

```
/admin/depreciation-factors.html
```

### Market Intelligence

يمكن التعديل من لوحة الإدارة:

```
/admin/market-intelligence.html
```

أو عبر API:

```bash
curl -X POST https://bonds-global.com/api/market-intelligence \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "assetClass": "factory",
    "country": "SA",
    "region": "Riyadh",
    "sector": "industrial",
    "averageSellingPrice": 2000000,
    "demandIndex": 8,
    "supplyIndex": 3,
    "riskScore": 5,
    "outlook": "neutral",
    "confidence": 0.8,
    "dataQualityScore": 75
  }'
```

لجلب التاريخ:

```bash
curl "https://bonds-global.com/api/market-intelligence?history=1&assetClass=factory&limit=30"
```

لتشغيل التحديث التلقائي من المصادر الخارجية يدوياً:

```bash
curl -X POST "https://bonds-global.com/api/market-intelligence?cronSecret=$CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"refresh"}'
```

جدولة التحديث التلقائي موجودة في `.github/workflows/market-intelligence-refresh.yml` وتعمل **كل 3 ساعات** (cron: `0 */3 * * *` UTC). تحتاج `CRON_SECRET` و `SITE_URL` في GitHub Secrets/Variables. بعد كل تحديث مجدول يُرسل تقرير بريدي (عربي/إنجليزي) بالنتائج إلى العناوين في متغير البيئة `REPORT_EMAILS` (افتراضياً `gm@bonds-global.com,info@bonds-global.com`، والبديل `MANAGER_EMAIL` ثم `ADMIN_EMAIL`) عبر Resend/SMTP حسب إعداد `lib/api/email.js`.

### المصادر الخارجية المُفعّلة

بعد تطبيق الترحيلات، ستجد مصادر جاهزة في جدول `market_data_sources`:

| المصدر | النطاق | البيانات | الرابط |
|---|---|---|---|
| KAPSARC Saudi RE Index | السعودية | مؤشر أسعار العقارات (عام، سكني، تجاري) | `datasource.kapsarc.org` |
| KAPSARC Saudi Repo Rate (RR) | السعودية | سعر الريبو الرسمي من SAMA | `datasource.kapsarc.org` |
| World Bank — Inflation (CPI) | 22 دولة عربية | التضخم السنوي | `api.worldbank.org` |
| World Bank — GDP Growth | 22 دولة عربية | النمو الاقتصادي السنوي | `api.worldbank.org` |

الدول العربية المدعومة:

`SA` `AE` `BH` `DZ` `EG` `IQ` `JO` `KW` `LB` `LY` `MA` `OM` `PS` `QA` `SD` `SY` `TN` `YE` `DJ` `SO` `MR` `KM`

جميعها APIs عامة ولا تحتاج مفاتيح. يمكن إضافة/تعديل المصادر من `/admin/market-intelligence.html`.

### Depreciation Factors

يمكن التعديل من لوحة الإدارة:

```
/admin/depreciation-factors.html
```

أو عبر API:

```bash
curl -X POST https://bonds-global.com/api/depreciation-factors \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "assetClass": "factory",
    "factors": { "economic": 1.2, "operational": 1.3 },
    "methods": { "accounting": "straight-line" }
  }'
```

**ملاحظة:** التحديث عبر API يتطلب مستخدمًا لديه دور `admin` أو `editor` في جدول `user_roles`.

## Troubleshooting

### خطأ: `failed to connect to postgres`

- تأكد من أن `SUPABASE_PROJECT_REF` صحيح.
- تأكد من أن المشروع نشط في Supabase.

### خطأ: `RLS policy denies`

- تأكد من أن الجدول `user_roles` يحتوي على المستخدم المُسجّل مع دور `admin` أو `editor`.

### خطأ: `relation already exists`

- ملفات الترحيل تستخدم `CREATE TABLE IF NOT EXISTS`، لذا لا مشكلة. لكن إذا كان هناك تعارض في الأعمدة، راجع المigration المناسب.
