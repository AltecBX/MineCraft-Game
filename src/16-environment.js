/* environment.js: Use key interactions, day and night, sky and light environment.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- INTERACT (use) ----------
function interact() {
  // creature realm: talk to the nearest NPC (Nurse, Shop, Trainer, Badge Master)
  if (DIM === "realm" && realmInteract()) return;
  if (DIM === "mario" && marioInteract()) return;
  // open a chest if aiming at one
  const look = voxelRaycast(4);
  if (look && look.id === CHEST) { openChest(chestKey(look.x, look.y, look.z)); return; }
  if (look && BLOCKS[look.id] && BLOCKS[look.id].gate) { toggleGate(look.x, look.y, look.z); return; }
  // use a crafting table: opens the bag with the full 3 x 3 grid
  if (look && look.id === FURNACE) { openFurnace(furnaceKey(look.x, look.y, look.z)); return; }
  if (look && look.id === CRAFT_TABLE) { if ($("inv").classList.contains("hidden")) toggleInv(); return; }
  // sleep in a bed to skip the night
  if (look && look.id === BED) {
    player.spawn.set(look.x + 0.5, look.y + 1, look.z + 0.5);
    if (isNight()) { timeOfDay = 0.28; survivedNight = true; player.hp = Math.min(player.maxHp, player.hp + 6); updateVitals(); toast("You slept. A new day begins."); SFX.levelUp(); }
    else toast("You can only sleep at night. Respawn point set.");
    return;
  }
  // eat food if selected
  const it = hotbar[selSlot];
  if (it && isItem(it.id) && ITEMS[it.id].food) { const F = ITEMS[it.id]; if (player.food < 20 || (F.heal && player.hp < player.maxHp)) { player.food = Math.min(20, player.food + F.food); if (F.heal) { player.hp = Math.min(player.maxHp, player.hp + F.heal); SFX.power(); } removeItem(selSlot, 1); if (F.returns && !hotbar[selSlot]) { hotbar[selSlot] = newStack(F.returns, 1); renderHotbar(); buildViewItem(); } updateVitals(); if (F.raw && Math.random() < F.raw) { player.food = Math.max(0, player.food - 4); damage(2); toast("That " + F.name.toLowerCase() + " made you sick. Cook it at a Furnace."); } else toast("Ate " + F.name); } return; }
  // shear, feed or breed a farm animal
  { const an = nearestAnimal(3.2); if (an && animalInteract(an)) return; }
  // open the merchant shop when standing next to it
  { const nv = nearestVillager(3); if (nv) { openShop(VSHOPS[nv.job].list, VSHOPS[nv.job].title); return; } }
  if (merchant && merchant.g.position.distanceTo(player.pos) < 3) { openShop(); return; }
  // open the nearest chest within reach even if not perfectly aimed (mobile friendly)
  { let bc = null, bd = 3.2; for (let oy = -1; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) { const cxn = Math.floor(player.pos.x) + ox, cyn = Math.floor(player.pos.y) + oy, czn = Math.floor(player.pos.z) + oz; if (getBlock(cxn, cyn, czn) === CHEST) { const d = Math.hypot(cxn + 0.5 - player.pos.x, czn + 0.5 - player.pos.z); if (d < bd) { bd = d; bc = [cxn, cyn, czn]; } } } if (bc) { openChest(chestKey(bc[0], bc[1], bc[2])); return; } }
  // tame nearby cat by feeding apple
  let near = null, nd = 3; for (const c of cats) { const d = c.g.position.distanceTo(player.pos); if (d < nd) { nd = d; near = c; } }
  if (near && !near.tamed) {
    if (near.friendly || countItem(I_APPLE) > 0) {
      if (!near.friendly) consumeItem(I_APPLE, 1);
      near.tamed = true; near.friendly = false; near.mode = "follow"; SFX.meow(); discoverCat(near.color); applyCatCosmetic(near);
      const who = near.name ? near.name : ("The " + near.color + " cat");
      toast(who + " joined you and " + catAbilityDesc(near.ability) + ".");
      if (near.name) { showBanner(near.name + " joined Thomas!"); questComplete("New Companion. " + near.name); }
      onTame();
    } else toast("Need an Apple to tame the cat (you start with a few).");
    return;
  }
  // set respawn at current spot
  player.spawn.copy(player.pos); toast("Respawn point set");
}
function catCommand() {
  let near = null, nd = 6; for (const c of cats) if (c.tamed) { const d = c.g.position.distanceTo(player.pos); if (d < nd) { nd = d; near = c; } }
  if (!near) { toast("No tamed cat nearby to command"); return; }
  if (near.mode === "follow") { near.mode = "stay"; near.stay.set(near.g.position.x, 0, near.g.position.z); toast(near.color + " cat will stay here"); }
  else { near.mode = "follow"; toast(near.color + " cat will follow you"); }
  SFX.meow();
}

// ---------- DAY / NIGHT ----------
let timeOfDay = 0.28, day = 1; const sunDir = new THREE.Vector3(0.5, 0.8, 0.3);
function isNight() { return timeOfDay > 0.78 || timeOfDay < 0.22; }
function updateDayNight(dt) {
  timeOfDay += dt / 180; if (timeOfDay >= 1) { timeOfDay -= 1; day++; }
  const ang = timeOfDay * Math.PI * 2 - Math.PI / 2;
  const sh = Math.sin(ang);                                  // true sun height -1..1
  sunDir.set(Math.cos(ang) * 0.85, sh, 0.32).normalize();
  if (sh >= 0) lightDir.copy(sunDir);                        // sun by day
  else lightDir.set(-sunDir.x, Math.max(0.28, -sh * 0.7 + 0.25), -sunDir.z).normalize(); // moon by night
  const phase = sh < 0 ? "Night" : (timeOfDay < 0.32 ? "Dawn" : timeOfDay < 0.5 ? "Morning" : timeOfDay < 0.7 ? "Afternoon" : "Dusk");
  document.getElementById("clockBig").textContent = "Day " + day;
  document.getElementById("clockSub").textContent = phase + (DIM === "overworld" && weather.amt > 0.4 ? (weather.snow > 0.5 ? ", Snow" : weather.kind === "storm" ? ", Storm" : ", Rain") : "");
}
// ---------- ENVIRONMENT: sky, fog and light uniforms for every dimension, plus matching three.js lights for entities ----------
const envLocal = { sky: 1, blk: 0, water: 0 };
const vAmbient = new THREE.AmbientLight(0xffffff, 0.85); vScene.add(vAmbient);
const torchAmb = new THREE.AmbientLight(0xffffff, 0); torchAmb.color.setRGB(1, 0.62, 0.32); scene.add(torchAmb);
function setC(c, a, k) { const m = k == null ? 1 : k; c.r = a[0] * m; c.g = a[1] * m; c.b = a[2] * m; return c; }
let envFogRef = null, envFogBase = [30, 100];
function sstep(x, a, b) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function updateEnv(dt) {
  const clampF = THREE.MathUtils.clamp;
  if (scene.fog !== envFogRef) { envFogRef = scene.fog; envFogBase = scene.fog ? [scene.fog.near, scene.fog.far] : [30, 100]; }
  U.uTime.value += dt;
  const ow = DIM === "overworld", bright = DIM === "realm" || DIM === "mario" || DIM === "sky";
  let h;
  if (ow) { U.uSunDir.value.copy(sunDir); U.uLightDir.value.copy(lightDir); h = sunDir.y; }
  else if (bright) { U.uSunDir.value.set(0.42, 0.66, 0.36).normalize(); U.uLightDir.value.copy(U.uSunDir.value); h = U.uSunDir.value.y; }
  else if (DIM === "fire") { U.uSunDir.value.set(0.3, 0.85, 0.25).normalize(); U.uLightDir.value.copy(U.uSunDir.value); h = 0.5; }
  else { U.uSunDir.value.set(-0.45, 0.6, 0.5).normalize(); U.uLightDir.value.copy(U.uSunDir.value); h = 0.5; }
  const e = GL.skyEnv(h), fade = ow ? sstep(Math.abs(h), 0.0, 0.07) : 1;
  setC(U.uZenith.value, e.zen); setC(U.uHorizon.value, e.hor); setC(U.uGlow.value, e.glow);
  setC(U.uSunCol.value, e.light, h > 0 ? 1 : 0); setC(U.uLightCol.value, e.light, fade);
  setC(U.uSkyAmb.value, e.sky); setC(U.uGroundAmb.value, e.gnd);
  setC(skyU.uCloudLit.value, e.cLit); setC(skyU.uCloudAmb.value, e.cAmb);
  skyU.uStars.value = e.night; skyU.uSunVis.value = clampF(h * 10 + 0.4, 0, 1); skyU.uMode.value = 0;
  skyU.uCloudCover.value = DIM === "sky" ? 0.3 : 0.46;
  U.uEmis.value = 1.3 + e.night * 1.2; U.uSkyMul.value = 1; U.uMinLight.value = 0.012;
  if (DIM === "fire") {
    setC(U.uZenith.value, [0.05, 0.01, 0.006]); setC(U.uHorizon.value, [0.36, 0.075, 0.02]); setC(U.uGlow.value, [0, 0, 0]); setC(U.uSunCol.value, [0, 0, 0]);
    setC(U.uLightCol.value, [0.85, 0.36, 0.13]); setC(U.uSkyAmb.value, [0.22, 0.085, 0.05]); setC(U.uGroundAmb.value, [0.36, 0.11, 0.03]);
    skyU.uMode.value = 1; skyU.uStars.value = 0; U.uEmis.value = 1.6; U.uMinLight.value = 0.03;
  } else if (DIM === "end") {
    setC(U.uZenith.value, [0.006, 0.002, 0.012]); setC(U.uHorizon.value, [0.04, 0.016, 0.06]); setC(U.uGlow.value, [0, 0, 0]); setC(U.uSunCol.value, [0, 0, 0]);
    setC(U.uLightCol.value, [0.55, 0.5, 0.78]); setC(U.uSkyAmb.value, [0.13, 0.1, 0.19]); setC(U.uGroundAmb.value, [0.04, 0.03, 0.06]);
    skyU.uMode.value = 2; skyU.uStars.value = 0; U.uEmis.value = 1.8; U.uMinLight.value = 0.02;
  }
  applyWeatherEnv();
  // light where the camera is: drives underwater fog and the three.js lights used by entities and the held item
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const ls = lightAt(cx, cy, cz) / 15, lb = blockLightAt(cx, cy, cz) / 15, k = Math.min(1, dt * 3);
  envLocal.sky += (ls - envLocal.sky) * k; envLocal.blk += (lb - envLocal.blk) * k;
  const wb = getBlock(Math.floor(cx), Math.floor(cy), Math.floor(cz));
  envLocal.water = wb === WATER && (getBlock(Math.floor(cx), Math.floor(cy) + 1, Math.floor(cz)) === WATER || cy - Math.floor(cy) < 0.875) ? 1 : 0;
  let near = envFogBase[0], far = envFogBase[1];
  if (ow || DIM === "realm" || DIM === "mario") { far = GFX[settings.gfx].dist * CH; near = far * 0.5; }
  if (ow && envLocal.sky < 0.5) { const cave = 1 - envLocal.sky * 2; far = THREE.MathUtils.lerp(far, 48, cave); near = THREE.MathUtils.lerp(near, 4, cave); }   // caves close in
  if (ow && weather.amt > 0.01) { far *= 1 - 0.4 * weather.amt; near *= 1 - 0.7 * weather.amt; }   // rain and snow thicken the air
  if (envLocal.water) {
    const wl = 0.25 + 0.75 * envLocal.sky;
    setC(U.uZenith.value, [0.012, 0.07, 0.085], wl * (0.3 + 0.7 * (1 - e.night))); U.uHorizon.value.copy(U.uZenith.value); U.uGlow.value.setRGB(0, 0, 0); U.uSunCol.value.setRGB(0, 0, 0);
    near = 0.5; far = 22;
  }
  U.uFogNear.value = near; U.uFogFar.value = far;
  if (scene.fog) { scene.fog.near = near; scene.fog.far = far; scene.fog.color.copy(U.uHorizon.value); }
  scene.background = null;
  // three.js lights for Lambert entities follow the same model, dimmed when the camera is under cover
  const skyL = ow ? envLocal.sky * envLocal.sky : 1, sunVis = ow ? sstep(envLocal.sky, 0.45, 0.92) : 1;
  sun.color.copy(U.uLightCol.value).multiplyScalar(sunVis); sun.intensity = 1;
  hemi.color.copy(U.uSkyAmb.value).multiplyScalar(skyL * 1.15); hemi.groundColor.copy(U.uGroundAmb.value).multiplyScalar(skyL); hemi.intensity = 1;
  const tb = envLocal.blk * envLocal.blk; torchAmb.color.setRGB(1.6 * tb + 0.012, 0.98 * tb + 0.012, 0.5 * tb + 0.014); torchAmb.intensity = 1;
  vAmbient.color.copy(U.uSkyAmb.value).multiplyScalar(skyL * 1.3).add(torchAmb.color); vAmbient.intensity = 1;
  vLight.color.copy(U.uLightCol.value).multiplyScalar(sunVis * 0.8); vLight.intensity = 1;
  U.uShadowCenter.value.set(player.pos.x, player.pos.y, player.pos.z);
}
