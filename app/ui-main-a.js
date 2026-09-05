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
