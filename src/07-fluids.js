/* fluids.js: Flowing water and lava.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- FLUIDS: water and lava spread, fall, drain, form springs and harden where they meet ----------
// Levels live in FSTORE (0 source, 1..7 flowing, 8 falling). Changed cells queue their neighbours; each fluid
// ticks at its own pace (water fast, lava slow) with a per tick budget. Only edits wake fluids, so generated
// oceans and lakes stay still until Thomas digs next to them.
const FLUID = { [WATER]: { step: 1, max: 7, tick: 0.25 }, [LAVA]: { step: 2, max: 6, tick: 0.9 } };
const fluidQ = { [WATER]: new Set(), [LAVA]: new Set() }, fluidT = { [WATER]: 0, [LAVA]: 0 };
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const fk = (x, y, z) => ((x + 32768) * 65536 + (z + 32768)) * 64 + y;
function clearFluidQueues() { fluidQ[WATER].clear(); fluidQ[LAVA].clear(); }
function fluidReplaceable(id) { return id === AIR || id === TALLGRASS || id === TORCH; }
function colLoaded(x, z) { return CSTORE.has(cnum(x >> 4, z >> 4)); }
function queueFluid(x, y, z) { if (y < 0 || y >= WORLD_H) return; const id = getBlock(x, y, z); if (id === WATER || id === LAVA) fluidQ[id].add(fk(x, y, z)); }
function fluidNotify(x, y, z) { queueFluid(x, y, z); queueFluid(x + 1, y, z); queueFluid(x - 1, y, z); queueFluid(x, y, z + 1); queueFluid(x, y, z - 1); queueFluid(x, y + 1, z); queueFluid(x, y - 1, z); }
function markAround(x, z) { markDirty(x, z); markDirty(x + 1, z); markDirty(x - 1, z); markDirty(x, z + 1); markDirty(x, z - 1); }
// write a fluid change: remesh, remember it for saves, wake the neighbours
function fluidSet(x, y, z, id, lv) {
  if (y < 0 || y >= WORLD_H) return;
  const old = getBlock(x, y, z);
  if (old === TORCH && id !== TORCH) dropItemAt(x + 0.5, y + 0.4, z + 0.5, TORCH, 1);    // water and lava wash torches away
  setRaw(x, y, z, id); if (lv) setFlow(x, y, z, lv);
  const m = editsByDim[DIM], k = bk(x, y, z); if (m) m.set(k, id);
  const fm = flowEditsByDim[DIM]; if (fm) { if (lv) fm.set(k, lv); else fm.delete(k); }
  markAround(x, z); if (old === TORCH) rebuildTorchCells();
  fluidNotify(x, y, z);
}
let fizzT = 0;
function fizz(x, y, z) {                                         // a hiss and a small puff of steam, rate limited when many cells harden at once
  const now = performance.now(); if (now - fizzT < 150) return; fizzT = now;
  SFX.fizz();
  if (fxParts.length > FX_CAP - 10) return;
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(chipGeo, new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.3, depthWrite: false })); m.position.set(x + 0.2 + Math.random() * 0.6, y + 1, z + 0.2 + Math.random() * 0.6); m.scale.setScalar(1.5 + Math.random()); scene.add(m); fxParts.push({ mesh: m, life: 0.9, max: 0.9, smoke: 1, disposeMat: 1, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.1, (Math.random() - 0.5) * 0.3) }); }
}
function fluidTick(fid, x, y, z) {
  if (getBlock(x, y, z) !== fid || !colLoaded(x, z)) return;
  const F = FLUID[fid], lv = getFlow(x, y, z), other = fid === WATER ? LAVA : WATER;
  if (fid === LAVA) {                                            // lava touched by water hardens: sources to obsidian, flows to cobblestone
    for (const [dx, dz] of DIRS4) if (getBlock(x + dx, y, z + dz) === WATER) { fluidSet(x, y, z, lv === 0 ? OBSIDIAN : COBBLE, 0); fizz(x, y, z); return; }
    if (getBlock(x, y + 1, z) === WATER) { fluidSet(x, y, z, lv === 0 ? OBSIDIAN : COBBLE, 0); fizz(x, y, z); return; }
  }
  if (lv !== 0) {                                                // a flowing cell takes the level its neighbours can feed it, or drains
    let want = 99;
    if (getBlock(x, y + 1, z) === fid) want = 8;
    else {
      let srcN = 0;
      for (const [dx, dz] of DIRS4) { if (getBlock(x + dx, y, z + dz) !== fid) continue; const nl = getFlow(x + dx, y, z + dz); if (nl === 0) srcN++; want = Math.min(want, (nl >= 8 ? 0 : nl) + F.step); }
      if (fid === WATER && srcN >= 2) { const b = getBlock(x, y - 1, z); if (isSolidBlock(b) || (b === WATER && getFlow(x, y - 1, z) === 0)) want = 0; }   // a spring between two sources
      if (want > F.max) want = 99;
    }
    if (want === 99) { fluidSet(x, y, z, AIR, 0); return; }
    if (want !== lv) { fluidSet(x, y, z, fid, want); return; }
  }
  if (y === 0) return;
  const below = getBlock(x, y - 1, z);
  if (fluidReplaceable(below)) { fluidSet(x, y - 1, z, fid, 8); return; }              // falls before it spreads
  if (below === other) { if (fid === LAVA) { fluidSet(x, y - 1, z, STONE, 0); fizz(x, y - 1, z); } else queueFluid(x, y - 1, z); return; }
  if (below === fid && getFlow(x, y - 1, z) !== 0) return;                             // pours into the flow below instead
  const nl = (lv >= 8 ? 0 : lv) + F.step; if (nl > F.max) return;
  for (const [dx, dz] of DIRS4) {
    const nx = x + dx, nz = z + dz; if (!colLoaded(nx, nz)) continue;
    const id = getBlock(nx, y, nz);
    if (fluidReplaceable(id)) fluidSet(nx, y, nz, fid, nl);
    else if (id === fid) { const ol = getFlow(nx, y, nz); if (ol !== 0 && ol !== 8 && ol > nl) fluidSet(nx, y, nz, fid, nl); }
    else if (id === other) queueFluid(fid === WATER ? nx : x, y, fid === WATER ? nz : z);
  }
}
function updateFluids(dt) {
  for (const fid of [WATER, LAVA]) {
    fluidT[fid] -= dt; if (fluidT[fid] > 0) continue; fluidT[fid] = FLUID[fid].tick;
    const Q = fluidQ[fid]; if (!Q.size) continue;
    const batch = []; for (const k of Q) { batch.push(k); if (batch.length >= 500) break; }
    for (const k of batch) Q.delete(k);                          // cells woken during this tick run on the next one
    for (const k of batch) { const y = k % 64, t = (k - y) / 64, z = (t % 65536) - 32768, x = (t - (z + 32768)) / 65536 - 32768; fluidTick(fid, x, y, z); }
  }
}
// the push of a current: toward weaker (lower) neighbours and open drops
const _fv = new THREE.Vector3();
function flowVec(x, y, z) {
  _fv.set(0, 0, 0); x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (getBlock(x, y, z) !== WATER) return _fv;
  const lv = getFlow(x, y, z); if (lv === 0 || lv === 8) return _fv;
  for (const [dx, dz] of DIRS4) {
    const id = getBlock(x + dx, y, z + dz);
    if (id === WATER) { const l2 = getFlow(x + dx, y, z + dz), h2 = l2 >= 8 ? lv : l2; _fv.x += dx * (h2 - lv); _fv.z += dz * (h2 - lv); }
    else if (fluidReplaceable(id)) { _fv.x += dx * 2; _fv.z += dz * 2; }
  }
  const L = Math.hypot(_fv.x, _fv.z); if (L > 0) { _fv.x /= L; _fv.z /= L; }
  return _fv;
}
