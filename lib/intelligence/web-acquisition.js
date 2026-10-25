'use strict';

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const SAFE_SCHEMES = new Set(['http:', 'https:']);
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = 'Bonds-Intelligence-WebAcquisition/1.0';

class AcquisitionBlocked extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'AcquisitionBlocked';
    this.code = code;
  }
}

function mappedIpv4Address(address) {
  const value = String(address || '').toLowerCase();
  if (!value.startsWith('::ffff:')) return null;
  const tail = value.slice('::ffff:'.length);
  if (net.isIP(tail) === 4) return tail;
  const parts = tail.split(':');
  if (parts.length !== 2 || !parts.every(part => /^[0-9a-f]{1,4}$/.test(part))) return null;
  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);
  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255
  ].join('.');
}

function isForbiddenIp(address) {
  const mapped = mappedIpv4Address(address);
  if (mapped) return isForbiddenIp(mapped);

  const version = net.isIP(address);
  if (!version) return true;
  if (version === 4) {
    const p = address.split('.').map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 192 && p[1] === 0 && p[2] === 0 && p[3] !== 9 && p[3] !== 10) return true;
    if (p[0] === 192 && p[1] === 0 && p[2] === 2) return true;
    if (p[0] === 192 && p[1] === 88 && p[2] === 99) return true;
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
    if (p[0] === 198 && p[1] === 51 && p[2] === 100) return true;
    if (p[0] === 203 && p[1] === 0 && p[2] === 113) return true;
    if (p[0] >= 224) return true;
    return false;
  }

  const v = address.toLowerCase();
  const firstHextet = parseInt(v.split(':')[0] || '0', 16);
  const linkLocal = Number.isFinite(firstHextet) && (firstHextet & 0xffc0) === 0xfe80;
  const uniqueLocal = Number.isFinite(firstHextet) && (firstHextet & 0xfe00) === 0xfc00;
  const multicast = Number.isFinite(firstHextet) && (firstHextet & 0xff00) === 0xff00;
  return v === '::' ||
    v === '::1' ||
    v.startsWith('::') ||
    linkLocal ||
    uniqueLocal ||
    multicast ||
    v.startsWith('2001:db8:');
}

async function preparePublicTarget(rawUrl, { allowPrivateNetworks = false } = {}) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch (_) { throw new AcquisitionBlocked('INVALID_URL'); }
  if (!SAFE_SCHEMES.has(parsed.protocol)) throw new AcquisitionBlocked('UNSUPPORTED_SCHEME');
  if (!parsed.hostname) throw new AcquisitionBlocked('MISSING_HOST');
  if (parsed.username || parsed.password) throw new AcquisitionBlocked('URL_CREDENTIALS_FORBIDDEN');

  let addresses;
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new AcquisitionBlocked('DNS_RESOLUTION_FAILED', err.message);
  }
  if (!addresses.length) throw new AcquisitionBlocked('DNS_RESOLUTION_EMPTY');
  if (!allowPrivateNetworks && addresses.some(item => isForbiddenIp(item.address))) {
    throw new AcquisitionBlocked('PRIVATE_OR_RESERVED_DESTINATION');
  }

  return { url: parsed.toString(), parsed, addresses };
}

async function validatePublicUrl(rawUrl, options = {}) {
  return (await preparePublicTarget(rawUrl, options)).url;
}

async function readResponseBody(response, maxBytes) {
  const chunks = [];
  let size = 0;
  let truncated = false;
  for await (const chunk of response.body) {
    const buf = Buffer.from(chunk);
    const remaining = maxBytes - size;
    if (remaining <= 0) { truncated = true; break; }
    chunks.push(buf.length > remaining ? buf.subarray(0, remaining) : buf);
    size += Math.min(buf.length, remaining);
    if (buf.length > remaining) { truncated = true; break; }
  }
  if (truncated && typeof response.body?.destroy === 'function' && !response.body.destroyed) {
    response.body.destroy();
  }
  return { body: Buffer.concat(chunks), truncated };
}

function selectedHeaders(headers) {
  const allowed = ['content-type', 'content-length', 'etag', 'last-modified', 'location', 'retry-after', 'x-request-id'];
  return Object.fromEntries(allowed.map(k => [k, headers.get(k)]).filter(([, v]) => v !== null));
}

