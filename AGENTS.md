# دليل المساعد AI — مشروع بوندز (Bonds Global)

> هذا الملف يحدد القواعد والاتفاقيات التي يجب على المساعد AI اتباعها عند العمل على هذا المشروع.

---

## 1. نظرة عامة

- **المشروع**: موقع ثابت (Static Site) + وظائف خادومية (Vercel Serverless APIs).
- **لا يوجد إطار عمل frontend**: لا React، لا Vue، لا Next.js. الكود هو HTML/CSS/JS vanilla.
- **الاستضافة**: Vercel. ملف `vercel.json` يحدد الإعدادات.
- **PWA**: يوجد Service Worker (`sw.js`) يستخدم `CACHE_VERSION` يدوي. عند تغيير ملفات CSS/JS الأساسية، رفع رقم الإصدار في `sw.js` وأعد تشغيل `scripts/generate-icons.js` إذا تغيّر الشعار.

---

## 2. هيكل الملفات

```
├── api/                    ← وظائف Vercel (Node.js)
├── calculators/            ← الحاسبات (النسخة العربية)
│   ├── auth/               ← صفحات المصادقة
│   ├── shared-utils.js     ← دوال مشتركة
│   └── *.html              ← ملفات الحاسبات
├── en/                     ← النسخة الإنجليزية (مرآة)
│   ├── calculators/
│   └── *.html
├── assets/                 ← الصور والشعارات
│   └── icons/              ← أيقونات PWA (192×192، 512×512)
├── blog/                   ← المقالات
├── components/             ← مكونات واجهة قابلة لإعادة الاستخدام
│   ├── universal-dropdown.js      ← مكون القائمة المنسدلة المخصص
│   ├── universal-dropdown.css     ← تنسيقات المكون
│   ├── universal-dropdown-init.js ← التهيئة التلقائية
├── reports/                ← التقارير والتحقق
├── scripts/                ← سكربتات الإعداد والتدقيق
├── styles/                 ← ملفات CSS المقسمة
│   ├── tokens.css          ← متغيرات التصميم
│   ├── base.css            ← الأساسيات والخلفية
│   ├── components.css      ← مكونات الواجهة
│   └── utilities.css       ← مساعدات والطباعة والحركات
├── supabase/migrations/    ← ترحيلات قاعدة البيانات
├── tests/                  ← اختبارات Jest و Playwright
│   ├── a11y/               ← تدقيق accessibility (axe-core)
│   ├── mobile/             ← اختبارات الجوال
│   ├── visual/             ← اختبارات انحدار الواجهة البصرية
│   ├── bonds-geo.test.js
│   └── calc-functions.test.js
├── v3/                     ← Bonds V3 (الذكاء الاقتصادي) — مدمج تحت /v3/ و /api/v3/
├── .github/workflows/      ← CI/CD
├── styles.css              ← ملف استيراد CSS الرئيسي
├── header-footer.css       ← تنسيق الهيدر والفوتر الموحد
├── script.js               ← JS العام (الموقع)
├── auth-guard.js           ← حماية المميزات والمصادقة
├── supabase-client.js      ← عميل Supabase
├── manifest.json           ← بيانات PWA
└── sw.js                   ← Service Worker
```

### قاعدة ذهبية
- **الجذر (`/`)** = العربية (`lang="ar" dir="rtl"`)
- **`en/`** = الإنجليزية (`lang="en" dir="ltr"`)
- الحاسبات في `calculators/` (عربي) و `en/calculators/` (إنجليزي)
- **النسختان يدويتان** — أي تعديل في ملف عربي يتطلب تعديل الملف الإنجليزي المقابل إن وجد.

---

## 3. نظام التصميم (Design System)

### المتغيرات الرئيسية (في `styles.css`)

| المتغير | القيمة (وضع داكن) | الاستخدام |
|---------|-------------------|-----------|
| `--gold` | `#d4a853` | الأزرار، العناوين، التمييز |
| `--gold-bright` | `#f0c96a` | التأثيرات |
| `--bg` | `#0a0f1a` | خلفية الصفحة |
| `--bg-card` | `rgba(16,24,45,0.6)` | البطاقات |
| `--text` | `#e8ecf4` | النص الأساسي |
| `--text-secondary` | `#94a3b8` | النصوص الفرعية |
| `--border` | `rgba(197,160,40,0.15)` | الحدود |

