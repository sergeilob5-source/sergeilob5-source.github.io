// Service worker для установки как приложение + офлайн-доступ.
// Стратегия network-first: всегда пробуем свежее из сети, офлайн — из кэша.
const CACHE = 'divanauto-v1';
const ASSETS = [
  'index.html', 'admin.html', 'catalog.html', 'feed.html', '404.html',
  'styles.css?v=10', 'config.js', 'settings.js', 'cars.js', 'feed.js',
  'db.js', 'script.js?v=1', 'admin.js', 'catalog.js', 'feed-page.js', 'auth.js', 'pwa.js',
  'img/logo.png?v=2', 'img/logo-icon.png?v=1', 'img/icon-192.png', 'img/icon-512.png',
  'favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request))
  );
});
