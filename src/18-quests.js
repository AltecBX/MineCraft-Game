/* quests.js: Quests, daily challenge, New Game Plus.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- QUESTS (Thomas main story) ----------
const quests = [
  { id: "wake", title: "Wake Up, Thomas", text: "Wake up. Move with WASD or the joystick", done: () => movedDist > 3 },
  { id: "wood", title: "Gather Wood", text: "Break trees for 4 Wood", done: () => countItem(WOOD) >= 4 || craftedPlanks },
  { id: "craft", title: "Craft Your First Tool", text: "Use the camp Crafting Table and craft a Wood Pickaxe", done: () => craftedPick },
  { id: "shelter", title: "Build Shelter", text: "Place 8 blocks to start a shelter", done: () => placedBlocks >= 8 },
  { id: "cat", title: "Find the Lost Cat", text: "Find a cat and tame it with an Apple", done: () => tamedCat },
  { id: "night", title: "Survive the First Night", text: "Survive until morning", done: () => survivedNight },
  { id: "kill", title: "Follow the Purple Trail", text: "Defeat 3 purple monsters", done: () => kills >= 3 },
  { id: "fire", title: "Enter the Fire Dimension", text: "Find the portal and enter the Fire Dimension", done: () => DIM === "fire" || DIM === "end" },
  { id: "fireboss", title: "Defeat the Fire Boss", text: "Defeat the Fire guardian", done: () => fireBossDown },
  { id: "end", title: "Enter the End", text: "Step into the End portal", done: () => DIM === "end" },
  { id: "dragon", title: "Defeat the Black Dragon", text: "Destroy the crystals and slay the Black Dragon", done: () => false }
];
let qi = 0, craftedPlanks = false, craftedPick = false, minedStone = 0, survivedNight = false, tamedCat = false, kills = 0, fireBossDown = false, tameCount = 0;
const sideQuests = [
  { id: "slayer", title: "Beast Slayer", text: "Defeat 10 purple monsters", prog: () => Math.min(kills, 10) + "/10", done: () => kills >= 10, reward: () => { addXP(40); addItem(I_APPLE, 2); } },
  { id: "friend", title: "Cat Friend", text: "Tame 3 cats", prog: () => Math.min(tameCount, 3) + "/3", done: () => tameCount >= 3, reward: () => { addXP(50); } },
  { id: "spelunker", title: "Spelunker", text: "Mine 20 stone or cobblestone", prog: () => Math.min(minedStone, 20) + "/20", done: () => minedStone >= 20, reward: () => { addXP(40); addItem(COBBLE, 8); } }
];
const sideDone = new Set();
function updateSideQuests() { for (const s of sideQuests) if (!sideDone.has(s.id) && s.done()) { sideDone.add(s.id); s.reward(); questComplete("Side Quest. " + s.title); } }
function setQuest(t) { document.getElementById("questText").textContent = t; }
function questComplete(t) { const p = document.getElementById("questPop"); p.innerHTML = '<div class="qc">QUEST COMPLETE</div><div class="qn">' + t + '</div>'; p.classList.remove("show"); void p.offsetWidth; p.classList.add("show"); SFX.levelUp(); addShake(0.08); }
function updateQuests() {
  updateSideQuests();
  if (qi >= quests.length) return;
  const q = quests[qi];
  if (q.done()) { questComplete(q.title); addXP(25); qi++; }
  if (qi < quests.length && DIM === "overworld") setQuest(quests[qi].text);
}
function onCollect(id) {}
function onCraft(out) { if (out === CRAFT_TABLE) achieve("tablemade", "Carpenter"); if (out === PLANKS) craftedPlanks = true; if (out === I_WPICK) { craftedPick = true; achieve("tool", "First Tool Crafted"); } }
function onMine(id) { if (id === STONE || id === COBBLE) { minedStone++; dailyTick("mine", 1); } achieve("block", "First Block Broken"); addXP(id === STONE || id === COBBLE ? 2 : 1); }
function onKill() { kills++; achieve("kill1", "First Monster Defeated"); addXP(10); dailyTick("kill", 1); }
function onTame() { tamedCat = true; tameCount++; achieve("cat", "First Cat Tamed"); if (tameCount >= 3) achieve("cathero", "Cat Hero"); dailyTick("tame", 1); }
// ---------- DAILY CHALLENGE + NEW GAME PLUS (replay value) ----------
const DAILY = [
  { id: "kill", kind: "kill", text: "Defeat 12 monsters", target: 12, reward: () => { addCoins(25); addXP(40); } },
  { id: "mine", kind: "mine", text: "Mine 25 stone or cobble", target: 25, reward: () => { addCoins(20); addItem(COBBLE, 16); } },
  { id: "tame", kind: "tame", text: "Tame 2 cats", target: 2, reward: () => { addCoins(20); addXP(40); } },
  { id: "mouse", kind: "mouse", text: "Catch 3 mice", target: 3, reward: () => { addCoins(20); addItem(I_APPLE, 2); } },
  { id: "build", kind: "build", text: "Place 20 blocks", target: 20, reward: () => { addCoins(15); addItem(PLANKS, 8); } }
];
let daily = null;
function todayStr() { const d = new Date(); return "" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }
function saveDaily() { if (!daily) return; try { localStorage.setItem("thomas_voxel_daily", JSON.stringify({ date: daily.date, prog: daily.prog, claimed: daily.claimed })); } catch (e) {} }
function initDaily() {
  const date = todayStr(), dn = parseInt(date, 10) || 0;
  const tmpl = DAILY[Math.floor(hsh(dn % 100000, 7) * DAILY.length) % DAILY.length] || DAILY[0];
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("thomas_voxel_daily")) || {}; } catch (e) {}
  const same = saved.date === date;
  daily = { date, id: tmpl.id, kind: tmpl.kind, text: tmpl.text, target: tmpl.target, reward: tmpl.reward, prog: same ? (saved.prog || 0) : 0, claimed: same ? !!saved.claimed : false };
  saveDaily();
}
function dailyTick(kind, n) {
  if (!daily || daily.claimed || daily.kind !== kind) return;
  daily.prog = Math.min(daily.target, daily.prog + (n || 1)); saveDaily();
  if (daily.prog >= daily.target && !daily.claimed) { daily.claimed = true; saveDaily(); toast("Daily Challenge complete!"); showBanner("Daily Challenge complete!"); SFX.victory(); if (daily.reward) daily.reward(); achieve("daily", "Daily Challenger"); }
}
let ngLevel = 0, ngMul = 1;     // New Game Plus: each dragon win makes the next run tougher
function loadNG() { try { ngLevel = parseInt(localStorage.getItem("thomas_voxel_ngplus"), 10) || 0; } catch (e) { ngLevel = 0; } ngMul = 1 + ngLevel * 0.2; }
function bumpNG() { ngLevel++; try { localStorage.setItem("thomas_voxel_ngplus", "" + ngLevel); } catch (e) {} ngMul = 1 + ngLevel * 0.2; }
function onFireBoss() { fireBossDown = true; achieve("fireb", "Fire Boss Defeated"); addXP(60); }
