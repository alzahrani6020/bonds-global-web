export const config = { runtime: 'edge' };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ALLOWED_ORIGINS = [
  'https://bonds-global.com',
  'https://www.bonds-global.com',
  'http://localhost:3005',
  'http://localhost:3000'
];

function corsHeaders(request) {
  const origin = request?.headers?.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : 'https://bonds-global.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
}

const ARABIC_PROMPT = `أنت محلل مالي متخصص في دراسات الجدوى. قم بتحليل النص التالي المستخرج من دراسة جدوى، واستخرج البيانات التالية بتنسيق JSON صالح فقط (valid JSON) بدون أي شرح إضافي أو رموز markdown.

النص قد يكون عربياً أو إنجليزياً أو مزيجاً. استخرج كل ما تجده.

أعد JSON بهذا الهيكل بالضبط:
{
  "projectName": "اسم المشروع",
  "country": "الدولة",
  "city": "المدينة",
  "sector": "القطاع",
  "vision": "رؤية ورسالة المشروع باختصار",
  "products": ["وصف المنتج/الخدمة 1", "وصف المنتج/الخدمة 2"],
  "targetCustomers": "وصف العملاء المستهدفين",
  "investment": 0,
  "currency": "SAR",
  "fixedCosts": [
    {"name": "اسم التكلفة الثابتة", "monthlyAmount": 0}
  ],
  "variableCosts": [
    {"name": "اسم التكلفة المتغيرة", "unitCost": 0, "unit": "لكل وحدة"}
  ],
  "revenueStreams": [
    {"name": "مصدر الإيراد", "unitPrice": 0, "monthlyUnits": 0}
  ],
  "employees": [
    {"position": "المسمى الوظيفي", "count": 1, "monthlySalary": 0}
  ],
  "marketing": {
    "product": "وصف المنتج التسويقي",
    "price": "استراتيجية التسعير",
    "place": "قنوات التوزيع",
    "promotion": "وسائل الترويج"
  },
  "swot": {
    "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
    "weaknesses": ["نقطة ضعف 1"],
    "opportunities": ["فرصة 1"],
    "threats": ["تهديد 1"]
  },
  "competitors": [
    {"name": "اسم المنافس", "strengths": "نقاط قوته", "weaknesses": "نقاط ضعفه"}
  ],
  "risks": [
    {"risk": "وصف الخطر", "mitigation": "طريقة التخفيف"}
  ],
  "legal": {
    "licenses": ["ترخيص 1", "ترخيص 2"],
    "insurance": "وصف التأمينات",
    "taxes": "وصف الالتزامات الضريبية"
  },
  "timeline": "الجدول الزمني التنفيذي باختصار",
  "summary": "ملخص تنفيذي للدراسة بـ 3-5 أسطر"
}

قواعد مهمة:
- جميع الأرقام يجب أن تكون أرقاماً (numbers) وليست نصوصاً.
- إذا لم تجد بيانات معينة، استخدم: للمصفوفات [] وللنصوص "" وللأرقام 0.
- لا تضف أي حقل غير المذكور أعلاه.
- اكتب JSON نظيفاً وصالحاً يمكن تحليله بـ JSON.parse().

النص المستخرج من الدراسة:`;

const ENGLISH_PROMPT = `You are a financial analyst specialized in feasibility studies. Analyze the following text extracted from a feasibility study and extract data in valid JSON format only (no markdown, no extra explanation).

The text may be in English, Arabic, or mixed. Extract everything you find.

Return JSON with this exact structure:
{
  "projectName": "Project name",
  "country": "Country",
  "city": "City",
  "sector": "Sector",
  "vision": "Vision and mission summary",
  "products": ["Product/Service description 1", "Product/Service description 2"],
  "targetCustomers": "Target customer description",
  "investment": 0,
  "currency": "SAR",
  "fixedCosts": [
    {"name": "Fixed cost name", "monthlyAmount": 0}
  ],
  "variableCosts": [
    {"name": "Variable cost name", "unitCost": 0, "unit": "per unit"}
  ],
  "revenueStreams": [
    {"name": "Revenue source", "unitPrice": 0, "monthlyUnits": 0}
  ],
  "employees": [
    {"position": "Job title", "count": 1, "monthlySalary": 0}
  ],
  "marketing": {
    "product": "Product marketing description",
    "price": "Pricing strategy",
    "place": "Distribution channels",
    "promotion": "Promotion methods"
  },
  "swot": {
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1"],
    "opportunities": ["Opportunity 1"],
    "threats": ["Threat 1"]
  },
  "competitors": [
    {"name": "Competitor name", "strengths": "Their strengths", "weaknesses": "Their weaknesses"}
  ],
  "risks": [
    {"risk": "Risk description", "mitigation": "Mitigation approach"}
  ],
  "legal": {
    "licenses": ["License 1", "License 2"],
    "insurance": "Insurance description",
    "taxes": "Tax obligations description"
  },
  "timeline": "Implementation timeline summary",
  "summary": "Executive summary of the study in 3-5 lines"
}

Important rules:
- All numbers must be actual numbers, not strings.
- If data not found, use: arrays [], strings "", numbers 0.
- Do NOT add any fields beyond those listed above.
- Write clean valid JSON parseable by JSON.parse().

The extracted study text:`;

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders(request) });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders(request) });
  }

  const { text, lang = 'ar' } = body;
  if (!text || text.trim().length < 100) {
    return new Response(JSON.stringify({ error: 'Text too short (minimum 100 characters)' }), { status: 400, headers: corsHeaders(request) });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: corsHeaders(request) });
  }

  const prompt = lang === 'ar' ? ARABIC_PROMPT : ENGLISH_PROMPT;
  const fullPrompt = prompt + '\n\n' + text.trim().substring(0, 25000); // Limit to 25K chars

  async function callGemini(modelName) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
      }),
    });
    return await res.json();
  }

  try {
    let data = await callGemini('gemini-2.5-flash');

    // Fallback to gemini-2.5-flash-lite if high demand or error
    if (data.error && (data.error.message?.includes('high demand') || data.error.status?.includes('UNAVAILABLE') || data.error.status?.includes('RESOURCE_EXHAUSTED') || data.error.message?.includes('not found') || data.error.message?.includes('quota'))) {
      data = await callGemini('gemini-2.5-flash-lite');
    }

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message || 'Gemini API error' }), { status: 500, headers: corsHeaders(request) });
    }

    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code blocks if present
    responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

    // Extract JSON from response
    let analysis = null;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Try cleaning up common issues
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .replace(/\n/g, ' ')
          .replace(/\r/g, '');
        try {
          analysis = JSON.parse(cleaned);
        } catch (e2) {
          return new Response(JSON.stringify({ error: 'Failed to parse AI response as JSON', raw: responseText }), { status: 200, headers: corsHeaders(request) });
        }
      }
    }

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'No valid JSON found in AI response', raw: responseText }), { status: 200, headers: corsHeaders(request) });
    }

    return new Response(JSON.stringify({ success: true, analysis }), { status: 200, headers: corsHeaders(request) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), { status: 500, headers: corsHeaders(request) });
  }
}