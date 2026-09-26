/* viewmodel.js: First person held items.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- VIEWMODEL ----------
let viewItem = null, swing = 0;
// ---------- textured held items ----------
// a cube wearing the block's own atlas tiles (top, bottom, sides), lit like any Lambert object
function blockCube(id, size) {
  const geo = new THREE.BoxGeometry(size, size, size), uv = geo.attributes.uv, tl = TIL[id] || [ATILE.snow, ATILE.snow, ATILE.snow];
  if (uv && uv.array) for (let f = 0; f < 6; f++) {
    const t = f === 2 ? tl[0] : f === 3 ? tl[2] : f === 4 ? (tl[3] || tl[1]) : tl[1];
    for (let k = 0; k < 4; k++) { const i = (f * 4 + k) * 2; uv.array[i] = t.u0 + uv.array[i] * t.s; uv.array[i + 1] = t.v0 + uv.array[i + 1] * t.sv; }
    uv.needsUpdate = true;
  }
  const bc = BCOL[id], col = bc ? new THREE.Color(bc[1][0], bc[1][1], bc[1][2]) : new THREE.Color(0xffffff);
  const mat = new THREE.MeshLambertMaterial({ map: atlasTex, color: col, alphaTest: KIND[id] === 2 || KIND[id] === 4 ? 0.5 : 0, transparent: id === WATER, opacity: id === WATER ? 0.8 : 1 });
  if (id === WATER) mat.color.setRGB(0.25, 0.5, 0.8);
  if (EMIT[id]) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = atlasTex; mat.emissiveIntensity = id === LAVA ? 0.9 : 0.35; }
  return new THREE.Mesh(geo, mat);
}
// grayscale detail maps for flat coloured tool parts: grain runs along a part's long axis, heads get stone or brushed metal
const DETAIL = {};
function detailMap(kind) {
  if (DETAIL[kind]) return DETAIL[kind];
  const D = GL.buildDetail(kind), tex = new THREE.DataTexture(D.data, D.size, D.size, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  return (DETAIL[kind] = tex);
}
function texturizeView(g) {
  g.traverse(m => {
    if (!m.isMesh || !m.material || m.material.map || Array.isArray(m.material)) return;
    const c = m.material.color; if (!c) return;
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), sat = mx > 0 ? (mx - mn) / mx : 0;
    const p = m.geometry && m.geometry.parameters, tall = p && p.height > p.width;
    let kind = "fine";
    if (sat < 0.14) kind = mx < 0.65 ? "stone" : "metal";
    else if (c.r > 0.7 && c.g > 0.5 && c.b < 0.4) kind = "metal";                                   // gold and brass
    else if (c.r >= c.g && c.g >= c.b && c.r - c.b > 0.12) kind = tall ? "grainV" : "grainH";       // wood tones
    m.material.map = detailMap(kind); m.material.needsUpdate = true;
  });
}

function buildViewItem() {
  if (viewItem) vScene.remove(viewItem);
  const g = new THREE.Group(); const it = hotbar[selSlot];
  if (it && isItem(it.id)) {
    const info = ITEMS[it.id], tool = info.tool, sp = info.special, tier = info.tier || 1;
    const wood = 0x6e4a25, dark = 0x4a3318, gold = 0xc9a227;
    // head + highlight colours follow the tool TIER: wood=tan, stone=grey, iron+=steel. No stray white boxes on wood/stone tools.
    const head = sp === "fire" ? 0xff7a2a : sp === "pierce" ? 0x76e4ff : tier >= 3 ? 0xd2d8e0 : tier === 2 ? 0x8c8c92 : 0xa9844e;
    const hi = sp === "fire" ? 0xffd24a : sp === "pierce" ? 0xd6f7ff : tier >= 3 ? 0xeef2f8 : tier === 2 ? 0xb4b4bc : 0xc7a467;
    if (info.food) {                                   // apple-style food
      g.add(box(0.22, 0.2, 0.22, 0xd83a2e)); const stem = box(0.03, 0.08, 0.03, wood); stem.position.y = 0.15; g.add(stem); const leaf = box(0.1, 0.04, 0.06, 0x49b04a); leaf.position.set(0.07, 0.15, 0); g.add(leaf);
      g.position.set(0.4, -0.4, -0.7); g.rotation.set(-0.2, 0.4, 0);
    } else if (tool === "sword") {
      const blade = box(0.085, 0.52, 0.028, head); blade.position.y = 0.36; g.add(blade);
      const edge = box(0.02, 0.5, 0.032, hi); edge.position.set(0.045, 0.36, 0); g.add(edge);            // cutting edge
      const tip = box(0.085, 0.1, 0.028, head); tip.position.set(0, 0.63, 0); tip.rotation.z = 0.785; g.add(tip);
      const gu = box(0.26, 0.055, 0.09, gold); gu.position.y = 0.08; g.add(gu);                          // crossguard
      const grip = box(0.05, 0.16, 0.05, dark); grip.position.y = -0.03; g.add(grip); const pom = box(0.08, 0.06, 0.08, gold); pom.position.y = -0.13; g.add(pom);
      g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.45, -0.32, 0.22);
    } else if (tool === "pick") {                       // wooden handle + a clear horizontal pick head with two angled points
      const stick = box(0.05, 0.52, 0.05, wood); stick.position.y = 0.02; g.add(stick);
      const bar = box(0.44, 0.08, 0.08, head); bar.position.y = 0.34; g.add(bar);
      const tL = box(0.13, 0.08, 0.08, head); tL.position.set(-0.26, 0.31, 0); tL.rotation.z = 0.55; g.add(tL);
      const tR = box(0.13, 0.08, 0.08, head); tR.position.set(0.26, 0.31, 0); tR.rotation.z = -0.55; g.add(tR);
      const collar = box(0.085, 0.09, 0.085, dark); collar.position.y = 0.31; g.add(collar);             // binding where head meets handle
      g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.45, -0.32, 0.22);
    } else if (tool === "axe") {
      const stick = box(0.05, 0.52, 0.05, wood); stick.position.y = 0.02; g.add(stick);
      const cheek = box(0.06, 0.26, 0.18, head); cheek.position.set(0.12, 0.34, 0); g.add(cheek);
      const edge = box(0.035, 0.32, 0.12, hi); edge.position.set(0.2, 0.34, 0); g.add(edge);
      const beard = box(0.05, 0.12, 0.13, head); beard.position.set(0.16, 0.2, 0); g.add(beard);
      const collar = box(0.085, 0.09, 0.085, dark); collar.position.set(0.04, 0.34, 0); g.add(collar);
      g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.45, -0.32, 0.22);
    } else if (tool === "hammer") {
      const headB = box(0.28, 0.22, 0.2, head); headB.position.y = 0.38; g.add(headB); const face = box(0.06, 0.24, 0.22, hi); face.position.set(0.15, 0.38, 0); g.add(face);
      const trim = box(0.3, 0.06, 0.22, gold); trim.position.y = 0.38; g.add(trim); const stick = box(0.05, 0.46, 0.05, wood); stick.position.y = 0.1; g.add(stick);
      g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.45, -0.32, 0.22);
    } else if (tool === "shield") {                     // a plank shield with an iron rim and boss
      const board = box(0.44, 0.52, 0.05, 0xa8793f); g.add(board);
      for (const yy of [-0.13, 0.13]) { const pl = box(0.45, 0.012, 0.055, 0x6e4a25); pl.position.y = yy; g.add(pl); }
      const rimT = box(0.48, 0.04, 0.07, 0x9aa0a8); rimT.position.y = 0.27; g.add(rimT); const rimB = rimT.clone(); rimB.position.y = -0.27; g.add(rimB);
      const rimL = box(0.04, 0.56, 0.07, 0x9aa0a8); rimL.position.x = -0.23; g.add(rimL); const rimR = rimL.clone(); rimR.position.x = 0.23; g.add(rimR);
      const boss = box(0.12, 0.12, 0.08, 0xc8ccd4); boss.position.z = 0.04; g.add(boss);
      g.userData.shield = 1; g.scale.setScalar(0.6); g.position.set(0.5, -0.42, -0.85); g.rotation.set(0.05, -0.5, 0.05);
    } else if (tool === "bow" && info.draw) {         // longbow held upright: limbs curve toward Thomas, the string and nocked arrow pull back with the draw
      const limb = 0x8a5a2e;
      const grip = box(0.05, 0.15, 0.065, 0x3a2414); g.add(grip);
      for (const sg of [1, -1]) {
        const l1 = box(0.042, 0.2, 0.05, limb); l1.position.set(0, sg * 0.16, 0.03); l1.rotation.x = sg * 0.35; g.add(l1);
        const l2 = box(0.036, 0.19, 0.044, limb); l2.position.set(0, sg * 0.33, 0.1); l2.rotation.x = sg * 0.75; g.add(l2);
        const tip = box(0.03, 0.05, 0.03, 0x2a1a10); tip.position.set(0, sg * 0.415, 0.16); g.add(tip);
      }
      const smat = new THREE.MeshBasicMaterial({ color: 0xe8e6de }), sgeo = new THREE.BoxGeometry(0.008, 1, 0.008);
      const up = new THREE.Mesh(sgeo, smat), dn = new THREE.Mesh(sgeo, smat); g.add(up); g.add(dn);
      const arrow = makeArrowMesh(); arrow.rotation.y = Math.PI; arrow.position.x = 0.03; g.add(arrow);
      g.userData.bow = { up, dn, arrow }; g.scale.setScalar(0.62);
      g.position.set(0.34, -0.34, -0.86); g.rotation.set(0, 0.1, 0.3);
    } else if (tool === "bow") {
      const col = sp === "slime" ? 0x49e06a : sp === "ice" ? 0x9fe8ff : 0xb5793a;
      const grip = box(0.06, 0.16, 0.06, dark); grip.position.y = 0.25; g.add(grip);
      const uL = box(0.05, 0.26, 0.05, col); uL.position.set(-0.02, 0.42, 0); uL.rotation.z = -0.45; g.add(uL); const uT = box(0.045, 0.16, 0.045, col); uT.position.set(-0.12, 0.6, 0); uT.rotation.z = -0.95; g.add(uT);
      const lL = box(0.05, 0.26, 0.05, col); lL.position.set(-0.02, 0.08, 0); lL.rotation.z = 0.45; g.add(lL); const lT = box(0.045, 0.16, 0.045, col); lT.position.set(-0.12, -0.1, 0); lT.rotation.z = 0.95; g.add(lT);
      const string = box(0.012, 0.66, 0.012, 0xf2f2f2); string.position.set(-0.16, 0.25, 0); g.add(string);
      g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.45, -0.05, 0.05);
    } else if (tool === "gun") {                        // voxel machine gun: receiver, barrel, magazine, grip, stock
      g.add(box(0.1, 0.13, 0.42, 0x2b2f36));
      const barrel = box(0.05, 0.05, 0.5, 0x14171b); barrel.position.set(0, 0.02, 0.44); g.add(barrel);
      const muzzle = box(0.075, 0.075, 0.08, 0x0c0d10); muzzle.position.set(0, 0.02, 0.7); g.add(muzzle);
      const mag = box(0.08, 0.24, 0.1, 0x3a4049); mag.position.set(0, -0.18, 0.06); mag.rotation.x = 0.18; g.add(mag);
      const grip = box(0.08, 0.17, 0.1, 0x20242a); grip.position.set(0, -0.13, -0.16); grip.rotation.x = 0.32; g.add(grip);
      const stock = box(0.07, 0.11, 0.2, 0x23272d); stock.position.set(0, -0.02, -0.28); g.add(stock);
      const sight = box(0.03, 0.05, 0.06, 0x14171b); sight.position.set(0, 0.11, -0.04); g.add(sight);
      g.position.set(0.32, -0.34, -0.62); g.rotation.set(0.02, -0.04, 0);
    } else if (it.id === I_STICK) {
      const stick = box(0.05, 0.5, 0.05, wood); stick.position.y = 0.1; g.add(stick); g.position.set(0.42, -0.42, -0.75); g.rotation.set(-0.4, -0.3, 0.22);
    } else {                                            // charm / orb item, never the pickaxe boxes
      g.add(box(0.16, 0.16, 0.16, sp === "fire" ? 0xff7a2a : 0x9bd0ff)); const rim = box(0.2, 0.05, 0.2, gold); g.add(rim); g.position.set(0.4, -0.42, -0.7); g.rotation.set(-0.3, 0.3, 0);
    }
  } else if (it) {
    if (it.id === FENCE || it.id === GATE) {              // a little fence section instead of a plank cube
      for (const px of [-0.08, 0.08]) { const p = box(0.045, 0.22, 0.045, 0xb08a4f); p.position.x = px; g.add(p); }
      for (const py of [-0.02, 0.06]) { const r = box(0.17, 0.035, 0.03, 0xa07a46); r.position.y = py; g.add(r); }
      g.position.set(0.44, -0.38, -0.75); g.rotation.set(-0.2, 0.5, 0);
    } else if (it.id === TORCH) {                              // torch: stick + glowing ember
      const stick = box(0.06, 0.34, 0.06, 0x6e4a25); g.add(stick); const ember = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshBasicMaterial({ color: 0xffd24a })); ember.position.y = 0.21; g.add(ember);
      g.position.set(0.42, -0.4, -0.7); g.rotation.set(-0.2, 0.2, 0.05);
    } else {
      const cube = blockCube(it.id, 0.32); g.add(cube); g.position.set(0.42, -0.4, -0.7); g.rotation.set(-0.4, 0.5, 0);
    }
  } else { const fist = box(0.18, 0.2, 0.2, 0xd9a06b); g.add(fist); g.position.set(0.4, -0.42, -0.7); g.rotation.set(-0.3, 0, 0); }
  texturizeView(g); viewItem = g; vScene.add(g);
}
function box(w, h, d, col) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); }
function updateBowView(dt) {
  const B = viewItem.userData.bow, p = bowPower(), k = Math.min(1, dt * 14);
  const nz = 0.16 + 0.24 * p, T = 0.415, dz = 0.16 - nz, L = Math.hypot(T, dz), ang = Math.atan2(dz, T);
  B.up.scale.y = L; B.up.position.set(0, T / 2, (0.16 + nz) / 2); B.up.rotation.x = ang;
  B.dn.scale.y = L; B.dn.position.set(0, -T / 2, (0.16 + nz) / 2); B.dn.rotation.x = -ang;
  B.arrow.visible = countItem(I_ARROW) > 0; B.arrow.position.z = nz - 0.31;
  const tremble = p >= 1 ? Math.sin(performance.now() * 0.05) * 0.004 : 0;
  const tx = 0.34 - 0.22 * p, ty = -0.34 + 0.1 * p + tremble, tz = -0.86 + 0.1 * p;
  viewItem.position.x += (tx - viewItem.position.x) * k; viewItem.position.y += (ty - viewItem.position.y) * k; viewItem.position.z += (tz - viewItem.position.z) * k;
  viewItem.rotation.z += ((0.3 - 0.18 * p) - viewItem.rotation.z) * k; viewItem.rotation.x = -Math.sin(swing * Math.PI) * 0.12;
  if (swing > 0) swing = Math.max(0, swing - dt * 4);
}
function updateViewItem(dt) { if (!viewItem) return; if (viewItem.userData.bow) { updateBowView(dt); return; }
  if (viewItem.userData.shield) {                        // raise the shield across the view while blocking
    const k = Math.min(1, dt * 12), up = blocking ? 1 : 0;
    viewItem.position.x += ((0.5 - 0.32 * up) - viewItem.position.x) * k; viewItem.position.y += ((-0.42 + 0.16 * up) - viewItem.position.y) * k; viewItem.position.z += ((-0.85 + 0.1 * up) - viewItem.position.z) * k;
    viewItem.rotation.y += ((-0.5 + 0.45 * up) - viewItem.rotation.y) * k; if (swing > 0) { swing = Math.max(0, swing - dt * 4); viewItem.position.z += Math.sin(swing * Math.PI) * 0.03; } return; } if (swing > 0) swing = Math.max(0, swing - dt * 4); const s = Math.sin(swing * Math.PI); const it = hotbar[selSlot]; if (it && isItem(it.id) && ITEMS[it.id].tool === "sword") { viewItem.rotation.x = -0.4 - s * 1.3; viewItem.rotation.z = 0.25 + s * 0.5; } else { viewItem.rotation.x = -0.4 - s * 0.7; viewItem.position.y = -0.4 - s * 0.08; } }
