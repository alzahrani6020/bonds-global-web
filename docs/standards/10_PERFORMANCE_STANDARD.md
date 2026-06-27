# 10 — Performance Standard (معيار الأداء)

## الهدف
ضمان سرعة تحميل المنصة واستجابتها، وخفض استهلاك الموارد على الخادم والمتصفح.

## النطاق
- جميع ملفات HTML/CSS/JS.
- جميع نقاط النهاية.
- جميع استعلامات قاعدة البيانات.
- Service Worker و PWA.

---

## القواعد الإلزامية (Mandatory)

### M1 — Lazy Loading
- لا يُحمّل JS/CSS غير الضروري في الصفحة الأولى.
- يجب تحميل المحركات عند الحاجة فقط.

### M2 — إصدار الأصول
- كل تعديل على ملف CSS/JS يجب أن يُرفع رقم الإصدار (query string أو filename hash).
- يجب رفع `CACHE_VERSION` في `sw.js`.

### M3 — استجابة API سريعة
- هدف وقت الاستجابة: < 1 ثانية للطلبات العادية.
- هدف وقت الاستجابة: < 3 ثوانٍ للطلبات المعقدة.

### M4 — استعلامات قاعدة البيانات
- يجب استخدام indexes لكل استعلام متكرر.
- يُمنع استخدام `SELECT *` إلا عند الضرورة.

### M5 — PWA Cache
- يجب تحديث Service Worker عند تغيير الأصول.
- يجب أن يعمل الموقع offline بشكل أساسي للصفحات الثابتة.

### M6 — لا ملفات ضخمة
- لا يجب أن يتجاوز أي ملف JS/CSS واحد 500 KB غير مضغوط.
- الصور يجب أن تكون في صيغة WebP عند الإمكان.

---

## القواعد الموصى بها (Recommended)

### R1 — Compression
- تفعيل Gzip/Brotli على Vercel.

### R2 — CDN
- استخدام CDN للأصول الثابتة.

### R3 — Lighthouse Score
- الهدف: Lighthouse score >= 90 على الأقل.

---

## أمثلة

### ✅ صحيح
```html
<script src="/valuation/valuation-ui.js?v=5" defer></script>
```

### ❌ خاطئ
```html
<script src="/valuation/valuation-ui.js"></script>
```

---

## كيفية القياس
1. مراجعة `sw.js` CACHE_VERSION.
2. فحص أحجام الملفات في `assets/`.
3. تشغيل Lighthouse (إن أمكن).
4. مراجعة استعلامات Supabase لوجود indexes.
5. `npm run test:visual` (للتأكد من عدم وجود انحدار بصري).

## Severity عند المخالفة
- **Critical:** Service Worker cache stale يسبب مشاكل إنتاجية.
- **High:** ملف JS > 1 MB غير مضغوط.
- **Medium:** API بطيء (> 3s).
- **Low:** عدم استخدام `defer` أو `async`.

## طريقة الإصلاح
- تحديث إصدارات الأصول و `sw.js`.
- تقسيم الملفات الكبيرة.
- إضافة indexes.
- تحسين الاستعلامات.
