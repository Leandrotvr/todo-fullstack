const VERSION = 'v1';
const APP_SHELL = ['/', '/index.html'];
const API_PREFIX = '/api/todos';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Sólo cachear GET
  if (e.request.method !== 'GET') return;

  // Assets con hash (cache-first)
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return r;
      }))
    );
    return;
  }

  // API (network-first con fallback a cache)
  if (url.pathname.startsWith(API_PREFIX)) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // index.html y demás (stale-while-revalidate simple)
  e.respondWith(
    caches.match(e.request).then(hit => {
      const fetchP = fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => hit || caches.match('/index.html'));
      return hit || fetchP;
    })
  );
});
