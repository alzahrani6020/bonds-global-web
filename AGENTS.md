# دليل المساعد AI — مشروع بوندز (Bonds Global)

> هذا الملف يحدد القواعد والاتفاقيات التي يجب على المساعد AI اتباعها عند العمل على هذا المشروع.

---

## 1. نظرة عامة

- **المشروع**: موقع ثابت (Static Site) + وظائف خادومية (Vercel Serverless APIs).
- **لا يوجد إطار عمل frontend**: لا React، لا Vue، لا Next.js. الكود هو HTML/CSS/JS vanilla.
- **الاستضافة**: Vercel. ملف `vercel.json` يحدد الإعدادات.
- **PWA**: يوجد Service Worker (`sw.js`) يحتاج إلى تحديث رقم الإصدار يدوياً عند تغييرات كبيرة.

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
├── blog/                   ← المقالات
├── reports/                ← التقارير والتحقق
├── scripts/                ← سكربتات الإعداد
├── supabase/migrations/    ← ترحيلات قاعدة البيانات
├── styles.css              ← التصميم العام
├── script.js               ← JS العام (الموقع)
├── auth-guard.js           ← حماية المميزات والمصادقة
├── supabase-client.js      ← عميل Supabase
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
- لا تغيّر نسبة `assets/شعار بوندز.jpg`
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
  <meta property="og:image" content="https://bonds-global.com/assets/site-logo.webp" />
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
- `calculators/*.html` ←→ `en/calculators/*.html`
- `calculators/auth/*.html` ←→ `en/calculators/auth/*.html`

### 5.3 الحاسبات المفقودة حالياً في الإنجليزية
- `en/calculators/menu-engineering.html` ❌
- `en/calculators/menu-engineering-simple.html` ❌

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
| المستوى | السعر | المميزات |
|---------|-------|----------|
| `free` | مجاني | 3 سيناريوهات، 5 دول، تصدير Excel |
| `pro` | $19/شهر | سيناريوهات غير محدودة، 22 دولة، تصدير PDF |
| `enterprise` | $49/شهر | Pro + webhooks + دعم أولوي |

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
   - `calculators/country-platforms-data.min.js` (يُولّد تلقائياً)
   - `package-lock.json`
   - `.vercel/`

2. **لا تضع أسرار في frontend**:
   - لا `STRIPE_SECRET_KEY` في HTML/JS
   - لا `SUPABASE_SERVICE_KEY` في HTML/JS
   - استخدم `api/env.js` للمتغيرات الآمنة

3. **لا تحذف**:
   - ملفات في `supabase/migrations/` (تاريخ قاعدة البيانات)
   - `assets/شعار بوندز.jpg` (الشعار الأصلي)

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
- Bonds Pro: سعر شهري `$19`
- Bonds Enterprise: سعر شهري `$49`

### 11.3 البلدان المدعومة
22 دولة عربية وعالمية. البيانات في `calculators/country-platforms-data.js`.

---

## 12. كيف تتواصل معي (المساعد)

- **اطلب توضيحاً** إذا كان المطلوب غامضاً.
- **اقترح بدائل** إذا كان الطلب قد يكسر شيئاً موجوداً.
- **اختبر** قبل أن تقول "تم" — شغّل `npx serve .` وافتح الصفحة.
- **كن محافظاً** — لا تحذف منطق موجود إلا إذا طُلب صراحةً.

---

*آخر تحديث: 2026-05-31*
