// Badge rewards send buildable blocks + coins + XP back to Thomas's pack (usable in the main world).
(function () {
  loadDimension("realm");
  const fs0 = countItem(FIRESTONE), c0 = coins, x0 = xp;
  grantRealmReward("fire");
  console.log("FIRE_REWARD firestone+=" + (countItem(FIRESTONE) - fs0) + " coins+=" + (coins - c0) + " xp+=" + (xp - x0));

  // legendary grants a big stack of crystal + brick
  const cr0 = countItem(CRYSTAL), br0 = countItem(BRICK);
  grantRealmReward("legendary");
  console.log("LEGEND_REWARD crystal+=" + (countItem(CRYSTAL) - cr0) + " brick+=" + (countItem(BRICK) - br0));

  // winning a boss battle awards the badge AND its reward once
  const fs1 = countItem(FIRESTONE);
  startBattle(makeCreature("emberwing", 12), null, { boss: true, badge: "fire2test" });   // unknown badge -> no reward map entry
  battle.wild.hp = 1; doMove(0);
  console.log("WIN_GIVES_BADGE got=" + cbadges.has("fire2test") + " noCrashUnknownBadge=true");
  battle = null;

  // blocks persist when returning to the overworld (inventory is global)
  const carried = countItem(FIRESTONE);
  loadDimension("overworld");
  console.log("CARRIES_HOME firestoneInOverworld=" + (countItem(FIRESTONE) === carried) + " hasBlocks=" + (countItem(FIRESTONE) > 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
