/* realm.js: The Creature Battle Realm.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ============================================================================
// THE CREATURE BATTLE REALM: original creatures, turn-based battles, taming.
// (Original designs/names inspired by classic creature-battler roles, no
//  trademarked characters, so the public game stays legally clear.)
// ============================================================================
const MOVES = {
  shock: { name: "Electric Shock", type: "electric", power: 18, status: "paralyze" }, fireblast: { name: "Fire Blast", type: "fire", power: 22, status: "burn" },
  watersurge: { name: "Water Surge", type: "water", power: 20 }, shadowball: { name: "Shadow Ball", type: "ghost", power: 20 },
  dragonstrike: { name: "Dragon Strike", type: "dragon", power: 24 }, psychicwave: { name: "Psychic Wave", type: "psychic", power: 20 },
  steelslam: { name: "Steel Slam", type: "steel", power: 18 }, darkbite: { name: "Dark Bite", type: "dark", power: 18 },
  iceslash: { name: "Ice Slash", type: "water", power: 18 }, healinglight: { name: "Healing Light", type: "fairy", power: 0, heal: 26 },
  quickattack: { name: "Quick Attack", type: "normal", power: 12 }, thunderdash: { name: "Thunder Dash", type: "electric", power: 22, status: "paralyze" },
  lavaburst: { name: "Lava Burst", type: "fire", power: 24, status: "burn" }, aquashield: { name: "Aqua Shield", type: "water", power: 0, shield: true },
  meteorpunch: { name: "Meteor Punch", type: "rock", power: 22 }, punch: { name: "Power Punch", type: "fighting", power: 18 },
  fairykiss: { name: "Fairy Kiss", type: "fairy", power: 18 }, earthslam: { name: "Earth Slam", type: "ground", power: 20 },
  windgust: { name: "Wind Gust", type: "flying", power: 16 }
};
const TYPE_CHART = {
  electric: { water: 2, flying: 2, ground: 0, grass: 0.5, dragon: 0.5, electric: 0.5 },
  fire: { grass: 2, steel: 2, water: 0.5, fire: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, flying: 0.5, dragon: 0.5, steel: 0.5 },
  psychic: { fighting: 2, psychic: 0.5, dark: 0 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, dark: 0.5, fighting: 0.5, fairy: 0.5 },
  fighting: { normal: 2, rock: 2, steel: 2, dark: 2, psychic: 0.5, flying: 0.5, fairy: 0.5, ghost: 0 },
  steel: { rock: 2, fairy: 2, steel: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
  ground: { fire: 2, electric: 2, rock: 2, steel: 2, grass: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  fairy: { dragon: 2, dark: 2, fighting: 2, fire: 0.5, steel: 0.5 },
  rock: { fire: 2, flying: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  normal: { rock: 0.5, ghost: 0, steel: 0.5 }
};
function typeMult(atk, def) { const m = TYPE_CHART[atk]; return (m && def in m) ? m[def] : 1; }
const TYPE_COLORS = { electric: "#f6d02e", fire: "#f07b28", water: "#3aa0d8", grass: "#5fbf4f", psychic: "#f361a6", ghost: "#7a5aa8", dragon: "#6a5cf0", dark: "#5a5466", fighting: "#c0392b", steel: "#9aa7b8", ground: "#d1a14a", flying: "#9fb6e6", fairy: "#f0a6d8", rock: "#b9a06a", ice: "#8fe0e8", normal: "#c8c8c8" };
function typeChip(t) { return "<i class='tchip' style='background:" + (TYPE_COLORS[t] || "#888") + "'></i>"; }
function moveAcc(mv) { return mv.acc != null ? mv.acc : (mv.power >= 22 ? 0.9 : mv.power >= 18 ? 0.95 : 1); }
const SPECIES = {
  foxling: { name: "Eevee", type: "normal", role: "starter", col: 0xc99a5a, size: 0.85, hp: 42, moves: ["quickattack", "darkbite", "fairykiss", "iceslash"] },
  voltmouse: { name: "Pikachu", type: "electric", role: "grass", col: 0xf6d02e, size: 0.65, hp: 34, moves: ["shock", "quickattack", "thunderdash"] },
  aurawolf: { name: "Lucario", type: "fighting", role: "grass", col: 0x2f63c8, size: 0.95, hp: 48, moves: ["punch", "steelslam", "quickattack"] },
  moonfox: { name: "Umbreon", type: "dark", role: "grass", col: 0x202430, size: 0.8, hp: 44, moves: ["darkbite", "quickattack", "fairykiss"] },
  frogblade: { name: "Greninja", type: "water", role: "water", col: 0x3aa0d8, size: 0.9, hp: 46, moves: ["watersurge", "darkbite", "quickattack"] },
  landshark: { name: "Garchomp", type: "dragon", role: "grass", col: 0x37506b, size: 1.1, hp: 56, moves: ["dragonstrike", "earthslam", "darkbite"] },
  museling: { name: "Gardevoir", type: "fairy", role: "grass", col: 0xe8edf0, size: 0.95, hp: 50, moves: ["fairykiss", "psychicwave", "healinglight"] },
  steelmind: { name: "Metagross", type: "steel", role: "grass", col: 0x5f7ba6, size: 1.1, hp: 58, moves: ["steelslam", "psychicwave", "meteorpunch"] },
  emberwing: { name: "Charizard", type: "fire", role: "fly", col: 0xf07b28, size: 1.4, hp: 60, moves: ["fireblast", "lavaburst", "windgust", "dragonstrike"] },
  dragonox: { name: "Dragonite", type: "dragon", role: "sky", col: 0xe9a93f, size: 1.3, hp: 62, moves: ["dragonstrike", "windgust", "quickattack"] },
  shadeling: { name: "Gengar", type: "ghost", role: "cave", col: 0x6a3aa0, size: 0.9, hp: 44, moves: ["shadowball", "darkbite", "psychicwave"] },
  rocktitan: { name: "Tyranitar", type: "rock", role: "grass", col: 0x5a7a44, size: 1.2, hp: 64, moves: ["meteorpunch", "earthslam", "darkbite"] },
  snoozer: { name: "Snorlax", type: "normal", role: "block", col: 0x2f4a58, size: 1.6, hp: 90, moves: ["quickattack", "earthslam"] },
  psyclone: { name: "Mewtwo", type: "psychic", role: "legendary", col: 0xd6cfe6, size: 1.4, hp: 95, moves: ["psychicwave", "shadowball", "dragonstrike", "healinglight"], legend: true },
  mewling: { name: "Mew", type: "psychic", role: "rare", col: 0xf3a6c8, size: 0.7, hp: 60, moves: ["psychicwave", "fairykiss", "quickattack"], legend: true },
  terraking: { name: "Groudon", type: "ground", role: "lava", col: 0xd1402a, size: 1.6, hp: 100, moves: ["lavaburst", "earthslam", "meteorpunch"], legend: true },
  tidequeen: { name: "Kyogre", type: "water", role: "water", col: 0x2a6ad0, size: 1.6, hp: 100, moves: ["watersurge", "aquashield", "iceslash"], legend: true },
  skywyrm: { name: "Rayquaza", type: "dragon", role: "sky", col: 0x2faf6a, size: 1.8, hp: 110, moves: ["dragonstrike", "windgust", "lavaburst"], legend: true },
  allbeast: { name: "Arceus", type: "normal", role: "legendary", col: 0xeae0c0, size: 1.7, hp: 130, moves: ["dragonstrike", "psychicwave", "fairykiss", "earthslam"], legend: true },
  bulba: { name: "Bulbasaur", type: "grass", role: "grass", col: 0x5fae8a, size: 0.8, hp: 44, moves: ["quickattack", "fairykiss", "earthslam"] },
  squirt: { name: "Squirtle", type: "water", role: "water", col: 0x7fc8e8, size: 0.75, hp: 44, moves: ["watersurge", "quickattack", "aquashield"] },
  charm: { name: "Charmander", type: "fire", role: "grass", col: 0xf2853c, size: 0.75, hp: 42, moves: ["fireblast", "quickattack", "darkbite"] },
  meow: { name: "Meowth", type: "normal", role: "grass", col: 0xe8d8a8, size: 0.7, hp: 38, moves: ["quickattack", "darkbite", "fairykiss"] },
  jiggly: { name: "Jigglypuff", type: "fairy", role: "grass", col: 0xffb6d0, size: 0.65, hp: 46, moves: ["fairykiss", "quickattack", "healinglight"] },
  raichu: { name: "Raichu", type: "electric", role: "grass", col: 0xe89a3c, size: 0.85, hp: 50, moves: ["shock", "thunderdash", "quickattack"] },
  psy: { name: "Psyduck", type: "water", role: "water", col: 0xf2d060, size: 0.75, hp: 42, moves: ["watersurge", "psychicwave", "quickattack"] },
  clef: { name: "Clefairy", type: "fairy", role: "grass", col: 0xffc8d8, size: 0.68, hp: 44, moves: ["fairykiss", "healinglight", "quickattack"] },
  piplup: { name: "Piplup", type: "water", role: "water", col: 0x6a9ad8, size: 0.68, hp: 42, moves: ["watersurge", "iceslash", "quickattack"] }
};
const WILD_POOL = ["voltmouse", "moonfox", "aurawolf", "museling", "frogblade", "landshark", "rocktitan", "bulba", "charm", "meow", "jiggly", "raichu", "clef"];
function makeCreature(id, level, opts) {
  opts = opts || {}; const sp = SPECIES[id]; const lvl = level || 5; const maxHp = Math.round(sp.hp + lvl * 4);
  const shiny = opts.shiny != null ? opts.shiny : (Math.random() < 0.03);
  return { sp: id, name: opts.name || (shiny ? "Shiny " + sp.name : sp.name), type: sp.type, level: lvl, hp: maxHp, maxHp, moves: sp.moves.slice(0, 4), xp: 0, friendship: opts.friendship || 0, shiny };
}
function xpNeed(lvl) { return 18 + lvl * 12; }
function gainCreatureXP(c, amt) { c.xp += amt; let ups = 0; while (c.xp >= xpNeed(c.level)) { c.xp -= xpNeed(c.level); c.level++; c.maxHp += 4; c.hp = Math.min(c.maxHp, c.hp + 6); ups++; } return ups; }
function calcDamage(atk, def, mv) {
  if (!mv.power) return 0;
  const eff = typeMult(mv.type, SPECIES[def.sp].type);
  const base = mv.power * (1 + atk.level * 0.06) * eff * (0.85 + Math.random() * 0.3);
  return { dmg: Math.max(1, Math.round(base)), eff };
}
// creature 3D models (blocky, colourful, role-flavoured)
function shinyTint(c) { const col = new THREE.Color(c); col.offsetHSL(0.12, 0.25, 0.12); return col.getHex(); }
function creatureCry(type) { const base = { electric: 1200, fire: 300, water: 500, dragon: 160, ghost: 900, psychic: 760, normal: 600 }[type] || 600; blip(base, 0.1, "square", 0.07, base * 1.4); }
function buildCreatureModel(id, shiny) {
  const sp = SPECIES[id], s = sp.size || 1, col = shiny ? shinyTint(sp.col) : sp.col, ghost = sp.role === "cave" || sp.type === "ghost";
  const fox = id === "foxling" || id === "moonfox";
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: ghost, opacity: ghost ? 0.7 : 1, emissive: sp.legend ? col : 0x000000, emissiveIntensity: sp.legend ? 0.3 : 0 });
  const lighten = (hex, amt) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, amt); return c.getHex(); };
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  const belly = lighten(col, 0.18);
  // two body plans so species stop sharing one box: chubby upright sitters vs long four legged runners
  const BIPED = { voltmouse: 1, aurawolf: 1, landshark: 1, rocktitan: 1, snoozer: 1, psyclone: 1, mewling: 1, terraking: 1, museling: 1, frogblade: 1, dragonox: 1, emberwing: 1, squirt: 1, charm: 1, meow: 1, jiggly: 1, raichu: 1, psy: 1, clef: 1, piplup: 1 };
  const biped = !!BIPED[id] && !ghost;
  if (biped) {
    const big = id === "snoozer" ? 1.3 : 1;            // the sleepy giant is mostly belly
    const body = box(0.6 * s * big, 0.66 * s * big, 0.5 * s * big, col); body.position.set(0, 0.45 * s * big, 0.28 * s); g.add(body);
    const bel = box(0.44 * s * big, 0.5 * s * big, 0.06, belly); bel.position.set(0, 0.42 * s * big, 0.28 * s + 0.25 * s * big); g.add(bel);
  } else {
    const body = box(0.6 * s, 0.5 * s, 0.8 * s, col); body.position.y = 0.5 * s; g.add(body);
    const bel = box(0.4 * s, 0.34 * s, 0.05, belly); bel.position.set(0, 0.46 * s, 0.41 * s); g.add(bel);
  }
  const head = box(0.5 * s, 0.5 * s, 0.5 * s, col); head.position.set(0, (biped ? 0.98 : 0.88) * s, 0.5 * s); g.add(head);
  // snout for fox + dragon faces
  if (fox || sp.type === "dragon" || sp.role === "sky") { const sn = box(0.24 * s, 0.18 * s, 0.2 * s, belly); sn.position.set(0, 0.82 * s, 0.8 * s); g.add(sn); const nose = box(0.08 * s, 0.07 * s, 0.06 * s, 0x222222); nose.position.set(0, 0.86 * s, 0.92 * s); g.add(nose); }
  // friendly cartoon eyes: white base with a dark pupil, plus a little mouth
  for (const sx of [-1, 1]) {
    const w = box(0.11 * s, 0.14 * s, 0.045, 0xffffff); w.position.set(sx * 0.13 * s, 0.96 * s, 0.755 * s); g.add(w);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.08 * s, 0.05), new THREE.MeshLambertMaterial({ color: 0x14161c, emissive: shiny ? 0xfff1a8 : 0x223344, emissiveIntensity: 0.5 })); p.position.set(sx * 0.13 * s, 0.95 * s, 0.765 * s); g.add(p);
  }
  if (!(fox || sp.type === "dragon" || sp.role === "sky")) { const mo = box(0.12 * s, 0.04 * s, 0.045, 0x5a2a2a); mo.position.set(0, 0.8 * s, 0.755 * s); g.add(mo); }
  // ears / horns vary by type so silhouettes differ
  if (sp.type === "dragon" || sp.role === "sky") { const hL = box(0.08 * s, 0.26 * s, 0.08 * s, 0xeeeeee); hL.position.set(-0.14 * s, 1.22 * s, 0.5 * s); hL.rotation.z = 0.3; g.add(hL); const hR = hL.clone(); hR.position.x = 0.14 * s; hR.rotation.z = -0.3; g.add(hR); }
  else if (sp.type === "electric") { for (const sx of [-1, 1]) { const ear = box(0.12 * s, 0.34 * s, 0.08 * s, col); ear.position.set(0.17 * s * sx, 1.3 * s, 0.5 * s); ear.rotation.z = -0.18 * sx; g.add(ear); const tip = box(0.13 * s, 0.12 * s, 0.085 * s, 0x222222); tip.position.set(0.21 * s * sx, 1.45 * s, 0.5 * s); tip.rotation.z = -0.18 * sx; g.add(tip); } }
  else if (fox) { for (const sx of [-1, 1]) { const ear = box(0.16 * s, 0.24 * s, 0.07 * s, col); ear.position.set(0.16 * s * sx, 1.2 * s, 0.5 * s); ear.rotation.z = 0.25 * sx; g.add(ear); const tip = box(0.1 * s, 0.12 * s, 0.075 * s, belly); tip.position.set(0.19 * s * sx, 1.31 * s, 0.5 * s); tip.rotation.z = 0.25 * sx; g.add(tip); } }
  else { const eaL = box(0.13 * s, 0.22 * s, 0.06 * s, col); eaL.position.set(-0.15 * s, 1.18 * s, 0.5 * s); g.add(eaL); const eaR = eaL.clone(); eaR.position.x = 0.15 * s; g.add(eaR); }
  // forehead gem for fairy / psychic, cheeks for electric
  if (sp.type === "fairy" || sp.type === "psychic") { const gem = box(0.12 * s, 0.12 * s, 0.06 * s, sp.type === "fairy" ? 0xff8ad6 : 0x9be8ff); gem.position.set(0, 1.07 * s, 0.7 * s); gem.rotation.z = 0.78; g.add(gem); }
  if (sp.type === "electric") { for (const sx of [-1, 1]) { const ch = box(0.1 * s, 0.1 * s, 0.05, 0xff5a4a); ch.position.set(0.23 * s * sx, 0.84 * s, 0.72 * s); g.add(ch); } }
  // back spikes for rock + dragon
  if (sp.type === "rock" || sp.type === "dragon") { for (let i = 0; i < 3; i++) { const sk = box(0.1 * s, 0.18 * s, 0.1 * s, belly); sk.position.set(0, 0.8 * s, 0.18 * s - i * 0.26 * s); sk.rotation.x = 0.2; g.add(sk); } }
  // type-themed tail
  if (sp.type === "electric") { const t1 = box(0.1 * s, 0.24 * s, 0.08 * s, 0xffe14d); t1.position.set(0, 0.55 * s, -0.5 * s); t1.rotation.z = 0.6; g.add(t1); const t2 = box(0.1 * s, 0.22 * s, 0.08 * s, 0xffe14d); t2.position.set(0.16 * s, 0.74 * s, -0.58 * s); t2.rotation.z = -0.6; g.add(t2); }
  else if (sp.type === "fire") { for (let i = 0; i < 3; i++) { const f = box((0.16 - i * 0.04) * s, 0.2 * s, 0.12 * s, i === 0 ? 0xff3a1e : i === 1 ? 0xff8a1e : 0xffd23d); f.position.set(0, 0.55 * s + i * 0.16 * s, -0.5 * s); g.add(f); } }
  else if (sp.type === "water" || sp.role === "water") { const fin = box(0.06, 0.32 * s, 0.34 * s, lighten(col, 0.1)); fin.position.set(0, 0.5 * s, -0.56 * s); fin.rotation.x = 0.3; g.add(fin); }
  else if (fox) { const b1 = box(0.18 * s, 0.18 * s, 0.34 * s, col); b1.position.set(0, 0.55 * s, -0.55 * s); g.add(b1); const tip = box(0.17 * s, 0.17 * s, 0.16 * s, belly); tip.position.set(0, 0.6 * s, -0.76 * s); g.add(tip); }
  else if (sp.type === "dragon" || sp.role === "sky") { const t = box(0.14 * s, 0.14 * s, 0.5 * s, col); t.position.set(0, 0.45 * s, -0.62 * s); g.add(t); const tip = box(0.12 * s, 0.18 * s, 0.12 * s, belly); tip.position.set(0, 0.5 * s, -0.86 * s); g.add(tip); }
  else { const st = box(0.12 * s, 0.12 * s, 0.22 * s, col); st.position.set(0, 0.5 * s, -0.5 * s); g.add(st); }
  // wings for flyers
  if (sp.role === "fly" || sp.role === "sky") { const wMat = mat(shiny ? 0xffffff : 0xcfeaff); const wl = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.08, 0.6 * s), wMat); wl.position.set(-0.62 * s, 0.65 * s, 0); g.add(wl); const wr = wl.clone(); wr.position.x = 0.62 * s; g.add(wr); g.userData.wings = [wl, wr]; }
  // legs, or a wispy floating tail for ghosts
  if (biped) {                                        // upright sitters: two stubby legs plus two little arms that swing together
    const legs = [];
    for (const sx of [-1, 1]) { const l = box(0.16 * s, 0.26 * s, 0.18 * s, col); l.geometry.translate(0, -0.13 * s, 0); l.position.set(sx * 0.18 * s, 0.26 * s, 0.34 * s); g.add(l); legs.push(l); }
    for (const sx of [-1, 1]) { const a = box(0.12 * s, 0.3 * s, 0.12 * s, col); a.geometry.translate(0, -0.15 * s, 0); a.position.set(sx * 0.36 * s, 0.72 * s, 0.28 * s); a.rotation.z = sx * 0.2; g.add(a); legs.push(a); }
    g.userData.legs = legs;
  }
  else if (!ghost) { const legs = []; for (const lx of [-0.18 * s, 0.18 * s]) for (const lz of [0.25 * s, -0.25 * s]) { const l = box(0.14 * s, 0.3 * s, 0.14 * s, col); l.geometry.translate(0, -0.15 * s, 0); l.position.set(lx, 0.3 * s, lz); g.add(l); legs.push(l); } g.userData.legs = legs; }
  else { const w1 = box(0.42 * s, 0.22 * s, 0.5 * s, col); w1.position.set(0, 0.22 * s, 0); g.add(w1); const w2 = box(0.26 * s, 0.18 * s, 0.32 * s, col); w2.position.set(0, 0.05 * s, 0); g.add(w2); }
  if (sp.role !== "fly" && sp.role !== "sky") blobShadow(g, 0.44 * s);   // ground shadow plants everyone in the world
  // per-creature recognizable accents (simple voxel markers for key features)
  if (id === "shadeling") { const r1 = box(0.12 * s, 0.09 * s, 0.05, 0xff2a2a); r1.position.set(-0.13 * s, 0.97 * s, 0.78 * s); g.add(r1); const r2 = box(0.12 * s, 0.09 * s, 0.05, 0xff2a2a); r2.position.set(0.13 * s, 0.97 * s, 0.78 * s); g.add(r2); const grin = box(0.34 * s, 0.06 * s, 0.05, 0xffffff); grin.position.set(0, 0.78 * s, 0.78 * s); g.add(grin); }   // red eyes + wide grin
  else if (id === "moonfox") { const fr = box(0.13 * s, 0.04 * s, 0.05, 0xffe14d); fr.position.set(0, 1.03 * s, 0.78 * s); g.add(fr); const ring = box(0.17 * s, 0.17 * s, 0.04, 0xffe14d); ring.position.set(0, 0.5 * s, 0.42 * s); g.add(ring); }   // glowing yellow rings
  else if (id === "emberwing") { for (const sx of [-1, 1]) { const h = box(0.08 * s, 0.22 * s, 0.08 * s, belly); h.position.set(0.12 * s * sx, 1.2 * s, 0.42 * s); h.rotation.z = -0.25 * sx; g.add(h); } }   // horns
  else if (id === "landshark") { const fin = box(0.42 * s, 0.16 * s, 0.06 * s, 0xcfe0ea); fin.position.set(0, 1.14 * s, 0.5 * s); g.add(fin); const rb = box(0.42 * s, 0.3 * s, 0.04, 0xc0392b); rb.position.set(0, 0.46 * s, 0.42 * s); g.add(rb); }   // head fin + red belly
  else if (id === "snoozer") { const bb = box(0.52 * s, 0.42 * s, 0.1, 0xe8dcc0); bb.position.set(0, 0.42 * s, 0.42 * s); g.add(bb); }   // cream belly
  else if (id === "voltmouse") { const tb = box(0.1 * s, 0.1 * s, 0.12 * s, 0x8a5a1e); tb.position.set(0, 0.42 * s, -0.48 * s); g.add(tb); }   // brown tail base
  else if (id === "psyclone") { const tl = box(0.1 * s, 0.1 * s, 0.6 * s, col); tl.position.set(0, 0.4 * s, -0.72 * s); g.add(tl); }   // long psychic tail
  else if (id === "frogblade") { const sc = box(0.5 * s, 0.12 * s, 0.5 * s, lighten(col, 0.2)); sc.position.set(0, 0.66 * s, 0.5 * s); g.add(sc); }   // pale scarf
  else if (id === "aurawolf") { for (const sx of [-1, 1]) { const sp2 = box(0.06 * s, 0.12 * s, 0.06 * s, 0x18324f); sp2.position.set(0.1 * s * sx, 0.55 * s, 0.4 * s); g.add(sp2); } }   // chest spikes
  else if (id === "museling") { const gown = box(0.7 * s, 0.4 * s, 0.5 * s, col); gown.position.set(0, 0.22 * s, 0); g.add(gown); const hair = box(0.42 * s, 0.3 * s, 0.1 * s, 0x49b06a); hair.position.set(0, 1.0 * s, 0.36 * s); g.add(hair); }   // flowing gown + green hair
  else if (id === "bulba") { const bulb = box(0.36 * s, 0.3 * s, 0.36 * s, 0x3f8f5a); bulb.position.set(0, 0.86 * s, -0.15 * s); g.add(bulb); const tip = box(0.14 * s, 0.14 * s, 0.14 * s, 0x6fcf8a); tip.position.set(0, 1.06 * s, -0.15 * s); g.add(tip); }   // plant bulb on the back
  else if (id === "squirt") { const sh = box(0.5 * s, 0.5 * s, 0.2 * s, 0x9a6f46); sh.position.set(0, 0.5 * s, 0.06 * s); g.add(sh); }   // rounded back shell
  else if (id === "meow") { const ch = box(0.14 * s, 0.14 * s, 0.05, 0xf2c94c); ch.position.set(0, 1.18 * s, 0.72 * s); g.add(ch); }   // gold forehead charm
  else if (id === "psy" || id === "piplup") { const bill = box(0.24 * s, 0.09 * s, 0.2 * s, id === "psy" ? 0xe8c060 : 0xf2b03c); bill.position.set(0, 0.88 * s, 0.8 * s); g.add(bill); }   // wide duck / penguin bill
  if (sp.legend) { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,245,180,0.8)", "rgba(255,200,80,0)"), depthWrite: false, transparent: true, fog: false })); aura.scale.set(3.2 * s, 3.2 * s, 1); aura.position.y = 0.8 * s; g.add(aura); }
  else if (shiny) { const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,255,255,0.9)", "rgba(180,220,255,0)"), depthWrite: false, transparent: true, fog: false })); sg.scale.set(2 * s, 2 * s, 1); sg.position.y = 0.8 * s; g.add(sg); }
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData = g.userData;   // licensed model (if supplied) replaces the placeholder inside this wrapper
  applyCharModel(wrap, g, sp.name, 1.5 * s);
  return wrap;
}
// team + collection
let cteam = [], cstorage = [], cdex = new Set(), cbadges = new Set();
let dexRewarded = 0;
function checkDex() {                                   // reward milestones for filling the creature collection book
  const n = cdex.size, total = Object.keys(SPECIES).length;
  const tiers = [[5, 30, [[CRYSTAL, 4]]], [10, 60, [[BRICK, 8], [CRYSTAL, 4]]], [15, 100, [[FIRE_CRYSTAL, 4]]], [total, 250, [[CRYSTAL, 20]]]];
  for (const t of tiers) { if (n >= t[0] && dexRewarded < t[0]) { dexRewarded = t[0]; addCoins(t[1]); for (const it of t[2]) addItem(it[0], it[1]); showBanner("Creature Dex " + n + "/" + total + "! Collection reward unlocked."); SFX.treasure(); if (n >= total) achieve("dexmaster", "Creature Dex Complete"); } }
}
function addCreature(c) { cdex.add(c.sp); checkDex(); if (cteam.length < 6) { cteam.push(c); return "team"; } cstorage.push(c); return "storage"; }
// roaming creatures in the realm
let realmCreatures = [], encounterCd = 0;
function clearRealmCreatures() { for (const c of realmCreatures) scene.remove(c.g); realmCreatures = []; }
function spawnRealmCreature(id, x, z, level) {
  const shiny = Math.random() < 0.04, g = buildCreatureModel(id, shiny), sp = SPECIES[id], fly = sp.role === "fly" || sp.role === "sky";
  g.position.set(x + 0.5, fly ? surfaceY(x, z) + 6 : surfaceY(x, z), z + 0.5); scene.add(g);
  realmCreatures.push({ id, g, sp, level, fly, shiny, dir: Math.random() * 6.28, t: Math.random() * 6, soundCd: Math.random() * 8, walkT: 0 });
}
function enterRealm() {
  clearRealmCreatures(); clearRealmNPCs(); clearRealmBosses(); encounterCd = 0; realmHinted = {};
  // Sparky the Voltmouse is Thomas's electric starter and follows him everywhere in this stage
  if (!cteam.length) { cteam.push(makeCreature("voltmouse", 5, { name: "Pikachu" })); cdex.add("voltmouse"); toast("Pikachu wants to follow Thomas!"); showBanner("Pikachu joins Thomas! Press Use near creatures to battle."); }
  spawnCompanion(Math.floor(player.pos.x), Math.floor(player.pos.z)); buildRealmVault(); buildRealmPuzzle();
  // hub NPCs near the spawn portal
  spawnRealmNPC("nurse", 3, 3); spawnRealmNPC("shop", 6, 3); spawnRealmNPC("trainer", -3, 4); spawnRealmNPC("badge", 0, 6); spawnRealmNPC("teacher", -6, 2);
  dressBossArenas(); spawnRealmBosses(); dressSnorlaxBridge(); spawnSnoozer(); buildRealmRoutes();
  if (Math.random() < 0.5) { const a = Math.random() * 6.28, r = 18 + Math.random() * 16; spawnRealmCreature("mewling", Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 10); }   // rare playful legendary
  const roamers = ["voltmouse", "moonfox", "aurawolf", "museling", "landshark", "steelmind", "rocktitan"];
  for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 22; spawnRealmCreature(roamers[Math.floor(Math.random() * roamers.length)], Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 3 + Math.floor(Math.random() * 5)); }
  for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 16 + Math.random() * 12; spawnRealmCreature(Math.random() < 0.5 ? "emberwing" : "dragonox", Math.floor(player.pos.x + Math.cos(a) * r), Math.floor(player.pos.z + Math.sin(a) * r), 8); }
  setQuest("Walk through the tall grass to find wild creatures, then Battle and Tame them.");
}
let realmVault = null;
function buildRealmVault() {                            // a locked electric vault Pikachu can open (puzzle door)
  const x = 12, z = -10, y = surfaceY(x, z) + 1;
  setRaw(x, y, z, CHEST); setRaw(x, y, z + 1, CDOOR);  // treasure behind an electric lock
  markDirty(x, z); markDirty(x, z + 1);
  const key = chestKey(x, y, z); if (!chestStore.has(key)) chestStore.set(key, [{ id: CRYSTAL, count: 8 }, { id: FIRE_CRYSTAL, count: 3 }, { id: I_APPLE, count: 4 }, null, null, null, null, null, null]);
  realmVault = { x, y, z, opened: !!realmBossDown.vault };
  if (realmVault.opened) { setRaw(x, y, z + 1, AIR); markDirty(x, z + 1); }
}
function tryElectricDoor() {
  if (!realmVault || realmVault.opened || !companion) return;
  const v = realmVault, d = Math.hypot(companion.g.position.x - (v.x + 0.5), companion.g.position.z - (v.z + 1.5));
  if (d < 3.2) {
    v.opened = true; realmBossDown.vault = true; setRaw(v.x, v.y, v.z + 1, AIR); recordEdit(v.x, v.y, v.z + 1, AIR); markDirty(v.x, v.z + 1);
    for (let i = 0; i < 8; i++) hitSpark(new THREE.Vector3(v.x + 0.5, v.y + 0.5, v.z + 1.5), 0xffe14d);
    showBanner("Pikachu unlocks the electric vault! Grab the treasure."); SFX.zap(); reactCompanion("cheer");
  }
}
// ---- push-block puzzle: shove the boulder onto the pressure plate to open a gated treasure ----
let realmPuzzle = null;
function clearRealmPuzzle() { if (realmPuzzle) { scene.remove(realmPuzzle.g); realmPuzzle = null; } }
function buildRealmPuzzle() {
  clearRealmPuzzle();
  const bx = 16, bz = 4, plx = 16, plz = 8, gx = 16, gz = 10;          // boulder start, plate, gate
  setRaw(plx, surfaceY(plx, plz) - 1, plz, HEAL);                       // glowing pressure plate (top block)
  const gy = surfaceY(gx, gz); setRaw(gx, gy, gz, CDOOR); setRaw(gx, gy + 1, gz, CDOOR); setRaw(gx, gy, gz + 1, CHEST);   // gy captured before the gate raises surfaceY
  const key = chestKey(gx, gy, gz + 1); if (!chestStore.has(key)) chestStore.set(key, [{ id: CRYSTAL, count: 6 }, { id: BRICK, count: 8 }, { id: I_APPLE, count: 3 }, null, null, null, null, null, null]);
  markDirty(plx, plz); markDirty(gx, gz); markDirty(gx, gz + 1);
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), new THREE.MeshLambertMaterial({ color: 0x8a8d92 }));
  g.position.set(bx + 0.5, surfaceY(bx, bz) + 0.46, bz + 0.5); scene.add(g);
  realmPuzzle = { boulder: { x: bx, z: bz }, plate: { x: plx, z: plz }, gate: { x: gx, z: gz }, gateY: gy, g, solved: !!realmBossDown.puzzle };
  if (realmPuzzle.solved) { setRaw(gx, gy, gz, AIR); setRaw(gx, gy + 1, gz, AIR); markDirty(gx, gz); }
}
function pushBoulder() {                                                // called from Use when Thomas is against the boulder
  const p = realmPuzzle; if (!p || p.solved) return false;
  if (Math.hypot((p.boulder.x + 0.5) - player.pos.x, (p.boulder.z + 0.5) - player.pos.z) > 2.2) return false;
  let ddx = (p.boulder.x + 0.5) - player.pos.x, ddz = (p.boulder.z + 0.5) - player.pos.z, mx = 0, mz = 0;   // shove away from Thomas, dominant axis
  if (Math.abs(ddx) > Math.abs(ddz)) mx = ddx > 0 ? 1 : -1; else mz = ddz > 0 ? 1 : -1;
  const nx = p.boulder.x + mx, nz = p.boulder.z + mz;
  if (nx === p.gate.x && nz === p.gate.z) return true;                  // can't push into the gate
  p.boulder.x = nx; p.boulder.z = nz; p.g.position.set(nx + 0.5, surfaceY(nx, nz) + 0.46, nz + 0.5); SFX.step();
  for (let i = 0; i < 3; i++) hitSpark(new THREE.Vector3(nx + 0.5, p.g.position.y, nz + 0.5), 0xcfd2d6);
  if (nx === p.plate.x && nz === p.plate.z) {                           // solved!
    p.solved = true; realmBossDown.puzzle = true;
    setRaw(p.gate.x, p.gateY, p.gate.z, AIR); setRaw(p.gate.x, p.gateY + 1, p.gate.z, AIR); recordEdit(p.gate.x, p.gateY, p.gate.z, AIR); markDirty(p.gate.x, p.gate.z);
    showBanner("The boulder clicks onto the plate! The gate grinds open."); SFX.victory(); addXP(40);
  }
  return true;
}
function updateRealm(dt) {
  updateCompanion(dt); tryElectricDoor();
  for (const c of realmCreatures) {
    const dpx = player.pos.x - c.g.position.x, dpz = player.pos.z - c.g.position.z, dp = Math.hypot(dpx, dpz) || 1;
    if (c.fly) { c.t += dt; c.g.position.x += Math.cos(c.dir) * 1.4 * dt; c.g.position.z += Math.sin(c.dir) * 1.4 * dt; if (Math.random() < 0.012) c.dir += (Math.random() - .5); c.g.position.y = surfaceY(c.g.position.x, c.g.position.z) + 6 + Math.sin(c.t) * 0.6; if (c.g.userData.wings) { const f = Math.sin(c.t * 8) * 0.5; c.g.userData.wings[0].rotation.z = -f; c.g.userData.wings[1].rotation.z = f; } c.g.rotation.y = c.dir + Math.PI / 2; }
    else {
      // living behavior: creatures wander, pause, look around, nap, and hop instead of endlessly pacing
      c.behT = (c.behT || 0) - dt;
      if (c.behT <= 0) { const opts = ["wander", "wander", "idle", "look", "sleep", "hop"]; c.beh = opts[Math.floor(Math.random() * opts.length)]; c.behT = 2.5 + Math.random() * 4.5; }
      let moving = false;
      if (dp < 6 && dp > 1.4) {                        // shy: drift away, waking if napping
        if (c.beh === "sleep") { c.beh = "wander"; creatureCry(c.sp.type); }
        c.dir = Math.atan2(c.g.position.x - player.pos.x, c.g.position.z - player.pos.z);
        c.g.position.x += Math.sin(c.dir) * 2.2 * dt; c.g.position.z += Math.cos(c.dir) * 2.2 * dt; c.g.rotation.y = c.dir; moving = true;
      } else if (c.beh === "wander") { if (Math.random() < 0.012) c.dir += (Math.random() - .5) * 1.5; c.g.position.x += Math.sin(c.dir) * 1.1 * dt; c.g.position.z += Math.cos(c.dir) * 1.1 * dt; c.g.rotation.y = c.dir; moving = true; }
      else if (c.beh === "look") { c.g.rotation.y += dt * 1.4; }
      else if (c.beh === "hop") { if (!c._vy) c._vy = 3.6; c.g.rotation.y = c.dir; }
      else if (c.beh === "sleep") { c.g.rotation.z += ((0.4) - c.g.rotation.z) * Math.min(1, dt * 4); if (Math.random() < 0.02) hitSpark(new THREE.Vector3(c.g.position.x, c.g.position.y + 1.2 * (c.sp.size || 1), c.g.position.z), 0xdfe8ff); }
      if (c.beh !== "sleep") c.g.rotation.z *= 0.85;
      // first meeting: a happy greeting hop toward Thomas
      if (!c.greeted && dp < 3.5) { c.greeted = true; c._vy = 4.2; creatureCry(c.sp.type); }
      fallToGround(c, dt);
      const L = c.g.userData.legs;
      if (moving) { c.walkT += dt * 8; const sw = Math.sin(c.walkT) * 0.5; if (L) { L[0].rotation.x = sw; L[1].rotation.x = -sw; L[2].rotation.x = -sw; L[3].rotation.x = sw; } }
      else if (L) for (const l of L) l.rotation.x *= 0.85;
      if (!cmenuOpen && !battle && encounterCd <= 0 && dp < 2.1) openEncounter(makeCreature(c.id, c.level, { shiny: c.shiny }), c);
    }
    c.soundCd -= dt; if (c.soundCd <= 0) { c.soundCd = 6 + Math.random() * 8; if (dp < 14) creatureCry(c.sp.type); }
  }
  // arena bosses idle with a glow bob; show a one-time challenge hint when Thomas gets close
  for (const b of realmBosses) { b.t += dt; b.g.position.y = surfaceY(b.x, b.z) + Math.sin(b.t * 1.5) * 0.2; b.g.rotation.y += dt * 0.4; if (!battle && !cmenuOpen && b.g.position.distanceTo(player.pos) < 4 && !realmHinted[b.badge]) { realmHinted[b.badge] = 1; showBanner(b.label + " — press Use to challenge!"); } }
  if (realmSnoozer && !battle && !cmenuOpen && realmSnoozer.g.position.distanceTo(player.pos) < 4 && !realmHinted.snoozer) { realmHinted.snoozer = 1; showBanner("A huge Snorlax blocks the path. Feed it Creature Food (press Use)."); }
  // roaming route trainers lock eyes and challenge Thomas once per visit
  if (!battle && !cmenuOpen) for (const n of realmNPCs) { if (n.route && !n.challenged && n.g.position.distanceTo(player.pos) < 3.4) { n.challenged = true; showBanner("A route Trainer wants to battle!"); SFX.screech(); trainerBattle(); break; } }
  if (encounterCd > 0) encounterCd -= dt;
  const feet = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z)), eye = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.6), Math.floor(player.pos.z));
  if ((feet === TALLGRASS || eye === TALLGRASS) && encounterCd <= 0 && !cmenuOpen && !battle) {
    encounterCd = 1.4;
    if (Math.random() < 0.3) {
      const night = typeof isNight === "function" && isNight();
      const pool = night ? WILD_POOL.concat(["moonfox", "shadeling", "frogblade"]) : WILD_POOL;   // night-only creatures appear after dark
      let id = pool[Math.floor(Math.random() * pool.length)], opts = {};
      if (Math.random() < 0.06) { id = Math.random() < 0.5 ? "mewling" : "museling"; opts.shiny = Math.random() < 0.5; showBanner("The air shimmers... a rare creature!"); }   // rare weather event
      SFX.mine(); openEncounter(makeCreature(id, 3 + Math.floor(Math.random() * 5), opts), null);
    }
  }
}
// ---- encounter menu (Battle / Tame / Feed / Run) ----
let cmenuOpen = false, cmenu = null;
function openEncounter(wild, roamRef) {
  cmenu = { wild, roam: roamRef }; cmenuOpen = true; encounterCd = 3; creatureCry(wild.type); reactCompanion("alert");
  const p = $("cmenuPanel"); if (p) {
    const heartLine = () => { const h = Math.max(0, Math.min(5, Math.round(wild.friendship / 2))); return "Friendship: " + ("❤️".repeat(h) || "—") + "  ·  Tame chance " + Math.round(tameChance(wild) * 100) + "%"; };
    p.innerHTML = "<div class='cav big" + (wild.shiny ? " shiny" : "") + "' style='margin:0 auto 6px;background:" + cssHex(SPECIES[wild.sp].col) + "'><i class='cear'></i><i class='cear r'></i><i class='ceye'></i><i class='ceye r'></i></div><h2>" + (wild.shiny ? "✨ " : "") + "A wild " + wild.name + " appeared!</h2><p class='muted'>Level " + wild.level + " · " + SPECIES[wild.sp].type + " type</p>";
    const status = document.createElement("p"); status.className = "muted"; status.id = "cmenuStatus"; status.textContent = heartLine(); p.appendChild(status);
    const row = document.createElement("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px";
    const mk = (label, fn) => { const b = document.createElement("button"); b.className = "btn"; b.textContent = label; b.addEventListener("click", fn); row.appendChild(b); };
    mk("Battle", () => { closeCMenu(); startBattle(wild, roamRef); });
    mk("Tame", () => tryTameFromMenu());
    // Feed: consumes Creature Food if you have it (bigger boost), otherwise a small free pat; feedback shows right in the panel
    mk("Feed", () => {
      let msg;
      if (citems.food > 0) { citems.food--; wild.friendship += 3; msg = "You fed " + wild.name + " Creature Food. It loves it!"; }
      else { wild.friendship += 1; msg = "You gently pet " + wild.name + ". It warms up a little. (Buy Creature Food at the Shop for more.)"; }
      status.textContent = heartLine(); toast(msg); SFX.pickup();
    });
    mk("Run", closeCMenu);
    p.appendChild(row);
  }
  show("cmenu"); document.exitPointerLock();
}
function closeCMenu() { cmenuOpen = false; cmenu = null; hide("cmenu"); if (!isTouch && running && !paused) canvas.requestPointerLock(); }
function tameChance(wild) { return Math.min(0.92, 0.28 + (1 - wild.hp / wild.maxHp) * 0.5 + wild.friendship * 0.04 + (wild.shiny ? -0.1 : 0)); }
function tryTameFromMenu() {
  const wild = cmenu.wild, roam = cmenu.roam;
  if (Math.random() < tameChance(wild)) { const where = addCreature(wild); SFX.victory(); showBanner("You befriended " + wild.name + "!"); toast(where === "team" ? wild.name + " joined your team." : wild.name + " went to your storage shrine."); if (roam) { scene.remove(roam.g); realmCreatures = realmCreatures.filter(c => c !== roam); } closeCMenu(); }
  else { toast(wild.name + " broke free! Weaken it in battle first."); SFX.hurt(); }
}
// ---- turn-based battle ----
let battle = null;
function startBattle(wild, roamRef, opts) {
  opts = opts || {};
  if (!cteam.length) cteam.push(makeCreature("foxling", 5));
  let mine = cteam.find(c => c.hp > 0); if (!mine) { toast("Your creatures are too tired. Visit the Healing Nurse."); return; }
  mine.status = null; mine.shield = false; wild.status = null;
  battle = { wild, mine, roam: roamRef, over: false, busy: false, menu: "main", trainer: !!opts.trainer, boss: opts.boss || null, badge: opts.badge || null, bossRef: opts.bossRef || null, phase: 1, log: opts.intro || (opts.trainer ? "A Trainer sends out " + wild.name + "!" : "A wild " + wild.name + " challenges you!") };
  showBattleWipe(); renderBattle(); show("battle"); document.exitPointerLock(); SFX.screech();
  try { if (!localStorage.getItem("thomas_battletip")) { localStorage.setItem("thomas_battletip", "1"); setTimeout(() => toast("Tip: Fight to attack · Bag for items · Creature to switch · Run to flee"), 800); } } catch (e) {}
}
function showBattleWipe() { const w = $("battleWipe"); if (!w) return; w.classList.remove("go"); void w.offsetWidth; w.classList.add("go"); setTimeout(() => { if (w) w.classList.remove("go"); }, 620); }
function battleFlash(type) {                          // colored attack burst over the battle screen, per move type
  const f = $("battleFx"); if (!f) return; const col = TYPE_COLORS[type] || "#ffffff";
  f.style.background = "radial-gradient(circle at 50% 42%, " + col + ", rgba(0,0,0,0) 62%)";
  f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
}
function cssHex(n) { return "#" + ("000000" + (n >>> 0).toString(16)).slice(-6); }
function hitAvatar(side) { const el = document.getElementById(side === "mine" ? "avM" : "avW"); if (!el) return; el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
function renderBattle() {
  const p = $("battlePanel"); if (!p || !battle) return; const b = battle;
  if (!b.menu) b.menu = "main";
  const bar = (c) => { const f = Math.max(0, 100 * c.hp / c.maxHp), col = f > 50 ? "#4ade80" : f > 20 ? "#fde047" : "#f87171"; return "<div class='cbar'><div class='cbarfill' style='width:" + f + "%;background:" + col + "'></div></div>"; };
  const head = (c, side) => {
    const av = "<div class='cav" + (c.shiny ? " shiny" : "") + "' id='av" + (side ? "M" : "W") + "' style='background:" + cssHex(SPECIES[c.sp].col) + "'><i class='cear'></i><i class='cear r'></i><i class='ceye'></i><i class='ceye r'></i></div>";
    const info = "<div class='cinfo'><b>" + (c.shiny ? "✨" : "") + c.name + "</b> Lv" + c.level + " " + typeChip(SPECIES[c.sp].type) + bar(c) + "<span class='muted'>" + Math.max(0, c.hp | 0) + "/" + c.maxHp + " · " + SPECIES[c.sp].type + (c.shield ? " · shielded" : "") + (c.status === "burn" ? " · 🔥burn" : c.status === "paralyze" ? " · ⚡par" : "") + "</span></div>";
    return "<div class='cbox" + (side ? " mine" : "") + "'>" + av + info + "</div>";
  };
  p.innerHTML = "<div class='battleRow'>" + head(b.wild, false) + head(b.mine, true) + "</div><div class='battleLog'>" + b.log + "</div>";
  if (b.over) { const r = document.createElement("div"); r.style.cssText = "text-align:center;margin-top:8px"; const x = document.createElement("button"); x.className = "btn"; x.textContent = "Continue"; x.addEventListener("click", () => { battle = null; hide("battle"); closeCMenu(); }); r.appendChild(x); p.appendChild(r); return; }
  if (b.busy) return;   // enemy is acting; hide controls until their turn resolves
  if (b.menu === "main") {
    const wrap = document.createElement("div"); wrap.className = "battleMenu";
    const cmd = (l, fn) => { const x = document.createElement("button"); x.className = "bcmd"; x.innerHTML = l; x.addEventListener("click", fn); wrap.appendChild(x); };
    cmd("⚔️ Fight", () => { b.menu = "fight"; renderBattle(); });
    cmd("🎒 Bag", () => { b.menu = "bag"; renderBattle(); });
    cmd("🐾 Creature", () => { b.menu = "creature"; renderBattle(); });
    cmd(b.trainer || b.boss ? "🏳️ Forfeit" : "🏃 Run", () => { battle = null; hide("battle"); closeCMenu(); });
    p.appendChild(wrap);
  } else if (b.menu === "fight") {
    const grid = document.createElement("div"); grid.className = "moveGrid";
    b.mine.moves.forEach((mid, i) => { const mv = MOVES[mid]; const btn = document.createElement("button"); btn.className = "mvBtn"; btn.innerHTML = "<b>" + typeChip(mv.type) + " " + mv.name + "</b><span>" + mv.type + (mv.power ? " · POW " + mv.power : mv.heal ? " · heal" : mv.shield ? " · guard" : "") + " · ACC " + Math.round(moveAcc(mv) * 100) + "%</span>"; btn.addEventListener("click", () => doMove(i)); grid.appendChild(btn); });
    p.appendChild(grid); battleBack(p, b);
  } else if (b.menu === "bag") {
    const list = document.createElement("div"); list.className = "bagList";
    bagItem(list, "🧪 Potion", citems.potion, "Heal a creature 30 HP", useBattlePotion);
    if (!b.trainer && !b.boss) bagItem(list, "💎 Capture Crystal", citems.capture, "Try to catch this creature", tryTameBattle);
    bagItem(list, "🍎 Creature Treat", citems.food, "Heal 12 HP and raise friendship", useBattleTreat);
    p.appendChild(list); battleBack(p, b);
  } else if (b.menu === "creature") {
    const list = document.createElement("div"); list.className = "bagList";
    cteam.forEach((c) => { const row = document.createElement("button"); row.className = "bagRow" + (c === b.mine || c.hp <= 0 ? " no" : ""); row.innerHTML = "<span><b>" + c.name + "</b> Lv" + c.level + " " + typeChip(SPECIES[c.sp].type) + "</span><span class='muted'>" + Math.max(0, c.hp | 0) + "/" + c.maxHp + (c === b.mine ? " · active" : c.hp <= 0 ? " · fainted" : "") + "</span>"; if (c !== b.mine && c.hp > 0) row.addEventListener("click", () => switchCreature(c)); list.appendChild(row); });
    p.appendChild(list); battleBack(p, b);
  }
}
function battleBack(p, b) { const r = document.createElement("div"); r.style.cssText = "text-align:center;margin-top:8px"; const x = document.createElement("button"); x.className = "btn ghost"; x.textContent = "◀ Back"; x.addEventListener("click", () => { b.menu = "main"; renderBattle(); }); r.appendChild(x); p.appendChild(r); }
function bagItem(list, label, count, desc, fn) { const row = document.createElement("button"); row.className = "bagRow" + ((count | 0) <= 0 ? " no" : ""); row.innerHTML = "<span><b>" + label + "</b> x" + (count | 0) + "<br><span class='muted'>" + desc + "</span></span>"; if ((count | 0) > 0) row.addEventListener("click", fn); list.appendChild(row); }
function useBattlePotion() {
  const b = battle; if (!b || b.over || b.busy || citems.potion <= 0) return;
  citems.potion--; b.mine.hp = Math.min(b.mine.maxHp, b.mine.hp + 30); b.log = "You used a Potion on " + b.mine.name + ". (+30)"; b.busy = true; b.menu = "main"; renderBattle(); setTimeout(enemyTurn, 600);
}
function useBattleTreat() {
  const b = battle; if (!b || b.over || b.busy || citems.food <= 0) return;
  citems.food--; b.mine.hp = Math.min(b.mine.maxHp, b.mine.hp + 12); b.mine.friendship = (b.mine.friendship || 0) + 1; b.log = "You gave " + b.mine.name + " a treat. (+12 HP, friendlier)"; b.busy = true; b.menu = "main"; renderBattle(); setTimeout(enemyTurn, 600);
}
function switchCreature(c) {
  const b = battle; if (!b || b.over || b.busy || c.hp <= 0 || c === b.mine) return;
  b.mine = c; b.log = "Go, " + c.name + "!"; b.busy = true; b.menu = "main"; renderBattle(); setTimeout(enemyTurn, 600);
}
function inflictStatus(target, st) { if (st && !target.status && Math.random() < 0.45) { target.status = st; return " " + target.name + (st === "burn" ? " is burned!" : " is paralyzed!"); } return ""; }
function burnTick(c) { if (c.status === "burn") { c.hp = Math.max(1, c.hp - Math.max(1, Math.round(c.maxHp * 0.06))); return " " + c.name + " is hurt by its burn."; } return ""; }
function doMove(i) {
  const b = battle; if (!b || b.over || b.busy) return; b.busy = true;
  const mv = MOVES[b.mine.moves[i]]; b.menu = "main";
  if (b.mine.status === "paralyze" && Math.random() < 0.28) { b.log = b.mine.name + " is paralyzed and can't move!" + burnTick(b.mine); renderBattle(); setTimeout(enemyTurn, 600); return; }
  if (mv.heal) { b.mine.hp = Math.min(b.mine.maxHp, b.mine.hp + mv.heal); b.log = b.mine.name + " used " + mv.name + " and recovered."; }
  else if (mv.shield) { b.mine.shield = true; b.log = b.mine.name + " raised " + mv.name + "."; }
  else { const r = calcDamage(b.mine, b.wild, mv); b.wild.hp -= r.dmg; b.log = b.mine.name + " used " + mv.name + "! " + (r.eff > 1 ? "Super effective! " : r.eff < 1 ? "Not very effective. " : "") + "(" + r.dmg + ")" + inflictStatus(b.wild, mv.status); battleFlash(mv.type); }
  b.log += burnTick(b.mine);
  renderBattle();
  if (b.wild.hp <= 0) { return winBattle(); }
  hitAvatar("wild");
  setTimeout(() => { enemyTurn(); }, 600);
}
function enemyTurn() {
  const b = battle; if (!b || b.over) return;
  if (b.boss) { const frac = b.wild.hp / b.wild.maxHp, ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3; if (ph > b.phase) { b.phase = ph; b.wild.hp = Math.min(b.wild.maxHp, b.wild.hp + 8); b.log = b.wild.name + " powers up to phase " + ph + "!"; renderBattle(); } }
  if (b.wild.status === "paralyze" && Math.random() < 0.28) { b.log = b.wild.name + " is paralyzed and can't move!" + burnTick(b.wild); b.busy = false; renderBattle(); if (b.wild.hp <= 0) return winBattle(); return; }
  const mid = b.wild.moves[Math.floor(Math.random() * b.wild.moves.length)], mv = MOVES[mid];
  if (mv.heal) { b.wild.hp = Math.min(b.wild.maxHp, b.wild.hp + mv.heal); b.log = b.wild.name + " used " + mv.name + "."; }
  else if (mv.shield) { b.wild.shield = true; b.log = b.wild.name + " braced with " + mv.name + "."; }
  else { let r = calcDamage(b.wild, b.mine, mv); if (b.boss) r.dmg = Math.round(r.dmg * (1 + (b.phase - 1) * 0.2)); if (b.mine.shield) { r.dmg = Math.round(r.dmg * 0.5); b.mine.shield = false; } b.mine.hp -= r.dmg; b.log = (b.trainer ? "" : b.boss ? "" : "Wild ") + b.wild.name + " used " + mv.name + "! (" + r.dmg + ")" + inflictStatus(b.mine, mv.status); battleFlash(mv.type); }
  b.log += burnTick(b.wild);
  b.busy = false; renderBattle();
  if (mv.power) hitAvatar("mine");
  if (b.wild.hp <= 0) return winBattle();
  if (b.mine.hp <= 0) {
    const next = cteam.find(c => c.hp > 0 && c !== b.mine);
    if (next) { b.mine = next; b.log = "Your creature fainted. Go, " + next.name + "!"; renderBattle(); }
    else { b.over = true; realmStreak = 0; b.log = "All your creatures fainted! Heal at a station."; cteam.forEach(c => { c.hp = Math.max(1, Math.round(c.maxHp * 0.3)); }); renderBattle(); }
  }
}
function winBattle() {
  const b = battle; b.over = true;
  const reward = Math.round((14 + b.wild.level * 6) * (b.boss ? 3 : b.trainer ? 1.5 : 1));
  const ups = gainCreatureXP(b.mine, reward); b.mine.friendship++;
  cdex.add(b.wild.sp); checkDex(); addCoins(Math.round((b.wild.level + 4) * (b.boss ? 4 : b.trainer ? 2 : 1))); realmWins++;
  let extra = "";
  if (b.boss && b.badge) { if (!cbadges.has(b.badge)) { cbadges.add(b.badge); extra = " The " + b.badge + " badge is yours!"; showBanner("Badge earned: " + b.badge + "!"); grantRealmReward(b.badge); } realmBossDown[b.badge] = true; if (b.bossRef) { scene.remove(b.bossRef.g); realmBosses = realmBosses.filter(x => x !== b.bossRef); } }
  b.log = "You defeated " + b.wild.name + "! +" + reward + " XP" + (ups ? ". Lv" + b.mine.level + "!" : "") + extra;
  if (b.roam) { scene.remove(b.roam.g); realmCreatures = realmCreatures.filter(c => c !== b.roam); }
  if (companion) companion.friendship++;
  realmStreak++; if (realmStreak % 5 === 0) { addCoins(40); addItem(CRYSTAL, 3); showBanner("Win streak x" + realmStreak + "! Combo bonus!"); SFX.treasure(); }   // streak combo reward
  reactCompanion("cheer"); battleFlash("electric");   // victory sparkle
  if (ups) { showBanner(b.mine.name + " grew to Lv" + b.mine.level + "!"); SFX.levelUp(); }   // level-up flourish
  SFX.victory(); renderBattle();
}
let realmStreak = 0;
function tryTameBattle() {
  const b = battle; if (!b || b.over || b.busy || b.trainer || b.boss) return;
  let chance = tameChance(b.wild); if (citems.capture > 0) { citems.capture--; chance = Math.min(0.97, chance + 0.28); }
  if (Math.random() < chance) { b.over = true; const where = addCreature(b.wild); b.log = "Gotcha! " + b.wild.name + (where === "team" ? " joined your team." : " went to storage."); SFX.victory(); showBanner("Gotcha! " + b.wild.name + " was caught!"); battleFlash("fairy"); if (b.roam) { scene.remove(b.roam.g); realmCreatures = realmCreatures.filter(c => c !== b.roam); } renderBattle(); }
  else { b.log = b.wild.name + " broke free! Weaken it more."; b.busy = true; b.menu = "main"; renderBattle(); setTimeout(enemyTurn, 600); }
}

// ---- Creature Realm: NPCs, healing, items, shop, badges, team/dex menus ----
let realmNPCs = [], realmWins = 0, realmBossDown = {};
const citems = { potion: 0, capture: 0, food: 0 };
const NPC_DEFS = { nurse: { name: "Healing Nurse", col: 0xff8aa0, hat: 0xffffff }, shop: { name: "Shopkeeper", col: 0x4a7ec2, hat: 0x2c4d80 }, trainer: { name: "Creature Trainer", col: 0x6abf6a, hat: 0x2f7a2f }, badge: { name: "Badge Master", col: 0xe8b23a, hat: 0xc98a1e }, teacher: { name: "Move Teacher", col: 0xb06ad0, hat: 0x7a3ea0 } };
function buildNPC(kind) {
  const d = NPC_DEFS[kind], g = new THREE.Group();
  const robe = box(0.5, 0.85, 0.36, d.col); robe.position.y = 0.62; g.add(robe);
  const head = box(0.4, 0.4, 0.4, 0xe8b98a); head.position.y = 1.26; g.add(head);
  const hat = box(0.62, 0.18, 0.62, d.hat); hat.position.y = 1.5; g.add(hat);
  const eL = box(0.06, 0.06, 0.04, 0x111114); eL.position.set(-0.1, 1.28, 0.2); g.add(eL); const eR = eL.clone(); eR.position.x = 0.1; g.add(eR);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,235,150,0.95)", "rgba(255,200,80,0)"), depthWrite: false, transparent: true, fog: false })); sign.scale.set(1.1, 1.1, 1); sign.position.y = 2.05; g.add(sign);
  blobShadow(g, 0.42);
  return g;
}
function spawnRealmNPC(kind, x, z) { const g = buildNPC(kind); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g); realmNPCs.push({ kind, g }); }
function clearRealmNPCs() { for (const n of realmNPCs) scene.remove(n.g); realmNPCs = []; }
function healTeam() { cteam.forEach(c => c.hp = c.maxHp); cstorage.forEach(c => c.hp = c.maxHp); toast("Your creatures are fully healed!"); showBanner("Team healed"); SFX.levelUp(); }
const CSHOP = [{ k: "potion", name: "Healing Potion", cost: 8, desc: "Heal a creature 30 HP in battle" }, { k: "capture", name: "Capture Crystal", cost: 12, desc: "Big taming boost" }, { k: "food", name: "Creature Food", cost: 6, desc: "Raise friendship / move Snoozer" }];
function renderCShop() {
  const sc = $("cshopCoins"); if (sc) sc.textContent = "you have 🪙 " + coins; const l = $("cshopList"); if (!l) return; l.innerHTML = "";
  for (const s of CSHOP) { const ok = coins >= s.cost; const row = document.createElement("div"); row.className = "craftRow" + (ok ? "" : " no"); row.innerHTML = "<span><b>" + s.name + "</b> x" + (citems[s.k] || 0) + "<br><span class='muted'>🪙 " + s.cost + " · " + s.desc + "</span></span>"; const b = document.createElement("button"); b.className = "mk"; b.textContent = "Buy"; b.addEventListener("pointerdown", e => { e.preventDefault(); if (coins >= s.cost) { coins -= s.cost; citems[s.k] = (citems[s.k] || 0) + 1; SFX.pickup(); updateCoinUI(); renderCShop(); } else toast("Not enough coins"); }); row.appendChild(b); l.appendChild(row); }
}
function openCShop() { renderCShop(); show("cshop"); document.exitPointerLock(); SFX.meow(); }
function trainerBattle() { const ids = Object.keys(SPECIES).filter(s => !SPECIES[s].legend && SPECIES[s].role !== "block"); const id = ids[Math.floor(Math.random() * ids.length)]; const avg = Math.max(5, Math.round(cteam.reduce((a, c) => a + c.level, 0) / Math.max(1, cteam.length))); startBattle(makeCreature(id, avg + 1), null, { trainer: true, intro: "The Creature Trainer challenges you!" }); }
const BADGES = [{ id: "forest", name: "Forest Badge", ic: "🌿" }, { id: "cave", name: "Cave Badge", ic: "👻" }, { id: "fire", name: "Fire Badge", ic: "🔥" }, { id: "water", name: "Water Badge", ic: "💧" }, { id: "sky", name: "Sky Badge", ic: "🌪️" }, { id: "psychic", name: "Mind Badge", ic: "🔮" }, { id: "lava", name: "Magma Badge", ic: "🌋" }, { id: "legendary", name: "Legend Badge", ic: "⭐" }];
// each badge sends themed building blocks (plus coins/XP) back to Thomas's pack for use in the main world
const BADGE_REWARDS = {
  forest: { items: [[WOOD, 8], [LEAVES, 8]], coins: 15, xp: 30 },
  cave: { items: [[CRYSTAL, 6]], coins: 20, xp: 40 },
  fire: { items: [[FIRESTONE, 10]], coins: 20, xp: 40 },
  water: { items: [[BRICK, 12]], coins: 20, xp: 40 },
  lava: { items: [[FIRESTONE, 10], [COBBLE, 8]], coins: 25, xp: 50 },
  psychic: { items: [[CRYSTAL, 8]], coins: 25, xp: 50 },
  sky: { items: [[BOUNCE, 4], [LAUNCH, 2]], coins: 25, xp: 50 },
  legendary: { items: [[CRYSTAL, 16], [BRICK, 16]], coins: 60, xp: 120 }
};
function grantRealmReward(badge) {
  const r = BADGE_REWARDS[badge]; if (!r) return;
  if (r.items) for (const it of r.items) addItem(it[0], it[1]);
  if (r.coins) addCoins(r.coins);
  if (r.xp) addXP(r.xp);
  toast("Badge reward sent to your pack: build with these blocks back home!");
  if (badge === "legendary") showBanner("Champion! Creature-realm blocks are yours to keep.");
}
function renderBadgeCase() { const el = $("badgeList"); if (!el) return; el.innerHTML = ""; let n = 0; for (const bd of BADGES) { const got = cbadges.has(bd.id); if (got) n++; const d = document.createElement("div"); d.className = "trophy" + (got ? " got" : ""); d.innerHTML = "<div class='ti'>" + (got ? bd.ic : "❔") + "</div><div class='tn'>" + (got ? bd.name : "???") + "</div>"; el.appendChild(d); } const h = $("badgeCount"); if (h) h.textContent = n + " / " + BADGES.length; }
function openBadgeCase() { if (realmWins >= 3 && !cbadges.has("forest")) { cbadges.add("forest"); showBanner("Forest Badge earned!"); SFX.victory(); toast("Badge Master: you've proven yourself. Take the Forest Badge!"); grantRealmReward("forest"); } renderBadgeCase(); show("badgecase"); document.exitPointerLock(); }
function renderCTeam() {
  const el = $("cteamList"); if (!el) return; el.innerHTML = "";
  const hd = t => { const h = document.createElement("div"); h.className = "muted"; h.style.cssText = "font-size:12px;letter-spacing:1px;margin:8px 0 4px"; h.textContent = t; el.appendChild(h); };
  hd("TEAM (" + cteam.length + "/6)");
  if (!cteam.length) { const e = document.createElement("div"); e.className = "muted"; e.textContent = "No creatures yet. Tame some in the realm!"; el.appendChild(e); }
  cteam.forEach((c, i) => { const row = document.createElement("div"); row.className = "craftRow"; row.innerHTML = "<span><b>" + (i === 0 ? "★ " : "") + (c.shiny ? "✨" : "") + c.name + "</b> Lv" + c.level + " " + SPECIES[c.sp].type + "<br><span class='muted'>HP " + (c.hp | 0) + "/" + c.maxHp + " · ♥" + c.friendship + " · " + c.moves.map(m => MOVES[m].name).join(", ") + "</span></span>"; if (i > 0) { const b = document.createElement("button"); b.className = "mk"; b.textContent = "Lead"; b.addEventListener("pointerdown", e => { e.preventDefault(); cteam.unshift(cteam.splice(i, 1)[0]); renderCTeam(); }); row.appendChild(b); } el.appendChild(row); });
  if (cstorage.length) { hd("STORAGE SHRINE (" + cstorage.length + ")"); cstorage.forEach((c, i) => { const row = document.createElement("div"); row.className = "craftRow no"; row.innerHTML = "<span><b>" + (c.shiny ? "✨" : "") + c.name + "</b> Lv" + c.level + " " + SPECIES[c.sp].type + "</span>"; if (cteam.length < 6) { const b = document.createElement("button"); b.className = "mk"; b.textContent = "Take"; b.addEventListener("pointerdown", e => { e.preventDefault(); cteam.push(cstorage.splice(i, 1)[0]); renderCTeam(); }); row.appendChild(b); } el.appendChild(row); }); }
}
function toggleCTeam() { const o = $("cteamui"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderCTeam(); o.classList.remove("hidden"); } }
function renderCDex() { const el = $("cdexList"); if (!el) return; el.innerHTML = ""; let n = 0; const ids = Object.keys(SPECIES); for (const id of ids) { const got = cdex.has(id); if (got) n++; const sp = SPECIES[id]; const row = document.createElement("div"); row.className = "craftRow" + (got ? "" : " no"); row.innerHTML = "<span><b>" + (got ? sp.name : "???") + "</b>" + (got ? " <span class='muted'>" + sp.type + (sp.legend ? " · legendary" : "") + "</span>" : "") + "</span>"; el.appendChild(row); } const h = $("cdexCount"); if (h) h.textContent = n + " / " + ids.length; }
function toggleCDex() { const o = $("cdexui"); const open = !o.classList.contains("hidden"); if (open) o.classList.add("hidden"); else { renderCDex(); o.classList.remove("hidden"); } }
// ---- arena bosses + legendary fights + the Snoozer road block ----
let realmBosses = [], realmSnoozer = null, realmHinted = {};
const BOSS_PLAN = [
  { id: "shadeling", badge: "cave", x: -24, z: 6, name: "Gengar, the Cave Phantom" },
  { id: "emberwing", badge: "fire", x: 24, z: 6, name: "Charizard, the Fire Drake" },
  { id: "tidequeen", badge: "water", x: 8, z: 26, name: "Kyogre of the Deep" },
  { id: "terraking", badge: "lava", x: -8, z: -26, name: "Groudon of the Magma" },
  { id: "psyclone", badge: "psychic", x: -26, z: -6, name: "Mewtwo, the Mind Tyrant" },
  { id: "skywyrm", badge: "sky", x: 26, z: -10, name: "Rayquaza, the Sky Serpent" }
];
function spawnRealmBoss(id, badge, x, z, label) {
  const g = buildCreatureModel(id, false); g.scale.multiplyScalar(1.5); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  realmBosses.push({ id, badge, g, x, z, label, t: Math.random() * 6, final: badge === "legendary" });
}
// classic route network: sandy trails from the hub to every arena, numbered signs, roaming trainers
function addRouteSign(x, z, text) {
  if (!portalSignGroup) { portalSignGroup = new THREE.Group(); scene.add(portalSignGroup); }
  const s = makeSign(text, "#ffe066"); s.scale.set(2.4, 0.4, 1); s.position.set(x + 0.5, surfaceY(x, z) + 2.2, z + 0.5); portalSignGroup.add(s);
}
function buildRealmRoutes() {
  ensureGen(0, 4, 36);                                  // paths span the whole arena ring, generate once up front
  BOSS_PLAN.forEach((b, i) => {
    const steps = Math.max(Math.abs(b.x), Math.abs(b.z));
    for (let s = 2; s <= steps; s++) { const t = s / steps, x = Math.round(b.x * t), z = Math.round(b.z * t); const y = surfaceY(x, z) - 1; if (getBlock(x, y, z) === GRASS) { setRaw(x, y, z, SAND); markDirty(x, z); } }
    addRouteSign(Math.round(b.x * 0.5), Math.round(b.z * 0.5), "ROUTE " + (i + 1) + " · " + b.badge.toUpperCase());
    if (i < 2) { const tx = Math.round(b.x * 0.66), tz = Math.round(b.z * 0.66); const g = buildNPC("trainer"); g.position.set(tx + 0.5, surfaceY(tx, tz), tz + 0.5); scene.add(g); realmNPCs.push({ kind: "trainer", g, route: true, challenged: false }); }
  });
}
function spawnRealmBosses() {
  for (const b of BOSS_PLAN) if (!realmBossDown[b.badge]) spawnRealmBoss(b.id, b.badge, b.x, b.z, b.name);
  if (!realmBossDown.legendary) spawnRealmBoss("allbeast", "legendary", 0, 34, "Arceus, the Creator");   // final, gated until others fall
}
function clearRealmBosses() { for (const b of realmBosses) scene.remove(b.g); realmBosses = []; if (realmSnoozer) { scene.remove(realmSnoozer.g); realmSnoozer = null; } }
// themed set-piece dressing around each legendary arena (centers kept clear so bosses are not buried)
function ensureGen(x, z, r) { const c0x = Math.floor((x - r) / CH), c1x = Math.floor((x + r) / CH), c0z = Math.floor((z - r) / CH), c1z = Math.floor((z + r) / CH); for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) genChunk(cx, cz); }
function dressArena(kind, x, z) {
  ensureGen(x, z, 6); const y = surfaceY(x, z);
  if (kind === "cave") {                                   // Gengar: dark floor + back wall with two glowing eyes
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { if (Math.hypot(dx, dz) <= 4 && Math.hypot(dx, dz) > 1.5) setRaw(x + dx, y, z + dz, COBBLE); }
    for (let dx = -4; dx <= 4; dx++) for (let yy = 1; yy <= 4; yy++) setRaw(x + dx, y + yy, z - 5, COBBLE);
    setRaw(x - 2, y + 3, z - 5, CRYSTAL); setRaw(x + 2, y + 3, z - 5, CRYSTAL);
  } else if (kind === "fire") {                            // Charizard: firestone ring with lava caps
    for (let a = 0; a < 16; a++) { const ax = x + Math.round(Math.cos(a / 16 * 6.28) * 4), az = z + Math.round(Math.sin(a / 16 * 6.28) * 4); for (let yy = 1; yy <= 2 + (a % 2); yy++) setRaw(ax, y + yy, az, FIRESTONE); setRaw(ax, y + 3 + (a % 2), az, LAVA); }
  } else if (kind === "water") {                           // Kyogre: a moat ring with brick pillars
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { const d = Math.hypot(dx, dz); if (d > 2.4 && d <= 4) setRaw(x + dx, y, z + dz, WATER); }
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) for (let yy = 1; yy <= 3; yy++) setRaw(x + px, y + yy, z + pz, BRICK);
  } else if (kind === "lava") {                            // Groudon: cracked ground + lava pockets
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { const d = Math.hypot(dx, dz); if (d <= 4 && d > 1.5) setRaw(x + dx, y, z + dz, ((dx + dz) & 1) ? FIRESTONE : STONE); }
    for (const [px, pz] of [[3, 1], [-3, -1], [1, 3], [-1, -3]]) setRaw(x + px, y, z + pz, LAVA);
  } else if (kind === "psychic") {                         // Mewtwo: floating crystal blocks
    for (const [px, py, pz] of [[-3, 3, 0], [3, 3, 0], [0, 4, -3], [0, 4, 3], [-2, 5, -2], [2, 5, 2]]) setRaw(x + px, y + py, z + pz, CRYSTAL);
    for (const [px, pz] of [[-3, -3], [3, 3]]) for (let yy = 1; yy <= 2; yy++) setRaw(x + px, y + yy, z + pz, BRICK);
  } else if (kind === "sky") {                             // Rayquaza: a tall tower offset from the arena
    const tx = x + 5; for (let yy = 1; yy <= 11; yy++) setRaw(tx, y + yy, z, (yy % 3) ? BRICK : CRYSTAL); setRaw(tx + 1, y + 11, z, CRYSTAL); setRaw(tx - 1, y + 11, z, CRYSTAL);
  } else if (kind === "divine") {                          // Arceus: a glowing crystal ring
    for (let a = 0; a < 12; a++) { const ax = x + Math.round(Math.cos(a / 12 * 6.28) * 4), az = z + Math.round(Math.sin(a / 12 * 6.28) * 4); setRaw(ax, y + 1, az, CRYSTAL); }
  }
}
function dressBossArenas() {
  const kindByBadge = { cave: "cave", fire: "fire", water: "water", lava: "lava", psychic: "psychic", sky: "sky" };
  for (const p of BOSS_PLAN) if (!realmBossDown[p.badge]) dressArena(kindByBadge[p.badge], p.x, p.z);
  if (!realmBossDown.legendary) dressArena("divine", 0, 34);
}
function dressSnorlaxBridge() {                            // Snorlax blocks a plank bridge over a river
  if (realmBossDown.snoozer) return;
  const x = 0, z = 15; ensureGen(x, z, 6); const gy = surfaceY(x, z);   // surfaceY is noise-based; Snorlax stands at gy, so deck the block below it
  for (let dx = -5; dx <= 5; dx++) {
    setRaw(x + dx, gy - 1, z, PLANKS);                         // walkable deck (top face at gy)
    for (let yy = gy; yy <= gy + 2; yy++) setRaw(x + dx, yy, z, AIR);   // clear any lake water over the deck
    setRaw(x + dx, gy, z - 1, WOOD); setRaw(x + dx, gy, z + 1, WOOD);   // side rails
  }
}
function spawnSnoozer() { if (realmBossDown.snoozer) return; const x = 0, z = 15; const g = buildCreatureModel("snoozer", false); g.scale.multiplyScalar(1.4); g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); g.rotation.y = Math.PI; scene.add(g); realmSnoozer = { g, x, z }; }
function teamAvgLevel() { return cteam.length ? Math.round(cteam.reduce((a, c) => a + c.level, 0) / cteam.length) : 5; }
function challengeBoss(b) {
  if (b.final) {
    const need = BOSS_PLAN.length, have = BOSS_PLAN.filter(p => realmBossDown[p.badge]).length;
    if (have < need) { toast("The Allbeast slumbers. Defeat all " + need + " arena bosses first (" + have + "/" + need + ")."); return; }
  }
  const lvl = Math.max(12, teamAvgLevel() + 6) + (b.final ? 8 : 0);
  startBattle(makeCreature(b.id, lvl), null, { boss: true, badge: b.badge, bossRef: b, intro: (b.label || b.id) + " rises to battle!" });
}
function feedSnoozer() {
  if (citems.food > 0) { citems.food--; realmBossDown.snoozer = true; scene.remove(realmSnoozer.g); realmSnoozer = null; addCoins(20); showBanner("Snorlax waddles off! The path is clear."); toast("You fed Snorlax. It happily moves aside. +20 coins"); SFX.victory(); }
  else { toast("Snorlax is fast asleep and hungry. Buy Creature Food from the Shop, then feed it."); }
}
function realmInteract() {   // Use near a realm NPC, boss, or the Snoozer. returns true if handled
  if (DIM !== "realm") return false;
  if (realmSnoozer && realmSnoozer.g.position.distanceTo(player.pos) < 3.2) { feedSnoozer(); return true; }
  let bb = null, bd = 3.6; for (const b of realmBosses) { const d = b.g.position.distanceTo(player.pos); if (d < bd) { bd = d; bb = b; } }
  if (bb) { challengeBoss(bb); return true; }
  let np = null, nd = 3.4; for (const n of realmNPCs) { const d = n.g.position.distanceTo(player.pos); if (d < nd) { nd = d; np = n; } }
  if (np) {
    if (np.kind === "nurse") healTeam(); else if (np.kind === "shop") openCShop(); else if (np.kind === "trainer") trainerBattle(); else if (np.kind === "badge") openBadgeCase(); else if (np.kind === "teacher") teachMove();
    return true;
  }
  if (pushBoulder()) return true;   // shove the puzzle boulder toward the pressure plate
  // fishing: stand by water and press Use to hook a water creature
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (getBlock(px + dx, py, pz + dz) === WATER || getBlock(px + dx, py - 1, pz + dz) === WATER) { goFishing(); return true; } }
  return false;
}
function goFishing() {
  if (battle || cmenuOpen) return;
  toast("You cast a line into the water...");
  const pool = ["frogblade", "squirt", "psy", "piplup"];
  const id = Math.random() < 0.12 ? "tidequeen" : pool[Math.floor(Math.random() * pool.length)];   // water dwellers, a rare giant catch
  openEncounter(makeCreature(id, 4 + Math.floor(Math.random() * 6), { shiny: Math.random() < 0.1 }), null);
}
function teachMove() {
  const c = cteam.find(x => x.moves.length < 4);
  if (!c) { toast("Move Teacher: your creatures have learned all they can for now."); return; }
  const learnable = ["quickattack", "dragonstrike", "psychicwave", "fireblast", "watersurge", "shadowball", "iceslash"].filter(m => c.moves.indexOf(m) < 0);
  if (!learnable.length) { toast("Move Teacher: nothing new to teach " + c.name + "."); return; }
  const mv = learnable[Math.floor(Math.random() * learnable.length)]; c.moves.push(mv);
  showBanner(c.name + " learned " + MOVES[mv].name + "!"); SFX.levelUp(); toast("Move Teacher taught " + c.name + " a new move.");
}