### الخطوط
- **العربية**: `Vazirmatn` (أساسي)، ثم `Cairo`
- **الإنجليزية**: `Inter` أو `system-ui`

### الألوان الثابتة للشعار
- لا تغيّر نسبة `assets/bonds-logo-v2.webp`
- لا تضغط الصورة بفقدان الجودة

---

## 4. كيف تضيف حاسبة جديدة

### 4.1 إنشاء الملف
1. أنشئ `calculators/<name>.html` (مثال: `break-even-advanced.html`)
2. استخدم القالب التالي:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>عنوان الحاسبة | بوندز</title>
  <meta name="description" content="وصف مناسب للـ SEO" />
  <!-- Open Graph -->
  <meta property="og:title" content="..." />
  <meta property="og:description" content="..." />
  <meta property="og:image" content="https://bonds-global.com/assets/bonds-logo-v2.webp" />
  <!-- Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <!-- Styles -->
  <link rel="stylesheet" href="../styles.css" />
  <script src="shared-utils.js"></script>
  <style>
    /* أنماط خاصة بالحاسبة */
  </style>
</head>
<body>
  <!-- Navbar -->
  <!-- Hero -->
  <!-- Calculator Form -->
  <!-- Results -->
  <!-- Charts -->
  <!-- Footer -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    // منطق الحاسبة
  </script>
</body>
</html>
```

### 4.2 أنماط الحاسبات الموحدة
- حاوية الإدخالات: `.calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }`
- مجموعة الإدخال: `.calc-input-group { margin-bottom: 1.5rem; }`
- التسمية: `label { font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); }`
- حقل الإدخال: `input[type="number"] { padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); }`
- بطاقات السيناريوهات: `.scenario-card` مع ألوان `.pessimistic` (أحمر)، `.expected` (ذهبي)، `.optimistic` (أخضر)

### 4.3 المكتبات المسموح بها
- **Chart.js** للرسوم البيانية: `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`
- **jsPDF** لتصدير PDF: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- **html2canvas** لالتقاط DOM: `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`
- **SheetJS (xlsx)** لتصدير Excel: `https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js`
- **idb-keyval** لتخزين IndexedDB: `https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js`

### 4.4 الربط في الموقع
أضف الحاسبة في:
1. `index.html` — القائمة المنسدلة (`<div class="dropdown-menu">`)
2. `index.html` — قسم `#calculators` (بطاقات الحاسبات)
3. `calculator.html` — لو كانت حاسبة بديلة/متقدمة لنقطة التعادل
4. أنشئ `en/calculators/<name>.html` — النسخة الإنجليزية

---

## 5. كيف تضيف ترجمة إنجليزية

### 5.1 قواعد الترجمة
- كل ملف عربي في الجذر له نظير في `en/`
- `lang="ar" dir="rtl"` ←→ `lang="en" dir="ltr"`
- الروابط: `href="../"` في العربي ←→ `href="../../"` أو نسبي صحيح في الإنجليزي
- النصوص: ترجمة احترافية، ليست حرفية

### 5.2 الملفات التي يجب أن يكون لها نسخة إنجليزية
- `index.html` ←→ `en/index.html`
- `about.html` ←→ `en/about.html`
- `calculator.html` ←→ `en/calculator.html`
- `pitch.html` ←→ `en/pitch.html`
- `pitch-print.html` ←→ `en/pitch-print.html`
- `calculators/*.html` ←→ `en/calculators/*.html`
- `calculators/auth/*.html` ←→ `en/calculators/auth/*.html`

### 5.3 الملفات المفقودة حالياً في الإنجليزية
- لا يوجد ملفات جذر أو حاسبات مفقودة حالياً ✅
- `blog/*.html` و `sectors/*.html` لا تزال غير مترجمة (محتوى تكميلي)

---

## 6. APIs (مجلد `api/`)

### 6.1 الهيكل
كل ملف يصدر دالة واحدة:
```javascript
module.exports = async function handler(req, res) {
  // CORS
  // التحقق من الطريقة (GET/POST)
  // التحقق من المدخلات
  // المنطق
  // الرد
};
```

### 6.2 التحقق من المدخلات (إلزامي)
- `priceId` يجب أن يبدأ بـ `price_`
- `userId` يجب أن يكون UUID صالح
- `email` يجب أن يطابق regex بسيط
- أرقام الهاتف: رقم سعودي يبدأ بـ `05` (10 أرقام) أو دولي يبدأ بـ `+`

