/* combat.js: Combat, Freda blocks, bow and arrows, projectiles, effects.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
  const targets = []; for (const m of monsters) if (!m.dead) targets.push(m.g); for (const a of farm) if (!a.dead && a.g.visible && a.g.position.distanceTo(player.pos) < 8) targets.push(a.g); if (fireBoss) targets.push(fireBoss.g); if (dragon && !dragon.dead) { targets.push(dragon.g); for (const cr of crystals) if (!cr.dead) targets.push(cr.g); }
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
  if (tool && tool.dur) wearTool(tool.tool === "sword" || tool.tool === "hammer" ? 1 : 2);
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
  else if (ent && ent.userData.kind === "animal") { const a = ent.userData.a, dv = new THREE.Vector3(a.g.position.x - player.pos.x, 0, a.g.position.z - player.pos.z).normalize(); hurtAnimal(a, dmg, dv, hit.point, crit); }
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
  "Freda made the sky explode with magic.",
  "Freda found a secret Pokemon.",
  "Freda opened a treasure portal.",
  "Freda made Pikachu dance.",
  "Freda is hiding in the tall grass.",
  "Freda made the monsters run away."
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
  // collectible counter: every Freda Box found counts toward milestone rewards
  fredaFound++;
  if (fredaFound % 10 === 0) { addCoins(50); addXP(80); showBanner("Freda Box Collector: " + fredaFound + " found! +50 coins"); SFX.treasure(); achieve("fredacollect", "Freda Box Collector"); }
  else if (fredaFound % 5 === 0) { addItem(CRYSTAL, 2); toast("Freda Boxes found: " + fredaFound + ". Bonus crystals!"); }
}
let fredaFound = 0;
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
  if (kind === "bullet") {                              // small fast tracer with a little spread
    dir.x += (Math.random() - .5) * 0.04; dir.y += (Math.random() - .5) * 0.04; dir.z += (Math.random() - .5) * 0.04; dir.normalize();
    const m = new THREE.Mesh(pshotGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d })); m.scale.set(0.5, 0.5, 0.5);
    m.position.set(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z); scene.add(m);
    playerShots.push({ mesh: m, vel: dir.clone().multiplyScalar(46), life: 1.2, kind });
    hitSpark(m.position, 0xffd24a); SFX.gun();
    return;
  }
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
      const dmg = p.kind === "bullet" ? 4 : 6 + swordBonus; hitM.hp -= dmg; hitM.flash = 0.15; hitM.bar.up(Math.max(0, hitM.hp / hitM.max));
      hitSpark(p.mesh.position, p.kind === "slime" ? 0x6fe06a : p.kind === "bullet" ? 0xffd24a : 0x9fe8ff); dmgNumber(p.mesh.position, dmg, false);
      if (p.kind === "ice") { if (!hitM._bspd) hitM._bspd = hitM.speed; hitM.speed = hitM._bspd * 0.4; hitM.slow = 2.8; }
      else { knock(hitM.g, p.kind === "bullet" ? 0.5 : 1.6); }
      if (hitM.hp <= 0 && !hitM.dead) killMonster(hitM);
    }
    if (hitM || ground || p.life <= 0) { scene.remove(p.mesh); playerShots.splice(i, 1); }
  }
}
// ---------- BOW AND ARROWS: hold to draw, release to loose a real arrow that arcs under gravity, sticks where it lands and can be picked back up ----------
let bowDraw = 0, bowHintCd = 0;
function bowPower() { return bowDraw > 0 ? Math.min(1, bowDraw / 0.9) : 0; }
const arrows = [], ARROW_CAP = 48, ARROW_G = 20;
const arrowShaftGeo = new THREE.BoxGeometry(0.035, 0.035, 0.62), arrowHeadGeo = new THREE.ConeGeometry(0.05, 0.14, 4), arrowFinGeo = new THREE.BoxGeometry(0.006, 0.075, 0.15);
const arrowMats = { shaft: new THREE.MeshLambertMaterial({ color: 0xb58450 }), head: new THREE.MeshLambertMaterial({ color: 0x5a5b62 }),
  fin: new THREE.MeshLambertMaterial({ color: 0xf2efe6, side: THREE.DoubleSide }), finR: new THREE.MeshLambertMaterial({ color: 0xc8352a, side: THREE.DoubleSide }) };
function makeArrowMesh() {                         // shaft along +z, broadhead at the front, three fletching vanes at the back
  const g = new THREE.Group();
  g.add(new THREE.Mesh(arrowShaftGeo, arrowMats.shaft));
  const hd = new THREE.Mesh(arrowHeadGeo, arrowMats.head); hd.rotation.x = Math.PI / 2; hd.position.z = 0.37; g.add(hd);
  for (let k = 0; k < 3; k++) { const a = k * 2.094, f = new THREE.Mesh(arrowFinGeo, k === 0 ? arrowMats.finR : arrowMats.fin); f.position.set(Math.sin(a) * 0.035, Math.cos(a) * 0.035, -0.24); f.rotation.z = -a; g.add(f); }
  return g;
}
function spawnArrow(o, dir, speed, dmg, owner, crit, pickup) {
  if (arrows.length >= ARROW_CAP) { let k = arrows.findIndex(a => a.stuck); if (k < 0) k = 0; scene.remove(arrows[k].g); arrows.splice(k, 1); }
  const g = makeArrowMesh(); g.position.copy(o); scene.add(g);
  g.lookAt(o.x + dir.x, o.y + dir.y, o.z + dir.z);
  const a = { g, vel: dir.clone().normalize().multiplyScalar(speed), owner, dmg, crit, pickup, stuck: false, life: 6, trail: 0, cell: null };
  arrows.push(a); return a;
}
// Thomas looses an arrow from eye height along the view direction; power decides speed and damage
function loosePlayerArrow() {
  const p = bowPower(); if (p < 0.12 || countItem(I_ARROW) <= 0) return null;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const o = new THREE.Vector3(player.pos.x + dir.x * 0.45, player.pos.y + (player._crouch ? EYE - 0.35 : EYE) - 0.08 + dir.y * 0.45, player.pos.z + dir.z * 0.45);
  const crit = p >= 1 && Math.random() < 0.35;
  const dmg = Math.round((2 + 7 * p) * (crit ? 1.5 : 1)) + Math.floor(swordBonus / 2);
  consumeItem(I_ARROW, 1);
  const a = spawnArrow(o, dir, 12 + 38 * p, dmg, "player", crit, true);
  wearTool(1); SFX.bowShot(p); addShake(0.04 * p); swing = 0.3;
  if (countItem(I_ARROW) === 0) toast("Out of arrows");
  return a;
}
// called from updateMining: with a draw bow held, the attack button draws and releasing fires
function updateBow(dt) {
  const t = currentTool();
  if (bowHintCd > 0) bowHintCd -= dt;
  if (!t || !t.draw) { if (bowDraw > 0) { bowDraw = 0; bowRing(0); } return false; }
  if (primaryHeld) {
    if (bowDraw === 0 && countItem(I_ARROW) <= 0) { if (bowHintCd <= 0) { bowHintCd = 3; toast("No arrows. Craft them from Flint, a Stick and a Feather"); } return true; }
    if (bowDraw === 0) SFX.bowDraw();
    bowDraw = Math.min(1.4, bowDraw + dt); bowRing(bowPower());
  } else if (bowDraw > 0) { loosePlayerArrow(); bowDraw = 0; bowRing(0); }
  return true;
}
function bowRing(p) {
  const ring = document.getElementById("mineRing"); if (!ring) return;
  ring.style.opacity = p > 0 ? "1" : "0"; const fg = document.querySelector("#mineRing .fg"); if (!fg) return;
  fg.style.strokeDasharray = (2 * Math.PI * 22).toFixed(1); fg.style.strokeDashoffset = (2 * Math.PI * 22 * (1 - p)).toFixed(1);
  fg.style.stroke = p >= 1 ? "#ffd24a" : "";
}
// hit volumes: upright cylinders for creatures, spheres for flyers and crystals
function arrowTargets(owner) {
  const T = [];
  if (owner === "player") {
    for (const m of monsters) if (!m.dead) T.push({ kind: "monster", ref: m, p: m.g.position, r: m.hr || 0.45, h: m.hh || 1.9 });
    if (fireBoss && fireBoss.hp > 0) T.push({ kind: "fireboss", ref: fireBoss, p: fireBoss.g.position, r: 1.2, h: 3.9 });
    if (typeof skyBoss !== "undefined" && skyBoss && skyBoss.hp > 0) T.push({ kind: "skyboss", ref: skyBoss, p: skyBoss.g.position, r: 1.7, sphere: 1 });
    if (dragon && !dragon.dead) T.push({ kind: "dragon", ref: dragon, p: dragon.g.position, r: 2.5, sphere: 1 });
    for (const c of crystals) if (!c.dead) T.push({ kind: "crystal", ref: c, p: c.g.position, r: 0.95, sphere: 1 });
    if (typeof farm !== "undefined") for (const a of farm) if (!a.dead && a.g.visible) T.push({ kind: "animal", ref: a, p: a.g.position, r: a.hr, h: a.hh });
  }
  return T;
}
function inTarget(t, q) {
  if (t.sphere) { const dx = q.x - t.p.x, dy = q.y - t.p.y, dz = q.z - t.p.z; return dx * dx + dy * dy + dz * dz < t.r * t.r; }
  const dx = q.x - t.p.x, dz = q.z - t.p.z; return dx * dx + dz * dz < t.r * t.r && q.y > t.p.y - 0.05 && q.y < t.p.y + t.h;
}
function arrowStrike(t, a, q) {
  const dmg = a.dmg, crit = a.crit, dir = a.vel.clone().setY(0).normalize();
  if (t.kind === "monster") {
    const m = t.ref; m.hp -= dmg; m.flash = 0.15; m.bar.up(Math.max(0, m.hp / m.max)); m.aggro = true;
    if (!m.ghost) { m.g.position.x += dir.x * 0.5; m.g.position.z += dir.z * 0.5; }
    hitSpark(q, crit ? 0xffe14d : 0xff5577); dmgNumber(q, dmg, crit); catCombo(m);
    if (m.hp <= 0 && !m.dead) { killMonster(m); achieve("archer", "Sharpshooter"); }
  } else if (t.kind === "fireboss" || t.kind === "skyboss") { t.ref.hp -= dmg; t.ref.flash = 0.15; hitSpark(q, 0xffb04a); dmgNumber(q, dmg, crit); }
  else if (t.kind === "dragon") { if (crystalsLeft > 0) { hitSpark(q, 0x888888); toast("Destroy the End Crystals first"); } else { dragon.hp -= dmg; updateBoss(); hitSpark(q, 0xb026ff); dmgNumber(q, dmg, crit); if (dragon.hp <= 0 && !dragon.dead) winDragon(); } }
  else if (t.kind === "crystal") { const c = t.ref; c.hp -= dmg; hitSpark(q, 0x22d3ee); dmgNumber(q, dmg, crit); if (c.hp <= 0 && !c.dead) { c.dead = true; scene.remove(c.g); crystalsLeft--; updateBoss(); SFX.glass(); } }
  else if (t.kind === "animal") hurtAnimal(t.ref, dmg, dir, q, crit);
  SFX.arrowHit();
}
const _aq = new THREE.Vector3();
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    if (a.stuck) {
      a.life -= dt;
      if (a.cell && !isSolidBlock(getBlock(a.cell[0], a.cell[1], a.cell[2]))) { a.stuck = false; a.cell = null; a.vel.set(0, -1, 0); a.life = Math.min(a.life, 4); continue; }   // the block it hit was mined: drop
      const q = a.g.position, dx = q.x - player.pos.x, dy = q.y - (player.pos.y + 0.9), dz = q.z - player.pos.z;
      if (a.pickup && dx * dx + dy * dy + dz * dz < 2.1 && running && giveItems(I_ARROW, 1) === 0) { renderHotbar(); SFX.pickup(); scene.remove(a.g); arrows.splice(i, 1); continue; }   // stays put if the bag is full
      if (a.life <= 0) { scene.remove(a.g); arrows.splice(i, 1); }
      continue;
    }
    a.life -= dt;
    const inWater = getBlock(Math.floor(a.g.position.x), Math.floor(a.g.position.y), Math.floor(a.g.position.z)) === WATER;
    a.vel.y -= ARROW_G * dt * (inWater ? 0.3 : 1); if (inWater) a.vel.multiplyScalar(Math.max(0, 1 - dt * 3.5)); else a.vel.multiplyScalar(1 - dt * 0.05);
    const sp = a.vel.length(), steps = Math.max(1, Math.ceil(sp * dt / 0.2)), sdt = dt / steps;
    const T = arrowTargets(a.owner === "player" ? "player" : "mob");
    let done = false;
    for (let s = 0; s < steps && !done; s++) {
      const q = a.g.position; _aq.copy(q).addScaledVector(a.vel, sdt);
      if (a.owner === "player") { for (const t of T) if (inTarget(t, _aq)) { arrowStrike(t, a, _aq); done = true; break; } }
      else if (Math.abs(_aq.x - player.pos.x) < HW + 0.12 && Math.abs(_aq.z - player.pos.z) < HW + 0.12 && _aq.y > player.pos.y && _aq.y < player.pos.y + PH && running) {
        damage(a.dmg); addShake(0.12); const k = a.vel.clone().setY(0).normalize(); player.vel.x += k.x * 3; player.vel.z += k.z * 3; SFX.arrowHit(); done = true;
      }
      if (done) { scene.remove(a.g); arrows.splice(i, 1); break; }
      const bx = Math.floor(_aq.x), by = Math.floor(_aq.y), bz = Math.floor(_aq.z);
      if (isSolidBlock(getBlock(bx, by, bz))) {                // bury the tip a little into the block and stay there
        q.addScaledVector(a.vel, sdt * 0.55); a.stuck = true; a.cell = [bx, by, bz]; a.life = a.owner === "player" ? 60 : 10;
        SFX.arrowThud(); if (a.crit) hitSpark(q, 0xffffff); break;
      }
      q.copy(_aq);
    }
    if (done || !arrows.includes(a)) continue;
    if (!a.stuck) {
      const q = a.g.position; a.g.lookAt(q.x + a.vel.x, q.y + a.vel.y, q.z + a.vel.z);
      if (a.crit) { a.trail -= dt; if (a.trail <= 0 && fxParts.length < FX_CAP) { a.trail = 0.03; const m = new THREE.Mesh(chipGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0 })); m.position.copy(q); m.scale.setScalar(0.5); scene.add(m); fxParts.push({ mesh: m, life: 0.35, vel: new THREE.Vector3(0, 0.4, 0), disposeMat: 1 }); } }
      if (a.life <= 0 || q.y < -10) { scene.remove(a.g); arrows.splice(i, 1); }
    }
  }
}
function clearArrows() { for (const a of arrows) scene.remove(a.g); arrows.length = 0; bowDraw = 0; }
// skeleton archers aim with a lead for gravity and a little spread
function mobShootArrow(m) {
  const o = new THREE.Vector3(m.g.position.x, m.g.position.y + 1.45 * (m.sc || 1), m.g.position.z);
  const tx = player.pos.x, ty = player.pos.y + 1.1, tz = player.pos.z, d = Math.hypot(tx - o.x, tz - o.z), speed = 24, tf = d / speed;
  const dir = new THREE.Vector3(tx - o.x, ty - o.y + 0.5 * ARROW_G * tf * tf, tz - o.z).normalize();
  const spread = 0.025 + (m.elite ? 0 : 0.02); dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread * 2; dir.normalize();
  o.addScaledVector(dir, 0.6);
  spawnArrow(o, dir, speed, Math.max(2, m.dmg), "mob", false, Math.random() < 0.5);
  SFX.bowShot(0.7);
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
    else if (p.debris) {                                           // block chips: fall, bounce off the ground, settle, shrink away
      p.vel.y -= 16 * dt; const q = p.mesh.position;
      if (isSolidBlock(getBlock(Math.floor(q.x), Math.floor(q.y - 0.05), Math.floor(q.z))) && p.vel.y < 0) { q.y = Math.floor(q.y - 0.05) + 1.05; p.vel.y *= -0.3; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      p.mesh.rotation.x += p.vel.z * dt * 3; p.mesh.rotation.z -= p.vel.x * dt * 3;
      if (p.life < 0.3) p.mesh.scale.setScalar(Math.max(0.01, p.life / 0.3));
    }
    else if (p.drop) {                                             // mined item hops up, spins, then zips into Thomas
      p.t += dt; const q = p.mesh.position; p.mesh.rotation.y += dt * 4;
      if (p.t < 0.28) { p.vel.y -= 14 * dt; } else { const tx = player.pos.x, ty = player.pos.y + 1.1, tz = player.pos.z; const k = Math.min(1, dt * (6 + p.t * 14)); q.x += (tx - q.x) * k; q.y += (ty - q.y) * k; q.z += (tz - q.z) * k; p.vel.set(0, 0, 0); if (Math.hypot(tx - q.x, ty - q.y, tz - q.z) < 0.35) p.life = 0; }
    }
    else { p.vel.y -= 9 * dt; p.mesh.scale.multiplyScalar(1 - dt * 2.5); }
    if (p.life <= 0) { scene.remove(p.mesh); if (p.disposeMat && p.mesh.material) p.mesh.material.dispose(); fxParts.splice(i, 1); }
  }
}
// tag entity meshes after spawn (so raycast finds kind)
function tagMonsters() { for (const m of monsters) m.g.traverse(o => { o.userData.kind = "monster"; o.userData.m = m; }); }
