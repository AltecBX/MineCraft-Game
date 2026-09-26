/* world.js: World store (W, CSTORE, FSTORE), noise, biomes, terrain and chunk generation.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- WORLD (global block map + chunked meshes) ----------
const CH = 16, WORLD_H = 56, SEA = 18;
let DIM = "overworld";
const W = new Map();              // "x,y,z" -> id
const generated = new Set();      // "cx,cz"
const chunks = new Map();         // "cx,cz" -> {opaque, water}
const dirty = new Set();
const bk = (x, y, z) => x + "," + y + "," + z;
// typed array mirror of W, one Uint8Array per 16x16 column, index (y*CH + lz)*CH + lx.
// W stays the source of truth for iteration; every write goes through setRaw so both always agree.
const CSTORE = new Map();
const CAREA = CH * CH;
const cnum = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
function getBlock(x, y, z) {
  if (y < 0 || y >= WORLD_H) return AIR;
  if ((x | 0) !== x || (y | 0) !== y || (z | 0) !== z) { const v = W.get(bk(x, y, z)); return v === undefined ? AIR : v; }
  const a = CSTORE.get(cnum(x >> 4, z >> 4)); return a ? a[y * CAREA + (z & 15) * CH + (x & 15)] : AIR;
}
function setRaw(x, y, z, id) {
  if (id === AIR) W.delete(bk(x, y, z)); else W.set(bk(x, y, z), id);
  if ((x | 0) !== x || (y | 0) !== y || (z | 0) !== z || y < 0 || y >= WORLD_H) return;
  const k = cnum(x >> 4, z >> 4); let a = CSTORE.get(k);
  const f = FSTORE.get(k); if (f) f[y * CAREA + (z & 15) * CH + (x & 15)] = 0;   // any write resets the cell to a source / no flow
  if (!a) { if (id === AIR) return; a = new Uint8Array(CAREA * WORLD_H); CSTORE.set(k, a); }
  a[y * CAREA + (z & 15) * CH + (x & 15)] = id;
}
// flow levels for water and lava, one Uint8Array per column, created only where something flows.
// 0 = source (or not a fluid), 1..7 = flowing (1 is next to the source), 8 = falling
const FSTORE = new Map();
function getFlow(x, y, z) { if (y < 0 || y >= WORLD_H) return 0; const a = FSTORE.get(cnum(x >> 4, z >> 4)); return a ? a[y * CAREA + (z & 15) * CH + (x & 15)] : 0; }
function setFlow(x, y, z, lv) {
  if (y < 0 || y >= WORLD_H) return;
  const k = cnum(x >> 4, z >> 4); let a = FSTORE.get(k);
  if (!a) { if (!lv) return; a = new Uint8Array(CAREA * WORLD_H); FSTORE.set(k, a); }
  a[y * CAREA + (z & 15) * CH + (x & 15)] = lv;
}
function ck(cx, cz) { return cx + "," + cz; }

// procedural noise
function hsh(x, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vn(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hsh(xi, zi), b = hsh(xi + 1, zi), c = hsh(xi, zi + 1), d = hsh(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; }
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += vn(x * f, z * f) * a; f *= 2; a *= 0.5; } return s; }

// 3D value noise for caves (TerrainSystem)
function hsh3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1103515245) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vn3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c000 = hsh3(xi, yi, zi), c100 = hsh3(xi + 1, yi, zi), c010 = hsh3(xi, yi + 1, zi), c110 = hsh3(xi + 1, yi + 1, zi);
  const c001 = hsh3(xi, yi, zi + 1), c101 = hsh3(xi + 1, yi, zi + 1), c011 = hsh3(xi, yi + 1, zi + 1), c111 = hsh3(xi + 1, yi + 1, zi + 1);
  return L(L(L(c000, c100, u), L(c010, c110, u), v), L(L(c001, c101, u), L(c011, c111, u), v), w);
}
// shared terrain functions so the world and the minimap agree
function biomeAt(x, z) { return { t: vn(x * 0.004 + 50, z * 0.004 + 50), m: vn(x * 0.005 + 200, z * 0.005 + 200) }; }
// meandering rivers: a thin band where a smooth noise crosses its middle value; kept clear of the spawn camp
function riverAt(x, z) {
  const d = Math.hypot(x, z); if (d < 28) return 0;
  const n = vn(x * 0.0042 + 700, z * 0.0042 + 700) * 0.62 + vn(x * 0.011 + 310, z * 0.011 + 310) * 0.38;
  const r = Math.abs(n - 0.5), w = 0.021;
  return r >= w ? 0 : (1 - r / w) * Math.min(1, (d - 28) / 24);
}
function heightAt(x, z) {
  const base = fbm(x * 0.02, z * 0.02);
  const mtn = Math.pow(Math.max(0, vn(x * 0.0065 + 300, z * 0.0065 + 300) - 0.5) * 2, 1.5);
  let h = SEA + 3 + (base - 0.5) * 24 + mtn * 26;
  const rv = riverAt(x, z);
  if (rv > 0) { const f = Math.min(1, rv * 1.8) * Math.max(0, Math.min(1, (SEA + 24 - h) / 10)); h += (SEA - 1.2 - 2.2 * rv - h) * f; }   // carve the channel, spare the high mountains
  return Math.max(3, Math.min(WORLD_H - 3, Math.floor(h)));
}
function caveMouthAt(x, z) { return vn(x * 0.035 + 90, z * 0.035 + 90) > 0.74; }
function caveAt(x, y, z) {
  const a = vn3(x * 0.07, y * 0.10, z * 0.07);
  const b = vn3(x * 0.13 + 11, y * 0.16 + 11, z * 0.13 + 11);
  return a > 0.7 || (a > 0.58 && b > 0.7);
}
// rare cobblestone ruin with a loot chest (exploration reward)
function buildRuin(x, y, z) {
  const mat = COBBLE;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
    if (!edge) continue;
    const hh = 1 + (hsh(x + dx * 7, z + dz * 7) > 0.4 ? 1 : 0) + (hsh(x + dx, z + dz) > 0.7 ? 1 : 0); // broken-down height
    for (let dy = 0; dy < hh; dy++) setRaw(x + dx, y + dy, z + dz, mat);
  }
  setRaw(x, y, z, CHEST);
  try { const ck2 = "overworld:" + bk(x, y, z); if (!chestStore.has(ck2)) chestStore.set(ck2, [{ id: I_SPICK, count: 1 }, { id: I_APPLE, count: 2 }, { id: COBBLE, count: 6 }, null, null, null, null, null, null]); } catch (e) {}
  if (getBlock(x + 1, y, z) === AIR) setRaw(x + 1, y, z, TORCH);
}
// a rare hidden treasure room buried under the forest, marked by a glowing crystal on the surface
function buildTreasureRoom(cx, surfY, cz) {
  const roomY = surfY - 7;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 3; dy++) {
    const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 0 || dy === 3;
    setRaw(cx + dx, roomY + dy, cz + dz, edge ? (dy === 0 ? COBBLE : BRICK) : AIR);
  }
  setRaw(cx, roomY + 1, cz, CHEST);
  try { const ck2 = "overworld:" + bk(cx, roomY + 1, cz); if (!chestStore.has(ck2)) chestStore.set(ck2, [{ id: CRYSTAL, count: 3 }, { id: FIRE_CRYSTAL, count: 2 }, { id: BOUNCE, count: 3 }, { id: LAUNCH, count: 1 }, { id: I_APPLE, count: 4 }, { id: BRICK, count: 12 }, null, null, null]); } catch (e) {}
  setRaw(cx - 1, roomY + 1, cz - 1, CRYSTAL); setRaw(cx + 1, roomY + 1, cz + 1, HEAL);   // light + a heal block inside
  setRaw(cx, surfY, cz, CRYSTAL);                                                         // glowing surface marker leads Thomas here
}

function genChunk(cx, cz) {
  if (generated.has(ck(cx, cz))) return;
  generated.add(ck(cx, cz));
  const x0 = cx * CH, z0 = cz * CH;
  if (DIM === "overworld") {
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const b = biomeAt(x, z), h = heightAt(x, z);
      const peak = h > SEA + 16;
      const desert = b.t > 0.66 && !peak && h > SEA;
      const mush = b.m > 0.72 && b.t > 0.4 && b.t < 0.66 && !peak && h > SEA;   // mushroom forest: very wet, temperate
      const swamp = b.m > 0.6 && !mush && !desert && !peak && h > SEA && h <= SEA + 2;  // swamp: wet lowlands
      const forest = b.m > 0.58 && !desert && !peak && !mush;
      const mouth = caveMouthAt(x, z) && !desert, river = riverAt(x, z), vil = villageNear(x, z, 3);
      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === h) id = (h <= SEA) ? SAND : peak ? SNOW : desert ? SAND : mush ? MYCELIUM : (b.t < 0.28 && h > SEA + 2) ? SNOW : GRASS;   // taiga ground is snow covered
        else if (y > h - 3) id = peak ? STONE : desert ? SAND : DIRT;
        // carve connected caves through the stone interior; where a cave mouth noise is high they break the surface
        if (id === STONE && y > 1 && y < h - 1 && caveAt(x, y, z)) id = (y <= 4) ? LAVA : AIR;
        else if (mouth && y >= h - 3 && y > SEA + 1 && caveAt(x, y, z)) id = AIR;
        // crystal-cave veins deep underground, then ores by depth, gravel pockets, sparse cobble
        else if (id === STONE && y > 2 && y < SEA - 3 && vn3(x * 0.18 + 9, y * 0.18 + 9, z * 0.18 + 9) > 0.93) id = CRYSTAL;
        else if (id === STONE && y < h - 3 && vn3(x * 0.3 + 40, y * 0.3 + 40, z * 0.3 + 40) > 0.88) {          // about 1.4% of stone
          const r = hsh3(x >> 2, y >> 2, z >> 2);
          id = (y < 10 && r < 0.06) ? DIAMOND_ORE : (y < SEA - 5 && r < 0.16) ? GOLD_ORE : (y < SEA + 8 && r < 0.46) ? IRON_ORE : COAL_ORE;
        }
        else if (id === STONE && vn3(x * 0.14 + 77, y * 0.14 + 77, z * 0.14 + 77) > 0.9) id = GRAVEL;
        else if (id === STONE && vn3(x * 0.2, y * 0.2, z * 0.2) > 0.9) id = COBBLE;
        setRaw(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);   // fill water to sea level
      if (h <= SEA) setRaw(x, h, z, river > 0.25 && vn(x * 0.18 + 5, z * 0.18 + 9) > 0.42 ? GRAVEL : SAND);   // shore, seabed and gravelly riverbeds
      if (h > SEA && !peak && getBlock(x, h, z) !== AIR && !vil) {
        const cold = b.t < 0.36 || h > SEA + 12, kind = cold ? "spruce" : (forest && hsh(x * 11 + 3, z * 7 + 9) < 0.35) ? "birch" : "oak";
        if (mush) { if (hsh(x * 3 + 7, z * 5 + 11) > 0.93) giantMushroom(x, h + 1, z); else if (hsh(x * 2 + 1, z * 2 + 3) > 0.9) setRaw(x, h + 1, z, MUSHROOM); }
        else if (swamp) { if (hsh(x * 3 + 2, z * 3 + 5) > 0.86) setRaw(x, h + 1, z, BOUNCE); else if (hsh(x * 5 + 1, z * 7 + 2) > 0.9) bush(x, h + 1, z); }
        else if (!desert) { const tr = hsh(x * 3 + 7, z * 5 + 11); if (tr > (forest ? 0.86 : cold ? 0.93 : 0.95)) tree(x, h + 1, z, kind); else if (forest && tr > 0.8) bush(x, h + 1, z); }
        if (!forest && !desert && !swamp && hsh(x * 17 + 3, z * 19 + 5) > 0.9985) boulder(x, h + 1, z);
        if (getBlock(x, h + 1, z) === AIR && hsh(x * 13 + 31, z * 17 + 19) > 0.9955) setRaw(x, h + 1, z, FREDA);   // scattered Freda Boxes to discover
      }
    }
    // rare ruin landmark per chunk (exploration reward)
    if (hsh(cx * 91 + 5, cz * 57 + 3) > 0.93) {
      const rx = x0 + 3 + Math.floor(hsh(cx, cz) * 9), rz = z0 + 3 + Math.floor(hsh(cz + 1, cx + 1) * 9), ry = heightAt(rx, rz);
      const rb = biomeAt(rx, rz);
      if (ry > SEA + 1 && !(ry > SEA + 18) && !villageNear(rx, rz, 6)) buildRuin(rx, ry + 1, rz);
    }
    // rarer hidden treasure room buried under the surface
    if (hsh(cx * 71 + 13, cz * 39 + 7) > 0.955) {
      const tx = x0 + 4 + Math.floor(hsh(cx + 3, cz + 3) * 7), tz = z0 + 4 + Math.floor(hsh(cz + 5, cx + 5) * 7), ty = heightAt(tx, tz);
      if (ty > SEA + 3 && ty < SEA + 16 && !villageNear(tx, tz, 6)) buildTreasureRoom(tx, ty, tz);
    }
    // villages whose footprint reaches into this chunk build their part of it now
    for (const gx of new Set([Math.floor(x0 / VCELL), Math.floor((x0 + CH - 1) / VCELL)])) for (const gz of new Set([Math.floor(z0 / VCELL), Math.floor((z0 + CH - 1) / VCELL)])) {
      const v = villageInCell(gx, gz);
      if (v && x0 + CH > v.cx - v.r - 2 && x0 < v.cx + v.r + 2 && z0 + CH > v.cz - v.r - 2 && z0 < v.cz + v.r + 2) buildVillagePart(v, x0, z0);
    }
  } else if (DIM === "fire") {
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const h = Math.max(4, Math.min(WORLD_H - 4, 18 + Math.floor((fbm(x * 0.04 + 5, z * 0.04 + 5) - 0.5) * 16)));
      for (let y = 0; y <= h; y++) {
        let id = FIRESTONE;
        if (y > 1 && y < h - 1 && caveAt(x, y, z)) id = (y <= 5) ? LAVA : AIR;                    // fire caves, deep lava
        else if (vn3(x * 0.16 + 3, y * 0.16 + 3, z * 0.16 + 3) > 0.86) id = FIRE_CRYSTAL;          // crystal veins
        setRaw(x, y, z, id);
      }
      if (vn(x * 0.04 + 9, z * 0.04 + 9) > 0.7) setRaw(x, h, z, LAVA);                              // lava rivers/pools
      else if (hsh(x * 13 + 2, z * 17 + 5) > 0.985) setRaw(x, h + 1, z, FIRE_CRYSTAL);              // surface crystal clusters
      if (hsh(x * 7 + 1, z * 9 + 3) > 0.987) { for (let y = h + 1; y < h + 4; y++) setRaw(x, y, z, WOOD); setRaw(x, h + 4, z, FIRE_CRYSTAL); }  // burning tree with ember
      if (getBlock(x, h + 1, z) === AIR && hsh(x * 19 + 7, z * 23 + 11) > 0.994) setRaw(x, h + 1, z, FREDA);   // Freda Boxes in the fire dimension
    }
  } else if (DIM === "sky") { // sky islands: a central spawn island plus scattered floating islands and clouds
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const d = Math.hypot(x, z);
      if (d < 11) { for (let y = 31; y <= 34; y++) setRaw(x, y, z, y === 34 ? GRASS : STONE); if (d < 8 && hsh(x * 3 + 1, z * 3 + 2) > 0.93) tree(x, 35, z); }   // spawn island
      const fi = vn(x * 0.06 + 300, z * 0.06 + 300);
      if (d > 11 && fi > 0.72) {                                                          // floating islands
        const fy = 28 + Math.floor((fi - 0.72) * 50) + Math.floor(hsh((x / 5) | 0, (z / 5) | 0) * 10);
        const thick = 2 + Math.floor(fi * 3);
        for (let y = fy - thick; y <= fy; y++) setRaw(x, y, z, y === fy ? GRASS : STONE);
        if (hsh(x * 3 + 1, z * 3 + 1) > 0.985) tree(x, fy + 1, z);
        else if (hsh(x * 2 + 5, z * 2 + 5) > 0.99) setRaw(x, fy + 1, z, FIRE_CRYSTAL);     // a shiny loot block
      }
      const cl = vn(x * 0.08 + 50, z * 0.08 + 50);
      if (cl > 0.88) setRaw(x, 46 + Math.floor(hsh(x, z) * 4), z, SNOW);                   // decorative clouds up high
    }
  } else if (DIM === "realm") { // creature battle realm: bright grass plains, tall-grass zones, forests, hills, lakes
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const base = fbm(x * 0.03 + 40, z * 0.03 + 40);
      const h = Math.max(6, Math.min(WORLD_H - 6, Math.floor(SEA + 2 + (base - 0.5) * 22)));
      for (let y = 0; y <= h; y++) { let id = STONE; if (y === h) id = (h <= SEA) ? SAND : (h > SEA + 14 ? SNOW : GRASS); else if (y > h - 3) id = DIRT; setRaw(x, y, z, id); }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);
      if (h > SEA && h <= SEA + 14) {
        const r = hsh(x * 3 + 9, z * 5 + 13);
        if (r > 0.94) tree(x, h + 1, z);
        else if (r > 0.5 && r < 0.86) setRaw(x, h + 1, z, TALLGRASS);   // wide tall-grass encounter zones
        else if (r > 0.9 && r < 0.94) setRaw(x, h + 1, z, hsh(x * 7 + 2, z * 7 + 5) > 0.5 ? CRYSTAL : FIRE_CRYSTAL);   // colorful flowers dotting the meadow
        if (getBlock(x, h + 1, z) === AIR && hsh(x * 29 + 3, z * 31 + 7) > 0.995) setRaw(x, h + 1, z, FREDA);   // Freda Boxes hidden in the valley
      }
    }
  } else if (DIM === "mario") { // mushroom kingdom: bright rolling hills, floating brick platforms, warp pipes, question blocks
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const base = fbm(x * 0.035 + 80, z * 0.035 + 80);
      const h = Math.max(8, Math.min(WORLD_H - 10, Math.floor(SEA + 3 + (base - 0.5) * 14)));
      for (let y = 0; y <= h; y++) { let id = STONE; if (y === h) id = GRASS; else if (y > h - 3) id = DIRT; setRaw(x, y, z, id); }
      for (let y = h + 1; y <= SEA; y++) setRaw(x, y, z, WATER);
      const r = hsh(x * 5 + 21, z * 7 + 33);
      if (h > SEA) {
        if (r > 0.965) { const ph = 2 + (hsh(x, z) * 2 | 0); for (let y = h + 1; y <= h + ph; y++) setRaw(x, y, z, PIPE); }        // scattered warp pipes
        else if (r > 0.9 && r < 0.93) setRaw(x, h + 1, z, MUSHROOM);                                                              // mushroom decorations
        else if (r > 0.86 && r < 0.9 && hsh(x * 2, z * 3) > 0.5) tree(x, h + 1, z);
      }
      // floating brick platforms with question blocks on some
      const fp = vn(x * 0.09 + 300, z * 0.09 + 300);
      if (fp > 0.86 && h > SEA) { const fy = h + 5 + Math.floor(hsh((x / 4) | 0, (z / 4) | 0) * 4); setRaw(x, fy, z, BRICK); if (hsh(x * 9 + 1, z * 11 + 4) > 0.82) setRaw(x, fy + 1, z, QBLOCK); }
    }
  } else { // end: large central island, floating islands, ruined pillars; void elsewhere
    for (let x = x0; x < x0 + CH; x++) for (let z = z0; z < z0 + CH; z++) {
      const d = Math.hypot(x, z);
      if (d < 46) for (let y = 13; y <= 16; y++) setRaw(x, y, z, ENDSTONE);                 // big thick main island
      if (d < 44 && hsh(x * 37 + 5, z * 41 + 9) > 0.99) setRaw(x, 17, z, FREDA);            // Freda Boxes on the End island
      const fi = vn(x * 0.05 + 700, z * 0.05 + 700);
      if (d > 26 && d < 120 && fi > 0.82) { const fy = 24 + Math.floor(hsh((x / 6) | 0, (z / 6) | 0) * 18); for (let y = fy; y <= fy + 1; y++) setRaw(x, y, z, ENDSTONE); }  // floating islands
    }
    if (Math.abs(cx) <= 2 && Math.abs(cz) <= 2 && hsh(cx * 13 + 1, cz * 17 + 2) > 0.55) {   // ruined pillars on the island
      const rx = x0 + 4 + (hsh(cx, cz) * 6 | 0), rz = z0 + 4 + (hsh(cz, cx) * 6 | 0);
      if (Math.hypot(rx, rz) < 40) { const ph = 3 + (hsh(rx, rz) * 4 | 0); for (let y = 17; y < 17 + ph; y++) setRaw(rx, y, rz, COBBLE); }
    }
  }
}
function tree(x, y, z, kind) {
  if (kind === "spruce") {                                     // tall conifer with stacked needle rings
    const th = 6 + Math.floor(hsh(x * 1.3, z * 1.9) * 4);
    for (let i = 0; i < th; i++) setRaw(x, y + i, z, SPRUCE_WOOD);
    const top = y + th;
    if (getBlock(x, top, z) === AIR) setRaw(x, top, z, SPRUCE_LEAVES);
    for (let i = 1; i <= th - 2; i++) {
      const r = i === 1 ? 1 : (i % 2 === 0 ? Math.min(3, 1 + (i >> 1)) : Math.max(1, (i >> 1))), yy = top - i;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (dx * dx + dz * dz > r * r + r * 0.6) continue; if ((dx || dz) && getBlock(x + dx, yy, z + dz) === AIR) setRaw(x + dx, yy, z + dz, SPRUCE_LEAVES); }
    }
    return;
  }
  const birch = kind === "birch", log = birch ? BIRCH_WOOD : WOOD, leaf = birch ? BIRCH_LEAVES : LEAVES;
  const th = (birch ? 5 : 4) + Math.floor(hsh(x * 1.1, z * 1.7) * 3);
  for (let i = 0; i < th; i++) setRaw(x, y + i, z, log);
  const top = y + th;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
    if (birch && dy === -1 && (Math.abs(dx) === 2 || Math.abs(dz) === 2) && hsh(x + dx * 3, z + dz * 5) > 0.5) continue;
    if (getBlock(x + dx, top + dy, z + dz) === AIR) setRaw(x + dx, top + dy, z + dz, leaf);
  }
  if (birch && getBlock(x, top + 2, z) === AIR) setRaw(x, top + 2, z, leaf);
}
