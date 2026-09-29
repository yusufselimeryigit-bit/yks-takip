// YKS Takip — service worker (v35)
// 1) ANINDA AÇILIŞ: Uygulama sayfası telefondaki kopyadan hemen açılır; arka planda internetten
//    güncel sürüm indirilir. Değiştiyse uygulamaya "Yeni sürüm hazır" bildirilir (bir sonraki
//    açılışta ya da "Yenile"ye basınca yeni sürüm gelir). İnternet yokken de açılır.
// 2) Sürümü sabit harici kütüphaneler (Chart.js, Lucide, Firebase kodu): telefonda saklanır.
// 3) Bildirime dokununca uygulamayı açar/öne getirir.
const CACHE = 'yks-takip-v52';
const LIB_CACHE = 'yks-libs-v1';
const LIB_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'www.gstatic.com'];
const SHELL = ['./', 'manifest.json', 'apple-touch-icon.png'];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const c = await caches.open(CACHE);
        await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE && k !== LIB_CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Yanıtın "sürüm parmak izi": ETag / Last-Modified, yoksa uzunluk
function stamp(res) {
    if (!res) return '';
    return res.headers.get('etag') || res.headers.get('last-modified') || res.headers.get('content-length') || '';
}
async function notifyUpdate() {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'update-available' }));
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Harici kütüphaneler: önbellekten hemen, arka planda tazele
    if (LIB_HOSTS.includes(url.hostname)) {
        event.respondWith((async () => {
            const cache = await caches.open(LIB_CACHE);
            const cached = await cache.match(req);
            const refresh = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
            if (cached) { event.waitUntil(refresh); return cached; }
            return (await refresh) || Response.error();
        })());
        return;
    }
    if (url.origin !== self.location.origin) return;   // Firebase veritabanı vb. dokunulmaz

    // Uygulama sayfası: önbellekten anında aç, arka planda güncelle
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            const cached = await cache.match('./') || await cache.match(req, { ignoreSearch: true });
            const update = fetch(req, { cache: 'no-cache' }).then(async res => {
                if (res && res.ok) {
                    const changed = cached && stamp(cached) !== stamp(res);
                    await cache.put('./', res.clone());
                    if (changed) await notifyUpdate();
                }
                return res;
            }).catch(() => null);
            if (cached) { event.waitUntil(update); return cached; }
            return (await update) || new Response('<h1>İnternet bağlantısı yok</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })());
        return;
    }

    // Diğer site dosyaları (ikonlar, açılış görselleri): önbellek, yoksa internet
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
            const res = await fetch(req);
            if (res && res.ok) cache.put(req, res.clone());
            return res;
        } catch (e) { return cached || Response.error(); }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || './';
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of list) { if ('focus' in c) return c.focus(); }
        if (self.clients.openWindow) return self.clients.openWindow(target);
    })());
});
