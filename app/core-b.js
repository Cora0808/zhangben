/* ================================================================
   打工人资金教练 v4 — core-b：发薪周期 / 节假日 / 模板 / 导出
   ================================================================ */
/* ---------- 日期工具 ---------- */
function addDateStr(dstr,n){ const d=new Date(dstr); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+P(d.getMonth()+1)+'-'+P(d.getDate()); }
function weekdayN(dstr){ return new Date(dstr).getDay(); }
function addMonth(m,d){ let y=+m.slice(0,4),mm=+m.slice(5,7)-1+d; y+=Math.floor(mm/12); mm=((mm%12)+12)%12; return y+'-'+P(mm+1); }
function daysIn(m){ return new Date(+m.slice(0,4),+m.slice(5,7),0).getDate(); }
function cmpD(a,b){ return a<b?-1:(a>b?1:0); }
/* ---------- 节假日（内置 2026 + 自定义；holidays.json 由仓库自动更新覆盖静态表） ---------- */
let HOL_EXTRA=null; /* 从 holidays.json 拉到的补充表 {hol:[],work:[],year:2027} */
const HOL_RANGES_2026=[['2026-01-01','2026-01-03'],['2026-02-15','2026-02-23'],['2026-04-04','2026-04-06'],['2026-05-01','2026-05-05'],['2026-06-19','2026-06-21'],['2026-09-25','2026-09-27'],['2026-10-01','2026-10-07']];
const WORK_EXTRA_2026=['2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10'];
function isHoliday(d){
  if(S.customWork&&S.customWork.indexOf(d)>=0) return false;
  if(HOL_EXTRA&&HOL_EXTRA.work&&HOL_EXTRA.work.indexOf(d)>=0) return false;
  if(S.customHol&&S.customHol.indexOf(d)>=0) return true;
  if(HOL_EXTRA&&HOL_EXTRA.hol&&HOL_EXTRA.hol.indexOf(d)>=0) return true;
  for(const r of HOL_RANGES_2026){ if(d>=r[0]&&d<=r[1]) return true; }
  const w=weekdayN(d); return w===0||w===6;
}
function isWorkday(d){ return !isHoliday(d); }
/* 顺延到最近工作日（优先往前=提前发薪；dir -1 提前/遇假提前到放假前最后工作日） */
function workdayNear(md,dir){ let d=md; for(let i=0;i<15;i++){ if(isWorkday(d)) return d; d=addDateStr(d,dir); } return md; }
function paydayIn(m){ /* 当月发薪日字符串 */
  const rule=S.profile.payRule||{mode:'prev',day:5};
  const mode=rule.mode||'prev', day=Math.max(1,Math.min(28,+rule.day||5));
  if(mode==='fixed') return m+'-'+P(day);
  /* prev: 遇节假提前到放假前最后工作日（用户场景） */
  const base=m+'-'+P(day);
  return workdayNear(base,-1);
}
function nextPayday(){ /* 从今天往后的下一个发薪日（今天若发薪=已进入新周期→用下月） */
  const ym=TODAY().slice(0,7);
  const thisP=paydayIn(ym);
  if(cmpD(TODAY(),thisP)<0) return thisP;
  return paydayIn(addMonth(ym,1));
}
function lastPayday(){ /* 今天之前最近一次发薪（含今天=今天） */
  const ym=TODAY().slice(0,7);
  const thisP=paydayIn(ym);
  if(cmpD(TODAY(),thisP)>=0) return thisP;
  return paydayIn(addMonth(ym,-1));
}
function daysToNextPay(){ const n=Math.round((new Date(nextPayday())-new Date(TODAY()))/86400000); return Math.max(0,n); }
function cycleLabel(){ return lastPayday().slice(5).replace('-','/')+' → '+nextPayday().slice(5).replace('-','/'); }
function recsInCycle(){
  const a=lastPayday(), b=nextPayday();
  return S.recs.filter(r=>r.d>=a&&r.d<b);
}
function fetchHolidays(){
  try{ fetch('holidays.json?x='+Date.now()).then(r=>{ if(!r.ok) return; return r.json(); }).then(j=>{ if(j&&j.year&&(!HOL_EXTRA||j.year>HOL_EXTRA.year)){ HOL_EXTRA=j; } }).catch(()=>{}); }catch(e){}
}

/* ---------- 快捷模板 & 记忆 ---------- */
function smartGuess(note){
  note=String(note||'').trim(); if(!note) return null;
  if(S.smart[note]) return {cat:S.smart[note],exact:true};
  let best=null,bl=0; Object.keys(S.smart).forEach(k=>{ if(k.length>bl&&note.indexOf(k)>=0){bl=k.length;best=S.smart[k];} });
  return best?{cat:best,exact:false}:null;
}
function smartLearn(note,c){ note=String(note||'').trim(); if(!note||!c) return; if(S.smart[note]!==c) S.smart[note]=c; }
function topTpls(){
  const cut=addDateStr(TODAY(),-60), map={};
  S.recs.forEach(r=>{
    if(r.type!=='exp'||r.srcFund||r.d<cut) return;
    const note=String(r.note||'').trim()||catInfo(r.cat).n;
    const k=r.cat+'|'+note+'|'+Math.round(+r.amt||0);
    if(!map[k]) map[k]={cat:r.cat,note,amt:Math.round(+r.amt||0),hits:0,ts:r.ts||0};
    map[k].hits++; if((r.ts||0)>map[k].ts) map[k].ts=r.ts;
  });
  const auto=Object.keys(map).map(k=>map[k]).filter(x=>x.hits>=2).sort((a,b)=>b.hits-a.hits||b.ts-a.ts).slice(0,5);
  return (S.tmpl||[]).concat(auto).slice(0,8);
}
/* ---------- 计划项（全弹性） ----------
 * {id,name,type:'exp'|'mv'|'sv',cat?,acc?,goal?,amt,day,flex,on,skip:[]}
 * 到期提醒：今天>=day && 未处理本月 */
