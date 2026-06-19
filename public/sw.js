// Roksal Railing Manager — Service Worker
// Minimal offline cache za PWA
const CACHE_NAME = 'roksal-v1';
const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Samo GET
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Skip chrome-extension in cross-origin
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API zahteve — vedno network (sveži podatki)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Statični resursi in navigacije — cache first, nato network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache samo uspešne odgovore
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
