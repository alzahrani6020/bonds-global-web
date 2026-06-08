/**
 * Image Search API
 * Uses Pexels API (200 requests/hour free)
 * https://www.pexels.com/api/
 *
 * Falls back to Unsplash Source (deprecated but works) if no key
 */

export const config = { runtime: 'edge' };

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Optimize user query for image search engines using Gemini.
 * Strips filler words, translates Arabic→English, extracts key nouns.
 */
async function optimizeQueryForImages(rawQuery) {
  if (!GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY, using raw query');
    return rawQuery;
  }

  // Simple rule-based optimization (faster, no API dependency)
  let q = rawQuery.toLowerCase().trim();
  // Strip Arabic filler words
  const arabicFillers = ['صور', 'صورة', 'صوره', 'كامل', 'بالتفصيل', 'صوره', 'صور', 'صورة'];
  arabicFillers.forEach(w => { q = q.replace(new RegExp(w, 'g'), ''); });
  // Strip English filler words
  const englishFillers = ['images', 'pictures', 'photos', 'photo', 'image', 'full', 'detailed', 'complete'];
  englishFillers.forEach(w => { q = q.replace(new RegExp('\\b' + w + '\\b', 'g'), ''); });
  // Simple Arabic→English dictionary for common industrial terms
  const dict = {
    'معدات': 'equipment',
    'خط': 'production line',
    'انتاج': 'production',
    'بلاستيك': 'plastic',
    'مكينة': 'machine',
    'ماكينة': 'machine',
    'فيلم': 'film',
    'مصنع': 'factory',
    'مطعم': 'restaurant',
    'مقهى': 'cafe',
    'تجارة': 'retail',
    'صناعة': 'manufacturing',
    'خدمات': 'services',
    'تقني': 'technology',
    'صحة': 'healthcare',
    'تعليم': 'education',
    'لوجستيات': 'logistics',
    'عقارات': 'real estate',
    'ترفيه': 'entertainment',
  };
  let translated = q;
  Object.entries(dict).forEach(([ar, en]) => {
    translated = translated.replace(new RegExp(ar, 'g'), en);
  });
  translated = translated.replace(/\s+/g, ' ').trim();
  if (translated && translated !== rawQuery.toLowerCase().trim()) {
    console.log('Rule-based optimize:', rawQuery, '→', translated);
    return translated;
  }

  // Fallback to Gemini for complex queries
  const prompt = `You are an image search query optimizer.\n\n` +
    `User's raw query: "${rawQuery}"\n\n` +
    `Rules:\n` +
    `1. Remove filler words.\n` +
    `2. Translate Arabic words to English.\n` +
    `3. Keep only the most important 3-5 keywords.\n` +
    `4. Output ONLY a plain JSON object: { "q": "optimized query here" }\n` +
    `5. No markdown, no explanation, no extra text.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      console.warn('Gemini error:', data.error.message);
      return rawQuery;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.q && parsed.q.trim().length > 0) {
        console.log('Gemini optimized:', rawQuery, '→', parsed.q);
        return parsed.q.trim();
      }
    }
  } catch (e) {
    console.warn('Gemini failed:', e.message);
  }
  return rawQuery;
}

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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  let body = {};
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS });
  }

  const { query, count = 20, page = 1 } = body;
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400, headers: CORS_HEADERS });
  }

  // Optimize query for image search (translate + strip fillers)
  const optimizedQuery = await optimizeQueryForImages(query);

  // Fetch from multiple sources in parallel
  const sources = [];

  const pexelsPromise = PEXELS_KEY ? fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(optimizedQuery)}&per_page=${Math.ceil(count/2)}&page=${page}&orientation=all`,
    { headers: { Authorization: PEXELS_KEY } }
  ).then(r => r.json()).then(d => ({
    source: 'pexels',
    images: (d.photos || []).map(p => ({
      thumb: p.src?.medium || p.src?.small,
      full: p.src?.large || p.src?.original,
      alt: p.alt || optimizedQuery,
      photographer: p.photographer,
      url: p.url,
    }))
  })).catch(e => { console.warn('Pexels failed:', e.message); return { source: 'pexels', images: [] }; }) : Promise.resolve({ source: 'pexels', images: [] });

  const unsplashPromise = UNSPLASH_KEY ? fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(optimizedQuery)}&per_page=${Math.ceil(count/2)}`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
  ).then(r => r.json()).then(d => ({
    source: 'unsplash',
    images: (d.results || []).map(r => ({
      thumb: r.urls?.small,
      full: r.urls?.regular || r.urls?.full,
      alt: r.alt_description || optimizedQuery,
      photographer: r.user?.name,
      url: r.links?.html,
    }))
  })).catch(e => { console.warn('Unsplash failed:', e.message); return { source: 'unsplash', images: [] }; }) : Promise.resolve({ source: 'unsplash', images: [] });

  const [pexelsResult, unsplashResult] = await Promise.all([pexelsPromise, unsplashPromise]);

  // Merge and interleave results for variety
  const merged = [];
  const pexelsImages = pexelsResult.images;
  const unsplashImages = unsplashResult.images;
  const maxLen = Math.max(pexelsImages.length, unsplashImages.length);

  for (let i = 0; i < maxLen && merged.length < count; i++) {
    if (pexelsImages[i]) merged.push(pexelsImages[i]);
    if (unsplashImages[i]) merged.push(unsplashImages[i]);
  }

  // Trim to requested count
  const finalImages = merged.slice(0, count);

  if (finalImages.length > 0) {
    return new Response(JSON.stringify({
      success: true,
      sources: [pexelsResult.images.length > 0 ? 'pexels' : null, unsplashResult.images.length > 0 ? 'unsplash' : null].filter(Boolean),
      originalQuery: query,
      optimizedQuery: optimizedQuery,
      images: finalImages,
    }), { status: 200, headers: CORS_HEADERS });
  }

  // Ultimate fallback: return empty with instructions
  return new Response(JSON.stringify({
    success: false,
    error: 'No image search API configured',
    images: [],
    hint: 'Add PEXELS_API_KEY (free from pexels.com/api) to Vercel Environment Variables',
  }), { status: 200, headers: CORS_HEADERS });
}
