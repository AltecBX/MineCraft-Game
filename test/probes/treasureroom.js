// Batch C: hidden treasure rooms under the forest.
(function () {
  // build one directly and verify the chamber, loot chest, lights, and surface marker
  const cx = 300, cz = 300, surfY = surfaceY(cx, cz) - 1; // approx surface solid y
  buildTreasureRoom(cx, surfY, cz);
  const roomY = surfY - 7;
  const chest = getBlock(cx, roomY + 1, cz) === CHEST;
  const wall = getBlock(cx + 2, roomY + 1, cz) === BRICK;
  const hollow = getBlock(cx, roomY + 2, cz) === AIR;
  const light = getBlock(cx - 1, roomY + 1, cz - 1) === CRYSTAL;
  const healIn = getBlock(cx + 1, roomY + 1, cz + 1) === HEAL;
  const marker = getBlock(cx, surfY, cz) === CRYSTAL;
  const lootKey = "overworld:" + (cx + "," + (roomY + 1) + "," + cz);
  console.log("ROOM chest=" + chest + " wall=" + wall + " hollow=" + hollow + " light=" + light + " healInside=" + healIn + " surfaceMarker=" + marker);
  console.log("LOOT stored=" + chestStore.has(lootKey));

  // scan a large generated overworld area to confirm rooms appear and leave surface crystal markers
  for (let ccx = -12; ccx <= 12; ccx++) for (let ccz = -12; ccz <= 12; ccz++) genChunk(ccx, ccz);
  let surfaceCrystals = 0;
  for (const [k, id] of W) { if (id === CRYSTAL) { const p = k.split(",").map(Number); if (p[1] > SEA + 2) surfaceCrystals++; } }
  console.log("WORLD_SCAN surfaceCrystalMarkers=" + (surfaceCrystals > 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
