const fs=require('fs'),vm=require('vm');
const path=require('path');
const script=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const pi=process.argv.indexOf('--probe');
const probeBody=pi>-1?fs.readFileSync(process.argv[pi+1],'utf8'):'';

// ---- real-ish Vector3 / Color ----
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;} sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} setScalar(s){this.x=this.y=this.z=s;return this;}
 length(){return Math.hypot(this.x,this.y,this.z);} lengthSq(){return this.x**2+this.y**2+this.z**2;}
 normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);} dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);} clone(){return new V3(this.x,this.y,this.z);}
 applyQuaternion(){return this;} crossVectors(){return this;} project(){return this;} unproject(){return this;} }
class Col{constructor(h){this.r=1;this.g=1;this.b=1;if(typeof h==='number')this.setHex(h);}
 setHex(h){this.r=((h>>16)&255)/255;this.g=((h>>8)&255)/255;this.b=(h&255)/255;return this;}
 set(h){return typeof h==='number'?this.setHex(h):this;} setHSL(){return this;} setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}
 clone(){const c=new Col();c.r=this.r;c.g=this.g;c.b=this.b;return c;} copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this;}
 lerp(c,a){this.r+=(c.r-this.r)*a;this.g+=(c.g-this.g)*a;this.b+=(c.b-this.b)*a;return this;}
 multiplyScalar(s){this.r*=s;this.g*=s;this.b*=s;return this;} getHexString(){return '000000';} }

// ---- permissive THREE object factory ----
function perm(extra={}){
 const base={position:new V3(),scale:new V3(1,1,1),rotation:{x:0,y:0,z:0,order:'',set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},copy(e){this.x=e.x;this.y=e.y;this.z=e.z;return this;}},
  material:{},geometry:{translate(){},dispose(){},center(){},computeVertexNormals(){}},
  children:[],userData:{},visible:true,renderOrder:0,castShadow:false,receiveShadow:false,
  ...extra};
 return new Proxy(base,{get(t,p){ if(p in t) return t[p];
   // unknown property -> chainable no-op function that also can be used as value
   const f=function(){return perm()}; return f; },
  set(t,p,v){t[p]=v;return true;}});
}
function ctor(extra){return function(){return perm(typeof extra==='function'?extra(arguments):extra)};}

const THREE=new Proxy({},{get(t,name){
 if(name==='Vector3')return V3; if(name==='Color')return Col;
 if(name==='Scene')return ctor({background:null,fog:{color:new Col(),near:0,far:0},add(){},remove(){}});
 if(name==='Group')return ctor({add(){},remove(){}});
 if(name==='BufferGeometry')return function(){const at={};return perm({attributes:at,setAttribute(n,a){at[n]=a;},setIndex(){},translate(){}});};
 if(name==='Float32BufferAttribute'||name==='BufferAttribute')return function(arr){return {array:arr,needsUpdate:false,count:(arr&&arr.length)||0};};
 if(name==='InstancedMesh')return ctor({instanceMatrix:{needsUpdate:false},setMatrixAt(){},count:0});
 if(name==='PerspectiveCamera')return ctor({fov:75,aspect:1,updateProjectionMatrix(){},getWorldDirection(v){return v;},position:new V3(),rotation:{x:0,y:0,z:0,order:'',set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}});
 if(name==='WebGLRenderer')return ctor({setSize(){},setPixelRatio(){},render(){},shadowMap:{enabled:false,type:0},domElement:{},outputEncoding:0,toneMapping:0,toneMappingExposure:1});
 if(name==='Raycaster')return ctor({setFromCamera(){},intersectObjects(){return[];},ray:{origin:new V3(),direction:new V3()},far:0});
 if(name==='Object3D')return ctor({add(){},updateMatrix(){},matrix:{}});
 if(name==='CanvasTexture'||name==='Texture')return ctor({needsUpdate:false});
 if(name==='Vector2')return function(x=0,y=0){return {x,y,set(a,b){this.x=a;this.y=b;return this;}}};
 if(name==='PCFSoftShadowMap'||name==='sRGBEncoding'||name==='ACESFilmicToneMapping'||name==='DoubleSide'||name==='FrontSide'||name==='BackSide'||name==='AdditiveBlending')return 1;
 if(name==='MathUtils')return {clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,degToRad:d=>d*Math.PI/180};
if(name==='HemisphereLight')return ctor({color:new Col(),groundColor:new Col(),intensity:1,position:new V3()});
 if(name==='DirectionalLight')return ctor({color:new Col(),intensity:1,position:new V3(),target:perm(),castShadow:false,shadow:{mapSize:{set(){}},camera:{},bias:0}});
 if(name==='AmbientLight'||name==='PointLight')return ctor({color:new Col(),intensity:1,position:new V3(),distance:0,decay:0});
 if(name==='Fog'||name==='FogExp2')return function(c,n,f){return {color:(typeof c==='number'?new Col(c):new Col()),near:n||0,far:f||0,density:0.01};};
 if(/Material$/.test(name))return function(o){return perm({color:new Col(),emissive:new Col(),opacity:1,transparent:false,needsUpdate:false,size:1,map:null,emissiveIntensity:1,vertexColors:false,side:0,uniforms:(o&&o.uniforms)||{},dispose(){}});};
 if(name==='Mesh')return function(geo,material){return perm({geometry:geo||{translate(){},dispose(){}}, material: material||{color:new Col(),emissive:new Col(),emissiveIntensity:1}});};
 // all other classes -> generic permissive ctor
 return ctor({});
}});

