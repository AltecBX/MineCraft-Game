/* hud.js: Minimap, game start, death, entity shadows.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
  if (DIM === "realm") {                               // colourful Creature-valley map with relief shading
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = cx + (i - N / 2) * step, wz = cz + (j - N / 2) * step, n = vn(wx * 0.06 + 5, wz * 0.06 + 5);
      let col;
      if (n < 0.33) col = [60, 150, 210]; else if (n < 0.4) col = [224, 210, 150]; else if (n > 0.72) col = [40, 120, 46]; else col = [96, 188, 98];
      const sh = 0.72 + n * 0.55;                      // higher ground reads brighter, giving the map a 3D relief look
      mmx.fillStyle = "rgb(" + Math.min(255, col[0] * sh | 0) + "," + Math.min(255, col[1] * sh | 0) + "," + Math.min(255, col[2] * sh | 0) + ")"; mmx.fillRect(i * px, j * px, px + 1.2, px + 1.2);
    }
  } else if (DIM === "mario") {                        // bright kingdom map with relief shading
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = cx + (i - N / 2) * step, wz = cz + (j - N / 2) * step, n = vn(wx * 0.05 + 80, wz * 0.05 + 80);
      let col; if (n < 0.3) col = [80, 170, 235]; else if (n > 0.78) col = [200, 120, 70]; else col = [110, 200, 96];
      const sh = 0.72 + n * 0.55;
      mmx.fillStyle = "rgb(" + Math.min(255, col[0] * sh | 0) + "," + Math.min(255, col[1] * sh | 0) + "," + Math.min(255, col[2] * sh | 0) + ")"; mmx.fillRect(i * px, j * px, px + 1.2, px + 1.2);
    }
    for (const n of marioNPCs) mmDot(W, span, cx, cz, n.g.position.x, n.g.position.z, "#ffe066", 3);
    for (const f of marioFoes) mmDot(W, span, cx, cz, f.g.position.x, f.g.position.z, f.kind === "boss" ? "#ff2a2a" : "#ff7a5a", f.kind === "boss" ? 5 : 3);
    let ci = 0; for (const c of marioCoins) { if (ci++ > 30) break; mmDot(W, span, cx, cz, c.mesh.position.x, c.mesh.position.z, "#ffd83d", 1.6); }
  } else if (DIM !== "overworld") { mmx.fillStyle = DIM === "fire" ? "#3a0d0d" : DIM === "sky" ? "#5aa0e0" : "#0c0c14"; mmx.fillRect(0, 0, W, W); }
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
  if (DIM === "overworld") for (const a of farm) if (!a.dead) mmDot(W, span, cx, cz, a.g.position.x, a.g.position.z, a.kept ? "#ffd9a0" : "#c8b28a", a.age >= 0 ? 1.6 : 2.2);
  if (DIM === "overworld") for (const n of villagers) mmDot(W, span, cx, cz, n.g.position.x, n.g.position.z, "#f3c27a", 2.6);
  if (typeof objMarker !== "undefined" && objMarker && objMarker.visible) mmDot(W, span, cx, cz, objMarker.position.x, objMarker.position.z, "#fff14a", 4);
  if (DIM === "realm") {                               // realm icons: wild creatures, bosses, NPCs (healers/shops/trainers), Snorlax, Pikachu
    if (typeof realmCreatures !== "undefined") for (const c of realmCreatures) mmDot(W, span, cx, cz, c.g.position.x, c.g.position.z, (c.sp.legend || c.shiny) ? "#ffd24a" : "#9be86b", 2.5);
    if (typeof realmBosses !== "undefined") for (const b of realmBosses) mmDot(W, span, cx, cz, b.g.position.x, b.g.position.z, b.final ? "#ffd24a" : "#ff5a5a", 4.5);
    if (typeof realmNPCs !== "undefined") for (const n of realmNPCs) mmDot(W, span, cx, cz, n.g.position.x, n.g.position.z, n.kind === "nurse" ? "#ff8ad6" : n.kind === "shop" ? "#ffe066" : "#7af0ff", 3.5);
    if (typeof realmSnoozer !== "undefined" && realmSnoozer) mmDot(W, span, cx, cz, realmSnoozer.g.position.x, realmSnoozer.g.position.z, "#cdb88a", 4.5);
    if (typeof companion !== "undefined" && companion) mmDot(W, span, cx, cz, companion.g.position.x, companion.g.position.z, "#ffe14d", 3.2);
  }
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
  for (let i = 0; i < 27; i++) bag[i] = null;
  hotbar[0] = { id: I_WPICK, count: 1 }; hotbar[1] = { id: I_SWORD, count: 1 }; hotbar[2] = { id: DIRT, count: 20 }; hotbar[3] = { id: I_APPLE, count: 3 };
  selSlot = 0;
  applyGfx();
  resetFarm(); cgrid.fill(0);
  loadDimension("overworld");
  setQuest(quests[0].text); qi = 0; kills = 0; minedStone = 0; survivedNight = false; tamedCat = false; craftedPick = false; craftedPlanks = false; fireBossDown = false;
  xp = 0; level = 1; xpNext = 50; placedBlocks = 0; movedDist = 0; tameCount = 0; ach.clear(); loadAch(); dodge.t = 0; dodge.cd = 0; wasNight = false; raidShown = false; updateXPUI(); renderSkills();
  editsByDim.overworld = new Map(); editsByDim.fire = new Map(); editsByDim.end = new Map(); editsByDim.sky = new Map(); editsByDim.realm = new Map(); editsByDim.mario = new Map(); for (const d of Object.keys(flowEditsByDim)) flowEditsByDim[d] = new Map(); marioQ = { coinsGot: 0, toad: false, stomps: 0, dk: false, bowser: false, hidden: false }; chestStore = new Map(); furnaceStore.clear(); knownItems.clear(); openChestK = null; day = 1; timeOfDay = 0.28;
  cteam = []; cstorage = []; cdex = new Set(); cbadges = new Set(); battle = null; cmenuOpen = false; citems.potion = citems.capture = citems.food = 0; realmWins = 0; realmBossDown = {};
  clearObjective(); story.active = false;
  eventCd = 180; activeEvent = null; xpMult = 1; setEventTint(null);
  coins = 0; updateCoinUI(); spawnMerchant(7, 5); treasureKey = null;   // a friendly trader near camp
  initDaily();
  if (ngLevel > 0) setTimeout(() => toast("New Game Plus " + ngLevel + ". Monsters are tougher, rewards are bigger."), 900);
  setTimeout(() => { if (daily && !daily.claimed) toast("Daily Challenge: " + daily.text + ". Open the Journal to track it."); }, 1600);
  const camp = buildSpawnCamp(); startStory(camp);
  { const wx = camp.chestX - 7, wz = camp.chestZ - 3;                      // wake a few steps from the fire, on the glade floor (not on an old canopy)
    player.pos.set(wx + 0.5, surfaceY(wx, wz), wz + 0.5); player.vel.set(0, 0, 0); player.spawn.copy(player.pos); }
  spawnHerd("cow", -13, 12, 3); spawnHerd("sheep", 15, -12, 3); spawnHerd("chicken", 14, 13, 3);   // a few animals graze near camp            // opening cinematic + guided first 5 minutes
  player.yaw = Math.atan2(-(camp.chestX - 1 - player.pos.x), -(camp.chestZ - player.pos.z)); player.pitch = -0.4;   // wake up facing the campfire
  renderHotbar(); updateVitals(); buildViewItem();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (!isTouch) canvas.requestPointerLock();
}
// panels that open during play; while any is open the world freezes so you cannot be killed in a menu
const GAME_PANELS = ["furnace", "inv", "skills", "journal", "chest", "shop", "ach", "collections", "trophies", "catwardrobe", "skinpicker", "settings", "cmenu", "battle", "cshop", "cteamui", "cdexui", "badgecase"];
function anyPanelOpen() { for (const id of GAME_PANELS) { const e = document.getElementById(id); if (e && !e.classList.contains("hidden")) return true; } return false; }
function hideAllPanels() { for (const id of GAME_PANELS) { const e = document.getElementById(id); if (e) e.classList.add("hidden"); } }
let deathT = 0;
function die() {
  if (!running) return;
  running = false; paused = false; charView = false; clearInputState(); hideAllPanels();
  document.exitPointerLock(); hide("touch"); $("hud").classList.add("hidden");
  deathT = performance.now(); show("death");
}

// every solid entity mesh casts and receives real sun shadows when shadow maps are on
let shadowTagT = 0;
function tagEntityShadows() {
  const on = renderer.shadowMap.enabled;
  for (const o of scene.children) {
    if (o.userData.noShadowTag || o === skyGroup) continue;
    o.traverse(m => {
      if (!m.isMesh || m.userData.noShadowTag || m.isInstancedMesh) return;
      const mt = m.material, solid = mt && !Array.isArray(mt) ? !mt.transparent && mt.visible !== false : true;
      m.castShadow = on && solid; m.receiveShadow = on;
      if (solid && mt && mt.isMeshLambertMaterial && !mt.map && !mt.userData.detailed) { mt.map = detailMap("fur"); mt.userData.detailed = 1; mt.needsUpdate = true; }   // subtle fur and cloth grain on flat coloured models
    });
  }
}
