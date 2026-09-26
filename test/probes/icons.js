// hotbar, inventory and chest cells must render every block id without throwing (icons fall back to colour swatches headless)
let n = 0;
for (const k of Object.keys(BLOCKS)) { const id = +k; hotbar[4] = { id, count: 5 }; renderHotbar(); renderInv(); cellEl(hotbar[4], () => {}); blockSwatch(id); n++; }
console.log('icons rendered for', n, 'blocks, cached', Object.keys(ICON_URL).length);
