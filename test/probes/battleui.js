// Classic battle UI: Fight/Bag/Creature/Run menu, type chips, Bag items, creature switch, transition.
(function () {
  loadDimension("realm");
  // ensure a 2-creature team so switching is testable
  if (cteam.length < 2) cteam.push(makeCreature("foxling", 6));
  startBattle(makeCreature("voltmouse", 6), null);
  console.log("START menu=" + battle.menu + " hasWipe=" + (typeof showBattleWipe === "function"));

  // type chip + accuracy helpers render
  console.log("HELPERS chip=" + (typeChip("fire").indexOf("tchip") > -1) + " acc=" + Math.round(moveAcc(MOVES.fireblast) * 100) + "%");

  // Bag: treat heals + costs the turn
  citems.food = 1; battle.mine.hp = 5; const fr0 = battle.mine.friendship || 0; useBattleTreat();
  console.log("TREAT healed=" + (battle.mine.hp > 5) + " foodUsed=" + (citems.food === 0) + " friendUp=" + ((battle.mine.friendship || 0) > fr0) + " busy=" + battle.busy);
  battle.busy = false;

  // Creature switch changes the active creature and costs the turn
  const other = cteam.find(c => c !== battle.mine && c.hp > 0);
  if (other) { switchCreature(other); console.log("SWITCH active=" + (battle.mine === other) + " busy=" + battle.busy); battle.busy = false; }

  // Fight still works and can win
  battle.menu = "fight"; battle.wild.hp = 1; doMove(0);
  console.log("FIGHT_WIN over=" + battle.over);
  battle = null;

  // boss battle keeps Bag's capture hidden (cannot tame a boss) — just ensure it renders
  startBattle(makeCreature("shadeling", 10), null, { boss: true, badge: "cave", intro: "Boss!" });
  battle.menu = "bag"; renderBattle();
  console.log("BOSS_BAG menu=" + battle.menu + " isBoss=" + !!battle.boss);
  battle = null;

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
