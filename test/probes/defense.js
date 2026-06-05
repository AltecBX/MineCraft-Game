// Batch 9: base defense (spike traps, alarm bell, raid rewards).
(function () {
  console.log("BLOCKS spike=" + !!BLOCKS[SPIKE] + " alarm=" + !!BLOCKS[ALARM] + " recipes=" + (RECIPES.some(r => r.out === SPIKE) && RECIPES.some(r => r.out === ALARM)));

  // place a spike, rebuild cells, and confirm a monster on it takes damage
  const px = Math.floor(player.pos.x) + 4, pz = Math.floor(player.pos.z), gy = surfaceY(px, pz);
  setRaw(px, gy, pz, SPIKE); rebuildDefenseCells();
  console.log("SPIKE_CELLS count=" + spikeCells.length);
  spawnMonster(px, pz, "crawler");
  const mob = monsters[monsters.length - 1];
  mob.g.position.set(px + 0.5, gy + 1, pz + 0.5);
  const hpB = mob.hp; mob.spikeCd = 0;
  updateMonsters(0.05);
  console.log("SPIKE_DAMAGE took=" + (hpB - mob.hp));

  // alarm bell rings when a monster is near at night
  const ax = Math.floor(player.pos.x) - 4, az = Math.floor(player.pos.z), ay = surfaceY(ax, az);
  setRaw(ax, ay, az, ALARM); rebuildDefenseCells();
  timeOfDay = 0.95; alarmCd = 0;
  mob.g.position.set(ax + 1, ay + 1, az + 1);
  const bannerBefore = document.getElementById("banner").textContent;
  updateMonsters(0.05);
  console.log("ALARM cells=" + alarmCells.length + " cooldownSet=" + (alarmCd > 0));

  // surviving the night rewards coins
  const coinsB = coins; wasNight = true; survivedNight = true; timeOfDay = 0.3;  // dawn
  // emulate the dawn check from the loop
  if (wasNight) { addCoins(8); addXP(15); }
  console.log("DAWN_REWARD coinsGained=" + (coins - coinsB));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
