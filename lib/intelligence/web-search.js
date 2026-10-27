'use strict';

const { fetchUrl } = require('./web-acquisition');
const { searchSearx } = require('./searx-search');

const DEFAULT_SEARCH_UPSTREAMS = Object.freeze([
  'https://www.bing.com/search?format=rss',
  'https://html.duckduckgo.com/html/',
  'https://lite.duckduckgo.com/lite/',
  'https://search.brave.com/search',
  'https://www.bing.com/search'
]);
const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 10;

function normalizeRequiredTerm(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterSearchResultsByRequiredTerms(results = [], requiredTerms = []) {
  const terms = [...new Set(
    (Array.isArray(requiredTerms) ? requiredTerms : [])
      .map(normalizeRequiredTerm)
      .filter(Boolean)
  )];
  const rows = Array.isArray(results) ? results : [];
  if (!terms.length) return rows;

  return rows.filter(row => {
    const text = normalizeRequiredTerm([
      row?.title,
      row?.snippet,
      row?.url
    ].filter(Boolean).join(' '));
    return terms.some(term => text.includes(term));
  });
}

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

function anchorAttributes(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match = re.exec(String(raw || '')))) {
    attrs[String(match[1]).toLowerCase()] = match[3];
  }
  return attrs;
}

function parseBraveHtml(html, limit = 5) {
  const source = String(html || '');
  const results = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRe.exec(source)) && results.length < limit) {
    const attrs = anchorAttributes(match[1]);
    const href = String(attrs.href || '').trim();
    if (!href) continue;

    let parsed;
    try {
      parsed = new URL(href, 'https://search.brave.com/');
    } catch (_) {
      continue;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) continue;
    const host = parsed.hostname.toLowerCase();
    if (host === 'search.brave.com' || host.endsWith('.brave.com')) continue;

    const title = decodeHtml(match[2]);
    if (!title || title.length < 3) continue;

    const trailing = source.slice(anchorRe.lastIndex, Math.min(source.length, anchorRe.lastIndex + 1800));
    const snippetMatch = trailing.match(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/i);

    results.push({
      title,
      url: parsed.toString(),
      snippet: decodeHtml(snippetMatch?.[1] || '')
    });
  }

  return results;
}

function decodeBingRedirectUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value, 'https://www.bing.com/');
  } catch (_) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!(host === 'bing.com' || host.endsWith('.bing.com'))) {
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  }

  const encoded = parsed.searchParams.get('u');
  if (!encoded) return null;

  const payload = encoded.startsWith('a1') ? encoded.slice(2) : encoded;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const target = new URL(decoded);
    return ['http:', 'https:'].includes(target.protocol) ? target.toString() : null;
  } catch (_) {
    return null;
  }
}

function parseBingHtml(html, limit = 5) {
  const source = String(html || '');
  const results = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRe.exec(source)) && results.length < limit) {
    const attrs = anchorAttributes(match[1]);
    const href = String(attrs.href || '').trim();
    if (!href) continue;

    const resolvedUrl = decodeBingRedirectUrl(href);
    if (!resolvedUrl) continue;

    let parsed;
    try {
      parsed = new URL(resolvedUrl);
    } catch (_) {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'bing.com' ||
      host.endsWith('.bing.com') ||
      host === 'microsoft.com' ||
      host.endsWith('.microsoft.com')
    ) continue;

    const title = decodeHtml(match[2]);
    if (!title || title.length < 3) continue;

    const trailing = source.slice(anchorRe.lastIndex, Math.min(source.length, anchorRe.lastIndex + 1800));
    const snippetMatch = trailing.match(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/i);

    results.push({
      title,
      url: parsed.toString(),
      snippet: decodeHtml(snippetMatch?.[1] || '')
    });
  }

  return results;
}


function decodeXmlText(value) {
  return decodeHtml(
    String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
  );
}

