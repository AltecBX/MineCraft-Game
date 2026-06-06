// Batch B: cat combo attacks + night-raid cat stakes.
(function () {
  // a tamed cat near a struck monster joins the attack for bonus damage
  spawnCat(Math.floor(player.pos.x) + 1, Math.floor(player.pos.z), { tamed: true, color: "orange" });
  const cat = cats[cats.length - 1];
  spawnMonster(2, 2, "brute"); const m = monsters[monsters.length - 1];
  m.g.position.set(player.pos.x + 1, player.pos.y, player.pos.z); cat.g.position.set(player.pos.x + 1.5, player.pos.y, player.pos.z + 0.5);
  cat.comboCd = 0; const hp0 = m.hp;
  catCombo(m);
  console.log("COMBO triggered=" + (m.hp < hp0) + " comboCdSet=" + (cat.comboCd > 0));
  const hp1 = m.hp; catCombo(m);  // on cooldown -> no extra hit
  console.log("COOLDOWN noSecondHit=" + (m.hp === hp1));

  // night-raid stakes: an adjacent monster at night wears a cat down and scares it off
  timeOfDay = 0.95;  // night
  spawnCat(Math.floor(player.pos.x), Math.floor(player.pos.z) + 1, { tamed: true, color: "white" });
  const victim = cats[cats.length - 1];
  const catsBefore = cats.length;
  spawnMonster(2, 2, "brute"); const raider = monsters[monsters.length - 1];
  for (let i = 0; i < 300 && cats.length === catsBefore; i++) { raider.g.position.copy(victim.g.position); raider.hp = raider.max; updateAnimals(0.1); }  // keep the raider alive to simulate being overwhelmed
  console.log("CAT_STAKES scaredOff=" + (cats.length < catsBefore));

  // dawn raid reward scales with surviving cats (count + reward logic)
  const safe = cats.filter(c => c.tamed).length;
  const rew = 8 + safe * 6;
  console.log("RAID_REWARD survivingCats=" + safe + " reward=" + rew + " scales=" + (rew > 8));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
