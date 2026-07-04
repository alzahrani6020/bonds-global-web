/**
 * Bonds V3 — AI Chat API endpoint
 *
 * POST /api/ai/chat
 * Body: { messages: [{role, content}], context?: {cityCode, activityCode, ...} }
 *
 * Design philosophy: accuracy and trust first.
 * - Answers are built from real database records when available.
 * - When data is missing, the assistant says so clearly.
 * - No profit promises, no exaggerated claims.
 */

const { getSupabaseClient } = require('../lib/supabase');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return 'غير متوفر';
  const n = Number(num);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' مليار';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' مليون';
  if (n >= 1e3) return n.toLocaleString('ar-SA');
  return n.toLocaleString('ar-SA');
}

function formatPercent(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return 'غير متوفر';
  return Number(num).toFixed(1) + '%';
}

function formatCurrency(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return 'غير متوفر';
  return formatNumber(num) + ' ر.س';
}

function dataQualityNote(confidence) {
  if (confidence == null) return '\n— مصدر: Bonds V3 Data Engine | مستوى الثقة: غير محدد.';
  const label = confidence >= 80 ? 'موثق' : confidence >= 50 ? 'متوسط' : 'تقديري';
  let note = `\n— مصدر: Bonds V3 Data Engine | مستوى الثقة: ${Math.round(confidence)}% (${label}).`;
  if (confidence < 50) {
    note += '\n⚠️ هذه البيانات تقديرية؛ يُنصح بالتحقق من مصادر محلية قبل اتخاذ القرار النهائي.';
  }
  return note;
}

function demandLabel(d) {
  if (d === 'high') return 'مرتفع';
  if (d === 'low') return 'منخفض';
  if (d === 'medium') return 'متوسط';
  return d || 'غير محدد';
}

function opportunityVerdict(score) {
  if (score >= 80) return { label: 'فرصة استثمارية قوية جداً', advice: 'توصي البيانات بدراسة الجدوى التفصيلية والمضي قدماً بحذر.' };
  if (score >= 60) return { label: 'فرصة جيدة', advice: 'الفرصة مشجعة، لكن يُنصح بمراجعة التكاليف والمنافسة.' };
  if (score >= 40) return { label: 'فرصة متوسطة', advice: 'تحتاج الدراسة لمزيد من التحقق قبل اتخاذ القرار.' };
  return { label: 'فرصة ضعيفة حالياً', advice: 'أنصحك بمراجعة البدائل أو انتظار تحسن المؤشرات.' };
}

function buildSystemPrompt(context) {
  const city = context?.cityName || context?.cityCode || 'غير محدد';
  const activity = context?.activityName || context?.activityCode || 'غير محدد';
  const country = context?.countryCode || '';

  return `أنت "مساعد بوندز"، محلل استثماري يعتمد على البيانات فقط. أجب بالعربية الفصحى بأسلوب مختصر وواقعي.

قواعدك الصارمة:
- استند إلى البيانات المذكورة فقط. لا تخترع أرقام ولا تبالغ.
- لا تقدم نصائح مالية نهائية ولا وعوداً بالربح.
- إذا ناقصتك بيانات، قل بوضوح: "لا توجد بيانات كافية".
- اذكر مصدر الأرقام (بonds V3 Data Engine) عند ذكرها.
- كن واقعياً: كل استثمار يحمل مخاطر، والبيانات تقديرية وتخضع للتحقق.

السياق المتاح:
- المدينة: ${city} (${country || 'الدولة غير محددة'})
- النشاط: ${activity}
${context?.population != null ? `- عدد السكان: ${formatNumber(context.population)} نسمة\n` : ''}${context?.purchasingPowerIndex != null ? `- مؤشر القوة الشرائية: ${context.purchasingPowerIndex}\n` : ''}${context?.indicators ? `- المؤشرات الاقتصادية متاحة.\n` : ''}${context?.marketData ? `- بيانات السوق لهذا النشاط متاحة.\n` : ''}${context?.comparison ? `- بيانات مقارنة مع مدن أخرى متاحة.\n` : ''}${context?.alerts?.length ? `- إنذارات حديثة متاحة (${context.alerts.length}).\n` : ''}`;
}

