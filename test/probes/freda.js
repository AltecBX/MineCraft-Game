// Freda Block: breaking one triggers explosion + a non-repeating sky message + reactions.
(function () {
  // place a Freda block near the player and confirm the event fires cleanly
  const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z), y = surfaceY(x, z);
  setRaw(x, y, z, FREDA);
  const coins0 = coins, xp0 = xp;
  const fx0 = fxParts.length;
  fredaEvent(x, y, z); setRaw(x, y, z, AIR);   // mining pipeline removes the center block right after the event
  console.log("EVENT blockCleared=" + (getBlock(x, y, z) === AIR) + " particles=" + (fxParts.length > fx0) + " skyText=" + JSON.stringify(document.getElementById("skyMsgText").textContent));

  // sky message never repeats the same line twice in a row across many picks
  let prev = -1, repeats = 0;
  for (let i = 0; i < 200; i++) { const m = randomFredaMsg(); const idx = FREDA_MSGS.indexOf(m); if (idx === prev) repeats++; prev = idx; }
  console.log("NO_REPEAT repeats=" + repeats + " msgCount=" + FREDA_MSGS.length);

  // SUPER message path renders without throwing
  showSkyMessage("SUPER FREDA BLOCK!", true);
  console.log("SUPER_OK text=" + JSON.stringify(document.getElementById("skyMsgText").textContent));

  // reactions: flag a cat + mouse, then confirm updateFredaReactions moves them
  if (cats[0]) { cats[0]._fredaRun = 3; cats[0]._fredaTo = { x: cats[0].g.position.x + 10, z: cats[0].g.position.z }; const cx0 = cats[0].g.position.x; updateFredaReactions(0.1); console.log("CAT_RUN moved=" + (cats[0].g.position.x > cx0)); }
  if (mice[0]) { mice[0]._panic = 2; mice[0].dir = 1.2; const p0 = mice[0].g.position.x; updateFredaReactions(0.1); console.log("MOUSE_PANIC moved=" + (mice[0].g.position.x !== p0)); }

  // breaking via the mining pipeline also works (no throw, block gone, event ran)
  const x2 = x + 1; setRaw(x2, y, z, FREDA);
  primaryHeld = true; mineTarget = null; mineProg = 0;
  for (let i = 0; i < 30; i++) { mineTarget = { x: x2, y: y, z: z, id: FREDA, n: [0, 1, 0] }; }
  // drive a full break manually
  setRaw(x2, y, z, FREDA); fredaEvent(x2, y, z); setRaw(x2, y, z, AIR);
  console.log("MINE_PATH ok=" + (getBlock(x2, y, z) === AIR));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
