"""拼装 v4 单文件应用：index.tpl.html + css + js 分片 → v4.html"""
import re, os
from pathlib import Path

APP = Path(r"D:\ai\Hermes Agent\zhangben\app")
OUT = APP / "dist"
OUT.mkdir(exist_ok=True)

tpl = (APP / "index.tpl.html").read_text(encoding="utf-8")
css = (APP / "css.css").read_text(encoding="utf-8")
parts = ["core-a.js","core-b.js","ui-main-a.js","ui-pages-1.js","ui-pages-2.js","ui-pages-fund.js","ui-pages-3.js","boot.js"]
js = "\n".join((APP / p).read_text(encoding="utf-8") for p in parts)

html = tpl.replace('<style id="appcss"></style>', '<style id="appcss">\n'+css+'\n</style>')

html_clean = html.replace('<script id="appjs"></script>', '<script>\n'+js+'\n</script>')
(OUT / "index.html").write_text(html_clean, encoding="utf-8")

TEST_JS = r"""
/* ==== AUTO TEST ==== */
(function(){
  var out=[];
  function log(s){ out.push(s); }
  try{
    S.onboard=true;
    S.t0.cash=5000; S.t0.acc={ylb:0,gold_mv:0}; S.t0.save={car:0}; S.t0.gold_cost=0;
    S.profile.payday=5; S.profile.payRule={mode:'prev',day:5};
    S.recs=[];
    function mk(o){ o.d=o.d||'2026-09-05'; o.ts=Date.now(); S.recs.push(o); }
    mk({id:'1',d:'2026-09-05',amt:6000,type:'inc',src:'salary'});
    mk({id:'2',d:'2026-09-05',amt:23,type:'exp',cat:'food',note:'午餐'});
    mk({id:'3',d:'2026-09-05',amt:200,type:'mv',dir:'in',acc:'gold'});
    mk({id:'4',d:'2026-09-05',amt:100,type:'mv',dir:'in',acc:'ylb'});
    mk({id:'5',d:'2026-09-05',amt:500,type:'sv',dir:'in',goal:'car'});
    mk({id:'6',d:'2026-09-06',amt:99,type:'obj',cat:'food'});
    var a=assets();
    log('cash='+a.cash+'|want10177');
    log('ylb='+a.ylb+'|want100');
    log('gold='+a.gold+'|want200');
    log('save='+a.save+'|want500');
    log('total='+a.total+'|want10977');
    log('objPaid='+objPaidTotal()+'|want99');
    log('pay='+nextPayday()+' daysTo='+daysToNextPay());
    log('cycle='+cycleLabel());
    var hh=renderHome();
    log('homeLen='+hh.length+' feed='+(hh.match(/class="card coach/g)||[]).length);
    log('digestOK='+(coachDigest().indexOf('资产:')>=0));
    var el=document.createElement('div'); el.id='tres'; el.textContent=out.join('\n'); document.body.appendChild(el);
  }catch(e){ var el=document.createElement('div'); el.id='tres'; el.textContent='ERR:'+e.message; document.body.appendChild(el); }
})();
"""
js_all = js + "\n" + TEST_JS
html = html.replace('<script id="appjs"></script>', '<script>\n'+js_all+'\n</script>')
(OUT / "autotest.html").write_text(html, encoding="utf-8")

(OUT / "index.html").write_text(html_clean, encoding="utf-8")
# 复制资源
import shutil
src = Path(r"C:\Users\Administrator\AppData\Local\hermes\cache\documents\小账本v3_work\v3_base")
for f in ["icon-192-v2.png","icon-512-v2.png","apple-touch-icon.png"]:
    if (src/f).exists(): shutil.copy(src/f, OUT/f)
# manifest 新
manifest = {"name":"打工人资金教练","short_name":"资金教练","description":"记账·预算·理财·教练，赛博风离线资金管家","lang":"zh-CN","start_url":"index.html","scope":"./","display":"standalone","orientation":"portrait","background_color":"#05070c","theme_color":"#05070c","icons":[{"src":"icon-192-v2.png","sizes":"192x192","type":"image/png"},{"src":"icon-512-v2.png","sizes":"512x512","type":"image/png","purpose":"any"}]}
import json
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False),encoding="utf-8")
# sw.js 简单版
sw = """const C='coach-v4-4';const F=['index.html','manifest.json','icon-192-v2.png','icon-512-v2.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET')return;
  const req=e.request, url=req.url, isNav=req.mode==='navigate'||url.indexOf('index.html')>=0;
  if(isNav){ e.respondWith(fetch(req).then(r=>{const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});return r;}).catch(()=>caches.match(req).then(h=>h||caches.match('index.html')))); return; }
  e.respondWith(caches.match(req).then(hit=>{ const nw=fetch(req).then(r=>{const cl=r.clone();caches.open(C).then(c=>c.put(req,cl)).catch(()=>{});return r;}).catch(()=>null); return hit||nw; })); });"""
(OUT/"sw.js").write_text(sw,encoding="utf-8")
(OUT/"version.json").write_text(json.dumps({"ver":"v4.0.0"}),encoding="utf-8")
(OUT/"holidays.json").write_text(json.dumps({"year":2026,"hol":[],"work":[]},ensure_ascii=False),encoding="utf-8")

# JS 语法检查（抽取 script）
scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
(OUT/".."/"_check.js").write_text("\n".join(scripts), encoding="utf-8")
print("dist 生成:", [p.name for p in OUT.iterdir()])
print("index.html:", (OUT/"index.html").stat().st_size, "bytes; script 块:", len(scripts))
