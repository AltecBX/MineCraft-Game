/* save.js: Save and load.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

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
      qi: qi, ach: [...ach], day: day, timeOfDay: timeOfDay, hotbar: hotbar, bag: bag, coins: coins,
      side: [...sideDone],
      cats: cats.filter(c => c.tamed).map(c => ({ x: Math.round(c.g.position.x), z: Math.round(c.g.position.z), color: c.color, level: c.level, mode: c.mode })),
      edits: { overworld: [...editsByDim.overworld], fire: [...editsByDim.fire], end: [...editsByDim.end], sky: [...editsByDim.sky], realm: [...editsByDim.realm], mario: [...editsByDim.mario] },
      cteam: cteam, cstorage: cstorage, cdex: [...cdex], cbadges: [...cbadges], citems: citems, realmWins: realmWins, realmBossDown: realmBossDown, fredaFound: fredaFound, dexRewarded: dexRewarded, marioQ: marioQ,
      chests: [...chestStore], known: [...knownItems], furnaces: [...furnaceStore].map(([k, F]) => [k, tickFurnace(F)]), flows: Object.fromEntries(Object.entries(flowEditsByDim).map(([d, m]) => [d, [...m]])), farm: DIM === "overworld" ? serializeFarm() : farmStash };
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
  for (let i = 0; i < 27; i++) bag[i] = (data.bag && data.bag[i]) ? data.bag[i] : null;
  editsByDim.overworld = new Map((data.edits && data.edits.overworld) || []);
  editsByDim.fire = new Map((data.edits && data.edits.fire) || []);
  editsByDim.end = new Map((data.edits && data.edits.end) || []);
  editsByDim.sky = new Map((data.edits && data.edits.sky) || []);
  editsByDim.realm = new Map((data.edits && data.edits.realm) || []);
  editsByDim.mario = new Map((data.edits && data.edits.mario) || []);
  for (const d of Object.keys(flowEditsByDim)) flowEditsByDim[d] = new Map((data.flows && data.flows[d]) || []);
  cteam = data.cteam || []; cstorage = data.cstorage || []; cdex = new Set(data.cdex || []); cbadges = new Set(data.cbadges || []);
  Object.assign(citems, data.citems || {}); realmWins = data.realmWins || 0; realmBossDown = data.realmBossDown || {}; fredaFound = data.fredaFound || 0; dexRewarded = data.dexRewarded || 0; if (data.marioQ) Object.assign(marioQ, data.marioQ);
  chestStore = new Map(data.chests || []);
  furnaceStore.clear(); for (const [k, F] of (data.furnaces || [])) furnaceStore.set(k, F);
  knownItems.clear(); for (const id of (data.known || [])) knownItems.add(id);
  running = true; paused = false; wasNight = false; raidShown = false; dodge.t = 0; dodge.cd = 0; openChestK = null;
  story.active = false; clearObjective(); endCine();
  eventCd = 180; activeEvent = null; xpMult = 1; setEventTint(null); treasureKey = null;
  applyGfx();
  resetFarm(); farmStash = Array.isArray(data.farm) ? data.farm : [];
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
{ const b = $("closeFurnaceBtn"); if (b) b.addEventListener("click", closeFurnace); }
$("closeShopBtn").addEventListener("click", (...a) => closeShop(...a));
