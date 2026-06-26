# مقترح الخطوات التالية — نظام تقييم حالة الأصول (CAE)

> **الحالة الحالية**: تم تنفيذ معظم المهام المقترحة في هذا المقترح (انظر قسم "حالة التنفيذ" في الأسفل). آخر commit مرجعي هو `ef3a2c0`.
>
> تم إنجاز CAE v1 ويشمل:
> - محرك التقييم (120 نقطة فحص / 10 فئات / 35 فئة أصل).
> - حفظ/تحميل التقييمات الفردية في `asset_condition_assessments`.
> - تصدير تقرير PDF.
> - سجل تاريخي + رسم بياني لتطور Condition Score.
>
> هذا المقترح يغطي ثلاثة محاور: **(1) خطة النشر إلى الإنتاج**، **(2) تحسينات CAE المقترحة**، **(3) معالجة التحذيرات والجودة**.

---

## 1. خطة نشر CAE على الإنتاج

### 1.1 تفعيل أسرار GitHub Actions

ملف CI الحالي يحتاج إلى الأسرار التالية لكي يتمكن من تطبيق ترحيلات Supabase تلقائيًا:

| السر | المصدر | الاستخدام |
|------|--------|-----------|
| `SUPABASE_ACCESS_TOKEN` | إعدادات المشروع في Supabase → Project Settings → API → Access Token | المصادقة مع Supabase CLI |
| `SUPABASE_PROJECT_REF` | نفس الصفحة (`reference id`) | تحديد المشروع المستهدف |
| `CRON_SECRET` | قيمة عشوائية تُنشئها أنت | حماية نقاط نهاية Cron/Vercel |
| `SITE_URL` | `https://bonds-global.com` أو النطاق المخصص | روابط البريد/الفواتير |

**الخطوة**: اذهب إلى `GitHub Repo → Settings → Secrets and variables → Actions → New repository secret` وأضفهم.

### 1.2 تطبيق الترحيلات على قاعدة البيانات الحية

بسبب غياب الأسرار السابقة، لم تُطبّق الترحيلات على Supabase بعد. يجب تشغيلها يدويًا:

1. افتح **Supabase SQL Editor**.
2. شغّل بالترتيب:
   - `supabase/migrations/20260714000000_condition_assessment.sql`
   - `supabase/migrations/20260715000000_asset_condition_assessments.sql`
3. تحقق من إنشاء الجداول:
   ```sql
   SELECT COUNT(*) FROM public.condition_assessment_standards;
   SELECT COUNT(*) FROM public.asset_condition_assessments;
   ```

> **بديل**: بعد إضافة الأسرار، شغّل `npx supabase db push` محليًا، أو دع GitHub Actions يطبقها تلقائيًا.

### 1.3 قائمة التحقق بعد النشر

- [ ] فتح `/valuation/index.html` واختيار فئة أصل.
- [ ] ملء بعض نقاط الفحص والتحقق من حساب Score/Grade/Confidence.
- [ ] حفظ تقييم جديد والتأكد من ظهوره في السجل.
- [ ] تغيير تاريخ أو معرّف الأصل والتأكد من تحديث الرسم البياني.
- [ ] تجربة تصدير PDF.
- [ ] فتح `/admin/condition-assessment.html` والتأكد من تحميل المعايير.
- [ ] تشغيل `npm test` و `npm run audit` بعد النشر للتأكد من عدم ظهور مشاكل جديدة.

---

## 2. تحسينات مقترحة على CAE

### 2.1 لوحة مقارنة الأصول (Asset Comparison)

**الوصف**: تمكين المستخدم من اختيار عدة تقييمات لنفس فئة الأصل وعرضها جانبًا إلى جانب.

**ما يُضاف**:
- جدول مقارنة: الاسم، المعرف، التاريخ، Score، Grade، Confidence، عدد الإخفاقات الحرجة.
- رسم بياني مجمع (grouped bar) لكل أصل.
- تصدير الجدول إلى Excel/PDF.

**الملفات المتأثرة**:
- `valuation/valuation-ui.js`
- `valuation/valuation-locale.js`
- `valuation/valuation.css`

