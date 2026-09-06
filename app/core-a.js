/* ================================================================
   打工人资金教练 v4 — core-a：模型 / 存储 / 账户计算 / 分类
   ================================================================ */
/* ---------- 常量 ---------- */
const KEY='wb_coach_v1';
const APP_VER='v4.2.5';
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
