const CACHE_NAME = 'quranhub-shell-v8';
const DATA_CACHE = 'quranhub-data-v8';
const AUDIO_CACHE = 'quranhub-audio-v8';

const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME, DATA_CACHE, AUDIO_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => !whitelist.includes(key)).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// Network-first for the app shell so new deployments appear immediately; fall
// back to the cached copy only when offline. This prevents the SW from
// endlessly serving a stale (and possibly broken) index.html.
async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const index = await caches.match('/index.html');
      if (index) return index;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  try {
    if (url.origin === self.location.origin) {
      event.respondWith(networkFirstShell(request));
      return;
    }

    if (url.origin === 'https://audio.qurancdn.com') {
      event.respondWith(cacheFirst(request, AUDIO_CACHE));
      return;
    }

    if (
      url.origin === 'https://api.quran.com' ||
      url.origin === 'https://ummahapi.com' ||
      url.origin === 'https://api.islamic.app'
    ) {
      event.respondWith(networkFirst(request, DATA_CACHE));
      return;
    }

    if (
      url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com' ||
      url.origin === 'https://cdnjs.cloudflare.com'
    ) {
      event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
      return;
    }

    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
  } catch (e) {
    // Never let the SW throw and break the page.
    event.respondWith(fetch(request));
  }
});
