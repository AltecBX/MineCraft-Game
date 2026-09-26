/* post.js: Post processing and frame rendering.
   Part of Thomas and the Block World. Classic script: every src/ file shares one global scope and loads in numeric order (see index.html). */
"use strict";

// ---------- POST PROCESSING: HDR multisampled scene target, bloom chain, god rays, eye adaptation, tone map + grade ----------
const POST = { on: false, rt: null, down: [], up: [], w: 0, h: 0, exposure: 1, scene: null, cam: null, quad: null, mats: null };
function postSupported() {
  try { return !isTouch && !!(renderer.capabilities && renderer.capabilities.isWebGL2) && !!THREE.WebGLMultisampleRenderTarget && !!(renderer.extensions && renderer.extensions.has && renderer.extensions.has("EXT_color_buffer_float")); }
  catch (e) { return false; }
}
function postMat(frag, uniforms) { return new THREE.ShaderMaterial({ uniforms, vertexShader: SH.POST_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped: false }); }
function postInit() {
  if (POST.mats) return;
  POST.scene = new THREE.Scene(); POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); POST.quad.frustumCulled = false; POST.scene.add(POST.quad);
  POST.mats = {
    bright: postMat(SH.BRIGHT_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.1 } }),
    down: postMat(SH.DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
    up: postMat(SH.UP_FRAG, { tSrc: { value: null }, tLow: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 } }),
    comp: postMat(SH.COMPOSITE_FRAG, { tScene: { value: null }, tBloom: { value: null }, tRays: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.07 },
      uRays: { value: 0 }, uSunPos: { value: new THREE.Vector2(0.5, 0.5) }, uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uTint: { value: new THREE.Color(1, 1, 1) } })
  };
}
function postDispose() {
  if (POST.rt) POST.rt.dispose(); for (const r of POST.down) r.dispose(); for (const r of POST.up) r.dispose();
  POST.rt = null; POST.down = []; POST.up = []; POST.w = POST.h = 0;
}
function postResize() {
  const pr = renderer.getPixelRatio(), w = Math.max(1, Math.floor(innerWidth * pr)), h = Math.max(1, Math.floor(innerHeight * pr));
  if (POST.rt && POST.w === w && POST.h === h) return;
  postDispose(); POST.w = w; POST.h = h;
  const o = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, stencilBuffer: false };
  POST.rt = new THREE.WebGLMultisampleRenderTarget(w, h, Object.assign({ depthBuffer: true }, o)); POST.rt.samples = 4;
  let lw = w, lh = h;
  for (let i = 0; i < 5; i++) { lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); POST.down.push(new THREE.WebGLRenderTarget(lw, lh, Object.assign({ depthBuffer: false }, o))); }
  for (let i = 0; i < 4; i++) POST.up.push(new THREE.WebGLRenderTarget(POST.down[i].width, POST.down[i].height, Object.assign({ depthBuffer: false }, o)));
}
function postPass(mat, target) { POST.quad.material = mat; renderer.setRenderTarget(target); renderer.render(POST.scene, POST.cam); }
function setPost(on) {
  on = !!on && postSupported();
  if (on === POST.on) return;
  POST.on = on;
  if (on) postInit(); else postDispose();
  renderer.toneMapping = on ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  const seen = new Set(), mark = m => { if (m && !seen.has(m)) { seen.add(m); m.needsUpdate = true; } };  // r128 does not recompile on a tone mapping change by itself
  for (const sc of [scene, vScene]) sc.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mark); });
  [matTerrain, matCutout, matWaterS, skyMat, depthCutout, portalMat, torchMat, torchHeadMat, torchGlowMat].forEach(mark);
}
const _sunNdc = new THREE.Vector3();
function renderFrame(withView) {
  // eye adaptation: open up in caves and at night, settle back in daylight
  const night = skyU.uStars.value, cave = DIM === "overworld" ? THREE.MathUtils.clamp(1 - envLocal.sky * 1.5, 0, 1) * (1 - envLocal.blk * 0.6) : 0;
  const target = (1 + night * 0.35) * (1 + cave * 0.7) * (envLocal.water ? 1.15 : 1);
  POST.exposure += (target - POST.exposure) * Math.min(1, lastDt * 1.4);
  if (!POST.on) {
    renderer.toneMappingExposure = 1.02 * POST.exposure;
    renderer.render(scene, camera);
    if (withView) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vScene, vCam); renderer.autoClear = true; }
    return;
  }
  postResize();
  renderer.setRenderTarget(POST.rt); renderer.render(scene, camera);
  if (withView) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vScene, vCam); renderer.autoClear = true; }
  const M = POST.mats;
  M.bright.uniforms.tSrc.value = POST.rt.texture; M.bright.uniforms.uTexel.value.set(1 / POST.w, 1 / POST.h); postPass(M.bright, POST.down[0]);
  for (let i = 1; i < 5; i++) { const s = POST.down[i - 1]; M.down.uniforms.tSrc.value = s.texture; M.down.uniforms.uTexel.value.set(1 / s.width, 1 / s.height); postPass(M.down, POST.down[i]); }
  let low = POST.down[4];
  for (let i = 3; i >= 0; i--) { M.up.uniforms.tSrc.value = POST.down[i].texture; M.up.uniforms.tLow.value = low.texture; M.up.uniforms.uTexel.value.set(1 / low.width, 1 / low.height); postPass(M.up, POST.up[i]); low = POST.up[i]; }
  const C = M.comp.uniforms;
  C.tScene.value = POST.rt.texture; C.tBloom.value = POST.up[0].texture; C.tRays.value = POST.down[1].texture; C.uExposure.value = POST.exposure;
  // god rays only while the sun is up and roughly in view
  let rays = 0;
  const sd = U.uSunDir.value, hasSun = DIM === "overworld" || DIM === "sky" || DIM === "realm" || DIM === "mario";
  if (hasSun && sd.y > -0.02 && !envLocal.water) {
    _sunNdc.set(camera.position.x + sd.x * 300, camera.position.y + sd.y * 300, camera.position.z + sd.z * 300).project(camera);
    if (_sunNdc.z < 1 && Math.abs(_sunNdc.x) < 1.6 && Math.abs(_sunNdc.y) < 1.6) {
      C.uSunPos.value.set(_sunNdc.x * 0.5 + 0.5, _sunNdc.y * 0.5 + 0.5);
      rays = 0.34 * (1 - Math.max(0, Math.hypot(_sunNdc.x, _sunNdc.y) - 0.6) / 1.2) * THREE.MathUtils.clamp(sd.y * 6 + 0.3, 0, 1) * (0.5 + 0.5 * THREE.MathUtils.clamp(1 - sd.y * 1.5, 0, 1));
    }
  }
  C.uRays.value = Math.max(0, rays);
  if (envLocal.water) C.uTint.value.setRGB(0.75, 0.95, 1.05); else C.uTint.value.setRGB(1, 1, 1);
  postPass(M.comp, null);
}
let lastDt = 0.016;
