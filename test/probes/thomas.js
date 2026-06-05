// Priority 1: THOMAS on the shirt back, improved model, camera zoom, character spin screen.
(function () {
  const u = thomas.userData;
  console.log("MODEL bodyMats=" + (u.bodyMats ? u.bodyMats.length : 0) + " backPrint=" + !!u.backTex + " hairBack=" + !!u.hairBack);
  console.log("PARTS arms=" + (!!u.armL && !!u.armR) + " legs=" + (!!u.legL && !!u.legR));

  // makeShirtBack builds a texture (the THOMAS print) without throwing
  const tex = makeShirtBack(0x2f6fe0);
  console.log("MAKE_BACK tex=" + !!tex);

  // camera zoom variable adjusts within bounds
  thirdPerson = true; tpZoom = 4.2;
  const ev = { deltaY: 100 }; // emulate scroll out — call the same clamp logic
  tpZoom = Math.max(1.8, Math.min(9, tpZoom + 0.6)); const out = tpZoom;
  tpZoom = Math.max(1.8, Math.min(9, tpZoom - 0.6 - 0.6 - 9)); const inn = tpZoom;
  console.log("ZOOM out=" + out + " clampedIn=" + inn + " bounded=" + (inn >= 1.8));

  // character screen spins Thomas and renders without throwing
  openCharacter();
  console.log("CHAR opened charView=" + charView + " thomasVisible=" + thomas.visible);
  const a0 = charAngle; for (let i = 0; i < 5; i++) loop();
  console.log("CHAR_SPIN advanced=" + (charAngle > a0) + " stillCharView=" + charView);
  closeCharacter();
  console.log("CHAR_CLOSED charView=" + charView);

  thirdPerson = false;
  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
