// Offline support: cache the game shell on install, then serve from cache and refresh in the background.
const CACHE = 'pothole-dash-v1.0.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(SHELL);
      // Also cache the scripts and styles the page loads, so the first visit already works offline.
      const html = await (await c.match('./index.html')).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit ?? (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return hit ?? net;
    }),
  );
});