function generateDataDrivenReply(userMessage, context) {
  const msg = (userMessage || '').toLowerCase();
  const city = context?.cityName || context?.cityCode || 'المدينة المختارة';
  const activity = context?.activityName || context?.activityCode || 'النشاط المختار';
  const m = context?.marketData || {};
  const hasMarketData = m.opportunity_score != null;
  const indicators = context?.indicators || {};
  const comparison = context?.comparison || [];
  const alerts = context?.alerts || [];

  // Greeting / general
  if (msg.match(/^(مرحبا|مرحباً|هلا|أهلا|السلام|سلام|مساعد|من أنت|ما هي|ما هو)/)) {
    return `مرحباً! أنا مساعد بوندز. أساعدك في تحليل الفرص الاستثمارية في المدن العربية بناءً على بيانات Bonds V3 Data Engine. اختر مدينة ونشاطاً، ثم اسألني عن التقييم، المخاطر، المقارنات، أو حجم السوق.`;
  }

  // Opportunity evaluation
  if (msg.includes('قيم') || msg.includes('تقييم') || msg.includes('رأيك') || msg.includes('فرصة') || msg.includes('هل تنصح')) {
    if (hasMarketData) {
      const verdict = opportunityVerdict(m.opportunity_score);
      const details = [];
      if (m.market_size != null) details.push(`حجم السوق ${formatCurrency(m.market_size)}`);
      if (m.competitors_count != null) details.push(`${formatNumber(m.competitors_count)} منافس`);
      if (m.market_saturation_score != null) details.push(`تشبع السوق ${formatPercent(m.market_saturation_score)}`);
      if (m.expected_demand) details.push(`الطلب المتوقع ${demandLabel(m.expected_demand)}`);
      if (m.avg_salary != null) details.push(`متوسط الراتب ${formatCurrency(m.avg_salary)}`);

      let reply = `تقييم فرصة "${activity}" في ${city}:\n`;
      reply += `• الحكم: ${verdict.label} (درجة الفرصة ${m.opportunity_score}/100).\n`;
      if (details.length) reply += `• البيانات: ${details.join('، ')}.\n`;
      reply += `• التوصية: ${verdict.advice}\n`;
      if (m.confidence != null) reply += `• مستوى ثقة البيانات: ${m.confidence}%.`;
      reply += dataQualityNote(m.confidence);
      return reply;
    }

    // No market data for this city/activity — be helpful with what we have
    let reply = `لا تتوفر بيانات سوق محددة لـ "${activity}" في ${city} حالياً، لذا لا يمكنني إعطاء حكم دقيق على الفرصة.\n`;
    if (Object.keys(indicators).length) {
      reply += `\nما يتوفر من مؤشرات المدينة:\n`;
      reply += `• عدد السكان: ${context?.population != null ? formatNumber(context.population) : 'غير متوفر'}\n`;
      reply += `• معدل النمو: ${indicators.growth_rate != null ? formatPercent(indicators.growth_rate) : 'غير متوفر'}\n`;
      reply += `• معدل البطالة: ${indicators.unemployment_rate != null ? formatPercent(indicators.unemployment_rate) : 'غير متوفر'}\n`;
      reply += `• متوسط الإيجار/م²: ${indicators.avg_rent_per_sqm != null ? formatCurrency(indicators.avg_rent_per_sqm) : 'غير متوفر'}\n`;
    }
    if (comparison.length > 1) {
      const sorted = [...comparison].sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
      reply += `\nللنشاط نفسه، لدينا بيانات لـ ${comparison.length} مدينة. المدن الأعلى فرصة:\n`;
      sorted.slice(0, 3).forEach((c, i) => {
        reply += `${i + 1}. ${c.cityName}: ${c.opportunity_score != null ? c.opportunity_score + '/100' : 'غير متوفر'}\n`;
      });
    } else {
      reply += `\nنصيحتي: جرّب مدينة أخرى لها بيانات سوق (مثلاً الرياض أو جدة أو دبي أو القاهرة)، أو اختر نشاطاً مختلفاً من القائمة. يمكنك أيضاً استعراض "بنك الفرص" لأفضل الفرص المتاحة حالياً.`;
    }
    reply += dataQualityNote(null);
    return reply;
  }

  // Compare cities
  if (msg.includes('أفضل') || msg.includes('قارن') || msg.includes('مقارنة') || msg.includes('compare')) {
    if (comparison.length > 1) {
      const sorted = [...comparison].sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
      const best = sorted[0];
      const currentRank = sorted.findIndex(c => c.cityCode === context.cityCode) + 1;
      let reply = `تصنيف مدن لنشاط "${activity}" حسب درجة الفرصة:\n`;
      sorted.slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.cityName}: ${c.opportunity_score != null ? c.opportunity_score + '/100' : 'غير متوفر'}\n`;
      });
      if (currentRank) reply += `\n${city} تحتل المركز ${currentRank} من بين ${sorted.length} مدينة لدينا بيانات لها.`;
      if (best && best.cityCode !== context.cityCode) {
        reply += `\nالمدينة الأفضل حالياً هي ${best.cityName} بدرجة فرصة ${best.opportunity_score}/100.`;
      }
      reply += dataQualityNote(60);
      return reply;
    }
    return `للمقارنة بين المدن، أحتاج لبيانات السوق لنشاط "${activity}" في عدة مدن. يمكنك استخدام صفحة "مقارنة المدن" لترتيبها حسب درجة الفرصة.`;
  }

  // Risks
  if (msg.includes('مخاطر') || msg.includes('خطر') || msg.includes('مخاطرة') || msg.includes('سلبيات')) {
    const risks = [];
    if (hasMarketData) {
      if (m.market_saturation_score > 70) risks.push(`تشبع سوقي مرتفع (${formatPercent(m.market_saturation_score)})`);
      if (m.market_saturation_score > 50 && m.market_saturation_score <= 70) risks.push(`تشبع سوقي متوسط`);
      if (m.competitors_count > 50) risks.push(`عدد كبير من المنافسين (${formatNumber(m.competitors_count)})`);
      if (m.expected_demand === 'low') risks.push(`طلب سوقي منخفض`);
      if (m.avg_salary > 12000) risks.push(`تكاليف عمالة مرتفعة`);
    }
    if (indicators.inflation_rate > 5) risks.push(`معدل تضخم مرتفع (${formatPercent(indicators.inflation_rate)})`);
    if (indicators.unemployment_rate > 10) risks.push(`بطالة مرتفعة (${formatPercent(indicators.unemployment_rate)})`);

    risks.push('تقلبات اقتصادية قد تؤثر على التدفقات النقدية');
    risks.push('تغيرات في تكاليف الإيجار والتشغيل');

    if (alerts.length) {
      const topAlert = alerts[0];
      risks.push(`إنذار حديث: ${topAlert.message}`);
    }

    let reply = `المخاطر الرئيسية لـ "${activity}" في ${city}:\n`;
    risks.forEach((r, i) => reply += `${i + 1}. ${r}\n`);
    reply += `\nلتقليل المخاطر، استخدم محرك السيناريوهات لاختبار الركود والتضخم.`;
    reply += dataQualityNote(hasMarketData ? m.confidence : (indicators.growth_rate != null ? 60 : null));
    return reply;
  }

  // Market size / competitors
  if (msg.includes('حجم السوق') || msg.includes('منافس') || msg.includes('منافسين') || msg.includes('تشبع')) {
    if (hasMarketData) {
      return `بيانات سوق "${activity}" في ${city}:\n` +
        `• حجم السوق: ${m.market_size != null ? formatCurrency(m.market_size) : 'غير متوفر'}\n` +
        `• عدد المنافسين: ${m.competitors_count != null ? formatNumber(m.competitors_count) : 'غير متوفر'}\n` +
        `• درجة التشبع: ${m.market_saturation_score != null ? formatPercent(m.market_saturation_score) : 'غير متوفر'}\n` +
        `• الطلب المتوقع: ${demandLabel(m.expected_demand)}\n` +
        `• متوسط الراتب: ${m.avg_salary != null ? formatCurrency(m.avg_salary) : 'غير متوفر'}` +
        dataQualityNote(m.confidence);
    }
    return `بيانات حجم السوق والمنافسين لـ "${activity}" في ${city} غير متوفرة حالياً. تأكد من اختيار النشاط، أو استخدم "بنك الفرص" لاستكشاف الأنشطة المتاحة.`;
  }

  // Payback / improve
  if (msg.includes('استرداد') || msg.includes('أحسن') || msg.includes('تحسين') || msg.includes('تقليل تكلفة')) {
    let reply = `لتحسين جدوى "${activity}" في ${city}:\n`;
    if (hasMarketData) {
      if (m.market_saturation_score > 60) reply += `• تجنب المناطق ذات التشبع العالي؛ ابحث عن مواقع بنسبة تشبع أقل.\n`;
      if (m.avg_salary > 12000) reply += `• راجع هيكل التوظيف لتقليل تكاليف العمالة.\n`;
      if (m.expected_demand === 'low') reply += `• قدم عروضاً تسويقية لتحفيز الطلب.\n`;
    }
    if (indicators.avg_rent_per_sqm > 500) reply += `• راجع خيارات الإيجار؛ تكلفة المتر مرتفعة نسبياً في هذه المدينة.\n`;
    reply += `• اختبر سيناريو تقليل التكاليف الثابتة 10-15% في محرك السيناريوهات.\n`;
    reply += `• راجع سعر الإيجار/المتر المربع قبل اختيار الموقع.`;
    reply += dataQualityNote(hasMarketData ? m.confidence : null);
    return reply;
  }

  // City indicators
  if (msg.includes('مؤشرات') || msg.includes('اقتصاد') || msg.includes('سكان') || msg.includes('نمو')) {
    return `مؤشرات ${city}:\n` +
      `• عدد السكان: ${context?.population != null ? formatNumber(context.population) : 'غير متوفر'}\n` +
      `• مؤشر القوة الشرائية: ${context?.purchasingPowerIndex != null ? context.purchasingPowerIndex : 'غير متوفر'}\n` +
      `• معدل النمو: ${indicators.growth_rate != null ? formatPercent(indicators.growth_rate) : 'غير متوفر'}\n` +
      `• معدل البطالة: ${indicators.unemployment_rate != null ? formatPercent(indicators.unemployment_rate) : 'غير متوفر'}\n` +
      `• معدل التضخم: ${indicators.inflation_rate != null ? formatPercent(indicators.inflation_rate) : 'غير متوفر'}\n` +
      `• متوسط الإيجار/م²: ${indicators.avg_rent_per_sqm != null ? formatCurrency(indicators.avg_rent_per_sqm) : 'غير متوفر'}` +
      dataQualityNote(indicators.overall_confidence);
  }

  // Alerts
  if (msg.includes('إنذار') || msg.includes('تنبيه') || msg.includes('تغير') || msg.includes('تحديث')) {
    if (alerts.length) {
      let reply = `أحدث التغيرات في ${city}:\n`;
      alerts.slice(0, 5).forEach((a, i) => {
        reply += `${i + 1}. ${a.message}\n`;
      });
      return reply;
    }
    return `لا توجد إنذارات حديثة مسجلة لـ ${city}. يمكنك متابعة صفحة الإنذارات للتحديثات.`;
  }

  return null;
}

function fallbackReply(userMessage, context) {
  const dataReply = generateDataDrivenReply(userMessage, context);
  if (dataReply) return dataReply;

  const city = context?.cityName || context?.cityCode || 'المدينة';
  const activity = context?.activityName || context?.activityCode || 'النشاط';

  return `أنا مساعد بوندز، وأعتمد على البيانات لإعطائك إجابات دقيقة عن "${activity}" في ${city}.\n\nيمكنك سؤالي عن:\n• كيف تقيم هذه الفرصة؟\n• ما مخاطر الاستثمار هنا؟\n• ما حجم السوق والمنافسين؟\n• قارن بين المدن\n• ما أحدث المؤشرات والإنذارات؟\n\nللحصول على إجابة أدق، اختر مدينة ونشاطاً محددين من القوائم أعلاه.`;
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

  // Enrich context with real data
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const lastUserText = lastUser?.content || '';

  let enrichedContext = { ...context };
  try {
    enrichedContext = await enrichContext(enrichedContext, lastUserText);
  } catch (err) {
    console.warn('[ai/chat] Context enrichment failed:', err.message);
  }

  const reply = fallbackReply(lastUserText, enrichedContext);

  // Debug: include enrichment summary in response during rollout
  const debugInfo = {
    input: lastUser?.content,
    cityName: enrichedContext.cityName || null,
    activityName: enrichedContext.activityName || null,
    hasMarketData: !!enrichedContext.marketData,
    hasIndicators: !!enrichedContext.indicators,
    comparisonCount: (enrichedContext.comparison || []).length,
    alertCount: (enrichedContext.alerts || []).length
  };

  sendJson(res, 200, {
    reply,
    source: 'data-driven',
    debug: debugInfo,
    context: {
      cityCode: enrichedContext.cityCode || null,
      activityCode: enrichedContext.activityCode || null,
      cityName: enrichedContext.cityName || null,
      activityName: enrichedContext.activityName || null
    }
  });
}

async function resolveActivityAndCityFromMessage(message, context, supabase) {
  const msg = (message || '').toLowerCase().trim();
  if (!msg) return context;

  if (!context.activityCode) {
    const { data: activities } = await supabase
      .from('economic_activities')
      .select('code, name_ar')
      .eq('is_active', true);
    if (activities) {
      const matched = activities.find(a => msg.includes((a.name_ar || '').toLowerCase()));
      if (matched) context.activityCode = matched.code;
    }
  }

  if (!context.cityCode) {
    const { data: cities } = await supabase
      .from('cities')
      .select('code, name_ar')
      .eq('is_active', true)
      .limit(2000);
    if (cities) {
      const matched = cities.find(c => msg.includes((c.name_ar || '').toLowerCase()));
      if (matched) context.cityCode = matched.code;
    }
  }

  return context;
}

async function enrichContext(context, userMessage) {
  const supabase = getSupabaseClient();
  const currentYear = new Date().getFullYear();

  await resolveActivityAndCityFromMessage(userMessage, context, supabase);

  if (!context.cityCode) return context;

  // City basic info
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

  // City indicators
  const { data: indicators } = await supabase
    .from('city_indicators')
    .select('gdp_city, growth_rate, unemployment_rate, inflation_rate, avg_rent_per_sqm, avg_land_price_per_sqm, establishments_count, business_ease_index, overall_confidence')
    .eq('city_id', city.id)
    .eq('year', currentYear)
    .maybeSingle();

  if (indicators) enriched.indicators = indicators;

  if (context.activityCode) {
    // Activity info
    const { data: activity } = await supabase
      .from('economic_activities')
      .select('id, name_ar, code')
      .eq('code', context.activityCode)
      .single();

    if (activity) {
      enriched.activityName = activity.name_ar;

      // Market data for this city + activity
      const { data: market } = await supabase
        .from('city_market_data')
        .select('opportunity_score, market_size, competitors_count, market_saturation_score, avg_salary, annual_growth_rate, expected_demand, confidence')
        .eq('city_id', city.id)
        .eq('activity_id', activity.id)
        .eq('data_year', currentYear)
        .maybeSingle();

      if (market) enriched.marketData = market;

      // Comparison with other cities for same activity
      // Fetch all modern city rows for this activity so rankings are accurate
      const { data: comparison } = await supabase
        .from('city_market_data')
        .select('opportunity_score, city:city_id(name_ar, code)')
        .eq('activity_id', activity.id)
        .eq('data_year', currentYear)
        .order('opportunity_score', { ascending: false })
        .limit(2000);

      if (comparison) {
        // Only include modern city codes (XX-NN-NNN) to avoid duplicates with legacy short codes
        enriched.comparison = comparison
          .filter(c => c.city && /^[A-Z]{2}-\d{2}-\d{3}$/.test(c.city.code))
          .map(c => ({
            cityCode: c.city.code,
            cityName: c.city.name_ar,
            opportunity_score: c.opportunity_score
          }));
      }
    }
  }

  // Recent alerts for this city
  const { data: alerts } = await supabase
    .from('alerts')
    .select('message, severity, created_at, metric_code')
    .eq('city_id', city.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (alerts) enriched.alerts = alerts;

  return enriched;
}

module.exports = { aiChatHandler };
