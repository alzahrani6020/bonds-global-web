/**
 * Bonds Global — Service Worker
 * Strategy: cache-first for static assets, network-first for pages.
 * Bump CACHE_VERSION when core assets change.
 */
const CACHE_VERSION = 'v2.75.0';
const STATIC_CACHE = `bonds-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `bonds-images-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/components.css',
  '/styles/select-reset.css',
  '/styles/utilities.css',
  '/styles/design-system.css',
  '/styles/home.css',
  '/styles/page-shared.css',
  '/styles/pricing.css',
  '/styles/services.css',
  '/styles/calculator-landing.css',
  '/styles/manufacturing.css',
  '/styles/distressed-recovery-study.css',
  '/components/universal-dropdown.css?v=2.51.8',
  '/components/universal-dropdown.js?v=2.51.8',
  '/components/universal-dropdown-init.js',
  '/components/ecc-icons.js',
  '/header-footer.css?v=2.53.0',
  '/script.js?v=4',
  '/site-layout.js?v=2.54.0',
  '/auth-guard.js',
  '/bonds-auth-2026.js?v=3',
  '/supabase-client.js',
  '/lib/formatting.js',
  '/assets/bonds-logo-2026-header.webp',
  '/assets/bonds-logo-2026.webp',
  '/assets/qr-bonds-global.png',
  '/manifest.json',
  '/calculator-wizard.html',
  '/en/calculator-wizard.html',
  '/styles/calculator-wizard.css',
  '/styles/case-studies.css',
  '/calculator-wizard.js',
  '/valuation/index.html',
  '/en/valuation/index.html',
  '/valuation/valuation.css',
  '/valuation/valuation-standards.js',
  '/valuation/depreciation-standards.js',
  '/valuation/depreciation-engine.js',
  '/valuation/depreciation-factors-client.js',
  '/valuation/market-intelligence-client.js',
  '/valuation/economic-life-client.js',
  '/valuation/valuation-engine.js',
  '/valuation/valuation-ui.js',
  '/valuation/valuation-locale.js',
  '/calculators/investment-center/investment-center.css',
  '/calculators/investment-center/investment-validator.js',
  '/calculators/investment-center/decision-intelligence.js',
  '/calculators/shared-geo.js?v=5',
  '/calculators/shared-platforms.js',
  '/calculators/shared-country-selector.js?v=3',
  '/v3/master-data/countries-governorates-cities.js',
  '/v3/master-data/global-countries.js',
  '/v3/master-data/arab-extended-countries.js',
  '/calculators/creditworthiness.html',
  '/en/calculators/creditworthiness.html',
  '/calculators/creditworthiness-engine.js',
  '/admin/financial-advisory/index.html',
  '/admin/financial-advisory/styles.css',
  '/admin/financial-advisory/service.js',
  '/admin/financial-advisory/app.js',
  '/admin/executive-dashboard/index.html',
  '/admin/executive-dashboard/styles.css',
  '/admin/executive-dashboard/service.js',
  '/admin/executive-dashboard/app.js',
  '/admin/city-intelligence/index.html',
  '/admin/city-intelligence/styles.css',
  '/admin/admin-embed.js',
  '/admin/economic-life.html',
  '/admin/depreciation-factors.html',
  '/admin/market-intelligence.html',
  '/admin/city-intelligence/service.js',
  '/admin/city-intelligence/app.js',
  '/admin/ai-business-advisor/index.html',
  '/admin/ai-business-advisor/styles.css',
  '/admin/ai-business-advisor/analysis-engine.js',
  '/admin/ai-business-advisor/service.js',
  '/admin/ai-business-advisor/app.js',
  '/admin/ai-business-advisor/redirect-standalone.js',
  '/admin/ai-business-advisor/guard.js',
  '/v3/project/project-command-center.css',
  '/v3/portfolio/portfolio-dashboard.css',
  '/en/v3/project/project-command-center.css',
  '/en/v3/portfolio/portfolio-dashboard.css',
  '/lib/enterprise/validation.js',
  '/lib/enterprise/rules-engine.js',
  '/lib/enterprise/cache.js',
  '/lib/enterprise/rbac.js',
  '/lib/enterprise/search.js',
  '/lib/enterprise/monitor.js',
  '/admin/data-quality-center/index.html',
  '/admin/data-quality-center/service.js',
  '/admin/data-quality-center/app.js',
  '/admin/global-search/index.html',
  '/admin/global-search/app.js',
  '/admin/admin-accessibility.js',
  '/assets/bonds-stamp.png',
  '/funding-readiness.html',
  '/for-banks.html',
  '/nps.html',
  '/advisors.html',
  '/advisor/index.html',
  '/en/funding-readiness.html',
  '/en/for-banks.html',
  '/en/nps.html',
  '/en/advisors.html',
  '/en/advisor/index.html',
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
