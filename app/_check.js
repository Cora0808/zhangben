
/* ================================================================
   打工人资金教练 v4 — core-a：模型 / 存储 / 账户计算 / 分类
   ================================================================ */
/* ---------- 常量 ---------- */
const KEY='wb_coach_v1';
const APP_VER='v4.2.3';
const TODAY=()=>{const d=new Date();return d.getFullYear()+'-'+P(d.getMonth()+1)+'-'+P(d.getDate());};
const P=n=>n<10?'0'+n:''+n;
const YM=dstr=>String(dstr||'').slice(0,7);
const nowTs=()=>Date.now();
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmt(n){n=Math.round((Number(n)||0)*100)/100;const neg=n<0;n=Math.abs(n);let s=(Math.round(n*100)/100).toFixed(Math.abs(n%1)>0.004?2:0);s=s.replace(/\B(?=(\d{3})+(?!\d))/g,',');return (neg?'-':'')+s;}
const money=n=>'¥'+fmt(n);

/* ---------- 分类 / 来源 / 账户（用户语言） ---------- */
const CATS=[
  {k:'food', n:'餐饮',  e:'🍚', g:'day'},
  {k:'traffic',n:'交通', e:'🚇', g:'day'},
  {k:'shop', n:'购物',  e:'🛍️', g:'day'},
  {k:'home', n:'居住',  e:'🏠', g:'day'},
  {k:'pet',  n:'宠物',  e:'🐱', g:'day'},
  {k:'daily',n:'日用',  e:'🧻', g:'day'},
  {k:'health',n:'医疗', e:'💊', g:'day'},
  {k:'fun',  n:'娱乐',  e:'🎮', g:'fun'},
  {k:'ai',   n:'AI充值',e:'🤖', g:'day'},
  {k:'sub',  n:'订阅',  e:'📱', g:'day'},
  {k:'give', n:'给家里',e:'🏡', g:'fix'},
  {k:'obj',  n:'给对象',e:'💝', g:'fix'},
  {k:'gift', n:'人情',  e:'🧧', g:'fun'},
  {k:'other',n:'其他',  e:'✨', g:'day'}
];
const CAT_MAP={};CATS.forEach(c=>CAT_MAP[c.k]=c);
function catInfo(k){ if(!k) k='other';
  const uc=userCats().find(c=>c.k===k);
  if(uc) return {n:uc.n,e:uc.e||'✨',g:'day',user:1};
  return CAT_MAP[k]||{n:'其他',e:'✨',g:'day'};
}
/* 用户自定义分类 */
function userCats(){ return ((S&&S.custom&&S.custom.cats)||[]); }
function findUserCat(k){ return userCats().find(c=>c.k===k); }
function allCats(){
  const uc=userCats();
  const mk=c=>({k:c.k,n:c.n,e:c.e||'✨',g:'day'});
  const ov={}, topK={};
  uc.forEach(c=>{ if(CAT_MAP[c.k]) ov[c.k]=c; if(c.top) topK[c.k]=1; });
  const out=[];
  uc.forEach(c=>{ if(c.top) out.push(mk(c)); });            /* 置顶(含内置改名版)排最前 */
  CATS.forEach(c=>{                                          /* 内置按原顺序，被覆盖的替换显示 */
    const o=ov[c.k];
    if(o){ if(!topK[c.k]) out.push({k:c.k,n:o.n,e:o.e||c.e,g:c.g}); }
    else out.push({k:c.k,n:c.n,e:c.e,g:c.g});
  });
  uc.forEach(c=>{ if(!c.top&&!CAT_MAP[c.k]) out.push(mk(c)); }); /* 普通自定义追加在后 */
  return out;
}
function catCol(k){ const uc=findUserCat(k); if(uc&&uc.c) return uc.c; return cCol(k); }
/* 收入来源：全部到账=活钱 */
const INCS=[
  {k:'salary',n:'工资'},{k:'help',n:'家人接济'},{k:'back',n:'存款转回(家人返我)'},
  {k:'bonus',n:'奖金'},{k:'other',n:'其他收入'}
];
/* 理财/存储账户 */
const ACCS=[
  {k:'ylb',n:'余利宝',kind:'bal'},          /* 余额型：本金累计=余额 */
  {k:'gold',n:'黄金',kind:'mv'}              /* 市值型：市值手动更新 */
];
const SAVE_KINDS=[{k:'car',n:'买车基金(给妈代存)'},{k:'other',n:'其他代存'}];

/* ---------- 默认状态 ---------- */
function defaults(){
  return {
    v:4, ver:APP_VER,
    onboard:false,
    t0:{ cash:0, acc:{ylb:0,gold_mv:0}, save:{car:0}, gold_cost:0 }, /* 期初快照 */
    profile:{ payday:5, payRule:{mode:'prev',day:5}, remind:false, remindH:21 },
    recs:[],            /* 流水 */
    goals:[{id:'car',name:'买车',target:20000}],
    plans:[],           /* 周期计划：弹性 */
    smart:{},           /* 备注→分类记忆 */
    tmpl:[],            /* 快捷模板(冻结) */
    custom:{cats:[]},   /* 用户自定义分类 [{k,n,e,c,top}] */
    funds:[],           /* 专项基金（锅）：为花而留的钱 {id,name,target,herIn,created} */
    stateFlags:{},      /* 状态开关，如 gold:'pause' */
    customHol:[], customWork:[],   /* 自定义放假/补班 */
    lastExport:'', lastRemind:'', created:''
  };
}
let S=defaults();
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){ toast('存储失败','err'); } }
function load(){
  try{ const raw=localStorage.getItem(KEY); if(!raw) return null; const d=JSON.parse(raw); return (d&&typeof d==='object')?d:null; }
  catch(e){ return null; }
}
function bootData(){
  const d=load();
  if(!d){ S=defaults(); return; }
  const b=defaults();
  S=Object.assign(b,d,{recs:Array.isArray(d.recs)?d.recs:[],plans:Array.isArray(d.plans)?d.plans:[],goals:Array.isArray(d.goals)&&d.goals.length?d.goals:b.goals,smart:d.smart||{},tmpl:Array.isArray(d.tmpl)?d.tmpl:[],stateFlags:d.stateFlags||{},customHol:Array.isArray(d.customHol)?d.customHol:[],customWork:Array.isArray(d.customWork)?d.customWork:[],custom:(d.custom&&Array.isArray(d.custom.cats))?d.custom:{cats:[]},funds:Array.isArray(d.funds)?d.funds:[]});
  S.t0=Object.assign({cash:0,acc:{ylb:0,gold_mv:0},save:{car:0},gold_cost:0}, d.t0||{});
  S.t0.acc=Object.assign({ylb:0,gold_mv:0}, (d.t0&&d.t0.acc)||{});
  S.t0.save=Object.assign({car:0}, (d.t0&&d.t0.save)||{});
  S.profile=Object.assign(b.profile,d.profile||{});
  S.profile.payRule=Object.assign(b.profile.payRule,(d.profile&&d.profile.payRule)||{});
  if(!S.created) S.created=TODAY();
}

/* ---------- 账户计算引擎 ----------
 * 语义：到手的钱才进活钱。
 * rec.type:
 *  exp 支出(自己付)        cash-
 *  obj 亲密付/对方付       cash±0（不扣我活钱，单列统计）
 *  inc 收入到账            cash+（src 只作标签）
 *  mv  理财搬移 in/out     cash-/+, acc 累计, gold 另 mv
 *  sv  代存 in/out(goal)   cash-/+, save 累计
 * ---------------------------------------------------------------- */
function cashNow(){
  let c=S.t0.cash||0;
  S.recs.forEach(r=>{
    if(r.type==='exp'){ if(!r.srcFund) c-=+r.amt||0; }        /* 专项花销早已拨出，不再扣活钱 */
    else if(r.type==='inc') c+=+r.amt||0;
    else if(r.type==='mv'){ if(r.dir==='in') c-=+r.amt||0; else c+=+r.amt||0; }
    else if(r.type==='sv'){ if(r.dir==='in') c-=+r.amt||0; else c+=+r.amt||0; }
    else if(r.type==='fd'){ if(r.dir==='in') c-=+r.amt||0; else if(r.dir==='out') c+=+r.amt||0; } /* xf 基金间结转不动活钱 */
  });
  return Math.round(c*100)/100;
}
function accIn(acc){ /* 累计买入-赎回 */
  let a=S.t0.acc[acc==='gold'?'gold_mv':'ylb']||0, b=0;
  S.recs.forEach(r=>{ if(r.type==='mv'&&r.acc===acc){ if(r.dir==='in') b+=+r.amt||0; else b-=+r.amt||0; } });
  return Math.round((acc==='gold'?S.t0.acc.gold_mv||0:b)*100)/100;
}
function accVal(k){
  if(k==='ylb'){
    let v=S.t0.acc.ylb||0;
    S.recs.forEach(r=>{ if(r.type==='mv'&&r.acc==='ylb'){ v+=(r.dir==='in'?1:-1)*(+r.amt||0); } });
    return Math.round(v*100)/100;
  }
  if(k==='gold'){
    /* 市值型：有"更新市值(mvup)"则用最新市值；
       否则期初填了市值用期初；再否则用买入累计成本当近似市值（买到即入账） */
    let last=null;
    S.recs.forEach(r=>{ if(r.type==='mvup'&&r.acc==='gold') last=+r.amt||0; });
    if(last!=null) return last;
    if(S.t0.acc.gold_mv) return S.t0.acc.gold_mv;
    let cost=(S.t0.gold_cost||0);
    S.recs.forEach(r=>{ if(r.type==='mv'&&r.acc==='gold'){ cost+=(r.dir==='in'?1:-1)*(+r.amt||0); } });
    return Math.round(Math.max(0,cost)*100)/100;
  }
  return 0;
}
function saveVal(k){
  let v=(S.t0.save&&S.t0.save[k])||0;
  S.recs.forEach(r=>{ if(r.type==='sv'&&r.goal===k){ v+=(r.dir==='in'?1:-1)*(+r.amt||0); } });
  return Math.round(v*100)/100;
}
/* ================= 专项基金（锅）：为花而留的钱，非储蓄 =================
 * rec: fd  {type:'fd', dir:'in'|'out'|'xf', fund:id, to?:id}  放入/退回走活钱；xf 基金间结转
 *       exp {type:'exp', srcFund:id}                            花销从锅出（不扣活钱）
 * 口径：拨出不减净资产；花销才算消费；退回=钱回活钱可再花 */
