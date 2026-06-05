// Skill-tree pass: Armor, Swiftness, Luck.
(function () {
  console.log("SKILLDEF count=" + SKILLDEF.length + " hasArmor=" + SKILLDEF.some(d => d.k === "armor") + " hasSwift=" + SKILLDEF.some(d => d.k === "swift") + " hasLuck=" + SKILLDEF.some(d => d.k === "luck"));

  // armor reduces damage taken
  skills.pts = 10; skills.armor = 0; applySkills();
  player.hp = 20; damage(10); const noArmor = 20 - player.hp;
  skills.armor = 5; applySkills(); player.hp = 20; damage(10); const withArmor = 20 - player.hp;
  console.log("ARMOR noArmor=" + noArmor.toFixed(1) + " withArmor=" + withArmor.toFixed(1) + " reduced=" + (withArmor < noArmor));

  // swiftness raises the move-speed multiplier
  skills.swift = 0; applySkills(); const base = swiftMult; skills.swift = 5; applySkills();
  console.log("SWIFT base=" + base + " max=" + swiftMult.toFixed(2) + " faster=" + (swiftMult > base));

  // luck adds coins on a kill
  skills.luck = 5; applySkills();
  spawnMonster(2, 2, "crawler"); const mob = monsters[monsters.length - 1];
  const c0 = coins; killMonster(mob);
  console.log("LUCK coinsGained=" + (coins - c0) + " (>=6 with +5 luck)");

  // spendSkill respects points and persists through render
  skills.pts = 1; skills.mine = 0; spendSkill("mine");
  console.log("SPEND mine=" + skills.mine + " pts=" + skills.pts);
  renderSkills();
  console.log("RENDER_OK");

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
