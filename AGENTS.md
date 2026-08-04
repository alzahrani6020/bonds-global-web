# دليل المساعد AI — مشروع بوندز (Bonds Global)

> هذا الملف يحدد القواعد والاتفاقيات التي يجب على المساعد AI اتباعها عند العمل على هذا المشروع.

---

## 1. نظرة عامة

- **المشروع**: موقع ثابت (Static Site) + وظائف خادومية (Vercel Serverless APIs).
- **لا يوجد إطار عمل frontend**: لا React، لا Vue، لا Next.js. الكود هو HTML/CSS/JS vanilla.
- **الاستضافة**: Vercel. ملف `vercel.json` يحدد الإعدادات.
- **PWA**: يوجد Service Worker (`sw.js`) يستخدم `CACHE_VERSION`. عند تغيير ملفات CSS/JS الأساسية، يُرفع الرقم يدوياً أو تلقائياً عبر workflow `bump-cache-version.yml` الذي يفحص `CORE_ASSETS` ويرفع النسخة عند الحاجة. يظهر للمستخدم إشعار تحديث خفيف في `script.js` عند توفر نسخة جديدة. أعد تشغيل `scripts/generate-icons.js` إذا تغيّر الشعار.
- **الدستور المعماري**: قبل أي تطوير جديد، راجع `docs/BONDS_CONSTITUTION.md` — وهو المرجع الأعلى لرؤية المنصة ومعماريتها.

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
│   ├── utilities.css       ← مساعدات والطباعة والحركات
│   ├── design-system.css   ← طبقة النظام الموحدة
│   ├── home.css            ← أنماط الصفحة الرئيسية
│   └── page-shared.css     ← مكونات الصفحات التسويقية والقطاعية
├── docs/                   ← الوثائق والمعايير
│   ├── BONDS_CONSTITUTION.md       ← الدستور المعماري
│   ├── DESIGN_SYSTEM.md            ← نظام التصميم الرسمي
│   └── EXECUTIVE_UI_GUIDE.md       ← دليل واجهة المستخدم التنفيذية
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
| `pro` | **82 ر.س/شهر** (71 + 11 ضريبة) | سيناريوهات غير محدودة، 96 دولة، تصدير PDF |
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
   - `calculators/shared-platforms-loader.js` (يُعدّل يدوياً عند الحاجة؛ لا يحتوي على بيانات)
   - `calculators/platform-data/*` (يُولّد تلقائياً)
   - `calculators/geo-data/*` (يُولّد تلقائياً من `v3/master-data/*.js`)
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
- `asset_valuations` — رأس كل عملية تقييم (BONDS Valuation Intelligence)
- `valuation_ai_reports` — تقارير AI Valuation Analyst (إصدارات)
- `valuation_certificates` — شهادات BONDS Digital Valuation Certificate (BDVC)
- `asset_condition_assessments` — نتائج فحص حالة الأصل
- `risk_assessments` — نتائج تقييم المخاطر
- `market_data` / `market_data_history` / `market_data_sources` — بيانات الذكاء السوقي
- `economic_life_database` — قاعدة بيانات العمر الاقتصادي
- `depreciation_factors` — عوامل الاستهلاك

> **Soft validation للعملاء المحتملين**: جدولا `calculator_leads` و `contact_messages` يقبلان الآن بيانات ناقصة أو غير صحيحة (بريد/جوال مفقود أو غير صالح، بدون اسم/مدينة/نشاط...) ويتتبعان جودتها عبر عمودي `validation_status` و `validation_notes`. انظر migrations `20260731000000_soft_lead_contact_validation.sql` و `20260807000005_calculator_leads_email_hash.sql`.
> 
> **اكتمال الملف الشخصي**: جدول `profiles` يحتوي على عمود `profile_completeness` (0–100) يُحسب تلقائيًا عبر Trigger عند إدخال/تحديث الصف، ويُستخدم في لوحة الإدارة للفلترة والتذكيرات. Migration: `20260730000000_profile_completeness.sql`.

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
96 دولة: 22 دولة عربية أساسية (أعضاء الجامعة العربية) + 10 أسواق عربية/مراقبة إضافية + 64 دولة عالمية. البيانات الجغرافية المصدرية في `v3/master-data/countries-governorates-cities.js` (الأساسية)، `v3/master-data/global-countries.js` (العالمية)، و`v3/master-data/arab-extended-countries.js` (الإضافية). بيانات المنصات/العملات المصدرية في `calculators/country-platforms-data.js`.

