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
