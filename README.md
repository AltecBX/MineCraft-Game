# Thomas and the Block World

A browser voxel survival game built on Three.js r128. Single screen, desktop and mobile, no build step. Three dimensions, two bosses, survival, crafting, companions, quests, achievements.

## Quick start

```
npx --yes serve .
# or
python3 -m http.server 8000
```

Open the printed URL. A static server is recommended so localStorage saves work cleanly.

## Validate

```
node --check game.js                                 # syntax
node test/harness.cjs                                # boot smoke test, expect BOOT_OK
node test/harness.cjs --probe test/probes/dragon.js  # run a feature probe
```

The harness stubs Three.js, the DOM, WebAudio, and localStorage so the game logic runs headless in Node. Probes run inside the game right after startGame and can touch any internal. See CLAUDE.md for the full method and the conventions to follow.

## Layout

```
index.html   shell, loads three.min.js (CDN) then game.js
styles.css   all CSS
game.js      the whole game in one IIFE
test/        validation harness and example probes
CLAUDE.md    architecture, rules, validation method, roadmap
```

## Where it came from

This started as one HTML file built in seven stages plus an audio and accessibility pass. It was split into index.html, styles.css, and game.js for editing in Claude Code. The logic in game.js is unchanged from the working single file and passes the same harness.

## Next

The recommended first task in Claude Code is splitting game.js into modules and adding Vite. See the Roadmap in CLAUDE.md.

## Deploy

GitHub Pages, static files. Push index.html, styles.css, and game.js to the served branch.
