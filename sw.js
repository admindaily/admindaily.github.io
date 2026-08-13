// Minimal, safe Service Worker. It only exists so the app can be installed as a
// PWA. It does NOT cache the app shell, so the browser always loads the latest
// code from the network. This avoids serving stale/cached copies (which hid
// fixes and caused crashes) and means the SW can never interfere with the page.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
