// Stage 2: special weapon (Lightning Hammer), power-ups, and cat abilities.
(function () {
  // --- Lightning Hammer chain shock ---
  hotbar[selSlot] = { id: I_LIGHTHAMMER, count: 1 };
  console.log("HAMMER item=" + (ITEMS[I_LIGHTHAMMER] && ITEMS[I_LIGHTHAMMER].name) + " special=" + ITEMS[I_LIGHTHAMMER].special);
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  spawnMonster(px + 2, pz + 1, "crawler");
  spawnMonster(px + 1, pz + 2, "crawler");
  spawnMonster(px + 2, pz + 2, "crawler");
  // pull them next to Thomas so they are inside the zap radius
  for (const m of monsters) m.g.position.set(player.pos.x + (Math.random() - .5), player.pos.y, player.pos.z + (Math.random() - .5));
  const hpBefore = monsters.map(m => m.hp);
  const killsBefore = kills;
  monsters[0].hp = 5;                 // this one should die from the zap
  lightningZap();
  const damaged = monsters.filter((m, i) => m.hp < hpBefore[i] || m.dead).length;
  console.log("ZAP damagedOrDead=" + damaged + "/" + monsters.length + " firstDead=" + monsters[0].dead + " killsDelta=" + (kills - killsBefore));

  // --- Power-ups ---
  givePowerup("speed");
  console.log("POWERUP speedActive=" + powerActive("speed") + " t=" + powerups.speed.toFixed(0));
  updatePowerups(5);
  console.log("AFTER_5s speed=" + powerups.speed.toFixed(0) + " stillActive=" + powerActive("speed"));
  powerups.speed = 0.4; updatePowerups(1);  // force expiry
  console.log("EXPIRY speedActive=" + powerActive("speed"));
  givePowerup("jump"); givePowerup("catvision");
  console.log("MULTI jump=" + powerActive("jump") + " catvision=" + powerActive("catvision"));

  // --- Cat abilities ---
  console.log("ABILITY white=" + catAbility("white") + " orange=" + catAbility("orange") + " black=" + catAbility("black"));
  spawnCat(px, pz, { tamed: true, color: "white" });
  const healer = cats[cats.length - 1];
  healer.g.position.set(player.pos.x, player.pos.y, player.pos.z + 0.5);
  player.hp = 10;
  const healers = cats.filter(c => c.tamed && c.ability === "heal").length;
  updateAnimals(3.2);                 // healer should mend ~1 hp per 3s
  console.log("HEAL ability=" + healer.ability + " healerCats=" + healers + " hpAfter=" + player.hp);

  // --- sanity: run frames with hammer + buffs active ---
  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK hp=" + player.hp);
})();