function responseHeaders(headers = {}) {
  return {
    get(name) {
      const value = headers[String(name || '').toLowerCase()];
      if (Array.isArray(value)) return value.join(', ');
      return value == null ? null : String(value);
    }
  };
}

function acquisitionTimeoutError() {
  const error = new Error('Acquisition deadline exceeded');
  error.name = 'AbortError';
  error.code = 'ACQUISITION_TIMEOUT';
  return error;
}

function requestPinnedTarget(target, { deadlineAt, headers }) {
  const transport = target.parsed.protocol === 'https:' ? require('https') : require('http');

  const attempt = (address) => new Promise((resolve, reject) => {
    const remainingMs = Number(deadlineAt) - Date.now();
    if (!(remainingMs > 0)) {
      reject(acquisitionTimeoutError());
      return;
    }

    let timer = null;
    let responseBody = null;
    let headersResolved = false;
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const req = transport.request({
      protocol: target.parsed.protocol,
      hostname: target.parsed.hostname,
      port: target.parsed.port || undefined,
      path: target.parsed.pathname + target.parsed.search,
      method: 'GET',
      headers,
      servername: target.parsed.protocol === 'https:' ? target.parsed.hostname : undefined,
      family: address.family,
      autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => {
        callback(null, address.address, address.family);
      }
    }, res => {
      responseBody = res;
      headersResolved = true;
      resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        headers: responseHeaders(res.headers),
        body: res,
        cleanup
      });
    });

    timer = setTimeout(() => {
      const error = acquisitionTimeoutError();
      if (responseBody && typeof responseBody.destroy === 'function' && !responseBody.destroyed) {
        responseBody.destroy(error);
      }
      if (typeof req.destroy === 'function' && !req.destroyed) {
        req.destroy(error);
      }
    }, Math.max(1, remainingMs));

    req.once('error', error => {
      if (!headersResolved) {
        cleanup();
        reject(error);
      }
    });
    req.end();
  });

  return target.addresses.reduce(
    (promise, address) => promise.catch(() => {
      if (Date.now() >= deadlineAt) throw acquisitionTimeoutError();
      return attempt(address);
    }),
    Promise.reject(new Error('No validated address available'))
  );
}

async function fetchUrl(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_BYTES);
  const maxRedirects = Number(options.maxRedirects ?? 5);
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let target;
  try {
    target = await preparePublicTarget(url, options);
  } catch (err) {
    return {
      ok: false, executed: false, body: Buffer.alloc(0), text: '',
      evidence: { url, final_url: null, status_code: null, content_type: null, content_length: 0,
        content_hash: null, elapsed_ms: Date.now() - startedAt, failure_class: 'POLICY_BLOCK',
        blocked_reason: err.code || err.message }
    };
  }

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (Date.now() >= deadline) {
      return {
        ok: false, executed: true, body: Buffer.alloc(0), text: '',
        evidence: { url, final_url: target?.url || null, status_code: null, content_type: null, content_length: 0,
          content_hash: null, elapsed_ms: Date.now() - startedAt, failure_class: 'TIMEOUT' }
      };
    }

    let response;
    try {
      response = await requestPinnedTarget(target, {
        deadlineAt: deadline,
        headers: {
          'user-agent': options.userAgent || DEFAULT_USER_AGENT,
          'accept': '*/*',
          ...(options.headers || {})
        }
      });
    } catch (err) {
      return {
        ok: false, executed: true, body: Buffer.alloc(0), text: '',
        evidence: { url, final_url: target?.url || null, status_code: null, content_type: null, content_length: 0,
          content_hash: null, elapsed_ms: Date.now() - startedAt,
          failure_class: err.name === 'AbortError' ? 'TIMEOUT' : 'CONNECT_OR_DNS_FAILURE' }
      };
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (typeof response.body?.resume === 'function') response.body.resume();
      if (typeof response.cleanup === 'function') response.cleanup();
      if (!location) break;
      if (redirects >= maxRedirects) {
        return { ok: false, executed: true, body: Buffer.alloc(0), text: '',
          evidence: { url, final_url: target?.url || null, status_code: response.status, content_type: null,
            content_length: 0, content_hash: null, elapsed_ms: Date.now() - startedAt,
            failure_class: 'TOO_MANY_REDIRECTS' } };
      }
      try {
        target = await preparePublicTarget(new URL(location, target.url).toString(), options);
      } catch (err) {
        return { ok: false, executed: true, body: Buffer.alloc(0), text: '',
          evidence: { url, final_url: target?.url || null, status_code: response.status, content_type: null,
            content_length: 0, content_hash: null, elapsed_ms: Date.now() - startedAt,
            failure_class: 'REDIRECT_BLOCKED', blocked_reason: err.code || err.message } };
      }
      continue;
    }

    let body;
    let truncated;
    try {
      ({ body, truncated } = await readResponseBody(response, maxBytes));
    } catch (err) {
      if (typeof response.cleanup === 'function') response.cleanup();
      return {
        ok: false, executed: true, body: Buffer.alloc(0), text: '',
        evidence: { url, final_url: target?.url || null, status_code: response.status, content_type: null,
          content_length: 0, content_hash: null, elapsed_ms: Date.now() - startedAt,
          failure_class: err.name === 'AbortError' || err.code === 'ABORT_ERR' || err.code === 'ACQUISITION_TIMEOUT'
            ? 'TIMEOUT'
            : 'READ_FAILURE' }
      };
    }
    if (typeof response.cleanup === 'function') response.cleanup();
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() || null;
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    return {
      ok: response.ok,
      executed: true,
      body,
      text: body.toString('utf8'),
      evidence: {
        url,
        final_url: target?.url || null,
        status_code: response.status,
        content_type: contentType,
        content_length: body.length,
        content_hash: hash,
        elapsed_ms: Date.now() - startedAt,
        headers: selectedHeaders(response.headers),
        failure_class: truncated ? 'BODY_TRUNCATED' : (response.ok ? null : `HTTP_${response.status}`)
      }
    };
  }

  return { ok: false, executed: true, body: Buffer.alloc(0), text: '',
    evidence: { url, final_url: target?.url || null, status_code: null, content_type: null,
      content_length: 0, content_hash: null, elapsed_ms: Date.now() - startedAt,
      failure_class: 'REDIRECT_FAILURE' } };
}

