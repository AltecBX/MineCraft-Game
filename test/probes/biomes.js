// More biomes: mushroom forest, swamp, crystal caves + Crystal Spear.
(function () {
  console.log("BLOCKS mycelium=" + !!BLOCKS[MYCELIUM] + " mushroom=" + !!BLOCKS[MUSHROOM] + " crystal=" + !!BLOCKS[CRYSTAL]);
  console.log("SPEAR item=" + !!ITEMS[I_CRYSTALSPEAR] + " recipe=" + RECIPES.some(r => r.out === I_CRYSTALSPEAR));

  // giantMushroom builds a stem + cap without throwing
  const gx = 200, gz = 200, gy = surfaceY(gx, gz);
  giantMushroom(gx, gy, gz);
  let caps = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 6; dy++) if (getBlock(gx + dx, gy + dy, gz + dz) === MUSHROOM) caps++;
  console.log("MUSHROOM_BUILD caps=" + caps);

  // scan a big area of generated overworld for the new biome blocks
  for (let cx = -8; cx <= 8; cx++) for (let cz = -8; cz <= 8; cz++) genChunk(cx, cz);
  let myc = 0, crys = 0, mush = 0;
  for (const [k, id] of W) { if (id === MYCELIUM) myc++; else if (id === CRYSTAL) crys++; else if (id === MUSHROOM) mush++; }
  console.log("WORLD_SCAN mycelium=" + (myc > 0) + " crystal=" + (crys > 0) + " mushroom=" + (mush > 0));

  // Crystal Spear pierces a second nearby monster
  hotbar[selSlot] = { id: I_CRYSTALSPEAR, count: 1 };
  spawnMonster(2, 2, "crawler"); spawnMonster(2, 2, "crawler");
  const m1 = monsters[monsters.length - 2], m2 = monsters[monsters.length - 1];
  m1.g.position.set(player.pos.x + 1, player.pos.y, player.pos.z); m2.g.position.set(player.pos.x + 1.5, player.pos.y, player.pos.z + 1);
  m1.g.userData = { kind: "monster", m: m1 };
  const hp2 = m2.hp; attackCd = 0;
  attackEntity({ obj: m1.g, point: m1.g.position });
  console.log("PIERCE secondHurt=" + (m2.hp < hp2));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
