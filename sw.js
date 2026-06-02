const CACHE_NAME = 'bonds-v34';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/services.html',
  '/pricing.html',
  '/about.html',
  '/calculator.html',
  '/contact.html',
  '/faq.html',
  '/privacy.html',
  '/styles.css',
  '/script.js',
  '/assets/site-logo.webp',
  '/assets/bonds-logo-opt.jpg',
  '/assets/bonds-mark.svg',
  '/manifest.json',
  '/calculators/shared-calculators.css',
  '/calculators/shared-utils.js',
  '/calculators/shared-ui.js',
  '/calculators/shared-export.js',
  '/calculators/shared-charts.js',
  '/calculators/shared-nav.js',
  '/calculators/calc-functions.js',
  '/calculators/db-client.js',
  '/calculators/db-client-auto.js',
  '/calculators/country-platforms-data.js',
  '/calculators/cash-flow.html',
  '/calculators/pricing.html',
  '/calculators/loan.html',
  '/calculators/loan-worker.js',
  '/calculators/restaurant.html',
  '/calculators/dish-margin.html',
  '/calculators/feasibility.html',
  '/calculators/invoice-analyzer.html',
  '/calculators/feasibility-template.html',
  '/calculators/menu-engineering.html',
  '/calculators/menu-engineering-simple.html',
  '/en/index.html',
  '/en/calculators/pricing.html',
  '/en/calculators/cash-flow.html',
  '/en/calculators/loan.html',
  '/en/calculators/restaurant.html',
  '/en/calculators/dish-margin.html',
  '/en/calculators/feasibility.html',
  '/en/calculators/invoice-analyzer.html',
  '/en/calculators/feasibility-template.html',
  '/en/calculators/menu-engineering.html',
  '/en/calculators/menu-engineering-simple.html',
  '/sectors/manufacturing.html',
  '/blog/index.html',
  '/blog/cash-flow-mistakes.html',
  '/blog/pricing-strategy.html',
  '/blog/break-even-explained.html',
  '/blog/tax-zakat-sme.html',
  '/blog/financial-kpis.html',
  '/methodology.html',
  '/reports/validation.html',
  '/reports/en/validation.html',
  '/reports/calculator-validation.xlsx'
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-While-Revalidate for CDN libraries
function cacheFirstWithRefresh(request) {
  return caches.match(request).then(cached => {
    const fetchPromise = fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return networkResponse;
    }).catch(() => cached);
    return cached || fetchPromise;
  });
}

// Network-first for HTML pages (always fresh content)
function networkFirst(request) {
  return fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      const clone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
    }
    return networkResponse;
  }).catch(() => caches.match(request));
}

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip cross-origin requests except CDN assets
  if (url.origin !== self.location.origin && !CDN_ASSETS.some(cdn => url.href === cdn)) {
    return;
  }

  // Navigation fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // CDN libraries: stale-while-revalidate
  if (CDN_ASSETS.some(cdn => url.href === cdn)) {
    e.respondWith(cacheFirstWithRefresh(request));
    return;
  }

  // HTML pages: network-first for freshness
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Static assets (CSS, JS, images, fonts): cache-first with network fallback
  e.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
    )
  );
});
