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
  power: () => { blip(440, 0.1, "triangle", 0.16, 660); setTimeout(() => blip(660, 0.12, "triangle", 0.16, 990), 80); },
  treasure: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, "triangle", 0.16), i * 70)); },
  victory: () => { [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, "square", 0.18), i * 120)); },
  boom: () => { noiseHit(0.45, 0.45); blip(64, 0.45, "sawtooth", 0.28, 28); setTimeout(() => noiseHit(0.3, 0.22), 70); setTimeout(() => blip(48, 0.3, "square", 0.18, 24), 40); },
  roar: () => { blip(70, 0.5, "sawtooth", 0.12, 110); setTimeout(() => blip(55, 0.6, "sawtooth", 0.1, 95), 120); setTimeout(() => noiseHit(0.18, 0.4), 60); },
  sparkle: () => { [880, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.1, "triangle", 0.1), i * 60)); }
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
const SCALES = { overworld: [220, 247, 294, 330, 392, 440], night: [165, 196, 220, 247, 196, 147], cave: [110, 131, 147, 110, 98, 87], fire: [110, 131, 147, 175, 131, 98], sky: [392, 440, 523, 587, 659, 784], end: [330, 392, 494, 587, 392, 247] };
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
  // overworld music shifts mood by time of day and when underground
  let key = DIM;
  if (DIM === "overworld") key = isNight() ? "night" : (player.pos.y < SEA - 3 ? "cave" : "overworld");
  const sc = SCALES[key] || SCALES.overworld, note = sc[musicIdx % sc.length]; musicIdx++;
  const boss = bossActive();
  const dur = boss ? 1.1 : key === "night" ? 2.4 : key === "cave" ? 3.1 : DIM === "fire" ? 2.2 : DIM === "sky" ? 1.7 : DIM === "end" ? 2.9 : 1.8;
  playPad(note * (boss ? (Math.random() < 0.5 ? 0.5 : 1) : (Math.random() < 0.18 ? 2 : 1)), dur);
  musicT = dur * (boss ? 0.45 : 0.66);
}

// ---------- BLOCKS ----------
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, WATER = 7, LAVA = 8,
      FIRESTONE = 9, ENDSTONE = 10, PORTAL = 11, PLANKS = 12, COBBLE = 13, TORCH = 14, CHEST = 15, SNOW = 16, BRICK = 17, BED = 18, FIRE_CRYSTAL = 19, BOUNCE = 20, SPIKE = 21, ALARM = 22, FREDA = 23, MYCELIUM = 24, MUSHROOM = 25, CRYSTAL = 26, LAUNCH = 27, HEAL = 28, FROST = 29, TALLGRASS = 30, CDOOR = 31;
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
  [BOUNCE]:   { name: "Bounce Block", solid: 1, opaque: 1, hard: 0.3, top: C(0x49e06a), side: C(0x36c456), bot: C(0x2aa345), drop: BOUNCE, bouncy: 1, icon: "🟢" },
  [SPIKE]:    { name: "Spike Trap", solid: 1, opaque: 1, hard: 0.5, top: C(0xb8c0cc), side: C(0x8a929e), bot: C(0x6f7782), drop: SPIKE, spike: 1, icon: "🔺" },
  [ALARM]:    { name: "Alarm Bell", solid: 1, opaque: 1, hard: 0.6, top: C(0xffd24a), side: C(0xc9a227), bot: C(0x8a6f1a), drop: ALARM, alarm: 1, icon: "🔔" },
  [FREDA]:    { name: "Freda Block", solid: 1, opaque: 1, hard: 0.35, top: C(0xe23b2e), side: C(0xc62c22), bot: C(0x8a1c16), drop: FREDA, freda: 1, icon: "💥" },
  [MYCELIUM]: { name: "Mycelium", solid: 1, opaque: 1, hard: 0.5, top: C(0x9a6cb8), side: C(0x6a4a86), bot: C(0x8a5a2b), drop: DIRT, icon: "🟪" },
  [MUSHROOM]: { name: "Mushroom", solid: 1, opaque: 1, hard: 0.3, top: C(0xd0463a), side: C(0xc23a30), bot: C(0xe8e0d0), drop: MUSHROOM, icon: "🍄" },
  [CRYSTAL]:  { name: "Crystal", solid: 1, opaque: 1, hard: 1.2, top: C(0x76e4ff), side: C(0x4fc8ef), bot: C(0x36a8d0), drop: CRYSTAL, tool: "pick", glow: 1, icon: "🔷" },
  [LAUNCH]:   { name: "Launch Pad", solid: 1, opaque: 1, hard: 0.4, top: C(0xffd23d), side: C(0xff9a2e), bot: C(0xc97a1e), drop: LAUNCH, launch: 1, icon: "🚀" },
  [HEAL]:     { name: "Heal Block", solid: 1, opaque: 1, hard: 0.5, top: C(0x7cf0a0), side: C(0x4fd07e), bot: C(0x36a85e), drop: HEAL, heal: 1, glow: 1, icon: "💚" },
  [FROST]:    { name: "Frost Block", solid: 1, opaque: 1, hard: 0.5, top: C(0xbfe8ff), side: C(0x8fcff0), bot: C(0x6fb0d8), drop: FROST, frost: 1, glow: 1, icon: "🧊" },
  [TALLGRASS]:{ name: "Tall Grass", solid: 0, opaque: 0, hard: 0.1, top: C(0x57c93e), side: C(0x49b432), bot: C(0x3a9a28), drop: TALLGRASS, tallgrass: 1, icon: "🌿" },
  [CDOOR]:    { name: "Creature Door", solid: 1, opaque: 1, hard: 2, top: C(0x6a3df0), side: C(0x9b30ff), bot: C(0x3aa0ff), drop: CDOOR, glow: 1, icon: "🚪" }
};
function isOpaque(id) { return id !== AIR && id !== WATER && id !== PORTAL && BLOCKS[id] && BLOCKS[id].opaque; }
function isSolidBlock(id) { return id !== AIR && id !== WATER && id !== PORTAL && BLOCKS[id] && BLOCKS[id].solid; }

// ITEMS (tools/food), ids offset 100
const I_HAND = 100, I_WPICK = 101, I_SPICK = 102, I_SWORD = 103, I_AXE = 104, I_FIRECHARM = 105, I_FIRESWORD = 106, I_LIGHTHAMMER = 107, I_BOOMPICK = 108, I_ICEBOW = 109, I_APPLE = 110, I_STICK = 111, I_SLIMELAUNCH = 112, I_CRYSTALSPEAR = 113;
const ITEMS = {
  [I_WPICK]: { name: "Wood Pickaxe", tool: "pick", tier: 1, dmg: 2, icon: "⛏️" },
  [I_SPICK]: { name: "Stone Pickaxe", tool: "pick", tier: 2, dmg: 3, icon: "⛏️" },
  [I_SWORD]: { name: "Wood Sword", tool: "sword", tier: 1, dmg: 5, icon: "🗡️" },
  [I_AXE]:   { name: "Wood Axe", tool: "axe", tier: 1, dmg: 3, icon: "🪓" },
  [I_FIRECHARM]: { name: "Flame Charm", protect: "fire", icon: "🧿" },
  [I_FIRESWORD]: { name: "Flame Sword", tool: "sword", tier: 3, dmg: 9, special: "fire", icon: "🗡️" },
  [I_LIGHTHAMMER]: { name: "Lightning Hammer", tool: "hammer", tier: 2, dmg: 7, special: "lightning", icon: "🔨" },
  [I_BOOMPICK]: { name: "Boom Pickaxe", tool: "pick", tier: 2, dmg: 3, special: "boom", icon: "⛏️" },
  [I_ICEBOW]: { name: "Ice Bow", tool: "bow", dmg: 1, special: "ice", icon: "🏹" },
  [I_SLIMELAUNCH]: { name: "Slime Launcher", tool: "bow", dmg: 1, special: "slime", icon: "🟢" },
  [I_CRYSTALSPEAR]: { name: "Crystal Spear", tool: "sword", tier: 3, dmg: 8, special: "pierce", icon: "🔱" },
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
// a rare hidden treasure room buried under the forest, marked by a glowing crystal on the surface
function buildTreasureRoom(cx, surfY, cz) {
  const roomY = surfY - 7;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 3; dy++) {
    const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 0 || dy === 3;
    setRaw(cx + dx, roomY + dy, cz + dz, edge ? (dy === 0 ? COBBLE : BRICK) : AIR);
  }
  setRaw(cx, roomY + 1, cz, CHEST);
  try { const ck2 = "overworld:" + bk(cx, roomY + 1, cz); if (!chestStore.has(ck2)) chestStore.set(ck2, [{ id: CRYSTAL, count: 3 }, { id: FIRE_CRYSTAL, count: 2 }, { id: BOUNCE, count: 3 }, { id: LAUNCH, count: 1 }, { id: I_APPLE, count: 4 }, { id: BRICK, count: 12 }, null, null, null]); } catch (e) {}
  setRaw(cx - 1, roomY + 1, cz - 1, CRYSTAL); setRaw(cx + 1, roomY + 1, cz + 1, HEAL);   // light + a heal block inside
  setRaw(cx, surfY, cz, CRYSTAL);                                                         // glowing surface marker leads Thomas here
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
      const mush = b.m > 0.72 && b.t > 0.4 && b.t < 0.66 && !peak && h > SEA;   // mushroom forest: very wet, temperate
      const swamp = b.m > 0.6 && !mush && !desert && !peak && h > SEA && h <= SEA + 2;  // swamp: wet lowlands
      const forest = b.m > 0.58 && !desert && !peak && !mush;
      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === h) id = (h <= SEA) ? SAND : peak ? SNOW : desert ? SAND : mush ? MYCELIUM : GRASS;
        else if (y > h - 3) id = peak ? STONE : desert ? SAND : DIRT;
        // carve connected caves through the stone interior (leave surface + bedrock intact)
        if (id === STONE && y > 1 && y < h - 1 && caveAt(x, y, z)) id = (y <= 4) ? LAVA : AIR;
        // crystal-cave veins deep underground, then sparse cobble "ore"
        else if (id === STONE && y > 2 && y < SEA - 3 && vn3(x * 0.18 + 9, y * 0.18 + 9, z * 0.18 + 9) > 0.93) id = CRYSTAL;
        else if (id === STONE && vn3(x * 0.2, y * 0.2, z * 0.2) > 0.9) id = COBBLE;
        setRaw(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);   // fill water to sea level
      if (h <= SEA) setRaw(x, h, z, SAND);                          // shore/seabed
      if (h > SEA && !peak) {
        if (mush) { if (hsh(x * 3 + 7, z * 5 + 11) > 0.93) giantMushroom(x, h + 1, z); else if (hsh(x * 2 + 1, z * 2 + 3) > 0.9) setRaw(x, h + 1, z, MUSHROOM); }
        else if (swamp) { if (hsh(x * 3 + 2, z * 3 + 5) > 0.86) setRaw(x, h + 1, z, BOUNCE); else if (hsh(x * 5 + 1, z * 7 + 2) > 0.9) bush(x, h + 1, z); }
        else if (!desert) { const tr = hsh(x * 3 + 7, z * 5 + 11); if (tr > (forest ? 0.86 : 0.95)) tree(x, h + 1, z); else if (forest && tr > 0.8) bush(x, h + 1, z); }
      }
    }
    // rare ruin landmark per chunk (exploration reward)
    if (hsh(cx * 91 + 5, cz * 57 + 3) > 0.93) {
      const rx = x0 + 3 + Math.floor(hsh(cx, cz) * 9), rz = z0 + 3 + Math.floor(hsh(cz + 1, cx + 1) * 9), ry = heightAt(rx, rz);
      const rb = biomeAt(rx, rz);
      if (ry > SEA + 1 && !(ry > SEA + 18)) buildRuin(rx, ry + 1, rz);
    }
    // rarer hidden treasure room buried under the surface
    if (hsh(cx * 71 + 13, cz * 39 + 7) > 0.955) {
      const tx = x0 + 4 + Math.floor(hsh(cx + 3, cz + 3) * 7), tz = z0 + 4 + Math.floor(hsh(cz + 5, cx + 5) * 7), ty = heightAt(tx, tz);
      if (ty > SEA + 3 && ty < SEA + 16) buildTreasureRoom(tx, ty, tz);
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
  } else if (DIM === "sky") { // sky islands: a central spawn island plus scattered floating islands and clouds
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const d = Math.hypot(x, z);
      if (d < 11) { for (let y = 31; y <= 34; y++) setRaw(x, y, z, y === 34 ? GRASS : STONE); if (d < 8 && hsh(x * 3 + 1, z * 3 + 2) > 0.93) tree(x, 35, z); }   // spawn island
      const fi = vn(x * 0.06 + 300, z * 0.06 + 300);
      if (d > 11 && fi > 0.72) {                                                          // floating islands
        const fy = 28 + Math.floor((fi - 0.72) * 50) + Math.floor(hsh((x / 5) | 0, (z / 5) | 0) * 10);
        const thick = 2 + Math.floor(fi * 3);
        for (let y = fy - thick; y <= fy; y++) setRaw(x, y, z, y === fy ? GRASS : STONE);
        if (hsh(x * 3 + 1, z * 3 + 1) > 0.985) tree(x, fy + 1, z);
        else if (hsh(x * 2 + 5, z * 2 + 5) > 0.99) setRaw(x, fy + 1, z, FIRE_CRYSTAL);     // a shiny loot block
      }
      const cl = vn(x * 0.08 + 50, z * 0.08 + 50);
      if (cl > 0.88) setRaw(x, 46 + Math.floor(hsh(x, z) * 4), z, SNOW);                   // decorative clouds up high
    }
  } else if (DIM === "realm") { // creature battle realm: bright grass plains, tall-grass zones, forests, hills, lakes
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const base = fbm(x * 0.03 + 40, z * 0.03 + 40);
      const h = Math.max(6, Math.min(WORLD_H - 6, Math.floor(SEA + 2 + (base - 0.5) * 22)));
      for (let y = 0; y <= h; y++) { let id = STONE; if (y === h) id = (h <= SEA) ? SAND : (h > SEA + 14 ? SNOW : GRASS); else if (y > h - 3) id = DIRT; setRaw(x, y, z, id); }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);
      if (h > SEA && h <= SEA + 14) {
        const r = hsh(x * 3 + 9, z * 5 + 13);
        if (r > 0.94) tree(x, h + 1, z);
        else if (r > 0.5 && r < 0.86) setRaw(x, h + 1, z, TALLGRASS);   // wide tall-grass encounter zones
      }
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
function giantMushroom(x, y, z) {   // mushroom-forest landmark: a pale stem topped with a red cap
  const th = 3 + (hsh(x * 2 + 1, z * 2 + 5) * 3 | 0);
  for (let i = 0; i < th; i++) setRaw(x, y + i, z, PLANKS);
  const top = y + th;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; if (getBlock(x + dx, top, z + dz) === AIR) setRaw(x + dx, top, z + dz, MUSHROOM); }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (getBlock(x + dx, top + 1, z + dz) === AIR) setRaw(x + dx, top + 1, z + dz, MUSHROOM);
}

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
    const def = BLOCKS[id]; const water = id === WATER; const transp = water || id === TALLGRASS;   // tall grass renders as translucent foliage
    const tint = id === WATER ? 1 : (0.9 + 0.16 * hsh(x * 1.7 + y * 4.3, z * 2.9));
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nb = getBlock(x + F.d[0], y + F.d[1], z + F.d[2]);
      const draw = transp ? (nb === AIR || (!isOpaque(nb) && nb !== id)) : !isOpaque(nb);
      if (!draw) continue;
      const t = transp ? wa : op, base = t.pos.length / 3, col = faceCol(def, f);
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
  chunks.clear(); dirty.clear(); generated.clear(); W.clear(); portalCells.length = 0; portalDest = {}; if (portalMesh) { scene.remove(portalMesh); portalMesh = null; }
  torchCells.length = 0; if (torchMesh) { scene.remove(torchMesh); torchMesh = null; }
}

// portal blocks rendered separately (animated)
const portalCells = [];
let portalDest = {};                 // "x,y,z" -> destination dimension for that portal block
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
// base defense: spike traps damage nearby monsters, alarm bells warn of raids
const spikeCells = [], alarmCells = [], healCells = [], frostCells = [];
function rebuildDefenseCells() {
  spikeCells.length = 0; alarmCells.length = 0; healCells.length = 0; frostCells.length = 0;
  for (const [k, id] of W) {
    if (id === SPIKE) { const p = k.split(","); spikeCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === ALARM) { const p = k.split(","); alarmCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === HEAL) { const p = k.split(","); healCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === FROST) { const p = k.split(","); frostCells.push([+p[0], +p[1], +p[2]]); }
  }
}
// floating "Freda" name plates over the explosive blocks
let fredaLabelGroup = null;
function rebuildFredaLabels() {
  if (fredaLabelGroup) { scene.remove(fredaLabelGroup); fredaLabelGroup = null; }
  const cells = []; for (const [k, id] of W) if (id === FREDA) { const p = k.split(","); cells.push([+p[0], +p[1], +p[2]]); }
  if (!cells.length) return;
  fredaLabelGroup = new THREE.Group();
  for (const c of cells) { const s = makeTag("Freda"); s.scale.set(1.0, 0.26, 1); s.position.set(c[0] + 0.5, c[1] + 1.15, c[2] + 0.5); fredaLabelGroup.add(s); }
  scene.add(fredaLabelGroup);
}

// chest storage (per dimension + position) and player block edits (for save/load)
let chestStore = new Map();           // "dim:x,y,z" -> [9 stacks]
const editsByDim = { overworld: new Map(), fire: new Map(), end: new Map(), sky: new Map(), realm: new Map() };
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
let thirdPerson = false, tpZoom = 4.2;
const dodge = { t: 0, cd: 0, x: 0, z: 0 };
const shake = { t: 0, mag: 0 };
let stepT = 0, movedDist = 0, miningMult = 1, placedBlocks = 0, breathT = 0.2;
let xp = 0, level = 1, xpNext = 50;
const ach = new Set();
function addShake(m) { if (settings.reduceMotion) m *= 0.2; shake.t = 0.28; shake.mag = Math.max(shake.mag, m); }

// Thomas avatar (visible in third person; animated)
const thomas = new THREE.Group();
// the name THOMAS printed on the back of the shirt, drawn to a texture so it sits on the cloth
function makeShirtBack(shirtHex) {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; const x = cv.getContext("2d");
  const col = new THREE.Color(shirtHex), R = col.r * 255 | 0, G = col.g * 255 | 0, B = col.b * 255 | 0;
  x.fillStyle = "rgb(" + R + "," + G + "," + B + ")"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "rgba(0,0,0,0.14)"; x.fillRect(0, 0, 128, 16);                  // collar shade
  const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
  x.fillStyle = lum > 0.55 ? "#15171c" : "#ffffff";
  x.strokeStyle = lum > 0.55 ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)"; x.lineWidth = 5;
  x.font = "900 30px Arial, Helvetica, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.strokeText("THOMAS", 64, 72); x.fillText("THOMAS", 64, 72);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}
