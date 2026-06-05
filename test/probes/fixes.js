// Fixes: chest collect, proximity open, Freda explosive blocks, easier monsters.
(function () {
  // FREDA block + recipe
  console.log("FREDA block=" + !!BLOCKS[FREDA] + " recipe=" + RECIPES.some(r => r.out === FREDA));

  // breaking a chest collects its prizes (never lost)
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z), py = surfaceY(px, pz);
  const k = chestKey(px + 6, py, pz + 6);
  chestStore.set(k, [{ id: COBBLE, count: 9 }, { id: I_APPLE, count: 2 }, null, null, null, null, null, null, null]);
  const cobbleBefore = countItem(COBBLE);
  collectChest(k);
  console.log("CHEST_COLLECT cobbleGained=" + (countItem(COBBLE) - cobbleBefore) + " storeGone=" + !chestStore.has(k));

  // interact opens the nearest chest even without precise aim
  openChestK = null;
  setRaw(px + 1, py, pz, CHEST); chestStore.set(chestKey(px + 1, py, pz), new Array(9).fill(null));
  interact();
  console.log("PROXIMITY_OPEN openChestK=" + (openChestK ? "set" : "none"));
  closeChest();

  // Freda labels build, and explode clears blocks + hurts monsters
  setRaw(px + 8, py, pz + 8, FREDA); rebuildFredaLabels();
  console.log("FREDA_LABELS group=" + !!fredaLabelGroup);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setRaw(px + 10 + dx, py, pz + 10 + dz, DIRT);
  spawnMonster(px + 10, pz + 10, "crawler"); const mob = monsters[monsters.length - 1];
  mob.g.position.set(px + 10.5, py, pz + 10.5);
  const mobHp = mob.hp; let solidBefore = 0; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (getBlock(px + 10 + dx, py, pz + 10 + dz) === DIRT) solidBefore++;
  explode(px + 10, py, pz + 10, 2);
  let solidAfter = 0; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (getBlock(px + 10 + dx, py, pz + 10 + dz) === DIRT) solidAfter++;
  console.log("EXPLODE blocksCleared=" + (solidBefore - solidAfter) + " monsterHurt=" + (mob.hp < mobHp || mob.dead));

  // easier monsters: a crawler now has less HP (base 28 -> ~18)
  spawnMonster(px + 14, pz, "crawler"); const c2 = monsters[monsters.length - 1];
  console.log("EASIER crawlerHp=" + c2.hp + " dmg=" + c2.dmg);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
