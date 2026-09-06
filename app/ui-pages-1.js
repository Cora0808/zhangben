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
  const recent=S.recs.slice().sort((x,y)=>cmpD(y.d,x.d)||(y.ts||0)-(x.ts||0)).slice(0,6);
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