function canonicalizeUrl(rawUrl, baseUrl = null) {
  try {
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    if (!SAFE_SCHEMES.has(parsed.protocol)) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /(?:href|src)\s*=\s*["']([^"'#]+)["']/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const url = canonicalizeUrl(match[1], baseUrl);
    if (url) links.add(url);
  }
  return [...links];
}

function extractPaginationLinks(html, baseUrl) {
  const source = String(html || '');
  const links = new Set();
  const relNext = /<(?:a|link)\b([^>]*\brel\s*=\s*["'][^"']*\bnext\b[^"']*["'][^>]*)>/gi;
  const hrefRe = /\bhref\s*=\s*["']([^"']+)["']/i;
  let match;
  while ((match = relNext.exec(source))) {
    const href = match[1].match(hrefRe)?.[1];
    const url = canonicalizeUrl(href, baseUrl);
    if (url) links.add(url);
  }

  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  while ((match = anchorRe.exec(source))) {
    const label = String(match[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:raquo|rsaquo|gt);/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!/^(?:next|next page|older|more|التالي|التالية|التاليه|أقدم|المزيد|›|»|>)$/iu.test(label)) continue;
    const href = match[1].match(hrefRe)?.[1];
    const url = canonicalizeUrl(href, baseUrl);
    if (url) links.add(url);
  }
  return [...links];
}

function extractSitemapUrls(xml, baseUrl) {
  const urls = [];
  const seen = new Set();
  const re = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let match;
  while ((match = re.exec(String(xml || '')))) {
    const value = String(match[1] || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
      .replace(/&amp;/g, '&')
      .trim();
    const url = canonicalizeUrl(value, baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function extractRobotsSitemaps(text, origin) {
  const urls = [];
  const seen = new Set();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!/^sitemap\s*:/i.test(line)) continue;
    const value = line.slice(line.indexOf(':') + 1).trim();
    const url = canonicalizeUrl(value, origin);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function sameSite(seedHost, candidateHost, allowSubdomains = false) {
  if (candidateHost === seedHost) return true;
  return allowSubdomains && candidateHost.endsWith('.' + seedHost);
}

function parseRobots(text, userAgent = DEFAULT_USER_AGENT) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      current = { agents: [value.toLowerCase()], allow: [], disallow: [] };
      groups.push(current);
      continue;
    }
    if (!current) continue;
    if (key === 'allow') current.allow.push(value);
    if (key === 'disallow') current.disallow.push(value);
  }
  const ua = String(userAgent || '').toLowerCase();
  const applicable = groups.filter(g => g.agents.some(a => a === '*' || (a && ua.includes(a))));
  return {
    canFetch(url) {
      const path = new URL(url).pathname || '/';
      let best = { length: -1, allow: true };
      for (const group of applicable) {
        for (const rule of group.allow) {
          if (rule && path.startsWith(rule) && rule.length > best.length) best = { length: rule.length, allow: true };
        }
        for (const rule of group.disallow) {
          if (rule && path.startsWith(rule) && rule.length > best.length) best = { length: rule.length, allow: false };
        }
      }
      return best.allow;
    }
  };
}

function normalizeCheckpoint(checkpoint = {}) {
  const visited = Array.isArray(checkpoint.visited) ? checkpoint.visited : [];
  const pending = Array.isArray(checkpoint.pending) ? checkpoint.pending : [];
  return {
    visited: visited.map(url => canonicalizeUrl(url)).filter(Boolean).slice(0, 5000),
    pending: pending.map(item => {
      if (typeof item === 'string') return { url: canonicalizeUrl(item), depth: 0, priority: 0, source: 'checkpoint' };
      if (!item || typeof item !== 'object') return null;
      return {
        url: canonicalizeUrl(item.url),
        depth: Math.max(0, Math.min(Number(item.depth || 0), 10)),
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
        source: String(item.source || 'checkpoint').slice(0, 40)
      };
    }).filter(item => item?.url).slice(0, 5000)
  };
}

function enqueue(queue, queued, item, maxFrontier) {
  const url = canonicalizeUrl(item?.url);
  if (!url || queued.has(url) || queue.length >= maxFrontier) return false;
  queued.add(url);
  queue.push({
    url,
    depth: Math.max(0, Number(item.depth || 0)),
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
    source: String(item.source || 'link').slice(0, 40)
  });
  return true;
}

function nextFrontierItem(queue) {
  if (!queue.length) return null;
  queue.sort((a, b) =>
    Number(b.priority || 0) - Number(a.priority || 0) ||
    Number(a.depth || 0) - Number(b.depth || 0) ||
    String(a.url).localeCompare(String(b.url))
  );
  return queue.shift() || null;
}

async function crawl(request = {}) {
  const rawSeeds = [...new Set((request.seedUrls || request.seed_urls || []).filter(Boolean))];
  if (!rawSeeds.length && request.url) rawSeeds.push(request.url);
  const seedUrls = rawSeeds.map(url => canonicalizeUrl(url)).filter(Boolean);
  if (!seedUrls.length) throw new Error('seedUrls or url is required');

  const maxPages = Math.max(1, Math.min(Number(request.maxPages || request.max_pages || 10), 100));
  const maxDepth = Math.max(0, Math.min(Number(request.maxDepth || request.max_depth || 2), 5));
  const maxFrontier = Math.max(maxPages, Math.min(Number(request.maxFrontier || request.max_frontier || maxPages * 20), 5000));
  const maxSitemapDocuments = Math.max(0, Math.min(Number(request.maxSitemapDocuments || request.max_sitemap_documents || 4), 20));
  const maxSitemapUrls = Math.max(0, Math.min(Number(request.maxSitemapUrls || request.max_sitemap_urls || maxFrontier), maxFrontier));
  const perHostPageBudget = Math.max(1, Math.min(Number(request.perHostPageBudget || request.per_host_page_budget || maxPages), maxPages));
  const allowSubdomains = Boolean(request.allowSubdomains || request.allow_subdomains);
  const seedHosts = new Set(seedUrls.map(u => new URL(u).hostname.toLowerCase()));
  const checkpoint = normalizeCheckpoint(request.checkpoint || request.resume_checkpoint || {});
  const visited = new Set(checkpoint.visited);
  const queued = new Set();
  const queue = [];
  for (const url of seedUrls) enqueue(queue, queued, { url, depth:0, priority:100, source:'seed' }, maxFrontier);
  for (const item of checkpoint.pending) enqueue(queue, queued, item, maxFrontier);

  const pages = [];
  const failures = [];
  const blocked = [];
  const duplicates = [];
  const hostCounts = new Map();
  const robotsByOrigin = new Map();
  const contentHashOwner = new Map();
  const previousHashes = request.previousContentHashes && typeof request.previousContentHashes === 'object'
    ? request.previousContentHashes
    : request.previous_content_hashes && typeof request.previous_content_hashes === 'object'
      ? request.previous_content_hashes
      : {};
  const obeyRobots = request.obeyRobots !== false && request.obey_robots !== false;
  const discoverSitemaps = request.discoverSitemaps !== false && request.discover_sitemaps !== false;
  const discoverPagination = request.discoverPagination !== false && request.discover_pagination !== false;
  const userAgent = request.userAgent || request.user_agent || DEFAULT_USER_AGENT;
  let sitemapDiscoveredCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  function inScope(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return [...seedHosts].some(seed => sameSite(seed, host, allowSubdomains));
    } catch (_) {
      return false;
    }
  }

  async function loadRobots(url) {
    const parsed = new URL(url);
    const origin = parsed.origin;
    if (robotsByOrigin.has(origin)) return robotsByOrigin.get(origin);

    const robotsUrl = new URL('/robots.txt', origin).toString();
    const robotsResult = await fetchUrl(robotsUrl, {
      timeoutMs: request.timeoutMs || request.timeout_seconds * 1000,
      maxBytes: 512_000,
      allowPrivateNetworks: Boolean(request.allowPrivateNetworks || request.allow_private_networks),
      userAgent
    });
    const state = {
      policy: robotsResult.ok ? parseRobots(robotsResult.text, userAgent) : { canFetch: () => true },
      sitemaps: robotsResult.ok ? extractRobotsSitemaps(robotsResult.text, origin) : []
    };
    robotsByOrigin.set(origin, state);
    return state;
  }

  async function robotsAllowed(url) {
    if (!obeyRobots) return true;
    return (await loadRobots(url)).policy.canFetch(url);
  }

  async function seedFromSitemaps() {
    if (!discoverSitemaps || maxSitemapDocuments === 0 || maxSitemapUrls === 0) return;
    const sitemapQueue = [];
    const sitemapSeen = new Set();

    for (const seed of seedUrls) {
      const origin = new URL(seed).origin;
      const robots = await loadRobots(seed);
      const declared = robots.sitemaps.length ? robots.sitemaps : [new URL('/sitemap.xml', origin).toString()];
      for (const url of declared) {
        const canonical = canonicalizeUrl(url);
        if (canonical && !sitemapSeen.has(canonical)) {
          sitemapSeen.add(canonical);
          sitemapQueue.push(canonical);
        }
      }
    }

    let documents = 0;
    while (sitemapQueue.length && documents < maxSitemapDocuments && sitemapDiscoveredCount < maxSitemapUrls) {
      const sitemapUrl = sitemapQueue.shift();
      if (!sitemapUrl || !inScope(sitemapUrl)) continue;
      const sitemap = await fetchUrl(sitemapUrl, {
        timeoutMs: request.timeoutMs || request.timeout_seconds * 1000,
        maxBytes: Math.min(Number(request.maxSitemapBytes || request.max_sitemap_bytes || 2_000_000), 5_000_000),
        allowPrivateNetworks: Boolean(request.allowPrivateNetworks || request.allow_private_networks),
        userAgent
      });
      documents += 1;
      if (!sitemap.ok) continue;

      for (const url of extractSitemapUrls(sitemap.text, sitemapUrl)) {
        if (!inScope(url)) continue;
        if (/\.xml(?:$|[?#])/i.test(url) && sitemapQueue.length < maxSitemapDocuments * 4) {
          if (!sitemapSeen.has(url)) {
            sitemapSeen.add(url);
            sitemapQueue.push(url);
          }
          continue;
        }
        if (sitemapDiscoveredCount >= maxSitemapUrls) break;
        if (enqueue(queue, queued, { url, depth:0, priority:70, source:'sitemap' }, maxFrontier)) {
          sitemapDiscoveredCount += 1;
        }
      }
    }
  }

  await seedFromSitemaps();

  while (queue.length && pages.length + failures.length + blocked.length < maxPages) {
    const item = nextFrontierItem(queue);
    if (!item || visited.has(item.url) || item.depth > maxDepth) continue;
    queued.delete(item.url);
    if (!inScope(item.url)) continue;

    const host = new URL(item.url).hostname.toLowerCase();
    if ((hostCounts.get(host) || 0) >= perHostPageBudget) continue;
    if (!(await robotsAllowed(item.url))) {
      visited.add(item.url);
      blocked.push({ url: item.url, reason: 'ROBOTS_DISALLOW' });
      continue;
    }

    visited.add(item.url);
    hostCounts.set(host, (hostCounts.get(host) || 0) + 1);

    const result = await fetchUrl(item.url, {
      timeoutMs: request.timeoutMs || request.timeout_seconds * 1000,
      maxBytes: request.maxBytesPerPage || request.max_bytes_per_page,
      allowPrivateNetworks: Boolean(request.allowPrivateNetworks || request.allow_private_networks),
      userAgent
    });
    if (!result.ok) {
      failures.push({ url: item.url, source:item.source, evidence: result.evidence });
      continue;
    }

    const canonicalFinal = canonicalizeUrl(result.evidence.final_url || item.url) || item.url;
    const duplicateOf = result.evidence.content_hash
      ? contentHashOwner.get(result.evidence.content_hash) || null
      : null;
    if (duplicateOf) {
      duplicates.push({
        url: canonicalFinal,
        duplicate_of: duplicateOf,
        content_hash: result.evidence.content_hash
      });
    } else if (result.evidence.content_hash) {
      contentHashOwner.set(result.evidence.content_hash, canonicalFinal);
    }

    const previousHash = previousHashes[canonicalFinal] || previousHashes[item.url] || null;
    const changeState = previousHash
      ? previousHash === result.evidence.content_hash ? 'unchanged' : 'changed'
      : 'new';
    if (changeState === 'changed') changedCount += 1;
    if (changeState === 'unchanged') unchangedCount += 1;

    pages.push({
      url: canonicalFinal,
      requested_url: item.url,
      depth: item.depth,
      source: item.source,
      change_state: changeState,
      duplicate_of: duplicateOf,
      text: result.text,
      body: result.body,
      evidence: result.evidence
    });

    if (item.depth < maxDepth && /html/i.test(result.evidence.content_type || '')) {
      if (discoverPagination) {
        for (const link of extractPaginationLinks(result.text, canonicalFinal)) {
          if (inScope(link) && !visited.has(link)) {
            enqueue(queue, queued, {
              url:link,
              depth:item.depth + 1,
              priority:60 - item.depth,
              source:'pagination'
            }, maxFrontier);
          }
        }
      }

      for (const link of extractLinks(result.text, canonicalFinal)) {
        if (!inScope(link) || visited.has(link)) continue;
        enqueue(queue, queued, {
          url:link,
          depth:item.depth + 1,
          priority:10 - item.depth,
          source:'link'
        }, maxFrontier);
      }
    }
  }

  const pending = queue
    .filter(item => !visited.has(item.url))
    .slice(0, maxFrontier)
    .map(item => ({
      url:item.url,
      depth:item.depth,
      priority:item.priority,
      source:item.source
    }));
  const discovered = new Set([...visited, ...pending.map(x => x.url)]);

  return {
    executed: true,
    pages,
    failures,
    blocked,
    duplicates,
    checkpoint: {
      version:1,
      visited:[...visited].slice(0, 5000),
      pending
    },
    coverage: {
      discovered_count: discovered.size,
      visited_count: visited.size,
      successful_count: pages.length,
      failed_count: failures.length,
      blocked_count: blocked.length,
      duplicate_count: duplicates.length,
      sitemap_discovered_count: sitemapDiscoveredCount,
      changed_count: changedCount,
      unchanged_count: unchangedCount,
      pending_count: pending.length,
      url_coverage: discovered.size ? visited.size / discovered.size : 0,
      unknowns: [
        ...(pending.length ? ['FRONTIER_REMAINS'] : []),
        ...(blocked.length ? ['BLOCKED_BY_ROBOTS'] : []),
        ...(!pages.length ? ['NO_SUCCESSFUL_ACQUISITION'] : [])
      ]
    }
  };
}

module.exports = {
  AcquisitionBlocked,
  isForbiddenIp,
  validatePublicUrl,
  fetchUrl,
  canonicalizeUrl,
  extractLinks,
  extractPaginationLinks,
  extractSitemapUrls,
  extractRobotsSitemaps,
  parseRobots,
  normalizeCheckpoint,
  crawl
};
