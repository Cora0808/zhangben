const C='coach-v4.2.4';const F=['index.html','manifest.json','icon-192-v2.png','icon-512-v2.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET')return;
  const req=e.request, isNav=req.mode==='navigate'||req.url.indexOf('index.html')>=0;
  e.respondWith(caches.match(req).then(h=>h||(isNav?caches.match('index.html'):null)).catch(()=>null).then(hit=>{
    if(hit){ fetch(req).then(r=>{if(r&&r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});}}).catch(()=>{}); return hit; }
    return fetch(req).then(r=>{if(r&&r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});} return r;}).catch(()=>hit);
  })); });