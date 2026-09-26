// crafting grid: every recipe is well formed, shaped and mirrored patterns match, 2x2 vs 3x3 gating, grid crafting consumes the right items
let bad = 0;
for (const r of RECIPES) {
  if (!r.need.length || r.need.some(([id, c]) => id == null || !(isItem(id) ? ITEMS[id] : BLOCKS[id]) || !(c > 0))) { bad++; console.log("BAD_RECIPE", itemName(r.out), JSON.stringify(r.need)); }
  if (!r.furnace && r.slots > 9) { bad++; console.log("TOO_BIG", itemName(r.out), r.slots); }
  if (r.pat && r.cells.some(row => row.some(v => v === undefined))) { bad++; console.log("BAD_KEY", itemName(r.out)); }
}
console.log("RECIPES", RECIPES.length, "bad", bad, "table", RECIPES.filter(r => r.table).length, "hand", RECIPES.filter(r => !r.table && !r.furnace).length);
// no two grid recipes may spell the same pattern
let clash = 0;
for (let a = 0; a < RECIPES.length; a++) for (let b = a + 1; b < RECIPES.length; b++) {
  const A = RECIPES[a], B = RECIPES[b]; if (!A.pat || !B.pat || A.w !== B.w || A.h !== B.h) continue;
  if (JSON.stringify(A.cells) === JSON.stringify(B.cells)) { clash++; console.log("CLASH", itemName(A.out), itemName(B.out)); }
}
console.log("CLASHES", clash);
// hand grid (no table near): the pickaxe pattern cannot fit, planks and sticks can
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null;
player.pos.set(500.5, 60, 500.5);
addItem(WOOD, 4); addItem(PLANKS, 10); addItem(I_STICK, 4);
console.log("SIZE_AWAY", gridSize());
cgrid.fill(0); cgrid[0] = WOOD; let m = matchGrid(); console.log("MATCH_PLANKS", m && itemName(m.out), m && m.n);
cgrid.fill(0); cgrid[4] = PLANKS; cgrid[1] = PLANKS; m = matchGrid(); console.log("MATCH_STICKS", m && itemName(m.out));
cgrid.fill(0); cgrid[0] = PLANKS; cgrid[1] = PLANKS; cgrid[3] = PLANKS; cgrid[4] = PLANKS; m = matchGrid(); console.log("MATCH_TABLE", m && itemName(m.out));
const before = countItem(PLANKS); craftFromGrid(); console.log("CRAFTED_TABLE", countItem(CRAFT_TABLE), "planks used", before - countItem(PLANKS));
// book craft of a 3x3 recipe is refused without a table
const pick = RECIPES.find(r => r.out === I_WPICK); console.log("PICK_NEEDS_TABLE", pick.table, "canCraft", canCraft(pick));
// place the table next to Thomas: the full grid opens and the pickaxe (and its mirror) match
const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z); ensureGen(px, pz, 1);
const gy = surfaceY(px + 2, pz); setRaw(px + 2, gy, pz, CRAFT_TABLE); player.pos.set(px + 0.5, gy, pz + 0.5);
console.log("SIZE_NEAR", gridSize(), "canCraft pick", canCraft(pick));
cgrid.fill(0); [0, 1, 2].forEach(i => cgrid[i] = PLANKS); cgrid[4] = I_STICK; cgrid[7] = I_STICK; m = matchGrid(); console.log("MATCH_PICK", m && itemName(m.out));
cgrid.fill(0); cgrid[1] = PLANKS; cgrid[2] = PLANKS; cgrid[4] = I_STICK; cgrid[5] = PLANKS; cgrid[7] = I_STICK; m = matchGrid(); console.log("MATCH_AXE_MIRROR", m && itemName(m.out));
cgrid.fill(0); cgrid[0] = PLANKS; cgrid[4] = I_STICK; m = matchGrid(); console.log("MATCH_NONSENSE", m);
// shapeless in any arrangement
addItem(I_EGG, 1); addItem(I_BREAD, 1); addItem(I_APPLE, 1);
cgrid.fill(0); cgrid[8] = I_EGG; cgrid[0] = I_APPLE; cgrid[4] = I_BREAD; m = matchGrid(); console.log("MATCH_PIE", m && itemName(m.out));
craftFromGrid(); console.log("PIE", countItem(I_PIE), "egg left", countItem(I_EGG), "missing after", gridMissing().size);
// gridShow lays out the bow pattern
gridShow(RECIPES.find(r => r.out === I_BOW)); m = matchGrid(); console.log("SHOW_BOW", m && itemName(m.out), JSON.stringify(cgrid));
// stacking of plain items
addItem(I_COAL, 70); let slots = 0; for (const arr of [hotbar, bag]) for (const s of arr) if (s && s.id === I_COAL) slots++;
console.log("COAL_STACKS", slots, "count", countItem(I_COAL), "bowStack", stackMax(I_BOW), "arrowStack", stackMax(I_ARROW));
renderCraft(); renderInv(); console.log("RENDER_OK");
console.log("ICON", typeof itemIconURL(I_ARROW), "tiles", Object.keys(ATL.tiles).length, "atlas", ATL.w + "x" + ATL.h);
// recipe discovery
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null; knownItems.clear();
const vis0 = RECIPES.filter(recipeKnown).length; addItem(WOOD, 1); const vis1 = RECIPES.filter(recipeKnown).length; addItem(I_IRON, 1); const vis2 = RECIPES.filter(recipeKnown).length;
console.log("DISCOVERY", vis0, vis1, vis2, vis0 === 0 && vis1 > 0 && vis2 > vis1 ? "PASS" : "FAIL");
