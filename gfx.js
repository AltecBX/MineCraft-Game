/* ===========================================================================
   GFX  -  procedural textures, shaders and the atmosphere model for the voxel
   renderer. Classic script loaded before game.js. Exposes window.GFXLIB.
   No asset files: every block texture is painted here from seeded noise.
=========================================================================== */
(function () {
"use strict";

// ---------- atlas layout ----------
// 64px tiles stored in 128px cells. The 32px border around each tile repeats the tile
// (wrap padding), so mipmapping never bleeds a neighbouring tile into a block face.
// The atlas is 16 x 8 cells (2048 x 1024), so tiles carry separate u and v scales (s, sv).
const T = 64, PAD = 32, CELL = T + PAD * 2, COLS = 16, ROWS = 8, SIZE = CELL * COLS, HGT = CELL * ROWS;

// ---------- seeded, tile periodic noise ----------
function ih(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function wrapi(i, n) { return ((i % n) + n) % n; }
function pn(u, v, fu, fv, s) {                      // value noise with an fu x fv lattice that tiles over the unit square
  const x = u * fu, y = v * fv, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = wrapi(xi, fu), x1 = wrapi(xi + 1, fu), y0 = wrapi(yi, fv), y1 = wrapi(yi + 1, fv);
  const a = ih(x0, y0, s), b = ih(x1, y0, s), c = ih(x0, y1, s), d = ih(x1, y1, s);
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function fbm(u, v, f, oct, s, fv) {
  let sum = 0, amp = 0.5, tot = 0, fu = f, fw = fv || f;
  for (let i = 0; i < oct; i++) { sum += pn(u, v, fu, fw, s + i * 17) * amp; tot += amp; amp *= 0.5; fu *= 2; fw *= 2; }
  return sum / tot;
}
const WR = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };
function worley(u, v, n, s) {                        // periodic cellular noise, distances in cell units
  const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = wrapi(cx, n), wy = wrapi(cy, n);
    const px = cx + 0.15 + ih(wx, wy, s) * 0.7, py = cy + 0.15 + ih(wx, wy, s + 7) * 0.7;
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = ih(wx, wy, s + 13); bx = px - x; by = py - y; } else if (d < f2) f2 = d;
  }
  WR.f1 = f1; WR.f2 = f2; WR.id = id; WR.cx = bx; WR.cy = by; return WR;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// ---------- tile buffer helpers (float RGBA 0..255, wraps at the tile edge) ----------
function newBuf(a) { const B = new Float32Array(T * T * 4); if (a !== 0) for (let i = 3; i < B.length; i += 4) B[i] = 255; return B; }
function idx(x, y) { return (((y | 0) & (T - 1)) * T + ((x | 0) & (T - 1))) * 4; }
function fill(B, fn) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const c = fn(x / T, y / T, x, y), i = (y * T + x) * 4;
    B[i] = c[0]; B[i + 1] = c[1]; B[i + 2] = c[2]; B[i + 3] = c.length > 3 ? c[3] : 255;
  }
}
function put(B, x, y, c, t, a) {                     // blend colour c into a pixel; a sets alpha
  const i = idx(Math.round(x), Math.round(y)), k = t == null ? 1 : t;
  B[i] += (c[0] - B[i]) * k; B[i + 1] += (c[1] - B[i + 1]) * k; B[i + 2] += (c[2] - B[i + 2]) * k;
  if (a != null) B[i + 3] = a;
}
function get(B, x, y) { const i = idx(x, y); return [B[i], B[i + 1], B[i + 2], B[i + 3]]; }
function scale(B, x, y, f) { const i = idx(x, y); B[i] *= f; B[i + 1] *= f; B[i + 2] *= f; }
function glow(B, x, y, g) { const i = idx(x, y); B[i + 3] = Math.min(B[i + 3], 255 * (1 - g)); }   // alpha < 255 marks emissive texels on opaque blocks

// tiny 5x7 pixel font for block labels
const GLYPH = {
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"]
};
function text(B, str, cx, cy, sc, col, shadow) {
  const w = str.length * 5 * sc + (str.length - 1) * sc, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 3.5 * sc);
  for (let pass = shadow ? 0 : 1; pass < 2; pass++) {
    const off = pass === 0 ? Math.max(1, sc >> 1) : 0, c = pass === 0 ? shadow : col;
    for (let k = 0; k < str.length; k++) { const g = GLYPH[str[k]]; if (!g) continue;
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (g[gy][gx] === "1")
        for (let sy = 0; sy < sc; sy++) for (let sx = 0; sx < sc; sx++) put(B, x0 + k * 6 * sc + gx * sc + sx + off, y0 + gy * sc + sy + off, c);
    }
  }
}

// ---------- shared material painters ----------
function paintDirt(B, s) {
  fill(B, (u, v, x, y) => {
    const b = fbm(u, v, 4, 5, s), g = pn(u, v, 32, 32, s + 1), m = fbm(u, v, 12, 2, s + 2);
    let f = 0.74 + b * 0.42 + (g - 0.5) * 0.16 + (m - 0.5) * 0.3;
    f = Math.round(f * 18) / 18;
    let c = mulc([116, 82, 55], f);
    const w = worley(u, v, 9, s + 3), pr = 0.08 + w.id * 0.12;
    if (w.f1 < pr && w.id > 0.72) {                            // scattered pebbles of varied size, lit from the top left
      const sh = 1 + (-w.cx - w.cy) * 1.4, gray = 0.5 + ih(w.id * 999, 3, s) * 0.5;
      c = mulc(mixc([124, 100, 76], [134, 126, 116], gray), (0.86 + (1 - w.f1 / pr) * 0.16) * sh);
    }
    const sp = ih(x, y, s + 4); if (sp > 0.985) c = mulc(c, 0.68); else if (sp < 0.012) c = mulc(c, 1.18);
    return c;
  });
}
const GRASS_PAL = [[86, 146, 50], [74, 132, 42], [104, 160, 58], [64, 118, 38], [118, 172, 66], [94, 150, 46]];
function paintGrassTop(B, s) {
  fill(B, (u, v) => { const b = fbm(u, v, 4, 4, s); return mulc([58, 100, 36], 0.85 + b * 0.3); });
  for (let k = 0; k < 1700; k++) {                              // a dense lawn of short blades
    const x0 = ih(k, 1, s) * T, y0 = ih(k, 2, s) * T, len = 2 + ih(k, 3, s) * 4, ang = ih(k, 4, s) * 6.2832;
    const pc = GRASS_PAL[(ih(k, 5, s) * GRASS_PAL.length) | 0], sh = 0.84 + ih(k, 6, s) * 0.3;
    for (let t = 0; t < len; t++) put(B, x0 + Math.cos(ang) * t, y0 + Math.sin(ang) * t, mulc(pc, sh * (0.9 + t / len * 0.18)));
  }
  for (let k = 0; k < 40; k++) put(B, ih(k, 9, s) * T, ih(k, 10, s) * T, [150, 180, 70]);   // sun-bleached tips
}
function paintFringe(B, s, pal, minL, var1, drip, dark) {       // grass/mycelium overhang on a side face
  for (let x = 0; x < T; x++) {
    const L = minL + pn(x / T, 0.5, 8, 1, s) * var1 + (ih(x, 7, s) > 0.82 ? ih(x, 8, s) * drip : 0);
    for (let y = 0; y < L; y++) {
      const pc = pal[(ih(x, y, s + 11) * pal.length) | 0];
      put(B, x, y, mulc(pc, (0.86 + ih(x, y, s + 12) * 0.22) * (y > L - 2 ? 0.8 : 1)));
    }
    scale(B, x, Math.floor(L), dark); scale(B, x, Math.floor(L) + 1, 0.9);
  }
}
function paintStone(B, s, base) {
  const bc = base || [126, 126, 128];
  fill(B, (u, v, x, y) => {
    const b = fbm(u, v, 4, 4, s), m = fbm(u, v, 16, 2, s + 20), g = pn(u, v, 32, 32, s + 50);
    let f = 0.62 + b * 0.5 + (m - 0.5) * 0.42 + (g - 0.5) * 0.12;
    f = Math.round(f * 16) / 16;                                             // chunky mineral blotches
    const r = 1 - Math.abs(fbm(u, v, 5, 3, s + 7) * 2 - 1);                  // ridged noise traces meandering fractures
    if (r > 0.95) f *= 0.8 + (1 - r) * 3;
    const sp = ih(x, y, s + 3); if (sp > 0.988) f += 0.16; else if (sp < 0.01) f -= 0.18;
    const warm = (pn(u, v, 6, 6, s + 30) - 0.5) * 0.06;
    return [bc[0] * f * (1 + warm), bc[1] * f, bc[2] * f * (1 - warm)];
  });
}
function paintPlanks(B, s, base) {
  const bc = base || [168, 126, 74];
  fill(B, (u, v, x, y) => {
    const bi = y >> 4, by = y & 15, tone = 0.9 + ih(bi, 1, s) * 0.2;
    const grain = pn(u + ih(bi, 2, s), v, 2, 28, s + bi * 31), fine = pn(u, v, 4, 64, s + 5);
    let f = tone * (0.8 + grain * 0.3 + (fine - 0.5) * 0.1);
    const jx = (ih(bi, 3, s) * T) | 0;
    if (by === 0) f *= 0.42; else if (by === 15) f *= 0.8; else if (by === 1) f *= 1.1;
    if (x === jx) f *= 0.45; else if (x === ((jx + 1) & 63)) f *= 0.85;
    if ((by === 4 || by === 11) && (x === ((jx + 3) & 63) || x === ((jx - 3) & 63))) return [70, 64, 60];
    const kx = ih(bi, 9, s) * T, dx = Math.abs(((x - kx + 96) % 64) - 32), dy = Math.abs(by - 8);   // an occasional knot
    if (ih(bi, 10, s) > 0.55 && dx < 4 && dy < 3) f *= 0.7 + (dx + dy) * 0.05;
    return mulc(bc, f);
  });
}
function paintBark(B, s, base) {
  const bc = base || [98, 74, 48];
  fill(B, (u, v, x, y) => {
    const ridge = fbm(u, v, 12, 3, s, 2), fine = pn(u, v, 48, 8, s + 9);
    const fis = Math.abs(fbm(u, v, 7, 2, s + 5, 2) * 2 - 1);                 // meandering vertical fissures
    let f = 0.66 + ridge * 0.62 + (fine - 0.5) * 0.18;
    if (fis < 0.1) f *= 0.42 + fis * 4; else if (fis < 0.16) f *= 1.1;
    f = Math.round(f * 14) / 14;
    if (ih(x, y, s + 2) > 0.985) f *= 1.2;
    return mulc(bc, f);
  });
}
function paintCrystals(B, s, n, thr, c1, c2, g) {             // glowing angular crystal shards set into the current buffer
  const FS = [1.25, 0.98, 0.72, 1.06];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const w = worley(x / T, y / T, n, s);
    if (w.id <= thr) continue;
    const ang = w.id * 40, ca = Math.cos(ang), sa = Math.sin(ang), lx = -w.cx * ca - w.cy * sa, ly = w.cx * sa - w.cy * ca;
    const d = Math.abs(lx) * 1.1 + Math.abs(ly) * (1.5 + w.id * 0.8);    // elongated diamond
    const R = 0.42 + (w.id - thr) * 0.5;
    if (d < R) {
      const t = 1 - d / R, facet = (lx > 0 ? 1 : 0) + (ly > 0 ? 2 : 0);
      let c = mulc(mixc(c1, c2, t * 0.9), FS[facet]);
      if (Math.abs(ly) < 0.02 * R * 10 && t > 0.3) c = mixc(c, c2, 0.5);
      if (d > R * 0.86) c = mulc(c, 0.6);
      put(B, x, y, c); glow(B, x, y, g * (0.5 + t * 0.5));
    }
  }
}
function bevel(B, w, lo, hi) { for (let i = 0; i < T; i++) for (let k = 0; k < w; k++) { scale(B, i, k, hi); scale(B, k, i, hi); scale(B, i, T - 1 - k, lo); scale(B, T - 1 - k, i, lo); } }
function hazard(B, y0, y1) { for (let y = y0; y < y1; y++) for (let x = 0; x < T; x++) put(B, x, y, (((x + y) >> 3) & 1) ? [34, 30, 28] : [236, 190, 40]); }
function blade(B, x0, h, bend, w, cLo, cHi) {                 // one grass blade growing up from the bottom edge
  for (let t = 0; t < h; t++) {
    const k = t / h, x = x0 + bend * k * k, y = T - 1 - t, c = mixc(cLo, cHi, k);
    const ww = w * (1 - k * 0.7);
    for (let o = 0; o < ww; o++) put(B, x + o, y, mulc(c, o === 0 ? 1 : 0.86), 1, 255);
  }
}
function flower(B, s, petal, center, kind) {
  for (let t = 0; t < 34; t++) { const sx = 31 + Math.sin(t * 0.12) * 1.2; put(B, sx, T - 1 - t, [58, 112, 36], 1, 255); put(B, sx + 1, T - 1 - t, [44, 92, 28], 1, 255); }   // stem
  for (let t = 0; t < 9; t++) { put(B, 31 - t, T - 12 - t * 0.6, [70, 130, 42], 1, 255); put(B, 32 + t, T - 18 - t * 0.5, [66, 124, 40], 1, 255); }
  const cx = 31.5, cy = 22;
  for (let y = 8; y < 36; y++) for (let x = 16; x < 48; x++) {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let R = kind === "star" ? 8 + 3 * Math.cos(a * 8) : kind === "daisy" ? 9 + 2.5 * Math.cos(a * 12) : kind === "puff" ? 8 + ih(x, y, s) * 2 : 8.5 + 1.5 * Math.cos(a * 4);
    if (r < R) {
      const sh = 0.75 + (1 - r / R) * 0.35 + (dy < 0 ? 0.08 : -0.05);
      put(B, x, y, mulc(r < 3.2 ? center : petal, sh), 1, 255);
    }
  }
}