### 11.4 تحديث بيانات المنصات والبيانات الجغرافية

#### بيانات المنصات
- المصدر الأصلي: `calculators/country-platforms-data.js`
- ملف المشروع المستخدم: `calculators/shared-platforms.js` (يُولّد تلقائياً)
- لإعادة التوليد: `npm run regenerate:platforms`
- التقسيم حسب الدولة:
  - `calculators/platform-data/meta.js` — بيانات تعريفية لجميع الدول (العملة، الضريبة، الرمز).
  - `calculators/platform-data/{code}.js` — بيانات المنصات لكل دولة على حدة (96 ملف).
  - `calculators/shared-platforms-loader.js` — يحمّل `meta.js` + ملف الدولة النشطة فقط أثناء تحليل HTML، مع توافق كامل مع API القديم `BondsPlatforms.getPlatforms(code)`.
  - `calculators/platform-data-loader.js` — يحمّل أي دولة عند الطلب (للاستخدامات المستقبلية/Async).
- لا تُعدّل ملفات `calculators/platform-data/*` يدوياً؛ يُعاد توليدها بالكامل من `scripts/extract-platform-data.js`.
- جميع الحاسبات التي كانت تحمّل `shared-platforms.js` أصبحت تحمّل `shared-platforms-loader.js`.
- أدوات `tools/apply_csv_data.py` و `tools/apply_csv_data_v2.py` و `tools/update_operating_models.py` تعيد توليد المنصات تلقائياً بعد التعديل.

#### البيانات الجغرافية
- المصدر الأصلي: `v3/master-data/countries-governorates-cities.js`، `v3/master-data/global-countries.js`، `v3/master-data/arab-extended-countries.js`
- لإعادة التوليد الكامل: `npm run regenerate:geo` (يحدّث البيانات المصدرية ثم يُنشئ الـ chunks)
- لتوليد الـ chunks فقط: `npm run regenerate:geo-chunks`
- التقسيم حسب الدولة:
  - `calculators/geo-data/meta.js` — بيانات تعريفية لجميع الدول (الاسم، الاسم الإنجليزي، العلم).
  - `calculators/geo-data/{code}.js` — بيانات كل دولة (المحافظات/المدن) على حدة (96 ملف).
  - `calculators/shared-geo.js` — يحمّل `meta.js` + ملف الدولة النشطة فوراً، ويحمّل باقي الدول عند الحاجة أو في الخلفية، مع تخزين البيانات المندمجة في IndexedDB عبر `calculators/shared-data-cache.js`.
- لا تُعدّل ملفات `calculators/geo-data/*` يدوياً؛ يُعاد توليدها بالكامل من `scripts/extract-geo-data.js`.
- الاختبارات: `tests/bonds-geo.test.js` تتحقق من سلامة `BondsGeo` و `BondsPlatforms` وعدم رجوع `country-platforms-data.js` إلى ملفات الحاسبات.

### 11.5 CSS مشترك لحاسبات تكلفة المصنع
- `calculators/factory-cost-shared.css`: الأنماط المشتركة لصفحات تكلفة المصنع العربية.
- `calculators/factory-cost-shared-en.css`: الأنماط المشتركة لمعظم الصفحات الإنجليزية.
- `calculators/factory-cost-shared-en-light.css`: نسخة إنجليزية خفيفة لـ 5 دول (dj, km, mr, ps, so).
- صفحات `factory-cost-*.html` (ما عدا `factory-cost.html` الرئيسية) تستخدم هذه الملفات بدلاً من `<style>` داخلي.
- `calculators/auth/auth-shared.css`: الأنماط المشتركة لصفحات المصادقة (تستخدمه جميع صفحات `calculators/auth/` مع الاحتفاظ بأنماط خاصة في كل صفحة حسب الحاجة).
- `calculators/feasibility-template-shared.css` و `calculators/feasibility-template-shared-en.css`: الأنماط المشتركة لقوالب دراسة الجدوى.
- `calculators/scenario-cards-shared.css`: أنماط بطاقات السيناريو/الحكم/المقاييس المشتركة لـ `feasibility.html` و `medical-viability.html` (عربي وإنجليزي).

