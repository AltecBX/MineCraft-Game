// Mushroom Kingdom stage: portal placement, cast, foes, coins, stomp, question blocks, Bowser.
(function () {
  // portal in the overworld, far from spawn / fire / creature valley
  loadDimension("overworld");
  let marioCell = null, fireCell = null;
  for (const k in portalDest) { const p = k.split(",").map(Number); if (portalDest[k] === "mario" && !marioCell) marioCell = p; if (portalDest[k] === "fire" && !fireCell) fireCell = p; }
  const dSpawn = Math.hypot(marioCell[0], marioCell[2]), dFire = Math.hypot(marioCell[0] - fireCell[0], marioCell[2] - fireCell[2]);
  const dValley = Math.hypot(marioCell[0] - CV_X, marioCell[2] - CV_Z);
  console.log("DOOR far=" + (dSpawn > 60 && dFire > 60 && dValley > 100) + " spawn=" + dSpawn.toFixed(0) + " fire=" + dFire.toFixed(0) + " valley=" + dValley.toFixed(0));

  // stage loads with the full cast and villains
  loadDimension("mario");
  const names = marioNPCs.map(n => n.name), foes = marioFoes.map(f => f.name);
  const wantN = ["Mario", "Luigi", "Peach", "Toad", "Toadette", "Daisy", "Pauline", "Toadsworth", "Birdo", "Yoshi", "Donkey Kong", "Diddy Kong", "Cranky Kong", "Rosalina", "Foreman Spike", "Fawful"];
  const wantF = ["Bowser", "Bowser Jr.", "Kamek", "Larry", "Morton", "Wendy", "Iggy", "Roy", "Lemmy", "Ludwig", "Wario", "Waluigi", "King Boo", "Petey Piranha", "King Bob-omb", "Nabbit", "Shy Guy"];
  console.log("CAST npcs=" + marioNPCs.length + " missingN=" + JSON.stringify(wantN.filter(n => names.indexOf(n) < 0)));
  console.log("FOES count=" + marioFoes.length + " missingF=" + JSON.stringify(wantF.filter(n => foes.indexOf(n) < 0)) + " cappy=" + !!cappy);

  // coins collect on touch
  const c0 = coins, n0 = marioCoins.length;
  player.pos.set(marioCoins[0].mesh.position.x, marioCoins[0].mesh.position.y, marioCoins[0].mesh.position.z);
  updateMario(0.05);
  console.log("COIN collected=" + (marioCoins.length < n0) + " coinsUp=" + (coins > c0) + " counted=" + (marioQ.coinsGot > 0));

  // stomp kills a Shy Guy and counts toward DK's quest
  const sg = marioFoes.find(f => f.name === "Shy Guy"); const st0 = marioQ.stomps;
  player.pos.set(sg.g.position.x, sg.g.position.y + 1.6, sg.g.position.z); player.vel.y = -6;
  updateMario(0.05);
  console.log("STOMP counted=" + (marioQ.stomps > st0) + " hurt=" + (sg.hp < sg.max));

  // dialogue works without throwing
  player.pos.set(marioNPCs[0].g.position.x + 1, marioNPCs[0].g.position.y, marioNPCs[0].g.position.z);
  console.log("TALK handled=" + marioInteract());

  // question block pop grants something (coins burst, powerup, or snack)
  const cc0 = marioCoins.length, pu0 = powerups.star + powerups.mega, ap0 = countItem(I_APPLE);
  qblockPop(2, surfaceY(2, 2) + 4, 2);
  console.log("QBLOCK gave=" + (marioCoins.length > cc0 || powerups.star + powerups.mega > pu0 || countItem(I_APPLE) > ap0));

  // Bowser defeat path: drops coins, sets the flag
  const bw = marioFoes.find(f => f.name === "Bowser"); bw.hp = 1;
  player.pos.set(bw.g.position.x, bw.g.position.y + 2.2, bw.g.position.z); player.vel.y = -6;
  updateMario(0.05);
  console.log("BOWSER down=" + marioQ.bowser + " gone=" + !marioFoes.some(f => f.name === "Bowser"));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
