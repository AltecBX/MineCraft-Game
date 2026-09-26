// furnace UI: timed smelting with fuel, offline progress, lava bucket fuel, saves and spilling
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
const k = furnaceKey(10, 30, 10), F = furnaceAt(k);
F.in = newStack(IRON_ORE, 3); F.fuel = newStack(I_COAL, 1); F.t = Date.now() - 10000; tickFurnace(F);
ok(F.out && F.out.id === I_IRON && F.out.count === 2, "10 s smelts 2 iron (" + (F.out && F.out.count) + ")");
ok(Math.abs(F.prog - 0.5) < 0.01 && F.in.count === 1 && !F.fuel && Math.abs(F.burn - 22) < 0.01, "half way through the third, coal burning 22 s left (" + F.burn.toFixed(1) + ")");
F.t = Date.now() - 60000; tickFurnace(F); ok(!F.in && F.out.count === 3, "finishes the batch while away");
ok(F.burn < 22, "idle fuel burns down");
// fuel runs out: planks give 1.5 items each
const G = furnaceAt(furnaceKey(11, 30, 10)); G.in = newStack(I_RAWBEEF, 5); G.fuel = newStack(PLANKS, 2); G.t = Date.now() - 100000; tickFurnace(G);
ok(G.out.id === I_STEAK && G.out.count === 3 && G.in.count === 2, "2 planks cook 3 steaks (" + G.out.count + ")");
// lava bucket leaves an empty bucket
const H = furnaceAt(furnaceKey(12, 30, 10)); H.in = newStack(COBBLE, 64); H.fuel = newStack(I_LBUCKET, 1); H.t = Date.now() - 20000; tickFurnace(H);
ok(H.fuel && H.fuel.id === I_BUCKET && H.out.id === STONE && H.out.count === 5, "lava bucket fuel, cobblestone to stone, bucket returned (" + H.out.count + ")");
// putting items from the bag
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null;
hotbar[0] = newStack(SAND, 10); hotbar[1] = newStack(I_COAL, 4); hotbar[2] = newStack(DIRT, 5);
const J = furnaceAt(furnaceKey(13, 30, 10)); furnacePut(J, hotbar, 0); furnacePut(J, hotbar, 1); furnacePut(J, hotbar, 2);
ok(J.in.id === SAND && J.in.count === 10 && J.fuel.count === 4 && hotbar[2] && hotbar[2].count === 5, "sand to input, coal to fuel, dirt refused");
J.t = Date.now() - 8000; tickFurnace(J); furnaceTake(J, "out"); ok(countItem(GLASS) === 2 && !J.out, "result taken into the bag (" + countItem(GLASS) + ")");
// save and load
saveGame(true); const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); ok(Array.isArray(sv.furnaces) && sv.furnaces.length >= 4, "furnaces saved (" + sv.furnaces.length + ")");
// breaking spills contents
const before = groundItems.length; spillFurnace(furnaceKey(13, 30, 10), 13, 30, 10); ok(groundItems.length > before && !furnaceStore.has(furnaceKey(13, 30, 10)), "breaking a furnace drops its contents");
openFurnace(k); renderFurnace(); closeFurnace(); console.log("UI_OK");
