// Cat cosmetics: collars/hats/crowns on tamed cats.
(function () {
  console.log("COSMETICS count=" + COSMETICS.length + " default=" + catCosmetic);

  // each cosmetic id builds a mesh (none returns null)
  let built = 0; for (const c of COSMETICS) { const m = buildCatCosmetic(c.id); if (c.id !== "none" && m) built++; }
  console.log("BUILDERS nonNone=" + built + "/" + (COSMETICS.length - 1));

  // tame a cat, set a cosmetic -> it gets a cosmetic mesh; switching replaces it
  spawnCat(Math.floor(player.pos.x) + 2, Math.floor(player.pos.z), { tamed: true, color: "orange" });
  const cat = cats[cats.length - 1];
  setCatCosmetic("crown");
  console.log("EQUIP crown hasMesh=" + !!cat.cosmeticMesh + " current=" + catCosmetic);
  const first = cat.cosmeticMesh;
  setCatCosmetic("tophat");
  console.log("SWITCH replaced=" + (cat.cosmeticMesh !== first) + " current=" + catCosmetic);
  setCatCosmetic("none");
  console.log("REMOVE noMesh=" + (cat.cosmeticMesh == null));

  // persisted + new tamed cats inherit the current cosmetic
  setCatCosmetic("collar");
  console.log("PERSIST saved=" + (localStorage.getItem("thomas_voxel_catcos") === "collar"));
  spawnCat(Math.floor(player.pos.x) + 4, Math.floor(player.pos.z), { tamed: true, color: "black" });
  const cat2 = cats[cats.length - 1];
  console.log("INHERIT newCatHasMesh=" + !!cat2.cosmeticMesh);

  // wardrobe panel renders + freezes world
  toggleWardrobe();
  console.log("PANEL visible=" + !document.getElementById("catwardrobe").classList.contains("hidden") + " freezes=" + anyPanelOpen());
  toggleWardrobe();

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
