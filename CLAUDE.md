# CLAUDE.md

Project memory for Claude Code. Read this before editing.

## What this is

A single screen browser voxel survival game, Minecraft style, built on Three.js r128 loaded from a CDN. Main character is named Thomas. Desktop and mobile controls. Three dimensions (overworld, fire, end), two reworked bosses (Fire Guardian, Black Dragon), survival, crafting, companions, quests, achievements. It runs with no build step today. It is meant to deploy to GitHub Pages as static files.

## Files

```
index.html        head, body DOM, loads three.min.js (CDN) then game.js
styles.css        all CSS
game.js           the entire game, wrapped in one IIFE (~1760 lines)
test/harness.cjs  Node validation harness (stubs THREE + DOM + audio + storage)
test/probes/      small probe scripts the harness can inject and run
package.json      dev server and test scripts
```

game.js is still one big file. Splitting it into modules is the first recommended task, see Roadmap below.

## How to run

No bundler required. Any static server works because game.js is a classic script and Three.js comes from the CDN.

```
npx --yes serve .            # then open the printed URL
# or
python3 -m http.server 8000  # then open http://localhost:8000
```

Opening index.html directly mostly works, but a server is better so localStorage saves behave.

## How to validate every change (required)

`node --check` only catches syntax. It does NOT catch undeclared references or runtime errors. A real bug once shipped that way (see Hard lessons). So after any edit:

1. Syntax: `node --check game.js`
2. Smoke boot: `node test/harness.cjs` and confirm it prints `BOOT_OK ...` with no `RUNTIME_ERROR`.
3. Feature probe: write a short probe in `test/probes/foo.js` that drives the thing you changed, then run `node test/harness.cjs --probe test/probes/foo.js`. The probe runs inside the game right after `startGame()`, so it has access to all internals (player, monsters, loadDimension, spawnMonster, settings, etc.).

Example probe (`test/probes/dragon.js`):
```js
loadDimension('end');
console.log('end dragon hp', dragon && dragon.hp, 'crystals', crystalsLeft);
```

The harness stubs Three.js with real Vector3 and Color math and permissive proxies for everything else, plus DOM, WebAudio, requestAnimationFrame (non recursive), and an in memory localStorage. If a probe throws on a stub gap rather than a game bug, fix the stub in `test/harness.cjs`, do not weaken the game.

## Conventions (owner: Jerry)

Code change responses use this exact format, nothing else for non code:
- The Problem (2 to 4 sentences, root cause)
- The Solution (bullet list of exact changes)
- Files Changed
- Validation (only checks actually run)
- Deploy (only if needed)
Then a confidence level. If confidence is below 0.90, do not ship, state what is missing.

Other rules:
- Never rewrite the file from scratch. Edit in place. Keep all working features.
- Fix feel and performance before adding content.
- Build in stages, leave TODO comments for deferred depth.
- In prose, no em dashes and no hyphens except technical tokens like `node --check`. Periods and commas only.
- Validate after every change using the harness above. Say plainly if something failed or was not tested.

## Architecture

One IIFE, `"use strict"`. Global state lives in closures, not modules yet.

- Blocks: global Map `W` keyed `"x,y,z"`. Per chunk face culled vertex colored BufferGeometry. Chunk streaming by render distance. Substepped AABB physics.
- Player constants: `HW=0.3` half width, `PH=1.8` height, `EYE=1.62`. Declared near `const player`. (These once went missing and the physics threw every frame, black screen. If you refactor, keep them.)
- Block ids: AIR0 GRASS1 DIRT2 STONE3 WOOD4 LEAVES5 SAND6 WATER7 LAVA8 FIRESTONE9 ENDSTONE10 PORTAL11 PLANKS12 COBBLE13 TORCH14 CHEST15 SNOW16 BRICK17 BED18 FIRE_CRYSTAL19.
- Item ids (>=100): I_HAND100 I_WPICK101 I_SPICK102 I_SWORD103 I_AXE104 I_FIRECHARM105 I_FIRESWORD106 I_APPLE110 I_STICK111.
- Noise: `hsh`/`hsh3` uniform hashes via Math.imul (do not use plain big int multiply, it overflows to float and biases terrain), `vn`/`vn3` value noise, `fbm`. Shared `biomeAt`, `heightAt`, `caveAt`.
- Dimensions: `loadDimension(name)` for overworld, fire, end. Fire has heat damage unless you hold a Flame Charm. End gates dragon damage behind four crystals (`crystalsLeft`).
- Audio: WebAudio synth, no asset files. `blip`, `noiseHit`, `SFX`, generative `playPad`/`updateMusic`. Master gains `sfxGain`, `musicGain`.
- UI overlays via `show(id)`/`hide(id)`. HUD ids in index.html.
- Save: localStorage key `thomas_voxel_save_v2`. Settings key `thomas_voxel_settings`. Achievements key `thomas_voxel_ach` (cumulative across playthroughs).

## Hard lessons (do not repeat)

- Undeclared player AABB constants threw every physics frame and rendered a black screen. `node --check` passed. Always run the harness boot.
- A non uniform hash biased all terrain below sea level so the world was near total ocean. Tune noise against measured distributions, not guesses.
- The harness Mesh stub once dropped the material arg, so `body.material.emissive` was undefined in tests. That was a stub gap, not a game bug. Fix the stub, not the game.

## Roadmap

First task, recommended: split game.js into ES modules and add Vite for dev with hot reload. Suggested layout:

```
src/
  main.js          boot, loop
  engine.js        scene, camera, renderer, lights, sky
  audio.js         actx, SFX, music
  settings.js      settings, persistence, syncSettingsUI
  blocks.js        block + item tables, recipes
  noise.js         hsh, vn, fbm, biomeAt, heightAt, caveAt
  world.js         chunks, genChunk, meshing, save/load
  player.js        physics, mining, building, inventory
  input.js         keyboard, mouse, touch, keymap
  entities/monsters.js, entities/animals.js, bosses.js
  ui/hud.js, ui/menus.js, quests.js, achievements.js
```

Do the split incrementally, one system at a time, running the harness after each move. The harness can be ported to load the bundled output or to import modules directly.

Then, in priority order: texture atlas for real block surfaces with FrontSide winding (big visual gain), music volume already done, surface cave mouths and rivers, a village with simple traders, chest storage UI, armor and durability, bow and arrows, full crafting table grid.

## Deploy

GitHub Pages serves static files. Push index.html, styles.css, game.js (and the bundled output once Vite is added) to the branch Pages serves. The CDN Three.js means no asset hosting is needed.
