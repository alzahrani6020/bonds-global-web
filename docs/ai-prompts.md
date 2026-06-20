# قوالب Prompts الخاصة بـ Bonds AI

> مبدأ التصميم: **"AI Call = Report, not step"**
> كل Prompt يطلب رداً واحداً منظماً بصيغة JSON.

## الملفات

- `lib/ai/prompts.js` — الوحدة البرمجية الجاهزة للاستخدام.

## أنواع التحليل المدعومة

| النوع | الاستخدام |
|-------|-----------|
| `credit_assessment` | تقييم الجدارة الائتمانية |
| `feasibility_study` | دراسة جدوى المشروع |
| `distressed_project` | إحياء مشروع متعثر |
| `city_analysis` | استخبارات المدينة |

## طريقة الاستخدام

```javascript
const { buildPrompt } = require('../lib/ai/prompts');

const messages = buildPrompt('feasibility_study', {
  type: 'restaurant',
  city: 'Jeddah',
  investment: 500000,
  monthly_revenue: 120000,
  monthly_costs: 85000,
  npv: 450000,
  irr: 0.18,
  dscr: 1.4
});

// إرسال messages إلى OpenAI API
```

## قواعد النظام (System Prompt)

- الاعتماد فقط على البيانات المدخلة.
- عدم اختراع أرقام أو معلومات.
- الإخراج كـ JSON صالح فقط.
- تقديم درجة ثقة (0-100) ومصدر لكل مؤشر.

## هيكل الإخراج المطلوب

```json
{
  "analysis": "نص تحليلي مختصر بالعربية",
  "risk_score": 0,
  "risk_level": "منخفض | متوسط | مرتفع | حرج",
  "recommendations": ["نصيحة 1", "نصيحة 2"],
  "financial_summary": {
    "key_metrics": [
      {
        "name": "اسم المؤشر",
        "value": "القيمة",
        "confidence": 0,
        "source": "البيانات المدخلة / استنتاج تحليلي"
      }
    ],
    "notes": "ملاحظات مالية"
  },
  "confidence": 0,
  "missing_data": ["بيان ناقص 1"]
}
```

## مبدأ تقليل التكلفة

1. **One Call Rule:** طلب واحد فقط لكل تقرير.
2. **Cache First:** تخزين النتائج وإعادة استخدامها.
3. **Compact Input:** إرسال JSON مختصر بدلاً من نصوص طويلة.
4. **Calculators First:** حساب NPV/IRR/DSCR خارج AI ثم إرسال النتيجة.
5. **Human Review Gate:** مراجعة المتخصص قبل عرض النتيجة للعميل.
