/* ===========================================================================
   VOXEL WORLD  -  organized into systems:
   Engine, Audio, Settings, Blocks, World(chunks), Player, Input(desktop+mobile),
   Mining/Build, Inventory, Crafting, Enemies, Animals, Combat, Portals,
   Dimensions, Quests, UI. Deep features are marked TODO.
=========================================================================== */
(function () {
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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1000);
camera.rotation.order = "YXZ";

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a4030, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(50, 90, 30); scene.add(sun); scene.add(sun.target);
const lightDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();

// ---------- SKY / ATMOSPHERE (LightingSystem + WeatherSystem foundation) ----------
const skyGroup = new THREE.Group(); scene.add(skyGroup);
const skyUni = { topC: { value: new THREE.Color(0x2a6fd0) }, botC: { value: new THREE.Color(0xcfeaff) } };
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUni,
  vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 topC; uniform vec3 botC; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(botC, topC, pow(h,0.55)),1.0); }"
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), skyMat); skyDome.renderOrder = -3; skyGroup.add(skyDome);
function glowTex(inner, outer) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.45, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,247,214,1)", "rgba(255,238,170,0)"), depthWrite: false, fog: false, transparent: true })); sunSpr.scale.set(64, 64, 1); sunSpr.renderOrder = -2; skyGroup.add(sunSpr);
const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(228,234,255,1)", "rgba(170,195,255,0)"), depthWrite: false, fog: false, transparent: true })); moonSpr.scale.set(40, 40, 1); moonSpr.renderOrder = -2; skyGroup.add(moonSpr);
const starGeo = new THREE.BufferGeometry(); { const sp = []; for (let i = 0; i < 700; i++) { const v = new THREE.Vector3(Math.random() - .5, Math.random() * 0.9 + 0.06, Math.random() - .5).normalize().multiplyScalar(405); sp.push(v.x, v.y, v.z); } starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -2; skyGroup.add(stars);
const cloudGroup = new THREE.Group(); skyGroup.add(cloudGroup);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
for (let i = 0; i < 10; i++) { const w = 30 + Math.random() * 44; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.6), cloudMat); m.rotation.x = -Math.PI / 2; m.position.set((Math.random() - .5) * 360, 64 + Math.random() * 36, (Math.random() - .5) * 360); m.userData.vx = 1.4 + Math.random() * 1.2; cloudGroup.add(m); }
function updateSky(dt) {
  skyGroup.visible = DIM === "overworld"; if (!skyGroup.visible) return;
  skyGroup.position.set(camera.position.x, 0, camera.position.z);
  for (const m of cloudGroup.children) { m.position.x += m.userData.vx * dt; if (m.position.x > 200) m.position.x -= 400; }
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
vScene.add(new THREE.AmbientLight(0xffffff, 0.85));
const vLight = new THREE.DirectionalLight(0xffffff, 0.9); vLight.position.set(-1, 2, 2); vScene.add(vLight);

// ---------- SETTINGS ----------
const settings = { sensD: 0.0012 * 12, sensM: 0.005, fov: 75, autoJump: false, gfx: "med", sound: true, music: true, showFps: false, bob: true, btnOpacity: 0.85, sprintMode: "hold", scheme: "fps",
  sfxVol: 0.8, musicVol: 0.5, muted: false, cbMarkers: false, reduceMotion: false,
  keys: { interact: "KeyE", dodge: "KeyF", camera: "KeyV", inv: "KeyI", skills: "KeyK", cat: "KeyG", journal: "KeyJ" } };
const DEFAULT_KEYS = { interact: "KeyE", dodge: "KeyF", camera: "KeyV", inv: "KeyI", skills: "KeyK", cat: "KeyG", journal: "KeyJ" };
const GFX = { low: { dist: 3, shadows: false, pr: 1 }, med: { dist: 5, shadows: false, pr: 1.5 }, high: { dist: 6, shadows: true, pr: 2 }, ultra: { dist: 8, shadows: true, pr: 2 } };
function applyGfx() {
  const g = GFX[settings.gfx];
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? Math.min(g.pr, 1.5) : g.pr));
  renderer.shadowMap.enabled = g.shadows && !isTouch;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = g.shadows && !isTouch;
  if (sun.castShadow) { sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.bias = -0.0008; }
  remeshAll();
}

// ---------- AUDIO (WebAudio synth, no asset files) ----------
let actx = null, sfxGain = null;
function initAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx) {
    if (!sfxGain) { sfxGain = actx.createGain(); sfxGain.connect(actx.destination); }
    if (!musicGain) { musicGain = actx.createGain(); musicGain.connect(actx.destination); }
    applyAudioGains();
  }
  if (actx && actx.resume) { try { actx.resume(); } catch (e) {} }
}
function applyAudioGains() { if (sfxGain) sfxGain.gain.value = settings.muted ? 0 : settings.sfxVol; if (musicGain) musicGain.gain.value = settings.muted ? 0 : settings.musicVol * 0.18; }
function blip(freq, dur, type, vol, slideTo) {
  if (!settings.sound || settings.muted || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || "sine"; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur);
  g.gain.value = vol || 0.15; g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g).connect(sfxGain || actx.destination); o.start(); o.stop(actx.currentTime + dur);
}
function noiseHit(dur, vol) {
  if (!settings.sound || settings.muted || !actx) return;
  const n = actx.createBufferSource(), b = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = b; const g = actx.createGain(); g.gain.value = vol || 0.2; g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900;
  n.connect(f).connect(g).connect(sfxGain || actx.destination); n.start();
}
const SFX = {
  mine: () => noiseHit(0.08, 0.18),
  place: () => blip(180, 0.1, "square", 0.18, 120),
  pickup: () => blip(660, 0.09, "sine", 0.14, 880),
  hurt: () => blip(220, 0.18, "square", 0.2, 90),
  jump: () => blip(420, 0.08, "sine", 0.1, 560),
  hit: () => noiseHit(0.06, 0.25),
  meow: () => { blip(520, 0.12, "sine", 0.16, 380); setTimeout(() => blip(420, 0.14, "sine", 0.14, 300), 90); },
  squeak: () => blip(1400, 0.06, "square", 0.08, 1800),
  portal: () => { blip(140, 0.5, "sine", 0.16, 520); },
  craft: () => blip(300, 0.12, "triangle", 0.16, 480),
  step: () => blip(110, 0.05, "sine", 0.05, 90),
  growl: () => { blip(90, 0.3, "sawtooth", 0.12, 60); setTimeout(() => blip(70, 0.25, "sawtooth", 0.1, 50), 120); },
  screech: () => { blip(900, 0.18, "sawtooth", 0.16, 1600); setTimeout(() => blip(1300, 0.16, "square", 0.12, 700), 80); },
  dig: () => noiseHit(0.07, 0.15),
  slam: () => { noiseHit(0.12, 0.3); blip(70, 0.2, "square", 0.18, 40); },
  levelUp: () => { blip(523, 0.12, "square", 0.16); setTimeout(() => blip(659, 0.12, "square", 0.16), 90); setTimeout(() => blip(784, 0.16, "square", 0.16), 180); },
  zap: () => { blip(1300, 0.07, "sawtooth", 0.2, 280); noiseHit(0.12, 0.22); setTimeout(() => blip(900, 0.06, "square", 0.12, 200), 50); },
  power: () => { blip(440, 0.1, "triangle", 0.16, 660); setTimeout(() => blip(660, 0.12, "triangle", 0.16, 990), 80); }
};
function stepSound() {
  const b = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z));
  if (b === STONE || b === COBBLE || b === FIRESTONE || b === ENDSTONE) blip(95, 0.05, "square", 0.05, 70);
  else if (b === SAND) noiseHit(0.045, 0.04);
  else if (b === WATER) noiseHit(0.06, 0.06);
  else if (b === WOOD || b === PLANKS) blip(150, 0.05, "triangle", 0.05, 110);
  else blip(120, 0.05, "sine", 0.045, 90);
}
// generative background music: a slow per-dimension pad, no asset files
let musicGain = null, musicT = 0, musicIdx = 0;
const SCALES = { overworld: [220, 247, 294, 330, 392, 440], fire: [110, 131, 147, 175, 131, 98], end: [330, 392, 494, 587, 392, 247] };
function playPad(freq, dur) {
  if (!settings.music || settings.muted || !actx) return;
  if (!musicGain) { musicGain = actx.createGain(); musicGain.connect(actx.destination); applyAudioGains(); }
  const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain();
  o.type = "sine"; o2.type = "triangle"; o.frequency.value = freq; o2.frequency.value = freq * 1.005;
  g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.5, actx.currentTime + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); o2.connect(g); g.connect(musicGain);
  o.start(); o2.start(); o.stop(actx.currentTime + dur); o2.stop(actx.currentTime + dur);
}
function updateMusic(dt) {
  if (!settings.music || !actx) return;
  musicT -= dt; if (musicT > 0) return;
  const sc = SCALES[DIM] || SCALES.overworld, note = sc[musicIdx % sc.length]; musicIdx++;
  const boss = bossActive();
  const dur = boss ? 1.1 : DIM === "fire" ? 2.2 : DIM === "end" ? 2.9 : 1.8;     // urgent tempo during boss fights
  playPad(note * (boss ? (Math.random() < 0.5 ? 0.5 : 1) : (Math.random() < 0.18 ? 2 : 1)), dur);
  musicT = dur * (boss ? 0.45 : 0.66);
}

// ---------- BLOCKS ----------
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, WATER = 7, LAVA = 8,
      FIRESTONE = 9, ENDSTONE = 10, PORTAL = 11, PLANKS = 12, COBBLE = 13, TORCH = 14, CHEST = 15, SNOW = 16, BRICK = 17, BED = 18, FIRE_CRYSTAL = 19, BOUNCE = 20;
function C(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
const BLOCKS = {
  [GRASS]:    { name: "Grass", solid: 1, opaque: 1, hard: 0.45, top: C(0x6cc24a), side: C(0x5aa83e), bot: C(0x8a5a2b), drop: DIRT, icon: "🟩" },
  [DIRT]:     { name: "Dirt", solid: 1, opaque: 1, hard: 0.4, top: C(0x8a5a2b), side: C(0x8a5a2b), bot: C(0x8a5a2b), drop: DIRT, icon: "🟫" },
  [STONE]:    { name: "Stone", solid: 1, opaque: 1, hard: 1.5, top: C(0x8d8d8d), side: C(0x8d8d8d), bot: C(0x8d8d8d), drop: COBBLE, tool: "pick", icon: "⬜" },
  [WOOD]:     { name: "Wood", solid: 1, opaque: 1, hard: 0.85, top: C(0x6e4a25), side: C(0x7a5630), bot: C(0x6e4a25), drop: WOOD, tool: "axe", icon: "🟧" },
  [LEAVES]:   { name: "Leaves", solid: 1, opaque: 1, hard: 0.2, top: C(0x3f9e3a), side: C(0x3f9e3a), bot: C(0x368a31), drop: LEAVES, icon: "🍃" },
  [SAND]:     { name: "Sand", solid: 1, opaque: 1, hard: 0.4, top: C(0xe3d7a0), side: C(0xe3d7a0), bot: C(0xd8c98c), drop: SAND, icon: "🟨" },
  [WATER]:    { name: "Water", solid: 0, opaque: 0, hard: 0, top: C(0x2f6fe0), side: C(0x2f6fe0), bot: C(0x2f6fe0), liquid: 1, icon: "🟦" },
  [LAVA]:     { name: "Lava", solid: 0, opaque: 1, hard: 0, top: C(0xff7a22), side: C(0xff5a14), bot: C(0xe2480c), liquid: 1, dmg: 4, icon: "🔥" },
  [FIRESTONE]:{ name: "Fire Stone", solid: 1, opaque: 1, hard: 1.4, top: C(0x6a1414), side: C(0x5a1414), bot: C(0x451010), drop: FIRESTONE, tool: "pick", icon: "🟥" },
  [ENDSTONE]: { name: "End Stone", solid: 1, opaque: 1, hard: 1.3, top: C(0xefe9c8), side: C(0xe6dfb6), bot: C(0xddd4a8), drop: ENDSTONE, tool: "pick", icon: "⬛" },
  [PLANKS]:   { name: "Planks", solid: 1, opaque: 1, hard: 0.7, top: C(0xb08a4f), side: C(0xb08a4f), bot: C(0xa07d45), drop: PLANKS, tool: "axe", icon: "🟫" },
  [COBBLE]:   { name: "Cobblestone", solid: 1, opaque: 1, hard: 1.5, top: C(0x7c7c7c), side: C(0x7c7c7c), bot: C(0x6f6f6f), drop: COBBLE, tool: "pick", icon: "⬜" },
  [TORCH]:    { name: "Torch", solid: 0, opaque: 0, hard: 0.1, top: C(0xffcf6b), side: C(0xffcf6b), bot: C(0x6e4a25), drop: TORCH, icon: "🕯️" },
  [CHEST]:    { name: "Chest", solid: 1, opaque: 1, hard: 0.8, top: C(0xb8863f), side: C(0x9c6f30), bot: C(0x7a5626), drop: CHEST, tool: "axe", icon: "🧰" },
  [SNOW]:     { name: "Snow", solid: 1, opaque: 1, hard: 0.35, top: C(0xeaf2f7), side: C(0xdfe9f0), bot: C(0xcfdae3), drop: SNOW, icon: "⬜" },
  [BRICK]:    { name: "Brick", solid: 1, opaque: 1, hard: 1.3, top: C(0x9c4a3c), side: C(0x99463a), bot: C(0x853c31), drop: BRICK, tool: "pick", icon: "🧱" },
  [BED]:      { name: "Bed", solid: 1, opaque: 1, hard: 0.4, top: C(0xd14b6a), side: C(0xb23b56), bot: C(0x7a5630), drop: BED, icon: "🛏️" },
  [FIRE_CRYSTAL]: { name: "Fire Crystal", solid: 1, opaque: 1, hard: 1.4, top: C(0xff8a1e), side: C(0xff5a14), bot: C(0xd23c08), drop: FIRE_CRYSTAL, tool: "pick", glow: 1, icon: "🔶" },
  [BOUNCE]:   { name: "Bounce Block", solid: 1, opaque: 1, hard: 0.3, top: C(0x49e06a), side: C(0x36c456), bot: C(0x2aa345), drop: BOUNCE, bouncy: 1, icon: "🟢" }
};
function isOpaque(id) { return id !== AIR && id !== WATER && id !== PORTAL && BLOCKS[id] && BLOCKS[id].opaque; }
function isSolidBlock(id) { return id !== AIR && id !== WATER && id !== PORTAL && BLOCKS[id] && BLOCKS[id].solid; }

// ITEMS (tools/food), ids offset 100
const I_HAND = 100, I_WPICK = 101, I_SPICK = 102, I_SWORD = 103, I_AXE = 104, I_FIRECHARM = 105, I_FIRESWORD = 106, I_LIGHTHAMMER = 107, I_APPLE = 110, I_STICK = 111;
const ITEMS = {
  [I_WPICK]: { name: "Wood Pickaxe", tool: "pick", tier: 1, dmg: 2, icon: "⛏️" },
  [I_SPICK]: { name: "Stone Pickaxe", tool: "pick", tier: 2, dmg: 3, icon: "⛏️" },
  [I_SWORD]: { name: "Wood Sword", tool: "sword", tier: 1, dmg: 5, icon: "🗡️" },
  [I_AXE]:   { name: "Wood Axe", tool: "axe", tier: 1, dmg: 3, icon: "🪓" },
  [I_FIRECHARM]: { name: "Flame Charm", protect: "fire", icon: "🧿" },
  [I_FIRESWORD]: { name: "Flame Sword", tool: "sword", tier: 3, dmg: 9, special: "fire", icon: "🗡️" },
  [I_LIGHTHAMMER]: { name: "Lightning Hammer", tool: "hammer", tier: 2, dmg: 7, special: "lightning", icon: "🔨" },
  [I_APPLE]: { name: "Apple", food: 4, icon: "🍎" },
  [I_STICK]: { name: "Stick", icon: "➖" }
};
function isItem(id) { return id >= 100; }
function itemInfo(id) { return isItem(id) ? ITEMS[id] : BLOCKS[id]; }
function itemName(id) { const i = itemInfo(id); return i ? i.name : "?"; }
function itemIcon(id) { const i = itemInfo(id); return i ? (i.icon || "▪") : "▪"; }

// ---------- WORLD (global block map + chunked meshes) ----------
const CH = 16, WORLD_H = 56, SEA = 18;
let DIM = "overworld";
const W = new Map();              // "x,y,z" -> id
const generated = new Set();      // "cx,cz"
const chunks = new Map();         // "cx,cz" -> {opaque, water}
const dirty = new Set();
const bk = (x, y, z) => x + "," + y + "," + z;
function getBlock(x, y, z) { if (y < 0 || y >= WORLD_H) return AIR; const v = W.get(bk(x, y, z)); return v === undefined ? AIR : v; }
function setRaw(x, y, z, id) { if (id === AIR) W.delete(bk(x, y, z)); else W.set(bk(x, y, z), id); }
function ck(cx, cz) { return cx + "," + cz; }

// procedural noise
function hsh(x, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vn(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hsh(xi, zi), b = hsh(xi + 1, zi), c = hsh(xi, zi + 1), d = hsh(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; }
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += vn(x * f, z * f) * a; f *= 2; a *= 0.5; } return s; }

// 3D value noise for caves (TerrainSystem)
function hsh3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1103515245) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c000 = hsh3(xi, yi, zi), c100 = hsh3(xi + 1, yi, zi), c010 = hsh3(xi, yi + 1, zi), c110 = hsh3(xi + 1, yi + 1, zi);
  const c001 = hsh3(xi, yi, zi + 1), c101 = hsh3(xi + 1, yi, zi + 1), c011 = hsh3(xi, yi + 1, zi + 1), c111 = hsh3(xi + 1, yi + 1, zi + 1);
  return L(L(L(c000, c100, u), L(c010, c110, u), v), L(L(c001, c101, u), L(c011, c111, u), v), w);
}
// shared terrain functions so the world and the minimap agree
function biomeAt(x, z) { return { t: vn(x * 0.004 + 50, z * 0.004 + 50), m: vn(x * 0.005 + 200, z * 0.005 + 200) }; }
function heightAt(x, z) {
  const base = fbm(x * 0.02, z * 0.02);
  const mtn = Math.pow(Math.max(0, vn(x * 0.0065 + 300, z * 0.0065 + 300) - 0.5) * 2, 1.5);
  const h = SEA + 3 + (base - 0.5) * 24 + mtn * 26;
  return Math.max(3, Math.min(WORLD_H - 3, Math.floor(h)));
}
function caveAt(x, y, z) {
  const a = vn3(x * 0.07, y * 0.10, z * 0.07);
  const b = vn3(x * 0.13 + 11, y * 0.16 + 11, z * 0.13 + 11);
  return a > 0.7 || (a > 0.58 && b > 0.7);
}
// rare cobblestone ruin with a loot chest (exploration reward)
function buildRuin(x, y, z) {
  const mat = COBBLE;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
    if (!edge) continue;
    const hh = 1 + (hsh(x + dx * 7, z + dz * 7) > 0.4 ? 1 : 0) + (hsh(x + dx, z + dz) > 0.7 ? 1 : 0); // broken-down height
    for (let dy = 0; dy < hh; dy++) setRaw(x + dx, y + dy, z + dz, mat);
  }
  setRaw(x, y, z, CHEST);
  try { const ck2 = "overworld:" + bk(x, y, z); if (!chestStore.has(ck2)) chestStore.set(ck2, [{ id: I_SPICK, count: 1 }, { id: I_APPLE, count: 2 }, { id: COBBLE, count: 6 }, null, null, null, null, null, null]); } catch (e) {}
  if (getBlock(x + 1, y, z) === AIR) setRaw(x + 1, y, z, TORCH);
}

