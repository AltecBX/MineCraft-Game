/* inventory.js: Inventory, stacking, durability, crafting grid and recipes.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- INVENTORY (9 slot hotbar + 27 slot backpack; tools carry durability) ----------
const hotbar = new Array(9).fill(null);   // {id, count, dur?}
const bag = new Array(27).fill(null);
let selSlot = 0;
// tools, weapons, armor and charms are one per slot; materials, food and ammo stack to 64
function stackMax(id) { if (!isItem(id)) return 64; const t = ITEMS[id]; return !t || t.tool || t.armor || t.dur || t.protect ? 1 : 64; }
function toolMaxDur(id) { const t = ITEMS[id]; return t && t.dur ? t.dur : 0; }
function newStack(id, count, dur) { const s = { id, count }; const m = toolMaxDur(id); if (m) s.dur = dur != null ? dur : m; return s; }
// put up to `count` of id into arr (stacking first, then empty slots); returns what did not fit
function addToStore(arr, id, count, dur) {
  const stack = stackMax(id);
  if (stack > 1) for (let i = 0; i < arr.length && count > 0; i++) { const s = arr[i]; if (s && s.id === id && s.count < stack) { const add = Math.min(count, stack - s.count); s.count += add; count -= add; } }
  for (let i = 0; i < arr.length && count > 0; i++) { if (!arr[i]) { const add = Math.min(count, stack); arr[i] = newStack(id, add, dur); count -= add; } }
  return count;
}
// recipe discovery: a recipe shows in the book once Thomas has held any of its ingredients
const knownItems = new Set();
function recipeKnown(r) { return r.need.some(([n]) => knownItems.has(n)) || knownItems.has(r.out); }
function learnItem(id) {
  if (knownItems.has(id)) return;
  const before = RECIPES.filter(recipeKnown).length; knownItems.add(id);
  const gained = RECIPES.filter(recipeKnown).length - before;
  if (gained > 0 && running && typeof toast === "function") toast("Recipe book: " + gained + " new recipe" + (gained > 1 ? "s" : ""));
}
// hand items to Thomas: top up existing stacks anywhere, then fill the hotbar, then the backpack
function giveItems(id, n, dur) {
  learnItem(id);
  const stack = stackMax(id);
  if (stack > 1) for (const arr of [hotbar, bag]) for (let i = 0; i < arr.length && n > 0; i++) { const s = arr[i]; if (s && s.id === id && s.count < stack) { const add = Math.min(n, stack - s.count); s.count += add; n -= add; } }
  if (n > 0) n = addToStore(hotbar, id, n, dur);
  if (n > 0) n = addToStore(bag, id, n, dur);
  return n;
}
function addItem(id, n, dur) {
  const left = giveItems(id, n, dur), got = n - left;
  if (got > 0) { renderHotbar(); SFX.pickup(); toast("+" + got + " " + itemName(id)); onCollect(id); if (!$("inv").classList.contains("hidden")) renderInv(); }
  if (left > 0) toast("Inventory full");
}
function removeItem(slot, n) { const s = hotbar[slot]; if (!s) return; s.count -= n; if (s.count <= 0) hotbar[slot] = null; renderHotbar(); }
function countItem(id) { let c = 0; for (const s of hotbar) if (s && s.id === id) c += s.count; for (const s of bag) if (s && s.id === id) c += s.count; return c; }
function consumeItem(id, n) {
  for (const arr of [bag, hotbar]) for (let i = 0; i < arr.length && n > 0; i++) { const s = arr[i]; if (s && s.id === id) { const take = Math.min(n, s.count); s.count -= take; n -= take; if (s.count <= 0) arr[i] = null; } }
  renderHotbar();
}
// the best armor anywhere in the inventory is worn automatically
function bestArmor() { let best = 0, id = 0; for (const arr of [hotbar, bag]) for (const s of arr) if (s && ITEMS[s.id] && ITEMS[s.id].armor > best) { best = ITEMS[s.id].armor; id = s.id; } return id; }
function updateArmorUI() {
  let el = $("armorHud"); const a = bestArmor();
  if (!el) { const v = $("vitals"); if (!v || !v.appendChild) return; el = document.createElement("div"); el.id = "armorHud"; v.appendChild(el); }
  el.textContent = a ? ITEMS[a].icon + " " + Math.round(ITEMS[a].armor * 100) + "%" : ""; el.style.display = a ? "" : "none";
}
// wear down the held tool; it breaks at zero
function wearTool(amount) {
  const s = hotbar[selSlot]; if (!s || !toolMaxDur(s.id)) return;
  if (s.dur == null) s.dur = toolMaxDur(s.id);
  s.dur -= amount || 1;
  if (s.dur <= 0) { const nm = itemName(s.id); hotbar[selSlot] = null; toast(nm + " broke!"); SFX.toolBreak(); addShake(0.12); buildViewItem(); }
  renderHotbar();
}
function selectSlot(i) { selSlot = i; renderHotbar(); buildViewItem(); }

// ---------- CRAFTING: shaped recipes on a 2 x 2 hand grid or a 3 x 3 Crafting Table grid, plus a recipe book ----------
// Grid recipes are patterns of rows whose letters come from CK. Their ingredient list (need) is derived from the
// pattern, so the recipe book and the grid always cost the same. Shapeless recipes list need directly and match
// any arrangement. Smelting and cooking need a Furnace nearby. Anything wider or taller than 2 needs a Crafting Table.
const CK = { P: PLANKS, S: I_STICK, W: WOOD, C: COBBLE, F: FIRE_CRYSTAL, B: BOUNCE, L: LEAVES, Y: CRYSTAL, A: I_APPLE, N: SNOW, I: I_IRON, D: I_DIAMOND,
  G: I_GOLD, K: I_COAL, T: TORCH, H: TALLGRASS, O: WOOL, R: I_STRING, X: I_FLINT, E: I_FEATHER, M: I_LEATHER, Z: STONE };
const shaped = (out, n, pat) => ({ out, n, pat });
const shapeless = (out, n, need) => ({ out, n, need, shapeless: 1 });
const smelt = (out, n, need) => ({ out, n, need, furnace: 1 });
const RECIPES = [
  shaped(PLANKS, 4, ["W"]),
  shaped(I_STICK, 4, ["P", "P"]),
  shaped(CRAFT_TABLE, 1, ["PP", "PP"]),
  shaped(I_WPICK, 1, ["PPP", " S ", " S "]),
  shaped(I_SWORD, 1, ["P", "P", "S"]),
  shaped(I_AXE, 1, ["PP", "PS", " S"]),
  shaped(I_SPICK, 1, ["CCC", " S ", " S "]),
  shaped(TORCH, 4, ["P", "S"]),
  shaped(CHEST, 1, ["PPP", "P P", "PPP"]),
  shaped(BRICK, 4, ["CC", "CC"]),
  shaped(BED, 1, ["PPP", "W W"]),
  shaped(BED, 1, ["OOO", "PPP"]),
  shapeless(I_FIRECHARM, 1, [[FIRE_CRYSTAL, 4], [I_STICK, 2]]),
  shapeless(I_FIRESWORD, 1, [[FIRE_CRYSTAL, 3], [I_STICK, 1]]),
  shaped(I_LIGHTHAMMER, 1, ["CCC", "CSC", " S "]),
  shaped(I_BOOMPICK, 1, ["CCC", "CSC", "CSC"]),
  shaped(I_BOW, 1, [" SR", "S R", " SR"]),
  shaped(I_ARROW, 4, ["X", "S", "E"]),
  shaped(I_ICEBOW, 1, [" PS", "P S", " PS"]),
  shapeless(I_SLIMELAUNCH, 1, [[BOUNCE, 2], [I_STICK, 2]]),
  shapeless(BOUNCE, 2, [[LEAVES, 4], [PLANKS, 1]]),
  shapeless(SPIKE, 2, [[COBBLE, 2], [I_STICK, 1]]),
  shapeless(ALARM, 1, [[COBBLE, 3], [I_STICK, 1]]),
  shapeless(FREDA, 1, [[COBBLE, 3], [FIRE_CRYSTAL, 1]]),
  shaped(I_CRYSTALSPEAR, 1, [" YY", " SY", "S  "]),
  shapeless(I_MACHINEGUN, 1, [[COBBLE, 6], [CRYSTAL, 2], [FIRE_CRYSTAL, 1]]),
  shapeless(LAUNCH, 1, [[BOUNCE, 1], [FIRE_CRYSTAL, 1]]),
  shapeless(HEAL, 1, [[CRYSTAL, 1], [I_APPLE, 2]]),
  shapeless(FROST, 1, [[CRYSTAL, 2], [SNOW, 2]]),
  shaped(FURNACE, 1, ["CCC", "C C", "CCC"]),
  smelt(I_IRON, 1, [[IRON_ORE, 1], [I_COAL, 1]]),
  smelt(I_GOLD, 1, [[GOLD_ORE, 1], [I_COAL, 1]]),
  smelt(GLASS, 4, [[SAND, 4], [I_COAL, 1]]),
  smelt(STONEBRICK, 4, [[COBBLE, 4], [I_COAL, 1]]),
  smelt(I_BREAD, 2, [[HAY, 1]]),
  smelt(I_STEAK, 1, [[I_RAWBEEF, 1]]),
  smelt(I_PORKCHOP, 1, [[I_RAWPORK, 1]]),
  smelt(I_MUTTON, 1, [[I_RAWMUTTON, 1]]),
  smelt(I_CHICKEN, 1, [[I_RAWCHICKEN, 1]]),
  shaped(TORCH, 8, ["K", "S", "S"]),
  shaped(I_IPICK, 1, ["III", " S ", " S "]),
  shaped(I_ISWORD, 1, ["I", "I", "S"]),
  shaped(I_IAXE, 1, ["II", "IS", " S"]),
  shaped(I_IARMOR, 1, ["I I", "III", "III"]),
  shaped(I_DPICK, 1, ["DDD", " S ", " S "]),
  shaped(I_DSWORD, 1, ["D", "D", "S"]),
  shaped(I_DAXE, 1, ["DD", "DS", " S"]),
  shaped(I_DARMOR, 1, ["D D", "DDD", "DDD"]),
  shaped(I_LARMOR, 1, ["M M", "MMM", "MMM"]),
  shaped(I_SHEARS, 1, [" I", "I "]),
  shaped(LANTERN, 2, ["I", "T"]),
  shaped(I_GAPPLE, 1, [" G ", "GAG", " G "]),
  shaped(HAY, 1, ["HHH", "HHH"]),
  shaped(I_STRING, 3, ["O"]),
  shaped(FENCE, 3, ["PSP", "PSP"]),
  shaped(STONEBRICK, 4, ["ZZ", "ZZ"]),
  shaped(GATE, 1, ["SPS", "SPS"]),
  shaped(I_BUCKET, 1, ["I I", " I "]),
  shaped(I_SHIELD, 1, ["PIP", "PPP", " P "]),
  shaped(WOOL, 1, ["RR", "RR"]),
  shapeless(I_PIE, 1, [[I_EGG, 1], [I_BREAD, 1], [I_APPLE, 1]])
];
for (const r of RECIPES) {                       // derive need, footprint and table requirement once
  if (r.pat) {
    r.h = r.pat.length; r.w = Math.max(...r.pat.map(row => row.length));
    r.cells = r.pat.map(row => { const a = []; for (let i = 0; i < r.w; i++) { const ch = row[i] || " "; a.push(ch === " " ? 0 : CK[ch]); } return a; });
    const cnt = new Map(); for (const row of r.cells) for (const id of row) if (id) cnt.set(id, (cnt.get(id) || 0) + 1);
    r.need = [...cnt];
  }
  r.slots = r.need.reduce((a, x) => a + x[1], 0);
  r.table = !r.furnace && (r.pat ? (r.w > 2 || r.h > 2) : r.slots > 4);
}
function nearBlock(bid, rad) { const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z); for (let dy = -2; dy <= 3; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (getBlock(px + dx, py + dy, pz + dz) === bid) return true; return false; }
function nearFurnace() { return nearBlock(FURNACE, 4); }
function nearTable() { return nearBlock(CRAFT_TABLE, 4); }
function canCraft(r) { return r.need.every(([id, c]) => countItem(id) >= c) && (!r.furnace || nearFurnace()) && (!r.table || nearTable()); }
function craft(r) {
  if (!canCraft(r)) { if (r.furnace && !nearFurnace()) toast("Stand next to a Furnace to smelt that"); else if (r.table && !nearTable()) toast("That needs a Crafting Table nearby (4 Planks)"); return; }
  r.need.forEach(([id, c]) => consumeItem(id, c)); addItem(r.out, r.n); if (r.furnace) SFX.smelt(); else SFX.craft();
  renderCraft(); if (!$("inv").classList.contains("hidden")) renderInv(); onCraft(r.out);
}
// the crafting grid: cells hold item ids reserved from the inventory; nothing is taken until you craft
const cgrid = new Array(9).fill(0);
let cgSel = 0, cgFilter = "";
function gridSize() { return nearTable() ? 3 : 2; }
function gridActive(i, N) { return (i % 3) < N && ((i / 3) | 0) < N; }
function gridUsed(id) { let n = 0; for (const c of cgrid) if (c === id) n++; return n; }
function gridFit(N) { for (let i = 0; i < 9; i++) if (!gridActive(i, N)) cgrid[i] = 0; if (!gridActive(cgSel, N)) cgSel = 0; }
// the recipe the current grid spells out (shaped with mirroring, or shapeless), or null
function matchGrid() {
  let x0 = 3, y0 = 3, x1 = -1, y1 = -1;
  for (let i = 0; i < 9; i++) if (cgrid[i]) { const x = i % 3, y = (i / 3) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, at = (x, y) => cgrid[(y0 + y) * 3 + x0 + x];
  const counts = new Map(); for (const c of cgrid) if (c) counts.set(c, (counts.get(c) || 0) + 1);
  for (const r of RECIPES) {
    if (r.furnace) continue;
    if (r.pat) {
      if (r.w !== w || r.h !== h) continue;
      let ok = true, okM = true;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (at(x, y) !== r.cells[y][x]) ok = false; if (at(x, y) !== r.cells[y][w - 1 - x]) okM = false; }
      if (ok || okM) return r;
    } else if (r.need.length === counts.size && r.need.every(([id, c]) => counts.get(id) === c)) return r;
  }
  return null;
}
function gridMissing() { const m = new Set(); const need = new Map(); for (const c of cgrid) if (c) need.set(c, (need.get(c) || 0) + 1); for (const [id, c] of need) if (countItem(id) < c) m.add(id); return m; }
function craftFromGrid() {
  const r = matchGrid(); if (!r) { toast("That pattern does not make anything"); return; }
  if (gridMissing().size) { toast("You are out of some of those ingredients"); return; }
  if (r.table && !nearTable()) { toast("That needs a Crafting Table nearby"); return; }
  const need = new Map(); for (const c of cgrid) if (c) need.set(c, (need.get(c) || 0) + 1);
  for (const [id, c] of need) consumeItem(id, c);
  addItem(r.out, r.n); SFX.craft(); onCraft(r.out);
  renderCraft(); renderInv();
}
// load a recipe's pattern into the grid (the recipe book's Grid button), so the layout is easy to learn
function gridShow(r) {
  const N = gridSize();
  if (r.furnace) { toast("Smelting happens at a Furnace. Use Make."); return; }
  if (r.table && N < 3) { toast("Stand by a Crafting Table to use the 3 x 3 grid"); return; }
  cgrid.fill(0);
  if (r.pat) { for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) cgrid[y * 3 + x] = r.cells[y][x]; }
  else { let k = 0; for (const [id, c] of r.need) for (let j = 0; j < c; j++) { while (k < 9 && !gridActive(k, N)) k++; if (k < 9) cgrid[k++] = id; } }
  cgSel = 0; renderCraft();
}
