// Roksal Railing Manager — Service Worker v2
// Strategije:
//  • navigacije (HTML): network-first, ob offline → /offline.html
//  • /api/ GET: network-first, ob offline → zadnji uspešen odgovor (cache)
//  • /_next/static + ikone: cache-first (nespremenljivi hash fajli)
//  • POST/PUT/DELETE: nikoli ne prestreži (offline vrsta je v aplikaciji)
// V dev načinu se SW sploh ne registrira (glej sw-register.tsx).

const CACHE_NAME = 'roksal-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ['/', OFFLINE_URL, '/manifest.json', '/icon-192.png', '/icon-512.png', '/logo.svg'];

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
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  // Dev artefakti in HMR — nikoli iz cache-a
  if (url.pathname.includes('webpack-hmr') || url.pathname.startsWith('/_next/webpack')) return;

  // 1) API — sveži podatki, offline pa zadnji dober odgovor
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2) Statični hash fajli — cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname === '/logo.svg' ||
      url.pathname === '/icon-192.png' || url.pathname === '/icon-512.png') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // 3) Navigacije — network-first, offline → /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 4) Ostalo (slike jsdelivr/twitter ipd. ni več, ampak varnost) — network s cache fallback
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
