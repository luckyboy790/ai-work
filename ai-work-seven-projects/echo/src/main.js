import {World} from './world.js';
import {Simulation,STATIONS,freshMeta,clamp,terrainHeight} from './simulation.js';
import {Input} from './input.js';
import {Soundscape} from './audio.js';
import {UI} from './ui.js';
const $=id=>document.getElementById(id);
const KEY='trisolaris-echo-save-v1',META='trisolaris-echo-meta-v1',SETTINGS='trisolaris-echo-settings-v1';
let storageOK=true;const read=key=>{try{return localStorage.getItem(key)}catch{storageOK=false;return null}};const write=(key,v)=>{try{localStorage.setItem(key,v);return true}catch{storageOK=false;return false}};
function loadMeta(){try{const x=JSON.parse(read(META));if(!x||!Number.isFinite(x.banked)||x.banked<0||x.banked>999||!Number.isFinite(x.generation)||!Array.isArray(x.records))return freshMeta();return{...freshMeta(),...x,records:x.records.filter(r=>['ruinCold','ruinHeat'].includes(r))}}catch{return freshMeta()}}
let quality='auto';try{const v=JSON.parse(read(SETTINGS));if(['auto','high','low'].includes(v?.quality))quality=v.quality}catch{}
const world=new World($('world'),quality);
let sim=new Simulation(137,loadMeta()),started=false,paused=true,speed=1,nearest=null,endedShown=false,visualTime=0,savingClock=0,uiClock=0,accumulator=0;
let resumeData=null;try{const data=JSON.parse(read(KEY));if(data?.version===1){const restored=Simulation.restore(data.simulation);if(restored&&!restored.s.ended)resumeData={sim:restored,player:data.player}}}catch{}
const sound=new Soundscape();
const ui=new UI(globalAction,facilityAction);
const input=new Input($('world'),world.camera,world.colliders,globalAction);input.reset();
$('begin').onclick=()=>begin(false);$('continue').onclick=()=>begin(true);$('soundButton').onclick=()=>{$('soundButton').textContent='声 / '+(sound.toggle()?'开':'关')};
function save(){if(!started)return;const result=write(KEY,JSON.stringify({version:1,simulation:sim.serialize(),player:{x:input.x,z:input.z,yaw:input.yaw,pitch:input.pitch}}));write(META,JSON.stringify(sim.s.meta));return result}
function setPause(v){paused=v;input.setEnabled(started&&!v&&!sim.s.ended);sound.setPaused(v);accumulator=0}
function begin(continuing){
 if(continuing&&resumeData){sim=resumeData.sim;const p=resumeData.player;if(p&&[p.x,p.z,p.yaw,p.pitch].every(Number.isFinite)&&Math.hypot(p.x,p.z)<118){input.x=p.x;input.z=p.z;input.yaw=p.yaw;input.pitch=clamp(p.pitch,-1.15,1.3)}else input.reset()}
 else{sim=new Simulation(137,loadMeta());input.reset()}
 started=true;endedShown=false;ui.enter();setPause(false);sound.start();save();ui.toast(continuing?'已恢复上次的观测现场。':'沿石路走向观星台。拖动环顾，靠近后按 E 或点击交互。');
}
function restart(sameSeed=false,clear=false){
 const old=sim.s;const meta=clear?freshMeta():structuredClone(old.meta);if(!clear&&!sameSeed)meta.generation=old.generation+1;
 const seed=clear?137:sameSeed?old.seed:old.seed+71;
 $('transition').classList.add('show');setPause(true);
 // Only an intentional narrative transition changes the camera position or epoch discontinuously.
 setTimeout(()=>{sim=new Simulation(seed,meta);input.reset();started=true;endedShown=false;speed=1;ui.enter();setPause(false);save();sound.start();$('transition').classList.remove('show');ui.toast(clear?'新的守望开始了。':'石碑仍在；水、族人和建筑从新的起点开始。')},650);
}
function refresh(){ui.update(sim.s,input,speed);findNearest();world.update(sim.s,0,visualTime)}
function findNearest(){
 nearest=null;let best=Infinity;
 for(const st of STATIONS){const d=Math.hypot(input.x-st.x,input.z-st.z);if(d<st.range&&d<best){nearest=st;best=d}}
 ui.proximity(nearest,best);
 if(ui.stationId){const st=STATIONS.find(a=>a.id===ui.stationId);if(Math.hypot(input.x-st.x,input.z-st.z)>st.range+.3){ui.closeStation();ui.toast('已离开设施范围。指令仍然继续执行。')}}
}
function facilityAction(id,arg){
 if(!started||paused||sim.s.ended)return;
 const required={observe:'scope',dehydrate:'vault',repair:'vault',revive:'pool',task:'camp',archive:'archive',complete:'archive',lore:arg}[id];
 const st=STATIONS.find(a=>a.id===required);
 if(!st||Math.hypot(input.x-st.x,input.z-st.z)>st.range+.05){ui.toast('请先走近对应设施。');return}
 const result=sim.action(id,arg);ui.toast(result.message);if(result.ok){sound.chime();save();if(sim.s.mode==='revive')speed=1}if(sim.s.ended)showEnding();refresh();
}
function showEnding(){if(endedShown)return;endedShown=true;setPause(true);ui.closeStation();save();ui.ending(sim.s)}
function globalAction(action){
 if(action.startsWith('quality:')){quality=action.slice(8);world.setQuality(quality);write(SETTINGS,JSON.stringify({quality}));return}
 if(action==='guide'){setPause(true);ui.guide();return}
 if(action==='closeModal'){
  if(sim.s.ended&&started){ui.ending(sim.s);return}
  ui.closeModal();setPause(!started);return;
 }
 if(action==='visibility'){if(started&&!sim.s.ended){setPause(true);save();ui.pause(quality,storageOK)}return}
 if(!started)return;
 if(action==='pause'){
  if(sim.s.ended){ui.ending(sim.s);return}
  if(ui.modalType){ui.closeModal();setPause(false)}else{setPause(true);save();ui.pause(quality,storageOK)}return;
 }
 if(action==='interact'){
  if(paused||sim.s.ended)return;if(ui.stationId){ui.closeStation();return}findNearest();if(nearest){if(document.pointerLockElement)document.exitPointerLock();ui.openStation(nearest.id,sim.s)}else ui.toast('走近有编号的设施，再进行交互。');return;
 }
 if(action==='closeStation'){ui.closeStation();return}
 if(action==='map'){ui.toggleMap();return}
 if(action==='journal'){
  if(ui.modalType==='journal'&&!sim.s.ended){ui.closeModal();setPause(false)}else{setPause(true);save();ui.journal(sim.s)}return;
 }
 if(action==='speed'){
  if(paused||sim.s.ended)return;speed=speed===1?4:1;ui.toast(speed===4?'时间加速 ×4。出现可观测的危险征兆时会自动降回 ×1。':'已恢复正常时间。');return;
 }
 if(action==='resetConfirm'){ui.confirmReset();return}
 if(action==='reset'){try{localStorage.removeItem(KEY);localStorage.removeItem(META)}catch{}restart(false,true);return}
 if(action==='retry'){restart(true);return}
 if(action==='rebuild'){restart(false);return}
 if(action==='export'){
  const s=sim.s,report={title:'三体·文明回声 / 文明手记',version:1,seed:s.seed,generation:s.generation,recordedEpoch:s.t,result:s.won?'协议完成':s.ended?'文明沉寂':'守望中',population:{active:s.active,dry:s.dry},knowledge:{current:s.knowledge,banked:s.meta.banked},losses:s.losses,observations:s.observations,forecasts:s.forecasts,history:s.history,log:s.log,model:'连续编排星历；并非精确三体运动预测'};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`文明-${s.generation}-观测手记.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ui.toast('已导出本轮观测、预测核验与决策记录。');return;
 }
}
// Simulation clocks are fixed-step. Page visibility never causes an elapsed-time catch-up catastrophe.
let last=performance.now(),frameSamples=[],qualityTimer=0;
function frame(now){
 requestAnimationFrame(frame);const raw=(now-last)/1000,dt=Math.min(Math.max(raw,0),.10);last=now;
 if(!document.hidden)visualTime+=dt;
 if(!paused&&started&&!sim.s.ended){
  const beforeAlarm=sim.s.lastAlarm;accumulator+=dt*speed;
  while(accumulator>=.1){sim.tick(.1);accumulator-=.1;if(sim.s.ended)break}
  if(speed>1&&(sim.s.lastAlarm>beforeAlarm||sim.s.vault<35||sim.s.water<20&&sim.s.active>0)){speed=1;ui.toast('守望者发现危险征兆，时间已自动降回 ×1。')}
  savingClock+=dt;if(savingClock>10){savingClock=0;save()}
 }
 input.update(dt);
 if(!document.hidden){world.update(sim.s,dt,visualTime);if(!paused)sound.update(sim.s,dt,input.moving,Math.hypot(input.x-20,input.z-4));}
 uiClock+=dt;if(uiClock>.15){uiClock=0;ui.update(sim.s,input,speed);findNearest()}
 if(sim.s.ended&&started)showEnding();
 // Adaptive quality is based on observed frame intervals, not an unmeasured FPS claim.
 if(quality==='auto'&&!document.hidden&&started&&!paused){frameSamples.push(raw);if(frameSamples.length>90)frameSamples.shift();qualityTimer+=dt;if(qualityTimer>9&&frameSamples.length>60){qualityTimer=0;const slow=frameSamples.filter(x=>x>.046).length/frameSamples.length;if(slow>.6&&!world.low){world.setQuality('low');ui.toast('已降低装饰密度与渲染分辨率，保留全部玩法和天象。')}}}
}
window.addEventListener('beforeunload',()=>save());
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);save();ui.modal('context','图形上下文已中断','记录已尝试保存','<p>浏览器暂时回收了图形资源。可以重新加载页面，再选择继续守望。</p><div class="modal-buttons"><button onclick="location.reload()">重新加载</button></div>',false)});
// Test helpers are absent unless explicitly requested; natural input tests do not use teleport.
if(new URLSearchParams(location.search).get('test')==='1'){
 window.__TRISOLARIS__={
  snapshot:()=>JSON.parse(sim.serialize()).state,
  player:()=>({x:input.x,z:input.z,yaw:input.yaw,pitch:input.pitch,y:world.camera.position.y}),
  advance:n=>{sim.tick(n);if(sim.s.ended)showEnding();refresh();return sim.s.t},
  teleport:(x,z)=>{if(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x,z)<118){input.x=x;input.z=z;world.camera.position.set(x,terrainHeight(x,z)+1.78,z);refresh()}},
  action:facilityAction,global:globalAction,
  rendererInfo:()=>({calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,low:world.low,three:world.renderer.constructor.name}),
  colliders:()=>structuredClone(world.colliders),
  isPaused:()=>paused
 };
}
world.update(sim.s,0,0);ui.ready(!!resumeData,sim.s.generation);requestAnimationFrame(frame);