function paintOre(B, s, col, hi, thr, g) {                 // chunky mineral nuggets in 4px cells, clustered by cellular noise
  paintStone(B, s + 3);
  for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) {
    const w = worley((cx + 0.5) / 16, (cy + 0.5) / 16, 4, s);
    if (w.id < thr || w.f1 > 0.42 || ih(cx, cy, s + 9) < 0.35) continue;
    const tone = 0.8 + ih(cx, cy, s + 10) * 0.35;
    for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
      if ((px === 0 || px === 3) && (py === 0 || py === 3) && ih(cx * 4 + px, cy * 4 + py, s) < 0.6) continue;
      const edge = px === 0 || py === 0 ? 1.18 : px === 3 || py === 3 ? 0.7 : 1;
      const c = mixc(col, hi, (px + py) < 3 ? 0.6 : 0.1);
      put(B, cx * 4 + px, cy * 4 + py, mulc(c, tone * edge));
      if (g) glow(B, cx * 4 + px, cy * 4 + py, g * (px + py < 3 ? 1 : 0.5));
    }
  }
}
function paintStoneBrick(B, s, base) {
  const bc = base || [128, 128, 130];
  fill(B, (u, v, x, y) => {
    const row = y >> 4, ry = y & 15, sx = (x + (row & 1) * 16) & 63, bx = sx & 31;
    const n = fbm(u, v, 8, 3, s), g = (ih(x, y, s + 1) - 0.5) * 0.1;
    if (ry >= 14 || bx >= 31) return mulc(bc, 0.45 + n * 0.15);
    let f = 0.86 + n * 0.24 + g + (ih(row, (x + (row & 1) * 16) >> 5, s + 2) - 0.5) * 0.12;
    if (ry === 0 || bx === 0) f *= 1.14; else if (ry === 13 || bx === 30) f *= 0.8;
    if (pn(u, v, 12, 12, s + 4) > 0.78) f *= 0.88;
    return mulc(bc, f);
  });
}
function paintLeafCluster(B, s, pal, holes, needles) {
  fill(B, () => [26, 44, 22, 0]);
  if (needles) {
    for (let k = 0; k < 900; k++) {
      const x0 = ih(k, 1, s) * T, y0 = ih(k, 2, s) * T, ang = 1.2 + (ih(k, 3, s) - 0.5) * 1.4, len = 3 + ih(k, 4, s) * 3, pc = mulc(pal[(ih(k, 5, s) * pal.length) | 0], 0.8 + ih(k, 6, s) * 0.35);
      for (let t = 0; t < len; t++) put(B, x0 + Math.cos(ang) * t, y0 + Math.sin(ang) * t, pc, 1, 255);
    }
  } else for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 170; k++) {
    const cx = ih(k, 1 + pass * 9, s) * T, cy = ih(k, 2 + pass * 9, s) * T, a = 1.8 + ih(k, 3, s) * 1.5, b = 1.2 + ih(k, 4, s) * 1.0, ang = ih(k, 5, s) * 3.1416;
    const pc = mulc(pal[(ih(k, 6 + pass, s) * pal.length) | 0], pass === 0 ? 0.72 : 0.95 + ih(k, 8, s) * 0.2), ca = Math.cos(ang), sa = Math.sin(ang);
    for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) { const lx = (ox * ca + oy * sa) / a, ly = (-ox * sa + oy * ca) / b; if (lx * lx + ly * ly > 1) continue; put(B, cx + ox, cy + oy, mulc(pc, 1 + (-ox - oy) * 0.035), 1, 255); }
  }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4; if (B[i + 3] > 0) continue;
    if (pn(x / T, y / T, 16, 16, s + 40) > holes && ih(x, y, s + 41) > 0.25) continue;
    const dk = mulc(pal[0], 0.45); B[i] = dk[0]; B[i + 1] = dk[1]; B[i + 2] = dk[2]; B[i + 3] = 255;
  }
}