function parseBingRss(xml, limit = 5) {
  const source = String(xml || '');
  const results = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRe.exec(source)) && results.length < limit) {
    const item = match[1];

    const titleMatch = item.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = item.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = item.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);

    const title = decodeXmlText(titleMatch?.[1] || '');
    const href = decodeXmlText(linkMatch?.[1] || '');
    const snippet = decodeXmlText(descMatch?.[1] || '');

    if (!title || !href) continue;

    let parsed;
    try {
      parsed = new URL(href);
    } catch (_) {
      continue;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) continue;

    const host = parsed.hostname.toLowerCase();

    if (
      host === 'bing.com' ||
      host.endsWith('.bing.com') ||
      host === 'microsoft.com' ||
      host.endsWith('.microsoft.com')
    ) continue;

    results.push({
      title,
      url: parsed.toString(),
      snippet
    });
  }

  return results;
}

function recordAttempt(attempts, attempt) {
  attempts.push(attempt);
  try {
    console.info('[bonds-web-search]', JSON.stringify(attempt));
  } catch (_) {}
}

function parseDuckDuckGoHtml(html, limit = 5) {
  const source = String(html || '');
  const anchors = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRe.exec(source))) {
    const attrs = anchorAttributes(match[1]);
    const href = attrs.href;
    const className = attrs.class || '';
    const url = normalizeResultUrl(href);
    if (!url) continue;

    const isResultClass = /(?:^|\s)(?:result__a|result-link)(?:\s|$)/i.test(className);
    const isDdgRedirect = /duckduckgo\.com\/l\//i.test(String(href || '')) &&
      /(?:[?&])uddg=/i.test(String(href || ''));

    if (!isResultClass && !isDdgRedirect) continue;

    anchors.push({
      href,
      url,
      title: match[2],
      start: match.index,
      end: anchorRe.lastIndex
    });

    if (anchors.length >= Math.max(limit * 3, MAX_RESULTS * 2)) break;
  }

  const results = [];
  for (let index = 0; index < anchors.length && results.length < limit; index += 1) {
    const current = anchors[index];
    const nextStart = anchors[index + 1]?.start ?? source.length;
    const trailing = source.slice(current.end, nextStart);
    const snippetMatch = trailing.match(
      /<(?:a|div|td)[^>]+class=["'][^"']*(?:result__snippet|result-snippet)[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i
    );

    const title = decodeHtml(current.title);
    if (!title) continue;

    results.push({
      title,
      url: current.url,
      snippet: decodeHtml(snippetMatch?.[1] || '')
    });
  }

  return results;
}

function searchUpstreams() {
  const configured = String(process.env.BONDS_WEB_SEARCH_URL || '').trim();
  if (configured) return [configured];
  return [...DEFAULT_SEARCH_UPSTREAMS];
}

function providerForUpstream(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('searx')) return 'searxng';
  if (raw.includes('duckduckgo')) return 'duckduckgo';
  if (raw.includes('brave')) return 'brave';
  if (raw.includes('bing')) return 'bing';
  return raw || 'unknown';
}

