// YKS Takip — service worker (v74)
const CACHE = 'yks-takip-v74';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function notifyUpdate() {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ type: 'update-available' }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase / canlı veri: hiç önbelleğe alma
  if (/firebaseio\.com|googleapis\.com|identitytoolkit|securetoken/.test(url.hostname)) return;
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && /(^\/?$|index\.html$|\/$)/.test(url.pathname));
  if (isPage) {
    // sayfa: önce önbellek (hızlı açılış), arkada yenile; değiştiyse "yeni sürüm" bandı çıksın
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), cached = await cache.match('index.html') || await cache.match(req);
      const fresh = fetch(req).then(async res => {
        if (res && res.ok) {
          const old = cached ? (await cached.clone().text()).length : 0, copy = res.clone();
          const len = (await copy.clone().text()).length;
          await cache.put('index.html', copy);
          if (cached && old !== len) notifyUpdate();
        }
        return res;
      }).catch(() => null);
      return cached || (await fresh) || new Response('Çevrimdışı', { status: 503 });
    })());
    return;
  }
  // statik dosyalar ve CDN: önbellek öncelikli
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque') && (url.origin === location.origin || /cdn|unpkg|jsdelivr|gstatic|fonts/.test(url.hostname))) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => hit)));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow(target);
  }));
});
