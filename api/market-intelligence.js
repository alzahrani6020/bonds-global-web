/**
 * Market Intelligence API
 *
 * GET  /api/market-intelligence
 *      ?assetClass=&country=&region=&city=&sector=&history=1&limit=
 * POST /api/market-intelligence
 *      Body: upsert payload (admin/editor)
 *      Body: { action: 'refresh' } (admin/editor or CRON_SECRET)
 */
const getSupabase = require('../lib/api/supabase');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');

const ALLOWED_ROLES = ['admin', 'editor']; // kept for backward compatibility
const OUTLOOKS = ['positive', 'neutral', 'negative'];

// Refresh must finish before Cloudflare's ~100s proxy timeout (HTTP 524).
const SOURCE_FETCH_TIMEOUT_MS = 15000;
const SOURCE_CONCURRENCY = 5;
const UPSERT_CONCURRENCY = 10;
const SOURCE_START_BUDGET_MS = 60000;
const TOTAL_TIME_BUDGET_MS = 80000;

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toSnake(str) {
  return str.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function getPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => {
    if (acc === undefined || acc === null) return undefined;
    if (part.endsWith(']')) {
      const [key, idxStr] = part.split('[');
      let node = key ? acc[key] : acc;
      const idx = Number(idxStr.replace(']', ''));
      return Array.isArray(node) ? node[idx] : undefined;
    }
    if (Array.isArray(acc) && /^\d+$/.test(part)) {
      return acc[Number(part)];
    }
    return acc[part];
  }, obj);
}

async function checkAuth(req, supabase) {
  return verifyAdminOrEditor(req, supabase);
}

