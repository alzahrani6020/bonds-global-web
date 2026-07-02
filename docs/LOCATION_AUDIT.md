# تدقيق المواقع — Location Audit

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 1  
> **الهدف:** فحص اتساق قوائم الدول والمدن عبر المنصة وتحديد الفجوات والتكرار.

---

## 1. ملخص

المنصة تدعم 22 دولة عربية (جامعة الدول العربية). يوجد مصدر مركزي واحد للبيانات الجغرافية:

- `v3/master-data/countries-governorates-cities.js` — يغطي 22 دولة عربية بأقاليم/محافظات ومدن.

لكن بعض الصفحات والحاسبات تستخدم مصادر موزعة أخرى:

- `calculators/country-platforms-data.js` — نسخة مكررة خاصة بحاسبات المطاعم/التوصيل.
- بعض الصفحات تحتوي على قوائم دول/مدن مكتوبة يدوياً في HTML.

هذا يؤدي إلى:
- اختلاف ترتيب/تسمية الدول بين الصفحات.
- مدن ناقصة أو زائدة في بعض الحاسبات.
- صعوبة الصيانة.

---

## 2. مصادر البيانات الجغرافية

| المصدر | المسار | التغطية | الحالة |
|---|---|---|---|
| Master Data (V3) | `v3/master-data/countries-governorates-cities.js` | 22 دولة عربية + أقاليم + مدن | ✅ موثق |
| Restaurant/Platform Data | `calculators/country-platforms-data.js` | 22 دولة + منصات + عمولات | ⚠️ مكرر |
| Shared Platforms (Generated) | `calculators/shared-platforms.js` | 22 دولة + منصات | ⚠️ يُولّد من المصدر السابق |
| Static HTML selects | متفرق في `calculators/*.html` | غير معروف | ⚠️ يدوي |

---

## 3. مشاكل مكتشفة

### 3.1 تعدد مصادر الدول والمدن

| المشكلة | الموقع | الخطورة |
|---|---|---|
| `country-platforms-data.js` يكرر نفس بيانات `v3/master-data` | `calculators/` | High |
| بعض الحاسبات قد تحتوي على `<select>` مكتوب يدوياً | `calculators/*.html` | Medium |
| صفحات Factory Cost تعتمد على ملفات CSS/JS مشتركة لكن قد تختلف في قائمة المدن | `calculators/factory-cost-*.html` | Medium |

### 3.2 عدم اتساق التسميات

| الدولة | الاسم في Master Data | ملاحظات |
|---|---|---|
| السعودية | `السعودية` / `Saudi Arabia` | ✅ |
| مصر | `مصر` / `Egypt` | ✅ |
| الإمارات | `الإمارات` / `United Arab Emirates` | ✅ |

لا توجد مشاكل واضحة في أسماء الدول في المصدر المركزي، لكن بعض الصفحات الإنجليزية تحتوي على نصوص عربية (انظر `i18n-audit-report.md`).

### 3.3 مدن ناقصة أو زائدة

لا يوجد دليل على مدن ناقصة في `v3/master-data`، لكن الفحص اليدوي المطلوب في Wave 2 يجب أن يتحقق من:

- جميع عواصم الدول موجودة.
- المدن الرئيسية الاقتصادية موجودة.
- لا يوجد تكرار في المدن (مثل `الاحساء` و`الأحساء` في السعودية).

**ملاحظة:** في `calculators/country-platforms-data.js` السعودية، تظهر `الأحساء` و`الاحساء` كمدينتين منفصلتين (SA-05-004 و SA-05-012). هذا تكرار واضح.

### 3.4 قوائم الدول في الصفحات المختلفة

بناءً على `docs/PROJECT_AUDIT.md` و`docs/i18n-audit-report.md`:

- قوائم الدول في `calculators/auth/` و`en/calculators/auth/` قد تختلف عن تلك الموجودة في V3.
- بعض صفحات admin تستخدم `SAR` كعملة افتراضية في الواجهة الإنجليزية.
- `hreflang` موجود فقط في `blog/index.html` و `blog/en/index.html`، مما يعني أن محركات البحث قد لا تكتشف النسخ البديلة للدول/المدن.

---

## 4. التدقيق عبر الحاسبات

| الحاسبة/الصفحة | مصدر المواقع | ملاحظة |
|---|---|---|
| V3 portfolio/project | `v3/master-data` | ✅ |
| Factory Cost (per country) | مشترك `factory-cost-shared*` | يحتاج إلى فحص |
| Restaurant calculators | `country-platforms-data.js` | ⚠️ مكرر |
| Valuation | `v3/master-data` | ✅ |
| Client portal | `v3/master-data` | ✅ |

---

## 5. التوصيات

1. **اعتماد `v3/master-data/countries-governorates-cities.js` كمصدر وحيد** للبيانات الجغرافية.
2. **إيقاف استخدام `country-platforms-data.js` كمصدر للمدن/الدول** وتحويله ليستخدم `BondsGeo` فقط للمنصات.
3. **إزالة أي `<select>` يدوي للدول/المدن** من HTML واستبداله بمكون موحد.
4. **إنشاء `LOCATION_STANDARD.md`** يحدد:
   - صيغة أكواد الدول (ISO 3166-1 alpha-2).
   - صيغة أكواد المدن (COUNTRY-GOV-CITY).
   - سياسة تسمية المدن المكررة.
5. **إضافة `hreflang`** لجميع الصفحات المترجمة.
6. **فحص تكرار المدن** (مثل `الأحساء`/`الاحساء`) وتوحيدها.

---

## 6. Quality Gate لـ Wave 3

- [ ] قائمة دول واحدة في كل الصفحات.
- [ ] قائمة مدين واحدة لكل دولة في كل الصفحات.
- [ ] لا يوجد مدينة ناقصة في الدول المدعومة.
- [ ] لا يوجد تكرار في المدن.
- [ ] جميع الصفحات المترجمة تحتوي على `hreflang`.

---

## 7. المراجع

- `v3/master-data/countries-governorates-cities.js`
- `calculators/country-platforms-data.js`
- `calculators/shared-platforms.js`
- `docs/i18n-audit-report.md`
- `docs/PROJECT_AUDIT.md`
