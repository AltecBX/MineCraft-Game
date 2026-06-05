// Stage 4: collections (cat collection + monster bestiary).
(function () {
  console.log("COLL_INIT cats=" + catsFound.size + " mobs=" + mobsFound.size);

  // taming a cat records it in the collection (black cat needs an apple)
  spawnCat(Math.floor(player.pos.x), Math.floor(player.pos.z), { color: "black" });
  const cat = cats[cats.length - 1];
  cat.g.position.set(player.pos.x, player.pos.y, player.pos.z + 0.4);
  const hadApple = countItem(I_APPLE) > 0;
  interact();
  console.log("DISCOVER_CAT hadApple=" + hadApple + " blackFound=" + catsFound.has("black"));

  // defeating a monster records it in the bestiary
  spawnMonster(Math.floor(player.pos.x) + 2, Math.floor(player.pos.z) + 2, "spitter");
  const mob = monsters[monsters.length - 1];
  killMonster(mob);
  console.log("DISCOVER_MOB spitterFound=" + mobsFound.has("spitter"));

  // persistence + render do not throw
  saveColl();
  console.log("PERSIST hasKey=" + (localStorage.getItem(COLL_KEY) != null));
  renderColl();
  console.log("RENDER_OK total=" + (catsFound.size + mobsFound.size) + "/" + (CAT_COLORS.length + Object.keys(MTYPE).length));

  // completing both sets fires the milestone achievements
  CAT_COLORS.forEach(c => catsFound.add(c.n));
  Object.keys(MTYPE).forEach(t => mobsFound.add(t));
  checkCollComplete();
  console.log("COMPLETE catCollector=" + ach.has("catcollector") + " bestiary=" + ach.has("bestiary"));
})();
