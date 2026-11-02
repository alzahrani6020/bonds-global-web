'use strict';

const { fetchUrl } = require('./web-acquisition');

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const GOOGLE_CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const MAX_RESULTS = 10;

function clean(value, max = 1200) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function braveKey() {
  return envValue('BONDS_BRAVE_SEARCH_API_KEY');
}

function bingKey() {
  return envValue('BONDS_BING_SEARCH_API_KEY');
}

function googleCseKey() {
  return envValue('GOOGLE_CSE_KEY');
}

function googleCseCx() {
  return envValue('GOOGLE_CSE_CX');
}

function configuredOfficialSearchProviders() {
  return Object.freeze({
    brave: Boolean(braveKey()),
    bing: Boolean(bingKey()),
    google_cse: Boolean(googleCseKey() && googleCseCx())
  });
}

function officialSearchConfigured() {
  const configured = configuredOfficialSearchProviders();
  return configured.brave || configured.bing || configured.google_cse;
}

function boundedLimit(value) {
  return Math.max(1, Math.min(Number(value || 5), MAX_RESULTS));
}

function arabicQuery(query) {
  return /[\u0600-\u06FF]/u.test(String(query || ''));
}

function parseBraveApi(payload, limit) {
  const rows = Array.isArray(payload?.web?.results) ? payload.web.results : [];
  const results = [];
  const seen = new Set();
  for (const row of rows) {
    if (results.length >= limit) break;
    const url = clean(row?.url, 2000);
    const title = clean(row?.title, 500);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title,
      url,
      snippet: clean(row?.description || row?.extra_snippets?.[0] || '', 1200),
      source: 'brave-api'
    });
  }
  return results;
}

function parseBingApi(payload, limit) {
  const rows = Array.isArray(payload?.webPages?.value) ? payload.webPages.value : [];
  const results = [];
  const seen = new Set();
  for (const row of rows) {
    if (results.length >= limit) break;
    const url = clean(row?.url, 2000);
    const title = clean(row?.name, 500);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title,
      url,
      snippet: clean(row?.snippet || '', 1200),
      source: 'bing-api'
    });
  }
  return results;
}

function parseGoogleCse(payload, limit) {
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  const results = [];
  const seen = new Set();
  for (const row of rows) {
    if (results.length >= limit) break;
    const url = clean(row?.link, 2000);
    const title = clean(row?.title, 500);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title,
      url,
      snippet: clean(row?.snippet || '', 1200),
      source: 'google-cse'
    });
  }
  return results;
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (_) {
    return null;
  }
}

function attemptRecord(provider, upstream, fetched, results, rawCount) {
  if (!fetched?.ok) {
    return {
      provider,
      upstream,
      code: 'SEARCH_UPSTREAM_FAILED',
      status_code: fetched?.evidence?.status_code || null,
      failure_class: fetched?.evidence?.failure_class || null,
      result_count: 0
    };
  }
  return {
    provider,
    upstream,
    code: results.length
      ? 'SEARCH_RESULTS_FOUND'
      : rawCount
        ? 'SEARCH_RESULTS_REJECTED'
        : 'SEARCH_NO_RESULTS',
    status_code: fetched.evidence?.status_code || null,
    raw_result_count: rawCount,
    result_count: results.length
  };
}

async function fetchJson(url, { headers, timeoutMs } = {}) {
  return fetchUrl(url, {
    timeoutMs: Math.max(3000, Math.min(Number(timeoutMs || 8000), 15000)),
    maxBytes: 700000,
    allowPrivateNetworks: false,
    userAgent: 'BONDS-Official-Search/1.0 (https://bonds-global.com)',
    headers: {
      accept: 'application/json',
      ...(headers || {})
    }
  });
}

async function searchBraveApi(query, options = {}) {
  const key = braveKey();
  if (!key) return null;
  const limit = boundedLimit(options.limit);
  const target = new URL(BRAVE_ENDPOINT);
  target.searchParams.set('q', String(query || '').slice(0, 400));
  target.searchParams.set('count', String(limit));
  if (arabicQuery(query)) {
    target.searchParams.set('search_lang', 'ar');
    target.searchParams.set('country', 'SA');
  }
  const fetched = await fetchJson(target.toString(), {
    timeoutMs: options.timeoutMs,
    headers: { 'X-Subscription-Token': key }
  });
  const payload = fetched.ok ? parseJson(fetched.text) : null;
  const raw = Array.isArray(payload?.web?.results) ? payload.web.results.length : 0;
  const results = payload ? parseBraveApi(payload, limit) : [];
  return {
    ok: results.length > 0,
    engine: 'brave-api',
    upstream: 'https://api.search.brave.com',
    results,
    attempt: attemptRecord('brave-api', 'https://api.search.brave.com', fetched, results, raw)
  };
}

