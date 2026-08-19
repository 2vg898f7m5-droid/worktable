const CACHE = 'worktable-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './idea-bg-final.jpg'
];
const SUPA_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const EXTERNAL_LIBS = [SUPA_LIB, LEAFLET_CSS, LEAFLET_JS];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() =>
      Promise.all(EXTERNAL_LIBS.map(url =>
        fetch(url).then(r => caches.open(CACHE).then(c => c.put(url, r.clone()))).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Network-first for navigation requests (fresh HTML), fallback to cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put('./index.html', c)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for app shell + icons
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); return r;
      }).catch(() => cached))
    );
    return;
  }

  // Stale-while-revalidate for external libs (Supabase + Leaflet), offline-capable
  if (EXTERNAL_LIBS.includes(req.url)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); return r; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // AMap tiles: cache-first with background update (offline map browsing)
  if (url.hostname.includes('autonavi.com') || url.hostname.includes('is.autonavi.com')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
        return r;
      }).catch(() => cached))
    );
    return;
  }

  // Supabase API calls: network only (don't cache responses)
  if (url.hostname.includes('supabase')) return;
});
