// Themed boss arenas + Snorlax bridge build into the realm without errors and place blocks.
(function () {
  loadDimension("realm");
  // each arena leaves the boss center clear but dresses the surroundings
  function near(x, z, ids, r) {
    r = r || 6; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy <= 12; dy++) { if (ids.indexOf(getBlock(x + dx, surfaceY(x, z) + dy, z + dz)) > -1) return true; }
    return false;
  }
  console.log("FIRE volcano=" + near(24, 6, [FIRESTONE, LAVA]));
  console.log("WATER moat=" + near(8, 26, [WATER, BRICK]));
  console.log("LAVA temple=" + near(-8, -26, [LAVA, FIRESTONE]));
  console.log("PSYCHIC lab=" + near(-26, -6, [CRYSTAL, BRICK]));
  console.log("CAVE den=" + near(-24, 6, [COBBLE, CRYSTAL]));
  console.log("SKY tower=" + near(26, -10, [BRICK, CRYSTAL]));
  console.log("DIVINE ring=" + near(0, 34, [CRYSTAL]));

  // boss center stays open (a boss can stand there)
  const open = getBlock(24, surfaceY(24, 6) + 1, 6) === AIR;
  console.log("CENTER_CLEAR fire=" + open);

  // Snorlax bridge: planks laid, Snorlax present on it
  const bridge = getBlock(0, surfaceY(0, 15) - 1, 15) === PLANKS;
  console.log("BRIDGE planks=" + bridge + " snorlax=" + !!realmSnoozer);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
