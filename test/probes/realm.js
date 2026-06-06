// Creature Battle Realm: door/dimension, roaming creatures, turn-based battle, taming, XP.
(function () {
  console.log("DATA species=" + Object.keys(SPECIES).length + " moves=" + Object.keys(MOVES).length + " wildPool=" + WILD_POOL.length);
  console.log("TYPES elec>water=" + typeMult("electric", "water") + " fire>water=" + typeMult("fire", "water") + " water>fire=" + typeMult("water", "fire") + " ghost>normal=" + typeMult("ghost", "normal"));

  // entering the realm: dimension loads, a starter joins, creatures roam, return portal exists
  loadDimension("realm");
  console.log("REALM dim=" + DIM + " team=" + cteam.length + " starter=" + (cteam[0] && cteam[0].sp) + " roamers=" + realmCreatures.length + " returnPortal=" + Object.values(portalDest).includes("overworld"));

  // a battle: my move damages the wild with type effectiveness; enemy hits back
  const wild = makeCreature("voltmouse", 6, { shiny: false });
  startBattle(wild, null);
  const ehp0 = battle.wild.hp; doMove(0);
  console.log("MOVE dealtDamage=" + (battle.wild.hp < ehp0) + " over=" + battle.over);
  if (!battle.over) { const mhp0 = battle.mine.hp; enemyTurn(); console.log("ENEMY_TURN minute=" + (battle.mine.hp <= mhp0)); }

  // taming a weakened wild adds it to the team
  if (battle && !battle.over) { const before = cteam.length + cstorage.length; let ok = false; for (let i = 0; i < 40 && !ok; i++) { battle.wild.hp = 1; battle.over = false; battle.busy = false; tryTameBattle(); if (cteam.length + cstorage.length > before) ok = true; } console.log("TAME success=" + ok + " collection=" + cdex.size); }

  // KO win grants XP and can level the creature
  const c = cteam[0], lv0 = c.level; gainCreatureXP(c, 999);
  console.log("LEVELUP from=" + lv0 + " to=" + c.level);
  const wild2 = makeCreature("moonfox", 4); startBattle(wild2, null); battle.wild.hp = 1; doMove(0);
  console.log("WIN over=" + battle.over + " log=" + battle.log.slice(0, 12));

  // tall grass exists in the generated realm
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) genChunk(cx, cz);
  let grass = 0; for (const [k, id] of W) if (id === TALLGRASS) grass++;
  console.log("TALLGRASS present=" + (grass > 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK dim=" + DIM);
})();