(function buildThomas() {
  const skin = 0xdca06b, shirt = 0x2f6fe0, pant = 0x374151, hair = 0x4a2f1a, shoe = 0x2a2a2a;
  const bx = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
  // torso: a 6-material box so the +z face (the back, seen in third person) carries the THOMAS print
  const backTex = makeShirtBack(shirt); const bodyMats = [];
  for (let i = 0; i < 6; i++) bodyMats.push(i === 4 ? new THREE.MeshLambertMaterial({ map: backTex, color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: shirt }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.28), bodyMats); body.position.y = 1.0; thomas.add(body);
  const head = bx(0.42, 0.42, 0.42, skin); head.position.y = 1.53; thomas.add(head);
  const hairTop = bx(0.46, 0.14, 0.46, hair); hairTop.position.y = 1.75; thomas.add(hairTop);
  const hairBack = bx(0.46, 0.3, 0.08, hair); hairBack.position.set(0, 1.58, -0.2); thomas.add(hairBack);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x20242c });            // face on the front (-z)
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.04), eyeMat); eL.position.set(-0.1, 1.55, -0.22); thomas.add(eL);
  const eR = eL.clone(); eR.position.x = 0.1; thomas.add(eR);
  const armL = bx(0.16, 0.5, 0.18, shirt); armL.geometry.translate(0, -0.2, 0); armL.position.set(-0.34, 1.06, 0); thomas.add(armL);
  const handL = bx(0.17, 0.16, 0.2, skin); handL.position.set(0, -0.46, 0); armL.add(handL);
  const armR = bx(0.16, 0.5, 0.18, shirt); armR.geometry.translate(0, -0.2, 0); armR.position.set(0.34, 1.06, 0); thomas.add(armR);
  const handR = bx(0.17, 0.16, 0.2, skin); handR.position.set(0, -0.46, 0); armR.add(handR);
  const legL = bx(0.18, 0.55, 0.2, pant); legL.geometry.translate(0, -0.27, 0); legL.position.set(-0.13, 0.55, 0); thomas.add(legL);
  const shoeL = bx(0.21, 0.13, 0.27, shoe); shoeL.position.set(0, -0.52, 0.03); legL.add(shoeL);
  const legR = bx(0.18, 0.55, 0.2, pant); legR.geometry.translate(0, -0.27, 0); legR.position.set(0.13, 0.55, 0); thomas.add(legR);
  const shoeR = bx(0.21, 0.13, 0.27, shoe); shoeR.position.set(0, -0.52, 0.03); legR.add(shoeR);
  thomas.userData = { armL, armR, legL, legR, body, bodyMats, backTex, hairTop, hairBack };
})();
thomas.visible = false; scene.add(thomas);
// ---------- THOMAS SKINS (cosmetic recolor of the third-person avatar) ----------
const SKINS = [
  { id: "explorer", name: "Explorer Thomas", shirt: 0x2f6fe0, pant: 0x374151, hair: 0x4a2f1a },
  { id: "knight", name: "Knight Thomas", shirt: 0xb8c0cc, pant: 0x4a4f57, hair: 0x4a2f1a },
  { id: "ninja", name: "Ninja Thomas", shirt: 0x1b1b22, pant: 0x111114, hair: 0x111114 },
  { id: "fire", name: "Fire Armor Thomas", shirt: 0xff5a1e, pant: 0x7a1d05, hair: 0x4a2f1a },
  { id: "dragon", name: "Dragon Armor Thomas", shirt: 0x6a2ca0, pant: 0x1b1030, hair: 0x120a22 },
  { id: "golden", name: "Golden Thomas", shirt: 0xf0c419, pant: 0xc9a227, hair: 0x8a6f1a },
  { id: "builder", name: "Builder Thomas", shirt: 0xe8862a, pant: 0x6e4a25, hair: 0x4a2f1a },
  { id: "shadow", name: "Shadow Thomas", shirt: 0x141420, pant: 0x0c0c14, hair: 0x0c0c14 }
];
let currentSkin = "explorer";
function applySkin(id) {
  const s = SKINS.find(x => x.id === id) || SKINS[0]; currentSkin = s.id; const u = thomas.userData; if (!u) return;
  // recolour the torso faces and regenerate the THOMAS back print in the new shirt colour
  if (u.bodyMats) {
    for (let i = 0; i < 6; i++) {
      if (i === 4) { const nt = makeShirtBack(s.shirt); if (u.bodyMats[4].map && u.bodyMats[4].map.dispose) u.bodyMats[4].map.dispose(); u.bodyMats[4].map = nt; if (u.bodyMats[4].color) u.bodyMats[4].color.setHex(0xffffff); u.bodyMats[4].needsUpdate = true; u.backTex = nt; }
      else if (u.bodyMats[i].color) u.bodyMats[i].color.setHex(s.shirt);
    }
  } else if (u.body && u.body.material.color) u.body.material.color.setHex(s.shirt);
  if (u.armL && u.armL.material.color) u.armL.material.color.setHex(s.shirt);
  if (u.armR && u.armR.material.color) u.armR.material.color.setHex(s.shirt);
  if (u.legL && u.legL.material.color) u.legL.material.color.setHex(s.pant);
  if (u.legR && u.legR.material.color) u.legR.material.color.setHex(s.pant);
  if (u.hairTop && u.hairTop.material.color) u.hairTop.material.color.setHex(s.hair);
  if (u.hairBack && u.hairBack.material.color) u.hairBack.material.color.setHex(s.hair);
  try { localStorage.setItem("thomas_voxel_skin", id); } catch (e) {}
}
function loadSkin() { try { const id = localStorage.getItem("thomas_voxel_skin"); if (id) applySkin(id); } catch (e) {} }

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
let xpMult = 1;                                      // boosted during a Golden Day event
function addXP(n) {
  xp += Math.round(n * xpMult);
  while (xp >= xpNext) { xp -= xpNext; level++; xpNext = Math.floor(xpNext * 1.35); levelUp(); }
  updateXPUI();
}
function levelUp() {
  skills.pts++; player.hp = Math.min(player.maxHp, player.hp + 4); SFX.levelUp();
  showBanner("Level " + level + "! Skill point earned"); toast("Level up. Spend your point in Skills.");
  addShake(settings.reduceMotion ? 0.06 : 0.18);
  for (let i = 0; i < 3; i++) hitSpark({ x: player.pos.x + (Math.random() - .5) * 1.2, y: player.pos.y + 1 + Math.random() * 1.2, z: player.pos.z + (Math.random() - .5) * 1.2 }, 0xffe066);
  updateVitals(); renderSkills();
}
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
  { id: "skyboss", label: "Sky Beast Slain", desc: "Defeat the Sky Serpent", test: () => ach.has("skyboss") },
  { id: "daily", label: "Daily Challenger", desc: "Complete a daily challenge", test: () => ach.has("daily") },
  { id: "raid", label: "Raid Defender", desc: "Survive a night raid", test: () => ach.has("raid") },
  { id: "treasure", label: "Treasure Hunter", desc: "Dig up buried treasure", test: () => ach.has("treasure") },
  { id: "cheeseking", label: "Cheese King Caught", desc: "Catch the Cheese King mouse", test: () => ach.has("cheeseking") },
  { id: "ninja", label: "Ninja Catcher", desc: "Catch a ninja mouse", test: () => ach.has("ninja") },
  { id: "dragon", label: "Dragon Defeated", desc: "Slay the Black Dragon", test: () => false }
];
function checkAchievements() { for (const a of ACHDEFS) if (!ach.has(a.id)) { try { if (a.test()) achieve(a.id, a.label); } catch (e) {} } }
function renderAch() {
  const el = document.getElementById("achList"); if (!el) return;
  el.innerHTML = ACHDEFS.map(a => { const got = ach.has(a.id); return '<div class="arow ' + (got ? "got" : "") + '"><b>' + (got ? "★ " : "☆ ") + a.label + "</b><span>" + a.desc + "</span></div>"; }).join("");
  const n = ACHDEFS.filter(a => ach.has(a.id)).length; const h = document.getElementById("achCount"); if (h) h.textContent = n + " / " + ACHDEFS.length;
}
function toggleAch() { const o = $("ach"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderAch(); o.classList.remove("hidden"); } }

// ---------- COLLECTIONS (cat collection + monster bestiary, long term goals) ----------
const catsFound = new Set(), mobsFound = new Set();
const COLL_KEY = "thomas_voxel_collections";
const CAT_NAMES = { orange: "Orange Tabby", black: "Black Cat", white: "Snow Cat", gray: "Gray Cat", tabby: "Tabby Cat" };
const MOB_NAMES = { crawler: "Crawler", brute: "Purple Brute", spitter: "Spitter", ghost: "Ghost", screamer: "Screamer", miner: "Miner", firedemon: "Fire Demon", lavaworm: "Lava Worm", shadowknight: "Shadow Knight", endstalker: "End Stalker" };
function saveColl() { try { localStorage.setItem(COLL_KEY, JSON.stringify({ cats: [...catsFound], mobs: [...mobsFound] })); } catch (e) {} }
function loadColl() { try { const d = JSON.parse(localStorage.getItem(COLL_KEY)); if (d) { (d.cats || []).forEach(c => catsFound.add(c)); (d.mobs || []).forEach(m => mobsFound.add(m)); } } catch (e) {} }
function discoverCat(color) { if (!color || catsFound.has(color)) return; catsFound.add(color); saveColl(); toast("New cat in your collection: " + (CAT_NAMES[color] || color)); SFX.pickup(); if (typeof renderColl === "function") renderColl(); checkCollComplete(); }
function discoverMob(type) { if (!type || !MTYPE[type] || mobsFound.has(type)) return; mobsFound.add(type); saveColl(); toast("Bestiary updated: " + (MOB_NAMES[type] || type)); if (typeof renderColl === "function") renderColl(); checkCollComplete(); }
function checkCollComplete() {
  if (CAT_COLORS.every(c => catsFound.has(c.n))) achieve("catcollector", "Cat Collector");
  if (Object.keys(MTYPE).every(t => mobsFound.has(t))) achieve("bestiary", "Monster Hunter");
}
function renderColl() {
  const el = $("collList"); if (!el) return;
  const hd = t => '<div class="muted" style="font-size:12px;letter-spacing:1px;margin:8px 0 4px">' + t + "</div>";
  let html = hd("CATS");
  for (const c of CAT_COLORS) { const got = catsFound.has(c.n); html += '<div class="arow ' + (got ? "got" : "") + '"><b>' + (got ? "★ " : "☆ ") + (got ? (CAT_NAMES[c.n] || c.n) : "? ? ?") + "</b><span>" + (got ? ("ability: " + catAbilityDesc(catAbility(c.n))) : "undiscovered cat") + "</span></div>"; }
  html += hd("BESTIARY");
  for (const t of Object.keys(MTYPE)) { const got = mobsFound.has(t); html += '<div class="arow ' + (got ? "got" : "") + '"><b>' + (got ? "★ " : "☆ ") + (got ? (MOB_NAMES[t] || t) : "? ? ?") + "</b><span>" + (got ? "defeated" : "not yet defeated") + "</span></div>"; }
  el.innerHTML = html;
  const found = catsFound.size + mobsFound.size, tot = CAT_COLORS.length + Object.keys(MTYPE).length;
  const h = $("collCount"); if (h) h.textContent = found + " / " + tot + " (" + Math.round(100 * found / tot) + "%)";
}
function toggleColl() { const o = $("collections"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderColl(); o.classList.remove("hidden"); } }
// ---------- TROPHY HALL (big victories + milestones, earned from achievements) ----------
const TROPHIES = [
  { ic: "🐱", name: "First Friend", desc: "Tame your first cat", id: "cat" },
  { ic: "🌙", name: "Night Survivor", desc: "Survive a night", id: "night" },
  { ic: "🗡️", name: "Beast Slayer", desc: "Defeat 10 monsters", id: "slayer" },
  { ic: "🏗️", name: "Builder", desc: "Build a shelter", id: "shelter" },
  { ic: "💰", name: "Treasure Hunter", desc: "Dig up buried treasure", id: "treasure" },
  { ic: "🐭", name: "Ninja Catcher", desc: "Catch a ninja mouse", id: "ninja" },
  { ic: "🧀", name: "Cheese Champion", desc: "Catch the Cheese King", id: "cheeseking" },
  { ic: "🐈", name: "Cat Collector", desc: "Befriend every cat", id: "catcollector" },
  { ic: "📖", name: "Monster Hunter", desc: "Defeat every monster", id: "bestiary" },
  { ic: "🔥", name: "Fire Guardian", desc: "Defeat the Fire Guardian", id: "fireboss" },
  { ic: "🏝️", name: "Sky Serpent", desc: "Defeat the Sky Serpent", id: "skyboss" },
  { ic: "🐲", name: "Dragon Slayer", desc: "Defeat the Black Dragon", id: "dragon" }
];
function renderTrophies() {
  const el = $("trophyList"); if (!el) return; el.innerHTML = ""; let n = 0;
  for (const t of TROPHIES) { const got = ach.has(t.id); if (got) n++; const d = document.createElement("div"); d.className = "trophy" + (got ? " got" : ""); d.innerHTML = "<div class='ti'>" + (got ? t.ic : "❔") + "</div><div class='tn'>" + (got ? t.name : "???") + "</div><div class='td'>" + t.desc + "</div>"; el.appendChild(d); }
  const h = $("trophyCount"); if (h) h.textContent = n + " / " + TROPHIES.length;
}
function toggleTrophies() { const o = $("trophies"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderTrophies(); o.classList.remove("hidden"); } }
function renderWardrobe() {
  const l = $("catCosList"); if (!l) return; l.innerHTML = "";
  const tamed = cats.filter(c => c.tamed).length;
  for (const c of COSMETICS) {
    const on = catCosmetic === c.id; const row = document.createElement("div"); row.className = "craftRow" + (on ? "" : " no");
    row.innerHTML = "<span><b>" + c.ic + " " + c.name + "</b>" + (on ? " <span class='muted'>(worn)</span>" : "") + "</span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = on ? "On" : "Wear";
    b.addEventListener("pointerdown", e => { e.preventDefault(); setCatCosmetic(c.id); });
    row.appendChild(b); l.appendChild(row);
  }
  if (!tamed) { const note = document.createElement("div"); note.className = "muted"; note.style.cssText = "font-size:12px;margin-top:6px"; note.textContent = "Tame a cat to see the accessory."; l.appendChild(note); }
}
function toggleWardrobe() { const o = $("catwardrobe"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderWardrobe(); o.classList.remove("hidden"); } }
function renderSkinPick() {
  const l = $("skinList"); if (!l) return; l.innerHTML = "";
  for (const s of SKINS) {
    const on = s.id === currentSkin; const row = document.createElement("div"); row.className = "craftRow" + (on ? "" : " no");
    row.innerHTML = "<span><b>" + s.name + "</b>" + (on ? " <span class='muted'>(equipped)</span>" : "") + "</span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = on ? "On" : "Wear";
    b.addEventListener("pointerdown", e => { e.preventDefault(); applySkin(s.id); SFX.pickup(); renderSkinPick(); });
    row.appendChild(b); l.appendChild(row);
  }
}
function toggleSkinPick() { const o = $("skinpicker"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderSkinPick(); o.classList.remove("hidden"); } }
// Character screen: spins Thomas so the player can see his outfit and the THOMAS print on his back
let charView = false, charAngle = 0;
function openCharacter() { charView = true; charAngle = 0; renderSkinPick(); show("skinpicker"); document.exitPointerLock(); }
function closeCharacter() { charView = false; hide("skinpicker"); thomas.visible = false; if (!isTouch && running && !paused) canvas.requestPointerLock(); }

// SKILL TREE
const skills = { pts: 0, mine: 0, hp: 0, stam: 0, sword: 0, cat: 0, armor: 0, swift: 0, luck: 0 };
let swordBonus = 0, catMult = 1, armorReduce = 0, swiftMult = 1, luckBonus = 0;
const SKILLDEF = [
  { k: "mine", name: "Mining Speed", ic: "⛏️", max: 5, desc: "+15% mine speed per point" },
  { k: "hp", name: "Max Health", ic: "❤️", max: 5, desc: "+2 hearts per point" },
  { k: "stam", name: "Max Stamina", ic: "⚡", max: 5, desc: "+20 stamina per point" },
  { k: "sword", name: "Sword Damage", ic: "🗡️", max: 5, desc: "+2 damage per point" },
  { k: "cat", name: "Cat Damage", ic: "🐾", max: 5, desc: "+30% cat damage per point" },
  { k: "armor", name: "Armor", ic: "🛡️", max: 5, desc: "-8% damage taken per point" },
  { k: "swift", name: "Swiftness", ic: "👟", max: 5, desc: "+6% move speed per point" },
  { k: "luck", name: "Luck", ic: "🍀", max: 5, desc: "+coins and better loot per point" }
];
function applySkills() { miningMult = 1 + skills.mine * 0.15; player.maxHp = 20 + skills.hp * 4; player.maxStam = 100 + skills.stam * 20; swordBonus = skills.sword * 2; catMult = 1 + skills.cat * 0.3; armorReduce = Math.min(0.45, skills.armor * 0.08); swiftMult = 1 + skills.swift * 0.06; luckBonus = skills.luck; }
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
  let sp = sprint ? 6.0 : 4.2; if (powerActive("speed")) sp *= 1.5; sp *= swiftMult; if (crouch) sp = 2.0;
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
  const jumpEdge = wantJump && !player._jumpHeld; player._jumpHeld = wantJump;
  if (wantJump && (player.onGround || player.coyote > 0)) { player.vel.y = jumpV * (powerActive("jump") ? 1.42 : 1); player.onGround = false; player.coyote = 0; player.djUsed = false; SFX.jump(); }
  else if (jumpEdge && powerActive("doublejump") && !player.onGround && !player.djUsed) { player.vel.y = jumpV * 1.1; player.djUsed = true; SFX.jump(); for (let i = 0; i < 4; i++) hitSpark({ x: player.pos.x, y: player.pos.y + 0.2, z: player.pos.z }, 0xbff0ff); }
  if (powerActive("glide") && !player.onGround && wantJump && player.vel.y < -2.5) player.vel.y = -2.5;   // Glide Cape: slow descent
  // substep to prevent tunneling
  player.onGround = false;
  const steps = Math.max(1, Math.ceil((Math.abs(player.vel.x) + Math.abs(player.vel.y) + Math.abs(player.vel.z)) * dt / 0.4));
  const sdt = dt / steps; let hitX = false, hitZ = false;
  for (let i = 0; i < steps; i++) {
    if (moveAxis("x", player.vel.x * sdt)) hitX = true;
    if (moveAxis("z", player.vel.z * sdt)) hitZ = true;
    moveAxis("y", player.vel.y * sdt);
  }
  if (player.onGround) { player.coyote = 0.12; player.djUsed = false; } else if (player.coyote > 0) player.coyote -= dt;
  // bounce block: landing on slime launches Thomas high (trampoline toy)
  if (player.onGround) { const below = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)); const bb = BLOCKS[below]; if (bb && bb.launch) { player.vel.y = 22; player.onGround = false; player.coyote = 0; SFX.jump(); SFX.zap(); addShake(0.12); } else if (bb && bb.bouncy) { player.vel.y = 13; player.onGround = false; player.coyote = 0; SFX.jump(); addShake(0.05); } }
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
    let dist = tpZoom;
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
    if (!player.onGround) { thomas.userData.legL.rotation.x = -0.55; thomas.userData.legR.rotation.x = 0.4; thomas.userData.armL.rotation.x = -0.7; if (swing <= 0) thomas.userData.armR.rotation.x = -0.7; }   // jump pose
    else if (primaryHeld && swing <= 0) { thomas.userData.armR.rotation.x = -1.1 + Math.sin(performance.now() * 0.018) * 0.5; }                                                                                  // mining/working swing
    thomas.scale.set(1, player._crouch ? 0.78 : 1, 1);
  } else thomas.visible = false;
  sun.position.set(player.pos.x + lightDir.x * 80, player.pos.y + lightDir.y * 90 + 10, player.pos.z + lightDir.z * 80);
  sun.target.position.set(player.pos.x, player.pos.y, player.pos.z);
  if (player.hurtCd > 0) player.hurtCd -= dt;
}
function damage(n) {
  if (!running) return;
  if (player.hurtCd > 0 && n < 1) return;
  if (powerActive("shield") && n >= 1) { hurtFlash(); player.hurtCd = 0.3; return; }   // Shield Bubble absorbs hits
  n *= (1 - armorReduce);                                                               // Armor skill reduces damage
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
  if (!running && deathT && !$("death").classList.contains("hidden") && (e.code === "Space" || e.code === "Enter") && performance.now() - deathT > 600) { doRespawn(); return; }
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
  if (e.code === "KeyH") primaryHeld = true;   // H breaks/hits just like the trackpad, without nudging the view
  if (e.code === "Escape") togglePause();
});
addEventListener("keyup", e => { keys[e.code] = false; if (e.code === "KeyH") { primaryHeld = false; mineReset(); } });
canvas.addEventListener("mousedown", e => { if (!running || paused) return; if (!isTouch && !pointerLocked) { canvas.requestPointerLock(); return; } if (e.button === 0) { primaryHeld = true; } if (e.button === 2) placeBlock(); });
canvas.addEventListener("mouseup", e => { if (e.button === 0) { primaryHeld = false; mineReset(); } });
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("wheel", e => { if (!running) return; selectSlot((selSlot + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
addEventListener("mousemove", e => { if (!pointerLocked) return; player.yaw -= e.movementX * settings.sensD; player.pitch -= e.movementY * settings.sensD; clampPitch(); });
addEventListener("wheel", e => { if (!thirdPerson) return; tpZoom = Math.max(1.8, Math.min(9, tpZoom + (e.deltaY > 0 ? 0.6 : -0.6))); }, { passive: true });
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
  const onBtn = t => t.target && t.target.closest && t.target.closest("#minimap,.tc,.slot,.btn,.seg,.cell,.craftRow,input");
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
  // ranged weapons fire instead of mining/meleeing
  const tBow = currentTool();
  if (tBow && tBow.tool === "bow") { if (bowCd <= 0) { bowCd = 0.55; firePlayerShot(tBow.special); } return; }
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
    if (r.id === CHEST) collectChest(chestKey(r.x, r.y, r.z));
    if (r.id === FREDA) { fredaEvent(r.x, r.y, r.z); }
    setRaw(r.x, r.y, r.z, AIR); recordEdit(r.x, r.y, r.z, AIR);
    if (r.id === PORTAL) rebuildPortalCells();
    if (r.id === TORCH) rebuildTorchCells();
    if (r.id === SPIKE || r.id === ALARM || r.id === HEAL || r.id === FROST) rebuildDefenseCells();
    if (r.id === FREDA) rebuildFredaLabels();
    markDirty(r.x, r.z); markDirty(r.x + 1, r.z); markDirty(r.x - 1, r.z); markDirty(r.x, r.z + 1); markDirty(r.x, r.z - 1);
    blockParticles(r.x, r.y, r.z, BLOCKS[r.id].top);
    if (drop !== undefined) addItem(drop, 1);
    const tBoom = currentTool(); if (tBoom && tBoom.special === "boom") boomBreak(r.x, r.y, r.z);
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
  if (it.id === SPIKE || it.id === ALARM || it.id === HEAL || it.id === FROST) rebuildDefenseCells();
  if (it.id === FREDA) rebuildFredaLabels();
  if (it.id === CHEST && !chestStore.has(chestKey(tx, ty, tz))) chestStore.set(chestKey(tx, ty, tz), new Array(9).fill(null));
  removeItem(selSlot, 1); SFX.place(); placedBlocks++; dailyTick("build", 1);
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
  { out: I_BOOMPICK, n: 1, need: [[COBBLE, 8], [I_STICK, 3]] },
  { out: I_ICEBOW, n: 1, need: [[PLANKS, 3], [I_STICK, 3]] },
  { out: I_SLIMELAUNCH, n: 1, need: [[BOUNCE, 2], [I_STICK, 2]] },
  { out: BOUNCE, n: 2, need: [[LEAVES, 4], [PLANKS, 1]] },
  { out: SPIKE, n: 2, need: [[COBBLE, 2], [I_STICK, 1]] },
  { out: ALARM, n: 1, need: [[COBBLE, 3], [I_STICK, 1]] },
  { out: FREDA, n: 1, need: [[COBBLE, 3], [FIRE_CRYSTAL, 1]] },
  { out: I_CRYSTALSPEAR, n: 1, need: [[CRYSTAL, 3], [I_STICK, 2]] },
  { out: LAUNCH, n: 1, need: [[BOUNCE, 1], [FIRE_CRYSTAL, 1]] },
  { out: HEAL, n: 1, need: [[CRYSTAL, 1], [I_APPLE, 2]] },
  { out: FROST, n: 1, need: [[CRYSTAL, 2], [SNOW, 2]] }
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
      ? (rl < 0.5 ? "crawler" : rl < 0.68 ? "brute" : rl < 0.82 ? "spitter" : rl < 0.92 ? "ghost" : rl < 0.97 ? "screamer" : "miner")  // mostly crawlers, fewer elites types
      : (rl < 0.55 ? "crawler" : rl < 0.82 ? "brute" : "miner"); }
  const cfg = MTYPE[type], elite = Math.random() < 0.05, sc = cfg.sc * (elite ? 1.5 : 1), col = cfg.col;
  const dayMul = Math.min(1.8, 1 + 0.035 * (day - 1));   // gentler growth over days
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
  const hp = Math.max(1, Math.round(cfg.hp * (elite ? 2 : 1) * dayMul * 0.66 * ngMul));   // easier base, scaled up by New Game Plus
  monsters.push({ g, type, hp, max: hp, speed: cfg.speed, dmg: Math.max(1, Math.round(cfg.dmg * (elite ? 1.5 : 1) * dayMul * 0.7 * (1 + (ngMul - 1) * 0.6))), xp: Math.round(cfg.xp * (elite ? 2.5 : 1)),
    ranged: !!cfg.ranged, ghost: !!cfg.ghost, slam: !!cfg.slam, summon: !!cfg.summon, digger: !!cfg.digger, flee: !!cfg.flee, elite,
    loot: cfg.loot || [], emBase, shootCd: 1.6, summonCd: 4 + Math.random() * 4, digCd: 1.5, touch: 0, flash: 0, windup: 0, slamCd: 0,
    bar, mark, body, legL, legR, armL, armR, moveT: 0, dir: Math.random() * 6.28, state: "idle", aggro: false, dead: false, dt: 0 });
}
function surfaceY(x, z) { for (let y = WORLD_H - 1; y >= 0; y--) if (isSolidBlock(getBlock(Math.floor(x), y, Math.floor(z)))) return y + 1; return SEA + 1; }
// gravity for creatures: fall with acceleration when unsupported (so they drop if you dig under them), step up onto ground
function fallToGround(o, dt) {
  const gy = surfaceY(o.g.position.x, o.g.position.z);
  if (o.g.position.y > gy + 0.05) { o._vy = (o._vy || 0) - 26 * dt; o.g.position.y += o._vy * dt; if (o.g.position.y <= gy) { o.g.position.y = gy; o._vy = 0; } }
  else { o.g.position.y += (gy - o.g.position.y) * Math.min(1, dt * 12); o._vy = 0; }
}
function updateMonsters(dt) {
  const night = isNight();
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m.dead) { m.dt += dt; m.g.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 3)); m.g.rotation.z += dt * 6; m.g.position.y -= dt * 1.5; if (m.dt > 0.5) { scene.remove(m.g); monsters.splice(i, 1); } continue; }
    const dx = player.pos.x - m.g.position.x, dz = player.pos.z - m.g.position.z, d = Math.hypot(dx, dz) || 0.0001;
    const aggroR = (night ? 13 : 10) + (m.summon ? 4 : 0) + (m.elite ? 3 : 0);
    if (!m.aggro && d < aggroR) { m.aggro = true; m.summon ? SFX.screech() : SFX.growl(); }
    else if (m.aggro && d > aggroR * 1.7) { m.aggro = false; }
    if (m.flash > 0) m.flash -= dt;
    if (m.slow > 0) { m.slow -= dt; if (m.slow <= 0 && m._bspd) m.speed = m._bspd; }   // ice slow wears off
    if (frostCells.length) { m.frostCd = (m.frostCd || 0) - dt; if (m.frostCd <= 0) { for (const c of frostCells) { if (Math.hypot(c[0] + 0.5 - m.g.position.x, c[2] + 0.5 - m.g.position.z) < 3 && Math.abs(c[1] + 1 - m.g.position.y) < 2.5) { if (!m._bspd) m._bspd = m.speed; m.speed = m._bspd * 0.4; m.slow = Math.max(m.slow || 0, 1.2); m.flash = 0.1; hitSpark(m.g.position, 0xbfe8ff); m.frostCd = 1; break; } } if (m.frostCd <= 0) m.frostCd = 0.5; } }   // Frost blocks freeze nearby monsters
    if (m.burn > 0) { m.burn -= dt; m.burnTick -= dt; if (m.burnTick <= 0) { m.burnTick = 0.5; m.hp -= 2; m.flash = 0.1; m.bar.up(Math.max(0, m.hp / m.max)); hitSpark(m.g.position, 0xff7a2a); if (m.hp <= 0 && !m.dead) { killMonster(m); continue; } } }
    if (spikeCells.length) { m.spikeCd = (m.spikeCd || 0) - dt; if (m.spikeCd <= 0) { for (const c of spikeCells) { const sdx = c[0] + 0.5 - m.g.position.x, sdz = c[2] + 0.5 - m.g.position.z; if (sdx * sdx + sdz * sdz < 1.2 && Math.abs(c[1] + 1 - m.g.position.y) < 1.6) { m.hp -= 4; m.flash = 0.12; m.bar.up(Math.max(0, m.hp / m.max)); hitSpark(m.g.position, 0xcfd6e0); m.spikeCd = 0.6; break; } } if (m.hp <= 0 && !m.dead) { killMonster(m); continue; } } }
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
      if (m.summon && m.summonCd <= 0 && d < aggroR && monsters.length < (night ? 8 : 5)) { m.summonCd = 15; SFX.screech(); const a = Math.random() * 6.28; spawnMonster(Math.floor(m.g.position.x + Math.cos(a) * 3), Math.floor(m.g.position.z + Math.sin(a) * 3), "crawler"); }
      if (m.digger && m.digCd <= 0 && d > 1.2) {
        const bx = Math.floor(m.g.position.x + (dx / d) * 0.8), bz = Math.floor(m.g.position.z + (dz / d) * 0.8), by = Math.floor(m.g.position.y + 0.5);
        let dug = false;
        for (const yy of [by, by + 1]) { const id = getBlock(bx, yy, bz); if (isSolidBlock(id) && BLOCKS[id] && BLOCKS[id].hard < 1) { setRaw(bx, yy, bz, AIR); markDirty(bx, bz); markDirty(bx + 1, bz); markDirty(bx - 1, bz); markDirty(bx, bz + 1); markDirty(bx, bz - 1); SFX.dig(); m.digCd = 0.9; dug = true; break; } }
        if (!dug) m.digCd = 0.5;
      }
    }
    if (m.body && m.body.material.emissive) m.body.material.emissive.setHex(m.flash > 0 ? 0x771018 : (m.emBase || 0x000000));
    fallToGround(m, dt);     // gravity: falls if the ground is dug out, steps up onto hills
    if (moving && m.windup <= 0) { m.moveT += dt * 9; const s = Math.sin(m.moveT) * 0.5; m.legL.rotation.x = s; m.legR.rotation.x = -s; m.armL.rotation.x = -s; m.armR.rotation.x = s; }
    else if (m.windup <= 0) { m.legL.rotation.x *= 0.8; m.legR.rotation.x *= 0.8; }
  }
  // spawning
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (DIM === "overworld") {
      spawnTimer = isNight() ? 6.5 : 16;
      const cap = isNight() ? 5 : 3;             // gentler raids: fewer monsters, slower spawns, time to react
      if (monsters.length < cap) {
        const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 8;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        if (!nearTorch(sxp, szp, 9)) spawnMonster(sxp, szp);
      }
    } else if (DIM === "fire") {
      spawnTimer = 7;
      if (monsters.length < 4) {
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
    } else if (DIM === "sky") {
      spawnTimer = 7;
      if (monsters.length < 4) {
        const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 6;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        spawnMonster(sxp, szp, Math.random() < 0.6 ? "ghost" : "crawler");
      }
    }
  }
  // alarm bells ring when monsters raid the base at night
  if (alarmCells.length && isNight()) { alarmCd -= dt; if (alarmCd <= 0) { for (const c of alarmCells) { let near = false; for (const m of monsters) if (!m.dead && Math.hypot(c[0] + 0.5 - m.g.position.x, c[2] + 0.5 - m.g.position.z) < 12) { near = true; break; } if (near) { alarmCd = 8; SFX.screech(); showBanner("Alarm! Monsters are raiding the base."); break; } } } }
}
let spawnTimer = 6, alarmCd = 0, blockHealCd = 0;
// heal blocks mend Thomas when he stands near one
function updateBlockPowers(dt) {
  if (!healCells.length) return;
  blockHealCd -= dt; if (blockHealCd > 0) return; blockHealCd = 0.5;
  for (const c of healCells) {
    if (Math.hypot(c[0] + 0.5 - player.pos.x, c[2] + 0.5 - player.pos.z) < 2.6 && Math.abs(c[1] + 1 - player.pos.y) < 2.2) {
      if (player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 1); updateVitals(); hitSpark(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0x7cf0a0); }
      blockHealCd = 1.5; break;
    }
  }
}

