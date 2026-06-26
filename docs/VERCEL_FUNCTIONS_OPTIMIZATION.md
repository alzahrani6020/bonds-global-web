# تحسين استخدام دوال Vercel Serverless

> **الحالة**: الخطة الحالية (Hobby) تسمح بـ 12 دالة serverless كحد أقصى. المشروع يحتوي حاليًا على 13 ملف `.js` مباشر في `api/`، بالإضافة إلى `api/v3/` التي قد تُنشئ دوالًا إضافية. هذا يعني أننا عند أو نتجاوز الحد.
>
> **الهدف**: تقليل عدد الدوال دون كسر أي endpoint مستخدم من الواجهة.

---

## 1. قائمة دوال `api/` الحالية

| الملف | الاستخدام | الأولوية |
|-------|-----------|----------|
| `api/admin.js` | admin operations, force-reset, reset-password | أساسي |
| `api/analyze-feasibility.js` | دراسة جدوى AI | مستخدم |
| `api/clear-user-data.js` | حذف بيانات المستخدم | مستخدم |
| `api/depreciation-factors.js` | قراءة/تحديث عوامل الاستهلاك | مستخدم |
| `api/economic-life.js` | قراءة بيانات العمر الاقتصادي | مستخدم |
| `api/env.js` | exposes public env vars | أساسي |
| `api/funding.js` | توصيات تمويل | مستخدم |
| `api/investment-analysis.js` | تحليل استثماري | مستخدم |
| `api/market-intelligence.js` | بيانات سوقية | مستخدم |
| `api/payments.js` | Stripe + Moyasar + webhooks | أساسي |
| `api/platform.js` | pro/track/nps/advisors/dashboard | أساسي |
| `api/research.js` | بحث/مصادر | مستخدم |
| `api/v3/index.js` | Bonds V3 API router | أساسي |

> **ملاحظة**: `vercel.json` يعيد كتابة العديد من المسارات إلى `api/platform` و `api/payments` و `api/admin`، لكن كل ملف `.js` في `api/` لا يزال يُحسب كدالة منفصلة بواسطة Vercel.

---

## 2. خيارات التقليل

### الخيار A: دمج نقاط البيانات المرجعية في router واحد (موصى)

دمج الثلاثة endpoints التالية في دالة واحدة اسمها `api/reference-data.js` مع توجيه داخلي حسب المسار:

- `/api/depreciation-factors`
- `/api/economic-life`
- `/api/market-intelligence`

**الخطوات**:
1. إنشاء `api/reference-data.js` تحتوي على منطق القراءة/الكتابة للثلاثة.
2. تحديث `vercel.json` لإعادة كتابة المسارات الثلاثة إلى `api/reference-data`.
3. حذف الملفات الثلاثة الأصلية.
4. تحديث `tests/api/depreciation-factors.test.js` و `tests/api/market-intelligence.test.js` لاستيراد الدالة من الملف الجديد.

**التوفير**: 2 دالة (من 13 إلى 11).

**المخاطر**: منخفضة — جميعها endpoints CRUD بسيطة ويمكن دمجها بسهولة.

---

### الخيار B: نقل الوظائف الخفيفة إلى `api/platform.js`

`api/platform.js` يستقبل بالفعل العديد من المسارات عبر `vercel.json`. يمكن إضافة ما يلي إليها:

- `/api/funding`
- `/api/research`

**التوفير**: 2 دالة إضافية (من 11 إلى 9).

**المخاطر**: متوسطة — يجب التأكد من أن منطق المصادقة والـ CORS متوافق.

---

### الخيار C: استخدام Supabase Edge Functions للوظائف الجديدة

لأي feature جديدة يحتاج API (مثل تذكيرات CAE أو webhooks)، استخدم **Supabase Edge Functions** بدلاً من Vercel Functions. Edge Functions لا تُحسب ضمن حد Vercel 12/12.

**التكلفة**: تتطلب تفعيل Edge Functions في Supabase وإضافة أسرار جديدة في GitHub Actions.

---

## 3. خطة التنفيذ المقترحة

| المرحلة | المهمة | التأثير |
|---------|--------|---------|
| **1** | دمج `depreciation-factors.js` + `economic-life.js` + `market-intelligence.js` في `api/reference-data.js` | -2 دوال |
| **2** | نقل `/api/funding` و `/api/research` إلى `api/platform.js` | -2 دوال |
| **3** | مراجعة `api/v3/index.js` للتأكد من عدم وجود دوال منفصلة إضافية داخل `api/v3/` | تحديد العدد الفعلي |
| **4** | تحديث الاختبارات و `vercel.json` | ضمان عدم كسر الوظائف |

**العدد المتوقع بعد التنفيذ**: 9 دوال أو أقل.

---

## 4. ملاحظات هامة

- لا تحذف أي ملف API قبل التأكد من عدم استخدامه في أي مكان (استخدم `grep -r "/api/..."`).
- بعد أي دمج، شغّل `npm test` و `npm run audit` بالكامل.
- إذا كان هناك API يُستخدم من GitHub Actions أو cron jobs، تأكد من تحديث الروابط.

---

## 5. التوصية

ابدأ بالخيار A فقط في البداية لأنه الآمن والسريع. بعد التحقق من الاستقرار، انتقل إلى الخيار B. استخدم الخيار C لأي feature مستقبلي.