### 11.6 حاسبة مصنع المياه (Investment Center)

حاسبة `water-factory` في `calculators/investment-center/water-factory.html` و `en/calculators/investment-center/water-factory.html` تستهدف قرار استثماري دقيق لمصنع تعبئة مياه.

- **بيانات السوق**: `calculators/investment-center/water-factory-data.js` يحتوي على مرجعيات لـ 22 دولة عربية (تكاليف تغليف، طاقة، مياه، أجور، تراخيص، معايير، منافسين، مصادر).
- **الملء التلقائي**: زر "ملء تلقائي من بيانات السوق" يجرب أولاً `/api/v3/water-factory-data?country=XX` ثم يعود إلى الملف المحلي إذا لم يتوفر API.
- **قوالب المصنع**: أزرار صغير/متوسط/كبير (5K/20K/50K عبوة/يوم) تضبط الإنتاج والمساحة والعمالة وتكلفة المصنع.
- **وضعان للإدخال**: الوضع **الأساسي** يعرض ~25 حقل فقط (الأهم لقرار الاستثمار)، بينما الوضع **الاحترافي** يعرض كل الـ 56 حقل مع المراحل التفصيلية. الحقول المخفية في الأساسي تأخذ قيمها الافتراضية.
- **مساهمة المستخدم**: قسم "اقترح تحديث بيانات" يرسل إلى `/api/contact` ببيانات منظمة (البند، القيمة الحالية، القيمة المقترحة، المصدر، الملاحظات) لتتم مراجعتها من الإدارة.
- **API ديناميكي**: `v3/api/water-factory-data.js` يخدم `GET /api/v3/water-factory-data` للقراءة العامة و `POST` محمي بـ `ADMIN_API_TOKEN` لتحديث بيانات الدولة.
- **Seed**: `scripts/seed-water-factory-market-data.js` يدفع البيانات المحلية إلى Supabase لأول مرة.
- **القوائم المالية التقديرية (Pro-Forma)**: `calculators/investment-center/pro-forma-engine.js` يبني قائمة الدخل (Income Statement) وقائمة التدفقات النقدية (Cash Flow) والميزانية العمومية (Balance Sheet) لمدة 5 سنوات، مع حساب EBITDA، الإهلاك، الفائدة، الضريبة، **Tax Loss Carryforward**، و**NPV/IRR** على مستوى المشروع، ورصد "حفرة السيولة" (Cash Deficit) تلقائياً. تُعرض حالياً في `water-factory` مع J-Curve للتدفقات النقدية وتحليل حساسية NPV/IRR، وتُحسب من المدخلات التفصيلية.