// ---------- ANIMALS (cats + mice) ----------
let cats = [], mice = [];
const CAT_COLORS = [{ n: "orange", c: 0xe8862a }, { n: "black", c: 0x2b2b2b }, { n: "white", c: 0xeeeeee }, { n: "gray", c: 0x8a8a8a }, { n: "tabby", c: 0xa9702f }];
// each colour gives a tamed cat a passive ability: white heals, orange/tabby fight harder, black/gray scout for danger
function catAbility(color) { if (color === "white") return "heal"; if (color === "orange" || color === "tabby") return "fury"; if (color === "black" || color === "gray") return "scout"; return "balanced"; }
function catAbilityDesc(a) { return a === "heal" ? "heals Thomas" : a === "fury" ? "fights harder" : a === "scout" ? "senses danger" : "loyal helper"; }
function bxm(w, h, d, col) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); }
// ---------- CAT COSMETICS (collars, hats, crowns worn by your tamed cats) ----------
const COSMETICS = [
  { id: "none", name: "None", ic: "🚫" },
  { id: "collar", name: "Collar", ic: "📿" },
  { id: "bowtie", name: "Bow Tie", ic: "🎀" },
  { id: "tophat", name: "Top Hat", ic: "🎩" },
  { id: "crown", name: "Crown", ic: "👑" },
  { id: "shades", name: "Sunglasses", ic: "🕶️" },
  { id: "wings", name: "Tiny Wings", ic: "🪽" }
];
let catCosmetic = "none";
function buildCatCosmetic(id) {
  if (!id || id === "none") return null;
  const g = new THREE.Group();
  if (id === "collar") { const c = bxm(0.3, 0.07, 0.22, 0xff3b6b); c.position.set(0, 0.36, 0.26); g.add(c); const tag = bxm(0.06, 0.06, 0.03, 0xffd23d); tag.position.set(0, 0.31, 0.37); g.add(tag); }
  else if (id === "bowtie") { const c = bxm(0.16, 0.1, 0.05, 0x9b1c2e); c.position.set(0, 0.36, 0.5); g.add(c); }
  else if (id === "tophat") { const brim = bxm(0.34, 0.04, 0.34, 0x16181d); brim.position.set(0, 0.62, 0.36); g.add(brim); const top = bxm(0.22, 0.2, 0.22, 0x16181d); top.position.set(0, 0.74, 0.36); g.add(top); }
  else if (id === "crown") { const band = bxm(0.3, 0.1, 0.3, 0xffd23d); band.position.set(0, 0.66, 0.36); g.add(band); for (const px of [-0.1, 0, 0.1]) { const sp = bxm(0.05, 0.1, 0.05, 0xffe98a); sp.position.set(px, 0.74, 0.36); g.add(sp); } }
  else if (id === "shades") { const bar = bxm(0.3, 0.08, 0.03, 0x111114); bar.position.set(0, 0.49, 0.5); g.add(bar); }
  else if (id === "wings") { const wl = bxm(0.05, 0.18, 0.3, 0xbfe3ff); wl.position.set(-0.16, 0.42, -0.05); wl.rotation.y = 0.4; g.add(wl); const wr = bxm(0.05, 0.18, 0.3, 0xbfe3ff); wr.position.set(0.16, 0.42, -0.05); wr.rotation.y = -0.4; g.add(wr); }
  return g;
}
function applyCatCosmetic(cat) { if (cat.cosmeticMesh) { cat.g.remove(cat.cosmeticMesh); cat.cosmeticMesh = null; } const m = buildCatCosmetic(catCosmetic); if (m) { cat.g.add(m); cat.cosmeticMesh = m; } }
function setCatCosmetic(id) { catCosmetic = id; try { localStorage.setItem("thomas_voxel_catcos", id); } catch (e) {} for (const c of cats) if (c.tamed) applyCatCosmetic(c); if (typeof renderWardrobe === "function") renderWardrobe(); SFX.meow(); }
function loadCatCosmetic() { try { const id = localStorage.getItem("thomas_voxel_catcos"); if (id) catCosmetic = id; } catch (e) {} }
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
  const ability = catAbility(pick.n);
  const wild = !opts.tamed && !opts.name;
  const rare = wild && Math.random() < 0.12;                  // rare named cats with a glowing collar
  const RARE_NAMES = { heal: "Snowball", fury: "Sparky", scout: "Shadow", balanced: "Patches" };
  const name = opts.name || (rare ? RARE_NAMES[ability] : null);
  if (rare) { const collar = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(120,220,255,0.9)", "rgba(60,140,255,0)"), depthWrite: false, transparent: true, fog: false })); collar.scale.set(0.85, 0.85, 1); collar.position.set(0, 0.5, 0.12); g.add(collar); }
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  cats.push({ g, dir: Math.random() * 6.28, tamed: !!opts.tamed, friendly: !!opts.friendly, name: name, rare: rare, hp: 10, level: opts.level || (rare ? 2 : 1), kills: 0, mode: opts.mode || "follow", stay: new THREE.Vector3(x + 0.5, 0, z + 0.5), meow: Math.random() * 6, warnCd: 0, healCd: 0, ability: ability, legs, tail, walkT: 0, moved: false, color: pick.n });
  if (opts.tamed) applyCatCosmetic(cats[cats.length - 1]);
}
function spawnMouse(x, z) {
  const cheese = Math.random() < 0.02;                        // Cheese King: a rare, big golden mouse
  const golden = !cheese && Math.random() < 0.08;
  const ninja = !cheese && !golden && Math.random() < 0.06;   // ninja mouse: darts in, steals coins, flees
  const col = cheese ? 0xffcf3a : golden ? 0xe8c23a : ninja ? 0x35363d : [0xb9b9c2, 0x8a6a4a, 0xeeeeee][Math.floor(Math.random() * 3)];
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: col, emissive: (golden || cheese) ? 0x7a5a00 : ninja ? 0x3a0000 : 0x000000, emissiveIntensity: (golden || cheese) ? 0.5 : ninja ? 0.4 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), mat); body.position.set(0, 0.09, 0); g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.12), mat); head.position.set(0, 0.1, 0.16); g.add(head);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), mat); earL.position.set(-0.06, 0.16, 0.15); g.add(earL);
  const earR = earL.clone(); earR.position.x = 0.06; g.add(earR);
  const eMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), eMat); eL.position.set(-0.04, 0.11, 0.22); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.04; g.add(eR);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.26), mat); tail.geometry.translate(0, 0, -0.13); tail.position.set(0, 0.09, -0.12); tail.rotation.x = -0.2; g.add(tail);
  if (cheese) { const crown = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.14), new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0x8a6f1a, emissiveIntensity: 0.6 })); crown.position.set(0, 0.22, 0.12); g.add(crown); g.scale.setScalar(1.8); }
  if (ninja) { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,70,70,0.85)", "rgba(150,0,0,0)"), depthWrite: false, transparent: true, fog: false })); glow.scale.set(0.5, 0.5, 1); glow.position.set(0, 0.18, 0); g.add(glow); }
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  mice.push({ g, dir: Math.random() * 6.28, tail, golden, cheese, ninja, stolen: false, steal: 0, t: Math.random() * 6 });
}
function wander(o, dt, sp) { if (Math.random() < 0.012) o.dir += (Math.random() - .5) * 1.6; o.g.position.x += Math.sin(o.dir) * sp * dt; o.g.position.z += Math.cos(o.dir) * sp * dt; o.g.rotation.y = o.dir; fallToGround(o, dt); }
function removeMouse(ms) { scene.remove(ms.g); mice = mice.filter(x => x !== ms); spawnMouse((player.pos.x + (Math.random() - .5) * 30) | 0, (player.pos.z + (Math.random() - .5) * 30) | 0); }
function mouseCaught(ms) {
  if (ms.cheese) { addCoins(25); addXP(60); addItem(I_APPLE, 3); toast("You caught the Cheese King! Huge reward."); SFX.treasure(); achieve("cheeseking", "Cheese King Caught"); }
  else if (ms.ninja) { addCoins((ms.steal || 0) + 5); addXP(15); toast("Ninja mouse caught. Coins recovered plus a bonus."); SFX.pickup(); achieve("ninja", "Caught a Ninja Mouse"); }
  else if (ms.golden) { addXP(20); addItem(I_APPLE, 1); toast("A golden mouse. Lucky find."); SFX.pickup(); }
  else { SFX.squeak(); }
  dailyTick("mouse", 1);
  removeMouse(ms);
}
function updateAnimals(dt) {
  if (DIM !== "overworld") return;
  for (const ms of mice.slice()) {                            // slice so catching a mouse mid-loop is safe
    let nd = 999, near = null; for (const c of cats) { const d = c.g.position.distanceTo(ms.g.position); if (d < nd) { nd = d; near = c; } }
    const dpm = ms.g.position.distanceTo(player.pos);
    if (dpm < 0.75) { mouseCaught(ms); continue; }            // Thomas catches a mouse by touching it
    if (ms.ninja && !ms.stolen) {                             // ninja darts straight at Thomas to grab coins
      const dx = player.pos.x - ms.g.position.x, dz = player.pos.z - ms.g.position.z, dd = Math.hypot(dx, dz) || 1;
      ms.g.position.x += (dx / dd) * 4.2 * dt; ms.g.position.z += (dz / dd) * 4.2 * dt; ms.g.rotation.y = Math.atan2(dx, dz); fallToGround(ms, dt);
      if (dpm < 1.1) { if (coins > 0) { const steal = Math.min(coins, 3); coins -= steal; updateCoinUI(); ms.steal = steal; toast("A ninja mouse stole " + steal + " coins. Catch it!"); SFX.squeak(); } ms.stolen = true; }
    } else {                                                   // flee from cats and Thomas (ninja flees fastest after stealing)
      const fleeing = (near && nd < 6) || dpm < 5 || (ms.ninja && ms.stolen);
      if (ms.ninja && ms.stolen) ms.dir = Math.atan2(ms.g.position.x - player.pos.x, ms.g.position.z - player.pos.z);
      else if (near && nd < 6) ms.dir = Math.atan2(ms.g.position.x - near.g.position.x, ms.g.position.z - near.g.position.z);
      else if (dpm < 4) ms.dir = Math.atan2(ms.g.position.x - player.pos.x, ms.g.position.z - player.pos.z);
      wander(ms, dt, (ms.ninja && ms.stolen) ? 4.8 : (fleeing ? 3.8 : 1.9));
    }
    ms.t += dt * 12; ms.tail.rotation.y = Math.sin(ms.t) * 0.6;
    if (Math.random() < 0.002) SFX.squeak();
  }
  for (let i = cats.length - 1; i >= 0; i--) {
    const c = cats[i]; c.meow -= dt; if (c.meow <= 0) { c.meow = 6 + Math.random() * 8; SFX.meow(); }
    if (c.warnCd > 0) c.warnCd -= dt;
    if (c.comboCd > 0) c.comboCd -= dt;
    c.moved = false;
    if (c.tamed) {
      // night-raid stakes: monsters can wear a cat down and scare it off; cats recover when safe
      let threat = false; if (isNight()) for (const m of monsters) { if (!m.dead && m.g.position.distanceTo(c.g.position) < 1.2) { threat = true; break; } }
      if (threat) { c.hp -= 2.2 * dt; if (c.hp <= 0) { toast((c.name || (c.color + " cat")) + " was scared off. Protect your cats!"); SFX.hurt(); scene.remove(c.g); cats.splice(i, 1); continue; } }
      else if (c.hp < 10) c.hp = Math.min(10, c.hp + dt);
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
      fallToGround(c, dt);
      // fight nearest monster (damage scales with cat level)
      let nm = null, nmd = 8; for (const m of monsters) if (!m.dead) { const md = m.g.position.distanceTo(c.g.position); if (md < nmd) { nmd = md; nm = m; } }
      if (nm && nmd < 1.3) { nm.hp -= 8 * dt * catMult * (1 + 0.25 * (c.level - 1)) * (c.ability === "fury" ? 1.5 : 1); nm.bar.up(Math.max(0, nm.hp / nm.max)); if (nm.hp <= 0 && !nm.dead) { nm.dead = true; discoverMob(nm.type); addXP(Math.round((nm.xp || 8) * 0.5)); onKill(); c.kills++; if (c.kills % 3 === 0) { c.level++; toast((c.name || (c.color + " cat")) + " reached level " + c.level); SFX.levelUp(); } } }
    } else if (c.friendly) {                                   // a friendly stray (Whiskers) trots over to Thomas
      const dx = player.pos.x - c.g.position.x, dz = player.pos.z - c.g.position.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.7) { c.g.position.x += (dx / d) * 3.4 * dt; c.g.position.z += (dz / d) * 3.4 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.moved = true; }
      else { c.g.rotation.y = Math.atan2(dx, dz); if (c.meow <= 0.05) { c.meow = 2.5 + Math.random() * 2; } }
      fallToGround(c, dt);
    } else {
      let nd = 999, near = null; for (const ms of mice) { const d = ms.g.position.distanceTo(c.g.position); if (d < nd) { nd = d; near = ms; } }
      if (near && nd < 12) { const dx = near.g.position.x - c.g.position.x, dz = near.g.position.z - c.g.position.z, d = Math.hypot(dx, dz) || 1; c.g.position.x += (dx / d) * 3 * dt; c.g.position.z += (dz / d) * 3 * dt; c.g.rotation.y = Math.atan2(dx, dz); fallToGround(c, dt); c.moved = true; if (nd < 0.6) { mouseCaught(near); } }
      else { wander(c, dt, 1.6); c.moved = true; }
    }
    if (c.moved) { c.walkT += dt * 10; const s = Math.sin(c.walkT) * 0.6; c.legs[0].rotation.x = s; c.legs[1].rotation.x = -s; c.legs[2].rotation.x = -s; c.legs[3].rotation.x = s; }
    else { for (const l of c.legs) l.rotation.x *= 0.8; }
    c.tail.rotation.z = Math.sin((c.walkT || 0) * 0.5) * 0.25;
  }
}

