/* engine.js: Engine: renderer, scene, camera, lights, shared render resources, sky, settings.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- ENGINE ----------
const canvas = document.getElementById("game");
const isTouch = window.matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window);
if (isTouch) document.body.classList.add("touch");

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isTouch });
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// linear workflow: the game's hex colours are sRGB, but r128 feeds material colours to the shader unconverted,
// which made every flat coloured model look pastel. Decode diffuse and emissive colours inside the built-in shaders.
(function linearizeBuiltinColors() {
  const fix = src => src.replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( pow( diffuse, vec3( 2.2 ) ), opacity );")
    .replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = pow( emissive, vec3( 2.2 ) );");
  if (THREE.ShaderLib) for (const k of Object.keys(THREE.ShaderLib)) { const L = THREE.ShaderLib[k]; if (L && typeof L.fragmentShader === "string") L.fragmentShader = fix(L.fragmentShader); }
  if (THREE.ShaderChunk) for (const k of Object.keys(THREE.ShaderChunk)) if (/_frag$/.test(k) && typeof THREE.ShaderChunk[k] === "string") THREE.ShaderChunk[k] = fix(THREE.ShaderChunk[k]);
})();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1000);
camera.rotation.order = "YXZ";

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a4030, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(50, 90, 30); scene.add(sun); scene.add(sun.target);
const lightDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();

// ---------- SHARED RENDER RESOURCES + SKY / ATMOSPHERE (see gfx.js) ----------
const GL = window.GFXLIB, SH = GL.shaders;
const NZ = GL.buildNoise(256);
const noiseTex = new THREE.DataTexture(NZ.data, NZ.size, NZ.size, THREE.RGBAFormat);
noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.magFilter = THREE.LinearFilter; noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
noiseTex.generateMipmaps = true; noiseTex.needsUpdate = true;
const ATL = GL.buildAtlas();
const atlasTex = new THREE.DataTexture(ATL.data, ATL.w, ATL.h, THREE.RGBAFormat);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.generateMipmaps = true;
{ const ma = renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? +renderer.capabilities.getMaxAnisotropy() : 1; atlasTex.anisotropy = ma > 1 ? Math.min(8, ma) : 1; }
atlasTex.encoding = THREE.sRGBEncoding; atlasTex.needsUpdate = true;
// uniforms shared by reference between the terrain, water and sky materials, written once per frame by updateEnv
const U = {
  uTime: { value: 0 }, uNoise: { value: noiseTex },
  uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
  uGlow: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
  uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) }, uLightCol: { value: new THREE.Color() }, uSkyAmb: { value: new THREE.Color() },
  uGroundAmb: { value: new THREE.Color() }, uBlockCol: { value: new THREE.Color().setRGB(1.6, 1.58, 1.55) }, uMinLight: { value: 0.012 }, uSkyMul: { value: 1 },
  uFogNear: { value: 30 }, uFogFar: { value: 80 }, uShadowCenter: { value: new THREE.Vector3() }, uShadowRadius: { value: 40 },
  uEmis: { value: 1.4 }, uWave: { value: 1 }, uWet: { value: 0 }, uWaterCol: { value: new THREE.Color().setRGB(0.012, 0.055, 0.1) }, uWaterAlpha: { value: 0.86 }
};
function glowTex(inner, outer) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.45, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const skyGroup = new THREE.Group(); scene.add(skyGroup);
const skyU = Object.assign({}, U, { uMode: { value: 0 }, uStars: { value: 0 }, uSunVis: { value: 1 }, uMoonCol: { value: new THREE.Color().setRGB(0.9, 0.92, 1.0) },
  uCloudCover: { value: 0.46 }, uCloudLit: { value: new THREE.Color() }, uCloudAmb: { value: new THREE.Color() }, uWind: { value: new THREE.Vector2(0, 0) } });
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU, defines: { CLOUD_STEPS: 8 },
  vertexShader: SH.SKYDOME_VERT, fragmentShader: SH.SKYDOME_FRAG });
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), skyMat);
skyDome.renderOrder = 10; skyDome.frustumCulled = false; skyDome.userData.noShadowTag = 1;   // drawn after opaque terrain so hidden sky pixels are never shaded
skyGroup.add(skyDome);
function updateSky(dt) {
  skyGroup.visible = true;
  skyGroup.position.copy(camera.position);
  const w = skyU.uWind.value; w.x += dt * 6.5; w.y += dt * 2.2;
}
// ambient particles (dust overworld, ash fire, motes end)
const AMB = 150, ambGeo = new THREE.BufferGeometry(), ambPos = new Float32Array(AMB * 3);
for (let i = 0; i < AMB * 3; i++) ambPos[i] = (Math.random() - .5) * 44;
ambGeo.setAttribute("position", new THREE.BufferAttribute(ambPos, 3));
const ambMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0, depthWrite: false, fog: true });
const amb = new THREE.Points(ambGeo, ambMat); scene.add(amb);
function updateAmbient(dt) {
  amb.position.copy(camera.position);
  const p = ambGeo.attributes.position.array, fire = DIM === "fire";
  ambMat.opacity = fire ? 0.7 : (DIM === "overworld" ? 0.22 : 0.14);
  ambMat.color.setHex(fire ? 0xff7a2a : (DIM === "end" ? 0x9b8cff : 0xffffff));
  ambMat.size = fire ? 0.15 : 0.09;
  const rise = fire ? 1.4 : -0.35;
  for (let i = 0; i < AMB; i++) { const o = i * 3; p[o + 1] += rise * dt; if (p[o + 1] > 22 || p[o + 1] < -22) { p[o] = (Math.random() - .5) * 44; p[o + 1] = fire ? -22 : 22; p[o + 2] = (Math.random() - .5) * 44; } }
  ambGeo.attributes.position.needsUpdate = true;
}

// viewmodel (held tool) drawn as overlay pass
const vScene = new THREE.Scene();
const vCam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
const vLight = new THREE.DirectionalLight(0xffffff, 0.9); vLight.position.set(-1, 2, 2); vScene.add(vLight);

// ---------- SETTINGS ----------
const settings = { sensD: 0.0012 * 12, sensM: 0.005, fov: 75, autoJump: false, gfx: "med", sound: true, music: true, showFps: false, bob: true, btnOpacity: 0.85, sprintMode: "hold", scheme: "fps",
  sfxVol: 0.8, musicVol: 0.5, muted: false, cbMarkers: false, reduceMotion: false,
  keys: { interact: "KeyE", dodge: "KeyF", camera: "KeyV", inv: "KeyI", skills: "KeyK", cat: "KeyG", journal: "KeyJ" } };
const DEFAULT_KEYS = { interact: "KeyE", dodge: "KeyF", camera: "KeyV", inv: "KeyI", skills: "KeyK", cat: "KeyG", journal: "KeyJ" };
const GFX = { low: { dist: 3, shadows: false, pr: 1, clouds: 0, map: 1024, rad: 32 }, med: { dist: 5, shadows: true, pr: 1.5, clouds: 5, map: 1024, rad: 34 },
  high: { dist: 6, shadows: true, pr: 2, clouds: 8, map: 2048, rad: 44 }, ultra: { dist: 8, shadows: true, pr: 2, clouds: 12, map: 4096, rad: 60 } };
// adaptive resolution: when the GPU cannot hold about 45 fps, render fewer pixels; give them back when there is headroom
const dynRes = { scale: 1, acc: 0, n: 0, cool: 3 };
function basePixelRatio() { const g = GFX[settings.gfx]; return Math.min(devicePixelRatio, isTouch ? Math.min(g.pr, 1.5) : g.pr); }
function updateDynRes(rawDt) {
  if (rawDt > 0.25) { dynRes.acc = 0; dynRes.n = 0; return; }                 // tab switch or a one off hitch
  dynRes.acc += rawDt; dynRes.n++;
  if (dynRes.acc < 1.5) return;
  const fps = dynRes.n / dynRes.acc; dynRes.acc = 0; dynRes.n = 0;
  if (dynRes.cool > 0) { dynRes.cool--; return; }
  let sc = dynRes.scale;
  if (fps < 45 && sc > 0.55) sc = Math.max(0.55, sc - 0.15); else if (fps > 57 && sc < 1) sc = Math.min(1, sc + 0.1);
  if (sc !== dynRes.scale) { dynRes.scale = sc; renderer.setPixelRatio(Math.max(0.5, basePixelRatio() * sc)); dynRes.cool = 1; }
}
function applyGfx() {
  const g = GFX[settings.gfx];
  renderer.setPixelRatio(Math.max(0.5, basePixelRatio() * dynRes.scale));
  renderer.shadowMap.enabled = g.shadows && !isTouch;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = g.shadows && !isTouch;
  if (sun.castShadow) {
    if (sun.shadow.map && sun.shadow.mapSize.x !== g.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(g.map, g.map); sun.shadow.camera.near = 1; sun.shadow.camera.far = 240;
    sun.shadow.camera.left = -g.rad; sun.shadow.camera.right = g.rad; sun.shadow.camera.top = g.rad; sun.shadow.camera.bottom = -g.rad;
    if (sun.shadow.camera.updateProjectionMatrix) sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
  }
  U.uShadowRadius.value = g.rad;
  const steps = isTouch ? Math.min(g.clouds, 4) : g.clouds;
  if (skyMat.defines.CLOUD_STEPS !== steps) { skyMat.defines.CLOUD_STEPS = steps; skyMat.needsUpdate = true; }
  fancyLeaves = settings.gfx !== "low";
  U.uWave.value = settings.gfx === "low" ? 0 : 1;
  setPost(settings.gfx !== "low");
  remeshAll();
}
// keep the shadow map centred on Thomas, snapped to whole shadow texels so edges do not shimmer while walking
function positionSunShadow() {
  const L = lightDir, g = GFX[settings.gfx], texel = (2 * g.rad) / g.map;
  let ax = L.z, az = -L.x; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;       // shadow camera right = normalize(up x L)
  const ux = L.y * az, uy = L.z * ax - L.x * az, uz = -L.y * ax, P = player.pos;          // shadow camera up = L x right
  const px = P.x * ax + P.z * az, py = P.x * ux + P.y * uy + P.z * uz;
  const dx = Math.round(px / texel) * texel - px, dy = Math.round(py / texel) * texel - py;
  sun.target.position.set(P.x + ax * dx + ux * dy, P.y + uy * dy, P.z + az * dx + uz * dy);
  sun.position.set(sun.target.position.x + L.x * 110, sun.target.position.y + L.y * 110, sun.target.position.z + L.z * 110);
}
