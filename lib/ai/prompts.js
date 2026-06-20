/**
 * Bonds AI Prompt Templates
 *
 * Design principle: AI Call = Report, not step
 * Each prompt requests a single structured JSON response.
 *
 * Usage:
 *   const { buildPrompt } = require('./lib/ai/prompts');
 *   const messages = buildPrompt('feasibility_study', { ... });
 */

const SYSTEM_PROMPT = `
أنت "مستشار بوندز المالي والاستثماري"، مساعد ذكاء اصطناعي متخصص في تحليل المشاريع والاستثمارات في السعودية والدول العربية.

قواعدك الأساسية:
1. اعتمد فقط على البيانات المقدمة. لا تُخترع أرقاماً أو معلومات.
2. إذا كانت البيانات غير كافية، اكتب "بيانات غير متوفرة" بدلاً من التخمين.
3. ركّز على الدقة المالية والمصطلحات السعودية/العربية (زكاة، ضريبة القيمة المضافة، سعودة، إلخ).
4. أخرج النتيجة كـ JSON صالح فقط، بدون أي نص إضافي خارج JSON.
5. قدّم درجة ثقة (0-100) لكل قسم رئيسي.
6. قدّم مصادر: إذا كان الرقم من البيانات المدخلة اكتب "البيانات المدخلة"، وإذا كان استنتاجاً اكتب "استنتاج تحليلي".
7. لا تقدم نصائح قانونية نهائية؛ اكتب "يوصى بمراجعة مستشار قانوني/مالي معتمد" عند الحاجة.
`.trim();

const OUTPUT_SCHEMA_INSTRUCTION = `
أخرج JSON بالهيكل التالي فقط:
{
  "executive_summary": "ملخص تنفيذي مختصر يفهمه العميل غير التقني (2-3 جمل)",
  "analysis": "تحليل تفصيلي مختصر",
  "risk_score": 0,
  "risk_level": "منخفض" | "متوسط" | "مرتفع" | "حرج",
  "recommendations": ["نصيحة 1", "نصيحة 2"],
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
  "financial_summary": {
    "key_metrics": [
      {"name": "اسم المؤشر", "value": "القيمة", "confidence": 0, "source": "البيانات المدخلة / استنتاج تحليلي"}
    ],
    "notes": "ملاحظات مالية"
  },
  "confidence": 0,
  "missing_data": ["بيان ناقص 1"]
}

ملاحظات:
- "executive_summary": اكتب ملخصاً تنفيذياً واضحاً يمكن للعميل فهمه دون خلفية مالية عميقة.
- "confidence" هي درجة الثقة الإجمالية في التحليل (0-100).
- "missing_data" اتركه [] إذا كانت البيانات كافية.
- لا تضف حقولاً إضافية خارج هذا الهيكل.
`.trim();

function compactJson(data) {
  return JSON.stringify(data, null, 2);
}

const templates = {
  credit_assessment: (data) => `
نوع التحليل: تقييم الجدارة الائتمانية (Credit Assessment)

البيانات المدخلة:
${compactJson(data)}

المطلوب:
- تقييم قدرة المنشأة أو الشخص على سداد الالتزامات المالية.
- تحليل النسب المالية المقدمة.
- تحديد المخاطر الائتمانية الرئيسية.
- تقديم توصيات: قبول / رفض / طلب ضمانات إضافية / مراجعة إضافية.
- يجب أن تتضمن المؤشرات:
  - التصنيف الائتماني (ممتاز / جيد / متوسط / ضعيف)
  - نسبة تغطية خدمة الدين (DSCR)
  - قدرة السداد الشهرية

${OUTPUT_SCHEMA_INSTRUCTION}
`.trim(),

  feasibility_study: (data) => `
نوع التحليل: دراسة جدوى (Feasibility Study)

البيانات المدخلة:
${compactJson(data)}

ملاحظة مهمة: إذا كانت المؤشرات المالية (NPV / IRR / DSCR) محسوبة مسبقاً، استخدمها كما هي. إذا لم تكن موجودة، لا تحسبها بنفسك واكتب "غير متوفرة".

المطلوب:
- تقييم جدوى المشروع من الناحية المالية والسوقية.
- تحديد نقاط القوة والضعف بوضوح.
- تحديد المخاطر الرئيسية.
- توصية: مُوصى به / قابل للتنفيذ بشروط / غير مُوصى به.
- يجب أن تتضمن المؤشرات المالية:
  - درجة الجدوى (0-100)
  - قابلية التمويل (مرتفعة / متوسطة / منخفضة)
  - العائد المتوقع (%)
  - مدة الاسترداد (سنوات)

${OUTPUT_SCHEMA_INSTRUCTION}
`.trim(),

  distressed_project: (data) => `
نوع التحليل: إحياء مشروع متعثر (Distressed Project Rescue)

البيانات المدخلة:
${compactJson(data)}

المطلوب:
- تحليل أسباب التعثر: مالية، تشغيلية، سوقية، قانونية، إدارية.
- تقييم حجم المشكلة وإمكانية الإنقاذ.
- اقتراح خيارات الإنقاذ: إعادة هيكلة، حقن نقدي، بيع جزئي/كلي، إغلاق منظم.
- خطة عمل عملية بخطوات مبدئية.
- يجب أن تتضمن المؤشرات:
  - احتمالية النجاة (%)
  - الخيار الأفضل للإنقاذ
  - الاحتياج النقدي التقريبي

${OUTPUT_SCHEMA_INSTRUCTION}
`.trim(),

  city_analysis: (data) => `
نوع التحليل: استخبارات المدينة (City Intelligence)

البيانات المدخلة:
${compactJson(data)}

المطلوب:
- تقييم جاذبية السوق في المدينة المحددة للقطاع المحدد.
- تحليل الطلب والمنافسة والبيئة التنظيمية والبنية التحتية.
- تحديد الفرص والمخاطر.
- تقديم توصية استثمارية.
- يجب أن تتضمن المؤشرات:
  - جاذبية السوق (0-100)
  - مستوى المنافسة (مرتفع / متوسط / منخفض)
  - حجم الفرصة
  - المخاطر الرئيسية

${OUTPUT_SCHEMA_INSTRUCTION}
`.trim(),
};

/**
 * Build an OpenAI-compatible messages array for a given analysis type.
 *
 * @param {'credit_assessment'|'feasibility_study'|'distressed_project'|'city_analysis'} type
 * @param {object} data - Compact JSON input data.
 * @returns {Array<{role:string, content:string}>}
 */
function buildPrompt(type, data) {
  if (!templates[type]) {
    throw new Error(
      `Unknown prompt type: ${type}. Available types: ${Object.keys(templates).join(', ')}`
    );
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: templates[type](data) },
  ];
}

module.exports = {
  SYSTEM_PROMPT,
  templates,
  buildPrompt,
  availableTypes: Object.keys(templates),
};