// ---------- COMBAT ----------
// when Thomas strikes a monster, a nearby tamed cat joins in with a pounce, scratch, or stun
function catCombo(m) {
  let cat = null, cd = 6; for (const c of cats) { if (!c.tamed) continue; const d = c.g.position.distanceTo(m.g.position); if (d < cd) { cd = d; cat = c; } }
  if (!cat || (cat.comboCd || 0) > 0) return;
  cat.comboCd = 2.4;
  const mv = ["pounce", "scratch", "stun"][Math.floor(Math.random() * 3)];
  const bonus = Math.round((6 + cat.level * 2) * catMult);
  const dx = m.g.position.x - cat.g.position.x, dz = m.g.position.z - cat.g.position.z, d = Math.hypot(dx, dz) || 1;
  cat.g.position.x += (dx / d) * Math.min(d, 1.6); cat.g.position.z += (dz / d) * Math.min(d, 1.6); cat.g.rotation.y = Math.atan2(dx, dz);
  m.hp -= bonus; m.flash = 0.2; m.bar.up(Math.max(0, m.hp / m.max)); knock(m.g, mv === "pounce" ? 1.8 : 1.1);
  hitSpark(m.g.position, 0x6cff6c); dmgNumber(m.g.position, bonus, true);
  if (mv === "stun") { if (!m._bspd) m._bspd = m.speed; m.speed = m._bspd * 0.3; m.slow = Math.max(m.slow || 0, 1.6); m.touch = Math.max(m.touch, 1.2); m.windup = 0; }
  toast((cat.name || (cat.color + " cat")) + " " + (mv === "stun" ? "stuns" : mv === "pounce" ? "pounces on" : "scratches") + " the monster! +" + bonus);
  SFX.meow();
  if (m.hp <= 0 && !m.dead) killMonster(m);
}
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
    if (tool && tool.special === "pierce") { for (const m2 of monsters) { if (m2.dead || m2 === m) continue; if (m2.g.position.distanceTo(m.g.position) < 3) { m2.hp -= dmg * 0.6; m2.flash = 0.15; m2.bar.up(Math.max(0, m2.hp / m2.max)); hitSpark(m2.g.position, 0x76e4ff); if (m2.hp <= 0 && !m2.dead) killMonster(m2); break; } } }  // Crystal Spear pierces a second foe
    catCombo(m);
    if (m.hp <= 0 && !m.dead) killMonster(m);
  }
  else if (ent && ent.userData.kind === "crystal") { const c = ent.userData.c; c.hp -= dmg; hitSpark(hit.point, 0x22d3ee); dmgNumber(hit.point, dmg, crit); if (c.hp <= 0 && !c.dead) { c.dead = true; scene.remove(c.g); crystalsLeft--; updateBoss(); } }
  else if (ent && ent.userData.kind === "dragon") { if (crystalsLeft > 0) { hitSpark(hit.point, 0x888888); toast("Destroy the End Crystals first"); return; } dragon.hp -= dmg; updateBoss(); hitSpark(hit.point, 0xb026ff); dmgNumber(hit.point, dmg, crit); if (dragon.hp <= 0 && !dragon.dead) winDragon(); }
}
function knock(g, f) { const dx = g.position.x - player.pos.x, dz = g.position.z - player.pos.z, d = Math.hypot(dx, dz) || 1; g.position.x += dx / d * f; g.position.z += dz / d * f; }
// central monster death: loot, xp, quest hook, and a power-up chance from elites
function killMonster(m) {
  if (m.dead) return; m.dead = true; discoverMob(m.type);
  for (const [lid, lc, lp] of (m.loot || [])) if (Math.random() < (m.elite ? Math.min(1, lp + 0.3) : lp) + luckBonus * 0.05) addItem(lid, lc);   // Luck improves loot
  if (m.elite) { addItem(I_APPLE, 1); if (Math.random() < 0.55) givePowerup(randPowerup()); }
  const ngB = 1 + ngLevel * 0.15;                                  // New Game Plus pays out more
  addCoins(Math.round(((m.elite ? 3 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2)) + luckBonus) * ngB));   // Luck adds coins
  if (!treasureKey && DIM === "overworld" && Math.random() < 0.03) { startTreasureHunt(); toast("A monster dropped a treasure map!"); }
  addXP(Math.round((m.xp || 10) * ngB)); onKill();
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
  if (fxParts.length > FX_CAP) return;
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); m.position.set(p.x + (Math.random() - .5) * 0.5, p.y + 0.5 + i * 0.4, p.z + (Math.random() - .5) * 0.5); scene.add(m); fxParts.push({ mesh: m, life: 0.25, vel: new THREE.Vector3((Math.random() - .5) * 2, 2, (Math.random() - .5) * 2) }); }
}
// Boom Pickaxe: shatter a 3x3x3 pocket of soft blocks around the mined cell
function boomBreak(cx, cy, cz) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    if (dx === 0 && dy === 0 && dz === 0) continue;
    const x = cx + dx, y = cy + dy, z = cz + dz, id = getBlock(x, y, z);
    if (id === AIR || id === WATER || id === PORTAL || id === CHEST || id === LAVA) continue;
    const b = BLOCKS[id]; if (!b || b.hard <= 0 || b.hard > 2) continue;
    const drop = b.drop; setRaw(x, y, z, AIR); recordEdit(x, y, z, AIR); if (drop !== undefined) addItem(drop, 1);
    if (id === TORCH) rebuildTorchCells();
    markDirty(x, z); markDirty(x + 1, z); markDirty(x - 1, z); markDirty(x, z + 1); markDirty(x, z - 1);
  }
  blockParticles(cx, cy, cz, [0.8, 0.8, 0.8]); SFX.slam(); addShake(0.18);
}
// Freda blocks explode when hit: clear a sphere of blocks, hurt nearby monsters, fling debris
function explosionFlash() {
  const f = $("flash"); if (!f) return;
  f.style.background = "radial-gradient(circle, rgba(255,225,140,.8), rgba(255,140,40,.35) 40%, rgba(120,40,0,0) 70%)";
  f.style.opacity = "1";
  setTimeout(() => { if (f) { f.style.opacity = "0"; setTimeout(() => { if (f) f.style.background = ""; }, 320); } }, settings.reduceMotion ? 140 : 300);
}
function explode(cx, cy, cz, power) {
  power = power || 2;
  const cxw = cx + 0.5, cyw = cy + 0.5, czw = cz + 0.5, cols = [];
  for (let dx = -power; dx <= power; dx++) for (let dy = -power; dy <= power; dy++) for (let dz = -power; dz <= power; dz++) {
    if (dx * dx + dy * dy + dz * dz > power * power + 1) continue;
    const x = cx + dx, y = cy + dy, z = cz + dz, id = getBlock(x, y, z);
    if (id === AIR || id === WATER || id === PORTAL || id === CHEST || id === BED || id === FREDA) continue;   // spare chests; chained Freda removed by the mining loop
    const b = BLOCKS[id]; if (!b || b.hard <= 0 || b.hard > 2.2) continue;
    if (b.top && cols.length < 24) cols.push(b.top);
    setRaw(x, y, z, AIR); recordEdit(x, y, z, AIR);
    markDirty(x, z); markDirty(x + 1, z); markDirty(x - 1, z); markDirty(x, z + 1); markDirty(x, z - 1);
  }
  rebuildTorchCells(); rebuildDefenseCells();
  // bright fireball core
  for (let i = 0; i < 12; i++) { if (fxParts.length > FX_CAP) break; const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffd23d : 0xffffff })); m.position.set(cxw, cyw, czw); scene.add(m); fxParts.push({ mesh: m, life: 0.45, vel: new THREE.Vector3((Math.random() - .5) * 13, Math.random() * 9, (Math.random() - .5) * 13) }); }
  // flying block debris in the colours of the blocks that broke
  for (let i = 0; i < 20; i++) { if (fxParts.length > FX_CAP) break; const c = cols.length ? cols[i % cols.length] : [0.6, 0.4, 0.3]; const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) })); m.position.set(cxw + (Math.random() - .5), cyw + (Math.random() - .5), czw + (Math.random() - .5)); scene.add(m); fxParts.push({ mesh: m, life: 1.1, vel: new THREE.Vector3((Math.random() - .5) * 12, 3 + Math.random() * 9, (Math.random() - .5) * 12) }); }
  // rising smoke
  for (let i = 0; i < 9; i++) { if (fxParts.length > FX_CAP) break; const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x6b6b6b, transparent: true, opacity: 0.55, depthWrite: false })); m.position.set(cxw + (Math.random() - .5) * 1.5, cyw + Math.random(), czw + (Math.random() - .5) * 1.5); scene.add(m); fxParts.push({ mesh: m, life: 1.3, max: 1.3, smoke: true, vel: new THREE.Vector3((Math.random() - .5) * 1.5, 1.5 + Math.random(), (Math.random() - .5) * 1.5) }); }
  spawnTelegraph(cxw, czw, power + 1.5, 0.45, 0xffd27a, true);    // ground shockwave ring
  explosionFlash();
  // damage + knockback
  for (const mo of monsters) { if (mo.dead) continue; const d = Math.hypot(mo.g.position.x - cxw, mo.g.position.z - czw); if (d < 5.2) { mo.hp -= 26; mo.flash = 0.25; mo.bar.up(Math.max(0, mo.hp / mo.max)); knock(mo.g, 2.8); if (mo.hp <= 0 && !mo.dead) killMonster(mo); } }
  const pd = Math.hypot(player.pos.x - cxw, player.pos.z - czw); if (pd < 3 && !powerActive("shield")) { damage(4); const kx = player.pos.x - cxw, kz = player.pos.z - czw, kd = Math.hypot(kx, kz) || 1; player.vel.x += kx / kd * 4; player.vel.y += 3; player.vel.z += kz / kd * 4; }
  SFX.boom(); SFX.zap(); addShake(settings.reduceMotion ? 0.3 : 0.9);
}
// ---------- FREDA BLOCK: a magical show plus a funny sky message ----------
const FREDA_MSGS = [
  "Freda is playing with the cats.",
  "Freda is with the dinosaurs.",
  "Freda just opened a secret portal.",
  "Freda made the cats dance.",
  "Freda is riding a dragon.",
  "Freda found the golden mouse.",
  "Freda is hiding in the block forest.",
  "Freda woke up the dinosaurs.",
  "Freda gave the cats superpowers.",
  "Freda is building a castle.",
  "Freda is chasing rocket mice.",
  "Freda found a treasure chest.",
  "Freda is flying through the sky.",
  "Freda is having a cat party.",
  "Freda turned the monsters purple.",
  "Freda is laughing in the clouds.",
  "Freda found the secret Freda Cave.",
  "Freda is feeding the dinosaurs.",
  "Freda is guarding the magic door.",
  "Freda just made everything sparkle.",
  "Freda summoned the Cat Army.",
  "Freda is dancing with the mice.",
  "Freda is riding a giant Snorlax style creature.",
  "Freda is hiding behind the moon.",
  "Freda made the sky explode with magic."
];
let lastFredaMsg = -1;
function randomFredaMsg() {
  if (FREDA_MSGS.length < 2) return FREDA_MSGS[0];
  let i = Math.floor(Math.random() * FREDA_MSGS.length);
  if (i === lastFredaMsg) i = (i + 1) % FREDA_MSGS.length;   // avoid repeating the same line twice in a row
  lastFredaMsg = i; return FREDA_MSGS[i];
}
function showSkyMessage(text, big) {
  const el = $("skyMsg"), t = $("skyMsgText"); if (!el || !t) return;
  t.textContent = text;
  if (big) el.classList.add("super"); else el.classList.remove("super");
  el.classList.remove("out"); el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");  // restart the fade-in
  clearTimeout(el._t1); clearTimeout(el._t2);
  const hold = big ? 4600 : 3200 + Math.floor(Math.random() * 1500);   // stays 3 to 5 seconds
  el._t1 = setTimeout(() => { el.classList.add("out"); el.classList.remove("show"); }, hold);
  el._t2 = setTimeout(() => { el.classList.remove("out"); el.classList.remove("super"); }, hold + 900);
}
function fredaConfetti(cx, cy, cz) {
  const cols = [0xff5d8f, 0xffd23d, 0x49e06a, 0x55b8ff, 0xb069ff, 0xff9a3d, 0xffffff];
  for (let i = 0; i < 28; i++) { if (fxParts.length > FX_CAP) break;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.04), new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }));
    m.position.set(cx + (Math.random() - .5), cy + 1 + Math.random() * 2, cz + (Math.random() - .5)); scene.add(m);
    fxParts.push({ mesh: m, life: 1.8, confetti: true, vel: new THREE.Vector3((Math.random() - .5) * 6, 3 + Math.random() * 5, (Math.random() - .5) * 6) });
  }
}
function rainbowBeam(cx, cy, cz) {
  const cols = [0xff4d4d, 0xff9a3d, 0xffe14d, 0x49e06a, 0x55b8ff, 0xb069ff];
  for (let i = 0; i < cols.length; i++) { if (fxParts.length > FX_CAP) break;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55), new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.set(cx, cy + 1 + i * 1.5, cz); scene.add(m);
    fxParts.push({ mesh: m, life: 1.6, max: 1.6, beam: true, vel: new THREE.Vector3(0, 2.2, 0) });
  }
}
function fredaSecretHole(x, y, z) {
  for (let dy = 1; dy <= 3; dy++) { setRaw(x, y - dy, z, AIR); recordEdit(x, y - dy, z, AIR); }
  const fy = y - 4; setRaw(x, fy, z, CHEST); recordEdit(x, fy, z, CHEST);
  const key = chestKey(x, fy, z);
  if (!chestStore.has(key)) chestStore.set(key, [{ id: CRYSTAL, count: 2 }, { id: I_APPLE, count: 3 }, { id: BRICK, count: 8 }, null, null, null, null, null, null]);
  markDirty(x, z); markDirty(x + 1, z); markDirty(x - 1, z); markDirty(x, z + 1); markDirty(x, z - 1);
  toast("A secret Freda treasure hole opened below!"); SFX.treasure();
}
// brief reactions: cats rush toward the blast, mice flee in panic (handled by updateFredaReactions)
function fredaEvent(x, y, z) {
  explode(x, y, z, 2);                                    // the bigger boom: clears blocks, debris, smoke, ring, shake, sound
  const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
  const sup = Math.random() < 0.12;                       // rare SUPER FREDA BLOCK
  fredaConfetti(cx, cy, cz);
  SFX.sparkle();
  showSkyMessage(sup ? "SUPER FREDA BLOCK!" : randomFredaMsg(), sup);
  addShake(0.2);
  if (sup || Math.random() < 0.4) rainbowBeam(cx, cy, cz);          // rainbow beam into the sky
  const here = new THREE.Vector3(cx, cy, cz);
  for (const c of cats) { if (c.g.position.distanceTo(here) < 16) { c._fredaRun = 3; c._fredaTo = { x: cx, z: cz }; if (Math.random() < 0.5) SFX.meow(); } }   // cats run over
  for (const ms of mice) { if (ms.g.position.distanceTo(here) < 14) { ms.dir = Math.atan2(ms.g.position.x - cx, ms.g.position.z - cz); ms._panic = 2.5; } }   // mice panic
  const roll = Math.random();                              // a small random reward
  if (roll < 0.30) { const c = 5 + Math.floor(Math.random() * 8); addCoins(c); toast("Freda left you " + c + " coins!"); }
  else if (roll < 0.55) { addXP(20 + Math.floor(Math.random() * 25)); }
  else if (roll < 0.72) { addItem(I_APPLE, 1 + Math.floor(Math.random() * 2)); toast("Freda dropped cat treats!"); }
  else if (roll < 0.82) { addItem(CRYSTAL, 1); toast("A rare crystal block popped out!"); }
  if (sup || Math.random() < 0.08) fredaSecretHole(x, y, z);        // rare secret treasure hole
  if (Math.random() < 0.15) setTimeout(() => SFX.roar(), 350);      // rare distant dinosaur roar
  if (Math.random() < 0.10) { for (const c of cats) { c._fredaRun = 3.5; c._fredaTo = { x: cx, z: cz }; } toast("A cat parade marches by!"); SFX.meow(); }   // rare cat parade
}
function updateFredaReactions(dt) {
  for (const c of cats) { if (c._fredaRun > 0) { c._fredaRun -= dt; const dx = c._fredaTo.x - c.g.position.x, dz = c._fredaTo.z - c.g.position.z, d = Math.hypot(dx, dz) || 1; if (d > 1.6) { c.g.position.x += dx / d * 4 * dt; c.g.position.z += dz / d * 4 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.moved = true; } fallToGround(c, dt); } }
  for (const ms of mice) { if (ms._panic > 0) { ms._panic -= dt; ms.g.position.x += Math.sin(ms.dir) * 5 * dt; ms.g.position.z += Math.cos(ms.dir) * 5 * dt; ms.g.rotation.y = ms.dir; fallToGround(ms, dt); } }
}
// player ranged shots: Ice Bow (slow) and Slime Launcher (knockback)
let bowCd = 0;
const playerShots = [];
const pshotGeo = new THREE.SphereGeometry(0.16, 8, 8);
function firePlayerShot(kind) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const m = new THREE.Mesh(pshotGeo, new THREE.MeshBasicMaterial({ color: kind === "slime" ? 0x6fe06a : 0x9fe8ff }));
  m.position.set(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z); scene.add(m);
  playerShots.push({ mesh: m, vel: dir.clone().multiplyScalar(24), life: 2, kind });
  SFX.zap();
}
function updatePlayerShots(dt) {
  for (let i = playerShots.length - 1; i >= 0; i--) {
    const p = playerShots[i]; p.life -= dt; p.mesh.position.addScaledVector(p.vel, dt);
    let hitM = null; for (const m of monsters) { if (m.dead) continue; if (m.g.position.distanceTo(p.mesh.position) < 1.2) { hitM = m; break; } }
    const ground = isSolidBlock(getBlock(Math.floor(p.mesh.position.x), Math.floor(p.mesh.position.y), Math.floor(p.mesh.position.z)));
    if (hitM) {
      const dmg = 6 + swordBonus; hitM.hp -= dmg; hitM.flash = 0.15; hitM.bar.up(Math.max(0, hitM.hp / hitM.max));
      hitSpark(p.mesh.position, p.kind === "slime" ? 0x6fe06a : 0x9fe8ff); dmgNumber(p.mesh.position, dmg, false);
      if (p.kind === "ice") { if (!hitM._bspd) hitM._bspd = hitM.speed; hitM.speed = hitM._bspd * 0.4; hitM.slow = 2.8; }
      else { knock(hitM.g, 1.6); }
      if (hitM.hp <= 0 && !hitM.dead) killMonster(hitM);
    }
    if (hitM || ground || p.life <= 0) { scene.remove(p.mesh); playerShots.splice(i, 1); }
  }
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
const FX_CAP = 150;                                  // keep particle count bounded so mobile stays smooth
function hitSpark(p, col) { if (fxParts.length > FX_CAP) return; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(p); scene.add(m); fxParts.push({ mesh: m, life: 0.3, vel: new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 4, (Math.random() - .5) * 4) }); } }
function updateFx(dt) {
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i]; p.life -= dt; p.mesh.position.addScaledVector(p.vel, dt);
    if (p.smoke) { p.mesh.scale.multiplyScalar(1 + dt * 1.6); p.vel.multiplyScalar(1 - dt * 1.2); if (p.mesh.material) p.mesh.material.opacity = Math.max(0, 0.55 * p.life / (p.max || 1)); }
    else if (p.confetti) { p.vel.y -= 3.5 * dt; p.vel.x *= (1 - dt * 0.6); p.vel.z *= (1 - dt * 0.6); p.mesh.rotation.x += dt * 6; p.mesh.rotation.z += dt * 5; }   // flutters and falls slowly without shrinking
    else if (p.beam) { p.vel.multiplyScalar(1 - dt * 0.4); if (p.mesh.material) p.mesh.material.opacity = Math.max(0, 0.7 * p.life / (p.max || 1)); }
    else { p.vel.y -= 9 * dt; p.mesh.scale.multiplyScalar(1 - dt * 2.5); }
    if (p.life <= 0) { scene.remove(p.mesh); fxParts.splice(i, 1); }
  }
}
// tag entity meshes after spawn (so raycast finds kind)
function tagMonsters() { for (const m of monsters) m.g.traverse(o => { o.userData.kind = "monster"; o.userData.m = m; }); }

