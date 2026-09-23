import {STATIONS,LORE,climateName,clamp} from './simulation.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Math.max(0,Math.floor(n));
const tasks={balanced:'均衡生计',water:'集中取水',research:'天象研究',build:'营造与修复'};
export class UI{
 constructor(onGlobal,onAction){
  this.onGlobal=onGlobal;this.onAction=onAction;this.stationId=null;this.modalType=null;this.mapOpen=false;this.lastLog=-1;this.radioUntil=0;this.toastTimer=null;
  document.addEventListener('click',e=>{const g=e.target.closest('[data-global]');if(g)onGlobal(g.dataset.global);const a=e.target.closest('[data-action]');if(a&&!a.disabled)onAction(a.dataset.action,a.dataset.arg)});
  $('interact').onclick=()=>onGlobal('interact');
 }
 ready(hasSave,gen){$('loading').classList.add('hidden');$('entry').classList.remove('hidden');$('continue').classList.toggle('hidden',!hasSave);$('entryGen').textContent=gen}
 enter(){ $('entry').classList.add('hidden');$('hud').classList.remove('hidden');this.lastLog=-1;this.closeModal();this.closeStation()}
 toast(text){clearTimeout(this.toastTimer);$('toast').textContent=text;$('toast').classList.add('show');this.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4600)}
 update(s,input,speed){
  $('generation').textContent=s.generation;$('epoch').textContent=s.t.toFixed(1).padStart(5,'0');
  $('eraName').textContent=climateName(s);$('eraDot').style.background=s.temperature>55?'#d59162':s.temperature< -18?'#91b9db':'#94c5b5';
  const far=s.sky.suns.filter(a=>a.far).length;
  $('skyCue').textContent=far===3?'三颗飞星 · 地表正在失去储热':far===2?'一轮太阳，两颗飞星':far===0?'三日可见 · 注意辐射叠加':'两日可见 · 比较日轮变化';
  $('temperature').textContent=Math.round(s.temperature);$('trend').textContent=s.tempTrend>.12?'↗':s.tempTrend<-.12?'↘':'→';
  $('thermalHint').textContent=s.temperature>50?'石阶发烫 · 入仓也需要时间':s.temperature< -12?'池沿结霜 · 余温不代表安全':'余温会延后真实的危险';
  $('active').textContent=f(s.active);$('dry').textContent=f(s.dry);$('population').textContent=f(s.active+s.dry)+' 人';$('vault').innerHTML=f(s.vault)+'<span>%</span>';
  $('water').textContent=f(s.water);$('materials').textContent=f(s.materials);$('knowledge').textContent=f(s.knowledge);$('banked').textContent='已刻 '+f(s.meta.banked);
  $('activeBar').style.width=(s.active/120*100)+'%';$('dryBar').style.width=(s.dry/120*100)+'%';
  $('workStatus').textContent=tasks[s.task];$('modeStatus').textContent=s.mode==='dehydrate'?'撤离入仓 · 剩余 '+Math.ceil(s.remaining)+' 人':s.mode==='revive'?'浸泡复苏 · 剩余 '+Math.ceil(s.remaining)+' 人':s.active<1?'所有劳动停止':s.temperature< -12||s.temperature>50?'环境恶劣 · 劳动中断':f(s.active)+' 人正在劳动';
  $('speedButton').innerHTML='<kbd>T</kbd> 时间 ×'+speed;
  const deg=((-input.yaw*180/Math.PI)%360+360)%360;$('bearing').textContent=String(Math.round(deg)).padStart(3,'0')+'° · '+['北','东北','东','东南','南','西南','西','西北'][Math.round(deg/45)%8];
  let goal,detail;
  if(s.observed<2){goal='前往观星台，隔一段时间记录两组天象。';detail='只有重复观测，才有角位移'}
  else if(s.records.length===0){goal='离开聚落，寻找一处前代文明的遗迹。';detail='焚城在东北；无日之碑在西南'}
  else if(s.meta.banked<80){goal='利用适温时段研究，把 80 点知识刻入文明碑。';detail=`封存 ${f(s.meta.banked)} / 80 · 新知识尚未继承`}
  else if(s.catastrophes<2){goal='保住干仓，度过两场灾变，再等待复苏机会。';detail=`已度过 ${s.catastrophes} / 2 场 · 不是所有等待都安全`}
  else if(s.active<32){goal='分批浸泡，让至少 32 名族人重返地面。';detail='到复苏池作出决定；没有恒纪元倒计时'}
  else{goal='返回文明碑，立下文明续存协议。';detail='你已经给下一代留下了一种方法'}
  $('objectiveText').textContent=goal;$('objectiveDetail').textContent=detail;
  $('goal1').classList.toggle('done',s.meta.banked>=80);$('goal2').classList.toggle('done',s.catastrophes>=2);$('goal3').classList.toggle('done',s.catastrophes>=2&&s.active>=32);
  const latest=s.log.at(-1);if(latest&&latest.t+latest.text!==this.lastLog){this.lastLog=latest.t+latest.text;$('radioText').textContent=latest.text;this.radioUntil=performance.now()+9000}
  $('radio').style.opacity=performance.now()<this.radioUntil?'1':'0';
  if(this.stationId)this.updateStation(s);
  if(this.mapOpen)this.drawMap(input,s);
 }
 proximity(st,distance){
  const visible=st&&!this.stationId&&!this.modalType;$('interact').classList.toggle('hidden',!visible);
  if(visible)$('interactText').textContent=(st.id.startsWith('ruin')?'抄录':'使用')+' '+st.name;
  $('targetLabel').textContent=st&&!this.stationId?st.number+' / '+st.name+' · '+Math.round(distance)+' 米':'';
 }
 openStation(id,s){
  const st=STATIONS.find(a=>a.id===id);if(!st)return;
  this.stationId=id;$('station').classList.remove('hidden');$('objective').style.opacity='.15';$('stationType').textContent='FACILITY / '+st.number;$('stationTitle').textContent=st.name;
  const descriptions={scope:'站在仪器旁，比较日轮大小与角位移。飞星也是太阳。仪器只看得到现在，不知道恒纪元何时结束。',vault:'族人以脱水状态保存在地下。撤离不是瞬间完成；热量仍会穿透石壁。留工加固，还是立刻让最后的人入仓？',pool:'池水与霜痕记录着地面的冷暖。每复苏一人消耗 0.65 水，并立刻暴露在地表环境中。小批试探更慢，也更容易撤回。',camp:'把有限的适温时段交给哪一种劳动？族人只在 −12 至 50℃ 间生产；清醒者始终消耗水。',archive:'石碑不使灾难停止，但能让灾难不再白白发生。只有铭刻的知识与遗迹记录，会被下一轮文明继承。'};
  $('stationDesc').textContent=descriptions[id]||LORE[id]?.text||'';
  const button=(action,text,cost='',arg='')=>`<button data-action="${action}" data-arg="${arg}">${text}${cost?'<span class="action-cost">'+cost+'</span>':''}</button>`;
  let actions='';
  if(id==='scope')actions=button('observe','记录天象','+5 知识');
  if(id==='vault')actions=button('dehydrate','发布全员脱水令','约 5 人 / 刻')+button('repair','留下工匠，加固干仓','16 建材 · 12 刻');
  if(id==='pool')actions=button('revive','先复苏 24 人','约 16 水','batch')+button('revive','复苏全部封存者','0.65 水 / 人','all');
  if(id==='camp')actions=Object.entries(tasks).map(([key,name])=>button('task',name,{balanced:'水 + 建材 + 知识',water:'储水优先',research:'知识优先；水会减少',build:'建材与仓体优先'}[key],key)).join('');
  if(id==='archive')actions=button('archive','把新知识刻进石碑','8 建材')+button('complete','立下文明续存协议','检查目标');
  if(id.startsWith('ruin'))actions=button('lore','抄录遗迹，带回聚落','+18 知识',id);
  $('stationActions').innerHTML=actions;this.updateStation(s);
 }
 closeStation(){this.stationId=null;$('station').classList.add('hidden');$('objective').style.opacity='1'}
 updateStation(s){
  const id=this.stationId;let html='';
  const row=(a,b)=>`<div class="reading-row"><span>${a}</span><b>${b}</b></div>`;
  if(id==='scope'){
   const obs=s.observations.at(-1);
   html=`<small>最近实测 ${obs?(s.t-obs.t).toFixed(0)+' 刻前':'尚未记录'} · 角位移需比较两次读数</small>`;
   if(obs)obs.suns.forEach((a,i)=>{html+=row(['甲日','乙日','丙日'][i],`${(a.alt*180/Math.PI).toFixed(1)}° 高度 · ${(a.radius*2*180/Math.PI).toFixed(2)}° 视直径`)});
   const p=s.forecast;
   if(p){const stale=s.t-p.t>22;html+=`<div class="forecast-box">${stale?'读数已陈旧，请重新观测':'短期外推：约 12 刻尺度'}<br><strong>${Math.round(p.low)} 至 ${Math.round(p.high)}℃</strong><small>这是误差估计带，不是安全承诺。无法推算纪元的终点。</small></div>`}
   else html+='<div class="forecast-box">记录不足。<small>至少取得两次有时间间隔的观测，才能估计变化方向。</small></div>';
   html+=row('已核验的估计',`${s.correctForecasts} / ${s.checkedForecasts} 次落在估计带内`);
   const b=$('stationActions').querySelector('[data-action="observe"]');b.disabled=s.t-s.lastObservation<10;
  }
  if(id==='vault'){
   html=row('仓体完整',f(s.vault)+'%')+row('清醒 / 封存',f(s.active)+' / '+f(s.dry)+' 人')+row('加固工程',s.project?f(s.project.progress/12*100)+'% · 需适温劳动':'无');
   html+='<p class="warning-inline">完整度低于 30% 后，极端环境会开始杀死仓内族人。脱水有 0.8% 搬运损耗，回收少量水。</p>';
   const repair=$('stationActions').querySelector('[data-action="repair"]');repair.disabled=!!s.project||s.active<8||s.materials<16||s.vault>=99;
   $('stationActions').querySelector('[data-action="dehydrate"]').disabled=s.active<.5||s.mode==='dehydrate';
  }
  if(id==='pool'){
   html=row('可用水',f(s.water)+' / 240')+row('全员复苏需水',Math.ceil(s.dry*.65))+row('水面状态',s.temperature< -10?'正在结冰':s.temperature>65?'正在蒸腾':'可浸泡');
   if(s.temperature< -12||s.temperature>50)html+='<p class="warning-inline">当前气温不适宜生产。强行复苏仍会执行，但族人将暴露于灾害。</p>';
   for(const b of $('stationActions').querySelectorAll('button')){const n=Math.min(s.dry,b.dataset.arg==='all'?s.dry:24);b.disabled=s.mode!=='none'||s.dry<1||s.water<n*.65}
  }
  if(id==='camp'){
   html=row('当前分工',tasks[s.task])+row('劳动条件',s.temperature>=-12&&s.temperature<=50?'适温 · '+f(s.active)+' 人可劳动':'暂停 · 环境越界')+row('聚落发展',s.buildLevel+' / 3');
   html+='<small>均衡：小幅积累所有资源。研究：最快积累知识但会消耗储水。营造：积累建材并缓慢修复干仓。</small>';
   for(const b of $('stationActions').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.arg===s.task);
  }
  if(id==='archive'){
   html=row('本轮知识',f(s.knowledge))+row('跨文明已封存',f(s.meta.banked))+row('度过灾变',s.catastrophes+' / 2')+row('复苏人口',f(s.active)+' / 32')+row('待铭刻遗迹',s.newRecords.length+' 处');
   html+='<small>新文明从已刻知识的 70% 重新学习；旧碑保留原有档案。建筑、储水与仓体不会被继承。</small>';
   $('stationActions').querySelector('[data-action="archive"]').disabled=s.materials<8||(s.knowledge<=s.meta.banked&&s.newRecords.length===0);
   $('stationActions').querySelector('[data-action="complete"]').disabled=s.meta.banked<80||s.catastrophes<2||s.active<32;
  }
  if(id.startsWith('ruin')){html='<div class="forecast-box">'+LORE[id].lesson+'</div><p>'+LORE[id].perk+'</p>';if(s.records.includes(id))html+='<small>已抄录。'+(s.meta.records.includes(id)?'前代石碑已保存此记录。':'尚需到文明碑铭刻。')+'</small>';$('stationActions').querySelector('button').disabled=s.records.includes(id)}
  $('stationStats').innerHTML=html;
 }
 modal(type,title,eyebrow,html,closable=true){this.modalType=type;$('modalTitle').textContent=title;$('modalEyebrow').textContent=eyebrow;$('modalContent').innerHTML=html;$('modalClose').classList.toggle('hidden',!closable);$('modalShade').classList.remove('hidden');$('modalShade').classList.toggle('ending',type==='end');requestAnimationFrame(()=>{$('modal').querySelector('button:not(.hidden),select')?.focus()})}
 closeModal(){this.modalType=null;$('modalShade').classList.add('hidden')}
 guide(){this.modal('guide','守望者须知','FIELD MANUAL / 世界暂停',`
 <p class="big-copy">你不能命令太阳。但你能决定，何时让文明醒来。</p>
 <div class="columns"><div><h3>先看天，再决定</h3><p>沿石路抵达观星台，按 E 或点击交互。间隔 10 刻记录两次天象，比较日轮大小和运动。估计带只覆盖局部外推，不提供灾害倒计时。实际温度有滞后；越来越大的太阳比一块温暖的石头更值得警惕。</p><h3>脱水不是无敌</h3><p>到西侧干仓发布撤离令。每刻约 5 人完成脱水；劳动随之停止，回收部分水，但搬运有少量损耗。仓体低于 30% 后，封存者也会在极端环境下死亡。修仓需要清醒工匠、建材与适温时间。</p></div><div><h3>给复苏留下代价</h3><p>到东侧复苏池，先试着浸泡 24 人，或承担全员复苏的风险。浸泡需要水，清醒者持续消耗水。营造场可调整取水、研究或施工。在 −12 至 50℃ 间，劳动才有产出。</p><h3>完成这一段文明</h3><p>探索聚落外的两处遗迹；把至少 80 点知识刻入文明碑；度过两场灾变后，恢复至少 32 人，再回碑前立下协议。失败后可沿相同天象重试，或带着已刻知识重建。</p></div></div>
 <h3>操作与存档</h3><p>WASD 行走，Shift 快走，鼠标拖动环顾，双击场景可锁定鼠标。方向键也能移动和转向。触摸设备使用左侧摇杆、空白处拖动和屏幕交互键。J 打开暂停的手记，M 查看不暂停的地图，T 切换 ×1 / ×4。后台标签页与设置菜单自动暂停。</p>
 <p>本机自动存档每 10 秒更新；浏览器清除站点数据会删除存档。正常游玩不请求外部素材，全部图像、几何、纹理与声音由代码生成。音效只在首次进入的用户操作后启动。</p>
 <h3>模拟边界</h3><p>这是基于小说规则的非官方同人实验。采用连续、带固定种子的编排星历，不是精确牛顿三体积分。三颗太阳的方向、视直径与辐射共享同一星历，温度再经过热惯性影响生存。时代长度经过压缩；玩家是耐受极端的观测终端，族人没有这层保护。资源、石碑传承、分批复苏和续存协议是新增玩法。</p>
 <div class="modal-buttons"><button class="primary" data-global="closeModal">理解，继续守望</button></div>`)}
 pause(quality,saving){this.modal('pause','暂停守望','OBSERVATORY / 世界暂停',`
 <p>太阳、劳动与资源消耗都已暂停。</p><div class="setting-row"><span>画面质量</span><select id="qualitySelect" aria-label="画面质量"><option value="auto">自动适应</option><option value="high">完整场景</option><option value="low">轻量场景</option></select></div><div class="setting-row"><span>运动方式</span><span>拖动环顾 / 双击鼠标锁定</span></div><div class="setting-row"><span>本机存档</span><span>${saving?'自动保存可用':'浏览器禁用存储；本次仍可游玩'}</span></div><p>轻量模式减少碎石、粒子与人群，降低分辨率和阴影精度；保留所有设施、碰撞与天象线索。</p><div class="modal-buttons"><button class="primary" data-global="closeModal">返回世界</button><button data-global="guide">玩法说明</button><button data-global="export">导出文明手记</button><button class="danger" data-global="resetConfirm">清除并重新开始</button></div>`);$('qualitySelect').value=quality;$('qualitySelect').onchange=e=>this.onGlobal('quality:'+e.target.value)}
 confirmReset(){this.modal('reset','抹去所有石碑？','LOCAL RECORD / 需要确认',`<p>这会清除本浏览器的当前进度、已刻知识和遗迹记录。场景与操作设置会保留。此操作不会修改上传的小说。</p><div class="modal-buttons"><button data-global="closeModal">保留记录</button><button class="danger" data-global="reset">清除记录，重新开始</button></div>`)}
 journal(s){
  const entries=s.log.slice().reverse().map(l=>`<p class="${l.kind}"><time>${l.t.toFixed(1)}</time><span>${escape(l.text)}</span></p>`).join('');
  const notes=s.records.length?s.records.map(k=>`<article><h3>${LORE[k].title}</h3><p>${LORE[k].lesson}</p><p>${s.meta.records.includes(k)?'已刻入前代石碑':'尚未铭刻；失败后会丢失'}</p></article>`).join(''):'<p>还没有抄录遗迹。请在地图上寻找聚落之外的两处标记。</p>';
  this.modal('journal','观测手记','FIELD NOTES / 世界暂停',`
  <div class="stats-row"><div><strong>${s.observed}</strong><small>本轮观测</small></div><div><strong>${s.correctForecasts} / ${s.checkedForecasts}</strong><small>短期估计带命中</small></div><div><strong>${f(s.meta.banked)}</strong><small>跨文明已刻知识</small></div></div>
  <h3>发生过的温度，而非未来的日历</h3><canvas id="historyChart" class="record-chart" width="1100" height="260"></canvas><div class="legend">实线：地表温度　点：望远镜记录　阴影：适温劳动区间</div>
  <h3>因果记录</h3><div class="log">${entries}</div><h3>前代留下的线索</h3><div class="note-grid">${notes}</div><div class="modal-buttons"><button class="primary" data-global="closeModal">回到现场</button><button data-global="export">导出手记 JSON</button></div>`);
  this.drawHistory(s);
 }
 ending(s){
  const text=s.won?'我们没有预测出永恒。\n但我们保存了足够多的人，和足够多的错误。':s.failureReason||'';
  const loss=Object.entries(s.losses).filter(([,v])=>v>.1).map(([k,v])=>({heat:'灼热',cold:'严寒',thirst:'缺水',vault:'仓毁',handling:'搬运'}[k])+Math.round(v)+' 人').join(' · ');
  this.modal('end',s.won?'文明，仍将醒来':'这轮文明，沉寂了',s.won?'CONTINUITY / 文明续存协议已完成':'EXTINCTION / 不是所有等待都有下一次日出',`
   <p class="big-copy">${s.won?'我们没有预测出永恒。<br>但我们保存了足够多的人，和足够多的错误。':escape(s.log.at(-1)?.text||'族人已无法维持文明。')}</p>
   <div class="stats-row"><div><strong>${f(s.active+s.dry)}</strong><small>最终幸存者</small></div><div><strong>${f(s.meta.banked)}</strong><small>下一代能够找到的知识</small></div><div><strong>${s.catastrophes}</strong><small>度过的灾变</small></div></div>
   <p>${loss?'本轮损失：'+loss:'族人仍然完好。'}。最低 ${Math.round(s.trough)}℃，最高 ${Math.round(s.peak)}℃。</p>
   <h3>这次判断留下了什么</h3><p>${s.checkedForecasts?`已核验 ${s.checkedForecasts} 次短期外推，其中 ${s.correctForecasts} 次实际温度落在估计带内。`:'本轮没有完成可核验的短期预测。'}短期正确不代表长期可靠。${Math.max(0,Math.floor(s.knowledge-s.meta.banked))} 点未刻知识不会进入下一文明。</p>
   <canvas id="historyChart" class="record-chart" width="1100" height="260"></canvas>
   <div class="modal-buttons"><button class="primary" data-global="rebuild">继承石碑 · 重建</button><button data-global="retry">重试相同天象</button><button data-global="journal">回看因果手记</button><button data-global="export">导出记录</button></div>`,false);
  this.drawHistory(s);
 }
 drawHistory(s){
  const cv=$('historyChart');if(!cv)return;const c=cv.getContext('2d'),w=cv.width,h=cv.height,left=50,bottom=26,top=16,right=14;
  c.clearRect(0,0,w,h);const minT=-60,maxT=200,duration=Math.max(30,s.t),x=t=>left+(t/duration)*(w-left-right),y=t=>h-bottom-(t-minT)/(maxT-minT)*(h-top-bottom);
  c.fillStyle='rgba(143,177,143,.10)';c.fillRect(left,y(50),w-left-right,y(-12)-y(50));
  c.font='16px system-ui';c.textAlign='right';for(const t of [-40,0,50,100,150]){c.strokeStyle='rgba(187,203,182,.13)';c.beginPath();c.moveTo(left,y(t));c.lineTo(w-right,y(t));c.stroke();c.fillStyle='#8ba097';c.fillText(t+'°',left-8,y(t)+5)}
  c.strokeStyle='#d6bd84';c.lineWidth=2.2;c.beginPath();s.history.forEach((p,i)=>i?c.lineTo(x(p.t),y(p.temp)):c.moveTo(x(p.t),y(p.temp)));c.stroke();
  c.fillStyle='#acd7c6';s.observations.forEach(p=>{c.beginPath();c.arc(x(p.t),y(p.temp),3,0,Math.PI*2);c.fill()});
  c.textAlign='left';c.fillStyle='#859b92';c.fillText('起点',left,h-5);c.textAlign='right';c.fillText('已观测到的现在',(w-right),h-5);
 }
 toggleMap(){this.mapOpen=!this.mapOpen;$('mapPanel').classList.toggle('hidden',!this.mapOpen)}
 drawMap(input,s){
  const cv=$('map'),c=cv.getContext('2d'),w=cv.width,h=cv.height,scale=3.7,cx=w/2,cy=h/2+5;
  c.clearRect(0,0,w,h);c.strokeStyle='rgba(151,173,151,.12)';c.lineWidth=1;for(let x=-60;x<=60;x+=10){c.beginPath();c.moveTo(cx+x*scale,18);c.lineTo(cx+x*scale,h-18);c.stroke()}for(let z=-50;z<=50;z+=10){c.beginPath();c.moveTo(20,cy+z*scale);c.lineTo(w-20,cy+z*scale);c.stroke()}
  c.strokeStyle='#64736a';c.setLineDash([4,8]);c.beginPath();c.arc(cx,cy,125,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.font='15px system-ui';c.textAlign='center';c.fillStyle='#879d90';c.fillText('北 N',cx,20);
  for(const st of STATIONS){const x=cx+st.x*scale,z=cy+st.z*scale;c.fillStyle=st.id.startsWith('ruin')?(s.records.includes(st.id)?'#96bdad':'#a18d68'):'#a8c1b0';c.beginPath();c.arc(x,z,4,0,Math.PI*2);c.fill();c.fillText(st.name,x,z+20)}
  c.save();c.translate(cx+input.x*scale,cy+input.z*scale);c.rotate(-input.yaw);c.beginPath();c.moveTo(0,-10);c.lineTo(6,7);c.lineTo(0,3);c.lineTo(-6,7);c.closePath();c.fillStyle='#e5c482';c.fill();c.restore();
 }
}
