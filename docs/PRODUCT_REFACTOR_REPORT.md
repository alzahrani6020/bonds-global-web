# تقرير إعادة بناء المنتج — Product Refactor Report

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 2  
> **التاريخ:** 2026-07-02  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`، `docs/MASTER_EXECUTION_PLAN.md`

---

## 1. ملخص

تم في Wave 2 إعادة بناء تجربة المنتج الأساسية دون إضافة محركات أو حاسبات أو صفحات جديدة. التركيز كان على:

- توحيد مصدر الحقيقة للمشاريع (`bonds_projects`).
- إصلاح الأخطاء التي تمنع ظهور المشاريع في المحفظة.
- تحويل بوابة العميل من "لوحة أدوات" إلى "رحلة مشروع".
- إنشاء معايير للحقول والمواقع.

---

## 2. الملفات المعدلة

### 2.1 الوثائق والمعايير

| الملف | التغيير |
|---|---|
| `docs/FIELD_NAMING_STANDARD.md` | معيار جديد لتسمية الحقول بلغة رجل الأعمال |
| `docs/LOCATION_STANDARD.md` | معيار جديد لتوحيد الدول والمدن |
| `docs/PTP_WAVE1_APPROVAL.md` | اعتماد Wave 1 |
| `docs/PTP_CURRENT_STATE.md` | تقرير حالة البرنامج |

### 2.2 الخلفية (Bug Fixes)

| الملف | التغيير |
|---|---|
| `lib/ecc/portfolio-status-aggregator.js` | إصلاح `select` ليقرأ `city_id` بدلاً من أعمدة غير موجودة (`city`, `country_code`) |
| `v3/api/projects.js` | إعادة توجيه الـ API ليكتب في `bonds_projects` وينشئ lifecycle instance |
| `v3/master-data/countries-governorates-cities.js` | إزالة تكرار `الأحساء`/`الاحساء` في السعودية |
| `sw.js` | رفع `CACHE_VERSION` إلى `v2.20.0` |

### 2.3 الواجهة الأمامية

| الملف | التغيير |
|---|---|
| `client/index.html` | تحميل `fields.js` و`shared-geo.js`؛ إزالة Tesseract |
| `client/portal.js` | إعادة كتابة كاملة لبوابة العميل V2 |
| `client/portal.css` | إضافة أنماط رحلة المشروع والـ Wizard والبطاقات |
| `client/login.html` | تحديث الوصف |
| `en/client/index.html` | مرآة إنجليزية محدّثة |
| `en/client/login.html` | تحديث الوصف |

### 2.4 المكتبات المشتركة

| الملف | التغيير |
|---|---|
| `lib/i18n/fields.js` | قاموس حقول مركزي جديد |

---

## 3. تفاصيل الإصلاحات التقنية

### 3.1 `portfolio-status-aggregator.js`

**المشكلة:** كان الاستعلام يطلب أعمدة `city` و`country_code` غير موجودة في `bonds_projects`.

**الحل:** تغيير الـ select إلى `city_id` فقط، والاعتماد على `aggregateProjectStatus` لجلب اسم المدينة وكود الدولة من جدول `cities`.

### 3.2 `v3/api/projects.js`

**المشكلة:** كان يكتب في `user_projects`، مما يجعل المشاريع الجديدة لا تظهر في `/v3/portfolio`.

**الحل:**
- الكتابة في `bonds_projects`.
- البحث عن `city_id` باستخدام `cityCode`.
- إنشاء lifecycle instance تلقائياً عند الإنشاء.
- تعديل `listProjects` و`getProject` ليقرآن من `bonds_projects`.

---

## 4. الرحلات المُصلحة

| الرحلة | الحالة قبل | الحالة بعد |
|---|---|---|
| إنشاء مشروع → ظهوره في المحفظة | مكسورة (جداول منفصلة) | ✅ تعمل |
| قائمة المشاريع → صفحة المشروع | غير موحدة | ✅ رابط مباشر إلى `/v3/project?id=...` |
| اختيار المدينة | قوائم يدوية/مكررة | ✅ BondsGeo موحد |
| تسميات الحقول | تقنية/مختلفة | ✅ قاموس موحد بلغة رجل الأعمال |

---

## 5. ما لم يُغيّر (بقية مخطط Wave 2/3)

- لم يُعاد تصميم الصفحة الرئيسية (Wave 3).
- لم يُنشأ Design System شامل (Wave 3).
- لم تُعاد تصميم صفحات الحاسبات (Wave 3).
- لم تُحذف الصفحات القديمة (`calculator.html`, `auth.html`...) — ستُعالج في Wave 3.

---

## 6. المراجع

- `docs/WAVE1_EXIT_REPORT.md`
- `docs/FIELD_DICTIONARY.md`
- `docs/LOCATION_AUDIT.md`
- `docs/BROKEN_FLOWS.md`
- `docs/UX_PROBLEMS.md`