// ---------- VIEWMODEL ----------
let viewItem = null, swing = 0;
function buildViewItem() {
  if (viewItem) vScene.remove(viewItem);
  const g = new THREE.Group(); const it = hotbar[selSlot];
  if (it && isItem(it.id)) {
    const tool = ITEMS[it.id].tool, sp = ITEMS[it.id].special, tier = ITEMS[it.id].tier || 1;
    // metal tone scales with tier so a stone tool reads grey and an iron/upgraded tool reads bright steel
    const metal = sp === "fire" ? 0xff7a2a : sp === "pierce" ? 0x76e4ff : tier >= 2 ? 0xcfd6de : 0x8f8f8f;
    const wood = 0x6e4a25;
    if (tool === "sword") { const blade = box(0.06, 0.5, 0.06, metal); blade.position.y = 0.32; g.add(blade); const tip = box(0.06, 0.1, 0.06, metal); tip.position.y = 0.6; tip.rotation.z = 0.78; g.add(tip); const gu = box(0.22, 0.05, 0.08, 0xc9a227); gu.position.y = 0.06; g.add(gu); const grip = box(0.05, 0.14, 0.05, wood); grip.position.y = -0.04; g.add(grip); const pom = box(0.07, 0.05, 0.07, 0xc9a227); pom.position.y = -0.12; g.add(pom); }
    else if (tool === "hammer") { const head = box(0.26, 0.2, 0.18, metal); head.position.y = 0.36; g.add(head); const trim = box(0.28, 0.06, 0.2, 0xffe066); trim.position.y = 0.36; g.add(trim); const stick = box(0.05, 0.42, 0.05, wood); stick.position.y = 0.1; g.add(stick); }
    else if (tool === "bow") { const col = sp === "slime" ? 0x49e06a : 0x9fe8ff; const arc = box(0.06, 0.5, 0.06, col); arc.position.y = 0.25; g.add(arc); const tip1 = box(0.05, 0.12, 0.05, 0xcfcfe0); tip1.position.set(0, 0.48, 0.04); tip1.rotation.x = 0.5; g.add(tip1); const tip2 = box(0.05, 0.12, 0.05, 0xcfcfe0); tip2.position.set(0, 0.02, 0.04); tip2.rotation.x = -0.5; g.add(tip2); }
    else if (tool === "pick") { const stick = box(0.05, 0.44, 0.05, wood); stick.position.y = 0.08; g.add(stick); const bar = box(0.34, 0.05, 0.05, metal); bar.position.y = 0.34; bar.rotation.z = 0.18; g.add(bar); const tL = box(0.05, 0.13, 0.05, metal); tL.position.set(-0.17, 0.3, 0); tL.rotation.z = 0.7; g.add(tL); const tR = box(0.05, 0.13, 0.05, metal); tR.position.set(0.17, 0.3, 0); tR.rotation.z = -0.7; g.add(tR); }
    else if (tool === "axe") { const stick = box(0.05, 0.44, 0.05, wood); stick.position.y = 0.08; g.add(stick); const blade = box(0.04, 0.22, 0.22, metal); blade.position.set(0.13, 0.33, 0); g.add(blade); const edge = box(0.03, 0.26, 0.1, metal); edge.position.set(0.18, 0.33, 0); g.add(edge); const collar = box(0.08, 0.08, 0.08, metal); collar.position.set(0.04, 0.33, 0); g.add(collar); }
    else { const head = box(0.18, 0.1, 0.06, metal); head.position.y = 0.34; g.add(head); const stick = box(0.05, 0.34, 0.05, wood); stick.position.y = 0.12; g.add(stick); }
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
  // creature realm: talk to the nearest NPC (Nurse, Shop, Trainer, Badge Master)
  if (DIM === "realm" && realmInteract()) return;
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
  // open the merchant shop when standing next to it
  if (merchant && merchant.g.position.distanceTo(player.pos) < 3) { openShop(); return; }
  // open the nearest chest within reach even if not perfectly aimed (mobile friendly)
  { let bc = null, bd = 3.2; for (let oy = -1; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) { const cxn = Math.floor(player.pos.x) + ox, cyn = Math.floor(player.pos.y) + oy, czn = Math.floor(player.pos.z) + oz; if (getBlock(cxn, cyn, czn) === CHEST) { const d = Math.hypot(cxn + 0.5 - player.pos.x, czn + 0.5 - player.pos.z); if (d < bd) { bd = d; bc = [cxn, cyn, czn]; } } } if (bc) { openChest(chestKey(bc[0], bc[1], bc[2])); return; } }
  // tame nearby cat by feeding apple
  let near = null, nd = 3; for (const c of cats) { const d = c.g.position.distanceTo(player.pos); if (d < nd) { nd = d; near = c; } }
  if (near && !near.tamed) {
    if (near.friendly || countItem(I_APPLE) > 0) {
      if (!near.friendly) consumeItem(I_APPLE, 1);
      near.tamed = true; near.friendly = false; near.mode = "follow"; SFX.meow(); discoverCat(near.color); applyCatCosmetic(near);
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
function buildPortalFrame(cx, baseY, z, dir, dest, edgeBlock) { // dir: 'x' plane; dest: dimension this portal leads to
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 4; dy++) {
    const edge = dx === -1 || dx === 2 || dy === -1 || dy === 4;
    setRaw(cx + dx, baseY + dy, z, edge ? (edgeBlock || COBBLE) : PORTAL);
    if (!edge && dest) portalDest[bk(cx + dx, baseY + dy, z)] = dest;
  }
  rebuildPortalCells();
  for (let i = -2; i <= 3; i++) markDirty(cx + i, z);
}
let portalCd = 0;
function checkPortal() {
  if (portalCd > 0) return;
  const fx = Math.floor(player.pos.x), fy = Math.floor(player.pos.y), fz = Math.floor(player.pos.z);
  const at = getBlock(fx, fy, fz), at2 = getBlock(fx, fy + 1, fz);
  if (at === PORTAL || at2 === PORTAL) {
    portalCd = 2;
    const dest = portalDest[bk(fx, fy, fz)] || portalDest[bk(fx, fy + 1, fz)];
    const next = dest || (DIM === "overworld" ? "fire" : DIM === "fire" ? "end" : "overworld");
    transitionTo(next);
  }
}
function transitionTo(name) {
  SFX.portal(); const fade = document.getElementById("fade"); fade.style.opacity = "1";
  setTimeout(() => { loadDimension(name); fade.style.opacity = "0"; }, 520);
}
function clearEntities() { for (const m of monsters) scene.remove(m.g); for (const c of cats) scene.remove(c.g); for (const m of mice) scene.remove(m.g); monsters = []; cats = []; mice = []; for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0; for (const p of playerShots) scene.remove(p.mesh); playerShots.length = 0; if (dragon) { scene.remove(dragon.g); dragon = null; } if (fireBoss) { scene.remove(fireBoss.g); fireBoss = null; } if (typeof skyBoss !== "undefined" && skyBoss) { scene.remove(skyBoss.g); skyBoss = null; } for (const c of crystals) scene.remove(c.g); crystals = []; if (merchant) { scene.remove(merchant.g); merchant = null; } if (typeof clearRealmCreatures === "function") clearRealmCreatures(); if (typeof clearRealmNPCs === "function") clearRealmNPCs(); if (typeof clearRealmBosses === "function") clearRealmBosses(); battle = null; cmenuOpen = false; if (typeof hide === "function") { hide("battle"); hide("cmenu"); } if (typeof clearTelegraphs === "function") clearTelegraphs(); hideBoss(); }
function loadDimension(name, fromSave) {
  DIM = name; clearWorld(); clearEntities();
  if (name === "fire") achieve("firep", "Fire Portal Opened");
  if (name === "end") achieve("endp", "End Portal Opened");
  player.pos.set(0.5, 50, 0.5); player.vel.set(0, 0, 0);
  gravity = (name === "end" || name === "sky") ? 16 : 28; jumpV = (name === "end" || name === "sky") ? 8.4 : 9.2;     // low gravity end + sky
  if (name === "overworld") { for (let i = 0; i < 3; i++) spawnCat((Math.random() * 20 - 10) | 0, (Math.random() * 20 - 10) | 0); for (let i = 0; i < 8; i++) spawnMouse((Math.random() * 30 - 15) | 0, (Math.random() * 30 - 15) | 0); }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) buildChunk(dx, dz);
  if (!fromSave) { player.pos.y = surfaceY(0, 0) + 1; player.spawn.copy(player.pos); }
  // dimension setup
  if (name === "overworld") { scene.fog = new THREE.Fog(0x9fd2ff, 20, GFX[settings.gfx].dist * CH); hemi.color.set(0xbfe3ff); sun.color.set(0xffffff); showBanner("Overworld"); buildPortalFrame(8, surfaceY(8, 0), 0, "x", "fire"); if (fireBossDown) { buildPortalFrame(-10, surfaceY(-10, 0), 0, "x", "sky"); } buildPortalFrame(12, surfaceY(12, -6), -6, "x", "realm", CDOOR); setQuest("Step through the purple portal to the Fire Dimension"); }
  else if (name === "realm") { scene.background = new THREE.Color(0x8ad0ff); scene.fog = new THREE.Fog(0xbfeaff, 26, GFX[settings.gfx].dist * CH); hemi.color.set(0xdaf3ff); hemi.intensity = 0.95; sun.intensity = 1.0; sun.color.set(0xffffff); showBanner("The Creature Battle Realm"); buildPortalFrame(6, surfaceY(6, 0), 0, "x", "overworld", CDOOR); enterRealm(); }
  else if (name === "fire") { scene.background = new THREE.Color(0x2a0808); scene.fog = new THREE.Fog(0x551111, 8, 40); hemi.color.set(0xff7a3a); hemi.intensity = 0.6; sun.intensity = 0.5; sun.color.set(0xff8a4a); showBanner("Fire Dimension"); clearFirePad(0, 0); if (fireBossDown) { buildPortalFrame(0, surfaceY(0, -8), -8, "x", "end"); setRaw(0, surfaceY(0, -8) + 1, -8, PORTAL); setQuest("Enter the portal to reach the End"); } else { spawnFireBoss(); setQuest("Defeat the Fire Guardian. A Flame Charm will protect you from the heat"); } }
  else if (name === "sky") { scene.background = new THREE.Color(0x8fd0ff); scene.fog = new THREE.Fog(0xbfe3ff, 36, 150); hemi.color.set(0xdff1ff); hemi.intensity = 0.95; sun.intensity = 0.9; sun.color.set(0xffffff); showBanner("Sky Islands"); buildPortalFrame(6, surfaceY(6, 0), 0, "x", "overworld"); spawnSkySerpent(); setQuest("Glide the Sky Islands and defeat the Sky Serpent"); }
  else { scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 30, 120); hemi.color.set(0xffffff); hemi.intensity = 0.9; sun.intensity = 0.7; sun.color.set(0xeae6ff); showBanner("The End"); buildEndDragon(); setQuest("Destroy the End Crystals, then slay the Black Dragon"); }
  // replay player block edits, then rebuild special blocks
  const ed = editsByDim[name]; if (ed) for (const [k, id] of ed) { const p = k.split(",").map(Number); setRaw(p[0], p[1], p[2], id); }
  remeshAll(); rebuildPortalCells(); rebuildTorchCells(); rebuildDefenseCells(); rebuildFredaLabels();
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
  const maxHp = 150;
  fireBoss = { g, hp: maxHp, max: maxHp, touch: 0, atkCd: 3.2, slamCd: 6, summonCd: 14, windup: 0, phase: 1, intro: 3.4, armL, armR, body, flash: 0 };
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
      SFX.slam(); addShake(0.6); if (d < 4) { damage(6); const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.8); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; spawnProjectile(fb.g.position, { x: fb.g.position.x + Math.cos(a) * 4, y: player.pos.y, z: fb.g.position.z + Math.sin(a) * 4 }); } // shockwave
      fb.armL.rotation.x = 0; fb.armR.rotation.x = 0; fb.slamCd = phase === 3 ? 5 : 7;
    }
  } else {
    if (d > 3) { fb.g.position.x += dx / d * spd * dt; fb.g.position.z += dz / d * spd * dt; }
    fb.g.rotation.y = Math.atan2(dx, dz); fb.g.position.y = surfaceY(fb.g.position.x, fb.g.position.z);
    fb.touch -= dt; if (d < 2.4 && fb.touch <= 0) { damage(5); fb.touch = 1.2; }
    fb.atkCd -= dt; if (fb.atkCd <= 0) { fb.atkCd = phase === 3 ? 1.8 : 3.0; const volley = phase === 3 ? 2 : 1; for (let i = 0; i < volley; i++) { const off = (i - (volley - 1) / 2) * 2; spawnProjectile(fb.g.position, { x: player.pos.x + off, y: player.pos.y, z: player.pos.z }); } }
    if (phase >= 2) { fb.slamCd -= dt; if (fb.slamCd <= 0 && d < 6) { fb.windup = 0.9; SFX.growl(); spawnTelegraph(player.pos.x, player.pos.z, 4, 0.9); } }
    if (phase >= 3) { fb.summonCd -= dt; if (fb.summonCd <= 0 && monsters.length < 3) { fb.summonCd = 18; const a = Math.random() * 6.28; spawnMonster(Math.floor(fb.g.position.x + Math.cos(a) * 3), Math.floor(fb.g.position.z + Math.sin(a) * 3), "lavaworm"); toast("The Guardian summons a lava worm"); } }
    fb.armL.rotation.x = Math.sin(performance.now() * 0.005) * 0.3; fb.armR.rotation.x = -fb.armL.rotation.x;
  }
  if (fb.hp <= 0) {
    hitSpark(fb.g.position, 0xff7a1e); for (let i = 0; i < 4; i++) hitSpark({ x: fb.g.position.x + (Math.random() - .5) * 2, y: fb.g.position.y + 1, z: fb.g.position.z + (Math.random() - .5) * 2 }, 0xffb02a);
    scene.remove(fb.g); fireBoss = null; hideBoss(); SFX.victory();
    toast("Fire Guardian defeated. The path to the End opens.");
    addItem(FIRE_CRYSTAL, 6); addItem(I_FIRECHARM, 1); addXP(120);
    buildPortalFrame(0, surfaceY(0, -8), -8, "x", "end"); setRaw(0, surfaceY(0, -8) + 1, -8, PORTAL); rebuildPortalCells();
    setQuest("Enter the portal to reach the End"); onFireBoss();
  }
}
// ---------- SKY ISLANDS: the Sky Serpent boss (flying, 3 phases, dive telegraphs) ----------
let skyBoss = null;
function spawnSkySerpent() {
  const g = new THREE.Group();
  const mat = (c, em) => new THREE.MeshLambertMaterial({ color: c, emissive: em != null ? em : 0x103a5a, emissiveIntensity: 0.45 });
  const segs = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.82 - i * 0.07, 0.82 - i * 0.07, 0.9), mat(i % 2 ? 0x3fa9f5 : 0x6fc7ff)); s.position.set(0, 0, -i * 0.85); g.add(s); segs.push(s); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.1), mat(0x2f8fe0)); head.position.set(0, 0.1, 0.95); g.add(head);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffe14d, emissive: 0xffe14d });
  const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.1), eyeMat); e1.position.set(-0.28, 0.28, 1.45); g.add(e1); const e2 = e1.clone(); e2.position.x = 0.28; g.add(e2);
  const wMat = mat(0xcfeaff, 0x2a5a8a);
  const wL = new THREE.Group(); const mem = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.7), wMat); mem.position.set(-1.5, 0, 0); wL.add(mem); wL.position.set(-0.4, 0.3, 0.2); g.add(wL);
  const wR = new THREE.Group(); const mem2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.7), wMat); mem2.position.set(1.5, 0, 0); wR.add(mem2); wR.position.set(0.4, 0.3, 0.2); g.add(wR);
  g.position.set(0, surfaceY(0, 0) + 9, -10); scene.add(g);
  const maxHp = 200;
  skyBoss = { g, hp: maxHp, max: maxHp, t: 0, touch: 0, atkCd: 2.5, phase: 1, intro: 2.6, wL, wR, segs, head, flash: 0, swoop: 0 };
  g.traverse(o => { o.userData.kind = "monster"; o.userData.m = { get hp() { return skyBoss.hp; }, set hp(v) { skyBoss.hp = v; }, get max() { return skyBoss.max; }, set flash(v) { if (skyBoss) skyBoss.flash = v; }, get flash() { return skyBoss ? skyBoss.flash : 0; }, bar: { up: () => {} }, get dead() { return !skyBoss || skyBoss.hp <= 0; }, get ghost() { return false; }, g } });
  bossIntro("SKY SERPENT", "It circles the islands. Strike when it dives.");
  showBoss("SKY SERPENT", 1);
}
function updateSkyBoss(dt) {
  if (!skyBoss) return;
  const fb = skyBoss; fb.t += dt;
  if (fb.flash > 0) fb.flash -= dt;
  const frac = fb.hp / fb.max, phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (phase !== fb.phase) { fb.phase = phase; SFX.growl(); toast(phase === 3 ? "The Sky Serpent shrieks in fury" : "The Sky Serpent grows fiercer"); }
  showBoss("SKY SERPENT" + (phase === 3 ? " (FURIOUS)" : ""), Math.max(0, frac));
  const flap = Math.sin(fb.t * 6) * 0.5; fb.wL.rotation.z = -flap; fb.wR.rotation.z = flap;
  for (let i = 0; i < fb.segs.length; i++) fb.segs[i].rotation.y = Math.sin(fb.t * 3 - i * 0.5) * 0.25;
  const dx = player.pos.x - fb.g.position.x, dz = player.pos.z - fb.g.position.z, d = Math.hypot(dx, dz) || 0.001;
  fb.g.rotation.y = Math.atan2(dx, dz);
  if (fb.intro > 0 && fb.hp > 0) { fb.intro -= dt; return; }
  const spd = phase === 3 ? 3.0 : 2.0, base = surfaceY(0, 0) + 9;
  fb.swoop -= dt;
  let tx, tz, ty;
  if (fb.swoop > 0) { tx = player.pos.x; tz = player.pos.z; ty = player.pos.y + 2.2; }     // dive at Thomas
  else { tx = Math.cos(fb.t * 0.6) * 12; tz = Math.sin(fb.t * 0.6) * 12; ty = base + Math.sin(fb.t * 0.8) * 2; }
  fb.g.position.x += (tx - fb.g.position.x) * Math.min(1, dt * spd);
  fb.g.position.z += (tz - fb.g.position.z) * Math.min(1, dt * spd);
  fb.g.position.y += (ty - fb.g.position.y) * Math.min(1, dt * 1.8);
  fb.touch -= dt; if (fb.g.position.distanceTo(player.pos) < 3 && fb.touch <= 0) { damage(phase >= 3 ? 7 : 5); fb.touch = 1; addShake(0.2); }
  if (fb.swoop <= 0 && Math.random() < (phase >= 3 ? 0.02 : 0.01)) { fb.swoop = 2.2; spawnTelegraph(player.pos.x, player.pos.z, 3, 0.9, 0x7afcff); }
  fb.atkCd -= dt; if (fb.atkCd <= 0) { fb.atkCd = phase >= 3 ? 1.2 : 2.4; const volley = phase >= 3 ? 3 : 1; for (let i = 0; i < volley; i++) { const off = (i - (volley - 1) / 2) * 2; spawnProjectile(fb.g.position, { x: player.pos.x + off, y: player.pos.y, z: player.pos.z }); } }
  if (fb.hp <= 0) {
    for (let i = 0; i < 10; i++) hitSpark({ x: fb.g.position.x + (Math.random() - .5) * 3, y: fb.g.position.y + (Math.random() - .5) * 2, z: fb.g.position.z + (Math.random() - .5) * 3 }, 0x7afcff);
    scene.remove(fb.g); skyBoss = null; hideBoss(); SFX.victory(); addShake(0.5);
    toast("Sky Serpent defeated! Glide Cape unlocked."); showBanner("Sky Beast Slain!");
    addXP(140); addCoins(20); givePowerup("glide"); achieve("skyboss", "Sky Beast Slain");
    setQuest("Return through the portal to the Overworld");
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
  dragon.dead = true; hideBoss(); achieve("dragon", "Dragon Defeated"); addXP(150); addShake(0.6); toast("The Black Dragon falls."); SFX.victory(); bumpNG();
  for (let i = 0; i < 12; i++) hitSpark({ x: dragon.g.position.x + (Math.random() - .5) * 4, y: dragon.g.position.y + (Math.random() - .5) * 3, z: dragon.g.position.z + (Math.random() - .5) * 4 }, 0xb026ff);
  setTimeout(() => { running = false; document.exitPointerLock(); hide("touch"); document.getElementById("hud").classList.add("hidden"); show("win"); }, 2200);
}

// ---------- BOSS POLISH (cinematic intro, telegraph warning zones, music cue) ----------
function bossActive() { return (typeof fireBoss !== "undefined" && fireBoss) || (typeof skyBoss !== "undefined" && skyBoss) || (typeof dragon !== "undefined" && dragon && !dragon.dead); }
function bossIntro(name, sub) {
  cine(name); showBanner(name); addShake(0.3); SFX.screech();
  setTimeout(() => { const cap = $("cineCap"); if (cap && sub) { cap.textContent = sub; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); } }, 1200);
  setTimeout(endCine, 2800);
}
// flat ground rings that flash where a heavy attack will land, so hits are readable
const telegraphs = [];
function spawnTelegraph(x, z, radius, dur, color, grow) {
  const geo = new THREE.RingGeometry(radius * 0.82, radius, 28);
  const mat = new THREE.MeshBasicMaterial({ color: color || 0xff3b3b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, surfaceY(x, z) + 0.06, z); scene.add(m);
  telegraphs.push({ mesh: m, life: dur, max: dur, grow: !!grow });
}
function updateTelegraphs(dt) {
  for (let i = telegraphs.length - 1; i >= 0; i--) {
    const t = telegraphs[i]; t.life -= dt; const f = 1 - Math.max(0, t.life) / t.max;
    if (t.grow) { t.mesh.scale.setScalar(0.3 + f * 2.4); if (t.mesh.material) t.mesh.material.opacity = 0.65 * (1 - f); }   // expanding shockwave
    else { t.mesh.scale.setScalar(0.5 + f * 0.7); if (t.mesh.material) t.mesh.material.opacity = 0.25 + 0.5 * Math.abs(Math.sin(t.life * 14)); }
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
function onMine(id) { if (id === STONE || id === COBBLE) { minedStone++; dailyTick("mine", 1); } achieve("block", "First Block Broken"); addXP(id === STONE || id === COBBLE ? 2 : 1); }
function onKill() { kills++; achieve("kill1", "First Monster Defeated"); addXP(10); dailyTick("kill", 1); }
function onTame() { tamedCat = true; tameCount++; achieve("cat", "First Cat Tamed"); if (tameCount >= 3) achieve("cathero", "Cat Hero"); dailyTick("tame", 1); }
// ---------- DAILY CHALLENGE + NEW GAME PLUS (replay value) ----------
const DAILY = [
  { id: "kill", kind: "kill", text: "Defeat 12 monsters", target: 12, reward: () => { addCoins(25); addXP(40); } },
  { id: "mine", kind: "mine", text: "Mine 25 stone or cobble", target: 25, reward: () => { addCoins(20); addItem(COBBLE, 16); } },
  { id: "tame", kind: "tame", text: "Tame 2 cats", target: 2, reward: () => { addCoins(20); addXP(40); } },
  { id: "mouse", kind: "mouse", text: "Catch 3 mice", target: 3, reward: () => { addCoins(20); addItem(I_APPLE, 2); } },
  { id: "build", kind: "build", text: "Place 20 blocks", target: 20, reward: () => { addCoins(15); addItem(PLANKS, 8); } }
];
let daily = null;
function todayStr() { const d = new Date(); return "" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }
function saveDaily() { if (!daily) return; try { localStorage.setItem("thomas_voxel_daily", JSON.stringify({ date: daily.date, prog: daily.prog, claimed: daily.claimed })); } catch (e) {} }
function initDaily() {
  const date = todayStr(), dn = parseInt(date, 10) || 0;
  const tmpl = DAILY[Math.floor(hsh(dn % 100000, 7) * DAILY.length) % DAILY.length] || DAILY[0];
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("thomas_voxel_daily")) || {}; } catch (e) {}
  const same = saved.date === date;
  daily = { date, id: tmpl.id, kind: tmpl.kind, text: tmpl.text, target: tmpl.target, reward: tmpl.reward, prog: same ? (saved.prog || 0) : 0, claimed: same ? !!saved.claimed : false };
  saveDaily();
}
function dailyTick(kind, n) {
  if (!daily || daily.claimed || daily.kind !== kind) return;
  daily.prog = Math.min(daily.target, daily.prog + (n || 1)); saveDaily();
  if (daily.prog >= daily.target && !daily.claimed) { daily.claimed = true; saveDaily(); toast("Daily Challenge complete!"); showBanner("Daily Challenge complete!"); SFX.victory(); if (daily.reward) daily.reward(); achieve("daily", "Daily Challenger"); }
}
let ngLevel = 0, ngMul = 1;     // New Game Plus: each dragon win makes the next run tougher
function loadNG() { try { ngLevel = parseInt(localStorage.getItem("thomas_voxel_ngplus"), 10) || 0; } catch (e) { ngLevel = 0; } ngMul = 1 + ngLevel * 0.2; }
function bumpNG() { ngLevel++; try { localStorage.setItem("thomas_voxel_ngplus", "" + ngLevel); } catch (e) {} ngMul = 1 + ngLevel * 0.2; }
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
    row.innerHTML = "<span><b>" + (d.ic ? d.ic + " " : "") + d.name + "</b> " + skills[d.k] + "/" + d.max + "<br><span class='muted'>" + d.desc + "</span></span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = skills[d.k] >= d.max ? "MAX" : "+";
    b.addEventListener("pointerdown", e => { e.preventDefault(); spendSkill(d.k); });
    row.appendChild(b); wrap.appendChild(row);
  }
}
function toggleSkills() { const el = $("skills"); if (el.classList.contains("hidden")) { renderSkills(); show("skills"); document.exitPointerLock(); } else { hide("skills"); if (!isTouch && running) canvas.requestPointerLock(); } }
function renderJournal() {
  const L = $("journalList"); if (!L) return; L.innerHTML = "";
  const hd = t => { const h = document.createElement("div"); h.className = "muted"; h.style.cssText = "font-size:12px;letter-spacing:1px;margin:6px 0 4px"; h.textContent = t; L.appendChild(h); };
  if (daily) {
    hd("DAILY CHALLENGE");
    const dr = document.createElement("div"); dr.className = "craftRow" + (daily.claimed ? "" : " no");
    dr.innerHTML = "<span><b>" + (daily.claimed ? "✓ " : "★ ") + daily.text + "</b><br><span class='muted'>" + (daily.claimed ? "Reward claimed. Come back tomorrow." : ("Progress " + daily.prog + "/" + daily.target)) + "</span></span>";
    L.appendChild(dr);
  }
  if (ngLevel > 0) hd("NEW GAME PLUS " + ngLevel);
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
// breaking a chest hands its prizes straight to Thomas (so loot is never lost)
function collectChest(key) {
  const st = chestStore.get(key);
  if (st) { let got = 0; for (const s of st) if (s) { addItem(s.id, s.count); got++; } if (got) { toast("Collected the chest's prizes!"); SFX.treasure(); } }
  chestStore.delete(key);
}
function openChest(key) {
  openChestK = key; if (!chestStore.has(key)) chestStore.set(key, new Array(9).fill(null));
  if (story.active && key === story.starterKey && !story.chestOpened) { story.chestOpened = true; clearObjective(); addXP(20); showBanner("Supplies recovered. Now gather Wood from the trees."); }
  if (story.active && key === story.secretKey && !story.secretOpened) { story.secretOpened = true; clearObjective(); showBanner("A buried secret! Cat Vision unlocked."); givePowerup("catvision"); }
  if (treasureKey && key === treasureKey) { treasureKey = null; clearObjective(); addCoins(15); addXP(40); SFX.treasure(); showBanner("Treasure found! +15 coins"); achieve("treasure", "Treasure Hunter"); }
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
// touch-robust tap: fire on touchend (with preventDefault) and de-dupe the synthesized click,
// so buttons that return to gameplay always work on iOS even with lingering game touch state
function tapBtn(el, fn) { if (!el) return; let h = false; el.addEventListener("touchend", e => { e.preventDefault(); h = true; fn(); setTimeout(() => h = false, 500); }, { passive: false }); el.addEventListener("click", () => { if (h) { h = false; return; } fn(); }); }
function clearInputState() { primaryHeld = false; if (typeof touch !== "undefined") { touch.jump = false; touch.sprint = false; touch.mag = 0; } input.fwd = 0; input.str = 0; if (typeof mineReset === "function") mineReset(); }
function doRespawn() {
  hide("death"); clearInputState();
  player.hp = player.maxHp; player.food = 20; player.stam = player.maxStam;
  player.pos.copy(player.spawn); player.vel.set(0, 0, 0); player.hurtCd = 2;   // brief grace so you do not instantly die again
  updateVitals(); running = true; paused = false; $("hud").classList.remove("hidden");
  if (isTouch) show("touch"); else canvas.requestPointerLock();
}
tapBtn($("respawnBtn"), doRespawn);
tapBtn($("againBtn"), () => { hide("win"); startGame(); });
// bulletproof mobile respawn: a tap anywhere on the death screen (after a short grace) respawns
$("death").addEventListener("pointerdown", e => { if (e.target && e.target.closest && e.target.closest("#respawnBtn")) return; if (performance.now() - deathT > 600) doRespawn(); });
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
$("pCollBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleColl(); });
$("closeCollBtn").addEventListener("click", () => hide("collections"));
$("pTrophyBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleTrophies(); });
$("closeTrophyBtn").addEventListener("click", () => hide("trophies"));
$("pCatsBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleWardrobe(); });
$("closeCatsBtn").addEventListener("click", () => hide("catwardrobe"));
$("pCteamBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleCTeam(); });
$("closeCteamBtn").addEventListener("click", () => hide("cteamui"));
$("pCdexBtn").addEventListener("click", () => { hide("pause"); paused = false; toggleCDex(); });
$("closeCdexBtn").addEventListener("click", () => hide("cdexui"));
$("closeCshopBtn").addEventListener("click", () => { hide("cshop"); if (!isTouch && running && !paused) canvas.requestPointerLock(); });
$("closeBadgeBtn").addEventListener("click", () => hide("badgecase"));
$("pSkinsBtn").addEventListener("click", () => { hide("pause"); paused = false; openCharacter(); });
$("closeSkinBtn").addEventListener("click", closeCharacter);
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
      skills: { mine: skills.mine, hp: skills.hp, stam: skills.stam, sword: skills.sword, cat: skills.cat, armor: skills.armor, swift: skills.swift, luck: skills.luck, pts: skills.pts },
      flags: { craftedPlanks, craftedPick, minedStone, survivedNight, tamedCat, kills, fireBossDown, tameCount, placedBlocks, movedDist },
      qi: qi, ach: [...ach], day: day, timeOfDay: timeOfDay, hotbar: hotbar, coins: coins,
      side: [...sideDone],
      cats: cats.filter(c => c.tamed).map(c => ({ x: Math.round(c.g.position.x), z: Math.round(c.g.position.z), color: c.color, level: c.level, mode: c.mode })),
      edits: { overworld: [...editsByDim.overworld], fire: [...editsByDim.fire], end: [...editsByDim.end], sky: [...editsByDim.sky], realm: [...editsByDim.realm] },
      cteam: cteam, cstorage: cstorage, cdex: [...cdex], cbadges: [...cbadges], citems: citems, realmWins: realmWins, realmBossDown: realmBossDown,
      chests: [...chestStore] };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) toast("Game saved");
    return true;
  } catch (e) { if (!silent) toast("Saving is not available here"); return false; }
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
  editsByDim.sky = new Map((data.edits && data.edits.sky) || []);
  editsByDim.realm = new Map((data.edits && data.edits.realm) || []);
  cteam = data.cteam || []; cstorage = data.cstorage || []; cdex = new Set(data.cdex || []); cbadges = new Set(data.cbadges || []);
  Object.assign(citems, data.citems || {}); realmWins = data.realmWins || 0; realmBossDown = data.realmBossDown || {};
  chestStore = new Map(data.chests || []);
  running = true; paused = false; wasNight = false; raidShown = false; dodge.t = 0; dodge.cd = 0; openChestK = null;
  story.active = false; clearObjective(); endCine();
  eventCd = 180; activeEvent = null; xpMult = 1; setEventTint(null); treasureKey = null;
  applyGfx();
  loadDimension(data.dim || "overworld", true);
  if (data.pos) { player.pos.set(data.pos[0], data.pos[1], data.pos[2]); player.spawn.copy(player.pos); }
  player.yaw = data.yaw || 0; player.pitch = data.pitch || 0; player.vel.set(0, 0, 0);
  player.hp = Math.min(player.maxHp, data.hp != null ? data.hp : player.maxHp); player.food = data.food != null ? data.food : 20; player.stam = Math.min(player.maxStam, data.stam != null ? data.stam : player.maxStam);
  sideDone.clear(); (data.side || []).forEach(s => sideDone.add(s));
  coins = data.coins || 0; updateCoinUI();
  if ((data.dim || "overworld") === "overworld") { (data.cats || []).forEach(cd => spawnCat(cd.x, cd.z, { tamed: true, color: cd.color, level: cd.level, mode: cd.mode })); spawnMerchant(7, 5); }
  renderHotbar(); updateVitals(); updateXPUI(); renderSkills(); buildViewItem();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (!isTouch) canvas.requestPointerLock();
}
$("contBtn").addEventListener("click", loadGame);
$("saveBtn").addEventListener("click", () => { const b = $("saveBtn"), prev = b.textContent, ok = saveGame(false); b.textContent = ok ? "Saved ✓" : "Save failed"; b.disabled = false; setTimeout(() => { b.textContent = prev; }, 1500); });
$("closeChestBtn").addEventListener("click", closeChest);
$("closeShopBtn").addEventListener("click", closeShop);

// ---------- POWER-UPS (easy to read timed buffs) ----------
const POWERUPS = {
  speed:      { name: "Speed Boots",  icon: "👢", dur: 30 },
  jump:       { name: "Super Jump",   icon: "🦘", dur: 30 },
  catvision:  { name: "Cat Vision",   icon: "🐾", dur: 45 },
  doublejump: { name: "Double Jump",  icon: "⏫", dur: 30 },
  glide:      { name: "Glide Cape",   icon: "🪂", dur: 30 },
  shield:     { name: "Shield Bubble", icon: "🛡️", dur: 8 }
};
const powerups = { speed: 0, jump: 0, catvision: 0, doublejump: 0, glide: 0, shield: 0 };
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
  // a couple of explosive Freda blocks to discover near camp
  for (const [fx, fz] of [[-3, -3], [6, -2]]) { const fy = surfaceY(fx, fz); put(fx, fy, fz, FREDA); }
  // rebuild touched chunks now so the camp is visible immediately
  for (const k of touched) { const p = k.split(","); buildChunk(+p[0], +p[1]); }
  rebuildTorchCells(); rebuildFredaLabels();
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

// ---------- RANDOM WORLD EVENTS (surprises with a warning, effect, and reward) ----------
let eventCd = 180, activeEvent = null, eventLeft = 0;
function setEventTint(css) { const el = $("eventTint"); if (!el) return; if (css) { el.style.background = "radial-gradient(circle, " + css + " 0%, rgba(0,0,0,0) 80%)"; el.style.opacity = "1"; } else { el.style.opacity = "0"; } }
function reward(msg, fn) { toast(msg); if (fn) fn(); SFX.levelUp(); }
function spawnRingMonster(r, type) { const a = Math.random() * 6.28; spawnMonster(Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), type); }
function dropChestNear(loot, label) {
  const a = Math.random() * 6.28, r = 6 + Math.random() * 4;
  const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r), y = surfaceY(x, z);
  setRaw(x, y, z, CHEST); recordEdit(x, y, z, CHEST);
  const arr = loot.slice(0, 9); while (arr.length < 9) arr.push(null);
  chestStore.set(chestKey(x, y, z), arr);
  buildChunk(Math.floor(x / CH), Math.floor(z / CH));
  setObjective(x + 0.5, y, z + 0.5);
  if (label) toast(label);
  return { x, y, z };
}
function meteorShower() {
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd27a })); m.position.set(player.pos.x + (Math.random() - .5) * 30, player.pos.y + 18 + Math.random() * 8, player.pos.z + (Math.random() - .5) * 30); scene.add(m); fxParts.push({ mesh: m, life: 1.6, vel: new THREE.Vector3((Math.random() - .5) * 3, -12, (Math.random() - .5) * 3) }); }
  addShake(0.25);
  dropChestNear([{ id: COBBLE, count: 12 }, { id: BOUNCE, count: 2 }, { id: I_APPLE, count: 2 }, { id: BRICK, count: 6 }], "A meteor crashed nearby. Find the crash site.");
}
const EVENTS = [
  { id: "meteor", name: "Meteor Shower", warn: "Meteors streak across the sky. Find the crash site.", dur: 25, tint: null, start() { meteorShower(); }, end() {} },
  { id: "bloodmoon", name: "Blood Moon", warn: "A Blood Moon rises. Survive the horde.", dur: 36, tint: "rgba(180,0,0,.30)", night: true, start() { for (let i = 0; i < 3; i++) spawnRingMonster(18 + Math.random() * 6); }, end() { reward("You survived the Blood Moon.", () => { addXP(80); addItem(I_APPLE, 3); }); } },
  { id: "storm", name: "Purple Storm", warn: "A corruption storm sweeps in. Hold out.", dur: 30, tint: "rgba(140,40,210,.24)", start() { for (let i = 0; i < 2; i++) spawnRingMonster(15 + Math.random() * 6); }, end() { reward("The storm passes.", () => { addXP(50); }); } },
  { id: "golden", name: "Golden Forest Day", warn: "A Golden Day. Double XP while it lasts.", dur: 35, tint: "rgba(255,210,80,.18)", start() { xpMult = 2; }, end() { xpMult = 1; toast("The golden glow fades."); } },
  { id: "merchant", name: "Traveling Merchant", warn: "A traveling merchant left a care package nearby.", dur: 20, tint: null, start() { dropChestNear([{ id: I_APPLE, count: 2 }, { id: PLANKS, count: 6 }, { id: TORCH, count: 4 }, { id: I_STICK, count: 4 }], "A care package was left nearby."); }, end() {} }
];
function startEvent(e) { activeEvent = e; eventLeft = e.dur; showBanner(e.name); toast(e.warn); SFX.screech(); if (e.tint) setEventTint(e.tint); if (e.start) e.start(); }
function endEvent() { if (!activeEvent) return; const e = activeEvent; activeEvent = null; setEventTint(null); if (e.end) e.end(); }
function updateEvents(dt) {
  if (DIM !== "overworld") { if (activeEvent) endEvent(); return; }
  if (activeEvent) { eventLeft -= dt; if (eventLeft <= 0) endEvent(); return; }
  eventCd -= dt;
  if (eventCd <= 0) { eventCd = 110 + Math.random() * 90; const pool = EVENTS.filter(e => !e.night || isNight()); if (pool.length) startEvent(pool[Math.floor(Math.random() * pool.length)]); }
}

