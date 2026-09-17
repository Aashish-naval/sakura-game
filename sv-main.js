/* ============================================================
   SAKURA VILLAGE · 5/5 — input, main loop, startup
   ============================================================ */
(() => {
'use strict';
const THREE = window.THREE;
const { store, G, renderer, camera } = SV;
const sys = SV.sys;
const ui = SV.ui;
const ent = SV.ent;

/* ---------------- input ---------------- */
let dragging = false;
let lockPauseAt = -1e9;
window.addEventListener('keydown', (e) => {
  G.keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  sys.AudioSys.init();
  if (e.repeat) return;
  const s = store.get();
  if (e.code === 'KeyL' && s.phase === 'playing' && !s.paused){
    G.lanternOn = !G.lanternOn;
    ent.lanternProp.visible = G.lanternOn;
    ent.lanternLight.intensity = G.lanternOn ? 2.2 : 0;
    sys.AudioSys.pluck(G.lanternOn ? 600 : 320, 0, 0.3, 0.15);
    return;
  }
  if (s.dialogue && G.uiOpts){
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= (s.dialogue.options ? s.dialogue.options.length : 0)) ui.chooseOption(n - 1);
    return;
  }
  if (e.code === 'Escape'){
    if (s.phase !== 'playing') return;
    if (performance.now() - lockPauseAt < 250) return;
    if (s.fishing){ sys.endFishing(); store.set({ paused: true }); return; }
    if (s.dialogue){ store.set({ dialogue: null, paused: true }); G.uiOpts = false; ui.hideOptions(); return; }
    if (s.racing){ sys.endRace(false); return; }
    sys.togglePause();
    return;
  }
  if (s.phase !== 'playing' || s.paused) return;
  if (e.code === 'KeyE'){
    if (s.fishing){
      const F = G.fish;
      if (F && F.phase === 'strike') sys.resolveFishStrike();
      else if (F) sys.endFishing();
      return;
    }
    if (s.racing) return;
    if (s.dialogue) sys.advanceDialogue();
    else if (s.prompt) sys.doInteract(s.prompt.id);
    else if (s.banner) store.set({ banner: null });
  }
});
window.addEventListener('keyup', (e) => G.keys.delete(e.code));
window.addEventListener('blur', () => G.keys.clear());
window.addEventListener('mousemove', (e) => {
  const s = store.get();
  if (s.phase !== 'playing' || s.paused || s.dialogue || s.fishing) return;
  // mouse movement steers the camera directly (pointer lock), drag is the fallback
  if (document.pointerLockElement === renderer.domElement) sys.applyLook(e.movementX, e.movementY);
  else if (dragging && (e.buttons & 1)) sys.applyLook(e.movementX, e.movementY);
});
window.addEventListener('mousedown', (e) => {
  sys.AudioSys.init();
  const s = store.get();
  if (s.phase !== 'playing' || s.paused) return;
  if (e.target && e.target.closest && e.target.closest('button')) return;
  if (s.dialogue){ if (!G.uiOpts) sys.advanceDialogue(); return; }
  if (e.target === renderer.domElement && !document.pointerLockElement){
    dragging = true;
    sys.requestLock();
  }
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('wheel', (e) => {
  const s = store.get();
  if (s.phase === 'playing' && !s.paused) G.cam.distTarget = THREE.MathUtils.clamp(G.cam.distTarget + e.deltaY * 0.004, 2.6, 9);
}, { passive: true });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  store.set({ locked });
  if (locked) store.set({ dragMode: false });
  if (!locked){
    dragging = false;
    const s = store.get();
    if (s.phase === 'playing' && !s.paused && !s.dialogue && !G.uiOpts){
      store.set({ paused: true });
      lockPauseAt = performance.now();
    }
  }
});
window.addEventListener('contextmenu', (e) => { if (store.get().phase === 'playing') e.preventDefault(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => sys.saveGame());

/* ---------------- buttons ---------------- */
const wire = (el, fn) => el.addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
wire(ui.els.startBtn, () => { try { localStorage.removeItem(SV.SAVE_KEY); } catch (e) {} sys.restartGame(); });
wire(ui.els.contBtn, () => sys.continueGame());
wire(ui.els.resumeBtn, () => sys.togglePause());
wire(ui.els.restartBtn, () => sys.restartGame());
wire(ui.els.dayNightBtn, () => sys.toggleDayNight());
wire(ui.els.muteBtn, () => { store.set({ muted: !store.get().muted }); sys.saveGame(); });
wire(ui.els.controlsBtn, () => {
  const open = ui.els.controlsList.style.display === 'flex';
  ui.els.controlsList.style.display = open ? 'none' : 'flex';
  ui.els.controlsBtn.textContent = (open ? 'Show' : 'Hide') + ' Controls';
});

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
let elapsed = 0, fpsFrames = 0, fpsLast = performance.now(), hudTick = 0, mmT = 0, loopErrShown = false;
function loop(){
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const s = store.get();
  try {
    sys.updateDayNight(dt);
    sys.updatePetals(dt, elapsed);
    sys.updatePlayer(dt);
    sys.updateNPCs(dt, elapsed);
    sys.updateCrows(dt, elapsed);
    sys.updateFireflies(dt, elapsed);
    sys.updateFox(dt, elapsed);
    sys.updateCat(dt, elapsed);
    sys.updateCharms(dt, elapsed);
    sys.updateCamera(dt);
    if (G.race) sys.updateRace(dt);
    if (s.fishing && G.fish) sys.updateFishing(dt, elapsed);
    sys.updateInteraction();
  } catch (err) {
    if (!loopErrShown){ loopErrShown = true; console.error('[Sakura Village] update error:', err); }
  }

  hudTick += dt;
  if (hudTick > 0.4){
    hudTick = 0;
    if (s.phase === 'playing' && !s.paused){
      const tr = ui.trackerInfo();
      if (ui.els.objText.textContent !== tr.main) ui.els.objText.textContent = tr.main;
      if (ui.els.objSub.textContent !== tr.sub) ui.els.objSub.textContent = tr.sub;
      if (s.stage >= 2) ui.els.sigilRow.innerHTML = Object.keys(SV.SIGIL_KANJI).map(k => `<span class="sigil${s.sigils[k] ? ' lit' : ''}" title="${SV.SIGIL_NAMES[k]}">${SV.SIGIL_KANJI[k]}</span>`).join('');
    }
  }
  mmT += dt;
  if (mmT > 0.12){ mmT = 0; ui.drawMinimap(elapsed); }
  if (G.race){
    ui.els.raceChip.style.display = '';
    ui.els.raceChip.textContent = G.race.phase === 'count'
      ? (Math.ceil(-G.race.t) > 0 ? Math.ceil(-G.race.t) + '…' : 'GO!')
      : `⚑ ${Math.min(G.race.cp + 1, SV.RACE_CPS.length)}/${SV.RACE_CPS.length} · ${G.race.t.toFixed(1)}s`;
  } else ui.els.raceChip.style.display = 'none';

  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 500){ ui.els.fpsChip.textContent = Math.round(fpsFrames * 1000 / (now - fpsLast)) + ' fps'; fpsFrames = 0; fpsLast = now; }
  ui.updateClock(G.time.t);
  renderer.render(SV.scene, camera);
}

/* ---------------- startup ---------------- */
function start(){
  SV.setSakuraBloom(false);
  ui.syncUI();
  sys.applyStoryWorld();
  renderer.setAnimationLoop(loop);
}
SV.main = { start };
})();