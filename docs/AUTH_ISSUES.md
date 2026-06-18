# مشاكل تسجيل الدخول — ملخص وإحصاء

## آخر تحديث: 2026-06-09

---

## 1. المشاكل التي تم حلها ✅

| # | المشكلة | الحل | الحالة |
|---|---------|------|--------|
| 1 | `Confirm email` كان مفعّلاً في Supabase | ألغاه المستخدم من Dashboard | ✅ محلول |
| 2 | روابط التأكيد تذهب لـ `localhost:3000` | ثابت `https://bonds-global.com` في الكود | ✅ محلول |
| 3 | `bonds-auth.js` في cache قديم (`v=4`) | رُفع إلى `v=999` في كل الصفحات | ✅ محلول |
| 4 | صفحات login/index تعيد تحميل cache | تغيير `login_v2` → `login_v3` | ✅ محلول |
| 5 | `calculator.html` لا تعرض اسم المستخدم | أُضيف `bonds-auth.js` + `authContainer` | ✅ محلول |
| 6 | `index.html` لا تعرض اسم المستخدم | أُضيف `bonds-auth.js` + `initSiteAuth()` | ✅ محلول |
| 7 | Redirect فارغ يسبب loop | `getRedirectUrl()` تُرجع URL كامل | ✅ محلول |

---

## 2. المشكلة المتبقية: Vercel Edge Cache

**السبب**: Vercel يحتفظ بنسخ cache من HTML/JS لمدة طويلة رغم `git push`.

**الأعراض**:
- `login.html` يوجّه إلى `calculators/auth/%2Fcalculator.html` (404)
- صفحات auth تُعرض كود JavaScript قديم

**الحل النهائي**: صفحة جديدة تماماً (`/auth.html`) — اسم غير موجود في cache.

---

## 3. تسلسل الخطوات الصحيح

### للمستخدم الجديد:
1. افتح `/auth.html` (وضع تصفح خفي)
2. اضغط "حساب جديد"
3. املأ البيانات واضغط "إنشاء حساب"
4. يُوجّه تلقائياً إلى `/calculator.html`
5. يظهر اسمه في الهيدر

### للمستخدم المسجل:
1. افتح `/auth.html` (وضع تصفح خفي)
2. اضغط "تسجيل الدخول"
3. املأ البريد وكلمة المرور
4. يُوجّه تلقائياً إلى `/calculator.html`
5. يظهر اسمه في الهيدر

### للخروج:
- اضغط الاسم في الهيدر → "تسجيل الخروج"

---

## 4. الملفات المعنية

| الملف | الدور | الحالة |
|-------|-------|--------|
| `bonds-auth.js` | عميل Supabase + UI | ✅ محدّث |
| `api/env.js` | توفير URL/Key | ✅ يعمل |
| `auth.html` | صفحة دخول جديدة (cache-free) | ⏳ قيد الإنشاء |
| `calculators/auth/login.html` | صفحة قديمة | ⚠️ قد تكون في cache |
| `calculators/auth/index.html` | صفحة قديمة | ⚠️ قد تكون في cache |
| `calculators/auth/diagnose.html` | صفحة تشخيص | ✅ تعمل |
| `index.html` | الصفحة الرئيسية | ✅ محدّثة |
| `calculator.html` | صفحة الحاسبة | ✅ محدّثة |

---

## 5. ملاحظات Supabase

- **Confirm email**: OFF ✅
- **Redirect URLs**: `https://bonds-global.com/**` ✅
- **Rate limit**: قد يتفعّل بعد 5 محاولات في الدقيقة — انتظر 5 دقائق

---

## 6. كيفية تجاوز Cache يدوياً

1. **وضع التصفح الخفي** (Ctrl+Shift+N)
2. أضف `?_=` عشوائي للرابط
3. أو اضغط **Ctrl+F5** (إعادة تحميل قسرية)
4. أو افتح DevTools → Network → Disable cache → ثم أعد التحميل
