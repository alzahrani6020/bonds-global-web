'use strict';

const { fetchUrl } = require('./web-acquisition');

const DEFAULT_BONDS_SEARX_UPSTREAM = 'https://searx.tiekoetter.com';
const MAX_QUERY_LENGTH = 2000;
const MAX_RESULTS = 20;

function clean(value, max = 2000) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

function configuredSearxUpstream() {
  return String(process.env.BONDS_SEARX_UPSTREAM || DEFAULT_BONDS_SEARX_UPSTREAM)
    .trim()
    .replace(/\/$/, '');
}

function configuredSearxEngines() {
  return String(process.env.BONDS_SEARX_ENGINES || '')
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .join(',');
}

function parseSearxJson(text, limit = 5) {
  let payload;
  try {
    payload = typeof text === 'string' ? JSON.parse(text) : text;
  } catch (_) {
    return { ok:false, code:'SEARX_INVALID_JSON', results:[] };
  }

  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const results = [];
  const seen = new Set();
  const bounded = Math.max(1, Math.min(Number(limit || 5), MAX_RESULTS));

  for (const row of rows) {
    if (results.length >= bounded) break;
    const url = normalizeHttpUrl(row?.url);
    if (!url || seen.has(url)) continue;
    const title = clean(row?.title, 500);
    if (!title) continue;

    seen.add(url);
    results.push({
      title,
      url,
      snippet:clean(row?.content || row?.snippet || '', 1200),
      engine:clean(row?.engine || '', 120) || null,
      engines:Array.isArray(row?.engines)
        ? row.engines.map(value => clean(value, 120)).filter(Boolean)
        : [],
      score:Number.isFinite(Number(row?.score)) ? Number(row.score) : null,
      category:clean(row?.category || '', 120) || null,
      published_date:row?.publishedDate || row?.published_date || null,
      source:'searxng'
    });
  }

  return {
    ok:true,
    code:results.length ? 'SEARX_RESULTS_FOUND' : 'SEARX_NO_RESULTS',
    results,
    raw_result_count:rows.length
  };
}

async function searchSearx(query, options = {}) {
  const q = clean(query, MAX_QUERY_LENGTH + 1);
  if (!q) {
    return { ok:false, executed:false, error:{ code:'SEARX_QUERY_REQUIRED' }, result:{ results:[] } };
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return { ok:false, executed:false, error:{ code:'SEARX_QUERY_TOO_LONG' }, result:{ results:[] } };
  }
  if (String(process.env.BONDS_SEARX_OFF || '').trim() === '1') {
    return { ok:false, executed:false, error:{ code:'SEARX_DISABLED' }, result:{ results:[] } };
  }

  const upstream = configuredSearxUpstream();
  let target;
  try {
    target = new URL('/search', upstream + '/');
  } catch (_) {
    return { ok:false, executed:false, error:{ code:'SEARX_UPSTREAM_INVALID' }, result:{ results:[] } };
  }

  const language = clean(options.language || 'ar', 32) || 'ar';
  const categories = clean(options.categories || 'general', 120) || 'general';
  const safeSearch = ['0','1','2'].includes(String(options.safeSearch ?? '1'))
    ? String(options.safeSearch ?? '1')
    : '1';

  target.searchParams.set('q', q);
  target.searchParams.set('format', 'json');
  target.searchParams.set('language', language);
  target.searchParams.set('categories', categories);
  target.searchParams.set('safesearch', safeSearch);

  const engines = clean(options.engines || configuredSearxEngines(), 500);
  if (engines) target.searchParams.set('engines', engines);

  const timeRange = clean(options.timeRange || '', 24);
  if (['day','week','month','year'].includes(timeRange)) {
    target.searchParams.set('time_range', timeRange);
  }

  const fetched = await fetchUrl(target.toString(), {
    timeoutMs:Math.max(3000, Math.min(Number(options.timeoutMs || 12000), 20000)),
    maxBytes:1_500_000,
    allowPrivateNetworks:false,
    userAgent:'BONDS-SearX-Search/1.0',
    headers:{
      accept:'application/json, text/plain;q=0.9,*/*;q=0.8',
      'accept-language':'ar,en-US;q=0.9,en;q=0.8',
      'cache-control':'no-cache'
    }
  });

  if (!fetched.ok) {
    return {
      ok:false,
      executed:true,
      error:{
        code:'SEARX_UPSTREAM_FAILED',
        status_code:fetched.evidence?.status_code || null,
        failure_class:fetched.evidence?.failure_class || null
      },
      evidence:{ upstream:target.origin, fetch:fetched.evidence },
      result:{ query:q, results:[], result_count:0 }
    };
  }

  const parsed = parseSearxJson(fetched.text, options.limit || 5);
  if (!parsed.ok || !parsed.results.length) {
    return {
      ok:false,
      executed:true,
      error:{ code:parsed.code || 'SEARX_NO_RESULTS' },
      evidence:{
        upstream:target.origin,
        fetch:fetched.evidence,
        raw_result_count:parsed.raw_result_count || 0
      },
      result:{ query:q, results:[], result_count:0 }
    };
  }

  return {
    ok:true,
    executed:true,
    result:{
      query:q,
      results:parsed.results,
      result_count:parsed.results.length
    },
    evidence:{
      upstream:target.origin,
      engine:'searxng',
      fetch:fetched.evidence,
      raw_result_count:parsed.raw_result_count
    }
  };
}

module.exports = {
  DEFAULT_BONDS_SEARX_UPSTREAM,
  configuredSearxUpstream,
  configuredSearxEngines,
  parseSearxJson,
  searchSearx
};
