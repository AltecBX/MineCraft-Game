// renderer probe: chunk build cost, light values, mesh contents, env uniforms
const t0 = performance.now(); let n = 0;
for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) { buildChunk(cx, cz); n++; }
const dtb = performance.now() - t0;
console.log('built', n, 'chunks in', dtb.toFixed(1), 'ms =', (dtb / n).toFixed(2), 'ms/chunk');
const t1 = performance.now(); for (let i = 0; i < 20; i++) buildChunk(0, 0); console.log('rebuild', ((performance.now() - t1) / 20).toFixed(2), 'ms');
let verts = 0, cut = 0, wat = 0;
for (const c of chunks.values()) { if (c.opaque) verts += c.opaque.geometry.attributes.position.array.length / 3; if (c.cutout) cut += c.cutout.geometry.attributes.position.array.length / 3; if (c.water) wat += c.water.geometry.attributes.position.array.length / 3; }
console.log('verts opaque', verts, 'cutout', cut, 'water', wat);
// light sanity: open sky above the surface, darkness deep underground, torch light near a torch
const sx = 5, sz = 5, sy = surfaceY(sx, sz);
console.log('surface y', sy, 'sky above', lightAt(sx, sy + 1, sz), 'sky deep', lightAt(sx, 4, sz));
setRaw(sx, sy + 3, sz, TORCH); markDirty(sx, sz); buildChunk(0, 0);
console.log('block light at torch', blockLightAt(sx, sy + 3, sz), '2 away', blockLightAt(sx + 2, sy + 3, sz), '8 away', blockLightAt(sx + 8, sy + 3, sz));
// overhang: roof over a column
for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) setRaw(sx + dx, sy + 4, sz + dz, STONE);
setRaw(sx, sy + 3, sz, AIR); buildChunk(0, 0);
console.log('under roof centre', lightAt(sx, sy + 1, sz), 'roof edge', lightAt(sx + 3, sy + 1, sz), 'outside', lightAt(sx + 5, sy + 1, sz));
const oa = chunks.get(ck(0, 0)).opaque.geometry.attributes.aLight.array; let mn = 255, mx = 0; for (let i = 0; i < oa.length; i += 4) { mn = Math.min(mn, oa[i]); mx = Math.max(mx, oa[i]); }
console.log('ao byte range', mn, mx, 'dirtyLow', dirtyLow.size);
DEV.time(0.5); updateDayNight(0); updateEnv(0.016); console.log('noon light', U.uLightCol.value.r.toFixed(2), 'zenith', U.uZenith.value.b.toFixed(2), 'fog', U.uFogNear.value, U.uFogFar.value);
DEV.time(0.0); updateDayNight(0); updateEnv(0.016); console.log('midnight light', U.uLightCol.value.r.toFixed(3), 'stars', skyU.uStars.value.toFixed(2));
// getBlock parity with the W map for integer and fractional coords
let bad = 0; for (const [k, id] of W) { const p = k.split(','); if (getBlock(+p[0], +p[1], +p[2]) !== id) { bad++; if (bad < 3) console.log('mismatch', k, id, getBlock(+p[0], +p[1], +p[2])); } }
console.log('getBlock mismatches', bad, 'of', W.size, 'fractional', getBlock(0.5, 10, 0.5));
