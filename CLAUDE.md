# CLAUDE.md

Project memory for Claude Code. Read this before editing.

## What this is

A single screen browser voxel survival game, Minecraft style, built on Three.js r128 loaded from a CDN. Main character is named Thomas. Desktop and mobile controls. Three dimensions (overworld, fire, end), two reworked bosses (Fire Guardian, Black Dragon), survival, crafting, companions, quests, achievements. It runs with no build step today. It is meant to deploy to GitHub Pages as static files.

## Files

```
index.html        head, body DOM, loads three.min.js (CDN), gfx.js, then every src/ file in order
styles.css        all CSS
gfx.js            renderer toolkit: procedural texture atlas, noise, detail maps, all GLSL, atmosphere model (window.GFXLIB)
src/NN-name.js    the game, split by system into 28 classic scripts (list below)
src/FILES         the load order, one file per line; index.html and the harness both follow it
test/harness.cjs  Node validation harness (stubs THREE + DOM + audio + storage, loads gfx.js, then src/ in order)
test/probes/      probe scripts the harness injects and runs (render, render2: renderer; gameplay: inventory, ores, villages, weather;
                  crafting: grid and recipe discovery; farmbow: bow and farm animals; fluids: water, lava, buckets, fences, shield, dodge;
                  furnace: timed smelting)
package.json      dev server, test and check scripts
```

The game source (`src/`):

```
  01-engine.js
  02-audio.js
  03-blocks.js
  04-world.js
  05-villages.js
  06-mesher.js
  07-fluids.js
  08-player.js
  09-input.js
  10-mining.js
  11-inventory.js
  12-monsters.js
  13-animals.js
  14-combat.js
  15-viewmodel.js
  16-environment.js
  17-dimensions.js
  18-quests.js
  19-ui.js
  20-furnace.js
  21-save.js
  22-story.js
  23-realm.js
  24-mario.js
  25-hud.js
  26-weather.js
  27-post.js
  28-main.js
```

### How the split works (read before adding files)

The src files are classic scripts, not ES modules. Top level `const`, `let` and `function` declarations in one file are visible to every later file because classic scripts share one global scope, so the game still runs with no bundler and GitHub Pages serves it as is. Each file starts with `"use strict"`.

The one rule that is new since the split: function declarations only hoist inside their own file. Code that runs at load time (top level statements, `addEventListener(..., fn)` with a bare function name, top level `if` blocks) must only name functions from the same or an earlier file. Wrap forward references in an arrow (`() => laterFn()`), which is resolved when it is called. Runtime calls inside functions are fine in any direction. Adding a file: create it with the next number, add it to `src/FILES` and a `<script>` tag in index.html at the same position.

Vite was considered and left out on purpose: it would add a build step to the Pages deploy for a dev server nicety, while the ordered script split already gives small, focused files.

## How to run

No bundler required. Any static server works because the src files are classic scripts and Three.js comes from the CDN.

```
npx --yes serve .            # then open the printed URL
# or
python3 -m http.server 8000  # then open http://localhost:8000
```

Opening index.html directly mostly works, but a server is better so localStorage saves behave.

## How to validate every change (required)

`node --check` only catches syntax. It does NOT catch undeclared references or runtime errors. A real bug once shipped that way (see Hard lessons). So after any edit:

1. Syntax: `npm run check` (runs `node --check` on gfx.js and every src file)
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

## Rendering (see gfx.js, src/01-engine.js, src/06-mesher.js, src/27-post.js)

Realistic look, all procedural, no image assets.
- Texture atlas: `GFXLIB.buildAtlas()` paints every block tile at 64px from seeded periodic noise into 128px cells with wrap padding (no mip bleeding). The atlas is 16 x 8 cells (2048 x 1024, 128 tiles max, 67 used), so tiles carry separate u and v scales (`s`, `sv`) and pixel lookups use `ATL.w`/`ATL.h`. Uploaded once as `atlasTex` (nearest mag, trilinear min, anisotropy). Opaque tiles use alpha < 255 to mark emissive texels (crystals, heal cross, frost). Cutout tiles (leaves, plants) use alpha for holes.
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
- Dev hooks for automated visual tests: `window.DEV` (start, go, look, time, tp, gfx, third, nocine, place, slot, ids, items, stats, surf, state, weather, crack, give, mob, herd, animal, draw, shoot, grid).

