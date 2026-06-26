// ═══════════════════════════════════════
// ORACLE — Service Worker
// Offline support · Caching · Background sync
// ═══════════════════════════════════════

const CACHE_NAME = 'oracle-v1';
const STATIC_ASSETS = [
  '/',
  '/offline',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip API calls and external URLs
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => cached || caches.match('/'));
      })
  );
});

// Background sync placeholder
self.addEventListener('sync', (event) => {
  if (event.tag === 'oracle-sync') {
    // Future: sync offline data when back online
  }
});