function searchHeaders() {
  return {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ar,en-US;q=0.9,en;q=0.8',
    'cache-control': 'no-cache',
    'pragma': 'no-cache'
  };
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
  const attempts = [];

  const searxLanguage = options.language ||
    (/[\u0600-\u06FF]/u.test(q) ? 'ar' : 'en');

  const disabledProviders = new Set(
    (Array.isArray(options.disabledProviders) ? options.disabledProviders : [])
      .map(value => String(value || '').toLowerCase())
      .filter(Boolean)
  );

  let searx = null;
  let searxResults = [];
  if (!disabledProviders.has('searxng')) {
    searx = await searchSearx(q, {
      limit,
      language:searxLanguage,
      categories:options.categories || 'general',
      engines:options.engines || '',
      safeSearch:options.safeSearch ?? '1',
      timeRange:options.timeRange || '',
      timeoutMs:options.timeoutMs
    });

    const rawResults = Array.isArray(searx?.result?.results)
      ? searx.result.results
      : [];
    searxResults = filterSearchResultsByRequiredTerms(
      rawResults,
      options.requiredTerms
    );

    recordAttempt(attempts, {
      provider:'searxng',
      upstream:searx?.evidence?.upstream || 'searxng',
      code:searx?.ok && searxResults.length
        ? 'SEARX_RESULTS_FOUND'
        : searx?.ok && rawResults.length
          ? 'SEARCH_RESULTS_REJECTED'
          : searx?.error?.code || 'SEARX_NO_RESULTS',
      status_code:searx?.evidence?.fetch?.status_code || searx?.error?.status_code || null,
      failure_class:searx?.evidence?.fetch?.failure_class || searx?.error?.failure_class || null,
      raw_result_count:rawResults.length,
      result_count:searxResults.length
    });
  } else {
    recordAttempt(attempts, {
      provider:'searxng',
      upstream:'searxng',
      code:'SEARCH_PROVIDER_CIRCUIT_OPEN',
      result_count:0
    });
  }

  if (searx?.ok && searxResults.length) {
    return {
      ok:true,
      executed:true,
      result:{
        query:q,
        results:searxResults,
        result_count:searxResults.length
      },
      evidence:{
        search_upstream:searx.evidence?.upstream || 'searxng',
        search_engine:'searxng',
        attempts,
        fetch:searx.evidence?.fetch || null
      }
    };
  }

  const browserUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

  for (const upstream of searchUpstreams()) {
    const provider = providerForUpstream(upstream);
    if (disabledProviders.has(provider)) {
      recordAttempt(attempts, {
        provider,
        upstream,
        code:'SEARCH_PROVIDER_CIRCUIT_OPEN',
        result_count:0
      });
      continue;
    }

    let target;
    try {
      target = new URL(upstream);
      target.searchParams.set('q', q);
      if (target.hostname === 'html.duckduckgo.com') target.searchParams.set('kl', 'wt-wt');
      if (target.hostname === 'search.brave.com') target.searchParams.set('source', 'web');
      if (target.hostname === 'www.bing.com') target.searchParams.set('setlang', 'ar');
    } catch (_) {
      recordAttempt(attempts, { provider, upstream, code: 'SEARCH_UPSTREAM_INVALID' });
      continue;
    }

    const fetched = await fetchUrl(target.toString(), {
      timeoutMs: Math.max(3000, Math.min(Number(options.timeoutMs || 12000), 20000)),
      maxBytes: 1_000_000,
      allowPrivateNetworks: false,
      userAgent: browserUserAgent,
      headers: searchHeaders()
    });

    if (!fetched.ok) {
      recordAttempt(attempts, {
        provider,
        upstream: target.origin,
        code: 'SEARCH_UPSTREAM_FAILED',
        status_code: fetched.evidence?.status_code || null,
        failure_class: fetched.evidence?.failure_class || null
      });
      continue;
    }

    const isBingRss =
      target.hostname === 'www.bing.com' &&
      target.searchParams.get('format') === 'rss';

    const rawResults = isBingRss
      ? parseBingRss(fetched.text, limit)
      : target.hostname === 'search.brave.com'
        ? parseBraveHtml(fetched.text, limit)
        : target.hostname === 'www.bing.com'
          ? parseBingHtml(fetched.text, limit)
          : parseDuckDuckGoHtml(fetched.text, limit);
    const results = filterSearchResultsByRequiredTerms(
      rawResults,
      options.requiredTerms
    );
    recordAttempt(attempts, {
      provider,
      upstream: target.origin,
      code: results.length
        ? 'SEARCH_RESULTS_FOUND'
        : rawResults.length
          ? 'SEARCH_RESULTS_REJECTED'
          : 'SEARCH_NO_RESULTS',
      status_code: fetched.evidence?.status_code || null,
      raw_result_count: rawResults.length,
      result_count: results.length
    });

    if (results.length) {
      return {
        ok: true,
        executed: true,
        result: {
          query: q,
          results,
          result_count: results.length
        },
        evidence: {
          search_upstream: target.origin,
          attempts,
          fetch: fetched.evidence
        }
      };
    }
  }

  return {
    ok: false,
    executed: true,
    httpStatus: 502,
    error: {
      code: 'SEARCH_NO_RESULTS',
      attempts
    },
    evidence: {
      attempts
    },
    result: {
      query: q,
      results: [],
      result_count: 0
    }
  };
}

module.exports = {
  DEFAULT_SEARCH_UPSTREAMS,
  normalizeResultUrl,
  parseDuckDuckGoHtml,
  parseBraveHtml,
  decodeBingRedirectUrl,
  parseBingHtml,
  parseBingRss,
  normalizeRequiredTerm,
  filterSearchResultsByRequiredTerms,
  searchUpstreams,
  providerForUpstream,
  searchWeb
};
