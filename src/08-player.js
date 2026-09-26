/* player.js: Player state, skins, collections, trophies, physics.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
  if (DIM === "mario" && !player.onGround && !player._pound) { player._pound = true; player.vel.y = -26; SFX.slam(); return; }   // ground pound: slam straight down
  if (dodge.cd > 0 || player.stam < 18 || !player.onGround) return;
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), r = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const w = new THREE.Vector3();
  if (keys["KeyW"]) w.add(f); if (keys["KeyS"]) w.sub(f); if (keys["KeyD"]) w.add(r); if (keys["KeyA"]) w.sub(r);
  if (touch.mag > 0.05) { w.add(f.clone().multiplyScalar(input.fwd)); w.add(r.clone().multiplyScalar(input.str)); }
  if (w.lengthSq() < 0.001) w.copy(f);
  w.normalize(); dodge.x = w.x; dodge.z = w.z; dodge.t = 0.2; dodge.cd = 0.85; dodge.iframe = 0.35; dodge.saved = false;
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
  { id: "archer", label: "Sharpshooter", desc: "Defeat a monster with a bow and arrow", test: () => ach.has("archer") },
  { id: "rancher", label: "Rancher", desc: "Breed two farm animals", test: () => ach.has("rancher") },
  { id: "shepherd", label: "Shepherd", desc: "Shear a sheep", test: () => ach.has("shepherd") },
  { id: "tablemade", label: "Carpenter", desc: "Craft a Crafting Table", test: () => ach.has("tablemade") },
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
  const yb = Math.floor(py - 0.5);                                       // the upper half block of a fence below the feet
  if (yb !== y0 && py < yb + 1.5) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (isTall(getBlock(x, yb, z))) return true;
  return false;
}
function tallBelow(px, py, pz) { const yb = Math.floor(py - 0.5); if (py - yb >= 1.5) return -1; for (let x = Math.floor(px - HW); x <= Math.floor(px + HW); x++) for (let z = Math.floor(pz - HW); z <= Math.floor(pz + HW); z++) if (isTall(getBlock(x, yb, z))) return yb + 1.5; return -1; }
function moveAxis(axis, d) {
  const p = player.pos; p[axis] += d;
  if (!aabbHit(p.x, p.y, p.z)) return false;
  if (axis === "x") { p.x = d > 0 ? Math.floor(p.x + HW) - HW - 0.001 : Math.floor(p.x - HW) + 1 + HW + 0.001; player.vel.x = 0; }
  else if (axis === "z") { p.z = d > 0 ? Math.floor(p.z + HW) - HW - 0.001 : Math.floor(p.z - HW) + 1 + HW + 0.001; player.vel.z = 0; }
  else { if (d > 0) { p.y = Math.floor(p.y + PH) - PH - 0.001; player.vel.y = 0; } else { const tb = tallBelow(p.x, p.y, p.z); p.y = tb > p.y ? tb : Math.floor(p.y) + 1; player.vel.y = 0; player.onGround = true; } }
  return true;
}
function physics(dt) {
  // gather wish dir
  dodge.cd = Math.max(0, dodge.cd - dt); if (dodge.iframe > 0) dodge.iframe -= dt;
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
  if (bowDraw > 0 || blocking) sprint = false;                       // no sprinting with a drawn bow or a raised shield
  if (blocking) { const t = currentTool(); if (!t || t.tool !== "shield") blocking = false; }
  let sp = sprint ? 6.0 : 4.2; if (powerActive("speed")) sp *= 1.5; sp *= swiftMult; if (crouch) sp = 2.0; if (bowDraw > 0) sp *= 0.45; if (blocking) sp *= 0.5;
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
  { const fv = flowVec(player.pos.x, player.pos.y + 0.2, player.pos.z); if (fv.x || fv.z) { player.vel.x += fv.x * 2.2; player.vel.z += fv.z * 2.2; } }   // currents carry Thomas along
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
  const targetFov = ((sprint ? settings.fov + 6 : settings.fov) + (thirdPerson ? 5 : 0)) * (1 - 0.15 * bowPower());   // drawing a bow zooms in
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
  positionSunShadow();
  if (player.hurtCd > 0) player.hurtCd -= dt;
}
function damage(n) {
  if (!running) return;
  if (player.hurtCd > 0 && n < 1) return;
  if (powerActive("shield") && n >= 1) { hurtFlash(); player.hurtCd = 0.3; return; }   // Shield Bubble absorbs hits
  if (n >= 1 && (dodge.t > 0 || dodge.iframe > 0)) { if (!dodge.saved) { dodge.saved = true; SFX.dodge(); toast("Dodged!"); } return; }   // dodge rolls grant brief invulnerability
  if (n >= 1 && blocking) { const t = currentTool(); if (t && t.tool === "shield") { SFX.shieldHit(); wearTool(Math.max(1, Math.round(n))); addShake(0.08); n *= 0.2; swing = 0.3; } }   // a raised shield soaks most of a hit
  n *= (1 - armorReduce);                                                               // Armor skill reduces damage
  { const a = bestArmor(); if (a) n *= 1 - ITEMS[a].armor; }                            // worn armor (best piece carried)
  player.hp -= n; if (n >= 1) { player.hurtCd = 0.6; hurtFlash(); SFX.hurt(); if (n >= 4) addShake(0.22); }
  if (player.hp <= 0) die();
  updateVitals();
}
