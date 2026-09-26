/* story.js: Power ups, opening story, world events, economy, villagers.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- POWER-UPS (easy to read timed buffs) ----------
const POWERUPS = {
  speed:      { name: "Speed Boots",  icon: "👢", dur: 30 },
  jump:       { name: "Super Jump",   icon: "🦘", dur: 30 },
  catvision:  { name: "Cat Vision",   icon: "🐾", dur: 45 },
  doublejump: { name: "Double Jump",  icon: "⏫", dur: 30 },
  glide:      { name: "Glide Cape",   icon: "🪂", dur: 30 },
  shield:     { name: "Shield Bubble", icon: "🛡️", dur: 8 },
  star:       { name: "Power Star",   icon: "⭐", dur: 12 },
  mega:       { name: "Mega Mushroom", icon: "🍄", dur: 10 }
};
const powerups = { speed: 0, jump: 0, catvision: 0, doublejump: 0, glide: 0, shield: 0, star: 0, mega: 0 };
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
  // open a small forest clearing so the camp sits on the ground and the opening view shows sky, not a wall of leaves
  ensureGen(1, 1, 16);
  for (let x = -9; x <= 11; x++) for (let z = -8; z <= 10; z++) {
    const d = Math.hypot(x - 1, z - 1), h = heightAt(x, z);
    if (d > 8.5) continue;
    const isLog = id => id === WOOD || id === BIRCH_WOOD || id === SPRUCE_WOOD;          // every tree kind, not just oak
    const trunk = isLog(getBlock(x, h + 1, z));
    for (let y = h + 1; y < WORLD_H; y++) { const id = getBlock(x, y, z); if ((LEAFY[id] && d <= 7) || (isLog(id) && (trunk ? d <= 6.5 : d <= 7))) put(x, y, z, AIR); }
  }
  // ring of stones around the fire
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) { const sy = surfaceY(cx + ox, cz + oz); put(cx + ox, sy, cz + oz, COBBLE); }
  // a couple of broken logs and an ember (torch) in the middle
  const fy = surfaceY(cx, cz); put(cx, fy, cz, WOOD); put(cx, fy + 1, cz, TORCH);
  const wy = surfaceY(cx + 1, cz - 1); put(cx + 1, wy, cz - 1, WOOD);
  // supply chest beside the fire, with a generous starter haul
  const chx = cx + 2, chz = cz; const chy = surfaceY(chx, chz);
  put(chx, chy, chz, CHEST);
  const cgkey = chestKey(chx, chy, chz);
  chestStore.set(cgkey, [{ id: WOOD, count: 6 }, { id: PLANKS, count: 8 }, { id: TORCH, count: 6 }, { id: I_APPLE, count: 3 }, { id: I_SPICK, count: 1 }, { id: COBBLE, count: 8 }, newStack(I_BOW, 1), { id: I_ARROW, count: 16 }, null]);
  // a crafting table beside the supply chest, so the first tools can be made right away
  { const tx = chx, tz = chz + 2, ty = surfaceY(tx, tz); put(tx, ty, tz, CRAFT_TABLE); }
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
let fredaPingCd = 0;
function updateFredaPing(dt) {                          // soft chime when Thomas is near an unbroken Freda Box
  fredaPingCd -= dt; if (fredaPingCd > 0 || !fredaLabelGroup) return;
  let nearest = 99; for (const s of fredaLabelGroup.children) { const d = Math.hypot(s.position.x - player.pos.x, s.position.z - player.pos.z); if (d < nearest) nearest = d; }
  if (nearest < 8) { fredaPingCd = 1.4; blip(880 + (8 - nearest) * 60, 0.05, "triangle", 0.06, 1320); }
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
// shops: the wandering merchant and every village trader share this panel; rows either sell to Thomas (cost) or buy from him (sell + gain)
let activeShop = SHOP, activeShopTitle = "Traveling Merchant";
function renderShop() {
  const sc = $("shopCoins"); if (sc) sc.textContent = "you have 🪙 " + coins;
  const tt = $("shopTitle"); if (tt) tt.textContent = activeShopTitle;
  const l = $("shopList"); if (!l) return; l.innerHTML = "";
  for (const s of activeShop) {
    const selling = !!s.sell, ok = selling ? s.sell.every(([id, n]) => countItem(id) >= n) : coins >= s.cost;
    const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no");
    row.innerHTML = "<span><b>" + s.name + "</b><br><span class='muted'>" + (selling ? "you get 🪙 " + s.gain : "🪙 " + s.cost) + "</span></span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = selling ? "Sell" : "Buy";
    b.addEventListener("pointerdown", e => { e.preventDefault();
      if (selling) { if (!ok) { toast("You do not have that"); return; } s.sell.forEach(([id, n]) => consumeItem(id, n)); addCoins(s.gain); SFX.coin(); renderShop(); return; }
      if (coins >= s.cost) { coins -= s.cost; s.give(); SFX.pickup(); updateCoinUI(); renderShop(); } else toast("Not enough coins"); });
    row.appendChild(b); l.appendChild(row);
  }
}
function openShop(list, title) { activeShop = list || SHOP; activeShopTitle = title || "Traveling Merchant"; renderShop(); show("shop"); document.exitPointerLock(); if (!list) SFX.meow(); else blip(260, 0.18, "triangle", 0.12, 200); }
// ---------- VILLAGERS: traders who stroll between the well and their doors ----------
const VSHOPS = {
  farmer: { title: "Farmer", list: [
    { name: "Bread x3", cost: 4, give: () => addItem(I_BREAD, 3) }, { name: "Apple x3", cost: 5, give: () => addItem(I_APPLE, 3) },
    { name: "Hay Bale x2", cost: 4, give: () => addItem(HAY, 2) }, { name: "Sell Tall Grass x8", sell: [[TALLGRASS, 8]], gain: 2 },
    { name: "Sell Wood x8", sell: [[WOOD, 8]], gain: 3 }, { name: "Golden Apple", cost: 30, give: () => addItem(I_GAPPLE, 1) },
    { name: "Shears", cost: 8, give: () => addItem(I_SHEARS, 1) }, { name: "Farm Pie x2", cost: 9, give: () => addItem(I_PIE, 2) },
    { name: "Sell Raw Beef x4", sell: [[I_RAWBEEF, 4]], gain: 4 }, { name: "Sell Raw Porkchop x4", sell: [[I_RAWPORK, 4]], gain: 4 },
    { name: "Sell Wool x6", sell: [[WOOL, 6]], gain: 4 }, { name: "Sell Egg x6", sell: [[I_EGG, 6]], gain: 3 }] },
  fletcher: { title: "Fletcher", list: [
    { name: "Arrow x16", cost: 5, give: () => addItem(I_ARROW, 16) }, { name: "Bow", cost: 10, give: () => addItem(I_BOW, 1) },
    { name: "Flint x4", cost: 3, give: () => addItem(I_FLINT, 4) }, { name: "Feather x6", cost: 3, give: () => addItem(I_FEATHER, 6) },
    { name: "Sell String x6", sell: [[I_STRING, 6]], gain: 3 }, { name: "Sell Feather x8", sell: [[I_FEATHER, 8]], gain: 3 },
    { name: "Sell Flint x6", sell: [[I_FLINT, 6]], gain: 3 }, { name: "Sell Leather x4", sell: [[I_LEATHER, 4]], gain: 5 }] },
  smith: { title: "Blacksmith", list: [
    { name: "Iron Ingot x2", cost: 10, give: () => addItem(I_IRON, 2) }, { name: "Iron Pickaxe", cost: 22, give: () => addItem(I_IPICK, 1) },
    { name: "Iron Sword", cost: 20, give: () => addItem(I_ISWORD, 1) }, { name: "Iron Armor", cost: 45, give: () => addItem(I_IARMOR, 1) },
    { name: "Sell Coal x8", sell: [[I_COAL, 8]], gain: 4 }, { name: "Sell Iron Ingot x2", sell: [[I_IRON, 2]], gain: 6 },
    { name: "Sell Gold Ingot", sell: [[I_GOLD, 1]], gain: 6 }, { name: "Sell Diamond", sell: [[I_DIAMOND, 1]], gain: 18 }] },
  mason: { title: "Mason", list: [
    { name: "Stone Bricks x16", cost: 8, give: () => addItem(STONEBRICK, 16) }, { name: "Glass x8", cost: 7, give: () => addItem(GLASS, 8) },
    { name: "Lantern x2", cost: 8, give: () => addItem(LANTERN, 2) }, { name: "Furnace", cost: 6, give: () => addItem(FURNACE, 1) },
    { name: "Sell Cobblestone x32", sell: [[COBBLE, 32]], gain: 4 }, { name: "Sell Gravel x16", sell: [[GRAVEL, 16]], gain: 3 }] },
  cleric: { title: "Cleric", list: [
    { name: "Golden Apple", cost: 26, give: () => addItem(I_GAPPLE, 1) }, { name: "Shield Bubble (power-up)", cost: 14, give: () => givePowerup("shield") },
    { name: "Treasure Map", cost: 10, give: () => startTreasureHunt() }, { name: "Sell Crystal x2", sell: [[CRYSTAL, 2]], gain: 7 }, { name: "Sell Fire Crystal x2", sell: [[FIRE_CRYSTAL, 2]], gain: 8 }] }
};
const VCOL = { farmer: [0x7a5a2e, 0xc9a23a], smith: [0x3b3b42, 0x1e1e22], mason: [0x9a8c78, 0x6e5f4a], cleric: [0x6b3fa0, 0xe8c64a], fletcher: [0x3f6a3a, 0x8a5a2e] };
let villagers = [], villageScanT = 0;
function makeVillager(job) {
  const g = new THREE.Group(), c = VCOL[job] || VCOL.farmer;
  const robe = box(0.5, 0.95, 0.34, c[0]); robe.position.y = 0.55; g.add(robe);
  const trim = box(0.52, 0.12, 0.36, c[1]); trim.position.y = 0.12; g.add(trim);
  const arms = box(0.56, 0.16, 0.26, c[0]); arms.position.set(0, 0.8, 0.14); g.add(arms);
  const hands = box(0.2, 0.14, 0.12, 0xd9a47a); hands.position.set(0, 0.8, 0.29); g.add(hands);
  const head = box(0.4, 0.46, 0.4, 0xd9a47a); head.position.y = 1.28; g.add(head);
  const nose = box(0.09, 0.2, 0.1, 0xc98f66); nose.position.set(0, 1.2, 0.24); g.add(nose);
  const brow = box(0.34, 0.05, 0.03, 0x4a3320); brow.position.set(0, 1.4, 0.205); g.add(brow);
  const eL = box(0.07, 0.06, 0.03, 0x2a6a3a); eL.position.set(-0.1, 1.33, 0.205); g.add(eL); const eR = eL.clone(); eR.position.x = 0.1; g.add(eR);
  if (job === "smith") { const ap = box(0.4, 0.6, 0.04, 0x2a2a2e); ap.position.set(0, 0.5, 0.19); g.add(ap); }
  if (job === "farmer") { const hat = box(0.62, 0.06, 0.62, 0xd8b45a); hat.position.y = 1.54; g.add(hat); const cr = box(0.36, 0.12, 0.36, 0xd8b45a); cr.position.y = 1.62; g.add(cr); }
  if (job === "cleric") { const hood = box(0.44, 0.1, 0.44, c[0]); hood.position.y = 1.54; g.add(hood); }
  if (job === "fletcher") { const cap = box(0.44, 0.12, 0.44, 0x2e4a2a); cap.position.y = 1.56; g.add(cap); const fe = box(0.03, 0.22, 0.1, 0xc8352a); fe.position.set(0.18, 1.7, -0.05); fe.rotation.z = -0.4; g.add(fe); const qv = box(0.12, 0.42, 0.12, 0x6a4424); qv.position.set(-0.12, 0.85, -0.22); qv.rotation.z = 0.35; g.add(qv); }
  return g;
}
function spawnVillagers(v) {
  v.spawned = true;
  v.houses.forEach((h, i) => {
    const g = makeVillager(h.job), vx = v.cx + 0.5 + Math.cos(i * 2.1) * 3, vz = v.cz + 0.5 + Math.sin(i * 2.1) * 3;
    g.position.set(vx, surfaceY(Math.floor(vx), Math.floor(vz)), vz); scene.add(g);
    const tag = makeTag(VSHOPS[h.job].title); tag.position.y = 2.0; tag.scale.set(1.0, 0.25, 1); tag.visible = false; g.add(tag);
    villagers.push({ g, v, h, job: h.job, tag, tx: vx, tz: vz, wait: Math.random() * 3, t: Math.random() * 6 });
  });
  // the village keeps a few animals near its farm and plaza
  const fx = v.farm ? v.farm.x0 - 3 : v.cx + 8, fz = v.farm ? v.farm.z0 + 2 : v.cz + 8;
  spawnHerd("cow", fx, fz, 2, { vil: v }); spawnHerd("sheep", fx + 2, fz - 3, 2, { vil: v }); spawnHerd("chicken", v.cx + 7, v.cz - 7, 3, { vil: v }); spawnHerd("pig", v.cx - 8, v.cz + 7, 2, { vil: v });
}
function despawnVillagers(v) { farm = farm.filter(a => { if (a.vil && (!v || a.vil === v) && !a.kept) { scene.remove(a.g); return false; } return true; }); villagers = villagers.filter(n => { if (!v || n.v === v) { scene.remove(n.g); return false; } return true; }); if (v) v.spawned = false; else for (const vv of villageCache.values()) if (vv) vv.spawned = false; }
function nearestVillager(r) { let best = null, bd = r; for (const n of villagers) { const d = n.g.position.distanceTo(player.pos); if (d < bd) { bd = d; best = n; } } return best; }
function updateVillagers(dt) {
  if (DIM !== "overworld") { if (villagers.length) despawnVillagers(null); return; }
  villageScanT -= dt;
  if (villageScanT <= 0) {
    villageScanT = 1;
    const gx = Math.floor(player.pos.x / VCELL), gz = Math.floor(player.pos.z / VCELL);
    for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
      const v = villageInCell(gx + ax, gz + az); if (!v) continue;
      const d = Math.hypot(player.pos.x - v.cx, player.pos.z - v.cz);
      if (d < 70 && !v.spawned && generated.has(ck(Math.floor(v.cx / CH), Math.floor(v.cz / CH)))) spawnVillagers(v);
      else if (d > 130 && v.spawned) despawnVillagers(v);
      if (d < 30 && !v.found) { v.found = true; showBanner("You found a village"); achieve("village", "Village Visitor"); }
    }
  }
  for (const n of villagers) {
    n.t += dt; const p = n.g.position, dP = p.distanceTo(player.pos);
    n.tag.visible = dP < 6;
    if (dP < 3.5) { n.g.rotation.y = Math.atan2(player.pos.x - p.x, player.pos.z - p.z); continue; }   // stop and look at Thomas
    if (n.wait > 0) { n.wait -= dt; continue; }
    const dx = n.tx - p.x, dz = n.tz - p.z, dd = Math.hypot(dx, dz);
    if (dd < 0.3) {                                                  // alternate between the plaza and their own front door
      n.wait = 2 + Math.random() * 5;
      if (Math.random() < 0.5) { n.tx = n.h.out[0] + 0.5; n.tz = n.h.out[1] + 0.5; } else { n.tx = n.v.cx + 0.5 + (Math.random() - 0.5) * 8; n.tz = n.v.cz + 0.5 + (Math.random() - 0.5) * 8; if (Math.abs(n.tx - n.v.cx - 0.5) < 2.5 && Math.abs(n.tz - n.v.cz - 0.5) < 2.5) n.tx += 3; }
      continue;
    }
    const sp = Math.min(dd, 1.1 * dt); p.x += dx / dd * sp; p.z += dz / dd * sp;
    const gy = surfaceY(Math.floor(p.x), Math.floor(p.z)); p.y += (gy - p.y) * Math.min(1, dt * 10);
    n.g.rotation.y = Math.atan2(dx, dz); n.g.children[0].rotation.z = Math.sin(n.t * 8) * 0.04;
  }
}
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
