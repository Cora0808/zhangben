/* ================================================================
   v4 — boot：启动装配
   ================================================================ */
window.APP_VER_CUR=APP_VER;
function bindUI(){
  document.querySelectorAll('#nav button').forEach(b=>{ b.onclick=()=>go(b.dataset.go); });
}
function boot(){
  bindUI();
  bootData();
  if(!S.onboard){ $('onboard').style.display='block'; renderOnboard(); }
  else render();
  fetchHolidays();
  setTimeout(checkUpdate,1200);
}
boot();
if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{}); }); }
/* 键盘弹起时，把弹窗/记账抽屉抬到可视区内（部分手机浏览器固定底栏会被输入法盖住） */
function kbMode(liftForce){
  const vv=window.visualViewport;
  const open=document.querySelectorAll('.modal.on,.sheet.on');
  if(!open.length) return;
  const active=document.activeElement;
  const editing=!!(active&&active.matches&&active.matches('input,textarea'));
  const lift=(liftForce!=null)?liftForce:(editing&&vv&&vv.height<window.innerHeight-40);
  open.forEach(el=>{
    if(lift){
      const h=Math.max(200,Math.round((vv?vv.height:window.innerHeight)*0.96));
      el.style.maxHeight=h+'px'; el.style.top='0px'; el.style.bottom='auto';
    }else{
      el.style.maxHeight=''; el.style.top=''; el.style.bottom='';
    }
  });
  return lift;
}
window.addEventListener('focusin',e=>{
  if(!(e.target&&e.target.matches&&e.target.matches('input,textarea'))) return;
  setTimeout(()=>{
    kbMode();
    const t=document.activeElement;
    if(t&&t.scrollIntoView){ try{ t.scrollIntoView({block:'center',behavior:'smooth'}); }catch(x){ try{ t.scrollIntoView(); }catch(y){} } }
  },220);
});
window.addEventListener('focusout',()=>{ setTimeout(()=>kbMode(false),220); });
window.addEventListener('input',e=>{ if(e.target&&e.target.matches&&e.target.matches('input,textarea')) setTimeout(kbMode,60); });
window.addEventListener('resize',()=>{ setTimeout(kbMode,80); });
if(window.visualViewport) window.visualViewport.addEventListener('resize',()=>{ setTimeout(kbMode,60); });
function forceUpdate(){ if(!confirm('清缓存并刷新？只清缓存不动数据')) return; if('caches' in window){ caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))).catch(()=>{}); } if('serviceWorker' in navigator){ navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{}); } location.replace(location.pathname+'?f='+Date.now()); }