const r2=n=>Math.round(n*100)/100;
const amtOf=r=>+r.amt||0;
function funds(){ return (S&&Array.isArray(S.funds))?S.funds.filter(f=>!f.dead):[]; }
function fundOf(id){ const all=(S&&Array.isArray(S.funds))?S.funds:[]; return all.find(f=>f.id===id); }
function fundName(id){ const f=fundOf(id); return f?f.name:(id||''); }
function fundBal(id){ /* 锅底=我放入−退回−结转出+结转入−已花 */
  let b=0;
  S.recs.forEach(r=>{
    if(r.type==='fd'&&r.fund===id){ if(r.dir==='in') b+=amtOf(r); else if(r.dir==='out') b-=amtOf(r); else if(r.dir==='xf') b-=amtOf(r); }
    else if(r.type==='fd'&&r.dir==='xf'&&r.to===id) b+=amtOf(r);
    else if(r.type==='exp'&&r.srcFund===id) b-=amtOf(r);
  });
  return r2(b);
}
function fundPutIn(id){ /* 累计我放入 */
  return r2(S.recs.filter(r=>r.type==='fd'&&r.fund===id&&r.dir==='in').reduce((s,r)=>s+amtOf(r),0));
}
function fundSpent(id){ /* 累计从锅花销 */
  return r2(S.recs.filter(r=>r.type==='exp'&&r.srcFund===id).reduce((s,r)=>s+amtOf(r),0));
}
function fundRecs(id){
  return S.recs.filter(r=>(r.type==='fd'&&(r.fund===id||(r.dir==='xf'&&r.to===id)))||(r.type==='exp'&&r.srcFund===id))
    .slice().sort((x,y)=>cmpD(y.d,x.d)||(y.ts||0)-(x.ts||0));
}
function fundsTotal(){ return r2(funds().reduce((s,f)=>s+fundBal(f.id),0)); }
/* 本周期内从专项花销的合计（单列展示用） */
function fundsSpentIn(arr){ return r2(arr.filter(r=>r.type==='exp'&&r.srcFund).reduce((s,r)=>s+amtOf(r),0)); }
function assets(){
  const cash=cashNow(), ylb=accVal('ylb'), gold=accVal('gold');
  let save=0; Object.keys(S.t0.save||{}).forEach(k=>{ const sv=saveVal(k); if(sv>0) save+=sv; });
  S.recs.forEach(r=>{ if(r.type==='sv'&&!S.t0.save[r.goal]&&r.dir==='out') save=Math.max(0,save-(+r.amt||0)); });
  const fnd=fundsTotal();
  return {cash,ylb,gold,save,funds:fnd,total:Math.round((cash+ylb+gold+save+fnd)*100)/100};
}
/* 对象付累计（不扣我钱，但统计她替我付了多少） */
function objPaidTotal(){
  return Math.round(S.recs.filter(r=>r.type==='obj').reduce((s,r)=>s+(+r.amt||0),0)*100)/100;
}
/* 本期(当前发薪周期)到账合计 */
function periodIn(recs){
  return Math.round(recs.filter(r=>r.type==='inc').reduce((s,r)=>s+(+r.amt||0),0)*100)/100;
}
function periodSpent(recs){ /* 我自己日常的消费（专项花销不算，钱是过去拨的） */
  return Math.round(recs.filter(r=>r.type==='exp'&&!r.srcFund).reduce((s,r)=>s+(+r.amt||0),0)*100)/100;
}

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

/* ================================================================
   v4 — ui-main-a：导航 / 引导 / 记一笔主流程
   ================================================================ */
let curTab='home';
function $(id){return document.getElementById(id);}
let toastT=null;
function showToast(msg,type){
  const el=$('toast'); if(!el) return;
  el.textContent=msg; el.className='show'+(type?' '+type:''); el.style.display='block';
  clearTimeout(toastT); toastT=setTimeout(()=>{ el.className=''; setTimeout(()=>{el.style.display='none';},260); },1900);
}
function vibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||25); }catch(e){} }
/* ---------- 导航 ---------- */
function go(tab){
  if(recPage||pfOn){ recPage=false; pfOn=false; }   /* 整页表单开着时点导航=关闭返回原页 */
  if(tab===curTab&&tab==='fund'&&fundOpen) fundOpen=null;   /* 再点专项=回列表 */
  curTab=tab;
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===tab));
  render();
}
function render(){
  const v=$('view');
  if(!S.onboard){ renderOnboard(); return; }
  if(recPage){ v.innerHTML=recShell(); bindViewActions(); return; }   /* 记一笔=整页表单(输入不被键盘挡) */
  if(pfOn){ v.innerHTML=pfHead(pfTitle)+pfHtml; bindViewActions(); return; }   /* 通用整页表单(计划项/专项基金/导入) */
  if(curTab==='home') v.innerHTML=renderHome();
  else if(curTab==='cycle') v.innerHTML=renderCycle();
  else if(curTab==='invest') v.innerHTML=renderInvest();
  else if(curTab==='goal') v.innerHTML=renderGoal();
  else if(curTab==='fund') v.innerHTML=renderFund();
  else if(curTab==='set') v.innerHTML=renderSet();
  bindViewActions();
}
/* ---------- Modal ---------- */
function openModal(html){ $('modal').innerHTML=html; $('mask').classList.add('on'); $('modal').classList.add('on'); }
function closeModal(){ $('mask').classList.remove('on'); $('modal').classList.remove('on'); }
/* ---------- 整页表单（输入弹窗的替代：小米浏览器键盘弹起不收缩视口，fixed 弹窗会被盖；改走页面内表单，浏览器保证输入框滚到键盘上方） ---------- */
let recPage=false, pfOn=false, pfTitle='', pfHtml='';
function pfHead(title){ return '<div class="c-head" style="margin:2px 2px 10px"><span style="color:var(--cy);cursor:pointer;font-size:14px" onclick="closePageForm()">‹ 返回</span><div class="c-title" style="margin-top:3px">'+title+'</div></div>'; }
function openPageForm(title,html){ pfTitle=title; pfHtml=html; pfOn=true; render(); }
function closePageForm(){ if(!pfOn) return; pfOn=false; render(); }
function recShell(){
  return '<div class="c-head" style="margin:2px 2px 10px"><span style="color:var(--cy);cursor:pointer;font-size:14px" onclick="closeSheet()">‹ 返回</span><div class="c-title" style="margin-top:3px">记一笔</div></div>'+
    '<div class="seg" id="segMode">'+
    '<button data-m="exp" class="'+(REC.mode==='exp'?'on':'')+'" onclick="setRecMode(\'exp\')">支出</button>'+
    '<button data-m="inc" class="'+(REC.mode==='inc'?'on':'')+'" onclick="setRecMode(\'inc\')">收入</button>'+
    '<button data-m="mv" class="'+(REC.mode==='mv'?'on':'')+'" onclick="setRecMode(\'mv\')">转入/转出</button></div>'+
    '<div id="recBox"></div>';
}
function openSheet(){ recPage=true; render(); }
function closeSheet(){ recPage=false; render(); }

/* ================= 首次引导（期初快照） ================= */
let obStep=0;
function renderOnboard(){
  const o=$('onboard'); o.style.display='block';
  const steps=[
    {t:'欢迎 🎉', sub:'打工人资金教练：帮你掌握资金、提升理财能力。先花 1 分钟告诉它你的家底（随时可改）。'},
    {t:'手头活钱', sub:'现在你随时能花的钱：微信/支付宝/银行卡里的活钱合计。', field:'obCash'},
    {t:'理财账户', sub:'余利宝余额、黄金目前市值（不知道成本可只填市值）。'},
    {t:'代存与目标', sub:'给家里代存的钱（如买车基金）现在有多少？目标想存到多少？'},
    {t:'发薪规则', sub:'每月几号发薪？遇节假日提前到放假前最后工作日。'}
  ];
  const s=steps[obStep];
  let body='';
  body+='<h2>'+s.t+'</h2><div class="sub">'+s.sub+'</div>';
  if(obStep===0){
    if(window._obImp){
      body+='<div style="margin:14px 0"><div class="fl">粘贴 Hermes 给你的初始化 JSON</div><textarea id="initTxt" rows="7" style="width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;color:var(--txt);padding:9px;font-size:9px;font-family:var(--mono);box-sizing:border-box" placeholder="粘贴 JSON…"></textarea><button class="btn cy" style="margin-top:10px" onclick="doInitImport()">导入并开始使用</button><div style="text-align:center;margin-top:10px"><span style="color:var(--txt3);font-size:12px" onclick="window._obImp=false;renderOnboard()">← 返回手动填写</span></div></div>';
    }else{
      body+='<div style="margin:18px 0;padding:14px;border:1px dashed var(--line2);border-radius:12px;background:var(--panel2)"><div style="font-size:13px;color:var(--txt2);margin-bottom:8px">已经有初始化数据？（Hermes 给你生成过导入包）</div><button class="btn ghost" style="background:rgba(0,229,255,.08);border-color:rgba(0,229,255,.4);color:var(--cy)" onclick="window._obImp=true;renderOnboard()">📥 粘贴导入初始化包</button></div>';
    }
  }
  else if(obStep===1){ body+=obInput('obCash','活钱金额',S.t0.cash); }
  else if(obStep===2){
    body+='<div class="field"><div class="fl">余利宝余额</div><input class="inp ob-in" data-k="ylb" type="number" inputmode="decimal" value="'+S.t0.acc.ylb+'"></div>';
    body+='<div class="field"><div class="fl">黄金当前市值</div><input class="inp ob-in" data-k="gold_mv" type="number" inputmode="decimal" value="'+S.t0.acc.gold_mv+'"></div>';
    body+='<div class="field"><div class="fh">黄金知道大概成本？</div><input class="inp ob-in" data-k="gold_cost" type="number" inputmode="decimal" value="'+S.t0.gold_cost+'" placeholder="不知道可留空"></div>';
  }
  else if(obStep===3){
    body+='<div class="field"><div class="fl">买车基金已存（在妈妈/家人那里）</div><input class="inp ob-in" data-k="save_car" type="number" inputmode="decimal" value="'+S.t0.save.car+'"></div>';
    body+='<div class="field"><div class="fl">买车目标金额</div><input class="inp ob-in" data-k="goal_car" type="number" inputmode="decimal" value="'+(S.goals.find(g=>g.id==='car')||{target:20000}).target+'"></div>';
  }
  else if(obStep===4){
    body+='<div class="field"><div class="fl">每月几号发薪</div><input class="inp ob-in" data-k="payday" type="number" inputmode="numeric" min="1" max="28" value="'+S.profile.payday+'"></div>';
    body+='<div class="field"><div class="fh">✅ 节假日自动提前到放假前最后工作日（沿用你现有规则）</div></div>';
    body+='<div class="field"><div class="fl">月薪约（用于教练估算，可不填）</div><input class="inp ob-in" data-k="salary_est" type="number" inputmode="decimal" placeholder="可选"></div>';
  }
  const btnTxt=obStep>=steps.length-1?'开始使用 →':'下一步';
  body+='<button class="btn cy" style="margin-top:18px" onclick="obNext()">'+btnTxt+'</button>';
  if(obStep>0) body+='<div style="text-align:center;margin-top:12px"><span style="color:var(--txt3);font-size:12px" onclick="obBack()">上一步</span></div>';
  o.innerHTML='<div style="max-width:420px;margin:0 auto;padding-top:30px">'+body+'</div>';
}
function obInput(k,label,v){ return '<div class="field"><div class="fl">'+label+'</div><input class="inp ob-in" data-k="'+k+'" type="number" inputmode="decimal" value="'+(v||'')+'"></div>'; }
function collectOb(){
  const m={};
  document.querySelectorAll('.ob-in').forEach(el=>{ m[el.dataset.k]=parseFloat(el.value)||0; });
  return m;
}
function obNext(){
  const m=collectOb();
  if(obStep===1) S.t0.cash=m.obCash||S.t0.cash;
  if(obStep===2){ S.t0.acc.ylb=m.ylb||0; S.t0.acc.gold_mv=m.gold_mv||0; S.t0.gold_cost=m.gold_cost||0; }
  if(obStep===3){ S.t0.save.car=m.save_car||0; const g=S.goals.find(x=>x.id==='car'); if(g) g.target=m.goal_car||g.target; }
  if(obStep===4){ S.profile.payday=m.payday||5; S.profile.payRule={mode:'prev',day:S.profile.payday}; if(m.salary_est) S._salaryEst=m.salary_est; }
  obStep++;
  if(obStep>=5){ S.onboard=true; save(); $('onboard').style.display='none'; render(); showToast('开始使用！先记一笔试试'); }
  else renderOnboard();
}
function obBack(){ if(obStep>0){ obStep--; renderOnboard(); } }
function editOnboard(){ obStep=1; renderOnboard(); }
function openInitImport(){ openPageForm('导入初始化包','<textarea class="inp" id="initTxt" rows="7" placeholder="粘贴 Hermes 给你的初始化 JSON" style="font-size:9px;font-family:var(--mono)"></textarea><div style="font-size:11px;color:var(--txt3)">只覆盖账本数据，不碰手机其它任何东西。</div><div style="display:flex;gap:9px;margin-top:12px"><button class="btn ghost" style="flex:1" onclick="closePageForm()">取消</button><button class="btn cy" style="flex:1" onclick="doInitImport()">导入并开始</button></div>'); }
function doInitImport(){
  const v=$('initTxt').value; if(!v||!v.trim()){ showToast('粘贴内容为空','warn'); return; }
  try{ const d=JSON.parse(v.trim()); if(!d||d.v!==4){ showToast('不是 v4 初始化包','err'); return; }
    S=d; S.onboard=true; save(); $('onboard').style.display='none'; closePageForm(); showToast('初始化完成 🎉','ok');
  }catch(e){ showToast('解析失败：'+e.message,'err'); }
}

