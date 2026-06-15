/**
 * Bonds V3 — Optional LLM Insights
 *
 * Falls back to rule-based insights if no OpenAI API key is configured.
 */

function isOpenAIKeyConfigured() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;
  // Treat obvious placeholders / local providers as not configured
  const normalized = apiKey.trim().toLowerCase();
  if (normalized === 'ollama' || normalized === 'none' || normalized === 'null' || normalized === 'test') return false;
  return true;
}

async function generateLLMInsights(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!isOpenAIKeyConfigured()) {
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Saudi economic investment analyst. Respond in Arabic with concise, actionable insights. Output valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[llm] OpenAI error:', err);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch (err) {
    console.error('[llm] Error:', err.message);
    return null;
  }
}

function buildPrompt(result, marketData, cityName) {
  const s = result.summary;
  const r = result.risk;

  return `
أنت محلل استثماري متخصص في السوق السعودي.

بيانات المشروع:
- النموذج: ${result.model.name_ar}
- المدينة: ${cityName || 'غير محددة'}
- الإيراد السنوي المتوقع: ${s.annualRevenue?.toLocaleString()} ريال
- صافي الربح السنوي: ${s.annualProfit?.toLocaleString()} ريال
- هامش الربح الإجمالي: ${s.grossMargin}%
- هامش EBITDA: ${s.ebitdaMargin}%
- فترة الاسترداد: ${s.paybackMonths} شهر
- NPV: ${s.npv?.toLocaleString()} ريال
- IRR: ${s.irr}%
- DSCR: ${s.dscr}
- درجة المخاطر: ${r.score}/100 (${r.level})
${marketData ? `
بيانات السوق:
- عدد المنافسين: ${marketData.competitors_count}
- إشباع السوق: ${marketData.market_saturation_score}/100
- توفر العمالة: ${marketData.labor_availability_score}/100
- متوسط الإيجار: ${marketData.avg_rent_per_sqm} ريال/م²
- متوسط الراتب: ${marketData.avg_salary} ريال
- مؤشر القوة الشرائية: ${marketData.purchasing_power_index}
` : ''}

أرجع JSON بالمفاتيح التالية فقط:
- "executive_summary": ملخص تنفيذي بسطرين
- "strengths": مصفوفة نقاط القوة
- "concerns": مصفوفة المخاوف
- "recommendation": توصية واضحة (استثمر / فكر فيه / تجنب)
- "action_items": مصفوفة خطوات عملية
`;
}

module.exports = { generateLLMInsights, buildPrompt };
