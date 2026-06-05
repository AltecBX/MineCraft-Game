// Stage 5: polish + performance (level-up celebration, particle cap, save robustness).
(function () {
  // level-up celebration fires and grants skill points without throwing
  const lv = level;
  addXP(10000);
  console.log("LEVELUP from=" + lv + " to=" + level + " skillPts=" + skills.pts);

  // particle cap keeps fxParts bounded even under spam (mobile safety)
  for (let i = 0; i < 300; i++) hitSpark({ x: 0, y: 40, z: 0 }, 0xffffff);
  console.log("FX_CAP fxParts=" + fxParts.length + " bounded=" + (fxParts.length <= FX_CAP + 6));

  // placed Bounce Block is recorded as an edit so it survives save/continue
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z), gy = surfaceY(px, pz);
  setRaw(px, gy, pz, BOUNCE); recordEdit(px, gy, pz, BOUNCE);
  console.log("EDIT_RECORDED bounceSaved=" + (editsByDim.overworld.get(px + "," + gy + "," + pz) === BOUNCE));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK level=" + level);
})();