/* ================= 记一笔 ================= */
const REC={mode:'exp', amt:'', cat:'food', src:'salary', payer:'me', srcFund:'', mvDir:'in', mvTo:'ylb', goal:'car', note:'', date:''};
function openRecord(mode){ REC.mode=mode||'exp'; REC.amt=''; REC.note=''; REC.date=TODAY(); openSheet(); renderRec(); }
function setRecMode(m){ REC.mode=m; document.querySelectorAll('#segMode button').forEach(b=>b.classList.toggle('on',b.dataset.m===m)); renderRec(); }
function padKey(k){ REC.amt=(REC.amt+k); if(REC.amt.indexOf('.')>=0&&REC.amt.split('.')[1].length>2) REC.amt=REC.amt.slice(0,-1); if(REC.amt.length>1&&REC.amt[0]==='0'&&REC.amt[1]!=='.') REC.amt=REC.amt.slice(1); }
function kbKey(k){
  if(k==='⌫') REC.amt=REC.amt.slice(0,-1);
  else if(k==='.'){ if(REC.amt.indexOf('.')<0) REC.amt=(REC.amt||'0')+'.'; }
  else { if(REC.amt==='0') REC.amt=k; else REC.amt+=k; if(parseFloat(REC.amt)>99999999) REC.amt=REC.amt.slice(0,-1); }
  renderRec();
}
function renderRec(){
  const box=$('recBox'); if(!box) return;
  const amtDisp=REC.amt||'0';
  let h='';
  h+='<div class="amt-disp'+(REC.mode==='inc'?'':'')+'"><span class="cur">¥</span><span class="val'+(REC.amt?'':' ph')+'" id="amtV">'+esc(amtDisp)+'</span></div>';
  h+='<div class="chips" id="pickArea"></div>';
  h+='<div style="display:flex;gap:8px;margin-top:9px">';
  h+='<div style="flex:1"><input class="inp" id="noteIn" placeholder="备注(可不填，如 午餐/地铁)" value="'+esc(REC.note)+'" oninput="REC.note=this.value;renderHint()"></div>';
  h+='<button class="mini" style="align-self:center" onclick="REC.date=todayInput();">📅</button></div>';
  h+='<div id="smartHint" style="font-size:11px;color:var(--txt3);min-height:16px;margin-top:5px"></div>';
  h+='<div class="kb">'+['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k=>'<button onclick="kbKey(\''+k+'\')">'+k+'</button>').join('')+'</div>';
  h+='<div style="display:flex;gap:9px;margin-top:11px"><button class="btn ghost" onclick="closeSheet()">取消</button><button class="btn cy" onclick="saveRec()">存 账</button></div>';
  box.innerHTML=h;
  renderPickArea();
  renderHint();
}
function todayInput(){ REC.date=prompt('日期(YYYY-MM-DD)', REC.date||TODAY())||REC.date; }
/* 分类在分类管理里改动后，若记账面板开着则即时刷新分类 chips */
function refreshPick(){ try{ if(recPage) renderPickArea(); }catch(e){} }
function setRecSrc(v){ /* 支出：钱从哪出（活钱/某专项基金/对象付） */
  if(v==='obj'){ REC.payer='obj'; REC.srcFund=''; }
  else{ REC.payer='me'; REC.srcFund=(v==='cash')?'':v.slice(2); }
  renderPickArea();
}
function renderPickArea(){
  const pa=$('pickArea'); if(!pa) return;
  let h='';
  if(REC.mode==='exp'){
    const list=allCats();
    if(!list.some(c=>c.k===REC.cat)) REC.cat=list.some(c=>c.k==='food')?'food':(list[0]?list[0].k:'other');
    h+=list.map(c=>'<div class="chip '+(REC.cat===c.k?'on':'')+'" style="'+(REC.cat===c.k?'background:'+catCol(c.k):'')+'" onclick="pickCat(\''+c.k+'\')">'+c.e+''+c.n+'</div>').join('');
    h+='<div class="chip" style="opacity:.6" onclick="openCatMgr()">✎ 管理</div>';
    /* 钱从哪出：活钱 / 专项基金 / 她付 */
    const curSrc=REC.payer==='obj'?'obj':(REC.srcFund?('f:'+REC.srcFund):'cash');
    const srcs=[{v:'cash',n:'活钱',st:'background:var(--gr);color:#04121a;font-weight:700'}]
      .concat(funds().map(f=>({v:'f:'+f.id,n:'锅·'+f.name,st:'background:var(--or);color:#04121a;font-weight:700'})))
      .concat([{v:'obj',n:'对象付(她出)',st:'background:var(--pu);color:#fff;font-weight:700'}]);
    h+='<div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;color:var(--txt3)">钱从哪出：</span>'+
       srcs.map(s=>'<div class="chip '+(curSrc===s.v?'on':'')+'" style="'+(curSrc===s.v?s.st:'')+'" onclick="setRecSrc(\''+s.v+'\')">'+s.n+'</div>').join('')+'</div>';
    if(REC.payer==='obj') h+='<div style="font-size:11px;color:var(--txt3);margin-top:6px">她付 → 单列统计，不进我的账（亲密付）</div>';
    else if(REC.srcFund) h+='<div style="font-size:11px;color:var(--or);margin-top:6px">从「'+fundName(REC.srcFund)+'」锅出：钱早拨出来了，不占活钱</div>';
  }
  else if(REC.mode==='inc'){
    h+=INCS.map(s=>'<div class="chip '+(REC.src===s.k?'on':'')+'" style="'+(REC.src===s.k?'background:var(--gr);color:#04121a;font-weight:700':'')+'" onclick="REC.src=\''+s.k+'\';renderPickArea()">'+s.n+'</div>').join('');
    h+='<div style="font-size:11px;color:var(--txt3);margin-top:7px">到账=活钱，都能花。来源只是标签（统计用）</div>';
  }
  else{ /* mv */
    h+='<div class="chips" style="margin-bottom:8px">'+
       '<div class="chip '+(REC.mvDir==='in'?'on':'')+'" style="'+(REC.mvDir==='in'?'background:var(--cy);color:#04121a;font-weight:700':'')+'" onclick="REC.mvDir=\'in\';renderPickArea()">→ 存入/买入</div>'+
       '<div class="chip '+(REC.mvDir==='out'?'on':'')+'" style="'+(REC.mvDir==='out'?'background:var(--ye);color:#04121a;font-weight:700':'')+'" onclick="REC.mvDir=\'out\';renderPickArea()">← 转回活钱</div></div>';
    const base=[{v:'ylb',n:'余利宝'},{v:'gold',n:'黄金'},{v:'car',n:'买车基金'},{v:'sav',n:'其他存钱'}];
    const targets=base.concat(funds().map(f=>({v:'f:'+f.id,n:'专项·'+f.name})));
    h+='<div class="chips">'+targets.map(t=>'<div class="chip '+(REC.mvTo===t.v?'on':'')+'" style="'+(REC.mvTo===t.v?'background:var(--pu);color:#fff;font-weight:700':'')+'" onclick="REC.mvTo=\''+t.v+'\';renderPickArea()">'+t.n+'</div>').join('')+'</div>';
    const fSel=REC.mvTo.slice(0,2)==='f:';
    h+='<div style="font-size:11px;color:var(--txt3);margin-top:7px">'+(fSel
      ?(REC.mvDir==='in'?'钱从我活钱转入「'+fundName(REC.mvTo.slice(2))+'」锅：留出来专门花':'从「'+fundName(REC.mvTo.slice(2))+'」锅退回活钱（钱回来继续可花，不算收入）')
      :(REC.mvDir==='in'?'钱从我活钱转入：记录投资/存钱':'钱回到我活钱（本金回来，不算收入）'))+'</div>';
  }
  pa.innerHTML=h;
}
function cCol(k){ const C={food:'#00E5FF',traffic:'#FFD60A',shop:'#FF2E88',home:'#00FFA3',pet:'#FF8A3D',daily:'#8CA3C0',health:'#FF4D4D',fun:'#B06BFF',ai:'#00E5FF',sub:'#FF8A3D',give:'#FF4D4D',obj:'#FF2E88',gift:'#FFD60A',other:'#55698A'}; return C[k]||'#55698A'; }
function pickCat(k){ REC.cat=k; renderPickArea(); }
function renderHint(){
  const el=$('smartHint'); if(!el) return;
  const note=String(REC.note||'').trim(); if(!note){ el.textContent=''; return; }
  const g=smartGuess(note);
  if(g){ el.innerHTML='💡 记得是 <b style="color:var(--cy)">'+catInfo(g.cat).n+'</b> <span style="margin-left:8px" onclick="REC.cat=\''+g.cat+'\';REC.note=note;renderPickArea();renderHint()">采用</span>'; }
}
function saveRec(){
  const amt=Math.round((parseFloat(REC.amt)||0)*100)/100;
  if(!(amt>0)){ showToast('先输金额','warn'); return; }
  const note=String(REC.note||'').trim();
  const rec={id:uid(),d:REC.date||TODAY(),amt,note,ts:nowTs()};
  if(REC.mode==='exp'){
    if(REC.payer==='obj'){ rec.type='obj'; rec.cat=REC.cat; }
    else { rec.type='exp'; rec.cat=REC.cat; if(REC.srcFund) rec.srcFund=REC.srcFund; else if(note) smartLearn(note,REC.cat); }
  }
  else if(REC.mode==='inc'){ rec.type='inc'; rec.src=REC.src; }
  else{ /* mv */
    if(REC.mvTo.slice(0,2)==='f:'){ /* 专项基金：放入=活钱→锅；转出=退回活钱 */
      rec.type='fd'; rec.dir=REC.mvDir; rec.fund=REC.mvTo.slice(2); rec.note=note||(REC.mvDir==='in'?'放入':'退回');
    }
    else if(REC.mvDir==='in'){
      if(REC.mvTo==='ylb'||REC.mvTo==='gold'){ rec.type='mv'; rec.dir='in'; rec.acc=REC.mvTo; if(REC.mvTo==='gold'&&note==='') note='黄金买入'; }
      else { rec.type='sv'; rec.dir='in'; rec.goal=REC.mvTo==='car'?'car':'oth'; }
    }else{
      if(REC.mvTo==='ylb'||REC.mvTo==='gold'){ rec.type='mv'; rec.dir='out'; rec.acc=REC.mvTo; }
      else { rec.type='sv'; rec.dir='out'; rec.goal=REC.mvTo==='car'?'car':'oth'; }
    }
    rec.note=note;
  }
  S.recs.push(rec); save();
  vibrate();
  const a=assets();
  if(rec.type==='exp'&&rec.cat==='give'){} 
  closeSheet();
  showToast('已记 '+money(amt)+(rec.type==='obj'?'（对象付）':''),'ok');
  /* 连记：留在表单 */
  if(REC.mode!=='mv'){ setTimeout(()=>openRecord(REC.mode),60); }
}

/* ================================================================
   v4 — ui-pages-1：首页仪表盘 + 周期页
   ================================================================ */
function bindViewActions(){ /* 大部分交互走全局 onclick */ }
function goalOf(id){ return (S.goals||[]).find(g=>g.id===id); }
function saveProgress(id){ const v=saveVal(id); const g=goalOf(id); if(!g) return 0; return g.target?Math.min(100,Math.round(v/g.target*100)):0; }
/* ---------------- 教练 feed（本地规则，动态阈值） ---------------- */
function coachFeed(){
  const cards=[];
  const a=assets(), toNext=daysToNextPay(), today=+TODAY().slice(8,10);
  const cyc=recsInCycle();
  const inc=periodIn(cyc), exp=cyc.filter(r=>r.type==='exp'&&!r.srcFund).reduce((s,r)=>s+(+r.amt||0),0);
  /* 1) 发薪日提醒 */
  if(TODAY()===nextPayday()||(today<=2&&cyc.length<3)) cards.push({q:'今天/刚发薪 💰',a:'记一下工资到账（收入→工资），教练好帮你规划这个周期。',w:'ok',btn:['记工资'],act:'inc'});
  /* 2) 到期计划 */
  plansDue().forEach(x=>{
    if(x.due){
      const t=(x.p.type==='mv')?(x.p.acc==='gold'?'黄金':'余利宝'):((x.p.goal)?((goalOf(x.p.goal)||{}).name||'存钱'):'支出');
      cards.push({q:'计划到期：'+x.p.name,a:'每月 '+x.p.day+' 日 · 默认 '+money(x.p.amt)+(x.p.flex?'（弹性金额，确认实际数）':'')+(x.p.skip?'':'，点一下记或跳'),w:'ye',due:x.p,act:'plan'});
    }
  });
  /* 3) 节奏/超速（动态：以活钱÷剩余天数为目标日均，看实际） */
  if(toNext>0){
    const targetDaily=Math.round(a.cash/toNext*100)/100;
    const daysPassed=Math.max(1,today-1);
    const actualDaily=Math.round(exp/daysPassed*100)/100;
    if(actualDaily>targetDaily*1.15&&targetDaily>=0){
      /* 找超速大头 */
      const byCat={}; cyc.filter(r=>r.type==='exp'&&!r.srcFund).forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+(+r.amt||0); });
      let top=null; Object.keys(byCat).forEach(k=>{ if(!top||byCat[k]>byCat[top]) top=k; });
      const cut=Math.max(0,Math.round((actualDaily-targetDaily)*toNext));
      cards.push({q:'花钱有点快了 ⚡',a:'最近日均 '+money(actualDaily)+'，按活钱够撑 '+money(targetDaily)+'/天。照这速度到下次发薪会超约 '+money(cut)+'。大头在「'+catInfo(top||'other').n+'」('+money(byCat[top||'other'])+')。接下来每天压到 '+money(Math.max(0,targetDaily))+' 就能稳。',w:'bad'});
    } else if(actualDaily>0&&actualDaily<=targetDaily*.6){
      cards.push({q:'节奏健康 ✅',a:'日均 '+money(actualDaily)+'，低于可花 '+money(targetDaily)+'/天，给自律点赞。多出的可以转入余利宝/买车基金。',w:'ok'});
    }
  }
  /* 4) 低活钱提醒 */
  if(toNext>0&&a.cash<Math.round((a.cash/toNext)*Math.min(7,toNext))&&a.cash<300) cards.push({q:'活钱不多了 ⚠️',a:'手头 '+money(a.cash)+'。注意别在月底前花光，必要时可转回余利宝一点。',w:'ye'});
  /* 5) 目标里程碑 */
  const car=goalOf('car');
  if(car&&car.target){ const v=saveVal('car'); const pct=Math.round(v/car.target*100);
    if(pct>=100) cards.push({q:'🎉 买车目标达成了！',a:'已存到 '+money(v)+'。可以把目标提高到新的数额，或者开始真正的买车计划。',w:'ok'});
    else if(pct>=50&&pct<100&&Math.abs(pct-((S.stateFlags||{})._carPct||-1))>=20) cards.push({q:'存车过半 🚗 '+pct+'%',a:'已 '+money(v)+'/'+money(car.target)+'。按现在的节奏，很快就能摸到车了。',w:'ok'});
  }
  /* 6) 黄金状态提示（一次性，不烦） */
  if(S.stateFlags&&S.stateFlags.gold==='pause'&&!S.stateFlags.goldTipShown){
    cards.push({q:'黄金在观望中 🥇',a:'你之前定投暂停、改存余利宝。金价如果回调到你心理价位，记得来恢复定投；没回调就继续等，不追高。',w:'ye',act:'goldTip'});
  }
  /* 7) 亲密付人情小结 */
  const op=objPaidTotal(); if(op>0&&op>=50) cards.push({q:'对方为你付过 '+money(op)+' 💕',a:'记账了对象/亲密付的花销。关系是双向的——也别忘了表达。',w:'ok'});
  return cards;
}
/* ---------------- 首页 ---------------- */
function renderHome(){
  const a=assets(), toNext=daysToNextPay(), cyc=recsInCycle();
  const inc=periodIn(cyc), exp=cyc.filter(r=>r.type==='exp'&&!r.srcFund).reduce((s,r)=>s+(+r.amt||0),0);
  const daily=toNext>0?Math.round(a.cash/toNext*100)/100:null;
  const recent=S.recs.slice().sort((x,y)=>(y.d+ (y.ts||0)/1e13)-(x.d+(x.ts||0)/1e13)).slice(0,6);
  let h='';
  /* 资产 hud */
  h+='<div class="card gr-b"><div class="c-head"><div class="c-title">FUND / 资金</div><div class="c-sub">'+cycleLabel()+' · 距发薪 '+toNext+' 天</div></div>'+
     '<div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 8px"><span style="color:var(--txt3);font-size:12px">还能花</span><span class="big-num" style="font-size:34px;color:var(--gr)">'+money(a.cash)+'</span>'+
     (daily!=null?'<span style="margin-left:auto;font-size:12px;color:var(--cy)">日均 <b style="font-size:16px">'+money(daily)+'</b></span>':'')+'</div>'+
     '<div class="assets">'+assetChip('活钱',money(a.cash),'gr')+assetChip('余利宝',money(a.ylb),'cy')+assetChip('黄金',money(a.gold),'ye')+assetChip('代存',money(a.save),'pu')+assetChip('专项',money(a.funds),'or')+assetChip('净资产',money(a.total),'','total')+'</div></div>';
  /* 本周期到账/支出 */
  h+='<div class="hud"><div class="cell"><div class="k">本周期到账</div><div class="v gr">'+money(inc)+'</div></div>'+
     '<div class="cell"><div class="k">本周期支出</div><div class="v '+(exp>daily?'mg':'')+'">'+money(exp)+'</div></div>'+
     '<div class="cell"><div class="k">对方代付</div><div class="v pu">'+money(objPaidTotal())+'</div></div></div>';
  /* 教练 feed */
  const feed=coachFeed();
  if(feed.length){
    h+='<div class="c-head" style="margin:14px 2px 6px"><div class="c-title" style="color:var(--gr)">COACH / 教练</div></div>';
    h+=feed.map(f=>{
      let btn='';
      if(f.act==='inc') btn='<button class="mini" style="margin-top:8px" onclick="openRecord(\'inc\')">记工资</button>';
      else if(f.act==='plan') btn='<button class="mini cy" style="margin-top:8px" onclick="doPlan(\''+f.due.id+'\')">记这笔</button><button class="mini" style="margin-top:8px;margin-left:6px" onclick="skipPlan(\''+f.due.id+'\')">本月跳过</button>';
      else if(f.act==='goldTip') btn='<button class="mini" style="margin-top:8px;margin-left:6px" onclick="S.stateFlags.goldTipShown=1;save();render()">知道了</button>';
      return '<div class="card coach '+(f.w==='bad'?'bad':(f.w==='ye'?'warn':'ok'))+'">'+
        '<div class="q">'+f.q+'</div><div class="a">'+f.a+'</div>'+btn+'</div>';
    }).join('');
  }
  /* 快捷模板 */
  const tpls=topTpls();
  if(tpls.length){
    h+='<div class="card"><div class="c-head"><div class="c-title">QUICK / 常记</div></div><div style="display:flex;gap:7px;overflow-x:auto">'+
      tpls.map((t,i)=>'<div style="flex-shrink:0;background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:8px 11px;text-align:center" onclick="useTpl('+i+')"><div style="font-size:11px">'+esc(t.note||catInfo(t.cat).n)+'</div><div style="font-family:var(--mono);color:var(--cy);font-size:12px;margin-top:2px">'+fmt(t.amt)+'</div></div>').join('')+'</div></div>';
  }
  /* 最近流水 */
  h+='<div class="c-head" style="margin:12px 2px 2px"><div class="c-title">RECENT / 最近</div><div class="c-sub" style="cursor:pointer" onclick="go(\'cycle\')">全部 →</div></div>';
  if(!recent.length) h+='<div class="empty">还没有记录<br><span style="font-size:11.5px">点右下角 ＋ 记第一笔</span></div>';
  else h+='<div class="card" style="padding-top:4px">'+recent.map(recRow).join('')+'</div>';
  return h;
}
function assetChip(n,m,c,extra){ return '<div class="a '+(extra||'')+'"><div class="n">'+n+'</div><div class="m" style="color:var(--'+(c||'txt')+')">'+m+'</div></div>'; }
function recRow(r){
  let ic='💸',c='var(--txt)',t1='',t2='';
  if(r.type==='inc'){ const si=INCS.find(x=>x.k===r.src)||{}; ic='💰'; c='var(--gr)'; t1=si.n||'收入'; t2=(r.note||TODAY())&&(r.d); }
  else if(r.type==='exp'&&r.srcFund){ ic='🎒'; c='var(--or)'; t1=r.note||'专项花销'; t2='专项·'+fundName(r.srcFund)+(r.cat?' · '+catInfo(r.cat).n:'')+' · '+r.d; }
  else if(r.type==='exp'||r.type==='obj'){ const ci=catInfo(r.cat); ic=ci.e; c=r.type==='obj'?'var(--pu)':'var(--mg)'; t1=r.note||ci.n; t2=ci.n+(r.type==='obj'?' · 对象付':'')+' · '+r.d; }
  else if(r.type==='mv'){ const an=(r.acc==='gold'?'黄金':'余利宝'); ic=r.dir==='in'?'📥':'📤'; c=r.dir==='in'?'var(--or)':'var(--cy)'; t1=(r.note||(r.dir==='in'?'买入':'赎回'))+' '+an; t2=r.d; }
  else if(r.type==='sv'){ const gn=(goalOf(r.goal)||{name:r.goal==='car'?'买车基金':'代存'}).name; ic=r.dir==='in'?'🏦':'↩️'; c=r.dir==='in'?'var(--pu)':'var(--gr)'; t1=(r.note||gn)+(r.dir==='in'?' 存入':' 转回'); t2=r.d; }
  else if(r.type==='fd'){ if(r.dir==='xf'){ ic='🔁'; c='var(--txt2)'; t1='结转 '+(r.note||(fundName(r.fund)+'→'+fundName(r.to))); t2=r.d; }
    else{ ic=r.dir==='in'?'📥':'↩️'; c='var(--or)'; t1=(r.note||(r.dir==='in'?'放入':'退回'))+' · 专项·'+fundName(r.fund); t2=r.d; } }
  const outAmt=(r.type==='inc'||r.type==='sv'&&r.dir==='out'||r.type==='mv'&&r.dir==='out'||r.type==='fd'&&(r.dir==='out'||r.dir==='xf'))?'+':'−';
  if(r.type==='fd'&&r.dir==='xf'){ /* 结转行：金额不带±便于读(两方向都显示数额) */
    return '<div class="row"><div class="ic" style="background:rgba(255,255,255,.05)">'+ic+'</div><div class="mid"><div class="t1">'+esc(t1)+'</div><div class="t2">'+esc(t2)+'</div></div><div class="amt" style="color:'+c+'">'+fmt(r.amt)+'</div></div>';
  }
  return '<div class="row"><div class="ic" style="background:rgba(255,255,255,.05)">'+ic+'</div><div class="mid"><div class="t1">'+esc(t1)+'</div><div class="t2">'+esc(t2)+'</div></div><div class="amt '+(r.type==='inc'||r.type==='sv'&&r.dir==='out'||r.type==='mv'&&r.dir==='out'||r.type==='fd'&&r.dir==='out'?'':'mg')+'" style="color:'+c+'">'+(r.type==='exp'&&r.srcFund?'−':outAmt)+fmt(r.amt)+'</div></div>';
}
function useTpl(i){ const t=(window._tpls=topTpls())[i]; if(!t) return; S.recs.push({id:uid(),d:TODAY(),amt:t.amt,note:t.note,cat:t.cat,type:'exp',ts:nowTs()}); save(); render(); showToast('已记 '+esc(t.note)+' '+money(t.amt),'ok'); }
function delRec(id){ if(!confirm('删除这笔？')) return; S.recs=S.recs.filter(r=>r.id!==id); save(); render(); }
/* ---------------- 周期页 ---------------- */
function renderCycle(){
  const toNext=daysToNextPay(), a=assets(), cyc=recsInCycle();
  const inc=periodIn(cyc);
  const exps=cyc.filter(r=>r.type==='exp'&&!r.srcFund);
  const exp=exps.reduce((s,r)=>s+(+r.amt||0),0);
  const objs=cyc.filter(r=>r.type==='obj').reduce((s,r)=>s+(+r.amt||0),0);
  const fs=fundsSpentIn(cyc);
  const byCat={}; exps.forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+(+r.amt||0); });
  const sorted=Object.keys(byCat).sort((x,y)=>byCat[y]-byCat[x]);
  const maxV=sorted.length?byCat[sorted[0]]:0;
  const rows=cyc.slice().sort((x,y)=>cmpD(y.d,x.d)||(y.ts||0)-(x.ts||0));
  let h='';
  h+='<div class="card cy-b"><div class="c-head"><div class="c-title">CYCLE / 发薪周期</div><div class="c-sub">'+cycleLabel()+'</div></div>'+
     '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="color:var(--txt3);font-size:12px">距下次发薪</span><span class="big-num" style="font-size:30px;color:var(--cy)">'+toNext+' 天</span>'+
     '<span style="font-size:12px;color:var(--txt2)">(下次 '+nextPayday()+')</span></div>'+
     '<div style="font-size:12px;color:var(--txt3);margin-top:8px">到账 <b style="color:var(--gr)">'+money(inc)+'</b> · 支出 <b style="color:var(--mg)">'+money(exp)+'</b>'+(objs?' · 对象付 <b style="color:var(--pu)">'+money(objs)+'</b>':'')+(fs?' · 专项花销 <b style="color:var(--or)">'+money(fs)+'</b>':'')+'</div></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">SPEND / 花在哪</div></div>';
  if(!sorted.length) h+='<div class="empty">这个周期还没有支出</div>';
  else sorted.slice(0,6).forEach(k=>{ const v=byCat[k], p=maxV?Math.round(v/maxV*100):0, ci=catInfo(k); h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><span style="width:70px;font-size:12px;flex-shrink:0">'+ci.e+' '+ci.n+'</span><div class="bar" style="flex:1"><i style="width:'+p+'%;background:'+catCol(k)+'"></i></div><span style="font-family:var(--mono);font-size:12px">'+money(v)+'</span></div>'; });
  h+='<button class="btn ghost" style="margin-top:10px" onclick="copyDigest()">📤 生成简报发教练</button></div>';
  h+='<div class="c-head" style="margin:12px 2px 2px"><div class="c-title">FLOW / 流水</div><div class="c-sub">'+rows.length+' 笔</div></div>';
  if(!rows.length) h+='<div class="empty">本周期暂无记录</div>';
  else h+='<div class="card" style="padding-top:4px">'+rows.map(recRow).join('')+'</div>';
  return h;
}
/* 复制教练简报（给微信的我） */
function copyDigest(){
  const t=coachDigest();
  const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); showToast('已复制，粘贴发微信给教练','ok'); }catch(e){ showToast('复制失败','err'); }
  document.body.removeChild(ta);
}

