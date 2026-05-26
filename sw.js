const CACHE_NAME = 'bonds-v3';
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
  '/assets/bonds-logo-opt.jpg'
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

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
    )
  );
});
