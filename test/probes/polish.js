// Polish pass: New Game Plus reward scaling + death-key respawn path.
(function () {
  // NG+ pays out more coins on average
  ngMul = 1; ngLevel = 0;
  function sumCoinsOverKills(n) { coins = 0; for (let i = 0; i < n; i++) { spawnMonster(2 + (i % 5), 2, "crawler"); const m = monsters[monsters.length - 1]; m.elite = false; killMonster(m); } return coins; }
  const base = sumCoinsOverKills(60);
  ngLevel = 4; ngMul = 1 + ngLevel * 0.2;
  const ng = sumCoinsOverKills(60);
  console.log("NG_REWARDS baseCoins=" + base + " ngCoins=" + ng + " bigger=" + (ng > base));

  // doRespawn (the death-screen action) works without throwing
  ngLevel = 0; player.hp = 0; die();
  console.log("DIE running=" + running);
  doRespawn();
  console.log("RESPAWN running=" + running + " hp=" + player.hp);

  // daily nudge text exists for a fresh challenge
  console.log("DAILY_TEXT=" + (daily ? daily.text.slice(0, 12) : "none"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
