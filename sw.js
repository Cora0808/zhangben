/* 打工人小账本 — Service Worker（网络优先，保证更新即时生效） */
const CACHE = 'wbbook-v44';
const STATIC = ['./manifest.json', './icon-192-v2.png', './icon-512-v2.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 导航/HTML：真·网络优先。cache:'reload' 绕过 HTTP 缓存强制回源，
  // 否则 fetch 会吃浏览器缓存，"更新了没变化"多半是这个坑。离线才回退缓存。
  const isHTML = e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '';
  if (isHTML) {
    e.respondWith(
      fetch(e.request, {cache:'reload'}).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // 静态资源（图标等）缓存优先，节省流量
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return resp;
      }).catch(() => r)
    )
  );
});