function genChunk(cx, cz) {
  if (generated.has(ck(cx, cz))) return;
  generated.add(ck(cx, cz));
  const x0 = cx * CH, z0 = cz * CH;
  if (DIM === "overworld") {
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const b = biomeAt(x, z), h = heightAt(x, z);
      const peak = h > SEA + 16;
      const desert = b.t > 0.66 && !peak && h > SEA;
      const forest = b.m > 0.58 && !desert && !peak;
      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === h) id = (h <= SEA) ? SAND : peak ? SNOW : desert ? SAND : GRASS;
        else if (y > h - 3) id = peak ? STONE : desert ? SAND : DIRT;
        // carve connected caves through the stone interior (leave surface + bedrock intact)
        if (id === STONE && y > 1 && y < h - 1 && caveAt(x, y, z)) id = (y <= 4) ? LAVA : AIR;
        // sparse cobble "ore" veins for variety
        else if (id === STONE && vn3(x * 0.2, y * 0.2, z * 0.2) > 0.9) id = COBBLE;
        setRaw(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);   // fill water to sea level
      if (h <= SEA) setRaw(x, h, z, SAND);                          // shore/seabed
      if (!desert && !peak && h > SEA) { const tr = hsh(x * 3 + 7, z * 5 + 11); if (tr > (forest ? 0.86 : 0.95)) tree(x, h + 1, z); else if (forest && tr > 0.8) bush(x, h + 1, z); }
    }
    // rare ruin landmark per chunk (exploration reward)
    if (hsh(cx * 91 + 5, cz * 57 + 3) > 0.93) {
      const rx = x0 + 3 + Math.floor(hsh(cx, cz) * 9), rz = z0 + 3 + Math.floor(hsh(cz + 1, cx + 1) * 9), ry = heightAt(rx, rz);
      const rb = biomeAt(rx, rz);
      if (ry > SEA + 1 && !(ry > SEA + 18)) buildRuin(rx, ry + 1, rz);
    }
  } else if (DIM === "fire") {
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const h = Math.max(4, Math.min(WORLD_H - 4, 18 + Math.floor((fbm(x * 0.04 + 5, z * 0.04 + 5) - 0.5) * 16)));
      for (let y = 0; y <= h; y++) {
        let id = FIRESTONE;
        if (y > 1 && y < h - 1 && caveAt(x, y, z)) id = (y <= 5) ? LAVA : AIR;                    // fire caves, deep lava
        else if (vn3(x * 0.16 + 3, y * 0.16 + 3, z * 0.16 + 3) > 0.86) id = FIRE_CRYSTAL;          // crystal veins
        setRaw(x, y, z, id);
      }
      if (vn(x * 0.04 + 9, z * 0.04 + 9) > 0.7) setRaw(x, h, z, LAVA);                              // lava rivers/pools
      else if (hsh(x * 13 + 2, z * 17 + 5) > 0.985) setRaw(x, h + 1, z, FIRE_CRYSTAL);              // surface crystal clusters
      if (hsh(x * 7 + 1, z * 9 + 3) > 0.987) { for (let y = h + 1; y < h + 4; y++) setRaw(x, y, z, WOOD); setRaw(x, h + 4, z, FIRE_CRYSTAL); }  // burning tree with ember
    }
  } else { // end: large central island, floating islands, ruined pillars; void elsewhere
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const d = Math.hypot(x, z);
      if (d < 46) for (let y = 13; y <= 16; y++) setRaw(x, y, z, ENDSTONE);                 // big thick main island
      const fi = vn(x * 0.05 + 700, z * 0.05 + 700);
      if (d > 26 && d < 120 && fi > 0.82) { const fy = 24 + Math.floor(hsh((x / 6) | 0, (z / 6) | 0) * 18); for (let y = fy; y <= fy + 1; y++) setRaw(x, y, z, ENDSTONE); }  // floating islands
    }
    if (Math.abs(cx) <= 2 && Math.abs(cz) <= 2 && hsh(cx * 13 + 1, cz * 17 + 2) > 0.55) {   // ruined pillars on the island
      const rx = x0 + 4 + (hsh(cx, cz) * 6 | 0), rz = z0 + 4 + (hsh(cz, cx) * 6 | 0);
      if (Math.hypot(rx, rz) < 40) { const ph = 3 + (hsh(rx, rz) * 4 | 0); for (let y = 17; y < 17 + ph; y++) setRaw(rx, y, rz, COBBLE); }
    }
  }
}
function tree(x, y, z) {
  const th = 4 + Math.floor(hsh(x * 1.1, z * 1.7) * 3);
  for (let i = 0; i < th; i++) setRaw(x, y + i, z, WOOD);
  const top = y + th;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
    if (getBlock(x + dx, top + dy, z + dz) === AIR) setRaw(x + dx, top + dy, z + dz, LEAVES);
  }
}
function bush(x, y, z) { if (getBlock(x, y, z) === AIR) setRaw(x, y, z, LEAVES); if (hsh(x * 5, z * 3) > 0.6 && getBlock(x, y + 1, z) === AIR) setRaw(x, y + 1, z, LEAVES); }

// chunk meshing (face-culled, vertex-colored)
const FACES = [
  { d: [1, 0, 0], c: [[1,1,1],[1,0,1],[1,0,0],[1,1,0]], s: 0.8 },
  { d: [-1,0, 0], c: [[0,1,0],[0,0,0],[0,0,1],[0,1,1]], s: 0.8 },
  { d: [0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], s: 1.0 },
  { d: [0,-1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], s: 0.5 },
  { d: [0, 0, 1], c: [[0,1,1],[0,0,1],[1,0,1],[1,1,1]], s: 0.65 },
  { d: [0, 0,-1], c: [[1,1,0],[1,0,0],[0,0,0],[0,1,0]], s: 0.65 }
];
const matOpaque = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); // TODO FrontSide after winding verify
const matWater = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });

function faceCol(def, fi) {
  const base = fi === 2 ? def.top : (fi === 3 ? def.bot : def.side);
  const s = FACES[fi].s; return [base[0] * s, base[1] * s, base[2] * s];
}
function buildChunk(cx, cz) {
  genChunk(cx, cz); genChunk(cx + 1, cz); genChunk(cx - 1, cz); genChunk(cx, cz + 1); genChunk(cx, cz - 1);
  const op = { pos: [], nor: [], col: [], idx: [] }, wa = { pos: [], nor: [], col: [], idx: [] };
  const x0 = cx * CH, z0 = cz * CH;
  for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) for (let y = 0; y < WORLD_H; y++) {
    const id = getBlock(x, y, z); if (id === AIR || id === PORTAL || id === TORCH) continue;
    const def = BLOCKS[id]; const water = id === WATER;
    const tint = id === WATER ? 1 : (0.9 + 0.16 * hsh(x * 1.7 + y * 4.3, z * 2.9));
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nb = getBlock(x + F.d[0], y + F.d[1], z + F.d[2]);
      const draw = water ? (nb === AIR) : !isOpaque(nb);
      if (!draw) continue;
      const t = water ? wa : op, base = t.pos.length / 3, col = faceCol(def, f);
      for (let k = 0; k < 4; k++) { const c = F.c[k]; t.pos.push(x + c[0], y + c[1], z + c[2]); t.nor.push(F.d[0], F.d[1], F.d[2]); t.col.push(col[0] * tint, col[1] * tint, col[2] * tint); }
      t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const prev = chunks.get(ck(cx, cz));
  if (prev) { if (prev.opaque) scene.remove(prev.opaque); if (prev.water) scene.remove(prev.water); }
  const out = { opaque: null, water: null };
  if (op.idx.length) out.opaque = makeMesh(op, matOpaque, true);
  if (wa.idx.length) out.water = makeMesh(wa, matWater, false);
  chunks.set(ck(cx, cz), out);
}
function makeMesh(t, mat, shadow) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(t.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(t.nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(t.col, 3));
  g.setIndex(t.idx);
  const m = new THREE.Mesh(g, mat);
  if (shadow && renderer.shadowMap.enabled) { m.castShadow = true; m.receiveShadow = true; }
  scene.add(m); return m;
}
function markDirty(x, z) { dirty.add(ck(Math.floor(x / CH), Math.floor(z / CH))); }
function remeshAll() { for (const k of chunks.keys()) dirty.add(k); }

function loadChunks() {
  const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
  const R = GFX[settings.gfx].dist;
  const need = [];
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz;
    if (!chunks.has(ck(cx, cz))) need.push([dx * dx + dz * dz, cx, cz]);
  }
  need.sort((a, b) => a[0] - b[0]);
  let budget = 2;
  for (const n of need) { if (budget-- <= 0) break; buildChunk(n[1], n[2]); }
  // remesh dirty
  let db = 4;
  for (const k of Array.from(dirty)) { if (db-- <= 0) break; const p = k.split(","); buildChunk(+p[0], +p[1]); dirty.delete(k); }
  // unload far
  for (const k of Array.from(chunks.keys())) {
    const p = k.split(","); const dx = +p[0] - pcx, dz = +p[1] - pcz;
    if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) { const c = chunks.get(k); if (c.opaque) { scene.remove(c.opaque); c.opaque.geometry.dispose(); } if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); } chunks.delete(k); }
  }
  updatePortalMesh();
}
function clearWorld() {
  for (const c of chunks.values()) { if (c.opaque) { scene.remove(c.opaque); c.opaque.geometry.dispose(); } if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); } }
  chunks.clear(); dirty.clear(); generated.clear(); W.clear(); portalCells.length = 0; if (portalMesh) { scene.remove(portalMesh); portalMesh = null; }
  torchCells.length = 0; if (torchMesh) { scene.remove(torchMesh); torchMesh = null; }
}

// portal blocks rendered separately (animated)
const portalCells = [];
let portalMesh = null;
const portalMat = new THREE.MeshLambertMaterial({ color: 0x9b30ff, emissive: 0x7a16d8, emissiveIntensity: 1.1, transparent: true, opacity: 0.82 });
const portalGeo = new THREE.BoxGeometry(1, 1, 1);
function rebuildPortalCells() {
  portalCells.length = 0;
  for (const [k, id] of W) if (id === PORTAL) { const p = k.split(","); portalCells.push([+p[0], +p[1], +p[2]]); }
  updatePortalMesh(true);
}
function updatePortalMesh(force) {
  if (!portalMesh || force) {
    if (portalMesh) scene.remove(portalMesh);
    if (!portalCells.length) { portalMesh = null; return; }
    portalMesh = new THREE.InstancedMesh(portalGeo, portalMat, portalCells.length);
    const d = new THREE.Object3D();
    for (let i = 0; i < portalCells.length; i++) { const c = portalCells[i]; d.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5); d.updateMatrix(); portalMesh.setMatrixAt(i, d.matrix); }
    portalMesh.instanceMatrix.needsUpdate = true; scene.add(portalMesh);
  }
}

// torch blocks rendered separately (glowing) + suppress night spawns nearby
const torchCells = [];
let torchMesh = null;
const torchMat = new THREE.MeshLambertMaterial({ color: 0xffcf6b, emissive: 0xff9a2e, emissiveIntensity: 1.2 });
const torchGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
function rebuildTorchCells() {
  torchCells.length = 0;
  for (const [k, id] of W) if (id === TORCH) { const p = k.split(","); torchCells.push([+p[0], +p[1], +p[2]]); }
  if (torchMesh) scene.remove(torchMesh);
  if (!torchCells.length) { torchMesh = null; return; }
  torchMesh = new THREE.InstancedMesh(torchGeo, torchMat, torchCells.length);
  const d = new THREE.Object3D();
  for (let i = 0; i < torchCells.length; i++) { const c = torchCells[i]; d.position.set(c[0] + 0.5, c[1] + 0.3, c[2] + 0.5); d.updateMatrix(); torchMesh.setMatrixAt(i, d.matrix); }
  torchMesh.instanceMatrix.needsUpdate = true; scene.add(torchMesh);
}
function nearTorch(x, z, rad) { for (const c of torchCells) { const dx = c[0] - x, dz = c[2] - z; if (dx * dx + dz * dz < rad * rad) return true; } return false; }

// chest storage (per dimension + position) and player block edits (for save/load)
let chestStore = new Map();           // "dim:x,y,z" -> [9 stacks]
const editsByDim = { overworld: new Map(), fire: new Map(), end: new Map() };
function chestKey(x, y, z) { return DIM + ":" + bk(x, y, z); }
function recordEdit(x, y, z, id) { const m = editsByDim[DIM]; if (m) m.set(bk(x, y, z), id); }
// player axis-aligned box: HW half width, PH total height, EYE eye height (feet at pos.y)
const HW = 0.3, PH = 1.8, EYE = 1.62;
const player = {
  pos: new THREE.Vector3(0, 40, 0), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  onGround: false, coyote: 0, hp: 20, maxHp: 20, food: 20, stam: 100, maxStam: 100, hurtCd: 0, bob: 0, hitH: false,
  spawn: new THREE.Vector3(0, 40, 0)
};
let gravity = 28, jumpV = 9.2;

// feel + progression state
let thirdPerson = false;
const dodge = { t: 0, cd: 0, x: 0, z: 0 };
const shake = { t: 0, mag: 0 };
let stepT = 0, movedDist = 0, miningMult = 1, placedBlocks = 0, breathT = 0.2;
let xp = 0, level = 1, xpNext = 50;
const ach = new Set();
function addShake(m) { if (settings.reduceMotion) m *= 0.2; shake.t = 0.28; shake.mag = Math.max(shake.mag, m); }

// Thomas avatar (visible in third person; animated)
const thomas = new THREE.Group();
(function buildThomas() {
  const skin = 0xdca06b, shirt = 0x2f6fe0, pant = 0x374151, hair = 0x4a2f1a;
  const bx = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
  const body = bx(0.5, 0.55, 0.28, shirt); body.position.y = 1.0; thomas.add(body);
  const head = bx(0.42, 0.42, 0.42, skin); head.position.y = 1.5; thomas.add(head);
  const hairTop = bx(0.46, 0.13, 0.46, hair); hairTop.position.y = 1.72; thomas.add(hairTop);
  const armL = bx(0.16, 0.5, 0.18, skin); armL.geometry.translate(0, -0.2, 0); armL.position.set(-0.33, 1.05, 0); thomas.add(armL);
  const armR = armL.clone(); armR.position.x = 0.33; thomas.add(armR);
  const legL = bx(0.18, 0.55, 0.2, pant); legL.geometry.translate(0, -0.27, 0); legL.position.set(-0.13, 0.55, 0); thomas.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; thomas.add(legR);
  thomas.userData = { armL, armR, legL, legR };
})();
thomas.visible = false; scene.add(thomas);

function startDodge() {
  if (dodge.cd > 0 || player.stam < 18 || !player.onGround) return;
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), r = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const w = new THREE.Vector3();
  if (keys["KeyW"]) w.add(f); if (keys["KeyS"]) w.sub(f); if (keys["KeyD"]) w.add(r); if (keys["KeyA"]) w.sub(r);
  if (touch.mag > 0.05) { w.add(f.clone().multiplyScalar(input.fwd)); w.add(r.clone().multiplyScalar(input.str)); }
  if (w.lengthSq() < 0.001) w.copy(f);
  w.normalize(); dodge.x = w.x; dodge.z = w.z; dodge.t = 0.2; dodge.cd = 0.85;
  player.stam -= 18; player.hurtCd = Math.max(player.hurtCd, 0.35); SFX.jump(); addShake(0.1);
}

// XP / Level
function addXP(n) {
  xp += n;
  while (xp >= xpNext) { xp -= xpNext; level++; xpNext = Math.floor(xpNext * 1.35); levelUp(); }
  updateXPUI();
}
function levelUp() { skills.pts++; player.hp = Math.min(player.maxHp, player.hp + 4); SFX.levelUp(); toast("Level up. Skill point earned"); addShake(0.12); updateVitals(); renderSkills(); }
function updateXPUI() { const l = document.getElementById("lvl"); if (l) l.textContent = "LV " + level + (skills.pts ? "  +" + skills.pts + "sp" : ""); const f = document.getElementById("xpfill"); if (f) f.style.width = (100 * xp / xpNext) + "%"; }
function achieve(id, label) { if (ach.has(id)) return; ach.add(id); saveAch(); toast("Achievement. " + label); SFX.pickup(); addXP(15); if (typeof renderAch === "function") renderAch(); }
const ACH_KEY = "thomas_voxel_ach";
function saveAch() { try { localStorage.setItem(ACH_KEY, JSON.stringify([...ach])); } catch (e) {} }
function loadAch() { try { (JSON.parse(localStorage.getItem(ACH_KEY)) || []).forEach(a => ach.add(a)); } catch (e) {} }
const ACHDEFS = [
  { id: "firstwood", label: "Lumberjack", desc: "Gather your first wood", test: () => countItem(WOOD) >= 1 || craftedPlanks },
  { id: "craft", label: "Toolmaker", desc: "Craft a pickaxe", test: () => craftedPick },
  { id: "shelter", label: "Homesteader", desc: "Place 8 blocks", test: () => placedBlocks >= 8 },
  { id: "cat", label: "Cat Friend", desc: "Tame a cat", test: () => tameCount >= 1 || tamedCat },
  { id: "night", label: "Night Survivor", desc: "Survive a night", test: () => survivedNight },
  { id: "firstkill", label: "First Blood", desc: "Defeat a monster", test: () => kills >= 1 },
  { id: "slayer", label: "Beast Slayer", desc: "Defeat 10 monsters", test: () => kills >= 10 },
  { id: "miner", label: "Spelunker", desc: "Mine 20 stone", test: () => minedStone >= 20 },
  { id: "level5", label: "Seasoned", desc: "Reach level 5", test: () => level >= 5 },
  { id: "fire", label: "Into the Fire", desc: "Enter the Fire Dimension", test: () => DIM === "fire" || DIM === "end" || fireBossDown },
  { id: "charm", label: "Fireproof", desc: "Hold a Flame Charm", test: () => countItem(I_FIRECHARM) > 0 },
  { id: "fireboss", label: "Guardian Slayer", desc: "Defeat the Fire Guardian", test: () => fireBossDown },
  { id: "endin", label: "The End", desc: "Reach the End", test: () => DIM === "end" },
  { id: "dragon", label: "Dragon Defeated", desc: "Slay the Black Dragon", test: () => false }
];
function checkAchievements() { for (const a of ACHDEFS) if (!ach.has(a.id)) { try { if (a.test()) achieve(a.id, a.label); } catch (e) {} } }
function renderAch() {
  const el = document.getElementById("achList"); if (!el) return;
  el.innerHTML = ACHDEFS.map(a => { const got = ach.has(a.id); return '<div class="arow ' + (got ? "got" : "") + '"><b>' + (got ? "★ " : "☆ ") + a.label + "</b><span>" + a.desc + "</span></div>"; }).join("");
  const n = ACHDEFS.filter(a => ach.has(a.id)).length; const h = document.getElementById("achCount"); if (h) h.textContent = n + " / " + ACHDEFS.length;
}
function toggleAch() { const o = $("ach"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderAch(); o.classList.remove("hidden"); } }

