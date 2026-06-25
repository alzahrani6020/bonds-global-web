/**
 * Image Search API
 * Searches royalty-free images via Pexels.
 * Requires PEXELS_API_KEY environment variable.
 */

const { withRateLimit } = require('../lib/api/rate-limit');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      {
        headers: { Authorization: PEXELS_API_KEY }
      }
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

module.exports = withRateLimit('compute', handler);
