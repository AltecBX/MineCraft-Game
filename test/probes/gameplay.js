// backpack stacking, durability, tier gating, furnace smelting, armor, villages and weather
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null;
addItem(COBBLE, 200); console.log('cobble 200 ->', countItem(COBBLE), 'stacks', [...hotbar, ...bag].filter(s => s && s.id === COBBLE).map(s => s.count).join('/'));
for (let i = 0; i < 40; i++) addItem(DIRT, 64); console.log('after flooding dirt, free slots', [...hotbar, ...bag].filter(s => !s).length);
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null;
addItem(I_WPICK, 1); selSlot = 0; console.log('wood pick dur', hotbar[0].dur, 'max', toolMaxDur(I_WPICK));
console.log('wood pick harvest iron?', canHarvest(IRON_ORE), 'coal?', canHarvest(COAL_ORE));
for (let i = 0; i < 59; i++) wearTool(1); console.log('dur after 59', hotbar[0] && hotbar[0].dur); wearTool(1); console.log('broke ->', hotbar[0]);
addItem(I_SPICK, 1); console.log('stone pick harvest iron?', canHarvest(IRON_ORE), 'gold?', canHarvest(GOLD_ORE));
// smelting needs a furnace nearby
addItem(IRON_ORE, 3); addItem(I_COAL, 3);
const rIron = RECIPES.find(r => r.out === I_IRON); console.log('can smelt away from furnace?', canCraft(rIron));
const fx = Math.floor(player.pos.x) + 2, fy = Math.floor(player.pos.y), fz = Math.floor(player.pos.z); setRaw(fx, fy, fz, FURNACE);
console.log('can smelt near furnace?', canCraft(rIron)); craft(rIron); craft(rIron); console.log('iron ingots', countItem(I_IRON), 'ore left', countItem(IRON_ORE));
// armor
const hp0 = player.hp; player.hurtCd = 0; damage(10); const noArmor = hp0 - player.hp; player.hp = hp0; addItem(I_IARMOR, 1); player.hurtCd = 0; damage(10); console.log('damage 10 without armor', noArmor.toFixed(1), 'with iron armor', (hp0 - player.hp).toFixed(1)); player.hp = hp0;
// saves keep the backpack
bag[5] = newStack(I_DIAMOND, 3); saveGame(true); bag[5] = null; loadGame(); console.log('bag after load', bag[5] && bag[5].id === I_DIAMOND && bag[5].count);
// villages: go to the home village and let villagers spawn
const vs = []; for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) { const v = villageInCell(gx, gz); if (v) vs.push(v); }
const v = vs.sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
ensureGen(v.cx, v.cz, 30); player.pos.set(v.cx + 3.5, v.gy + 2, v.cz + 3.5); villageScanT = 0; updateVillagers(0.1); for (let i = 0; i < 30; i++) updateVillagers(0.1);
console.log('village at', v.cx, v.cz, 'houses', v.houses.length, 'villagers', villagers.length, 'found', v.found, 'jobs', villagers.map(n => n.job).join(','));
const nv = villagers[0]; nv.g.position.set(player.pos.x + 1, player.pos.y, player.pos.z); coins = 50; openShop(VSHOPS[nv.job].list, VSHOPS[nv.job].title); console.log('shop title', activeShopTitle, 'rows', activeShop.length);
// weather cycles and drives the wet uniform
DEV.weather('storm'); for (let i = 0; i < 200; i++) updateWeather(0.1); updateEnv(0.016); console.log('storm amt', weather.amt.toFixed(2), 'wet', weather.wet.toFixed(2), 'cloud cover', skyU.uCloudCover.value.toFixed(2), 'fog far', U.uFogFar.value.toFixed(0));
DEV.weather('clear'); for (let i = 0; i < 200; i++) updateWeather(0.1); console.log('clear amt', weather.amt.toFixed(2));
camera.position.set(player.pos.x, player.pos.y + 1.6, player.pos.z); for (let i = 0; i < 20; i++) { timeOfDay = 0.95; updateDayNight(0); updateEnv(0.05); updateAmbientLife(0.05); } console.log('night fireflies visible', ffPts.visible);