### 6.3 إضافة API جديد
1. أنشئ `api/<name>.js`
2. أضف rewrite في `vercel.json` إن لزم
3. أضف CORS headers
4. لا تنسخ `STRIPE_SECRET_KEY` أو `SUPABASE_SERVICE_KEY` إلى الـ frontend أبداً

---

## 7. المصادقة والاشتراكات (Auth)

### 7.1 مستويات الاشتراك
| المستوى | السعر (شامل VAT 15%) | المميزات |
|---------|----------------------|----------|
| `free` | مجاني | 3 سيناريوهات، 5 دول، تصدير Excel |
| `pro` | **82 ر.س/شهر** (71 + 11 ضريبة) | سيناريوهات غير محدودة، 22 دولة، تصدير PDF |
| `enterprise` | **212 ر.س/شهر** (184 + 28 ضريبة) | Pro + webhooks + دعم أولوي |

### 7.2 كيف تتحقق من الصلاحيات في الحاسبة
```javascript
if (window.BondsAuth && window.BondsAuth.checkFeatureAccess) {
  const hasAccess = await window.BondsAuth.checkFeatureAccess('pdf_export');
  if (!hasAccess) {
    // أظهر زر "ترقية" أو رسالة
  }
}
```

### 7.3 دوال مفيدة من `auth-guard.js`
- `window.requireAuth(redirectUrl)` — يجبر المستخدم على تسجيل الدخول
- `window.requireTier(feature, fallbackFn)` — يتحقق من مستوى الاشتراك

---

## 8. اتفاقيات التسمية والكود

### 8.1 الملفات
- **kebab-case** للملفات: `cash-flow.html`, `shared-utils.js`
- لا مسافات في أسماء الملفات الجديدة
- الامتداد: `.html` للصفحات، `.js` للسكربتات

### 8.2 CSS
- نمط BEM-lite:
  - `.block__element` (مثال: `.card__icon`, `.hero__title`)
  - `.block--modifier` (مثال: `.btn--primary`, `.scenario-card--optimistic`)
- المتغيرات في `:root` فقط داخل `styles.css`
- لا تضف `!important` إلا للضرورة القصوى

### 8.3 JavaScript
- **camelCase** للدوال والمتغيرات: `calculateBreakEven`, `getUserData`
- **PascalCase** للكلاسات فقط
- لا تستخدم `var` — استخدم `const` أو `let`
- لا تستخدم `==` — استخدم `===` دائماً
- تجنب `innerHTML` إذا كان المدخل من المستخدم — استخدم `textContent`

### 8.4 localStorage
- كل المفاتيح تبدأ بـ `bonds_`
- أمثلة: `bonds_session_type`, `bonds_scenarios`, `bonds_restaurant_name`

### 8.5 معرفات البيانات
- الدول: ISO-3166 uppercase (`SA`, `AE`, `EG`, `US`)
- المنصات: `plat_<name>` (مثال: `plat_hunger`, `plat_jahez`)
- المكونات: `ing_<id>` (مثال: `ing_flour_001`)

---

## 9. ⚠️ قواعد حمراء (لا تلمس)

1. **لا تعدّل يدوياً**:
   - `calculators/shared-platforms.js` (يُولّد تلقائياً من `country-platforms-data.js`)
   - `package-lock.json`
   - `.vercel/`

2. **لا تضع أسرار في frontend**:
   - لا `STRIPE_SECRET_KEY` في HTML/JS
   - لا `SUPABASE_SERVICE_KEY` في HTML/JS
   - استخدم `api/env.js` للمتغيرات الآمنة

3. **لا تحذف**:
   - ملفات في `supabase/migrations/` (تاريخ قاعدة البيانات)
   - `assets/شعار بوندز.jpg` (الشعار الأصلي — أرشيف)

4. **لا تنسَ** عند تعديل حاسبة:
   - النسخة الإنجليزية (إن وجدت)
   - `sw.js` — رفع رقم الإصدار إذا غيّرت assets مهمة
   - اختبار الجوال (Responsive)

---

## 10. ✅ قائمة التحقق قبل إنهاء أي مهمة