// ---------- ECONOMY + MOUSE MERCHANT (coins, trading) ----------
let coins = 0, merchant = null;
function updateCoinUI() { const el = $("coins"); if (el) el.textContent = "🪙 " + coins; }
function addCoins(n) { coins += n; updateCoinUI(); }
function spawnMerchant(x, z) {
  if (merchant) { scene.remove(merchant.g); merchant = null; }
  const g = new THREE.Group();
  const robe = box(0.5, 0.85, 0.36, 0x4a7ec2); robe.position.y = 0.62; g.add(robe);
  const head = box(0.4, 0.4, 0.4, 0xe8b98a); head.position.y = 1.26; g.add(head);
  const hat = box(0.62, 0.18, 0.62, 0x2c4d80); hat.position.y = 1.52; g.add(hat);
  const eL = box(0.06, 0.06, 0.04, 0x111111); eL.position.set(-0.1, 1.28, 0.2); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.1; g.add(eR);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,225,110,0.95)", "rgba(255,180,40,0)"), depthWrite: false, transparent: true, fog: false })); sign.scale.set(1.1, 1.1, 1); sign.position.y = 2.1; g.add(sign);
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  merchant = { g };
}
const SHOP = [
  { name: "Apple x2", cost: 6, give: () => addItem(I_APPLE, 2) },
  { name: "Torch x4", cost: 8, give: () => addItem(TORCH, 4) },
  { name: "Cobblestone x16", cost: 10, give: () => addItem(COBBLE, 16) },
  { name: "Bounce Block x3", cost: 12, give: () => addItem(BOUNCE, 3) },
  { name: "Speed Boots (power-up)", cost: 16, give: () => givePowerup("speed") },
  { name: "Shield Bubble (power-up)", cost: 16, give: () => givePowerup("shield") },
  { name: "Mystery Power-up", cost: 24, give: () => givePowerup(randPowerup()) },
  { name: "Treasure Map", cost: 10, give: () => startTreasureHunt() }
];
function renderShop() {
  const sc = $("shopCoins"); if (sc) sc.textContent = "you have 🪙 " + coins;
  const l = $("shopList"); if (!l) return; l.innerHTML = "";
  for (const s of SHOP) {
    const ok = coins >= s.cost; const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no");
    row.innerHTML = "<span><b>" + s.name + "</b><br><span class='muted'>🪙 " + s.cost + "</span></span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = "Buy";
    b.addEventListener("pointerdown", e => { e.preventDefault(); if (coins >= s.cost) { coins -= s.cost; s.give(); SFX.pickup(); updateCoinUI(); renderShop(); } else toast("Not enough coins"); });
    row.appendChild(b); l.appendChild(row);
  }
}
function openShop() { renderShop(); show("shop"); document.exitPointerLock(); SFX.meow(); }
function closeShop() { hide("shop"); if (!isTouch && running) canvas.requestPointerLock(); }
// Treasure Hunt mini game: a map buries a chest a short trek away and points the beacon at the X
let treasureKey = null;
function startTreasureHunt() {
  if (DIM !== "overworld") { toast("Treasure maps only work in the forest."); return; }
  const a = Math.random() * 6.28, r = 22 + Math.random() * 18;
  const x = Math.floor(player.pos.x + Math.cos(a) * r), z = Math.floor(player.pos.z + Math.sin(a) * r), y = surfaceY(x, z);
  setRaw(x, y - 1, z, CHEST); setRaw(x, y, z, DIRT); recordEdit(x, y - 1, z, CHEST); recordEdit(x, y, z, DIRT);
  treasureKey = chestKey(x, y - 1, z);
  chestStore.set(treasureKey, [{ id: I_APPLE, count: 3 }, { id: BRICK, count: 8 }, { id: BOUNCE, count: 3 }, { id: COBBLE, count: 16 }, { id: TORCH, count: 6 }, null, null, null, null]);
  buildChunk(Math.floor(x / CH), Math.floor(z / CH));
  setObjective(x + 0.5, y, z + 0.5);
  showBanner("Treasure Hunt! X marks the spot."); toast("Follow the glowing marker and dig up the treasure."); SFX.power();
}

