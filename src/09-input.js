/* input.js: Keyboard, mouse and touch input.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- INPUT ----------
const keys = {};
const input = { fwd: 0, str: 0 };
const touch = { mag: 0, jump: false, sprint: false };
let pointerLocked = false, primaryHeld = false, paused = false, running = false;

let rebindAction = null;
function keyLabel(code) { if (!code) return "?"; if (code.startsWith("Key")) return code.slice(3); if (code.startsWith("Digit")) return code.slice(5); const arr = { ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" }; return arr[code] || code; }
addEventListener("keydown", e => {
  if (rebindAction) { e.preventDefault(); if (e.code !== "Escape") { settings.keys[rebindAction] = e.code; saveSettings(); toast("Bound " + rebindAction + " to " + keyLabel(e.code)); } rebindAction = null; renderKeybinds(); return; }
  if (e.target && e.target.tagName === "INPUT" && (e.target.type === "search" || e.target.type === "text")) return;   // typing in the recipe search box
  keys[e.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyM") { settings.muted = !settings.muted; applyAudioGains(); saveSettings(); syncSettingsUI(); toast(settings.muted ? "Muted" : "Unmuted"); }
  if (!running && deathT && !$("death").classList.contains("hidden") && (e.code === "Space" || e.code === "Enter") && performance.now() - deathT > 600) { doRespawn(); return; }
  if (!running) return;
  if (e.code.startsWith("Digit")) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 9) selectSlot(n); }
  const K = settings.keys;
  if (e.code === K.interact) interact();
  if (e.code === K.dodge) startDodge();
  if (e.code === K.camera) { thirdPerson = !thirdPerson; toast(thirdPerson ? "Third person" : "First person"); }
  if (e.code === K.inv || e.code === "KeyB") toggleInv();
  if (e.code === K.skills) toggleSkills();
  if (e.code === K.cat) catCommand();
  if (e.code === K.journal) toggleJournal();
  if (e.code === "KeyH") primaryHeld = true;   // H breaks/hits just like the trackpad, without nudging the view
  if (e.code === "Escape") togglePause();
});
addEventListener("keyup", e => { keys[e.code] = false; if (e.code === "KeyH") { primaryHeld = false; mineReset(); } });
canvas.addEventListener("mousedown", e => { if (!running || paused) return; if (!isTouch && !pointerLocked) { canvas.requestPointerLock(); return; } if (e.button === 0) { primaryHeld = true; } if (e.button === 2) secondaryDown(); });
canvas.addEventListener("mouseup", e => { if (e.button === 0) { primaryHeld = false; mineReset(); } if (e.button === 2) blocking = false; });
// right click / Build: raise a held shield, otherwise place or use
let blocking = false;
function secondaryDown() { const t = currentTool(); if (t && t.tool === "shield") { blocking = true; return; } placeBlock(); }
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("wheel", e => { if (!running) return; selectSlot((selSlot + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
addEventListener("mousemove", e => { if (!pointerLocked) return; player.yaw -= e.movementX * settings.sensD; player.pitch -= e.movementY * settings.sensD; clampPitch(); });
addEventListener("wheel", e => { if (!thirdPerson) return; tpZoom = Math.max(1.8, Math.min(9, tpZoom + (e.deltaY > 0 ? 0.6 : -0.6))); }, { passive: true });
document.addEventListener("pointerlockchange", () => { pointerLocked = document.pointerLockElement === canvas; });
function clampPitch() { const l = Math.PI / 2 - 0.04; player.pitch = Math.max(-l, Math.min(l, player.pitch)); }

// touch input
if (isTouch) {
  const joy = document.getElementById("joy"), jt = document.getElementById("joyT");
  let mId = null, lId = null, lx = 0, ly = 0; const JR = 56;
  const showJoy = (x, y) => { joy.style.left = x + "px"; joy.style.top = y + "px"; joy.style.display = "block"; };
  const setT = (dx, dy) => jt.style.transform = "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px))";
  function upJoy(x, y) { let dx = x - parseFloat(joy.style.left), dy = y - parseFloat(joy.style.top); const d = Math.hypot(dx, dy) || 1; if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; } setT(dx, dy); input.str = dx / JR; input.fwd = -dy / JR; touch.mag = Math.min(1, d / JR); touch.sprint = touch.mag > 0.92; }
  function endJoy() { joy.style.display = "none"; setT(0, 0); input.fwd = input.str = 0; touch.mag = 0; touch.sprint = false; }
  const onBtn = t => t.target && t.target.closest && t.target.closest("#minimap,.tc,.slot,.btn,.seg,.cell,.craftRow,input");
  addEventListener("touchstart", e => { if (!running || paused) return; let used = false; for (const t of e.changedTouches) { if (onBtn(t)) continue; used = true; const x = t.clientX, y = t.clientY; if (x < innerWidth * 0.45 && mId === null) { mId = t.identifier; showJoy(x, y); upJoy(x, y); } else if (lId === null) { lId = t.identifier; lx = x; ly = y; } } if (used) e.preventDefault(); }, { passive: false });
  addEventListener("touchmove", e => { if (!running) return; for (const t of e.changedTouches) { if (t.identifier === mId) upJoy(t.clientX, t.clientY); else if (t.identifier === lId) { player.yaw -= (t.clientX - lx) * settings.sensM; player.pitch -= (t.clientY - ly) * settings.sensM; clampPitch(); lx = t.clientX; ly = t.clientY; } } e.preventDefault(); }, { passive: false });
  function endT(e) { for (const t of e.changedTouches) { if (t.identifier === mId) { mId = null; endJoy(); } else if (t.identifier === lId) lId = null; } }
  addEventListener("touchend", endT); addEventListener("touchcancel", endT);
  document.addEventListener("gesturestart", e => e.preventDefault());
  const bind = (id, dn, up) => { const el = document.getElementById(id); el.addEventListener("pointerdown", e => { e.preventDefault(); dn(); }); if (up) { el.addEventListener("pointerup", e => { e.preventDefault(); up(); }); el.addEventListener("pointercancel", up); el.addEventListener("pointerleave", up); } };
  bind("bJump", () => touch.jump = true, () => touch.jump = false);
  bind("bAttack", () => primaryHeld = true, () => { primaryHeld = false; mineReset(); });
  bind("bBuild", secondaryDown, () => { blocking = false; });
  bind("bDodge", startDodge);
  bind("bUse", () => interact());
  bind("bInv", () => toggleInv());
  bind("bPause", () => togglePause());
}
