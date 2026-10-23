'use strict';

const { fetchUrl } = require('./web-acquisition');

const DEFAULT_SEARCH_UPSTREAM = 'https://html.duckduckgo.com/html/';
const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 10;

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeResultUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value, 'https://duckduckgo.com/');
    const redirectTarget = parsed.searchParams.get('uddg');
    if (redirectTarget) {
      const decoded = decodeURIComponent(redirectTarget);
      const target = new URL(decoded);
      return ['http:', 'https:'].includes(target.protocol) ? target.toString() : null;
    }
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch (_) {
    return null;
  }
}

function parseDuckDuckGoHtml(html, limit = 5) {
  const source = String(html || '');
  const results = [];
  const blockRe = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*result|$)/gi;
  let block;

  while ((block = blockRe.exec(source)) && results.length < limit) {
    const chunk = block[1];
    const link = chunk.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = normalizeResultUrl(link[1]);
    if (!url) continue;
    const snippetMatch = chunk.match(/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    results.push({
      title: decodeHtml(link[2]),
      url,
      snippet: decodeHtml(snippetMatch?.[1] || '')
    });
  }

  if (!results.length) {
    const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRe.exec(source)) && results.length < limit) {
      const url = normalizeResultUrl(match[1]);
      if (!url) continue;
      results.push({ title: decodeHtml(match[2]), url, snippet: '' });
    }
  }

  return results;
}

async function searchWeb(query, options = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return { ok: false, executed: false, httpStatus: 400, error: { code: 'SEARCH_QUERY_REQUIRED' } };
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return { ok: false, executed: false, httpStatus: 400, error: { code: 'SEARCH_QUERY_TOO_LONG' } };
  }

  const limit = Math.max(1, Math.min(Number(options.limit || 5), MAX_RESULTS));
  const upstream = String(process.env.BONDS_WEB_SEARCH_URL || DEFAULT_SEARCH_UPSTREAM).trim();
  let target;
  try {
    target = new URL(upstream);
    target.searchParams.set('q', q);
    target.searchParams.set('kl', 'wt-wt');
  } catch (_) {
    return { ok: false, executed: false, httpStatus: 503, error: { code: 'SEARCH_UPSTREAM_INVALID' } };
  }

  const fetched = await fetchUrl(target.toString(), {
    timeoutMs: Math.max(3000, Math.min(Number(options.timeoutMs || 12000), 20000)),
    maxBytes: 1_000_000,
    allowPrivateNetworks: false,
    userAgent: 'Bonds-Search/1.0'
  });

  if (!fetched.ok) {
    return {
      ok: false,
      executed: fetched.executed,
      httpStatus: 502,
      error: { code: 'SEARCH_UPSTREAM_FAILED', failure_class: fetched.evidence?.failure_class || null },
      evidence: { fetch: fetched.evidence }
    };
  }

  const results = parseDuckDuckGoHtml(fetched.text, limit);
  return {
    ok: results.length > 0,
    executed: true,
    result: {
      query: q,
      results,
      result_count: results.length
    },
    evidence: {
      search_upstream: target.origin,
      fetch: fetched.evidence
    },
    ...(results.length ? {} : { error: { code: 'SEARCH_NO_RESULTS' } })
  };
}

module.exports = {
  DEFAULT_SEARCH_UPSTREAM,
  parseDuckDuckGoHtml,
  searchWeb
};