```
□ الكود يعمل في المتصفح بدون أخطاء في Console
□ تم اختبار الوضع الداكن والفاتح
□ تم اختبار الشاشات الصغيرة (Mobile)
□ إذا عدّلت حاسبة عربية → هل النسخة الإنجليزية محدّثة؟
□ لا توجد أسرار (API Keys) مكشوفة
□ لا يوجد console.log leftover (احذف logs التصحيح)
□ الروابط نسبية وصحيحة (../styles.css وليس /styles.css)
□ `npm test` يمر بدون أخطاء
□ `npm run audit` و `npm run audit:og` بدون مشاكل
□ `npm run test:a11y` و `npm run test:mobile` و `npm run test:visual` ناجحة
□ `sw.js` — رفع رقم الإصدار عند تغيير assets مهمة
```

---

## 11. بيانات المشروع

### 11.1 Supabase — الجداول الرئيسية
- `profiles` — بيانات المستخدمين
- `subscriptions` — حالة الاشتراك
- `scenarios` — سيناريوهات محفوظة
- `ingredients` — مكونات المطاعم
- `ingredient_prices` — أسعار المكونات
- `recipes` — وصفات/أطباق
- `recipe_ingredients` — ربط الوصفات بالمكونات

### 11.2 Stripe — المنتجات
- Bonds Pro: سعر شهري **71 ر.س** (إجمالي 82 ر.س شامل VAT 15%)
- Bonds Enterprise: سعر شهري **184 ر.س** (إجمالي 212 ر.س شامل VAT 15%)
- العملة: SAR (الريال السعودي)
- الضريبة: VAT 15% (يتم تطبيقها عبر `STRIPE_TAX_RATE_ID` env var)

### 11.3 Moyasar — SADAD / التحويل البنكي
- Bonds Pro: **82 ر.س** (شامل VAT 15%)
- Bonds Enterprise: **212 ر.س** (شامل VAT 15%)
- بوابة ثانوية للدفع عبر SADAD أو التحويل البنكي
- لا تدعم الاشتراكات التلقائية (يدوي التجديد)
- API: `api/moyasar-checkout.js` + `api/moyasar-verify.js`

### 11.3 البلدان المدعومة
22 دولة عربية وعالمية. البيانات الجغرافية في `v3/master-data/countries-governorates-cities.js` وبيانات المنصات/العملات في `calculators/shared-platforms.js`.

### 11.4 تحديث بيانات المنصات
- المصدر الأصلي: `calculators/country-platforms-data.js`
- ملف المشروع المستخدم: `calculators/shared-platforms.js` (يُولّد تلقائياً)
- لإعادة التوليد: `npm run regenerate:platforms`
- أدوات `tools/apply_csv_data.py` و `tools/apply_csv_data_v2.py` و `tools/update_operating_models.py` تعيد التوليد تلقائياً بعد التعديل.
- الاختبارات: `tests/bonds-geo.test.js` تتحقق من سلامة `BondsGeo` و `BondsPlatforms` وعدم رجوع `country-platforms-data.js` إلى ملفات الحاسبات.

### 11.5 CSS مشترك لحاسبات تكلفة المصنع
- `calculators/factory-cost-shared.css`: الأنماط المشتركة لصفحات تكلفة المصنع العربية.
- `calculators/factory-cost-shared-en.css`: الأنماط المشتركة لمعظم الصفحات الإنجليزية.
- `calculators/factory-cost-shared-en-light.css`: نسخة إنجليزية خفيفة لـ 5 دول (dj, km, mr, ps, so).
- صفحات `factory-cost-*.html` (ما عدا `factory-cost.html` الرئيسية) تستخدم هذه الملفات بدلاً من `<style>` داخلي.
- `calculators/auth/auth-shared.css`: الأنماط المشتركة لصفحات المصادقة (تستخدمه جميع صفحات `calculators/auth/` مع الاحتفاظ بأنماط خاصة في كل صفحة حسب الحاجة).
- `calculators/feasibility-template-shared.css` و `calculators/feasibility-template-shared-en.css`: الأنماط المشتركة لقوالب دراسة الجدوى.
- `calculators/scenario-cards-shared.css`: أنماط بطاقات السيناريو/الحكم/المقاييس المشتركة لـ `feasibility.html` و `medical-viability.html` (عربي وإنجليزي).