**الأولوية**: P1
**التكلفة**: منخفضة — تستخدم البيانات الموجودة ولا تحتاج API جديد.

---

### 2.2 تقرير الصيانة وخطة العمل (Maintenance Action Plan)

**الوصف**: تحويل الإخفاقات الحرجة ونقاط الضعف إلى قائمة مهام صيانة مرتبة حسب الأولوية.

**ما يُضاف**:
- إنشاء قائمة تلقائية من `criticalFailures` + الفئات التي درجتها < 60.
- تقدير تكلفة الصيانة بناءً على فئة الأصل (يمكن البدء بقيم افتراضية قابلة للتعديل).
- تصدير تقرير منفصل بعنوان "خطة صيانة مقترحة".

**الملفات المتأثرة**:
- `valuation/condition-assessment-engine.js` (إضافة `generateMaintenancePlan`)
- `valuation/valuation-ui.js`
- `valuation/condition-assessment-client.js` (حفظ الخطة مع التقييم اختياريًا)

**الأولوية**: P1
**التكلفة**: متوسطة.

---

### 2.3 تذكير إعادة التقييم (Re-evaluation Reminders)

**الوصف**: تنبيه المستخدم عندما يكون تقييم أصل قديمًا (> 6 أشهر أو 12 شهرًا).

**الحل المقترح**:
- استخدام **Supabase Cron** أو **pg_cron** لإرسال تذكيرات عبر البريد/اللوحة.
- بدون إضافة دالة Vercel جديدة (نحن عند الحد الأقصى 12/12).
- إضافة حقل `next_assessment_due` في `asset_condition_assessments` وتحديثه عند الحفظ.

**الملفات المتأثرة**:
- `supabase/migrations/20260716000000_assessment_due_date.sql`
- `valuation/valuation-ui.js` (إظهار شارة "يحتاج إعادة تقييم")

**الأولوية**: P2
**التكلفة**: منخفضة إلى متوسطة.

---

### 2.4 الربط التلقائي مع محرك التقييم (Valuation Engine)

**الوصف**: بعد حساب Condition Score، يتم تعبئة حقول التقييم الأساسية تلقائيًا (مثل `conditionScore`, `maintenanceLevel`, `inspectionScore`).

**ما يُضاف**:
- زر "تطبيق على التقييم" يملأ الحقول في النموذج الرئيسي.
- تخزين الربط في `valuation_inputs` موجود بالفعل؛ يحتاج فقط UI.

**الملفات المتأثرة**:
- `valuation/valuation-ui.js`

**الأولوية**: P0
**التكلفة**: منخفضة جدًا.

---

### 2.5 دعم اللغة الإنجليزية في لوحة إدارة CAE

**الوصف**: جعل `/admin/condition-assessment.html` تدعم `lang` ديناميكيًا مثل بقية الصفحات.

**الملفات المتأثرة**:
- `admin/condition-assessment.html`
- `valuation/valuation-locale.js` (إضافة مفاتيح الإدارة)

**الأولوية**: P2
**التكلفة**: منخفضة.

---

## 3. معالجة التحذيرات والجودة

### 3.1 إصلاح `admin/dashboard.html:192`

**المشكلة**: هناك `</button>` يتيم عند السطر 276–278 بعد إضافة رابط "تقييم الحالة".

**الإصلاح**: حذف الأسطر الزائدة:

```html
<!-- احذف هذه الأسطر -->
  <svg ...>...</svg>
  <span>عوامل الاستهلاك</span>
</button>
```

**الملف المتأثر**: `admin/dashboard.html`
**الأولوية**: P0

---

### 3.2 تقليل عدد دوال Vercel

الحساب الحالي عند الحد الأقصى 12/12. للسماح بإضافة APIs مستقبلية:

| الاقتراح | التأثير |
|----------|---------|
| مراجعة `api/` وتحديد الدوال غير المستخدمة | حذف أو دمج |
| دمج APIs متشابهة (مثل `moyasar-checkout.js` + `create-checkout.js` تحت router واحد) | تقليل العدد |
| نقل بعض المنطق إلى Supabase Edge Functions | يحسب كدالة منفصلة على Vercel؟ لا، Edge Functions منفصلة عن limit |

