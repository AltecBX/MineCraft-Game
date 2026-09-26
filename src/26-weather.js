/* weather.js: Weather and ambient life.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- WEATHER: clear skies, rain, thunderstorms, and snow where it is cold ----------
const weather = { kind: "clear", next: 200, amt: 0, wet: 0, snow: 0, flash: 0, boltCd: 6 };
const colTopCache = new Map(); let colTopT = 0;
function colTop(x, z) {                                              // highest non air block in a column (cached, refreshed every couple of seconds)
  const k = cnum(x, z) * 1 + 0; let v = colTopCache.get(k); if (v !== undefined) return v;
  v = -1; for (let y = WORLD_H - 1; y >= 0; y--) { const id = getBlock(x, y, z); if (id !== AIR && id !== TALLGRASS && id !== TORCH) { v = y; break; } }
  colTopCache.set(k, v); return v;
}
const RAIN_N = 1400, rainPos = new Float32Array(RAIN_N * 6), rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xa8b8cc, transparent: true, opacity: 0.4, depthWrite: false });
const rainLines = new THREE.LineSegments(rainGeo, rainMat); rainLines.frustumCulled = false; rainLines.userData.noShadowTag = 1; rainLines.visible = false; scene.add(rainLines);
const SNOW_N = 1200, snowPos = new Float32Array(SNOW_N * 3), snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.9, depthWrite: false }));
snowPts.frustumCulled = false; snowPts.userData.noShadowTag = 1; snowPts.visible = false; scene.add(snowPts);
let rainSeeded = false, rainSrc = null, rainGain = null;
function seedPrecip(i, cx, cy, cz, snow) {
  const x = cx + (Math.random() - 0.5) * 48, z = cz + (Math.random() - 0.5) * 48, y = cy + 4 + Math.random() * 22;
  if (snow) { snowPos[i * 3] = x; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = z; }
  else { const o = i * 6; rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - 0.08; rainPos[o + 4] = y - 0.7; rainPos[o + 5] = z; }
}
function rainSound(level) {
  if (!actx || !settings.sound || settings.muted) { if (rainGain) rainGain.gain.value = 0; return; }
  if (!rainSrc) {
    try {
      const b = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
      rainSrc = actx.createBufferSource(); rainSrc.buffer = b; rainSrc.loop = true;
      const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400;
      rainGain = actx.createGain(); rainGain.gain.value = 0;
      rainSrc.connect(f).connect(rainGain).connect(sfxGain || actx.destination); rainSrc.start();
    } catch (e) { rainSrc = null; }
  }
  if (rainGain) rainGain.gain.value = level;
}
function updateWeather(dt) {
  colTopT -= dt; if (colTopT <= 0) { colTopT = 2; colTopCache.clear(); }
  const ow = DIM === "overworld";
  if (ow) {
    weather.next -= dt;
    if (weather.next <= 0) {
      if (weather.kind === "clear") { weather.kind = Math.random() < 0.65 ? "rain" : "storm"; weather.next = 90 + Math.random() * 150; }
      else { weather.kind = "clear"; weather.next = 220 + Math.random() * 320; }
    }
  }
  const target = !ow || weather.kind === "clear" ? 0 : weather.kind === "rain" ? 0.72 : 1;
  weather.amt += (target - weather.amt) * Math.min(1, dt * 0.12);
  const b = biomeAt(player.pos.x, player.pos.z), cold = b.t < 0.36 || player.pos.y > SEA + 17;
  weather.snow += ((cold ? 1 : 0) - weather.snow) * Math.min(1, dt * 0.5);
  const raining = weather.amt * (1 - weather.snow);
  weather.wet += (raining > 0.2 ? Math.min(1, raining * 1.3) : 0) > weather.wet ? dt * 0.08 : -dt * 0.012;   // puddles form quickly and dry slowly
  weather.wet = Math.max(0, Math.min(1, weather.wet));
  U.uWet.value = ow ? weather.wet : 0;
  // lightning in storms
  weather.flash = Math.max(0, weather.flash - dt * 5);
  if (ow && weather.kind === "storm" && weather.amt > 0.75 && !weather.snow) {
    weather.boltCd -= dt;
    if (weather.boltCd <= 0) { weather.boltCd = 5 + Math.random() * 14; weather.flash = 1; setTimeout(() => SFX.thunder(), 250 + Math.random() * 1600); }
  }
  // precipitation particles follow the camera; drops stop on roofs and leaves
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  if (!rainSeeded) { rainSeeded = true; for (let i = 0; i < RAIN_N; i++) seedPrecip(i, cx, cy, cz, false); for (let i = 0; i < SNOW_N; i++) seedPrecip(i, cx, cy, cz, true); }
  const nRain = Math.floor(RAIN_N * raining), nSnow = Math.floor(SNOW_N * weather.amt * weather.snow);
  rainLines.visible = ow && nRain > 10; snowPts.visible = ow && nSnow > 10;
  if (rainLines.visible) {
    rainGeo.setDrawRange(0, nRain * 2);
    for (let i = 0; i < nRain; i++) {
      const o = i * 6; rainPos[o + 1] -= 19 * dt; rainPos[o + 4] -= 19 * dt; rainPos[o] += 1.2 * dt; rainPos[o + 3] += 1.2 * dt;
      const x = rainPos[o], y = rainPos[o + 4], z = rainPos[o + 2];
      if (y < cy - 14 || y < colTop(Math.floor(x), Math.floor(z)) + 1 || Math.abs(x - cx) > 26 || Math.abs(z - cz) > 26) seedPrecip(i, cx, cy, cz, false);
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainMat.opacity = 0.18 + 0.28 * raining;
  }
  if (snowPts.visible) {
    snowGeo.setDrawRange(0, nSnow);
    const t = U.uTime.value;
    for (let i = 0; i < nSnow; i++) {
      const o = i * 3; snowPos[o + 1] -= 1.6 * dt; snowPos[o] += Math.sin(t * 0.8 + i) * 0.5 * dt; snowPos[o + 2] += Math.cos(t * 0.6 + i * 1.3) * 0.5 * dt;
      if (snowPos[o + 1] < cy - 14 || snowPos[o + 1] < colTop(Math.floor(snowPos[o]), Math.floor(snowPos[o + 2])) + 1 || Math.abs(snowPos[o] - cx) > 26 || Math.abs(snowPos[o + 2] - cz) > 26) seedPrecip(i, cx, cy, cz, true);
    }
    snowGeo.attributes.position.needsUpdate = true;
  }
  rainSound(ow ? raining * 0.22 * (envLocal.sky > 0.6 ? 1 : 0.5) : 0);
}
// sky, light and fog adjustments while the weather is bad (applied inside updateEnv, before the lights are copied)
function applyWeatherEnv() {
  const w = weather.amt; if (DIM !== "overworld" || (w < 0.01 && weather.flash <= 0)) return;
  const grey = (c, k) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; c.r += (l - c.r) * k; c.g += (l - c.g) * k; c.b += (l - c.b) * k; };
  for (const c of [U.uZenith.value, U.uHorizon.value]) { grey(c, 0.8 * w); c.multiplyScalar(1 - 0.5 * w); }
  U.uGlow.value.multiplyScalar(1 - w); U.uSunCol.value.multiplyScalar(1 - 0.95 * w);
  U.uLightCol.value.multiplyScalar(1 - 0.72 * w); U.uSkyAmb.value.multiplyScalar(1 - 0.3 * w); grey(U.uSkyAmb.value, 0.5 * w);
  skyU.uCloudCover.value = Math.min(0.95, skyU.uCloudCover.value + 0.45 * w); skyU.uCloudLit.value.multiplyScalar(1 - 0.65 * w); skyU.uCloudAmb.value.multiplyScalar(1 - 0.35 * w); skyU.uSunVis.value *= 1 - w;
  if (weather.flash > 0) { const f = weather.flash * weather.flash; U.uZenith.value.r += 0.9 * f; U.uZenith.value.g += 0.95 * f; U.uZenith.value.b += 1.1 * f; U.uHorizon.value.r += 0.7 * f; U.uHorizon.value.g += 0.75 * f; U.uHorizon.value.b += 0.9 * f; U.uSkyAmb.value.r += 1.2 * f; U.uSkyAmb.value.g += 1.25 * f; U.uSkyAmb.value.b += 1.45 * f; skyU.uCloudAmb.value.r += 2 * f; skyU.uCloudAmb.value.g += 2 * f; skyU.uCloudAmb.value.b += 2.3 * f; }
}
// ---------- AMBIENT LIFE: fireflies at night, drifting leaves, bird flocks and birdsong by day ----------
const FF_N = 60, ffPos = new Float32Array(FF_N * 3), ffCol = new Float32Array(FF_N * 3), ffGeo = new THREE.BufferGeometry(), ffSeed = [];
ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3)); ffGeo.setAttribute("color", new THREE.BufferAttribute(ffCol, 3));
const ffPts = new THREE.Points(ffGeo, new THREE.PointsMaterial({ size: 0.13, map: glowTex("rgba(235,255,170,1)", "rgba(160,255,80,0)"), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
ffPts.frustumCulled = false; ffPts.userData.noShadowTag = 1; ffPts.visible = false; scene.add(ffPts);
for (let i = 0; i < FF_N; i++) ffSeed.push({ x: 0, y: 0, z: 0, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.8, live: false });
const leafGeo = new THREE.PlaneGeometry(0.14, 0.1), fallingLeaves = [];
const birdGeo = new THREE.PlaneGeometry(0.5, 0.16), birdMat = new THREE.MeshBasicMaterial({ color: 0x1c1c22, side: THREE.DoubleSide }), flocks = [];
let leafT = 0, chirpT = 8;
function makeFlock() {
  const g = new THREE.Group(); g.userData.noShadowTag = 1; const birds = [];
  for (let i = 0; i < 5 + ((Math.random() * 4) | 0); i++) {
    const b = new THREE.Group(), l = new THREE.Mesh(birdGeo, birdMat), r = new THREE.Mesh(birdGeo, birdMat);
    l.position.x = -0.25; r.position.x = 0.25; b.add(l); b.add(r);
    b.position.set((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.1, Math.random() * 0.6, -Math.ceil(i / 2) * 0.9); b.userData.ph = Math.random() * 6.28; g.add(b); birds.push(b);
  }
  const a = Math.random() * 6.28; g.position.set(player.pos.x - Math.cos(a) * 90, 50 + Math.random() * 16, player.pos.z - Math.sin(a) * 90); g.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
  scene.add(g); return { g, birds, dx: Math.cos(a), dz: Math.sin(a), life: 30 };
}
function updateAmbientLife(dt) {
  const ow = DIM === "overworld", night = skyU.uStars.value, t = U.uTime.value, px = player.pos.x, pz = player.pos.z, calm = weather.amt < 0.3;
  // fireflies hover low over the ground around Thomas at night
  const ffOn = ow && night > 0.5 && calm && envLocal.sky > 0.6; ffPts.visible = ffOn;
  if (ffOn) {
    for (let i = 0; i < FF_N; i++) {
      const f = ffSeed[i];
      if (!f.live || Math.hypot(f.x - px, f.z - pz) > 22) { f.x = px + (Math.random() - 0.5) * 36; f.z = pz + (Math.random() - 0.5) * 36; const top = colTop(Math.floor(f.x), Math.floor(f.z)); if (top <= SEA) { f.live = false; ffCol[i * 3] = ffCol[i * 3 + 1] = ffCol[i * 3 + 2] = 0; continue; } f.y = top + 1.3 + Math.random() * 1.6; f.live = true; }
      f.ph += dt * f.sp; f.x += Math.sin(f.ph * 0.7 + i) * 0.4 * dt; f.z += Math.cos(f.ph * 0.9 + i * 2) * 0.4 * dt; const yy = f.y + Math.sin(f.ph * 1.3) * 0.35;
      ffPos[i * 3] = f.x; ffPos[i * 3 + 1] = yy; ffPos[i * 3 + 2] = f.z;
      const glow = Math.max(0, Math.sin(t * (1.1 + f.sp) + f.ph * 3)) ** 3 * night; ffCol[i * 3] = glow * 0.9; ffCol[i * 3 + 1] = glow; ffCol[i * 3 + 2] = glow * 0.4;
    }
    ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true;
  }
  // leaves drift down from canopies near Thomas
  leafT -= dt;
  if (ow && leafT <= 0 && fallingLeaves.length < 40) {
    leafT = 0.12;
    const x = Math.floor(px + (Math.random() - 0.5) * 24), z = Math.floor(pz + (Math.random() - 0.5) * 24), y = colTop(x, z), id = getBlock(x, y, z);
    if (LEAFY[id] && getBlock(x, y - 1, z) === AIR) {
      const c = id === BIRCH_LEAVES ? 0x86b048 : id === SPRUCE_LEAVES ? 0x2e5a34 : (Math.random() < 0.15 ? 0xc79a3a : 0x4f8a34);
      const m = new THREE.Mesh(leafGeo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); m.material.userData.detailed = 1; m.userData.noShadowTag = 1;
      m.position.set(x + Math.random(), y - 0.05, z + Math.random()); scene.add(m); fallingLeaves.push({ m, ph: Math.random() * 6.28, life: 14 });
    }
  }
  for (let i = fallingLeaves.length - 1; i >= 0; i--) {
    const L = fallingLeaves[i], p = L.m.position; L.life -= dt; L.ph += dt * 2.2;
    p.y -= 0.55 * dt; p.x += Math.sin(L.ph) * 0.6 * dt + 0.25 * dt; p.z += Math.cos(L.ph * 0.7) * 0.4 * dt;
    L.m.rotation.set(Math.sin(L.ph) * 0.9, L.ph * 0.5, Math.cos(L.ph * 1.3) * 0.7);
    const ground = colTop(Math.floor(p.x), Math.floor(p.z));
    if (p.y < ground + 1.03 && getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) === AIR) { p.y = Math.max(p.y, ground + 1.02); L.life = Math.min(L.life, 3); L.m.rotation.set(-Math.PI / 2, L.m.rotation.y, 0); L.ph -= dt * 2.2; }
    if (L.life <= 0 || !ow) { scene.remove(L.m); L.m.material.dispose(); fallingLeaves.splice(i, 1); }
  }
  // flocks cross the sky by day
  const wantBirds = ow && night < 0.3 && calm ? 2 : 0;
  if (flocks.length < wantBirds && Math.random() < dt * 0.1) flocks.push(makeFlock());
  for (let i = flocks.length - 1; i >= 0; i--) {
    const F = flocks[i]; F.life -= dt; F.g.position.x += F.dx * 9 * dt; F.g.position.z += F.dz * 9 * dt; F.g.position.y += Math.sin(t * 0.3 + i) * 0.4 * dt;
    for (const b of F.birds) { const fl = Math.sin(t * 9 + b.userData.ph); b.children[0].rotation.z = fl * 0.6; b.children[1].rotation.z = -fl * 0.6; }
    if (F.life <= 0 || !ow) { scene.remove(F.g); flocks.splice(i, 1); }
  }
  // birdsong in leafy places during calm days
  chirpT -= dt;
  if (chirpT <= 0) { chirpT = 5 + Math.random() * 10; if (ow && night < 0.3 && calm && envLocal.sky > 0.5) { let leafy = 0; for (let k = 0; k < 12; k++) if (LEAFY[getBlock(Math.floor(px + (Math.random() - 0.5) * 16), Math.floor(player.pos.y + 3 + Math.random() * 5), Math.floor(pz + (Math.random() - 0.5) * 16))]) leafy++; if (leafy >= 2) SFX.chirp(); } }
}
