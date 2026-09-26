/* monsters.js: Monsters: types, skins, AI, spawning.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- ENEMIES (purple monsters) — EnemySystem + MonsterAI ----------
// types: crawler, brute (slam windup), spitter (ranged), ghost (phasing),
//        screamer (summons backup), miner (digs weak blocks). Elites + loot + day scaling.
// TODO: portal guard, real A* pathfinding, full mini-boss variants.
let monsters = [];
const MTYPE = {
  crawler:  { col: 0xb05bff, sc: 0.85, hp: 28, speed: 3.3, dmg: 3, xp: 8,  flee: true,  loot: [[I_STICK, 1, 0.4]] },
  brute:    { col: 0x6a1fb0, sc: 1.3,  hp: 70, speed: 1.3, dmg: 7, xp: 16, slam: true,  loot: [[COBBLE, 2, 0.6], [I_APPLE, 1, 0.3]] },
  spitter:  { col: 0xd24bff, sc: 0.95, hp: 34, speed: 1.9, dmg: 0, xp: 14, ranged: true, flee: true, loot: [[I_STICK, 1, 0.5]] },
  archer:   { col: 0xd8d4c4, sc: 0.95, hp: 30, speed: 2.1, dmg: 4, xp: 18, ranged: true, archer: true, loot: [[I_ARROW, 3, 0.85], [I_FEATHER, 1, 0.35], [I_BOW, 1, 0.05]] },
  ghost:    { col: 0xc9a8ff, sc: 0.95, hp: 24, speed: 3.9, dmg: 4, xp: 18, ghost: true,  loot: [[I_APPLE, 1, 0.4]] },
  screamer: { col: 0x9a3df0, sc: 1.15, hp: 40, speed: 1.7, dmg: 4, xp: 22, tall: true, summon: true, loot: [[I_APPLE, 1, 0.5], [PLANKS, 2, 0.4]] },
  miner:    { col: 0x7c4bd0, sc: 1.0,  hp: 46, speed: 1.9, dmg: 5, xp: 20, digger: true, loot: [[COBBLE, 3, 0.7], [I_SPICK, 1, 0.06]] },
  firedemon:{ col: 0xff5a1e, sc: 1.1,  hp: 55, speed: 2.1, dmg: 6, xp: 24, ranged: true, fire: true, loot: [[FIRE_CRYSTAL, 2, 0.6]] },
  lavaworm: { col: 0xff8a2e, sc: 0.9,  hp: 38, speed: 3.3, dmg: 5, xp: 20, fire: true, loot: [[FIRE_CRYSTAL, 1, 0.5]] },
  shadowknight: { col: 0x14141c, sc: 1.2, hp: 64, speed: 1.9, dmg: 7, xp: 28, shadow: true, loot: [[ENDSTONE, 2, 0.5]] },
  endstalker:   { col: 0x241f33, sc: 0.9, hp: 30, speed: 4.3, dmg: 5, xp: 24, shadow: true, loot: [[ENDSTONE, 1, 0.5]] }
};
function makeBar() { const c = document.createElement("canvas"); c.width = 48; c.height = 8; const x = c.getContext("2d"); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(1.0, 0.16, 1); function up(f) { x.clearRect(0, 0, 48, 8); x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, 48, 8); x.fillStyle = f > .5 ? "#4ade80" : f > .25 ? "#facc15" : "#ef4444"; x.fillRect(1, 1, 46 * Math.max(0, f), 6); t.needsUpdate = true; } up(1); return { sprite: s, up }; }
function makeTag(text) { const c = document.createElement("canvas"); c.width = 128; c.height = 32; const x = c.getContext("2d"); x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(0, 0, 128, 32); x.fillStyle = "#fff"; x.font = "bold 20px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 64, 17); const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(1.3, 0.33, 1); return s; }
function monsterLabel(cfg, type) { if (cfg.archer) return "ARCHER"; if (cfg.fire) return type === "lavaworm" ? "WORM" : "FIRE"; if (cfg.shadow) return type === "endstalker" ? "STALK" : "KNIGHT"; if (cfg.ranged) return "RANGED"; if (cfg.summon) return "SUMMON"; if (cfg.digger) return "DIGGER"; if (cfg.ghost) return "GHOST"; if (cfg.slam) return "BRUTE"; return "MELEE"; }
function applyCbMarkers() { for (const m of monsters) if (m.mark) m.mark.visible = settings.cbMarkers; }
// painted monster skins: a grayscale pattern per creature (scales, hide, spots, stripes, rock, magma, plate, bone, mist)
// tinted by the monster's colour; fire creatures also get a glow mask so their magma veins burn
const MOB_SKIN = {}, MOB_PAT = { crawler: "scales", brute: "hide", spitter: "spots", ghost: "mist", screamer: "stripes", miner: "rock", archer: "bone", firedemon: "magma", lavaworm: "magma", shadowknight: "plate", endstalker: "spots" };
function mobSkin(type, glow) {
  const key = type + (glow ? ":glow" : ""); if (key in MOB_SKIN) return MOB_SKIN[key];
  const pat = MOB_PAT[type] || "hide", S = 64, seed = type.length * 131;
  let tex = null;
  try {
    const cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d");
    if (x && x.createImageData && x.putImageData) {
      const img = x.createImageData(S, S), D = img.data;
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const n = vn(px * 0.18 + seed, py * 0.18), g = hsh(px * 7 + seed, py * 13 + seed);
        let v = 196 + (g - 0.5) * 34 + (n - 0.5) * 50, e = 0;
        if (pat === "scales") { const cx = px & 7, cy = (py + ((px >> 3) & 1) * 4) & 7; if (cx === 0 || cy === 0) v *= 0.62; else if (cx < 3 && cy < 3) v *= 1.12; }
        else if (pat === "hide") { v *= 0.8 + n * 0.4; if (Math.abs(((px * 0.7 + py) % 23) - 11) < 0.6 && hsh(px >> 3, py >> 3) > 0.6) v *= 0.55; }
        else if (pat === "spots") { const cx = (px & 15) - 8, cy = (py & 15) - 8, r = 3 + hsh(px >> 4, (py >> 4) + seed) * 3; if (cx * cx + cy * cy < r * r) v *= 0.62; }
        else if (pat === "stripes") { if (((px + py * 0.35) % 12) < 3) v *= 0.6; }
        else if (pat === "rock") { const m = vn(px * 0.35 + 9, py * 0.35 - seed); v = 150 + m * 110 + (g - 0.5) * 30; if (Math.abs(m - 0.5) < 0.03) v *= 0.55; }
        else if (pat === "magma") { const m = vn(px * 0.22 + 3, py * 0.22 + seed); v = 120 + g * 40; if (Math.abs(m - 0.5) < 0.045) { v = 255; e = 1; } else if (Math.abs(m - 0.5) < 0.08) { v = 200; e = 0.4; } }
        else if (pat === "plate") { if ((px & 15) === 0 || (py & 15) === 0) v *= 0.5; else if (((px & 15) === 3 && (py & 15) === 3)) v = 250; else v *= 0.9 + ((15 - (py & 15)) / 15) * 0.2; }
        else if (pat === "bone") { v = 226 + (g - 0.5) * 22; if (Math.abs(vn(px * 0.3, py * 0.3 + seed) - 0.5) < 0.025) v *= 0.6; }
        else if (pat === "mist") { v = 190 + Math.sin(px * 0.4 + n * 6) * 40 + (g - 0.5) * 20; }
        const o = (py * S + px) * 4, c = glow ? e * 255 : Math.max(0, Math.min(255, v));
        D[o] = c; D[o + 1] = c; D[o + 2] = c; D[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
  } catch (err) { tex = null; }
  return (MOB_SKIN[key] = tex);
}
function spawnMonster(x, z, type) {
  if (!type) { const rl = Math.random();
    type = isNight()
      ? (rl < 0.44 ? "crawler" : rl < 0.58 ? "brute" : rl < 0.72 ? "archer" : rl < 0.82 ? "spitter" : rl < 0.9 ? "ghost" : rl < 0.96 ? "screamer" : "miner")  // mostly crawlers, fewer elites types
      : (rl < 0.55 ? "crawler" : rl < 0.82 ? "brute" : "miner"); }
  const cfg = MTYPE[type], elite = Math.random() < 0.05, sc = cfg.sc * (elite ? 1.5 : 1), col = cfg.col;
  const dayMul = Math.min(1.8, 1 + 0.035 * (day - 1));   // gentler growth over days
  const g = new THREE.Group();
  const skin = mobSkin(type), veins = cfg.fire ? mobSkin(type, true) : null;
  const mat = c => { const m = new THREE.MeshLambertMaterial({ color: c, transparent: !!(cfg.ghost || cfg.shadow), opacity: cfg.ghost ? 0.55 : cfg.shadow ? 0.82 : 1 }); if (skin) m.map = skin; return m; };
  const headY = (cfg.tall ? 1.95 : 1.55) * sc;
  const body = new THREE.Mesh(new THREE.BoxGeometry((cfg.tall ? 0.5 : 0.7) * sc, (cfg.tall ? 1.15 : 0.85) * sc, 0.45 * sc), mat(col)); body.position.y = (cfg.tall ? 1.05 : 0.9) * sc; g.add(body);
  const emBase = cfg.fire ? (veins ? 0xff6a1a : 0x6a1800) : cfg.shadow ? 0x14001f : 0x000000;
  if (cfg.fire || cfg.shadow) { body.material.emissive.setHex(emBase); body.material.emissiveIntensity = cfg.fire ? 0.85 : 0.5; }
  if (veins) { body.material.emissiveMap = veins; body.material.emissive.setHex(0xff6a1a); body.material.emissiveIntensity = 1.6; }   // glowing magma veins
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * sc, 0.55 * sc, 0.55 * sc), mat(col)); head.position.y = headY; g.add(head);
  const eC = cfg.archer ? 0x1a1a22 : cfg.fire ? 0xffd23d : cfg.shadow ? 0xc24bff : cfg.ranged ? 0x7afcff : cfg.ghost ? 0xffffff : cfg.summon ? 0xffd23d : 0xff3df0;
  const eyeMat = new THREE.MeshLambertMaterial({ color: eC, emissive: eC, emissiveIntensity: 1.0 });
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.13, cfg.summon ? 0.16 : 0.1, 0.05), eyeMat); eL.position.set(-0.15, headY + 0.05, 0.28 * sc); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.15; g.add(eR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34 * sc, cfg.summon ? 0.2 : 0.08, 0.05), new THREE.MeshLambertMaterial({ color: 0x140014 })); mouth.position.set(0, headY - 0.18 * sc, 0.28 * sc); g.add(mouth);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(cfg.digger ? 0.22 : 0.16, 0.6 * sc, 0.18), mat(col)); armL.geometry.translate(0, -0.25 * sc, 0); armL.position.set(-0.45 * sc, (cfg.tall ? 1.6 : 1.35) * sc, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.45 * sc; g.add(armR);
  const clawCol = cfg.digger ? 0xffd9a0 : 0xe9e2ff, cs = cfg.digger ? 1.7 : 1;
  const cl = (px) => { const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.07 * cs, 0.16 * cs, 0.07 * cs), new THREE.MeshLambertMaterial({ color: clawCol })); c2.position.set(px, (cfg.tall ? 1.25 : 1.02) * sc, 0); g.add(c2); };
  cl(-0.45 * sc); cl(0.45 * sc);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5 * sc, 0.2), mat(col)); legL.geometry.translate(0, -0.25 * sc, 0); legL.position.set(-0.15, 0.5 * sc, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  if (type === "brute") { const hMat = new THREE.MeshLambertMaterial({ color: 0x2a0a3a }); const hL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), hMat); hL.position.set(-0.2, 1.98 * sc, 0); hL.rotation.z = 0.35; g.add(hL); const hR = hL.clone(); hR.position.x = 0.2; hR.rotation.z = -0.35; g.add(hR); }
  if (cfg.archer) {                                   // a bony archer: rib bands, a hood and a longbow in the right hand
    for (let k = 0; k < 3; k++) { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.72 * sc, 0.05, 0.47 * sc), new THREE.MeshLambertMaterial({ color: 0x8a8676 })); rb.position.y = (0.72 + k * 0.2) * sc; g.add(rb); }
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.66 * sc, 0.2 * sc, 0.6 * sc), new THREE.MeshLambertMaterial({ color: 0x3a3f36 })); hood.position.y = headY + 0.28 * sc; g.add(hood);
    const bow = new THREE.Group(), bm = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), bm); l1.position.set(0, 0.18, 0.06); l1.rotation.x = 0.35; bow.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), bm); l2.position.set(0, -0.18, 0.06); l2.rotation.x = -0.35; bow.add(l2);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.76, 0.012), new THREE.MeshLambertMaterial({ color: 0xeeeeee })); st.position.z = 0.13; bow.add(st);
    bow.position.set(0, -0.45 * sc, 0.12); armR.add(bow);
  }
  if (elite) { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,90,255,0.85)", "rgba(150,0,255,0)"), depthWrite: false, transparent: true, fog: false })); aura.scale.set(2.6 * sc, 2.6 * sc, 1); aura.position.y = headY * 0.8; g.add(aura); }
  const bar = makeBar(); bar.sprite.position.y = (cfg.tall ? 2.6 : 2.25) * sc; g.add(bar.sprite);
  const mark = makeTag(monsterLabel(cfg, type) + (elite ? "+" : "")); mark.position.y = (cfg.tall ? 2.95 : 2.6) * sc; mark.visible = settings.cbMarkers; g.add(mark);
  g.position.set(x + 0.5, surfaceY(x, z), z + 0.5); scene.add(g);
  const hp = Math.max(1, Math.round(cfg.hp * (elite ? 2 : 1) * dayMul * 0.66 * ngMul));   // easier base, scaled up by New Game Plus
  monsters.push({ g, type, sc, hr: (cfg.tall ? 0.36 : 0.44) * sc + 0.08, hh: (cfg.tall ? 2.3 : 1.9) * sc, archer: !!cfg.archer, hp, max: hp, speed: cfg.speed, dmg: Math.max(1, Math.round(cfg.dmg * (elite ? 1.5 : 1) * dayMul * 0.7 * (1 + (ngMul - 1) * 0.6))), xp: Math.round(cfg.xp * (elite ? 2.5 : 1)),
    ranged: !!cfg.ranged, ghost: !!cfg.ghost, slam: !!cfg.slam, summon: !!cfg.summon, digger: !!cfg.digger, flee: !!cfg.flee, elite,
    loot: cfg.loot || [], emBase, shootCd: 1.6, summonCd: 4 + Math.random() * 4, digCd: 1.5, touch: 0, flash: 0, windup: 0, slamCd: 0,
    bar, mark, body, legL, legR, armL, armR, moveT: 0, dir: Math.random() * 6.28, state: "idle", aggro: false, dead: false, dt: 0 });
}
function surfaceY(x, z) { for (let y = WORLD_H - 1; y >= 0; y--) if (isSolidBlock(getBlock(Math.floor(x), y, Math.floor(z)))) return y + 1; return SEA + 1; }
// gravity for creatures: fall with acceleration when unsupported (so they drop if you dig under them), step up onto ground
function fallToGround(o, dt) {
  const gy = surfaceY(o.g.position.x, o.g.position.z);
  if (o.g.position.y > gy + 0.05) { o._vy = (o._vy || 0) - 26 * dt; o.g.position.y += o._vy * dt; if (o.g.position.y <= gy) { o.g.position.y = gy; o._vy = 0; } }
  else { o.g.position.y += (gy - o.g.position.y) * Math.min(1, dt * 12); o._vy = 0; }
}
function updateMonsters(dt) {
  const night = isNight();
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m.dead) { m.dt += dt; m.g.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 3)); m.g.rotation.z += dt * 6; m.g.position.y -= dt * 1.5; if (m.dt > 0.5) { scene.remove(m.g); monsters.splice(i, 1); } continue; }
    const dx = player.pos.x - m.g.position.x, dz = player.pos.z - m.g.position.z, d = Math.hypot(dx, dz) || 0.0001;
    const aggroR = (night ? 13 : 10) + (m.summon ? 4 : 0) + (m.elite ? 3 : 0);
    if (!m.aggro && d < aggroR) { m.aggro = true; m.summon ? SFX.screech() : SFX.growl(); }
    else if (m.aggro && d > aggroR * 1.7) { m.aggro = false; }
    if (m.flash > 0) m.flash -= dt;
    if (m.slow > 0) { m.slow -= dt; if (m.slow <= 0 && m._bspd) m.speed = m._bspd; }   // ice slow wears off
    if (frostCells.length) { m.frostCd = (m.frostCd || 0) - dt; if (m.frostCd <= 0) { for (const c of frostCells) { if (Math.hypot(c[0] + 0.5 - m.g.position.x, c[2] + 0.5 - m.g.position.z) < 3 && Math.abs(c[1] + 1 - m.g.position.y) < 2.5) { if (!m._bspd) m._bspd = m.speed; m.speed = m._bspd * 0.4; m.slow = Math.max(m.slow || 0, 1.2); m.flash = 0.1; hitSpark(m.g.position, 0xbfe8ff); m.frostCd = 1; break; } } if (m.frostCd <= 0) m.frostCd = 0.5; } }   // Frost blocks freeze nearby monsters
    if (m.burn > 0) { m.burn -= dt; m.burnTick -= dt; if (m.burnTick <= 0) { m.burnTick = 0.5; m.hp -= 2; m.flash = 0.1; m.bar.up(Math.max(0, m.hp / m.max)); hitSpark(m.g.position, 0xff7a2a); if (m.hp <= 0 && !m.dead) { killMonster(m); continue; } } }
    if (spikeCells.length) { m.spikeCd = (m.spikeCd || 0) - dt; if (m.spikeCd <= 0) { for (const c of spikeCells) { const sdx = c[0] + 0.5 - m.g.position.x, sdz = c[2] + 0.5 - m.g.position.z; if (sdx * sdx + sdz * sdz < 1.2 && Math.abs(c[1] + 1 - m.g.position.y) < 1.6) { m.hp -= 4; m.flash = 0.12; m.bar.up(Math.max(0, m.hp / m.max)); hitSpark(m.g.position, 0xcfd6e0); m.spikeCd = 0.6; break; } } if (m.hp <= 0 && !m.dead) { killMonster(m); continue; } } }
    if (m.touch > 0) m.touch -= dt;
    if (m.slamCd > 0) m.slamCd -= dt;
    if (m.summonCd > 0) m.summonCd -= dt;
    if (m.digCd > 0) m.digCd -= dt;
    const lowHp = m.hp < m.max * 0.28, face = () => { if (d > 0.3) m.g.rotation.y = Math.atan2(dx, dz); };
    let moving = false;

    if (m.windup > 0) {                                  // attack telegraph (readable)
      m.windup -= dt; face(); m.armL.rotation.x = -1.2; m.armR.rotation.x = -1.2;
      if (m.windup <= 0) {
        if (m.slam) { SFX.slam(); if (d < 2.7) { damage(m.dmg); addShake(0.5); const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.6); } m.slamCd = 2.6; }
        else if (m.archer) { mobShootArrow(m); m.shootCd = 2.4 + Math.random() * 0.8; }
        else if (m.ranged) { spawnProjectile(m.g.position, player.pos); m.shootCd = 2.2; }
        m.armL.rotation.x = 0; m.armR.rotation.x = 0;
      }
    } else if (!m.aggro) {                                // idle patrol, or raid the base at night
      let tx = null, tz = null, td = 40;
      if (night) for (const c of torchCells) { const ddx = c[0] - m.g.position.x, ddz = c[2] - m.g.position.z, dd = Math.hypot(ddx, ddz); if (dd < td) { td = dd; tx = ddx; tz = ddz; } }
      if (tx !== null) { const dd = Math.hypot(tx, tz) || 1; m.g.position.x += (tx / dd) * m.speed * 0.7 * dt; m.g.position.z += (tz / dd) * m.speed * 0.7 * dt; m.g.rotation.y = Math.atan2(tx, tz); moving = true; }
      else { if (Math.random() < 0.01) m.dir += (Math.random() - .5) * 1.5; m.g.position.x += Math.sin(m.dir) * 0.5 * dt; m.g.position.z += Math.cos(m.dir) * 0.5 * dt; m.g.rotation.y = m.dir; moving = true; }
    } else if (m.flee && lowHp) {                         // retreat when hurt
      m.g.position.x -= (dx / d) * m.speed * dt; m.g.position.z -= (dz / d) * m.speed * dt; m.g.rotation.y = Math.atan2(-dx, -dz); moving = true;
    } else if (m.ranged) {                                // keep range + cast with windup
      const mv = d > 11 ? 1 : (d < 6 ? -1 : 0);
      if (mv) { m.g.position.x += (dx / d) * m.speed * dt * mv; m.g.position.z += (dz / d) * m.speed * dt * mv; moving = mv > 0; }
      face(); m.shootCd -= dt; if (d < 22 && m.shootCd <= 0) { m.windup = 0.5; m.shootCd = 2.2; }
    } else {                                              // melee chase
      if (m.slam && d < 2.7 && m.slamCd <= 0) { m.windup = 0.6; SFX.growl(); }
      else if (d > 1.1) { m.g.position.x += (dx / d) * m.speed * dt; m.g.position.z += (dz / d) * m.speed * dt; face(); moving = true; }
      else if (m.touch <= 0 && !m.slam) { damage(m.dmg); m.touch = 1.0; const k = new THREE.Vector3(-dx / d, 0, -dz / d); player.pos.addScaledVector(k, 0.3); }
      if (m.summon && m.summonCd <= 0 && d < aggroR && monsters.length < (night ? 8 : 5)) { m.summonCd = 15; SFX.screech(); const a = Math.random() * 6.28; spawnMonster(Math.floor(m.g.position.x + Math.cos(a) * 3), Math.floor(m.g.position.z + Math.sin(a) * 3), "crawler"); }
      if (m.digger && m.digCd <= 0 && d > 1.2) {
        const bx = Math.floor(m.g.position.x + (dx / d) * 0.8), bz = Math.floor(m.g.position.z + (dz / d) * 0.8), by = Math.floor(m.g.position.y + 0.5);
        let dug = false;
        for (const yy of [by, by + 1]) { const id = getBlock(bx, yy, bz); if (isSolidBlock(id) && BLOCKS[id] && BLOCKS[id].hard < 1) { setRaw(bx, yy, bz, AIR); markDirty(bx, bz); markDirty(bx + 1, bz); markDirty(bx - 1, bz); markDirty(bx, bz + 1); markDirty(bx, bz - 1); SFX.dig(); m.digCd = 0.9; dug = true; break; } }
        if (!dug) m.digCd = 0.5;
      }
    }
    if (m.body && m.body.material.emissive) m.body.material.emissive.setHex(m.flash > 0 ? 0x771018 : (m.emBase || 0x000000));
    fallToGround(m, dt);     // gravity: falls if the ground is dug out, steps up onto hills
    if (moving && m.windup <= 0) { m.moveT += dt * 9; const s = Math.sin(m.moveT) * 0.5; m.legL.rotation.x = s; m.legR.rotation.x = -s; m.armL.rotation.x = -s; m.armR.rotation.x = s; }
    else if (m.windup <= 0) { m.legL.rotation.x *= 0.8; m.legR.rotation.x *= 0.8; }
  }
  // spawning
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (DIM === "overworld") {
      spawnTimer = isNight() ? 6.5 : 16;
      const cap = isNight() ? 5 : 3;             // gentler raids: fewer monsters, slower spawns, time to react
      if (monsters.length < cap) {
        const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 8;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        if (!nearTorch(sxp, szp, 9)) spawnMonster(sxp, szp);
      }
    } else if (DIM === "fire") {
      spawnTimer = 7;
      if (monsters.length < 4) {
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 8;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        spawnMonster(sxp, szp, Math.random() < 0.5 ? "firedemon" : "lavaworm");
      }
    } else if (DIM === "end") {
      spawnTimer = 6;
      if (monsters.length < 6) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 8;
        let sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        if (Math.hypot(sxp, szp) > 42) { sxp = Math.floor(player.pos.x); szp = Math.floor(player.pos.z); }  // keep on the island
        spawnMonster(sxp, szp, Math.random() < 0.5 ? "shadowknight" : "endstalker");
      }
    } else if (DIM === "sky") {
      spawnTimer = 7;
      if (monsters.length < 4) {
        const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 6;
        const sxp = Math.floor(player.pos.x + Math.cos(a) * r), szp = Math.floor(player.pos.z + Math.sin(a) * r);
        spawnMonster(sxp, szp, Math.random() < 0.6 ? "ghost" : "crawler");
      }
    }
  }
  // alarm bells ring when monsters raid the base at night
  if (alarmCells.length && isNight()) { alarmCd -= dt; if (alarmCd <= 0) { for (const c of alarmCells) { let near = false; for (const m of monsters) if (!m.dead && Math.hypot(c[0] + 0.5 - m.g.position.x, c[2] + 0.5 - m.g.position.z) < 12) { near = true; break; } if (near) { alarmCd = 8; SFX.screech(); showBanner("Alarm! Monsters are raiding the base."); break; } } } }
}
let spawnTimer = 6, alarmCd = 0, blockHealCd = 0;
// heal blocks mend Thomas when he stands near one
function updateBlockPowers(dt) {
  if (!healCells.length) return;
  blockHealCd -= dt; if (blockHealCd > 0) return; blockHealCd = 0.5;
  for (const c of healCells) {
    if (Math.hypot(c[0] + 0.5 - player.pos.x, c[2] + 0.5 - player.pos.z) < 2.6 && Math.abs(c[1] + 1 - player.pos.y) < 2.2) {
      if (player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 1); updateVitals(); hitSpark(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0x7cf0a0); }
      blockHealCd = 1.5; break;
    }
  }
}