## Gameplay systems added with the renderer

- Inventory: `hotbar` (9) plus `bag` (27). Use `addItem`/`giveItems`/`countItem`/`consumeItem`, which span both. Stacks cap at 64, tools stack 1 and carry `dur` (`toolMaxDur`, `wearTool`). Saves store `bag`.
- Ores and tiers: coal, iron, gold, diamond ores by depth (about 1.4% of stone). `minTier` on a block needs a pickaxe of that tier (wood 1, stone 2, iron 3, diamond 4) or it drops nothing (`canHarvest`). Smelting recipes carry `furnace: 1` and need a placed Furnace within 4 blocks (`nearFurnace`).
- Armor: the best armor item carried is worn automatically (`bestArmor`), reducing damage in `damage()`.
- Mining feel: `updateCrack` crack overlay, `blockParticles` chips sampled from the atlas, `popDrop` item that flies to Thomas.
- World gen: `riverAt` carves rivers in `heightAt` (kept 28+ blocks from spawn), cave mouths (`caveMouthAt`), gravel pockets, birch and spruce trees by biome, snowy taiga ground, boulders.
- Villages: one possible village per 144 block cell (`villageInCell`, deterministic `layoutVillage`), built per chunk and clipped to it (`buildVillagePart`) so generation order never matters. Wells, plaza, paths, houses with glass, lanterns, beds, job blocks and loot chests, lamp posts, farm. `VKEEP` keeps villages off Creature Valley, portals and spawn. Villagers (`villagers`, `updateVillagers`) spawn within 70 blocks, wander between the well and their doors, and trade through `openShop(list, title)` using `VSHOPS` (buy rows have `cost`, sell rows have `sell` and `gain`).

## Crafting, bow and farm animals

- Crafting grid: `RECIPES` entries are `shaped(out, n, pattern)` (letters from `CK`), `shapeless(out, n, need)` or `smelt(out, n, need)`. A shaped recipe's `need` is derived from its pattern at startup, so the recipe book (Make) and the grid always cost the same. Recipes wider or taller than 2 (or shapeless with more than 4 items) set `table` and need a Crafting Table within 4 blocks (`nearTable`); smelting and cooking need a Furnace (`nearFurnace`). The bag shows a 2 x 2 grid, a table shows 3 x 3 (`gridSize`). `cgrid` holds item ids reserved from the inventory; nothing is taken until `craftFromGrid`. `matchGrid` trims the grid, compares shaped patterns and their mirror, then shapeless multisets. The book's Grid button lays a pattern out (`gridShow`). The spawn camp has a table so the first pickaxe works.
- Stacking: tools, weapons, armor and charms stack 1 (`stackMax`), every other item stacks to 64.
- Item icons: new items are painted on a canvas by `ITEM_PAINT` (`itemIconURL`, cached); items without a painter keep their emoji. Dropped items use the same painter.
- Bow (`I_BOW`, `draw: 1`): `updateBow` runs first in `updateMining`. Holding attack draws (`bowDraw`, full power at 0.9 s, slows Thomas and zooms the FOV), releasing calls `loosePlayerArrow`, which needs an `I_ARROW`. Arrows (`arrows`, `spawnArrow`, `updateArrows`) fly with gravity (`ARROW_G`), drag in water, hit targets from `arrowTargets` (cylinders and spheres, no raycaster), stick in blocks, drop when the block is mined, and are picked back up. The Ice Bow and Slime Launcher keep their instant magic shots. Skeleton archers (`MTYPE.archer`) spawn at night and shoot real arrows via `mobShootArrow` with gravity lead.
- Farm animals (`FARM`, `farm`, `spawnFarmAnimal`, `updateFarm`): cows, pigs, sheep and chickens with block collision (`animalCellOk`: a two block wall pens them, they step up one block, avoid cliffs and water), idle, walk, graze, panic when hit (the herd scatters), follow their food in Thomas's hand, breed after both are fed (`animalInteract`, `breedAnimals`), babies grow in 180 s. Shears give wool (sheep regrow it by grazing), chickens lay eggs, deaths drop meat, leather and feathers as `groundItems` that drift to Thomas. Fed, bred and sheared animals are `kept`: never despawned, saved (`serializeFarm` in the save's `farm`), stashed across dimension trips (`stashFarm`, `restoreFarm`). Wild herds spawn by biome 26 to 48 blocks away and despawn past 110. Each model's static boxes are merged into one vertex coloured mesh per moving part (`mergeParts`, colours linearized by hand).
- Villages now include a Fletcher (arrows, bows, flint, feathers) and animals near the farm; the Farmer sells Shears and buys meat, wool and eggs.