function plansDue(){
  const m=TODAY(), today=+TODAY().slice(8,10), ym=TODAY().slice(0,7);
  const key=p=>ym+'|'+p.id;
  return (S.plans||[]).map(p=>{
    const done=p.lastDone===ym;
    const skipped=(p.skip||[]).includes(ym);
    const due=!done&&!skipped&&today>=+p.day;
    return {p,done,skipped,due,key:key(p)};
  });
}
/* ---------- 教练简报（导出给 Hermes/微信） ---------- */
function coachDigest(){
  const a=assets(), inc=periodIn(recsInCycle()), exp=periodSpent(recsInCycle());
  const cashPer=daysToNextPay()>0?Math.round((a.cash/daysToNextPay())*100)/100:null;
  const lines=[];
  lines.push('📋 资金简报 '+TODAY());
  lines.push('周期 '+cycleLabel()+' · 距下次发薪 '+daysToNextPay()+' 天');
  lines.push('资产: 活钱 ¥'+fmt(a.cash)+' · 余利宝 ¥'+fmt(a.ylb)+' · 黄金 ¥'+fmt(a.gold)+' · 代存 ¥'+fmt(a.save)+' · 专项 ¥'+fmt(a.funds)+' · 合计 ¥'+fmt(a.total));
  lines.push('本周期: 到账 ¥'+fmt(inc)+' · 支出 ¥'+fmt(exp)+' · 日均可花 '+(cashPer==null?'—':'¥'+fmt(cashPer)));
  const oP=objPaidTotal(); if(oP>0) lines.push('对方代付(亲密付) 累计 ¥'+fmt(oP));
  S.goals.forEach(g=>{ const v=saveVal(g.id); if(g.id==='car'){ if(v>0||S.t0.save.car>0) lines.push('目标「'+g.name+'」 '+fmt(v)+' / '+fmt(g.target||0)); } });
  const pd=plansDue(); const pend=pd.filter(x=>x.due||x.done);
  if(pend.length) lines.push('计划: '+pend.map(x=>x.done?'✔':'◌')+pend.map(x=>x.p.name+(x.done?'(已记)':'待记')).join('、'));
  /* 专项基金概况（为花而留的锅） */
  funds().forEach(f=>{
    const put=fundPutIn(f.id), sp=fundSpent(f.id), bal=fundBal(f.id);
    if(put>0||sp>0||f.herIn>0||bal!==0){
      let s='专项「'+f.name+'」: 我放入 ¥'+fmt(put)+' · 已花 ¥'+fmt(sp)+' · 锅底 ¥'+fmt(bal);
      if(f.herIn>0) s+=' · 她放入 ¥'+fmt(f.herIn);
      lines.push(s);
    }
  });
  /* 状态开关注释 */
  Object.keys(S.stateFlags||{}).forEach(k=>{ if(k==='gold'&&S.stateFlags[k]) lines.push('状态: 黄金定投暂停中(观望)'); });
  return lines.join('\n');
}
/* ---------- 自更新检查（页面内横幅，不依赖 service worker） ---------- */
function checkUpdate(){
  try{
    fetch('./version.json?v='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
      if(!j||!j.ver) return;
      const curV=(window.APP_VER_CUR||APP_VER);
      if(j.ver!==curV){
        const bar=$('updbar'); if(bar){ bar.style.display='block'; }
      }
    }).catch(()=>{});
  }catch(e){}
}
/* ---------- 安装到桌面 & 手动检查更新 ---------- */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; try{ render(); }catch(x){} });
function installApp(){
  if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice && deferredPrompt.userChoice.then(()=>{ deferredPrompt=null; try{render();}catch(x){} }); }
  else showToast('请用浏览器菜单「添加到主屏幕/安装应用」','warn');
}
function checkUpdManual(){
  try{
    fetch('./version.json?v='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
      if(!j||!j.ver){ showToast('检查失败','err'); return; }
      const cur=(window.APP_VER_CUR||APP_VER);
      if(j.ver!==cur){ if(confirm('发现新版 '+j.ver+'（当前 '+cur+'），立即更新？')) forceUpdate(); }
      else showToast('已是最新版 '+cur,'ok');
    }).catch(()=>{ showToast('检查失败（离线？）','err'); });
  }catch(e){ showToast('检查失败','err'); }
}
/* ---------- 备份导出/导入 ---------- */
function exportJSON(){ const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='账本备份_'+TODAY()+'.json'; a.click(); S.lastExport=TODAY(); save(); showToast('备份已导出，请存好'); }
function importJSON(text){ try{ const d=JSON.parse(text); if(!d||d.v!==4) { showToast('不是 v4 备份文件','err'); return false; } S=d; save(); location.reload(); return true; }catch(e){ showToast('解析失败','err'); return false; } }