### 11.7 الاختبارات و GitHub Actions
- `package.json` يحدد `"node": "24.x"` لتثبيت إصدار Node على Vercel وتجنب التحذيرات.
- `npm audit` يُظهر ثغرة واحدة فقط في `xlsx` (لا يوجد إصلاح upstream). باقي الاعتماديات المعرّضة تمّ رفعها عبر `overrides` في `package.json`.
- `npm test` — Jest: `tests/bonds-geo.test.js` + `tests/calc-functions.test.js`.
- `npm run audit` — تدقيق الموقع: أسرار، روابط مكسورة، ملفات ضائعة (`scripts/site-audit.js`).
- `npm run audit:og` — تدقيق Open Graph / Twitter Card / canonical (`scripts/og-audit.js`).
- `npm run test:a11y` — تدقيق accessibility باستخدام `axe-core` + Playwright.
- `npm run test:mobile` — اختبارات تفاعل الجوال (hover → tap، overflow).
- `npm run test:visual` — اختبارات انحدار الواجهة البصرية عبر `pixelmatch`.
- `npm run test:visual:update` — تحديث صور baseline للاختبارات البصرية.
- CI: `.github/workflows/ci.yml` يشغّل كل ما سبق عند كل push/PR.
- تطبيق migrations تلقائياً: `.github/workflows/apply-migrations.yml` يشغّل `supabase db push --include-all` عند أي تعديل في `supabase/migrations/` على فرع `main`. يتطلب إضافة `SUPABASE_ACCESS_TOKEN` و `SUPABASE_PROJECT_REF` في GitHub Secrets. ملاحظة: `--include-all` ضروري لأن بعض الـ migrations القديمة طُبّقت يدوياً عبر SQL Editor وهي غير مسجلة في remote history. قاعدة: كل ملف migration يجب أن يكون idempotent ويحمل رقم إصدار فريداً (تكرار الإصدار بين ملفين يُسقط `db push` بخطأ `schema_migrations_pkey`).
- تذكيرات إكمال الملف الشخصي: `.github/workflows/profile-reminders.yml` يشغّل endpoint `/api/admin?action=send-profile-reminders-bulk` يوميًا باستخدام `CRON_SECRET`؛ يتطلب إضافة `CRON_SECRET` في GitHub Secrets.
- تقرير جودة البيانات: صفحة `admin/data-quality.html` و endpoint `GET /api/admin?action=data-quality-report`.
- لإعادة توليد أيقونات PWA بعد تغيير الشعار: `node scripts/generate-icons.js`.
- لتحديث/إضافة Open Graph tags لصفحة جديدة: `node scripts/apply-og-tags.js`.

### 11.7 وحدات لوحة التحكم الإدارية
اللوحة الموحدة في `admin/dashboard.html` تُحمّل الوحدات داخل iframe عبر `?embed=1`. كل وحدة هي SPA مستقلة (HTML/CSS/JS) وتستخدم `admin-embed.js` لإخفاء قائمتها الجانبية داخل اللوحة.

- **تحسينات UX الموحدة**:
  - `admin/admin-shared-ux.css` — تنسيقات مشتركة لأيقونات الشريط الجانبي وجداول الجوال.
  - `admin/admin-sidebar-icons.js` — يستبدل الإيموجي في روابط الشريط الجانبي بأيقونات SVG، ويحول `href="#"` إلى روابط `javascript:void(0)` مع `role="button"`.
  - تُضمّن هاتان الملفان في `admin/dashboard.html` وفي جميع صفحات `admin/*/index.html`.

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
  - **أيقونات الخيارات**: يدعم `<option data-icon="...">` (رابط صورة، أو اسم أيقونة مسجّل في `EccIcons` مثل `checkCircle`/`xCircle`/`warning`، أو إيموجي) لعرض الأيقونة بجوار النص في عناصر القائمة وفي قيمة الـ trigger المختارة. عند استخدام اسم أيقونة، يجب تحميل `components/ecc-icons.js` في الصفحة.

### 11.9 Enterprise Intelligence Layer (Wave 4.3)
طبقة موحّدة لتشغيل المحركات الذكية معاً وإنتاج قرار موثوق.

- **الملفات**: `lib/enterprise-intelligence/` (registry.js, runner.js, engine-adapter.js, blind-spot-engine.js, decision-graph-engine.js, recommendation-synthesizer.js, index.js).
- **المدخل API**: `v3/api/intelligence.js` ومسارات `/api/v3/intelligence/*` موجّهة عبر `v3/api/index.js`.
- **المبدأ**: جميع الحسابات المالية تمر عبر UCP؛ المحركات المستقلة تُغلّف فقط (`engine-adapter.js`).
- **المحركات المتاحة**: valuation, risk, opportunity, scenario, recommendation, feasibility, financing, market، بالإضافة إلى المحركات الوصفية: blind_spot, decision_graph, recommendation_synthesizer.
- **الجداول**: `enterprise_intelligence_runs`, `enterprise_intelligence_graphs`, `enterprise_intelligence_recommendations` (migration: `20260723000000_enterprise_intelligence_layer.sql`).

