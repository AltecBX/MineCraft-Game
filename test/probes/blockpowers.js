// Batch A: big Freda explosion + special-power blocks (launch, heal, frost).
(function () {
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z), py = surfaceY(px, pz);
  console.log("BLOCKS launch=" + !!BLOCKS[LAUNCH] + " heal=" + !!BLOCKS[HEAL] + " frost=" + !!BLOCKS[FROST] + " recipes=" + ([LAUNCH, HEAL, FROST].every(b => RECIPES.some(r => r.out === b))));

  // big explosion: clears blocks, makes smoke + a shockwave ring, hurts a monster
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setRaw(px + 20 + dx, py, pz + 20 + dz, DIRT);
  spawnMonster(px + 20, pz + 20, "crawler"); const mob = monsters[monsters.length - 1]; mob.g.position.set(px + 20.5, py, pz + 20.5);
  const mobHp = mob.hp, fx0 = fxParts.length, tg0 = telegraphs.length;
  explode(px + 20, py, pz + 20, 2);
  console.log("EXPLODE smoke=" + fxParts.some(p => p.smoke) + " debris=" + (fxParts.length - fx0 > 20) + " shockwave=" + telegraphs.some(t => t.grow) + " monsterHurt=" + (mob.hp < mobHp));

  // launch pad: standing on it flings Thomas high
  setRaw(px, py, pz, LAUNCH);
  player.pos.set(px + 0.5, py + 1, pz + 0.5); player.vel.set(0, -2, 0); player.onGround = false;
  let maxVy = -99; for (let i = 0; i < 12; i++) { physics(0.05); if (player.vel.y > maxVy) maxVy = player.vel.y; }
  console.log("LAUNCH maxVelY=" + maxVy.toFixed(1) + " bigBoost=" + (maxVy > 18));
  setRaw(px, py, pz, AIR);

  // heal block: mends Thomas when near
  player.pos.set(px + 0.5, py + 1, pz + 0.5);
  setRaw(px + 1, py, pz, HEAL); rebuildDefenseCells();
  player.hp = 10; blockHealCd = 0; updateBlockPowers(0.6);
  console.log("HEAL cells=" + healCells.length + " hpAfter=" + player.hp + " healed=" + (player.hp > 10));

  // frost block: freezes a nearby monster
  setRaw(px + 5, py, pz, FROST); rebuildDefenseCells();
  spawnMonster(px + 5, pz, "crawler"); const fm = monsters[monsters.length - 1];
  fm.g.position.set(px + 5.5, py + 1, pz + 0.5); const baseSpd = fm.speed; fm.frostCd = 0;
  updateMonsters(0.05);
  console.log("FROST cells=" + frostCells.length + " slowed=" + (fm.speed < baseSpd) + " slowTimer=" + (fm.slow > 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
