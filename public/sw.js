// Unishop service worker: installable app shell, offline fallback, and push notifications.
// Bump VERSION to invalidate every cache on the next deploy.
const VERSION = 'v1';
const SHELL_CACHE = `unishop-shell-${VERSION}`;
const ASSET_CACHE = `unishop-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const SHELL_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png', '/assets/unishop-logo.jpeg'];
const MAX_ASSET_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Cache the shell best-effort so one missing file never blocks the install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('unishop-') && key !== SHELL_CACHE && key !== ASSET_CACHE).map((key) => caches.delete(key))))
      .then(() => self.registration.navigationPreload && self.registration.navigationPreload.enable().catch(() => {}))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

// Pages: always try the network so users never see stale data; fall back to a cached copy, then the offline page.
async function handleNavigation(event) {
  try {
    const preload = event.preloadResponse && await event.preloadResponse;
    const response = preload || await fetch(event.request);
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_URL)) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// Static files (css, js, images): serve the cached copy at once and refresh it in the background.
async function handleAsset(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request).then((response) => {
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(event.request, response.clone()).then(() => trim(ASSET_CACHE, MAX_ASSET_ENTRIES));
    }
    return response;
  });
  if (cached) { event.waitUntil(refresh.catch(() => {})); return cached; }
  try { return await refresh; } catch { return Response.error(); }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the API, user uploads, the service worker itself, or partial (video range) requests.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/admin') || url.pathname === '/sw.js' || request.headers.has('range')) return;
  if (request.mode === 'navigate') { event.respondWith(handleNavigation(event)); return; }
  if (/\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|webmanifest)$/i.test(url.pathname)) event.respondWith(handleAsset(event));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let data = { title: 'Unishop', body: '', url: '/dashboard.html' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', data: { url: data.url } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard.html';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((windows) => {
    const open = windows.find((client) => client.url.includes(url));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
