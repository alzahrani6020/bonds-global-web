/**
 * Reference Data API
 *
 * Unified endpoint for:
 *   - /api/depreciation-factors
 *   - /api/economic-life
 *   - /api/market-intelligence
 *
 * Merged into one Vercel Serverless Function to stay within the Hobby plan limit.
 */

const getSupabase = require('../lib/api/supabase');
const { verifyAdminOrEditor } = require('../lib/api/admin-auth');
const { sendEmail } = require('../lib/api/email');
const { setAllowedOrigin } = require('../lib/api/cors');

const ALLOWED_ROLES = ['admin', 'editor'];
const OUTLOOKS = ['positive', 'neutral', 'negative'];

const SOURCE_FETCH_TIMEOUT_MS = 15000;
const SOURCE_CONCURRENCY = 5;
const UPSERT_CONCURRENCY = 10;
const SOURCE_START_BUDGET_MS = 60000;
const TOTAL_TIME_BUDGET_MS = 80000;
const REPORT_TIMEZONE = 'Asia/Riyadh';
const REFRESH_CRON_INTERVAL_HOURS = 3;

function cors(res, req) {
  setAllowedOrigin(res, req);
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function formatRiyadhTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function nextRunRiyadh(now) {
  const next = new Date(now.getTime());
  next.setUTCMinutes(0, 0, 0);
  do {
    next.setUTCHours(next.getUTCHours() + 1);
  } while (next.getUTCHours() % REFRESH_CRON_INTERVAL_HOURS !== 0);
  return next;
}

function getReportRecipients() {
  const raw = process.env.REPORT_EMAILS || process.env.MANAGER_EMAIL || process.env.ADMIN_EMAIL || '';
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

function buildRefreshReport(result, fatalError) {
  const now = new Date();
  const timeStr = formatRiyadhTime(now);
  const nextStr = formatRiyadhTime(nextRunRiyadh(now));

  let status;
  if (fatalError) {
    status = { key: 'failure', ar: 'فشل', en: 'FAILURE', icon: '\u274c', color: '#dc2626' };
  } else if (result.failed === 0 && result.skipped === 0) {
    status = { key: 'success', ar: 'نجاح', en: 'SUCCESS', icon: '\u2705', color: '#16a34a' };
  } else if (result.updated > 0) {
    status = { key: 'partial', ar: 'نجاح جزئي', en: 'PARTIAL', icon: '\u26a0\ufe0f', color: '#d97706' };
  } else {
    status = { key: 'failure', ar: 'فشل', en: 'FAILURE', icon: '\u274c', color: '#dc2626' };
  }

  const updated = result ? result.updated : 0;
  const failed = result ? result.failed : 0;
  const skipped = result ? result.skipped : 0;
  const total = result ? result.total : 0;
  const elapsedSec = result && result.elapsedMs ? (result.elapsedMs / 1000).toFixed(1) : '0';
  const errors = result && Array.isArray(result.errors) ? result.errors : (fatalError ? [fatalError] : []);

  const subject = `${status.icon} Bonds Market Intelligence \u2014 ${status.en}: ${updated}/${total} (${timeStr} KSA)`;

  const text = [
    `Bonds Market Intelligence Refresh \u2014 ${status.en}`,
    `\u0627\u0644\u062d\u0627\u0644\u0629: ${status.ar} | Status: ${status.en}`,
    `Updated: ${updated} | Failed: ${failed} | Skipped: ${skipped} | Total: ${total}`,
    `Duration: ${elapsedSec}s | Time: ${timeStr} KSA | Next run: ${nextStr} KSA`,
    errors.length ? `Errors:\n- ${errors.join('\n- ')}` : ''
  ].filter(Boolean).join('\n');

  const statCell = (labelAr, labelEn, value, color) => `
    <td style="padding:12px 8px;text-align:center;background:#0f172a;border-radius:8px;">
      <div style="font-size:22px;font-weight:800;color:${color || '#f0c96a'};">${value}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${labelAr}<br/>${labelEn}</div>
    </td>`;

  const errorsHtml = errors.length ? `
    <div style="margin-top:16px;padding:12px;background:#1e293b;border-radius:8px;border-right:3px solid #dc2626;">
      <div style="font-weight:700;color:#fca5a5;margin-bottom:8px;">\u0627\u0644\u0623\u062e\u0637\u0627\u0621 / Errors (${errors.length})</div>
      <ul style="margin:0;padding:0 0 0 18px;color:#cbd5e1;font-size:12px;line-height:1.7;">
        ${errors.slice(0, 10).map(e => `<li>${escapeHtml(e)}</li>`).join('')}
      </ul>
      ${errors.length > 10 ? `<div style="color:#94a3b8;font-size:11px;margin-top:6px;">+ ${errors.length - 10} more</div>` : ''}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#10182d,#0a0f1a);border:1px solid rgba(212,168,83,0.3);border-radius:14px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(212,168,83,0.2);">
        <div style="font-size:18px;font-weight:800;color:#f0c96a;">Bonds Global \u2014 Market Intelligence</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a \u2022 Automated Refresh Report</div>
      </div>
      <div style="padding:20px 24px;">
        <div style="display:inline-block;padding:6px 16px;border-radius:999px;background:${status.color}22;color:${status.color};font-weight:800;font-size:14px;border:1px solid ${status.color}55;">
          ${status.icon} ${status.ar} \u2014 ${status.en}
        </div>
        <table role="presentation" width="100%" cellspacing="6" style="margin-top:18px;border-collapse:separate;">
          <tr>
            ${statCell('\u062a\u0645 \u0627\u0644\u062a\u062d\u062f\u064a\u062b', 'Updated', updated, '#16a34a')}
            ${statCell('\u0641\u0634\u0644', 'Failed', failed, failed ? '#dc2626' : '#94a3b8')}
            ${statCell('\u062a\u0645 \u062a\u062e\u0637\u064a\u0647', 'Skipped', skipped, skipped ? '#d97706' : '#94a3b8')}
            ${statCell('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a', 'Total', total)}
          </tr>
        </table>
        ${errorsHtml}
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,168,83,0.15);font-size:12px;color:#94a3b8;line-height:2;">
          <div>\u23f1\ufe0f \u0627\u0644\u0645\u062f\u0629: <b style="color:#e8ecf4;">${elapsedSec} \u062b\u0627\u0646\u064a\u0629</b> \u200f(Duration: ${elapsedSec}s)</div>
          <div>\ud83d\uddd3 \u0648\u0642\u062a \u0627\u0644\u062a\u0646\u0641\u064a\u0630: <b style="color:#e8ecf4;">${timeStr}</b> \u0628\u062a\u0648\u0642\u064a\u062a \u0627\u0644\u0631\u064a\u0627\u0636</div>
          <div>\u23ed\ufe0f \u0627\u0644\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0642\u0627\u062f\u0645: <b style="color:#e8ecf4;">${nextStr}</b> \u0628\u062a\u0648\u0642\u064a\u062a \u0627\u0644\u0631\u064a\u0627\u0636 \u200f(Next run)</div>
        </div>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#475569;margin-top:14px;">
      Bonds Global \u00b7 Automated report \u2014 do not reply \u00b7 \u062a\u0642\u0631\u064a\u0631 \u0622\u0644\u064a \u2014 \u0644\u0627 \u062a\u0631\u062f \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064a\u062f
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

async function sendRefreshReport(result, fatalError) {
  const to = getReportRecipients();
  if (!to.length) return { sent: false, reason: 'no_recipients_configured' };
  const { subject, text, html } = buildRefreshReport(result, fatalError);
  try {
    await sendEmail({ to, subject, text, html });
    return { sent: true, to: to.length };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

function isAllowedSourceUrl(urlStr) {
  try {
    const url = new URL(String(urlStr));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') return false;
    const parts = host.split('.').map(h => Number(h));
    if (parts.length === 4 && parts.every(n => Number.isFinite(n) && n >= 0 && n <= 255)) {
      const [a, b, c] = parts;
      if (a === 127 || a === 0 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224) return false;
    }
    if (host.startsWith('fc00:') || host.startsWith('fe80:')) return false;
    const allowed = String(process.env.MARKET_SOURCE_HOSTS || '')
      .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.some(rule => host === rule || host.endsWith('.' + rule))) return false;
    return true;
  } catch (err) {
    return false;
  }
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
      if (!isAllowedSourceUrl(src.url)) {
        throw new Error('Source URL is not on the allow-list or is private');
      }
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

/* ---------- Depreciation Factors ---------- */
async function handleDepreciationFactors(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { assetClass } = req.query || {};
    let query = supabase
      .from('depreciation_factors')
      .select('*')
      .order('asset_class', { ascending: true });

    if (assetClass) {
      query = query.eq('asset_class', assetClass);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
    const auth = await verifyAdminOrEditor(req, supabase);
    if (!auth.authorized) {
      const status = auth.reason === 'forbidden' ? 403 : 401;
      return res.status(status).json({ success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
    }

    const body = req.body || {};
    const { assetClass, nameAr, nameEn, factors, methods, notes } = body;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const payload = {
      asset_class: assetClass,
      name_ar: nameAr || null,
      name_en: nameEn || null,
      factors: factors || {},
      methods: methods || {},
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('depreciation_factors')
      .upsert(payload, { onConflict: 'asset_class' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

/* ---------- Economic Life ---------- */
async function handleEconomicLife(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { assetClass } = req.query || {};
    let query = supabase
      .from('economic_life_database')
      .select('*')
      .order('asset_class', { ascending: true });

    if (assetClass) {
      query = query.eq('asset_class', assetClass);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
    const auth = await verifyAdminOrEditor(req, supabase);
    if (!auth.authorized) {
      const status = auth.reason === 'forbidden' ? 403 : 401;
      return res.status(status).json({ success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
    }

    const body = req.body || {};
    const assetClass = body.assetClass || body.asset_class;
    const nameAr = body.nameAr || body.name_ar;
    const nameEn = body.nameEn || body.name_en;
    const economicLifeYears = body.economicLifeYears || body.economic_life_years;
    const accountingLifeYears = body.accountingLifeYears || body.accounting_life_years;
    const technicalLifeYears = body.technicalLifeYears || body.technical_life_years;
    const designLifeYears = body.designLifeYears || body.design_life_years;
    const operationalLifeYears = body.operationalLifeYears || body.operational_life_years;
    const minLifeYears = body.minLifeYears || body.min_life_years;
    const maxLifeYears = body.maxLifeYears || body.max_life_years;
    const source = body.source;
    const notes = body.notes;

    if (!assetClass) {
      return res.status(400).json({ success: false, error: 'assetClass is required' });
    }

    const upsertData = {
      asset_class: assetClass,
      name_ar: nameAr,
      name_en: nameEn,
      economic_life_years: Number(economicLifeYears) || 0,
      accounting_life_years: Number(accountingLifeYears) || 0,
      technical_life_years: Number(technicalLifeYears) || 0,
      design_life_years: Number(designLifeYears) || 0,
      operational_life_years: Number(operationalLifeYears) || 0,
      min_life_years: Number(minLifeYears) || 0,
      max_life_years: Number(maxLifeYears) || 0,
      source: source || 'BONDS Valuation Standards',
      notes: notes || '',
      updated_at: new Date().toISOString()
    };
    if (body.updated_by) upsertData.updated_by = body.updated_by;

    const { data, error } = await supabase
      .from('economic_life_database')
      .upsert(upsertData, { onConflict: 'asset_class' })
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

/* ---------- Market Intelligence ---------- */
async function handleMarketIntelligence(req, res) {
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
      auth = await verifyAdminOrEditor(req, supabase);
      if (!auth.authorized) {
        const status = auth.reason === 'forbidden' ? 403 : 401;
        return res.status(status).json({ success: false, error: auth.reason === 'forbidden' ? 'Forbidden' : 'Unauthorized' });
      }
    }

    if (isRefresh) {
      try {
        const result = await refreshSources(supabase);
        const email = cronOk ? await sendRefreshReport(result) : { sent: false, reason: 'manual_trigger' };
        return res.status(200).json({ success: true, ...result, email });
      } catch (err) {
        if (cronOk) await sendRefreshReport(null, err.message);
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
}

/* ---------- Main Handler ---------- */
module.exports = async function handler(req, res) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = req.query?.__route;

  if (route === 'depreciation-factors') return handleDepreciationFactors(req, res);
  if (route === 'economic-life') return handleEconomicLife(req, res);
  if (route === 'market-intelligence') return handleMarketIntelligence(req, res);

  return res.status(404).json({ success: false, error: 'Not found' });
};
