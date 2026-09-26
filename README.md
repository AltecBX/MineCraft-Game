# Thomas and the Block World

A browser voxel survival game built on Three.js r128. Single screen, desktop and mobile, no build step. Three dimensions, two bosses, survival, crafting, companions, quests, achievements.

The renderer is fully procedural: 64px painted block textures, smooth lighting with ambient occlusion, torch and lava light, sun shadows with dappled leaf shade, a physical sky with raymarched clouds, stars and moon, clear shallow water that deepens to blue, swaying grass and wildflowers, bloom, god rays and eye adaptation. Coloured torch, lava and crystal light, rain, thunderstorms and snow with wet reflective ground, fireflies, falling leaves and birds. No image assets are needed.

Gameplay includes a 36 slot inventory, coal, iron, gold and diamond ores with pickaxe tiers, a furnace for smelting, iron and diamond tools and armor with durability, rivers and cave mouths, birch and spruce forests, villages with trading villagers, a crafting grid (2 x 2 in the bag, 3 x 3 at a Crafting Table) with shaped recipes and a recipe book, a drawable bow with arrows that arc, stick and can be picked back up, skeleton archers, and farm animals (cows, pigs, sheep, chickens) that graze, flee, follow food, breed, give wool, eggs and meat to cook.

## Quick start

```
npx --yes serve .
# or
python3 -m http.server 8000
```

Open the printed URL. A static server is recommended so localStorage saves work cleanly.

## Validate

```
node --check game.js && node --check gfx.js         # syntax
node test/harness.cjs                                # boot smoke test, expect BOOT_OK
node test/harness.cjs --probe test/probes/dragon.js  # run a feature probe
```

The harness stubs Three.js, the DOM, WebAudio, and localStorage so the game logic runs headless in Node. Probes run inside the game right after startGame and can touch any internal. See CLAUDE.md for the full method and the conventions to follow.

## Layout

```
index.html   shell, loads three.min.js (CDN), gfx.js, then game.js
styles.css   all CSS
gfx.js       procedural textures, shaders and the atmosphere model
game.js      the whole game in one IIFE
test/        validation harness and example probes
CLAUDE.md    architecture, rules, validation method, roadmap
```

## Where it came from

This started as one HTML file built in seven stages plus an audio and accessibility pass. It was split into index.html, styles.css, and game.js for editing in Claude Code. The logic in game.js is unchanged from the working single file and passes the same harness.

## Next

The recommended first task in Claude Code is splitting game.js into modules and adding Vite. See the Roadmap in CLAUDE.md.

## Deploy

GitHub Pages, static files. Every push to main is validated and deployed by .github/workflows/deploy.yml.
