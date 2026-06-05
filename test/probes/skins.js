// Batch 10: Thomas skins (cosmetic recolor).
(function () {
  console.log("SKINS count=" + SKINS.length + " default=" + currentSkin);
  console.log("PARTS body=" + !!thomas.userData.body + " hair=" + !!thomas.userData.hairTop + " legL=" + !!thomas.userData.legL);
  // the THOMAS name lives on the +z (back) face of the torso as a texture
  console.log("BACKPRINT bodyMats=" + (thomas.userData.bodyMats ? thomas.userData.bodyMats.length : 0) + " backTex=" + !!thomas.userData.backTex);

  // applying a skin updates currentSkin and regenerates the back print
  applySkin("ninja");
  console.log("APPLY currentSkin=" + currentSkin + " backTexAfter=" + !!thomas.userData.bodyMats[4].map);

  // persisted to localStorage
  console.log("PERSIST saved=" + (localStorage.getItem("thomas_voxel_skin") === "ninja"));

  // switch again + render does not throw
  applySkin("golden");
  renderSkinPick();
  console.log("SWITCH currentSkin=" + currentSkin + " renderOk=true");

  // loadSkin restores the saved skin
  applySkin("explorer"); localStorage.setItem("thomas_voxel_skin", "dragon"); loadSkin();
  console.log("LOAD restored=" + currentSkin);

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