async function searchBingApi(query, options = {}) {
  const key = bingKey();
  if (!key) return null;
  const limit = boundedLimit(options.limit);
  const endpoint = envValue('BONDS_BING_SEARCH_ENDPOINT') || BING_ENDPOINT;
  let target;
  try {
    target = new URL(endpoint);
  } catch (_) {
    return {
      ok: false,
      engine: 'bing-api',
      upstream: 'bing-api',
      results: [],
      attempt: {
        provider: 'bing-api',
        upstream: 'bing-api',
        code: 'SEARCH_UPSTREAM_INVALID',
        result_count: 0
      }
    };
  }
  target.searchParams.set('q', String(query || '').slice(0, 400));
  target.searchParams.set('count', String(limit));
  target.searchParams.set(
    'mkt',
    envValue('BONDS_BING_SEARCH_MKT') || (arabicQuery(query) ? 'ar-SA' : 'en-US')
  );
  const fetched = await fetchJson(target.toString(), {
    timeoutMs: options.timeoutMs,
    headers: { 'Ocp-Apim-Subscription-Key': key }
  });
  const payload = fetched.ok ? parseJson(fetched.text) : null;
  const raw = Array.isArray(payload?.webPages?.value) ? payload.webPages.value.length : 0;
  const results = payload ? parseBingApi(payload, limit) : [];
  return {
    ok: results.length > 0,
    engine: 'bing-api',
    upstream: target.origin,
    results,
    attempt: attemptRecord('bing-api', target.origin, fetched, results, raw)
  };
}

async function searchGoogleCse(query, options = {}) {
  const key = googleCseKey();
  const cx = googleCseCx();
  if (!key || !cx) return null;
  const limit = boundedLimit(options.limit);
  const target = new URL(GOOGLE_CSE_ENDPOINT);
  target.searchParams.set('key', key);
  target.searchParams.set('cx', cx);
  target.searchParams.set('q', String(query || '').slice(0, 400));
  target.searchParams.set('num', String(Math.min(limit, 10)));
  if (arabicQuery(query)) target.searchParams.set('lr', 'lang_ar');
  const fetched = await fetchJson(target.toString(), { timeoutMs: options.timeoutMs });
  const payload = fetched.ok ? parseJson(fetched.text) : null;
  const raw = Array.isArray(payload?.items) ? payload.items.length : 0;
  const results = payload ? parseGoogleCse(payload, limit) : [];
  return {
    ok: results.length > 0,
    engine: 'google-cse',
    upstream: 'https://www.googleapis.com',
    results,
    attempt: attemptRecord('google-cse', 'https://www.googleapis.com', fetched, results, raw)
  };
}

async function searchOfficialWeb(query, options = {}) {
  const disabled = new Set(
    (Array.isArray(options.disabledProviders) ? options.disabledProviders : [])
      .map(value => String(value || '').toLowerCase())
      .filter(Boolean)
  );
  const attempts = [];
  const runners = [
    ['brave-api', searchBraveApi],
    ['bing-api', searchBingApi],
    ['google-cse', searchGoogleCse]
  ];

  for (const [provider, runner] of runners) {
    if (disabled.has(provider)) {
      attempts.push({
        provider,
        upstream: provider,
        code: 'SEARCH_PROVIDER_CIRCUIT_OPEN',
        result_count: 0
      });
      continue;
    }
    const result = await runner(query, options);
    if (!result) continue;
    attempts.push(result.attempt);
    if (result.ok && result.results.length) {
      return {
        ok: true,
        engine: result.engine,
        upstream: result.upstream,
        results: result.results,
        attempts
      };
    }
  }

  return { ok: false, engine: null, upstream: null, results: [], attempts };
}

module.exports = {
  BRAVE_ENDPOINT,
  BING_ENDPOINT,
  GOOGLE_CSE_ENDPOINT,
  configuredOfficialSearchProviders,
  officialSearchConfigured,
  parseBraveApi,
  parseBingApi,
  parseGoogleCse,
  searchOfficialWeb
};
