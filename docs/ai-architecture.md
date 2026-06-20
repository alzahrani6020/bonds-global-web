# معمارية Bonds AI — النسخة المبسطة

## الهدف
بناء نظام ذكاء اصطناعي داخل بوندز لتحليل:
- الجدارة الائتمانية
- دراسات الجدوى
- المشاريع المتعثرة
- استخبارات المدن

بأقل تكلفة تشغيل ممكنة، وبجودة مناسبة للمراجعة من المتخصصين.

---

## المبدأ الأساسي

> **"AI Call = Report, not step"**

كل طلب تحليل = طلب واحد فقط للـ AI.

---

## المكونات

| الملف | الوظيفة |
|-------|---------|
| `lib/ai/prompts.js` | قوالب Prompts الجاهزة |
| `lib/ai/orchestrator.js` | Cache + Prompt + AI Call + حفظ النتيجة |
| `lib/ai/analyze-handler.js` | معالج HTTP endpoint |
| `v3/api/index.js` | توجيه الطلب `/ai/analyze` |
| `supabase/migrations/20260624000000_ai_analysis_tables.sql` | جداول `ai_requests`, `ai_results`, `ai_cache` |

---

## Endpoints

### تحليل AI

```http
POST /api/v3/ai/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "feasibility_study",
  "projectId": "uuid-اختياري",
  "payload": {
    "sector": "restaurant",
    "city": "Jeddah",
    "investment": 500000,
    "monthly_revenue": 120000,
    "monthly_costs": 85000
  },
  "model": "gpt-5.4"
}
```

### طلب مراجعة استشارية

```http
POST /api/v3/ai/request-review
Authorization: Bearer <token>
Content-Type: application/json

{
  "requestId": "uuid",
  "note": "العميل طلب مراجعة استشارية"
}
```

### الرد

```json
{
  "success": true,
  "cached": false,
  "request_id": "uuid",
  "result": {
    "analysis": "...",
    "risk_score": 65,
    "risk_level": "متوسط",
    "recommendations": ["..."],
    "financial_summary": { "key_metrics": [...] },
    "confidence": 80,
    "missing_data": []
  },
  "usage": {
    "tokens_input": 1200,
    "tokens_output": 800,
    "cost_usd": 0.015
  }
}
```

---

## تدفق العمل

```
User Request
    ↓
Auth Check (JWT)
    ↓
Generate Input Hash
    ↓
Check Cache (Supabase ai_cache)
    ↓
Exists → Return cached result
Not exists →
    ↓
Save pending request
    ↓
Build Prompt (lib/ai/prompts.js)
    ↓
Call OpenAI API (ONE CALL)
    ↓
Save result + usage + cost
    ↓
Save to cache
    ↓
Return response
    ↓
Specialist Review Gate
    ↓
Client Dashboard / PDF
```

---

## تقليل التكلفة

1. **One Call Rule**: طلب واحد فقط لكل تحليل.
2. **Cache First**: نفس البيانات = نفس النتيجة بدون AI.
3. **Compact Input**: JSON مختصر بدلاً من نصوص طويلة.
4. **Calculators First**: حساب NPV/IRR/DSCR خارج AI.
5. **Model Routing**: GPT-5.4 للتحليل، GPT-5.4-mini للتلخيص.
6. **Batch API**: للمهام الليلية غير العاجلة.

---

## Validation Layer

قبل إرسال أي طلب إلى OpenAI، يتم التحقق من:

- صحة `type`.
- وجود الحقول المطلوبة لكل نوع تحليل.
- أن الحقول المالية أرقام صحيحة وغير سالبة.
- إزالة وسوم HTML من النصوص.
- تقييد طول النصوص لتقليل التوكنات.

## واجهة العميل

تمت إضافة وحدة AI داخل بوابة العميل:

- الملف: `client/portal.js`
- المسار: `client/index.html`
- تظهر للعميل تحت قسم "التحليل الاستشاري".
- Dashboard احترافي يعرض:
  - مؤشر المخاطر الدائري.
  - بطاقات: درجة الجدوى، قابلية التمويل، العائد المتوقع، مدة الاسترداد.
  - نقاط القوة والضعف.
  - التوصيات الرئيسية.
  - الملخص التنفيذي.
- أزرار عمل:
  - **تحميل التقرير التنفيذي PDF**
  - **طلب مراجعة استشارية**

## إدارة Prompt Drift (مستقبلاً)

- تم إعداد `prompts.js` ليسهل إضافة `version` لكل قالب.
- يمكن تخزين رقم النسخة في `ai_requests.model_version` لاحقاً.

## الأمان

- لا يوجد `password` في الجداول — نستخدم Supabase Auth.
- RLS على `ai_requests` و `ai_results`.
- `OPENAI_API_KEY` في Vercel Environment Variables فقط.
- AI لا يرى البيانات إلا بعد تسجيل دخول المستخدم.

---

## المرحلة التالية

1. تطبيق الـ Migration في Supabase.
2. إضافة `OPENAI_API_KEY` في Vercel.
3. اختبار الـ Endpoint باستخدام Postman أو cURL.
4. اختبار واجهة العميل في البيئة المحلية.
5. مراجعة التصميم البصري مع فريق UI/UX.
