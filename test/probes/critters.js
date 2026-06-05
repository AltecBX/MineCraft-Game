// Batch: special cats, ninja mice, Cheese King.
(function () {
  // a forced rare wild cat gets a name, glow, and higher level
  let rareCat = null;
  for (let i = 0; i < 200 && !rareCat; i++) { spawnCat(20 + i, 20, {}); const c = cats[cats.length - 1]; if (c.rare) rareCat = c; }
  console.log("RARE_CAT found=" + !!rareCat + " name=" + (rareCat && rareCat.name) + " level=" + (rareCat && rareCat.level));

  // Cheese King + golden mouse variants exist
  let cheese = null, golden = null;
  for (let i = 0; i < 400 && (!cheese || !golden); i++) { spawnMouse(40 + i, 40); const m = mice[mice.length - 1]; if (m.cheese && !cheese) cheese = m; if (m.golden && !golden) golden = m; }
  console.log("MOUSE_VARIANTS cheese=" + !!cheese + " golden=" + !!golden);

  // catching the Cheese King gives a big reward + achievement
  const coinsB = coins; mouseCaught(cheese);
  console.log("CHEESE_CAUGHT coinsGained=" + (coins - coinsB) + " ach=" + ach.has("cheeseking"));

  // ninja mouse: darts at Thomas, steals coins, then flees; catching recovers + bonus
  coins = 10; updateCoinUI();
  let nm = mice.find(m => m.ninja && !m.stolen);
  for (let i = 0; i < 400 && !nm; i++) { spawnMouse(60 + i, 60); const m = mice[mice.length - 1]; if (m.ninja) nm = m; }
  nm.g.position.set(player.pos.x + 2, player.pos.y, player.pos.z);     // start a couple blocks away
  for (let i = 0; i < 60 && !nm.stolen; i++) updateAnimals(0.05);       // let it dart in and steal
  console.log("NINJA isNinja=" + nm.ninja + " stole=" + (nm.steal || 0) + " stolen=" + nm.stolen + " coinsNow=" + coins);
  const cb = coins; mouseCaught(nm); console.log("NINJA_CAUGHT recovered=" + (coins - cb) + " ach=" + ach.has("ninja"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK miceCount=" + mice.length);
})();