## Fluids, fences, furnaces and combat extras

- Fluids (`src/07-fluids.js`): water and lava keep their block id; the flow level lives in `FSTORE` (a Uint8Array per column like `CSTORE`, created only where something flows): 0 source, 1 to 7 flowing, 8 falling. `setRaw` resets a cell's level. `fluidSet` writes a change, remeshes, records it (`editsByDim` plus `flowEditsByDim` for levels) and wakes neighbours. `updateFluids` ticks water every 0.25 s and lava every 0.9 s with a 500 cell budget. Rules: fall first, spread only on solid ground or a source below, water reaches 7 blocks and lava 3, flows drain when unfed, two water sources make a spring, lava next to water becomes obsidian (source) or cobblestone (flow), lava falling on water makes stone. Only edits wake fluids (`recordEdit` calls `fluidNotify`), so generated seas stay still. Currents (`flowVec`) push Thomas and dropped items. Flows are saved (`flows`) and resume on load.
- Fluid meshing: `rF` carries levels into the padded region. Water tops use shared corner heights (`fluidCorners`: average of the up to four water cells around a corner, 1 when water sits above) so flows slope and meet without gaps. Flowing lava is drawn by `cubeFace` with lowered corner heights (`hts`) and does not occlude neighbours.
- Buckets: empty buckets scoop a still source (`voxelRaycast(reach, true)` stops on water), water and lava buckets pour a source, water boils away in the fire dimension, a bucket on a cow gives milk, drinking it returns the bucket (`returns`).
- Fences and gates (`FENCE`, `GATE`, `GATE_OPEN`): mesh kind 5 built from boxes (`fenceModel`, `boxPart`), rails link to fences, gates and solid blocks. `isTall` blocks stand 1.5 high: `aabbHit` checks the half block above them, `tallBelow` lands Thomas on top, `animalCellOk` refuses to step over them. Right click or E swings a gate (`toggleGate`), never shut on Thomas.
- Furnaces (`src/20-furnace.js`): per furnace input, fuel and result slots in `furnaceStore` keyed by dimension and position. `tickFurnace` advances by real elapsed time (capped at an hour), so furnaces work while Thomas is away and across reloads. `SMELT_T` 4 s per item, `SMELTS` recipes, `FUELS` in items per fuel (coal 8, lava bucket 50 and returns the bucket, wood and planks 1.5, stick 0.5). Breaking a furnace spills its contents. The recipe book's instant smelting still works too.
- Shield (`I_SHIELD`): right click (Build on mobile) raises it while held (`blocking`), 80% of a hit is soaked and wears the shield, movement slows. Dodge rolls grant 0.35 s of invulnerability (`dodge.iframe`).
- Monster skins: `mobSkin(type)` paints a grayscale pattern per creature (scales, hide, spots, stripes, rock, magma, plate, bone, mist) that tints with the monster colour; fire creatures get a glow mask for burning magma veins.
- Recipe discovery: the book shows a recipe once any ingredient has been held (`knownItems`, `learnItem` from `giveItems`, saved as `known`), with a count of recipes still hidden. The grid crafts anything regardless.

## Architecture

Ordered classic scripts in `src/` sharing one global scope (see Files). `"use strict"` in each.

