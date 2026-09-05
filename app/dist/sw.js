const C='coach-v4-4';const F=['index.html','manifest.json','icon-192-v2.png','icon-512-v2.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET')return;
  const req=e.request, url=req.url, isNav=req.mode==='navigate'||url.indexOf('index.html')>=0;
  if(isNav){ e.respondWith(fetch(req).then(r=>{const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});return r;}).catch(()=>caches.match(req).then(h=>h||caches.match('index.html')))); return; }
  e.respondWith(caches.match(req).then(hit=>{ const nw=fetch(req).then(r=>{const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});return r;}).catch(()=>null); return hit||nw; })); });