/* ================================================================
   v4 — ui-pages-2：理财 + 目标
   ================================================================ */
/* ---------------- 理财 ---------------- */
function renderInvest(){
  const a=assets();
  const ym=TODAY().slice(0,7);
  const mIn=S.recs.filter(r=>r.type==='mv'&&r.dir==='in'&&YM(r.d)===ym).reduce((s,r)=>s+(+r.amt||0),0);
  const mOut=S.recs.filter(r=>r.type==='mv'&&r.dir==='out'&&YM(r.d)===ym).reduce((s,r)=>s+(+r.amt||0),0);
  const sIn=S.recs.filter(r=>r.type==='sv'&&r.dir==='in'&&YM(r.d)===ym).reduce((s,r)=>s+(+r.amt||0),0);
  let h='';
  h+='<div class="card cy-b"><div class="c-head"><div class="c-title">PORTFOLIO / 持仓</div><div class="c-sub">'+mLabel(ym)+' 投入 ¥'+fmt(mIn+mOut?mIn+mOut:0)+'</div></div>';
  /* 余利宝 */
  const ylbCost=S.recs.filter(r=>r.type==='mv'&&r.acc==='ylb'&&r.dir==='in').reduce((s,r)=>s+(+r.amt||0),0)+(S.t0.acc.ylb||0);
  h+='<div class="row"><div class="ic" style="background:rgba(0,229,255,.12)">💧</div><div class="mid"><div class="t1">余利宝</div><div class="t2">余额型 · 活钱 + '+fmt(ylbCost)+' 累计转入</div></div><div class="amt" style="color:var(--cy)">'+money(a.ylb)+'</div></div>';
  /* 黄金 */
  const gCost=(S.t0.gold_cost||0)+S.recs.filter(r=>r.type==='mv'&&r.acc==='gold'&&r.dir==='in').reduce((s,r)=>s+(+r.amt||0),0)-S.recs.filter(r=>r.type==='mv'&&r.acc==='gold'&&r.dir==='out').reduce((s,r)=>s+(+r.amt||0),0);
  const gKnown=!!(S.t0.gold_cost||S.recs.some(r=>r.type==='mv'&&r.acc==='gold'));
  const gGain=gCost>0?a.gold-gCost:null;
  const gp=S.stateFlags&&S.stateFlags.gold;
  h+='<div class="row"><div class="ic" style="background:rgba(255,214,10,.12)">🥇</div><div class="mid"><div class="t1">黄金 '+(gp==='pause'?'<span style="font-size:9px;color:var(--ye);border:1px solid rgba(255,214,10,.4);padding:1px 6px;border-radius:6px">观望中·定投暂停</span>':'')+'</div><div class="t2">'+(gKnown?'成本 '+fmt(Math.max(0,gCost))+(gGain!=null?(' · '+(gGain>=0?'+':'')+fmt(gGain)):''):'成本未知')+'</div></div><div class="amt" style="color:var(--ye)">'+money(a.gold)+'</div></div>';
  h+='<div style="display:flex;gap:8px;margin-top:10px">'+
     '<button class="mini cy" style="flex:1" onclick="openRecord(\'mv\')">记投入/转出</button>'+
     '<button class="mini" style="flex:1" onclick="updGoldMv()">更新黄金市值</button>'+
     '<button class="mini" style="flex:1" onclick="toggleGoldPause()">'+(gp==='pause'?'恢复定投':'暂停定投(观望)')+'</button></div>'+
     '<div style="font-size:11px;color:var(--txt3);margin-top:8px;line-height:1.6">余利宝=转入即余额；黄金=市值型，记得在涨跌后"更新市值"看真实盈亏。本金搬移不算收入。</div></div>';
  /* 本月投入流 */
  h+='<div class="card"><div class="c-head"><div class="c-title">FLOW / '+mLabel(ym)+' 投入</div></div>'+
     '<div class="grid2">'+
     '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--txt3)">理财转入</div><div style="font-family:var(--mono);color:var(--or);font-size:15px;margin-top:2px">'+money(mIn)+'</div></div>'+
     '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--txt3)">理财转回</div><div style="font-family:var(--mono);color:var(--cy);font-size:15px;margin-top:2px">'+money(mOut)+'</div></div>'+
     '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:9px;text-align:center"><div style="font-size:10px;color:var(--txt3)">代存(目标)</div><div style="font-family:var(--mono);color:var(--pu);font-size:15px;margin-top:2px">'+money(sIn)+'</div></div></div></div>';
  return h;
}
function mLabel(m){ return m.slice(0,4)+'年'+ (+m.slice(5,7))+'月'; }
function updGoldMv(){
  const cur=accVal('gold')||S.t0.acc.gold_mv||0;
  const v=prompt('黄金当前市值（更新后用于计算真实盈亏）', cur);
  if(v==null) return;
  const n=parseFloat(v); if(isNaN(n)||n<0){ showToast('无效','err'); return; }
  S.recs.push({id:uid(),d:TODAY(),amt:n,type:'mvup',acc:'gold',note:'更新市值',ts:nowTs()});
  save(); render(); showToast('黄金市值已更新','ok');
}
function toggleGoldPause(){
  if(!S.stateFlags) S.stateFlags={};
  if(S.stateFlags.gold==='pause'){ delete S.stateFlags.gold; showToast('已恢复，黄金建议重新活跃','ok'); }
  else { S.stateFlags.gold='pause'; showToast('已暂停定投·观望模式','ok'); }
  save(); render();
}
/* ---------------- 目标 ---------------- */
function renderGoal(){
  let h='';
  h+='<div class="c-head" style="margin:2px 2px 8px"><div class="c-title">GOALS / 目标</div><div class="c-sub">存进去的目标钱在"代存"里</div></div>';
  (S.goals||[]).forEach(g=>{
    const v=saveVal(g.id);
    const target=g.target||1;
    const pct=Math.min(100,Math.round(v/target*100));
    const e=g.id==='car'?'🚗':(g.id==='oth'?'💰':'🎯');
    h+='<div class="card '+(pct>=100?'gr-b':'')+'"><div class="row" style="border:none;padding:2px 0"><div class="ic" style="background:rgba(176,107,255,.14)">'+e+'</div>'+
      '<div class="mid"><div class="t1">'+esc(g.name)+(g.id==='car'?' <span style="font-size:10px;color:var(--txt3)">(妈妈代存)</span>':'')+'</div>'+
      '<div class="t2">已存 '+money(v)+' / '+money(target)+'</div></div>'+
      '<div style="text-align:right"><div class="amt" style="color:var(--pu);font-size:16px">'+pct+'%</div></div></div>'+
      '<div class="bar" style="margin:4px 0 10px"><i style="width:'+pct+'%;background:var(--pu)"></i></div>'+
      (pct>=100?'<div style="color:var(--gr);font-size:12px;margin-bottom:8px">🎉 达成！可以定新目标了</div>':'')+
      '<div style="display:flex;gap:8px"><button class="mini cy" style="flex:1" onclick="addToGoal(\''+g.id+'\')">存入</button>'+
      '<button class="mini" style="flex:1" onclick="goalBack(\''+g.id+'\')">转回活钱</button>'+
      '<button class="mini" style="flex:1" onclick="editGoal(\''+g.id+'\')">改目标</button></div></div>';
  });
  if(!(S.goals||[]).some(g=>g.id==='car')) h+='<div class="card"><div class="empty">还没有目标，点下方添加</div></div>';
  h+='<button class="btn ghost" style="margin-top:4px" onclick="addGoalPrompt()">＋ 加新目标</button>';
  return h;
}
function addToGoal(id){ REC.mode='mv'; REC.mvDir='in'; REC.mvTo=id==='car'?'car':'sav'; REC.goal=id; REC.amt=''; openSheet(); setRecMode('mv'); }
function goalBack(id){ REC.mode='mv'; REC.mvDir='out'; REC.mvTo=id==='car'?'car':'sav'; REC.goal=id; REC.amt=''; openSheet(); setRecMode('mv'); }
function editGoal(id){
  const g=(S.goals||[]).find(x=>x.id===id); if(!g) return;
  const v=prompt('目标名', g.name); if(v==null||!v.trim()) return;
  const t=prompt('目标金额', g.target||''); if(t==null) return;
  g.name=v.trim(); g.target=parseFloat(t)||0; save(); render();
}
function addGoalPrompt(){
  const n=prompt('新目标名（如：买车 / 旅行基金）'); if(!n||!n.trim()) return;
  const t=prompt('目标金额'); if(!t) return;
  S.goals=S.goals||[];
  const id='g'+uid().slice(-6);
  S.goals.push({id,name:n.trim(),target:parseFloat(t)||0});
  S.t0.save[id]=0;
  save(); render(); showToast('目标已添加：往「代存」存入即可','ok');
}

