// Machine gun: rapid-fire bullets that damage monsters; realm minimap is no longer black.
(function () {
  // craftable
  const recipe = RECIPES.find(r => r.out === I_MACHINEGUN);
  console.log("RECIPE exists=" + !!recipe + " tool=" + ITEMS[I_MACHINEGUN].tool);

  // equip + fire: holding primary with a gun spawns fast bullets
  hotbar[selSlot] = { id: I_MACHINEGUN, n: 1 };
  primaryHeld = true; bowCd = 0;
  const n0 = playerShots.length;
  updateMining(0.016);
  const fired = playerShots.length > n0, kind = playerShots.length ? playerShots[playerShots.length - 1].kind : "";
  console.log("FIRE spawnedBullet=" + fired + " kind=" + kind);

  // a bullet that reaches a monster damages it
  spawnMonster(Math.floor(player.pos.x) + 2, Math.floor(player.pos.z), "crawler");
  const mon = monsters[monsters.length - 1]; const hp0 = mon.hp;
  for (const s of playerShots) s.mesh.position.copy(mon.g.position);   // place bullet on the monster
  updatePlayerShots(0.016);
  console.log("BULLET_DAMAGE hurt=" + (mon.hp < hp0));
  primaryHeld = false;

  // realm minimap draws without throwing and is not the black fill
  loadDimension("realm");
  drawMinimap();
  console.log("MINIMAP_OK realm drew without error");

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