// SKILL TREE
const skills = { pts: 0, mine: 0, hp: 0, stam: 0, sword: 0, cat: 0 };
let swordBonus = 0, catMult = 1;
const SKILLDEF = [
  { k: "mine", name: "Mining Speed", max: 5, desc: "+15% mine speed per point" },
  { k: "hp", name: "Max Health", max: 5, desc: "+2 hearts per point" },
  { k: "stam", name: "Max Stamina", max: 5, desc: "+20 stamina per point" },
  { k: "sword", name: "Sword Damage", max: 5, desc: "+2 damage per point" },
  { k: "cat", name: "Cat Damage", max: 5, desc: "+30% cat damage per point" }
];
function applySkills() { miningMult = 1 + skills.mine * 0.15; player.maxHp = 20 + skills.hp * 4; player.maxStam = 100 + skills.stam * 20; swordBonus = skills.sword * 2; catMult = 1 + skills.cat * 0.3; }
function spendSkill(k) { const def = SKILLDEF.find(d => d.k === k); if (skills.pts <= 0 || skills[k] >= def.max) return; skills[k]++; skills.pts--; applySkills(); if (k === "hp") player.hp = Math.min(player.maxHp, player.hp + 4); SFX.craft(); updateVitals(); updateXPUI(); renderSkills(); }
function aabbHit(px, py, pz) {
  const x0 = Math.floor(px - HW), x1 = Math.floor(px + HW), y0 = Math.floor(py), y1 = Math.floor(py + PH - 0.001), z0 = Math.floor(pz - HW), z1 = Math.floor(pz + HW);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (isSolidBlock(getBlock(x, y, z))) return true;
  return false;
}
function moveAxis(axis, d) {
  const p = player.pos; p[axis] += d;
  if (!aabbHit(p.x, p.y, p.z)) return false;
  if (axis === "x") { p.x = d > 0 ? Math.floor(p.x + HW) - HW - 0.001 : Math.floor(p.x - HW) + 1 + HW + 0.001; player.vel.x = 0; }
  else if (axis === "z") { p.z = d > 0 ? Math.floor(p.z + HW) - HW - 0.001 : Math.floor(p.z - HW) + 1 + HW + 0.001; player.vel.z = 0; }
  else { if (d > 0) { p.y = Math.floor(p.y + PH) - PH - 0.001; player.vel.y = 0; } else { p.y = Math.floor(p.y) + 1; player.vel.y = 0; player.onGround = true; } }
  return true;
}
function physics(dt) {
  // gather wish dir
  dodge.cd = Math.max(0, dodge.cd - dt);
  const dodging = dodge.t > 0;
  const crouch = !dodging && player.onGround && (keys["KeyC"] || keys["ControlLeft"]);
  // turning: arrow Left/Right always turn; A/D turn only in tank scheme
  let turn = 0;
  if (keys["ArrowLeft"]) turn += 1; if (keys["ArrowRight"]) turn -= 1;
  if (settings.scheme === "tank") { if (keys["KeyA"]) turn += 1; if (keys["KeyD"]) turn -= 1; }
  if (turn) player.yaw += turn * 2.4 * dt;
  const fwdKey = keys["KeyW"] || keys["ArrowUp"], backKey = keys["KeyS"] || keys["ArrowDown"];
  const moveKey = fwdKey || backKey || keys["KeyA"] || keys["KeyD"];
  let sprint = !crouch && (keys["ShiftLeft"] || keys["ShiftRight"] || touch.sprint || (isTouch && settings.sprintMode === "always" && touch.mag > 0.12)) && player.stam > 1 && (input.fwd !== 0 || input.str !== 0 || moveKey);
  let sp = sprint ? 6.0 : 4.2; if (powerActive("speed")) sp *= 1.5; if (crouch) sp = 2.0;
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const r = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const wish = new THREE.Vector3();
  if (fwdKey) wish.add(f); if (backKey) wish.sub(f);
  if (settings.scheme !== "tank") { if (keys["KeyD"]) wish.add(r); if (keys["KeyA"]) wish.sub(r); }   // A/D strafe in FPS scheme
  if (touch.mag > 0.05) { wish.add(f.clone().multiplyScalar(input.fwd)); wish.add(r.clone().multiplyScalar(input.str)); }
  if (wish.lengthSq() > 0.0004) { if (wish.length() > 1) wish.normalize(); wish.multiplyScalar(sp); } else wish.set(0, 0, 0);
  if (crouch && player.onGround) {  // sneak: do not walk off ledges
    if (wish.x !== 0 && !isSolidBlock(getBlock(Math.floor(player.pos.x + Math.sign(wish.x) * (HW + 0.06)), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)))) wish.x = 0;
    if (wish.z !== 0 && !isSolidBlock(getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z + Math.sign(wish.z) * (HW + 0.06))))) wish.z = 0;
  }
  if (dodging) { dodge.t -= dt; player.vel.x = dodge.x * 9; player.vel.z = dodge.z * 9; }
  else { player.vel.x = wish.x; player.vel.z = wish.z; }
  player._crouch = crouch;
  player.vel.y -= gravity * dt;
  // jump
  const wantJump = keys["Space"] || touch.jump;
  if (wantJump && (player.onGround || player.coyote > 0)) { player.vel.y = jumpV * (powerActive("jump") ? 1.42 : 1); player.onGround = false; player.coyote = 0; SFX.jump(); }
  // substep to prevent tunneling
  player.onGround = false;
  const steps = Math.max(1, Math.ceil((Math.abs(player.vel.x) + Math.abs(player.vel.y) + Math.abs(player.vel.z)) * dt / 0.4));
  const sdt = dt / steps; let hitX = false, hitZ = false;
  for (let i = 0; i < steps; i++) {
    if (moveAxis("x", player.vel.x * sdt)) hitX = true;
    if (moveAxis("z", player.vel.z * sdt)) hitZ = true;
    moveAxis("y", player.vel.y * sdt);
  }
  if (player.onGround) player.coyote = 0.12; else if (player.coyote > 0) player.coyote -= dt;
  // bounce block: landing on slime launches Thomas high (trampoline toy)
  if (player.onGround) { const below = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)); if (BLOCKS[below] && BLOCKS[below].bouncy) { player.vel.y = 13; player.onGround = false; player.coyote = 0; SFX.jump(); addShake(0.05); } }
  // auto jump (mobile/option): bumped a wall while moving on ground -> hop
  if (settings.autoJump && player.onGround && (hitX || hitZ) && (wish.lengthSq() > 0.01)) { player.vel.y = jumpV; player.onGround = false; }
  // stamina
  if (sprint || dodging) player.stam = Math.max(0, player.stam - 22 * dt); else player.stam = Math.min(player.maxStam, player.stam + 14 * dt);
  // void / fall
  if (player.pos.y < -20) { player.pos.copy(player.spawn); player.vel.set(0, 0, 0); damage(4); }
  // lava / drown-ish damage
  const eye = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1), Math.floor(player.pos.z));
  const feet = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z));
  if (feet === LAVA || eye === LAVA) damage(4 * dt * 4);
  // camera + feedback
  const moving = (player.vel.x * player.vel.x + player.vel.z * player.vel.z) > 0.5 && player.onGround;
  if (moving) { player.bob += dt * (sprint ? 13 : 9); movedDist += sp * dt; stepT -= dt; if (stepT <= 0) { stepSound(); stepT = sprint ? 0.3 : 0.42; } }
  if (sprint && moving) { breathT -= dt; if (breathT <= 0) { breathT = 0.7; blip(180, 0.18, "sine", 0.03, 120); } } else breathT = 0.2;
  const targetFov = (sprint ? settings.fov + 6 : settings.fov) + (thirdPerson ? 5 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  const curEye = player._crouch ? EYE - 0.35 : EYE;
  const eyeY = player.pos.y + curEye + Math.sin(player.bob) * 0.045 * (moving && settings.bob ? 1 : 0);
  let sx = 0, sy = 0, sz = 0;
  if (shake.t > 0) { shake.t -= dt; const s = shake.mag * (shake.t / 0.28); sx = (Math.random() - .5) * s; sy = (Math.random() - .5) * s; sz = (Math.random() - .5) * s; if (shake.t <= 0) shake.mag = 0; }
  if (thirdPerson) {
    const dir = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    let dist = 4.2;
    for (let d = 0.6; d < dist; d += 0.4) { if (isSolidBlock(getBlock(Math.floor(player.pos.x - dir.x * d), Math.floor(eyeY - dir.y * d + 0.3), Math.floor(player.pos.z - dir.z * d)))) { dist = Math.max(1.2, d - 0.4); break; } }
    camera.position.set(player.pos.x - dir.x * dist + sx, eyeY - dir.y * dist + 0.4 + sy, player.pos.z - dir.z * dist + sz);
  } else {
    camera.position.set(player.pos.x + sx, eyeY + sy, player.pos.z + sz);
  }
  camera.rotation.set(player.pitch, player.yaw, 0);
  // Thomas avatar (third person animations: idle, walk, run, mine, attack, crouch)
  if (thirdPerson) {
    thomas.visible = true; thomas.position.set(player.pos.x, player.pos.y, player.pos.z); thomas.rotation.y = player.yaw;
    const amp = moving ? 0.7 : 0, swph = Math.sin(player.bob);
    thomas.userData.legL.rotation.x = swph * amp; thomas.userData.legR.rotation.x = -swph * amp;
    thomas.userData.armL.rotation.x = -swph * amp * 0.7;
    thomas.userData.armR.rotation.x = swing > 0 ? -Math.sin(swing * Math.PI) * 1.7 : swph * amp * 0.7;
    thomas.scale.set(1, player._crouch ? 0.78 : 1, 1);
  } else thomas.visible = false;
  sun.position.set(player.pos.x + lightDir.x * 80, player.pos.y + lightDir.y * 90 + 10, player.pos.z + lightDir.z * 80);
  sun.target.position.set(player.pos.x, player.pos.y, player.pos.z);
  if (player.hurtCd > 0) player.hurtCd -= dt;
}
function damage(n) {
  if (!running) return;
  if (player.hurtCd > 0 && n < 1) return;
  player.hp -= n; if (n >= 1) { player.hurtCd = 0.6; hurtFlash(); SFX.hurt(); if (n >= 4) addShake(0.22); }
  if (player.hp <= 0) die();
  updateVitals();
}

// ---------- INPUT ----------
const keys = {};
const input = { fwd: 0, str: 0 };
const touch = { mag: 0, jump: false, sprint: false };
let pointerLocked = false, primaryHeld = false, paused = false, running = false;

let rebindAction = null;
function keyLabel(code) { if (!code) return "?"; if (code.startsWith("Key")) return code.slice(3); if (code.startsWith("Digit")) return code.slice(5); const arr = { ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" }; return arr[code] || code; }
addEventListener("keydown", e => {
  if (rebindAction) { e.preventDefault(); if (e.code !== "Escape") { settings.keys[rebindAction] = e.code; saveSettings(); toast("Bound " + rebindAction + " to " + keyLabel(e.code)); } rebindAction = null; renderKeybinds(); return; }
  keys[e.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyM") { settings.muted = !settings.muted; applyAudioGains(); saveSettings(); syncSettingsUI(); toast(settings.muted ? "Muted" : "Unmuted"); }
  if (!running) return;
  if (e.code.startsWith("Digit")) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 9) selectSlot(n); }
  const K = settings.keys;
  if (e.code === K.interact) interact();
  if (e.code === K.dodge) startDodge();
  if (e.code === K.camera) { thirdPerson = !thirdPerson; toast(thirdPerson ? "Third person" : "First person"); }
  if (e.code === K.inv || e.code === "KeyB") toggleInv();
  if (e.code === K.skills) toggleSkills();
  if (e.code === K.cat) catCommand();
  if (e.code === K.journal) toggleJournal();
  if (e.code === "Escape") togglePause();
});
addEventListener("keyup", e => { keys[e.code] = false; });
canvas.addEventListener("mousedown", e => { if (!running || paused) return; if (!isTouch && !pointerLocked) { canvas.requestPointerLock(); return; } if (e.button === 0) { primaryHeld = true; } if (e.button === 2) placeBlock(); });
canvas.addEventListener("mouseup", e => { if (e.button === 0) { primaryHeld = false; mineReset(); } });
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("wheel", e => { if (!running) return; selectSlot((selSlot + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
addEventListener("mousemove", e => { if (!pointerLocked) return; player.yaw -= e.movementX * settings.sensD; player.pitch -= e.movementY * settings.sensD; clampPitch(); });
document.addEventListener("pointerlockchange", () => { pointerLocked = document.pointerLockElement === canvas; });
function clampPitch() { const l = Math.PI / 2 - 0.04; player.pitch = Math.max(-l, Math.min(l, player.pitch)); }

// touch input
if (isTouch) {
  const joy = document.getElementById("joy"), jt = document.getElementById("joyT");
  let mId = null, lId = null, lx = 0, ly = 0; const JR = 56;
  const showJoy = (x, y) => { joy.style.left = x + "px"; joy.style.top = y + "px"; joy.style.display = "block"; };
  const setT = (dx, dy) => jt.style.transform = "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px))";
  function upJoy(x, y) { let dx = x - parseFloat(joy.style.left), dy = y - parseFloat(joy.style.top); const d = Math.hypot(dx, dy) || 1; if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; } setT(dx, dy); input.str = dx / JR; input.fwd = -dy / JR; touch.mag = Math.min(1, d / JR); touch.sprint = touch.mag > 0.92; }
  function endJoy() { joy.style.display = "none"; setT(0, 0); input.fwd = input.str = 0; touch.mag = 0; touch.sprint = false; }
  const onBtn = t => t.target && t.target.closest && t.target.closest(".tc,.slot,.btn,.seg,.cell,.craftRow,input");
  addEventListener("touchstart", e => { if (!running || paused) return; let used = false; for (const t of e.changedTouches) { if (onBtn(t)) continue; used = true; const x = t.clientX, y = t.clientY; if (x < innerWidth * 0.45 && mId === null) { mId = t.identifier; showJoy(x, y); upJoy(x, y); } else if (lId === null) { lId = t.identifier; lx = x; ly = y; } } if (used) e.preventDefault(); }, { passive: false });
  addEventListener("touchmove", e => { if (!running) return; for (const t of e.changedTouches) { if (t.identifier === mId) upJoy(t.clientX, t.clientY); else if (t.identifier === lId) { player.yaw -= (t.clientX - lx) * settings.sensM; player.pitch -= (t.clientY - ly) * settings.sensM; clampPitch(); lx = t.clientX; ly = t.clientY; } } e.preventDefault(); }, { passive: false });
  function endT(e) { for (const t of e.changedTouches) { if (t.identifier === mId) { mId = null; endJoy(); } else if (t.identifier === lId) lId = null; } }
  addEventListener("touchend", endT); addEventListener("touchcancel", endT);
  document.addEventListener("gesturestart", e => e.preventDefault());
  const bind = (id, dn, up) => { const el = document.getElementById(id); el.addEventListener("pointerdown", e => { e.preventDefault(); dn(); }); if (up) { el.addEventListener("pointerup", e => { e.preventDefault(); up(); }); el.addEventListener("pointercancel", up); el.addEventListener("pointerleave", up); } };
  bind("bJump", () => touch.jump = true, () => touch.jump = false);
  bind("bAttack", () => primaryHeld = true, () => { primaryHeld = false; mineReset(); });
  bind("bBuild", placeBlock);
  bind("bDodge", startDodge);
  bind("bUse", interact);
  bind("bInv", toggleInv);
  bind("bPause", togglePause);
}

// ---------- AIM / MINING / BUILDING ----------
const ray = new THREE.Raycaster(); const ctr = new THREE.Vector2(0, 0);
const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
selBox.visible = false; scene.add(selBox);
function voxelRaycast(reach) {
  // DDA voxel traversal from camera
  const o = new THREE.Vector3(player.pos.x, player.pos.y + (player._crouch ? EYE - 0.35 : EYE), player.pos.z); const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
  const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
  let mx = (sx > 0 ? (x + 1 - o.x) : (o.x - x)) * tdx, my = (sy > 0 ? (y + 1 - o.y) : (o.y - y)) * tdy, mz = (sz > 0 ? (z + 1 - o.z) : (o.z - z)) * tdz;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < reach * 4; i++) {
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) return { x, y, z, id, n: [nx, ny, nz] };
    if (mx < my && mx < mz) { x += sx; t = mx; mx += tdx; nx = -sx; ny = nz = 0; }
    else if (my < mz) { y += sy; t = my; my += tdy; ny = -sy; nx = nz = 0; }
    else { z += sz; t = mz; mz += tdz; nz = -sz; nx = ny = 0; }
    if (t > reach) break;
  }
  return null;
}
let mineTarget = null, mineProg = 0, mineSfxCd = 0;
function mineReset() { mineProg = 0; mineTarget = null; document.getElementById("mineRing").style.opacity = "0"; }
function currentTool() { const it = hotbar[selSlot]; return (it && isItem(it.id)) ? ITEMS[it.id] : null; }
function breakTime(id) {
  const b = BLOCKS[id]; if (!b || b.hard <= 0) return Infinity;
  let t = b.hard; const tool = currentTool();
  if (tool && b.tool && tool.tool === b.tool) t /= (1 + tool.tier);    // right tool faster
  else if (tool && tool.tool === "sword") t *= 1.2;
  return Math.max(0.12, t / miningMult);
}
function updateMining(dt) {
  if (!primaryHeld) return;
  // attack entities first
  const hit = aimEntity();
  if (hit) { attackEntity(hit); return; }
  const r = voxelRaycast(5);
  if (!r || !BLOCKS[r.id] || BLOCKS[r.id].hard <= 0) { mineReset(); return; }
  if (!mineTarget || mineTarget.x !== r.x || mineTarget.y !== r.y || mineTarget.z !== r.z) { mineTarget = r; mineProg = 0; }
  mineProg += dt; mineSfxCd -= dt; if (mineSfxCd <= 0) { SFX.mine(); mineSfxCd = 0.18; }
  const need = breakTime(r.id);
  const ring = document.getElementById("mineRing"); ring.style.opacity = "1";
  const frac = Math.min(1, mineProg / need);
  document.querySelector("#mineRing .fg").style.strokeDasharray = (2 * Math.PI * 22).toFixed(1);
  document.querySelector("#mineRing .fg").style.strokeDashoffset = (2 * Math.PI * 22 * (1 - frac)).toFixed(1);
  if (mineProg >= need) {
    const drop = BLOCKS[r.id].drop;
    if (r.id === CHEST) chestStore.delete(chestKey(r.x, r.y, r.z));
    setRaw(r.x, r.y, r.z, AIR); recordEdit(r.x, r.y, r.z, AIR);
    if (r.id === PORTAL) rebuildPortalCells();
    if (r.id === TORCH) rebuildTorchCells();
    markDirty(r.x, r.z); markDirty(r.x + 1, r.z); markDirty(r.x - 1, r.z); markDirty(r.x, r.z + 1); markDirty(r.x, r.z - 1);
    blockParticles(r.x, r.y, r.z, BLOCKS[r.id].top);
    if (drop !== undefined) addItem(drop, 1);
    SFX.place();
    mineReset(); onMine(r.id);
  }
}
function placeBlock() {
  const it = hotbar[selSlot]; if (!it || isItem(it.id)) { return; }       // only blocks place
  const r = voxelRaycast(5); if (!r) return;
  const tx = r.x + r.n[0], ty = r.y + r.n[1], tz = r.z + r.n[2];
  if (getBlock(tx, ty, tz) !== AIR && getBlock(tx, ty, tz) !== WATER) return;
  // don't place a solid block inside the player
  if (BLOCKS[it.id].solid) {
    const x0 = Math.floor(player.pos.x - HW), x1 = Math.floor(player.pos.x + HW), y0 = Math.floor(player.pos.y), y1 = Math.floor(player.pos.y + PH - 0.001), z0 = Math.floor(player.pos.z - HW), z1 = Math.floor(player.pos.z + HW);
    if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 && tz >= z0 && tz <= z1) return;
  }
  setRaw(tx, ty, tz, it.id); recordEdit(tx, ty, tz, it.id);
  markDirty(tx, tz); markDirty(tx + 1, tz); markDirty(tx - 1, tz); markDirty(tx, tz + 1); markDirty(tx, tz - 1);
  if (it.id === TORCH) rebuildTorchCells();
  if (it.id === CHEST && !chestStore.has(chestKey(tx, ty, tz))) chestStore.set(chestKey(tx, ty, tz), new Array(9).fill(null));
  removeItem(selSlot, 1); SFX.place(); placedBlocks++;
}
function blockParticles(x, y, z, col) {
  const c = new THREE.Color(col[0], col[1], col[2]);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x + 0.5, y + 0.5, z + 0.5); scene.add(m); fxParts.push({ mesh: m, life: 0.4, vel: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3) }); }
}

// ---------- INVENTORY ----------
const hotbar = new Array(9).fill(null);   // {id,count}
let selSlot = 0;
function addItem(id, n) {
  const stack = isItem(id) ? 1 : 64;
  for (let i = 0; i < 9; i++) { const s = hotbar[i]; if (s && s.id === id && s.count < stack) { s.count += n; renderHotbar(); SFX.pickup(); toast("+" + n + " " + itemName(id)); onCollect(id); return; } }
  for (let i = 0; i < 9; i++) { if (!hotbar[i]) { hotbar[i] = { id, count: n }; renderHotbar(); SFX.pickup(); toast("+" + n + " " + itemName(id)); onCollect(id); return; } }
  toast("Inventory full");
}
function removeItem(slot, n) { const s = hotbar[slot]; if (!s) return; s.count -= n; if (s.count <= 0) hotbar[slot] = null; renderHotbar(); }
function countItem(id) { let c = 0; for (const s of hotbar) if (s && s.id === id) c += s.count; return c; }
function consumeItem(id, n) { for (let i = 0; i < 9; i++) { const s = hotbar[i]; if (s && s.id === id) { const take = Math.min(n, s.count); s.count -= take; n -= take; if (s.count <= 0) hotbar[i] = null; if (n <= 0) break; } } renderHotbar(); }
function selectSlot(i) { selSlot = i; renderHotbar(); buildViewItem(); }

// ---------- CRAFTING (basic, TODO: full tree + crafting grid) ----------
const RECIPES = [
  { out: PLANKS, n: 4, need: [[WOOD, 1]] },
  { out: I_STICK, n: 4, need: [[PLANKS, 2]] },
  { out: I_WPICK, n: 1, need: [[PLANKS, 3], [I_STICK, 2]] },
  { out: I_SWORD, n: 1, need: [[PLANKS, 2], [I_STICK, 1]] },
  { out: I_AXE, n: 1, need: [[PLANKS, 3], [I_STICK, 2]] },
  { out: I_SPICK, n: 1, need: [[COBBLE, 3], [I_STICK, 2]] },
  { out: TORCH, n: 4, need: [[PLANKS, 1], [I_STICK, 1]] },
  { out: CHEST, n: 1, need: [[PLANKS, 8]] },
  { out: BRICK, n: 4, need: [[COBBLE, 4]] },
  { out: BED, n: 1, need: [[PLANKS, 3], [WOOD, 2]] },
  { out: I_FIRECHARM, n: 1, need: [[FIRE_CRYSTAL, 4], [I_STICK, 2]] },
  { out: I_FIRESWORD, n: 1, need: [[FIRE_CRYSTAL, 3], [I_STICK, 1]] },
  { out: I_LIGHTHAMMER, n: 1, need: [[COBBLE, 5], [I_STICK, 2]] },
  { out: BOUNCE, n: 2, need: [[LEAVES, 4], [PLANKS, 1]] }
];
function canCraft(r) { return r.need.every(([id, c]) => countItem(id) >= c); }
function craft(r) { if (!canCraft(r)) return; r.need.forEach(([id, c]) => consumeItem(id, c)); addItem(r.out, r.n); SFX.craft(); renderCraft(); onCraft(r.out); }

