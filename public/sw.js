const CACHE_NAME = 'drill-app-shell-v2';
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DRILL offline</title>
</head>
<body>
  <main>
    <h1>Offline</h1>
    <p>DRILL is unavailable right now. Reconnect and try again.</p>
  </main>
</body>
</html>`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app-icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key === CACHE_NAME) return Promise.resolve();
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        if (response.ok) {
          cache.put('./index.html', response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        const shell = await caches.match('./');
        if (shell) return shell;
        return new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;

      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        return cachedResponse;
      }
    })());
  }
});
