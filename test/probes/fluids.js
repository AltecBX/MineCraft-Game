// flowing water and lava, buckets, fences and gates, shield, dodge
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
const X0 = 300, Z0 = 300; ensureGen(X0, Z0, 24);
const Y = 30;
function clearBox(x0, x1, z0, z1, y0, y1) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) setRaw(x, y, z, AIR); }
function floor(x0, x1, z0, z1, y, id) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) setRaw(x, y, z, id || STONE); }
function run(sec) { for (let t = 0; t < sec; t += 0.05) updateFluids(0.05); }
clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10); floor(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y - 1);
// 1. a source spreads 7 blocks over flat ground with falling levels
fluidSet(X0, Y, Z0, WATER, 0); run(6);
ok(getBlock(X0 + 3, Y, Z0) === WATER && getFlow(X0 + 3, Y, Z0) === 3, "level 3 three blocks out (" + getFlow(X0 + 3, Y, Z0) + ")");
ok(getBlock(X0 + 7, Y, Z0) === WATER && getFlow(X0 + 7, Y, Z0) === 7, "reaches 7 blocks");
ok(getBlock(X0 + 8, Y, Z0) === AIR, "stops after 7");
let wet = 0; for (let x = X0 - 9; x <= X0 + 9; x++) for (let z = Z0 - 9; z <= Z0 + 9; z++) if (getBlock(x, Y, z) === WATER) wet++;
ok(wet === 113, "diamond shaped pool of 113 cells (" + wet + ")");
// 2. removing the source drains everything
fluidSet(X0, Y, Z0, AIR, 0); run(8);
wet = 0; for (let x = X0 - 9; x <= X0 + 9; x++) for (let z = Z0 - 9; z <= Z0 + 9; z++) if (getBlock(x, Y, z) === WATER) wet++;
ok(wet === 0, "flow drains when the source is removed (" + wet + " left)");
// 3. water falls off a ledge before spreading
floor(X0 - 2, X0 + 2, Z0 - 2, Z0 + 2, Y + 3, STONE); fluidSet(X0, Y + 4, Z0, WATER, 0); run(6);
ok(getBlock(X0 + 3, Y + 4, Z0) === WATER && getFlow(X0 + 3, Y + 4, Z0) === 3 && getFlow(X0 + 3, Y + 2, Z0) === 8, "spills over the ledge edge and falls as a column (" + getFlow(X0 + 3, Y + 4, Z0) + "," + getFlow(X0 + 3, Y + 2, Z0) + ")");
ok(getBlock(X0 + 3, Y, Z0) === WATER, "water reaches the floor below");
fluidSet(X0, Y + 4, Z0, AIR, 0); run(10); clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10);
// 4. an infinite spring forms between two sources in a trench
for (let x = X0 - 3; x <= X0 + 3; x++) { setRaw(x, Y, Z0 - 1, STONE); setRaw(x, Y, Z0 + 1, STONE); }
setRaw(X0 - 3, Y, Z0, STONE); setRaw(X0 + 3, Y, Z0, STONE);
fluidSet(X0 - 2, Y, Z0, WATER, 0); fluidSet(X0, Y, Z0, WATER, 0); run(3);
ok(getBlock(X0 - 1, Y, Z0) === WATER && getFlow(X0 - 1, Y, Z0) === 0, "a spring between two sources becomes a source");
// 5. buckets
for (let i = 0; i < 9; i++) hotbar[i] = null; for (let i = 0; i < 27; i++) bag[i] = null;
hotbar[0] = newStack(I_BUCKET, 1); selectSlot(0);
player.pos.set(X0 + 0.5, Y + 3, Z0 + 0.5); player.pitch = -Math.PI / 2 + 0.05; player.yaw = 0;
camera.position.set(X0 + 0.5, Y + 3 + EYE, Z0 + 0.5); camera.getWorldDirection = v => v.set(0, -1, 0);
useBucket(); ok(hotbar[0] && hotbar[0].id === I_WBUCKET, "empty bucket scoops the source below");
run(4); ok(getBlock(X0, Y, Z0) === WATER, "the trench refills from its neighbours (spring)");
clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10);
camera.getWorldDirection = v => v.set(0, -1, 0); player.pos.set(X0 + 0.5, Y + 1.5, Z0 + 0.5); camera.position.set(X0 + 0.5, Y + 1.5 + EYE, Z0 + 0.5);
useBucket(); run(0.3); ok(getBlock(X0, Y, Z0) === WATER && getFlow(X0, Y, Z0) === 0 && hotbar[0].id === I_BUCKET, "water bucket pours a source onto the floor");
run(5); fluidSet(X0, Y, Z0, AIR, 0); run(8);
// 6. lava meets water: a lava source turns to obsidian, flowing lava to cobblestone, lava onto water makes stone
clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10);
fluidSet(X0, Y, Z0, LAVA, 0); run(4);
ok(getBlock(X0 + 2, Y, Z0) === LAVA && getFlow(X0 + 2, Y, Z0) === 4, "lava creeps slowly with a short reach (" + getFlow(X0 + 2, Y, Z0) + ")");
ok(getBlock(X0 + 4, Y, Z0) === AIR, "lava stops after 3 blocks");
fluidSet(X0 + 1, Y + 1, Z0, WATER, 0); run(3);
ok(getBlock(X0 + 1, Y, Z0) === COBBLE, "water on flowing lava makes cobblestone (" + getBlock(X0 + 1, Y, Z0) + ")");
setRaw(X0 + 1, Y + 1, Z0, AIR); fluidSet(X0 - 1, Y, Z0, WATER, 0); run(3);
ok(getBlock(X0, Y, Z0) === OBSIDIAN, "water beside a lava source makes obsidian (" + getBlock(X0, Y, Z0) + ")");
clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10); run(8);
// 7. currents push Thomas
fluidSet(X0, Y, Z0, WATER, 0); run(4);
const fv = flowVec(X0 + 3.5, Y + 0.2, Z0 + 0.5); ok(fv.x > 0.5, "current flows away from the source (" + fv.x.toFixed(2) + "," + fv.z.toFixed(2) + ")");
fluidSet(X0, Y, Z0, AIR, 0); run(8); clearBox(X0 - 20, X0 + 20, Z0 - 20, Z0 + 20, Y, Y + 10);
// 8. fences: 1.5 tall, player lands on top, cannot walk through; gates open and close
for (let z = Z0 - 3; z <= Z0 + 3; z++) setRaw(X0 + 2, Y, z, FENCE);
setRaw(X0 + 2, Y, Z0, GATE);
player.pos.set(X0 + 0.5, Y, Z0 + 2.5); player.vel.set(0, 0, 0);
ok(aabbHit(X0 + 2.5, Y + 1.2, Z0 + 2.5), "the space half a block above a fence is solid");
ok(!aabbHit(X0 + 2.5, Y + 1.5, Z0 + 2.5), "standing on top of the fence is free");
player.pos.set(X0 + 2.5, Y + 3, Z0 + 2.5); player.vel.set(0, 0, 0); for (let i = 0; i < 90; i++) physics(1 / 60);
ok(Math.abs(player.pos.y - (Y + 1.5)) < 0.01, "Thomas lands on the fence top at +1.5 (" + (player.pos.y - Y).toFixed(3) + ")");
player.pos.set(X0 + 0.5, Y, Z0 + 2.5); for (let i = 0; i < 20; i++) { moveAxis("x", 0.1); }
ok(player.pos.x < X0 + 2 - HW + 0.01, "cannot walk through a fence (x " + (player.pos.x - X0).toFixed(2) + ")");
ok(aabbHit(X0 + 2.5, Y, Z0 + 0.5), "a shut gate blocks");
toggleGate(X0 + 2, Y, Z0); ok(getBlock(X0 + 2, Y, Z0) === GATE_OPEN && !aabbHit(X0 + 2.5, Y, Z0 + 0.5), "an open gate lets Thomas through");
toggleGate(X0 + 2, Y, Z0); ok(getBlock(X0 + 2, Y, Z0) === GATE, "and shuts again");
// 9. fences pen animals
resetFarm(); const pig = spawnFarmAnimal("pig", X0 + 0.5, Z0 + 0.5, { y: Y, kept: true });
for (let x = X0 - 3; x <= X0 + 3; x++) for (let z = Z0 - 3; z <= Z0 + 3; z++) if (Math.abs(x - X0) === 3 || Math.abs(z - Z0) === 3) setRaw(x, Y, z, FENCE);
for (let i = 0; i < 1200; i++) { pig.state = "walk"; pig.t = 5; updateFarmAnimal(pig, 1 / 30); }
ok(Math.abs(pig.g.position.x - X0 - 0.5) < 3 && Math.abs(pig.g.position.z - Z0 - 0.5) < 3, "a one block fence pens a pig (" + (pig.g.position.x - X0).toFixed(1) + "," + (pig.g.position.z - Z0).toFixed(1) + ")");
// 10. shield and dodge
hotbar[1] = newStack(I_SHIELD, 1); selectSlot(1); player.hp = 20; player.hurtCd = 0; running = true;
secondaryDown(); ok(blocking, "right click raises the shield");
damage(10); ok(Math.abs(player.hp - 18) < 0.01 && hotbar[1].dur < toolMaxDur(I_SHIELD), "shield blocks 80% (hp " + player.hp + ")");
blocking = false; player.hp = 20; player.hurtCd = 0; player.onGround = true; player.stam = 50; dodge.cd = 0; startDodge(); damage(6);
ok(player.hp === 20, "a dodge roll grants invulnerability");
for (let i = 0; i < 30; i++) physics(1 / 60); player.hurtCd = 0; damage(6); ok(player.hp < 20, "damage lands again after the roll");
// 11. milk
hotbar[2] = newStack(I_BUCKET, 1); selectSlot(2); const cow = spawnFarmAnimal("cow", X0 + 0.5, Z0 + 0.5, { y: Y });
ok(animalInteract(cow) && hotbar[2].id === I_MILK, "milking a cow fills the bucket");
player.food = 10; interact(); ok(player.food === 16 && hotbar[2] && hotbar[2].id === I_BUCKET, "drinking milk gives the bucket back (food " + player.food + ")");
// 12. flows persist in saves
fluidSet(X0 - 10, Y, Z0 - 10, WATER, 0); run(2); saveGame(true);
const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); ok(sv.flows && sv.flows.overworld && sv.flows.overworld.length > 5, "save carries flow levels (" + (sv.flows.overworld || []).length + ")");
console.log("RECIPES fence " + !!RECIPES.find(r => r.out === FENCE) + " bucket " + !!RECIPES.find(r => r.out === I_BUCKET) + " tiles " + Object.keys(ATL.tiles).length);
