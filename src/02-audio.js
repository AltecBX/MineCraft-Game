/* audio.js: Audio: WebAudio synth, SFX, generative music.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
  thunder: () => { noiseHit(1.6, 0.4); blip(42, 1.4, "sawtooth", 0.16, 26); setTimeout(() => noiseHit(0.9, 0.22), 180); },
  chirp: () => { const f = 2200 + Math.random() * 900; blip(f, 0.06, "sine", 0.05, f * 1.3); setTimeout(() => blip(f * 1.1, 0.07, "sine", 0.05, f * 0.9), 90); setTimeout(() => blip(f * 1.2, 0.05, "sine", 0.04, f * 1.4), 190); },
  toolBreak: () => { noiseHit(0.14, 0.3); blip(300, 0.2, "square", 0.14, 90); },
  smelt: () => { noiseHit(0.2, 0.12); blip(200, 0.25, "triangle", 0.1, 420); },
  glass: () => { [2600, 3100, 2200].forEach((f, i) => setTimeout(() => blip(f, 0.08, "triangle", 0.06, f * 0.7), i * 30)); noiseHit(0.1, 0.12); },
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
  sparkle: () => { [880, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.1, "triangle", 0.1), i * 60)); },
  gun: () => { noiseHit(0.05, 0.06); blip(180, 0.04, "square", 0.12, 60); },
  coin: () => { blip(988, 0.06, "square", 0.1); setTimeout(() => blip(1319, 0.14, "square", 0.1), 55); },
  stomp: () => { noiseHit(0.05, 0.1); blip(320, 0.07, "square", 0.12, 140); },
  pipe: () => { blip(220, 0.1, "square", 0.12, 110); setTimeout(() => blip(150, 0.12, "square", 0.1, 80), 90); },
  bowDraw: () => { blip(90, 0.45, "sawtooth", 0.035, 150); noiseHit(0.3, 0.03); },
  bowShot: p => { blip(210 + (p || 1) * 60, 0.14, "triangle", 0.16, 70); noiseHit(0.08, 0.12 + (p || 1) * 0.08); setTimeout(() => blip(420, 0.05, "sine", 0.04, 300), 30); },
  arrowHit: () => { noiseHit(0.05, 0.22); blip(160, 0.06, "square", 0.08, 90); },
  arrowThud: () => { noiseHit(0.04, 0.14); blip(120, 0.07, "triangle", 0.1, 70); },
  moo: () => { blip(150, 0.55, "sawtooth", 0.07, 120); setTimeout(() => blip(128, 0.5, "sawtooth", 0.06, 110), 260); },
  oink: () => { blip(260, 0.09, "square", 0.06, 200); setTimeout(() => blip(240, 0.1, "square", 0.06, 180), 120); },
  baa: () => { const f = 380 + Math.random() * 40; for (let k = 0; k < 4; k++) setTimeout(() => blip(f - k * 6, 0.07, "sawtooth", 0.05, f - 20), k * 60); },
  cluck: () => { blip(700, 0.05, "square", 0.05, 500); setTimeout(() => blip(640, 0.05, "square", 0.05, 480), 110); setTimeout(() => blip(820, 0.06, "square", 0.05, 560), 230); },
  shear: () => { noiseHit(0.06, 0.12); setTimeout(() => noiseHit(0.06, 0.12), 90); blip(1500, 0.04, "square", 0.05, 1200); },
  fizz: () => { noiseHit(0.5, 0.14); blip(1800, 0.3, "sine", 0.03, 900); },
  splash: () => { noiseHit(0.22, 0.2); blip(300, 0.12, "sine", 0.06, 140); },
  gate: open => { blip(open ? 240 : 180, 0.09, "square", 0.08, open ? 300 : 120); noiseHit(0.05, 0.08); },
  shieldHit: () => { noiseHit(0.08, 0.3); blip(140, 0.12, "square", 0.12, 90); },
  dodge: () => { noiseHit(0.12, 0.08); blip(700, 0.08, "sine", 0.05, 1100); },
  love: () => { [660, 880, 990].forEach((f, i) => setTimeout(() => blip(f, 0.1, "sine", 0.07, f * 1.1), i * 80)); }
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
const SCALES = { overworld: [220, 247, 294, 330, 392, 440], night: [165, 196, 220, 247, 196, 147], cave: [110, 131, 147, 110, 98, 87], fire: [110, 131, 147, 175, 131, 98], sky: [392, 440, 523, 587, 659, 784], end: [330, 392, 494, 587, 392, 247], realm: [392, 440, 523, 587, 659, 523], mario: [262, 330, 392, 440, 523, 392] };
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
  const dur = boss ? 1.1 : key === "night" ? 2.4 : key === "cave" ? 3.1 : DIM === "fire" ? 2.2 : DIM === "sky" ? 1.7 : DIM === "end" ? 2.9 : DIM === "realm" ? 1.4 : DIM === "mario" ? 1.2 : 1.8;
  playPad(note * (boss ? (Math.random() < 0.5 ? 0.5 : 1) : (Math.random() < 0.18 ? 2 : 1)), dur);
  musicT = dur * (boss ? 0.45 : 0.66);
}