### 11.6 الاختبارات و GitHub Actions
- `npm test` — Jest: `tests/bonds-geo.test.js` + `tests/calc-functions.test.js`.
- `npm run audit` — تدقيق الموقع: أسرار، روابط مكسورة، ملفات ضائعة (`scripts/site-audit.js`).
- `npm run audit:og` — تدقيق Open Graph / Twitter Card / canonical (`scripts/og-audit.js`).
- `npm run test:a11y` — تدقيق accessibility باستخدام `axe-core` + Playwright.
- `npm run test:mobile` — اختبارات تفاعل الجوال (hover → tap، overflow).
- `npm run test:visual` — اختبارات انحدار الواجهة البصرية عبر `pixelmatch`.
- `npm run test:visual:update` — تحديث صور baseline للاختبارات البصرية.
- CI: `.github/workflows/ci.yml` يشغّل كل ما سبق عند كل push/PR.
- تطبيق migrations تلقائياً: `.github/workflows/apply-migrations.yml` يشغّل `supabase db push` عند أي تعديل في `supabase/migrations/` على فرع `main`. يتطلب إضافة `SUPABASE_ACCESS_TOKEN` و `SUPABASE_PROJECT_REF` في GitHub Secrets.
- لإعادة توليد أيقونات PWA بعد تغيير الشعار: `node scripts/generate-icons.js`.
- لتحديث/إضافة Open Graph tags لصفحة جديدة: `node scripts/apply-og-tags.js`.

### 11.7 وحدات لوحة التحكم الإدارية
اللوحة الموحدة في `admin/dashboard.html` تُحمّل الوحدات داخل iframe عبر `?embed=1`. كل وحدة هي SPA مستقلة (HTML/CSS/JS) وتستخدم `admin-embed.js` لإخفاء قائمتها الجانبية داخل اللوحة.

| الوحدة | المسار | الوصف |
|--------|--------|-------|
| لوحة المؤشرات التنفيذية | `/admin/executive-dashboard/` | KPIs ورسوم بيانية مالية وتنفيذية. |
| مستشار الأعمال الذكي | `/admin/ai-business-advisor/` | تحليل مالي، فرص، مخاطر، حلول تمويلية، تقارير إدارة عليا. لا يُفتح مباشرة — يُعيد التوجيه إلى `/admin/dashboard.html`. |
| الاستشارات المالية | `/admin/financial-advisory/` | العملاء، المشاريع، دراسات الجدوى، النماذج المالية. |
| إنقاذ الأصول المتعثرة | `/admin/distressed-recovery/` | تقييم الأصول وخطط الإنقاذ. |
| City Intelligence | `/admin/city-intelligence/` | تحليل المدن والأحياء والتقارير الجغرافية. |
| مراجعة المتخصص (AI) | `/admin/ai-reviews.html` | إدارة طلبات مراجعة تحليلات AI من العملاء. تعتمد على `ai_review_requests` والحالات: pending_review → assigned → under_review → approved → returned. |

#### مستشار الأعمال الذكي — ملاحظات تنفيذية
- الملفات في `admin/ai-business-advisor/`.
- التحليل يعتمد على جداول `subscriptions` و`moyasar_invoices` و`profiles` و`advisory_clients` و`advisory_projects` و`recovery_assets`.
- جدول `ai_advisor_reports` يحفظ تقارير الإدارة العليا المنشأة.
- يجب تحديث `sw.js` CACHE_VERSION عند تعديل ملفات الوحدة.

### 11.8 UniversalDropdown — القائمة المنسدلة الموحدة
مكوّن مخصّص لتحسين عناصر `<select>` وتوحيد الشكل والتصرف عبر الموقع.

- **الملفات**:
  - `components/universal-dropdown.js` — الصنف الأساسي.
  - `components/universal-dropdown.css` — التنسيقات (خلفية داكنة، حدود ذهبية، hover ذهبي).
  - `components/universal-dropdown-init.js` — التهيئة التلقائية للعناصر التي تحمل `data-universal-dropdown`.
- **الاستخدام في HTML**:
  ```html
  <select data-universal-dropdown="true" data-ud-search="true" data-ud-sort="true">
    <option value="sa">السعودية</option>
    ...
  </select>
  ```
- **الاستخدام في JavaScript ديناميكي**:
  ```javascript
  if (window.initUniversalDropdowns) window.initUniversalDropdowns(container);
  ```
  - ملاحظة: `universal-dropdown-init.js` يراقب DOM عبر `MutationObserver` ويُحسّن أي `<select data-universal-dropdown>` يُضاف لاحقاً تلقائياً.
