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
