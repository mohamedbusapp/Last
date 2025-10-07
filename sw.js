const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  '/Suucess_Modified_RedStayLonger_WaveSlower.html',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png'
];

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (isNavigationRequest(req)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (req.destination === 'image' || /\.(png|jpg|jpeg|svg|gif|webp)$/.test(req.url)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cache = await caches.match(request);
    if (cache) return cache;
    return caches.match('/offline.html');
  }
}

async function cacheFirst(request) {
  const cacheMatch = await caches.match(request);
  if (cacheMatch) return cacheMatch;
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    return caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  }).catch(()=>null);
  return cached || (await networkPromise) || caches.match('/offline.html');
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