/* ================================================================
   v4 — ui-pages-fund：专项基金（锅）——为某件事留出来专门花的钱，不是储蓄
   ================================================================ */
let fundOpen=null;   /* 当前打开的基金 id，null=列表 */
function goFundDetail(id){ fundOpen=id; render(); }
function fundBack(){ fundOpen=null; render(); }

/* ---------------- 列表 ---------------- */
function renderFund(){
  if(fundOpen&&fundOf(fundOpen)) return fundDetail(fundOpen);
  const fs=funds();
  let h='';
  h+='<div class="c-head" style="margin:2px 2px 8px"><div class="c-title">FUNDS / 专项基金</div><div class="c-sub">为花而留的锅 · 不是储蓄</div></div>';
  if(!fs.length){
    h+='<div class="card"><div class="empty">还没有专项基金。<br>想旅游 / 办件事先留钱？建一个锅，把活钱放进去，到点专门花。</div>'+
       '<div style="font-size:11px;color:var(--txt3);line-height:1.7;margin-top:10px">和对象共用也适用：钱统一放一个人手上混着花，你的账只记「放入」和「退回」两笔，中间花销整体统计就行。</div></div>';
  }else{
    fs.forEach(f=>{
      const bal=fundBal(f.id), put=fundPutIn(f.id), sp=fundSpent(f.id), target=f.target||0;
      const pct=target>0?Math.min(100,Math.round(put/target*100)):0;
      h+='<div class="card" style="cursor:pointer" onclick="goFundDetail(\''+f.id+'\')">'+
        '<div class="c-head"><div class="c-title">🎒 '+esc(f.name)+(f.herIn>0?' <span style="font-size:9px;color:var(--pu);border:1px solid rgba(176,107,255,.4);padding:1px 6px;border-radius:6px">她放 ¥'+fmt(f.herIn)+'</span>':'')+'</div><div class="c-sub" style="color:var(--txt3)">详情 ›</div></div>'+
        '<div style="display:flex;align-items:baseline;gap:8px;margin:0 0 6px"><span style="color:var(--txt3);font-size:12px">锅底</span><span class="big-num" style="font-size:26px;color:var(--or)">'+money(bal)+'</span>'+
        (target>0?'<span style="margin-left:auto;font-size:12px;color:var(--txt3)">预算 '+money(target)+'</span>':'')+'</div>'+
        '<div style="display:flex;gap:14px;font-size:11.5px;color:var(--txt3)"><span>已放(我) <b style="color:var(--txt)">'+money(put)+'</b></span><span>已花 <b style="color:var(--mg)">'+money(sp)+'</b></span></div>'+
        (target>0?'<div class="bar" style="margin-top:7px"><i style="width:'+pct+'%;background:var(--or)"></i></div>':'')+
        '</div>';
    });
  }
  h+='<button class="btn cy" style="margin-top:6px" onclick="newFundPrompt()">＋ 新建专项基金</button>'+
     '<div style="font-size:11px;color:var(--txt3);margin-top:10px;line-height:1.7">用法：先把钱从活钱「放入」锅（净资产不变，只是留出来）；到了用它，记花销时选「锅·名字」出，或回来记一笔总账。花不完：留着下次 / 退回活钱 / 结转给别的基金。</div>';
  return h;
}