// ---------- ENEMIES (purple monsters) — EnemySystem + MonsterAI ----------
// types: crawler, brute (slam windup), spitter (ranged), ghost (phasing),
//        screamer (summons backup), miner (digs weak blocks). Elites + loot + day scaling.
// TODO: portal guard, real A* pathfinding, full mini-boss variants.
let monsters = [];
const MTYPE = {
  crawler:  { col: 0xb05bff, sc: 0.85, hp: 28, speed: 3.3, dmg: 3, xp: 8,  flee: true,  loot: [[I_STICK, 1, 0.4]] },
  brute:    { col: 0x6a1fb0, sc: 1.3,  hp: 70, speed: 1.3, dmg: 7, xp: 16, slam: true,  loot: [[COBBLE, 2, 0.6], [I_APPLE, 1, 0.3]] },
  spitter:  { col: 0xd24bff, sc: 0.95, hp: 34, speed: 1.9, dmg: 0, xp: 14, ranged: true, flee: true, loot: [[I_STICK, 1, 0.5]] },
  ghost:    { col: 0xc9a8ff, sc: 0.95, hp: 24, speed: 3.9, dmg: 4, xp: 18, ghost: true,  loot: [[I_APPLE, 1, 0.4]] },
  screamer: { col: 0x9a3df0, sc: 1.15, hp: 40, speed: 1.7, dmg: 4, xp: 22, tall: true, summon: true, loot: [[I_APPLE, 1, 0.5], [PLANKS, 2, 0.4]] },
  miner:    { col: 0x7c4bd0, sc: 1.0,  hp: 46, speed: 1.9, dmg: 5, xp: 20, digger: true, loot: [[COBBLE, 3, 0.7], [I_SPICK, 1, 0.06]] },
  firedemon:{ col: 0xff5a1e, sc: 1.1,  hp: 55, speed: 2.1, dmg: 6, xp: 24, ranged: true, fire: true, loot: [[FIRE_CRYSTAL, 2, 0.6]] },
  lavaworm: { col: 0xff8a2e, sc: 0.9,  hp: 38, speed: 3.3, dmg: 5, xp: 20, fire: true, loot: [[FIRE_CRYSTAL, 1, 0.5]] },
  shadowknight: { col: 0x14141c, sc: 1.2, hp: 64, speed: 1.9, dmg: 7, xp: 28, shadow: true, loot: [[ENDSTONE, 2, 0.5]] },
  endstalker:   { col: 0x241f33, sc: 0.9, hp: 30, speed: 4.3, dmg: 5, xp: 24, shadow: true, loot: [[ENDSTONE, 1, 0.5]] }
};
function makeBar() { const c = document.createElement("canvas"); c.width = 48; c.height = 8; const x = c.getContext("2d"); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(1.0, 0.16, 1); function up(f) { x.clearRect(0, 0, 48, 8); x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, 48, 8); x.fillStyle = f > .5 ? "#4ade80" : f > .25 ? "#facc15" : "#ef4444"; x.fillRect(1, 1, 46 * Math.max(0, f), 6); t.needsUpdate = true; } up(1); return { sprite: s, up }; }
function makeTag(text) { const c = document.createElement("canvas"); c.width = 128; c.height = 32; const x = c.getContext("2d"); x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(0, 0, 128, 32); x.fillStyle = "#fff"; x.font = "bold 20px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 64, 17); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(1.3, 0.33, 1); return s; }
function monsterLabel(cfg, type) { if (cfg.fire) return type === "lavaworm" ? "WORM" : "FIRE"; if (cfg.shadow) return type === "endstalker" ? "STALK" : "KNIGHT"; if (cfg.ranged) return "RANGED"; if (cfg.summon) return "SUMMON"; if (cfg.digger) return "DIGGER"; if (cfg.ghost) return "GHOST"; if (cfg.slam) return "BRUTE"; return "MELEE"; }
function applyCbMarkers() { for (const m of monsters) if (m.mark) m.mark.visible = settings.cbMarkers; }
function spawnMonster(x, z, type) {
  if (!type) { const rl = Math.random();
    type = isNight()
      ? (rl < 0.26 ? "crawler" : rl < 0.44 ? "brute" : rl < 0.62 ? "spitter" : rl < 0.76 ? "ghost" : rl < 0.9 ? "screamer" : "miner")
      : (rl < 0.5 ? "crawler" : rl < 0.8 ? "brute" : "miner"); }
  const cfg = MTYPE[type], elite = Math.random() < 0.08, sc = cfg.sc * (elite ? 1.5 : 1), col = cfg.col;
  const dayMul = Math.min(2.2, 1 + 0.05 * (day - 1));
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: !!(cfg.ghost || cfg.shadow), opacity: cfg.ghost ? 0.55 : cfg.shadow ? 0.82 : 1 });
  const headY = (cfg.tall ? 1.95 : 1.55) * sc;
  const body = new THREE.Mesh(new THREE.BoxGeometry((cfg.tall ? 0.5 : 0.7) * sc, (cfg.tall ? 1.15 : 0.85) * sc, 0.45 * sc), mat(col)); body.position.y = (cfg.tall ? 1.05 : 0.9) * sc; g.add(body);
  const emBase = cfg.fire ? 0x6a1800 : cfg.shadow ? 0x14001f : 0x000000;
  if (cfg.fire || cfg.shadow) { body.material.emissive.setHex(emBase); body.material.emissiveIntensity = cfg.fire ? 0.85 : 0.5; }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * sc, 0.55 * sc, 0.55 * sc), mat(col)); head.position.y = headY; g.add(head);
  const eC = cfg.fire ? 0xffd23d : cfg.shadow ? 0xc24bff : cfg.ranged ? 0x7afcff : cfg.ghost ? 0xffffff : cfg.summon ? 0xffd23d : 0xff3df0;
  const eyeMat = new THREE.MeshLambertMaterial({ color: eC, emissive: eC, emissiveIntensity: 1.0 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.13, cfg.summon ? 0.16 : 0.1, 0.05), eyeMat); eL.position.set(-0.15, headY + 0.05, 0.28 * sc); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.15; g.add(eR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34 * sc, cfg.summon ? 0.2 : 0.08, 0.05), new THREE.MeshLambertMaterial({ color: 0x140014 })); mouth.position.set(0, headY - 0.18 * sc, 0.28 * sc); g.add(mouth);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(cfg.digger ? 0.22 : 0.16, 0.6 * sc, 0.18), mat(col)); armL.geometry.translate(0, -0.25 * sc, 0); armL.position.set(-0.45 * sc, (cfg.tall ? 1.6 : 1.35) * sc, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.45 * sc; g.add(armR);
  const clawCol = cfg.digger ? 0xffd9a0 : 0xe9e2ff, cs = cfg.digger ? 1.7 : 1;
  const cl = (px) => { const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.07 * cs, 0.16 * cs, 0.07 * cs), new THREE.MeshLambertMaterial({ color: clawCol })); c2.position.set(px, (cfg.tall ? 1.25 : 1.02) * sc, 0); g.add(c2); };
  cl(-0.45 * sc); cl(0.45 * sc);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5 * sc, 0.2), mat(col)); legL.geometry.translate(0, -0.25 * sc, 0); legL.position.set(-0.15, 0.5 * sc, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  if (type === "brute") { const hMat = new THREE.MeshLambertMaterial({ color: 0x2a0a3a }); const hL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), hMat); hL.position.set(-0.2, 1.98 * sc, 0); hL.rotation.z = 0.35; g.add(hL); const hR = hL.clone(); hR.position.x = 0.2; hR.rotation.z = -0.35; g.add(hR); }
  if (elite) { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,90,255,0.85)", "rgba(150,0,255,0)"), depthWrite: false, transparent: true, fog: false })); aura.scale.set(2.6 * sc, 2.6 * sc, 1); aura.position.y = headY * 0.8; g.add(aura); }
  const bar = makeBar(); bar.sprite.position.y = (cfg.tall ? 2.6 : 2.25) * sc; g.add(bar.sprite);
  const mark = makeTag(monsterLabel(cfg, type) + (elite ? "+" : "")); mark.position.y = (cfg.tall ? 2.95 : 2.6) * sc; mark.visible = settings.cbMarkers; g.add(mark);
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  const hp = Math.round(cfg.hp * (elite ? 2 : 1) * dayMul);
  monsters.push({ g, type, hp, max: hp, speed: cfg.speed, dmg: Math.round(cfg.dmg * (elite ? 1.5 : 1) * dayMul), xp: Math.round(cfg.xp * (elite ? 2.5 : 1)),
    ranged: !!cfg.ranged, ghost: !!cfg.ghost, slam: !!cfg.slam, summon: !!cfg.summon, digger: !!cfg.digger, flee: !!cfg.flee, elite,
    loot: cfg.loot || [], emBase, shootCd: 1.6, summonCd: 4 + Math.random() * 4, digCd: 1.5, touch: 0, flash: 0, windup: 0, slamCd: 0,
    bar, mark, body, legL, legR, armL, armR, moveT: 0, dir: Math.random() * 6.28, state: "idle", aggro: false, dead: false, dt: 0 });
}
function surfaceY(x, z) { for (let y = WORLD_H - 1; y >= 0; y--) if (isSolidBlock(getBlock(Math.floor(x), y, Math.floor(z)))) return y + 1; return SEA + 1; }
function updateMonsters(dt) {
  const night = isNight();
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m.dead) { m.dt += dt; m.g.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 3)); m.g.rotation.z += dt * 6; m.g.position.y -= dt * 1.5; if (m.dt > 0.5) { scene.remove(m.g); monsters.splice(i, 1); } continue; }
    const dx = player.pos.x - m.g.position.x, dz = player.pos.z - m.g.position.z, d = Math.hypot(dx, dz) || 0.0001;
    const aggroR = (night ? 22 : 14) + (m.summon ? 6 : 0) + (m.elite ? 4 : 0);
    if (!m.aggro && d < aggroR) { m.aggro = true; m.summon ? SFX.screech() : SFX.growl(); }
    else if (m.aggro && d > aggroR * 1.7) { m.aggro = false; }
    if (m.flash > 0) m.flash -= dt;
    if (m.burn > 0) { m.burn -= dt; m.burnTick -= dt; if (m.burnTick <= 0) { m.burnTick = 0.5; m.hp -= 2; m.flash = 0.1; m.bar.up(Math.max(0, m.hp / m.max)); hitSpark(m.g.position, 0xff7a2a); if (m.hp <= 0 && !m.dead) { killMonster(m); continue; } } }
    if (m.touch > 0) m.touch -= dt;
    if (m.slamCd > 0) m.slamCd -= dt;
    if (m.summonCd > 0) m.summonCd -= dt;
    if (m.digCd > 0) m.digCd -= dt;
    const lowHp = m.hp < m.max * 0.28, face = () => { if (d > 0.3) m.g.rotation.y = Math.atan2(dx, dz); };
    let moving = false;

    if (m.windup > 0) {                                  // attack telegraph (readable)
      m.windup -= dt; face(); m.armL.rotation.x = -1.2; m.armR.rotation.x = -1.2;
      if (m.windup <= 0) {
        if (m.slam) { SFX.slam(); if (d < 2.7) { damage(m.dmg); addShake(0.5); const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.6); } m.slamCd = 2.6; }
        else if (m.ranged) { spawnProjectile(m.g.position, player.pos); m.shootCd = 2.2; }
        m.armL.rotation.x = 0; m.armR.rotation.x = 0;
      }
    } else if (!m.aggro) {                                // idle patrol, or raid the base at night
      let tx = null, tz = null, td = 40;
      if (night) for (const c of torchCells) { const ddx = c[0] - m.g.position.x, ddz = c[2] - m.g.position.z, dd = Math.hypot(ddx, ddz); if (dd < td) { td = dd; tx = ddx; tz = ddz; } }
      if (tx !== null) { const dd = Math.hypot(tx, tz) || 1; m.g.position.x += (tx / dd) * m.speed * 0.7 * dt; m.g.position.z += (tz / dd) * m.speed * 0.7 * dt; m.g.rotation.y = Math.atan2(tx, tz); moving = true; }
      else { if (Math.random() < 0.01) m.dir += (Math.random() - .5) * 1.5; m.g.position.x += Math.sin(m.dir) * 0.5 * dt; m.g.position.z += Math.cos(m.dir) * 0.5 * dt; m.g.rotation.y = m.dir; moving = true; }
    } else if (m.flee && lowHp) {                         // retreat when hurt
      m.g.position.x -= (dx / d) * m.speed * dt; m.g.position.z -= (dz / d) * m.speed * dt; m.g.rotation.y = Math.atan2(-dx, -dz); moving = true;
    } else if (m.ranged) {                                // keep range + cast with windup
      const mv = d > 11 ? 1 : (d < 6 ? -1 : 0);
      if (mv) { m.g.position.x += (dx / d) * m.speed * dt * mv; m.g.position.z += (dz / d) * m.speed * dt * mv; moving = mv > 0; }
      face(); m.shootCd -= dt; if (d < 22 && m.shootCd <= 0) { m.windup = 0.5; m.shootCd = 2.2; }
    } else {                                              // melee chase
      if (m.slam && d < 2.7 && m.slamCd <= 0) { m.windup = 0.6; SFX.growl(); }
      else if (d > 1.1) { m.g.position.x += (dx / d) * m.speed * dt; m.g.position.z += (dz / d) * m.speed * dt; face(); moving = true; }
      else if (m.touch <= 0 && !m.slam) { damage(m.dmg); m.touch = 1.0; const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.3); }
      if (m.summon && m.summonCd <= 0 && d < aggroR && monsters.length < (night ? 16 : 6)) { m.summonCd = 11; SFX.screech(); for (let s = 0; s < 2; s++) { const a = Math.random() * 6.28; spawnMonster(Math.floor(m.g.position.x + Math.cos(a) * 3), Math.floor(m.g.position.z + Math.sin(a) * 3), "crawler"); } }
      if (m.digger && m.digCd <= 0 && d > 1.2) {
        const bx = Math.floor(m.g.position.x + (dx / d) * 0.8), bz = Math.floor(m.g.position.z + (dz / d) * 0.8), by = Math.floor(m.g.position.y + 0.5);
        let dug = false;
        for (const yy of [by, by + 1]) { const id = getBlock(bx, yy, bz); if (isSolidBlock(id) && BLOCKS[id] && BLOCKS[id].hard < 1) { setRaw(bx, yy, bz, AIR); markDirty(bx, bz); markDirty(bx + 1, bz); markDirty(bx - 1, bz); markDirty(bx, bz + 1); markDirty(bx, bz - 1); SFX.dig(); m.digCd = 0.9; dug = true; break; } }
        if (!dug) m.digCd = 0.5;
      }
    }
    if (m.body && m.body.material.emissive) m.body.material.emissive.setHex(m.flash > 0 ? 0x771018 : (m.emBase || 0x000000));
    const ty = surfaceY(m.g.position.x, m.g.position.z);     // smooth ground follow
    m.g.position.y += (ty - m.g.position.y) * Math.min(1, dt * 10);
    if (moving && m.windup <= 0) { m.moveT += dt * 9; const s = Math.sin(m.moveT) * 0.5; m.legL.rotation.x = s; m.legR.rotation.x = -s; m.armL.rotation.x = -s; m.armR.rotation.x = s; }
    else if (m.windup <= 0) { m.legL.rotation.x *= 0.8; m.legR.rotation.x *= 0.8; }
  }
  // spawning
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (DIM === "overworld") {
      spawnTimer = isNight() ? 3 : 12;
      const cap = isNight() ? 14 : 4;
      if (monsters.length < cap) {
        const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 8;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        if (!nearTorch(sxp, szp, 9)) spawnMonster(sxp, szp);
      }
    } else if (DIM === "fire") {
      spawnTimer = 5;
      if (monsters.length < 7) {
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 8;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        spawnMonster(sxp, szp, Math.random() < 0.5 ? "firedemon" : "lavaworm");
      }
    } else if (DIM === "end") {
      spawnTimer = 6;
      if (monsters.length < 6) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 8;
        let sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        if (Math.hypot(sxp, szp) > 42) { sxp = Math.floor(player.pos.x); szp = Math.floor(player.pos.z); }  // keep on the island
        spawnMonster(sxp, szp, Math.random() < 0.5 ? "shadowknight" : "endstalker");
      }
    }
  }
}
let spawnTimer = 6;

// ---------- ANIMALS (cats + mice) ----------
let cats = [], mice = [];
const CAT_COLORS = [{ n: "orange", c: 0xe8862a }, { n: "black", c: 0x2b2b2b }, { n: "white", c: 0xeeeeee }, { n: "gray", c: 0x8a8a8a }, { n: "tabby", c: 0xa9702f }];
// each colour gives a tamed cat a passive ability: white heals, orange/tabby fight harder, black/gray scout for danger
function catAbility(color) { if (color === "white") return "heal"; if (color === "orange" || color === "tabby") return "fury"; if (color === "black" || color === "gray") return "scout"; return "balanced"; }
function catAbilityDesc(a) { return a === "heal" ? "heals Thomas" : a === "fury" ? "fights harder" : a === "scout" ? "senses danger" : "loyal helper"; }
function bxm(w, h, d, col) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); }
function spawnCat(x, z, opts) {
  opts = opts || {};
  const pick = opts.color ? (CAT_COLORS.find(c => c.n === opts.color) || CAT_COLORS[0]) : CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)];
  const col = pick.c;
  const g = new THREE.Group();
  const body = bxm(0.26, 0.22, 0.5, col); body.position.set(0, 0.34, 0); g.add(body);
  const chest = bxm(0.24, 0.22, 0.18, col); chest.position.set(0, 0.36, 0.24); g.add(chest);
  const head = bxm(0.26, 0.24, 0.24, col); head.position.set(0, 0.46, 0.36); g.add(head);
  const earL = bxm(0.08, 0.12, 0.05, col); earL.position.set(-0.09, 0.6, 0.36); earL.rotation.z = 0.2; g.add(earL);
  const earR = bxm(0.08, 0.12, 0.05, col); earR.position.set(0.09, 0.6, 0.36); earR.rotation.z = -0.2; g.add(earR);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0x3a5f1f, emissiveIntensity: 0.4 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), eyeMat); eL.position.set(-0.07, 0.48, 0.49); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.07; g.add(eR);
  const nose = bxm(0.05, 0.04, 0.04, 0xd98a8a); nose.position.set(0, 0.43, 0.5); g.add(nose);
  const legs = [];
  const lp = [[-0.09, 0.28], [0.09, 0.28], [-0.09, -0.18], [0.09, -0.18]];
  for (const [lx, lz] of lp) { const leg = bxm(0.07, 0.2, 0.07, col); leg.geometry.translate(0, -0.1, 0); leg.position.set(lx, 0.24, lz); g.add(leg); legs.push(leg); }
  const tail = bxm(0.06, 0.06, 0.32, col); tail.geometry.translate(0, 0, -0.16); tail.position.set(0, 0.42, -0.25); tail.rotation.x = 0.6; g.add(tail);
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  cats.push({ g, dir: Math.random() * 6.28, tamed: !!opts.tamed, friendly: !!opts.friendly, name: opts.name || null, hp: 10, level: opts.level || 1, kills: 0, mode: opts.mode || "follow", stay: new THREE.Vector3(x + 0.5, 0, z + 0.5), meow: Math.random() * 6, warnCd: 0, healCd: 0, ability: catAbility(pick.n), legs, tail, walkT: 0, moved: false, color: pick.n });
}
function spawnMouse(x, z) {
  const golden = Math.random() < 0.08;
  const col = golden ? 0xe8c23a : [0xb9b9c2, 0x8a6a4a, 0xeeeeee][Math.floor(Math.random() * 3)];
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: col, emissive: golden ? 0x7a5a00 : 0x000000, emissiveIntensity: golden ? 0.5 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), mat); body.position.set(0, 0.09, 0); g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.12), mat); head.position.set(0, 0.1, 0.16); g.add(head);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), mat); earL.position.set(-0.06, 0.16, 0.15); g.add(earL);
  const earR = earL.clone(); earR.position.x = 0.06; g.add(earR);
  const eMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), eMat); eL.position.set(-0.04, 0.11, 0.22); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.04; g.add(eR);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.26), mat); tail.geometry.translate(0, 0, -0.13); tail.position.set(0, 0.09, -0.12); tail.rotation.x = -0.2; g.add(tail);
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  mice.push({ g, dir: Math.random() * 6.28, tail, golden, t: Math.random() * 6 });
}
function wander(o, dt, sp) { if (Math.random() < 0.012) o.dir += (Math.random() - .5) * 1.6; o.g.position.x += Math.sin(o.dir) * sp * dt; o.g.position.z += Math.cos(o.dir) * sp * dt; o.g.rotation.y = o.dir; o.g.position.y = surfaceY(o.g.position.x, o.g.position.z); }
function updateAnimals(dt) {
  if (DIM !== "overworld") return;
  for (const ms of mice) {
    let nd = 999, near = null; for (const c of cats) { const d = c.g.position.distanceTo(ms.g.position); if (d < nd) { nd = d; near = c; } }
    const dpm = ms.g.position.distanceTo(player.pos);
    const fleeing = (near && nd < 6) || dpm < 4;
    if (near && nd < 6) ms.dir = Math.atan2(ms.g.position.x - near.g.position.x, ms.g.position.z - near.g.position.z);
    else if (dpm < 4) ms.dir = Math.atan2(ms.g.position.x - player.pos.x, ms.g.position.z - player.pos.z);
    wander(ms, dt, fleeing ? 3.8 : 1.9);
    ms.t += dt * 12; ms.tail.rotation.y = Math.sin(ms.t) * 0.6;
    if (Math.random() < 0.002) SFX.squeak();
  }
  for (let i = cats.length - 1; i >= 0; i--) {
    const c = cats[i]; c.meow -= dt; if (c.meow <= 0) { c.meow = 6 + Math.random() * 8; SFX.meow(); }
    if (c.warnCd > 0) c.warnCd -= dt;
    c.moved = false;
    if (c.tamed) {
      // danger warning: scout cats sense monsters day or night, others at night
      if (c.warnCd <= 0 && (isNight() || c.ability === "scout")) { for (const m of monsters) if (!m.dead && m.g.position.distanceTo(c.g.position) < 9) { SFX.meow(); toast((c.name || (c.color + " cat")) + " senses danger nearby"); c.warnCd = 12; break; } }
      // healer cats slowly mend Thomas when close
      if (c.ability === "heal") { c.healCd -= dt; if (c.healCd <= 0 && c.g.position.distanceTo(player.pos) < 6 && player.hp < player.maxHp) { c.healCd = 3; player.hp = Math.min(player.maxHp, player.hp + 1); updateVitals(); hitSpark(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0x7CF07C); } }
      if (c.mode === "stay") {                                   // hold position
        const sx = c.stay.x - c.g.position.x, sz = c.stay.z - c.g.position.z, sd = Math.hypot(sx, sz);
        if (sd > 0.6) { c.g.position.x += (sx / sd) * 2.2 * dt; c.g.position.z += (sz / sd) * 2.2 * dt; c.g.rotation.y = Math.atan2(sx, sz); c.moved = true; }
      } else {                                                   // follow
        const dx = player.pos.x - c.g.position.x, dz = player.pos.z - c.g.position.z, d = Math.hypot(dx, dz);
        if (d > 2) { c.g.position.x += (dx / d) * 3.2 * dt; c.g.position.z += (dz / d) * 3.2 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.moved = true; }
      }
      c.g.position.y = surfaceY(c.g.position.x, c.g.position.z);
      // fight nearest monster (damage scales with cat level)
      let nm = null, nmd = 8; for (const m of monsters) if (!m.dead) { const md = m.g.position.distanceTo(c.g.position); if (md < nmd) { nmd = md; nm = m; } }
      if (nm && nmd < 1.3) { nm.hp -= 8 * dt * catMult * (1 + 0.25 * (c.level - 1)) * (c.ability === "fury" ? 1.5 : 1); nm.bar.up(Math.max(0, nm.hp / nm.max)); if (nm.hp <= 0 && !nm.dead) { nm.dead = true; addXP(Math.round((nm.xp || 8) * 0.5)); onKill(); c.kills++; if (c.kills % 3 === 0) { c.level++; toast((c.name || (c.color + " cat")) + " reached level " + c.level); SFX.levelUp(); } } }
    } else if (c.friendly) {                                   // a friendly stray (Whiskers) trots over to Thomas
      const dx = player.pos.x - c.g.position.x, dz = player.pos.z - c.g.position.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.7) { c.g.position.x += (dx / d) * 3.4 * dt; c.g.position.z += (dz / d) * 3.4 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.g.position.y = surfaceY(c.g.position.x, c.g.position.z); c.moved = true; }
      else { c.g.rotation.y = Math.atan2(dx, dz); if (c.meow <= 0.05) { c.meow = 2.5 + Math.random() * 2; } }
    } else {
      let nd = 999, near = null; for (const ms of mice) { const d = ms.g.position.distanceTo(c.g.position); if (d < nd) { nd = d; near = ms; } }
      if (near && nd < 12) { const dx = near.g.position.x - c.g.position.x, dz = near.g.position.z - c.g.position.z, d = Math.hypot(dx, dz) || 1; c.g.position.x += (dx / d) * 3 * dt; c.g.position.z += (dz / d) * 3 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.g.position.y = surfaceY(c.g.position.x, c.g.position.z); c.moved = true; if (nd < 0.6) { if (near.golden) { addXP(20); addItem(I_APPLE, 1); toast("A golden mouse. Lucky find."); SFX.pickup(); } scene.remove(near.g); mice = mice.filter(x => x !== near); spawnMouse((player.pos.x + (Math.random() - .5) * 30) | 0, (player.pos.z + (Math.random() - .5) * 30) | 0); } }
      else { wander(c, dt, 1.6); c.moved = true; }
    }
    if (c.moved) { c.walkT += dt * 10; const s = Math.sin(c.walkT) * 0.6; c.legs[0].rotation.x = s; c.legs[1].rotation.x = -s; c.legs[2].rotation.x = -s; c.legs[3].rotation.x = s; }
    else { for (const l of c.legs) l.rotation.x *= 0.8; }
    c.tail.rotation.z = Math.sin((c.walkT || 0) * 0.5) * 0.25;
  }
}

