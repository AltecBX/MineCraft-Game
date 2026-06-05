// Mobile fixes: respawn reliability, input clearing, minimap render.
(function () {
  console.log("HELPERS tapBtn=" + (typeof tapBtn) + " doRespawn=" + (typeof doRespawn) + " clearInputState=" + (typeof clearInputState));

  // clearInputState resets lingering touch/hold state
  primaryHeld = true; touch.jump = true; touch.sprint = true; touch.mag = 1; input.fwd = 1; input.str = -1;
  clearInputState();
  console.log("CLEAR primaryHeld=" + primaryHeld + " jump=" + touch.jump + " fwd=" + input.fwd + " mag=" + touch.mag);

  // die() stops the game and clears input; doRespawn brings it back with a grace window
  primaryHeld = true; player.hp = 0; die();
  console.log("DIE running=" + running + " primaryHeld=" + primaryHeld);
  doRespawn();
  console.log("RESPAWN running=" + running + " hp=" + player.hp + " grace=" + (player.hurtCd > 0) + " paused=" + paused);

  // minimap renders (including the enlarged state) without throwing
  drawMinimap();
  mmBig = true; drawMinimap(); mmBig = false;
  console.log("MINIMAP rendered res=" + mmCv.width);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK running=" + running);
})();
