// Batch 6: random world events.
(function () {
  console.log("EVENTS count=" + EVENTS.length + " cd0=" + eventCd.toFixed(0));

  // force the meteor event and check it spawns a reward chest
  const chestsBefore = chestStore.size;
  startEvent(EVENTS.find(e => e.id === "meteor"));
  console.log("METEOR active=" + (activeEvent && activeEvent.id) + " chestAdded=" + (chestStore.size - chestsBefore));
  // run it down to completion
  updateEvents(30);
  console.log("METEOR_END active=" + (activeEvent ? activeEvent.id : "none"));

  // golden day doubles XP while active, restores after
  startEvent(EVENTS.find(e => e.id === "golden"));
  const before = xp + level * 1000;                 // rough monotonic measure
  const lv0 = level, xp0 = xp; addXP(10);
  console.log("GOLDEN xpMult=" + xpMult + " gained~=" + ((level - lv0) * 0 + (xp - xp0)) + " (expect ~20)");
  updateEvents(40);
  console.log("GOLDEN_END xpMult=" + xpMult);

  // blood moon spawns a horde at night
  timeOfDay = 0.95;                                  // night
  const monBefore = monsters.length;
  startEvent(EVENTS.find(e => e.id === "bloodmoon"));
  console.log("BLOODMOON monstersAdded=" + (monsters.length - monBefore) + " tintSet=" + (document.getElementById("eventTint").style.opacity === "1"));
  updateEvents(45);
  console.log("BLOODMOON_END active=" + (activeEvent ? activeEvent.id : "none"));

  // events do not run in other dimensions
  loadDimension("fire");
  updateEvents(0.1);
  console.log("FIREDIM eventActive=" + (activeEvent ? activeEvent.id : "none"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