/* ---------------- 新建（整页表单：键盘弹起时输入框不会被盖住） ---------------- */
function newFundPrompt(){
  openPageForm('新建专项基金',
    '<div class="field"><div class="fl">名字</div><input class="inp" id="nf_name" placeholder="如：2026国庆旅行 / 办婚礼 / 学习班"></div>'+
    '<div class="field"><div class="fl">目标预算 ¥（可空）</div><input class="inp" id="nf_target" type="number" inputmode="decimal" placeholder="想留到多少，心里有数"></div>'+
    '<div class="field"><div class="fl">她放入 ¥（统计用，不进我的账；可空）</div><input class="inp" id="nf_her" type="number" inputmode="decimal" placeholder="0"></div>'+
    '<div style="font-size:11px;color:var(--txt3);line-height:1.7">对象的钱放进来只做整体统计，不进我的资产/收入，账才不会乱。</div>'+
    '<div style="display:flex;gap:9px;margin-top:14px"><button class="btn ghost" style="flex:1" onclick="closePageForm()">取消</button><button class="btn cy" style="flex:1" onclick="nfCreate()">创建</button></div>');
  setTimeout(()=>{ const i=$('nf_name'); if(i){ try{ i.focus(); }catch(e){} } },150);
}
function nfCreate(){
  const n=$('nf_name').value.trim(); if(!n){ showToast('起个名字','warn'); return; }
  const t=parseFloat($('nf_target').value)||0, her=parseFloat($('nf_her').value)||0;
  const id='f'+uid().slice(-6);
  S.funds=S.funds||[]; S.funds.push({id,name:n,target:t,herIn:her,created:TODAY()});
  save(); fundOpen=id; closePageForm(); showToast('已建「'+n+'」，可以把活钱放进去了','ok');
}

