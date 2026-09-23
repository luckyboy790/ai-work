import * as THREE from '../vendor/three.module.js';
import {terrainHeight,random,clamp,STATIONS} from './simulation.js';
const TAU=Math.PI*2;
const skyVertex=`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const skyFragment=`
precision highp float;
varying vec3 vDir;uniform vec3 sunDir[3];uniform vec3 sunColor[3];uniform float sunRadius[3];uniform float flux;uniform float heat;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 d=normalize(vDir);float h=max(d.y,0.0);float day=smoothstep(.03,.8,flux);
 vec3 night=mix(vec3(.037,.057,.075),vec3(.005,.013,.027),pow(h,.48));
 vec3 horizon=mix(vec3(.54,.49,.39),vec3(.62,.24,.10),heat);
 vec3 zenith=mix(vec3(.14,.25,.29),vec3(.27,.12,.085),heat);
 vec3 col=mix(night,mix(horizon,zenith,pow(h,.45)),day);
 for(int i=0;i<3;i++){
  float a=acos(clamp(dot(d,sunDir[i]),-1.,1.));float r=sunRadius[i];
  float core=1.-smoothstep(r*.94,r*1.035,a);
  float halo=exp(-a*a/(r*r*4.4))*.40;
  float wide=exp(-a*a/(r*r*38.))*.055;
  float gran=.92+.08*sin(d.x*920.+time*.2)*sin(d.y*1400.+time*.15);
  col+=sunColor[i]*(core*gran*3.8+halo+wide);
 }
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const waterVertex=`varying vec2 vUv;varying vec3 vPosition;void main(){vUv=uv;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const waterFragment=`precision highp float;varying vec2 vUv;varying vec3 vPosition;uniform float time;uniform float freeze;uniform float light;
 void main(){vec2 p=vPosition.xy;float wave=sin(p.x*3.1+time*.8)*sin(p.y*3.9-time*.7);float rip=pow(.5+.5*sin(length(p)*9.-time*1.2),14.);vec3 water=mix(vec3(.025,.10,.115),vec3(.20,.43,.43),.55+wave*.25);water+=rip*.1;vec3 ice=vec3(.58,.68,.70)+.08*wave;gl_FragColor=vec4(mix(water,ice,freeze)*(.38+light*.62),.93);}`;
const weatherVertex=`uniform float time;uniform vec3 player;uniform float harsh;uniform float cold;varying float alpha;void main(){vec3 p=position;float span=65.;p.x=mod(p.x+time*(3.+harsh*9.),span)-span*.5;p.z=mod(p.z+time*1.4,span)-span*.5;p.y=mod(p.y-time*(.5+cold*2.),19.)+1.;p+=player;vec4 mv=modelViewMatrix*vec4(p,1.);alpha=harsh*.50;gl_PointSize=clamp((cold>.5?80.:45.)/-mv.z,1.,5.);gl_Position=projectionMatrix*mv;}`;
const weatherFragment=`uniform float cold;varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vec3(.72,.49,.27),vec3(.77,.88,.92),cold),alpha*(1.-d*2.));}`;

export class World{
 constructor(canvas,quality='auto'){
  this.canvas=canvas;this.quality=quality;this.low=quality==='low';this.colliders=[];this.rng=random(826519);this.decor=[];this.workers=[];this.flags=[];this.fire=[];this.time=0;this.scratch=new THREE.Vector3();
  this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x969284,.0018);
  this.camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.10,1300);this.camera.position.set(0,1.78,27);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.low?1:1.5));this.renderer.setSize(innerWidth,innerHeight);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.debug.checkShaderErrors=true;
  this.figureMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  this.mat={stone:new THREE.MeshStandardMaterial({color:0x8c8070,roughness:.96}),lightStone:new THREE.MeshStandardMaterial({color:0xb3a18a,roughness:.96}),dark:new THREE.MeshStandardMaterial({color:0x393b38,roughness:.91}),bronze:new THREE.MeshStandardMaterial({color:0x967653,metalness:.48,roughness:.44}),cloth:new THREE.MeshStandardMaterial({color:0x9d8e73,side:THREE.DoubleSide,roughness:1}),char:new THREE.MeshStandardMaterial({color:0x383330,roughness:1}),glow:new THREE.MeshBasicMaterial({color:0xa4ddce}),wood:new THREE.MeshStandardMaterial({color:0x615342,roughness:1}),skin:new THREE.MeshStandardMaterial({color:0x887c6b,roughness:1})};
  this.geo={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,12),rock:new THREE.DodecahedronGeometry(1,0)};
  this.buildSky();this.buildTerrain();this.buildPaths();this.buildObservatory();this.buildVault();this.buildPool();this.buildSettlement();this.buildArchive();this.buildRuins();this.buildCitizens();this.buildWeather();
  for(const st of STATIONS)this.sign(st);
  this.mergeStaticArchitecture();
  this.setQuality(quality);
  addEventListener('resize',()=>this.resize());
 }
 mesh(geometry,material,x,y,z,parent=this.scene){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 box(x,y,z,w,h,d,mat=this.mat.stone,parent=this.scene){const m=this.mesh(this.geo.box,mat,x,y,z,parent);m.scale.set(w,h,d);return m}
 cylinder(x,y,z,r,h,mat=this.mat.stone,parent=this.scene){const m=this.mesh(this.geo.cylinder,mat,x,y,z,parent);m.scale.set(r,h,r);return m}
 blockCollider(x,z,w,d){this.colliders.push({kind:'box',x,z,w,d})}
 circleCollider(x,z,r){this.colliders.push({kind:'circle',x,z,r})}
 beam(a,b,r,mat=this.mat.bronze,parent=this.scene){const dir=new THREE.Vector3().subVectors(b,a),m=this.mesh(this.geo.cylinder,mat,0,0,0,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(r,dir.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return m}
 buildSky(){
  this.skyUniforms={sunDir:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},sunColor:{value:[new THREE.Color(1,.73,.38),new THREE.Color(.92,.97,1),new THREE.Color(1,.39,.19)]},sunRadius:{value:[.05,.003,.003]},flux:{value:.7},heat:{value:0},time:{value:0}};
  const skyMat=new THREE.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,uniforms:this.skyUniforms,side:THREE.BackSide,depthWrite:false});
  this.sky=this.mesh(new THREE.SphereGeometry(1000,32,20),skyMat,0,0,0);this.sky.castShadow=false;this.sky.receiveShadow=false;this.sky.renderOrder=-20;
  const points=[];for(let i=0;i<2200;i++){const y=this.rng()*2-1,az=this.rng()*TAU,r=Math.sqrt(1-y*y);points.push(r*Math.cos(az)*910,y*910,r*Math.sin(az)*910)}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  this.stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xa8c6d6,size:1.45,sizeAttenuation:false,transparent:true,opacity:.3,depthWrite:false}));this.scene.add(this.stars);
  this.hemi=new THREE.HemisphereLight(0x90aab2,0x625342,1.1);this.scene.add(this.hemi);
  this.sunLights=[];for(let i=0;i<3;i++){
   const l=new THREE.DirectionalLight([0xffdcaa,0xd3e7ff,0xffa37e][i],1);l.position.set(40,70,-60);l.castShadow=i===0;
   l.shadow.mapSize.set(1024,1024);Object.assign(l.shadow.camera,{left:-62,right:62,top:62,bottom:-62,near:1,far:260});l.shadow.bias=-.0005;l.shadow.normalBias=.12;l.shadow.radius=2;
   this.scene.add(l);this.scene.add(l.target);this.sunLights.push(l);
  }
 }
 sandTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),img=ctx.createImageData(512,512),rnd=random(911);
  for(let i=0;i<img.data.length;i+=4){const n=(rnd()-.5)*28;img.data[i]=159+n;img.data[i+1]=145+n;img.data[i+2]=119+n;img.data[i+3]=255}ctx.putImageData(img,0,0);
  ctx.strokeStyle='rgba(63,53,40,.13)';ctx.lineWidth=.7;for(let i=0;i<85;i++){let x=rnd()*512,y=rnd()*512;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<4;k++){x+=(rnd()-.5)*40;y+=(rnd()-.5)*40;ctx.lineTo(x,y)}ctx.stroke()}
  const tx=new THREE.CanvasTexture(c);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(88,88);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;return tx;
 }
 buildTerrain(){
  const geo=new THREE.PlaneGeometry(840,840,220,220);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(pos.getX(i),pos.getZ(i))-.025);geo.computeVertexNormals();
  this.groundMat=new THREE.MeshStandardMaterial({color:0xc3b295,map:this.sandTexture(),roughness:1});
  const ground=this.mesh(geo,this.groundMat,0,0,0);ground.castShadow=false;
  // Three layers of mountains: low mesa skirts, broken cliffs, high remote ridges.
  const rnd=this.rng;
  for(let i=0;i<54;i++){
   const az=i/54*TAU,dist=185+rnd()*170,h=14+rnd()*65,r=20+rnd()*38;
   const g=new THREE.CylinderGeometry(r*(.35+rnd()*.3),r*1.45,h,5+Math.floor(rnd()*4));
   const m=this.mesh(g,i%3===0?this.mat.dark:this.mat.stone,Math.sin(az)*dist,h/2-8,Math.cos(az)*dist);m.rotation.y=rnd()*TAU;m.castShadow=false;
   // Strata make silhouettes read as geology, not unmodified cones.
   if(i%2===0){const strata=this.mesh(new THREE.CylinderGeometry(r*.82,r*1.15,h*.08,6),this.mat.dark,m.position.x,h*.38,m.position.z);strata.rotation.y=m.rotation.y;strata.castShadow=false}
  }
  const rocks=new THREE.InstancedMesh(this.geo.rock,this.mat.stone,480),o=new THREE.Object3D();
  for(let i=0;i<480;i++){const a=rnd()*TAU,r=38+rnd()*142,x=Math.sin(a)*r,z=Math.cos(a)*r;const size=.15+rnd()*2.0;o.position.set(x,terrainHeight(x,z)+size*.20,z);o.scale.set(size*(1+rnd()),size*.5,size);o.rotation.set(rnd(),rnd()*TAU,rnd());o.updateMatrix();rocks.setMatrixAt(i,o.matrix)}
  rocks.receiveShadow=true;rocks.castShadow=true;this.scene.add(rocks);this.rocks=rocks;
  // Ruined aqueduct establishes human scale against the geological horizon.
  for(let i=0;i<12;i++){const x=-65+i*7,z=-84;const h=10+(i%4)*2;this.box(x,h/2,z,1.8,h,2.1,this.mat.char);if(i%4!==1)this.box(x+2.9,h-.7,z,5.8,1.2,2.1,this.mat.char)}
 }
 buildPaths(){
  const tiles=[];const rnd=this.rng;
  const path=(x1,z1,x2,z2,width)=>{const len=Math.hypot(x2-x1,z2-z1),az=Math.atan2(x2-x1,z2-z1);for(let d=0;d<len;d+=1.7){for(let j=0;j<width;j++){const along=d+(rnd()-.5)*.12,side=(j-(width-1)/2)*1.45;const x=x1+Math.sin(az)*along+Math.cos(az)*side,z=z1+Math.cos(az)*along-Math.sin(az)*side;tiles.push({x,z,az})}}};
  path(0,40,0,-20,4);path(-22,8,20,8,3);path(-20,-17,20,-17,3);path(-20,8,-20,-17,2);path(20,8,20,-17,2);
  const inst=new THREE.InstancedMesh(this.geo.box,this.mat.lightStone,tiles.length),o=new THREE.Object3D();
  tiles.forEach((t,i)=>{o.position.set(t.x,terrainHeight(t.x,t.z)-.005,t.z);o.rotation.set(0,t.az+(rnd()-.5)*.025,0);o.scale.set(1.37,.045,1.61);o.updateMatrix();inst.setMatrixAt(i,o.matrix);inst.setColorAt(i,new THREE.Color().setHSL(.10,.13,.39+rnd()*.16))});inst.receiveShadow=true;this.scene.add(inst);
  this.cylinder(0,.01,-4,10,.08,this.mat.dark);this.cylinder(0,.06,-4,9.65,.035,this.mat.lightStone);
  for(let i=0;i<48;i++){const a=i/48*TAU;const b=this.box(Math.sin(a)*8.8,.09,-4+Math.cos(a)*8.8,.05,.025,i%4===0?1:.45,this.mat.bronze);b.rotation.y=a}
  const ring=this.mesh(new THREE.TorusGeometry(7.6,.035,5,100),this.mat.bronze,0,.12,-4);ring.rotation.x=Math.PI/2;
  // Low route lamps remain legible when all three suns recede.
  this.lamps=[];for(const [x,z] of [[-4,20],[4,20],[-4,7],[4,7],[-4,-11],[4,-11],[-15,11],[15,11]]){
   this.box(x,.38,z,.52,.76,.52,this.mat.dark);this.cylinder(x,.8,z,.20,.08,this.mat.glow);this.circleCollider(x,z,.35);
   const glow=this.mesh(new THREE.SphereGeometry(.1,8,5),this.mat.glow,x,.86,z);this.lamps.push(glow);
  }
 }
 buildObservatory(){
  const g=new THREE.Group();g.position.set(0,0,-25);this.scene.add(g);
  // Paired pylons with a real traversable central aperture; no painted-on doorway.
  for(const sign of [-1,1]){
   const x=sign*6.4;
   this.box(x,8.5,-2,4.8,17,4.2,this.mat.stone,g);
   this.box(x,17.2,-2,5.6,.8,5,this.mat.dark,g);
   this.box(x,18.1,-2,4.5,1,4,this.mat.lightStone,g);
   for(let j=0;j<9;j++)this.box(x,1+j*1.85,.13,4.7,.06,.06,this.mat.dark,g);
   for(const offset of [-1.65,1.65])this.box(x+offset,8.2,.3,.18,16,.24,this.mat.bronze,g);
   this.blockCollider(x,-27,4.8,4.2);
   const foot=this.box(x,1,-.5,6.5,2,7.4,this.mat.stone,g);this.blockCollider(x,-25.5,6.5,7.4);
  }
  this.box(0,16.5,-2,9,1.5,3.3,this.mat.dark,g);
  for(let i=0;i<5;i++)this.box(0,17.35+i*.10,-2,8-i*1.0,.18,3.4-i*.45,this.mat.lightStone,g);
  this.armillary=new THREE.Group();this.armillary.position.set(0,8.1,-24);this.scene.add(this.armillary);
  const axes=[[.22,.35,0],[1.14,.5,0],[0,0,.61]];
  axes.forEach((r,i)=>{const ring=this.mesh(new THREE.TorusGeometry(5.7-i*.5,.075,8,100),i===2?this.mat.lightStone:this.mat.bronze,0,0,0,this.armillary);ring.rotation.set(...r);
   if(i===0){const ticks=new THREE.InstancedMesh(this.geo.box,this.mat.bronze,72),o=new THREE.Object3D();for(let j=0;j<72;j++){const a=j/72*TAU;o.position.set(Math.sin(a)*5.7,Math.cos(a)*5.7,0);o.scale.set(.065,j%6===0?.44:.22,.08);o.rotation.z=-a;o.updateMatrix();ticks.setMatrixAt(j,o.matrix)}ring.add(ticks)}
  });
  const orb=this.mesh(new THREE.SphereGeometry(.38,20,12),this.mat.bronze,0,0,0,this.armillary);this.beam(new THREE.Vector3(-5.8,-2.4,0),new THREE.Vector3(5.8,2.4,0),.045,this.mat.bronze,this.armillary);
  this.cylinder(0,3.1,-24,.30,6.2,this.mat.dark);this.cylinder(0,.42,-24,1.7,.85,this.mat.stone);this.circleCollider(0,-24,1.8);
  // Actual observer's instrument and standing approach on the south side.
  this.cylinder(0,.50,-19.7,.80,1,this.mat.dark);this.cylinder(0,1.10,-19.7,.55,.16,this.mat.bronze);
  const lens=this.mesh(new THREE.CylinderGeometry(.19,.24,1.55,18),this.mat.bronze,0,1.65,-19.7);lens.rotation.x=.85;
  this.circleCollider(0,-19.7,.8);
  for(let i=0;i<2;i++){
   const x=i===0?-10:10,z=-20;
   this.box(x,4.4,z,.35,8.8,.5,this.mat.dark);this.box(x,8.8,z+1.8,.4,.32,4,this.mat.bronze);
   const pivot=new THREE.Group();pivot.position.set(x,8.6,z+3);this.scene.add(pivot);
   this.cylinder(0,-3.1,0,.025,6.2,this.mat.bronze,pivot);this.mesh(new THREE.SphereGeometry(.36,16,12),this.mat.bronze,0,-6.2,0,pivot);
   this.flags.push({pivot,phase:i});this.circleCollider(x,z,.4);
  }
 }
 buildVault(){
  const x=-20,z=2;this.vaultGroup=new THREE.Group();this.vaultGroup.position.set(x,0,z);this.scene.add(this.vaultGroup);
  const g=this.vaultGroup;
  // Vault roof with a hollow entrance, shelves and a walkable central corridor.
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(5.4,5.4,11,36,1,true,0,Math.PI),this.mat.dark);
  roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2; // replace orientation below with explicit barrel surface
  const points=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI;points.push(new THREE.Vector2(0,0))}
  const shape=new THREE.Shape();shape.moveTo(-5.5,0);shape.absarc(0,0,5.5,Math.PI,0,true);shape.lineTo(4.9,0);shape.absarc(0,0,4.9,0,Math.PI,false);shape.closePath();
  const barrel=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:10,steps:1,bevelEnabled:false,curveSegments:32}),this.mat.dark,0,.35,-6,g);
  this.box(-4.9,1.4,-1,.9,2.8,10,this.mat.stone,g);this.box(4.9,1.4,-1,.9,2.8,10,this.mat.stone,g);this.box(0,2,-6,10,4,1,this.mat.stone,g);
  this.blockCollider(x-4.9,z-1,.9,10);this.blockCollider(x+4.9,z-1,.9,10);this.blockCollider(x,z-6,10,1);
  // Facade stones explicitly leave the 3.6 m opening clear.
  for(const side of [-1,1]){this.box(side*3.7,1.7,4,3.4,3.4,1.1,this.mat.stone,g);this.blockCollider(x+side*3.7,z+4,3.4,1.1)}
  const arch=new THREE.Mesh(new THREE.TorusGeometry(2.2,.45,6,30,Math.PI),this.mat.lightStone);arch.position.set(0,3,4.5);g.add(arch);this.box(-2.2,1.5,4.5,.9,3,.9,this.mat.lightStone,g);this.box(2.2,1.5,4.5,.9,3,.9,this.mat.lightStone,g);
  for(let i=0;i<6;i++){const r=this.mesh(new THREE.TorusGeometry(5.53,.10,5,40,Math.PI),this.mat.stone,0,.35,4-i*1.85,g)}
  this.dryBundles=[];
  for(const side of [-1,1])for(let level=0;level<3;level++){
   this.box(side*3.4,.65+level*.84,-1.1,2.1,.12,7.5,this.mat.wood,g);
   for(let j=0;j<5;j++){
    const bundle=new THREE.Group();bundle.position.set(side*3.4,.85+level*.84,-4+j*1.4);g.add(bundle);
    const body=this.mesh(new THREE.CapsuleGeometry(.23,.64,3,7),this.mat.cloth,0,0,0,bundle);body.rotation.x=Math.PI/2;body.scale.z=.35;
    const head=this.mesh(new THREE.SphereGeometry(.14,7,5),this.mat.skin,0,.015,-.62,bundle);head.scale.y=.5;
    for(const bandZ of [-.2,.2])this.box(0,.075,bandZ,.49,.025,.045,this.mat.dark,bundle);
    this.batchFigure(bundle);this.dryBundles.push(bundle);
   }
   this.blockCollider(x+side*3.4,z-1.1,2.1,7.5);
  }
  const light=new THREE.PointLight(0x83bdb0,5,13,2);light.position.set(x,2.8,z+1);this.scene.add(light);
  this.box(0,3.8,4.8,1.8,.10,.15,this.mat.glow,g);
 }
 buildPool(){
  const x=20,z=4;this.poolCenter={x,z};
  this.cylinder(x,.17,z,5.9,.34,this.mat.dark);this.cylinder(x,.36,z,5.55,.36,this.mat.lightStone);
  this.cylinder(x,.55,z,4.95,.35,this.mat.dark);
  const waterMat=this.waterMat=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,uniforms:{time:{value:0},freeze:{value:0},light:{value:1}},transparent:true,side:THREE.DoubleSide});
  this.water=this.mesh(new THREE.CircleGeometry(4.7,72),waterMat,x,.755,z);this.water.rotation.x=-Math.PI/2;this.water.castShadow=false;
  for(let i=0;i<42;i++){const a=i/42*TAU,m=this.box(x+Math.sin(a)*5.34,.66,z+Math.cos(a)*5.34,.73,.30,.55,this.mat.stone);m.rotation.y=a}
  for(const side of [-1,1]){
   this.box(x+side*6.2,.55,z,1.1,1.1,4.5,this.mat.stone);this.blockCollider(x+side*6.2,z,1.1,4.5);
   this.beam(new THREE.Vector3(x+side*6.2,3,z-1.7),new THREE.Vector3(x+side*6.2,.6,z+1.7),.07,this.mat.bronze);
  }
  this.circleCollider(x,z,5.6);
  // Water feed channel, intentionally shallow and not a collision wall.
  this.box(x,.08,z-10,1.4,.10,9,this.mat.dark);this.box(x,.15,z-10,.85,.08,9,this.mat.bronze);
  const mast=this.box(x-7,3,z-6,.22,6,.22,this.mat.wood);this.circleCollider(x-7,z-6,.25);
  this.banner(x-7,5,z-6,3,1.7);
 }
 banner(x,y,z,w,h){
  const geo=new THREE.PlaneGeometry(w,h,12,5);geo.translate(w*.5,0,0);
  const flag=this.mesh(geo,this.mat.cloth,x,y,z);flag.castShadow=false;this.flags.push({flag,base:Array.from(geo.attributes.position.array),phase:this.rng()*4});
 }
 buildSettlement(){
  this.settlement=new THREE.Group();this.scene.add(this.settlement);this.plants=[];
  const locations=[[23,-19],[32,-19],[27,-30],[37,-30],[38,-10]];
  locations.forEach(([x,z],idx)=>{
   const y=terrainHeight(x,z);
   this.box(x,y+.20,z,6.6,.40,6,this.mat.dark);this.box(x,y+1.3,z,5.9,2.3,5.5,this.mat.stone);
   this.box(x,y+2.55,z,6.3,.32,5.9,this.mat.lightStone);this.box(x,y+3,z,5.8,.65,5.4,this.mat.stone);
   this.blockCollider(x,z,6.6,6);
   // Deep black doorway and lintel on building facades; these dwellings are explicitly closed.
   this.box(x,y+1.25,z+2.77,1.2,2.1,.05,this.mat.dark);this.box(x,y+2.3,z+2.82,1.7,.17,.19,this.mat.wood);
   for(const k of [-1.8,1.8])this.box(x+k,y+1.6,z+2.8,.65,.60,.07,this.mat.dark);
   if(idx<3){for(let j=0;j<5;j++)this.box(x-2.5+j*1.25,y+3.45,z,.14,.14,6.2,this.mat.wood);const shade=this.mesh(new THREE.PlaneGeometry(5.6,6),this.mat.cloth,x,y+3.5,z);shade.rotation.x=-Math.PI/2;}
  });
  // Workshop: tables, posts, tool wheel and open-sided woven awning.
  for(const [x,z] of [[14,-14],[21,-14],[14,-9],[21,-9]]){this.box(x,1.85,z,.15,3.7,.15,this.mat.wood);this.circleCollider(x,z,.20)}
  this.box(17.5,3.65,-11.5,7.4,.15,5.6,this.mat.wood);
  const awning=this.mesh(new THREE.PlaneGeometry(7.4,5.6),this.mat.cloth,17.5,3.72,-11.5);awning.rotation.x=-Math.PI/2;
  this.box(18,.95,-13.2,3,.16,1.15,this.mat.wood);for(const x of [16.8,19.2])this.box(x,.48,-13.2,.13,.96,.9,this.mat.wood);this.blockCollider(18,-13.2,3,1.15);
  for(let i=0;i<6;i++)this.cylinder(17+i*.28,1.1,-13.2,.065,.25,this.mat.bronze);
  this.scaffolds=new THREE.Group();this.scene.add(this.scaffolds);
  for(let level=0;level<3;level++){
   const group=new THREE.Group();this.scaffolds.add(group);
   for(let i=0;i<4;i++)this.box(30+i*1.4,.8+level*.65,-2,1.25,.6,1.6,this.mat.lightStone,group);
  }
  // Crops show labour, drought and frost rather than changing the HUD alone.
  this.plantMat=new THREE.MeshStandardMaterial({color:0x6b7546,roughness:1,side:THREE.DoubleSide});
  const plantGeo=new THREE.ConeGeometry(.19,.68,4);const inst=new THREE.InstancedMesh(plantGeo,this.plantMat,240);const o=new THREE.Object3D();
  for(let i=0;i<240;i++){const x=28+(i%12)*.72,z=11+Math.floor(i/12)*.52;o.position.set(x,terrainHeight(x,z)+.22,z);o.rotation.y=this.rng()*TAU;o.scale.setScalar(.6+this.rng()*.6);o.updateMatrix();inst.setMatrixAt(i,o.matrix)}
  inst.castShadow=true;inst.receiveShadow=true;this.scene.add(inst);this.crops=inst;
  for(let i=0;i<5;i++)this.box(31.8,.10,11+i*2.7,10,.10,.14,this.mat.dark);
  this.banner(24,4,-17,2.2,1.2);this.box(24,2,-17,.12,4,.12,this.mat.wood);
 }
 buildArchive(){
  const x=-20,z=-20;
  this.cylinder(x,.12,z,5.1,.24,this.mat.dark);
  for(let i=0;i<7;i++){
   const a=(-.75+i*.25)*Math.PI,px=x+Math.sin(a)*3.9,pz=z+Math.cos(a)*3.9,h=2.8+(i%3)*.72;
   const m=this.box(px,h/2,pz,1.2,h,.6,i%2===0?this.mat.dark:this.mat.stone);m.rotation.y=a;this.circleCollider(px,pz,.78);
   for(let j=0;j<9;j++){const bar=this.box(0,.35+j*.24,.32,.6-(j%3)*.08,.025,.012,this.mat.bronze,m);bar.position.y=-h*.35+j*.22;bar.scale.set(.60,.025,.012)}
  }
  this.box(x,.7,z+1.25,2.4,1.4,1.05,this.mat.dark);this.blockCollider(x,z+1.25,2.4,1.05);
  const tablet=this.box(x,1.45,z+1.25,2.1,.13,.9,this.mat.bronze);tablet.rotation.x=.12;
  this.archiveGlow=this.mesh(new THREE.TorusGeometry(.55,.025,6,48),this.mat.glow,x,1.54,z+1.25);this.archiveGlow.rotation.x=-Math.PI/2;
 }
 buildRuins(){
  for(const st of STATIONS.filter(s=>s.id.startsWith('ruin'))){
   const x=st.x,z=st.z,y=terrainHeight(x,z);
   for(let i=0;i<9;i++){
    const a=i/9*TAU,r=4+this.rng()*3,px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r,h=1+this.rng()*5.5;
    const m=this.box(px,terrainHeight(px,pz)+h/2,pz,.9,h,1.1,this.mat.char);m.rotation.z=(this.rng()-.5)*.16;this.circleCollider(px,pz,.82);
   }
   this.box(x,y+.65,z,2.5,1.3,1.5,this.mat.dark);this.blockCollider(x,z,2.5,1.5);
   const slab=this.box(x+3.3,y+.32,z+2,2.5,.3,1.6,this.mat.lightStone);slab.rotation.y=.6;
   if(st.id==='ruinHeat'){
    const arch=this.mesh(new THREE.TorusGeometry(8,.6,6,36,Math.PI*1.5),this.mat.char,x+1,y+4,z-6);arch.rotation.z=.25;
   }else{
    const sundial=this.mesh(new THREE.TorusGeometry(3,.08,6,64),this.mat.bronze,x,y+.09,z+4.5);sundial.rotation.x=Math.PI/2;
    this.box(x-3,y+3.9,z-4,.9,7.8,.9,this.mat.dark);
   }
  }
 }
 sign(st){
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#292e2c';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#a19677';ctx.lineWidth=3;ctx.strokeRect(14,14,484,228);
  ctx.fillStyle='#aabaad';ctx.font='24px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText('C I V I L I Z A T I O N  /  '+st.number,256,67);ctx.fillStyle='#e8dfc5';ctx.font='bold 60px system-ui, sans-serif';ctx.fillText(st.name,256,154);ctx.fillStyle='#a4b4a8';ctx.font='24px system-ui, sans-serif';ctx.fillText(st.short+' · '+st.number,256,212);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:tx});const x=st.x+(st.id==='scope'?3.8:st.id==='pool'?-3.5:3.0),z=st.z+1.4,y=terrainHeight(x,z);
  this.box(x,y+.65,z,.13,1.3,.13,this.mat.bronze);const sign=this.mesh(new THREE.PlaneGeometry(2.2,1.1),material,x,y+1.8,z);sign.castShadow=false;
  this.circleCollider(x,z,.18);
 }
 buildCitizens(){
  const robeGeo=new THREE.CylinderGeometry(.19,.32,.85,7);const headGeo=new THREE.SphereGeometry(.145,8,6);const legGeo=new THREE.CylinderGeometry(.065,.055,.53,5);
  for(let i=0;i<28;i++){
   const group=new THREE.Group();this.scene.add(group);const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.10,.10,.29+(i%5)*.055),roughness:1});
   this.mesh(robeGeo,mat,0,.80,0,group);this.mesh(headGeo,this.mat.skin,0,1.38,0,group);
   const hood=this.mesh(new THREE.SphereGeometry(.18,7,6,0,TAU,0,Math.PI*.70),mat,0,1.4,0,group);
   const left=this.mesh(legGeo,this.mat.dark,-.12,.28,0,group),right=this.mesh(legGeo,this.mat.dark,.12,.28,0,group);
   const armA=this.box(-.26,.95,0,.10,.58,.11,mat,group);armA.rotation.z=-.15;const armB=this.box(.26,.95,0,.10,.58,.11,mat,group);armB.rotation.z=.15;
   this.batchFigure(group,[left,right]);this.workers.push({group,left,right,phase:i*1.9,route:i%4});
  }
 }
 buildWeather(){
  const pts=[];for(let i=0;i<900;i++)pts.push(this.rng()*65,this.rng()*19,this.rng()*65);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  this.weatherMaterial=new THREE.ShaderMaterial({vertexShader:weatherVertex,fragmentShader:weatherFragment,uniforms:{time:{value:0},player:{value:new THREE.Vector3()},harsh:{value:0},cold:{value:0}},transparent:true,depthWrite:false});
  this.weather=new THREE.Points(geo,this.weatherMaterial);this.weather.frustumCulled=false;this.scene.add(this.weather);
 }
 batchFigure(group,excluded=[]){
  const meshes=group.children.filter(m=>m.isMesh&&!excluded.includes(m));if(meshes.length<2)return;
  const geos=meshes.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g});
  const count=geos.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);let offset=0;
  geos.forEach((g,k)=>{const n=g.attributes.position.count;positions.set(g.attributes.position.array,offset*3);normals.set(g.attributes.normal.array,offset*3);for(let i=0;i<n;i++)meshes[k].material.color.toArray(colors,(offset+i)*3);offset+=n;g.dispose()});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));const batch=new THREE.Mesh(geometry,this.figureMat);batch.castShadow=true;batch.receiveShadow=true;meshes.forEach(m=>group.remove(m));group.add(batch);
 }
 mergeStaticArchitecture(){
  // Bake static objects by shared material; moving instruments, people, stored bodies,
  // flags, growing scaffolds and procedural sky/water remain independently controllable.
  const animated=new Set([this.sky,this.water,this.armillary,this.scaffolds,this.archiveGlow,...this.workers.map(w=>w.group),...this.dryBundles,...this.flags.map(f=>f.flag||f.pivot)]);
  const underAnimated=m=>{for(let p=m;p;p=p.parent)if(animated.has(p))return true;return false};
  this.scene.updateMatrixWorld(true);const groups=new Map();
  this.scene.traverse(m=>{if(!m.isMesh||m.isInstancedMesh||Array.isArray(m.material)||underAnimated(m))return;
   const key=m.material.uuid+'/'+m.castShadow+'/'+m.receiveShadow;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);
  });
  for(const meshes of groups.values()){
   if(meshes.length<3)continue;
   const geos=meshes.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();return g.applyMatrix4(m.matrixWorld)});
   const count=geos.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);let offset=0;
   for(const g of geos){const n=g.attributes.position.count;positions.set(g.attributes.position.array,offset*3);if(g.attributes.normal)normals.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,offset*2);offset+=n;g.dispose()}
   const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.setAttribute('uv',new THREE.BufferAttribute(uvs,2));merged.computeBoundingSphere();
   const batch=new THREE.Mesh(merged,meshes[0].material);batch.castShadow=meshes[0].castShadow;batch.receiveShadow=meshes[0].receiveShadow;this.scene.add(batch);
   meshes.forEach(m=>m.removeFromParent());
  }
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)}
 setQuality(q){this.quality=q;this.low=q==='low';this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.low?.85:1.5));this.renderer.setSize(innerWidth,innerHeight);if(this.rocks)this.rocks.count=this.low?160:480;if(this.stars)this.stars.geometry.setDrawRange(0,this.low?700:2200);if(this.weather)this.weather.geometry.setDrawRange(0,this.low?260:900);for(const l of this.sunLights){const n=this.low?512:1024;if(l.shadow.mapSize.x!==n){l.shadow.mapSize.set(n,n);if(l.shadow.map){l.shadow.map.dispose();l.shadow.map=null}}}}
 update(s,dt,visualTime){
  this.time=visualTime;const cam=this.camera;this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);
  const flux=s.sky.flux,hot=clamp((s.temperature-50)/100,0,1),cold=clamp((-s.temperature-5)/35,0,1),day=clamp(flux/.85,.04,1);
  this.skyUniforms.flux.value=flux;this.skyUniforms.heat.value=hot;this.skyUniforms.time.value=visualTime;
  let dominant=0;s.sky.suns.forEach((sun,i)=>{this.skyUniforms.sunDir.value[i].set(sun.dir.x,sun.dir.y,sun.dir.z);this.skyUniforms.sunRadius.value[i]=sun.angularRadius;if(sun.flux>s.sky.suns[dominant].flux)dominant=i});
  s.sky.suns.forEach((sun,i)=>{
   const l=this.sunLights[i];l.position.set(sun.dir.x*125,sun.dir.y*125,sun.dir.z*125);l.intensity=clamp(sun.flux*3.1,0,7);l.castShadow=i===dominant;
  });
  this.hemi.intensity=.38+day*.77;this.hemi.color.setHex(cold>.3?0x8fa5c8:hot>.3?0xba8d6a:0x8facb9);
  const fogColor=new THREE.Color().setRGB(.065+.37*day,.092+.34*day,.12+.26*day);fogColor.lerp(new THREE.Color(0xa77956),hot*.60);fogColor.lerp(new THREE.Color(0x697f96),cold*.32);this.scene.fog.color.copy(fogColor);this.scene.fog.density=.0019+hot*.003+cold*.002;
  this.stars.material.opacity=clamp(1-flux*2.0,0,.95);
  this.groundMat.color.setHex(0xc3b295);this.groundMat.color.lerp(new THREE.Color(0xc0ced0),cold*.88).lerp(new THREE.Color(0xaf7750),hot*.30);
  this.plantMat.color.setHex(s.active>10?0x6b7546:0x766148);this.plantMat.color.lerp(new THREE.Color(0x78604a),hot).lerp(new THREE.Color(0xb9c9c8),cold);
  this.waterMat.uniforms.time.value=visualTime*(1-cold*.96);this.waterMat.uniforms.freeze.value=cold;this.waterMat.uniforms.light.value=day;
  const waterScale=.55+.45*(s.water/240);this.water.scale.set(waterScale,waterScale,1);
  this.armillary.rotation.y=Math.sin(visualTime*.025)*.035;
  for(const f of this.flags){if(f.pivot){f.pivot.rotation.z=Math.sin(visualTime*.83+f.phase)*.17;continue}const p=f.flag.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=f.base[i*3],y=f.base[i*3+1];p.setZ(i,Math.sin(x*2.3+visualTime*(2+hot*2)+f.phase+y)*x*.065)}p.needsUpdate=true}
  const aliveCount=Math.ceil(s.active/120*(this.low?17:28));
  this.workers.forEach((w,i)=>{
   const g=w.group;g.visible=i<aliveCount;if(!g.visible)return;
   const t=visualTime*.15+w.phase;
   let x,z;
   if(s.mode==='dehydrate'){const q=(i+1)/Math.max(aliveCount,1);x=-20+q*16;z=8+Math.sin(t)*.6;g.rotation.y=-Math.PI/2}
   else if(s.mode==='revive'){x=20+Math.sin(t)*2;z=10-i*.45;g.rotation.y=Math.PI}
   else if(s.temperature>55||s.temperature< -18){x=-19+Math.sin(t)*1.7;z=8+Math.cos(t)*1.6;g.rotation.y=t}
   else {const route=w.route;if(route===0){x=7+Math.sin(t)*6;z=5+Math.cos(t)*2}else if(route===1){x=31+Math.sin(t)*3;z=13+Math.cos(t)*7}else if(route===2){x=8+Math.sin(t)*5;z=-14+Math.cos(t)*4}else{x=-11+Math.sin(t)*3;z=-10+Math.cos(t)*7}g.rotation.y=-t}
   g.position.lerp(this.scratch.set(x,terrainHeight(x,z),z),1-Math.exp(-Math.max(.016,dt)*2));w.left.rotation.x=Math.sin(visualTime*4+w.phase)*.36;w.right.rotation.x=-w.left.rotation.x;
  });
  this.dryBundles.forEach((m,i)=>m.visible=i<Math.ceil(s.dry/120*this.dryBundles.length));
  this.scaffolds.children.forEach((g,i)=>g.visible=i<s.buildLevel);
  this.archiveGlow.visible=s.meta.banked>0;
  this.weatherMaterial.uniforms.time.value=visualTime;this.weatherMaterial.uniforms.player.value.copy(cam.position).setY(0);this.weatherMaterial.uniforms.harsh.value=Math.max(hot,cold);this.weatherMaterial.uniforms.cold.value=cold;
  this.renderer.render(this.scene,this.camera);
 }
}