// ---------- COMBAT ----------
function aimEntity() {
  const targets = []; for (const m of monsters) if (!m.dead) targets.push(m.g); if (fireBoss) targets.push(fireBoss.g); if (dragon && !dragon.dead) { targets.push(dragon.g); for (const cr of crystals) if (!cr.dead) targets.push(cr.g); }
  if (!targets.length) return null;
  ray.setFromCamera(ctr, camera); ray.far = 7;
  const h = ray.intersectObjects(targets, true); if (!h.length) return null;
  let o = h[0].object; while (o && !o.userData.ref && o.parent) o = o.parent;
  return { obj: h[0].object, point: h[0].point, dist: h[0].distance };
}
let attackCd = 0;
function attackEntity(hit) {
  if (attackCd > 0) return; attackCd = 0.35; swing = 1;
  const tool = currentTool(); let dmg = ((tool && tool.dmg) ? tool.dmg : 1) + swordBonus;
  const crit = Math.random() < 0.15; if (crit) dmg *= 2;
  let o = hit.obj, ent = null; while (o) { if (o.userData.kind) { ent = o; break; } o = o.parent; }
  SFX.hit();
  if (ent && ent.userData.kind === "monster") {
    const m = ent.userData.m; m.hp -= dmg; m.flash = 0.15; m.bar.up(Math.max(0, m.hp / m.max)); if (!m.ghost) knock(m.g, 0.5);
    hitSpark(hit.point, m.elite ? 0xff66ff : 0xff5577); dmgNumber(hit.point, dmg, crit);
    if (tool && tool.special === "fire") { m.burn = 3; m.burnTick = 0; }                       // Flame Sword: burn over time
    if (tool && tool.special === "lightning" && hammerCd <= 0) { hammerCd = 2.2; lightningZap(); } // Lightning Hammer: chain shock
    if (m.hp <= 0 && !m.dead) killMonster(m);
  }
  else if (ent && ent.userData.kind === "crystal") { const c = ent.userData.c; c.hp -= dmg; hitSpark(hit.point, 0x22d3ee); dmgNumber(hit.point, dmg, crit); if (c.hp <= 0 && !c.dead) { c.dead = true; scene.remove(c.g); crystalsLeft--; updateBoss(); } }
  else if (ent && ent.userData.kind === "dragon") { if (crystalsLeft > 0) { hitSpark(hit.point, 0x888888); toast("Destroy the End Crystals first"); return; } dragon.hp -= dmg; updateBoss(); hitSpark(hit.point, 0xb026ff); dmgNumber(hit.point, dmg, crit); if (dragon.hp <= 0 && !dragon.dead) winDragon(); }
}
function knock(g, f) { const dx = g.position.x - player.pos.x, dz = g.position.z - player.pos.z, d = Math.hypot(dx, dz) || 1; g.position.x += dx / d * f; g.position.z += dz / d * f; }
// central monster death: loot, xp, quest hook, and a power-up chance from elites
function killMonster(m) {
  if (m.dead) return; m.dead = true;
  for (const [lid, lc, lp] of (m.loot || [])) if (Math.random() < (m.elite ? Math.min(1, lp + 0.3) : lp)) addItem(lid, lc);
  if (m.elite) { addItem(I_APPLE, 1); if (Math.random() < 0.55) givePowerup(randPowerup()); }
  addXP(m.xp || 10); onKill();
}
// Lightning Hammer chain shock: damages every monster near Thomas with a cooldown
let hammerCd = 0;
function lightningZap() {
  let hits = 0;
  for (const m of monsters) {
    if (m.dead) continue;
    if (m.g.position.distanceTo(player.pos) < 7.5) {
      const d2 = 12 + swordBonus * 2; m.hp -= d2; m.flash = 0.15; m.bar.up(Math.max(0, m.hp / m.max));
      hitSpark(m.g.position, 0x7afcff); dmgNumber(m.g.position, d2, false); lightningBolt(m.g.position); hits++;
      if (m.hp <= 0 && !m.dead) killMonster(m);
    }
  }
  SFX.zap(); addShake(0.22);
  if (hits) toast("⚡ Lightning Hammer struck " + hits + (hits > 1 ? " monsters" : " monster"));
}
function lightningBolt(p) {
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); m.position.set(p.x + (Math.random() - .5) * 0.5, p.y + 0.5 + i * 0.4, p.z + (Math.random() - .5) * 0.5); scene.add(m); fxParts.push({ mesh: m, life: 0.25, vel: new THREE.Vector3((Math.random() - .5) * 2, 2, (Math.random() - .5) * 2) }); }
}
// floating damage numbers
const _proj = new THREE.Vector3();
function dmgNumber(pos, amount, crit) {
  _proj.copy(pos).project(camera); if (_proj.z > 1) return;
  const el = document.createElement("div"); el.className = "dmgNum" + (crit ? " crit" : "");
  el.textContent = Math.round(amount) + (crit ? "!" : "");
  el.style.left = (( _proj.x * 0.5 + 0.5) * innerWidth) + "px"; el.style.top = ((-_proj.y * 0.5 + 0.5) * innerHeight) + "px";
  document.getElementById("dmg").appendChild(el); setTimeout(() => el.remove(), 750);
}
// spitter projectiles
const projectiles = [];
const projGeo = new THREE.SphereGeometry(0.18, 8, 8);
const projMat = new THREE.MeshBasicMaterial({ color: 0xc026ff });
function spawnProjectile(from, to) {
  if (projectiles.length > 30) return;
  const m = new THREE.Mesh(projGeo, projMat); m.position.set(from.x, from.y + 1.4, from.z); scene.add(m);
  const dir = new THREE.Vector3(to.x - from.x, (to.y + 1) - (from.y + 1.4), to.z - from.z).normalize();
  projectiles.push({ mesh: m, vel: dir.multiplyScalar(11), life: 3 });
}
function updateProjectiles(dt) {
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.vel, dt);
    const ground = isSolidBlock(getBlock(Math.floor(p.mesh.position.x), Math.floor(p.mesh.position.y), Math.floor(p.mesh.position.z)));
    const near = p.mesh.position.distanceTo(eye) < 1.0;
    if (near) { damage(5); addShake(0.12); }
    if (near || ground || p.life <= 0) { scene.remove(p.mesh); projectiles.splice(i, 1); }
  }
}
const fxParts = [];
function hitSpark(p, col) { for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(p); scene.add(m); fxParts.push({ mesh: m, life: 0.3, vel: new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 4, (Math.random() - .5) * 4) }); } }
function updateFx(dt) { for (let i = fxParts.length - 1; i >= 0; i--) { const p = fxParts[i]; p.life -= dt; p.vel.y -= 9 * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.scale.multiplyScalar(1 - dt * 2.5); if (p.life <= 0) { scene.remove(p.mesh); fxParts.splice(i, 1); } } }
// tag entity meshes after spawn (so raycast finds kind)
function tagMonsters() { for (const m of monsters) m.g.traverse(o => { o.userData.kind = "monster"; o.userData.m = m; }); }

// ---------- VIEWMODEL ----------
let viewItem = null, swing = 0;
function buildViewItem() {
  if (viewItem) vScene.remove(viewItem);
  const g = new THREE.Group(); const it = hotbar[selSlot];
  if (it && isItem(it.id)) {
    if (ITEMS[it.id].tool === "sword") { const blade = box(0.06, 0.5, 0.06, ITEMS[it.id].special === "fire" ? 0xff7a2a : 0xd7dbe4); blade.position.y = 0.3; g.add(blade); const gu = box(0.2, 0.05, 0.08, 0xc9a227); gu.position.y = 0.05; g.add(gu); }
    else if (ITEMS[it.id].tool === "hammer") { const head = box(0.26, 0.2, 0.18, 0x6fb7ff); head.position.y = 0.36; g.add(head); const trim = box(0.28, 0.06, 0.2, 0xffe066); trim.position.y = 0.36; g.add(trim); const stick = box(0.05, 0.36, 0.05, 0x6e4a25); stick.position.y = 0.12; g.add(stick); }
    else { const head = box(0.18, 0.1, 0.06, 0x9b9b9b); head.position.y = 0.34; g.add(head); const stick = box(0.05, 0.34, 0.05, 0x6e4a25); stick.position.y = 0.12; g.add(stick); }
    g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.4, -0.3, 0.25);
  } else if (it) {
    const c = BLOCKS[it.id]; const cube = box(0.32, 0.32, 0.32, new THREE.Color(c.top[0], c.top[1], c.top[2]).getHex()); g.add(cube); g.position.set(0.42, -0.4, -0.7); g.rotation.set(-0.4, 0.5, 0);
  } else { const fist = box(0.18, 0.2, 0.2, 0xd9a06b); g.add(fist); g.position.set(0.4, -0.42, -0.7); g.rotation.set(-0.3, 0, 0); }
  viewItem = g; vScene.add(g);
}
function box(w, h, d, col) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); }
function updateViewItem(dt) { if (!viewItem) return; if (swing > 0) swing = Math.max(0, swing - dt * 4); const s = Math.sin(swing * Math.PI); const it = hotbar[selSlot]; if (it && isItem(it.id) && ITEMS[it.id].tool === "sword") { viewItem.rotation.x = -0.4 - s * 1.3; viewItem.rotation.z = 0.25 + s * 0.5; } else { viewItem.rotation.x = -0.4 - s * 0.7; viewItem.position.y = -0.4 - s * 0.08; } }

// ---------- INTERACT (use) ----------
function interact() {
  // open a chest if aiming at one
  const look = voxelRaycast(4);
  if (look && look.id === CHEST) { openChest(chestKey(look.x, look.y, look.z)); return; }
  // sleep in a bed to skip the night
  if (look && look.id === BED) {
    player.spawn.set(look.x + 0.5, look.y + 1, look.z + 0.5);
    if (isNight()) { timeOfDay = 0.28; survivedNight = true; player.hp = Math.min(player.maxHp, player.hp + 6); updateVitals(); toast("You slept. A new day begins."); SFX.levelUp(); }
    else toast("You can only sleep at night. Respawn point set.");
    return;
  }
  // eat food if selected
  const it = hotbar[selSlot];
  if (it && isItem(it.id) && ITEMS[it.id].food) { if (player.food < 20) { player.food = Math.min(20, player.food + ITEMS[it.id].food); removeItem(selSlot, 1); updateVitals(); toast("Ate " + ITEMS[it.id].name); } return; }
  // tame nearby cat by feeding apple
  let near = null, nd = 3; for (const c of cats) { const d = c.g.position.distanceTo(player.pos); if (d < nd) { nd = d; near = c; } }
  if (near && !near.tamed) {
    if (near.friendly || countItem(I_APPLE) > 0) {
      if (!near.friendly) consumeItem(I_APPLE, 1);
      near.tamed = true; near.friendly = false; near.mode = "follow"; SFX.meow();
      const who = near.name ? near.name : ("The " + near.color + " cat");
      toast(who + " joined you and " + catAbilityDesc(near.ability) + ".");
      if (near.name) { showBanner(near.name + " joined Thomas!"); questComplete("New Companion. " + near.name); }
      onTame();
    } else toast("Need an Apple to tame the cat (you start with a few).");
    return;
  }
  // set respawn at current spot
  player.spawn.copy(player.pos); toast("Respawn point set");
}
function catCommand() {
  let near = null, nd = 6; for (const c of cats) if (c.tamed) { const d = c.g.position.distanceTo(player.pos); if (d < nd) { nd = d; near = c; } }
  if (!near) { toast("No tamed cat nearby to command"); return; }
  if (near.mode === "follow") { near.mode = "stay"; near.stay.set(near.g.position.x, 0, near.g.position.z); toast(near.color + " cat will stay here"); }
  else { near.mode = "follow"; toast(near.color + " cat will follow you"); }
  SFX.meow();
}

// ---------- DAY / NIGHT ----------
let timeOfDay = 0.28, day = 1; const sunDir = new THREE.Vector3(0.5, 0.8, 0.3);
function isNight() { return timeOfDay > 0.78 || timeOfDay < 0.22; }
const SKY = { dayTop: new THREE.Color(0x2a6fd0), dayBot: new THREE.Color(0xcfeaff), setTop: new THREE.Color(0x3a3a6e), setBot: new THREE.Color(0xff8a4a), nightTop: new THREE.Color(0x04050d), nightBot: new THREE.Color(0x122038) };
function updateDayNight(dt) {
  timeOfDay += dt / 180; if (timeOfDay >= 1) { timeOfDay -= 1; day++; }
  const ang = timeOfDay * Math.PI * 2 - Math.PI / 2;
  const sh = Math.sin(ang);                                  // true sun height -1..1
  sunDir.set(Math.cos(ang) * 0.85, sh, 0.32).normalize();
  if (sh >= 0) lightDir.copy(sunDir);                        // sun by day
  else lightDir.set(-sunDir.x, Math.max(0.28, -sh * 0.7 + 0.25), -sunDir.z).normalize(); // moon by night
  if (DIM === "overworld") {
    const dayF = THREE.MathUtils.clamp((sh - 0.04) / 0.3, 0, 1);
    const nightF = THREE.MathUtils.clamp((-sh - 0.02) / 0.18, 0, 1);
    const setF = THREE.MathUtils.clamp(1 - Math.abs(sh) / 0.2, 0, 1);
    const top = SKY.nightTop.clone().lerp(SKY.dayTop, dayF).lerp(SKY.setTop, setF * 0.5);
    const bot = SKY.nightBot.clone().lerp(SKY.dayBot, dayF).lerp(SKY.setBot, setF * 0.7);
    skyUni.topC.value.copy(top); skyUni.botC.value.copy(bot);
    scene.background = null; if (scene.fog) scene.fog.color.copy(bot);
    sunSpr.position.set(sunDir.x * 380, sunDir.y * 380, sunDir.z * 380);
    moonSpr.position.set(-sunDir.x * 380, -sunDir.y * 380, -sunDir.z * 380);
    sunSpr.material.opacity = THREE.MathUtils.clamp(sh * 2 + 0.25, 0, 1);
    moonSpr.material.opacity = THREE.MathUtils.clamp(-sh * 2 + 0.2, 0, 1);
    starMat.opacity = THREE.MathUtils.clamp(-sh * 3 + 0.1, 0, 1) * 0.9;
    cloudMat.opacity = 0.5 * dayF + 0.12;
    if (sh >= 0) { sun.color.setHex(setF > 0.55 ? 0xffc69a : 0xfff4e0); sun.intensity = 0.28 + dayF * 0.95; }
    else { sun.color.setHex(0x8aa2dc); sun.intensity = 0.22; }
    hemi.color.setHex(0xbfe3ff); hemi.groundColor.setHex(0x4a4030);
    hemi.intensity = 0.22 + dayF * 0.55 + nightF * 0.08;
  }
  const phase = sh < 0 ? "Night" : (timeOfDay < 0.32 ? "Dawn" : timeOfDay < 0.5 ? "Morning" : timeOfDay < 0.7 ? "Afternoon" : "Dusk");
  document.getElementById("clockBig").textContent = "Day " + day;
  document.getElementById("clockSub").textContent = phase;
}

