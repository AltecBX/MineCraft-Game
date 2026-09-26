/* ui.js: HUD, icons, inventory and crafting panels, chests.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- UI ----------
const $ = id => document.getElementById(id);
function show(id) { $(id).classList.remove("hidden"); } function hide(id) { $(id).classList.add("hidden"); }
function toast(t) { const el = document.createElement("div"); el.className = "toastItem"; el.textContent = t; $("toast").appendChild(el); setTimeout(() => el.remove(), 2200); }
let bannerT = 0; function showBanner(t) { const b = $("banner"); b.textContent = t; b.style.opacity = "1"; bannerT = 2; }
function hurtFlash() { const h = $("hurt"); h.style.opacity = settings.reduceMotion ? "0.35" : "1"; setTimeout(() => h.style.opacity = "0", 120); }
function updateVitals() {
  const he = $("hearts"); he.innerHTML = ""; const maxHearts = Math.ceil(player.maxHp / 2); const full = Math.ceil(Math.max(0, player.hp) / 2);
  for (let i = 0; i < maxHearts; i++) { const d = document.createElement("div"); d.className = "pip heart" + (i < full ? "" : " empty"); d.textContent = "\u2665"; he.appendChild(d); }
  const fe = $("hunger"); fe.innerHTML = ""; const ff = Math.ceil(Math.max(0, player.food) / 2);
  for (let i = 0; i < 10; i++) { const d = document.createElement("div"); d.className = "pip food" + (i < ff ? "" : " empty"); d.textContent = "\u25C6"; fe.appendChild(d); }
  $("stamina").firstElementChild.style.width = (100 * player.stam / player.maxStam) + "%";
}
function colorHex(id) { if (isItem(id)) return null; const c = BLOCKS[id]; return "#" + new THREE.Color(c.top[0], c.top[1], c.top[2]).getHexString(); }
// isometric block icons painted from the world atlas (top, left and right faces), cached as data URLs
const ICON_URL = {};
function blockIconURL(id) {
  if (id in ICON_URL) return ICON_URL[id];
  if (id === GATE_OPEN) return blockIconURL(GATE);
  if (typeof ITEM_PAINT !== "undefined" && ITEM_PAINT[id]) return (ICON_URL[id] = itemIconURL(id));   // fences and gates get a drawn icon, not a cube
  let url = null;
  try {
    const S = 96, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const cx = cv.getContext("2d"), img = cx && cx.createImageData ? cx.createImageData(S, S) : null;
    if (img && img.data && TIL[id]) {
      const D = img.data, A = ATL.data, AW = ATL.w, AH = ATL.h, TS = GL.TILE, tl = TIL[id], bc = BCOL[id], kind = KIND[id];
      const sample = (t, u, v, face) => {                       // u, v in 0..1 with v = 0 at the tile top
        const px = Math.min(TS - 1, Math.floor(u * TS)), py = Math.min(TS - 1, Math.floor(v * TS));
        const i = ((Math.round(t.v0 * AH) + TS - 1 - py) * AW + Math.round(t.u0 * AW) + px) * 4;
        let r = A[i], g = A[i + 1], b = A[i + 2], a = A[i + 3];
        if (bc) { const c = bc[face === 0 ? 0 : 1]; r *= c[0] * 1.15; g *= c[1] * 1.15; b *= c[2] * 1.15; }
        if (id === WATER) { r = 40 + r * 0.1; g = 110 + g * 0.15; b = 200 + b * 0.2; a = 215; }
        else if (id === LAVA) { const n = (px * 7 + py * 13) % 17 / 17; r = 255; g = 90 + n * 110; b = 20; a = 255; }
        else if (kind !== 2 && kind !== 4) a = 255;              // opaque tiles keep alpha for glow, not holes
        return [r, g, b, a];
      };
      const put = (x, y, c, sh) => { if (c[3] < 128) return; const o = (y * S + x) * 4; D[o] = Math.min(255, c[0] * sh); D[o + 1] = Math.min(255, c[1] * sh); D[o + 2] = Math.min(255, c[2] * sh); D[o + 3] = c[3]; };
      if (kind === 4) {                                          // plants: the flat sprite
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, sample(tl[1], x / S, y / S, 1), 1);
      } else {
        const T = [48, 6], L = [8, 26], R = [88, 26], C = [48, 46], H = 44;   // cube corners, H = side height
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          // top face: P = T + u (R - T) + v (L - T)
          let ax = R[0] - T[0], ay = R[1] - T[1], bx = L[0] - T[0], by = L[1] - T[1], dx = x + 0.5 - T[0], dy = y + 0.5 - T[1], det = ax * by - ay * bx;
          let u = (dx * by - dy * bx) / det, v = (ax * dy - ay * dx) / det;
          if (u >= 0 && u < 1 && v >= 0 && v < 1) { put(x, y, sample(tl[0], u, v, 0), 1); continue; }
          if (x < C[0]) { u = (x + 0.5 - L[0]) / (C[0] - L[0]); v = (y + 0.5 - L[1] - u * (C[1] - L[1])) / H; if (u >= 0 && u < 1 && v >= 0 && v < 1) put(x, y, sample(tl[3] || tl[1], u, v, 1), 0.8); }
          else { u = (x + 0.5 - C[0]) / (R[0] - C[0]); v = (y + 0.5 - C[1] - u * (R[1] - C[1])) / H; if (u >= 0 && u < 1 && v >= 0 && v < 1) put(x, y, sample(tl[1], u, v, 1), 0.62); }
        }
      }
      cx.putImageData(img, 0, 0); url = cv.toDataURL();
      if (typeof url !== "string" || url.indexOf("data:") !== 0) url = null;
    }
  } catch (e) { url = null; }
  return (ICON_URL[id] = url);
}
function blockSwatch(id) {
  const sw = document.createElement("div"), url = blockIconURL(id);
  if (url) { sw.className = "sw blk"; sw.style.backgroundImage = "url(" + url + ")"; } else { sw.className = "sw"; sw.style.background = colorHex(id); }
  return sw;
}
// painted item icons for the ranged and farm items (vector drawn on a 64px canvas, cached as data URLs).
// Items without a painter keep their emoji.
const ITEM_ICON_URL = {};
function icPoly(x, pts, fill, stroke, lw) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 2.5; x.stroke(); } }
function icEll(x, cx, cy, rx, ry, rot, fill, stroke, lw) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 2.5; x.stroke(); } }
function icLine(x, pts, col, lw, cap) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = cap || "round"; x.lineJoin = "round"; x.stroke(); }
function icMeat(x, body, fat, cooked, bone) {                 // a cut of meat: fat rim, marbling or grill marks, optional bone
  if (bone) { icLine(x, [40, 40, 56, 56], "#3a2a1e", 9); icLine(x, [40, 40, 56, 56], "#efe6d6", 6); icEll(x, 56, 55, 5, 4, 0.8, "#efe6d6", "#3a2a1e", 2); }
  icEll(x, 29, 29, 23, 17, -0.6, fat, "#2a1410", 3);
  icEll(x, 27, 27, 18, 12.5, -0.6, body);
  if (cooked) { for (const o of [-8, 0, 8]) icLine(x, [16 + o, 34 + o * 0.2, 34 + o, 16 + o * 0.2], "rgba(40,18,8,.8)", 3); }
  else { icLine(x, [16, 30, 24, 26, 30, 30], "rgba(255,236,226,.75)", 2); icLine(x, [24, 20, 32, 22, 38, 18], "rgba(255,236,226,.6)", 1.6); }
  icEll(x, 21, 21, 6, 3, -0.6, "rgba(255,255,255,.18)");
}
function icDrum(x, meat, dark) {                              // a drumstick
  icLine(x, [38, 38, 54, 54], "#3a2a1e", 9); icLine(x, [38, 38, 54, 54], "#f2eadc", 6);
  icEll(x, 55, 51, 4.5, 4, 0, "#f2eadc", "#3a2a1e", 2); icEll(x, 51, 56, 4.5, 4, 0, "#f2eadc", "#3a2a1e", 2);
  icEll(x, 27, 27, 19, 15, -0.75, meat, "#2a1a10", 3); icEll(x, 31, 31, 10, 8, -0.75, dark); icEll(x, 21, 20, 6, 3.5, -0.75, "rgba(255,255,255,.25)");
}
const ITEM_PAINT = {
  [I_ARROW]: x => {
    icLine(x, [14, 50, 48, 16], "#2a1a10", 7); icLine(x, [14, 50, 48, 16], "#b07a44", 4); icLine(x, [15, 48, 46, 17], "#d8a46a", 1.4);
    icPoly(x, [58, 6, 42, 12, 52, 22], "#c9ccd4", "#2a2a30", 2.5); icPoly(x, [58, 6, 48, 12, 52, 16], "#eef0f4");
    icPoly(x, [6, 46, 16, 42, 20, 48, 10, 54], "#f4f2ec", "#2a1a10", 2); icPoly(x, [18, 58, 22, 48, 16, 44, 12, 56], "#d23a2e", "#2a1a10", 2);
  },
  [I_BOW]: x => {
    x.beginPath(); x.moveTo(46, 4); x.quadraticCurveTo(0, 32, 46, 60); x.strokeStyle = "#2a1a10"; x.lineWidth = 9; x.lineCap = "round"; x.stroke();
    x.strokeStyle = "#a8743c"; x.lineWidth = 5.5; x.stroke(); x.strokeStyle = "rgba(255,220,160,.5)"; x.lineWidth = 1.5; x.stroke();
    icLine(x, [46, 5, 46, 59], "#f2f2ea", 1.8); icPoly(x, [18, 26, 26, 26, 26, 38, 18, 38], "#5a3a1e", "#2a1a10", 2);
  },
  [I_FLINT]: x => { icPoly(x, [30, 6, 52, 22, 48, 50, 22, 58, 10, 34], "#3c3c42", "#141418", 3); icPoly(x, [30, 6, 52, 22, 32, 30, 18, 20], "#5c5c66"); icPoly(x, [32, 30, 48, 50, 22, 58], "#2c2c32"); icLine(x, [22, 16, 30, 12], "rgba(255,255,255,.45)", 2); },
  [I_FEATHER]: x => {
    x.beginPath(); x.moveTo(12, 56); x.quadraticCurveTo(24, 20, 54, 6); x.quadraticCurveTo(44, 34, 12, 56); x.fillStyle = "#f4f4f0"; x.fill(); x.strokeStyle = "#3a3a40"; x.lineWidth = 2.5; x.stroke();
    x.beginPath(); x.moveTo(10, 58); x.quadraticCurveTo(28, 30, 52, 8); x.strokeStyle = "#b8b4a8"; x.lineWidth = 2; x.stroke();
    for (let k = 0; k < 5; k++) icLine(x, [22 + k * 6, 44 - k * 7, 28 + k * 6, 44 - k * 7], "rgba(120,120,130,.45)", 1.2);
  },
  [I_STRING]: x => { for (let k = 0; k < 4; k++) icEll(x, 32, 32, 18 - k * 3, 12 - k * 1.5, -0.5 + k * 0.35, null, k % 2 ? "#e6e2d8" : "#fbfaf4", 3); icLine(x, [44, 40, 58, 58], "#f4f2ea", 2.5); },
  [I_SHEARS]: x => {
    icPoly(x, [30, 34, 54, 6, 58, 10, 34, 38], "#c6cad2", "#26262c", 2.5); icPoly(x, [34, 30, 10, 6, 6, 10, 30, 34], "#aeb2ba", "#26262c", 2.5);
    icEll(x, 20, 46, 9, 9, 0, null, "#1c1c20", 7); icEll(x, 20, 46, 9, 9, 0, null, "#c83a30", 4.5); icEll(x, 44, 46, 9, 9, 0, null, "#1c1c20", 7); icEll(x, 44, 46, 9, 9, 0, null, "#c83a30", 4.5);
    icEll(x, 32, 34, 3, 3, 0, "#3a3a40");
  },
  [I_LEATHER]: x => {
    icPoly(x, [14, 10, 28, 14, 38, 8, 52, 14, 54, 32, 50, 52, 36, 56, 22, 52, 10, 54, 12, 32], "#9a6234", "#2a160a", 3);
    icPoly(x, [18, 16, 28, 18, 38, 14, 48, 18, 44, 26, 20, 26], "rgba(255,210,160,.18)");
    x.setLineDash && x.setLineDash([3, 3]); icPoly(x, [18, 18, 46, 18, 48, 48, 18, 48], null, "rgba(255,226,180,.55)", 1.5); x.setLineDash && x.setLineDash([]);
  },
  [I_LARMOR]: x => {
    icPoly(x, [18, 8, 26, 12, 38, 12, 46, 8, 58, 18, 52, 28, 48, 24, 48, 58, 16, 58, 16, 24, 12, 28, 6, 18], "#9a6234", "#2a160a", 3);
    icPoly(x, [26, 12, 32, 22, 38, 12], "#6e4222"); icLine(x, [16, 40, 48, 40], "#6e4222", 3); icPoly(x, [22, 16, 42, 16, 44, 24, 20, 24], "rgba(255,220,170,.16)");
  },
  [I_RAWBEEF]: x => icMeat(x, "#c8323a", "#f4dccf", false, false),
  [I_STEAK]: x => icMeat(x, "#7c4222", "#c8986a", true, false),
  [I_RAWPORK]: x => icMeat(x, "#f09a9a", "#fff2ea", false, false),
  [I_PORKCHOP]: x => icMeat(x, "#b87444", "#ecc898", true, false),
  [I_RAWMUTTON]: x => icMeat(x, "#b43238", "#ecd2c4", false, true),
  [I_MUTTON]: x => icMeat(x, "#744424", "#b88c62", true, true),
  [I_RAWCHICKEN]: x => icDrum(x, "#f4cdb8", "rgba(220,150,130,.5)"),
  [I_CHICKEN]: x => icDrum(x, "#c8862e", "rgba(120,60,10,.45)"),
  [I_EGG]: x => { icEll(x, 32, 34, 17, 22, 0, "#f2e8d4", "#3a3024", 3); icEll(x, 26, 24, 5, 8, -0.3, "rgba(255,255,255,.7)"); for (const [a, b] of [[38, 42], [28, 46], [40, 28]]) icEll(x, a, b, 1.6, 1.6, 0, "rgba(160,120,80,.5)"); },
  [I_PIE]: x => {
    icEll(x, 32, 36, 26, 18, 0, "#8a5424", "#2a160a", 3); icEll(x, 32, 32, 24, 15, 0, "#dca050"); icEll(x, 32, 32, 18, 10.5, 0, "#9a3a28");
    for (const o of [-10, 0, 10]) { icLine(x, [22 + o, 23, 30 + o, 41], "#e8b464", 3.2); icLine(x, [42 + o, 23, 34 + o, 41], "#e8b464", 3.2); }
  }
};
function icBucket(x, fill) {
  icPoly(x, [12, 16, 52, 16, 46, 56, 18, 56], "#a9aeb6", "#26282c", 3); icPoly(x, [14, 18, 24, 18, 22, 54, 19, 54], "rgba(255,255,255,.35)");
  icLine(x, [12, 18, 32, 4, 52, 18], "#3a3c42", 2.5); icEll(x, 32, 17, 20, 5, 0, fill || "#3c3f46", "#26282c", 2.5);
  if (fill) icEll(x, 27, 16, 8, 2, 0, "rgba(255,255,255,.35)");
}
ITEM_PAINT[I_BUCKET] = x => icBucket(x, null);
ITEM_PAINT[I_WBUCKET] = x => icBucket(x, "#3d7fe0");
ITEM_PAINT[I_LBUCKET] = x => icBucket(x, "#ff8a22");
ITEM_PAINT[I_MILK] = x => icBucket(x, "#f6f4ee");
ITEM_PAINT[I_SHIELD] = x => {
  icPoly(x, [10, 8, 54, 8, 54, 34, 32, 58, 10, 34], "#a8793f", "#23262c", 3.5); icPoly(x, [14, 12, 50, 12, 50, 32, 32, 52, 14, 32], null, "#9aa0a8", 3);
  icLine(x, [32, 12, 32, 52], "#6e4a25", 2); icLine(x, [14, 26, 50, 26], "#6e4a25", 2); icEll(x, 32, 28, 6, 6, 0, "#c8ccd4", "#3a3c42", 2);
};
ITEM_PAINT[FENCE] = x => {
  for (const px of [12, 44]) { icPoly(x, [px, 8, px + 9, 8, px + 9, 58, px, 58], "#b88a52", "#3a2412", 2.5); icLine(x, [px + 2, 10, px + 2, 56], "rgba(255,230,190,.35)", 1.5); }
  for (const py of [20, 40]) icPoly(x, [21, py, 44, py, 44, py + 7, 21, py + 7], "#a07a46", "#3a2412", 2);
};
ITEM_PAINT[GATE] = x => {
  for (const px of [6, 50]) icPoly(x, [px, 10, px + 8, 10, px + 8, 58, px, 58], "#b88a52", "#3a2412", 2.5);
  for (const py of [18, 42]) icPoly(x, [14, py, 50, py, 50, py + 7, 14, py + 7], "#a07a46", "#3a2412", 2);
  icPoly(x, [28, 25, 36, 25, 36, 42, 28, 42], "#a07a46", "#3a2412", 2);
};
function itemIconURL(id) {
  if (id in ITEM_ICON_URL) return ITEM_ICON_URL[id];
  let url = null;
  try {
    const f = ITEM_PAINT[id];
    if (f) { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
      if (x && x.beginPath && x.ellipse && x.quadraticCurveTo) { f(x); url = cv.toDataURL(); if (typeof url !== "string" || url.indexOf("data:") !== 0) url = null; } }
  } catch (e) { url = null; }
  return (ITEM_ICON_URL[id] = url);
}
// one slot's contents: block cube, painted item or emoji, stack count, durability bar
function fillCell(el, s) {
  if (!s) return;
  if (isItem(s.id)) { const u = itemIconURL(s.id), ic = document.createElement("div"); if (u) { ic.className = "iu"; ic.style.backgroundImage = "url(" + u + ")"; } else { ic.className = "ic"; ic.textContent = ITEMS[s.id].icon; } el.appendChild(ic); } else el.appendChild(blockSwatch(s.id));
  if (s.count > 1) { const ct = document.createElement("div"); ct.className = "ct"; ct.textContent = s.count; el.appendChild(ct); }
  const m = toolMaxDur(s.id);
  if (m && s.dur != null && s.dur < m) { const f = Math.max(0, s.dur / m), d = document.createElement("div"); d.className = "dur"; const i = document.createElement("i"); i.style.width = (f * 100).toFixed(0) + "%"; i.style.background = f > 0.5 ? "#4ade80" : f > 0.2 ? "#facc15" : "#ef4444"; d.appendChild(i); el.appendChild(d); }
  el.title = itemName(s.id);
}
function renderHotbar() {
  const hb = $("hotbar"); hb.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const s = hotbar[i]; const slot = document.createElement("div"); slot.className = "slot" + (i === selSlot ? " active" : "");
    const n = document.createElement("div"); n.className = "n"; n.textContent = i + 1; slot.appendChild(n);
    fillCell(slot, s);
    slot.addEventListener("pointerdown", e => { e.preventDefault(); selectSlot(i); });
    hb.appendChild(slot);
  }
  updateArmorUI();
}
// inventory panel: tap a backpack item to move it to the hotbar (swapping with the selected slot when full), tap a hotbar item to stow it
function renderInv() {
  const g = $("invGrid"); g.innerHTML = "";
  for (let i = 0; i < 9; i++) g.appendChild(cellEl(hotbar[i], () => { const s = hotbar[i]; if (!s) { selectSlot(i); renderInv(); return; } const left = addToStore(bag, s.id, s.count, s.dur); hotbar[i] = left > 0 ? newStack(s.id, left, s.dur) : null; renderHotbar(); buildViewItem(); renderInv(); }, i === selSlot));
  const bg = $("bagGrid"); if (!bg) return; bg.innerHTML = "";
  for (let i = 0; i < 27; i++) bg.appendChild(cellEl(bag[i], () => {
    const s = bag[i]; if (!s) return;
    const left = addToStore(hotbar, s.id, s.count, s.dur);
    if (left === s.count) { const t = hotbar[selSlot]; hotbar[selSlot] = s; bag[i] = t; } else bag[i] = left > 0 ? newStack(s.id, left, s.dur) : null;
    renderHotbar(); buildViewItem(); renderInv();
  }));
  const ar = $("armorLine"); if (ar) { const a = bestArmor(); ar.textContent = a ? "Wearing " + ITEMS[a].name + ", blocks " + Math.round(ITEMS[a].armor * 100) + "% of damage" : "No armor. Craft some from iron or diamonds."; }
}
function craftIconHTML(id) { const bu = !isItem(id) && blockIconURL(id), iu = isItem(id) && itemIconURL(id); return bu ? "<img class='bi' src='" + bu + "' alt=''>" : iu ? "<img class='bi' src='" + iu + "' alt=''>" : itemIcon(id); }
function renderCraft() {
  const N = gridSize(); gridFit(N);
  const miss = gridMissing(), match = matchGrid();
  const hint = $("cgHint");
  if (hint) hint.textContent = N === 3 ? "Crafting Table: 3 x 3 grid. Tap a square, then tap a material below." : "Hand grid: 2 x 2. Stand by a Crafting Table for the full 3 x 3 grid.";
  const G = $("cgrid");
  if (G) {
    G.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const on = gridActive(i, N), id = cgrid[i];
      const c = cellEl(id ? { id, count: 1 } : null, () => {
        if (!on) { toast("Needs a Crafting Table nearby"); return; }
        if (cgSel === i && cgrid[i]) cgrid[i] = 0; else cgSel = i;
        renderCraft();
      }, on && cgSel === i);
      if (!on) c.classList.add("locked"); if (id && miss.has(id)) c.classList.add("miss");
      G.appendChild(c);
    }
  }
  const O = $("cout");
  if (O) {
    O.innerHTML = ""; O.className = "cell cout" + (match && !miss.size ? " ready" : "");
    if (match) { fillCell(O, { id: match.out, count: match.n }); O.title = match.n + "x " + itemName(match.out); }
    O.onpointerdown = e => { e.preventDefault(); craftFromGrid(); };
  }
  const P = $("cgPal");
  if (P) {                                                   // every material Thomas carries, minus what the grid already holds
    P.innerHTML = ""; const seen = new Set();
    for (const arr of [hotbar, bag]) for (const s of arr) {
      if (!s || seen.has(s.id) || stackMax(s.id) === 1) continue; seen.add(s.id);
      const left = countItem(s.id) - gridUsed(s.id);
      const c = cellEl({ id: s.id, count: left }, () => {
        if (left <= 0) { toast("None left"); return; }
        if (!gridActive(cgSel, N)) cgSel = 0;
        cgrid[cgSel] = s.id;
        for (let k = 1; k <= 9; k++) { const n = (cgSel + k) % 9; if (gridActive(n, N) && !cgrid[n]) { cgSel = n; break; } }
        SFX.place(); renderCraft();
      });
      if (left <= 0) c.classList.add("miss"); P.appendChild(c);
    }
    if (!seen.size) { const d = document.createElement("div"); d.className = "muted"; d.style.gridColumn = "1 / -1"; d.textContent = "No materials yet. Chop a tree first."; P.appendChild(d); }
  }
  const l = $("craftList"); if (!l) return; l.innerHTML = "";
  for (const arr of [hotbar, bag]) for (const st of arr) if (st && !knownItems.has(st.id)) knownItems.add(st.id);   // anything carried counts as seen
  const q = cgFilter.trim().toLowerCase(), hasT = N === 3, hasF = nearFurnace();
  let locked = 0;
  for (const r of RECIPES) {
    if (!recipeKnown(r)) { locked++; continue; }
    if (q && itemName(r.out).toLowerCase().indexOf(q) < 0 && !r.need.some(([id]) => itemName(id).toLowerCase().indexOf(q) >= 0)) continue;
    const ok = canCraft(r); const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no");
    const need = r.need.map(([id, c]) => c + "x " + itemName(id)).join(", ");
    const tag = r.furnace ? "<span class='tag" + (hasF ? " on" : "") + "'>Furnace</span>" : r.table ? "<span class='tag" + (hasT ? " on" : "") + "'>Table</span>" : "";
    row.innerHTML = "<span>" + craftIconHTML(r.out) + " " + r.n + "x " + itemName(r.out) + " " + tag + "<br><span class='muted'>" + need + "</span></span>";
    const bx = document.createElement("span"); bx.className = "mkx";
    if (!r.furnace) { const g = document.createElement("button"); g.className = "mk alt"; g.textContent = "Grid"; g.title = "Show the pattern in the grid"; g.addEventListener("pointerdown", e => { e.preventDefault(); gridShow(r); }); bx.appendChild(g); }
    const b = document.createElement("button"); b.className = "mk"; b.textContent = "Make"; b.addEventListener("pointerdown", e => { e.preventDefault(); craft(r); }); bx.appendChild(b);
    row.appendChild(bx); l.appendChild(row);
  }
  if (locked) { const d = document.createElement("div"); d.className = "craftRow no"; d.innerHTML = "<span>🔒 " + locked + " more recipe" + (locked > 1 ? "s" : "") + " to discover<br><span class='muted'>Collect new materials to unlock them</span></span>"; l.appendChild(d); }
}
function toggleInv() { const el = $("inv"); if (el.classList.contains("hidden")) { renderInv(); renderCraft(); show("inv"); document.exitPointerLock(); } else { hide("inv"); if (!isTouch && running) canvas.requestPointerLock(); } }
function renderSkills() {
  const wrap = $("skillList"); if (!wrap) return; $("skillPts").textContent = skills.pts; wrap.innerHTML = "";
  for (const d of SKILLDEF) {
    const can = skills.pts > 0 && skills[d.k] < d.max;
    const row = document.createElement("div"); row.className = "craftRow" + (can ? "" : " no");
    row.innerHTML = "<span><b>" + (d.ic ? d.ic + " " : "") + d.name + "</b> " + skills[d.k] + "/" + d.max + "<br><span class='muted'>" + d.desc + "</span></span>";
    const b = document.createElement("button"); b.className = "mk"; b.textContent = skills[d.k] >= d.max ? "MAX" : "+";
    b.addEventListener("pointerdown", e => { e.preventDefault(); spendSkill(d.k); });
    row.appendChild(b); wrap.appendChild(row);
  }
}
function toggleSkills() { const el = $("skills"); if (el.classList.contains("hidden")) { renderSkills(); show("skills"); document.exitPointerLock(); } else { hide("skills"); if (!isTouch && running) canvas.requestPointerLock(); } }
function renderJournal() {
  const L = $("journalList"); if (!L) return; L.innerHTML = "";
  const hd = t => { const h = document.createElement("div"); h.className = "muted"; h.style.cssText = "font-size:12px;letter-spacing:1px;margin:6px 0 4px"; h.textContent = t; L.appendChild(h); };
  if (daily) {
    hd("DAILY CHALLENGE");
    const dr = document.createElement("div"); dr.className = "craftRow" + (daily.claimed ? "" : " no");
    dr.innerHTML = "<span><b>" + (daily.claimed ? "✓ " : "★ ") + daily.text + "</b><br><span class='muted'>" + (daily.claimed ? "Reward claimed. Come back tomorrow." : ("Progress " + daily.prog + "/" + daily.target)) + "</span></span>";
    L.appendChild(dr);
  }
  if (ngLevel > 0) hd("NEW GAME PLUS " + ngLevel);
  hd("MAIN QUEST");
  quests.forEach((q, i) => {
    const row = document.createElement("div"); row.className = "craftRow" + (i > qi ? " no" : "");
    const mark = i < qi ? "\u2713 " : i === qi ? "\u25B6 " : "\u2022 ";
    const status = i < qi ? "Complete" : i === qi ? q.text : "Locked";
    row.innerHTML = "<span><b>" + mark + q.title + "</b><br><span class='muted'>" + status + "</span></span>";
    L.appendChild(row);
  });
  hd("SIDE QUESTS");
  sideQuests.forEach(s => {
    const done = sideDone.has(s.id);
    const row = document.createElement("div"); row.className = "craftRow" + (done ? "" : " no");
    row.innerHTML = "<span><b>" + (done ? "\u2713 " : "\u2022 ") + s.title + "</b><br><span class='muted'>" + s.text + " (" + (done ? "done" : s.prog()) + ")</span></span>";
    L.appendChild(row);
  });
}
function toggleJournal() { const el = $("journal"); if (el.classList.contains("hidden")) { renderJournal(); show("journal"); document.exitPointerLock(); } else { hide("journal"); if (paused) show("pause"); else if (!isTouch && running) canvas.requestPointerLock(); } }
// chest storage UI
let openChestK = null;
// breaking a chest hands its prizes straight to Thomas (so loot is never lost)
function collectChest(key) {
  const st = chestStore.get(key);
  if (st) { let got = 0; for (const s of st) if (s) { addItem(s.id, s.count, s.dur); got++; } if (got) { toast("Collected the chest's prizes!"); SFX.treasure(); } }
  chestStore.delete(key);
}
function openChest(key) {
  openChestK = key; if (!chestStore.has(key)) chestStore.set(key, new Array(9).fill(null));
  if (story.active && key === story.starterKey && !story.chestOpened) { story.chestOpened = true; clearObjective(); addXP(20); showBanner("Supplies recovered. Now gather Wood from the trees."); }
  if (story.active && key === story.secretKey && !story.secretOpened) { story.secretOpened = true; clearObjective(); showBanner("A buried secret! Cat Vision unlocked."); givePowerup("catvision"); }
  if (treasureKey && key === treasureKey) { treasureKey = null; clearObjective(); addCoins(15); addXP(40); SFX.treasure(); showBanner("Treasure found! +15 coins"); achieve("treasure", "Treasure Hunter"); }
  renderChest(); show("chest"); document.exitPointerLock();
}
function cellEl(s, onClick, active) {
  const c = document.createElement("div"); c.className = "cell" + (active ? " active" : "");
  fillCell(c, s);
  c.addEventListener("pointerdown", e => { e.preventDefault(); onClick(); });
  return c;
}
function renderChest() {
  const store = chestStore.get(openChestK); if (!store) return;
  const cg = $("chestGrid"); cg.innerHTML = "";
  for (let i = 0; i < store.length; i++) cg.appendChild(cellEl(store[i], () => { const s = store[i]; if (!s) return; const left = giveItems(s.id, s.count, s.dur); store[i] = left > 0 ? newStack(s.id, left, s.dur) : null; renderChest(); renderHotbar(); }));
  const ig = $("chestInv"); ig.innerHTML = "";
  for (const arr of [hotbar, bag]) for (let i = 0; i < arr.length; i++) ig.appendChild(cellEl(arr[i], () => { const s = arr[i]; if (!s) return; const left = addToStore(store, s.id, s.count, s.dur); arr[i] = left > 0 ? newStack(s.id, left, s.dur) : null; renderChest(); renderHotbar(); buildViewItem(); }));
}
function closeChest() { hide("chest"); openChestK = null; if (!isTouch && running) canvas.requestPointerLock(); }
