// Creature Realm batch 3: arena bosses, final gating, Snoozer road block.
(function () {
  loadDimension("realm");
  console.log("BOSSES spawned=" + realmBosses.length + " final=" + realmBosses.some(b => b.final) + " snoozer=" + !!realmSnoozer);

  // challenge a normal arena boss -> boss battle -> badge + boss removed
  const boss = realmBosses.find(b => !b.final), badge = boss.badge;
  challengeBoss(boss);
  console.log("BOSS_BATTLE active=" + !!battle + " isBoss=" + (battle && battle.boss) + " badge=" + (battle && battle.badge));
  battle.wild.hp = 1; doMove(0);
  console.log("BOSS_DEFEAT gotBadge=" + cbadges.has(badge) + " down=" + !!realmBossDown[badge] + " removed=" + !realmBosses.includes(boss));
  battle = null;

  // final boss gated until all arena badges are won
  const fin = realmBosses.find(b => b.final);
  challengeBoss(fin); console.log("FINAL_GATED blocked=" + !battle);
  BOSS_PLAN.forEach(p => realmBossDown[p.badge] = true);
  challengeBoss(fin); console.log("FINAL_OPEN active=" + !!battle + " badge=" + (battle && battle.badge));
  if (battle) { battle.wild.hp = 1; doMove(0); console.log("FINAL_WIN legendBadge=" + cbadges.has("legendary")); battle = null; }

  // Snoozer road block: needs Creature Food to move
  citems.food = 0; feedSnoozer(); console.log("SNOOZER_HUNGRY stillThere=" + !!realmSnoozer);
  citems.food = 1; feedSnoozer(); console.log("SNOOZER_FED moved=" + (realmSnoozer === null) + " flag=" + !!realmBossDown.snoozer);

  // re-entering does not respawn beaten bosses or the snoozer
  enterRealm();
  console.log("REENTER bosses=" + realmBosses.length + " snoozer=" + !!realmSnoozer + " (all beaten)");

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