// ---------- PORTALS + DIMENSIONS ----------
let dragon = null, crystals = [], crystalsLeft = 0;
function buildPortalFrame(cx, baseY, z, dir) { // dir: 'x' plane
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 4; dy++) {
    const edge = dx === -1 || dx === 2 || dy === -1 || dy === 4;
    setRaw(cx + dx, baseY + dy, z, edge ? COBBLE : PORTAL);
  }
  rebuildPortalCells();
  for (let i = -2; i <= 3; i++) markDirty(cx + i, z);
}
let portalCd = 0;
function checkPortal() {
  if (portalCd > 0) return;
  const at = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z));
  const at2 = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1), Math.floor(player.pos.z));
  if (at === PORTAL || at2 === PORTAL) {
    portalCd = 2;
    const next = DIM === "overworld" ? "fire" : DIM === "fire" ? "end" : "overworld";
    transitionTo(next);
  }
}
function transitionTo(name) {
  SFX.portal(); const fade = document.getElementById("fade"); fade.style.opacity = "1";
  setTimeout(() => { loadDimension(name); fade.style.opacity = "0"; }, 520);
}
function clearEntities() { for (const m of monsters) scene.remove(m.g); for (const c of cats) scene.remove(c.g); for (const m of mice) scene.remove(m.g); monsters = []; cats = []; mice = []; for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0; if (dragon) { scene.remove(dragon.g); dragon = null; } if (fireBoss) { scene.remove(fireBoss.g); fireBoss = null; } for (const c of crystals) scene.remove(c.g); crystals = []; if (typeof clearTelegraphs === "function") clearTelegraphs(); hideBoss(); }
function loadDimension(name, fromSave) {
  DIM = name; clearWorld(); clearEntities();
  if (name === "fire") achieve("firep", "Fire Portal Opened");
  if (name === "end") achieve("endp", "End Portal Opened");
  player.pos.set(0.5, 50, 0.5); player.vel.set(0, 0, 0);
  gravity = name === "end" ? 16 : 28; jumpV = name === "end" ? 8.4 : 9.2;     // low gravity end
  if (name === "overworld") { for (let i = 0; i < 3; i++) spawnCat((Math.random() * 20 - 10) | 0, (Math.random() * 20 - 10) | 0); for (let i = 0; i < 8; i++) spawnMouse((Math.random() * 30 - 15) | 0, (Math.random() * 30 - 15) | 0); }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) buildChunk(dx, dz);
  if (!fromSave) { player.pos.y = surfaceY(0, 0) + 1; player.spawn.copy(player.pos); }
  // dimension setup
  if (name === "overworld") { scene.fog = new THREE.Fog(0x9fd2ff, 20, GFX[settings.gfx].dist * CH); hemi.color.set(0xbfe3ff); sun.color.set(0xffffff); showBanner("Overworld"); buildPortalFrame(8, surfaceY(8, 0), 0, "x"); setQuest("Step through the purple portal to the Fire Dimension"); }
  else if (name === "fire") { scene.background = new THREE.Color(0x2a0808); scene.fog = new THREE.Fog(0x551111, 8, 40); hemi.color.set(0xff7a3a); hemi.intensity = 0.6; sun.intensity = 0.5; sun.color.set(0xff8a4a); showBanner("Fire Dimension"); clearFirePad(0, 0); if (fireBossDown) { buildPortalFrame(0, surfaceY(0, -8), -8, "x"); setRaw(0, surfaceY(0, -8) + 1, -8, PORTAL); setQuest("Enter the portal to reach the End"); } else { spawnFireBoss(); setQuest("Defeat the Fire Guardian. A Flame Charm will protect you from the heat"); } }
  else { scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 30, 120); hemi.color.set(0xffffff); hemi.intensity = 0.9; sun.intensity = 0.7; sun.color.set(0xeae6ff); showBanner("The End"); buildEndDragon(); setQuest("Destroy the End Crystals, then slay the Black Dragon"); }
  // replay player block edits, then rebuild special blocks
  const ed = editsByDim[name]; if (ed) for (const [k, id] of ed) { const p = k.split(",").map(Number); setRaw(p[0], p[1], p[2], id); }
  remeshAll(); rebuildPortalCells(); rebuildTorchCells();
  loadChunks(); updateVitals(); renderHotbar();
}
// Fire dim: a teal portal to the End plus a simple fire guardian mini boss (TODO full fire boss with phases)
function buildEndPortalFire() { /* placed after boss death */ }
let fireBoss = null;
function clearFirePad(sx, sz) {
  for (let ddx = -1; ddx <= 1; ddx++) for (let ddz = -1; ddz <= 1; ddz++) {
    const yy = surfaceY(sx + ddx, sz + ddz);
    for (let k = 0; k < 3; k++) if (getBlock(sx + ddx, yy + k, sz + ddz) === LAVA) setRaw(sx + ddx, yy + k, sz + ddz, AIR);
    setRaw(sx + ddx, yy - 1, sz + ddz, FIRESTONE);
  }
}
function spawnFireBoss() {
  const g = new THREE.Group();
  const mat = (c, em) => new THREE.MeshLambertMaterial({ color: c, emissive: em != null ? em : 0x5a1400, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.4), mat(0xff4a14)); body.position.y = 1.5; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.0), mat(0xff6a2a)); head.position.y = 2.9; g.add(head);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffe14d, emissive: 0xffe14d });
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.1), eyeMat); e1.position.set(-0.28, 3.0, 0.5); g.add(e1);
  const e2 = e1.clone(); e2.position.x = 0.28; g.add(e2);
  const hMat = mat(0x3a0a00, 0x200500);
  const hL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), hMat); hL.position.set(-0.4, 3.6, 0); hL.rotation.z = 0.4; g.add(hL);
  const hR = hL.clone(); hR.position.x = 0.4; hR.rotation.z = -0.4; g.add(hR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), mat(0xff5a1e)); armL.geometry.translate(0, -0.6, 0); armL.position.set(-1.1, 2.5, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 1.1; g.add(armR);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), new THREE.MeshLambertMaterial({ color: 0xffb02a, emissive: 0xff7a1e })); const a = i / 5 * 6.28; c.position.set(Math.cos(a) * 0.5, 3.5, Math.sin(a) * 0.5); g.add(c); }
  clearFirePad(0, 6);
  g.position.set(0.5, surfaceY(0, 6) + 0.1, 6.5); scene.add(g);
  const maxHp = 220;
  fireBoss = { g, hp: maxHp, max: maxHp, touch: 0, atkCd: 2.5, slamCd: 4, summonCd: 9, windup: 0, phase: 1, intro: 2.6, armL, armR, body, flash: 0 };
  bossIntro("FIRE GUARDIAN", "Heat radiates from its core. Strike when the rings flash.");
  g.traverse(o => { o.userData.kind = "monster"; o.userData.m = { get hp() { return fireBoss.hp; }, set hp(v) { fireBoss.hp = v; }, get max() { return fireBoss.max; }, set flash(v) { if (fireBoss) fireBoss.flash = v; }, get flash() { return fireBoss ? fireBoss.flash : 0; }, bar: { up: () => {} }, get dead() { return !fireBoss || fireBoss.hp <= 0; }, get ghost() { return false; }, g } });
  showBoss("FIRE GUARDIAN", 1);
}
function updateFireBoss(dt) {
  if (!fireBoss) return;
  const fb = fireBoss;
  if (fb.flash > 0) fb.flash -= dt;
  if (fb.body && fb.body.material.emissive) fb.body.material.emissive.setHex(fb.flash > 0 ? 0xffffff : (fb.phase === 3 ? 0x8a1400 : 0x5a1400));
  const frac = fb.hp / fb.max, phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (phase !== fb.phase) { fb.phase = phase; SFX.growl(); toast(phase === 3 ? "The Fire Guardian enrages" : "The Fire Guardian grows stronger"); if (phase === 3) fb.body.material.color.setHex(0xff2a00); }
  showBoss("FIRE GUARDIAN" + (phase === 3 ? " (ENRAGED)" : ""), Math.max(0, frac));
  const dx = player.pos.x - fb.g.position.x, dz = player.pos.z - fb.g.position.z, d = Math.hypot(dx, dz) || 0.001;
  const spd = phase === 3 ? 2.8 : 1.7;
  if (fb.intro > 0 && fb.hp > 0) { fb.intro -= dt; fb.g.rotation.y = Math.atan2(dx, dz); fb.g.position.y = surfaceY(fb.g.position.x, fb.g.position.z); return; }  // cinematic entrance grace
  if (fb.windup > 0) {                                       // ground slam telegraph
    fb.windup -= dt; fb.armL.rotation.x = -1.4; fb.armR.rotation.x = -1.4; fb.g.rotation.y = Math.atan2(dx, dz);
    if (fb.windup <= 0) {
      SFX.slam(); addShake(0.6); if (d < 4) { damage(10); const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.8); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; spawnProjectile(fb.g.position, { x: fb.g.position.x + Math.cos(a) * 4, y: player.pos.y, z: fb.g.position.z + Math.sin(a) * 4 }); } // shockwave
      fb.armL.rotation.x = 0; fb.armR.rotation.x = 0; fb.slamCd = phase === 3 ? 3 : 5;
    }
  } else {
    if (d > 3) { fb.g.position.x += dx / d * spd * dt; fb.g.position.z += dz / d * spd * dt; }
    fb.g.rotation.y = Math.atan2(dx, dz); fb.g.position.y = surfaceY(fb.g.position.x, fb.g.position.z);
    fb.touch -= dt; if (d < 2.4 && fb.touch <= 0) { damage(8); fb.touch = 1; }
    fb.atkCd -= dt; if (fb.atkCd <= 0) { fb.atkCd = phase === 3 ? 1.0 : 2.2; const volley = phase === 3 ? 3 : 1; for (let i = 0; i < volley; i++) { const off = (i - (volley - 1) / 2) * 2; spawnProjectile(fb.g.position, { x: player.pos.x + off, y: player.pos.y, z: player.pos.z }); } }
    if (phase >= 2) { fb.slamCd -= dt; if (fb.slamCd <= 0 && d < 6) { fb.windup = 0.7; SFX.growl(); spawnTelegraph(player.pos.x, player.pos.z, 4, 0.7); } }
    if (phase >= 2) { fb.summonCd -= dt; if (fb.summonCd <= 0 && monsters.length < 8) { fb.summonCd = 12; for (let s = 0; s < 2; s++) { const a = Math.random() * 6.28; spawnMonster(Math.floor(fb.g.position.x + Math.cos(a) * 3), Math.floor(fb.g.position.z + Math.sin(a) * 3), "lavaworm"); } toast("The Guardian summons lava worms"); } }
    fb.armL.rotation.x = Math.sin(performance.now() * 0.005) * 0.3; fb.armR.rotation.x = -fb.armL.rotation.x;
  }
  if (fb.hp <= 0) {
    hitSpark(fb.g.position, 0xff7a1e); for (let i = 0; i < 4; i++) hitSpark({ x: fb.g.position.x + (Math.random() - .5) * 2, y: fb.g.position.y + 1, z: fb.g.position.z + (Math.random() - .5) * 2 }, 0xffb02a);
    scene.remove(fb.g); fireBoss = null; hideBoss();
    toast("Fire Guardian defeated. The path to the End opens.");
    addItem(FIRE_CRYSTAL, 6); addItem(I_FIRECHARM, 1); addXP(120);
    buildPortalFrame(0, surfaceY(0, -8), -8, "x"); setRaw(0, surfaceY(0, -8) + 1, -8, PORTAL); rebuildPortalCells();
    setQuest("Enter the portal to reach the End"); onFireBoss();
  }
}
// End dim: dragon + crystals
function buildEndDragon() {
  const g = new THREE.Group();
  const mat = (em) => new THREE.MeshLambertMaterial({ color: 0x121218, emissive: em != null ? em : 0x08040e, emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 4.2), mat()); g.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.4), mat()); neck.position.set(0, 0.5, 2.8); g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.3), mat()); head.position.set(0, 0.8, 3.8); g.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 1.0), mat()); jaw.position.set(0, 0.32, 4.0); g.add(jaw);
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), new THREE.MeshLambertMaterial({ color: 0xb026ff, emissive: 0xb026ff })); eL.position.set(-0.34, 1.05, 4.3); g.add(eL); const eR = eL.clone(); eR.position.x = 0.34; g.add(eR);
  const hMat = mat(0x05030a);
  const hoL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), hMat); hoL.position.set(-0.32, 1.5, 3.7); hoL.rotation.z = 0.4; g.add(hoL); const hoR = hoL.clone(); hoR.position.x = 0.32; hoR.rotation.z = -0.4; g.add(hoR);
  const wL = new THREE.Group(); const memL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 2.4), mat(0x100018)); memL.position.set(-2.2, 0, 0); wL.add(memL); wL.position.set(-0.7, 0.6, 0); g.add(wL);
  const wR = new THREE.Group(); const memR = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 2.4), mat(0x100018)); memR.position.set(2.2, 0, 0); wR.add(memR); wR.position.set(0.7, 0.6, 0); g.add(wR);
  const tail = []; for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.9 - i * 0.18, 0.9 - i * 0.18, 1.0), mat()); t.position.set(0, 0, -2.4 - i * 0.9); g.add(t); tail.push(t); }
  const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4); for (const lx of [-0.6, 0.6]) for (const lz of [1.2, -1.2]) { const l = new THREE.Mesh(legGeo, mat()); l.position.set(lx, -1.0, lz); g.add(l); }
  g.position.set(0, 30, -16); scene.add(g);
  dragon = { g, hp: 240, max: 240, t: 0, swoop: 0, wL, wR, head, tail, dead: false, fall: 0, touch: 0, breatheCd: 3, summonCd: 12, phase: 1 };
  bossIntro("BLACK DRAGON", "Destroy the four End Crystals, then strike.");
  g.traverse(o => { o.userData.kind = "dragon"; });
  crystals = []; const pts = [[12, 0], [-12, 0], [0, 12], [0, -12]];
  for (const p of pts) { for (let y = 17; y <= 19; y++) setRaw(p[0], y, p[1], COBBLE); const cg = new THREE.Group(); const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshLambertMaterial({ color: 0xa6f1ff, emissive: 0x1d7d92 })); cg.add(oct); cg.position.set(p[0] + 0.5, 21.5, p[1] + 0.5); scene.add(cg); const c = { g: cg, hp: 10, dead: false }; cg.traverse(o => { o.userData.kind = "crystal"; o.userData.c = c; }); crystals.push(c); }
  crystalsLeft = crystals.length; remeshAll();
  showBoss("BLACK DRAGON", 1);
}
function updateDragon(dt) {
  if (!dragon) return;
  const fb = dragon, g = fb.g;
  for (const c of crystals) if (!c.dead) { c.g.rotation.y += dt * 1.5; c.g.position.y = 21.5 + Math.sin(fb.t * 2 + c.g.position.x) * 0.3; }
  if (fb.dead) { fb.fall += dt; g.position.y -= (fb.fall * 4 + 2) * dt; g.rotation.z += dt * 3; g.rotation.x += dt * 1.5; g.scale.multiplyScalar(Math.max(0.001, 1 - dt * 0.4)); return; }
  fb.t += dt;
  const flap = Math.sin(fb.t * 6) * 0.6; fb.wL.rotation.z = -flap; fb.wR.rotation.z = flap;
  for (let i = 0; i < fb.tail.length; i++) fb.tail[i].rotation.y = Math.sin(fb.t * 2 - i * 0.5) * 0.2;
  const engaged = crystalsLeft === 0, frac = fb.hp / fb.max, phase = !engaged ? 0 : frac > 0.5 ? 1 : frac > 0.3 ? 2 : 3;
  if (phase !== fb.phase && phase > 0) { fb.phase = phase; SFX.growl(); if (phase === 3) toast("The Black Dragon roars in fury"); }
  const speed = phase >= 3 ? 2.6 : phase >= 2 ? 1.9 : 1.4;
  let tx = Math.cos(fb.t * 0.5) * 16, tz = Math.sin(fb.t * 0.5) * 16, ty = (engaged ? 24 : 30) + Math.sin(fb.t * 0.8) * 2;  // circle high until crystals fall
  fb.swoop -= dt;
  if (engaged && fb.swoop <= 0 && Math.random() < (phase >= 3 ? 0.02 : 0.008)) { fb.swoop = 2.4; spawnTelegraph(player.pos.x, player.pos.z, 3, 0.9, 0xb026ff); }
  if (fb.swoop > 0) { tx = player.pos.x; tz = player.pos.z; ty = player.pos.y + 2.5; }                                  // swoop/dive
  g.position.x += (tx - g.position.x) * Math.min(1, dt * speed);
  g.position.z += (tz - g.position.z) * Math.min(1, dt * speed);
  g.position.y += (ty - g.position.y) * Math.min(1, dt * 1.8);
  g.rotation.y = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z);
  fb.touch -= dt; if (g.position.distanceTo(camera.position) < 4 && fb.touch <= 0) { damage(phase >= 3 ? 8 : 6); fb.touch = 1; addShake(0.2); }
  if (engaged) {
    fb.breatheCd -= dt; if (fb.breatheCd <= 0) { fb.breatheCd = phase >= 3 ? 1.4 : 2.6; const volley = phase >= 3 ? 3 : 1; for (let i = 0; i < volley; i++) { const off = (i - (volley - 1) / 2) * 2; spawnProjectile({ x: g.position.x, y: g.position.y, z: g.position.z }, { x: player.pos.x + off, y: player.pos.y, z: player.pos.z }); } }
    if (phase >= 3) { fb.summonCd -= dt; if (fb.summonCd <= 0 && monsters.length < 6) { fb.summonCd = 14; const a = Math.random() * 6.28; spawnMonster(Math.floor(player.pos.x + Math.cos(a) * 6), Math.floor(player.pos.z + Math.sin(a) * 6), "endstalker"); toast("The Dragon summons a shadow"); } }
  }
}
function winDragon() {
  dragon.dead = true; hideBoss(); achieve("dragon", "Dragon Defeated"); addXP(150); addShake(0.6); toast("The Black Dragon falls.");
  for (let i = 0; i < 12; i++) hitSpark({ x: dragon.g.position.x + (Math.random() - .5) * 4, y: dragon.g.position.y + (Math.random() - .5) * 3, z: dragon.g.position.z + (Math.random() - .5) * 4 }, 0xb026ff);
  setTimeout(() => { running = false; document.exitPointerLock(); hide("touch"); document.getElementById("hud").classList.add("hidden"); show("win"); }, 2200);
}

