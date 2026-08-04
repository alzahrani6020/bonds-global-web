// ============================================
// Research API router
// Merges: image-search, market-research, promo-simulator, omnichannel-calculator
// ============================================

const getSupabase = require('../lib/api/supabase');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { setAllowedOrigin } = require('../lib/api/cors');
const { verifyBearer } = require('../lib/api/auth-helper');

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Image Search ───────────────────────────────────────────
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function imageSearchHandler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!PEXELS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'PEXELS_API_KEY not configured',
      hint: 'أضف PEXELS_API_KEY في متغيرات بيئة Vercel لتفعيل البحث عن الصور'
    });
  }

  try {
    const { query, count = 15, page = 1 } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const perPage = Math.min(Math.max(parseInt(count, 10) || 15, 1), 30);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query.trim())}&per_page=${perPage}&page=${pageNum}`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );

    if (!pexelsRes.ok) {
      const errText = await pexelsRes.text();
      console.error('[image-search] Pexels error:', pexelsRes.status, errText);
      return res.status(502).json({ success: false, error: 'Pexels API error', details: errText });
    }

    const pexelsData = await pexelsRes.json();
    const images = (pexelsData.photos || []).map(photo => ({
      id: photo.id,
      thumb: photo.src?.medium || photo.src?.small,
      full: photo.src?.large || photo.src?.medium || photo.src?.original,
      alt: photo.alt || query,
      photographer: photo.photographer,
      url: photo.url
    }));

    return res.status(200).json({
      success: true,
      originalQuery: query,
      optimizedQuery: query,
      images,
      total_results: pexelsData.total_results || images.length
    });
  } catch (err) {
    console.error('[image-search] Error:', err);
    return res.status(500).json({ success: false, error: 'Image search failed' });
  }
}

// ── Market Research ────────────────────────────────────────
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

async function researchCallGemini(modelName, prompt) {
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

function researchExtractJson(text) {
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

async function marketResearchHandler(req, res) {
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

    let data = await researchCallGemini('gemini-2.5-flash', fullPrompt);

    if (data.error && (data.error.message?.includes('high demand') || data.error.status?.includes('UNAVAILABLE') || data.error.status?.includes('RESOURCE_EXHAUSTED') || data.error.message?.includes('not found') || data.error.message?.includes('quota'))) {
      data = await researchCallGemini('gemini-2.5-flash-lite', fullPrompt);
    }

    if (data.error) {
      console.error('[market-research] Gemini error:', data.error);
      return res.status(502).json({ success: false, error: data.error.message || 'Gemini API error' });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const analysis = researchExtractJson(responseText);

    if (!analysis) {
      return res.status(500).json({ success: false, error: 'Failed to parse AI response as JSON', raw: responseText });
    }

    return res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('[market-research] Error:', err);
    return res.status(500).json({ success: false, error: 'Market research failed' });
  }
}

// ── Promo Simulator ────────────────────────────────────────
async function promoSimulatorHandler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearer(req);
    const body = req.body || {};
    const { menu_item_id, platform_id, discount_pct, current_daily_sales } = body;

    if (!menu_item_id || !platform_id || typeof discount_pct !== 'number' || typeof current_daily_sales !== 'number') {
      return res.status(400).json({ success: false, error: 'menu_item_id, platform_id, discount_pct, and current_daily_sales are required' });
    }

    const supabase = getSupabase();

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', menu_item_id)
      .eq('user_id', user.id)
      .single();
    if (itemError || !item) return res.status(404).json({ success: false, error: 'Menu item not found' });

    const { data: platform, error: platError } = await supabase
      .from('platforms')
      .select('*')
      .eq('id', platform_id)
      .single();
    if (platError || !platform) return res.status(404).json({ success: false, error: 'Platform not found' });

    let ingredientCost = 0;
    try {
      const { data: itemIngredients } = await supabase
        .from('menu_item_ingredients')
        .select('ingredient_id, quantity_needed')
        .eq('menu_item_id', menu_item_id);

      if (itemIngredients?.length) {
        const ingredientIds = itemIngredients.map(r => r.ingredient_id);
        const { data: prices } = await supabase
          .from('menu_ingredients')
          .select('id, current_price')
          .eq('user_id', user.id)
          .in('id', ingredientIds);

        const priceMap = new Map((prices || []).map(p => [p.id, p.current_price]));
        for (const row of itemIngredients) {
          const price = priceMap.get(row.ingredient_id) || 0;
          ingredientCost += (row.quantity_needed || 0) * price;
        }
      }
    } catch (ingErr) {
      console.warn('[promo-simulator] Could not load ingredient costs:', ingErr.message);
    }

    const originalPrice = parseFloat(item.base_price) || 0;
    const discountedPrice = originalPrice * (1 - discount_pct / 100);

    const commissionRate = parseFloat(platform.commission_rate) || 0;
    const serviceFeeRate = parseFloat(platform.service_fee_rate) || 0;
    const gatewayFeeRate = parseFloat(platform.payment_gateway_fee) || 0;

    const originalCommission = originalPrice * (commissionRate / 100);
    const originalServiceFee = originalPrice * (serviceFeeRate / 100);
    const originalGatewayFee = originalPrice * (gatewayFeeRate / 100);
    const originalPlatformFees = originalCommission + originalServiceFee + originalGatewayFee;
    const originalNet = originalPrice - ingredientCost - originalPlatformFees;
    const originalMarginPct = originalPrice > 0 ? (originalNet / originalPrice) * 100 : 0;

    const discountedCommission = discountedPrice * (commissionRate / 100);
    const discountedServiceFee = discountedPrice * (serviceFeeRate / 100);
    const discountedGatewayFee = discountedPrice * (gatewayFeeRate / 100);
    const discountedPlatformFees = discountedCommission + discountedServiceFee + discountedGatewayFee;
    const discountedNet = discountedPrice - ingredientCost - discountedPlatformFees;
    const newMarginPct = discountedPrice > 0 ? (discountedNet / discountedPrice) * 100 : 0;

    const isProfitable = discountedNet > 0;
    const dailyOriginalNet = originalNet * current_daily_sales;
    const dailyDiscountedNet = discountedNet * current_daily_sales;
    const dailyDifference = dailyDiscountedNet - dailyOriginalNet;

    let verdict;
    if (!isProfitable) {
      verdict = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFCC4D" d="M2.653 35C.811 35-.001 33.662.847 32.027L16.456 1.972c.849-1.635 2.238-1.635 3.087 0l15.609 30.056c.85 1.634.037 2.972-1.805 2.972H2.653z"/><path fill="#231F20" d="M15.583 28.953c0-1.333 1.085-2.418 2.419-2.418 1.333 0 2.418 1.085 2.418 2.418 0 1.334-1.086 2.419-2.418 2.419-1.334 0-2.419-1.085-2.419-2.419zm.186-18.293c0-1.302.961-2.108 2.232-2.108 1.241 0 2.233.837 2.233 2.108v11.938c0 1.271-.992 2.108-2.233 2.108-1.271 0-2.232-.807-2.232-2.108V10.66z"/></svg> الخصم ${discount_pct}% يجعل الوجبة خاسرة بمقدار ${Math.abs(discountedNet).toFixed(2)} ر.س لكل قطعة`;
    } else if (dailyDifference >= 0) {
      verdict = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#77B255" d="M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z"/><path fill="#FFF" d="M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z"/></svg> الخصم مربح: زيادة يومية متوقعة بـ ${dailyDifference.toFixed(2)} ر.س`;
    } else {
      verdict = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFCC4D" d="M2.653 35C.811 35-.001 33.662.847 32.027L16.456 1.972c.849-1.635 2.238-1.635 3.087 0l15.609 30.056c.85 1.634.037 2.972-1.805 2.972H2.653z"/><path fill="#231F20" d="M15.583 28.953c0-1.333 1.085-2.418 2.419-2.418 1.333 0 2.418 1.085 2.418 2.418 0 1.334-1.086 2.419-2.418 2.419-1.334 0-2.419-1.085-2.419-2.419zm.186-18.293c0-1.302.961-2.108 2.232-2.108 1.241 0 2.233.837 2.233 2.108v11.938c0 1.271-.992 2.108-2.233 2.108-1.271 0-2.232-.807-2.232-2.108V10.66z"/></svg> الخصم يقلل الربح اليومي بـ ${Math.abs(dailyDifference).toFixed(2)} ر.س`;
    }

    return res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        original_price: parseFloat(originalPrice.toFixed(2)),
        discounted_price: parseFloat(discountedPrice.toFixed(2)),
        ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
        original_margin_pct: parseFloat(originalMarginPct.toFixed(1)),
        new_margin_pct: parseFloat(newMarginPct.toFixed(1)),
        original_net_per_unit: parseFloat(originalNet.toFixed(2)),
        new_net_per_unit: parseFloat(discountedNet.toFixed(2)),
        daily_original_net: parseFloat(dailyOriginalNet.toFixed(2)),
        daily_discounted_net: parseFloat(dailyDiscountedNet.toFixed(2)),
        daily_difference: parseFloat(dailyDifference.toFixed(2)),
        is_profitable: isProfitable,
        verdict
      }
    });
  } catch (err) {
    console.error('[promo-simulator] Error:', err);
    return res.status(500).json({ success: false, error: 'Simulation failed' });
  }
}

