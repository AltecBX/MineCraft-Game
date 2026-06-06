// Daily Challenge + New Game Plus.
(function () {
  console.log("DAILY_TEMPLATES=" + DAILY.length + " active=" + (daily ? daily.id : "none"));

  // force a known daily challenge and drive its progress to completion
  daily = { date: todayStr(), id: "kill", kind: "kill", text: "Defeat 3 monsters", target: 3, reward: () => addCoins(25), prog: 0, claimed: false };
  const c0 = coins;
  dailyTick("kill", 1); dailyTick("mine", 1); /* wrong kind, ignored */ dailyTick("kill", 1);
  console.log("PROGRESS prog=" + daily.prog + " (mine ignored) claimed=" + daily.claimed);
  dailyTick("kill", 1);
  console.log("COMPLETE claimed=" + daily.claimed + " coinsGained=" + (coins - c0) + " ach=" + ach.has("daily"));
  // further ticks do nothing once claimed
  const c1 = coins; dailyTick("kill", 5);
  console.log("NO_DOUBLE coinsUnchanged=" + (coins === c1));

  // initDaily picks a stable challenge for the day and persists
  initDaily();
  console.log("INIT_DAILY id=" + daily.id + " persisted=" + (localStorage.getItem('thomas_voxel_daily') != null));

  // New Game Plus: a dragon win bumps the level and scales monsters
  const lvl0 = ngLevel; bumpNG();
  console.log("NGPLUS level=" + ngLevel + " mul=" + ngMul.toFixed(2) + " bumped=" + (ngLevel > lvl0));
  // a monster spawned now has more HP than at ng0
  ngMul = 1; spawnMonster(2, 2, "brute"); const baseHp = monsters[monsters.length - 1].hp;
  ngMul = 1.4; spawnMonster(3, 3, "brute"); const ngHp = monsters[monsters.length - 1].hp;
  console.log("NG_SCALING baseHp=" + baseHp + " ngHp=" + ngHp + " tougher=" + (ngHp > baseHp));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
