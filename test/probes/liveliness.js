// Ground pound, proximity name tags, and living creature behavior.
(function () {
  // ground pound: airborne dodge slams down; landing shockwave hurts nearby foes
  loadDimension("mario");
  player.onGround = false; player._pound = false; player.stam = 100; dodge.cd = 0;
  startDodge();
  console.log("POUND armed=" + player._pound + " slamVel=" + (player.vel.y < -20));
  const sg = marioFoes.find(f => f.name === "Shy Guy");
  player.pos.set(sg.g.position.x + 1, sg.g.position.y, sg.g.position.z); player.onGround = true;
  const hp0 = sg.hp; updateMario(0.05);
  console.log("SHOCKWAVE hurt=" + (sg.hp < hp0) + " cleared=" + !player._pound);

  // tags: visible near, hidden far
  const n0 = marioNPCs[0];
  player.pos.set(n0.g.position.x + 2, n0.g.position.y, n0.g.position.z); updateMario(0.05);
  const nearVis = n0.tag.visible;
  player.pos.set(n0.g.position.x + 40, n0.g.position.y, n0.g.position.z); updateMario(0.05);
  console.log("TAGS nearVisible=" + nearVis + " farHidden=" + !n0.tag.visible);

  // creatures develop living behavior states over time
  loadDimension("realm");
  player.pos.set(200, surfaceY(200, 200), 200);        // far away so shy-flee does not override
  for (let i = 0; i < 200; i++) updateRealm(0.05);
  const behs = new Set(realmCreatures.filter(c => !c.fly).map(c => c.beh).filter(Boolean));
  console.log("BEHAVIOR states=" + JSON.stringify([...behs]) + " varied=" + (behs.size >= 2));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
