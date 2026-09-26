/* furnace.js: Furnace panel and timed smelting, then the rest of the panel UI (pause, boss bar, settings, key bindings).
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- FURNACES: an input, a fuel and a result slot per furnace, smelting in real time (even while Thomas is away) ----------
const SMELT_T = 4;                                                      // seconds per item
const SMELTS = { [IRON_ORE]: [I_IRON, 1], [GOLD_ORE]: [I_GOLD, 1], [SAND]: [GLASS, 1], [COBBLE]: [STONE, 1], [WOOD]: [I_COAL, 1], [HAY]: [I_BREAD, 2],
  [I_RAWBEEF]: [I_STEAK, 1], [I_RAWPORK]: [I_PORKCHOP, 1], [I_RAWMUTTON]: [I_MUTTON, 1], [I_RAWCHICKEN]: [I_CHICKEN, 1], [I_EGG]: [I_BREAD, 1] };
const FUELS = { [I_COAL]: 8, [I_LBUCKET]: 50, [WOOD]: 1.5, [PLANKS]: 1.5, [I_STICK]: 0.5, [CRAFT_TABLE]: 1.5, [CHEST]: 1.5, [FENCE]: 1.5, [GATE]: 1.5, [TALLGRASS]: 0.25, [HAY]: 2, [BIRCH_WOOD]: 1.5, [SPRUCE_WOOD]: 1.5 };  // in items smelted
const furnaceStore = new Map();
let openFurnaceK = null, furnaceTimer = null;
function furnaceKey(x, y, z) { return DIM + ":" + bk(x, y, z); }
function furnaceAt(key) { let F = furnaceStore.get(key); if (!F) { F = { in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0, t: Date.now() }; furnaceStore.set(key, F); } return F; }
function furnaceCanSmelt(F) {
  if (!F.in || !SMELTS[F.in.id]) return false;
  const [oid, on] = SMELTS[F.in.id]; if (!F.out) return true;
  return F.out.id === oid && F.out.count + on <= stackMax(oid);
}
// advance a furnace by the real time since it was last looked at (capped at an hour)
function tickFurnace(F, now) {
  let el = Math.min(3600, Math.max(0, ((now || Date.now()) - F.t) / 1000)); F.t = now || Date.now();
  let guard = 0;
  while (el > 1e-6 && guard++ < 2000) {
    if (!furnaceCanSmelt(F)) { F.prog = 0; F.burn = Math.max(0, F.burn - el); break; }
    if (F.burn <= 0) {                                                  // light the next piece of fuel
      if (!F.fuel || !FUELS[F.fuel.id]) break;
      F.burnMax = F.burn = FUELS[F.fuel.id] * SMELT_T;
      if (F.fuel.id === I_LBUCKET) F.fuel = newStack(I_BUCKET, 1); else { F.fuel.count--; if (F.fuel.count <= 0) F.fuel = null; }
    }
    const step = Math.min(el, F.burn, (1 - F.prog) * SMELT_T);
    F.prog += step / SMELT_T; F.burn -= step; el -= step;
    if (F.prog >= 1 - 1e-6) {
      const [oid, on] = SMELTS[F.in.id]; F.prog = 0;
      F.in.count--; if (F.in.count <= 0) F.in = null;
      if (F.out) F.out.count += on; else F.out = newStack(oid, on);
    }
  }
  return F;
}
function openFurnace(key) {
  openFurnaceK = key; tickFurnace(furnaceAt(key)); renderFurnace(); show("furnace"); document.exitPointerLock(); SFX.smelt();
  if (furnaceTimer) clearInterval(furnaceTimer);
  furnaceTimer = setInterval(() => { if (!openFurnaceK || $("furnace").classList.contains("hidden")) { clearInterval(furnaceTimer); furnaceTimer = null; return; } tickFurnace(furnaceAt(openFurnaceK)); renderFurnace(true); }, 250);
}
function closeFurnace() { hide("furnace"); openFurnaceK = null; if (furnaceTimer) { clearInterval(furnaceTimer); furnaceTimer = null; } if (!isTouch && running) canvas.requestPointerLock(); }
// move a stack from the bag into a furnace slot (smeltables to the input, fuel to the fuel slot)
function furnacePut(F, arr, i) {
  const s = arr[i]; if (!s) return;
  const slot = SMELTS[s.id] && (!F.in || F.in.id === s.id) ? "in" : FUELS[s.id] && (!F.fuel || F.fuel.id === s.id) ? "fuel" : null;
  if (!slot) { toast(SMELTS[s.id] || FUELS[s.id] ? "That slot is taken" : itemName(s.id) + " cannot go in a furnace"); return; }
  const cur = F[slot], room = cur ? stackMax(s.id) - cur.count : stackMax(s.id), n = Math.min(room, s.count); if (n <= 0) return;
  if (cur) cur.count += n; else F[slot] = newStack(s.id, n, s.dur);
  s.count -= n; if (s.count <= 0) arr[i] = null;
  F.t = Date.now(); SFX.place();
}
function furnaceTake(F, slot) { const s = F[slot]; if (!s) return; const left = giveItems(s.id, s.count, s.dur); if (left < s.count) { SFX.pickup(); if (slot === "out") onCraft(s.id); } F[slot] = left > 0 ? newStack(s.id, left, s.dur) : null; }
function renderFurnace(live) {
  const F = furnaceAt(openFurnaceK);
  const fill = (id, slot) => { const el = $(id); if (!el) return; el.innerHTML = ""; fillCell(el, F[slot]); el.onpointerdown = e => { e.preventDefault(); furnaceTake(F, slot); renderFurnace(); renderHotbar(); }; };
  fill("fIn", "in"); fill("fFuel", "fuel"); fill("fOut", "out");
  const fl = $("fFlame"), pr = $("fProg");
  if (fl) fl.style.height = (F.burnMax > 0 ? Math.max(0, F.burn / F.burnMax) * 100 : 0).toFixed(0) + "%";
  if (pr) pr.style.width = (F.prog * 100).toFixed(0) + "%";
  if (live) return;
  const ig = $("furnaceInv"); if (!ig) return; ig.innerHTML = "";
  for (const arr of [hotbar, bag]) for (let i = 0; i < arr.length; i++) {
    const s = arr[i], c = cellEl(s, () => { furnacePut(F, arr, i); renderFurnace(); renderHotbar(); buildViewItem(); });
    if (s && !SMELTS[s.id] && !FUELS[s.id]) c.classList.add("dim"); ig.appendChild(c);
  }
}
// breaking a furnace spills whatever it holds
function spillFurnace(key, x, y, z) { const F = furnaceStore.get(key); if (!F) return; tickFurnace(F); for (const s of [F.in, F.fuel, F.out]) if (s) dropItemAt(x + 0.5, y + 0.6, z + 0.5, s.id, s.count); furnaceStore.delete(key); }
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
{ const b1 = $("cgCraft"), b2 = $("cgClear"), fl = $("craftFilter");
  if (b1) b1.addEventListener("click", craftFromGrid);
  if (b2) b2.addEventListener("click", () => { cgrid.fill(0); cgSel = 0; renderCraft(); });
  if (fl) fl.addEventListener("input", () => { cgFilter = fl.value || ""; renderCraft(); }); }
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
