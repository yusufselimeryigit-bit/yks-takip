/* YKS Takip service worker — yks-takip-v95 */
const VERSION = 'yks-takip-v95';
const LIBS = ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js','https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js','https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js'];
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.concat(LIBS).map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('yks-takip-') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function notifyUpdate() {
  const cl = await self.clients.matchAll({ type: 'window' });
  cl.forEach(c => c.postMessage({ type: 'update-available' }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase ve canlı veri istekleri doğrudan ağa gider
  if (/firebaseio\.com|firebasedatabase\.app|identitytoolkit\.googleapis|securetoken\.googleapis|firestore\.googleapis/.test(url.hostname) && url.hostname !== location.hostname) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: false, ignoreVary: true });
    const net = fetch(req).then(async res => {
      if (res && (res.ok || res.type === 'opaque')) {
        if (cached && res.ok && url.origin === location.origin && (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/'))) {
          try {
            const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
            if (a !== b) notifyUpdate();
          } catch (x) {}
        }
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const idx = await cache.match('index.html') || await cache.match('./'); if (idx) return idx; }
    return new Response('Çevrimdışı', { status: 503, statusText: 'Offline' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cl) { if ('focus' in c) { await c.focus(); return; } }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