### 11.10 Executive Command Center (Phase E.0)
مركز قيادة المشروع — طبقة مركزية تجمع كل ذكاء المشروع في صفحة واحدة.

- **الملفات**:
  - `lib/ecc/project-status-aggregator.js` — يجمع الحالة من Investment Intelligence، Enterprise Intelligence، Lifecycle، Digital Twin، Confidence.
  - `lib/ecc/index.js` — واجهة عامة.
  - `v3/api/ecc.js` — مسارات `/api/v3/ecc/*`.
  - `v3/project/index.html` + `v3/project/project-command-center.js` + `v3/project/project-command-center.css` — واجهة مركز قيادة المشروع.
  - `en/v3/project/project-command-center.js` + `en/v3/project/project-command-center.css` — النسخة الإنجليزية.
  - `components/ecc-icons.js` — مكتبة الأيقونات SVG المشتركة للواجهة التنفيذية.
  - `v3/components/ai-chat-widget.js` — مساعد الذكاء الاصطناعي (يدعم وضع المشروع).
- **واجهة المستخدم**: شريط رحلة المشروع (`.ecc-journey`) يعرض المراحل من الفكرة إلى النشر، وألسنة تنقل تنفيذية (`.ecc-tabs`) تفصل بين: نظرة عامة، خط الزمن، الموافقات، الإنذارات، المستندات. جميع الأيقونات SVG من `ecc-icons.js` (لا إيموجي) مع تحسينات Accessibility (أدوار ولواحق ARIA).
- **المبدأ**: لا محرك حسابي جديد؛ كل الأرقام من UCP والمحركات الموجودة. الذكاء الاصطناعي يلخّص وينصح فقط.
- **المسارات**:
  - `POST /api/v3/ecc/project-status` — حالة موحدة للمشروع.
  - `POST /api/v3/ecc/advisor` — مستشار بوندز التنفيذي حسب سياق المشروع.
- **صفحة العرض**: `/v3/project?id=PROJECT_ID`.
- **الوثائق**: `docs/phase-e/PHASE_E_ADR.md` و `PHASE_E_EXIT_REPORT.md`.

### 11.10.1 Portfolio Dashboard (Phase E.1)
لوحة المدير التنفيذي لمتابعة محفظة المشاريع الاستثمارية.

- **الملفات**:
  - `lib/ecc/portfolio-status-aggregator.js` — يجمع حالة كل المشاريع المملوكة للمستخدم عبر `project-status-aggregator`.
  - `lib/ecc/notification-engine.js` — يولد إشعارات ذكية من الموافقات المعلقة، المهام، التنبيهات الحرجة، فجوات الجاهزية، والخطوات التالية.
  - `lib/ecc/executive-search-engine.js` — بحث تنفيذي عبر المشاريع، المذكرات، مراجعات AI، الجدول الزمني، المهام، والموافقات.
  - `lib/ecc/role-guard.js` — إدراك الأدوار: يقرأ `profiles.role` ويحدد صلاحيات `viewer / advisor / admin / owner`.
  - `v3/api/ecc.js` — مسارات `POST /api/v3/ecc/portfolio` و `POST /api/v3/ecc/notifications` و `POST /api/v3/ecc/search`.
  - `v3/portfolio/index.html` + `v3/portfolio/portfolio-dashboard.js` + `v3/portfolio/portfolio-dashboard.css` — واجهة لوحة المحفظة مع جرس إشعارات وشريط بحث وتحديث حي (عربي).
  - `en/v3/portfolio/index.html` + `en/v3/portfolio/portfolio-dashboard.js` + `en/v3/portfolio/portfolio-dashboard.css` — النسخة الإنجليزية.
  - `v3/project/project-command-center.js` — يخفي أزرار التعديل عن `viewer` و `advisor`.
  - `components/ecc-icons.js` — مكتبة الأيقونات SVG المشتركة للواجهة التنفيذية.