// ============================================================================
// THE CREATURE BATTLE REALM: original creatures, turn-based battles, taming.
// (Original designs/names inspired by classic creature-battler roles, no
//  trademarked characters, so the public game stays legally clear.)
// ============================================================================
const MOVES = {
  shock: { name: "Electric Shock", type: "electric", power: 18 }, fireblast: { name: "Fire Blast", type: "fire", power: 22 },
  watersurge: { name: "Water Surge", type: "water", power: 20 }, shadowball: { name: "Shadow Ball", type: "ghost", power: 20 },
  dragonstrike: { name: "Dragon Strike", type: "dragon", power: 24 }, psychicwave: { name: "Psychic Wave", type: "psychic", power: 20 },
  steelslam: { name: "Steel Slam", type: "steel", power: 18 }, darkbite: { name: "Dark Bite", type: "dark", power: 18 },
  iceslash: { name: "Ice Slash", type: "water", power: 18 }, healinglight: { name: "Healing Light", type: "fairy", power: 0, heal: 26 },
  quickattack: { name: "Quick Attack", type: "normal", power: 12 }, thunderdash: { name: "Thunder Dash", type: "electric", power: 22 },
  lavaburst: { name: "Lava Burst", type: "fire", power: 24 }, aquashield: { name: "Aqua Shield", type: "water", power: 0, shield: true },
  meteorpunch: { name: "Meteor Punch", type: "rock", power: 22 }, punch: { name: "Power Punch", type: "fighting", power: 18 },
  fairykiss: { name: "Fairy Kiss", type: "fairy", power: 18 }, earthslam: { name: "Earth Slam", type: "ground", power: 20 },
  windgust: { name: "Wind Gust", type: "flying", power: 16 }
};
const TYPE_CHART = {
  electric: { water: 2, flying: 2, ground: 0, grass: 0.5, dragon: 0.5, electric: 0.5 },
  fire: { grass: 2, steel: 2, water: 0.5, fire: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, flying: 0.5, dragon: 0.5, steel: 0.5 },
  psychic: { fighting: 2, psychic: 0.5, dark: 0 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, dark: 0.5, fighting: 0.5, fairy: 0.5 },
  fighting: { normal: 2, rock: 2, steel: 2, dark: 2, psychic: 0.5, flying: 0.5, fairy: 0.5, ghost: 0 },
  steel: { rock: 2, fairy: 2, steel: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
  ground: { fire: 2, electric: 2, rock: 2, steel: 2, grass: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  fairy: { dragon: 2, dark: 2, fighting: 2, fire: 0.5, steel: 0.5 },
  rock: { fire: 2, flying: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  normal: { rock: 0.5, ghost: 0, steel: 0.5 }
};
function typeMult(atk, def) { const m = TYPE_CHART[atk]; return (m && def in m) ? m[def] : 1; }
const SPECIES = {
  foxling: { name: "Foxling", type: "normal", role: "starter", col: 0xd8a24a, size: 0.85, hp: 42, moves: ["quickattack", "darkbite", "fairykiss", "iceslash"] },
  voltmouse: { name: "Voltmouse", type: "electric", role: "grass", col: 0xf5d020, size: 0.65, hp: 34, moves: ["shock", "quickattack", "thunderdash"] },
  aurawolf: { name: "Aurawolf", type: "fighting", role: "grass", col: 0x3a7bd5, size: 0.95, hp: 48, moves: ["punch", "steelslam", "quickattack"] },
  moonfox: { name: "Moonfox", type: "dark", role: "grass", col: 0x2a2e3c, size: 0.8, hp: 44, moves: ["darkbite", "quickattack", "fairykiss"] },
  frogblade: { name: "Frogblade", type: "water", role: "water", col: 0x2f8fd0, size: 0.9, hp: 46, moves: ["watersurge", "darkbite", "quickattack"] },
  landshark: { name: "Landshark", type: "dragon", role: "grass", col: 0x4a6a8a, size: 1.1, hp: 56, moves: ["dragonstrike", "earthslam", "darkbite"] },
  museling: { name: "Museling", type: "fairy", role: "grass", col: 0xe6a8d8, size: 0.95, hp: 50, moves: ["fairykiss", "psychicwave", "healinglight"] },
  steelmind: { name: "Steelmind", type: "steel", role: "grass", col: 0x8a93a8, size: 1.1, hp: 58, moves: ["steelslam", "psychicwave", "meteorpunch"] },
  emberwing: { name: "Emberwing", type: "fire", role: "fly", col: 0xff5a1e, size: 1.4, hp: 60, moves: ["fireblast", "lavaburst", "windgust", "dragonstrike"] },
  dragonox: { name: "Dragonox", type: "dragon", role: "sky", col: 0xe8a23a, size: 1.3, hp: 62, moves: ["dragonstrike", "windgust", "quickattack"] },
  shadeling: { name: "Shadeling", type: "ghost", role: "cave", col: 0x6a3aa0, size: 0.9, hp: 44, moves: ["shadowball", "darkbite", "psychicwave"] },
  rocktitan: { name: "Rocktitan", type: "rock", role: "grass", col: 0x6a5a44, size: 1.2, hp: 64, moves: ["meteorpunch", "earthslam", "darkbite"] },
  snoozer: { name: "Snoozer", type: "normal", role: "block", col: 0x3a5a6a, size: 1.6, hp: 90, moves: ["quickattack", "earthslam"] },
  psyclone: { name: "Psyclone", type: "psychic", role: "legendary", col: 0xb06ad0, size: 1.4, hp: 95, moves: ["psychicwave", "shadowball", "dragonstrike", "healinglight"], legend: true },
  mewling: { name: "Mewling", type: "psychic", role: "rare", col: 0xf3a6c8, size: 0.7, hp: 60, moves: ["psychicwave", "fairykiss", "quickattack"], legend: true },
  terraking: { name: "Terraking", type: "ground", role: "lava", col: 0xd14a2a, size: 1.6, hp: 100, moves: ["lavaburst", "earthslam", "meteorpunch"], legend: true },
  tidequeen: { name: "Tidequeen", type: "water", role: "water", col: 0x2a6ad0, size: 1.6, hp: 100, moves: ["watersurge", "aquashield", "iceslash"], legend: true },
  skywyrm: { name: "Skywyrm", type: "dragon", role: "sky", col: 0x2faf6a, size: 1.8, hp: 110, moves: ["dragonstrike", "windgust", "lavaburst"], legend: true },
  allbeast: { name: "Allbeast", type: "normal", role: "legendary", col: 0xeae0c0, size: 1.7, hp: 130, moves: ["dragonstrike", "psychicwave", "fairykiss", "earthslam"], legend: true }
};
const WILD_POOL = ["voltmouse", "moonfox", "aurawolf", "museling", "frogblade", "landshark", "rocktitan"];
function makeCreature(id, level, opts) {
  opts = opts || {}; const sp = SPECIES[id]; const lvl = level || 5; const maxHp = Math.round(sp.hp + lvl * 4);
  const shiny = opts.shiny != null ? opts.shiny : (Math.random() < 0.03);
  return { sp: id, name: opts.name || (shiny ? "Shiny " + sp.name : sp.name), type: sp.type, level: lvl, hp: maxHp, maxHp, moves: sp.moves.slice(0, 4), xp: 0, friendship: opts.friendship || 0, shiny };
}
function xpNeed(lvl) { return 18 + lvl * 12; }
function gainCreatureXP(c, amt) { c.xp += amt; let ups = 0; while (c.xp >= xpNeed(c.level)) { c.xp -= xpNeed(c.level); c.level++; c.maxHp += 4; c.hp = Math.min(c.maxHp, c.hp + 6); ups++; } return ups; }
function calcDamage(atk, def, mv) {
  if (!mv.power) return 0;
  const eff = typeMult(mv.type, SPECIES[def.sp].type);
  const base = mv.power * (1 + atk.level * 0.06) * eff * (0.85 + Math.random() * 0.3);
  return { dmg: Math.max(1, Math.round(base)), eff };
}
// creature 3D models (blocky, colourful, role-flavoured)
function shinyTint(c) { const col = new THREE.Color(c); col.offsetHSL(0.12, 0.25, 0.12); return col.getHex(); }
function creatureCry(type) { const base = { electric: 1200, fire: 300, water: 500, dragon: 160, ghost: 900, psychic: 760, normal: 600 }[type] || 600; blip(base, 0.1, "square", 0.07, base * 1.4); }
function buildCreatureModel(id, shiny) {
  const sp = SPECIES[id], s = sp.size || 1, col = shiny ? shinyTint(sp.col) : sp.col, ghost = sp.role === "cave" || sp.type === "ghost";
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: ghost, opacity: ghost ? 0.7 : 1, emissive: sp.legend ? col : 0x000000, emissiveIntensity: sp.legend ? 0.3 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.5 * s, 0.8 * s), mat(col)); body.position.y = 0.5 * s; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.5 * s), mat(col)); head.position.set(0, 0.85 * s, 0.5 * s); g.add(head);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: shiny ? 0xfff1a8 : 0x335577, emissiveIntensity: 0.6 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s, 0.11 * s, 0.05), eyeMat); eL.position.set(-0.12 * s, 0.92 * s, 0.76 * s); g.add(eL); const eR = eL.clone(); eR.position.x = 0.12 * s; g.add(eR);
  if (sp.type === "dragon" || sp.role === "sky") { const hL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.26 * s, 0.08 * s), mat(0xeeeeee)); hL.position.set(-0.14 * s, 1.18 * s, 0.5 * s); hL.rotation.z = 0.3; g.add(hL); const hR = hL.clone(); hR.position.x = 0.14 * s; hR.rotation.z = -0.3; g.add(hR); }
  else { const eaL = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.22 * s, 0.06 * s), mat(col)); eaL.position.set(-0.15 * s, 1.16 * s, 0.5 * s); g.add(eaL); const eaR = eaL.clone(); eaR.position.x = 0.15 * s; g.add(eaR); }
  if (sp.role === "fly" || sp.role === "sky") { const wMat = mat(shiny ? 0xffffff : 0xcfeaff); const wl = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.08, 0.6 * s), wMat); wl.position.set(-0.62 * s, 0.6 * s, 0); g.add(wl); const wr = wl.clone(); wr.position.x = 0.62 * s; g.add(wr); g.userData.wings = [wl, wr]; }
  const legs = []; for (const lx of [-0.18 * s, 0.18 * s]) for (const lz of [0.25 * s, -0.25 * s]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.3 * s, 0.14 * s), mat(col)); l.geometry.translate(0, -0.15 * s, 0); l.position.set(lx, 0.3 * s, lz); g.add(l); legs.push(l); }
  g.userData.legs = legs;
  if (sp.legend) { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,245,180,0.8)", "rgba(255,200,80,0)"), depthWrite: false, transparent: true, fog: false })); aura.scale.set(3.2 * s, 3.2 * s, 1); aura.position.y = 0.8 * s; g.add(aura); }
  else if (shiny) { const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,255,255,0.9)", "rgba(180,220,255,0)"), depthWrite: false, transparent: true, fog: false })); sg.scale.set(2 * s, 2 * s, 1); sg.position.y = 0.8 * s; g.add(sg); }
  return g;
}
// team + collection
let cteam = [], cstorage = [], cdex = new Set(), cbadges = new Set();
function addCreature(c) { cdex.add(c.sp); if (cteam.length < 6) { cteam.push(c); return "team"; } cstorage.push(c); return "storage"; }
// roaming creatures in the realm
let realmCreatures = [], encounterCd = 0;
function clearRealmCreatures() { for (const c of realmCreatures) scene.remove(c.g); realmCreatures = []; }
function spawnRealmCreature(id, x, z, level) {
  const shiny = Math.random() < 0.04, g = buildCreatureModel(id, shiny), sp = SPECIES[id], fly = sp.role === "fly" || sp.role === "sky";
  g.position.set(x + 0.5, fly ? surfaceY(x, z) + 6 : surfaceY(x, z), z + 0.5); scene.add(g);
  realmCreatures.push({ id, g, sp, level, fly, shiny, dir: Math.random() * 6.28, t: Math.random() * 6, soundCd: Math.random() * 8, walkT: 0 });
}
function enterRealm() {
  clearRealmCreatures(); clearRealmNPCs(); clearRealmBosses(); encounterCd = 0; realmHinted = {};
  if (!cteam.length) { cteam.push(makeCreature("foxling", 5, { shiny: false })); cdex.add("foxling"); toast("Foxling joins you as your battle companion!"); }
  // hub NPCs near the spawn portal
  spawnRealmNPC("nurse", 3, 3); spawnRealmNPC("shop", 6, 3); spawnRealmNPC("trainer", -3, 4); spawnRealmNPC("badge", 0, 6);
  spawnRealmBosses(); spawnSnoozer();
  if (Math.random() < 0.5) { const a = Math.random() * 6.28, r = 18 + Math.random() * 16; spawnRealmCreature("mewling", Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 10); }   // rare playful legendary
  const roamers = ["voltmouse", "moonfox", "aurawolf", "museling", "landshark", "steelmind", "rocktitan"];
  for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 22; spawnRealmCreature(roamers[Math.floor(Math.random() * roamers.length)], Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 3 + Math.floor(Math.random() * 5)); }
  for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 16 + Math.random() * 12; spawnRealmCreature(Math.random() < 0.5 ? "emberwing" : "dragonox", Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 8); }
  setQuest("Walk through the tall grass to find wild creatures, then Battle and Tame them.");
}
function updateRealm(dt) {
  for (const c of realmCreatures) {
    const dpx = player.pos.x - c.g.position.x, dpz = player.pos.z - c.g.position.z, dp = Math.hypot(dpx, dpz) || 1;
    if (c.fly) { c.t += dt; c.g.position.x += Math.cos(c.dir) * 1.4 * dt; c.g.position.z += Math.sin(c.dir) * 1.4 * dt; if (Math.random() < 0.012) c.dir += (Math.random() - .5); c.g.position.y = surfaceY(c.g.position.x, c.g.position.z) + 6 + Math.sin(c.t) * 0.6; if (c.g.userData.wings) { const f = Math.sin(c.t * 8) * 0.5; c.g.userData.wings[0].rotation.z = -f; c.g.userData.wings[1].rotation.z = f; } c.g.rotation.y = c.dir + Math.PI / 2; }
    else {
      if (dp < 6 && dp > 1.4) { c.dir = Math.atan2(c.g.position.x - player.pos.x, c.g.position.z - player.pos.z); c.g.position.x += Math.sin(c.dir) * 2.2 * dt; c.g.position.z += Math.cos(c.dir) * 2.2 * dt; }   // shy: drift away
      else { if (Math.random() < 0.012) c.dir += (Math.random() - .5) * 1.5; c.g.position.x += Math.sin(c.dir) * 1.1 * dt; c.g.position.z += Math.cos(c.dir) * 1.1 * dt; }
      c.g.rotation.y = c.dir; fallToGround(c, dt);
      c.walkT += dt * 8; const sw = Math.sin(c.walkT) * 0.5, L = c.g.userData.legs; if (L) { L[0].rotation.x = sw; L[1].rotation.x = -sw; L[2].rotation.x = -sw; L[3].rotation.x = sw; }
      if (!cmenuOpen && !battle && encounterCd <= 0 && dp < 2.1) openEncounter(makeCreature(c.id, c.level, { shiny: c.shiny }), c);
    }
    c.soundCd -= dt; if (c.soundCd <= 0) { c.soundCd = 6 + Math.random() * 8; if (dp < 14) creatureCry(c.sp.type); }
  }
  // arena bosses idle with a glow bob; show a one-time challenge hint when Thomas gets close
  for (const b of realmBosses) { b.t += dt; b.g.position.y = surfaceY(b.x, b.z) + Math.sin(b.t * 1.5) * 0.2; b.g.rotation.y += dt * 0.4; if (!battle && !cmenuOpen && b.g.position.distanceTo(player.pos) < 4 && !realmHinted[b.badge]) { realmHinted[b.badge] = 1; showBanner(b.label + " — press Use to challenge!"); } }
  if (realmSnoozer && !battle && !cmenuOpen && realmSnoozer.g.position.distanceTo(player.pos) < 4 && !realmHinted.snoozer) { realmHinted.snoozer = 1; showBanner("A huge Snoozer blocks the path. Feed it Creature Food (press Use)."); }
  if (encounterCd > 0) encounterCd -= dt;
  const feet = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z)), eye = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.6), Math.floor(player.pos.z));
  if ((feet === TALLGRASS || eye === TALLGRASS) && encounterCd <= 0 && !cmenuOpen && !battle) { encounterCd = 1.4; if (Math.random() < 0.3) { SFX.mine(); openEncounter(makeCreature(WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)], 3 + Math.floor(Math.random() * 5)), null); } }
}
// ---- encounter menu (Battle / Tame / Feed / Run) ----
let cmenuOpen = false, cmenu = null;
function openEncounter(wild, roamRef) {
  cmenu = { wild, roam: roamRef }; cmenuOpen = true; encounterCd = 3; creatureCry(wild.type);
  const p = $("cmenuPanel"); if (p) {
    p.innerHTML = "<h2>" + (wild.shiny ? "✨ " : "") + "A wild " + wild.name + " appeared!</h2><p class='muted'>Level " + wild.level + " · " + SPECIES[wild.sp].type + " type</p>";
    const row = document.createElement("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px";
    const mk = (label, fn) => { const b = document.createElement("button"); b.className = "btn"; b.textContent = label; b.addEventListener("click", fn); row.appendChild(b); };
    mk("Battle", () => { closeCMenu(); startBattle(wild, roamRef); });
    mk("Tame", () => tryTameFromMenu());
    mk("Feed", () => { wild.friendship += 2; toast(wild.name + " looks friendlier."); SFX.pickup(); });
    mk("Run", closeCMenu);
    p.appendChild(row);
  }
  show("cmenu"); document.exitPointerLock();
}
function closeCMenu() { cmenuOpen = false; cmenu = null; hide("cmenu"); if (!isTouch && running && !paused) canvas.requestPointerLock(); }
function tameChance(wild) { return Math.min(0.92, 0.28 + (1 - wild.hp / wild.maxHp) * 0.5 + wild.friendship * 0.04 + (wild.shiny ? -0.1 : 0)); }
function tryTameFromMenu() {
  const wild = cmenu.wild, roam = cmenu.roam;
  if (Math.random() < tameChance(wild)) { const where = addCreature(wild); SFX.victory(); showBanner("You befriended " + wild.name + "!"); toast(where === "team" ? wild.name + " joined your team." : wild.name + " went to your storage shrine."); if (roam) { scene.remove(roam.g); realmCreatures = realmCreatures.filter(c => c !== roam); } closeCMenu(); }
  else { toast(wild.name + " broke free! Weaken it in battle first."); SFX.hurt(); }
}
// ---- turn-based battle ----
let battle = null;
function startBattle(wild, roamRef, opts) {
  opts = opts || {};
  if (!cteam.length) cteam.push(makeCreature("foxling", 5));
  let mine = cteam.find(c => c.hp > 0); if (!mine) { toast("Your creatures are too tired. Visit the Healing Nurse."); return; }
  battle = { wild, mine, roam: roamRef, over: false, busy: false, trainer: !!opts.trainer, boss: opts.boss || null, badge: opts.badge || null, bossRef: opts.bossRef || null, phase: 1, log: opts.intro || (opts.trainer ? "A Trainer sends out " + wild.name + "!" : "A wild " + wild.name + " challenges you!") };
  renderBattle(); show("battle"); document.exitPointerLock(); SFX.screech();
}
function renderBattle() {
  const p = $("battlePanel"); if (!p || !battle) return; const b = battle;
  const bar = (c) => "<div class='cbar'><div class='cbarfill' style='width:" + Math.max(0, 100 * c.hp / c.maxHp) + "%'></div></div>";
  let html = "<div class='battleRow'><div class='cbox'><b>" + (b.wild.shiny ? "✨" : "") + b.wild.name + "</b> Lv" + b.wild.level + bar(b.wild) + "<span class='muted'>" + Math.max(0, b.wild.hp | 0) + "/" + b.wild.maxHp + " · " + SPECIES[b.wild.sp].type + "</span></div>";
  html += "<div class='cbox mine'><b>" + b.mine.name + "</b> Lv" + b.mine.level + bar(b.mine) + "<span class='muted'>" + Math.max(0, b.mine.hp | 0) + "/" + b.mine.maxHp + " · " + SPECIES[b.mine.sp].type + "</span></div></div>";
  html += "<div class='battleLog'>" + b.log + "</div>";
  p.innerHTML = html;
  const grid = document.createElement("div"); grid.className = "moveGrid";
  if (!b.over) {
    b.mine.moves.forEach((mid, i) => { const mv = MOVES[mid]; const btn = document.createElement("button"); btn.className = "mvBtn"; btn.innerHTML = "<b>" + mv.name + "</b><span>" + mv.type + (mv.power ? " · " + mv.power : "") + "</span>"; btn.addEventListener("click", () => doMove(i)); grid.appendChild(btn); });
  }
  p.appendChild(grid);
  const row = document.createElement("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px";
  const mk = (l, fn) => { const x = document.createElement("button"); x.className = "btn ghost"; x.textContent = l; x.addEventListener("click", fn); row.appendChild(x); };
  if (!b.over) {
    if (!b.trainer && !b.boss) mk("Tame" + (citems.capture > 0 ? " (💎" + citems.capture + ")" : ""), tryTameBattle);
    if (citems.potion > 0) mk("Potion (" + citems.potion + ")", useBattlePotion);
    mk(b.trainer || b.boss ? "Forfeit" : "Run", () => { battle = null; hide("battle"); closeCMenu(); });
  } else mk("Continue", () => { battle = null; hide("battle"); closeCMenu(); });
  p.appendChild(row);
}
function useBattlePotion() {
  const b = battle; if (!b || b.over || b.busy || citems.potion <= 0) return;
  citems.potion--; b.mine.hp = Math.min(b.mine.maxHp, b.mine.hp + 30); b.log = "You used a Healing Potion on " + b.mine.name + ". (+30)"; b.busy = true; renderBattle(); setTimeout(enemyTurn, 600);
}
function doMove(i) {
  const b = battle; if (!b || b.over || b.busy) return; b.busy = true;
  const mv = MOVES[b.mine.moves[i]];
  if (mv.heal) { b.mine.hp = Math.min(b.mine.maxHp, b.mine.hp + mv.heal); b.log = b.mine.name + " used " + mv.name + " and recovered."; }
  else if (mv.shield) { b.mine.shield = true; b.log = b.mine.name + " raised " + mv.name + "."; }
  else { const r = calcDamage(b.mine, b.wild, mv); b.wild.hp -= r.dmg; b.log = b.mine.name + " used " + mv.name + "! " + (r.eff > 1 ? "Super effective! " : r.eff < 1 ? "Not very effective. " : "") + "(" + r.dmg + ")"; }
  renderBattle();
  if (b.wild.hp <= 0) { return winBattle(); }
  setTimeout(() => { enemyTurn(); }, 600);
}
function enemyTurn() {
  const b = battle; if (!b || b.over) return;
  if (b.boss) { const frac = b.wild.hp / b.wild.maxHp, ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3; if (ph > b.phase) { b.phase = ph; b.wild.hp = Math.min(b.wild.maxHp, b.wild.hp + 8); b.log = b.wild.name + " powers up to phase " + ph + "!"; renderBattle(); } }
  const mid = b.wild.moves[Math.floor(Math.random() * b.wild.moves.length)], mv = MOVES[mid];
  if (mv.heal) { b.wild.hp = Math.min(b.wild.maxHp, b.wild.hp + mv.heal); b.log = b.wild.name + " used " + mv.name + "."; }
  else { let r = calcDamage(b.wild, b.mine, mv); if (b.boss) r.dmg = Math.round(r.dmg * (1 + (b.phase - 1) * 0.2)); if (b.mine.shield) { r.dmg = Math.round(r.dmg * 0.5); b.mine.shield = false; } b.mine.hp -= r.dmg; b.log = (b.trainer ? "" : b.boss ? "" : "Wild ") + b.wild.name + " used " + mv.name + "! (" + r.dmg + ")"; }
  b.busy = false; renderBattle();
  if (b.mine.hp <= 0) {
    const next = cteam.find(c => c.hp > 0 && c !== b.mine);
    if (next) { b.mine = next; b.log = "Your creature fainted. Go, " + next.name + "!"; renderBattle(); }
    else { b.over = true; b.log = "All your creatures fainted! Heal at a station."; cteam.forEach(c => { c.hp = Math.max(1, Math.round(c.maxHp * 0.3)); }); renderBattle(); }
  }
}
function winBattle() {
  const b = battle; b.over = true;
  const reward = Math.round((14 + b.wild.level * 6) * (b.boss ? 3 : b.trainer ? 1.5 : 1));
  const ups = gainCreatureXP(b.mine, reward); b.mine.friendship++;
  cdex.add(b.wild.sp); addCoins(Math.round((b.wild.level + 4) * (b.boss ? 4 : b.trainer ? 2 : 1))); realmWins++;
  let extra = "";
  if (b.boss && b.badge) { if (!cbadges.has(b.badge)) { cbadges.add(b.badge); extra = " The " + b.badge + " badge is yours!"; showBanner("Badge earned: " + b.badge + "!"); } realmBossDown[b.badge] = true; if (b.bossRef) { scene.remove(b.bossRef.g); realmBosses = realmBosses.filter(x => x !== b.bossRef); } }
  b.log = "You defeated " + b.wild.name + "! +" + reward + " XP" + (ups ? ". Lv" + b.mine.level + "!" : "") + extra;
  if (b.roam) { scene.remove(b.roam.g); realmCreatures = realmCreatures.filter(c => c !== b.roam); }
  SFX.victory(); renderBattle();
}
function tryTameBattle() {
  const b = battle; if (!b || b.over || b.busy || b.trainer || b.boss) return;
  let chance = tameChance(b.wild); if (citems.capture > 0) { citems.capture--; chance = Math.min(0.97, chance + 0.28); }
  if (Math.random() < chance) { b.over = true; const where = addCreature(b.wild); b.log = "Gotcha! " + b.wild.name + (where === "team" ? " joined your team." : " went to storage."); SFX.victory(); showBanner("Befriended " + b.wild.name + "!"); if (b.roam) { scene.remove(b.roam.g); realmCreatures = realmCreatures.filter(c => c !== b.roam); } renderBattle(); }
  else { b.log = b.wild.name + " broke free! Weaken it more."; b.busy = true; renderBattle(); setTimeout(enemyTurn, 600); }
}

// ---- Creature Realm: NPCs, healing, items, shop, badges, team/dex menus ----
let realmNPCs = [], realmWins = 0, realmBossDown = {};
const citems = { potion: 0, capture: 0, food: 0 };
const NPC_DEFS = { nurse: { name: "Healing Nurse", col: 0xff8aa0, hat: 0xffffff }, shop: { name: "Shopkeeper", col: 0x4a7ec2, hat: 0x2c4d80 }, trainer: { name: "Creature Trainer", col: 0x6abf6a, hat: 0x2f7a2f }, badge: { name: "Badge Master", col: 0xe8b23a, hat: 0xc98a1e } };
function buildNPC(kind) {
  const d = NPC_DEFS[kind], g = new THREE.Group();
  const robe = box(0.5, 0.85, 0.36, d.col); robe.position.y = 0.62; g.add(robe);
  const head = box(0.4, 0.4, 0.4, 0xe8b98a); head.position.y = 1.26; g.add(head);
  const hat = box(0.62, 0.18, 0.62, d.hat); hat.position.y = 1.5; g.add(hat);
  const eL = box(0.06, 0.06, 0.04, 0x111114); eL.position.set(-0.1, 1.28, 0.2); g.add(eL); const eR = eL.clone(); eR.position.x = 0.1; g.add(eR);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,235,150,0.95)", "rgba(255,200,80,0)"), depthWrite: false, transparent: true, fog: false })); sign.scale.set(1.1, 1.1, 1); sign.position.y = 2.05; g.add(sign);
  return g;
}
function spawnRealmNPC(kind, x, z) { const g = buildNPC(kind); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g); realmNPCs.push({ kind, g }); }
function clearRealmNPCs() { for (const n of realmNPCs) scene.remove(n.g); realmNPCs = []; }
function healTeam() { cteam.forEach(c => c.hp = c.maxHp); cstorage.forEach(c => c.hp = c.maxHp); toast("Your creatures are fully healed!"); showBanner("Team healed"); SFX.levelUp(); }
const CSHOP = [{ k: "potion", name: "Healing Potion", cost: 8, desc: "Heal a creature 30 HP in battle" }, { k: "capture", name: "Capture Crystal", cost: 12, desc: "Big taming boost" }, { k: "food", name: "Creature Food", cost: 6, desc: "Raise friendship / move Snoozer" }];
function renderCShop() {
  const sc = $("cshopCoins"); if (sc) sc.textContent = "you have 🪙 " + coins; const l = $("cshopList"); if (!l) return; l.innerHTML = "";
  for (const s of CSHOP) { const ok = coins >= s.cost; const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no"); row.innerHTML = "<span><b>" + s.name + "</b> x" + (citems[s.k] || 0) + "<br><span class='muted'>🪙 " + s.cost + " · " + s.desc + "</span></span>"; const b = document.createElement("button"); b.className = "mk"; b.textContent = "Buy"; b.addEventListener("pointerdown", e => { e.preventDefault(); if (coins >= s.cost) { coins -= s.cost; citems[s.k] = (citems[s.k] || 0) + 1; SFX.pickup(); updateCoinUI(); renderCShop(); } else toast("Not enough coins"); }); row.appendChild(b); l.appendChild(row); }
}
function openCShop() { renderCShop(); show("cshop"); document.exitPointerLock(); SFX.meow(); }
function trainerBattle() { const ids = Object.keys(SPECIES).filter(s => !SPECIES[s].legend && SPECIES[s].role !== "block"); const id = ids[Math.floor(Math.random() * ids.length)]; const avg = Math.max(5, Math.round(cteam.reduce((a, c) => a + c.level, 0) / Math.max(1, cteam.length))); startBattle(makeCreature(id, avg + 1), null, { trainer: true, intro: "The Creature Trainer challenges you!" }); }
const BADGES = [{ id: "forest", name: "Forest Badge", ic: "🌿" }, { id: "cave", name: "Cave Badge", ic: "👻" }, { id: "fire", name: "Fire Badge", ic: "🔥" }, { id: "water", name: "Water Badge", ic: "💧" }, { id: "sky", name: "Sky Badge", ic: "🌪️" }, { id: "psychic", name: "Mind Badge", ic: "🔮" }, { id: "lava", name: "Magma Badge", ic: "🌋" }, { id: "legendary", name: "Legend Badge", ic: "⭐" }];
function renderBadgeCase() { const el = $("badgeList"); if (!el) return; el.innerHTML = ""; let n = 0; for (const bd of BADGES) { const got = cbadges.has(bd.id); if (got) n++; const d = document.createElement("div"); d.className = "trophy" + (got ? " got" : ""); d.innerHTML = "<div class='ti'>" + (got ? bd.ic : "❔") + "</div><div class='tn'>" + (got ? bd.name : "???") + "</div>"; el.appendChild(d); } const h = $("badgeCount"); if (h) h.textContent = n + " / " + BADGES.length; }
function openBadgeCase() { if (realmWins >= 3 && !cbadges.has("forest")) { cbadges.add("forest"); showBanner("Forest Badge earned!"); SFX.victory(); toast("Badge Master: you've proven yourself. Take the Forest Badge!"); } renderBadgeCase(); show("badgecase"); document.exitPointerLock(); }
function renderCTeam() {
  const el = $("cteamList"); if (!el) return; el.innerHTML = "";
  const hd = t => { const h = document.createElement("div"); h.className = "muted"; h.style.cssText = "font-size:12px;letter-spacing:1px;margin:8px 0 4px"; h.textContent = t; el.appendChild(h); };
  hd("TEAM (" + cteam.length + "/6)");
  if (!cteam.length) { const e = document.createElement("div"); e.className = "muted"; e.textContent = "No creatures yet. Tame some in the realm!"; el.appendChild(e); }
  cteam.forEach((c, i) => { const row = document.createElement("div"); row.className = "craftRow"; row.innerHTML = "<span><b>" + (i === 0 ? "★ " : "") + (c.shiny ? "✨" : "") + c.name + "</b> Lv" + c.level + " " + SPECIES[c.sp].type + "<br><span class='muted'>HP " + (c.hp | 0) + "/" + c.maxHp + " · ♥" + c.friendship + " · " + c.moves.map(m => MOVES[m].name).join(", ") + "</span></span>"; if (i > 0) { const b = document.createElement("button"); b.className = "mk"; b.textContent = "Lead"; b.addEventListener("pointerdown", e => { e.preventDefault(); cteam.unshift(cteam.splice(i, 1)[0]); renderCTeam(); }); row.appendChild(b); } el.appendChild(row); });
  if (cstorage.length) { hd("STORAGE SHRINE (" + cstorage.length + ")"); cstorage.forEach((c, i) => { const row = document.createElement("div"); row.className = "craftRow no"; row.innerHTML = "<span><b>" + (c.shiny ? "✨" : "") + c.name + "</b> Lv" + c.level + " " + SPECIES[c.sp].type + "</span>"; if (cteam.length < 6) { const b = document.createElement("button"); b.className = "mk"; b.textContent = "Take"; b.addEventListener("pointerdown", e => { e.preventDefault(); cteam.push(cstorage.splice(i, 1)[0]); renderCTeam(); }); row.appendChild(b); } el.appendChild(row); }); }
}
function toggleCTeam() { const o = $("cteamui"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderCTeam(); o.classList.remove("hidden"); } }
function renderCDex() { const el = $("cdexList"); if (!el) return; el.innerHTML = ""; let n = 0; const ids = Object.keys(SPECIES); for (const id of ids) { const got = cdex.has(id); if (got) n++; const sp = SPECIES[id]; const row = document.createElement("div"); row.className = "craftRow" + (got ? "" : " no"); row.innerHTML = "<span><b>" + (got ? sp.name : "???") + "</b>" + (got ? " <span class='muted'>" + sp.type + (sp.legend ? " · legendary" : "") + "</span>" : "") + "</span>"; el.appendChild(row); } const h = $("cdexCount"); if (h) h.textContent = n + " / " + ids.length; }
function toggleCDex() { const o = $("cdexui"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderCDex(); o.classList.remove("hidden"); } }
// ---- arena bosses + legendary fights + the Snoozer road block ----
let realmBosses = [], realmSnoozer = null, realmHinted = {};
const BOSS_PLAN = [
  { id: "shadeling", badge: "cave", x: -24, z: 6, name: "Shadeling, the Cave Phantom" },
  { id: "emberwing", badge: "fire", x: 24, z: 6, name: "Emberwing, the Fire Drake" },
  { id: "tidequeen", badge: "water", x: 8, z: 26, name: "Tidequeen of the Deep" },
  { id: "terraking", badge: "lava", x: -8, z: -26, name: "Terraking of the Magma" },
  { id: "psyclone", badge: "psychic", x: -26, z: -6, name: "Psyclone, the Mind Tyrant" },
  { id: "skywyrm", badge: "sky", x: 26, z: -10, name: "Skywyrm, the Sky Serpent" }
];
function spawnRealmBoss(id, badge, x, z, label) {
  const g = buildCreatureModel(id, false); g.scale.multiplyScalar(1.5); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  realmBosses.push({ id, badge, g, x, z, label, t: Math.random() * 6, final: badge === "legendary" });
}
function spawnRealmBosses() {
  for (const b of BOSS_PLAN) if (!realmBossDown[b.badge]) spawnRealmBoss(b.id, b.badge, b.x, b.z, b.name);
  if (!realmBossDown.legendary) spawnRealmBoss("allbeast", "legendary", 0, 34, "Allbeast, the Creator");   // final, gated until others fall
}
function clearRealmBosses() { for (const b of realmBosses) scene.remove(b.g); realmBosses = []; if (realmSnoozer) { scene.remove(realmSnoozer.g); realmSnoozer = null; } }
function spawnSnoozer() { if (realmBossDown.snoozer) return; const x = 0, z = 15; const g = buildCreatureModel("snoozer", false); g.scale.multiplyScalar(1.4); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); g.rotation.y = Math.PI; scene.add(g); realmSnoozer = { g, x, z }; }
function teamAvgLevel() { return cteam.length ? Math.round(cteam.reduce((a, c) => a + c.level, 0) / cteam.length) : 5; }
function challengeBoss(b) {
  if (b.final) {
    const need = BOSS_PLAN.length, have = BOSS_PLAN.filter(p => realmBossDown[p.badge]).length;
    if (have < need) { toast("The Allbeast slumbers. Defeat all " + need + " arena bosses first (" + have + "/" + need + ")."); return; }
  }
  const lvl = Math.max(12, teamAvgLevel() + 6) + (b.final ? 8 : 0);
  startBattle(makeCreature(b.id, lvl), null, { boss: true, badge: b.badge, bossRef: b, intro: (b.label || b.id) + " rises to battle!" });
}
function feedSnoozer() {
  if (citems.food > 0) { citems.food--; realmBossDown.snoozer = true; scene.remove(realmSnoozer.g); realmSnoozer = null; addCoins(20); showBanner("Snoozer waddles off! The path is clear."); toast("You fed Snoozer. It happily moves aside. +20 coins"); SFX.victory(); }
  else { toast("Snoozer is fast asleep and hungry. Buy Creature Food from the Shop, then feed it."); }
}
function realmInteract() {   // Use near a realm NPC, boss, or the Snoozer. returns true if handled
  if (DIM !== "realm") return false;
  if (realmSnoozer && realmSnoozer.g.position.distanceTo(player.pos) < 3.2) { feedSnoozer(); return true; }
  let bb = null, bd = 3.6; for (const b of realmBosses) { const d = b.g.position.distanceTo(player.pos); if (d < bd) { bd = d; bb = b; } }
  if (bb) { challengeBoss(bb); return true; }
  let np = null, nd = 3.4; for (const n of realmNPCs) { const d = n.g.position.distanceTo(player.pos); if (d < nd) { nd = d; np = n; } }
  if (!np) return false;
  if (np.kind === "nurse") healTeam(); else if (np.kind === "shop") openCShop(); else if (np.kind === "trainer") trainerBattle(); else if (np.kind === "badge") openBadgeCase();
  return true;
}

