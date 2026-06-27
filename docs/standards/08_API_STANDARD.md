# 08 — API Standard (معيار نقاط النهاية)

## الهدف
بناء واجهة برمجة موحدة، متسقة، وقابلة للصيانة لجميع خدمات BONDS.

## النطاق
- جميع ملفات `api/`.
- جميع مسارات `v3/api/`.
- ملف `vercel.json`.

---

## القواعد الإلزامية (Mandatory)

### M1 — استجابات JSON موحدة
- كل استجابة يجب أن تكون JSON.
- يجب أن تحتوي على `success` أو `error`.
- يجب أن تحمل `statusCode` مناسب.

### M2 — معالجة الأخطاء
- يجب التقاط الأخطاء وإرجاع رسالة واضحة بدون تسريب أسرار.
- لا يُعرض stack trace في الإنتاج.

### M3 — CORS
- جميع نقاط النهاية تُعيد رؤوس CORS صحيحة.
- `OPTIONS` مُعالج بشكل صحيح.

### M4 — التحقق من الطريقة HTTP
- يجب رفض الطرق غير المدعومة بـ `405 Method Not Allowed`.

### M5 — V3 Router
- جميع مسارات `/api/v3/*` يجب أن تمر عبر `v3/api/index.js`.
- لا يُنشأ ملف جديد في `api/` لخدمة V3.

### M6 — التوثيق
- كل API يجب أن يكون مذكوراً في `docs/API_INVENTORY.md` أو ما يعادله.

---

## القواعد الموصى بها (Recommended)

### R1 — Versioning
- الحفاظ على `v3/` كإصدار ثابت.
- تجنب التغييرات الكسرية دون إصدار جديد.

### R2 — Rate Limiting
- تطبيق rate limiting على APIs عامة.

---

## أمثلة

### ✅ صحيح
```js
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  // ... logic
  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, data: result }));
};
```

### ❌ خاطئ
```js
res.end('OK');
```

---

## كيفية القياس
1. مراجعة `v3/api/index.js`.
2. مراجعة `vercel.json` rewrites.
3. مراجعة `docs/API_INVENTORY.md`.
4. فحص كل API على معالجة الأخطاء والـ CORS.

## Severity عند المخالفة
- **Critical:** API جديد في `api/` بدلاً من `v3/api/index.js` (تجاوز حد Vercel).
- **High:** API لا يعيد JSON.
- **Medium:** عدم معالجة OPTIONS.
- **Low:** API غير موثق.

## طريقة الإصلاح
- نقل API إلى `v3/api/index.js`.
- توحيد الاستجابات على JSON.
- إضافة CORS ومعالجة OPTIONS.
- تحديث API inventory.
