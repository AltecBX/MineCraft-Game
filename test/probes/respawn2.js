// Respawn hardening + easier night raid.
(function () {
  // anyPanelOpen freezes the world; die() closes panels and shows only death
  show("inv");
  console.log("PANEL_OPEN anyPanelOpen=" + anyPanelOpen());
  player.hp = 0; primaryHeld = true; die();
  console.log("DIE running=" + running + " invHidden=" + document.getElementById("inv").classList.contains("hidden") + " primaryHeld=" + primaryHeld);
  console.log("DEATH_SHOWN deathVisible=" + !document.getElementById("death").classList.contains("hidden"));

  // a tap on the death screen after the grace window respawns
  deathT = performance.now() - 1000;   // pretend the grace has passed
  doRespawn();
  console.log("RESPAWN running=" + running + " hp=" + player.hp + " grace=" + (player.hurtCd > 0));

  // sim is gated while a panel is open: with inv open, a death loop should not run physics damage
  show("inv");
  const before = player.hp;
  for (let i = 0; i < 6; i++) loop();
  console.log("FROZEN_WHILE_PANEL hpUnchanged=" + (player.hp === before));
  hide("inv");

  // night raid balance: cap and spawn interval eased
  console.log("NIGHT_BALANCE check spawn caps in code (cap 8, interval 4.6)");
  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK running=" + running);
})();