// ---- DOM / window stubs ----
function el(){return new Proxy({style:{setProperty(){},},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
 children:[],dataset:{},textContent:'',value:'85',width:64,height:8,
 appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},
 getContext(){return new Proxy({},{get(){return function(){return {addColorStop(){}}}}})},
 requestPointerLock(){},getBoundingClientRect(){return{left:0,top:0,width:800,height:600};},
 querySelectorAll(){return[];},querySelector(){return el();},setAttribute(){},getAttribute(){return null;},
 focus(){},click(){},remove(){}},{get(t,p){ if(p in t) return t[p]; if(['firstElementChild','lastElementChild','parentElement','parentNode','nextElementSibling','previousElementSibling'].includes(p)) return el(); return el; }});}
const elements={};
const document={getElementById(id){return elements[id]||(elements[id]=el());},
 createElement(){return el();},body:el(),documentElement:el(),
 addEventListener(){},exitPointerLock(){},querySelector(){return el();},querySelectorAll(){return[];},
 pointerLockElement:null,hidden:false};
global.document=document;
global.window=global;
global.THREE=THREE;
global.requestAnimationFrame=function(){return 0;}; // do NOT recurse
global.cancelAnimationFrame=function(){};
global.__handlers={}; global.addEventListener=function(t,fn){ (global.__handlers[t]=global.__handlers[t]||[]).push(fn); };
global.removeEventListener=function(){};
global.innerWidth=800;global.innerHeight=600;global.devicePixelRatio=2;
global.matchMedia=function(){return{matches:false,addEventListener(){},addListener(){}};};
global.performance={now:()=>Date.now()};
global.__ls={}; global.localStorage={getItem(k){return Object.prototype.hasOwnProperty.call(global.__ls,k)?global.__ls[k]:null;},setItem(k,v){global.__ls[k]=String(v);},removeItem(k){delete global.__ls[k];}};
global.AudioContext=function(){return new Proxy({currentTime:0,destination:{},sampleRate:44100,
 createOscillator(){return{type:'',frequency:{value:0,exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setValueAtTime(){}},connect(){return this;},start(){},stop(){}}},
 createGain(){return{gain:{value:0,exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setValueAtTime(){}},connect(){return this;}}},
 createBuffer(){return{getChannelData(){return new Float32Array(16);}}},
 createBufferSource(){return{buffer:null,connect(){return this;},start(){},stop(){}}},
 createBiquadFilter(){return{type:'',frequency:{value:0},connect(){return this;}}}},{get(t,p){return p in t?t[p]:function(){return {}}}});};
global.webkitAudioContext=global.AudioContext;

let driver=`
;try{
  if (typeof startGame==='function'){ startGame();
    /*__PROBE__*/
    for(let i=0;i<8;i++){ loop(); }
    console.log('BOOT_OK frames=8 pos=('+player.pos.x.toFixed(2)+','+player.pos.y.toFixed(2)+','+player.pos.z.toFixed(2)+') hp='+player.hp+' monsters='+monsters.length+' cats='+cats.length+' mice='+mice.length);
  } else { console.log('NO startGame'); }
}catch(e){ console.log('RUNTIME_ERROR:', e.constructor.name, e.message); console.log(e.stack.split('\\n').slice(0,4).join('\\n')); }
`;
driver=driver.replace('/*__PROBE__*/', probeBody);
const injected=script.replace(/\}\)\(\);\s*$/, driver+'\n})();');
vm.runInThisContext(injected,{filename:'game.js'});
