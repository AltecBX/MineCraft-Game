// Stage 3: bounce block trampoline, boss telegraphs, and boss cinematic intro.
(function () {
  // --- Bounce block: standing on slime launches Thomas ---
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  const gy = surfaceY(px, pz);
  setRaw(px, gy, pz, BOUNCE);                 // bounce block on the ground
  console.log("BOUNCE craftable=" + RECIPES.some(r => r.out === BOUNCE) + " bouncy=" + !!(BLOCKS[BOUNCE] && BLOCKS[BOUNCE].bouncy));
  player.pos.set(px + 0.5, gy + 1, pz + 0.5); player.vel.set(0, -2, 0); player.onGround = false;
  let maxVy = -99;
  for (let i = 0; i < 12; i++) { physics(0.05); if (player.vel.y > maxVy) maxVy = player.vel.y; }
  console.log("BOUNCE launched=" + (maxVy > 6) + " maxVelY=" + maxVy.toFixed(1));

  // --- Telegraph rings ---
  const tBefore = telegraphs.length;
  spawnTelegraph(player.pos.x, player.pos.z, 4, 0.5);
  console.log("TELEGRAPH spawned=" + (telegraphs.length - tBefore));
  updateTelegraphs(0.6);
  console.log("TELEGRAPH afterExpire=" + telegraphs.length);

  // --- Boss intro + music cue (fire guardian) ---
  console.log("BOSS_ACTIVE_overworld=" + bossActive());
  loadDimension("fire");
  console.log("BOSS_INTRO intro=" + (fireBoss && fireBoss.intro.toFixed(1)) + " active=" + bossActive());
  const hpB = fireBoss.hp;
  updateFireBoss(0.1);                          // during intro it should not attack
  console.log("BOSS_DURING_INTRO hpUnchanged=" + (fireBoss.hp === hpB) + " stillIntro=" + (fireBoss.intro > 0));
  // fast-forward past the intro and confirm it starts acting
  for (let i = 0; i < 30; i++) updateFireBoss(0.1);
  console.log("BOSS_AFTER_INTRO introOver=" + (fireBoss.intro <= 0));
})();
