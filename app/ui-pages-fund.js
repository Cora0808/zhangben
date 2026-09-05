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