**الأولوية**: P1
**التكلفة**: متوسطة — يتطلب اختبارًا دقيقًا.

---

### 3.3 تحسين اختبارات CAE

- إضافة اختبار لـ `renderHistoryChart` (mock لـ Chart.js).
- إضافة اختبار لحفظ/تحميل التقييمات عبر `BondsConditionAssessmentClient` (mock Supabase).
- التأكد من أن `asset_class` غير موجود في القائمة يرجع خطأ واضح.

**الملفات المتأثرة**: `tests/condition-assessment-engine.test.js` أو إنشاء `tests/condition-assessment-client.test.js`
**الأولوية**: P1
**التكلفة**: منخفضة.

---

## 4. خارطة الطريق المقترحة

| المرحلة | المهام | المدة التقديرية |
|---------|--------|-----------------|
| **الأسبوع 1** | نشر CAE على الإنتاج + تطبيق الترحيلات + إصلاح `dashboard.html` + ربط CAE بالتقييم | 2–3 أيام |
| **الأسبوع 2** | لوحة مقارنة الأصول + تقرير الصيانة | 3–4 أيام |
| **الأسبوع 3** | تذكير إعادة التقييم + دعم الإنجليزية للوحة الإدارة | 2–3 أيام |
| **الأسبوع 4** | مراجعة دوال Vercel + تحسين الاختبارات + تحديث الوثائق | 2–3 أيام |

---

## 5. المخاطر والاعتبارات

| المخاطر | التأثير | التخفيف |
|---------|---------|---------|
| عدم توفر أسرار GitHub Actions | يمنع النشر التلقائي للترحيلات | التطبيق اليدوي عبر SQL Editor |
| تجاوز حد Vercel 12/12 | يمنع إضافة API جديد | استخدام Supabase client/Edge Functions |
| تغييرات على معايير CAE قد تؤثر على التقييمات المحفوظة | بيانات تاريخية غير متسقة | حفظ `version` مع كل تقييم ودعم backward compatibility |
| RLS خاطئ | تسرب بيانات التقييمات | اختبار السياسات على بيئة staging |

---

## 6. حالة التنفيذ

| المهمة | الحالة | الملفات المعدلة |
|--------|--------|-----------------|
| إصلاح `admin/dashboard.html` | ✅ منفذ | `admin/dashboard.html` |
| ربط CAE تلقائيًا بمحرك التقييم | ✅ منفذ مسبقًا | `valuation/valuation-ui.js` |
| مقارنة الأصول | ✅ منفذ | `valuation/valuation-ui.js`, `valuation/valuation-locale.js`, `valuation/valuation.css` |
| تقرير الصيانة وخطة العمل | ✅ منفذ | `valuation/condition-assessment-engine.js`, `valuation/valuation-ui.js`, `valuation/valuation-locale.js`, `valuation/valuation.css` |
| تذكير إعادة التقييم | ✅ منفذ (جزء UI + DB) | `supabase/migrations/20260716000000_assessment_due_date.sql`, `admin/condition-assessment.html`, `valuation/valuation-ui.js` |
| دعم الإنجليزية في لوحة إدارة CAE | ⏳ غير منفذ | — |
| مراجعة/تقليل دوال Vercel | ⏳ تحليلي فقط | `docs/VERCEL_FUNCTIONS_OPTIMIZATION.md` (موصى إنشاؤه) |
| نشر CAE على الإنتاج | ⏳ ينتظر أسرار GitHub Actions + تطبيق الترحيلات | `docs/MIGRATIONS.md` |

## 7. التوصية الفورية

1. **P0**: تطبيق الترحيلات الثلاثة على Supabase الحية وإضافة أسرار GitHub Actions.
2. **P1**: دمج CAE مع العملاء الحاليين (استخدام لوحة الإدارة + عرض history في التقييم).
3. **P2**: إضافة دعم الإنجليزية لصفحة `admin/condition-assessment.html` ومراجعة دوال Vercel.

> لا يحتاج الأمر إلى موافقة جديدة — معظم الكود منفذ وتم اختباره محليًا (`npm test` و `npm run audit` ناجحان).
