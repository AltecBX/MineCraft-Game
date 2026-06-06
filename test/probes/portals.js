// Verify the Creature Realm portal exists in the overworld, is signposted, and is reachable.
(function () {
  loadDimension("overworld");
  // find the portal cell routed to the realm (frame at x=12, z=-6, CDOOR edges, PORTAL interior)
  let realmCell = null;
  for (const k in portalDest) { if (portalDest[k] === "realm") { realmCell = k.split(",").map(Number); break; } }
  console.log("REALM_PORTAL found=" + !!realmCell + " isPortalBlock=" + (realmCell && getBlock(realmCell[0], realmCell[1], realmCell[2]) === PORTAL) + " signs=" + (portalSignGroup && portalSignGroup.children.length));

  // stepping onto the realm portal queues the transition (async fade), so it sets the cooldown
  player.pos.set(realmCell[0] + 0.5, realmCell[1], realmCell[2] + 0.5); portalCd = 0; checkPortal();
  console.log("STEP_ON portalQueued=" + (portalCd > 0));

  // load the realm directly to confirm it is set up with a return door, creatures, and a sign
  loadDimension("realm");
  let backRouted = false; for (const k in portalDest) { if (portalDest[k] === "overworld") { backRouted = true; break; } }
  console.log("REALM_READY backDoor=" + backRouted + " creatures=" + realmCreatures.length + " signs=" + (portalSignGroup && portalSignGroup.children.length));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
