// Sparky companion follows Thomas in the realm; Creature Door is far from spawn and other portals.
(function () {
  // --- portal separation (overworld) ---
  loadDimension("overworld");
  let realmCell = null, fireCell = null;
  for (const k in portalDest) { const v = portalDest[k]; const p = k.split(",").map(Number); if (v === "realm" && !realmCell) realmCell = p; if (v === "fire" && !fireCell) fireCell = p; }
  const distSpawn = Math.hypot(realmCell[0] - 0, realmCell[2] - 0);
  const distFire = Math.hypot(realmCell[0] - fireCell[0], realmCell[2] - fireCell[2]);
  console.log("DOOR_FAR fromSpawn=" + distSpawn.toFixed(0) + " fromFire=" + distFire.toFixed(0) + " farEnough=" + (distSpawn > 60 && distFire > 60) + " trail=" + (trailGroup && trailGroup.children.length));

  // valley dressing present (door chunk pre-generated so terrain won't clobber it)
  console.log("DOOR_BLOCK isPortal=" + (getBlock(realmCell[0], realmCell[1], realmCell[2]) === PORTAL));

  // --- companion in the realm ---
  loadDimension("realm");
  console.log("SPARKY exists=" + !!companion + " starterIsVolt=" + (cteam[0] && cteam[0].sp === "voltmouse") + " name=" + (cteam[0] && cteam[0].name));

  // follows: move Thomas far, run several frames, companion should close the gap
  const c = companion; player.pos.set(c.g.position.x + 12, c.g.position.y, c.g.position.z);
  const d0 = Math.hypot(player.pos.x - c.g.position.x, player.pos.z - c.g.position.z);
  for (let i = 0; i < 40; i++) updateCompanion(0.05);
  const d1 = Math.hypot(player.pos.x - c.g.position.x, player.pos.z - c.g.position.z);
  console.log("FOLLOW d0=" + d0.toFixed(1) + " d1=" + d1.toFixed(1) + " caughtUp=" + (d1 < d0 - 3));

  // reactions do not throw
  reactCompanion("alert"); reactCompanion("cheer");
  console.log("REACT cheerTimer=" + (companion.cheer > 0));

  // leaving the realm removes Sparky
  loadDimension("overworld");
  console.log("CLEARED gone=" + !companion);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