// ── Omnichannel Calculator ─────────────────────────────────
async function omnichannelCalculatorHandler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearer(req);
    const body = req.body || {};
    const { menu_item_id, platform_id, direct_cac, direct_delivery_fee, monthly_ad_budget } = body;

    if (!menu_item_id || !platform_id || typeof direct_cac !== 'number' || typeof direct_delivery_fee !== 'number' || typeof monthly_ad_budget !== 'number') {
      return res.status(400).json({ success: false, error: 'menu_item_id, platform_id, direct_cac, direct_delivery_fee, and monthly_ad_budget are required' });
    }

    const supabase = getSupabase();

    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', menu_item_id)
      .eq('user_id', user.id)
      .single();
    if (itemError || !item) return res.status(404).json({ success: false, error: 'Menu item not found' });

    const { data: platform, error: platError } = await supabase
      .from('platforms')
      .select('*')
      .eq('id', platform_id)
      .single();
    if (platError || !platform) return res.status(404).json({ success: false, error: 'Platform not found' });

    let ingredientCost = 0;
    try {
      const { data: itemIngredients } = await supabase
        .from('menu_item_ingredients')
        .select('ingredient_id, quantity_needed')
        .eq('menu_item_id', menu_item_id);

      if (itemIngredients?.length) {
        const ingredientIds = itemIngredients.map(r => r.ingredient_id);
        const { data: prices } = await supabase
          .from('menu_ingredients')
          .select('id, current_price')
          .eq('user_id', user.id)
          .in('id', ingredientIds);

        const priceMap = new Map((prices || []).map(p => [p.id, p.current_price]));
        for (const row of itemIngredients) {
          const price = priceMap.get(row.ingredient_id) || 0;
          ingredientCost += (row.quantity_needed || 0) * price;
        }
      }
    } catch (ingErr) {
      console.warn('[omnichannel-calculator] Could not load ingredient costs:', ingErr.message);
    }

    const itemPrice = parseFloat(item.base_price) || 0;

    const commissionRate = parseFloat(platform.commission_rate) || 0;
    const serviceFeeRate = parseFloat(platform.service_fee_rate) || 0;
    const gatewayFeeRate = parseFloat(platform.payment_gateway_fee) || 0;

    const platformCommission = itemPrice * (commissionRate / 100);
    const platformServiceFee = itemPrice * (serviceFeeRate / 100);
    const platformGatewayFee = itemPrice * (gatewayFeeRate / 100);
    const platformDeliveryFee = parseFloat(platform.delivery_fee) || parseFloat(direct_delivery_fee) || 0;
    const platformTotalFees = platformCommission + platformServiceFee + platformGatewayFee;
    const platformNetRevenue = itemPrice - ingredientCost - platformTotalFees - platformDeliveryFee;

    const directAdCostPerOrder = monthly_ad_budget / 100;
    const directTotalCost = ingredientCost + direct_cac + direct_delivery_fee + directAdCostPerOrder;
    const directNetRevenue = itemPrice - directTotalCost;

    const diff = directNetRevenue - platformNetRevenue;
    const betterChannel = diff > 0 ? 'direct' : 'platform';
    const recommendation = diff > 0
      ? `البيع المباشر أفضل بمقدار ${Math.abs(diff).toFixed(2)} ر.س لكل قطعة`
      : `المنصة أفضل بمقدار ${Math.abs(diff).toFixed(2)} ر.س لكل قطعة`;

    return res.status(200).json({
      success: true,
      data: {
        item_name: item.name,
        item_price: parseFloat(itemPrice.toFixed(2)),
        ingredient_cost: parseFloat(ingredientCost.toFixed(2)),
        platform: {
          name: platform.name,
          commission: parseFloat(platformCommission.toFixed(2)),
          service_fee: parseFloat(platformServiceFee.toFixed(2)),
          gateway_fee: parseFloat(platformGatewayFee.toFixed(2)),
          delivery_fee: parseFloat(platformDeliveryFee.toFixed(2)),
          net_revenue: parseFloat(platformNetRevenue.toFixed(2))
        },
        direct: {
          cac: parseFloat(direct_cac.toFixed(2)),
          delivery_fee: parseFloat(direct_delivery_fee.toFixed(2)),
          ad_cost_per_order: parseFloat(directAdCostPerOrder.toFixed(2)),
          net_revenue: parseFloat(directNetRevenue.toFixed(2))
        },
        comparison: {
          difference: parseFloat(diff.toFixed(2)),
          better_channel: betterChannel,
          recommendation
        }
      }
    });
  } catch (err) {
    console.error('[omnichannel-calculator] Error:', err);
    return res.status(500).json({ success: false, error: 'Calculation failed' });
  }
}

// ── Main Router ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/api/image-search' || pathname === '/api/image-search/') {
      if (await checkRateLimit('compute', req, res)) return;
      return imageSearchHandler(req, res);
    }
    if (pathname === '/api/market-research' || pathname === '/api/market-research/') {
      if (await checkRateLimit('ai', req, res)) return;
      return marketResearchHandler(req, res);
    }
    if (pathname === '/api/promo-simulator' || pathname === '/api/promo-simulator/') {
      if (await checkRateLimit('auth', req, res)) return;
      return promoSimulatorHandler(req, res);
    }
    if (pathname === '/api/omnichannel-calculator' || pathname === '/api/omnichannel-calculator/') {
      if (await checkRateLimit('auth', req, res)) return;
      return omnichannelCalculatorHandler(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[research] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
};