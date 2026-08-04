/**
 * Water Factory Market Data API
 * GET /water-factory-data?country=SA
 * Returns editable market/regulatory/competitor data for the water factory calculator.
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

async function waterFactoryDataRouter(req, res, path, supabase) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const countryCode = (url.searchParams.get('country') || 'SA').toUpperCase();

    if (req.method === 'GET' && path === '/water-factory-data') {
      const { data, error } = await supabase
        .from('water_factory_market_data')
        .select('country_code, country_name_ar, country_name_en, data, meta, updated_at')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[water-factory-data]', error.message);
        return sendJson(res, 500, { error: 'Failed to load market data' });
      }

      return sendJson(res, 200, { country: countryCode, record: data });
    }

    if (req.method === 'POST' && path === '/water-factory-data') {
      // Admin/service-role updates only — protected by x-admin-token or auth
      const adminToken = req.headers['x-admin-token'] || '';
      const expectedToken = process.env.ADMIN_API_TOKEN || '';
      if (!expectedToken || adminToken !== expectedToken) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      const body = await parseBody(req);
      const { country_code, country_name_ar, country_name_en, data, meta } = body;
      if (!country_code) {
        return sendJson(res, 400, { error: 'country_code is required' });
      }

      const upsertPayload = {
        country_code: String(country_code).toUpperCase(),
        country_name_ar: country_name_ar || null,
        country_name_en: country_name_en || null,
        data: data || {},
        meta: meta || {}
      };

      const { data: saved, error: saveError } = await supabase
        .from('water_factory_market_data')
        .upsert(upsertPayload, { onConflict: 'country_code' })
        .select()
        .single();

      if (saveError) {
        console.error('[water-factory-data] save error:', saveError.message);
        return sendJson(res, 500, { error: 'Failed to save market data' });
      }

      return sendJson(res, 200, { saved });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[water-factory-data] router error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

module.exports = { waterFactoryDataRouter };
