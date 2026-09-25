// YKS Takip — service worker (v16)
// 1) Bildirime dokununca uygulamayı açar/öne getirir.
// 2) Sayfa için "önce internet, yoksa son kayıtlı kopya" stratejisi: internet yokken de uygulama açılır.
const CACHE = 'yks-takip-v16';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Sadece sitenin kendi sayfaları (Firebase, CDN vb. dokunulmaz)
    if (url.origin !== self.location.origin) return;
    event.respondWith((async () => {
        try {
            const res = await fetch(req);
            if (res && res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return res;
        } catch (e) {
            const cached = await caches.match(req, { ignoreSearch: true });
            if (cached) return cached;
            if (req.mode === 'navigate') {
                const page = await caches.match('./', { ignoreSearch: true }) || await caches.match('index.html', { ignoreSearch: true });
                if (page) return page;
            }
            throw e;
        }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || './';
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of list) {
            if ('focus' in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
    })());
});
