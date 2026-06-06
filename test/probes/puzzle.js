// Push-block puzzle: shove the boulder onto the plate to open the gate.
(function () {
  loadDimension("realm");
  const p = realmPuzzle;
  console.log("PUZZLE exists=" + !!p + " plate=" + (getBlock(16, surfaceY(16, 8) - 1, 8) === HEAL) + " gate=" + (getBlock(p.gate.x, p.gateY, p.gate.z) === CDOOR));

  // far away: pressing Use does nothing to the boulder
  player.pos.set(40, surfaceY(40, 40), 40);
  console.log("NO_PUSH_FAR handled=" + pushBoulder());

  // push the boulder along +z from (16,4) to the plate at (16,8): stand just behind it each time
  for (let i = 0; i < 6 && !realmPuzzle.solved; i++) {
    player.pos.set(p.boulder.x + 0.5, surfaceY(p.boulder.x, p.boulder.z), p.boulder.z - 0.6);
    pushBoulder();
  }
  console.log("SOLVED solved=" + p.solved + " onPlate=" + (p.boulder.x === 16 && p.boulder.z === 8) + " gateOpen=" + (getBlock(p.gate.x, p.gateY, p.gate.z) === AIR));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
