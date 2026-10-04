/* WEEKLINE offline cache. Bump VERSION on every release so phones pick up the new build. */
const VERSION = 'weekline-2026-10-04-2';
const SHELL = ['./', 'index.html', 'privacy.html', 'manifest.webmanifest', 'en/', 'en/privacy.html', 'en/manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages: network first so updates arrive, cache when offline
  if (req.mode === 'navigate') {
    // cache each page under its own URL so the Korean and English pages never overwrite each other
    const page = new URL(req.url); page.hash = ''; page.search = '';
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(page.href, copy)); }
      return res;
    }).catch(() => caches.match(page.href).then(hit => hit || caches.match(page.pathname.includes('/en/') ? 'en/' : './'))));
    return;
  }
  // same-origin files and Google Fonts: cache first, refresh in the background
  if (url.origin === location.origin || url.host.endsWith('googleapis.com') || url.host.endsWith('gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    const open = list.find(c => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('./#today');
  }));
});
