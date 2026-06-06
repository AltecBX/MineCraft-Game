// Build every creature model: confirm none throw and ground-walkers keep their 4-leg animation hook.
(function () {
  loadDimension("realm");
  let ok = 0, missingLegs = [], errs = [];
  for (const id in SPECIES) {
    try {
      buildCreatureModel(id, false);
      const g = buildCreatureModel(id, true);   // shiny variant
      const sp = SPECIES[id];
      const ghost = sp.role === "cave" || sp.type === "ghost";
      const flyer = sp.role === "fly" || sp.role === "sky";
      if (!ghost && (!g.userData.legs || g.userData.legs.length !== 4)) missingLegs.push(id);
      if (flyer && (!g.userData.wings || g.userData.wings.length !== 2)) errs.push(id + ":wings");
      ok++;
    } catch (e) { errs.push(id + ":" + e.message); }
  }
  console.log("MODELS built=" + ok + "/" + Object.keys(SPECIES).length + " missingLegs=" + JSON.stringify(missingLegs) + " errs=" + JSON.stringify(errs));

  // names reflect the requested roster
  console.log("NAMES pikachu=" + (SPECIES.voltmouse.name === "Pikachu") + " charizard=" + (SPECIES.emberwing.name === "Charizard") + " snorlax=" + (SPECIES.snoozer.name === "Snorlax") + " arceus=" + (SPECIES.allbeast.name === "Arceus"));

  spawnRealmCreature("foxling", 2, 2, 5);
  const c = realmCreatures[realmCreatures.length - 1];
  c.moved = true; for (let i = 0; i < 4; i++) updateRealm(0.05);
  console.log("ANIM_OK legs=" + (c.g.userData.legs ? c.g.userData.legs.length : 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
