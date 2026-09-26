/* main.js: Main loop, boot, dev hooks.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- MAIN LOOP ----------
let last = performance.now(); let hungerT = 0, heatT = 0, droneT = 3;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); let dt = (now - last) / 1000; last = now; const rawDt = dt; if (dt > 0.05) dt = 0.05; lastDt = dt;
  if (charView) {                                              // character screen: orbit-free spin of Thomas
    charAngle += dt * 0.7;
    const u = thomas.userData; thomas.visible = true; thomas.position.set(player.pos.x, player.pos.y, player.pos.z); thomas.rotation.y = charAngle;
    u.legL.rotation.x = 0; u.legR.rotation.x = 0; u.armL.rotation.x = 0; u.armR.rotation.x = 0; thomas.scale.set(1, 1, 1);
    camera.position.set(player.pos.x, player.pos.y + 1.25, player.pos.z + 3.0); camera.rotation.set(0, 0, 0);
    if (camera.lookAt) camera.lookAt(player.pos.x, player.pos.y + 1.0, player.pos.z);
    renderFrame(false); return;
  }
  if (running && !paused && !anyPanelOpen()) {
    if (attackCd > 0) attackCd -= dt; if (harvestHintCd > 0) harvestHintCd -= dt; if (portalCd > 0) portalCd -= dt; if (hammerCd > 0) hammerCd -= dt; if (bowCd > 0) bowCd -= dt;
    physics(dt);
    tagMonsters();
    updateMining(dt);
    updateMonsters(dt);
    updateAnimals(dt);
    updateFarm(dt);
    updateGroundItems(dt);
    updateVillagers(dt);
    updateFredaReactions(dt);
    if (DIM === "realm") updateRealm(dt);
    if (DIM === "mario") updateMario(dt);
    updateFireBoss(dt);
    updateSkyBoss(dt);
    updateProjectiles(dt);
    updatePlayerShots(dt);
    updateArrows(dt);
    updateFluids(dt);
    updateDragon(dt);
    updateFx(dt);
    if (charMixers.length) for (const mX of charMixers) mX.update(dt);   // play animation clips on supplied character models
    updateTelegraphs(dt);
    updateViewItem(dt);
    updateDayNight(dt);
    updateEnv(dt);
    updateSky(dt);
    updateAmbient(dt);
    updateWeather(dt);
    updateAmbientLife(dt);
    mmT -= dt; if (mmT <= 0) { mmT = 0.2; drawMinimap(); }
    shadowTagT -= dt; if (shadowTagT <= 0) { shadowTagT = 0.75; tagEntityShadows(); }
    updateDynRes(rawDt);
    loadChunks();
    checkPortal();
    // selection box
    const r = voxelRaycast(5);
    if (r && BLOCKS[r.id] && BLOCKS[r.id].hard > 0) { selBox.position.set(r.x + 0.5, r.y + 0.5, r.z + 0.5); selBox.visible = true; } else selBox.visible = false;
    $("crosshair").classList.toggle("target", !!aimEntity());
    // portal glow pulse
    torchGlowMat.opacity = 0.55 + Math.sin(now * 0.011) * 0.06 + Math.sin(now * 0.027) * 0.05;
    // hunger drain + regen
    hungerT += dt; if (hungerT > 4) { hungerT = 0; if (player.food > 0) { if (Math.random() < 0.5) player.food = Math.max(0, player.food - 1); } else damage(1); if (player.food > 16 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 1); updateVitals(); }
    if (DIM === "fire") { heatT += dt; if (heatT > 2.5) { heatT = 0; if (countItem(I_FIRECHARM) === 0) { damage(1); if (Math.random() < 0.5) toast("The heat is searing. You need a Flame Charm."); } } }
    if (DIM === "end") { droneT -= dt; if (droneT <= 0) { droneT = 5 + Math.random() * 4; if (typeof blip === "function") blip(58, 0.7, "sine", 0.05, 44); } }
    // night raid event: monsters assault the base; survive and protect the cats for a reward
    if (isNight()) { wasNight = true; if (!raidShown) { raidShown = true; showBanner("Night Raid! Defend Thomas and the cats."); } }
    else { raidShown = false; if (wasNight) { if (!survivedNight) { survivedNight = true; achieve("night", "First Night Survived"); } const safe = cats.filter(c => c.tamed).length; const rew = 8 + safe * 6; addCoins(rew); addXP(15 + safe * 5); showBanner("Raid survived! +" + rew + " coins. Cats safe: " + safe); toast("You protected " + safe + " cat" + (safe === 1 ? "" : "s") + "."); achieve("raid", "Raid Defender"); wasNight = false; } }
    updateStory(dt);
    updateFredaPing(dt);
    updatePowerups(dt);
    updateBlockPowers(dt);
    updateEvents(dt);
    updateQuests();
    checkAchievements();
    updateMusic(dt);
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").style.opacity = "0"; }
  }
  renderFrame(!thirdPerson);
  if (settings.showFps) { fpsAcc += (1 / Math.max(0.001, dt) - fpsAcc) * 0.1; const e = $("fps"); if (e) e.textContent = Math.round(fpsAcc) + " fps"; }
}
let fpsAcc = 60;
let wasNight = false, raidShown = false;
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vCam.aspect = innerWidth / innerHeight; vCam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
addEventListener("orientationchange", () => setTimeout(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }, 250));
scene.background = new THREE.Color(0x9fd2ff);
loadAch();
loadColl();
loadSkin();
loadCatCosmetic();
loadNG();
initDaily();
loadSettings();
syncSettingsUI();
applyGfx();
refreshContinue();
loop();

/* ===========================================================================
   STAGE 8 (audio + accessibility polish) DONE: separate SFX and Music volume
   sliders with master gain nodes, a Mute all toggle (M key) that silences both
   instantly, all persisted. Colorblind safe enemy labels (text tag above each
   monster naming its type, plus + for elites), toggleable and applied live.
   Reduce motion option that cuts screen shake and softens the hit flash for
   motion and photosensitivity. Key rebinding for the discrete action keys
   (interact, dodge, camera, inventory, skills, cat command, journal) with a
   click then press a key flow, a reset to default, and persistence. Movement
   (WASD and arrows) and jump (Space) stay fixed by design. Prior stages kept.

   Recommended next: migrate this single 150K file to Claude Code, split into
   modules (world, entities, audio, ui, save), add a texture atlas there.

   TODO (foundations in place, deeper work deferred per staged plan):
   - World: surface cave mouths, rivers, villages/dungeons, biome-specific mobs and weather.
   - Render: texture atlas + FrontSide winding, real lava/portal emissive lighting, smooth chunk LOD.
   - Survival: done (shield, dodge invulnerability, fences and gates, buckets, flowing fluids).
   - Crafting: done (grid, recipe discovery, furnace with fuel).
   - Progression: real skill tree UI + skill points (mining speed perk is the first hook), armor, durability.
   - Enemies: spitter (ranged), ghost (phasing), miner, screamer, portal guard, real A* path + jumping, dungeon mini bosses.
   - Animals: cat command wheel (follow/stay/guard/attack/search), cat leveling, loot finding, more cat types, mice stealing food.
   - Fire dim: lava rivers detail, burning trees, ash particles, rare fire blocks, multi-phase fire boss.
   - End: floating islands, end crystal beams healing dragon, full 5-phase dragon (fire breath, tail swipe, ground slam, summon, rage).
   - Audio: background music; Settings persistence via localStorage when hosted.
=========================================================================== */
// tiny dev hook so automated visual tests can start the game and jump between stages
if (typeof window !== "undefined") window.DEV = { start: startGame, go: loadDimension,
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
  time(t) { timeOfDay = t; },
  tp(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
  gfx(level) { settings.gfx = level; applyGfx(); },
  third(on) { thirdPerson = !!on; },
  nocine() { story.active = false; endCine(); },
  crack(x, y, z, f) { updateCrack(f > 0 ? { x, y, z } : null, f); },
  weather(kind, wet) { if (kind === "snow") { kind = "rain"; weather.snow = 1; } weather.kind = kind; weather.next = 999; weather.amt = kind === "clear" ? 0 : kind === "rain" ? 0.72 : 1; if (wet != null) weather.wet = wet; },
  place(x, y, z, id) { setRaw(x, y, z, id); markDirty(x, z); markDirty(x + 1, z); markDirty(x - 1, z); markDirty(x, z + 1); markDirty(x, z - 1); if (id === TORCH || id === AIR) rebuildTorchCells(); },
  slot(i, id) { if (id != null) hotbar[i] = { id, count: 10 }; selSlot = i; renderHotbar(); buildViewItem(); },
  ids() { return { STONE, COBBLE, TORCH, WOOD, PLANKS, BRICK, LAVA, WATER, AIR, GRASS, LEAVES, SAND, CRYSTAL, FIRE_CRYSTAL }; },
  stats() { let op = 0, cu = 0, wa = 0, wc = 0; for (const c of chunks.values()) { if (c.opaque) op += c.opaque.geometry.attributes.position.count; if (c.cutout) cu += c.cutout.geometry.attributes.position.count; if (c.water) { wa += c.water.geometry.attributes.position.count; wc++; } }
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z); let wb = 0; for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) if (getBlock(px + dx, SEA, pz + dz) === WATER) wb++;
    return { chunks: chunks.size, op, cu, wa, wc, waterBlocksNear: wb, shadows: renderer.shadowMap.enabled, sunCast: sun.castShadow, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, progs: renderer.info.programs ? renderer.info.programs.length : 0 }; },
  surf(x, z) { ensureGen(x, z, 2); return surfaceY(x, z); },
  give(id, n) { addItem(id, n || 1); },
  mob(type, x, z, yaw) { spawnMonster(x, z, type); const m = monsters[monsters.length - 1]; m.g.rotation.y = yaw || 0; m.speed = 0; m.aggro = false; m.dir = yaw || 0; return m.hp; },
  herd(type, x, z, n) { ensureGen(x, z, 1); return spawnHerd(type, x, z, n || 3).length; },
  animal(type, x, y, z, opts) { const a = spawnFarmAnimal(type, x, z, Object.assign({ y }, opts || {})); if (a && opts && opts.yaw != null) a.g.rotation.y = opts.yaw; if (a && opts && opts.freeze) a.frozen = 1; return !!a; },
  draw(sec) { primaryHeld = sec > 0; bowDraw = sec; },
  shoot(x, y, z, dx, dy, dz, sp) { spawnArrow(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, dy, dz), sp || 30, 5, "player", false, true); },
  grid(ids) { for (let i = 0; i < 9; i++) cgrid[i] = ids[i] || 0; renderCraft(); },
  fluid(x, y, z, id) { fluidSet(x, y, z, id, 0); },
  settle(sec) { for (let t = 0; t < sec; t += 0.05) updateFluids(0.05); },
  furnace(x, y, z) { openFurnace(furnaceKey(x, y, z)); },
  items() { return { FENCE, GATE, OBSIDIAN, I_BUCKET, I_WBUCKET, I_LBUCKET, I_MILK, I_SHIELD, IRON_ORE, I_COAL, I_IRON, I_BOW, I_ARROW, I_SHEARS, I_STEAK, I_RAWBEEF, I_EGG, I_FEATHER, I_FLINT, I_STRING, I_PIE, I_LEATHER, I_STICK, PLANKS, CRAFT_TABLE, WOOL, TALLGRASS, WOOD, COBBLE }; },
  state() { return { x: player.pos.x, y: player.pos.y, z: player.pos.z, dim: DIM, t: timeOfDay }; } };
