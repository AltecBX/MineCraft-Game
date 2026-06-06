// Verify entities fall with gravity when the ground under them is removed.
(function () {
  // pick a tamed cat, lift it 6 blocks above its surface, then let physics run
  const c = cats[0];
  const gy = surfaceY(c.g.position.x, c.g.position.z);
  c.g.position.y = gy + 6;
  c.tamed = true; c.mode = "stay"; c.stay = { x: c.g.position.x, z: c.g.position.z };
  const y0 = c.g.position.y;
  for (let i = 0; i < 40; i++) loop();
  const y1 = c.g.position.y;
  console.log("CAT_FELL start=" + y0.toFixed(2) + " end=" + y1.toFixed(2) + " landed=" + (Math.abs(y1 - gy) < 0.2) + " moved=" + (y1 < y0 - 1));

  // mouse gravity too (drive fallToGround directly so wander doesn't relocate it mid-fall)
  const m = mice[0];
  const mgy = surfaceY(m.g.position.x, m.g.position.z);
  m.g.position.y = mgy + 5;
  const my0 = m.g.position.y;
  for (let i = 0; i < 40; i++) fallToGround(m, 0.05);
  console.log("MOUSE_FELL start=" + my0.toFixed(2) + " end=" + m.g.position.y.toFixed(2) + " landed=" + (Math.abs(m.g.position.y - mgy) < 0.2));
})();
