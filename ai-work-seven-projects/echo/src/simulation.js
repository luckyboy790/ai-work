/**
 * Deterministic, bounded gameplay ephemeris, not a Newtonian three-body solver.
 * All visible suns, radiative input, temperature, warnings and damage share skyAt().
 * Forecasting reads only already acquired measurements, never the event schedule.
 * Time unit is an accelerated epoch tick, not a physical SI second or a calendar day.
 */
export const VERSION=1;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
export function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export const STATIONS=[
 {id:'scope',name:'观星台',short:'观测',x:0,z:-17,range:5,number:'01'},
 {id:'vault',name:'地下干仓',short:'脱水',x:-20,z:8,range:5,number:'02'},
 {id:'pool',name:'复苏池',short:'复苏',x:20,z:10.5,range:4.5,number:'03'},
 {id:'camp',name:'营造场',short:'建设',x:18,z:-11,range:5,number:'04'},
 {id:'archive',name:'文明碑',short:'传承',x:-20,z:-17,range:4.5,number:'05'},
 {id:'ruinHeat',name:'焚城遗址',short:'探索',x:47,z:-32,range:5,number:'06'},
 {id:'ruinCold',name:'无日之碑',short:'探索',x:-43,z:29,range:5,number:'07'}
];
export const LORE={
 ruinHeat:{title:'第 119 号文明 · 焚城',text:'他们在太阳变大时才停止浸泡。干仓保住了第一批人，却没有撑过第二次热浪。石缝里的仓册只剩一句：干燥不等于不燃。',lesson:'热量有滞后。留意日轮增大；脱水之后仍要看仓体耐受。',perk:'获得隔热施工知识，修仓额外恢复 10 点完整度。'},
 ruinCold:{title:'第 126 号文明 · 无日',text:'三颗细小的光点在天上移动。祭司称它们为三次黎明，守仓人却在池面最后一圈涟漪结冰之前，封存了族人。',lesson:'飞星不是新的太阳。三日皆远时，地面仍会在余温消散后冻结。',perk:'获得透镜校准记录，观测噪声降低 25%。'}
};
function envelope(t,start,rise,hold,fall){return smooth((t-start)/rise)*(1-smooth((t-start-rise-hold)/fall))}
export function skyAt(t,seed=137){
 const j=((seed*9301+49297)%233280)/233280;
 // Generations vary the windows, but the first approach always gives readable warning.
 const shift=(j-.5)*18;
 const cycle=Math.floor(t/690),u=t%690;
 const h=envelope(u,142+shift,40,34,42);
 const cold=envelope(u,331+shift,38,42,42);
 const triple=envelope(u,520+shift,46,28,40);
 const daily=2*Math.PI*t/112;
 const baseAlt=.52+.20*Math.sin(daily+.8);
 const suns=[0,1,2].map(i=>{
  let distance=i===0?1.18:6.4+i*.7;
  let alt=i===0?baseAlt:.35+.17*Math.sin(t*.018+i*2.2);
  let az=i===0?-.57+.85*Math.sin(daily*.65):1.8+i*1.1+t*(i===1?.007:-.009);
  if(i===0){distance=mix(distance,.66,h);alt=mix(alt,.70,h);az=mix(az,-.62,h)}
  if(i===1){distance=mix(distance,1.7,h*.70);alt=mix(alt,.39,h)}
  distance=mix(distance,8.7+i*.7,cold);alt=mix(alt,.22+.11*i,cold);
  distance=mix(distance,.84+i*.06,triple);alt=mix(alt,.49+i*.13,triple);
  az=mix(az,[-.85,.05,.85][i],triple);
  const luminosity=[1.7,1.3,1.15][i];
  const dir={x:Math.sin(az)*Math.cos(alt),y:Math.sin(alt),z:-Math.cos(az)*Math.cos(alt)};
  const flux=luminosity/(distance*distance)*Math.max(0,dir.y);
  // Distant stars remain visible; the size transition represents the novel's optical convention.
  const angularRadius=distance>4? .0035+.006/distance : .060/distance;
  return {id:i,name:['甲日','乙日','丙日'][i],distance,alt,az,dir,flux,angularRadius,far:distance>4};
 });
 const flux=suns.reduce((a,s)=>a+s.flux,0);
 return {suns,flux,equilibrium:clamp(-49+100*flux,-70,180),cycle,
  perturbation:Math.max(h,cold,triple),regime:h>.35?'heat':cold>.35?'cold':triple>.35?'triple':'stable'};
}
export function climateName(s){
 if(s.temperature>55)return '乱纪元 · 炽热';
 if(s.temperature< -18)return '乱纪元 · 严寒';
 if(s.sky.flux>1.5||s.sky.flux<.12||Math.abs(s.tempTrend)>.55)return '天象扰动 · 未定';
 return '恒纪元 · 暂定';
}
export function freshMeta(){return{banked:0,records:[],generation:137,bestSurvivors:0,failures:0}}
export function freshState(seed=137,meta=freshMeta()){
 return {version:VERSION,seed,t:0,step:0,generation:meta.generation,temperature:22,tempTrend:0,
  active:36,dry:84,water:112,materials:75,knowledge:Math.floor(meta.banked*.70),vault:82,
  task:'balanced',mode:'none',remaining:0,project:null,observations:[],lastObservation:-99,
  archive:meta.banked,records:[...meta.records],newRecords:[],log:[],history:[],forecasts:[],
  forecast:null,correctForecasts:0,checkedForecasts:0,catastrophes:0,catastropheOpen:false,
  catastropheKind:null,peak:22,trough:22,losses:{heat:0,cold:0,thirst:0,vault:0,handling:0},
  savedByDry:0,observed:0,buildLevel:0,ended:false,won:false,lastAlarm:-99,lastSample:-99,
  sky:skyAt(0,seed),meta:structuredClone(meta)};
}
export class Simulation{
 constructor(seed=137,meta=freshMeta()){this.s=freshState(seed,meta);this.note('arrival','第 '+meta.generation+' 号文明：36 人值守，84 人封存。先去观星台。')}
 note(kind,text){const s=this.s;s.log.push({t:s.t,kind,text});if(s.log.length>90)s.log.shift()}
 action(id,arg){
  const s=this.s;if(s.ended)return {ok:false,message:'本轮已结束。'};
  const fail=message=>({ok:false,message});
  if(id==='observe'){
   if(s.t-s.lastObservation<10)return fail('需间隔 10 刻，才能取得有意义的角位移。');
   const rng=random(s.seed+s.step*317);const precision=(s.records.includes('ruinCold')?.75:1)/(1+s.knowledge/100);
   const flux=Math.max(0,s.sky.flux+(rng()-.5)*.08*precision);
   const sample={t:s.t,temp:s.temperature+(rng()-.5)*1.8*precision,flux,suns:s.sky.suns.map(a=>({alt:a.alt+(rng()-.5)*.01*precision,az:a.az+(rng()-.5)*.008*precision,radius:a.angularRadius}))};
   s.observations.push(sample);if(s.observations.length>30)s.observations.shift();s.lastObservation=s.t;s.observed++;s.knowledge+=5;
   s.forecast=this.predict();if(s.forecast){s.forecasts.push({...s.forecast,checked:false});if(s.forecasts.length>30)s.forecasts.shift()}
   this.note('observe',s.forecast?`第 ${s.observed} 次观测：短期估计 ${Math.round(s.forecast.low)} 至 ${Math.round(s.forecast.high)}℃。`:'第一条记录已收集；隔一段时间再测，才知道光点是否在移动。');
   return{ok:true,message:s.forecast?'角位移已记录。预测只使用过去的观测。':'第一条观测已保存；需要第二条记录才能估计变化。'};
  }
  if(id==='dehydrate'){
   if(s.mode==='dehydrate')return fail('族人正在撤入干仓。');
   if(s.active<.5)return fail('所有族人已脱水。');
   s.mode='dehydrate';s.remaining=s.active;
   this.note('decision',`发布脱水令：${Math.ceil(s.active)} 人，气温 ${Math.round(s.temperature)}℃。`);
   return{ok:true,message:'脱水开始，每刻约 5 人入仓。回收部分水分；劳动逐渐停止。'};
  }
  if(id==='revive'){
   if(s.mode!=='none')return fail('等待当前转运完成，或先在干仓发布撤离令。');
   if(s.dry<1)return fail('没有等待浸泡的族人。');
   const amount=Math.min(s.dry,arg==='all'?s.dry:24);const cost=amount*.65;
   if(s.water<cost)return fail(`浸泡需要 ${Math.ceil(cost)} 水；目前只有 ${Math.floor(s.water)}。`);
   s.water-=cost;s.mode='revive';s.remaining=amount;
   this.note('decision',`浸泡 ${Math.ceil(amount)} 人：耗水 ${Math.ceil(cost)}，气温 ${Math.round(s.temperature)}℃。`);
   return{ok:true,message:`浸泡已开始。${s.temperature< -12||s.temperature>50?'当前环境危险，复苏者会立即暴露。':'刚复苏的族人会逐步恢复劳动。'}`};
  }
  if(id==='task'){
   if(!['balanced','water','research','build'].includes(arg))return fail('未知分工。');
   s.task=arg;this.note('decision','调整劳动：'+({balanced:'均衡生计',water:'集中取水',research:'天象研究',build:'营造与修复'})[arg]);return{ok:true,message:'分工已下达。只有清醒且适温的族人能劳动。'};
  }
  if(id==='repair'){
   if(s.project)return fail('施工尚未完成。');
   if(s.active<8)return fail('至少需要 8 名清醒族人施工。');
   if(s.materials<16)return fail('修仓需要 16 建材。');
   if(s.vault>=99)return fail('仓体已经完好。');
   s.materials-=16;s.project={type:'repair',progress:0};this.note('decision','开始修仓：消耗 16 建材，需要 12 刻适温劳动。');
   return{ok:true,message:'工匠开始加固；过早全员脱水会使工程停顿。'};
  }
  if(id==='archive'){
   if(s.materials<8)return fail('铭刻需要 8 建材。');
   if(s.knowledge<=s.meta.banked&&s.newRecords.length===0)return fail('目前没有尚未保存的新知识。');
   s.materials-=8;s.archive=Math.floor(s.knowledge);s.meta.banked=Math.max(s.meta.banked,s.archive);
   s.meta.records=[...new Set([...s.meta.records,...s.records])];s.newRecords=[];
   this.note('archive',`将 ${s.archive} 点知识刻入石碑。文明消亡后，这些知识仍可被找到。`);
   return{ok:true,message:'知识与遗迹记录已封存。建筑和物资不会随重建保留。'};
  }
  if(id==='lore'){
   if(!LORE[arg])return fail('未知遗迹。');
   if(s.records.includes(arg))return fail('已抄录此处；在文明碑铭刻后，下一代才能继承。');
   s.records.push(arg);s.newRecords.push(arg);s.knowledge+=18;
   this.note('discovery',LORE[arg].title+'：'+LORE[arg].lesson);
   return{ok:true,message:'遗迹已抄录，获得 18 点知识。'+LORE[arg].perk};
  }
  if(id==='complete'){
   if(s.catastrophes<2||s.active<32||s.meta.banked<80)return fail('需度过 2 场灾变，恢复至少 32 人，并封存 80 点知识。');
   s.won=true;s.ended=true;s.meta.bestSurvivors=Math.max(s.meta.bestSurvivors,Math.floor(s.active+s.dry));
   this.note('victory','文明续存协议完成。我们没有算出永恒，只给下一代留下了判断的方法。');
   return{ok:true,message:'文明续存协议完成。'};
  }
  return fail('未知操作。');
 }
 predict(){
  const s=this.s,obs=s.observations;
  if(obs.length<2)return null;
  const b=obs.at(-1),a=obs.at(-2),dt=b.t-a.t;
  if(dt<1)return null;
  const derivative=clamp((b.flux-a.flux)/dt,-.07,.07);
  const horizon=12;
  const projectedFlux=Math.max(0,b.flux+derivative*horizon*.55);
  const target=clamp(-49+100*projectedFlux,-70,180);
  const mid=b.temp+(target-b.temp)*(1-Math.exp(-horizon/24));
  // Errors grow with extrapolation distance, signal acceleration and age, not hidden state.
  let acceleration=0;
  if(obs.length>=3){const c=obs.at(-3);acceleration=Math.abs(derivative-(a.flux-c.flux)/Math.max(1,a.t-c.t))}
  const margin=7+11/(1+s.knowledge/40)+Math.abs(derivative)*110+acceleration*400;
  return{t:b.t,due:b.t+horizon,low:clamp(mid-margin,-90,240),high:clamp(mid+margin,-90,240),trend:derivative,margin};
 }
 tick(dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  // Bound every numerical integration step even when tests or time acceleration pass large dt.
  let rest=Math.min(dt,3600);while(rest>1e-8&&!this.s.ended){const step=Math.min(rest,.2);this.integrate(step);rest-=step}
 }
 integrate(dt){
  const s=this.s;s.t+=dt;s.step++;s.sky=skyAt(s.t,s.seed);
  const oldT=s.temperature;
  s.temperature+=(s.sky.equilibrium-s.temperature)*(1-Math.exp(-dt/24));
  s.tempTrend=(s.temperature-oldT)/dt;s.peak=Math.max(s.peak,s.temperature);s.trough=Math.min(s.trough,s.temperature);
  const habitable=s.temperature>=-12&&s.temperature<=50;
  if(s.mode==='dehydrate'){
   const n=Math.min(s.active,5*dt);const loss=n*.008;s.active-=n;s.dry+=n-loss;s.water+=n*.30;s.losses.handling+=loss;
   s.remaining=s.active;if(s.active<.01){s.active=0;s.mode='none';s.remaining=0;this.note('status','最后一名族人入仓。世界安静了；生产已经停止。')}
  }else if(s.mode==='revive'){
   const n=Math.min(s.dry,s.remaining,3*dt);s.dry-=n;s.active+=n;s.remaining-=n;
   if(s.remaining<.01||s.dry<.01){if(s.dry<1e-8){s.active+=s.dry;s.dry=0}s.mode='none';s.remaining=0;this.note('status','这批族人已完成浸泡。')}
  }
  // Survival consumption is continuous; water production only exists in the inhabitable band.
  s.water-=s.active*.012*dt;
  const labor=habitable?s.active:0;
  if(labor>0){
   const rates={balanced:[.042,.015,.010],water:[.13,.004,.002],research:[.005,.003,.038],build:[.010,.058,.003]}[s.task];
   s.water+=labor*rates[0]*dt;s.materials+=labor*rates[1]*dt;s.knowledge+=labor*rates[2]*dt;
   if(s.task==='build')s.vault+=labor*.003*dt;
   if(s.project&&s.active>=8){s.project.progress+=dt;if(s.project.progress>=12){s.vault+=s.records.includes('ruinHeat')?46:36;s.project=null;this.note('status','加固完成。石壁只能延缓热量，不能取消灾害。')}}
   s.buildLevel=Math.max(s.buildLevel,Math.min(3,Math.floor(s.knowledge/45)));
  }
  const heat=Math.max(0,s.temperature-55),cold=Math.max(0,-18-s.temperature);
  if(heat+cold>0){
   const rate=heat*.0015+cold*.0022;
   const loss=s.active*(1-Math.exp(-rate*dt));s.active-=loss;s.losses[heat>0?'heat':'cold']+=loss;
   s.savedByDry+=s.dry*rate*dt*.01;
  }
  // Underground thermal buffering is finite. Cold damages seals much more slowly than heat.
  const vaultStress=Math.max(0,s.temperature-85)*.014+Math.max(0,-40-s.temperature)*.009;
  s.vault-=vaultStress*dt;
  if(s.vault<30&&heat+cold>0){const loss=s.dry*(1-Math.exp(-(30-s.vault)*.0006*dt));s.dry-=loss;s.losses.vault+=loss}
  if(s.water<=0&&s.active>0){const loss=s.active*(1-Math.exp(-.035*dt));s.active-=loss;s.losses.thirst+=loss}
  s.water=clamp(s.water,0,240);s.materials=clamp(s.materials,0,180);s.knowledge=clamp(s.knowledge,0,999);s.vault=clamp(s.vault,0,100);
  if(!s.catastropheOpen&&(s.temperature>65||s.temperature< -25)){
   s.catastropheOpen=true;s.catastropheKind=s.temperature<0?'cold':s.sky.suns.filter(a=>!a.far).length>=3?'triple':'heat';
   this.note('hazard',s.catastropheKind==='cold'?'三颗太阳退到远处，地表正在失去储热。':s.catastropheKind==='triple'?'三日同时照射；输入地表的辐射正在叠加。':'逼近的日轮增大；地面吸热快于散热。');
  }
  if(s.catastropheOpen&&s.temperature> -12&&s.temperature<50&&s.sky.flux>.15&&s.sky.flux<1.25){
   s.catastropheOpen=false;s.catastrophes++;this.note('survival',`第 ${s.catastrophes} 场灾变已度过。气温回到劳动范围，但这不保证下一次日出。`);
  }
  if(s.t-s.lastAlarm>24&&(s.temperature>47&&s.tempTrend>.3||s.temperature< -8&&s.tempTrend<-.3)){
   s.lastAlarm=s.t;this.note('warning',s.tempTrend>0?'守望者敲钟：日轮在变大，石阶摸起来发烫。':'守望者敲钟：池沿结霜，三颗光点都太小了。');
  }
  for(const p of s.forecasts){if(!p.checked&&s.t>=p.due){p.checked=true;p.actual=s.temperature;p.hit=s.temperature>=p.low&&s.temperature<=p.high;s.checkedForecasts++;if(p.hit)s.correctForecasts++;if(!p.hit)this.note('forecast','一次短期外推超出估计带：天象变化加快。不要把局部趋势当作万年历。')}}
  if(s.t-s.lastSample>=2){s.lastSample=s.t;s.history.push({t:s.t,temp:s.temperature,flux:s.sky.flux,active:s.active,dry:s.dry,vault:s.vault});if(s.history.length>360)s.history.shift()}
  if(s.active+s.dry<5){s.ended=true;s.meta.failures++;this.note('extinction',this.failureReason())}
 }
 failureReason(){
  const s=this.s;const dominant=Object.entries(s.losses).sort((a,b)=>b[1]-a[1])[0][0];
  return {heat:'文明止于灼热。日轮增大与持续升温已发出征兆；脱水令下得太晚，或复苏过早。',cold:'文明止于长夜。三颗飞星意味着三日皆远；温暖的余温不是恒纪元的保证。',thirst:'文明止于缺水。浸泡消耗储水，清醒者持续饮水；研究与建设不会自动补足水源。',vault:'文明止于仓毁。脱水躲开了露天灾害，但受损的干仓失去了保护；需要提前留工修仓。',handling:'最后的族人未能延续。每次脱水有小幅损耗，反复迁移也有代价。'}[dominant];
 }
 serialize(){return JSON.stringify({version:VERSION,state:this.s})}
 static restore(text){
  try{const data=JSON.parse(text),s=data.state;if(data.version!==VERSION||!s||s.version!==VERSION)return null;
   for(const key of ['seed','t','temperature','active','dry','water','materials','knowledge','vault'])if(!Number.isFinite(s[key]))return null;
   if(!Number.isFinite(s.meta?.banked)||s.meta.banked<0||!Array.isArray(s.meta?.records)||!Number.isFinite(s.meta?.generation))return null;
   if(s.t<0||s.t>1e7||s.active<0||s.dry<0||s.active+s.dry>121||!s.meta||!Array.isArray(s.log)||!Array.isArray(s.records)||!Array.isArray(s.observations)||!Array.isArray(s.forecasts)||!s.losses||!['none','revive','dehydrate'].includes(s.mode))return null;
   const sim=new Simulation(s.seed,s.meta);sim.s={...freshState(s.seed,s.meta),...s,sky:skyAt(s.t,s.seed)};return sim;
  }catch{return null}
 }
}
export function terrainHeight(x,z){
 const r=Math.hypot(x,z),outer=smooth((r-37)/55);
 return outer*(1.8*Math.sin(x*.047)+1.1*Math.cos(z*.062)+.6*Math.sin((x+z)*.10))+.06*Math.sin(x*.13)*Math.sin(z*.12);
}
export function moveWithCollisions(x,z,dx,dz,colliders,radius=.42){
 // Small substeps prevent tunnelling; axis separation provides stable wall sliding.
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22));
 const blocked=(a,b)=>Math.hypot(a,b)>118||colliders.some(c=>c.kind==='circle'?Math.hypot(a-c.x,b-c.z)<c.r+radius:(a>c.x-c.w/2-radius&&a<c.x+c.w/2+radius&&b>c.z-c.d/2-radius&&b<c.z+c.d/2+radius));
 for(let i=0;i<steps;i++){if(!blocked(x+dx/steps,z))x+=dx/steps;if(!blocked(x,z+dz/steps))z+=dz/steps}
 return{x,z};
}
