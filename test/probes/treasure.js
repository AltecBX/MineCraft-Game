// Batch: Treasure Hunt mini-game + audio moods.
(function () {
  // music scales now include night and cave moods
  console.log("SCALES night=" + !!SCALES.night + " cave=" + !!SCALES.cave);
  console.log("SFX victory=" + (typeof SFX.victory) + " treasure=" + (typeof SFX.treasure));

  // merchant sells a Treasure Map
  console.log("SHOP_MAP=" + SHOP.some(s => s.name === "Treasure Map"));

  // starting a hunt buries a chest and sets the objective beacon
  const chestsBefore = chestStore.size;
  startTreasureHunt();
  console.log("HUNT_START key=" + (treasureKey ? "set" : "none") + " chestAdded=" + (chestStore.size - chestsBefore) + " beacon=" + (objMarker && objMarker.visible));

  // digging up the treasure rewards coins/xp and clears the hunt
  const coinsB = coins, xpKey = treasureKey;
  openChest(treasureKey);
  console.log("HUNT_DONE cleared=" + (treasureKey === null) + " coinsGained=" + (coins - coinsB) + " achTreasure=" + ach.has("treasure"));

  // hunts only start in the overworld
  loadDimension("fire");
  startTreasureHunt();
  console.log("FIREDIM_NOHUNT key=" + (treasureKey ? "set" : "none"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
