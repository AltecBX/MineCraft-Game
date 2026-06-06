// Creature collection (dex) milestone rewards.
(function () {
  loadDimension("realm");
  cdex = new Set(); dexRewarded = 0;
  const c0 = coins, cr0 = countItem(CRYSTAL);
  const ids = Object.keys(SPECIES);
  for (let i = 0; i < 5; i++) { cdex.add(ids[i]); checkDex(); }
  console.log("TIER5 rewarded=" + (dexRewarded >= 5) + " coinsUp=" + (coins > c0) + " crystalUp=" + (countItem(CRYSTAL) > cr0));
  // no double-reward for the same tier
  const coinsAfter = coins; checkDex();
  console.log("NO_DOUBLE same=" + (coins === coinsAfter));
  // complete the dex
  for (const id of ids) cdex.add(id);
  checkDex();
  console.log("COMPLETE rewardedAll=" + (dexRewarded >= ids.length));
  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
