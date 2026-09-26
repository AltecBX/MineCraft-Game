/* villages.js: Villages: layout and chunk clipped building.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- VILLAGES: one possible village per 144 block cell, laid out deterministically and built chunk by chunk ----------
const VCELL = 144, villageCache = new Map();
const VKEEP = [[86, -54, 26], [-30, -84, 10], [8, 0, 10], [-64, 36, 10], [0, 0, 20]];   // landmarks villages must not overlap (Creature Valley, portals, spawn camp)
const VJOBS = ["farmer", "smith", "fletcher", "mason", "farmer", "cleric", "fletcher", "smith", "mason"];
function villageInCell(gx, gz) {
  const key = gx + "," + gz; if (villageCache.has(key)) return villageCache.get(key);
  let v = null;
  const home = Math.abs(gx) <= 1 && Math.abs(gz) <= 1;                // cells around spawn try hard so a village is within a short walk
  const tries = home ? 24 : 4;
  if (home || hsh(gx * 31 + 7, gz * 17 + 3) > 0.35) for (let t = 0; t < tries && !v; t++) {
    const cx = gx * VCELL + 40 + Math.floor(hsh(gx * 5 + 1 + t * 13, gz * 9 + 2) * 64), cz = gz * VCELL + 40 + Math.floor(hsh(gx * 7 + 3, gz * 3 + 4 + t * 17) * 64);
    const gy = heightAt(cx, cz), b = biomeAt(cx, cz);
    let ok = gy > SEA + 1 && gy < SEA + 13 && b.t <= 0.66 && Math.hypot(cx, cz) > 44 && !VKEEP.some(([kx, kz, kr]) => Math.hypot(cx - kx, cz - kz) < 30 + kr);
    if (ok) { let lo = 99, hi = -99; for (let a = 0; a < 12 && ok; a++) for (const r of [6, 13, 20]) { const px = cx + Math.round(Math.cos(a / 12 * 6.283) * r), pz = cz + Math.round(Math.sin(a / 12 * 6.283) * r), hh = heightAt(px, pz); lo = Math.min(lo, hh); hi = Math.max(hi, hh); if (riverAt(px, pz) > 0) ok = false; } if (hi - lo > 9 || lo <= SEA) ok = false; }
    if (ok) v = layoutVillage(gx, gz, cx, cz, gy);
  }
  villageCache.set(key, v); return v;
}
function villageNear(x, z, margin) { const v = villageInCell(Math.floor(x / VCELL), Math.floor(z / VCELL)); return !!v && Math.hypot(x - v.cx, z - v.cz) < v.r + margin; }
function layoutVillage(gx, gz, cx, cz, gy) {
  const seed = gx * 7919 + gz * 104729 + 17, houses = [], n = 4 + Math.floor(hsh(seed, 1) * 4);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + hsh(seed, i + 10) * 0.45, rad = 13 + hsh(seed, i + 20) * 7, big = hsh(seed, i + 30) > 0.55, w = big ? 7 : 5, d = big ? 7 : 5;
    const hx = Math.round(cx + Math.cos(ang) * rad), hz = Math.round(cz + Math.sin(ang) * rad), x0 = hx - (w >> 1), z0 = hz - (d >> 1);
    if (houses.some(o => x0 < o.x0 + o.w + 2 && x0 + w + 2 > o.x0 && z0 < o.z0 + o.d + 2 && z0 + d + 2 > o.z0)) continue;
    const dx = cx - hx, dz = cz - hz, face = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3);   // wall that faces the well: +x, -x, +z, -z
    const door = face === 0 ? [x0 + w - 1, z0 + (d >> 1)] : face === 1 ? [x0, z0 + (d >> 1)] : face === 2 ? [x0 + (w >> 1), z0 + d - 1] : [x0 + (w >> 1), z0];
    const out = face === 0 ? [door[0] + 1, door[1]] : face === 1 ? [door[0] - 1, door[1]] : face === 2 ? [door[0], door[1] + 1] : [door[0], door[1] - 1];
    houses.push({ x0, z0, w, d, face, door, out, hb: heightAt(hx, hz), job: VJOBS[houses.length % VJOBS.length], roof: hsh(seed, i + 40) > 0.5 ? BRICK : PLANKS });
  }
  // a small farm on the emptiest side of the ring
  let farm = null;
  for (let k = 0; k < 8 && !farm; k++) {
    const a = k / 8 * 6.283 + 0.4, fx = Math.round(cx + Math.cos(a) * 12) - 4, fz = Math.round(cz + Math.sin(a) * 12) - 2;
    if (!houses.some(o => fx < o.x0 + o.w + 2 && fx + 10 > o.x0 && fz < o.z0 + o.d + 2 && fz + 7 > o.z0)) farm = { x0: fx, z0: fz, w: 9, d: 5 };
  }
  return { gx, gz, cx, cz, gy, houses, farm, r: 27, lamps: [[cx - 6, cz - 6], [cx + 6, cz - 6], [cx - 6, cz + 6], [cx + 6, cz + 6]], spawned: false, found: false };
}
function inHouse(v, x, z, pad) { for (const h of v.houses) if (x >= h.x0 - pad && x < h.x0 + h.w + pad && z >= h.z0 - pad && z < h.z0 + h.d + pad) return h; return null; }
function buildVillagePart(v, x0, z0) {
  const inC = (x, z) => x >= x0 && x < x0 + CH && z >= z0 && z < z0 + CH;
  const P = (x, y, z, id) => { if (inC(x, z)) setRaw(x, y, z, id); };
  const top = (x, z) => heightAt(x, z);
  const paveAt = (x, z) => { if (!inC(x, z) || inHouse(v, x, z, 0)) return; const y = top(x, z); if (y <= SEA) return; for (let yy = y + 1; yy < y + 4; yy++) if (BLOCKS[getBlock(x, yy, z)] && !BLOCKS[getBlock(x, yy, z)].opaque) setRaw(x, yy, z, AIR); setRaw(x, y, z, PATH); };
  // plaza and paths to every door
  for (let x = v.cx - 6; x <= v.cx + 6; x++) for (let z = v.cz - 6; z <= v.cz + 6; z++) if (Math.hypot(x - v.cx, z - v.cz) < 6.3) paveAt(x, z);
  for (const h of v.houses) {
    const [tx, tz] = h.out, L = Math.hypot(tx - v.cx, tz - v.cz);
    for (let t = 0; t <= L; t += 0.5) { const px = Math.round(v.cx + (tx - v.cx) * t / L), pz = Math.round(v.cz + (tz - v.cz) * t / L); paveAt(px, pz); if (h.face < 2) paveAt(px, pz + 1); else paveAt(px + 1, pz); }
  }
  // the well: stone brick curb around water, four log posts and a plank roof
  { const y = v.gy;
    for (let x = v.cx - 1; x <= v.cx + 2; x++) for (let z = v.cz - 1; z <= v.cz + 2; z++) {
      const rim = x === v.cx - 1 || x === v.cx + 2 || z === v.cz - 1 || z === v.cz + 2;
      for (let yy = y - 3; yy <= y; yy++) P(x, yy, z, rim ? STONEBRICK : WATER);
      for (let yy = y + 1; yy <= y + 5; yy++) P(x, yy, z, AIR);
      if (rim) P(x, y + 1, z, STONEBRICK);
      if ((x === v.cx - 1 || x === v.cx + 2) && (z === v.cz - 1 || z === v.cz + 2)) { P(x, y + 2, z, WOOD); P(x, y + 3, z, WOOD); }
      P(x, y + 4, z, PLANKS);
    }
    P(v.cx, y + 5, v.cz, PLANKS); P(v.cx + 1, y + 5, v.cz + 1, PLANKS); P(v.cx + 1, y + 5, v.cz, PLANKS); P(v.cx, y + 5, v.cz + 1, PLANKS);
  }
  // lamp posts around the plaza
  for (const [lx, lz] of v.lamps) { const y = top(lx, lz); P(lx, y + 1, lz, WOOD); P(lx, y + 2, lz, WOOD); P(lx, y + 3, lz, LANTERN); }
  // houses
  for (const h of v.houses) {
    const hb = h.hb, W = h.w, D = h.d, smith = h.job === "smith";
    for (let x = h.x0 - 1; x < h.x0 + W + 1; x++) for (let z = h.z0 - 1; z < h.z0 + D + 1; z++) {
      if (!inC(x, z)) continue;
      const inside = x >= h.x0 && x < h.x0 + W && z >= h.z0 && z < h.z0 + D;
      for (let yy = hb + 1; yy < hb + 11; yy++) setRaw(x, yy, z, AIR);
      if (!inside) continue;
      const t0 = top(x, z); for (let yy = Math.min(t0, hb) - 1; yy < hb; yy++) setRaw(x, yy, z, COBBLE);
      setRaw(x, hb, z, smith ? STONEBRICK : PLANKS);
      const edgeX = x === h.x0 || x === h.x0 + W - 1, edgeZ = z === h.z0 || z === h.z0 + D - 1;
      if (edgeX || edgeZ) for (let yy = hb + 1; yy <= hb + 4; yy++) {
        const corner = edgeX && edgeZ, midX = x === h.x0 + (W >> 1), midZ = z === h.z0 + (D >> 1);
        let id = corner ? WOOD : (yy === hb + 1 ? (smith ? STONEBRICK : COBBLE) : smith ? STONEBRICK : PLANKS);
        if (!corner && yy === hb + 2 && ((edgeX && (midZ || (D > 5 && Math.abs(z - (h.z0 + (D >> 1))) === 2))) || (edgeZ && (midX || (W > 5 && Math.abs(x - (h.x0 + (W >> 1))) === 2))))) id = GLASS;
        if (x === h.door[0] && z === h.door[1] && yy <= hb + 2) id = AIR;
        setRaw(x, yy, z, id);
      }
    }
    // stepped roof with an overhang
    for (let k = 0; ; k++) {
      const ax = h.x0 - 1 + k, bx = h.x0 + W + 1 - k, az = h.z0 - 1 + k, bz = h.z0 + D + 1 - k;
      if (bx - ax < 1 || bz - az < 1) break;
      for (let x = ax; x < bx; x++) for (let z = az; z < bz; z++) P(x, hb + 5 + k, z, h.roof);
      if (bx - ax <= 2 || bz - az <= 2) break;
    }
    // interior: a hanging lantern, a bed, a job block and a supply chest
    const ix = h.x0 + 1, iz = h.z0 + 1, jx = h.x0 + W - 2, jz = h.z0 + D - 2;
    P(h.x0 + (W >> 1), hb + 4, h.z0 + (D >> 1), LANTERN);
    P(ix, hb + 1, iz, BED);
    P(jx, hb + 1, iz, h.job === "smith" ? FURNACE : h.job === "farmer" ? HAY : h.job === "mason" ? STONEBRICK : h.job === "fletcher" ? CRAFT_TABLE : BOUNCE);
    if (inC(jx, jz) && !(jx === h.door[0] && jz === h.door[1])) {
      setRaw(jx, hb + 1, jz, CHEST);
      const key = "overworld:" + bk(jx, hb + 1, jz);
      try { if (!chestStore.has(key)) chestStore.set(key, villageLoot(h.job, v.gx * 31 + v.gz * 17 + jx)); } catch (e) {}
    }
    const [ox, oz] = h.out; if (inC(ox, oz)) { const y = top(ox, oz); if (getBlock(ox, y + 1, oz) === AIR && y >= hb - 1) setRaw(ox, y + 1, oz, AIR); }
  }
  // farm: log border, dirt rows of crops, a water channel and hay bales
  if (v.farm) { const f = v.farm, y = top(f.x0 + 4, f.z0 + 2);
    for (let x = f.x0; x < f.x0 + f.w; x++) for (let z = f.z0; z < f.z0 + f.d; z++) {
      if (!inC(x, z)) continue;
      for (let yy = y + 1; yy < y + 4; yy++) setRaw(x, yy, z, AIR);
      const t0 = top(x, z); for (let yy = Math.min(t0, y) - 1; yy < y; yy++) setRaw(x, yy, z, DIRT);
      const border = x === f.x0 || x === f.x0 + f.w - 1 || z === f.z0 || z === f.z0 + f.d - 1;
      if (border) setRaw(x, y, z, WOOD); else if (x === f.x0 + 4) setRaw(x, y, z, WATER); else { setRaw(x, y, z, DIRT); if (hsh(x * 3, z * 7) > 0.12) setRaw(x, y + 1, z, TALLGRASS); }
    }
    P(f.x0 - 1, y + 1, f.z0, HAY); P(f.x0 - 1, y + 1, f.z0 + 1, HAY); P(f.x0 - 1, y + 2, f.z0, HAY);
  }
}
function villageLoot(job, seed) {
  const r = k => hsh(seed, k);
  const L = { farmer: [{ id: I_BREAD, count: 3 + Math.floor(r(1) * 3) }, { id: I_APPLE, count: 2 }, { id: HAY, count: 2 }],
    smith: [{ id: I_IRON, count: 2 + Math.floor(r(2) * 3) }, { id: I_COAL, count: 4 }, r(3) > 0.7 ? { id: I_DIAMOND, count: 1 } : { id: I_BREAD, count: 2 }],
    mason: [{ id: STONEBRICK, count: 12 }, { id: GLASS, count: 6 }, { id: LANTERN, count: 2 }],
    cleric: [{ id: I_GAPPLE, count: 1 }, { id: I_APPLE, count: 3 }, { id: TORCH, count: 6 }],
    fletcher: [{ id: I_ARROW, count: 8 + Math.floor(r(4) * 8) }, { id: I_FEATHER, count: 4 }, { id: I_FLINT, count: 3 }, r(5) > 0.6 ? { id: I_BOW, count: 1 } : { id: I_STRING, count: 3 }] }[job] || [{ id: I_BREAD, count: 2 }];
  const out = new Array(9).fill(null); L.forEach((s, i) => { out[i] = newStack(s.id, s.count); }); return out;
}
function boulder(x, y, z) {                                    // a small mossy boulder dropped on open ground
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 2 || (dy === 1 && (dx || dz))) continue;
    if (hsh(x + dx * 7 + dy, z + dz * 5) < 0.2) continue;
    const id = getBlock(x + dx, y + dy, z + dz); if (id === AIR || id === GRASS || id === DIRT || id === TALLGRASS) setRaw(x + dx, y + dy, z + dz, hsh(x * dx + 3, z * dz + dy) > 0.55 ? COBBLE : STONE);
  }
}
function bush(x, y, z) { if (getBlock(x, y, z) === AIR) setRaw(x, y, z, LEAVES); if (hsh(x * 5, z * 3) > 0.6 && getBlock(x, y + 1, z) === AIR) setRaw(x, y + 1, z, LEAVES); }
function giantMushroom(x, y, z) {   // mushroom-forest landmark: a pale stem topped with a red cap
  const th = 3 + (hsh(x * 2 + 1, z * 2 + 5) * 3 | 0);
  for (let i = 0; i < th; i++) setRaw(x, y + i, z, PLANKS);
  const top = y + th;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; if (getBlock(x + dx, top, z + dz) === AIR) setRaw(x + dx, top, z + dz, MUSHROOM); }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (getBlock(x + dx, top + 1, z + dz) === AIR) setRaw(x + dx, top + 1, z + dz, MUSHROOM);
}