/* ---------------- 详情 ---------------- */
function fundDetail(id){
  const f=fundOf(id); if(!f) return '';
  const bal=fundBal(id), put=fundPutIn(id), sp=fundSpent(id), target=f.target||0;
  const pct=target>0?Math.min(100,Math.round(put/target*100)):0;
  const others=funds().filter(x=>x.id!==id);
  const rows=fundRecs(id);
  let h='';
  h+='<div style="margin:2px 0 8px"><span style="color:var(--cy);cursor:pointer;font-size:13px" onclick="fundBack()">‹ 返回</span></div>';
  h+='<div class="card cy-b"><div class="c-head"><div class="c-title">🎒 '+esc(f.name)+'</div>'+
     '<div class="c-sub" style="cursor:pointer" onclick="editFundMeta(\''+id+'\')">✎ 改名/预算</div></div>'+
     '<div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 6px"><span style="color:var(--txt3);font-size:12px">锅底(我的)</span><span class="big-num" style="font-size:32px;color:var(--or)">'+money(bal)+'</span>'+
     (target>0?'<span style="margin-left:auto;font-size:12px;color:var(--txt3)">预算 '+money(target)+' · 已放 '+pct+'%</span>':'')+'</div>'+
     (target>0?'<div class="bar" style="margin:2px 0 10px"><i style="width:'+pct+'%;background:var(--or)"></i></div>':'')+
     '<div class="hud"><div class="cell"><div class="k">我放入</div><div class="v or">'+money(put)+'</div></div>'+
     '<div class="cell"><div class="k">已花(锅出)</div><div class="v '+(sp>0?'mg':'')+'">'+money(sp)+'</div></div>'+
     '<div class="cell"><div class="k">她放入</div><div class="v pu" style="cursor:pointer" onclick="editHerIn(\''+id+'\')">'+money(f.herIn||0)+(f.herIn>0?' ✎':'')+'</div></div></div>'+
     '<div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">'+
     '<button class="mini cy" onclick="fundPut(\''+id+'\')">＋放入</button>'+
     '<button class="mini" style="background:rgba(255,45,85,.15);color:var(--mg)" onclick="fundSpendPrompt(\''+id+'\')">记花销</button>'+
     '<button class="mini" onclick="fundBackPrompt(\''+id+'\')">退回活钱</button>'+
     (others.length?'<button class="mini" onclick="fundXfPrompt(\''+id+'\')">结转…</button>':'')+
     '<button class="mini" onclick="fundDel(\''+id+'\')">删除</button></div>'+
     '<div style="font-size:11px;color:var(--txt3);margin-top:9px;line-height:1.7">她放/她付：只统计不进我账，整体看预算够不够。<b>她的钱放我这也别记成收入</b>——填「她放入」就行。</div></div>';
  /* 流水 */
  h+='<div class="c-head" style="margin:10px 2px 2px"><div class="c-title">FLOW / 这口锅</div><div class="c-sub">'+rows.length+' 笔</div></div>';
  h+=rows.length?'<div class="card" style="padding-top:4px">'+rows.map(recRow).join('')+'</div>':'<div class="empty">还没有流水<br>点「＋放入」先把钱留进来</div>';
  return h;
}
/* 操作：放钱进锅（走记一笔-转入，可带备注连记） */
function fundPut(id){
  const f=fundOf(id); if(!f) return;
  REC.mode='mv'; REC.mvDir='in'; REC.mvTo='f:'+id; REC.amt=''; REC.note='';
  openSheet(); setRecMode('mv');
  showToast('转入目的地已选「专项·'+f.name+'」','ok');
}
/* 记花销：省心总账式（逐笔可去记一笔选“锅·名”出） */
function fundSpendPrompt(id){
  const f=fundOf(id); if(!f) return;
  const v=prompt('「'+f.name+'」这趟/这笔花销 ¥（从锅出，钱已拨出不占活钱）'); if(v==null) return;
  const n=parseFloat(v); if(!(n>0)){ showToast('金额无效','warn'); return; }
  const note=prompt('备注（如：国庆云南 · 总花销；可空）','')||'';
  S.recs.push({id:uid(),d:TODAY(),amt:Math.round(n*100)/100,note:note.trim(),cat:'other',type:'exp',srcFund:id,ts:nowTs()});
  save(); render(); showToast('已记花销 '+money(n),'ok');
}
/* 退回活钱 */
function fundBackPrompt(id){
  const f=fundOf(id); if(!f) return;
  const bal=fundBal(id);
  const v=prompt('从「'+f.name+'」退回活钱 ¥（锅底 '+fmt(bal)+'）', bal>0?fmt(bal):'');
  if(v==null) return;
  const n=Math.round((parseFloat(v)||0)*100)/100;
  if(!(n>0)){ showToast('金额无效','warn'); return; }
  if(n>bal){ showToast('超过锅底了（锅底 '+money(bal)+'）','warn'); return; }
  S.recs.push({id:uid(),d:TODAY(),amt:n,note:'退回活钱',type:'fd',dir:'out',fund:id,ts:nowTs()});
  save(); render(); showToast('已退回 '+money(n)+' 到活钱','ok');
}
/* 结转给别的基金（不动活钱、净资产不变） */
let xfFrom=null;
function fundXfPrompt(id){ xfFrom=id; renderXf(); }
function renderXf(){
  const fs=funds().filter(f=>f.id!==xfFrom);
  if(!fs.length){ showToast('没有其它基金可结转','warn'); return; }
  openModal('<div class="mh">结转给哪个基金</div><div style="font-size:11px;color:var(--txt3);margin-bottom:8px">从「'+fundName(xfFrom)+'」挪到另一口锅（不动活钱，净资产不变）</div>'+
    fs.map(f=>'<button class="btn ghost" style="display:block;width:100%;margin-bottom:8px;text-align:left" onclick="xfDo(\''+f.id+'\')">🎒 '+esc(f.name)+'（锅底 '+fmt(fundBal(f.id))+'）</button>').join('')+
    '<button class="btn" style="width:100%" onclick="closeModal()">取消</button>');
}
function xfDo(to){
  const from=xfFrom; const bal=fundBal(from); if(bal<=0){ showToast('源锅底为 0，没什么可结转','warn'); return; }
  const v=prompt('结转金额 ¥（锅底 '+fmt(bal)+'）', fmt(bal)); if(v==null){ renderXf(); return; }
  const n=Math.round((parseFloat(v)||0)*100)/100;
  if(!(n>0)||n>bal){ showToast('金额无效或超过锅底','warn'); renderXf(); return; }
  S.recs.push({id:uid(),d:TODAY(),amt:n,note:'结转',type:'fd',dir:'xf',fund:from,to,ts:nowTs()});
  save(); closeModal(); render(); showToast('已结转 '+money(n)+' → '+fundName(to),'ok');
}
/* 编辑：改名/预算；她放入 */
function editFundMeta(id){
  const f=fundOf(id); if(!f) return;
  const nm=prompt('基金名字', f.name); if(nm==null) return;
  const tg=prompt('目标预算 ¥（0=不设）', f.target||''); if(tg==null) return;
  if(nm.trim()) f.name=nm.trim();
  f.target=Math.max(0,parseFloat(tg)||0);
  save(); render(); showToast('已保存','ok');
}
function editHerIn(id){
  const f=fundOf(id); if(!f) return;
  const v=prompt('她放入合计 ¥（统计用，不进我的账）', f.herIn||'0'); if(v==null) return;
  f.herIn=Math.max(0,parseFloat(v)||0);
  save(); render(); showToast('已保存','ok');
}
/* 删除：仅允许锅底 0（钱都花完或已退回/结转）；墓碑保留以便历史流水仍显示名字 */
function fundDel(id){
  const f=fundOf(id); if(!f) return;
  const bal=fundBal(id);
  if(bal!==0){ showToast('锅底还有 '+money(bal)+'，先退回活钱或结转掉再删','warn'); return; }
  if(!confirm('删除专项基金「'+f.name+'」？历史流水仍显示名字，统计不再列入')) return;
  f.dead=1;
  save(); fundOpen=null; render(); showToast('已删除','ok');
}

/* ================================================================
   v4 — ui-pages-3：设置 / 计划管理 / 数据
   ================================================================ */
/* ---------------- 计划到期处理 ---------------- */
function doPlan(id){
  const p=(S.plans||[]).find(x=>x.id===id); if(!p) return;
  const ym=TODAY().slice(0,7);
  let amt=+p.amt||0;
  if(p.flex){ const v=prompt('「'+p.name+'」本月实际金额', amt||''); if(v==null) return; amt=Math.round((parseFloat(v)||0)*100)/100; if(!(amt>0)){ showToast('金额无效','warn'); return; } }
  const rec={id:uid(),d:TODAY(),amt,note:p.name||'',ts:nowTs()};
  if(p.type==='exp'){ rec.type='exp'; rec.cat=p.cat||'other'; }
  else if(p.type==='mv'){ rec.type='mv'; rec.dir='in'; rec.acc=p.acc||'ylb'; }
  else if(p.type==='sv'){ rec.type='sv'; rec.dir='in'; rec.goal=p.goal||'car'; }
  else { rec.type='exp'; rec.cat=p.cat||'other'; }
  S.recs.push(rec); p.lastDone=ym;
  if(p.skip) p.skip=p.skip.filter(x=>x!==ym);
  save(); vibrate(); render(); showToast('已记 '+money(amt)+'：'+p.name,'ok');
}
function skipPlan(id){
  const p=(S.plans||[]).find(x=>x.id===id); if(!p) return;
  const ym=TODAY().slice(0,7);
  if(!confirm('本月跳过「'+p.name+'」？（下月自动恢复提醒）')) return;
  p.skip=p.skip||[]; p.skip.push(ym); p.lastDone=ym; save(); render(); showToast('已跳过本月','ok');
}
/* ---------------- 计划 CRUD ---------------- */
function planForm(id){
  const p=id?(S.plans||[]).find(x=>x.id===id):null;
  const cur=p||{name:'',day:1,amt:'',type:'exp',cat:'food',acc:'ylb',goal:'car',flex:false,on:true};
  const kindSel=[
    {v:'exp',n:'支出（日常固定：如猫399）'},
    {v:'mv:ylb',n:'转余利宝（定存）'},
    {v:'mv:gold',n:'买黄金（定投）'},
    {v:'sv:car',n:'存买车基金'},
    {v:'sv:oth',n:'存其他目标'}
  ];
  const curKind=(cur.type==='mv')?('mv:'+(cur.acc||'ylb')):((cur.type==='sv')?('sv:'+(cur.goal||'car')):'exp');
  openPageForm((p?'编辑':'新增')+'计划项',
    '<div class="field"><div class="fl">名称</div><input class="inp" id="pl_name" value="'+esc(cur.name||'')+'" placeholder="如：给妈妈 / 猫粮 / 黄金定投"></div>'+
    '<div class="field"><div class="fl">每月几号</div><input class="inp" id="pl_day" type="number" inputmode="numeric" min="1" max="28" value="'+(cur.day||1)+'"></div>'+
    '<div class="field"><div class="fl">默认金额</div><input class="inp" id="pl_amt" type="number" inputmode="decimal" value="'+cur.amt+'" placeholder="0"></div>'+
    '<div class="field"><div class="fl">类型</div><select class="inp" id="pl_kind">'+kindSel.map(o=>'<option value="'+o.v+'"'+(o.v===curKind?' selected':'')+'>'+o.n+'</option>').join('')+'</select></div>'+
    '<div class="field"><div class="fl">支出分类（类型选"支出"时）</div><select class="inp" id="pl_cat">'+allCats().map(c=>'<option value="'+c.k+'"'+(cur.cat===c.k?' selected':'')+'>'+c.e+c.n+'</option>').join('')+'</select></div>'+
    '<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--txt2);margin-bottom:14px"><input type="checkbox" id="pl_flex" '+(cur.flex?'checked':'')+' style="width:15px;height:15px;accent-color:var(--cy)"> 弹性金额（每月到期让我确认实际数）</label>'+
    '<div style="display:flex;gap:9px">'+(p?'<button class="btn mg" style="flex:1" onclick="delPlan(\''+p.id+'\')">删除</button>':'')+
    '<button class="btn ghost" style="flex:1" onclick="closePageForm()">取消</button>'+
    '<button class="btn cy" style="flex:1" onclick="savePlan('+(p?'\''+p.id+'\'':'null')+')">保存</button></div>');
}
function savePlan(id){
  const name=($('pl_name').value||'').trim(); if(!name){ showToast('写个名字','warn'); return; }
  const day=Math.max(1,Math.min(28,parseInt($('pl_day').value)||1));
  const amt=Math.round((parseFloat($('pl_amt').value)||0)*100)/100;
  const kind=$('pl_kind').value, cat=$('pl_cat').value, flex=$('pl_flex').checked;
  const [type,sub]=kind.split(':');
  const obj={name,day,amt,flex,cat,type:type||'exp'};
  if(type==='mv') obj.acc=sub||'ylb';
  if(type==='sv') obj.goal=sub||'car';
  if(id){ const p=S.plans.find(x=>x.id===id); if(p) Object.assign(p,obj); }
  else { S.plans=S.plans||[]; S.plans.push(Object.assign({id:uid(),on:true,lastDone:''},obj)); }
  save(); closePageForm(); showToast('已保存','ok');
}
function delPlan(id){ if(!confirm('删除这个计划？')) return; S.plans=(S.plans||[]).filter(x=>x.id!==id); save(); closePageForm(); }
function togglePlan(id){ const p=(S.plans||[]).find(x=>x.id===id); if(!p) return; p.on=!p.on; if(!p.on) p.lastDone=TODAY().slice(0,7); save(); render(); }
function planRowHtml(x){
  const st=plansDue().find(d=>d.p.id===x.id);
  const ym=TODAY().slice(0,7);
  const skipped=x.skip&&x.skip.includes(ym);
  const kindT=(x.type==='mv')?(x.acc==='gold'?'🥇黄金定投':'💧余利宝定存'):((x.type==='sv')?'🏦存'+((x.goal==='car'?'车':'钱')):'💸'+(catInfo(x.cat).e+catInfo(x.cat).n));
  return '<div class="row"><div class="ic" style="background:rgba(255,255,255,.05)">'+(kindT[0]||'📌')+'</div>'+
    '<div class="mid"><div class="t1">'+esc(x.name)+(x.flex?' <span style="color:var(--cy);font-size:9px;border:1px solid rgba(0,229,255,.4);padding:0 5px;border-radius:6px">弹性</span>':'')+'</div>'+
    '<div class="t2">每月 '+x.day+' 日 · '+money(x.amt)+(st&&st.done?' · 本月已记':(skipped?' · 本月跳过':(st&&st.due?' · 待记':' · 未到期')))+'</div></div>'+
    '<div style="display:flex;gap:6px;align-items:center">'+
    '<button class="mini" onclick="togglePlan(\''+x.id+'\')">'+(x.on?'⏸':'▶')+'</button>'+
    '<button class="mini" onclick="planForm(\''+x.id+'\')">✎</button></div></div>';
}
/* ---------------- 分类管理 ---------------- */
function catTag(c){ return findUserCat(c.k)?(CAT_MAP[c.k]?'<span style="font-size:9px;color:var(--cy)">已改</span>':'<span style="font-size:9px;color:var(--cy)">自定</span>'):'<span style="font-size:9px;color:var(--txt3)">内置</span>'; }
function catMgrRows(){
  const list=allCats();
  return '<div class="c-head"><div class="c-title">CATEGORY / 分类</div><div class="c-sub" style="cursor:pointer" onclick="addUserCat()">＋新增</div></div>'+
    list.map(c=>{ const isU=!!findUserCat(c.k);
      return '<div class="row"><div class="ic" style="background:rgba(255,255,255,.05)">'+c.e+'</div>'+
      '<div class="mid"><div class="t1">'+esc(c.n)+' '+catTag(c)+'</div>'+
      (CAT_MAP[c.k]&&!isU?'':'<div class="t2">'+(CAT_MAP[c.k]?'同名覆盖内置：历史流水自动显示新名':'历史记录随改名同步')+'</div>')+'</div>'+
      (isU?('<button class="mini" onclick="toggleTopCat(\''+c.k+'\')">'+(findUserCat(c.k).top?'取消置顶':'置顶')+'</button>'+
            '<button class="mini" onclick="editCat(\''+c.k+'\')">改名</button>'+
            '<button class="mini mg" onclick="delUserCat(\''+c.k+'\')">'+(CAT_MAP[c.k]?'还原':'删')+'</button>')
           :'<button class="mini" onclick="editCat(\''+c.k+'\')">改名</button>')+
      '</div>'; }).join('');
}
function renderCatMgr(){ openModal('<div class="mh">分类管理</div>'+catMgrRows()+
  '<div style="font-size:11px;color:var(--txt3);margin-top:10px">内置分类也能改名字/图标（改后历史流水同步显示新名）；自定义分类可置顶/改名/删除，删除后其历史显示为「其他」。点遮罩关闭。</div>'); }
