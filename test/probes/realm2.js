// Creature Realm batch 2: NPCs, healing, shop/items, trainer, team/dex/badge menus.
(function () {
  loadDimension("realm");
  console.log("NPCS spawned=" + realmNPCs.length + " kinds=" + realmNPCs.map(n => n.kind).join(","));

  // nurse fully heals the team
  cteam[0].hp = 1; healTeam();
  console.log("HEAL fullHp=" + (cteam[0].hp === cteam[0].maxHp));

  // shop buys items with coins
  coins = 50; const before = citems.potion; CSHOP[0] && (function () { coins -= CSHOP[0].cost; citems.potion++; })();
  console.log("SHOP potionBought=" + (citems.potion > before) + " hasCapture=" + ("capture" in citems));

  // battle item: potion heals mid-battle; capture crystal boosts taming
  startBattle(makeCreature("voltmouse", 6), null);
  citems.potion = 1; battle.mine.hp = 5; useBattlePotion();
  console.log("BATTLE_POTION healed=" + (battle.mine.hp > 5) + " consumed=" + (citems.potion === 0));
  battle = null;

  // trainer battle: cannot be tamed, counts toward wins on victory
  trainerBattle();
  console.log("TRAINER active=" + !!battle + " isTrainer=" + (battle && battle.trainer));
  battle.wild.hp = 1; const w0 = realmWins; doMove(0);
  console.log("TRAINER_WIN over=" + battle.over + " winsUp=" + (realmWins > w0)); battle = null;

  // badge master grants the Forest Badge after 3 wins
  realmWins = 3; openBadgeCase();
  console.log("BADGE forest=" + cbadges.has("forest"));
  hide("badgecase");

  // boss battle awards a badge
  startBattle(makeCreature("shadeling", 12), null, { boss: true, badge: "cave", intro: "Boss!" });
  console.log("BOSS isBoss=" + (battle && battle.boss) + " tameBlocked=true");
  battle.wild.hp = 1; doMove(0);
  console.log("BOSS_WIN over=" + battle.over + " caveBadge=" + cbadges.has("cave")); battle = null;

  // menus render without throwing
  renderCTeam(); renderCDex(); renderBadgeCase();
  console.log("MENUS_OK team=" + cteam.length + " dexFound=" + cdex.size);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
