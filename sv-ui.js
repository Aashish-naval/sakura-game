/* ============================================================
   SAKURA VILLAGE · 4/5 — HUD, dialogue box, journal, minimap
   ============================================================ */
(() => {
'use strict';
const { store, G, isNight, CHARMS, NPCS, KITE, FISH_SPOT, FOX_SHRINE, SUMMIT_BELL,
        MOUNT, RIVER_N, RIVER_S, POND, SIGIL_KANJI, SIGIL_NAMES, CHAPTERS,
        petalIconData } = { ...SV, petalIconData: null };
const sys = SV.sys;

/* ---------------- svg helpers ---------------- */
const petalIcon = (filled, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${
  [0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="5.6" rx="2.9" ry="5" transform="rotate(${a} 12 12)" fill="${filled ? '#d9788c' : 'rgba(0,0,0,0)'}" stroke="#b95f76" stroke-width="1.3"/>`).join('')}<circle cx="12" cy="12" r="2" fill="${filled ? '#e8c26a' : 'rgba(0,0,0,0)'}" stroke="#b98a3e" stroke-width="1"/></svg>`;
const sunSvg = () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="12" y1="3.5" x2="12" y2="6" transform="rotate(${a} 12 12)"/>`).join('')}</svg>`;
const moonSvg = () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" class="moon"><path d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z"/></svg>`;
const soundSvg = (muted) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none"/>${muted ? '<line x1="16" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="16" y2="15"/>' : '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>'}</svg>`;
const phaseWord = (t) => t < 0.21 ? 'Night' : t < 0.30 ? 'Dawn' : t < 0.46 ? 'Morning' : t < 0.56 ? 'Midday' : t < 0.70 ? 'Afternoon' : t < 0.79 ? 'Dusk' : t < 0.85 ? 'Evening' : 'Night';

/* ---------------- mount DOM ---------------- */
const rootEl = document.getElementById('root');
rootEl.innerHTML = '';
const app = document.createElement('div'); app.id = 'app'; rootEl.appendChild(app);
app.appendChild(SV.renderer.domElement);
app.insertAdjacentHTML('beforeend', `
<div class="ui" id="hud" style="display:none">
  <div class="brand">
    <div class="seal">桜</div>
    <div><h1 class="serif">Sakura Village</h1><small>the fading spring</small></div>
  </div>
  <div class="objective paper">
    <div class="label">Objective</div>
    <div class="text serif" id="objText"></div>
    <div class="sub" id="objSub"></div>
    <div class="charm-row" id="charmRow"></div>
    <div class="charm-row" id="sigilRow" style="display:none"></div>
  </div>
  <div class="tr">
    <div class="chip" id="fpsChip">— fps</div>
    <button class="chip icon-btn" id="muteBtn" title="Toggle sound"></button>
  </div>
  <div class="hints">
    <span class="combo"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> move</span>
    <span class="combo"><span class="key">Shift</span> run</span>
    <span class="combo"><span class="key">Space</span> jump</span>
    <span class="combo"><span class="key">E</span> interact</span>
    <span class="combo"><span class="key">L</span> lantern</span>
    <span class="combo"><span class="key">Esc</span> pause</span>
  </div>
  <div class="prompt paper" id="prompt" style="display:none"><span class="key">E</span><span id="promptText"></span></div>
  <div class="mouse-hint" id="mouseHint" style="display:none"></div>
  <div class="paper" id="raceChip"></div>
  <div class="paper" id="fishUI">
    <div class="flabel" id="fishLabel">Wait for it…</div>
    <div id="fishBar"><div id="fishZone"></div><div id="fishMark"></div></div>
  </div>
  <div class="paper" id="minimapWrap"><canvas id="minimap" width="176" height="176"></canvas></div>
  <div class="clock paper">
    <div class="dial">
      <div class="horizon"></div>
      <div class="needle" id="needle"></div>
      <span class="dial-ico" id="sunIco">${sunSvg()}</span>
      <span class="dial-ico" id="moonIco" style="display:none">${moonSvg()}</span>
    </div>
    <div class="phase" id="phaseTxt">Day</div>
  </div>
  <div class="dialogue paper" id="dialogue" style="display:none">
    <div class="name" id="dName"></div>
    <p class="dtext"><span id="dText"></span><span class="cursor" id="dCursor"></span></p>
    <div class="dopts" id="dOpts" style="display:none"></div>
    <div class="dfoot"><span class="key">E</span> next · or click</div>
  </div>
  <div class="banner paper" id="banner" style="display:none">
    <div class="petals" id="bannerPetals"></div>
    <h2 id="bannerTitle" class="serif"></h2>
    <p id="bannerText"></p>
    <p class="sub" id="bannerSub"></p>
  </div>
</div>
<div id="chapter"><div id="chapterTitle" class="serif"></div><div id="chapterSub"></div></div>
<div id="flash"></div>
<div id="svToast"></div>
<div class="overlay start" id="startOverlay">
  <div class="start-panel paper">
    <div class="start-seal">桜</div>
    <div class="start-jp">桜の里</div>
    <div class="start-kicker">A Cozy Mystery in Three Acts</div>
    <h1 class="start-title serif">Sakura Village</h1>
    <div class="rule"></div>
    <p class="start-text">The petals are falling early this year. Three charms have scattered, a fox spirit has gone quiet,
      and the Great Sakura on the mountain is fading. Help the village remember what it forgot —
      the valley's spring is in your hands.</p>
    <div class="controls-grid">
      <span class="combo"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> move</span>
      <span class="combo"><span class="key">Shift</span> run</span>
      <span class="combo"><span class="key">Space</span> jump</span>
      <span class="combo"><span class="key">E</span> interact</span>
      <span class="combo"><span class="key">L</span> lantern</span>
      <span class="combo"><span class="key">Mouse</span> look</span>
      <span class="combo"><span class="key">Wheel</span> zoom</span>
      <span class="combo"><span class="key">Esc</span> pause</span>
    </div>
    <div class="btnrow">
      <button class="btn primary" id="startBtn">Begin a New Stroll</button>
      <button class="btn" id="contBtn" style="display:none">Continue</button>
    </div>
    <div class="foot">runs entirely in your browser · progress auto-saves · mouse recommended</div>
  </div>
</div>
<div class="overlay pause" id="pauseOverlay" style="display:none">
  <div class="pause-panel paper">
    <h2 class="serif">Paused</h2>
    <div class="pause-jp">休</div>
    <div class="menu">
      <button class="btn primary" id="resumeBtn">Resume</button>
      <button class="btn" id="restartBtn">Restart (clears save)</button>
      <button class="btn" id="dayNightBtn">Make it Night</button>
      <button class="btn" id="controlsBtn">Show Controls</button>
    </div>
    <div class="controls-list" id="controlsList">
      <div class="row"><span>Move</span><span class="key">W A S D</span></div>
      <div class="row"><span>Run</span><span class="key">Shift</span></div>
      <div class="row"><span>Jump</span><span class="key">Space</span></div>
      <div class="row"><span>Interact / advance dialogue</span><span class="key">E</span></div>
      <div class="row"><span>Lantern (torch)</span><span class="key">L</span></div>
      <div class="row"><span>Rotate camera</span><span class="key">Mouse</span></div>
      <div class="row"><span>Camera distance</span><span class="key">Wheel</span></div>
      <div class="row"><span>Pause / resume</span><span class="key">Esc</span></div>
    </div>
    <div class="journal">
      <h3>Journal</h3>
      <div id="journalList"></div>
      <h3 style="margin-top:14px">Pouch</h3>
      <div class="inv" id="invRow"></div>
    </div>
  </div>
</div>`);
const $id = (id) => document.getElementById(id);
const els = {
  hud: $id('hud'), startOverlay: $id('startOverlay'), pauseOverlay: $id('pauseOverlay'),
  objText: $id('objText'), objSub: $id('objSub'), charmRow: $id('charmRow'), sigilRow: $id('sigilRow'),
  fpsChip: $id('fpsChip'), muteBtn: $id('muteBtn'), promptEl: $id('prompt'), promptText: $id('promptText'),
  mouseHint: $id('mouseHint'), needle: $id('needle'), sunIco: $id('sunIco'), moonIco: $id('moonIco'),
  phaseTxt: $id('phaseTxt'), dialogueEl: $id('dialogue'), dName: $id('dName'), dText: $id('dText'),
  dCursor: $id('dCursor'), dOpts: $id('dOpts'), bannerEl: $id('banner'), bannerTitle: $id('bannerTitle'),
  bannerText: $id('bannerText'), bannerSub: $id('bannerSub'), bannerPetals: $id('bannerPetals'),
  dayNightBtn: $id('dayNightBtn'), journalList: $id('journalList'), invRow: $id('invRow'),
  raceChip: $id('raceChip'), fishUI: $id('fishUI'), fishZone: $id('fishZone'), fishMark: $id('fishMark'),
  fishLabel: $id('fishLabel'), chapterEl: $id('chapter'), chapterTitle: $id('chapterTitle'),
  chapterSub: $id('chapterSub'), flash: $id('flash'), minimapCv: $id('minimap'),
  startBtn: $id('startBtn'), contBtn: $id('contBtn'), resumeBtn: $id('resumeBtn'),
  restartBtn: $id('restartBtn'), controlsBtn: $id('controlsBtn'), controlsList: $id('controlsList'),
};

/* ---------------- minimap ---------------- */
const mmStatic = document.createElement('canvas'); mmStatic.width = 176; mmStatic.height = 176;
{
  const x = mmStatic.getContext('2d');
  const mx = (wx) => 88 + (wx - 15) * 1.05, my = (wz) => 88 + (wz + 15) * 1.05;
  x.fillStyle = '#e9e0cc'; x.fillRect(0, 0, 176, 176);
  x.fillStyle = '#cfe0b4';
  x.beginPath(); x.arc(mx(50), my(-6), 26, 0, 7); x.fill();
  x.fillStyle = '#bcd8a4'; x.fillRect(mx(-13), my(34), 26 * 1.05, 27 * 1.05);
  x.fillStyle = '#c9c9b8';
  MOUNT.discs.forEach(d => { const c = d.c || [MOUNT.cx, MOUNT.cz]; x.beginPath(); x.arc(mx(c[0]), my(c[1]), d.r * 1.05, 0, 7); x.fill(); });
  x.strokeStyle = '#a8c8d8'; x.lineWidth = 3; x.lineCap = 'round';
  [RIVER_N, RIVER_S].forEach(p => { x.beginPath(); p.forEach((q, i) => i ? x.lineTo(mx(q[0]), my(q[1])) : x.moveTo(mx(q[0]), my(q[1]))); x.stroke(); });
  x.fillStyle = '#a8c8d8'; x.beginPath(); x.arc(mx(POND.x), my(POND.z), 6, 0, 7); x.fill();
  x.strokeStyle = '#d8c49a'; x.lineWidth = 2;
  const road = [[0,18],[0,3],[0,-8],[0,-20],[0,-33]];
  x.beginPath(); road.forEach((q, i) => i ? x.lineTo(mx(q[0]), my(q[1])) : x.moveTo(mx(q[0]), my(q[1]))); x.stroke();
  x.beginPath(); [[0,3],[17,-10],[30,-6],[46,-2],[62,-2]].forEach((q, i) => i ? x.lineTo(mx(q[0]), my(q[1])) : x.moveTo(mx(q[0]), my(q[1]))); x.stroke();
  x.beginPath(); [[0,14],[1.6,24],[-1,31],[-3,35]].forEach((q, i) => i ? x.lineTo(mx(q[0]), my(q[1])) : x.moveTo(mx(q[0]), my(q[1]))); x.stroke();
  x.fillStyle = '#8a8578'; x.beginPath(); x.arc(mx(0), my(3), 4, 0, 7); x.fill();
  x.strokeStyle = 'rgba(43,37,33,.25)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 175, 175);
}
const mmCtx = els.minimapCv.getContext('2d');
function drawMinimap(T){
  mmCtx.drawImage(mmStatic, 0, 0);
  const mx = (wx) => 88 + (wx - 15) * 1.05, my = (wz) => 88 + (wz + 15) * 1.05;
  const s = store.get();
  if (s.phase !== 'playing') return;
  mmCtx.fillStyle = 'rgba(90,84,74,.75)';
  Object.values(NPCS).forEach(n => { mmCtx.beginPath(); mmCtx.arc(mx(n.x), my(n.z), 1.6, 0, 7); mmCtx.fill(); });
  const pulse = 0.55 + Math.sin(T * 4) * 0.45;
  sys.questTargets().forEach(t => {
    mmCtx.strokeStyle = `rgba(185,95,118,${pulse})`; mmCtx.lineWidth = 2;
    mmCtx.beginPath(); mmCtx.arc(mx(t.x), my(t.z), 5, 0, 7); mmCtx.stroke();
    mmCtx.fillStyle = '#b95f76';
    mmCtx.beginPath(); mmCtx.arc(mx(t.x), my(t.z), 2.4, 0, 7); mmCtx.fill();
  });
  const P = G.player.pos;
  mmCtx.save();
  mmCtx.translate(mx(P.x), my(P.z));
  mmCtx.rotate(Math.atan2(Math.sin(G.playerAnim.facing), -Math.cos(G.playerAnim.facing)));
  mmCtx.fillStyle = '#2b2521';
  mmCtx.beginPath(); mmCtx.moveTo(0, -5.5); mmCtx.lineTo(3.6, 4.2); mmCtx.lineTo(0, 2.2); mmCtx.lineTo(-3.6, 4.2); mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
}

/* ---------------- typewriter + options + chapters ---------------- */
const TW = SV.TW || { n: 0, skip: false, full: '' };
let typeRaf = null;
function startTypewriter(d){
  TW.n = 0; TW.skip = false; TW.full = d.lines[d.i];
  els.dText.textContent = '';
  cancelAnimationFrame(typeRaf);
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (TW.skip) TW.n = TW.full.length;
    else TW.n = Math.min(TW.full.length, TW.n + dt * 55);
    els.dText.textContent = TW.full.slice(0, Math.floor(TW.n));
    els.dCursor.style.display = TW.n < TW.full.length ? 'inline-block' : 'none';
    typeRaf = requestAnimationFrame(tick);
  };
  typeRaf = requestAnimationFrame(tick);
}
function showOptions(d){
  G.uiOpts = true;
  els.dOpts.innerHTML = '';
  d.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = (i + 1) + '. ' + o.label;
    b.addEventListener('click', () => chooseOption(i));
    els.dOpts.appendChild(b);
  });
  els.dOpts.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
function hideOptions(){ els.dOpts.style.display = 'none'; els.dOpts.innerHTML = ''; }
function chooseOption(i){
  const d = store.get().dialogue;
  G.uiOpts = false; hideOptions();
  store.set({ dialogue: null });
  sys.AudioSys.tick();
  if (d && d.options && d.options[i]) d.options[i].fn();
  sys.requestLock();
}
function showChapter(n){
  const c = CHAPTERS[Math.min(n, CHAPTERS.length - 1)];
  els.chapterTitle.textContent = c[0]; els.chapterSub.textContent = c[1];
  els.chapterEl.classList.remove('show');
  void els.chapterEl.offsetWidth;
  els.chapterEl.classList.add('show');
  setTimeout(() => els.chapterEl.classList.remove('show'), 3400);
}

/* ---------------- tracker + journal ---------------- */
function trackerInfo(){
  const s = store.get();
  if (s.stage === 0) return { main: s.blessed ? 'Speak with Hana at the tea house' : 'Gather the Sakura Charms', sub: `Sakura Charms ${s.charms.filter(Boolean).length}/3` };
  if (s.stage === 1) return { main: 'Speak with Genji at the shrine', sub: 'North, past the great gate' };
  if (s.stage === 2){
    const subs = [];
    if (s.quests.kite === 'active') subs.push("Kenta's kite — the red rocks in the bamboo");
    if (s.quests.crows === 'active') subs.push(`Crows ${s.crowGone}/5 gone from the terraces`);
    if (s.quests.fishing === 'active') subs.push(`Fish ${s.fishCaught.length}/4 kinds caught`);
    if (s.quests.fireflies === 'active') subs.push(`Fireflies ${s.firefliesCaught}/7 (night, in the bamboo)`);
    return { main: `Gather the four Spirit Sigils (${sys.sigilCount()}/4)`, sub: subs.join(' · ') || 'Speak with Genji' };
  }
  if (s.stage === 3) return { main: 'Ring the Great Bell at the summit', sub: s.foxMet ? 'The mountain path is open — follow the trail north' : (isNight() ? 'A white fox waits at the great gate (light your lantern — L)' : 'The fox comes to the great gate at night (pause menu can speed up dusk)') };
  return { main: 'Wander the blooming valley', sub: s.raceBest != null ? `Best race time: ${s.raceBest.toFixed(1)}s` : 'Kenta hosts races at the plaza' };
}
function journalEntries(){
  const s = store.get(), J = [];
  const CH = ['The Charms of Spring', 'The Fading Spring', 'The Four Sigils', "The Fox's Path", 'The Blooming'];
  for (let i = 0; i < s.stage; i++) J.push({ state: 'done', title: CH[i], desc: '' });
  J.push({ state: s.stage >= 4 ? 'done' : 'active', title: CH[s.stage], desc: trackerInfo().main });
  if (s.quests.kite !== 'none') J.push({ state: s.quests.kite === 'done' ? 'done' : 'active', title: "Kenta's Kite", desc: s.quests.kite === 'done' ? 'Returned from the red rocks' : 'Climb the red rocks in the bamboo grove' });
  if (s.quests.crows !== 'none') J.push({ state: s.quests.crows === 'done' ? 'done' : 'active', title: "Aki's Crows", desc: `Chase each crow three times — ${s.crowGone}/5 gone` });
  if (s.quests.fishing !== 'none') J.push({ state: s.quests.fishing === 'done' ? 'done' : 'active', title: "Mizuki's River Test", desc: `Catch 4 kinds of fish — ${s.fishCaught.length}/4` + (s.fishCaught.length ? ` (${s.fishCaught.join(', ')})` : '') });
  if (s.quests.fireflies !== 'none') J.push({ state: s.quests.fireflies === 'done' ? 'done' : 'active', title: 'The Dusk Jar', desc: `Catch 7 fireflies at night — ${s.firefliesCaught}/7` });
  if (s.cats.some(Boolean)) J.push({ state: s.catDone ? 'done' : 'active', title: "Yuzu's Naps", desc: `Find Yuzu's three sleeping spots — ${s.cats.filter(Boolean).length}/3` });
  if (s.raceBest != null) J.push({ state: 'done', title: 'Village Race', desc: `Best time: ${s.raceBest.toFixed(1)}s — talk to Kenta to race again` });
  return J;
}

/* ---------------- main UI sync ---------------- */
let lastDlgKey = null, lastBanner = null, bannerTimer = null, controlsOpen = false;
function syncUI(){
  const s = store.get();
  els.hud.style.display = s.phase === 'playing' ? '' : 'none';
  els.startOverlay.style.display = s.phase === 'title' ? '' : 'none';
  els.pauseOverlay.style.display = s.paused ? '' : 'none';
  const tr = trackerInfo();
  els.objText.textContent = tr.main;
  els.objSub.textContent = tr.sub || '';
  els.charmRow.style.display = s.stage === 0 ? 'flex' : 'none';
  els.charmRow.innerHTML = s.charms.map(c => petalIcon(c)).join('') + `<span class="charm-count">${s.charms.filter(Boolean).length}/3</span>`;
  els.sigilRow.style.display = s.stage >= 2 ? 'flex' : 'none';
  if (s.stage >= 2) els.sigilRow.innerHTML = Object.keys(SIGIL_KANJI).map(k => `<span class="sigil${s.sigils[k] ? ' lit' : ''}" title="${SIGIL_NAMES[k]}">${SIGIL_KANJI[k]}</span>`).join('');
  if (s.prompt){ els.promptEl.style.display = ''; els.promptText.textContent = s.prompt.label; }
  else els.promptEl.style.display = 'none';
  els.mouseHint.style.display = (s.phase === 'playing' && !s.paused && !s.dialogue && !s.locked && !s.prompt && !s.fishing && !G.race) ? '' : 'none';
  els.mouseHint.textContent = s.dragMode ? 'drag with the mouse to look around' : 'click to capture the mouse';
  if (s.dialogue){
    els.dialogueEl.style.display = '';
    els.dName.textContent = s.dialogue.speaker;
    const key = s.dialogue.speaker + '#' + s.dialogue.i;
    if (key !== lastDlgKey){ lastDlgKey = key; startTypewriter(s.dialogue); }
  } else {
    els.dialogueEl.style.display = 'none';
    lastDlgKey = null;
    if (typeRaf){ cancelAnimationFrame(typeRaf); typeRaf = null; }
    G.uiOpts = false; hideOptions();
  }
  if (s.banner){
    els.bannerEl.style.display = '';
    if (s.banner !== lastBanner){
      lastBanner = s.banner;
      els.bannerTitle.textContent = s.banner.title;
      els.bannerText.textContent = s.banner.text;
      els.bannerSub.textContent = s.banner.sub || '';
      els.bannerPetals.innerHTML = petalIcon(true, 20).repeat(3);
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => store.set({ banner: null }), 5200);
    }
  } else { els.bannerEl.style.display = 'none'; lastBanner = null; clearTimeout(bannerTimer); }
  if (s.paused){
    const isDay = Math.sin((G.time.t - 0.25) * Math.PI * 2) > 0;
    els.dayNightBtn.textContent = 'Make it ' + (isDay ? 'Night' : 'Day');
    els.journalList.innerHTML = journalEntries().map(j =>
      `<div class="jq ${j.state}"><span class="dot">${j.state === 'done' ? '✓' : '●'}</span><span><b>${j.title}</b>${j.desc ? ' — ' + j.desc : ''}</span></div>`
    ).join('');
    const inv = [`<span class="chip">Charms ${s.charms.filter(Boolean).length}/3</span>`];
    if (s.jar) inv.push('<span class="chip">Dusk Jar</span>');
    Object.keys(SIGIL_KANJI).forEach(k => { if (s.sigils[k]) inv.push(`<span class="chip">${SIGIL_KANJI[k]} ${SIGIL_NAMES[k]}</span>`); });
    if (s.fishCaught.length) inv.push(`<span class="chip">Creel: ${s.fishCaught.join(', ')}</span>`);
    if (s.raceBest != null) inv.push(`<span class="chip">Race best ${s.raceBest.toFixed(1)}s</span>`);
    els.invRow.innerHTML = inv.join('');
  }
  els.muteBtn.innerHTML = soundSvg(s.muted);
}
store.subscribe(() => { syncUI(); sys.applyStoryWorld(); });
if (sys.hasSave()) els.contBtn.style.display = '';

/* ---------------- clock dial ---------------- */
let lastPhaseWord = '';
function updateClock(t){
  els.needle.style.transform = `rotate(${(t - 0.5) * 360}deg)`;
  const isDay = Math.sin((t - 0.25) * Math.PI * 2) > 0;
  els.sunIco.style.display = isDay ? 'flex' : 'none';
  els.moonIco.style.display = isDay ? 'none' : 'flex';
  const w = phaseWord(t);
  if (w !== lastPhaseWord){ els.phaseTxt.textContent = w; lastPhaseWord = w; }
}

SV.ui = { els, syncUI, showOptions, hideOptions, chooseOption, showChapter, drawMinimap, trackerInfo, updateClock };
SV.TW = SV.TW || { n: 0, skip: false, full: '' };
})();