async function refreshSources(supabase) {
  const { data: sources, error } = await supabase
    .from('market_data_sources')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;

  const now = new Date().toISOString();
  const startedAt = Date.now();
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  await mapLimit(sources || [], SOURCE_CONCURRENCY, async (src) => {
    if (Date.now() - startedAt > SOURCE_START_BUDGET_MS) {
      skipped++;
      return;
    }
    try {
      const res = await fetch(src.url, {
        method: src.method || 'GET',
        headers: src.headers || {},
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let records = getPath(json, src.record_path);
      if (!Array.isArray(records)) records = records ? [records] : [];

      const mapping = src.field_mapping || {};
      const outcomes = await mapLimit(records, UPSERT_CONCURRENCY, async (rec) => {
        if (Date.now() - startedAt > TOTAL_TIME_BUDGET_MS) return false;
        const payload = {
          asset_class: src.asset_class,
          country: src.country || '',
          region: src.region || '',
          city: src.city || '',
          sector: src.sector || '',
          source: src.name,
          recorded_at: now.split('T')[0]
        };
        for (const [destKey, srcPath] of Object.entries(mapping)) {
          const raw = getPath(rec, String(srcPath));
          const col = toSnake(destKey);
          if (['asset_class', 'country', 'region', 'city', 'sector', 'source', 'outlook', 'notes', 'recorded_at'].includes(col)) {
            payload[col] = raw !== undefined && raw !== null ? String(raw) : payload[col];
          } else if (raw !== undefined && raw !== null && raw !== '') {
            payload[col] = safeNum(raw);
          }
        }
        const { error: upsertError } = await supabase
          .from('market_data')
          .upsert(payload, { onConflict: 'asset_class, country, region, city, sector' });
        if (upsertError) throw upsertError;
        return true;
      });
      updated += outcomes.filter(Boolean).length;

      await supabase
        .from('market_data_sources')
        .update({ last_fetched_at: now, last_status: 'success', last_error: null })
        .eq('id', src.id);
    } catch (err) {
      failed++;
      const msg = err.name === 'TimeoutError' ? `timeout after ${SOURCE_FETCH_TIMEOUT_MS}ms` : err.message;
      errors.push(`${src.name}: ${msg}`);
      await supabase
        .from('market_data_sources')
        .update({ last_fetched_at: now, last_status: 'error', last_error: msg })
        .eq('id', src.id);
    }
  });

  return { updated, failed, skipped, errors, total: (sources || []).length, elapsedMs: Date.now() - startedAt };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const {
      assetClass,
      country,
      region,
      city,
      sector,
      history,
      limit
    } = req.query || {};

    const isHistory = String(history || '').toLowerCase() === 'true' || history === '1';
    const table = isHistory ? 'market_data_history' : 'market_data';
    let query = supabase
      .from(table)
      .select('*')
      .order(isHistory ? 'created_at' : 'updated_at', { ascending: false });

    if (assetClass) query = query.eq('asset_class', assetClass);
    if (country) query = query.eq('country', country);
    if (region) query = query.eq('region', region);
    if (city) query = query.eq('city', city);
    if (sector) query = query.eq('sector', sector);

    const maxLimit = isHistory ? 500 : 1000;
    const parsedLimit = Math.min(maxLimit, Math.max(1, safeNum(limit, isHistory ? 50 : 1000)));
    query = query.limit(parsedLimit);

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const isRefresh = body.action === 'refresh';

    const cronSecret = req.query.cronSecret || body.cronSecret;
    const cronOk = process.env.CRON_SECRET && cronSecret && cronSecret === process.env.CRON_SECRET;

    let auth = { authorized: false };
    if (!cronOk) {
      auth = await checkAuth(req, supabase);
      if (!auth.authorized) {
        const status = auth.reason === 'forbidden' ? 403 : 401;
        return res.status(status).json({ success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
      }
    }

    if (isRefresh) {
      try {
        const result = await refreshSources(supabase);
        return res.status(200).json({ success: true, ...result });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    const assetClass = body.assetClass || body.asset_class;
    const country = body.country;
    const region = body.region;
    const city = body.city;
    const sector = body.sector;
    const averageSellingPrice = body.averageSellingPrice || body.average_selling_price;
    const averageBuyingPrice = body.averageBuyingPrice || body.average_buying_price;
    const transactionCount = body.transactionCount || body.transaction_count;
    const supplyIndex = body.supplyIndex || body.supply_index;
    const demandIndex = body.demandIndex || body.demand_index;
    const competitorCount = body.competitorCount || body.competitor_count;
    const averageSaleSpeedDays = body.averageSaleSpeedDays || body.average_sale_speed_days;
    const inflationRate = body.inflationRate || body.inflation_rate;
    const interestRate = body.interestRate || body.interest_rate;
    const economicGrowthRate = body.economicGrowthRate || body.economic_growth_rate;
    const riskScore = body.riskScore || body.risk_score;
    const outlook = body.outlook;
    const confidence = body.confidence;
    const dataQualityScore = body.dataQualityScore || body.data_quality_score;
    const notes = body.notes;
    const source = body.source;
    const recordedAt = body.recordedAt || body.recorded_at;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const normalizedOutlook = String(outlook || 'neutral').toLowerCase();
    if (!OUTLOOKS.includes(normalizedOutlook)) {
      return res.status(400).json({ success: false, error: `outlook must be one of ${OUTLOOKS.join(', ')}` });
    }

    const payload = {
      asset_class: assetClass,
      country: String(country || ''),
      region: String(region || ''),
      city: String(city || ''),
      sector: String(sector || ''),
      average_selling_price: safeNum(averageSellingPrice),
      average_buying_price: safeNum(averageBuyingPrice),
      transaction_count: safeNum(transactionCount),
      supply_index: safeNum(supplyIndex),
      demand_index: safeNum(demandIndex),
      competitor_count: safeNum(competitorCount),
      average_sale_speed_days: safeNum(averageSaleSpeedDays),
      inflation_rate: safeNum(inflationRate),
      interest_rate: safeNum(interestRate),
      economic_growth_rate: safeNum(economicGrowthRate),
      risk_score: Math.min(10, Math.max(0, safeNum(riskScore, 5))),
      outlook: normalizedOutlook,
      confidence: Math.min(1, Math.max(0, safeNum(confidence, 0.5))),
      data_quality_score: Math.min(100, Math.max(0, safeNum(dataQualityScore, 50))),
      notes: notes ? String(notes) : '',
      source: source ? String(source) : null,
      recorded_at: recordedAt || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('market_data')
      .upsert(payload, { onConflict: 'asset_class, country, region, city, sector' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
