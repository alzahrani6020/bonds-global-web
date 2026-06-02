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

  const { query, count = 8 } = body;
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400, headers: CORS_HEADERS });
  }

  // Primary: Pexels
  if (PEXELS_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=all`,
        { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      if (data.photos?.length) {
        return new Response(JSON.stringify({
          success: true,
          source: 'pexels',
          images: data.photos.map(p => ({
            thumb: p.src?.medium || p.src?.small,
            full: p.src?.large || p.src?.original,
            alt: p.alt || query,
            photographer: p.photographer,
            url: p.url,
          })),
        }), { status: 200, headers: CORS_HEADERS });
      }
    } catch (e) {
      console.warn('Pexels failed:', e.message);
    }
  }

  // Fallback: Unsplash
  if (UNSPLASH_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` }, signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      if (data.results?.length) {
        return new Response(JSON.stringify({
          success: true,
          source: 'unsplash',
          images: data.results.map(r => ({
            thumb: r.urls?.small,
            full: r.urls?.regular || r.urls?.full,
            alt: r.alt_description || query,
            photographer: r.user?.name,
            url: r.links?.html,
          })),
        }), { status: 200, headers: CORS_HEADERS });
      }
    } catch (e) {
      console.warn('Unsplash failed:', e.message);
    }
  }

  // Ultimate fallback: return empty with instructions
  return new Response(JSON.stringify({
    success: false,
    error: 'No image search API configured',
    images: [],
    hint: 'Add PEXELS_API_KEY (free from pexels.com/api) to Vercel Environment Variables',
  }), { status: 200, headers: CORS_HEADERS });
}
