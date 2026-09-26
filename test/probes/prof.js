const T = (f, n) => { const t = performance.now(); for (let i = 0; i < n; i++) f(); return ((performance.now() - t) / n).toFixed(2); };
buildChunk(0, 0);
console.log('fill', T(() => fillRegion(0, 0), 50), 'light', T(() => { fillRegion(0, 0); lightRegion(); }, 50), 'full', T(() => buildChunk(0, 0), 50));
let cut = 0, op = 0; for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) { buildChunk(cx, cz); const c = chunks.get(ck(cx, cz)); if (c.cutout) cut += c.cutout.geometry.attributes.position.array.length / 3; if (c.opaque) op += c.opaque.geometry.attributes.position.array.length / 3; }
console.log('opaque verts', op, 'cutout verts', cut);
