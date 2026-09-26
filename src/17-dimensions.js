/* dimensions.js: Portals, dimensions, bosses.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
// ---------- CREATURE VALLEY: the Creature Door lives FAR from spawn, reached by travel ----------
const CV_X = 86, CV_Z = -54;           // far from the Fire portal (8,0) and spawn, in its own direction
let trailGroup = null;
function clearTrail() { if (trailGroup) { scene.remove(trailGroup); trailGroup = null; } }
function buildSparkTrail(x0, z0, x1, z1) {     // glowing electric sparks guide Thomas toward the valley
  clearTrail(); trailGroup = new THREE.Group(); scene.add(trailGroup);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1), x = Math.floor(x0 + (x1 - x0) * t), z = Math.floor(z0 + (z1 - z0) * t);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(150,230,255,0.95)", "rgba(60,140,255,0)"), depthWrite: false, transparent: true, fog: false }));
    s.scale.set(1.1, 1.1, 1); s.position.set(x + 0.5, surfaceY(x, z) + 1.3, z + 0.5); trailGroup.add(s);
  }
}
function buildCreatureValley() {
  // force-generate the valley's chunks first so terrain streaming will not overwrite the door later
  const cMinX = Math.floor((CV_X - 9) / CH), cMaxX = Math.floor((CV_X + 9) / CH), cMinZ = Math.floor((CV_Z - 9) / CH), cMaxZ = Math.floor((CV_Z + 9) / CH);
  for (let cx = cMinX; cx <= cMaxX; cx++) for (let cz = cMinZ; cz <= cMaxZ; cz++) genChunk(cx, cz);
  const baseY = surfaceY(CV_X, CV_Z);
  // colorful tall-grass meadow
  for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) {
    if (dx * dx + dz * dz > 50) continue; const gx = CV_X + dx, gz = CV_Z + dz, gy = surfaceY(gx, gz);
    if (getBlock(gx, gy, gz) === GRASS && getBlock(gx, gy + 1, gz) === AIR && Math.random() < 0.55) setRaw(gx, gy + 1, gz, TALLGRASS);
  }
  // colorful little trees ring the valley
  for (const [tx, tz] of [[-6, -3], [6, -4], [-5, 5], [7, 4], [0, -7], [-7, 1]]) {
    const x = CV_X + tx, z = CV_Z + tz, y = surfaceY(x, z);
    for (let h = 0; h < 3; h++) setRaw(x, y + 1 + h, z, WOOD);
    for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++) setRaw(x + lx, y + 4, z + lz, LEAVES);
    setRaw(x, y + 5, z, LEAVES);
  }
  // creature statues flanking the door + a glowing crystal shrine behind it
  for (const sx of [-3, 3]) { const x = CV_X + sx, z = CV_Z + 4, y = surfaceY(x, z); setRaw(x, y + 1, z, COBBLE); setRaw(x, y + 2, z, BRICK); setRaw(x, y + 3, z, CRYSTAL); }
  for (let i = 0; i < 4; i++) setRaw(CV_X, baseY + 1 + i, CV_Z - 3, i < 3 ? BRICK : CRYSTAL);
  setRaw(CV_X - 1, baseY + 1, CV_Z - 3, CRYSTAL); setRaw(CV_X + 1, baseY + 1, CV_Z - 3, CRYSTAL);
  // the Creature Door portal
  buildPortalFrame(CV_X, baseY, CV_Z, "x", "realm", CDOOR);
  addPortalSign(CV_X, baseY, CV_Z, "CREATURE VALLEY", "#c79bff");
}
// ---------- SPARKY: the electric-mouse companion that follows Thomas in the Creature realm ----------
let companion = null;
function clearCompanion() { if (companion) { scene.remove(companion.g); companion = null; } }
function spawnCompanion(x, z) {
  clearCompanion();
  const g = buildCreatureModel("voltmouse", false); g.scale.multiplyScalar(0.62);
  g.position.set(x + 1.2, surfaceY(x, z), z + 0.5); scene.add(g);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,240,120,0.95)", "rgba(255,200,40,0)"), depthWrite: false, transparent: true, fog: false }));
  glow.scale.set(1.8, 1.8, 1); glow.position.y = 0.7; glow.visible = false; g.add(glow);
  const lamp = new THREE.PointLight(0xfff0a0, 0.55, 9); lamp.position.y = 1.0; g.add(lamp);   // Pikachu lights up its surroundings / dark caves
  companion = { g, glow, lamp, vy: 0, walkT: 0, t: Math.random() * 6, jumpCd: 0, emoteCd: 4, cheer: 0, friendship: 0, alertCd: 4 };
}
function companionEmote(col) { if (companion) hitSpark(new THREE.Vector3(companion.g.position.x, companion.g.position.y + 1.2, companion.g.position.z), col || 0xffe14d); }
function reactCompanion(kind) {        // "alert" when a wild creature appears, "cheer" for treasure/wins
  if (!companion) return;
  companion.cheer = 1.2; companion.vy = 5; companionEmote(kind === "cheer" ? 0xff7ad6 : 0xfff14a);
  blip(kind === "cheer" ? 880 : 1200, 0.08, "square", 0.08, kind === "cheer" ? 1320 : 1600);
}
function updateCompanion(dt) {
  if (!companion) return;
  const c = companion, g = c.g; c.t += dt; c.jumpCd = Math.max(0, c.jumpCd - dt); c.cheer = Math.max(0, c.cheer - dt);
  const dx = player.pos.x - g.position.x, dz = player.pos.z - g.position.z, d = Math.hypot(dx, dz) || 1;
  let moving = false;
  if (d > 1.9) {                                  // stay close, run to catch up, but never crowd Thomas
    const run = d > 6, sp = run ? 5.4 : 3.0;
    g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; g.rotation.y = Math.atan2(dx, dz); moving = true;
    c.walkT += dt * (run ? 16 : 10);
    if (run && c.jumpCd <= 0 && c.vy === 0) { c.vy = 5; c.jumpCd = 0.7; }   // little hops when sprinting to keep up
  } else { g.rotation.y = Math.atan2(dx, dz); }
  // gravity so it lands on terrain
  const gy = surfaceY(g.position.x, g.position.z);
  c.vy -= 22 * dt; g.position.y += c.vy * dt; if (g.position.y <= gy) { g.position.y = gy; c.vy = 0; }
  // leg + idle animation
  const L = g.userData.legs; if (L) { if (moving) { const s = Math.sin(c.walkT) * 0.6; L[0].rotation.x = s; L[1].rotation.x = -s; L[2].rotation.x = -s; L[3].rotation.x = s; } else { for (const l of L) l.rotation.x *= 0.85; } }
  if (!moving && c.vy === 0) g.position.y = gy + Math.abs(Math.sin(c.t * 3)) * 0.05;     // cute idle bob
  if (c.cheer > 0) g.rotation.z = Math.sin(c.t * 24) * 0.18; else g.rotation.z = 0;       // wiggle when cheering
  // detect rare/legendary creatures: glow when close, alert (banner + sound) when one is roaming nearby
  let rare = false, rareNear = false; for (const rc of realmCreatures) { if (rc.sp.legend || rc.shiny) { const dd = rc.g.position.distanceTo(g.position); if (dd < 14) rare = true; if (dd < 26) rareNear = true; } }
  c.glow.visible = rare; if (rare) c.glow.material.opacity = 0.45 + 0.4 * Math.sin(c.t * 6);
  if (c.lamp) c.lamp.intensity = 0.5 + (rare ? 0.7 : 0) + 0.12 * Math.sin(c.t * 4);   // steady glow, brighter near rares
  c.alertCd = Math.max(0, c.alertCd - dt);
  if (rareNear && c.alertCd <= 0) { c.alertCd = 25; showBanner("Pikachu senses a rare creature nearby!"); SFX.screech(); reactCompanion("alert"); }
  // occasional happy spark emote
  c.emoteCd -= dt; if (c.emoteCd <= 0) { c.emoteCd = 6 + Math.random() * 7; companionEmote(0xffe14d); if (Math.random() < 0.4) blip(1000, 0.05, "square", 0.05, 1500); }
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
function clearEntities() { for (const m of monsters) scene.remove(m.g); for (const c of cats) scene.remove(c.g); for (const m of mice) scene.remove(m.g); monsters = []; cats = []; mice = []; for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0; for (const p of playerShots) scene.remove(p.mesh); playerShots.length = 0; clearArrows(); stashFarm(); clearGroundItems(); if (dragon) { scene.remove(dragon.g); dragon = null; } if (fireBoss) { scene.remove(fireBoss.g); fireBoss = null; } if (typeof skyBoss !== "undefined" && skyBoss) { scene.remove(skyBoss.g); skyBoss = null; } for (const c of crystals) scene.remove(c.g); crystals = []; if (merchant) { scene.remove(merchant.g); merchant = null; } if (typeof clearRealmCreatures === "function") clearRealmCreatures(); if (typeof clearRealmNPCs === "function") clearRealmNPCs(); if (typeof clearRealmBosses === "function") clearRealmBosses(); if (typeof clearCompanion === "function") clearCompanion(); if (typeof clearRealmPuzzle === "function") clearRealmPuzzle(); if (typeof clearMarioStage === "function") clearMarioStage(); if (typeof charMixers !== "undefined") charMixers.length = 0; battle = null; cmenuOpen = false; if (typeof hide === "function") { hide("battle"); hide("cmenu"); } if (typeof clearTelegraphs === "function") clearTelegraphs(); hideBoss(); }
function loadDimension(name, fromSave) {
  DIM = name; clearWorld(); clearEntities(); clearPortalSigns(); clearTrail();
  if (name === "fire") achieve("firep", "Fire Portal Opened");
  if (name === "end") achieve("endp", "End Portal Opened");
  player.pos.set(0.5, 50, 0.5); player.vel.set(0, 0, 0);
  gravity = (name === "end" || name === "sky") ? 16 : 28; jumpV = (name === "end" || name === "sky") ? 8.4 : 9.2;     // low gravity end + sky
  if (name === "overworld") { for (let i = 0; i < 3; i++) spawnCat((Math.random() * 20 - 10) | 0, (Math.random() * 20 - 10) | 0); for (let i = 0; i < 8; i++) spawnMouse((Math.random() * 30 - 15) | 0, (Math.random() * 30 - 15) | 0); }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) buildChunk(dx, dz);
  if (!fromSave) { player.pos.y = surfaceY(0, 0) + 1; player.spawn.copy(player.pos); }
  // dimension setup
  if (name === "overworld") { scene.fog = new THREE.Fog(0x9fd2ff, 20, GFX[settings.gfx].dist * CH); hemi.color.set(0xbfe3ff); sun.color.set(0xffffff); showBanner("Overworld"); buildPortalFrame(8, surfaceY(8, 0), 0, "x", "fire"); addPortalSign(8, surfaceY(8, 0), 0, "FIRE DIMENSION", "#ff8a4a"); if (fireBossDown) { buildPortalFrame(-64, surfaceY(-64, 36), 36, "x", "sky"); addPortalSign(-64, surfaceY(-64, 36), 36, "SKY ISLANDS", "#bfe3ff"); } buildCreatureValley(); buildSparkTrail(16, -10, CV_X - 6, CV_Z); ensureGen(-30, -84, 4); buildPortalFrame(-30, surfaceY(-30, -84), -84, "x", "mario", BRICK); addPortalSign(-30, surfaceY(-30, -84), -84, "MUSHROOM KINGDOM", "#ff6a5a"); setObjective(CV_X + 0.5, surfaceY(CV_X, CV_Z) + 1, CV_Z + 0.5); setQuest("Sparks lead northeast to Creature Valley. A brick door far southwest hides the Mushroom Kingdom"); }
  else if (name === "realm") { scene.background = new THREE.Color(0x8ad0ff); scene.fog = new THREE.Fog(0xbfeaff, 26, GFX[settings.gfx].dist * CH); hemi.color.set(0xdaf3ff); hemi.intensity = 0.95; sun.intensity = 1.0; sun.color.set(0xffffff); showBanner("The Creature Battle Realm"); buildPortalFrame(6, surfaceY(6, 0), 0, "x", "overworld", CDOOR); addPortalSign(6, surfaceY(6, 0), 0, "BACK HOME", "#bfe3ff"); enterRealm(); }
  else if (name === "mario") { scene.background = new THREE.Color(0x6ec8ff); scene.fog = new THREE.Fog(0xaee2ff, 30, GFX[settings.gfx].dist * CH); hemi.color.set(0xeaf6ff); hemi.intensity = 1.0; sun.intensity = 1.05; sun.color.set(0xfff6e0); showBanner("The Mushroom Kingdom"); buildPortalFrame(6, surfaceY(6, -4), -4, "x", "overworld", BRICK); addPortalSign(6, surfaceY(6, -4), -4, "BACK HOME", "#bfe3ff"); buildMarioStage(); }
  else if (name === "fire") { scene.background = new THREE.Color(0x2a0808); scene.fog = new THREE.Fog(0x551111, 8, 40); hemi.color.set(0xff7a3a); hemi.intensity = 0.6; sun.intensity = 0.5; sun.color.set(0xff8a4a); showBanner("Fire Dimension"); clearFirePad(0, 0); if (fireBossDown) { buildPortalFrame(0, surfaceY(0, -8), -8, "x", "end"); setRaw(0, surfaceY(0, -8) + 1, -8, PORTAL); setQuest("Enter the portal to reach the End"); } else { spawnFireBoss(); setQuest("Defeat the Fire Guardian. A Flame Charm will protect you from the heat"); } }
  else if (name === "sky") { scene.background = new THREE.Color(0x8fd0ff); scene.fog = new THREE.Fog(0xbfe3ff, 36, 150); hemi.color.set(0xdff1ff); hemi.intensity = 0.95; sun.intensity = 0.9; sun.color.set(0xffffff); showBanner("Sky Islands"); buildPortalFrame(6, surfaceY(6, 0), 0, "x", "overworld"); addPortalSign(6, surfaceY(6, 0), 0, "BACK HOME", "#bfe3ff"); spawnSkySerpent(); setQuest("Glide the Sky Islands and defeat the Sky Serpent"); }
  else { scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 30, 120); hemi.color.set(0xffffff); hemi.intensity = 0.9; sun.intensity = 0.7; sun.color.set(0xeae6ff); showBanner("The End"); buildEndDragon(); setQuest("Destroy the End Crystals, then slay the Black Dragon"); }
  // replay player block edits, then rebuild special blocks
  const ed = editsByDim[name]; if (ed) for (const [k, id] of ed) { const p = k.split(",").map(Number); setRaw(p[0], p[1], p[2], id); }
  const fe = flowEditsByDim[name]; if (fe) for (const [k, lv] of fe) { const p = k.split(",").map(Number); const id = getBlock(p[0], p[1], p[2]); if (id === WATER || id === LAVA) { setFlow(p[0], p[1], p[2], lv); queueFluid(p[0], p[1], p[2]); } }   // flows resume where they were
  remeshAll(); rebuildPortalCells(); rebuildTorchCells(); rebuildDefenseCells(); rebuildFredaLabels();
  if (name === "overworld") { restoreFarm(farmStash); farmStash = []; }
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