- **واجهة المستخدم**: ألسنة تنقل تنفيذية (`.ecc-tabs`) تفصل بين: نظرة عامة، إجراءات، بحث. جميع الأيقونات SVG من `ecc-icons.js` (لا إيموجي) مع تحسينات Accessibility (أدوار ولواحق ARIA).
- **المبدأ**: لا محرك حسابي جديد؛ إعادة استخدام `aggregateProjectStatus` وقراءة الجداول الموجودة.
- **المخرجات**: ملخص المحفظة، توزيع القطاعات والمراحل والصحة، جدول المشاريع، التنبيهات الحرجة، الخطوات التالية، إشعارات ذكية، نتائج بحث، وتحكم بالأدوار.
- **صفحة العرض**: `/v3/portfolio` (عربي) و `/en/v3/portfolio` (إنجليزي).

### 11.11 Investment Intelligence Suite (Phase D.1)
منصة تحويل المشاريع إلى نشرات استثمارية جاهزة.

- **الملفات**: `lib/investment-intelligence/` (project-resolver.js, investment-readiness-engine.js, investment-memorandum-engine.js, investment-story-engine.js, ai-investment-review.js, versioning-engine.js, document-generator.js, index.js).
- **المدخل API**: `v3/api/investment-intelligence.js` ومسارات `/api/v3/investment-intelligence/*`.
- **واجهة الإدارة**: `admin/investment-intelligence/index.html`.
- **المبدأ**: جميع الأرقام من UCP؛ لا محرك حسابي جديد؛ البيانات تُقرأ من `bonds_projects` / `bonds_valuations` / `bonds_financing`.
- **الجداول**: `investment_memoranda`, `investment_memoranda_versions`, `investment_readiness_scores`, `ai_investment_reviews` (migration: `20260724000000_phase_d_investment_intelligence_core.sql`).
- **التراجع الاحتياطي**: ملف `styles/select-reset.css` يُخزَّن في ذاكرة Service Worker (`sw.js`) ويُعطي `<select>` الأصلي مظهراً مقبولاً إذا لم يُحمّل المكون أو على أجهزة اللمس التي تُبقي القائمة الأصلية.
- **النشر**: تم تطبيق المكون على الصفحات التي تحتوي `<select>` عبر `scripts/apply-universal-dropdown.py`.
- **الاختبارات**: `tests/universal-dropdown/universal-dropdown.test.js` يغطي البحث، الفرز، الاختيار، الثيم الفاتح، multi-select، virtualization، optgroups، setLoading، reduced-motion، أيقونات الخيارات، والتهيئة التلقائية.
- **صفحة العرض**: `components/universal-dropdown/showcase.html` (عربي) و `showcase-en.html` (إنجليزي) تُظهر جميع الخصائص تفاعلياً.

### 11.12 Enterprise Lifecycle Engine (Phase D.1.5)
موقع المحرك: `lib/enterprise-lifecycle/`.  
يقوم بإدارة دورة حياة المشاريع والأصول والتقارير بشكل موحد وmetadata-driven عبر:
- `lifecycle-engine.js` — الواجهة الرئيسية.
- `lifecycle-registry.js` + `definitions/*.json` — تعريفات workflows والمراحل.
- `state-machine.js` — حماية الحالة الحالية والانتقالات.
- `transition-engine.js` — تقييم Gates والموافقات وتنفيذ الانتقال.
- `gate-engine.js` — تقييم الشروط (data completeness, confidence, document status, approval).
- `task-engine.js` — توليد المهام التلقائية لكل مرحلة.
- `approval-engine.js` — موافقات single / multi / sequential / parallel / committee.
- `event-bus.js` — أحداث مثل `ProjectEnteredStage`, `ApprovalGranted`.
- `timeline-engine.js` — بناء Timeline موحد.
- `integrations/` — ربط UCP، Trusted Data Fabric، Investment Intelligence، Confidence، Explainability، Decision Memory، Digital Twin.

