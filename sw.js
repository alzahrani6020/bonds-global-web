/**
 * Bonds Global — Service Worker
 * Strategy: cache-first for static assets, network-first for pages.
 * Bump CACHE_VERSION when core assets change.
 */
const CACHE_VERSION = 'v2.4.0';
const STATIC_CACHE = `bonds-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `bonds-images-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/components.css',
  '/styles/utilities.css',
  '/header-footer.css',
  '/script.js',
  '/site-layout.js',
  '/auth-guard.js',
  '/supabase-client.js',
  '/assets/bonds-logo-2026-header.webp',
  '/assets/bonds-logo-2026.webp',
  '/manifest.json',
  '/calculators/creditworthiness.html',
  '/en/calculators/creditworthiness.html',
  '/calculators/creditworthiness-engine.js',
  '/admin/financial-advisory/index.html',
  '/admin/financial-advisory/styles.css',
  '/admin/financial-advisory/service.js',
  '/admin/financial-advisory/app.js',
  '/admin/city-intelligence/index.html',
  '/admin/city-intelligence/styles.css',
  '/admin/city-intelligence/service.js',
  '/admin/city-intelligence/app.js',
];

const MAX_IMAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bonds-') && !key.includes(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCoreAsset(request) {
  return CORE_ASSETS.includes(new URL(request.url).pathname);
}

function isImage(request) {
  const dest = request.destination;
  return dest === 'image' || /\.(webp|png|jpg|jpeg|svg|gif|ico)(\?.*)?$/i.test(request.url);
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200 && isSameOrigin(new URL(request.url))) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200 && isSameOrigin(new URL(request.url))) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    throw err;
  }
}

async function imageStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    const dateHeader = cached.headers.get('sw-fetched-date');
    const cachedDate = dateHeader ? new Date(dateHeader).getTime() : 0;
    const isFresh = Date.now() - cachedDate < MAX_IMAGE_AGE_MS;
    if (isFresh) return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200 && isSameOrigin(new URL(request.url))) {
      const headers = new Headers(networkResponse.headers);
      headers.append('sw-fetched-date', new Date().toUTCString());
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      });
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin and API requests
  if (request.method !== 'GET' || !isSameOrigin(url) || url.pathname.startsWith('/api/')) {
    return;
  }

  // Pages: network-first so updates are visible quickly
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Core static assets: cache-first for offline speed
  if (isCoreAsset(request) || request.destination === 'style' || request.destination === 'script' || request.destination === 'manifest') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Images: stale-while-revalidate
  if (isImage(request)) {
    event.respondWith(imageStrategy(request));
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(networkFirst(request));
});
