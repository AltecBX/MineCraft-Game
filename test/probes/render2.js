// cycle dimensions, edit blocks, time of day, and gfx tiers while running frames; any throw fails the harness
const dims = ['overworld', 'fire', 'end', 'sky', 'realm', 'mario', 'overworld'];
for (const d of dims) {
  loadDimension(d);
  for (let i = 0; i < 12; i++) loop();
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z), sy = surfaceY(px + 2, pz);
  setRaw(px + 2, sy, pz, TORCH); markDirty(px + 2, pz); setRaw(px + 3, sy - 1, pz, AIR); markDirty(px + 3, pz);
  for (let i = 0; i < 6; i++) loop();
  let n = 0; for (const c of chunks.values()) if (c.opaque || c.cutout || c.water) n++;
  console.log(d, 'chunks', chunks.size, 'meshed', n, 'dirty', dirty.size, 'low', dirtyLow.size, 'sky@cam', lightAt(camera.position.x, camera.position.y, camera.position.z), 'fog', U.uFogNear.value.toFixed(1), U.uFogFar.value.toFixed(1), 'mode', skyU.uMode.value);
}
for (const t of [0, 0.25, 0.5, 0.75]) { timeOfDay = t; updateDayNight(0); updateEnv(0.016); console.log('t', t, 'light', U.uLightCol.value.r.toFixed(2), U.uLightCol.value.g.toFixed(2), U.uLightCol.value.b.toFixed(2), 'exposure', POST.exposure.toFixed(2)); }
for (const g of ['low', 'med', 'high', 'ultra', 'high']) { settings.gfx = g; applyGfx(); for (let i = 0; i < 3; i++) loop(); console.log('gfx', g, 'post', POST.on, 'clouds', skyMat.defines.CLOUD_STEPS, 'fancy', fancyLeaves); }
// underwater camera
const wx = 115, wz = -77; ensureGen(wx, wz, 4); player.pos.set(wx + 0.5, SEA - 1, wz + 0.5); for (let i = 0; i < 4; i++) loop();
console.log('underwater', envLocal.water, 'fogFar', U.uFogFar.value);