function openCatMgr(){ renderCatMgr(); }
/* 编辑分类（内置=建同名覆盖；自定义=改名/换图标）。返回 false=取消/无改动 */
function editCat(k){
  const base=CAT_MAP[k]?CAT_MAP[k]:null;
  const ex=findUserCat(k);
  const oldN=ex?(ex.n||''):(base?base.n:'');
  const oldE=ex?(ex.e||''):(base?base.e:'');
  const nm0=prompt('分类名称（历史记录会同步显示新名字）',oldN); if(nm0==null) return;
  const nm=nm0.trim(); if(!nm){ showToast('名称不能为空','warn'); return; }
  if(!ex&&!base){ showToast('分类不存在','err'); return; }
  const e0=prompt('图标（输入一个 emoji，留空保持不变）',oldE||'✨'); if(e0==null) return;
  const em=(e0&&e0.trim())?e0.trim():oldE;
  if(ex&&nm===ex.n&&em===(ex.e||'')){ return; }
  if(allCats().some(x=>x.k!==k&&x.n===nm)){ showToast('已有同名分类（'+nm+'），换个名','warn'); return; }
  if(ex){ ex.n=nm; ex.e=em; }
  else S.custom.cats.push({k,n:nm,e:em,top:false});
  afterCatEdit();
  showToast('已保存：'+catInfo(k).e+' '+catInfo(k).n,'ok');
}
function addUserCat(){
  const n=prompt('新分类名称（如：咖啡 / 话费 / 打车）'); if(!n||!n.trim()) return;
  const e=prompt('图标（可输入一个 emoji，如 ☕ 📱 🚕；留空默认 ✨）')||'✨';
  const nm=n.trim();
  if(allCats().some(c=>c.n===nm)){ showToast('已有同名分类（'+nm+'）','warn'); return; }
  const k='c'+uid().slice(-8);
  const PAL=['#00E5FF','#FF2E88','#00FFA3','#FFD60A','#B06BFF','#FF8A3D','#FF4D4D','#8CA3C0'];
  S.custom.cats.push({k,n:nm,e:e.trim()||'✨',c:PAL[S.custom.cats.length%PAL.length],top:false});
  afterCatEdit(); showToast('已添加「'+nm+'」','ok');
}
function delUserCat(k){
  const c=findUserCat(k); if(!c) return;
  const isB=!!CAT_MAP[k];
  if(!confirm(isB?('把「'+c.n+'」还原成内置默认「'+CAT_MAP[k].n+'」？'):('删除分类「'+c.n+'」？其历史记录将显示为「其他」'))) return;
  S.custom.cats=S.custom.cats.filter(x=>x.k!==k);
  if(typeof REC!=='undefined'&&REC.cat===k) REC.cat='food';
  afterCatEdit();
  showToast(isB?'已还原默认':'已删除','ok');
}
function toggleTopCat(k){ const c=findUserCat(k); if(!c) return; c.top=!c.top; afterCatEdit(); }
function afterCatEdit(){ save(); renderCatMgr(); refreshPick(); }
/* ---------------- 设置页 ---------------- */
function renderSet(){
  let h='';
  h+='<div class="card"><div class="c-head"><div class="c-title">CATEGORY / 分类</div><div class="c-sub" style="cursor:pointer" onclick="openCatMgr()">＋管理</div></div>'+
     '<div style="font-size:11px;color:var(--txt3)">分类都能自定义：内置的可以直接改名/换图标（改后历史同步显示新名），还能新增、置顶、删除。点上面进入管理。</div></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">PLANS / 每月计划</div><div class="c-sub" style="cursor:pointer" onclick="planForm(null)">＋新增</div></div>';
  h+=(S.plans&&S.plans.length?S.plans.map(planRowHtml).join(''):'<div class="empty">还没有计划项。<br>给妈妈的钱、猫399、黄金定投、余利宝定存，都能设成每月提醒。</div>')+'</div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">PAY / 发薪</div></div>'+
     '<div class="field"><div class="fl">每月几号发薪</div><input class="inp" id="payDayIn" type="number" inputmode="numeric" min="1" max="28" value="'+S.profile.payday+'" onchange="setPayday(this.value)"></div>'+
     '<div style="font-size:11.5px;color:var(--txt3)">遇节假日自动提前到放假前最后工作日（沿用你的规则）。</div></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">HOLIDAY / 自定义节假日</div></div>'+
     '<div style="font-size:11.5px;color:var(--txt3);margin-bottom:8px">公司/特殊放假或补班，手动补（内置2026 + 自动更新次年表）。</div>'+
     '<div style="display:flex;gap:8px"><button class="mini" style="flex:1" onclick="addHol(false)">＋放假</button><button class="mini" style="flex:1" onclick="addHol(true)">＋补班</button></div>'+
     ((S.customHol&&S.customHol.length)||(S.customWork&&S.customWork.length)?'<div style="margin-top:8px">'+((S.customHol||[]).map(d=>'<span class="chip" style="padding:2px 8px;font-size:11px">🏖 '+d+' <b onclick="rmHol(\''+d+'\',false)">✕</b></span>').join(' '))+((S.customWork||[]).map(d=>'<span class="chip" style="padding:2px 8px;font-size:11px">💼 '+d+' <b onclick="rmHol(\''+d+'\',true)">✕</b></span>').join(' '))+'</div>':'')+'</div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">STATE / 状态开关</div></div>'+
     '<div class="row" style="border:none"><div class="mid"><div class="t1">黄金定投</div><div class="t2">观望暂停中时，教练不催你买金</div></div><button class="mini '+(S.stateFlags&&S.stateFlags.gold==='pause'?'cy':'')+'" onclick="toggleGoldPause()">'+(S.stateFlags&&S.stateFlags.gold==='pause'?'✓ 已暂停':'正常')+'</button></div>'+
     '<button class="btn ghost" style="margin-top:8px" onclick="editOnboard()">🔄 重设期初资产</button></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">APP / 应用</div></div>'+
     '<div style="display:flex;gap:8px;margin-bottom:8px">'+
     '<button class="mini cy" style="flex:1" onclick="checkUpdManual()">🔄 检查更新</button>'+
     '<button class="mini" style="flex:1" onclick="installApp()">📲 安装到桌面</button></div>'+
     '<div style="font-size:11px;color:var(--txt3);line-height:1.7">当前版本 '+APP_VER+'（可在 <span style="color:var(--txt2)" onclick="window.open(\'https://github.com/Cora0808/zhangben\')">GitHub 查看</span>）。有新版时顶部会出现更新横幅，也可随时点上面按钮。以后我更新了你不用重装——自动生效或点一下更新。</div></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">COACH / 与教练同步</div></div>'+
     '<button class="btn" style="margin-bottom:8px" onclick="copyDigest()">📤 生成简报并复制（发给微信教练）</button>'+
     '<div style="font-size:11.5px;color:var(--txt3);line-height:1.7">复制后粘贴到微信发给 Hermes，我会基于你的画像给分析和理财建议。</div></div>';
  h+='<div class="card"><div class="c-head"><div class="c-title">DATA / 数据</div></div>'+
     '<div style="display:flex;gap:8px"><button class="mini" style="flex:1" onclick="exportJSON()">备份导出</button>'+
     '<button class="mini" style="flex:1" onclick="importModal()">恢复备份</button>'+
     '<button class="mini mg" style="flex:1" onclick="clearAll()">清空数据</button></div>'+
     '<div style="font-size:11px;color:var(--txt3);margin-top:8px">数据只存在本机。换手机用"备份导出→新机恢复"。</div></div>';
  h+='<div class="card" style="text-align:center"><div style="color:var(--txt3);font-size:12px">打工人资金教练 '+APP_VER+' · 纯本地 · 无云端</div></div>';
  return h;
}
function setPayday(v){ S.profile.payday=Math.max(1,Math.min(28,parseInt(v)||5)); S.profile.payRule={mode:'prev',day:S.profile.payday}; save(); render(); showToast('发薪日已设为每月 '+S.profile.payday+' 号'); }
function addHol(work){
  const ans=prompt((work?'补班':'放假')+'日期\n可单个日期 YYYY-MM-DD，或区间 2027-02-15~2027-02-23');
  if(!ans) return;
  const seg=ans.replace(/\s/g,'');
  if(seg.indexOf('~')>=0){
    const [a,b]=seg.split('~'); if(!a||!b){ showToast('格式：2027-01-01~2027-01-03','warn'); return; }
    let d=a; let added=0;
    while(d<=b&&added<40){ addHolOne(d,work); d=addDateStr(d,1); added++; }
  } else addHolOne(seg,work);
  save(); render(); showToast('已添加','ok');
}
function addHolOne(d,work){
  if(work){ S.customWork=S.customWork||[]; if(!S.customWork.includes(d)) S.customWork.push(d); S.customHol=(S.customHol||[]).filter(x=>x!==d); }
  else{ S.customHol=S.customHol||[]; if(!S.customHol.includes(d)) S.customHol.push(d); S.customWork=(S.customWork||[]).filter(x=>x!==d); }
}
function rmHol(d,work){ if(work) S.customWork=(S.customWork||[]).filter(x=>x!==d); else S.customHol=(S.customHol||[]).filter(x=>x!==d); save(); render(); }
function clearAll(){ if(!confirm('清空全部数据？（备份先导出）')) return; localStorage.removeItem(KEY); location.reload(); }
function importModal(){ openPageForm('恢复备份','<textarea class="inp" id="impTxt" rows="8" placeholder="把备份 JSON 粘贴进来" style="font-size:10px;font-family:var(--mono)"></textarea><div style="display:flex;gap:9px;margin-top:12px"><button class="btn ghost" style="flex:1" onclick="closePageForm()">取消</button><button class="btn cy" style="flex:1" onclick="doImport()">恢复</button></div>'); }
function doImport(){ const v=$('impTxt').value; if(importJSON(v)){ closePageForm(); } }

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