الـ API موحد تحت `/api/v3/enterprise-lifecycle/*` داخل `v3/api/index.js`.  
الترحيلات:
- `supabase/migrations/20260725000000_enterprise_lifecycle_engine.sql` — الجداول والسياسات الأولية.
- `supabase/migrations/20260726000000_enterprise_lifecycle_multi_user_rls.sql` — RLS متعدد المستخدمين للسماح للموافقين بالقراءة والتصويت.

الوثائق: `docs/phase-d/PHASE_D_1_5_ENTERPRISE_LIFECYCLE_ADR.md` و `PHASE_D_1_5_EXIT_REPORT.md` و `docs/ARCHITECTURE_COMPLIANCE_REPORT_D_1_5.md` و `docs/MIGRATIONS.md`.

### 11.13 BONDS Valuation Intelligence — محرك التقييم

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
  - `valuation/market-intelligence-client.js` — عميل frontend لجلب البيانات السوقية من `market_data` مع دعم الجغرافيا والتاريخ.
  - `api/market-intelligence.js` — API endpoint للقراءة العامة والتحديث (admin/editor) + التحديث التلقائي من المصادر الخارجية.
  - `supabase/migrations/20260710000000_market_intelligence.sql` — جدول `market_data` الأساسي.
  - `supabase/migrations/20260711000000_market_intelligence_v2.sql` — توسعة المحرك: `market_data_history`، `market_data_sources`، وأعمدة `region/sector/risk_score/outlook/confidence/data_quality_score/notes`.
  - `supabase/migrations/20260712000000_market_intelligence_sources.sql` — مصادر بيانات خارجية موثوقة: KAPSARC (عقارات + ريو) و World Bank (تضخم + نمو) للسعودية.
  - `supabase/migrations/20260713000000_market_intelligence_arab_sources.sql` — مؤشرات ماكرو اقتصادية (تضخم + نمو) لجميع الدول العربية الـ 22.
  - `admin/market-intelligence.html` — لوحة إدارة البيانات السوقية ومصادر البيانات.
  - `.github/workflows/market-intelligence-refresh.yml` — جدولة تحديث يومي للمصادر الخارجية.
  - `valuation/valuation-ui.js` — يعرض البيانات السوقية والاتجاهات في لوحة النتائج.
  - `valuation/valuation-locale.js` — التسميات العربية والإنجليزية لحقول ومخرجات الذكاء السوقي.
  - `valuation/valuation.css` — تنسيق بطاقات وبادجات الذكاء السوقي.
- **BONDS AI Valuation Analyst (Phase 2)**:
  - `valuation/valuation-knowledge-base.js` — قاعدة معرفة قطاعية نوعية فقط؛ لا تحتوي على أرقام.
  - `lib/ai/prompts.js` — قالب `asset_valuation` يطلب JSON منظّم (ملخص تنفيذي، SWOT، قرار BONDS، توقعات).
  - `lib/ai/valuation-analyze-handler.js` — معالج `POST /api/v3/ai/valuate`؛ يتحقق من ملكية السجل، يجمع المعرفة والبيانات، ويستدعي `lib/ai/orchestrator.js`.
  - `v3/api/index.js` — يوجّه `/ai/valuate` إلى المعالج أعلاه ضمن الدالة الواحدة لتجنب تجاوز حد Vercel.
  - واجهة النتائج (`valuation/index.html` + `en/valuation/index.html`) — تحتوي على زر "تقرير تنفيذي ذكي" ولوحة عرض التقرير.
  - شروط الجودة لتوليد التقرير: `confidence_score ≥ 80` و `data_quality_score ≥ 80`.
