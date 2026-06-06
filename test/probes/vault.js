// Pikachu electric vault puzzle: locked until the companion is near, then it opens.
(function () {
  loadDimension("realm");
  const v = realmVault;
  console.log("VAULT exists=" + !!v + " chest=" + (getBlock(v.x, v.y, v.z) === CHEST) + " locked=" + (getBlock(v.x, v.y, v.z + 1) === CDOOR));

  // not opened when Pikachu is far
  companion.g.position.set(v.x + 40, v.y, v.z + 40);
  tryElectricDoor();
  console.log("STILL_LOCKED far=" + (getBlock(v.x, v.y, v.z + 1) === CDOOR && !realmVault.opened));

  // opens when Pikachu comes close
  companion.g.position.set(v.x + 0.5, v.y, v.z + 2.0);
  tryElectricDoor();
  console.log("OPENED unlocked=" + (getBlock(v.x, v.y, v.z + 1) === AIR && realmVault.opened));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