// ---------- every tile ----------
const PAINT = {
  grass_top(B, s) { paintGrassTop(B, s); },
  grass_side(B, s) { paintDirt(B, 11); paintFringe(B, s, GRASS_PAL, 9, 6, 8, 0.72); },
  dirt(B) { paintDirt(B, 11); },
  stone(B, s) { paintStone(B, s); },
  cobble(B, s) {
    fill(B, (u, v, x, y) => {
      const w = worley(u, v, 4, s), e = w.f2 - w.f1, id = w.id, h = sstep(0, 0.38, e);
      const a = worley(u + 1 / T, v, 4, s), hx = sstep(0, 0.38, a.f2 - a.f1) - h;
      const b = worley(u, v + 1 / T, 4, s), hy = sstep(0, 0.38, b.f2 - b.f1) - h;
      const det = fbm(u, v, 8, 3, s + 5), sh = clamp(1 + (hx + hy) * 7, 0.55, 1.4);
      if (e < 0.06) return mulc([62, 60, 57], 0.8 + det * 0.4);
      const tone = 0.72 + id * 0.45, f = tone * (0.84 + det * 0.3) * sh * (0.6 + 0.4 * h);
      return [118 * f * (0.97 + id * 0.05), 118 * f, 120 * f * (1.03 - id * 0.05)];
    });
  },
  sand(B, s) {
    fill(B, (u, v, x, y) => {
      const rip = Math.sin((v * 5 + fbm(u, v, 3, 2, s) * 0.9) * 6.2832);
      let f = 0.94 + (pn(u, v, 32, 32, s + 1) - 0.5) * 0.1 + (ih(x, y, s) - 0.5) * 0.09 + rip * 0.025 + (fbm(u, v, 4, 3, s + 3) - 0.5) * 0.08;
      const sp = ih(x, y, s + 5); if (sp > 0.975) f -= 0.14; else if (sp < 0.02) f += 0.08;
      return mulc([198, 180, 134], f);
    });
  },
  log_side(B, s) { paintBark(B, s); },
  log_top(B, s) {
    fill(B, (u, v, x, y) => {
      const dx = (x - 31.5) / 32, dy = (y - 31.5) / 32, eu = Math.hypot(dx, dy), ch = Math.max(Math.abs(dx), Math.abs(dy));
      const r = eu * 0.55 + ch * 0.45, n = fbm(u, v, 4, 3, s);
      if (r > 0.86) { const b = fbm(u, v, 8, 3, s + 4); return mulc([86, 64, 40], 0.7 + b * 0.5); }
      const ring = Math.sin((r * 8 + n * 0.7) * 6.2832) * 0.5 + 0.5;
      let c = mixc([178, 138, 86], [142, 102, 60], ring * ring);
      if (r < 0.05) c = mulc(c, 0.7);
      const ang = Math.atan2(dy, dx);
      if (r > 0.45 && r < 0.8 && Math.abs(Math.sin(ang * 1.5 + s)) < 0.02) c = mulc(c, 0.8);
      return mulc(c, 0.94 + (ih(x, y, s) - 0.5) * 0.08);
    });
  },
  leaves(B, s) {
    fill(B, () => [30, 52, 20, 0]);
    const pal = [[50, 96, 30], [62, 112, 38], [74, 126, 44], [86, 140, 50], [56, 104, 34]];
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 150; k++) {
      const cx = ih(k, 1 + pass * 9, s) * T, cy = ih(k, 2 + pass * 9, s) * T, a = 2.2 + ih(k, 3, s) * 1.8, b = 1.3 + ih(k, 4, s) * 1.1, ang = ih(k, 5, s) * 3.1416;
      const pc = mulc(pal[(ih(k, 6 + pass, s) * pal.length) | 0], pass === 0 ? 0.72 : 0.95 + ih(k, 8, s) * 0.2), ca = Math.cos(ang), sa = Math.sin(ang);
      for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
        const lx = (ox * ca + oy * sa) / a, ly = (-ox * sa + oy * ca) / b, d = lx * lx + ly * ly;
        if (d > 1) continue;
        const sh = 1 + (-ox - oy) * 0.035 - (Math.abs(ly) < 0.18 ? 0.12 : 0);
        put(B, cx + ox, cy + oy, mulc(pc, sh), 1, 255);
      }
    }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {        // gaps read as shaded inner foliage; only a few true holes
      const i = (y * T + x) * 4; if (B[i + 3] > 0) continue;
      if (pn(x / T, y / T, 16, 16, s + 40) > 0.6 && ih(x, y, s + 41) > 0.25) continue;
      B[i] = 26 + ih(x, y, s) * 14; B[i + 1] = 48 + ih(x, y, s + 1) * 20; B[i + 2] = 18 + ih(x, y, s + 2) * 8; B[i + 3] = 255;
    }
  },
  planks(B, s) { paintPlanks(B, s); },
  snow(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 4, s), g = pn(u, v, 16, 16, s + 1);
      let c = [222 * (0.95 + f * 0.07), 230 * (0.95 + f * 0.06), 240 * (0.96 + f * 0.05)];
      if (g < 0.3) c = mulc(c, 0.97);
      if (ih(x, y, s) > 0.994) c = [255, 255, 255];
      return c;
    });
  },
  brick(B, s) {
    fill(B, (u, v, x, y) => {
      const row = y >> 4, ry = y & 15, sx = (x + (row & 1) * 16) & 63, bx = sx & 31, col = sx >> 5;
      const n = fbm(u, v, 8, 3, s);
      if (ry >= 13 || bx >= 30) return mulc([166, 158, 148], 0.82 + n * 0.3);
      const t = ih(row, col, s), base = [140 + t * 34, 58 + t * 18, 46 + t * 12];
      let f = 0.84 + n * 0.28 + (ih(x, y, s + 2) - 0.5) * 0.1;
      if (bx === 0 || ry === 0) f *= 1.12; else if (bx === 29 || ry === 12) f *= 0.82;
      if (pn(u, v, 16, 16, s + 3) > 0.8) f *= 0.86;
      return mulc(base, f);
    });
  },
  firestone(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 5, 5, s), w = worley(u, v, 6, s + 3);
      let k = 0.58 + f * 0.8; if (w.f1 < 0.28) k *= 1.14; if (w.f2 - w.f1 < 0.06) k *= 0.62;
      if (ih(x, y, s + 1) > 0.982) return [168, 56, 42];
      return mulc([108, 34, 32], k);
    });
  },
  endstone(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 4, s), w = worley(u, v, 8, s + 2);
      let k = 0.9 + f * 0.16 + (ih(x, y, s) - 0.5) * 0.06;
      if (w.f1 < 0.24 && w.id > 0.4) k *= 0.8 + (w.cy > 0 ? 0.08 : -0.04);
      return mulc([220, 222, 160], k);
    });
  },
  mycelium_top(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 6, 4, s), r = ih(x, y, s);
      let c = r > 0.5 ? [134, 110, 140] : [98, 80, 104]; c = mulc(c, 0.86 + f * 0.26);
      if (r > 0.97) c = [196, 170, 190];
      return c;
    });
  },
  mycelium_side(B, s) { paintDirt(B, 11); paintFringe(B, s, [[120, 98, 128], [98, 80, 104], [140, 116, 146]], 6, 4, 5, 0.75); },
  mushroom_cap(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 4, s), w = worley(u, v, 3, s + 1);
      if (w.f1 < 0.26) { const t = sstep(0.26, 0.2, w.f1); return mixc(mulc([188, 42, 34], 0.8 + f * 0.3), [234, 226, 214], t); }
      return mulc([188, 42, 34], 0.8 + f * 0.3 + (ih(x, y, s) - 0.5) * 0.06);
    });
  },
  mushroom_gills(B, s) { fill(B, (u, v, x, y) => mulc([214, 200, 176], 0.86 + Math.abs(Math.sin(x * 0.9 + fbm(u, v, 4, 2, s) * 6)) * 0.14 + (ih(x, y, s) - 0.5) * 0.05)); },
  chest_top(B, s) {
    paintPlanks(B, s, [158, 108, 56]);
    for (let i = 0; i < T; i++) for (let k = 0; k < 4; k++) { put(B, i, k, [80, 52, 28]); put(B, k, i, [80, 52, 28]); put(B, i, T - 1 - k, [72, 46, 24]); put(B, T - 1 - k, i, [72, 46, 24]); }
  },
  chest_side(B, s) {
    paintPlanks(B, s + 3, [158, 108, 56]);
    for (let i = 0; i < T; i++) for (let k = 0; k < 4; k++) { put(B, i, k, [80, 52, 28]); put(B, k, i, [80, 52, 28]); put(B, i, T - 1 - k, [72, 46, 24]); put(B, T - 1 - k, i, [72, 46, 24]); }
    for (let x = 4; x < 60; x++) { put(B, x, 22, [60, 40, 22]); put(B, x, 23, [96, 66, 36]); }
    for (let y = 16; y < 32; y++) for (let x = 27; x < 37; x++) { const e = x === 27 || x === 36 || y === 16 || y === 31; put(B, x, y, e ? [70, 72, 78] : mulc([168, 172, 180], 0.9 + (x - 27) * 0.012 - (y - 16) * 0.01)); }
    for (let y = 24; y < 28; y++) for (let x = 30; x < 34; x++) put(B, x, y, [40, 40, 46]);
  },
  bed_top(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 3, s), weave = ((x + y) & 1) ? 1.04 : 0.95;
      if (y < 20) { const e = Math.min(x - 3, 60 - x, y - 3, 18 - y); return mulc([236, 232, 226], (0.88 + f * 0.12) * (e < 2 ? 0.86 : 1)); }
      return mulc([172, 36, 44], (0.8 + f * 0.3) * weave);
    });
    for (let i = 0; i < T; i++) for (let k = 0; k < 2; k++) { put(B, i, k, [110, 76, 44]); put(B, k, i, [110, 76, 44]); put(B, i, T - 1 - k, [96, 66, 38]); put(B, T - 1 - k, i, [96, 66, 38]); }
  },
  bed_side(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 3, s);
      if (y < 36) return mulc([172, 36, 44], (0.82 + f * 0.28) * (((x + y) & 1) ? 1.03 : 0.96) * (y > 32 ? 0.8 : 1));
      if ((x < 8 || x > 55) && y > 44) return mulc([92, 62, 34], 0.9 + f * 0.2);
      return mulc([132, 92, 52], 0.84 + pn(u, v, 2, 24, s) * 0.3);
    });
  },
  fire_crystal(B, s) { PAINT.firestone(B, s + 1); paintCrystals(B, s, 5, 0.42, [255, 120, 30], [255, 236, 150], 0.85); },
  crystal(B, s) { paintStone(B, s + 2); paintCrystals(B, s, 5, 0.4, [40, 170, 230], [210, 252, 255], 0.72); },
  slime(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 4, 3, s), outer = Math.min(x, y, 63 - x, 63 - y), inner = x > 15 && x < 48 && y > 15 && y < 48;
      let c = mulc([108, 196, 88], 0.9 + f * 0.16);
      if (outer < 3) c = [150, 228, 120];
      if (inner) { c = mulc([70, 150, 58], 0.9 + f * 0.2); if (x === 16 || y === 16 || x === 47 || y === 47) c = [56, 124, 46]; }
      if ((x > 6 && x < 12 && y > 6 && y < 9) || (x > 6 && x < 9 && y > 6 && y < 14)) c = [214, 252, 196];
      return c;
    });
  },
  spike_top(B, s) {
    fill(B, (u, v, x, y) => {
      const lx = (x & 15) - 7.5, ly = (y & 15) - 7.5, ax = Math.abs(lx), ay = Math.abs(ly), m = Math.max(ax, ay);
      let f = ax > ay ? (lx > 0 ? 0.62 : 1.12) : (ly > 0 ? 0.5 : 1.25);
      if (m < 1.2) f = 1.4; if (m > 6.8) f = 0.72;
      return mulc([152, 158, 166], f * (0.94 + (ih(x, y, s) - 0.5) * 0.08));
    });
  },
  metal_side(B, s) {
    fill(B, (u, v, x, y) => {
      let f = 0.86 + pn(u, v, 2, 40, s) * 0.2 + (ih(x, y, s) - 0.5) * 0.05;
      const e = Math.min(x, y, 63 - x, 63 - y); if (e < 2) f *= 0.62; else if (e < 3) f *= 1.15;
      const rx = Math.min(Math.hypot(x - 7, y - 7), Math.hypot(x - 56, y - 7), Math.hypot(x - 7, y - 56), Math.hypot(x - 56, y - 56));
      if (rx < 2.6) f *= rx < 1.2 ? 1.35 : 0.7;
      return mulc([128, 134, 142], f);
    });
  },
  gold_bell(B, s) {
    fill(B, (u, v, x, y) => {
      let f = 0.84 + pn(u, v, 1, 10, s) * 0.22 + (ih(x, y, s) - 0.5) * 0.05;
      const e = Math.min(x, y, 63 - x, 63 - y); if (e < 3) f *= (x < 3 || y < 3) ? 1.18 : 0.72;
      let c = mulc([226, 172, 52], f);
      const dx = Math.abs(x - 31.5), body = y > 18 && y < 44 && dx < 7 + (y - 18) * 0.34, rim = y >= 44 && y < 48 && dx < 17, knob = Math.hypot(x - 31.5, y - 15) < 3.5;
      if (body || rim || knob) c = mulc([150, 100, 26], 0.9 + (31.5 - x) * 0.018 + (body && x < 30 && x > 26 ? 0.25 : 0));
      if (Math.hypot(x - 31.5, y - 50) < 2.6) c = [110, 72, 20];
      return c;
    });
  },
  freda_top(B, s) {
    fill(B, (u, v, x, y) => {
      const lx = ((x % 21) - 10), ly = ((y % 21) - 10), r = Math.hypot(lx, ly);
      let c = mulc([188, 40, 36], 0.86 + fbm(u, v, 4, 3, s) * 0.24);
      if (r > 7 && r < 9) c = mulc(c, 0.6); if (r < 2.5) c = [70, 60, 56];
      return c;
    });
  },
  freda_side(B, s) {
    fill(B, (u, v, x, y) => {
      const tube = 0.72 + 0.36 * Math.abs(Math.sin((x + 0.5) / 64 * Math.PI * 4));
      if (y >= 22 && y < 42) return mulc([238, 232, 220], (y === 22 || y === 41) ? 0.7 : 0.94 + (ih(x, y, s) - 0.5) * 0.06);
      return mulc([190, 40, 36], tube * (0.92 + fbm(u, v, 4, 2, s) * 0.14));
    });
    text(B, "FREDA", 32, 32, 2, [26, 20, 20]);
  },
  launch_top(B, s) {
    fill(B, (u, v, x, y) => mulc([240, 172, 40], 0.9 + fbm(u, v, 4, 2, s) * 0.14));
    hazard(B, 0, 6); hazard(B, 58, 64);
    for (let y = 6; y < 58; y++) for (let x = 0; x < 6; x++) { put(B, x, y, (((x + y) >> 3) & 1) ? [34, 30, 28] : [236, 190, 40]); put(B, 63 - x, y, (((x + y) >> 3) & 1) ? [34, 30, 28] : [236, 190, 40]); }
    for (let k = 0; k < 2; k++) for (let y = 0; y < 12; y++) for (let x = -14; x <= 14; x++) {
      const yy = 16 + k * 16 + y + Math.abs(x) * 0.7; if (Math.abs(x) < 14 - y * 0.2) put(B, 32 + x, yy, y < 5 ? [255, 250, 236] : [255, 236, 200]);
    }
  },
  launch_side(B, s) {
    fill(B, (u, v, x, y) => { let f = 0.86 + pn(u, v, 2, 30, s) * 0.2; if (Math.hypot((x % 32) - 16, y - 40) < 2.4) f *= 0.65; return mulc([228, 132, 40], f); });
    hazard(B, 0, 12);
  },
  heal(B, s) {
    fill(B, (u, v, x, y) => mulc([108, 214, 146], 0.88 + fbm(u, v, 4, 3, s) * 0.2));
    bevel(B, 3, 0.72, 1.16);
    for (let y = 14; y < 50; y++) for (let x = 14; x < 50; x++) {
      if ((x >= 26 && x < 38) || (y >= 26 && y < 38)) { put(B, x, y, [246, 255, 248]); glow(B, x, y, 0.8); }
    }
  },
  frost(B, s) {
    fill(B, (u, v, x, y) => {
      const f = fbm(u, v, 3, 4, s), w = worley(u, v, 4, s + 1), e = w.f2 - w.f1;
      let c = mixc([118, 176, 226], [196, 232, 252], f);
      if (e < 0.04) c = [236, 248, 255];
      if (ih(x, y, s + 2) > 0.992) c = [255, 255, 255];
      return [c[0], c[1], c[2], 255 * 0.72];
    });
  },
  cdoor(B, s) {
    fill(B, (u, v, x, y) => {
      const dx = x - 31.5, dy = y - 31.5, r = Math.hypot(dx, dy) / 32, a = Math.atan2(dy, dx);
      const sw = Math.sin(a * 3 + r * 14 + fbm(u, v, 4, 3, s) * 5) * 0.5 + 0.5;
      const e = Math.min(x, y, 63 - x, 63 - y);
      if (e < 4) return mulc([44, 22, 76], 0.9 + (ih(x, y, s) - 0.5) * 0.2);
      const c = mixc(mixc([100, 40, 210], [70, 160, 255], sw), [236, 220, 255], sstep(0.3, 0, r));
      return [c[0], c[1], c[2], 255 * 0.3];
    });
  },
  qblock(B, s) {
    fill(B, (u, v, x, y) => mulc([238, 168, 40], 0.9 + fbm(u, v, 4, 3, s) * 0.12 + (ih(x, y, s) - 0.5) * 0.05));
    bevel(B, 3, 0.62, 1.2);
    for (const [cx, cy] of [[8, 8], [55, 8], [8, 55], [55, 55]]) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const r = Math.hypot(x, y); if (r < 2.8) put(B, cx + x, cy + y, r < 1.2 ? [255, 236, 170] : [124, 70, 16]); }
    text(B, "?", 32, 33, 5, [132, 64, 10], [70, 34, 6]);
  },
  pipe_side(B, s) {
    fill(B, (u, v, x, y) => {
      const f = 0.5 + 0.5 * Math.pow(Math.sin(Math.PI * (x + 0.5) / 64), 0.7) + 0.4 * Math.exp(-Math.pow(((x + 0.5) / 64 - 0.3) / 0.06, 2));
      return mulc([44, 160, 64], f * (0.96 + (ih(x, y, s) - 0.5) * 0.04));
    });
  },
  pipe_top(B, s) {
    fill(B, (u, v, x, y) => {
      const r = Math.hypot(x - 31.5, y - 31.5);
      if (r < 22) return mulc([12, 34, 14], 0.5 + r / 22 * 0.7);
      return mulc([52, 176, 72], (r < 25 ? 1.2 : 0.9) + (ih(x, y, s) - 0.5) * 0.06);
    });
  },
  tallgrass(B, s) {
    fill(B, () => [40, 70, 26, 0]);
    for (let k = 0; k < 26; k++) blade(B, 4 + ih(k, 1, s) * 56, 30 + ih(k, 2, s) * 33, (ih(k, 3, s) - 0.5) * 16, 2 + (ih(k, 4, s) > 0.6 ? 1 : 0), [44, 90, 28], mulc([112, 172, 62], 0.85 + ih(k, 5, s) * 0.25));
  },
  tuft(B, s) {
    fill(B, () => [40, 70, 26, 0]);
    for (let k = 0; k < 20; k++) blade(B, 8 + ih(k, 1, s) * 48, 10 + ih(k, 2, s) * 20, (ih(k, 3, s) - 0.5) * 12, 2, [52, 98, 32], mulc([116, 176, 64], 0.85 + ih(k, 5, s) * 0.25));
  },
  flower_red(B, s) { fill(B, () => [40, 70, 26, 0]); flower(B, s, [206, 32, 30], [30, 20, 18], "round"); },
  flower_yellow(B, s) { fill(B, () => [40, 70, 26, 0]); flower(B, s, [250, 208, 44], [214, 150, 20], "puff"); },
  flower_blue(B, s) { fill(B, () => [40, 70, 26, 0]); flower(B, s, [74, 112, 232], [36, 44, 120], "star"); },
  flower_white(B, s) { fill(B, () => [40, 70, 26, 0]); flower(B, s, [242, 240, 234], [240, 196, 40], "daisy"); },
  coal_ore(B, s) { paintOre(B, s, [34, 34, 36], [80, 80, 86], 0.35, 0); },
  iron_ore(B, s) { paintOre(B, s, [196, 150, 118], [236, 206, 178], 0.4, 0); },
  gold_ore(B, s) { paintOre(B, s, [236, 186, 40], [255, 244, 150], 0.45, 0.25); },
  diamond_ore(B, s) { paintOre(B, s, [70, 214, 214], [210, 255, 252], 0.5, 0.4); },
  furnace_front(B, s) {
    paintStoneBrick(B, s, [118, 118, 120]);
    for (let y = 30; y < 56; y++) for (let x = 14; x < 50; x++) {
      const e = x === 14 || x === 49 || y === 30 || y === 55;
      if (e) { put(B, x, y, [52, 52, 54]); continue; }
      const heat = Math.max(0, (y - 38) / 17) * (0.7 + ih(x, y, s) * 0.5), c = mixc([40, 14, 8], [255, 170, 60], Math.min(1, heat));
      put(B, x, y, c); if (heat > 0.25) glow(B, x, y, Math.min(0.9, heat));
    }
    for (let x = 12; x < 52; x++) { put(B, x, 28, [96, 96, 98]); put(B, x, 29, [70, 70, 72]); }
  },
  furnace_side(B, s) { paintStoneBrick(B, s + 1, [118, 118, 120]); },
  furnace_top(B, s) { fill(B, (u, v, x, y) => { const e = Math.min(x, y, 63 - x, 63 - y); let f = 0.9 + fbm(u, v, 6, 3, s) * 0.2 + (ih(x, y, s) - 0.5) * 0.06; if (e < 3) f *= 0.72; return mulc([128, 128, 130], f); }); },
  glass(B, s) {
    fill(B, () => [200, 230, 240, 0]);
    for (let i = 0; i < T; i++) for (let k = 0; k < 3; k++) { const c = k === 1 ? [238, 246, 250] : [186, 206, 214]; put(B, i, k, c, 1, 255); put(B, k, i, c, 1, 255); put(B, i, T - 1 - k, c, 1, 255); put(B, T - 1 - k, i, c, 1, 255); }
    for (let t = 0; t < 14; t++) { put(B, 10 + t, 24 - t, [255, 255, 255], 1, 255); put(B, 11 + t, 24 - t, [236, 246, 250], 1, 255); }
    for (let t = 0; t < 7; t++) put(B, 40 + t, 50 - t, [255, 255, 255], 1, 255);
  },
  birch_log(B, s) {
    fill(B, (u, v, x, y) => { const n = fbm(u, v, 4, 3, s, 2); return mulc([226, 222, 206], 0.88 + n * 0.14 + (ih(x, y, s) - 0.5) * 0.05); });
    for (let k = 0; k < 26; k++) { const y = (ih(k, 1, s) * T) | 0, x0 = (ih(k, 2, s) * T) | 0, len = 4 + ih(k, 3, s) * 12; for (let t = 0; t < len; t++) { put(B, x0 + t, y, [36, 32, 30]); if (ih(k, t, s) > 0.5) put(B, x0 + t, y + 1, [60, 56, 52]); } }
    for (let k = 0; k < 3; k++) { const cx = ih(k, 7, s) * T, cy = ih(k, 8, s) * T; for (let oy = -2; oy <= 2; oy++) for (let ox = -3; ox <= 3; ox++) if (ox * ox / 9 + oy * oy / 4 < 1) put(B, cx + ox, cy + oy, [48, 40, 34]); }
  },
  birch_leaves(B, s) { paintLeafCluster(B, s, [[112, 150, 60], [128, 166, 70], [98, 136, 52], [140, 176, 80]], 0.62, false); },
  spruce_log(B, s) { paintBark(B, s + 7, [70, 50, 32]); },
  spruce_top(B, s) { PAINT.log_top(B, s + 9); for (let i = 0; i < T * T; i++) { B[i * 4] *= 0.72; B[i * 4 + 1] *= 0.66; B[i * 4 + 2] *= 0.6; } },
  spruce_leaves(B, s) { paintLeafCluster(B, s, [[48, 90, 56], [58, 104, 64], [40, 78, 48], [68, 116, 72]], 0.66, true); },
  gravel(B, s) {
    fill(B, (u, v, x, y) => {
      const w = worley(u, v, 9, s), e = w.f2 - w.f1, tone = 0.7 + w.id * 0.5, warm = ih(w.id * 1000, 1, s) > 0.6;
      if (e < 0.08) return mulc([70, 66, 62], 0.8 + ih(x, y, s) * 0.3);
      const sh = 1 + (-w.cx - w.cy) * 0.8;
      return mulc(warm ? [150, 132, 116] : [132, 128, 126], tone * sh * (0.95 + (ih(x, y, s + 1) - 0.5) * 0.1));
    });
  },
  hay_top(B, s) { fill(B, (u, v, x, y) => { const r = Math.hypot(x - 31.5, y - 31.5), ring = Math.sin(r * 0.9 + fbm(u, v, 4, 2, s) * 6) * 0.5 + 0.5; return mulc(mixc([196, 150, 44], [232, 196, 84], ring), 0.9 + (ih(x, y, s) - 0.5) * 0.18); }); },
  hay_side(B, s) {
    fill(B, (u, v, x, y) => { const st = pn(u, v, 24, 2, s); let c = mixc([186, 142, 40], [236, 200, 90], st); c = mulc(c, 0.88 + (ih(x, y, s) - 0.5) * 0.2); if ((y >= 12 && y < 16) || (y >= 48 && y < 52)) c = mulc([150, 44, 30], 0.9 + (ih(x, y, s + 3) - 0.5) * 0.2); return c; });
  },
  path_top(B, s) {
    fill(B, (u, v, x, y) => { const n = fbm(u, v, 6, 3, s), m = pn(u, v, 20, 20, s + 1); let c = mulc([150, 116, 72], 0.82 + n * 0.28 + (m - 0.5) * 0.1); if (ih(x, y, s + 4) > 0.985) c = [168, 150, 124]; return c; });
    for (let i = 0; i < T; i++) for (let k = 0; k < 2; k++) { scale(B, i, k, 0.85); scale(B, k, i, 0.85); scale(B, i, 63 - k, 0.85); scale(B, 63 - k, i, 0.85); }
  },
  lantern(B, s) {
    fill(B, (u, v, x, y) => {
      const e = Math.min(x, y, 63 - x, 63 - y), bar = (x > 29 && x < 34) || (y > 29 && y < 34);
      if (e < 5 || bar) return mulc([52, 54, 62], 0.85 + (ih(x, y, s) - 0.5) * 0.2 + (e < 2 ? 0.2 : 0));
      const r = Math.hypot(x - 31.5, y - 31.5) / 32, c = mixc([255, 236, 170], [255, 150, 50], r);
      return [c[0], c[1], c[2], 255 * 0.12];
    });
  },
  stonebrick(B, s) { paintStoneBrick(B, s); },
  // crafting table: a framed plank top scored into a 3 x 3 grid, sides with a lip and hanging tools
  craft_top(B, s) {
    paintPlanks(B, s, [176, 132, 80]);
    for (let i = 0; i < T; i++) for (let k = 0; k < 5; k++) { const c = k < 4 ? [104, 70, 40] : [80, 52, 28]; put(B, i, k, c); put(B, k, i, c); put(B, i, T - 1 - k, mulc(c, 0.9)); put(B, T - 1 - k, i, mulc(c, 0.9)); }
    for (const g of [22, 41]) for (let i = 7; i < 57; i++) { put(B, g, i, [70, 46, 26]); put(B, g + 1, i, [196, 156, 104]); put(B, i, g, [70, 46, 26]); put(B, i, g + 1, [196, 156, 104]); }
  },
  craft_side(B, s) {
    paintPlanks(B, s + 2, [160, 118, 70]);
    for (let x = 0; x < T; x++) for (let y = 0; y < 9; y++) put(B, x, y, mulc([118, 82, 48], y === 8 ? 0.6 : 0.9 + (ih(x, y, s) - 0.5) * 0.1));
    for (let x = 0; x < T; x++) put(B, x, 9, [70, 46, 26]);
    for (let y = 10; y < T; y++) for (let k = 0; k < 4; k++) { put(B, k, y, [110, 76, 44]); put(B, T - 1 - k, y, [96, 66, 38]); }
    for (let y = 16; y < 50; y++) for (let x = 12; x < 26; x++) { if (x - 12 > (y - 16) * 0.42) continue; put(B, x, y, mulc([188, 192, 198], 0.85 + (x - 12) * 0.012)); if (x === 12 && (y & 3) === 0) put(B, x - 1, y, [120, 124, 130]); }   // saw blade with teeth
    for (let y = 12; y < 18; y++) for (let x = 10; x < 20; x++) put(B, x, y, [92, 56, 30]);                                                                              // saw handle
    for (let y = 18; y < 54; y++) { put(B, 44, y, [110, 70, 36]); put(B, 45, y, [86, 54, 28]); }                                                                         // hammer shaft
    for (let y = 14; y < 22; y++) for (let x = 36; x < 54; x++) put(B, x, y, mulc([120, 122, 128], 0.9 + (y - 14) * 0.02));                                              // hammer head
  },
  craft_front(B, s) {
    PAINT.craft_side(B, s);
    for (let y = 14; y < 56; y++) for (let x = 10; x < 56; x++) { const e = Math.min(x - 10, 55 - x, y - 14, 55 - y); if (e < 2) put(B, x, y, [84, 56, 32]); }                // framed panel
    for (let t = 0; t < 32; t++) { put(B, 20 + t, 50 - t, [110, 70, 36]); put(B, 21 + t, 50 - t, [86, 54, 28]); }                                                        // pickaxe handle
    for (let t = -12; t <= 12; t++) { const x = 44 + t, y = 20 + Math.round(t * t * 0.05) - Math.abs(t) * 0.2; for (let w = 0; w < 3; w++) put(B, x, y + w, mulc([150, 154, 162], 0.8 + w * 0.12)); }   // pick head
  },
  wool(B, s) {
    fill(B, (u, v, x, y) => {
      const w = worley(u, v, 10, s), curl = Math.sin(w.f1 * 22 + w.id * 6), n = fbm(u, v, 8, 3, s + 1);
      const f = 0.8 + n * 0.16 + curl * 0.05 - w.f1 * 0.12 + (ih(x, y, s) - 0.5) * 0.05;
      return mulc([238, 236, 230], f);
    });
  }
};
const CLAMP_PAD = { tallgrass: 1, tuft: 1, flower_red: 1, flower_yellow: 1, flower_blue: 1, flower_white: 1 };