- **BONDS Digital Valuation Certificate — BDVC (Phase 3)**:
  - `lib/ai/valuation-certificate-handler.js` — ثلاثة مسارات:
    - `POST /api/v3/ai/valuate/:report_id/approve` — اعتماد التقرير الذكي.
    - `POST /api/v3/valuations/:id/certificate` — إصدار شهادة BDVC برقم فريد `BDVC-YYYY-CC-NNNNNNNN` وبصمة ختم HMAC-SHA256.
    - `GET /api/v3/certificates/:number/verify` — التحقق العام من صلاحية الشهادة.
  - شروط إصدار الشهادة: تقرير معتمد + `confidence_score ≥ 85` + `data_quality_score ≥ 80`.
  - واجهة النتائج — أزرار "اعتماد التقرير" و"إصدار شهادة BDVC" ومعاينة الشهادة مع QR Code للتحقق.
  - `tests/valuation-certificate.test.js` — اختبارات وحدة لبصمة الختم.
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

### 11.14 Condition Assessment Engine (CAE) — تقييم حالة الأصول

محرك تقييم الحالة التفصيلي مدمج في خطوة Condition بواجهة التقييم (`valuation/valuation-ui.js`) ويغذي `ValuationEngine` بالمدخلات الفنية.

- **الملفات الأساسية**:
  - `valuation/condition-assessment-engine.js` — محرك حساب Condition Score (0–100)، التقدير A–E، الثقة، الإخفاقات الحرجة، ومدخلات التقييم.
  - `valuation/condition-assessment-standards.js` — 120 نقطة فحص في 10 فئات ومعايير 35 فئة أصل.
  - `valuation/condition-assessment-client.js` — عميل Supabase لحفظ/تحميل المعايير والتقييمات الفردية.
  - `valuation/valuation-locale.js` — النصوص العربية والإنجليزية.
  - `valuation/valuation.css` — تنسيقات CAE والسجل والرسم البياني.
  - `admin/condition-assessment.html` — لوحة إدارة لتحرير المعايير وعرض التقييمات.
- **الجداول**:
  - `condition_assessment_standards` — معايير قابلة للتخصيص لكل فئة أصل.
  - `asset_condition_assessments` — تقييمات فردية محفوظة.
  - `assets_due_for_reassessment` — view للأصول التي تقترب أو تجاوزت تاريخ إعادة التقييم.
- **الترحيلات**:
  - `supabase/migrations/20260714000000_condition_assessment.sql`
  - `supabase/migrations/20260715000000_asset_condition_assessments.sql`
  - `supabase/migrations/20260716000000_assessment_due_date.sql`
- **الخصائص الحالية**:
  - قائمة فحص تفاعلية حسب فئة الأصل.
  - حساب الدرجة وتعبئة حقول التقييم الأساسية تلقائيًا.
  - حفظ/تحميل التقييمات السابقة.
  - تصدير تقرير PDF.
  - سجل تاريخي + رسم بياني لتطور Condition Score.
  - مقارنة بين تقييمات متعددة (جدول + رسم بياني + تصدير CSV).
  - توليد خطة صيانة مقترحة من الإخفاقات الحرجة والفئات الضعيفة.
  - تذكير بتاريخ إعادة التقييم (next_assessment_due).
- **القيود**: لا يوجد API جديد على Vercel؛ يتم تجنب الحد الأقصى 12/12 دالة باستخدام Supabase client مباشرة من المتصفح مع RLS.

### 11.15 معالجة الروابط والمعلومات الخارجية

- **Calendly**: صفحات `/book` (عربي) و `/en/book` (إنجليزي) تقرأ `CALENDLY_URL` من `window.__ENV` وتُعيد التوجيه إليه. صفحات التسويق تربط بـ `/book` بدلاً من رابط Calendly المباشر، مما يسهل تغيير الرابط لاحقاً عبر متغير بيئة واحد.
- **Google Analytics 4**: كود GA4 لا يُحمّل إلا عندما يكون `GA_MEASUREMENT_ID` مضبوطاً في متغيرات البيئة (`GA_MEASUREMENT_ID` أو `NEXT_PUBLIC_GA_MEASUREMENT_ID`). لا يوجد معرّف placeholder في الكود.
- **WhatsApp**: رقم التواصل عبر WhatsApp ثابت في footer التقارير (`966567566616`).

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


