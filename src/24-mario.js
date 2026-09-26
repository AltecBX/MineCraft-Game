/* mario.js: Character models and the Mushroom Kingdom.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- CHARACTER MODEL PIPELINE ----------
// The game ships with original placeholder figures only. If the project owner holds proper
// licenses for character models, dropping them into assets/models/ as <name>.glb (lowercase
// letters and digits only: mario.glb, pikachu.glb, kingbobomb.glb, bowserjr.glb) makes the
// game load them automatically: auto scaled to the character's height, ground shadow added,
// first animation clip played if present, and the placeholder figure hidden.
const MODEL_DIR = "assets/models/";
let gltfLoader = null; const modelMissing = {}; const charMixers = [];
function nameToFile(name) { return name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".glb"; }
function getGLTFLoader() { if (!gltfLoader && typeof THREE.GLTFLoader === "function") { try { gltfLoader = new THREE.GLTFLoader(); } catch (e) { gltfLoader = null; } } return gltfLoader; }
function applyCharModel(wrap, fb, name, targetH) {
  const loader = getGLTFLoader(); if (!loader || typeof loader.load !== "function") return;
  const file = nameToFile(name); if (modelMissing[file]) return;
  loader.load(MODEL_DIR + file, (gltf) => {
    try {
      const model = gltf.scene || (gltf.scenes && gltf.scenes[0]); if (!model) return;
      const bb = new THREE.Box3().setFromObject(model), sz = new THREE.Vector3(); bb.getSize(sz);
      const sc = (targetH || 1.7) / (sz.y || 1); model.scale.setScalar(sc); model.position.y = -bb.min.y * sc;
      fb.visible = false; wrap.add(model); blobShadow(wrap, 0.3 * (targetH || 1.7));
      if (gltf.animations && gltf.animations.length && typeof THREE.AnimationMixer === "function") { const mx = new THREE.AnimationMixer(model); mx.clipAction(gltf.animations[0]).play(); charMixers.push(mx); }
    } catch (e) {}
  }, undefined, () => { modelMissing[file] = 1; });   // missing file: keep the placeholder, never retry-spam
}
// ---------- MUSHROOM KINGDOM STAGE (placeholder figures until licensed models are supplied) ----------
let marioNPCs = [], marioFoes = [], marioCoins = [], cappy = null, marioQ = { coinsGot: 0, toad: false, stomps: 0, dk: false, bowser: false, hidden: false };
function clearMarioStage() { for (const n of marioNPCs) scene.remove(n.g); for (const f of marioFoes) scene.remove(f.g); for (const c of marioCoins) scene.remove(c.mesh); marioNPCs = []; marioFoes = []; marioCoins = []; if (cappy) { scene.remove(cappy); cappy = null; } }
// parameterized voxel toon figure: every guest character is built from the same original kit of boxes
// soft ground shadow disc: the single biggest cheap cue that makes figures sit IN the world
function blobShadow(g, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); return m;
}
// toon kit v2: every figure gets its own body plan, arms, gloves, and an expressive face
function buildToon(d) {
  const s = d.size || 1, g = new THREE.Group(), plan = d.plan || (d.ghost ? "ghost" : d.dress ? "gown" : "biped");
  const skin = d.skin != null ? d.skin : 0xe8b98a, glove = d.glove != null ? d.glove : 0xf2f2f2;
  const arms = [], legsA = [];
  const face = (hy, w) => {   // white eyes with pupils plus a small mouth
    for (const sx of [-1, 1]) { const e = box(0.1 * s, 0.13 * s, 0.04, 0xffffff); e.position.set(sx * (w || 0.11) * s, hy, 0.21 * s); g.add(e);
      const p = box(0.05 * s, 0.07 * s, 0.045, 0x14161c); p.position.set(sx * (w || 0.11) * s, hy - 0.01 * s, 0.225 * s); g.add(p); }
    if (!d.mustache && !d.mask) { const mo = box(0.1 * s, 0.035 * s, 0.04, d.mouth != null ? d.mouth : 0x7a3a2a); mo.position.set(0, hy - 0.14 * s, 0.21 * s); g.add(mo); }
  };
  const arm = (sx, len, col, ay) => { const a = box(0.11 * s, len * s, 0.11 * s, col); a.geometry.translate(0, -len * 0.5 * s, 0); a.position.set(sx, ay, 0); g.add(a);
    const h = box(0.14 * s, 0.12 * s, 0.14 * s, glove); h.position.set(0, -len * s, 0); a.add(h); arms.push(a); return a; };
  const leg = (sx, len, col) => { const l = box(0.15 * s, len * s, 0.15 * s, col); l.geometry.translate(0, -len * 0.5 * s, 0); l.position.set(sx, len * s, 0); g.add(l);
    const sh = box(0.18 * s, 0.09 * s, 0.24 * s, d.shoe != null ? d.shoe : 0x5a3a1e); sh.position.set(0, -len * s + 0.03 * s, 0.03 * s); l.add(sh); legsA.push(l); return l; };
  if (plan === "ghost") {
    const b1 = box(0.62 * s, 0.5 * s, 0.55 * s, d.body); b1.position.y = 0.72 * s; b1.material.transparent = true; b1.material.opacity = 0.8; g.add(b1);
    const b2 = box(0.5 * s, 0.24 * s, 0.44 * s, d.body); b2.position.y = 0.42 * s; b2.material.transparent = true; b2.material.opacity = 0.7; g.add(b2);
    for (const sx of [-1, 1]) { const st = box(0.14 * s, 0.12 * s, 0.14 * s, d.body); st.position.set(sx * 0.38 * s, 0.8 * s, 0); g.add(st); }
    if (d.tongue) { const t = box(0.12 * s, 0.16 * s, 0.08 * s, 0xff5d6a); t.position.set(0, 0.6 * s, 0.3 * s); t.rotation.x = 0.5; g.add(t); }
    const hy = 1.0 * s; const head2 = box(0.5 * s, 0.4 * s, 0.44 * s, d.body); head2.position.y = hy; head2.material.transparent = true; head2.material.opacity = 0.85; g.add(head2); face(hy + 0.05 * s);
  } else if (plan === "gown") {
    const sk1 = box(0.8 * s, 0.34 * s, 0.66 * s, d.body); sk1.position.y = 0.17 * s; g.add(sk1);
    const sk2 = box(0.6 * s, 0.3 * s, 0.5 * s, d.body); sk2.position.y = 0.48 * s; g.add(sk2);
    const to = box(0.38 * s, 0.3 * s, 0.3 * s, d.body); to.position.y = 0.78 * s; g.add(to);
    for (const sx of [-1, 1]) { const pf = box(0.16 * s, 0.14 * s, 0.16 * s, d.body); pf.position.set(sx * 0.26 * s, 0.88 * s, 0); g.add(pf); arm(sx * 0.28 * s, 0.3, skin, 0.86 * s); }
    const head = box(0.42 * s, 0.38 * s, 0.38 * s, skin); head.position.y = 1.12 * s; g.add(head); face(1.17 * s);
    if (d.hair) { const h1 = box(0.46 * s, 0.3 * s, 0.2 * s, d.hair); h1.position.set(0, 1.14 * s, -0.16 * s); g.add(h1); const h2 = box(0.44 * s, 0.14 * s, 0.4 * s, d.hair); h2.position.y = 1.32 * s; g.add(h2); }
  } else if (plan === "round") {                       // stubby mushroom-shaped walker: big cranky brows, feet only
    const bod = box(0.66 * s, 0.6 * s, 0.6 * s, d.body); bod.position.y = 0.5 * s; g.add(bod);
    const bot = box(0.5 * s, 0.18 * s, 0.44 * s, d.belly != null ? d.belly : 0xe8d0a8); bot.position.y = 0.16 * s; g.add(bot);
    for (const sx of [-1, 1]) { const f = box(0.2 * s, 0.14 * s, 0.26 * s, 0x3a2a1a); f.position.set(sx * 0.18 * s, 0.07 * s, 0.06 * s); g.add(f); legsA.push(f); }
    face(0.62 * s, 0.15);
    for (const sx of [-1, 1]) { const br = box(0.16 * s, 0.05 * s, 0.05, 0x14161c); br.position.set(sx * 0.16 * s, 0.78 * s, 0.28 * s); br.rotation.z = sx * -0.4; g.add(br); }
    legsA.push(legsA[0], legsA[1]);                    // pad to 4 so the shared limb animator works
  } else if (plan === "turtle") {
    leg(-0.14 * s, 0.24, d.skin2 || 0xf2d24c); leg(0.14 * s, 0.24, d.skin2 || 0xf2d24c);
    const bod = box(0.44 * s, 0.36 * s, 0.3 * s, d.skin2 || 0xf2d24c); bod.position.y = 0.42 * s; g.add(bod);
    const sh = box(0.5 * s, 0.4 * s, 0.3 * s, d.shell); sh.position.set(0, 0.48 * s, -0.2 * s); g.add(sh);
    const rim = box(0.56 * s, 0.12 * s, 0.36 * s, 0xf2ead0); rim.position.set(0, 0.32 * s, -0.2 * s); g.add(rim);
    arm(-0.26 * s, 0.24, d.skin2 || 0xf2d24c, 0.52 * s); arm(0.26 * s, 0.24, d.skin2 || 0xf2d24c, 0.52 * s);
    const head = box(0.36 * s, 0.32 * s, 0.34 * s, d.skin2 || 0xf2d24c); head.position.set(0, 0.82 * s, 0.08 * s); g.add(head); face(0.88 * s, 0.09);
  } else if (plan === "ape") {
    leg(-0.16 * s, 0.2, d.body); leg(0.16 * s, 0.2, d.body);
    const bod = box(0.66 * s, 0.52 * s, 0.44 * s, d.body); bod.position.y = 0.56 * s; g.add(bod);
    const chest = box(0.44 * s, 0.34 * s, 0.1 * s, skin); chest.position.set(0, 0.52 * s, 0.2 * s); g.add(chest);
    arm(-0.42 * s, 0.52, d.body, 0.76 * s); arm(0.42 * s, 0.52, d.body, 0.76 * s);
    const head = box(0.44 * s, 0.36 * s, 0.4 * s, d.body); head.position.y = 1.0 * s; g.add(head);
    const jaw = box(0.34 * s, 0.16 * s, 0.14 * s, skin); jaw.position.set(0, 0.9 * s, 0.18 * s); g.add(jaw); face(1.08 * s, 0.1);
  } else {                                             // biped: stubby legs, overalls, swinging arms, big nose option
    const pants = d.pants != null ? d.pants : 0x2a3f8f;
    leg(-0.13 * s, 0.28, pants); leg(0.13 * s, 0.28, pants);
    const bod = box(0.5 * s, 0.4 * s, 0.34 * s, d.body); bod.position.y = 0.76 * s; g.add(bod);
    if (d.overalls) { const bib = box(0.34 * s, 0.26 * s, 0.05, pants); bib.position.set(0, 0.74 * s, 0.18 * s); g.add(bib);
      for (const sx of [-1, 1]) { const bt = box(0.06 * s, 0.06 * s, 0.05, 0xffe14d); bt.position.set(sx * 0.12 * s, 0.86 * s, 0.2 * s); g.add(bt);
        const str = box(0.08 * s, 0.2 * s, 0.05, pants); str.position.set(sx * 0.12 * s, 0.94 * s, 0.16 * s); g.add(str); } }
    arm(-0.31 * s, 0.34, d.sleeve != null ? d.sleeve : d.body, 0.92 * s); arm(0.31 * s, 0.34, d.sleeve != null ? d.sleeve : d.body, 0.92 * s);
    const head = box(0.46 * s, 0.4 * s, 0.42 * s, skin); head.position.y = 1.18 * s; g.add(head); face(1.24 * s);
    if (d.nose) { const n = box(0.14 * s, 0.12 * s, 0.14 * s, d.nose === 1 ? skin : d.nose); n.position.set(0, 1.18 * s, 0.26 * s); g.add(n); }
  }
  const hy2 = plan === "gown" ? 1.32 * s : plan === "ghost" ? 1.2 * s : 1.38 * s;
  if (d.mustache) { const m = box(0.3 * s, 0.07 * s, 0.05, 0x2b2018); m.position.set(0, (plan === "biped" ? 1.1 : 0.94) * s, 0.26 * s); g.add(m); }
  if (d.beard) { const b = box(0.32 * s, 0.2 * s, 0.08, 0xe8e8e8); b.position.set(0, (plan === "biped" ? 1.02 : 0.85) * s, 0.24 * s); g.add(b); }
  if (d.snout) { const sn = box(0.24 * s, 0.18 * s, 0.26 * s, d.snout === 1 ? skin : d.snout); sn.position.set(0, (plan === "biped" ? 1.14 : 0.98) * s, 0.32 * s); g.add(sn); }
  if (d.mask) { const mk = box(0.36 * s, 0.32 * s, 0.04, 0xf2f2f2); mk.position.set(0, (plan === "biped" ? 1.2 : 1.02) * s, 0.24 * s); g.add(mk);
    for (const sx of [-1, 1]) { const hole = box(0.07 * s, 0.1 * s, 0.045, 0x14161c); hole.position.set(sx * 0.09 * s, (plan === "biped" ? 1.22 : 1.04) * s, 0.25 * s); g.add(hole); } }
  if (d.glasses) { const gl = box(0.38 * s, 0.09 * s, 0.04, d.glasses === 1 ? 0x222831 : d.glasses); gl.position.set(0, (plan === "biped" ? 1.26 : 1.06) * s, 0.25 * s); g.add(gl); }
  if (d.cap) { const c1 = box(0.5 * s, 0.15 * s, 0.46 * s, d.cap); c1.position.y = hy2; g.add(c1); const brim = box(0.34 * s, 0.05 * s, 0.22 * s, d.cap); brim.position.set(0, hy2 - 0.07 * s, 0.32 * s); g.add(brim);
    const em = box(0.12 * s, 0.1 * s, 0.03, 0xffffff); em.position.set(0, hy2 + 0.02 * s, 0.235 * s); g.add(em); }
  if (d.mushcap) { const mc = box(0.68 * s, 0.3 * s, 0.64 * s, 0xffffff); mc.position.y = hy2; g.add(mc);
    for (const [dx, dz] of [[0, 0.24], [-0.22, -0.1], [0.22, -0.1], [0, -0.26]]) { const dot = box(0.18 * s, 0.08 * s, 0.18 * s, d.mushcap); dot.position.set(dx * s, hy2 + 0.13 * s, dz * s); g.add(dot); } }
  if (d.crown) { const cr = box(0.26 * s, 0.12 * s, 0.26 * s, 0xf2c94c); cr.position.y = hy2 + 0.04 * s; g.add(cr); const jw = box(0.08 * s, 0.08 * s, 0.08 * s, 0xff5d8f); jw.position.y = hy2 + 0.12 * s; g.add(jw); }
  if (d.hairband) { const hb = box(0.48 * s, 0.09 * s, 0.44 * s, d.hairband); hb.position.y = hy2 - 0.05 * s; g.add(hb); }
  if (d.shell) { const sh = box(0.5 * s, 0.42 * s, 0.26 * s, d.shell); sh.position.set(0, 0.7 * s, -0.3 * s); g.add(sh);
    for (const [sx, sy] of [[-0.14, 0.9], [0.14, 0.9], [0, 0.72], [-0.14, 0.54], [0.14, 0.54]]) { const sp = box(0.09 * s, 0.13 * s, 0.09 * s, 0xf2ead0); sp.position.set(sx * s, sy * s, -0.32 * s); g.add(sp); } }
  if (d.horns) for (const sx of [-1, 1]) { const h = box(0.1 * s, 0.2 * s, 0.1 * s, 0xf2ead0); h.position.set(sx * 0.2 * s, hy2 + 0.08 * s, 0); h.rotation.z = sx * -0.3; g.add(h); }
  if (d.tail) { const t = box(0.16 * s, 0.14 * s, 0.4 * s, d.tail === 1 ? d.body : d.tail); t.position.set(0, 0.4 * s, -0.44 * s); g.add(t); }
  if (d.tie) { const t = box(0.16 * s, 0.22 * s, 0.04, d.tie); t.position.set(0, 0.56 * s, 0.24 * s); g.add(t); }
  if (d.fuse) { const f = box(0.06 * s, 0.18 * s, 0.06 * s, 0xf2f2f2); f.position.y = hy2 + 0.1 * s; g.add(f); }
  while (legsA.length < 4) legsA.push(arms[legsA.length - 2] || legsA[0] || box(0.01, 0.01, 0.01, 0x000000));
  g.userData.legs = [legsA[0], legsA[1], arms[0] || legsA[2], arms[1] || legsA[3]];   // shared limb animator swings legs and arms
  blobShadow(g, 0.42 * s);
  return g;
}
function toonTalk(pitch) { blip(pitch, 0.09, "square", 0.1, pitch * 1.3); setTimeout(() => blip(pitch * 1.25, 0.11, "square", 0.09, pitch * 1.5), 90); }
function marioNPC(name, def, x, z, line, pitch, quest) {
  const fb = buildToon(def), g = new THREE.Group(); g.add(fb); g.userData = fb.userData;
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  const tag = makeTag(name); tag.position.y = (def.size || 1) * 1.7 + 0.3; g.add(tag);
  applyCharModel(g, fb, name, (def.size || 1) * 1.7);
  marioNPCs.push({ name, g, tag, line, pitch: pitch || 440, quest, t: Math.random() * 6 });
}
function marioFoe(name, def, x, z, hp, kind) {
  const fb = buildToon(def), g = new THREE.Group(); g.add(fb); g.userData = fb.userData;
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  const tag = makeTag(name); tag.position.y = (def.size || 1) * 1.7 + 0.3; g.add(tag);
  applyCharModel(g, fb, name, (def.size || 1) * 1.7);
  marioFoes.push({ name, g, tag, hp, max: hp, kind: kind || "patrol", dir: Math.random() * 6.28, t: Math.random() * 6, touch: 0, shoot: 1.5 + Math.random() * 2, size: def.size || 1 });
}
function dropMarioCoin(x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.07), new THREE.MeshBasicMaterial({ color: 0xffd83d }));
  m.position.set(x, y, z); scene.add(m); marioCoins.push({ mesh: m, t: Math.random() * 6 });
}
function buildMarioStage() {
  clearMarioStage(); ensureGen(0, 0, 12); ensureGen(0, 40, 10); ensureGen(-24, 10, 8); ensureGen(26, 8, 8); ensureGen(-26, -20, 8); ensureGen(30, -16, 8);
  // plaza: brick ring + flag pole
  const py = surfaceY(0, 0);
  for (let a = 0; a < 20; a++) { const ax = Math.round(Math.cos(a / 20 * 6.28) * 6), az = Math.round(Math.sin(a / 20 * 6.28) * 6); setRaw(ax, surfaceY(ax, az) - 1, az, BRICK); markDirty(ax, az); }
  for (let y = 1; y <= 6; y++) setRaw(3, py + y - 1, 3, y === 6 ? CRYSTAL : COBBLE); markDirty(3, 3);
  // friendly cast around the plaza
  marioNPC("Mario", { body: 0xd8342c, pants: 0x2a3f8f, overalls: 1, cap: 0xd8342c, mustache: 1, nose: 1, size: 0.95 }, 1, -3, "Welcome! Ready for a super adventure? Bowser is up at the castle.", 520);
  marioNPC("Luigi", { body: 0x2e9e46, pants: 0x2a3f8f, overalls: 1, cap: 0x2e9e46, mustache: 1, nose: 1, size: 1.08 }, -2, -3, "S-spooky cellar under the castle... I will guard the plaza. You go ahead!", 620);
  marioNPC("Peach", { body: 0xffa6c9, plan: "gown", crown: 1, hair: 0xf2d24c, skin: 0xf2d4b8 }, 0, -5, "Bowser took over the castle courtyard. Please send him packing!", 700, "peach");
  marioNPC("Toad", { body: 0x4a6ad8, mushcap: 0xd8342c, size: 0.75 }, 3, -2, "Coins keep the Kingdom running! Grab 15 and I will reward you.", 820, "toad");
  marioNPC("Toadette", { body: 0xff8ad6, mushcap: 0xff5d8f, size: 0.72 }, 4, 0, "The healing house is always open for heroes!", 860);
  marioNPC("Daisy", { body: 0xf2a03d, plan: "gown", crown: 1, hair: 0x8a5a2e, skin: 0xf2d4b8 }, -4, 0, "Hi! The flower fields are gorgeous today!", 680);
  marioNPC("Pauline", { body: 0xc0392b, plan: "gown", hairband: 0x6a2a8f, hair: 0x3a2a20, skin: 0xe8c49a }, -4, 3, "The city misses a hero like you.", 560);
  marioNPC("Toadsworth", { body: 0x8a6a3f, mushcap: 0xc9b08a, mustache: 1, size: 0.8 }, 2, 4, "Do mind the lava moat by the castle, young master!", 400);
  marioNPC("Birdo", { body: 0xff8ad6, snout: 0xffb6de, hairband: 0xff5d8f, tail: 1 }, 5, 2, "Mwah! Take an egg for good luck!", 750);
  marioNPC("Yoshi", { body: 0x49c04a, snout: 0x9fe89f, pants: 0x49c04a, shoe: 0xf2683c, shell: 0xd8342c, tail: 1, size: 0.95 }, -1, 5, "Mlem! Yoshi smelled berries growing by the warp pipes.", 900);
  // DK jungle corner
  marioNPC("Donkey Kong", { body: 0x6a4a2e, plan: "ape", skin: 0xc9a06a, tie: 0xd8342c, size: 1.35 }, -24, 10, "Shy Guys keep raiding my banana pile! Stomp 5 of them for me.", 220, "dk");
  marioNPC("Diddy Kong", { body: 0x6a4a2e, plan: "ape", skin: 0xc9a06a, cap: 0xd8342c, size: 0.7 }, -22, 12, "Watch me backflip! Whoo!", 980);
  marioNPC("Cranky Kong", { body: 0x5a4028, plan: "ape", skin: 0xc9a06a, beard: 1, size: 1.1 }, -26, 12, "In my day we buried treasure right under the plaza's south bricks... hint hint.", 300, "cranky");
  // Rosalina's star rise
  const ry = surfaceY(0, -26); for (let y = 0; y < 3; y++) setRaw(0, ry + y, -26, y === 2 ? CRYSTAL : BRICK); markDirty(0, -26);
  marioNPC("Rosalina", { body: 0x7fd6d0, dress: 1, crown: 1, skin: 0xf2e2c8, size: 1.1 }, 1, -27, "The stars watch over your journey, little hero.", 640);
  // construction zone pair
  marioNPC("Foreman Spike", { body: 0x4a5a9a, legs: 0x35406a, cap: 0x8a4fd0, mustache: 1 }, 30, -16, "These pipes will not fix themselves. Scram, or grab a wrench.", 340);
  marioNPC("Fawful", { body: 0x2e9e46, glasses: 0xff4d4d, size: 0.8 }, 32, -14, "My plan bubbles like a soup of winning! You cannot taste it!", 1050);
  // Cappy floats near Mario
  const cfb = buildToon({ body: 0xf2f2f2, ghost: 1, size: 0.45 }); cappy = new THREE.Group(); cappy.add(cfb);
  const ct = makeTag("Cappy"); ct.position.y = 1.2; cappy.add(ct); applyCharModel(cappy, cfb, "Cappy", 0.8);
  cappy.position.set(2.2, surfaceY(1, -3) + 1.6, -2.5); scene.add(cappy);
  // villains: castle at (0,40) with lava moat + Bowser and court
  const cy = surfaceY(0, 40);
  for (let dx = -6; dx <= 6; dx++) for (const dz of [-6, 6]) { for (let y = 0; y < 3; y++) setRaw(dx, cy + y, 40 + dz, BRICK); markDirty(dx, 40 + dz); }
  for (const dx of [-6, 6]) for (let dz = -6; dz <= 6; dz++) { for (let y = 0; y < 3; y++) setRaw(dx, cy + y, 40 + dz, BRICK); markDirty(dx, 40 + dz); }
  for (let dx = -8; dx <= 8; dx++) { setRaw(dx, cy - 1, 32, LAVA); setRaw(dx, cy - 1, 48, LAVA); markDirty(dx, 32); markDirty(dx, 48); }
  setRaw(0, cy, 34, PLANKS); setRaw(0, cy, 33, PLANKS);   // drawbridge over the moat
  marioFoe("Bowser", { body: 0xf2a03d, skin: 0xf2c060, shell: 0x2e9e46, horns: 1, tail: 1, size: 1.9, glasses: 0xc0392b }, 0, 42, 140, "boss");
  marioFoe("Bowser Jr.", { body: 0xf2c060, shell: 0x9fe89f, horns: 1, size: 0.9 }, 2, 44, 36, "chase");
  marioFoe("Kamek", { body: 0x3a5ad8, glasses: 1, cap: 0x3a5ad8, size: 0.95 }, -3, 44, 24, "rooted");
  const koop = [["Larry", 0x7fd0f2], ["Morton", 0x8a6a3f], ["Wendy", 0xff8ad6], ["Iggy", 0x9fe86b], ["Roy", 0xc06ad8], ["Lemmy", 0xf2d24c], ["Ludwig", 0x6a8af2]];
  koop.forEach((k, i) => { const a = i / 7 * 6.28; marioFoe(k[0], { body: k[1], shell: k[1], horns: 1, size: 0.8 }, Math.round(Math.cos(a) * 10), 40 + Math.round(Math.sin(a) * 10), 26, "patrol"); });
  // rivals, ghosts, minibosses
  marioFoe("Wario", { body: 0xf2d24c, pants: 0x8a4fd0, overalls: 1, cap: 0xf2d24c, mustache: 1, nose: 1, size: 1.1 }, 12, 20, 30, "chase");
  marioFoe("Waluigi", { body: 0x8a4fd0, pants: 0x2b2b3f, overalls: 1, cap: 0x8a4fd0, mustache: 1, nose: 1, size: 1.18 }, 14, 22, 30, "chase");
  const boy = surfaceY(18, 46); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { setRaw(18 + dx, boy + 3, 46 + dz, COBBLE); markDirty(18 + dx, 46 + dz); }   // dark cellar roof
  marioFoe("King Boo", { body: 0xf2f2f2, plan: "ghost", tongue: 1, crown: 1, size: 1.3 }, 18, 46, 34, "ghost");
  marioFoe("Boo", { body: 0xf2f2f2, plan: "ghost", tongue: 1, size: 0.7 }, 16, 44, 12, "ghost");
  marioFoe("Boo", { body: 0xf2f2f2, plan: "ghost", tongue: 1, size: 0.7 }, 20, 48, 12, "ghost");
  marioFoe("Petey Piranha", { body: 0x49c04a, snout: 0xff5d5d, size: 1.5 }, 26, 8, 40, "rooted");
  marioFoe("King Bob-omb", { body: 0x2b2b33, plan: "round", belly: 0x3a3a44, crown: 1, fuse: 1, size: 1.4 }, -26, -20, 44, "chase");
  marioFoe("Nabbit", { body: 0x8a4fd0, mask: 1, size: 0.85 }, 8, -8, 16, "thief");
  for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = 10 + Math.random() * 14; marioFoe("Shy Guy", { body: 0xd8342c, mask: 1, size: 0.7 }, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 10, "patrol"); }
  for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 16; marioFoe("Goomba", { body: 0x9a5f32, plan: "round", size: 0.65 }, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 6, "patrol"); }
  for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = 12 + Math.random() * 14; marioFoe("Koopa Troopa", { plan: "turtle", shell: 0x2e9e46, skin2: 0xf2d24c, size: 0.75 }, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 8, "patrol"); }
  // coin trails: plaza ring, path to castle, DK corner
  for (let a = 0; a < 12; a++) { const ax = Math.cos(a / 12 * 6.28) * 4, az = Math.sin(a / 12 * 6.28) * 4; dropMarioCoin(ax + 0.5, surfaceY(ax, az) + 0.8, az + 0.5); }
  for (let z = 8; z <= 30; z += 2) dropMarioCoin(0.5, surfaceY(0, z) + 0.8, z + 0.5);
  for (let x = -8; x >= -20; x -= 2) dropMarioCoin(x + 0.5, surfaceY(x, 10) + 0.8, 10 + 0.5);
  // Cranky's hidden treasure under the plaza's south bricks
  if (!marioQ.hidden) { const hx = 0, hz = 6, hy = surfaceY(hx, hz) - 3; setRaw(hx, hy, hz, CHEST); const k = chestKey(hx, hy, hz); if (!chestStore.has(k)) chestStore.set(k, [{ id: CRYSTAL, count: 6 }, { id: I_APPLE, count: 4 }, { id: BRICK, count: 12 }, null, null, null, null, null, null]); }
  setQuest(marioQ.bowser ? "The Kingdom is at peace. Explore, pop Question Blocks, and collect coins!" : "Talk to Peach in the plaza, then cross the drawbridge north and defeat Bowser!");
}
function marioInteract() {
  if (DIM !== "mario") return false;
  let np = null, nd = 3.4; for (const n of marioNPCs) { const d = n.g.position.distanceTo(player.pos); if (d < nd) { nd = d; np = n; } }
  if (!np) return false;
  toonTalk(np.pitch);
  if (np.quest === "toad") { if (!marioQ.toad && marioQ.coinsGot >= 15) { marioQ.toad = true; addCoins(30); addItem(CRYSTAL, 3); showBanner("Toad's reward: +30 coins and crystals!"); SFX.treasure(); } else toast("Toad: " + Math.min(15, marioQ.coinsGot) + "/15 coins collected here." + (marioQ.toad ? " Thanks again, hero!" : "")); }
  else if (np.quest === "dk") { if (!marioQ.dk && marioQ.stomps >= 5) { marioQ.dk = true; addCoins(25); addXP(60); showBanner("Donkey Kong's reward: +25 coins!"); SFX.treasure(); } else toast("Donkey Kong: " + Math.min(5, marioQ.stomps) + "/5 Shy Guys stomped." + (marioQ.dk ? " Bananas are safe!" : "")); }
  else if (np.quest === "peach" && marioQ.bowser) toast("Peach: You saved the Kingdom! Visit any time, hero.");
  else if (np.quest === "cranky" && !marioQ.hidden) { toast(np.line); setObjective(0.5, surfaceY(0, 6), 6.5); }
  else toast(np.name + ": " + np.line);
  return true;
}
function qblockPop(x, y, z) {
  const roll = Math.random();
  SFX.coin(); hitSpark(new THREE.Vector3(x + 0.5, y + 0.8, z + 0.5), 0xffd83d);
  if (roll < 0.5) { const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) dropMarioCoin(x + 0.5 + (Math.random() - .5), y + 1.2 + Math.random(), z + 0.5 + (Math.random() - .5)); toast("Coins burst out!"); }
  else if (roll < 0.68) { givePowerup("star"); }
  else if (roll < 0.86) { givePowerup("mega"); player.hp = Math.min(player.maxHp, player.hp + 6); updateVitals(); }
  else { addItem(I_APPLE, 1); toast("A snack popped out!"); }
}
function updateMario(dt) {
  if (DIM !== "mario") return;
  // ground pound landing: shockwave that flattens nearby foes
  if (player._pound && player.onGround) {
    player._pound = false; addShake(0.35); SFX.boom(); spawnTelegraph(player.pos.x, player.pos.z, 3, 0.35, 0xffd27a, true);
    for (const f of marioFoes) { if (f.kind === "boss") continue; const d2 = Math.hypot(f.g.position.x - player.pos.x, f.g.position.z - player.pos.z); if (d2 < 3.2) { f.hp -= 14; hitSpark(f.g.position, 0xffd83d); } }
  }
  // NPC idle bob + Cappy orbit; name tags show only when Thomas is close enough to interact
  for (const n of marioNPCs) { n.t += dt; n.g.position.y = surfaceY(n.g.position.x, n.g.position.z) + Math.abs(Math.sin(n.t * 2)) * 0.06; const dx = player.pos.x - n.g.position.x, dz = player.pos.z - n.g.position.z; const d2 = dx * dx + dz * dz; if (d2 < 64) n.g.rotation.y = Math.atan2(dx, dz); if (n.tag) n.tag.visible = d2 < 90; }
  if (cappy) { const m = marioNPCs[0]; if (m) { cappy.position.x = m.g.position.x + Math.cos(performance.now() * 0.0015) * 1.3; cappy.position.z = m.g.position.z + Math.sin(performance.now() * 0.0015) * 1.3; cappy.position.y = m.g.position.y + 1.5 + Math.sin(performance.now() * 0.003) * 0.15; cappy.rotation.y += dt * 3; } }
  // coins spin, drift toward Thomas when close, and collect
  for (let i = marioCoins.length - 1; i >= 0; i--) { const c = marioCoins[i]; c.t += dt; c.mesh.rotation.y += dt * 5; c.mesh.position.y += Math.sin(c.t * 4) * 0.003;
    const cd = c.mesh.position.distanceTo(player.pos);
    if (cd < 2.6 && cd > 1.1) { c.mesh.position.x += (player.pos.x - c.mesh.position.x) / cd * 5 * dt; c.mesh.position.z += (player.pos.z - c.mesh.position.z) / cd * 5 * dt; c.mesh.position.y += (player.pos.y + 1 - c.mesh.position.y) / cd * 4 * dt; }
    if (cd < 1.3) { scene.remove(c.mesh); marioCoins.splice(i, 1); addCoins(1); marioQ.coinsGot++; SFX.coin(); } }
  // foes
  const star = powerActive("star");
  for (let i = marioFoes.length - 1; i >= 0; i--) {
    const f = marioFoes[i]; f.t += dt; f.touch = Math.max(0, f.touch - dt);
    const dx = player.pos.x - f.g.position.x, dz = player.pos.z - f.g.position.z, d = Math.hypot(dx, dz) || 1;
    if (f.tag) f.tag.visible = d < 10;                 // names only when close, not floating across the whole map
    if (f.kind === "ghost") { f.g.position.y = surfaceY(f.g.position.x, f.g.position.z) + 0.6 + Math.sin(f.t * 2) * 0.3; if (d < 9) { f.g.position.x += dx / d * 1.2 * dt; f.g.position.z += dz / d * 1.2 * dt; f.g.rotation.y = Math.atan2(dx, dz); } }
    else if (f.kind === "thief") { if (d < 9) { f.dir = Math.atan2(f.g.position.x - player.pos.x, f.g.position.z - player.pos.z); f.g.position.x += Math.sin(f.dir) * 4.2 * dt; f.g.position.z += Math.cos(f.dir) * 4.2 * dt; f.g.rotation.y = f.dir; } else if (Math.random() < 0.01) f.dir += (Math.random() - .5) * 2; fallToGround(f, dt);
      if (d < 1.2 && coins > 0 && f.touch <= 0) { const steal = Math.min(coins, 4); coins -= steal; updateCoinUI(); f.steal = (f.steal || 0) + steal; f.touch = 2; toast("Nabbit swiped " + steal + " coins! Catch him!"); SFX.squeak(); } }
    else if (f.kind === "rooted") { f.g.rotation.y = Math.atan2(dx, dz); f.shoot -= dt; if (d < 14 && f.shoot <= 0) { f.shoot = 2.6; spawnProjectile({ x: f.g.position.x, y: f.g.position.y, z: f.g.position.z }, { x: player.pos.x, y: player.pos.y, z: player.pos.z }); } }
    else if (f.kind === "boss") {
      f.g.rotation.y = Math.atan2(dx, dz);
      if (d < 16) { if (d > 3.2) { f.g.position.x += dx / d * 1.6 * dt; f.g.position.z += dz / d * 1.6 * dt; } fallToGround(f, dt);
        f.shoot -= dt; if (f.shoot <= 0) { f.shoot = f.hp < f.max * 0.4 ? 1.4 : 2.2; spawnProjectile({ x: f.g.position.x, y: f.g.position.y, z: f.g.position.z }, { x: player.pos.x, y: player.pos.y, z: player.pos.z }); SFX.growl(); }
        if (d < 2.6 && f.touch <= 0) { damage(6); addShake(0.4); f.touch = 1.2; } }
    }
    else { if (f.kind === "chase" && d < 10) { f.g.position.x += dx / d * 2.2 * dt; f.g.position.z += dz / d * 2.2 * dt; f.g.rotation.y = Math.atan2(dx, dz); }
      else { if (Math.random() < 0.012) f.dir += (Math.random() - .5) * 1.6; f.g.position.x += Math.sin(f.dir) * 1.1 * dt; f.g.position.z += Math.cos(f.dir) * 1.1 * dt; f.g.rotation.y = f.dir; }
      fallToGround(f, dt);
      f.walkT = (f.walkT || 0) + dt * 8; const L = f.g.userData.legs; if (L) { const sw = Math.sin(f.walkT) * 0.5; L[0].rotation.x = sw; L[1].rotation.x = -sw; if (L[2]) L[2].rotation.x = -sw * 0.7; if (L[3]) L[3].rotation.x = sw * 0.7; } }
    // stomp: falling onto a foe squashes it; star power defeats on contact
    const foeTop = f.g.position.y + f.size * 1.2;
    if (d < 1.1 && player.vel.y < -3 && player.pos.y > foeTop - 0.4) {
      if (f.kind === "thief") { addCoins((f.steal || 0) + 6); toast("Caught Nabbit! Coins recovered plus a bonus."); SFX.treasure(); player.vel.y = 8.5; scene.remove(f.g); marioFoes.splice(i, 1); continue; }
      f.hp -= 12; player.vel.y = 8.5; SFX.stomp(); addShake(0.08); hitSpark(f.g.position, 0xffd83d); if (f.name === "Shy Guy") marioQ.stomps++;
    }
    else if (d < 1.1 && star && f.touch <= 0) { f.hp -= 20; f.touch = 0.4; hitSpark(f.g.position, 0xfff14a); SFX.zap(); }
    else if (d < 1.1 && f.kind !== "boss" && f.kind !== "thief" && f.touch <= 0) { damage(f.kind === "chase" ? 4 : 2); f.touch = 1.1; const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.5); }
    if (f.hp <= 0) {
      scene.remove(f.g); marioFoes.splice(i, 1);
      for (let c = 0; c < (f.kind === "boss" ? 12 : 3); c++) dropMarioCoin(f.g.position.x + (Math.random() - .5) * 2, f.g.position.y + 1 + Math.random(), f.g.position.z + (Math.random() - .5) * 2);
      addXP(f.kind === "boss" ? 200 : f.max > 25 ? 30 : 10); SFX.victory();
      if (f.kind === "boss") { marioQ.bowser = true; addCoins(100); showBanner("BOWSER IS DEFEATED! The Kingdom is saved!"); achieve("bowser", "Kingdom Hero"); setQuest("The Kingdom is at peace. Explore, pop Question Blocks, and collect coins!"); }
      else if (f.max > 25) showBanner(f.name + " is defeated!");
    }
  }
}
