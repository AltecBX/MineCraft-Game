// Trophy Hall: earned trophies reflect achievements; panel renders and freezes the world.
(function () {
  console.log("TROPHIES count=" + TROPHIES.length);
  // none earned yet at game start
  renderTrophies();
  console.log("INITIAL count=" + document.getElementById("trophyCount").textContent);
  // earn a few achievements, trophies should follow
  achieve("cat", "First Cat Tamed"); achieve("fireboss", "Fire Boss"); achieve("skyboss", "Sky Beast Slain"); achieve("dragon", "Dragon");
  renderTrophies();
  const earned = TROPHIES.filter(t => ach.has(t.id)).length;
  console.log("AFTER_EARN earnedTrophies=" + earned + " hasFire=" + ach.has("fireboss") + " hasSky=" + ach.has("skyboss"));
  // opening the trophy hall freezes the world (it is a game panel)
  toggleTrophies();
  console.log("OPEN visible=" + !document.getElementById("trophies").classList.contains("hidden") + " freezes=" + anyPanelOpen());
  const hp0 = player.hp; for (let i = 0; i < 6; i++) loop();
  console.log("FROZEN hpUnchanged=" + (player.hp === hp0));
  toggleTrophies();
  console.log("CLOSE freezes=" + anyPanelOpen());
})();