function buildAtlas() {
  if (Object.keys(PAINT).length > COLS * ROWS) throw new Error("texture atlas is full (" + Object.keys(PAINT).length + " tiles, max " + COLS * ROWS + ")");
  const names = Object.keys(PAINT), data = new Uint8Array(SIZE * HGT * 4), tiles = {};
  names.forEach((name, n) => {
    const B = newBuf(); PAINT[name](B, 101 + n * 977);
    const gc = n % COLS, gr = (n / COLS) | 0, clampPad = !!CLAMP_PAD[name];
    for (let cy = 0; cy < CELL; cy++) for (let cx = 0; cx < CELL; cx++) {
      const sx = clampPad ? clamp(cx - PAD, 0, T - 1) : (cx - PAD) & (T - 1), sy = clampPad ? clamp(cy - PAD, 0, T - 1) : (cy - PAD) & (T - 1);
      const si = (sy * T + sx) * 4, di = ((gr * CELL + (CELL - 1 - cy)) * SIZE + gc * CELL + cx) * 4;   // image row 0 is the tile top (high v)
      data[di] = clamp(B[si], 0, 255); data[di + 1] = clamp(B[si + 1], 0, 255); data[di + 2] = clamp(B[si + 2], 0, 255); data[di + 3] = clamp(B[si + 3], 0, 255);
    }
    tiles[name] = { u0: (gc * CELL + PAD) / SIZE, v0: (gr * CELL + PAD) / HGT, s: T / SIZE, sv: T / HGT, i: n };
  });
  return { data, size: SIZE, w: SIZE, h: HGT, tiles, tile: T, max: COLS * ROWS };
}

