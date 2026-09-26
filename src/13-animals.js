/* animals.js: Cats, mice and farm animals.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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

// ---------- FARM ANIMALS: cows, pigs, sheep and chickens that graze, wander, flee, follow food, breed and can be farmed ----------
// Each animal walks with block collision (a two block wall pens it in, it steps up one block, avoids cliffs and water).
// Feeding two of a kind makes them breed a baby that grows up. Sheep are sheared for wool, chickens lay eggs.
// Animals that were fed, bred or born stay for good and are saved; wild herds spawn and despawn around Thomas.
const FARM = {
  cow:     { name: "Cow", hp: 10, speed: 1.1, run: 3.6, hr: 0.52, hh: 1.4, food: [TALLGRASS, HAY], drops: [[I_RAWBEEF, 1, 3], [I_LEATHER, 0, 2]], sound: "moo", xp: 4, graze: 1 },
  pig:     { name: "Pig", hp: 10, speed: 1.2, run: 3.8, hr: 0.46, hh: 0.95, food: [I_APPLE, I_BREAD], drops: [[I_RAWPORK, 1, 3]], sound: "oink", xp: 4, graze: 1 },
  sheep:   { name: "Sheep", hp: 8, speed: 1.0, run: 3.6, hr: 0.5, hh: 1.3, food: [TALLGRASS, HAY], drops: [[I_RAWMUTTON, 1, 2]], sound: "baa", xp: 4, graze: 1 },
  chicken: { name: "Chicken", hp: 4, speed: 1.0, run: 3.2, hr: 0.28, hh: 0.8, food: [TALLGRASS, I_BREAD], drops: [[I_RAWCHICKEN, 1, 1], [I_FEATHER, 0, 2]], sound: "cluck", xp: 2, graze: 1 }
};
let farm = [], farmStash = [], farmSpawnT = 3;
const WOOL_COLS = [0xefede6, 0xefede6, 0xefede6, 0xefede6, 0xe8e4da, 0x9a9894, 0x5a4a3e, 0x2c2a2a];
function farmPart(g, w, h, d, col, x, y, z, pivotTop) { const m = bxm(w, h, d, col); if (pivotTop) m.geometry.translate(0, -h / 2, 0); m.position.set(x, y, z); g.add(m); return m; }
function buildFarmModel(type, woolCol) {
  const g = new THREE.Group(), head = new THREE.Group(), legs = [], U = { head, legs };
  if (type === "cow") {
    const hide = 0x4a3222, white = 0xf0ece4;
    farmPart(g, 0.9, 0.76, 1.32, hide, 0, 0.96, 0);
    farmPart(g, 0.92, 0.36, 0.44, white, 0, 1.04, -0.26); farmPart(g, 0.92, 0.3, 0.3, white, 0, 0.84, 0.36); farmPart(g, 0.46, 0.78, 0.36, white, 0.23, 0.97, 0.02);
    farmPart(g, 0.32, 0.12, 0.26, 0xe8a0a8, 0, 0.53, -0.26);                                                           // udder
    const tail = farmPart(g, 0.07, 0.56, 0.07, hide, 0, 1.28, -0.67, true); tail.rotation.x = 0.18; tail.userData.keep = 1; U.tail = tail;
    head.position.set(0, 1.18, 0.62); g.add(head);
    farmPart(head, 0.58, 0.56, 0.46, hide, 0, 0.1, 0.24); farmPart(head, 0.22, 0.32, 0.02, white, 0, 0.14, 0.475);
    farmPart(head, 0.38, 0.2, 0.12, 0xd9a0a0, 0, -0.08, 0.52); farmPart(head, 0.06, 0.05, 0.02, 0x3a2020, -0.09, -0.07, 0.585); farmPart(head, 0.06, 0.05, 0.02, 0x3a2020, 0.09, -0.07, 0.585);
    farmPart(head, 0.08, 0.08, 0.02, 0x101010, -0.2, 0.2, 0.475); farmPart(head, 0.08, 0.08, 0.02, 0x101010, 0.2, 0.2, 0.475);
    farmPart(head, 0.08, 0.16, 0.08, 0xe8e0c8, -0.31, 0.42, 0.24); farmPart(head, 0.08, 0.16, 0.08, 0xe8e0c8, 0.31, 0.42, 0.24);
    farmPart(head, 0.16, 0.09, 0.12, hide, -0.36, 0.26, 0.2); farmPart(head, 0.16, 0.09, 0.12, hide, 0.36, 0.26, 0.2);
    for (const [x, z] of [[-0.27, 0.46], [0.27, 0.46], [-0.27, -0.46], [0.27, -0.46]]) { const l = legPivot(g, x, 0.6, z); farmPart(l, 0.22, 0.6, 0.22, hide, 0, 0, 0, true); farmPart(l, 0.23, 0.1, 0.23, 0x2a1c12, 0, -0.55, 0); legs.push(l); }
  } else if (type === "pig") {
    const pink = 0xf0a8a8;
    farmPart(g, 0.72, 0.62, 1.02, pink, 0, 0.64, 0);
    farmPart(g, 0.5, 0.04, 0.8, 0xf4b8b4, 0, 0.965, 0);
    head.position.set(0, 0.7, 0.5); g.add(head);
    farmPart(head, 0.58, 0.54, 0.5, pink, 0, 0.02, 0.22); farmPart(head, 0.32, 0.22, 0.1, 0xe88a92, 0, -0.06, 0.5);
    farmPart(head, 0.06, 0.07, 0.02, 0x7a3a40, -0.07, -0.06, 0.555); farmPart(head, 0.06, 0.07, 0.02, 0x7a3a40, 0.07, -0.06, 0.555);
    farmPart(head, 0.08, 0.08, 0.02, 0x101010, -0.18, 0.12, 0.475); farmPart(head, 0.08, 0.08, 0.02, 0xffffff, -0.2, 0.12, 0.476); farmPart(head, 0.08, 0.08, 0.02, 0x101010, 0.18, 0.12, 0.475); farmPart(head, 0.08, 0.08, 0.02, 0xffffff, 0.2, 0.12, 0.476);
    const eL = farmPart(head, 0.16, 0.14, 0.06, 0xe898a0, -0.22, 0.3, 0.3); eL.rotation.x = 0.5; const eR = farmPart(head, 0.16, 0.14, 0.06, 0xe898a0, 0.22, 0.3, 0.3); eR.rotation.x = 0.5;
    const tail = farmPart(g, 0.06, 0.12, 0.06, 0xe898a0, 0, 0.84, -0.53); tail.rotation.x = -0.6; tail.userData.keep = 1; U.tail = tail;
    for (const [x, z] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) { const l = legPivot(g, x, 0.36, z); farmPart(l, 0.2, 0.36, 0.2, pink, 0, 0, 0, true); farmPart(l, 0.21, 0.06, 0.21, 0x9a6a64, 0, -0.33, 0); legs.push(l); }
  } else if (type === "sheep") {
    const face = 0x3a302a;
    U.skin = farmPart(g, 0.74, 0.6, 1.0, 0xd8bca4, 0, 0.9, 0);
    U.wool = new THREE.Group(); g.add(U.wool);
    farmPart(U.wool, 1.0, 0.82, 1.22, woolCol, 0, 0.94, 0); farmPart(U.wool, 0.84, 0.12, 1.04, woolCol, 0, 1.4, 0); farmPart(U.wool, 1.04, 0.5, 0.9, woolCol, 0, 0.9, 0);
    head.position.set(0, 1.12, 0.55); g.add(head);
    farmPart(head, 0.42, 0.46, 0.42, face, 0, 0, 0.2); farmPart(head, 0.08, 0.08, 0.02, 0xf2eee0, -0.12, 0.06, 0.415); farmPart(head, 0.08, 0.08, 0.02, 0xf2eee0, 0.12, 0.06, 0.415);
    farmPart(head, 0.04, 0.04, 0.02, 0x101010, -0.12, 0.05, 0.425); farmPart(head, 0.04, 0.04, 0.02, 0x101010, 0.12, 0.05, 0.425);
    U.cap = farmPart(head, 0.48, 0.2, 0.36, woolCol, 0, 0.26, 0.14); U.cap.userData.keep = 1;
    farmPart(head, 0.16, 0.08, 0.1, face, -0.27, 0.12, 0.14); farmPart(head, 0.16, 0.08, 0.1, face, 0.27, 0.12, 0.14);
    for (const [x, z] of [[-0.26, 0.38], [0.26, 0.38], [-0.26, -0.38], [0.26, -0.38]]) { const l = legPivot(g, x, 0.62, z); farmPart(l, 0.18, 0.62, 0.18, face, 0, 0, 0, true); legs.push(l); }
  } else {
    const white = 0xf4f2ee;
    farmPart(g, 0.36, 0.36, 0.48, white, 0, 0.46, 0);
    const tf = farmPart(g, 0.26, 0.24, 0.1, white, 0, 0.62, -0.26); tf.rotation.x = -0.5;
    head.position.set(0, 0.6, 0.18); g.add(head);
    farmPart(head, 0.24, 0.32, 0.22, white, 0, 0.1, 0.06); farmPart(head, 0.14, 0.08, 0.14, 0xf0b030, 0, 0.1, 0.22);
    farmPart(head, 0.08, 0.12, 0.05, 0xd83a2e, 0, -0.02, 0.19); farmPart(head, 0.06, 0.1, 0.16, 0xd83a2e, 0, 0.3, 0.06);
    farmPart(head, 0.05, 0.05, 0.02, 0x101010, -0.1, 0.16, 0.175); farmPart(head, 0.05, 0.05, 0.02, 0x101010, 0.1, 0.16, 0.175);
    U.wings = [farmPart(g, 0.06, 0.24, 0.34, 0xe8e4dc, -0.21, 0.6, 0, true), farmPart(g, 0.06, 0.24, 0.34, 0xe8e4dc, 0.21, 0.6, 0, true)]; U.wings.forEach(w => w.userData.keep = 1);
    for (const x of [-0.08, 0.08]) { const l = legPivot(g, x, 0.3, 0.02); farmPart(l, 0.05, 0.3, 0.05, 0xe8a030, 0, 0, 0, true); farmPart(l, 0.14, 0.03, 0.16, 0xe8a030, 0, -0.28, 0.04); legs.push(l); }
  }
  // collapse the static boxes of each moving part into one vertex coloured mesh: ~7 draw calls per animal instead of ~25
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  mergeParts(g, mat); mergeParts(head, mat); for (const l of legs) mergeParts(l, mat); if (U.wool) mergeParts(U.wool, mat);
  g.userData.farmU = U; return g;
}
function legPivot(g, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; }
const _mv = new THREE.Vector3(), _mn = new THREE.Matrix3();
function mergeParts(node, mat) {
  const parts = node.children.filter(c => c.isMesh && !c.children.length && !c.userData.keep && c.geometry && c.geometry.index && c.geometry.attributes && c.geometry.attributes.position);
  if (parts.length < 2) return null;
  let nv = 0, ni = 0;
  for (const m of parts) { const P = m.geometry.attributes.position; if (typeof P.count !== "number" || typeof m.geometry.index.count !== "number" || !m.geometry.attributes.normal || !m.geometry.attributes.uv) return null; nv += P.count; ni += m.geometry.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), idx = new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const m of parts) {
    m.updateMatrix(); _mn.getNormalMatrix(m.matrix);
    const G = m.geometry, P = G.attributes.position, N = G.attributes.normal, T = G.attributes.uv, c = m.material.color;
    const r = Math.pow(c.r, 2.2), gg = Math.pow(c.g, 2.2), b = Math.pow(c.b, 2.2);   // vertex colours skip the sRGB patch, so linearize here
    for (let i = 0; i < P.count; i++) {
      _mv.fromBufferAttribute(P, i).applyMatrix4(m.matrix); pos[(vo + i) * 3] = _mv.x; pos[(vo + i) * 3 + 1] = _mv.y; pos[(vo + i) * 3 + 2] = _mv.z;
      _mv.fromBufferAttribute(N, i).applyMatrix3(_mn).normalize(); nor[(vo + i) * 3] = _mv.x; nor[(vo + i) * 3 + 1] = _mv.y; nor[(vo + i) * 3 + 2] = _mv.z;
      col[(vo + i) * 3] = r; col[(vo + i) * 3 + 1] = gg; col[(vo + i) * 3 + 2] = b; uvs[(vo + i) * 2] = T.getX(i); uvs[(vo + i) * 2 + 1] = T.getY(i);
    }
    for (let i = 0; i < G.index.count; i++) idx[io + i] = G.index.getX(i) + vo;
    vo += P.count; io += G.index.count; node.remove(m); G.dispose(); if (m.material.dispose) m.material.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); const mesh = new THREE.Mesh(geo, mat); node.add(mesh); return mesh;
}
function spawnFarmAnimal(type, x, z, opts) {
  opts = opts || {};
  const cfg = FARM[type]; if (!cfg) return null;
  const woolCol = opts.wool != null ? opts.wool : WOOL_COLS[Math.floor(Math.random() * WOOL_COLS.length)];
  const g = buildFarmModel(type, woolCol), U = g.userData.farmU;
  const y = opts.y != null ? opts.y : surfaceY(Math.floor(x), Math.floor(z));
  g.position.set(x, y, z); g.rotation.y = Math.random() * 6.28; scene.add(g);
  const a = { g, type, hp: cfg.hp, max: cfg.hp, hr: cfg.hr, hh: cfg.hh, dir: g.rotation.y, state: "idle", t: 1 + Math.random() * 3, vy: 0, kx: 0, kz: 0,
    age: opts.baby ? 0 : -1, love: 0, breedCd: opts.baby ? 120 : 0, sheared: !!opts.sheared, woolT: 0, eggT: 60 + Math.random() * 120, panic: 0, flash: 0,
    sayT: 4 + Math.random() * 14, walkT: Math.random() * 6, kept: !!opts.kept, vil: opts.vil || null, woolCol, dead: false, dt: 0,
    legs: U.legs, head: U.head, wings: U.wings, wool: U.wool, cap: U.cap, tail: U.tail };
  if (a.wool) a.wool.visible = !a.sheared; if (a.cap) a.cap.visible = !a.sheared;
  g.traverse(o => { o.userData.kind = "animal"; o.userData.a = a; });
  setAnimalScale(a); farm.push(a); return a;
}
function setAnimalScale(a) { const s = a.age >= 0 ? 0.5 + 0.5 * Math.min(1, a.age / 180) : 1; a.g.scale.setScalar(s); a.hr = FARM[a.type].hr * s; a.hh = FARM[a.type].hh * s; if (a.head) a.head.scale.setScalar(a.age >= 0 ? 1 + 0.3 * (1 - s) / 0.5 : 1); }
function colReady(x, z) { return CSTORE.has(cnum(Math.floor(Math.floor(x) / CH), Math.floor(Math.floor(z) / CH))); }
// the ground an animal stands on: highest solid block at or below one step above its feet
function animalGround(x, y, z) { const bx = Math.floor(x), bz = Math.floor(z); let by = Math.min(WORLD_H - 1, Math.floor(y + 1.05)); for (let k = 0; k < 48 && by >= 0; k++, by--) { const id = getBlock(bx, by, bz); if (isSolidBlock(id)) return by + 1; } return -64; }
// can the animal walk into this cell: no two block wall, no cliff, no water or lava (unless it is running for its life)
function animalCellOk(a, nx, nz, panic) {
  const fy = Math.floor(a.g.position.y + 0.01), bx = Math.floor(nx), bz = Math.floor(nz);
  if (isSolidBlock(getBlock(bx, fy + 1, bz)) || isTall(getBlock(bx, fy, bz))) return false;   // two block walls and fences pen animals in
  if (a.hh > 1.0 && isSolidBlock(getBlock(bx, fy + 2, bz)) && isSolidBlock(getBlock(bx, fy, bz))) return false;   // no headroom after a step
  const gy = animalGround(nx, a.g.position.y, nz);
  if (gy < fy - (panic ? 4 : 2)) return false;
  const under = getBlock(bx, gy, bz), below = getBlock(bx, gy - 1, bz);
  if (under === WATER || under === LAVA || below === LAVA || (below === WATER && !panic)) return false;
  return true;
}
function animalStep(a, dx, dz, sp, dt, panic) {
  const d = Math.hypot(dx, dz); if (d < 1e-4) return false;
  const ux = dx / d, uz = dz / d, st = sp * dt, p = a.g.position, r = a.hr * 0.8;
  let moved = false;
  if (animalCellOk(a, p.x + ux * (st + r), p.z, panic)) { p.x += ux * st; moved = true; }
  if (animalCellOk(a, p.x, p.z + uz * (st + r), panic)) { p.z += uz * st; moved = true; }
  const want = Math.atan2(ux, uz); let da = want - a.g.rotation.y; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
  a.g.rotation.y += da * Math.min(1, dt * 7);
  return moved;
}
function animalGravity(a, dt) {
  const p = a.g.position, gy = animalGround(p.x, p.y, p.z);
  const inWater = getBlock(Math.floor(p.x), Math.floor(p.y + 0.3), Math.floor(p.z)) === WATER;
  if (inWater) { a.vy = Math.min(2, a.vy + 14 * dt); if (getBlock(Math.floor(p.x), Math.floor(p.y + 0.7), Math.floor(p.z)) !== WATER) a.vy = Math.min(a.vy, 0.4); p.y += a.vy * dt; if (p.y < gy) p.y = gy; return; }
  if (p.y > gy + 0.02) { a.vy -= 24 * dt; p.y += a.vy * dt; if (p.y <= gy) { p.y = gy; a.vy = 0; } }
  else { p.y += Math.min(gy - p.y, dt * 7); if (Math.abs(gy - p.y) < 0.02) p.y = gy; a.vy = 0; }
}
function hearts(p, n) { if (fxParts.length > FX_CAP) return; for (let i = 0; i < (n || 4); i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex(), transparent: true, depthWrite: false })); m.scale.set(0.3, 0.3, 1); m.position.set(p.x + (Math.random() - 0.5) * 0.6, p.y + 1 + Math.random() * 0.4, p.z + (Math.random() - 0.5) * 0.6); scene.add(m); fxParts.push({ mesh: m, life: 1.1, beam: 1, max: 1.1, vel: new THREE.Vector3(0, 0.8, 0) }); } }
let _heartTex = null;
function heartTex() {
  if (_heartTex) return _heartTex;
  const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d");
  if (x && x.beginPath && x.bezierCurveTo) { x.fillStyle = "#ff4d6d"; x.beginPath(); x.moveTo(16, 28); x.bezierCurveTo(2, 18, 2, 6, 10, 6); x.bezierCurveTo(14, 6, 16, 10, 16, 12); x.bezierCurveTo(16, 10, 18, 6, 22, 6); x.bezierCurveTo(30, 6, 30, 18, 16, 28); x.fill(); x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(9, 9, 4, 3); }
  return (_heartTex = new THREE.CanvasTexture(c));
}
function animalSay(a) { const d = a.g.position.distanceTo(player.pos); if (d < 18 && SFX[FARM[a.type].sound]) SFX[FARM[a.type].sound](); }
function hurtAnimal(a, dmg, dir, point, crit) {
  if (a.dead) return;
  a.hp -= dmg; a.flash = 0.25; a.panic = 5 + Math.random() * 2; a.state = "flee"; a.love = 0;
  const d = dir || new THREE.Vector3(a.g.position.x - player.pos.x, 0, a.g.position.z - player.pos.z).normalize();
  a.kx = d.x * 5; a.kz = d.z * 5; a.vy = 4.5; a.dir = Math.atan2(d.x, d.z);
  hitSpark(point || a.g.position, 0xff5566); dmgNumber(point || a.g.position, dmg, crit); animalSay(a);
  for (const o of farm) if (o !== a && o.type === a.type && !o.dead && o.g.position.distanceTo(a.g.position) < 7) { o.panic = 3 + Math.random() * 2; o.state = "flee"; }   // the herd scatters
  if (a.hp <= 0) killAnimal(a);
}
function killAnimal(a) {
  if (a.dead) return; a.dead = true; a.dt = 0;
  const cfg = FARM[a.type], p = a.g.position, grown = a.age < 0 || a.age >= 180;
  if (grown) {
    for (const [id, lo, hi] of cfg.drops) { const n = lo + Math.floor(Math.random() * (hi - lo + 1 + luckBonus * 0.5)); if (n > 0) dropItemAt(p.x, p.y + 0.5, p.z, id, n); }
    if (a.type === "sheep" && !a.sheared) dropItemAt(p.x, p.y + 0.6, p.z, WOOL, 1);
  }
  addXP(cfg.xp); animalSay(a);
}
// shearing, feeding, breeding: the Use key on an animal within reach
function nearestAnimal(r) { let best = null, bd = r; for (const a of farm) { if (a.dead || !a.g.visible) continue; const d = a.g.position.distanceTo(player.pos); if (d < bd) { bd = d; best = a; } } return best; }
function animalInteract(a) {
  const it = hotbar[selSlot], cfg = FARM[a.type], who = "The " + cfg.name.toLowerCase();
  if (it && it.id === I_BUCKET && a.type === "cow" && a.age < 0) { hotbar[selSlot] = newStack(I_MILK, 1); renderHotbar(); buildViewItem(); SFX.splash(); animalSay(a); toast("Filled a bucket with milk"); return true; }
  if (it && it.id === I_SHEARS && a.type === "sheep") {
    if (a.sheared || a.age >= 0) { toast(a.age >= 0 ? "Lambs are too small to shear" : "This sheep has no wool yet. Let it graze."); return true; }
    a.sheared = true; a.woolT = 0; if (a.wool) a.wool.visible = false; if (a.cap) a.cap.visible = false; a.kept = true;
    const n = 1 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) dropItemAt(a.g.position.x, a.g.position.y + 1, a.g.position.z, WOOL, 1);
    wearTool(1); SFX.shear(); animalSay(a); achieve("shepherd", "Shepherd"); return true;
  }
  if (it && cfg.food.indexOf(it.id) >= 0) {
    if (a.age >= 0 && a.age < 180) { a.age = Math.min(180, a.age + 36); setAnimalScale(a); removeItem(selSlot, 1); hearts(a.g.position, 2); SFX.love(); a.kept = true; return true; }
    if (a.breedCd > 0) { toast(who + " needs time before it can breed again"); return true; }
    if (a.love > 0) { toast(who + " is already looking for a mate"); return true; }
    removeItem(selSlot, 1); a.love = 25; a.kept = true; hearts(a.g.position, 5); SFX.love(); animalSay(a);
    toast("Fed " + cfg.name.toLowerCase() + ". Feed another nearby to breed them.");
    return true;
  }
  return false;
}
function breedAnimals(a, b) {
  a.love = b.love = 0; a.breedCd = b.breedCd = 150;
  const x = (a.g.position.x + b.g.position.x) / 2, z = (a.g.position.z + b.g.position.z) / 2;
  const baby = spawnFarmAnimal(a.type, x, z, { baby: true, kept: true, y: Math.max(a.g.position.y, b.g.position.y), wool: Math.random() < 0.5 ? a.woolCol : b.woolCol });
  hearts(baby.g.position, 7); SFX.love(); addXP(6); achieve("rancher", "Rancher");
  toast("A baby " + FARM[a.type].name.toLowerCase() + " was born!");
}
function updateFarmAnimal(a, dt) {
  const cfg = FARM[a.type], p = a.g.position;
  const dpx = player.pos.x - p.x, dpz = player.pos.z - p.z, dP = Math.hypot(dpx, dpz);
  if (a.flash > 0) a.flash -= dt;
  if (a.age >= 0) { a.age += dt; if (a.age >= 180) { a.age = -1; } setAnimalScale(a); }
  if (a.breedCd > 0) a.breedCd -= dt;
  if (a.love > 0) { a.love -= dt; if (Math.random() < dt * 2) hearts(p, 1); }
  a.sayT -= dt; if (a.sayT <= 0) { a.sayT = 8 + Math.random() * 16; animalSay(a); }
  if (a.type === "chicken" && a.age < 0) { a.eggT -= dt; if (a.eggT <= 0) { a.eggT = 120 + Math.random() * 120; dropItemAt(p.x, p.y + 0.3, p.z, I_EGG, 1); if (dP < 16) SFX.cluck(); } }
  const held = hotbar[selSlot], tempted = held && cfg.food.indexOf(held.id) >= 0 && dP < 10 && a.panic <= 0;
  let moved = false, sp = cfg.speed * (a.age >= 0 ? 1.15 : 1);
  if (a.kx || a.kz) { const k = Math.min(1, dt * 6); if (animalCellOk(a, p.x + a.kx * dt * 1.5, p.z + a.kz * dt * 1.5, true)) { p.x += a.kx * dt; p.z += a.kz * dt; } a.kx -= a.kx * k; a.kz -= a.kz * k; if (Math.abs(a.kx) + Math.abs(a.kz) < 0.05) a.kx = a.kz = 0; }
  if (a.panic > 0) {                                           // run from Thomas, zig zagging
    a.panic -= dt; if (Math.random() < dt * 1.5) a.dir += (Math.random() - 0.5) * 1.8;
    const away = Math.atan2(-dpx, -dpz), dd = dP < 10 ? away : a.dir; a.dir = dd + (Math.random() - 0.5) * 0.4 * dt;
    moved = animalStep(a, Math.sin(a.dir), Math.cos(a.dir), cfg.run, dt, true); if (!moved) a.dir += 1.4 + Math.random();
  } else if (a.love > 0 && a.age < 0) {                        // find a partner that was fed too
    let mate = null, md = 9; for (const o of farm) if (o !== a && !o.dead && o.type === a.type && o.love > 0 && o.age < 0) { const d = o.g.position.distanceTo(p); if (d < md) { md = d; mate = o; } }
    if (mate) { if (md < 1.3) breedAnimals(a, mate); else moved = animalStep(a, mate.g.position.x - p.x, mate.g.position.z - p.z, sp * 1.2, dt, false); }
    else if (tempted && dP > 2) moved = animalStep(a, dpx, dpz, sp, dt, false);
  } else if (tempted) {                                        // follows the food in Thomas's hand
    if (dP > 2.0) moved = animalStep(a, dpx, dpz, sp * 1.1, dt, false);
    else { const want = Math.atan2(dpx, dpz); a.g.rotation.y += (want - a.g.rotation.y) * Math.min(1, dt * 4); }
    a.state = "idle"; a.t = 1;
  } else if (a.age >= 0 && a.age < 180) {                      // babies trail after the nearest adult of their kind
    let mom = null, md = 12; for (const o of farm) if (o !== a && !o.dead && o.type === a.type && o.age < 0) { const d = o.g.position.distanceTo(p); if (d < md) { md = d; mom = o; } }
    if (mom && md > 2.2) moved = animalStep(a, mom.g.position.x - p.x, mom.g.position.z - p.z, sp * 1.2, dt, false);
    else { a.t -= dt; if (a.state === "walk") { moved = animalStep(a, Math.sin(a.dir), Math.cos(a.dir), sp, dt, false); if (!moved) a.dir += 1.5; } if (a.t <= 0) { a.state = a.state === "walk" ? "idle" : "walk"; a.t = 1 + Math.random() * 3; a.dir += (Math.random() - 0.5) * 2; } }
  } else {                                                     // idle, stroll or graze
    a.t -= dt;
    if (a.state === "walk") { moved = animalStep(a, Math.sin(a.dir), Math.cos(a.dir), sp, dt, false); if (!moved) { a.dir += 1.2 + Math.random() * 1.5; } if (Math.random() < dt * 0.4) a.dir += (Math.random() - 0.5) * 1.2; }
    if (a.state === "graze" && a.t < 0.1) {                    // sheep regrow wool by grazing on grass
      const under = getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z));
      if (a.type === "sheep" && a.sheared && (under === GRASS || under === TALLGRASS) && Math.random() < 0.4) { a.sheared = false; if (a.wool) a.wool.visible = true; if (a.cap) a.cap.visible = true; }
    }
    if (a.t <= 0) { const r = Math.random(); if (r < 0.45) { a.state = "walk"; a.t = 2 + Math.random() * 5; a.dir += (Math.random() - 0.5) * 2.4; } else if (r < 0.7 && cfg.graze) { a.state = "graze"; a.t = 2 + Math.random() * 3; } else { a.state = "idle"; a.t = 1.5 + Math.random() * 4; } }
  }
  animalGravity(a, dt);
  // animation: legs swing while walking, head dips to graze, chickens flap when they fall or panic
  if (moved) a.walkT += dt * (a.panic > 0 ? 14 : 8);
  const sw = moved ? Math.sin(a.walkT) * (a.type === "chicken" ? 0.8 : 0.55) : 0;
  for (let i = 0; i < a.legs.length; i++) { const tgt = (i === 0 || i === 3 ? sw : -sw); a.legs[i].rotation.x += (tgt - a.legs[i].rotation.x) * Math.min(1, dt * 12); }
  if (a.head) { const graze = a.state === "graze" && !moved && a.panic <= 0 && !tempted ? (a.type === "chicken" ? 0.9 + Math.sin(a.walkT += dt * 9) * 0.35 : 0.95) : 0; a.head.rotation.x += (graze - a.head.rotation.x) * Math.min(1, dt * 5); }
  if (a.wings) { const f = (a.vy < -0.5 || a.panic > 0) ? Math.sin(performance.now() * 0.05) * 0.7 + 0.7 : 0; a.wings[0].rotation.z = f; a.wings[1].rotation.z = -f; }
  if (a.tail) a.tail.rotation.z = Math.sin(performance.now() * 0.004 + a.walkT) * 0.25;
  const fl = a.flash > 0; if (fl !== !!a._fl) { a._fl = fl; const em = fl ? 0x661018 : 0x000000; a.g.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(em); }); }
}
function pickFarmType(x, z) {
  const b = biomeAt(x, z), r = Math.random();
  if (b.t > 0.66) return null;                                   // no herds in the desert
  if (b.t < 0.3) return r < 0.6 ? "sheep" : r < 0.8 ? "cow" : "chicken";
  if (b.m > 0.58) return r < 0.4 ? "pig" : r < 0.7 ? "chicken" : r < 0.85 ? "cow" : "sheep";
  return r < 0.3 ? "cow" : r < 0.55 ? "sheep" : r < 0.78 ? "pig" : "chicken";
}
function spawnHerd(type, x, z, n, opts) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const hx = x + (Math.random() - 0.5) * 5, hz = z + (Math.random() - 0.5) * 5; if (!colReady(hx, hz)) continue;
    const top = getBlock(Math.floor(hx), surfaceY(Math.floor(hx), Math.floor(hz)) - 1, Math.floor(hz));
    if (top !== GRASS && top !== SNOW && top !== DIRT && top !== PATH) continue;
    out.push(spawnFarmAnimal(type, hx, hz, Object.assign({ baby: Math.random() < 0.15 }, opts || {})));
  }
  return out;
}
function updateFarm(dt) {
  if (DIM !== "overworld") return;
  for (let i = farm.length - 1; i >= 0; i--) {
    const a = farm[i];
    if (a.dead) { a.dt += dt; a.g.rotation.z = Math.min(1.5, a.dt * 5); a.g.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 1.5)); if (a.dt > 0.7) { scene.remove(a.g); farm.splice(i, 1); } continue; }
    const d = Math.hypot(a.g.position.x - player.pos.x, a.g.position.z - player.pos.z);
    if (!a.kept && d > 110) { scene.remove(a.g); farm.splice(i, 1); continue; }   // wild herds come and go
    if (d > 80 || a.frozen || !colReady(a.g.position.x, a.g.position.z)) continue;   // frozen while its chunk is far or unloaded
    updateFarmAnimal(a, dt);
  }
  farmSpawnT -= dt;
  if (farmSpawnT <= 0) {
    farmSpawnT = 5 + Math.random() * 4;
    let wild = 0; for (const a of farm) if (!a.kept && !a.vil && !a.dead) wild++;
    if (wild < 12 && farm.length < 60) {
      const ang = Math.random() * 6.283, r = 26 + Math.random() * 22, x = player.pos.x + Math.cos(ang) * r, z = player.pos.z + Math.sin(ang) * r;
      if (colReady(x, z) && !villageNear(x, z, 4) && Math.hypot(x - CV_X, z - CV_Z) > 30) { const t = pickFarmType(x, z); if (t) spawnHerd(t, x, z, t === "chicken" ? 2 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2)); }
    }
  }
}
// farm animals survive trips to other dimensions and saves: tamed ones always, wild ones near Thomas
function serializeFarm() { return farm.filter(a => !a.dead && (a.kept || (!a.vil && a.g.position.distanceTo(player.pos) < 64))).slice(0, 80).map(a => ({ t: a.type, x: +a.g.position.x.toFixed(2), y: +a.g.position.y.toFixed(2), z: +a.g.position.z.toFixed(2), age: Math.round(a.age), s: a.sheared ? 1 : 0, k: a.kept ? 1 : 0, w: a.woolCol, bc: Math.round(a.breedCd) })); }
function stashFarm() { if (farm.length) farmStash = serializeFarm(); for (const a of farm) scene.remove(a.g); farm = []; }
function restoreFarm(list) { for (const d of list || []) { if (!FARM[d.t]) continue; const a = spawnFarmAnimal(d.t, d.x, d.z, { y: d.y, sheared: !!d.s, kept: !!d.k, wool: d.w, baby: d.age >= 0 }); if (a) { a.age = d.age != null ? d.age : -1; a.breedCd = d.bc || 0; setAnimalScale(a); } } }
function resetFarm() { for (const a of farm) scene.remove(a.g); farm = []; farmStash = []; }
// items lying in the world (eggs, animal drops, wool): they bob and spin, and drift to Thomas when he walks close
const groundItems = [];
function dropItemAt(x, y, z, id, n) {
  if (groundItems.length > 120) { const o = groundItems.shift(); scene.remove(o.mesh); }
  const m = dropMesh(id); m.position.set(x, y, z); scene.add(m);
  groundItems.push({ mesh: m, id, n: n || 1, vel: new THREE.Vector3((Math.random() - 0.5) * 2.4, 3 + Math.random() * 1.5, (Math.random() - 0.5) * 2.4), t: 0, life: 300 });
}
function updateGroundItems(dt) {
  for (let i = groundItems.length - 1; i >= 0; i--) {
    const g = groundItems[i], q = g.mesh.position; g.t += dt; g.life -= dt;
    const dx = player.pos.x - q.x, dy = player.pos.y + 0.8 - q.y, dz = player.pos.z - q.z, d = Math.hypot(dx, dy, dz);
    if (g.t > 0.6 && d < 2.6) { const k = Math.min(1, dt * (5 + (2.6 - d) * 6)); q.x += dx * k; q.y += dy * k; q.z += dz * k; if (d < 0.7) { const left = giveItems(g.id, g.n); if (left < g.n) { renderHotbar(); SFX.pickup(); toast("+" + (g.n - left) + " " + itemName(g.id)); onCollect(g.id); } if (left <= 0) { scene.remove(g.mesh); groundItems.splice(i, 1); continue; } g.n = left; } }
    else {
      g.vel.y -= 16 * dt; q.addScaledVector(g.vel, dt);
      const by = Math.floor(q.y - 0.18);
      if (isSolidBlock(getBlock(Math.floor(q.x), by, Math.floor(q.z))) && g.vel.y <= 0) { q.y = by + 1.18; g.vel.set(0, 0, 0); }
      if (isSolidBlock(getBlock(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z)))) q.y += dt * 4;   // squeezed out of a block
      if (g.vel.lengthSq() === 0) { q.y += Math.sin(g.t * 3) * 0.004; const fv = flowVec(q.x, q.y - 0.1, q.z); if (fv.x || fv.z) { q.x += fv.x * 1.8 * dt; q.z += fv.z * 1.8 * dt; } }
    }
    g.mesh.rotation.y += dt * 1.6;
    if (g.life <= 0) { scene.remove(g.mesh); groundItems.splice(i, 1); }
  }
}
function clearGroundItems() { for (const g of groundItems) scene.remove(g.mesh); groundItems.length = 0; }
