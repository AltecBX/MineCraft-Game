// Sky Islands: dimension, floating terrain, portal routing, and the Sky Serpent boss.
(function () {
  // a sky portal appears in the overworld only after the Fire Guardian is beaten
  fireBossDown = true; loadDimension("overworld");
  let skyPortal = false; for (const k in portalDest) if (portalDest[k] === "sky") skyPortal = true;
  console.log("OVERWORLD_PORTALS sky=" + skyPortal + " fire=" + Object.values(portalDest).includes("fire"));

  // enter the sky dimension
  loadDimension("sky");
  console.log("SKY dim=" + DIM + " gravity=" + gravity + " boss=" + !!skyBoss + " returnPortal=" + Object.values(portalDest).includes("overworld"));

  // floating islands generated (spawn island has solid ground near origin; void far out)
  let solidNearOrigin = 0; for (let y = 28; y <= 36; y++) if (isSolidBlock(getBlock(0, y, 0))) solidNearOrigin++;
  console.log("ISLANDS spawnGround=" + (solidNearOrigin > 0));

  // boss intro grace, then it acts; killing it rewards the Glide Cape
  const hp0 = skyBoss.hp; for (let i = 0; i < 40; i++) updateSkyBoss(0.1);
  console.log("BOSS_INTRO_OVER introDone=" + (skyBoss.intro <= 0));
  skyBoss.hp = -1; updateSkyBoss(0.1);
  console.log("BOSS_DEAD gone=" + (skyBoss === null) + " glide=" + powerActive("glide") + " ach=" + ach.has("skyboss"));

  // sky monsters spawn (ghosts/crawlers)
  const mb = monsters.length; for (let i = 0; i < 200 && monsters.length <= mb; i++) { spawnTimer = -1; updateMonsters(0.1); }
  console.log("SKY_SPAWN monstersAppear=" + (monsters.length > 0));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK dim=" + DIM);
})();
