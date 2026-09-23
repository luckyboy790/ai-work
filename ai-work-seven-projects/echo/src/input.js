import {moveWithCollisions,terrainHeight,clamp} from './simulation.js';
/** Pointer lock is optional. Drag-to-look works on desktop, tablets and insecure LAN URLs. */
export class Input{
 constructor(canvas,camera,colliders,onAction){
  this.canvas=canvas;this.camera=camera;this.colliders=colliders;this.onAction=onAction;
  this.keys=new Set();this.enabled=false;this.yaw=0;this.pitch=.09;this.x=0;this.z=27;
  this.lookPointer=null;this.touchLook=null;this.stick={x:0,y:0};this.moving=false;this.bob=0;this.dragged=false;
  this.touch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
  document.body.classList.toggle('touch',this.touch);
  addEventListener('keydown',e=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
   if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
   this.keys.add(e.code);
   if(!e.repeat){if(e.code==='KeyE')onAction('interact');if(e.code==='Escape'||e.code==='KeyP')onAction('pause');if(e.code==='KeyJ')onAction('journal');if(e.code==='KeyM')onAction('map');if(e.code==='KeyT')onAction('speed')}
  });
  addEventListener('keyup',e=>this.keys.delete(e.code));
  addEventListener('blur',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();onAction('visibility')}});
  document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('locked',document.pointerLockElement===canvas)});
  document.addEventListener('mousemove',e=>{if(this.enabled&&document.pointerLockElement===canvas)this.look(e.movementX,e.movementY,.0022)});
  canvas.addEventListener('pointerdown',e=>{
   if(!this.enabled)return;
   if(e.pointerType==='touch'||document.pointerLockElement!==canvas){this.lookPointer=e.pointerId;this.dragged=false;this.lastX=e.clientX;this.lastY=e.clientY;canvas.setPointerCapture(e.pointerId)}
  });
  canvas.addEventListener('pointermove',e=>{if(this.enabled&&this.lookPointer===e.pointerId){const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;this.lastX=e.clientX;this.lastY=e.clientY;this.dragged=true;this.look(dx,dy,e.pointerType==='touch'?.004:.004)}});
  const end=e=>{if(this.lookPointer===e.pointerId)this.lookPointer=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('dblclick',()=>{if(this.enabled&&!this.touch&&canvas.requestPointerLock){try{const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{})}catch{}}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  this.setupJoystick();
 }
 setupJoystick(){
  const el=document.querySelector('#joystick'),knob=document.querySelector('#stick');let id=null,ox=0,oy=0;
  el.addEventListener('pointerdown',e=>{if(!this.enabled)return;e.preventDefault();id=e.pointerId;el.setPointerCapture(id);const r=el.getBoundingClientRect();ox=r.left+r.width/2;oy=r.top+r.height/2;move(e)});
  const move=e=>{if(e.pointerId!==id)return;const dx=e.clientX-ox,dy=e.clientY-oy,len=Math.max(42,Math.hypot(dx,dy));this.stick.x=dx/len;this.stick.y=dy/len;knob.style.transform=`translate(${this.stick.x*35}px,${this.stick.y*35}px)`};
  const end=e=>{if(e.pointerId!==id)return;id=null;this.stick.x=this.stick.y=0;knob.style.transform='translate(0,0)'};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
 }
 look(dx,dy,sensitivity){this.yaw-=dx*sensitivity;this.pitch=clamp(this.pitch-dy*sensitivity,-1.15,1.3)}
 clear(){this.keys.clear();this.stick.x=this.stick.y=0;this.lookPointer=null;const s=document.querySelector('#stick');if(s)s.style.transform='translate(0,0)'}
 setEnabled(v){this.enabled=v;if(!v){this.clear();if(document.pointerLockElement)document.exitPointerLock()}}
 reset(){this.x=0;this.z=27;this.yaw=0;this.pitch=.09;this.bob=0;this.clear();this.camera.position.set(this.x,terrainHeight(this.x,this.z)+1.78,this.z)}
 update(dt){
  let forward=0,right=0;
  if(this.enabled){forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-this.stick.y;right=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'))+this.stick.x;
   if(this.keys.has('ArrowLeft'))this.yaw+=dt*1.25;if(this.keys.has('ArrowRight'))this.yaw-=dt*1.25;
   const l=Math.max(1,Math.hypot(forward,right));forward/=l;right/=l;
  }
  this.moving=Math.abs(forward)+Math.abs(right)>.03;
  const speed=this.keys.has('ShiftLeft')?8.5:5.4;
  const dx=(right*Math.cos(this.yaw)-forward*Math.sin(this.yaw))*speed*dt;
  const dz=(-forward*Math.cos(this.yaw)-right*Math.sin(this.yaw))*speed*dt;
  const p=moveWithCollisions(this.x,this.z,dx,dz,this.colliders);this.x=p.x;this.z=p.z;
  if(this.moving)this.bob+=dt*9;
  const y=terrainHeight(this.x,this.z)+1.78+(this.moving?Math.sin(this.bob)*.018:0);
  this.camera.position.x=this.x;this.camera.position.z=this.z;this.camera.position.y+=(y-this.camera.position.y)*(1-Math.exp(-dt*18));
  this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
 }
}
