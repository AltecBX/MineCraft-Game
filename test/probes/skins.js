// Batch 10: Thomas skins (cosmetic recolor).
(function () {
  console.log("SKINS count=" + SKINS.length + " default=" + currentSkin);
  console.log("PARTS body=" + !!thomas.userData.body + " hair=" + !!thomas.userData.hairTop + " legL=" + !!thomas.userData.legL);

  // applying a skin updates the recolorable materials and currentSkin
  applySkin("ninja");
  const bodyHex = thomas.userData.body.material.color.getHexString ? thomas.userData.body.material.color : null;
  console.log("APPLY currentSkin=" + currentSkin);

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
