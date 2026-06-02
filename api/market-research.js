/**
 * Smart Market Research Agent
 * Vercel Edge Function — zero-cost tier
 *
 * Search sources (no API key needed for primary):
 * 1. DuckDuckGo Lite HTML scraping (primary)
 * 2. DuckDuckGo Classic HTML scraping (fallback)
 * 3. Google Custom Search (optional, 100 req/day free)
 * 4. Built-in industry estimates (ultimate fallback)
 *
 * Analysis: Gemini 1.5 Flash (optional, 1500 req/day free)
 */

export const config = { runtime: 'edge' };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const {
    query,
    country,
    city,
    sector = 'restaurant',
    sectorType,
    researchType = 'market_overview',
  } = body;

  if (!query || !country) {
    return new Response(
      JSON.stringify({ error: 'Missing query or country' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    // Step 1: Gather search results
    let snippets = [];
    let sourceUsed = 'fallback';

    // Primary: DuckDuckGo Lite (no API key)
    try {
      const ddg = await searchDuckDuckGoLite(query, country);
      if (ddg.length) {
        snippets = ddg;
        sourceUsed = 'duckduckgo_lite';
      }
    } catch (e) {
      console.warn('DDG Lite failed:', e.message);
    }

    // Fallback 1: DuckDuckGo Classic
    if (snippets.length < 3) {
      try {
        const ddgClassic = await searchDuckDuckGoClassic(query, country);
        snippets = mergeSnippets(snippets, ddgClassic);
        if (ddgClassic.length && sourceUsed === 'fallback') sourceUsed = 'duckduckgo';
      } catch (e) {
        console.warn('DDG Classic failed:', e.message);
      }
    }

    // Fallback 2: Google Custom Search (if user configured it)
    if (GOOGLE_CSE_KEY && GOOGLE_CSE_CX && snippets.length < 3) {
      try {
        const google = await searchGoogle(query, country);
        snippets = mergeSnippets(snippets, google);
        if (google.length) sourceUsed = 'google';
      } catch (e) {
        console.warn('Google CSE failed:', e.message);
      }
    }

    // Fallback 3: Built-in snippets
    if (snippets.length < 2) {
      snippets = buildFallbackSnippets(query, country, sector);
      sourceUsed = 'fallback';
    }

    // Step 2: Analyze with Gemini (optional)
    let analysis;
    let usedGemini = false;
    if (GEMINI_API_KEY) {
      try {
        analysis = await analyzeWithGemini({ query, country, city, sector, sectorType, researchType, snippets });
        usedGemini = true;
      } catch (e) {
        console.warn('Gemini failed:', e.message);
        analysis = generateLocalEstimate({ query, country, sector, researchType });
      }
    } else {
      analysis = generateLocalEstimate({ query, country, sector, researchType });
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        sources: snippets.slice(0, 5).map((s) => ({
          title: s.title,
          url: s.url,
        })),
        sourceUsed,
        usedGemini,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('Market research error:', err);
    // Never break the UI — return local fallback
    return new Response(
      JSON.stringify({
        success: true,
        analysis: generateLocalEstimate({ query, country, sector, researchType }),
        sources: [],
        sourceUsed: 'local_fallback',
        usedGemini: false,
        warning: err.message,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

/**
 * DuckDuckGo Lite — simpler HTML, often more reliable
 */
async function searchDuckDuckGoLite(query, country) {
  const q = encodeURIComponent(`${query} ${country} restaurant market 2024`);
  const url = `https://lite.duckduckgo.com/lite/?q=${q}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`DDG Lite HTTP ${res.status}`);

  const html = await res.text();
  const results = [];

  // DDG Lite uses table rows: .result-link and .result-snippet
  const linkMatches = [...html.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippetMatches = [...html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)];

  for (let i = 0; i < Math.min(linkMatches.length, snippetMatches.length, 5); i++) {
    const title = stripHtml(linkMatches[i][2]);
    const url = decodeURIComponent(linkMatches[i][1]);
    const snippet = stripHtml(snippetMatches[i][1]);
    if (title && snippet) {
      results.push({ title, url, snippet, source: 'duckduckgo_lite' });
    }
  }

  return results;
}

/**
 * DuckDuckGo Classic HTML
 */
async function searchDuckDuckGoClassic(query, country) {
  const q = encodeURIComponent(`${query} ${country} restaurant market`);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`DDG Classic HTTP ${res.status}`);

  const html = await res.text();
  const results = [];

  // Match result blocks
  const blocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g);
  if (!blocks) return [];

  for (const block of blocks.slice(0, 5)) {
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    const title = titleMatch ? stripHtml(titleMatch[1]) : '';
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : '';
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';

    if (title && snippet) {
      results.push({ title, url, snippet, source: 'duckduckgo' });
    }
  }

  return results;
}

/**
 * Google Custom Search JSON API (100 req/day free)
 */
async function searchGoogle(query, country) {
  const q = `${query} ${country} restaurant market 2024 2025`;
  const url =
    `https://www.googleapis.com/customsearch/v1?` +
    `key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(q)}` +
    `&num=5&hl=${country === 'SA' ? 'ar' : 'en'}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();

  if (!data.items) return [];

  return data.items.map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet || '',
    source: 'google',
  }));
}

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function mergeSnippets(a, b) {
  const seen = new Set(a.map((s) => s.url));
  for (const s of b) {
    if (!seen.has(s.url)) a.push(s);
  }
  return a;
}

function buildFallbackSnippets(query, country, sector) {
  return [
    {
      title: `${query} market in ${country}`,
      url: 'internal://fallback',
      snippet: `The ${sector} market in ${country} continues expanding driven by urbanization, tourism recovery, digital delivery platforms, and evolving consumer preferences toward convenience and quality.`,
      source: 'fallback',
    },
    {
      title: `${country} F&B trends`,
      url: 'internal://fallback',
      snippet: `Food delivery growth, health-conscious menus, experiential dining, and technology integration in restaurant operations are key trends shaping the sector.`,
      source: 'fallback',
    },
    {
      title: `Restaurant sector outlook ${country}`,
      url: 'internal://fallback',
      snippet: `Government SME support programs, rising disposable income, and young demographics create favorable conditions for new restaurant ventures.`,
      source: 'fallback',
    },
  ];
}

/**
 * Analyze with Gemini 1.5 Flash
 */
async function analyzeWithGemini({ query, country, city, sector, sectorType, researchType, snippets }) {
  const prompt = buildGeminiPrompt({ query, country, city, sector, sectorType, researchType, snippets });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(25000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { summary: text, raw: true };
    }
  }

  return { summary: text, raw: true };
}

function buildGeminiPrompt({ query, country, city, sector, sectorType, researchType, snippets }) {
  const context = snippets.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n\n');

  const typeInstructions = {
    market_overview: `
Return JSON with:
- market_size_usd: estimated market size in USD (number). If uncertain, say 0.
- annual_growth_pct: annual growth rate (number). Be conservative.
- key_players: array of 3-5 real competitor/peer names. Only names you are confident exist.
- consumer_trends: array of 3 trends. Include at least 1 NEGATIVE or risky trend.
- opportunities: array of 3 opportunities. Include at least 1 that is conditional/hard to achieve.
- risks: array of 3 specific risks that could kill this business.`,
    competitor_analysis: `
Return JSON with:
- competitors: array of {name, type, strengths, weaknesses, price_range}. Be brutally honest about weaknesses.
- market_gap: string describing the unmet need. If no real gap exists, say so.
- differentiation_opportunity: string. If differentiation is difficult, explain why.`,
    swot_analysis: `
Return JSON with:
- strengths: array of 4 strings. Only genuine internal advantages.
- weaknesses: array of 4 strings. Be critical. Include operational, financial, and talent gaps.
- opportunities: array of 4 strings. Realistic, not fantasy.
- threats: array of 4 strings. Include regulatory, economic, and competitive threats.
- overall_assessment: string. One honest sentence: "This project is [high/medium/low] risk because..."`,
    pestle: `
Return JSON with:
- political: string (1-2 sentences). Include risks, not just stability.
- economic: string (1-2 sentences). Mention inflation, cost pressures, or downturn risks.
- social: string (1-2 sentences). Include changing habits that could hurt the business.
- technological: string (1-2 sentences). Include disruption risks.
- legal: string (1-2 sentences). Include compliance burdens and fines.
- environmental: string (1-2 sentences). Include costs and restrictions.`,
    financial_projections: `
Return JSON with:
- avg_monthly_revenue_usd: conservative estimate (number)
- avg_margin_pct: conservative estimate after all costs (number)
- setup_cost_range_usd: {min, max}. Include hidden costs.
- break_even_months: realistic months, often longer than hoped (number)
- warning: string. One sentence about why projections often fail.`,
    full_template: `
Return ONE comprehensive JSON object that fills all research sections of a feasibility study template:

{
  "country_economy": {
    "gdp_growth": "string: GDP growth rate last 3 years",
    "credit_rating": "string: country credit rating",
    "budget_status": "string: surplus/deficit status",
    "purchasing_power": "string: average income and consumer spending",
    "market_outlook": "string: sector growth expectations",
    "government_impact": "string: how government decisions affect this business"
  },
  "pestle": {
    "political": "string: political risks and support",
    "economic": "string: economic pressures and inflation",
    "social": "string: social trends that could hurt",
    "technological": "string: tech disruption risks",
    "legal": "string: compliance burdens",
    "environmental": "string: environmental costs"
  },
  "swot": {
    "strengths": ["4 strings"],
    "weaknesses": ["4 strings"],
    "opportunities": ["4 strings"],
    "threats": ["4 strings"],
    "overall_assessment": "string: honest risk sentence"
  },
  "competitors": [
    {"name": "string", "type": "string", "strengths": "string", "weaknesses": "string", "price_range": "string"}
  ],
  "market_trends": ["3 trends, at least 1 negative"],
  "marketing_4ps": {
    "product_strategy": "string",
    "pricing_strategy": "string",
    "place_strategy": "string",
    "promotion_strategy": "string"
  },
  "technological_impact": {
    "positive": "string: tech benefits",
    "negative": "string: tech risks",
    "future_risk": "string: how tech could disrupt"
  },
  "legal_requirements": {
    "licenses": ["array of required license names"],
    "taxes": "string: tax obligations",
    "insurance": "string: required insurances"
  },
  "financial_projections": {
    "avg_monthly_revenue_usd": number,
    "avg_margin_pct": number,
    "setup_cost_range_usd": {"min": number, "max": number},
    "break_even_months": number,
    "warning": "string"
  }
}`,
  };

  const langInstruction = isArabicCountry(country)
    ? 'Respond in Arabic language for all text fields.'
    : 'Respond in English language for all text fields.';

  const location = city ? `${city}, ${country}` : country;
  const sectorLabel = sectorType || sector;

  return `You are a skeptical venture capitalist who has lost money on overhyped projects. You are advising an investor whether to fund this ${sectorLabel} project. You MUST be brutally honest — your reputation and money depend on it.

Search Results:
${context}

Project: "${query}" in ${location} (${sectorLabel} sector)

CRITICAL RULES:
1. NEVER be optimistic to please the reader. Pessimism saves money; false optimism loses it.
2. If the search results are weak, say so explicitly.
3. Every claim must be grounded in the search results or general industry reality.
4. If you are uncertain about something, state the uncertainty clearly.
5. Include specific numbers, dates, or percentages where possible.
6. Write as if you are risking your own money on this analysis.

${typeInstructions[researchType] || typeInstructions.market_overview}

${langInstruction}

Return ONLY valid JSON. No markdown, no explanations outside JSON, no cheerleading.

JSON:`;
}

function isArabicCountry(code) {
  const arabCountries = ['SA','AE','EG','KW','QA','BH','OM','JO','IQ','LB','YE','SY','PS','DZ','MA','TN','LY','SD','MR','DJ','KM'];
  return arabCountries.includes(code);
}

function generateLocalEstimate({ query, country, sector, sectorType, researchType }) {
  const isArabic = isArabicCountry(country);
  const type = sectorType || sector;
  const isNgo = /جمعية|منظمة|غير ربح|non-profit|ngo|charity/i.test(type);
  const isIndustrial = /صناع|مصنع|industr|factory|manufactur/i.test(type);
  const isTech = /تقني|برمج|tech|software|it|digital/i.test(type);
  const isHealthcare = /صحة|عياد|health|clinic|medical/i.test(type);
  const isRetail = /تجار|متجر|retail|shop|store/i.test(type);

  const ar = {
    market_overview: {
      market_size_usd: isNgo ? 0 : (isTech ? 1500000000 : (isIndustrial ? 5000000000 : 2500000000)),
      annual_growth_pct: isTech ? 15 : (isNgo ? 5 : 8.5),
      key_players: isNgo ? ['منظمة خيرية رائدة', 'جمعية محلية', 'مبادرة مجتمعية'] : (isTech ? ['شركة ناشئة محلية', 'عملاق تقني عالمي', 'مستشار تقني'] : ['سلسلة محلية رائدة', 'علامة تجارية عالمية', 'منافس ناشئ']),
      consumer_trends: isNgo ? ['زيادة الوعي الاجتماعي', 'توجه نحو المسؤولية المجتمعية', 'دعم حكومي للقطاع غير الربحي'] : ['زيادة الطلب على التوصيل الرقمي', 'الاهتمام بالجودة والخدمة', 'تفضيل تجارب فريدة'],
      opportunities: isNgo ? ['شراكات حكومية', 'تمويل دولي', 'تطوع شبابي'] : ['فرصة في المناطق النامية', 'التوسع الرقمي', 'تطوير منتجات مبتكرة'],
    },
    swot_analysis: {
      strengths: isNgo ? ['دعم حكومي للقطاع غير الربحي', 'وعي مجتمعي متزايد', 'تمويلات دولية متاحة', 'شراكات استراتيجية'] : ['طلب متزايد على القطاع', 'دعم حكومي للمشاريع الصغيرة', 'تنوع المستهلكين', 'نمو رقمي متسارع'],
      weaknesses: isNgo ? ['اعتماد على التبرعات', 'صعوبة الاستدامة المالية', 'نقص الكوادر المؤهلة', 'بيروقراطية إدارية'] : ['تكاليف التأسيس المرتفعة', 'اعتماد على العمالة الوافدة', 'منافسة شديدة', 'تقلبات في الأسعار'],
      opportunities: isNgo ? ['برامج تمكين شبابية', 'تحول رقمي للخدمات', 'شراكات دولية', 'توجهات حكومية جديدة'] : ['نمو السياحة والترفيه', 'التوسع الرقمي', 'تطوير مفاهيم مبتكرة', 'الطلب على الخيارات الجديدة'],
      threats: isNgo ? ['تقلبات التمويل الخارجي', 'تغيرات تنظيمية', 'تباطؤ اقتصادي', 'منافسة على الجهات المانحة'] : ['تقلبات أسعار المواد الخام', 'تغيرات تنظيمية', 'تباطؤ اقتصادي', 'منافسة جديدة'],
    },
    pestle: {
      political: isNgo ? 'استقرار سياسي مع دعم حكومي متزايد للقطاع غير الربحي' : 'استقرار سياسي نسبي مع دعم حكومي للقطاع الخاص',
      economic: isNgo ? 'نمو اقتصادي يدعم الإنفاق الاجتماعي لكن التبرعات قد تتأثر بالتباطؤ' : 'نمو اقتصادي مطرد مع ارتفاع القدرة الشرائية',
      social: isNgo ? 'توجه شبابي نحو العمل التطوعي والمسؤولية المجتمعية' : 'تغيرات سكانية نحو الشباب مع تفضيل تجارب جديدة',
      technological: isNgo ? 'تحول رقمي يُمكّن الجمعيات من الوصول لجمهور أوسع' : 'انتشار المنصات الرقمية وأنظمة الأتمتة',
      legal: isNgo ? 'متطلبات تراخيص للجمعيات ومتطلبات شفافية مالية' : 'متطلبات تراخيص بلدية وضريبة القيمة المضافة',
      environmental: isNgo ? 'تزايد الوعي بالاستدامة ومسؤولية المؤسسات الاجتماعية' : 'تزايد الوعي بالاستدامة وتقليل الهدر',
    },
    financial_projections: {
      avg_monthly_revenue_usd: isNgo ? 0 : (isTech ? 35000 : (isIndustrial ? 80000 : 45000)),
      avg_margin_pct: isNgo ? 0 : (isTech ? 25 : (isIndustrial ? 12 : 18)),
      setup_cost_range_usd: { min: isNgo ? 10000 : (isTech ? 30000 : 80000), max: isNgo ? 50000 : (isTech ? 150000 : 250000) },
      break_even_months: isNgo ? 0 : (isTech ? 10 : (isIndustrial ? 18 : 14)),
    },
  };

  const en = {
    market_overview: {
      market_size_usd: isNgo ? 0 : (isTech ? 1500000000 : (isIndustrial ? 5000000000 : 2500000000)),
      annual_growth_pct: isTech ? 15 : (isNgo ? 5 : 8.5),
      key_players: isNgo ? ['Leading Charity', 'Local Association', 'Community Initiative'] : (isTech ? ['Local Startup', 'Global Tech Giant', 'Tech Consultant'] : ['Leading Local Chain', 'Global Brand', 'Emerging Competitor']),
      consumer_trends: isNgo ? ['Growing social awareness', 'Shift toward corporate social responsibility', 'Government support for non-profits'] : ['Growing digital demand', 'Quality and service focus', 'Preference for unique experiences'],
      opportunities: isNgo ? ['Government partnerships', 'International funding', 'Youth volunteering'] : ['Underserved areas', 'Digital expansion', 'Innovative product development'],
    },
    swot_analysis: {
      strengths: isNgo ? ['Government support for non-profits', 'Growing social awareness', 'International funding available', 'Strategic partnerships'] : ['Growing sector demand', 'Government SME support', 'Diverse consumer base', 'Rapid digital growth'],
      weaknesses: isNgo ? ['Donation dependency', 'Financial sustainability challenges', 'Qualified staff shortage', 'Administrative bureaucracy'] : ['High setup costs', 'Expatriate labor dependency', 'Intense competition', 'Price volatility'],
      opportunities: isNgo ? ['Youth empowerment programs', 'Digital service transformation', 'International partnerships', 'New government directions'] : ['Tourism growth', 'Digital expansion', 'Innovative concepts', 'Demand for new options'],
      threats: isNgo ? ['External funding fluctuations', 'Regulatory changes', 'Economic slowdown', 'Donor competition'] : ['Raw material price fluctuations', 'Regulatory changes', 'Economic slowdown', 'New competition'],
    },
    pestle: {
      political: isNgo ? 'Political stability with increasing government support for non-profit sector' : 'Relative political stability with government support for private sector',
      economic: isNgo ? 'Economic growth supports social spending but donations may be affected by slowdown' : 'Steady economic growth with rising purchasing power',
      social: isNgo ? 'Youth trend toward volunteering and community responsibility' : 'Youth-driven population favoring new experiences',
      technological: isNgo ? 'Digital transformation enables NGOs to reach wider audiences' : 'Widespread digital platforms and automation',
      legal: isNgo ? 'NGO licensing requirements and financial transparency mandates' : 'Municipal licensing and value-added tax requirements',
      environmental: isNgo ? 'Growing sustainability awareness and institutional social responsibility' : 'Growing sustainability awareness and waste reduction',
    },
    financial_projections: {
      avg_monthly_revenue_usd: isNgo ? 0 : (isTech ? 35000 : (isIndustrial ? 80000 : 45000)),
      avg_margin_pct: isNgo ? 0 : (isTech ? 25 : (isIndustrial ? 12 : 18)),
      setup_cost_range_usd: { min: isNgo ? 10000 : (isTech ? 30000 : 80000), max: isNgo ? 50000 : (isTech ? 150000 : 250000) },
      break_even_months: isNgo ? 0 : (isTech ? 10 : (isIndustrial ? 18 : 14)),
    },
  };

  const data = isArabic ? ar : en;
  return data[researchType] || data.market_overview;
}
