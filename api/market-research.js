/**
 * Market Research API
 * Generates market research insights using Gemini.
 * Requires GEMINI_API_KEY environment variable.
 */

const { withRateLimit } = require('../lib/api/rate-limit');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const RESEARCH_PROMPT_AR = `أنت محلل سوق واستشاري اقتصادي متخصص في دراسات الجدوى للمشاريع الصغيرة والمتوسطة في العالم العربي.

المطلوب: قدم تحليل سوق مفيدًا ومختصرًا لمشروع يصفه المستخدم، في دولة ومدينة محددتين وقطاع معين.

أعد الرد كـ JSON صالح فقط (بدون شرح خارجي أو markdown) بهذا الهيكل:
{
  "market_trends": ["اتجاه 1", "اتجاه 2", "اتجاه 3"],
  "technological_impact": {
    "positive": "تأثير إيجابي مختصر",
    "negative": "تحدي تقني محتمل",
    "future_risk": "مخاطر مستقبلية"
  },
  "country_economy": {
    "gdp_growth": "نمو الناتج المحلي الإجمالي أو الوضع الاقتصادي العام",
    "inflation": "معدل التضخم أو تأثيره",
    "consumer_spending": "قوة الإنفاق الاستهلاكي في القطاع"
  },
  "target_customers": "وصف مختصر للعملاء المستهدفين",
  "competitors": [
    {"name": "اسم منافس 1", "strengths": "نقاط القوة", "weaknesses": "نقاط الضعف", "intensity": 8},
    {"name": "اسم منافس 2", "strengths": "...", "weaknesses": "...", "intensity": 6}
  ],
  "legal_requirements": {
    "licenses": ["ترخيص 1", "ترخيص 2"],
    "taxes": "ملخص ضريبي مختصر",
    "insurance": "تأمينات مقترحة"
  },
  "risks": [
    {"risk": "خطر 1", "mitigation": "طريقة التخفيف"},
    {"risk": "خطر 2", "mitigation": "طريقة التخفيف"}
  ],
  "opportunities": ["فرصة 1", "فرصة 2"],
  "summary": "ملخص تنفيذي للبحث بـ 3-5 أسطر"
}

قواعد:
- اجعل البيانات واقعية ومخصصة للدولة والمدينة والقطاع المذكورة.
- إذا لم تكن متأكدًا من رقم محدد، استخدم وصفًا عامًا بدلًا من تخمين.
- جميع المصفوفات يجب أن تحتوي على عنصر واحد على الأقل.
- لا تضف أي نص خارج كتلة JSON.`;

const RESEARCH_PROMPT_EN = `You are a market analyst and economic consultant specialized in feasibility studies for SMEs in the Arab world.

Task: Provide useful and concise market research for a project described by the user, in a specific country, city, and sector.

Return ONLY valid JSON (no markdown, no external explanation) with this structure:
{
  "market_trends": ["Trend 1", "Trend 2", "Trend 3"],
  "technological_impact": {
    "positive": "Short positive impact",
    "negative": "Potential tech challenge",
    "future_risk": "Future risks"
  },
  "country_economy": {
    "gdp_growth": "GDP growth or general economic situation",
    "inflation": "Inflation rate or impact",
    "consumer_spending": "Consumer spending power in the sector"
  },
  "target_customers": "Brief description of target customers",
  "competitors": [
    {"name": "Competitor 1", "strengths": "Strengths", "weaknesses": "Weaknesses", "intensity": 8},
    {"name": "Competitor 2", "strengths": "...", "weaknesses": "...", "intensity": 6}
  ],
  "legal_requirements": {
    "licenses": ["License 1", "License 2"],
    "taxes": "Brief tax summary",
    "insurance": "Recommended insurances"
  },
  "risks": [
    {"risk": "Risk 1", "mitigation": "Mitigation approach"},
    {"risk": "Risk 2", "mitigation": "Mitigation approach"}
  ],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "summary": "Executive summary of the research in 3-5 lines"
}

Rules:
- Make data realistic and tailored to the country, city, and sector.
- If unsure about a specific number, use a general description instead of guessing.
- All arrays must contain at least one item.
- Do not include any text outside the JSON block.`;

async function callGemini(modelName, prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });
  return await res.json();
}

function extractJson(text) {
  text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    const cleaned = match[0]
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
    return JSON.parse(cleaned);
  }
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'GEMINI_API_KEY not configured',
      hint: 'أضف GEMINI_API_KEY في متغيرات بيئة Vercel لتفعيل البحث الذكي'
    });
  }

  try {
    const { query, country, city, sectorType, researchType, lang = 'ar' } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'query is required (minimum 5 characters)' });
    }
    if (!country) {
      return res.status(400).json({ success: false, error: 'country is required' });
    }

    const promptBase = lang === 'ar' ? RESEARCH_PROMPT_AR : RESEARCH_PROMPT_EN;
    const userPrompt = `مشروع: ${query.trim()}\nالدولة: ${country}\nالمدينة: ${city || 'غير محددة'}\nالقطاع: ${sectorType || 'عام'}\nنوع البحث: ${researchType || 'full_template'}`;
    const fullPrompt = `${promptBase}\n\n${userPrompt}`;

    let data = await callGemini('gemini-2.5-flash', fullPrompt);

    if (data.error && (data.error.message?.includes('high demand') || data.error.status?.includes('UNAVAILABLE') || data.error.status?.includes('RESOURCE_EXHAUSTED') || data.error.message?.includes('not found') || data.error.message?.includes('quota'))) {
      data = await callGemini('gemini-2.5-flash-lite', fullPrompt);
    }

    if (data.error) {
      console.error('[market-research] Gemini error:', data.error);
      return res.status(502).json({ success: false, error: data.error.message || 'Gemini API error' });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const analysis = extractJson(responseText);

    if (!analysis) {
      return res.status(500).json({ success: false, error: 'Failed to parse AI response as JSON', raw: responseText });
    }

    return res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('[market-research] Error:', err);
    return res.status(500).json({ success: false, error: 'Market research failed' });
  }
}

module.exports = withRateLimit('ai', handler);
