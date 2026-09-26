/* mesher.js: Chunk meshing, lighting, fluids and fence models, portals and torches, chunk streaming.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- CHUNK MESHING: textured, smooth lit (sky light + block light + ambient occlusion) ----------
// Each rebuild copies the chunk plus a 7 block margin into a padded region, floods sky and block light
// through it, then emits faces whose vertices carry AO and averaged light. Faces go to three meshes:
// opaque (terrain shader), cutout (leaves and plants, alpha tested, double sided) and water.
const FACES = [
  { d: [1, 0, 0], c: [[1,1,1],[1,0,1],[1,0,0],[1,1,0]] },
  { d: [-1,0, 0], c: [[0,1,0],[0,0,0],[0,0,1],[0,1,1]] },
  { d: [0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { d: [0,-1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { d: [0, 0, 1], c: [[0,1,1],[0,0,1],[1,0,1],[1,1,1]] },
  { d: [0, 0,-1], c: [[1,1,0],[1,0,0],[0,0,0],[0,1,0]] }
];
const LM = 7, RW = CH + LM * 2, RA = RW * RW, RH = WORLD_H + 2, RV = RA * RH, LDEC = 2;
const rB = new Uint8Array(RV), rS = new Uint8Array(RV), rL = new Uint8Array(RV), rC = new Uint8Array(RV), rF = new Uint8Array(RV);
// block light colours: the colour of whichever source lights a cell brightest travels with the light
const LPAL = [[255, 200, 140], [255, 190, 120], [255, 150, 62], [110, 215, 255], [130, 255, 160], [170, 220, 255], [200, 120, 255]], LCOL = new Uint8Array(256);
const QM = (1 << 18) - 1, lq = new Int32Array(QM + 1);
const KIND = new Uint8Array(256), OCC = new Uint8Array(256), LATT = new Uint8Array(256), EMIT = new Uint8Array(256), FLG = new Uint8Array(256), TINTK = new Uint8Array(256), ROT = new Uint8Array(256);
const TIL = [], BCOL = [], TMUL = [], LEAFY = new Uint8Array(256);
const ATILE = ATL.tiles;
(function initBlockRender() {
  const map = {
    [GRASS]: ["grass_top", "grass_side", "dirt"], [DIRT]: ["dirt"], [STONE]: ["stone"], [WOOD]: ["log_top", "log_side", "log_top"], [LEAVES]: ["leaves"],
    [SAND]: ["sand"], [LAVA]: ["dirt"], [FIRESTONE]: ["firestone"], [ENDSTONE]: ["endstone"], [PLANKS]: ["planks"], [COBBLE]: ["cobble"],
    [CHEST]: ["chest_top", "chest_side", "planks"], [SNOW]: ["snow"], [BRICK]: ["brick"], [BED]: ["bed_top", "bed_side", "planks"],
    [FIRE_CRYSTAL]: ["fire_crystal"], [BOUNCE]: ["slime"], [SPIKE]: ["spike_top", "metal_side", "metal_side"], [ALARM]: ["gold_bell"],
    [FREDA]: ["freda_top", "freda_side", "freda_top"], [MYCELIUM]: ["mycelium_top", "mycelium_side", "dirt"], [MUSHROOM]: ["mushroom_cap", "mushroom_cap", "mushroom_gills"],
    [CRYSTAL]: ["crystal"], [LAUNCH]: ["launch_top", "launch_side", "launch_side"], [HEAL]: ["heal"], [FROST]: ["frost"], [TALLGRASS]: ["tallgrass"],
    [CDOOR]: ["cdoor"], [QBLOCK]: ["qblock"], [PIPE]: ["pipe_top", "pipe_side", "pipe_top"],
    [COAL_ORE]: ["coal_ore"], [IRON_ORE]: ["iron_ore"], [GOLD_ORE]: ["gold_ore"], [DIAMOND_ORE]: ["diamond_ore"],
    [FURNACE]: ["furnace_top", "furnace_side", "furnace_top", "furnace_front"], [GLASS]: ["glass"],
    [BIRCH_WOOD]: ["log_top", "birch_log", "log_top"], [BIRCH_LEAVES]: ["birch_leaves"], [SPRUCE_WOOD]: ["spruce_top", "spruce_log", "spruce_top"], [SPRUCE_LEAVES]: ["spruce_leaves"],
    [GRAVEL]: ["gravel"], [HAY]: ["hay_top", "hay_side", "hay_top"], [PATH]: ["path_top", "dirt", "dirt"], [LANTERN]: ["metal_side", "lantern", "metal_side"], [STONEBRICK]: ["stonebrick"],
    [CRAFT_TABLE]: ["craft_top", "craft_side", "planks", "craft_front"], [WOOL]: ["wool"], [OBSIDIAN]: ["obsidian"],
    [FENCE]: ["planks"], [GATE]: ["planks"], [GATE_OPEN]: ["planks"]
  };
  const leafy = new Set([LEAVES, BIRCH_LEAVES, SPRUCE_LEAVES]);
  const rotTops = new Set([GRASS, DIRT, SAND, STONE, SNOW, FIRESTONE, ENDSTONE, MYCELIUM, COBBLE, LEAVES, BIRCH_LEAVES, SPRUCE_LEAVES, GRAVEL, PATH, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, WOOL]);
  const emit = { [TORCH]: 14, [LAVA]: 15, [FIRE_CRYSTAL]: 12, [CRYSTAL]: 13, [HEAL]: 12, [FROST]: 10, [CDOOR]: 12, [PORTAL]: 11, [FURNACE]: 10, [LANTERN]: 15, [DIAMOND_ORE]: 0, [GOLD_ORE]: 0 };
  for (const k of Object.keys(BLOCKS)) {
    const id = +k, def = BLOCKS[id], names = map[id];
    if (id === WATER) KIND[id] = 3; else if (id === TALLGRASS) KIND[id] = 4; else if (leafy.has(id) || id === GLASS) KIND[id] = 2;
    else if (id === TORCH || id === PORTAL) KIND[id] = 0; else if (id === FENCE || id === GATE || id === GATE_OPEN) KIND[id] = 5; else KIND[id] = 1;
    OCC[id] = KIND[id] === 1 && isOpaque(id) ? 1 : 0;
    if (id === WATER) LATT[id] = 1; else if (leafy.has(id)) LATT[id] = 1;
    EMIT[id] = emit[id] !== undefined ? emit[id] : (def.glow ? 9 : 0);
    LCOL[id] = id === LAVA || id === FIRE_CRYSTAL ? 2 : id === CRYSTAL ? 3 : id === HEAL ? 4 : id === FROST ? 5 : (id === PORTAL || id === CDOOR) ? 6 : id === LANTERN ? 1 : 0;
    const t = names ? names.map(n => ATILE[n]) : [ATILE.snow];                     // unknown blocks: neutral tile tinted by their colour
    TIL[id] = [t[0], t[1] || t[0], t[2] || t[1] || t[0], t[3] || t[1] || t[0]];
    BCOL[id] = names ? null : [def.top, def.side, def.bot];
    ROT[id] = rotTops.has(id) ? 1 : 0;
    let f = 0;
    if (def.glow || id === GOLD_ORE) f |= 2; if (id === LAVA) f |= 4; if (id === TALLGRASS) f |= 8; if (leafy.has(id)) f |= 16;
    FLG[id] = f;
    TINTK[id] = (id === GRASS || id === TALLGRASS) ? 1 : leafy.has(id) ? 2 : 0;
    LEAFY[id] = leafy.has(id) ? 1 : 0;
    TMUL[id] = id === BIRCH_LEAVES ? [1.08, 1.04, 0.86] : id === SPRUCE_LEAVES ? [0.86, 0.95, 0.95] : [1, 1, 1];
  }
  KIND[AIR] = 0; OCC[AIR] = 0;
})();
// region offsets for the AO / light samples of every face corner, relative to the face's neighbour cell
const NOFF = FACES.map(F => F.d[1] * RA + F.d[2] * RW + F.d[0]);
const AOT = [];
for (let f = 0; f < 6; f++) {
  const ax = FACES[f].d[0] ? 0 : FACES[f].d[1] ? 1 : 2, tan = [0, 1, 2].filter(a => a !== ax);
  for (let k = 0; k < 4; k++) {
    const c = FACES[f].c[k], o = [0, 0, 0], p = [0, 0, 0];
    o[tan[0]] = c[tan[0]] * 2 - 1; p[tan[1]] = c[tan[1]] * 2 - 1;
    const off = v => v[1] * RA + v[2] * RW + v[0];
    AOT.push([off(o), off(p), off([o[0] + p[0], o[1] + p[1], o[2] + p[2]])]);
  }
}
const AOC = [0.38, 0.6, 0.8, 1.0];
function GeoBuf(cap) { this.cap = cap; this.alloc(cap); this.n = 0; this.ni = 0; }
GeoBuf.prototype.alloc = function (cap) {
  const o = this.pos ? this : null;
  const pos = new Float32Array(cap * 3), uv = new Uint16Array(cap * 2), tint = new Uint8Array(cap * 4), lit = new Uint8Array(cap * 4), bcol = new Uint8Array(cap * 4), idx = new Uint32Array(Math.ceil(cap * 1.5));
  if (o) { pos.set(o.pos); uv.set(o.uv); tint.set(o.tint); lit.set(o.lit); bcol.set(o.bcol); idx.set(o.idx); }
  this.pos = pos; this.uv = uv; this.tint = tint; this.lit = lit; this.bcol = bcol; this.idx = idx; this.cap = cap;
};
GeoBuf.prototype.room = function (nv) { if (this.n + nv > this.cap) this.alloc(Math.max(this.cap * 2, this.n + nv)); };
const gOp = new GeoBuf(16384), gCut = new GeoBuf(8192), gWat = new GeoBuf(4096);
let vbR = 255, vbG = 200, vbB = 140;                                             // block light colour for the next vertices
function vtx(g, x, y, z, u, v, tr, tg, tb, fl, ao, sk, bl, face) {
  const i = g.n++, i3 = i * 3, i2 = i * 2, i4 = i * 4;
  g.bcol[i4] = vbR; g.bcol[i4 + 1] = vbG; g.bcol[i4 + 2] = vbB; g.bcol[i4 + 3] = 255;
  g.pos[i3] = x; g.pos[i3 + 1] = y; g.pos[i3 + 2] = z;
  g.uv[i2] = u * 65535; g.uv[i2 + 1] = v * 65535;
  g.tint[i4] = tr; g.tint[i4 + 1] = tg; g.tint[i4 + 2] = tb; g.tint[i4 + 3] = fl;
  g.lit[i4] = ao; g.lit[i4 + 1] = sk; g.lit[i4 + 2] = bl; g.lit[i4 + 3] = face;
}
function quadIdx(g, base, flip) {
  const I = g.idx, j = g.ni; g.ni += 6;
  if (flip) { I[j] = base; I[j + 1] = base + 1; I[j + 2] = base + 3; I[j + 3] = base + 1; I[j + 4] = base + 2; I[j + 5] = base + 3; }
  else { I[j] = base; I[j + 1] = base + 1; I[j + 2] = base + 2; I[j + 3] = base; I[j + 4] = base + 2; I[j + 5] = base + 3; }
}
function fillRegion(cx, cz) {
  const bx = cx * CH - LM, bz = cz * CH - LM;
  for (let rz = 0; rz < RW; rz++) {
    const wz = bz + rz, czz = wz >> 4, lz = wz & 15;
    for (let rx = 0; rx < RW; rx++) {
      const wx = bx + rx, a = CSTORE.get(cnum(wx >> 4, czz)), fa = FSTORE.get(cnum(wx >> 4, czz)), col = rz * RW + rx;
      rB[col] = STONE; rB[(RH - 1) * RA + col] = AIR;                         // sealed floor below y=0, open sky above the build limit
      let ri = RA + col;
      if (a) { let ci = lz * CH + (wx & 15); for (let y = 0; y < WORLD_H; y++, ri += RA, ci += CAREA) rB[ri] = a[ci]; }
      else for (let y = 0; y < WORLD_H; y++, ri += RA) rB[ri] = AIR;
      ri = RA + col;
      if (fa) { let ci = lz * CH + (wx & 15); for (let y = 0; y < WORLD_H; y++, ri += RA, ci += CAREA) rF[ri] = fa[ci]; }
      else for (let y = 0; y < WORLD_H; y++, ri += RA) rF[ri] = 0;
    }
  }
}
function spreadLight(L, qh, qt, C) {
  while (qh !== qt) {
    const ri = lq[qh]; qh = (qh + 1) & QM;
    const l = L[ri] - LDEC; if (l <= 0) continue;
    const cc = C ? C[ri] : 0;
    const ry = (ri / RA) | 0, r2 = ri - ry * RA, rz = (r2 / RW) | 0, rx = r2 - rz * RW;
    let n, id, nl;
    if (rx > 0) { n = ri - 1; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
    if (rx < RW - 1) { n = ri + 1; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
    if (rz > 0) { n = ri - RW; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
    if (rz < RW - 1) { n = ri + RW; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
    if (ry > 0) { n = ri - RA; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
    if (ry < RH - 1) { n = ri + RA; id = rB[n]; if (!OCC[id]) { nl = l - LATT[id]; if (nl > L[n]) { L[n] = nl; if (C) C[n] = cc; lq[qt] = n; qt = (qt + 1) & QM; } } }
  }
}
function lightRegion() {
  rS.fill(0); rL.fill(0); rC.fill(0);
  let top = 0;
  for (let c = 0; c < RA; c++) {                                                   // sky columns fall straight down
    let l = 15;
    for (let ry = RH - 1; ry >= 0; ry--) {
      const ri = ry * RA + c, id = rB[ri];
      if (OCC[id]) { if (ry > top) top = ry; break; }
      if (LATT[id]) { l -= LATT[id]; if (l < 0) l = 0; if (ry > top) top = ry; }
      rS[ri] = l;
    }
  }
  let qt = 0;                                                                      // then spread sideways into overhangs and caves
  for (let ry = 0; ry <= Math.min(RH - 1, top + 1); ry++) for (let rz = 0; rz < RW; rz++) for (let rx = 0; rx < RW; rx++) {
    const ri = ry * RA + rz * RW + rx, l = rS[ri]; if (l <= LDEC) continue;
    const t = l - LDEC;
    if ((rx > 0 && rS[ri - 1] < t && !OCC[rB[ri - 1]]) || (rx < RW - 1 && rS[ri + 1] < t && !OCC[rB[ri + 1]]) ||
        (rz > 0 && rS[ri - RW] < t && !OCC[rB[ri - RW]]) || (rz < RW - 1 && rS[ri + RW] < t && !OCC[rB[ri + RW]]) ||
        (ry > 0 && rS[ri - RA] < t && !OCC[rB[ri - RA]])) { lq[qt] = ri; qt = (qt + 1) & QM; }
  }
  spreadLight(rS, 0, qt);
  qt = 0;
  for (let ri = RA; ri < RV - RA; ri++) { const e = EMIT[rB[ri]]; if (e) { rL[ri] = e; rC[ri] = LCOL[rB[ri]]; lq[qt] = ri; qt = (qt + 1) & QM; } }
  if (qt) spreadLight(rL, 0, qt, rC);
}
// terrain + water materials (custom shaders with three.js shadow maps, fog done in shader)
function mkShader(vs, fs, extra, opts) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights]); Object.assign(u, U, extra || {});
  return new THREE.ShaderMaterial(Object.assign({ uniforms: u, vertexShader: vs, fragmentShader: fs, lights: true, fog: false }, opts || {}));
}
const matTerrain = mkShader(SH.TERRAIN_VERT, SH.TERRAIN_FRAG, { uAtlas: { value: atlasTex } }, { side: THREE.FrontSide });
const matCutout = mkShader(SH.TERRAIN_VERT, SH.TERRAIN_FRAG, { uAtlas: { value: atlasTex } }, { side: THREE.DoubleSide, defines: { CUTOUT: 1 } });
const depthCutout = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlasTex, alphaTest: 0.5, side: THREE.DoubleSide });
const matWaterS = mkShader(SH.WATER_VERT, SH.WATER_FRAG, {}, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
const tintCol = new Float32Array(CAREA * 6);                                        // per column: grass tint rgb, foliage tint rgb
function biomeTints(cx, cz) {
  for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const o = (lz * CH + lx) * 6; let r = 1, g = 1, b = 1;
    if (DIM === "overworld") {
      const bi = biomeAt(cx * CH + lx, cz * CH + lz), t = bi.t, m = bi.m;
      const dry = THREE.MathUtils.clamp((t - 0.48) * 3.2, 0, 1) * THREE.MathUtils.clamp((0.7 - m) * 2.5, 0, 1);
      const cold = THREE.MathUtils.clamp((0.42 - t) * 4, 0, 1), wet = THREE.MathUtils.clamp((m - 0.5) * 3, 0, 1);
      r = 1 + 0.3 * dry - 0.16 * cold - 0.14 * wet; g = 1 + 0.03 * dry - 0.04 * cold + 0.02 * wet; b = 1 - 0.42 * dry + 0.1 * cold - 0.12 * wet;
    } else if (DIM === "realm" || DIM === "mario") { r = 0.9; g = 1.1; b = 0.78; }
    tintCol[o] = r; tintCol[o + 1] = g; tintCol[o + 2] = b;
    tintCol[o + 3] = r * 0.92; tintCol[o + 4] = g * 0.97; tintCol[o + 5] = b * 1.02;
  }
}
const DECO = ["tuft", "tuft", "tuft", "tallgrass", "flower_red", "flower_yellow", "flower_blue", "flower_white"];
let fancyLeaves = true;
function buildChunk(cx, cz) {
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) genChunk(cx + dx, cz + dz);
  fillRegion(cx, cz); lightRegion(); biomeTints(cx, cz);
  gOp.n = gOp.ni = 0; gCut.n = gCut.ni = 0; gWat.n = gWat.ni = 0;
  const x0 = cx * CH, z0 = cz * CH;
  const skyOut = new Uint8Array(CAREA * WORLD_H), blkOut = new Uint8Array(CAREA * WORLD_H);
  const deco = DIM === "overworld" || DIM === "realm" || DIM === "mario" || DIM === "sky";
  for (let y = 0; y < WORLD_H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const ri = (y + 1) * RA + (lz + LM) * RW + lx + LM, id = rB[ri], oi = y * CAREA + lz * CH + lx;
    skyOut[oi] = rS[ri]; blkOut[oi] = rL[ri];
    const kind = KIND[id]; if (!kind) continue;
    const wx = x0 + lx, wz = z0 + lz, tc = (lz * CH + lx) * 6;
    if (kind === 4) { plant(gCut, wx, y, wz, ri, ATILE.tallgrass, 1, 0, 0, tintCol[tc], tintCol[tc + 1], tintCol[tc + 2]); continue; }
    if (kind === 5) { fenceModel(gOp, wx, y, wz, ri, id); continue; }
    const jit = 0.95 + 0.1 * hsh(wx * 7 + y * 13, wz * 11 - y * 5);
    let hcW = null, hcL = null;
    if (id === LAVA && rF[ri] && rB[ri + RA] !== LAVA) hcL = fluidCorners(ri, LAVA, hcLava);   // flowing lava sits lower and slopes
    for (let f = 0; f < 6; f++) {
      const n = ri + NOFF[f], nid = rB[n];
      if (OCC[nid] && !(nid === LAVA && rF[n])) continue;                              // flowing lava does not hide what is behind it
      if (kind === 3) { if (nid === WATER) continue; if (!hcW) hcW = fluidCorners(ri, WATER, hcWater); waterFace(wx, y, wz, ri, f, hcW); continue; }
      if (id === LAVA && nid === LAVA && !(rF[n] && !rF[ri])) continue;               // lava to lava faces only where a full cell meets a lower flow
      if (kind === 2 && (nid === id || (LEAFY[id] && LEAFY[nid]))) continue;         // canopy shell only; holes show the far side
      const tl = TIL[id][f === 2 ? 0 : f === 3 ? 2 : f >= 4 ? 3 : 1];
      let tr = jit, tg = jit, tb = jit, fl = FLG[id];
      const bc = BCOL[id]; if (bc) { const c = bc[f === 2 ? 0 : f === 3 ? 2 : 1]; tr *= c[0] * 1.15; tg *= c[1] * 1.15; tb *= c[2] * 1.15; }
      const tk = TINTK[id];
      if (tk === 1 && f !== 3) { tr *= tintCol[tc]; tg *= tintCol[tc + 1]; tb *= tintCol[tc + 2]; if (f !== 2) fl |= 1; }
      else if (tk === 2) { const tm = TMUL[id]; tr *= tintCol[tc + 3] * tm[0]; tg *= tintCol[tc + 4] * tm[1]; tb *= tintCol[tc + 5] * tm[2]; }
      const h = hsh(wx * 3 + y, wz * 5 - y);
      cubeFace(kind === 2 ? gCut : gOp, wx, y, wz, n, f, tl, ROT[id] && f === 2 ? (h * 4) | 0 : 0, ROT[id] && f !== 2 && h > 0.5, tr, tg, tb, fl, hcL);
    }
    if (deco && id === GRASS && rB[ri + RA] === AIR && y + 1 < WORLD_H) {           // grass tufts and wildflowers (visual only)
      const r = hsh(wx * 7 + 3, wz * 11 + 5), dens = DIM === "realm" ? 0.2 : 0.36;
      if (r < dens) {
        const pick = r < dens * 0.9 ? (hsh(wx * 5 + 1, wz * 3 + 2) < 0.12 ? 3 : 0) : 4 + ((hsh(wx * 13, wz * 17) * 4) | 0);
        const sc = pick === 3 ? 0.9 : pick >= 4 ? 0.7 + hsh(wx, wz * 3) * 0.25 : 0.55 + hsh(wx * 9, wz * 7) * 0.4;
        plant(gCut, wx, y + 1, wz, ri + RA, ATILE[DECO[pick]], sc, (hsh(wx * 3, wz * 9) - 0.5) * 0.3, (hsh(wx * 9, wz * 3) - 0.5) * 0.3,
          pick >= 4 ? 1 : tintCol[tc], pick >= 4 ? 1 : tintCol[tc + 1], pick >= 4 ? 1 : tintCol[tc + 2]);
      }
    }
  }
  const key = ck(cx, cz), prev = chunks.get(key);
  if (prev) disposeChunk(prev);
  const out = { opaque: null, cutout: null, water: null, sky: skyOut, blk: blkOut };
  if (gOp.ni) out.opaque = makeChunkMesh(gOp, matTerrain, true, null);
  if (gCut.ni) out.cutout = makeChunkMesh(gCut, matCutout, true, depthCutout);
  if (gWat.ni) out.water = makeChunkMesh(gWat, matWaterS, false, null);
  chunks.set(key, out);
}
function cubeFace(g, wx, y, wz, n, f, tl, rot, mir, tr, tg, tb, fl, hts) {
  g.room(4); if (g.ni + 6 > g.idx.length) g.alloc(g.cap * 2);
  const F = FACES[f], base = g.n, s = tl.s, sv = tl.sv;
  const tR = Math.min(255, tr / 1.5 * 255), tG = Math.min(255, tg / 1.5 * 255), tB = Math.min(255, tb / 1.5 * 255);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
  for (let k = 0; k < 4; k++) {
    const c = F.c[k], o = AOT[f * 4 + k], a1 = n + o[0], a2 = n + o[1], a3 = n + o[2];
    const o1 = OCC[rB[a1]], o2 = OCC[rB[a2]], o3 = OCC[rB[a3]];
    const aoL = (o1 && o2) ? 0 : 3 - (o1 + o2 + o3);
    let sk = rS[n], bl = rL[n], cnt = 1, P = LPAL[rC[n]], w = rL[n], cr = P[0] * w, cg = P[1] * w, cb = P[2] * w, ws = w;
    if (!o1) { sk += rS[a1]; bl += rL[a1]; cnt++; w = rL[a1]; P = LPAL[rC[a1]]; cr += P[0] * w; cg += P[1] * w; cb += P[2] * w; ws += w; }
    if (!o2) { sk += rS[a2]; bl += rL[a2]; cnt++; w = rL[a2]; P = LPAL[rC[a2]]; cr += P[0] * w; cg += P[1] * w; cb += P[2] * w; ws += w; }
    if (!o3 && !(o1 && o2)) { sk += rS[a3]; bl += rL[a3]; cnt++; w = rL[a3]; P = LPAL[rC[a3]]; cr += P[0] * w; cg += P[1] * w; cb += P[2] * w; ws += w; }
    sk /= cnt; bl /= cnt;
    if (ws > 0) { vbR = cr / ws; vbG = cg / ws; vbB = cb / ws; } else { vbR = 255; vbG = 200; vbB = 140; }
    let lu, lv;
    if (f === 2) { lu = c[0]; lv = 1 - c[2]; if (rot === 1) { const t = lu; lu = lv; lv = 1 - t; } else if (rot === 2) { lu = 1 - lu; lv = 1 - lv; } else if (rot === 3) { const t = lu; lu = 1 - lv; lv = t; } }
    else if (f === 3) { lu = c[0]; lv = c[2]; }
    else { lv = c[1]; lu = f === 0 ? 1 - c[2] : f === 1 ? c[2] : f === 4 ? c[0] : 1 - c[0]; if (mir) lu = 1 - lu; }
    const cy = hts && c[1] ? hts[c[0] + c[2] * 2] : c[1]; if (hts && f !== 2 && f !== 3) lv = cy;
    const wv = (fl & 16) && c[1] === 1 ? 32 : 0;
    vtx(g, wx + c[0], y + cy, wz + c[2], tl.u0 + lu * s, tl.v0 + lv * sv, tR, tG, tB, fl | wv, AOC[aoL] * 255, sk * 17, bl * 17, f);
    const lum = aoL * 16 + sk;
    if (k === 0) b0 = lum; else if (k === 1) b1 = lum; else if (k === 2) b2 = lum; else b3 = lum;
  }
  quadIdx(g, base, b0 + b2 > b1 + b3);                                             // split through the darker diagonal so AO corners fade smoothly
}
function plant(g, wx, y, wz, ri, tl, hgt, ox, oz, tr, tg, tb) {
  g.room(8); if (g.ni + 12 > g.idx.length) g.alloc(g.cap * 2);
  const s = tl.s, sv = tl.sv, sk = rS[ri] * 17, bl = rL[ri] * 17, PC = LPAL[rC[ri]]; vbR = PC[0]; vbG = PC[1]; vbB = PC[2];
  const tR = Math.min(255, tr / 1.5 * 255), tG = Math.min(255, tg / 1.5 * 255), tB = Math.min(255, tb / 1.5 * 255);
  const cx = wx + 0.5 + ox, cz = wz + 0.5 + oz, e = 0.45, top = y + hgt;
  for (let q = 0; q < 2; q++) {
    const base = g.n, sx = q ? -e : e;
    vtx(g, cx - sx, y, cz - e, tl.u0, tl.v0, tR, tG, tB, 8, 215, sk, bl, 6);
    vtx(g, cx + sx, y, cz + e, tl.u0 + s, tl.v0, tR, tG, tB, 8, 215, sk, bl, 6);
    vtx(g, cx + sx, top, cz + e, tl.u0 + s, tl.v0 + sv * Math.min(1, hgt + 0.001), tR, tG, tB, 8 | 32, 255, sk, bl, 6);
    vtx(g, cx - sx, top, cz - e, tl.u0, tl.v0 + sv * Math.min(1, hgt + 0.001), tR, tG, tB, 8 | 32, 255, sk, bl, 6);
    quadIdx(g, base, false);
  }
}
// fences and gates: posts and rails built from small textured boxes, connecting to fences, gates and solid blocks
function boxPart(g, wx, y, wz, ri, tl, x0, y0, z0, x1, y1, z1, sh) {
  const sk = rS[ri] * 17, bl = rL[ri] * 17, PC = LPAL[rC[ri]], s = tl.s, sv = tl.sv, t = Math.min(255, (sh || 1) / 1.5 * 255);
  for (let f = 0; f < 6; f++) {
    g.room(4); if (g.ni + 6 > g.idx.length) g.alloc(g.cap * 2);
    const F = FACES[f], base = g.n; vbR = PC[0]; vbG = PC[1]; vbB = PC[2];
    for (let k = 0; k < 4; k++) {
      const c = F.c[k], px = c[0] ? x1 : x0, py = c[1] ? y1 : y0, pz = c[2] ? z1 : z0;
      const u = f < 2 ? pz : px, v = f === 2 || f === 3 ? pz : py;
      vtx(g, wx + px, y + py, wz + pz, tl.u0 + u * s, tl.v0 + v * sv, t, t, t, 0, 235, sk, bl, f);
    }
    quadIdx(g, base, false);
  }
}
function fenceLinks(id) { return id === FENCE || id === GATE || id === GATE_OPEN || OCC[id]; }
function fenceModel(g, wx, y, wz, ri, id) {
  const tl = ATILE.planks, P = (a, b, c, d, e, f, sh) => boxPart(g, wx, y, wz, ri, tl, a, b, c, d, e, f, sh);
  const ex = fenceLinks(rB[ri + 1]), wxn = fenceLinks(rB[ri - 1]), sz = fenceLinks(rB[ri + RW]), nz = fenceLinks(rB[ri - RW]);
  if (id === FENCE) {
    P(0.375, 0, 0.375, 0.625, 1, 0.625, 0.95);
    for (const [ya, yb] of [[0.375, 0.5625], [0.75, 0.9375]]) {
      if (ex) P(0.625, ya, 0.4375, 1, yb, 0.5625); if (wxn) P(0, ya, 0.4375, 0.375, yb, 0.5625);
      if (sz) P(0.4375, ya, 0.625, 0.5625, yb, 1); if (nz) P(0.4375, ya, 0, 0.5625, yb, 0.375);
    }
    return;
  }
  const alongX = ex || wxn || !(sz || nz), open = id === GATE_OPEN;
  const B = (a, b, c, d, e, f) => alongX ? P(a, b, c, d, e, f) : P(c, b, a, f, e, d);     // build along x, mirror onto z
  B(0, 0.3125, 0.4375, 0.125, 1, 0.5625, 0.92); B(0.875, 0.3125, 0.4375, 1, 1, 0.5625, 0.92);   // end posts
  if (!open) {
    for (const [ya, yb] of [[0.375, 0.5625], [0.75, 0.9375]]) B(0.125, ya, 0.4375, 0.875, yb, 0.5625);
    B(0.4375, 0.5625, 0.4375, 0.5625, 0.75, 0.5625);
  } else {
    for (const [ya, yb] of [[0.375, 0.5625], [0.75, 0.9375]]) { B(0, ya, 0.5625, 0.125, yb, 0.9375); B(0.875, ya, 0.5625, 1, yb, 0.9375); }
    B(0, 0.5625, 0.8125, 0.125, 0.75, 0.9375); B(0.875, 0.5625, 0.8125, 1, 0.75, 0.9375);
  }
}
function waterDepth(ri) { let d = 0; while (d < 8 && rB[ri] === WATER) { d++; ri -= RA; } return d; }
// top height of a fluid cell (1 when the same fluid sits on top), or -1 when the cell holds something else
function fluidH(ri, fid) {
  if (rB[ri] !== fid) return -1;
  if (rB[ri + RA] === fid) return 1;
  const lv = rF[ri], top = fid === WATER ? 0.875 : 1;
  return lv === 0 || lv >= 8 ? top : top * (8 - lv) / 8;
}
// corner heights shared by the four cells around each corner, so neighbouring flows meet without gaps and slope downhill
const hcWater = new Float32Array(4), hcLava = new Float32Array(4);
function fluidCorners(ri, fid, out) {
  for (let cz = 0; cz < 2; cz++) for (let cx = 0; cx < 2; cx++) {
    let s = 0, n = 0, full = false;
    for (let dz = cz - 1; dz <= cz && !full; dz++) for (let dx = cx - 1; dx <= cx; dx++) { const h = fluidH(ri + dz * RW + dx, fid); if (h === 1 && fid === WATER) { full = true; break; } if (h >= 0) { s += h; n++; } }
    out[cx + cz * 2] = full ? 1 : n ? s / n : 0.875;
  }
  return out;
}
function waterFace(wx, y, wz, ri, f, H) {
  const g = gWat; g.room(4); if (g.ni + 6 > g.idx.length) g.alloc(g.cap * 2);
  const F = FACES[f], base = g.n, n = ri + NOFF[f], sk = rS[n] * 17, bl = rL[n] * 17;
  // corner water depths (0 at the shore) go to every vertex so the shader interpolates them bilinearly, not per triangle
  const D = [160, 160, 160, 160];
  if (f === 2) for (let k = 0; k < 4; k++) {
    const c = F.c[k], o = AOT[8 + k];
    D[c[0] + c[2] * 2] = (waterDepth(ri) + waterDepth(ri + o[0]) + waterDepth(ri + o[1]) + waterDepth(ri + o[2])) / 32 * 255;
  }
  for (let k = 0; k < 4; k++) {
    const c = F.c[k];
    vtx(g, wx + c[0], y + (c[1] ? H[c[0] + c[2] * 2] : 0), wz + c[2], c[0], c[2], D[0], D[1], D[2], D[3], 255, sk, bl, f);
  }
  quadIdx(g, base, false);
}
function makeChunkMesh(g, mat, cast, depthMat) {
  const geo = new THREE.BufferGeometry(), nv = g.n;
  geo.setAttribute("position", new THREE.BufferAttribute(g.pos.slice(0, nv * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(g.uv.slice(0, nv * 2), 2, true));
  geo.setAttribute("aTint", new THREE.BufferAttribute(g.tint.slice(0, nv * 4), 4, true));
  geo.setAttribute("aLight", new THREE.BufferAttribute(g.lit.slice(0, nv * 4), 4, true));
  geo.setAttribute("aBCol", new THREE.BufferAttribute(g.bcol.slice(0, nv * 4), 4, true));
  geo.setIndex(new THREE.BufferAttribute(nv > 65535 ? g.idx.slice(0, g.ni) : Uint16Array.from(g.idx.subarray(0, g.ni)), 1));
  const m = new THREE.Mesh(geo, mat);
  m.matrixAutoUpdate = false; m.userData.noShadowTag = 1;
  if (renderer.shadowMap.enabled) { m.castShadow = cast; m.receiveShadow = true; }
  if (depthMat) m.customDepthMaterial = depthMat;
  scene.add(m); return m;
}
function disposeChunk(c) {
  for (const m of [c.opaque, c.cutout, c.water]) if (m) { scene.remove(m); m.geometry.dispose(); }
}
// sky and block light (0..15) recorded for a world cell by the last mesh of its chunk
function lightAt(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (y >= WORLD_H) return 15;
  const c = chunks.get(ck(Math.floor(x / CH), Math.floor(z / CH)));
  if (!c || !c.sky || y < 0) return 15;
  return c.sky[y * CAREA + (z & 15) * CH + (x & 15)];
}
function blockLightAt(x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  const c = chunks.get(ck(Math.floor(x / CH), Math.floor(z / CH)));
  if (!c || !c.blk || y < 0 || y >= WORLD_H) return 0;
  return c.blk[y * CAREA + (z & 15) * CH + (x & 15)];
}
// an edit changes light up to LM blocks away, so neighbour chunks relight at low priority
const dirtyLow = new Set();
function markDirty(x, z) {
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH), lx = x - cx * CH, lz = z - cz * CH;
  dirty.add(ck(cx, cz));
  const xs = lx < LM ? -1 : lx >= CH - LM ? 1 : 0, zs = lz < LM ? -1 : lz >= CH - LM ? 1 : 0;
  for (const [ax, az] of [[xs, 0], [0, zs], [xs, zs]]) {
    if (!ax && !az) continue;
    const k = ck(cx + ax, cz + az); if (chunks.has(k) && !dirty.has(k)) dirtyLow.add(k);
  }
}
function remeshAll() { for (const k of chunks.keys()) dirty.add(k); }

function loadChunks() {
  const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
  const R = GFX[settings.gfx].dist;
  const need = [];
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz;
    if (!chunks.has(ck(cx, cz))) need.push([dx * dx + dz * dz, cx, cz]);
  }
  need.sort((a, b) => a[0] - b[0]);
  const t0 = performance.now();
  let built = 0;
  for (const n of need) { if (built >= 6 || (built > 0 && performance.now() - t0 > 7)) break; buildChunk(n[1], n[2]); built++; }
  // remesh edited chunks first, then relight their neighbours when there is time left
  let db = 4;
  for (const k of Array.from(dirty)) { if (db-- <= 0) break; const p = k.split(","); dirtyLow.delete(k); buildChunk(+p[0], +p[1]); dirty.delete(k); }
  if (dirtyLow.size && performance.now() - t0 < 9) { const k = dirtyLow.values().next().value; dirtyLow.delete(k); if (chunks.has(k)) { const p = k.split(","); buildChunk(+p[0], +p[1]); } }
  // unload far
  for (const k of Array.from(chunks.keys())) {
    const p = k.split(","); const dx = +p[0] - pcx, dz = +p[1] - pcz;
    if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) { disposeChunk(chunks.get(k)); chunks.delete(k); dirtyLow.delete(k); }
  }
  updatePortalMesh();
}
function clearWorld() {
  for (const c of chunks.values()) disposeChunk(c);
  chunks.clear(); dirty.clear(); dirtyLow.clear(); generated.clear(); W.clear(); CSTORE.clear(); FSTORE.clear(); if (typeof clearFluidQueues === "function") clearFluidQueues(); portalCells.length = 0; portalDest = {}; if (portalMesh) { scene.remove(portalMesh); portalMesh = null; }
  torchCells.length = 0; for (const m of [torchMesh, torchHead, torchGlow]) if (m) scene.remove(m); torchMesh = torchHead = torchGlow = null;
}

// portal blocks rendered separately (animated)
const portalCells = [];
let portalDest = {};                 // "x,y,z" -> destination dimension for that portal block
let portalMesh = null;
const portalMat = new THREE.ShaderMaterial({                    // swirling energy sheet, continuous across the whole portal
  uniforms: { uTime: U.uTime, uNoise: U.uNoise }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: "varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: "uniform float uTime; uniform sampler2D uNoise; varying vec3 vW; varying vec3 vN;\n" +
    "void main(){ vec2 p = (abs(vN.x) > 0.5 ? vW.zy : abs(vN.z) > 0.5 ? vW.xy : vW.xz) * 0.22;\n" +
    " float a = texture2D(uNoise, p + vec2(uTime * 0.03, -uTime * 0.05)).r; float b = texture2D(uNoise, p * 2.2 + vec2(a * 0.6, uTime * 0.07)).g;\n" +
    " float swirl = smoothstep(0.35, 0.9, b); vec3 c = mix(vec3(0.16, 0.02, 0.42), vec3(0.72, 0.24, 1.0), swirl) + vec3(0.9, 0.7, 1.0) * pow(swirl, 6.0) * 1.5;\n" +
    " gl_FragColor = vec4(c * 1.6, 0.72 + swirl * 0.25);\n#include <encodings_fragment>\n}"
});
const portalGeo = new THREE.BoxGeometry(1, 1, 1);
function rebuildPortalCells() {
  portalCells.length = 0;
  for (const [k, id] of W) if (id === PORTAL) { const p = k.split(","); portalCells.push([+p[0], +p[1], +p[2]]); }
  updatePortalMesh(true);
}
function updatePortalMesh(force) {
  if (!portalMesh || force) {
    if (portalMesh) scene.remove(portalMesh);
    if (!portalCells.length) { portalMesh = null; return; }
    portalMesh = new THREE.InstancedMesh(portalGeo, portalMat, portalCells.length);
    const d = new THREE.Object3D();
    for (let i = 0; i < portalCells.length; i++) { const c = portalCells[i]; d.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5); d.updateMatrix(); portalMesh.setMatrixAt(i, d.matrix); }
    portalMesh.instanceMatrix.needsUpdate = true; scene.add(portalMesh);
  }
}

// torch blocks rendered separately (glowing) + suppress night spawns nearby
const torchCells = [];
let torchMesh = null;
const torchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });                         // wooden stick
const torchHeadMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });                         // burning head, unlit and bright
const torchGeo = new THREE.BoxGeometry(0.11, 0.52, 0.11), torchHeadGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const torchGlowMat = new THREE.SpriteMaterial({ map: glowTex("rgba(255,190,100,0.55)", "rgba(255,110,30,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
let torchHead = null, torchGlow = null;
function rebuildTorchCells() {
  torchCells.length = 0;
  for (const [k, id] of W) if (id === TORCH) { const p = k.split(","); torchCells.push([+p[0], +p[1], +p[2]]); }
  for (const m of [torchMesh, torchHead, torchGlow]) if (m) scene.remove(m);
  torchMesh = torchHead = torchGlow = null;
  if (!torchCells.length) return;
  torchMesh = new THREE.InstancedMesh(torchGeo, torchMat, torchCells.length);
  torchHead = new THREE.InstancedMesh(torchHeadGeo, torchHeadMat, torchCells.length);
  const d = new THREE.Object3D();
  torchGlow = new THREE.Group(); torchGlow.userData.noShadowTag = 1;
  for (let i = 0; i < torchCells.length; i++) {
    const c = torchCells[i];
    d.position.set(c[0] + 0.5, c[1] + 0.26, c[2] + 0.5); d.updateMatrix(); torchMesh.setMatrixAt(i, d.matrix);
    d.position.set(c[0] + 0.5, c[1] + 0.58, c[2] + 0.5); d.updateMatrix(); torchHead.setMatrixAt(i, d.matrix);
    const sp = new THREE.Sprite(torchGlowMat); sp.position.set(c[0] + 0.5, c[1] + 0.62, c[2] + 0.5); sp.scale.set(1.1, 1.1, 1); torchGlow.add(sp);
  }
  torchMesh.instanceMatrix.needsUpdate = true; torchHead.instanceMatrix.needsUpdate = true;
  torchHead.userData.noShadowTag = 1;
  scene.add(torchMesh); scene.add(torchHead); scene.add(torchGlow);
}
function nearTorch(x, z, rad) { for (const c of torchCells) { const dx = c[0] - x, dz = c[2] - z; if (dx * dx + dz * dz < rad * rad) return true; } return false; }
// base defense: spike traps damage nearby monsters, alarm bells warn of raids
const spikeCells = [], alarmCells = [], healCells = [], frostCells = [];
function rebuildDefenseCells() {
  spikeCells.length = 0; alarmCells.length = 0; healCells.length = 0; frostCells.length = 0;
  for (const [k, id] of W) {
    if (id === SPIKE) { const p = k.split(","); spikeCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === ALARM) { const p = k.split(","); alarmCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === HEAL) { const p = k.split(","); healCells.push([+p[0], +p[1], +p[2]]); }
    else if (id === FROST) { const p = k.split(","); frostCells.push([+p[0], +p[1], +p[2]]); }
  }
}
// floating "Freda" name plates over the explosive blocks
let fredaLabelGroup = null;
function rebuildFredaLabels() {
  if (fredaLabelGroup) { scene.remove(fredaLabelGroup); fredaLabelGroup = null; }
  const cells = []; for (const [k, id] of W) if (id === FREDA) { const p = k.split(","); cells.push([+p[0], +p[1], +p[2]]); }
  if (!cells.length) return;
  fredaLabelGroup = new THREE.Group();
  for (const c of cells) { const s = makeTag("Freda"); s.scale.set(1.0, 0.26, 1); s.position.set(c[0] + 0.5, c[1] + 1.15, c[2] + 0.5); fredaLabelGroup.add(s); }
  scene.add(fredaLabelGroup);
}
// floating signs that hover over each portal so destinations are easy to find
let portalSignGroup = null;
function clearPortalSigns() { if (portalSignGroup) { scene.remove(portalSignGroup); portalSignGroup = null; } }
function makeSign(text, col) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 40; const x = c.getContext("2d");
  x.fillStyle = "rgba(0,0,0,.62)"; x.fillRect(0, 0, 256, 40);
  x.fillStyle = col || "#ffe14d"; x.font = "bold 24px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 128, 21);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(3.2, 0.5, 1); return s;
}
function addPortalSign(cx, baseY, z, text, col) {
  if (!portalSignGroup) { portalSignGroup = new THREE.Group(); scene.add(portalSignGroup); }
  const s = makeSign(text, col); s.position.set(cx + 0.5, baseY + 5.2, z + 0.5); portalSignGroup.add(s);
}

// chest storage (per dimension + position) and player block edits (for save/load)
let chestStore = new Map();           // "dim:x,y,z" -> [9 stacks]
const editsByDim = { overworld: new Map(), fire: new Map(), end: new Map(), sky: new Map(), realm: new Map(), mario: new Map() };
function chestKey(x, y, z) { return DIM + ":" + bk(x, y, z); }
function recordEdit(x, y, z, id) { const m = editsByDim[DIM]; if (m) m.set(bk(x, y, z), id); const fm = flowEditsByDim[DIM]; if (fm) fm.delete(bk(x, y, z)); fluidNotify(x, y, z); }
const flowEditsByDim = { overworld: new Map(), fire: new Map(), end: new Map(), sky: new Map(), realm: new Map(), mario: new Map() };