// RGBA tileable noise: r,g,b = fbm at 4, 8, 16 cells; a = cellular
function buildNoise(N) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = (y * N + x) * 4;
    data[i] = fbm(u, v, 4, 5, 7) * 255; data[i + 1] = fbm(u, v, 8, 4, 19) * 255; data[i + 2] = fbm(u, v, 16, 3, 41) * 255;
    const w = worley(u, v, 8, 63); data[i + 3] = clamp(1 - w.f1 * 1.2, 0, 1) * 255;
  }
  // stretch contrast so every channel spans the full range
  for (let c = 0; c < 4; c++) { let lo = 255, hi = 0; for (let i = c; i < data.length; i += 4) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
    const k = 255 / Math.max(1, hi - lo); for (let i = c; i < data.length; i += 4) data[i] = (data[i] - lo) * k; }
  return { data, size: N };
}

// ---------- GLSL ----------
// analytic sky radiance shared by the sky dome, terrain fog and water reflections so they always agree
const SKY_GLSL = `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunCol;
vec3 skyBase(vec3 d) {
  float h = d.y, hp = max(h, 0.0);
  float t = 1.0 - exp(-hp * 3.4);
  vec3 col = mix(uHorizon, uZenith, t);
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlow * pow(sd, 4.0) * (1.0 - t * 0.8);
  col += uSunCol * (pow(sd, 36.0) * 0.05 + pow(sd, 500.0) * 0.35);
  col = mix(col, uHorizon * 0.55 + uZenith * 0.05, smoothstep(0.0, -0.4, h));
  return col;
}
`;
// scene lighting shared by terrain and water
const LIGHT_GLSL = `
uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform vec3 uBlockCol;
uniform float uMinLight;
uniform float uSkyMul;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uShadowCenter;
uniform float uShadowRadius;
uniform float uTime;
float shadowTerm(vec3 wp) {
  float sh = getShadowMask();
  float sd = length(wp.xz - uShadowCenter.xz);
  return mix(sh, 1.0, smoothstep(uShadowRadius * 0.7, uShadowRadius * 0.96, sd));
}
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 V = wp - cameraPosition; float dist = length(V); V /= max(dist, 1e-4);
  float f = clamp((dist - uFogNear) / max(uFogFar - uFogNear, 1.0), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  f = max(f, (1.0 - exp(-dist * 0.0045)) * 0.55);                 // thin aerial haze at mid range
  vec3 fc = skyBase(normalize(vec3(V.x, max(V.y, -0.02) * 0.4 + 0.015, V.z)));
  return mix(col, fc, f);
}
`;
const PARS_FRAG = `
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
`;
const FACE_NORMAL = `
vec3 faceNormal(float face) {
  if (face < 0.5) return vec3(1.0, 0.0, 0.0);
  if (face < 1.5) return vec3(-1.0, 0.0, 0.0);
  if (face < 2.5) return vec3(0.0, 1.0, 0.0);
  if (face < 3.5) return vec3(0.0, -1.0, 0.0);
  if (face < 4.5) return vec3(0.0, 0.0, 1.0);
  if (face < 5.5) return vec3(0.0, 0.0, -1.0);
  return vec3(0.0, 1.0, 0.0);
}
`;

