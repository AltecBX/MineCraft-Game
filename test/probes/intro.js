// Drives the Stage 1 opening story and checks each beat fires cleanly.
// startGame() has already run, so buildSpawnCamp + startStory are active.
(function () {
  const catsBefore = cats.length;
  console.log("STORY active=" + story.active + " t0=" + story.t.toFixed(2) + " starterKey=" + (story.starterKey || "none"));

  // the supply chest store should exist from buildSpawnCamp
  console.log("STARTER_CHEST has=" + chestStore.has(story.starterKey));

  // fast-forward past the whole cinematic (steps at 0.3..12.6s)
  updateStory(20);
  const whiskers = cats.find(c => c.name === "Whiskers");
  console.log("WHISKERS spawned=" + !!whiskers + " friendly=" + (whiskers && whiskers.friendly) + " catsAdded=" + (cats.length - catsBefore));
  console.log("OBJMARKER created=" + !!objMarker + " visible=" + (objMarker && objMarker.visible));

  // simulate the player opening the supply chest -> objective clears
  openChest(story.starterKey);
  console.log("AFTER_OPEN chestOpened=" + story.chestOpened + " markerVisible=" + (objMarker && objMarker.visible));

  // pass the first-monster threshold (70s)
  const monBefore = monsters.length;
  updateStory(60);
  console.log("FIRST_MONSTER fired=" + story.firstMonster + " monstersAdded=" + (monsters.length - monBefore));

  // pass the buried-secret threshold (150s)
  updateStory(90);
  console.log("SECRET revealed=" + (story.secret && story.secret.revealed) + " markerVisibleAgain=" + (objMarker && objMarker.visible));

  // taming the friendly cat should cost no apple and set tamed
  if (whiskers) {
    const applesBefore = countItem(I_APPLE);
    // stand next to Whiskers so interact() finds it
    whiskers.g.position.set(player.pos.x, player.pos.y, player.pos.z + 0.4);
    const rc = voxelRaycast(4);
    console.log("TAME_DBG dist=" + whiskers.g.position.distanceTo(player.pos).toFixed(2) + " raycast=" + (rc ? rc.id : "null") + " selItem=" + (hotbar[selSlot] && hotbar[selSlot].id));
    interact();
    console.log("TAME tamed=" + whiskers.tamed + " applesSpent=" + (applesBefore - countItem(I_APPLE)) + " tameCount=" + tameCount);
  }
})();