- Blocks: global Map `W` keyed `"x,y,z"` mirrored into typed arrays (see Rendering). Chunk streaming by render distance with a per frame time budget. Substepped AABB physics.
- Player constants: `HW=0.3` half width, `PH=1.8` height, `EYE=1.62`. Declared near `const player`. (These once went missing and the physics threw every frame, black screen. If you refactor, keep them.)
- Block ids: AIR0 GRASS1 DIRT2 STONE3 WOOD4 LEAVES5 SAND6 WATER7 LAVA8 FIRESTONE9 ENDSTONE10 PORTAL11 PLANKS12 COBBLE13 TORCH14 CHEST15 SNOW16 BRICK17 BED18 FIRE_CRYSTAL19 ... PIPE33 COAL_ORE34 IRON_ORE35 GOLD_ORE36 DIAMOND_ORE37 FURNACE38 GLASS39 BIRCH_WOOD40 BIRCH_LEAVES41 SPRUCE_WOOD42 SPRUCE_LEAVES43 GRAVEL44 HAY45 PATH46 LANTERN47 STONEBRICK48 CRAFT_TABLE49 WOOL50 OBSIDIAN51 FENCE52 GATE53 GATE_OPEN54. The atlas holds 128 tiles and has 68 used; `buildAtlas` throws if it overflows.
- Item ids (>=100): I_HAND100 I_WPICK101 I_SPICK102 I_SWORD103 I_AXE104 I_FIRECHARM105 I_FIRESWORD106 I_APPLE110 I_STICK111 ... I_COAL115 I_IRON116 I_GOLD117 I_DIAMOND118 I_IPICK119 I_DPICK120 I_ISWORD121 I_DSWORD122 I_IAXE123 I_DAXE124 I_IARMOR125 I_DARMOR126 I_BREAD127 I_GAPPLE128 I_BOW129 I_ARROW130 I_FLINT131 I_FEATHER132 I_STRING133 I_SHEARS134 I_LEATHER135 I_LARMOR136 I_RAWBEEF137 I_STEAK138 I_RAWPORK139 I_PORKCHOP140 I_RAWMUTTON141 I_MUTTON142 I_RAWCHICKEN143 I_CHICKEN144 I_EGG145 I_PIE146 I_BUCKET147 I_WBUCKET148 I_LBUCKET149 I_MILK150 I_SHIELD151.
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
- `surfaceY` treats leaves as ground. Anything placed "on the surface" in a forest lands on the canopy; the spawn camp clears a glade first, and `spawnHerd` only accepts grass, dirt, snow or path under an animal.
- The harness `Raycaster` always returns no hits and `camera.getWorldDirection` is a stub, so anything that must be tested headless (arrow hits) uses plain geometry tests instead of raycasts.
- Vertex colours are not touched by `linearizeBuiltinColors`; linearize them yourself (pow 2.2) or merged models look washed out.
- After the split, a touch only binding (`bind("bUse", interact)`) named a function from a later file and would have thrown on phones only; the harness never runs touch code. Wrap forward references in arrows, and when touching load time code scan for them (see How the split works).
- The spawn glade cleared only oak leaves and logs, so after birch and spruce forests arrived the whole camp (fire, chest, table) was built on a birch canopy and Thomas woke in the treetops. Clear by `LEAFY` and every log id, and place Thomas with `surfaceY` after the glade is cut.
- Lava and water meeting over a wide area fired dozens of steam puffs a second and drew white smears. Effects triggered by simulations need a rate limit (`fizz` allows one per 150 ms).

## Roadmap

Block icons in the hotbar, inventory, chest and crafting list are painted from the atlas by `blockIconURL` (cached data URLs, colour swatch fallback); items and fence shaped blocks use `ITEM_PAINT`. Deeper follow ups live as TODO notes at the end of `src/28-main.js`.

## Deploy

GitHub Pages serves static files. `.github/workflows/deploy.yml` validates and deploys on every push to main. Ship index.html, styles.css, gfx.js, src/ and assets. The workflow runs `node --check` on gfx.js and every src file, then the harness boot. The CDN Three.js means no asset hosting is needed.
