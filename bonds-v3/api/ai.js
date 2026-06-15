/**
 * Bonds V3 — AI Chat API endpoint
 *
 * POST /api/ai/chat
 * Body: { messages: [{role, content}], context?: {cityCode, activityCode, ...} }
 */

const { getSupabaseClient } = require('../lib/supabase');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Simple in-memory per-IP rate limit: 20 requests per minute
const rateLimiter = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;

  const entries = rateLimiter.get(ip) || [];
  const fresh = entries.filter(t => now - t < windowMs);
  if (fresh.length >= limit) return false;
  fresh.push(now);
  rateLimiter.set(ip, fresh);
  return true;
}

function isOpenAIConfigured() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;
  const normalized = key.trim().toLowerCase();
  return !['ollama', 'none', 'null', 'test', ''].includes(normalized);
}

async function fetchOpenAIChat(messages, model) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 700
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

function buildSystemPrompt(context) {
  let prompt = `أنت "مساعد بوندز"، محلل استثماري متخصص في السوق السعودي والخليجي والمصري. أجب بالعربية الفصحى بأسلوب مختصر وعملي.

قواعد:
- لا تقدم نصائح مالية نهائية أو وعود بالربح.
- استند إلى البيانات المقدمة فقط؛ إذا لم تتوفر بيانات كافية، اطلب توضيحاً من المستخدم.
- عند مقارنة مدن، ذكر المؤشرات الرئيسية (حجم السوق، التشبع، القوة الشرائية، توفر العمالة، تكلفة الإيجار، المخاطر).
- إذا كان المشروع ضعيفاً، اقترح تحسينات أو مدن/أنشطة بديلة بأدب.
`;

  if (context?.cityCode) {
    prompt += `\nالمدينة المختارة: ${context.cityCode}.`;
  }
  if (context?.activityCode) {
    prompt += `\nالنشاط الاقتصادي المختار: ${context.activityCode}.`;
  }
  if (context?.modelCode) {
    prompt += `\nنموذج المشروع: ${context.modelCode}.`;
  }
  if (context?.calculationResult) {
    const r = context.calculationResult;
    prompt += `\nنتائج الحساب المتاحة: ${JSON.stringify(r)}.`;
  }

  return prompt;
}

function fallbackReply(userMessage, context) {
  const city = context?.cityCode || 'المدينة المختارة';
  const activity = context?.activityCode || 'النشاط المختار';
  const replies = [
    `شكراً لسؤالك. لمساعدتك بشكل أفضل حول "${activity}" في "${city}"، يمكنك مراجعة مؤشر الفرصة الذهبية والخريطة الاستثمارية. إذا كان لديك نتائج حساب محددة، أرسلها لي لأحللها.`,
    `المعذرة، مساعد الذكاء الاصطناعي غير متاح مؤقتاً. يمكنك الاستفادة من بيانات السوق والمنافسة المتاحة في صفحة ذكاء المدن والخريطة الاستثمارية.`,
    `أنا هنا لمساعدتك في تحليل الفرص الاستثمارية. حدد المدينة والنشاط أو أرسل نتائج دراسة جدوى لأعطيك رأياً أولياً.`
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

async function aiChatHandler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return sendJson(res, 429, { error: 'Rate limit exceeded. Try again later.' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { messages = [], context = {} } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages array is required' });
  }

  // Optional: enrich context with current city and market data
  let enrichedContext = { ...context };
  try {
    enrichedContext = await enrichContext(enrichedContext);
  } catch (err) {
    console.warn('[ai/chat] Context enrichment failed:', err.message);
  }

  const systemPrompt = buildSystemPrompt(enrichedContext);
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-10) // keep last 10 messages
  ];

  let reply = null;
  let source = 'openai';

  if (isOpenAIConfigured()) {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      reply = await fetchOpenAIChat(chatMessages, model);
    } catch (err) {
      console.error('[ai/chat] OpenAI failed:', err.message);
    }
  }

  if (!reply) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    reply = fallbackReply(lastUser?.content || '', enrichedContext);
    source = 'fallback';
  }

  sendJson(res, 200, {
    reply,
    source,
    context: {
      cityCode: enrichedContext.cityCode || null,
      activityCode: enrichedContext.activityCode || null
    }
  });
}

async function enrichContext(context) {
  if (!context.cityCode) return context;

  const supabase = getSupabaseClient();
  const { data: city } = await supabase
    .from('cities')
    .select('id, code, name_ar, name_en, country_code, population, purchasing_power_index')
    .eq('code', context.cityCode)
    .single();

  if (!city) return context;

  const enriched = {
    ...context,
    cityName: city.name_ar,
    cityNameEn: city.name_en,
    countryCode: city.country_code,
    population: city.population,
    purchasingPowerIndex: city.purchasing_power_index
  };

  if (context.activityCode) {
    const { data: activity } = await supabase
      .from('economic_activities')
      .select('id, name_ar, code')
      .eq('code', context.activityCode)
      .single();

    if (activity) {
      enriched.activityName = activity.name_ar;
      const { data: market } = await supabase
        .from('city_market_data')
        .select('opportunity_score, market_size, competitors_count, market_saturation_score, avg_salary, annual_growth_rate, expected_demand, confidence')
        .eq('city_id', city.id)
        .eq('activity_id', activity.id)
        .eq('data_year', new Date().getFullYear())
        .maybeSingle();
      if (market) enriched.marketData = market;
    }
  }

  return enriched;
}

module.exports = { aiChatHandler };