- **الخصائص**:
  - بحث فوري للقوائم الطويلة (`data-ud-search="true"`) مع زر مسح.
  - فرز وإزالة التكرار وإزالة القيم الفارغة (`data-ud-sort`, `data-ud-deduplicate`, `data-ud-remove-empty`).
  - دعم RTL/LTR تلقائي.
  - التنسيق المطلق أو الثابت (`data-ud-fixed="true"`) لتجنب `overflow: hidden`.
  - لوحة المفاتيح (ArrowDown/Up, Enter, Escape, Space للمتعدد).
  - **اختيار متعدد**: `<select multiple data-universal-dropdown="true">` يعرض الاختيارات كـ chips مع أزرار تحديد/إلغاء الكل.
  - **مجموعات**: يدعم `<optgroup>` ويبقي العناوين عند البحث.
  - **تحميل غير متزامن**: `dd.setLoading(true/false)` لعرض حالة التحميل أثناء جلب البيانات.
  - **virtualization**: `data-ud-virtualize="true"` للقوائم الطويلة (+50 عنصر افتراضياً).
  - **ثيم فاتح**: أضف `data-ud-theme="light"` على `<html>` أو أي أصل، أو يُكتشف تلقائياً بواسطة `scripts/apply-universal-dropdown.py`.
  - **تراجع الجوال**: على أجهزة اللمس، القوائم القصيرة (≤6 خيارات افتراضياً) تبقى `<select>` أصلي؛ القوائم الطويلة تُحسّن.
  - **reduced-motion**: يحترم `prefers-reduced-motion` ويُلغي الحركات.
- **التراجع الاحتياطي**: ملف `styles/select-reset.css` يُخزَّن في ذاكرة Service Worker (`sw.js`) ويُعطي `<select>` الأصلي مظهراً مقبولاً إذا لم يُحمّل المكون أو على أجهزة اللمس التي تُبقي القائمة الأصلية.
- **النشر**: تم تطبيق المكون على الصفحات التي تحتوي `<select>` عبر `scripts/apply-universal-dropdown.py`.
- **الاختبارات**: `tests/universal-dropdown/universal-dropdown.test.js` يغطي البحث، الفرز، الاختيار، الثيم الفاتح، multi-select، virtualization، optgroups، setLoading، reduced-motion، والتهيئة التلقائية.
- **صفحة العرض**: `components/universal-dropdown/showcase.html` (عربي) و `showcase-en.html` (إنجليزي) تُظهر جميع الخصائص تفاعلياً.

### 11.9 BONDS Valuation Intelligence — محرك التقييم

منصة التقييم في `valuation/` تدعم 35 فئة أصول وتستخدم معايير BONDS Valuation Standards (BVS).

- **الملفات الأساسية**:
  - `valuation/valuation-engine.js` — محرك التقييم الرئيسي (book, market, fair, investment, liquidation values).
  - `valuation/valuation-standards.js` — معايير BVS لكل فئة أصل.
  - `valuation/economic-life-client.js` — عميل جلب العمر الاقتصادي من `economic_life_database`.
  - `valuation/depreciation-engine.js` — **محرك الاستهلاك** (BDE) يحسب 8 أنواع من الاستهلاك.
  - `valuation/depreciation-standards.js` — معايير BONDS Depreciation Standards (BDS) لكل فئة (fallback محلي).
  - `valuation/depreciation-factors-client.js` — عميل frontend لجلب العوامل من جدول `depreciation_factors`.
  - `api/depreciation-factors.js` — API endpoint للقراءة العامة والتحديث (admin/editor).
  - `supabase/migrations/20260709000000_depreciation_factors.sql` — جدول عوامل الاستهلاك المركزي.
  - `valuation/market-intelligence-client.js` — عميل frontend لجلب البيانات السوقية من `market_data`.
  - `api/market-intelligence.js` — API endpoint للقراءة العامة والتحديث (admin/editor).
  - `supabase/migrations/20260710000000_market_intelligence.sql` — جدول البيانات السوقية المركزي.
  - `admin/market-intelligence.html` — لوحة إدارة البيانات السوقية.
  - `valuation/valuation-ui.js` — يعرض نتائج الاستهلاك في لوحة النتائج.
  - `valuation/valuation-locale.js` — التسميات العربية والإنجليزية لحقول ومخرجات الاستهلاك.
  - `valuation/valuation.css` — تنسيق قسم تحليل الاستهلاك.
