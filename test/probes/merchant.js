// Batch 8: economy + mouse merchant + shop.
(function () {
  console.log("MERCHANT spawned=" + !!merchant + " coins0=" + coins);

  // killing a monster awards coins
  spawnMonster(Math.floor(player.pos.x) + 2, Math.floor(player.pos.z) + 2, "crawler");
  const mob = monsters[monsters.length - 1];
  const c0 = coins; killMonster(mob);
  console.log("COIN_DROP gained=" + (coins - c0));

  // standing by the merchant opens the shop
  merchant.g.position.set(player.pos.x, player.pos.y, player.pos.z + 0.5);
  interact();
  console.log("SHOP_OPEN visible=" + (!document.getElementById("shop").classList.contains("hidden")));

  // buying deducts coins and grants the item
  coins = 100; const apples0 = countItem(I_APPLE);
  SHOP[0].give();             // Apple x2 effect
  console.log("BUY_EFFECT applesAdded=" + (countItem(I_APPLE) - apples0));
  renderShop();
  console.log("SHOP_RENDER_OK coinsShown=" + (document.getElementById("shopCoins").textContent.indexOf("100") >= 0));

  // merchant is cleared on dimension change
  loadDimension("fire");
  console.log("DIM_CHANGE merchantGone=" + (merchant === null));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
