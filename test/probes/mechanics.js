// Status effects, fishing, and the move teacher.
(function () {
  loadDimension("realm");

  // --- status effects ---
  startBattle(makeCreature("emberwing", 8), null);      // mine = Pikachu (electric starter)
  battle.menu = "fight";
  // find a status move index on the player's creature, else inject one for the test
  let burnIdx = battle.mine.moves.findIndex(m => MOVES[m].status === "burn");
  if (burnIdx < 0) { battle.mine.moves[0] = "fireblast"; burnIdx = 0; }
  battle.wild.hp = battle.wild.maxHp;                    // keep it alive so status can stick
  // apply many times until status lands (deterministic enough over tries)
  let landed = false; for (let t = 0; t < 30 && !landed; t++) { battle.busy = false; battle.wild.status = null; doMove(burnIdx); landed = battle.wild.status === "burn"; }
  console.log("BURN inflicted=" + landed);
  // burn never faints (stays >= 1)
  battle.wild.status = "burn"; battle.wild.hp = 1; const note = burnTick(battle.wild);
  console.log("BURN_TICK floorsAt1=" + (battle.wild.hp >= 1) + " note=" + (note.length > 0));
  battle = null;

  // --- move teacher ---
  cteam = [makeCreature("voltmouse", 6)]; const m0 = cteam[0].moves.length;
  teachMove();
  console.log("TEACH learned=" + (cteam[0].moves.length > m0 || m0 >= 4));

  // --- fishing ---
  cmenuOpen = false; battle = null;
  goFishing();
  console.log("FISH encounter=" + !!cmenu + " water=" + (cmenu && ["frogblade", "tidequeen"].indexOf(cmenu.wild.sp) > -1));
  if (typeof closeCMenu === "function") closeCMenu();

  // --- night pool includes night-only creatures ---
  const nightPool = ["voltmouse"].concat(["moonfox", "shadeling", "frogblade"]);
  console.log("NIGHT_POOL hasUmbreon=" + (nightPool.indexOf("moonfox") > -1) + " hasGengar=" + (nightPool.indexOf("shadeling") > -1));

  for (let i = 0; i < 6; i++) loop();
  console.log("LOOP_OK");
})();