// aTint: rgb biome/brightness tint (x1.5), a = flags. aLight: ao, sky light, block light, face id.
// flags: 1 grass side tint mask, 2 emissive texels, 4 lava, 8 plant, 16 waving leaves, 32 waving plant tip
const TERRAIN_VERT = `
#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 aTint;
attribute vec4 aLight;
attribute vec4 aBCol;
uniform float uTime;
uniform float uWave;
varying vec2 vUv;
varying vec3 vBCol;
varying vec3 vTint;
varying vec4 vL;
varying vec3 vN;
varying vec3 vWPos;
${FACE_NORMAL}
void main() {
  float face = floor(aLight.w * 255.0 + 0.5);
  float flags = floor(aTint.w * 255.0 + 0.5);
  vec3 n = faceNormal(face);
  vec3 transformed = position;
  float wl = mod(floor(flags / 16.0), 2.0), wp = mod(floor(flags / 32.0), 2.0);
  if (wl + wp > 0.5) {
    float ph = uTime * 1.6 + position.x * 0.8 + position.z * 0.6 + position.y * 0.35;
    float gust = 0.6 + 0.4 * sin(uTime * 0.37 + position.x * 0.045 + position.z * 0.03);
    vec3 off = vec3(sin(ph), sin(ph * 1.3 + 1.1) * 0.35, cos(ph * 0.83 + 0.4));
    transformed += off * (wl * 0.03 + wp * 0.09) * gust * uWave;
  }
  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vec3 transformedNormal = normalMatrix * n;
  #include <shadowmap_vertex>
  vUv = uv;
  vBCol = aBCol.rgb;
  vTint = aTint.rgb * 1.5;
  vL = vec4(aLight.xyz, mod(flags, 16.0));
  vN = n;
  vWPos = worldPosition.xyz;
}
`;
const TERRAIN_FRAG = `
uniform sampler2D uAtlas;
uniform sampler2D uNoise;
uniform float uEmis;
uniform float uWet;
varying vec2 vUv;
varying vec3 vBCol;
varying vec3 vTint;
varying vec4 vL;
varying vec3 vN;
varying vec3 vWPos;
${PARS_FRAG}
${SKY_GLSL}
${LIGHT_GLSL}
vec3 lavaColor(vec3 p, vec3 n) {
  vec2 q = (abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy + vec2(0.0, uTime * 0.25) : p.xy + vec2(0.0, uTime * 0.25))) * 0.3;
  float a = texture2D(uNoise, q + vec2(uTime * 0.012, uTime * 0.008)).r;
  float b = texture2D(uNoise, q * 2.4 - vec2(uTime * 0.02, -uTime * 0.015)).g;
  float n1 = a * 0.6 + b * 0.4;
  float veins = smoothstep(0.45, 1.0, 1.0 - abs(n1 - 0.6) * 16.0);   // narrow glowing cracks between cooling plates
  vec3 crust = mix(vec3(0.09, 0.018, 0.006), vec3(0.34, 0.065, 0.012), smoothstep(0.25, 0.75, b));
  vec3 c = mix(crust, vec3(1.0, 0.52, 0.1), veins);
  c += vec3(0.9, 0.3, 0.04) * smoothstep(0.7, 0.92, a) * 0.8;         // molten pools
  return c;
}
void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  #ifdef CUTOUT
    if (tex.a < 0.5) discard;
  #endif
  float flags = floor(vL.w + 0.5);
  float fGrass = mod(flags, 2.0);
  float fGlow = mod(floor(flags / 2.0), 2.0);
  float fLava = mod(floor(flags / 4.0), 2.0);
  float fPlant = mod(floor(flags / 8.0), 2.0);
  vec3 alb = pow(tex.rgb, vec3(2.2));
  float tm = fGrass > 0.5 ? clamp((tex.g - tex.r) * 7.0 - 0.15, 0.0, 1.0) : 1.0;
  alb *= mix(vec3(1.0), vTint, tm);
  vec3 N = normalize(vN);
  #ifdef CUTOUT
    if (!gl_FrontFacing) N = -N;
  #endif
  float emis = 0.0;
  #ifndef CUTOUT
    emis = fGlow * (1.0 - tex.a);
  #endif
  if (fLava > 0.5) { alb = lavaColor(vWPos, N); emis = 1.9 / max(uEmis, 0.01); }
  float ao = vL.x, sky = vL.y * uSkyMul, blk = vL.z;
  float ndl = max(dot(N, uLightDir), 0.0);
  if (fPlant > 0.5) ndl = 0.3 + 0.5 * max(uLightDir.y, 0.0);
  float skyVis = smoothstep(0.45, 0.92, sky);
  vec3 direct = uLightCol * ndl * shadowTerm(vWPos) * skyVis;
  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * (sky * sky);
  vec3 torch = uBlockCol * vBCol * vBCol * (blk * blk * (0.55 + 0.45 * blk));
  vec3 light = (amb + torch + vec3(uMinLight)) * ao + direct * (0.35 + 0.65 * ao);
  float wet = uWet * skyVis * step(0.5, N.y) * (1.0 - fLava) * (1.0 - fPlant);
  if (wet > 0.0) alb *= 1.0 - 0.3 * wet;
  vec3 col = alb * light * (1.0 - fLava) + alb * emis * uEmis;
  if (wet > 0.0) {                                                // rain soaked ground: darker, glossy, with puddles that mirror the sky
    vec3 Vd = normalize(vWPos - cameraPosition);
    float puddle = smoothstep(0.52, 0.68, texture2D(uNoise, vWPos.xz * 0.07).r);
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(-Vd, N), 0.0), 5.0);
    vec3 R = reflect(Vd, N);
    col += skyBase(R) * fr * wet * mix(0.3, 1.0, puddle) + uLightCol * pow(max(dot(R, uLightDir), 0.0), 60.0) * wet * 0.5 * shadowTerm(vWPos);
  }
  gl_FragColor = vec4(applyFog(col, vWPos), 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}
`;

