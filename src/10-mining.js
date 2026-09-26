/* mining.js: Aiming, mining, building, buckets, gates, debris and drops.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- AIM / MINING / BUILDING ----------
const ray = new THREE.Raycaster(); const ctr = new THREE.Vector2(0, 0);
const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
selBox.visible = false; scene.add(selBox);
function voxelRaycast(reach, fluids) {
  // DDA voxel traversal from camera
  const o = new THREE.Vector3(player.pos.x, player.pos.y + (player._crouch ? EYE - 0.35 : EYE), player.pos.z); const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
  const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
  let mx = (sx > 0 ? (x + 1 - o.x) : (o.x - x)) * tdx, my = (sy > 0 ? (y + 1 - o.y) : (o.y - y)) * tdy, mz = (sz > 0 ? (z + 1 - o.z) : (o.z - z)) * tdz;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < reach * 4; i++) {
    const id = getBlock(x, y, z);
    if (id !== AIR && (id !== WATER || fluids)) return { x, y, z, id, n: [nx, ny, nz] };
    if (mx < my && mx < mz) { x += sx; t = mx; mx += tdx; nx = -sx; ny = nz = 0; }
    else if (my < mz) { y += sy; t = my; my += tdy; ny = -sy; nx = nz = 0; }
    else { z += sz; t = mz; mz += tdz; nz = -sz; nx = ny = 0; }
    if (t > reach) break;
  }
  return null;
}
let mineTarget = null, mineProg = 0, mineSfxCd = 0;
function mineReset() { mineProg = 0; mineTarget = null; document.getElementById("mineRing").style.opacity = "0"; updateCrack(null, 0); }
function currentTool() { const it = hotbar[selSlot]; return (it && isItem(it.id)) ? ITEMS[it.id] : null; }
// ores need a good enough pickaxe to drop anything (wood 1, stone 2, iron 3, diamond 4)
function canHarvest(id) { const b = BLOCKS[id]; if (!b || !b.minTier) return true; const t = currentTool(); return !!(t && t.tool === "pick" && (t.tier || 0) >= b.minTier); }
let harvestHintCd = 0;
function breakTime(id) {
  const b = BLOCKS[id]; if (!b || b.hard <= 0) return Infinity;
  let t = b.hard; const tool = currentTool();
  if (!canHarvest(id)) t *= 2.5;
  if (tool && b.tool && tool.tool === b.tool) t /= (1 + tool.tier);    // right tool faster
  else if (tool && tool.tool === "sword") t *= 1.2;
  return Math.max(0.12, t / miningMult);
}
function updateMining(dt) {
  if (updateBow(dt)) { if (mineTarget) mineReset(); return; }    // a draw bow uses the attack button to draw and loose
  if (!primaryHeld) { if (mineTarget) mineReset(); return; }
  // ranged weapons fire instead of mining/meleeing
  const tBow = currentTool();
  if (tBow && tBow.tool === "bow") { if (bowCd <= 0) { bowCd = 0.55; firePlayerShot(tBow.special); } return; }
  if (tBow && tBow.tool === "gun") { if (bowCd <= 0) { bowCd = 0.11; firePlayerShot("bullet"); swing = 0.4; addShake(0.05); } return; }   // rapid fire
  // attack entities first
  const hit = aimEntity();
  if (hit) { attackEntity(hit); return; }
  const r = voxelRaycast(5);
  if (!r || !BLOCKS[r.id] || BLOCKS[r.id].hard <= 0) { mineReset(); return; }
  if (!mineTarget || mineTarget.x !== r.x || mineTarget.y !== r.y || mineTarget.z !== r.z) { mineTarget = r; mineProg = 0; }
  mineProg += dt; mineSfxCd -= dt; if (mineSfxCd <= 0) { SFX.mine(); mineSfxCd = 0.18; }
  const need = breakTime(r.id);
  const ring = document.getElementById("mineRing"); ring.style.opacity = "1";
  const frac = Math.min(1, mineProg / need); updateCrack(r, frac);
  document.querySelector("#mineRing .fg").style.strokeDasharray = (2 * Math.PI * 22).toFixed(1);
  document.querySelector("#mineRing .fg").style.strokeDashoffset = (2 * Math.PI * 22 * (1 - frac)).toFixed(1);
  if (mineProg >= need) {
    let drop = BLOCKS[r.id].drop;
    if (r.id === GRAVEL && Math.random() < 0.25) drop = I_FLINT;              // gravel sometimes gives flint for arrowheads
    if (r.id === CHEST) collectChest(chestKey(r.x, r.y, r.z));
    if (r.id === FURNACE) spillFurnace(furnaceKey(r.x, r.y, r.z), r.x, r.y, r.z);
    if (r.id === FREDA) { fredaEvent(r.x, r.y, r.z); }
    if (r.id === QBLOCK) { qblockPop(r.x, r.y, r.z); }
    setRaw(r.x, r.y, r.z, AIR); recordEdit(r.x, r.y, r.z, AIR);
    if (r.id === PORTAL) rebuildPortalCells();
    if (r.id === TORCH) rebuildTorchCells();
    if (r.id === SPIKE || r.id === ALARM || r.id === HEAL || r.id === FROST) rebuildDefenseCells();
    if (r.id === FREDA) rebuildFredaLabels();
    markDirty(r.x, r.z); markDirty(r.x + 1, r.z); markDirty(r.x - 1, r.z); markDirty(r.x, r.z + 1); markDirty(r.x, r.z - 1);
    blockParticles(r.x, r.y, r.z, BLOCKS[r.id].top, r.id);
    const harvest = canHarvest(r.id);
    if (drop !== undefined && harvest) popDrop(r.x, r.y, r.z, drop, r.id);
    else if (!harvest && harvestHintCd <= 0) { harvestHintCd = 4; toast(BLOCKS[r.id].name + " needs a " + ["", "wood", "stone", "iron", "diamond"][BLOCKS[r.id].minTier] + " pickaxe or better"); }
    { const tw = currentTool(); if (tw && tw.dur) wearTool(tw.tool === "sword" ? 2 : 1); }
    if (r.id === GLASS) SFX.glass();
    const tBoom = currentTool(); if (tBoom && tBoom.special === "boom") boomBreak(r.x, r.y, r.z);
    SFX.place();
    mineReset(); onMine(r.id);
  }
}
function placeBlock() {
  { const g = voxelRaycast(5); if (g && BLOCKS[g.id] && BLOCKS[g.id].gate) { toggleGate(g.x, g.y, g.z); return; } }   // right click swings a gate
  const it = hotbar[selSlot];
  if (it && ITEMS[it.id] && ITEMS[it.id].bucket !== undefined) { useBucket(); return; }
  if (!it || isItem(it.id)) { return; }       // only blocks place
  const r = voxelRaycast(5); if (!r) return;
  const tx = r.x + r.n[0], ty = r.y + r.n[1], tz = r.z + r.n[2];
  if (getBlock(tx, ty, tz) !== AIR && getBlock(tx, ty, tz) !== WATER) return;
  // don't place a solid block inside the player
  if (BLOCKS[it.id].solid) {
    const x0 = Math.floor(player.pos.x - HW), x1 = Math.floor(player.pos.x + HW), y0 = Math.floor(player.pos.y), y1 = Math.floor(player.pos.y + PH - 0.001), z0 = Math.floor(player.pos.z - HW), z1 = Math.floor(player.pos.z + HW);
    if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 && tz >= z0 && tz <= z1) return;
  }
  setRaw(tx, ty, tz, it.id); recordEdit(tx, ty, tz, it.id);
  markDirty(tx, tz); markDirty(tx + 1, tz); markDirty(tx - 1, tz); markDirty(tx, tz + 1); markDirty(tx, tz - 1);
  if (it.id === TORCH) rebuildTorchCells();
  if (it.id === SPIKE || it.id === ALARM || it.id === HEAL || it.id === FROST) rebuildDefenseCells();
  if (it.id === FREDA) rebuildFredaLabels();
  if (it.id === CHEST && !chestStore.has(chestKey(tx, ty, tz))) chestStore.set(chestKey(tx, ty, tz), new Array(9).fill(null));
  removeItem(selSlot, 1); SFX.place(); placedBlocks++; dailyTick("build", 1);
}
function toggleGate(x, y, z) {
  const id = getBlock(x, y, z), open = id === GATE;
  if (!open) {                                                             // do not shut a gate on Thomas
    const px0 = Math.floor(player.pos.x - HW), px1 = Math.floor(player.pos.x + HW), pz0 = Math.floor(player.pos.z - HW), pz1 = Math.floor(player.pos.z + HW), py0 = Math.floor(player.pos.y), py1 = Math.floor(player.pos.y + PH);
    if (x >= px0 && x <= px1 && z >= pz0 && z <= pz1 && y >= py0 - 1 && y <= py1) { toast("Step out of the gateway first"); return; }
  }
  setRaw(x, y, z, open ? GATE_OPEN : GATE); recordEdit(x, y, z, open ? GATE_OPEN : GATE); markAround(x, z);
  SFX.gate(open);
}
// buckets: scoop a still source of water or lava, pour it out again, or milk a cow (see animalInteract)
function useBucket() {
  const it = hotbar[selSlot], B = ITEMS[it.id];
  if (B.bucket === "empty") {
    const r = voxelRaycast(5, true);
    if (r && (r.id === WATER || r.id === LAVA)) {
      if (getFlow(r.x, r.y, r.z) !== 0) { toast("That is flowing. Scoop from a still source block."); return; }
      fluidSet(r.x, r.y, r.z, AIR, 0); hotbar[selSlot] = newStack(r.id === WATER ? I_WBUCKET : I_LBUCKET, 1);
      SFX.splash(); renderHotbar(); buildViewItem();
    }
    return;
  }
  if (B.bucket === WATER || B.bucket === LAVA) {
    const r = voxelRaycast(5); if (!r) return;
    const tx = r.x + r.n[0], ty = r.y + r.n[1], tz = r.z + r.n[2], at = getBlock(tx, ty, tz);
    if (!(fluidReplaceable(at) || at === WATER || at === LAVA)) return;
    if (B.bucket === WATER && DIM === "fire") { fizz(tx, ty, tz); toast("The water boils away in this heat"); hotbar[selSlot] = newStack(I_BUCKET, 1); renderHotbar(); buildViewItem(); return; }
    fluidSet(tx, ty, tz, B.bucket, 0); hotbar[selSlot] = newStack(I_BUCKET, 1);
    SFX.splash(); renderHotbar(); buildViewItem();
  }
}
// debris chips coloured from the block's real texture, lit like the world
const chipGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
function tileTexel(id, face) {
  const tl = TIL[id]; if (!tl) return null;
  const t = tl[face || 1], TS = GL.TILE, AW = ATL.w, AH = ATL.h;
  for (let k = 0; k < 6; k++) {
    const px = (Math.random() * TS) | 0, py = (Math.random() * TS) | 0, i = ((Math.round(t.v0 * AH) + py) * AW + Math.round(t.u0 * AW) + px) * 4;
    if (ATL.data[i + 3] > 128 || KIND[id] === 1) return [ATL.data[i] / 255, ATL.data[i + 1] / 255, ATL.data[i + 2] / 255];
  }
  return null;
}
function blockParticles(x, y, z, col, id) {
  for (let i = 0; i < 12; i++) {
    const tc = id != null ? tileTexel(id, i % 3 === 0 ? 0 : 1) : null, c = tc || col;
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }); mat.userData.detailed = 1;
    const m = new THREE.Mesh(chipGeo, mat); m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6); m.scale.setScalar(0.6 + Math.random() * 0.8);
    scene.add(m); fxParts.push({ mesh: m, life: 0.7 + Math.random() * 0.5, debris: 1, disposeMat: 1, vel: new THREE.Vector3((Math.random() - .5) * 4, 2 + Math.random() * 3, (Math.random() - .5) * 4) });
  }
}
// the mined item pops out of the block and flies to Thomas (the item itself is added immediately)
const dropSpriteCache = {};
function dropMesh(drop) {
  if (!isItem(drop) && TIL[drop] && !ITEM_PAINT[drop]) return blockCube(drop, 0.26);
  let tex = dropSpriteCache[drop];
  if (!tex) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    let painted = false; try { if (ITEM_PAINT[drop] && x && x.ellipse && x.quadraticCurveTo) { ITEM_PAINT[drop](x); painted = true; } } catch (e) {}
    if (!painted && x && x.fillText) { x.font = "48px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(itemIcon(drop), 32, 36); }
    tex = dropSpriteCache[drop] = new THREE.CanvasTexture(c); }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); sp.scale.set(0.4, 0.4, 1); return sp;
}
function popDrop(x, y, z, drop, srcId) {
  addItem(drop, 1);
  const m = dropMesh(drop); m.position.set(x + 0.5, y + 0.5, z + 0.5); scene.add(m);
  fxParts.push({ mesh: m, life: 1.4, drop: 1, t: 0, vel: new THREE.Vector3((Math.random() - .5) * 1.5, 3.2, (Math.random() - .5) * 1.5) });
}
// crack overlay that spreads across the block being mined (8 stages drawn once)
const crackTex = [];
function crackStage(n) {
  if (crackTex[n]) return crackTex[n];
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  if (x && x.fillRect) {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.fillStyle = "rgba(15,12,10,0.8)";
    const lines = 2 + n * 2;
    for (let k = 0; k < lines; k++) { let px = 32 + (rnd() - 0.5) * 10, py = 32 + (rnd() - 0.5) * 10, a = rnd() * 6.283; const len = 6 + n * 4 + rnd() * 6;
      for (let t = 0; t < len; t++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * 2; py += Math.sin(a) * 2; x.fillRect(Math.round(px), Math.round(py), 2, 2); if (rnd() < 0.08 + n * 0.02) x.fillRect(Math.round(px + (rnd() - 0.5) * 6), Math.round(py + (rnd() - 0.5) * 6), 2, 2); } }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return (crackTex[n] = t);
}
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
crackMesh.visible = false; crackMesh.userData.noShadowTag = 1; crackMesh.material.userData.detailed = 1; scene.add(crackMesh);
function updateCrack(target, frac) {
  if (!target || frac <= 0) { crackMesh.visible = false; return; }
  const st = Math.min(7, Math.floor(frac * 8)); crackMesh.material.map = crackStage(st); crackMesh.material.needsUpdate = crackMesh.userData.st !== st; crackMesh.userData.st = st;
  crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); crackMesh.visible = true;
}