// ---------- GAME START ----------
// ---------- MINIMAP (UISystem) ----------
const mmCv = document.getElementById("minimap"), mmx = mmCv.getContext("2d");
mmCv.width = 220; mmCv.height = 220;                 // crisp internal resolution (CSS controls display size)
let mmT = 0, mmBig = false;
mmCv.style.pointerEvents = "auto";
mmCv.addEventListener("pointerdown", e => { e.preventDefault(); mmBig = !mmBig; mmCv.classList.toggle("big", mmBig); drawMinimap(); });
function mmDot(W, span, cx, cz, ex, ez, color, r) {
  const mx = ((ex - cx) / span + 0.5) * W, mz = ((ez - cz) / span + 0.5) * W;
  if (mx < 2 || mx > W - 2 || mz < 2 || mz > W - 2) return;
  mmx.fillStyle = color; mmx.strokeStyle = "rgba(0,0,0,.55)"; mmx.lineWidth = 1.5;
  mmx.beginPath(); mmx.arc(mx, mz, r || 3.2, 0, 6.2832); mmx.fill(); mmx.stroke();
}
function drawMinimap() {
  const W = mmCv.width, span = mmBig ? 160 : 96, N = mmBig ? 64 : 52, step = span / N, px = W / N, cx = player.pos.x, cz = player.pos.z;
  mmx.clearRect(0, 0, W, W);
  if (DIM !== "overworld") { mmx.fillStyle = DIM === "fire" ? "#3a0d0d" : DIM === "sky" ? "#5aa0e0" : "#0c0c14"; mmx.fillRect(0, 0, W, W); }
  else {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = cx + (i - N / 2) * step, wz = cz + (j - N / 2) * step;   // j=0 north (-z), i=0 west (-x)
      const h = heightAt(wx, wz), b = biomeAt(wx, wz);
      const peak = h > SEA + 16, snow = b.t < 0.28 && h > SEA + 6, desert = b.t > 0.66 && !peak && h > SEA, forest = b.m > 0.58 && !desert && !peak;
      const beach = h > SEA && h <= SEA + 1;
      let col;
      if (h <= SEA - 3) col = [38, 84, 168]; else if (h <= SEA) col = [60, 120, 200]; else if (beach) col = [222, 208, 150];
      else if (peak) col = [236, 242, 248]; else if (snow) col = [206, 224, 236]; else if (desert) col = [212, 196, 128]; else if (forest) col = [48, 116, 50]; else col = [108, 170, 90];
      const s = 0.74 + Math.max(-0.2, (h - SEA) / 38);
      mmx.fillStyle = "rgb(" + Math.min(255, (col[0] * s) | 0) + "," + Math.min(255, (col[1] * s) | 0) + "," + Math.min(255, (col[2] * s) | 0) + ")";
      mmx.fillRect(i * px, j * px, px + 1.2, px + 1.2);
    }
  }
  // live entity dots
  if (typeof mice !== "undefined") for (const m of mice) mmDot(W, span, cx, cz, m.g.position.x, m.g.position.z, m.golden ? "#ffd24a" : "#d8d8d8", 2);
  if (typeof monsters !== "undefined") for (const m of monsters) if (!m.dead) mmDot(W, span, cx, cz, m.g.position.x, m.g.position.z, m.elite ? "#ff66ff" : "#ff4444", 3);
  if (typeof cats !== "undefined") for (const c of cats) mmDot(W, span, cx, cz, c.g.position.x, c.g.position.z, c.tamed ? "#6cff6c" : "#bfffbf", 3);
  if (typeof merchant !== "undefined" && merchant) mmDot(W, span, cx, cz, merchant.g.position.x, merchant.g.position.z, "#ffe066", 3.5);
  if (typeof objMarker !== "undefined" && objMarker && objMarker.visible) mmDot(W, span, cx, cz, objMarker.position.x, objMarker.position.z, "#fff14a", 4);
  // player arrow at centre, pointing where Thomas faces
  const c = W / 2;
  mmx.save(); mmx.translate(c, c); mmx.rotate(-player.yaw);
  mmx.fillStyle = "#fff"; mmx.strokeStyle = "rgba(0,0,0,.7)"; mmx.lineWidth = 2;
  const a = W / 18;
  mmx.beginPath(); mmx.moveTo(0, -a * 1.3); mmx.lineTo(a, a); mmx.lineTo(0, a * 0.5); mmx.lineTo(-a, a); mmx.closePath(); mmx.fill(); mmx.stroke();
  mmx.restore();
  // north marker
  mmx.fillStyle = "rgba(255,255,255,.85)"; mmx.font = "bold " + (W / 16) + "px ui-monospace,monospace"; mmx.textAlign = "center"; mmx.textBaseline = "top";
  mmx.fillText("N", c, 3);
}

function startGame() {
  initAudio(); hide("menu"); hide("win"); hide("death"); $("hud").classList.remove("hidden");
  if (isTouch) show("touch");
  skills.pts = 0; skills.mine = skills.hp = skills.stam = skills.sword = skills.cat = skills.armor = skills.swift = skills.luck = 0; applySkills();
  player.hp = player.maxHp; player.food = 20; player.stam = player.maxStam; running = true; paused = false;
  // starter kit (TODO: true survival empty start)
  for (let i = 0; i < 9; i++) hotbar[i] = null;
  hotbar[0] = { id: I_WPICK, count: 1 }; hotbar[1] = { id: I_SWORD, count: 1 }; hotbar[2] = { id: DIRT, count: 20 }; hotbar[3] = { id: I_APPLE, count: 3 };
  selSlot = 0;
  applyGfx();
  loadDimension("overworld");
  setQuest(quests[0].text); qi = 0; kills = 0; minedStone = 0; survivedNight = false; tamedCat = false; craftedPick = false; craftedPlanks = false; fireBossDown = false;
  xp = 0; level = 1; xpNext = 50; placedBlocks = 0; movedDist = 0; tameCount = 0; ach.clear(); loadAch(); dodge.t = 0; dodge.cd = 0; wasNight = false; raidShown = false; updateXPUI(); renderSkills();
  editsByDim.overworld = new Map(); editsByDim.fire = new Map(); editsByDim.end = new Map(); editsByDim.sky = new Map(); editsByDim.realm = new Map(); chestStore = new Map(); openChestK = null; day = 1; timeOfDay = 0.28;
  cteam = []; cstorage = []; cdex = new Set(); cbadges = new Set(); battle = null; cmenuOpen = false; citems.potion = citems.capture = citems.food = 0; realmWins = 0; realmBossDown = {};
  clearObjective(); story.active = false;
  eventCd = 180; activeEvent = null; xpMult = 1; setEventTint(null);
  coins = 0; updateCoinUI(); spawnMerchant(7, 5); treasureKey = null;   // a friendly trader near camp
  initDaily();
  if (ngLevel > 0) setTimeout(() => toast("New Game Plus " + ngLevel + ". Monsters are tougher, rewards are bigger."), 900);
  setTimeout(() => { if (daily && !daily.claimed) toast("Daily Challenge: " + daily.text + ". Open the Journal to track it."); }, 1600);
  const camp = buildSpawnCamp(); startStory(camp);            // opening cinematic + guided first 5 minutes
  renderHotbar(); updateVitals(); buildViewItem();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (!isTouch) canvas.requestPointerLock();
}
// panels that open during play; while any is open the world freezes so you cannot be killed in a menu
const GAME_PANELS = ["inv", "skills", "journal", "chest", "shop", "ach", "collections", "trophies", "catwardrobe", "skinpicker", "settings", "cmenu", "battle", "cshop", "cteamui", "cdexui", "badgecase"];
function anyPanelOpen() { for (const id of GAME_PANELS) { const e = document.getElementById(id); if (e && !e.classList.contains("hidden")) return true; } return false; }
function hideAllPanels() { for (const id of GAME_PANELS) { const e = document.getElementById(id); if (e) e.classList.add("hidden"); } }
let deathT = 0;
function die() {
  if (!running) return;
  running = false; paused = false; charView = false; clearInputState(); hideAllPanels();
  document.exitPointerLock(); hide("touch"); $("hud").classList.add("hidden");
  deathT = performance.now(); show("death");
}

// ---------- MAIN LOOP ----------
let last = performance.now(); let hungerT = 0, heatT = 0, droneT = 3;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
  if (charView) {                                              // character screen: orbit-free spin of Thomas
    charAngle += dt * 0.7;
    const u = thomas.userData; thomas.visible = true; thomas.position.set(player.pos.x, player.pos.y, player.pos.z); thomas.rotation.y = charAngle;
    u.legL.rotation.x = 0; u.legR.rotation.x = 0; u.armL.rotation.x = 0; u.armR.rotation.x = 0; thomas.scale.set(1, 1, 1);
    camera.position.set(player.pos.x, player.pos.y + 1.25, player.pos.z + 3.0); camera.rotation.set(0, 0, 0);
    if (camera.lookAt) camera.lookAt(player.pos.x, player.pos.y + 1.0, player.pos.z);
    renderer.render(scene, camera); return;
  }
  if (running && !paused && !anyPanelOpen()) {
    if (attackCd > 0) attackCd -= dt; if (portalCd > 0) portalCd -= dt; if (hammerCd > 0) hammerCd -= dt; if (bowCd > 0) bowCd -= dt;
    physics(dt);
    tagMonsters();
    updateMining(dt);
    updateMonsters(dt);
    updateAnimals(dt);
    updateFredaReactions(dt);
    if (DIM === "realm") updateRealm(dt);
    updateFireBoss(dt);
    updateSkyBoss(dt);
    updateProjectiles(dt);
    updatePlayerShots(dt);
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
    // night raid event: monsters assault the base; survive and protect the cats for a reward
    if (isNight()) { wasNight = true; if (!raidShown) { raidShown = true; showBanner("Night Raid! Defend Thomas and the cats."); } }
    else { raidShown = false; if (wasNight) { if (!survivedNight) { survivedNight = true; achieve("night", "First Night Survived"); } const safe = cats.filter(c => c.tamed).length; const rew = 8 + safe * 6; addCoins(rew); addXP(15 + safe * 5); showBanner("Raid survived! +" + rew + " coins. Cats safe: " + safe); toast("You protected " + safe + " cat" + (safe === 1 ? "" : "s") + "."); achieve("raid", "Raid Defender"); wasNight = false; } }
    updateStory(dt);
    updatePowerups(dt);
    updateBlockPowers(dt);
    updateEvents(dt);
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
loadColl();
loadSkin();
loadCatCosmetic();
loadNG();
initDaily();
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
