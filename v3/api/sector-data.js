/**
 * Generic Sector Market Data API
 * GET  /api/v3/sector-data?sector=<code>&country=<code>
 * POST /api/v3/sector-data  (admin token required)
 */

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

function sanitizeCode(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

async function sectorDataRouter(req, res, path, supabase) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && path === '/sector-data') {
      const sectorCode = sanitizeCode(url.searchParams.get('sector') || '');
      const countryCode = sanitizeCode(url.searchParams.get('country') || 'SA');

      if (!sectorCode) {
        return sendJson(res, 400, { error: 'sector query parameter is required' });
      }

      const { data, error } = await supabase
        .from('sector_market_data')
        .select('sector_code, country_code, country_name_ar, country_name_en, data, meta, updated_at')
        .eq('sector_code', sectorCode)
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[sector-data] get error:', error.message);
        return sendJson(res, 500, { error: 'Failed to load sector market data' });
      }

      return sendJson(res, 200, { sector: sectorCode, country: countryCode, record: data });
    }

    if (req.method === 'POST' && path === '/sector-data') {
      const adminToken = req.headers['x-admin-token'] || '';
      const expectedToken = process.env.ADMIN_API_TOKEN || '';
      if (!expectedToken || adminToken !== expectedToken) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      const body = await parseBody(req);
      const sector_code = sanitizeCode(body.sector_code);
      const country_code = sanitizeCode(body.country_code);

      if (!sector_code || !country_code) {
        return sendJson(res, 400, { error: 'sector_code and country_code are required' });
      }

      const upsertPayload = {
        sector_code,
        country_code,
        country_name_ar: body.country_name_ar || null,
        country_name_en: body.country_name_en || null,
        data: body.data && typeof body.data === 'object' ? body.data : {},
        meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
        is_active: body.is_active !== false
      };

      const { data: saved, error: saveError } = await supabase
        .from('sector_market_data')
        .upsert(upsertPayload, { onConflict: 'sector_code,country_code' })
        .select()
        .single();

      if (saveError) {
        console.error('[sector-data] save error:', saveError.message);
        return sendJson(res, 500, { error: 'Failed to save sector market data' });
      }

      return sendJson(res, 200, { saved });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[sector-data] router error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

module.exports = { sectorDataRouter };