const WATER_VERT = `
#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 aLight;
attribute vec4 aTint;
varying vec4 vL;
varying vec4 vDep;
varying vec2 vLoc;
varying vec3 vN;
varying vec3 vWPos;
${FACE_NORMAL}
void main() {
  vDep = aTint; vLoc = uv;
  vec3 n = faceNormal(floor(aLight.w * 255.0 + 0.5));
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vec3 transformedNormal = normalMatrix * n;
  #include <shadowmap_vertex>
  vL = aLight; vN = n; vWPos = worldPosition.xyz;
}
`;
const WATER_FRAG = `
uniform sampler2D uNoise;
uniform vec3 uWaterCol;
uniform float uWaterAlpha;
varying vec4 vL;
varying vec4 vDep;
varying vec2 vLoc;
varying vec3 vN;
varying vec3 vWPos;
${PARS_FRAG}
${SKY_GLSL}
${LIGHT_GLSL}
float wh(vec2 p) {
  return texture2D(uNoise, p * 0.045 + vec2(uTime * 0.010, uTime * 0.006)).r * 0.55
       + texture2D(uNoise, p * 0.12 + vec2(-uTime * 0.018, uTime * 0.012)).g * 0.3
       + texture2D(uNoise, p * 0.33 + vec2(uTime * 0.03, -uTime * 0.022)).b * 0.15;
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = cameraPosition - vWPos; float dist = length(V); V /= max(dist, 1e-4);
  float sky = vL.y * uSkyMul, blk = vL.z;
  if (N.y > 0.5) {
    float h0 = wh(vWPos.xz), hx = wh(vWPos.xz + vec2(0.12, 0.0)), hz = wh(vWPos.xz + vec2(0.0, 0.12));
    float k = 3.2 / (1.0 + dist * 0.035);
    N = normalize(vec3((h0 - hx) * k, 1.0, (h0 - hz) * k));
  }
  float under = dot(N, V) < 0.0 ? 1.0 : 0.0;
  if (under > 0.5) N = -N;
  float cosv = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  float skyVis = smoothstep(0.45, 0.92, sky);
  vec3 refl = skyBase(R) * (0.18 + 0.82 * skyVis);
  float sh = shadowTerm(vWPos);
  vec3 H = normalize(uLightDir + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0) * 7.0 * sh * skyVis * (1.0 - under);
  float depth = mix(mix(vDep.x, vDep.y, vLoc.x), mix(vDep.z, vDep.w, vLoc.x), vLoc.y);   // 0 at the shore .. 1 at 8 blocks deep
  vec3 amb = mix(uGroundAmb, uSkyAmb, 0.85) * (sky * sky) + uBlockCol * vec3(1.0, 0.4, 0.13) * blk * blk + vec3(uMinLight);
  vec3 wcol = mix(vec3(0.06, 0.32, 0.30), uWaterCol, smoothstep(0.05, 0.6, depth));
  vec3 body = wcol * (amb + uLightCol * max(uLightDir.y, 0.0) * 0.5 * sh * skyVis);
  vec3 col = mix(body, refl, fres * (1.0 - under * 0.6)) + uLightCol * spec;
  float a = mix(mix(0.22, uWaterAlpha, smoothstep(0.0, 0.45, depth)), 0.97, fres) + spec * 0.2;
  gl_FragColor = vec4(applyFog(col, vWPos), clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}
`;