// ---------- BOSS POLISH (cinematic intro, telegraph warning zones, music cue) ----------
function bossActive() { return (typeof fireBoss !== "undefined" && fireBoss) || (typeof dragon !== "undefined" && dragon && !dragon.dead); }
function bossIntro(name, sub) {
  cine(name); showBanner(name); addShake(0.3); SFX.screech();
  setTimeout(() => { const cap = $("cineCap"); if (cap && sub) { cap.textContent = sub; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); } }, 1200);
  setTimeout(endCine, 2800);
}
// flat ground rings that flash where a heavy attack will land, so hits are readable
const telegraphs = [];
function spawnTelegraph(x, z, radius, dur, color) {
  const geo = new THREE.RingGeometry(radius * 0.82, radius, 28);
  const mat = new THREE.MeshBasicMaterial({ color: color || 0xff3b3b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, surfaceY(x, z) + 0.06, z); scene.add(m);
  telegraphs.push({ mesh: m, life: dur, max: dur });
}
function updateTelegraphs(dt) {
  for (let i = telegraphs.length - 1; i >= 0; i--) {
    const t = telegraphs[i]; t.life -= dt; const f = 1 - Math.max(0, t.life) / t.max;
    t.mesh.scale.setScalar(0.5 + f * 0.7);
    if (t.mesh.material) t.mesh.material.opacity = 0.25 + 0.5 * Math.abs(Math.sin(t.life * 14));
    if (t.life <= 0) { scene.remove(t.mesh); if (t.mesh.geometry && t.mesh.geometry.dispose) t.mesh.geometry.dispose(); telegraphs.splice(i, 1); }
  }
}
function clearTelegraphs() { for (const t of telegraphs) scene.remove(t.mesh); telegraphs.length = 0; }

// ---------- QUESTS (Thomas main story) ----------
const quests = [
  { id: "wake", title: "Wake Up, Thomas", text: "Wake up. Move with WASD or the joystick", done: () => movedDist > 3 },
  { id: "wood", title: "Gather Wood", text: "Break trees for 4 Wood", done: () => countItem(WOOD) >= 4 || craftedPlanks },
  { id: "craft", title: "Craft Your First Tool", text: "Open the Bag and craft a Wood Pickaxe", done: () => craftedPick },
  { id: "shelter", title: "Build Shelter", text: "Place 8 blocks to start a shelter", done: () => placedBlocks >= 8 },
  { id: "cat", title: "Find the Lost Cat", text: "Find a cat and tame it with an Apple", done: () => tamedCat },
  { id: "night", title: "Survive the First Night", text: "Survive until morning", done: () => survivedNight },
  { id: "kill", title: "Follow the Purple Trail", text: "Defeat 3 purple monsters", done: () => kills >= 3 },
  { id: "fire", title: "Enter the Fire Dimension", text: "Find the portal and enter the Fire Dimension", done: () => DIM === "fire" || DIM === "end" },
  { id: "fireboss", title: "Defeat the Fire Boss", text: "Defeat the Fire guardian", done: () => fireBossDown },
  { id: "end", title: "Enter the End", text: "Step into the End portal", done: () => DIM === "end" },
  { id: "dragon", title: "Defeat the Black Dragon", text: "Destroy the crystals and slay the Black Dragon", done: () => false }
];
let qi = 0, craftedPlanks = false, craftedPick = false, minedStone = 0, survivedNight = false, tamedCat = false, kills = 0, fireBossDown = false, tameCount = 0;
const sideQuests = [
  { id: "slayer", title: "Beast Slayer", text: "Defeat 10 purple monsters", prog: () => Math.min(kills, 10) + "/10", done: () => kills >= 10, reward: () => { addXP(40); addItem(I_APPLE, 2); } },
  { id: "friend", title: "Cat Friend", text: "Tame 3 cats", prog: () => Math.min(tameCount, 3) + "/3", done: () => tameCount >= 3, reward: () => { addXP(50); } },
  { id: "spelunker", title: "Spelunker", text: "Mine 20 stone or cobblestone", prog: () => Math.min(minedStone, 20) + "/20", done: () => minedStone >= 20, reward: () => { addXP(40); addItem(COBBLE, 8); } }
];
const sideDone = new Set();
function updateSideQuests() { for (const s of sideQuests) if (!sideDone.has(s.id) && s.done()) { sideDone.add(s.id); s.reward(); questComplete("Side Quest. " + s.title); } }
function setQuest(t) { document.getElementById("questText").textContent = t; }
function questComplete(t) { const p = document.getElementById("questPop"); p.innerHTML = '<div class="qc">QUEST COMPLETE</div><div class="qn">' + t + '</div>'; p.classList.remove("show"); void p.offsetWidth; p.classList.add("show"); SFX.levelUp(); addShake(0.08); }
function updateQuests() {
  updateSideQuests();
  if (qi >= quests.length) return;
  const q = quests[qi];
  if (q.done()) { questComplete(q.title); addXP(25); qi++; }
  if (qi < quests.length && DIM === "overworld") setQuest(quests[qi].text);
}
function onCollect(id) {}
function onCraft(out) { if (out === PLANKS) craftedPlanks = true; if (out === I_WPICK) { craftedPick = true; achieve("tool", "First Tool Crafted"); } }
function onMine(id) { if (id === STONE || id === COBBLE) minedStone++; achieve("block", "First Block Broken"); addXP(id === STONE || id === COBBLE ? 2 : 1); }
function onKill() { kills++; achieve("kill1", "First Monster Defeated"); addXP(10); }
function onTame() { tamedCat = true; tameCount++; achieve("cat", "First Cat Tamed"); if (tameCount >= 3) achieve("cathero", "Cat Hero"); }
function onFireBoss() { fireBossDown = true; achieve("fireb", "Fire Boss Defeated"); addXP(60); }

// ---------- UI ----------
const $ = id => document.getElementById(id);
function show(id) { $(id).classList.remove("hidden"); } function hide(id) { $(id).classList.add("hidden"); }
function toast(t) { const el = document.createElement("div"); el.className = "toastItem"; el.textContent = t; $("toast").appendChild(el); setTimeout(() => el.remove(), 2200); }
let bannerT = 0; function showBanner(t) { const b = $("banner"); b.textContent = t; b.style.opacity = "1"; bannerT = 2; }
function hurtFlash() { const h = $("hurt"); h.style.opacity = settings.reduceMotion ? "0.35" : "1"; setTimeout(() => h.style.opacity = "0", 120); }
function updateVitals() {
  const he = $("hearts"); he.innerHTML = ""; const maxHearts = Math.ceil(player.maxHp / 2); const full = Math.ceil(Math.max(0, player.hp) / 2);
  for (let i = 0; i < maxHearts; i++) { const d = document.createElement("div"); d.className = "pip heart" + (i < full ? "" : " empty"); d.textContent = "\u2665"; he.appendChild(d); }
  const fe = $("hunger"); fe.innerHTML = ""; const ff = Math.ceil(Math.max(0, player.food) / 2);
  for (let i = 0; i < 10; i++) { const d = document.createElement("div"); d.className = "pip food" + (i < ff ? "" : " empty"); d.textContent = "\u25C6"; fe.appendChild(d); }
  $("stamina").firstElementChild.style.width = (100 * player.stam / player.maxStam) + "%";
}
function colorHex(id) { if (isItem(id)) return null; const c = BLOCKS[id]; return "#" + new THREE.Color(c.top[0], c.top[1], c.top[2]).getHexString(); }
function renderHotbar() {
  const hb = $("hotbar"); hb.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const s = hotbar[i]; const slot = document.createElement("div"); slot.className = "slot" + (i === selSlot ? " active" : "");
    const n = document.createElement("div"); n.className = "n"; n.textContent = i + 1; slot.appendChild(n);
    if (s) { if (isItem(s.id)) { const ic = document.createElement("div"); ic.className = "ic"; ic.textContent = ITEMS[s.id].icon; slot.appendChild(ic); } else { const sw = document.createElement("div"); sw.className = "sw"; sw.style.background = colorHex(s.id); slot.appendChild(sw); } if (s.count > 1) { const ct = document.createElement("div"); ct.className = "ct"; ct.textContent = s.count; slot.appendChild(ct); } }
    slot.addEventListener("pointerdown", e => { e.preventDefault(); selectSlot(i); });
    hb.appendChild(slot);
  }
}
function renderInv() { const g = $("invGrid"); g.innerHTML = ""; for (let i = 0; i < 9; i++) { const s = hotbar[i]; const c = document.createElement("div"); c.className = "cell"; if (s) { if (isItem(s.id)) { const ic = document.createElement("div"); ic.className = "ic"; ic.textContent = ITEMS[s.id].icon; c.appendChild(ic); } else { const sw = document.createElement("div"); sw.className = "sw"; sw.style.background = colorHex(s.id); c.appendChild(sw); } if (s.count > 1) { const ct = document.createElement("div"); ct.className = "ct"; ct.textContent = s.count; c.appendChild(ct); } } g.appendChild(c); } }
function renderCraft() { const l = $("craftList"); l.innerHTML = ""; for (const r of RECIPES) { const ok = canCraft(r); const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no"); const need = r.need.map(([id, c]) => c + "x " + itemName(id)).join(", "); row.innerHTML = "<span>" + itemIcon(r.out) + " " + r.n + "x " + itemName(r.out) + "<br><span class='muted'>" + need + "</span></span>"; const b = document.createElement("button"); b.className = "mk"; b.textContent = "Make"; b.addEventListener("pointerdown", e => { e.preventDefault(); craft(r); }); row.appendChild(b); l.appendChild(row); } }
function toggleInv() { const el = $("inv"); if (el.classList.contains("hidden")) { renderInv(); renderCraft(); show("inv"); document.exitPointerLock(); } else { hide("inv"); if (!isTouch && running) canvas.requestPointerLock(); } }
function renderSkills() {
  const wrap = $("skillList"); if (!wrap) return; $("skillPts").textContent = skills.pts; wrap.innerHTML = "";
  for (const d of SKILLDEF) {
    const can = skills.pts > 0 && skills[d.k] < d.max;
    const row = document.createElement("div"); row.className = "craftRow" + (can ? "" : " no");
    row.innerHTML = "<span><b>" + d.name + "</b> " + skills[d.k] + "/" + d.max + "<br><span class='muted'>" + d.desc + "</span></span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = skills[d.k] >= d.max ? "MAX" : "+";
    b.addEventListener("pointerdown", e => { e.preventDefault(); spendSkill(d.k); });
    row.appendChild(b); wrap.appendChild(row);
  }
}
function toggleSkills() { const el = $("skills"); if (el.classList.contains("hidden")) { renderSkills(); show("skills"); document.exitPointerLock(); } else { hide("skills"); if (!isTouch && running) canvas.requestPointerLock(); } }
function renderJournal() {
  const L = $("journalList"); if (!L) return; L.innerHTML = "";
  const hd = t => { const h = document.createElement("div"); h.className = "muted"; h.style.cssText = "font-size:12px;letter-spacing:1px;margin:6px 0 4px"; h.textContent = t; L.appendChild(h); };
  hd("MAIN QUEST");
  quests.forEach((q, i) => {
    const row = document.createElement("div"); row.className = "craftRow" + (i > qi ? " no" : "");
    const mark = i < qi ? "\u2713 " : i === qi ? "\u25B6 " : "\u2022 ";
    const status = i < qi ? "Complete" : i === qi ? q.text : "Locked";
    row.innerHTML = "<span><b>" + mark + q.title + "</b><br><span class='muted'>" + status + "</span></span>";
    L.appendChild(row);
  });
  hd("SIDE QUESTS");
  sideQuests.forEach(s => {
    const done = sideDone.has(s.id);
    const row = document.createElement("div"); row.className = "craftRow" + (done ? "" : " no");
    row.innerHTML = "<span><b>" + (done ? "\u2713 " : "\u2022 ") + s.title + "</b><br><span class='muted'>" + s.text + " (" + (done ? "done" : s.prog()) + ")</span></span>";
    L.appendChild(row);
  });
}
function toggleJournal() { const el = $("journal"); if (el.classList.contains("hidden")) { renderJournal(); show("journal"); document.exitPointerLock(); } else { hide("journal"); if (paused) show("pause"); else if (!isTouch && running) canvas.requestPointerLock(); } }
// chest storage UI
let openChestK = null;
function addToStore(arr, id, count) {  // arr is 9 slots; returns leftover
  const stack = isItem(id) ? 1 : 64;
  for (let i = 0; i < 9 && count > 0; i++) { const s = arr[i]; if (s && s.id === id && s.count < stack) { const add = Math.min(count, stack - s.count); s.count += add; count -= add; } }
  for (let i = 0; i < 9 && count > 0; i++) { if (!arr[i]) { const add = Math.min(count, stack); arr[i] = { id, count: add }; count -= add; } }
  return count;
}
function openChest(key) {
  openChestK = key; if (!chestStore.has(key)) chestStore.set(key, new Array(9).fill(null));
  if (story.active && key === story.starterKey && !story.chestOpened) { story.chestOpened = true; clearObjective(); addXP(20); showBanner("Supplies recovered. Now gather Wood from the trees."); }
  if (story.active && key === story.secretKey && !story.secretOpened) { story.secretOpened = true; clearObjective(); showBanner("A buried secret! Cat Vision unlocked."); givePowerup("catvision"); }
  renderChest(); show("chest"); document.exitPointerLock();
}
function cellEl(s, onClick) {
  const c = document.createElement("div"); c.className = "cell";
  if (s) { if (isItem(s.id)) { const ic = document.createElement("div"); ic.className = "ic"; ic.textContent = ITEMS[s.id].icon; c.appendChild(ic); } else { const sw = document.createElement("div"); sw.className = "sw"; sw.style.background = colorHex(s.id); c.appendChild(sw); } if (s.count > 1) { const ct = document.createElement("div"); ct.className = "ct"; ct.textContent = s.count; c.appendChild(ct); } }
  c.addEventListener("pointerdown", e => { e.preventDefault(); onClick(); });
  return c;
}
function renderChest() {
  const store = chestStore.get(openChestK); if (!store) return;
  const cg = $("chestGrid"); cg.innerHTML = "";
  for (let i = 0; i < 9; i++) cg.appendChild(cellEl(store[i], () => { const s = store[i]; if (!s) return; const left = addToStore(hotbar, s.id, s.count); store[i] = left > 0 ? { id: s.id, count: left } : null; renderChest(); renderHotbar(); }));
  const ig = $("chestInv"); ig.innerHTML = "";
  for (let i = 0; i < 9; i++) ig.appendChild(cellEl(hotbar[i], () => { const s = hotbar[i]; if (!s) return; const left = addToStore(store, s.id, s.count); hotbar[i] = left > 0 ? { id: s.id, count: left } : null; renderChest(); renderHotbar(); }));
}
function closeChest() { hide("chest"); openChestK = null; if (!isTouch && running) canvas.requestPointerLock(); }
function togglePause() { if (!running) return; paused = !paused; if (paused) { saveGame(true); show("pause"); document.exitPointerLock(); } else { hide("pause"); hide("settings"); if (!isTouch) canvas.requestPointerLock(); } }
function showBoss(name, f) { $("bossbar").style.opacity = "1"; $("bossName").textContent = name; $("bossFill").style.width = Math.max(0, f * 100) + "%"; }
function hideBoss() { $("bossbar").style.opacity = "0"; }
function updateBoss() { if (dragon) { const dmgFrac = crystalsLeft > 0 ? 1 : dragon.hp / dragon.max; showBoss(crystalsLeft > 0 ? "BLACK DRAGON (" + crystalsLeft + " crystals)" : "BLACK DRAGON", crystalsLeft > 0 ? 1 : dmgFrac); } }

// menu wiring
$("playBtn").addEventListener("click", () => { initAudio(); show("intro"); });
$("beginBtn").addEventListener("click", () => { hide("intro"); startGame(); });
$("settBtn").addEventListener("click", () => show("settings"));
$("closeSettBtn").addEventListener("click", () => hide("settings"));
$("resumeBtn").addEventListener("click", togglePause);
$("pSettBtn").addEventListener("click", () => { renderKeybinds(); show("settings"); });
$("quitBtn").addEventListener("click", () => { saveGame(true); running = false; paused = false; story.active = false; clearObjective(); endCine(); hide("pause"); hide("touch"); $("hud").classList.add("hidden"); show("menu"); refreshContinue(); });
$("closeInvBtn").addEventListener("click", toggleInv);
$("pSkillBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleSkills(); });
$("closeSkillBtn").addEventListener("click", toggleSkills);
$("pJournalBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleJournal(); });
$("closeJournalBtn").addEventListener("click", toggleJournal);
$("respawnBtn").addEventListener("click", () => { hide("death"); player.hp = player.maxHp; player.food = 20; player.stam = player.maxStam; player.pos.copy(player.spawn); player.vel.set(0, 0, 0); updateVitals(); running = true; $("hud").classList.remove("hidden"); if (isTouch) show("touch"); else canvas.requestPointerLock(); });
$("againBtn").addEventListener("click", () => { hide("win"); startGame(); });
canvas.addEventListener("click", () => { if (running && !paused && !pointerLocked && !isTouch) canvas.requestPointerLock(); });
// settings controls
$("sSensD").addEventListener("input", e => settings.sensD = 0.0001 * e.target.value);
$("sSensM").addEventListener("input", e => settings.sensM = 0.00035 * e.target.value);
$("sFov").addEventListener("input", e => { settings.fov = +e.target.value; });
$("sAuto0").addEventListener("click", () => { settings.autoJump = false; $("sAuto0").classList.add("on"); $("sAuto1").classList.remove("on"); });
$("sAuto1").addEventListener("click", () => { settings.autoJump = true; $("sAuto1").classList.add("on"); $("sAuto0").classList.remove("on"); });
$("sCam1").addEventListener("click", () => { thirdPerson = false; $("sCam1").classList.add("on"); $("sCam3").classList.remove("on"); });
$("sCam3").addEventListener("click", () => { thirdPerson = true; $("sCam3").classList.add("on"); $("sCam1").classList.remove("on"); });
$("sBob1").addEventListener("click", () => { settings.bob = true; $("sBob1").classList.add("on"); $("sBob0").classList.remove("on"); });
$("sBob0").addEventListener("click", () => { settings.bob = false; $("sBob0").classList.add("on"); $("sBob1").classList.remove("on"); });
$("sRun0").addEventListener("click", () => { settings.sprintMode = "hold"; $("sRun0").classList.add("on"); $("sRun1").classList.remove("on"); });
$("sRun1").addEventListener("click", () => { settings.sprintMode = "always"; $("sRun1").classList.add("on"); $("sRun0").classList.remove("on"); });
$("sBtnOp").addEventListener("input", e => { settings.btnOpacity = e.target.value / 100; document.body.style.setProperty("--tcop", settings.btnOpacity); });
$("sScheme0").addEventListener("click", () => { settings.scheme = "fps"; $("sScheme0").classList.add("on"); $("sScheme1").classList.remove("on"); });
$("sScheme1").addEventListener("click", () => { settings.scheme = "tank"; $("sScheme1").classList.add("on"); $("sScheme0").classList.remove("on"); });
$("sSnd1").addEventListener("click", () => { settings.sound = true; $("sSnd1").classList.add("on"); $("sSnd0").classList.remove("on"); });
$("sSnd0").addEventListener("click", () => { settings.sound = false; $("sSnd0").classList.add("on"); $("sSnd1").classList.remove("on"); });
$("sMus1").addEventListener("click", () => { settings.music = true; initAudio(); $("sMus1").classList.add("on"); $("sMus0").classList.remove("on"); });
$("sMus0").addEventListener("click", () => { settings.music = false; $("sMus0").classList.add("on"); $("sMus1").classList.remove("on"); });
$("sFps0").addEventListener("click", () => { settings.showFps = false; $("fps").style.display = "none"; $("sFps0").classList.add("on"); $("sFps1").classList.remove("on"); });
$("sFps1").addEventListener("click", () => { settings.showFps = true; $("fps").style.display = "block"; $("sFps1").classList.add("on"); $("sFps0").classList.remove("on"); });
document.querySelectorAll(".seg button[data-g]").forEach(b => b.addEventListener("click", () => { settings.gfx = b.dataset.g; document.querySelectorAll(".seg button[data-g]").forEach(x => x.classList.remove("on")); b.classList.add("on"); applyGfx(); }));
$("pAchBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleAch(); });
$("closeAchBtn").addEventListener("click", () => hide("ach"));
$("sSfx").addEventListener("input", e => { settings.sfxVol = e.target.value / 100; applyAudioGains(); });
$("sMusV").addEventListener("input", e => { settings.musicVol = e.target.value / 100; applyAudioGains(); });
$("sMute0").addEventListener("click", () => { settings.muted = false; applyAudioGains(); segOn("sMute1", "sMute0", false); });
$("sMute1").addEventListener("click", () => { settings.muted = true; applyAudioGains(); segOn("sMute1", "sMute0", true); });
$("sCb0").addEventListener("click", () => { settings.cbMarkers = false; applyCbMarkers(); segOn("sCb1", "sCb0", false); });
$("sCb1").addEventListener("click", () => { settings.cbMarkers = true; applyCbMarkers(); segOn("sCb1", "sCb0", true); });
$("sRm0").addEventListener("click", () => { settings.reduceMotion = false; segOn("sRm1", "sRm0", false); });
$("sRm1").addEventListener("click", () => { settings.reduceMotion = true; segOn("sRm1", "sRm0", true); });
$("resetKeysBtn").addEventListener("click", () => { settings.keys = Object.assign({}, DEFAULT_KEYS); saveSettings(); renderKeybinds(); toast("Key bindings reset"); });
function renderKeybinds() {
  const el = $("keybinds"); if (!el) return;
  const labels = { interact: "Interact / Use", dodge: "Dodge", camera: "Camera toggle", inv: "Inventory", skills: "Skills", cat: "Cat command", journal: "Journal" };
  el.innerHTML = Object.keys(labels).map(a => '<div class="row"><span>' + labels[a] + '</span><button class="kb" data-kb="' + a + '">' + (rebindAction === a ? "press a key" : keyLabel(settings.keys[a])) + "</button></div>").join("");
  el.querySelectorAll("button[data-kb]").forEach(b => b.addEventListener("click", () => { rebindAction = b.dataset.kb; renderKeybinds(); }));
}
// persist settings after any interaction in the settings panel
let setSaveT = null;
$("settings").addEventListener("input", () => { clearTimeout(setSaveT); setSaveT = setTimeout(saveSettings, 250); });
$("settings").addEventListener("click", () => { clearTimeout(setSaveT); setSaveT = setTimeout(saveSettings, 80); });

// ---------- SAVE SYSTEM (localStorage) ----------
const SAVE_KEY = "thomas_voxel_save_v2";
const SET_KEY = "thomas_voxel_settings";
function saveSettings() {
  try { localStorage.setItem(SET_KEY, JSON.stringify({ sensD: settings.sensD, sensM: settings.sensM, fov: settings.fov, autoJump: settings.autoJump, gfx: settings.gfx, sound: settings.sound, music: settings.music, showFps: settings.showFps, bob: settings.bob, btnOpacity: settings.btnOpacity, sprintMode: settings.sprintMode, scheme: settings.scheme, thirdPerson: thirdPerson, sfxVol: settings.sfxVol, musicVol: settings.musicVol, muted: settings.muted, cbMarkers: settings.cbMarkers, reduceMotion: settings.reduceMotion, keys: settings.keys })); } catch (e) {}
}
function loadSettings() {
  let d; try { d = JSON.parse(localStorage.getItem(SET_KEY)); } catch (e) {}
  if (!d) return;
  for (const k of ["sensD", "sensM", "fov", "autoJump", "gfx", "sound", "music", "showFps", "bob", "btnOpacity", "sprintMode", "scheme", "sfxVol", "musicVol", "muted", "cbMarkers", "reduceMotion"]) if (d[k] != null) settings[k] = d[k];
  if (d.thirdPerson != null) thirdPerson = d.thirdPerson;
  if (d.keys) settings.keys = Object.assign({}, DEFAULT_KEYS, d.keys);
  syncSettingsUI();
}
function segOn(onId, offId, cond) { const a = $(onId), b = $(offId); if (!a || !b) return; a.classList.toggle("on", cond); b.classList.toggle("on", !cond); }
function syncSettingsUI() {
  if ($("sSensD")) $("sSensD").value = Math.round(settings.sensD / 0.0001);
  if ($("sSensM")) $("sSensM").value = Math.round(settings.sensM / 0.00035);
  if ($("sFov")) $("sFov").value = settings.fov;
  if ($("sBtnOp")) $("sBtnOp").value = Math.round(settings.btnOpacity * 100);
  segOn("sAuto1", "sAuto0", settings.autoJump);
  segOn("sCam3", "sCam1", thirdPerson);
  segOn("sScheme1", "sScheme0", settings.scheme === "tank");
  segOn("sBob1", "sBob0", settings.bob);
  segOn("sRun1", "sRun0", settings.sprintMode === "always");
  segOn("sSnd1", "sSnd0", settings.sound);
  segOn("sMus1", "sMus0", settings.music);
  segOn("sFps1", "sFps0", settings.showFps);
  segOn("sMute1", "sMute0", settings.muted);
  segOn("sCb1", "sCb0", settings.cbMarkers);
  segOn("sRm1", "sRm0", settings.reduceMotion);
  if ($("sSfx")) $("sSfx").value = Math.round(settings.sfxVol * 100);
  if ($("sMusV")) $("sMusV").value = Math.round(settings.musicVol * 100);
  document.querySelectorAll(".seg button[data-g]").forEach(x => x.classList.toggle("on", x.dataset.g === settings.gfx));
  document.body.style.setProperty("--tcop", settings.btnOpacity);
  if ($("fps")) $("fps").style.display = settings.showFps ? "block" : "none";
  if (typeof camera !== "undefined" && camera) { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  applyAudioGains(); applyCbMarkers(); if (typeof renderKeybinds === "function") renderKeybinds();
  applyGfx();
}
function saveGame(silent) {
  try {
    const data = { v: 2, dim: DIM, pos: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, pitch: player.pitch,
      hp: player.hp, food: player.food, stam: player.stam,
      xp: xp, level: level, xpNext: xpNext,
      skills: { mine: skills.mine, hp: skills.hp, stam: skills.stam, sword: skills.sword, cat: skills.cat, pts: skills.pts },
      flags: { craftedPlanks, craftedPick, minedStone, survivedNight, tamedCat, kills, fireBossDown, tameCount, placedBlocks, movedDist },
      qi: qi, ach: [...ach], day: day, timeOfDay: timeOfDay, hotbar: hotbar,
      side: [...sideDone],
      cats: cats.filter(c => c.tamed).map(c => ({ x: Math.round(c.g.position.x), z: Math.round(c.g.position.z), color: c.color, level: c.level, mode: c.mode })),
      edits: { overworld: [...editsByDim.overworld], fire: [...editsByDim.fire], end: [...editsByDim.end] },
      chests: [...chestStore] };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) toast("Game saved");
  } catch (e) { if (!silent) toast("Saving is not available here"); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function refreshContinue() { const b = $("contBtn"); if (b) b.style.display = hasSave() ? "" : "none"; }
function loadGame() {
  let data; try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  if (!data) { toast("No save found"); return; }
  initAudio(); hide("menu"); hide("intro"); hide("win"); hide("death"); $("hud").classList.remove("hidden"); if (isTouch) show("touch");
  xp = data.xp || 0; level = data.level || 1; xpNext = data.xpNext || 50;
  Object.assign(skills, data.skills || {}); applySkills();
  qi = data.qi || 0; const f = data.flags || {};
  craftedPlanks = !!f.craftedPlanks; craftedPick = !!f.craftedPick; minedStone = f.minedStone || 0; survivedNight = !!f.survivedNight; tamedCat = !!f.tamedCat; kills = f.kills || 0; fireBossDown = !!f.fireBossDown; tameCount = f.tameCount || 0; placedBlocks = f.placedBlocks || 0; movedDist = f.movedDist || 0;
  (data.ach || []).forEach(a => ach.add(a)); loadAch();
  day = data.day || 1; timeOfDay = data.timeOfDay != null ? data.timeOfDay : 0.28;
  for (let i = 0; i < 9; i++) hotbar[i] = (data.hotbar && data.hotbar[i]) ? data.hotbar[i] : null;
  editsByDim.overworld = new Map((data.edits && data.edits.overworld) || []);
  editsByDim.fire = new Map((data.edits && data.edits.fire) || []);
  editsByDim.end = new Map((data.edits && data.edits.end) || []);
  chestStore = new Map(data.chests || []);
  running = true; paused = false; wasNight = false; raidShown = false; dodge.t = 0; dodge.cd = 0; openChestK = null;
  story.active = false; clearObjective(); endCine();
  applyGfx();
  loadDimension(data.dim || "overworld", true);
  if (data.pos) { player.pos.set(data.pos[0], data.pos[1], data.pos[2]); player.spawn.copy(player.pos); }
  player.yaw = data.yaw || 0; player.pitch = data.pitch || 0; player.vel.set(0, 0, 0);
  player.hp = Math.min(player.maxHp, data.hp != null ? data.hp : player.maxHp); player.food = data.food != null ? data.food : 20; player.stam = Math.min(player.maxStam, data.stam != null ? data.stam : player.maxStam);
  sideDone.clear(); (data.side || []).forEach(s => sideDone.add(s));
  if ((data.dim || "overworld") === "overworld") (data.cats || []).forEach(cd => spawnCat(cd.x, cd.z, { tamed: true, color: cd.color, level: cd.level, mode: cd.mode }));
  renderHotbar(); updateVitals(); updateXPUI(); renderSkills(); buildViewItem();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (!isTouch) canvas.requestPointerLock();
}
$("contBtn").addEventListener("click", loadGame);
$("saveBtn").addEventListener("click", () => saveGame(false));
$("closeChestBtn").addEventListener("click", closeChest);

// ---------- POWER-UPS (easy to read timed buffs) ----------
const POWERUPS = {
  speed:     { name: "Speed Boots", icon: "👢", dur: 30 },
  jump:      { name: "Super Jump",  icon: "🦘", dur: 30 },
  catvision: { name: "Cat Vision",  icon: "🐾", dur: 45 }
};
const powerups = { speed: 0, jump: 0, catvision: 0 };
function powerActive(k) { return (powerups[k] || 0) > 0; }
function randPowerup() { const ks = Object.keys(POWERUPS); return ks[Math.floor(Math.random() * ks.length)]; }
function givePowerup(k) { const p = POWERUPS[k]; if (!p) return; powerups[k] = p.dur; toast(p.icon + " " + p.name + " activated!"); SFX.power(); renderPowerups(); if (k === "catvision") revealSecretsNow(); }
function updatePowerups(dt) {
  let changed = false;
  for (const k in powerups) { if (powerups[k] > 0) { const was = Math.ceil(powerups[k]); powerups[k] = Math.max(0, powerups[k] - dt); if (powerups[k] === 0) { toast(POWERUPS[k].name + " wore off"); changed = true; } else if (Math.ceil(powerups[k]) !== was) changed = true; } }
  if (changed) renderPowerups();
}
function renderPowerups() {
  const el = $("powerups"); if (!el) return; el.innerHTML = "";
  for (const k in powerups) if (powerups[k] > 0) { const d = document.createElement("div"); d.className = "pwr"; d.textContent = POWERUPS[k].icon + " " + Math.ceil(powerups[k]) + "s"; el.appendChild(d); }
}
function revealSecretsNow() {
  if (story.secret && !story.secret.revealed && DIM === "overworld") { story.secret.revealed = true; setObjective(story.secret.x + 0.5, surfaceY(story.secret.x, story.secret.z), story.secret.z + 0.5); toast("Cat Vision reveals a buried secret nearby."); }
}

// ---------- OPENING STORY + OBJECTIVE MARKER (first 5 minutes) ----------
// A short scripted intro: wake by a broken campfire, a friendly cat (Whiskers)
// runs up, the sky flashes purple, then guided objectives with a glowing beacon,
// a first monster within 2 minutes and a buried secret within 3. New game only.
let objMarker = null;
function ensureObjMarker() {
  if (objMarker) return;
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7, 0.22), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
  beam.position.y = 3.5; g.add(beam);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,228,110,0.95)", "rgba(255,180,40,0)"), depthWrite: false, transparent: true, fog: false }));
  spr.scale.set(2.2, 2.2, 1); spr.position.y = 7.2; g.add(spr);
  objMarker = g; objMarker.visible = false; scene.add(objMarker);
}
function setObjective(x, y, z) { ensureObjMarker(); objMarker.position.set(x, y, z); objMarker.visible = true; }
function clearObjective() { if (objMarker) objMarker.visible = false; }
function purpleFlash() {
  const f = $("flash"); if (f) { f.style.opacity = "1"; setTimeout(() => { if (f) f.style.opacity = "0"; }, settings.reduceMotion ? 220 : 750); }
}
// cinematic captions over letterbox bars
function cine(text) { const c = $("cine"); if (!c) return; c.classList.remove("hidden"); const cap = $("cineCap"); if (cap) { cap.textContent = text; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); } }
function endCine() { const c = $("cine"); if (c) c.classList.add("hidden"); }
// build a broken campfire + supply chest near spawn (decorative, new game only)
function buildSpawnCamp() {
  const touched = new Set();
  const put = (x, y, z, id) => { setRaw(x, y, z, id); touched.add(ck(Math.floor(x / CH), Math.floor(z / CH))); touched.add(ck(Math.floor((x + 1) / CH), Math.floor(z / CH))); touched.add(ck(Math.floor((x - 1) / CH), Math.floor(z / CH))); touched.add(ck(Math.floor(x / CH), Math.floor((z + 1) / CH))); touched.add(ck(Math.floor(x / CH), Math.floor((z - 1) / CH))); };
  const cx = 3, cz = 2;                                        // campfire centre, a couple blocks from spawn
  // ring of stones around the fire
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) { const sy = surfaceY(cx + ox, cz + oz); put(cx + ox, sy, cz + oz, COBBLE); }
  // a couple of broken logs and an ember (torch) in the middle
  const fy = surfaceY(cx, cz); put(cx, fy, cz, WOOD); put(cx, fy + 1, cz, TORCH);
  const wy = surfaceY(cx + 1, cz - 1); put(cx + 1, wy, cz - 1, WOOD);
  // supply chest beside the fire, with a generous starter haul
  const chx = cx + 2, chz = cz; const chy = surfaceY(chx, chz);
  put(chx, chy, chz, CHEST);
  const cgkey = chestKey(chx, chy, chz);
  chestStore.set(cgkey, [{ id: WOOD, count: 6 }, { id: PLANKS, count: 8 }, { id: TORCH, count: 6 }, { id: I_APPLE, count: 3 }, { id: I_SPICK, count: 1 }, { id: COBBLE, count: 8 }, null, null, null]);
  // a buried secret a short walk away (revealed by Whiskers later)
  const sx = -4, sz = 4; const sgy = surfaceY(sx, sz);
  put(sx, sgy - 1, sz, CHEST); put(sx, sgy, sz, DIRT);          // chest one below the surface, capped by dirt
  chestStore.set(chestKey(sx, sgy - 1, sz), [{ id: I_APPLE, count: 4 }, { id: PLANKS, count: 12 }, { id: BRICK, count: 8 }, { id: I_STICK, count: 6 }, null, null, null, null, null]);
  // rebuild touched chunks now so the camp is visible immediately
  for (const k of touched) { const p = k.split(","); buildChunk(+p[0], +p[1]); }
  rebuildTorchCells();
  return { chestX: chx, chestY: chy, chestZ: chz, catX: cx - 2, catZ: cz + 3, secret: { x: sx, y: sgy, z: sz, revealed: false, key: chestKey(sx, sgy - 1, sz) } };
}
function spawnWhiskers(x, z) { spawnCat(x, z, { color: "orange", friendly: true, name: "Whiskers" }); SFX.meow(); }
const story = { active: false, t: 0, step: 0, steps: [], firstMonster: false, secret: null, chestOpened: false };
function startStory(camp) {
  story.active = true; story.t = 0; story.step = 0; story.firstMonster = false; story.secret = camp.secret; story.chestOpened = false;
  story.starterKey = chestKey(camp.chestX, camp.chestY, camp.chestZ);
  story.secretKey = camp.secret.key; story.secretOpened = false;
  story.steps = [
    [0.3, () => cine("Thomas wakes beside a cold, broken campfire.")],
    [3.2, () => { cine("A small orange cat slips out of the ferns, meowing at Thomas."); spawnWhiskers(camp.catX, camp.catZ); }],
    [6.4, () => { cine("Far away, the sky flashes purple."); purpleFlash(); SFX.growl(); addShake(0.22); }],
    [9.4, () => cine("Thomas... the forest is changing.")],
    [12.6, () => { endCine(); showBanner("Chapter 1. The Block Forest"); setObjective(camp.chestX + 0.5, surfaceY(camp.chestX, camp.chestZ), camp.chestZ + 0.5); toast("Open the supply chest by the campfire. Look at it and press Use."); }]
  ];
}
function updateStory(dt) {
  if (objMarker && objMarker.visible) {                        // gentle pulse + bob
    const t = performance.now() * 0.004; const b = objMarker.children[0], s = objMarker.children[1];
    if (b && b.material) b.material.opacity = 0.32 + (Math.sin(t) * 0.5 + 0.5) * 0.3;
    if (s) s.position.y = 7.2 + Math.sin(t) * 0.3;
  }
  if (!story.active) return;
  story.t += dt;
  while (story.step < story.steps.length && story.t >= story.steps[story.step][0]) { try { story.steps[story.step][1](); } catch (e) {} story.step++; }
  if (!story.firstMonster && story.t > 70 && DIM === "overworld") {   // first encounter, within 2 minutes
    story.firstMonster = true;
    const a = Math.random() * 6.28, r = 11;
    spawnMonster(Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), "crawler");
    showBanner("A purple crawler creeps out of the trees. Defend Thomas."); SFX.growl();
  }
  if (story.secret && !story.secret.revealed && story.t > 150 && DIM === "overworld") {  // first secret, within 3 minutes
    story.secret.revealed = true;
    setObjective(story.secret.x + 0.5, surfaceY(story.secret.x, story.secret.z), story.secret.z + 0.5);
    toast("Whiskers sniffs at loose dirt nearby. Something is buried here. Dig down to find it."); SFX.meow();
  }
}

// ---------- GAME START ----------
// ---------- MINIMAP (UISystem) ----------
const mmCv = document.getElementById("minimap"), mmx = mmCv.getContext("2d");
let mmT = 0;
function drawMinimap() {
  const N = 30, span = 100, step = span / N, px = mmCv.width / N, cx = player.pos.x, cz = player.pos.z;
  mmx.clearRect(0, 0, mmCv.width, mmCv.height);
  if (DIM !== "overworld") { mmx.fillStyle = DIM === "fire" ? "#3a0d0d" : "#0c0c14"; mmx.fillRect(0, 0, mmCv.width, mmCv.height); }
  else {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = cx + (i - N / 2) * step, wz = cz + (j - N / 2) * step;   // j=0 north (-z), i=0 west (-x)
      const h = heightAt(wx, wz), b = biomeAt(wx, wz);
      const peak = h > SEA + 16, desert = b.t > 0.66 && !peak && h > SEA, forest = b.m > 0.58 && !desert && !peak;
      let col;
      if (h <= SEA) col = [44, 96, 180]; else if (peak) col = [228, 236, 243]; else if (desert) col = [212, 196, 128]; else if (forest) col = [54, 120, 52]; else col = [108, 170, 90];
      const s = 0.7 + (h - SEA) / 40;
      mmx.fillStyle = "rgb(" + ((col[0] * s) | 0) + "," + ((col[1] * s) | 0) + "," + ((col[2] * s) | 0) + ")";
      mmx.fillRect(i * px, j * px, px + 1, px + 1);
    }
  }
  const c = mmCv.width / 2;
  mmx.save(); mmx.translate(c, c); mmx.rotate(-player.yaw);
  mmx.fillStyle = "#fff"; mmx.strokeStyle = "rgba(0,0,0,.6)"; mmx.lineWidth = 1.5;
  mmx.beginPath(); mmx.moveTo(0, -7); mmx.lineTo(5, 6); mmx.lineTo(0, 3); mmx.lineTo(-5, 6); mmx.closePath(); mmx.fill(); mmx.stroke();
  mmx.restore();
}

function startGame() {
  initAudio(); hide("menu"); hide("win"); hide("death"); $("hud").classList.remove("hidden");
  if (isTouch) show("touch");
  skills.pts = 0; skills.mine = skills.hp = skills.stam = skills.sword = skills.cat = 0; applySkills();
  player.hp = player.maxHp; player.food = 20; player.stam = player.maxStam; running = true; paused = false;
  // starter kit (TODO: true survival empty start)
  for (let i = 0; i < 9; i++) hotbar[i] = null;
  hotbar[0] = { id: I_WPICK, count: 1 }; hotbar[1] = { id: I_SWORD, count: 1 }; hotbar[2] = { id: DIRT, count: 20 }; hotbar[3] = { id: I_APPLE, count: 3 };
  selSlot = 0;
  applyGfx();
  loadDimension("overworld");
  setQuest(quests[0].text); qi = 0; kills = 0; minedStone = 0; survivedNight = false; tamedCat = false; craftedPick = false; craftedPlanks = false; fireBossDown = false;
  xp = 0; level = 1; xpNext = 50; placedBlocks = 0; movedDist = 0; tameCount = 0; ach.clear(); loadAch(); dodge.t = 0; dodge.cd = 0; wasNight = false; raidShown = false; updateXPUI(); renderSkills();
  editsByDim.overworld = new Map(); editsByDim.fire = new Map(); editsByDim.end = new Map(); chestStore = new Map(); openChestK = null; day = 1; timeOfDay = 0.28;
  clearObjective(); story.active = false;
  const camp = buildSpawnCamp(); startStory(camp);            // opening cinematic + guided first 5 minutes
  renderHotbar(); updateVitals(); buildViewItem();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (!isTouch) canvas.requestPointerLock();
}
function die() { running = false; document.exitPointerLock(); hide("touch"); $("hud").classList.add("hidden"); show("death"); }

// ---------- MAIN LOOP ----------
let last = performance.now(); let hungerT = 0, heatT = 0, droneT = 3;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
  if (running && !paused) {
    if (attackCd > 0) attackCd -= dt; if (portalCd > 0) portalCd -= dt; if (hammerCd > 0) hammerCd -= dt;
    physics(dt);
    tagMonsters();
    updateMining(dt);
    updateMonsters(dt);
    updateAnimals(dt);
    updateFireBoss(dt);
    updateProjectiles(dt);
    updateDragon(dt);
    updateFx(dt);
    updateTelegraphs(dt);
    updateViewItem(dt);
    updateDayNight(dt);
    updateSky(dt);
    updateAmbient(dt);
    mmT -= dt; if (mmT <= 0) { mmT = 0.2; drawMinimap(); }
    loadChunks();
    checkPortal();
    // selection box
    const r = voxelRaycast(5);
    if (r && BLOCKS[r.id] && BLOCKS[r.id].hard > 0) { selBox.position.set(r.x + 0.5, r.y + 0.5, r.z + 0.5); selBox.visible = true; } else selBox.visible = false;
    $("crosshair").classList.toggle("target", !!aimEntity());
    // portal glow pulse
    if (portalMat) portalMat.emissiveIntensity = 0.9 + Math.sin(now * 0.005) * 0.3;
    // hunger drain + regen
    hungerT += dt; if (hungerT > 4) { hungerT = 0; if (player.food > 0) { if (Math.random() < 0.5) player.food = Math.max(0, player.food - 1); } else damage(1); if (player.food > 16 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 1); updateVitals(); }
    if (DIM === "fire") { heatT += dt; if (heatT > 2.5) { heatT = 0; if (countItem(I_FIRECHARM) === 0) { damage(1); if (Math.random() < 0.5) toast("The heat is searing. You need a Flame Charm."); } } }
    if (DIM === "end") { droneT -= dt; if (droneT <= 0) { droneT = 5 + Math.random() * 4; if (typeof blip === "function") blip(58, 0.7, "sine", 0.05, 44); } }
    // night raid + survive-night
    if (isNight()) { wasNight = true; if (!raidShown) { raidShown = true; showBanner("Night raid. Defend Thomas."); } }
    else { raidShown = false; if (wasNight && !survivedNight) { survivedNight = true; achieve("night", "First Night Survived"); } }
    updateStory(dt);
    updatePowerups(dt);
    updateQuests();
    checkAchievements();
    updateMusic(dt);
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").style.opacity = "0"; }
  }
  renderer.render(scene, camera);
  if (!thirdPerson) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vScene, vCam); renderer.autoClear = true; }
  if (settings.showFps) { fpsAcc += (1 / Math.max(0.001, dt) - fpsAcc) * 0.1; const e = $("fps"); if (e) e.textContent = Math.round(fpsAcc) + " fps"; }
}
let fpsAcc = 60;
let wasNight = false, raidShown = false;
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vCam.aspect = innerWidth / innerHeight; vCam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
addEventListener("orientationchange", () => setTimeout(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }, 250));
scene.background = new THREE.Color(0x9fd2ff);
loadAch();
loadSettings();
syncSettingsUI();
applyGfx();
refreshContinue();
loop();

