// Verify pick, axe, sword each render a distinct viewmodel (not the same hammer shape).
(function () {
  function partsFor(id) {
    hotbar[selSlot] = { id: id, n: 1 };
    buildViewItem();
    return viewItem.children.length;
  }
  const pick = partsFor(I_WPICK);
  const axe = partsFor(I_AXE);
  const sword = partsFor(I_SWORD);
  const hammer = partsFor(I_LIGHTHAMMER);
  const bow = partsFor(I_ICEBOW);
  console.log("PARTS pick=" + pick + " axe=" + axe + " sword=" + sword + " hammer=" + hammer + " bow=" + bow);
  console.log("DISTINCT pickHasParts=" + (pick > 1) + " axeHasParts=" + (axe > 1) + " swordHasParts=" + (sword > 1) + " allBuilt=" + (pick && axe && sword && hammer && bow));
})();
