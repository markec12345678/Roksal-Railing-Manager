// Roksal Railing Manager — Service Worker v3 (R131 — issue #5 §5)
// Strategije:
//  • navigacije (HTML): network-first, ob offline → /offline.html
//  • /api/ GET: NETWORK-ONLY — nikoli iz cache-a (§5: uporabnik A → odjava →
//    uporabnik B ne sme videti A-jevih podatkov; brskalniški HTTP cache je
//    obenem zaprt z `Cache-Control: no-store` na strežniku — proxy.ts)
//  • /_next/static + ikone: cache-first (nespremenljivi hash fajli)
//  • POST/PUT/DELETE: nikoli ne prestreži (offline vrsta je v aplikaciji)
//  • PURGE: sporočilo { type: 'ROKSAL_PURGE_CACHES' } izbriše VSE cache-e
//    (odjava ga pošlje iz aplikacije; enako počisti `caches.delete` direktno)
// V dev načinu se SW sploh ne registrira (glej sw-register.tsx).

const CACHE_NAME = 'roksal-v3';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ['/', OFFLINE_URL, '/manifest.json', '/icon-192.png', '/icon-512.png', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

// Cache versioning (§5): ob aktivaciji nove verzije SW vsi starejši cache-i
// (roksal-v1, roksal-v2, …) izginejo — zastareli podatki ne preživijo nadgradnje.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// §5: eksplicitno čiščenje ob odjavi (in na zahtevo iz nastavitev).
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ROKSAL_PURGE_CACHES') return;
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k))).then(() => {
        // Poročilo nazaj kličevalcu (koliko cache-ov je izginilo).
        const client = event.source;
        if (client && 'postMessage' in client) {
          client.postMessage({ type: 'ROKSAL_CACHES_PURGED', count: keys.length });
        }
      })
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  // Dev artefakti in HMR — nikoli iz cache-a
  if (url.pathname.includes('webpack-hmr') || url.pathname.startsWith('/_next/webpack')) return;

  // 1) API — vedno mreža, NIKOLI cache (§5). Odgovorov ne shranjujemo in iz
  //    cache-a jih ne servoamo: privatni podatki (projekti, stranke, računi)
  //    ne smejo preživeti odjave v SW cache-u. Offline odgovornost je v
  //    aplikaciji: pisanje gre v IndexedDB vrsto (offline-queue.ts), branje
  //    pokaže jasen offline pas — zastarelih podatkov ne izdajamo za sveže.
  if (url.pathname.startsWith('/api/')) return;

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

  // 4) Ostalo — network s cache fallback
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
