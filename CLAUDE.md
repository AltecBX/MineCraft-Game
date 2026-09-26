# CLAUDE.md

Project memory for Claude Code. Read this before editing.

## What this is

A single screen browser voxel survival game, Minecraft style, built on Three.js r128 loaded from a CDN. Main character is named Thomas. Desktop and mobile controls. Three dimensions (overworld, fire, end), two reworked bosses (Fire Guardian, Black Dragon), survival, crafting, companions, quests, achievements. It runs with no build step today. It is meant to deploy to GitHub Pages as static files.

## Files

```
index.html        head, body DOM, loads three.min.js (CDN), gfx.js, then game.js
styles.css        all CSS
gfx.js            renderer toolkit: procedural texture atlas, noise, detail maps, all GLSL, atmosphere model (window.GFXLIB)
game.js           the entire game, wrapped in one IIFE (~5200 lines)
test/harness.cjs  Node validation harness (stubs THREE + DOM + audio + storage, loads gfx.js first)
test/probes/      small probe scripts the harness can inject and run (render.js, render2.js cover the renderer, gameplay.js the inventory, ores, villages and weather)
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

1. Syntax: `node --check game.js` and `node --check gfx.js`
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
- When a task is finished and validated, open the PR and merge it to main yourself, then confirm the Pages deploy. Do not ask first (owner's standing instruction). Do the whole job in one pass instead of proposing follow ups.
- Never rewrite the file from scratch. Edit in place. Keep all working features.
- Fix feel and performance before adding content.
- Build in stages, leave TODO comments for deferred depth.
- In prose, no em dashes and no hyphens except technical tokens like `node --check`. Periods and commas only.
- Validate after every change using the harness above. Say plainly if something failed or was not tested.

## Rendering (see gfx.js and the RENDER sections of game.js)

Realistic look, all procedural, no image assets.
- Texture atlas: `GFXLIB.buildAtlas()` paints every block tile at 64px from seeded periodic noise into 128px cells with wrap padding (no mip bleeding). Uploaded once as `atlasTex` (nearest mag, trilinear min, anisotropy). Opaque tiles use alpha < 255 to mark emissive texels (crystals, heal cross, frost). Cutout tiles (leaves, plants) use alpha for holes.
- World store: `W` (Map, source of truth) is mirrored by `CSTORE`, one Uint8Array per 16x16 column, index `y*256 + lz*16 + lx`. Every write must go through `setRaw` (and `clearWorld`). `getBlock` reads the typed mirror.
- Mesher (`buildChunk`): copies the chunk plus a 7 block margin (`LM`) into a padded region, floods sky light (columns then BFS, 2 levels per block) and block light (EMIT table: torch, lava, crystals, portal), then emits faces with per vertex AO, averaged light, biome tint and shader flags. Three meshes per chunk: opaque, cutout (leaf shell, tall grass, grass tufts and flowers, double sided, alpha tested, dappled leaf shadows via `depthCutout`), water (surface lowered to 0.875, per corner depth for clear shallows). Chunk record also keeps `sky`/`blk` light arrays; `lightAt`/`blockLightAt` read them. Edits call `markDirty`, which queues the chunk now and relights neighbours via `dirtyLow`.
- Vertex attributes: `uv` (Uint16 normalized), `aTint` (rgb tint x1.5 + flags byte), `aLight` (ao, sky, block, face id). Flags: 1 grass side tint mask, 2 emissive texels, 4 lava, 8 plant, 16 waving leaves, 32 waving plant tip.
- Materials: `matTerrain`, `matCutout`, `matWaterS`, `skyMat` are ShaderMaterials sharing uniform objects in `U` (and `skyU`). They use three's shadow map chunks, do their own sky matched fog, and decode sRGB manually. Built-in materials are patched at startup (`linearizeBuiltinColors`) so hex colours are treated as sRGB; without that everything looks pastel.
- Environment: `updateEnv` runs every frame, turns the sun height into sky, fog and light colours via `GFXLIB.skyEnv` keyframes, sets per dimension overrides (fire haze, End void, fixed day for realm, mario, sky), closes fog in caves and underwater, and drives the three.js lights so Lambert entities match the terrain.
- Shadows: `positionSunShadow` keeps the sun shadow map centred on Thomas, snapped to texels. `tagEntityShadows` (every 0.75 s) makes solid entity meshes cast and receive shadows and gives flat Lambert materials a subtle fur detail map.
- Post: `renderFrame` renders into a HalfFloat multisampled target, then bloom chain, god rays, eye adaptation (`POST.exposure`), ACES, grade, vignette. Needs WebGL2 + EXT_color_buffer_float; off on touch and the Low tier, in which case materials tone map directly. r128 does not recompile on a tone mapping change, so `setPost` marks materials dirty.
- Quality tiers (`GFX`): dist, shadows, pixel ratio, cloud raymarch steps, shadow map size and radius. `updateDynRes` lowers the pixel ratio when fps drops under 45 and restores it with headroom.
- Block light colour: `rC` carries a palette index (`LPAL`, `LCOL`) through the block light flood fill; vertices get the light weighted colour in `aBCol`.
- Weather (`weather`, `updateWeather`, `applyWeatherEnv`): clear, rain, storm cycles in the overworld; snow where the biome is cold or high. Rain streaks and snow points stop on the highest block of each column (`colTop`, cached 2 s). `U.uWet` makes top faces darker and glossy with puddles that reflect the sky; lightning flashes plus delayed thunder in storms; looped rain noise.
- Ambient life (`updateAmbientLife`): fireflies at night, falling leaves under canopies, bird flocks and birdsong by day.
- Dev hooks for automated visual tests: `window.DEV` (start, go, look, time, tp, gfx, third, nocine, place, slot, ids, stats, surf, state, weather, crack).

## Gameplay systems added with the renderer

- Inventory: `hotbar` (9) plus `bag` (27). Use `addItem`/`giveItems`/`countItem`/`consumeItem`, which span both. Stacks cap at 64, tools stack 1 and carry `dur` (`toolMaxDur`, `wearTool`). Saves store `bag`.
- Ores and tiers: coal, iron, gold, diamond ores by depth (about 1.4% of stone). `minTier` on a block needs a pickaxe of that tier (wood 1, stone 2, iron 3, diamond 4) or it drops nothing (`canHarvest`). Smelting recipes carry `furnace: 1` and need a placed Furnace within 4 blocks (`nearFurnace`).
- Armor: the best armor item carried is worn automatically (`bestArmor`), reducing damage in `damage()`.
- Mining feel: `updateCrack` crack overlay, `blockParticles` chips sampled from the atlas, `popDrop` item that flies to Thomas.
- World gen: `riverAt` carves rivers in `heightAt` (kept 28+ blocks from spawn), cave mouths (`caveMouthAt`), gravel pockets, birch and spruce trees by biome, snowy taiga ground, boulders.
- Villages: one possible village per 144 block cell (`villageInCell`, deterministic `layoutVillage`), built per chunk and clipped to it (`buildVillagePart`) so generation order never matters. Wells, plaza, paths, houses with glass, lanterns, beds, job blocks and loot chests, lamp posts, farm. `VKEEP` keeps villages off Creature Valley, portals and spawn. Villagers (`villagers`, `updateVillagers`) spawn within 70 blocks, wander between the well and their doors, and trade through `openShop(list, title)` using `VSHOPS` (buy rows have `cost`, sell rows have `sell` and `gain`).

## Architecture

One IIFE, `"use strict"`. Global state lives in closures, not modules yet.

- Blocks: global Map `W` keyed `"x,y,z"` mirrored into typed arrays (see Rendering). Chunk streaming by render distance with a per frame time budget. Substepped AABB physics.
- Player constants: `HW=0.3` half width, `PH=1.8` height, `EYE=1.62`. Declared near `const player`. (These once went missing and the physics threw every frame, black screen. If you refactor, keep them.)
- Block ids: AIR0 GRASS1 DIRT2 STONE3 WOOD4 LEAVES5 SAND6 WATER7 LAVA8 FIRESTONE9 ENDSTONE10 PORTAL11 PLANKS12 COBBLE13 TORCH14 CHEST15 SNOW16 BRICK17 BED18 FIRE_CRYSTAL19 ... PIPE33 COAL_ORE34 IRON_ORE35 GOLD_ORE36 DIAMOND_ORE37 FURNACE38 GLASS39 BIRCH_WOOD40 BIRCH_LEAVES41 SPRUCE_WOOD42 SPRUCE_LEAVES43 GRAVEL44 HAY45 PATH46 LANTERN47 STONEBRICK48. The atlas holds 64 tiles and has 63 used; `buildAtlas` throws if it overflows.
- Item ids (>=100): I_HAND100 I_WPICK101 I_SPICK102 I_SWORD103 I_AXE104 I_FIRECHARM105 I_FIRESWORD106 I_APPLE110 I_STICK111 ... I_COAL115 I_IRON116 I_GOLD117 I_DIAMOND118 I_IPICK119 I_DPICK120 I_ISWORD121 I_DSWORD122 I_IAXE123 I_DAXE124 I_IARMOR125 I_DARMOR126 I_BREAD127 I_GAPPLE128.
- Noise: `hsh`/`hsh3` uniform hashes via Math.imul (do not use plain big int multiply, it overflows to float and biases terrain), `vn`/`vn3` value noise, `fbm`. Shared `biomeAt`, `heightAt`, `caveAt`.
- Dimensions: `loadDimension(name)` for overworld, fire, end. Fire has heat damage unless you hold a Flame Charm. End gates dragon damage behind four crystals (`crystalsLeft`).
- Audio: WebAudio synth, no asset files. `blip`, `noiseHit`, `SFX`, generative `playPad`/`updateMusic`. Master gains `sfxGain`, `musicGain`.
- UI overlays via `show(id)`/`hide(id)`. HUD ids in index.html.
- Save: localStorage key `thomas_voxel_save_v2`. Settings key `thomas_voxel_settings`. Achievements key `thomas_voxel_ach` (cumulative across playthroughs).

## Hard lessons (do not repeat)

- Undeclared player AABB constants threw every physics frame and rendered a black screen. `node --check` passed. Always run the harness boot.
- A non uniform hash biased all terrain below sea level so the world was near total ocean. Tune noise against measured distributions, not guesses.
- The harness Mesh stub once dropped the material arg, so `body.material.emissive` was undefined in tests. That was a stub gap, not a game bug. Fix the stub, not the game.
- r128 feeds material hex colours to shaders unconverted while outputting sRGB, which washed every model out. Keep `linearizeBuiltinColors` and decode textures yourself in custom shaders.
- AO quads must split through the darker diagonal (`b0 + b2 > b1 + b3` flips), otherwise corners show hard triangles.
- `surfaceY` treats leaves as ground. Anything placed "on the surface" in a forest lands on the canopy; the spawn camp clears a glade first.

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

Then, in priority order: bow and arrows with an ammo item, full crafting table grid, farm animals and cooking, flowing water and lava. Rendering follow ups: coloured block light, mob textures. Block icons in the hotbar, inventory, chest and crafting list are painted from the atlas by `blockIconURL` (cached data URLs, colour swatch fallback).

## Deploy

GitHub Pages serves static files. `.github/workflows/deploy.yml` validates and deploys on every push to main. Ship index.html, styles.css, gfx.js, game.js and assets (and the bundled output once Vite is added). The CDN Three.js means no asset hosting is needed.