const SKYDOME_VERT = `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
// uMode: 0 open sky with day/night, 1 fire dimension haze, 2 the End void
const SKYDOME_FRAG = `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uMode;
uniform float uStars;
uniform float uSunVis;
uniform vec3 uMoonCol;
uniform float uCloudCover;
uniform vec3 uCloudLit;
uniform vec3 uCloudAmb;
uniform vec2 uWind;
varying vec3 vDir;
${SKY_GLSL}
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 starField(vec3 d, float density) {
  vec3 p = d * 150.0; vec3 c = floor(p); vec3 f = fract(p) - 0.5;
  float h = h13(c);
  if (h < 1.0 - density) return vec3(0.0);
  vec3 o = vec3(h13(c + 1.7), h13(c + 3.1), h13(c + 5.3)) - 0.5;
  float b = smoothstep(0.2, 0.0, length(f - o * 0.6)) * (0.35 + 0.65 * fract(h * 97.0));
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + fract(h * 13.0) * 4.0) + h * 100.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.88, 0.72), h13(c + 9.1));
  return tint * b * tw * 2.6;
}
const float CB = 118.0;
const float CT = 152.0;
float cloudMap(vec3 p) {
  vec2 uv = (p.xz + uWind) * 0.00105;
  float n = texture2D(uNoise, uv).r * 0.64 + texture2D(uNoise, uv * 3.3 + 0.37).g * 0.36;
  float hf = clamp((p.y - CB) / (CT - CB), 0.0, 1.0);
  float prof = smoothstep(0.0, 0.2, hf) * smoothstep(1.0, 0.4, hf);
  return clamp((n - (1.0 - uCloudCover)) * 2.8 - (1.0 - prof) * 0.85, 0.0, 1.0);
}
vec4 clouds(vec3 ro, vec3 rd) {
  if (rd.y <= 0.012 || uCloudCover <= 0.0) return vec4(0.0);
  float t0 = max((CB - ro.y) / rd.y, 0.0), t1 = (CT - ro.y) / rd.y;
  if (t0 > 12000.0) return vec4(0.0);
  float mu = dot(rd, uSunDir);
  float phase = 0.6 + 0.9 * pow(max(mu, 0.0), 6.0) + 0.5 * pow(max(mu, 0.0), 60.0);
  float fade = exp(-t0 * 0.00018);
#if CLOUD_STEPS > 0
  float span = min(t1 - t0, 650.0);
  float dt = span / float(CLOUD_STEPS);
  float t = t0 + dt * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float Tr = 1.0; vec3 L = vec3(0.0);
  for (int i = 0; i < CLOUD_STEPS; i++) {
    vec3 p = ro + rd * t;
    float den = cloudMap(p);
    if (den > 0.004) {
      float lt = exp(-cloudMap(p + uSunDir * 24.0) * 3.0);
      float hf = clamp((p.y - CB) / (CT - CB), 0.0, 1.0);
      vec3 c = uCloudAmb * (0.6 + 0.4 * hf) + uCloudLit * lt * phase;
      float a = 1.0 - exp(-den * dt * 0.05);
      L += Tr * a * c; Tr *= 1.0 - a;
      if (Tr < 0.02) break;
    }
    t += dt;
  }
  return vec4(L, 1.0 - Tr) * fade;
#else
  vec3 p = ro + rd * (t0 + (t1 - t0) * 0.45);
  float den = cloudMap(p);
  float lt = exp(-cloudMap(p + uSunDir * 24.0) * 3.0);
  float a = clamp(den * 1.6, 0.0, 1.0);
  return vec4((uCloudAmb * 0.8 + uCloudLit * lt * phase) * a, a) * fade;
#endif
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col;
  if (uMode < 0.5) {
    col = skyBase(d);
    if (uStars > 0.0 && d.y > -0.05) {
      float mw = exp(-pow(dot(d, normalize(vec3(0.35, 0.3, 0.88))) * 3.2, 2.0)) * texture2D(uNoise, d.xz * 0.9 + 0.2).r;
      col += (starField(d, 0.012) + vec3(0.35, 0.4, 0.6) * mw * mw * 0.06) * uStars * smoothstep(-0.05, 0.15, d.y);
    }
    float md = dot(d, -uSunDir);
    if (md > 0.999) {
      vec3 mu = normalize(cross(-uSunDir, vec3(0.0, 1.0, 0.0)) + 1e-4), mv = cross(mu, -uSunDir);
      vec2 lp = vec2(dot(d, mu), dot(d, mv)) / 0.028;
      float disk = smoothstep(1.0, 0.94, length(lp));
      float crat = texture2D(uNoise, lp * 0.22 + 0.5).b;
      col = mix(col, uMoonCol * (0.75 + crat * 0.35) * (0.85 + 0.15 * lp.x), disk);
    }
    col += uMoonCol * (pow(max(md, 0.0), 900.0) * 0.25 + pow(max(md, 0.0), 40.0) * 0.03);
    float sd = dot(d, uSunDir);
    col += uSunCol * uSunVis * 14.0 * smoothstep(0.99955, 0.99978, sd);
    vec4 cl = clouds(cameraPosition, d);
    col = col * (1.0 - cl.a) + cl.rgb;
    col = mix(col, uHorizon * 0.55 + uZenith * 0.05, smoothstep(0.0, -0.4, d.y));
  } else if (uMode < 1.5) {
    float n = texture2D(uNoise, d.xz / (abs(d.y) + 0.35) * 0.25 + vec2(uTime * 0.004, 0.0)).r;
    float n2 = texture2D(uNoise, d.xz / (abs(d.y) + 0.35) * 0.6 - vec2(0.0, uTime * 0.006)).g;
    col = mix(uHorizon, uZenith, smoothstep(-0.1, 0.7, d.y));
    col *= 0.55 + 0.9 * n * n2;
    col += vec3(1.0, 0.35, 0.05) * pow(max(1.0 - abs(d.y) * 3.0, 0.0), 3.0) * 0.25;
  } else {
    col = mix(uHorizon, uZenith, smoothstep(-0.3, 0.6, d.y));
    float neb = texture2D(uNoise, d.xz * 0.7 + d.y * 0.3).r * texture2D(uNoise, d.zx * 1.3 + 0.4).g;
    col += vec3(0.25, 0.08, 0.35) * neb * neb * 0.6;
    col += starField(d, 0.02) * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}
`;

// ---------- post processing (HDR bloom, god rays, grade, vignette) ----------
const POST_VERT = `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BRIGHT_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
          + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb) * 0.25;
  c = min(c, vec3(40.0));
  float br = max(c.r, max(c.g, c.b)), knee = uThreshold * 0.5;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  gl_FragColor = vec4(c * max(soft, br - uThreshold) / max(br, 1e-4), 1.0);
}
`;
const DOWN_FRAG = `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.5;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 0.125;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb * 0.125;
  gl_FragColor = vec4(c, 1.0);
}
`;
const UP_FRAG = `
uniform sampler2D tSrc;
uniform sampler2D tLow;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * uSpread;
  vec3 l = texture2D(tLow, vUv).rgb * 4.0;
  l += (texture2D(tLow, vUv + vec2(o.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(o.x, 0.0)).rgb + texture2D(tLow, vUv + vec2(0.0, o.y)).rgb + texture2D(tLow, vUv - vec2(0.0, o.y)).rgb) * 2.0;
  l += texture2D(tLow, vUv + o).rgb + texture2D(tLow, vUv - o).rgb + texture2D(tLow, vUv + vec2(o.x, -o.y)).rgb + texture2D(tLow, vUv + vec2(-o.x, o.y)).rgb;
  gl_FragColor = vec4(texture2D(tSrc, vUv).rgb + l / 16.0, 1.0);
}
`;
const COMPOSITE_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform float uExposure;
uniform float uBloom;
uniform float uRays;
uniform vec2 uSunPos;
uniform float uVignette;
uniform float uSat;
uniform vec3 uTint;
varying vec2 vUv;
vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 IM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= uExposure / 0.6; c = IM * c; c = rrtOdt(c); c = OM * c; return clamp(c, 0.0, 1.0);
}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;
  if (uRays > 0.0) {                                             // crepuscular rays streaming from the sun through gaps
    vec2 dir = (vUv - uSunPos) / 32.0, uv = vUv; float w = 1.0; vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) { uv -= dir; acc += texture2D(tRays, clamp(uv, 0.001, 0.999)).rgb * w; w *= 0.955; }
    c += acc / 32.0 * uRays;
  }
  c *= uTint;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  vec2 d = vUv - 0.5; c *= 1.0 - uVignette * dot(d, d) * 1.8;
  gl_FragColor = vec4(c, 1.0);
  #include <encodings_fragment>
  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}
`;

// ---------- atmosphere model ----------
// keyframes over sun height (sin of elevation). Linear HDR colours; ACES tone mapping brings them to screen.
const KEYS = [
  { h: -1.0, zen: [0.0035, 0.005, 0.014], hor: [0.010, 0.015, 0.03], glow: [0, 0, 0], light: [0.11, 0.14, 0.22], sky: [0.030, 0.040, 0.075], gnd: [0.008, 0.010, 0.016], cLit: [0.030, 0.036, 0.055], cAmb: [0.010, 0.013, 0.022] },
  { h: -0.25, zen: [0.0035, 0.005, 0.014], hor: [0.010, 0.015, 0.03], glow: [0, 0, 0], light: [0.11, 0.14, 0.22], sky: [0.030, 0.040, 0.075], gnd: [0.008, 0.010, 0.016], cLit: [0.030, 0.036, 0.055], cAmb: [0.010, 0.013, 0.022] },
  { h: -0.08, zen: [0.015, 0.025, 0.07], hor: [0.08, 0.06, 0.09], glow: [0.30, 0.09, 0.03], light: [0.10, 0.10, 0.16], sky: [0.06, 0.06, 0.11], gnd: [0.02, 0.018, 0.02], cLit: [0.25, 0.10, 0.08], cAmb: [0.04, 0.035, 0.06] },
  { h: 0.02, zen: [0.07, 0.11, 0.28], hor: [0.95, 0.46, 0.20], glow: [1.30, 0.46, 0.12], light: [1.05, 0.46, 0.16], sky: [0.22, 0.20, 0.26], gnd: [0.07, 0.05, 0.035], cLit: [1.6, 0.62, 0.28], cAmb: [0.20, 0.15, 0.20] },
  { h: 0.16, zen: [0.11, 0.24, 0.60], hor: [0.86, 0.64, 0.44], glow: [0.95, 0.48, 0.17], light: [1.75, 1.18, 0.70], sky: [0.38, 0.44, 0.58], gnd: [0.18, 0.15, 0.11], cLit: [2.0, 1.45, 1.0], cAmb: [0.42, 0.44, 0.55] },
  { h: 0.4, zen: [0.10, 0.26, 0.72], hor: [0.50, 0.66, 0.90], glow: [0.22, 0.20, 0.16], light: [2.55, 2.38, 2.10], sky: [0.46, 0.58, 0.82], gnd: [0.25, 0.22, 0.17], cLit: [2.3, 2.25, 2.15], cAmb: [0.55, 0.62, 0.76] },
  { h: 1.0, zen: [0.08, 0.22, 0.68], hor: [0.47, 0.64, 0.90], glow: [0.16, 0.16, 0.14], light: [2.75, 2.62, 2.40], sky: [0.48, 0.60, 0.85], gnd: [0.27, 0.24, 0.18], cLit: [2.4, 2.38, 2.3], cAmb: [0.58, 0.65, 0.8] }
];
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function skyEnv(h) {
  let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1), s = t * t * (3 - 2 * t), o = {};
  for (const k of ["zen", "hor", "glow", "light", "sky", "gnd", "cLit", "cAmb"]) o[k] = lerp3(a[k], b[k], s);
  o.night = clamp((-h - 0.02) / 0.2, 0, 1);
  return o;
}

// grayscale detail maps (0.45..1) for flat coloured models: wood grain along either axis, brushed metal, stone, fine grain
function buildDetail(kind) {
  const d = new Uint8Array(T * T * 4);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const u = x / T, v = y / T; let f;
    if (kind === "grainV" || kind === "grainH") {
      const a = kind === "grainV" ? u : v, b = kind === "grainV" ? v : u;
      const g = fbm(a, b, 10, 3, 5, 1), ring = Math.abs(Math.sin((a * 9 + g * 1.6) * 3.1416));
      f = 0.72 + ring * 0.2 + (pn(a, b, 40, 4, 9) - 0.5) * 0.12;
    } else if (kind === "metal") f = 0.8 + pn(u, v, 2, 40, 3) * 0.14 + (ih(x, y, 4) - 0.5) * 0.05;
    else if (kind === "stone") f = 0.68 + fbm(u, v, 4, 4, 11) * 0.3 + (ih(x, y, 2) - 0.5) * 0.1;
    else if (kind === "fur") f = 0.9 + (pn(u, v, 32, 8, 21) - 0.5) * 0.12 + (fbm(u, v, 4, 3, 23) - 0.5) * 0.08 + (ih(x, y, 25) - 0.5) * 0.05;
    else f = 0.8 + (fbm(u, v, 8, 3, 13) - 0.5) * 0.16 + (ih(x, y, 6) - 0.5) * 0.06;
    const c = clamp(f, 0.45, 1) * 255, i = (y * T + x) * 4; d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
  }
  return { data: d, size: T };
}

window.GFXLIB = { buildAtlas, buildNoise, buildDetail, skyEnv, TILE: T, ATLAS: SIZE, ATLAS_H: HGT,
  shaders: { TERRAIN_VERT, TERRAIN_FRAG, WATER_VERT, WATER_FRAG, SKYDOME_VERT, SKYDOME_FRAG, POST_VERT, BRIGHT_FRAG, DOWN_FRAG, UP_FRAG, COMPOSITE_FRAG } };
})();
