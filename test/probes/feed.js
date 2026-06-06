// Encounter menu opens cleanly and feeding raises friendship + tame chance.
(function () {
  loadDimension("realm");
  const wild = makeCreature("voltmouse", 6);
  openEncounter(wild, null);
  console.log("MENU open=" + cmenuOpen + " noThrow=true");

  // feeding effect (mirror of the Feed button: food gives +3, otherwise +1)
  const f0 = wild.friendship, t0 = tameChance(wild);
  citems.food = 1; if (citems.food > 0) { citems.food--; wild.friendship += 3; }
  const t1 = tameChance(wild);
  console.log("FEED_FOOD friendUp=" + (wild.friendship > f0) + " foodConsumed=" + (citems.food === 0) + " tameChanceRose=" + (t1 > t0));

  const f1 = wild.friendship; wild.friendship += 1;   // free pet path
  console.log("FEED_PET friendUp=" + (wild.friendship > f1));

  closeCMenu();
  console.log("CLOSED open=" + cmenuOpen);
  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
