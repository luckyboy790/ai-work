/** All sound is synthesized after a user gesture. No audio URLs or autoplay. */
export class Soundscape{
 constructor(){this.context=null;this.enabled=true;this.lastBell=0;this.stepTimer=0}
 async start(){
  if(!this.enabled)return;
  try{
   if(!this.context){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const c=this.context=new C();this.master=c.createGain();this.master.gain.value=.35;this.master.connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);
    let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.024)/1.025;data[i]=last*3.5}
    const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=380;
    this.wind=c.createGain();this.wind.gain.value=.24;noise.connect(this.filter).connect(this.wind).connect(this.master);noise.start();
    this.drone=c.createOscillator();this.drone.type='sine';this.drone.frequency.value=48;
    this.droneGain=c.createGain();this.droneGain.gain.value=.03;this.drone.connect(this.droneGain).connect(this.master);this.drone.start();
    this.noiseBuffer=buffer;
   }
   if(this.context.state==='suspended')await this.context.resume();
  }catch(e){console.warn('合成音不可用；游戏保持可玩。',e.message)}
 }
 toggle(){this.enabled=!this.enabled;if(this.context)this.master.gain.setTargetAtTime(this.enabled?.35:0,this.context.currentTime,.12);if(this.enabled)this.start();return this.enabled}
 setPaused(paused){if(this.context)this.master.gain.setTargetAtTime(this.enabled?(paused?.10:.35):0,this.context.currentTime,.3)}
 update(s,dt,moving,distanceToPool){
  if(!this.context||!this.enabled)return;const c=this.context,t=c.currentTime;
  const harsh=Math.min(1,Math.max(Math.abs(s.temperature-20)/110,s.sky.perturbation));
  this.filter.frequency.setTargetAtTime(300+harsh*1700,t,.8);
  this.wind.gain.setTargetAtTime(.15+harsh*.45,t,.8);this.drone.frequency.setTargetAtTime(42+s.sky.flux*12,t,1);
  this.droneGain.gain.setTargetAtTime(.02+harsh*.03,t,1);
  if(moving){this.stepTimer+=dt;if(this.stepTimer>.48){this.stepTimer=0;this.footstep()}}
  if(s.lastAlarm>this.lastBell){this.lastBell=s.lastAlarm;this.bell()}
 }
 footstep(){if(!this.context)return;const c=this.context,n=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();n.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=750;g.gain.setValueAtTime(.10,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);n.connect(f).connect(g).connect(this.master);n.start();n.stop(c.currentTime+.14);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect()}}
 bell(){if(!this.context)return;const c=this.context,t=c.currentTime;[220,447,602,923].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.1/(i+1),t);g.gain.exponentialRampToValueAtTime(.0001,t+3);o.connect(g).connect(this.master);o.start(t);o.stop(t+3);o.onended=()=>{o.disconnect();g.disconnect()}})}
 chime(){if(!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.frequency.value=520;g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.25);o.connect(g).connect(this.master);o.start();o.stop(c.currentTime+.28);o.onended=()=>{o.disconnect();g.disconnect()}}
}
