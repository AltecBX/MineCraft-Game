// Batch 7: Boom Pickaxe, Ice Bow / Slime Launcher, and the new power-ups.
(function () {
  console.log("ITEMS boom=" + !!ITEMS[I_BOOMPICK] + " icebow=" + !!ITEMS[I_ICEBOW] + " slime=" + !!ITEMS[I_SLIMELAUNCH]);
  console.log("RECIPES boom=" + RECIPES.some(r => r.out === I_BOOMPICK) + " icebow=" + RECIPES.some(r => r.out === I_ICEBOW));

  // --- Ice Bow: a shot that reaches a monster damages and slows it ---
  // (camera direction is not simulated headless, so inject a shot aimed at the mob)
  hotbar[selSlot] = { id: I_ICEBOW, count: 1 };
  spawnMonster(Math.floor(player.pos.x) + 3, Math.floor(player.pos.z), "crawler");
  const mob = monsters[monsters.length - 1];
  mob.g.position.set(20, 55, 20);                  // above terrain so the bolt has a clear path
  const baseSpeed = mob.speed, hpB = mob.hp;
  const sm = new THREE.Mesh(pshotGeo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  sm.position.set(18, 55, 20);
  playerShots.push({ mesh: sm, vel: new THREE.Vector3(24, 0, 0), life: 2, kind: "ice" });
  let hit = false;
  for (let i = 0; i < 20; i++) { updatePlayerShots(0.03); if (mob.hp < hpB) { hit = true; break; } }
  console.log("ICEBOW hit=" + hit + " slowed=" + (mob.speed < baseSpeed) + " slowTimer=" + (mob.slow > 0));
  // slow restores after expiry
  mob.slow = 0.01; updateMonsters(0.05);
  console.log("ICE_RESTORE speedBack=" + (mob.speed === baseSpeed));

  // --- Boom Pickaxe: clears a pocket of soft blocks ---
  const px = Math.floor(player.pos.x) + 5, pz = Math.floor(player.pos.z) + 5, py = surfaceY(px, pz) - 1;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) setRaw(px + dx, py + dy, pz + dz, DIRT);
  let solidBefore = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (getBlock(px + dx, py + dy, pz + dz) === DIRT) solidBefore++;
  boomBreak(px, py, pz);
  let solidAfter = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (getBlock(px + dx, py + dy, pz + dz) === DIRT) solidAfter++;
  console.log("BOOM clearedNeighbors=" + (solidBefore - solidAfter) + "/26 (center kept)");

  // --- Power-ups: shield blocks damage, double-jump + glide flags ---
  givePowerup("shield"); const hp0 = player.hp; damage(5);
  console.log("SHIELD blocked=" + (player.hp === hp0));
  givePowerup("doublejump"); givePowerup("glide");
  console.log("POWERUPS dj=" + powerActive("doublejump") + " glide=" + powerActive("glide"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