/* ===========================================================================
   STAGE 8 (audio + accessibility polish) DONE: separate SFX and Music volume
   sliders with master gain nodes, a Mute all toggle (M key) that silences both
   instantly, all persisted. Colorblind safe enemy labels (text tag above each
   monster naming its type, plus + for elites), toggleable and applied live.
   Reduce motion option that cuts screen shake and softens the hit flash for
   motion and photosensitivity. Key rebinding for the discrete action keys
   (interact, dodge, camera, inventory, skills, cat command, journal) with a
   click then press a key flow, a reset to default, and persistence. Movement
   (WASD and arrows) and jump (Space) stay fixed by design. Prior stages kept.

   Recommended next: migrate this single 150K file to Claude Code, split into
   modules (world, entities, audio, ui, save), add a texture atlas there.

   TODO (foundations in place, deeper work deferred per staged plan):
   - World: surface cave mouths, rivers, villages/dungeons, biome-specific mobs and weather.
   - Render: texture atlas + FrontSide winding, real lava/portal emissive lighting, smooth chunk LOD.
   - Survival: chests (storage), real bed block, bow + arrows, shield block, dodge i-frame tuning, torches/light.
   - Crafting: full recipe tree + crafting table grid UI.
   - Progression: real skill tree UI + skill points (mining speed perk is the first hook), armor, durability.
   - Enemies: spitter (ranged), ghost (phasing), miner, screamer, portal guard, real A* path + jumping, dungeon mini bosses.
   - Animals: cat command wheel (follow/stay/guard/attack/search), cat leveling, loot finding, more cat types, mice stealing food.
   - Fire dim: lava rivers detail, burning trees, ash particles, rare fire blocks, multi-phase fire boss.
   - End: floating islands, end crystal beams healing dragon, full 5-phase dragon (fire breath, tail swipe, ground slam, summon, rage).
   - Audio: background music; Settings persistence via localStorage when hosted.
=========================================================================== */
})();
