// Realm route network: sandy trails, route signs, roaming trainers that auto-challenge.
(function () {
  loadDimension("realm");
  // a sand trail exists partway along the path to the first arena
  const b = BOSS_PLAN[0];
  let sandy = 0; const steps = Math.max(Math.abs(b.x), Math.abs(b.z));
  for (let s = 2; s <= steps; s++) { const t = s / steps, x = Math.round(b.x * t), z = Math.round(b.z * t); if (getBlock(x, surfaceY(x, z) - 1, z) === SAND) sandy++; }
  console.log("TRAIL sandyBlocks=" + sandy + " ok=" + (sandy > 5));

  // route signs exist alongside portal signs
  console.log("SIGNS total=" + (portalSignGroup && portalSignGroup.children.length) + " ok=" + (portalSignGroup && portalSignGroup.children.length >= 7));

  // roaming trainers spawn on the first two routes and challenge when close
  const rts = realmNPCs.filter(n => n.route);
  console.log("TRAINERS roaming=" + rts.length);
  const t0 = rts[0];
  // silence wild encounters for a deterministic check: close menus, block grass rolls, clear nearby roamers
  if (typeof closeCMenu === "function") closeCMenu(); battle = null; encounterCd = 99;
  player.pos.set(t0.g.position.x + 1, t0.g.position.y, t0.g.position.z);
  for (const c of realmCreatures) if (c.g.position.distanceTo(player.pos) < 4) c.g.position.x += 30;
  updateRealm(0.05);
  console.log("CHALLENGE battle=" + !!battle + " marked=" + t0.challenged);
  if (battle) { battle.wild.hp = 1; doMove(0); battle = null; }

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