- **أنواع الاستهلاك المحسوبة**:
  1. الاستهلاك المحاسبي (`accountingDepreciation`)
  2. الاستهلاك الاقتصادي (`economicDepreciation`)
  3. الاستهلاك التشغيلي (`operationalDepreciation`)
  4. الاستهلاك البيئي (`environmentalDepreciation`)
  5. الاستهلاك التقني (`technicalDepreciation`)
  6. الاستهلاك الوظيفي (`functionalDepreciation`)
  7. الاستهلاك الناتج عن قلة الصيانة (`maintenanceDepreciation`)
  8. الاستهلاك الناتج عن سوء الاستخدام (`misuseDepreciation`)
- **المخرجات الإضافية من محرك الاستهلاك**:
  - `depreciationCurrentValue` — القيمة الحالية بعد الاستهلاك.
  - `depreciationFutureValue` — القيمة المتوقعة بعد `projectionYears`.
  - `depreciationReplacementValue` — تكلفة الاستبدال بأصل مكافئ حديث.
- **الدمج**: `valuation-engine.js` يستدعي `DepreciationEngine` تلقائياً ويُضيف النتائج إلى ناتج `calculate()`.
- **الاختبارات**: `tests/depreciation-engine.test.js` + `tests/valuation-engine.test.js`.
- **تطبيق الـ migrations على DB الفعلية**: راجع `docs/MIGRATIONS.md` للخطوات التفصيلية. يتطلب إضافة `SUPABASE_ACCESS_TOKEN` و `SUPABASE_PROJECT_REF` في GitHub Secrets.

---

## 12. تصميم footer التقرير (Report Footer)

- **الملف المركزي**: `calculators/shared-export.js` — يولّد footer موحّد لجميع التقارير المطبوعة عبر `openPrintWindow(options)`.
- **المكونات**:
  - **بطاقة ملاحظة من بوندز**: خلفية `#f8f5ef` مع حد ذهبي `#d4a853`.
  - **خطوات "ماذا بعد؟" / "What's next?"**: مراجعة الأرقام → التحدث إلى مستشار → الحصول على خطة مالية.
  - **QR Code**: يؤدي مباشرة إلى `https://wa.me/966567566616`.
  - **CTA**: زر ذهبي بنص "تحدث إلى مستشار" / "Talk to an advisor".
  - **Testimonial مخصص**: يتغير حسب `options.reportType` (`break-even`, `cash-flow`, `loan`, `pricing`, `default`).
  - **عرض محدود ديناميكي**: تاريخ الانتهاء = آخر يوم من الشهر الحالي.
  - **Social proof**: "انضم لأكثر من 500 صاحب مشروع..." / "Join 500+ entrepreneurs...".
- **كيفية التخصيص**:
  - لتغيير testimonial حسب نوع التقرير: عدّل كائن `testimonials` في `calculators/shared-export.js`.
  - لتمرير نوع التقرير: `openPrintWindow({ ..., reportType: 'cash-flow' })`.
  - لتغيير تاريخ العرض أو نصه: عدّل حساب `offerDate` في `calculators/shared-export.js` أو النصوص المقابلة في HTML/JS.
- **ملفات إضافية**:
  - `calculator.html` و `calculator-v2.html`: نافذة طباعة مخصصة لنقطة التعادل.
  - `en/calculator.html`: النسخة الإنجليزية.
  - `calculators/loan.html`, `calculators/cash-flow.html`, `calculators/pricing.html` ونسخها الإنجليزية في `en/calculators/`.
  - `add_disclaimer.py`: ينسخ footer الحاسبات إلى الصفحات الجديدة.
  - `translate_cashflow.py`: يترجم النصوص عند إنشاء النسخة الإنجليزية من cash-flow.

---

## 13. كيف تتواصل معي (المساعد)

- **اطلب توضيحاً** إذا كان المطلوب غامضاً.
- **اقترح بدائل** إذا كان الطلب قد يكسر شيئاً موجوداً.
- **اختبر** قبل أن تقول "تم" — شغّل `npx serve .` وافتح الصفحة.
- **كن محافظاً** — لا تحذف منطق موجود إلا إذا طُلب صراحةً.

---

*آخر تحديث: 2026-06-24*
