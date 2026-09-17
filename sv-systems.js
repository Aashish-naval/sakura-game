/* ============================================================
   SAKURA VILLAGE · 3/5 — physics, audio, story, quests, systems
   ============================================================ */
(() => {
'use strict';
const THREE = window.THREE;
const {
  store, G, isNight, gridQuery, distSegPt, shortAngle, clamp01,
  NPCS, CHARMS, FOX_SHRINE, KITE, TERR, FISH_SPOT, SUMMIT_BELL, HOTSPRING,
  FOX_WP, FISH_SPECIES, SIGIL_NAMES, RIVER_N, RIVER_S, POND, GREAT_SAKURA,
  scene, camera, sun, hemi, FOG, SKY, STARS, LANTERN_LIGHTS, MAT,
  renderer, sampleSky, setSakuraBloom, shiftPetalColors, zeroInstances,
  petalsData, petalsScr, ambPetals, burstPetals, stormPetals,
  rainData, rainMesh, steamMeshes, rockslideGroup, slideColliders, kiteGroup,
  WORLD_CENTER, WORLD_R, SAVE_KEY, SPAWN,
} = SV;
const { V, playerRig, playerGrp, charmOuters, charmFloats, raceFlags, catSpots, catPet, fox, makeCrow, bobber, splashRing } = SV.ent;

/* ================= physics ================= */
function collideCircle(p, r, h){
  for (let iter = 0; iter < 3; iter++){
    let any = false;
    const list = gridQuery(p.x, p.z, r + 0.1);
    for (const c of list){
      const top = c.y0 + c.h;
      const skip = c.walk ? 0.45 : 0.02;
      if (p.y >= top - skip) continue;
      if (p.y + h <= c.y0 + 0.02) continue;
      if (c.type === 'cyl'){
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), rr = c.r + r;
        if (d < rr){ if (d < 1e-4){ p.x += rr; } else { const push = rr - d; p.x += dx / d * push; p.z += dz / d * push; } any = true; }
      } else if (c.type === 'box'){
        const rot = c.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
        const dx = p.x - c.x, dz = p.z - c.z;
        let lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs;
        const px = c.hw + r - Math.abs(lx), pz = c.hd + r - Math.abs(lz);
        if (px > 0 && pz > 0){
          if (px < pz) lx += (lx > 0 ? px : -px); else lz += (lz > 0 ? pz : -pz);
          p.x = c.x + lx * cs - lz * sn; p.z = c.z + lx * sn + lz * cs;
          any = true;
        }
      } else {
        const dxs = c.bx - c.ax, dzs = c.bz - c.az;
        let t = ((p.x - c.ax) * dxs + (p.z - c.az) * dzs) / (dxs * dxs + dzs * dzs);
        t = Math.max(0, Math.min(1, t));
        let ddx = p.x - (c.ax + dxs * t), ddz = p.z - (c.az + dzs * t);
        const d = Math.hypot(ddx, ddz), rr = c.r + r;
        if (d < rr){
          if (d < 1e-4){ ddx = 1; ddz = 0; } else { ddx /= d; ddz /= d; }
          const push = rr - (d < 1e-4 ? 0 : d);
          p.x += ddx * push; p.z += ddz * push;
          any = true;
        }
      }
    }
    if (!any) break;
  }
}
function groundHeight(x, z, py){
  let g = 0;
  const list = gridQuery(x, z, 0.25);
  for (const c of list){
    if (!c.walk || c.top > py + 0.52) continue;
    if (c.type === 'cyl'){
      if (Math.hypot(x - c.x, z - c.z) <= c.r + 0.12) g = Math.max(g, c.top);
    } else {
      const rot = c.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs;
      if (Math.abs(lx) <= c.hw + 0.12 && Math.abs(lz) <= c.hd + 0.12) g = Math.max(g, c.top);
    }
  }
  return g;
}
function pointBlocked(x, y, z){
  const list = gridQuery(x, z, 0.4);
  for (const c of list){
    if (c.noCam) continue;
    if (y < c.y0 - 0.05 || y > c.y0 + c.h + 0.05) continue;
    if (c.type === 'cyl'){ if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return true; }
    else if (c.type === 'box'){
      const rot = c.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs;
      if (Math.abs(lx) < c.hw + 0.3 && Math.abs(lz) < c.hd + 0.3) return true;
    } else if (distSegPt(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.3) return true;
  }
  return false;
}

/* ================= audio (all synthesized) ================= */
const AudioSys = {
  ctx: null, master: null, riverGain: null, rainGain: null,
  init(){
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const mk = (freq) => {
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.master); src.start();
        return g;
      };
      this.riverGain = mk(900); this.rainGain = mk(1400);
    } catch (e) {}
  },
  pluck(freq, delay = 0, vol = 1, dur = 0.6, type = 'triangle'){
    if (!this.ctx || store.get().muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(this.master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },
  noiseBurst(freq, dur, vol){
    if (!this.ctx || store.get().muted) return;
    const t = this.ctx.currentTime, len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  },
  collect(){ this.pluck(659.25, 0, 1, 0.7); this.pluck(880, 0.09, 0.9, 0.8); this.pluck(1318.5, 0.18, 0.7, 1.0); },
  complete(d = 0){ [440, 554.37, 659.25, 880].forEach((f, i) => this.pluck(f, d + i * 0.13, 0.9, 1.1)); },
  tick(){ this.pluck(740, 0, 0.3, 0.16); },
  chime(){ this.pluck(523.25, 0, 0.55, 0.9); this.pluck(783.99, 0.1, 0.5, 1.2); },
  gong(){ [98, 147, 196, 261].forEach((f, i) => this.pluck(f, i * 0.02, 1.1 - i * 0.18, 3.4, 'sine')); this.noiseBurst(300, 0.4, 0.15); },
  caw(){ this.pluck(640, 0, 0.35, 0.14, 'sawtooth'); this.pluck(520, 0.16, 0.3, 0.14, 'sawtooth'); },
  splash(){ this.noiseBurst(900, 0.28, 0.3); },
  purr(){ this.pluck(70, 0, 0.5, 1.3, 'sine'); this.pluck(74, 0.05, 0.3, 1.2, 'sine'); },
  cricket(){ for (let i = 0; i < 3; i++) this.pluck(4200 + Math.random() * 500, i * 0.07, 0.06, 0.05, 'triangle'); },
  frog(){ this.pluck(160, 0, 0.16, 0.22, 'sawtooth'); this.pluck(150, 0.24, 0.12, 0.2, 'sawtooth'); },
  beep(hi){ this.pluck(hi ? 880 : 440, 0, 0.5, 0.18, 'square'); },
};
const KOTO_SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25];

/* ================= dialogue & story ================= */
SV.TW = SV.TW || { n: 0, skip: false, full: '' };
const TW = SV.TW;
function openDialogue(speaker, lines, opts){ store.set({ dialogue: { speaker, lines, i: 0, options: opts || null }, prompt: null }); }
function advanceDialogue(){
  const d = store.get().dialogue; if (!d) return;
  if (G.uiOpts) return;
  const full = d.lines[d.i];
  if (TW.n < full.length){ TW.skip = true; return; }
  AudioSys.tick();
  if (d.i < d.lines.length - 1) store.set({ dialogue: { ...d, i: d.i + 1 } });
  else if (d.options) SV.ui.showOptions(d);
  else closeDialogue(true);
}
function closeDialogue(natural){
  const d = store.get().dialogue;
  store.set({ dialogue: null });
  G.uiOpts = false;
  SV.ui.hideOptions();
  if (natural && d && d.onEnd) d.onEnd();
}
function remainingSigils(){
  const s = store.get().sigils, out = [];
  if (!s.grove) out.push("Kenta's kite is still in the bamboo");
  if (!s.field) out.push("Aki's crows are still shameless");
  if (!s.river) out.push("the river keeps its secret");
  if (!s.dusk) out.push("the dusk jar sits empty");
  return out.join('. ') + (out.length ? '.' : '');
}
const sigilCount = () => Object.values(store.get().sigils).filter(Boolean).length;
function getDialogue(id){
  const s = store.get();
  const kentaOptions = [{ label: "Let's race!", fn: () => startRace() }, { label: 'Maybe later', fn: () => {} }];
  if (id === 'hana'){
    if (s.stage === 0 && !s.blessed) return { sp: 'Hana', lines: [
      "Oh — a visitor! Welcome to Sakura Village. The petals came early this year.",
      "Truth is, three little Sakura Charms have wandered off and hidden themselves around the valley. Playful things, charms.",
      "One rests by the water. One hides in the bamboo grove, across the east bridge. One sits with the old rocks, north of the pond.",
      "Gather all three, and the old shrine will grant you its blessing. Off you go — I'll be right here!",
    ]};
    if (s.stage === 0 && s.blessed) return { sp: 'Hana', lines: [
      "So the shrine gave you its blessing. Look — the petals follow you now.",
      "…But hold one. Feel how thin it is? The edges are browning, and they fall earlier every day.",
      "The Great Sakura on the mountain is fading, traveller. And when it sleeps… spring leaves the valley.",
      "Please — speak with Genji at the old shrine, up the north path. He keeps the stories the village forgot.",
    ], onEnd: () => setStage(1) };
    if (s.stage === 1) return { sp: 'Hana', lines: [
      "Genji waits at the shrine — north, past the great gate. He sweeps the steps when he thinks no one is watching.",
      "He can be gruff as a winter pine, but his heart is a hearth.",
    ]};
    if (s.stage === 2){
      if (s.sigils.grove && s.sigils.field && s.sigils.river && s.sigils.dusk) return { sp: 'Hana', lines: [
        "Four sigils! You've been busy as spring bees. Quickly — take them to Genji.",
        "He'll know what to weave.",
      ]};
      return { sp: 'Hana', lines: ["The valley still needs its sigils, traveller.", remainingSigils(), "Take your time. The kettle and I will be here."] };
    }
    if (s.stage === 3) return { sp: 'Hana', lines: [
      "A white fox at the great gate…? Then it's true.",
      "Light your lantern — the L key, traveller — and walk north when night falls. Some paths are walked in the dark.",
    ]};
    return { sp: 'Hana', lines: [
      "The Great Sakura blooms again, and it's all around you — in the air, in the tea, in old Genji's smile.",
      "Stay as long as you like. The kettle is always warm in Sakura Village.",
    ]};
  }
  if (id === 'genji'){
    if (s.stage === 0) return { sp: 'Genji', lines: [
      "The shrine is quiet these days. Make your offering first — three charms, scattered by the wind.",
      "Then we'll talk of heavier things.",
    ]};
    if (s.stage === 1) return { sp: 'Genji', lines: [
      "Hm. So Hana sent you. She's right — the petals are dying early. Been dying early for three springs now.",
      "Long ago, a fox spirit kept watch over the Great Sakura on the mountain. Its bell was rung every dawn, the tree bloomed, and the valley ate well.",
      "Then the rope rotted, the bell went silent… and the fox stopped coming down. The tree has been fading since.",
      "A bell rope is not mere rope. It must be woven of four sigils — tokens of the valley's own spirit. Kenta, Aki, Mizuki… and the dusk itself.",
      "Help them, traveller. Bring me four sigils, and I'll weave us a rope worth ringing.",
    ], onEnd: () => setStage(2) };
    if (s.stage === 2){
      if (s.sigils.grove && s.sigils.field && s.sigils.river && s.sigils.dusk) return { sp: 'Genji', lines: [
        "Four sigils… you actually did it. Grove, field, river, and dusk — woven and bound.",
        "There. The rope is ready. And the rockslide that closed the mountain path — I'll have those stones shifted before you take your first step.",
        "One more thing: the fox comes to the great gate only at night. Light your lantern, walk north, and follow it to the summit.",
        "Ring the bell at dawn or at dusk — the tree isn't choosy. Go on. The valley is watching.",
      ], onEnd: () => setStage(3) };
      if (!s.jar) return { sp: 'Genji', lines: [
        "Before you ask — the fourth sigil cannot be given, only gathered. It belongs to the fox's own fireflies.",
        "Take this jar. Seven of them drift through the bamboo grove at night, little embers of the fox's lantern-light.",
        "Catch all seven, and the dusk is yours. They sleep when the sun is up.",
      ], onEnd: () => { store.set({ jar: true, quests: { ...store.get().quests, fireflies: 'active' } }); saveGame(); } };
      const ff = s.firefliesCaught;
      return { sp: 'Genji', lines: [
        ff >= 7 ? "The jar glows warm. Good. The dusk sigil is yours — I felt it from here." : `Still waiting on the sigils — and on ${7 - ff} more firefly${7 - ff === 1 ? '' : 'ies'}. Night, bamboo, patience.`,
        remainingSigils(),
      ]};
    }
    if (s.stage === 3) return { sp: 'Genji', lines: [
      "The fox waits at the great gate when night falls. Follow it. And mind the steps — they're older than me.",
      "Light that lantern of yours. Mountains are honest, but they are not bright.",
    ]};
    return { sp: 'Genji', lines: [
      "Well rung, traveller. Well rung. The mountain will remember your name for a while.",
      "…First visitor in years to ring that bell. The second was me, forty springs ago.",
    ]};
  }
  if (id === 'kenta'){
    if (s.stage < 2) return { sp: 'Kenta', lines: [
      "Have you seen my kite? It's red, with a long tail! The wind took it east, over the river, toward the bamboo!",
      "I'm not allowed past the bridge alone…",
    ]};
    if (s.quests.kite === 'none') return { sp: 'Kenta', lines: [
      "You're going to the bamboo grove?! REALLY? My kite's caught way up in the tall stalks!",
      "There's red climbing rocks right under it — Genji put them there for drying herbs, weird huh. You can hop up them!",
      "Ma says I can't go. But you're tall and you can jump! Please please please!",
    ], onEnd: () => { store.set({ quests: { ...store.get().quests, kite: 'active' } }); saveGame(); } };
    if (s.quests.kite === 'active') return { sp: 'Kenta', lines: [
      "The red rocks! Over the east bridge, keep the stream on your left, then look for the red rocks!",
      "You have to JUMP between them. Like a ninja. A polite ninja.",
    ]};
    return { sp: 'Kenta', lines: [
      "MY KITE! You got it! You're the best!",
      "Wanna see something? I set up a race course around the whole village! Eight red flags!",
      "Genji times me but I always win because he refuses to run.",
    ], options: kentaOptions };
  }
  if (id === 'aki'){
    if (s.stage < 2) return { sp: 'Aki', lines: [
      "The terraces drink too much and sleep too little. That's farming for you.",
      "Come back when Genji's set you to work.",
    ]};
    if (s.quests.crows === 'none') return { sp: 'Aki', lines: [
      "Crows. Five of the fat devils, eating my seed rice like it's a festival.",
      "You can't catch a crow — but you can out-stubborn one. Charge at them! Each one takes three good chases before it gives up on a field.",
      "Clear all five off my terraces and the Field Sigil is yours. It's been in my family longer than the farm has.",
    ], onEnd: () => { store.set({ quests: { ...store.get().quests, crows: 'active' } }); saveGame(); } };
    if (s.quests.crows === 'active') return { sp: 'Aki', lines: [
      `${s.crowGone} of 5 crows gone. Three chases each — they're stubborn, but you're taller.`,
      "Mind the water edges. The rice doesn't care about your shoes.",
    ]};
    return { sp: 'Aki', lines: [
      "Not a single crow left! You've the makings of a farmer.",
      "Next spring, you eat for free at my table. That's a legally binding farmer promise.",
    ]};
  }
  if (id === 'mizuki'){
    if (s.stage < 2) return { sp: 'Mizuki', lines: [
      "The river was quieter last week. Fish feel everything first.",
      "Come back when Genji's set you to work.",
    ]};
    if (s.quests.fishing === 'none') return { sp: 'Mizuki', lines: [
      "So you're the one chasing sigils. The river's token doesn't come by asking — it comes by fishing.",
      "Cast from my dock, west of the pond. The water holds five kinds: tanago, sweetfish, red carp… a catfish that only stirs at night… and the Moon Koi, rare as an honest politician.",
      "Show me four different fish and the River Sigil is yours. Watch the float — strike (E) when the marker crosses the green.",
    ], onEnd: () => { store.set({ quests: { ...store.get().quests, fishing: 'active' } }); saveGame(); } };
    if (s.quests.fishing === 'active') return { sp: 'Mizuki', lines: [
      `${s.fishCaught.length} of 4 kinds in your creel. ${s.fishCaught.join(', ') || 'Nothing yet — the dock is patient.'}`,
      "The Moon Koi only bites after dark, by the way. Just saying.",
    ]};
    return { sp: 'Mizuki', lines: [
      "Four different fish! And you fish like the river owes you money.",
      "The dock is yours whenever the water calls. It calls to me at dinner, usually.",
    ]};
  }
  if (id === 'fox') return { sp: 'The White Fox', lines: [
    "The white fox regards you with old, patient eyes.",
    "It rises, flicks its tail once, and turns toward the mountain…",
  ], onEnd: () => { store.set({ foxMet: true }); saveGame(); } };
  return null;
}
function doInteract(id){
  const s = store.get();
  const d = getDialogue(id);
  if (d){
    openDialogue(d.sp, d.lines, d.options);
    if (d.onEnd){ const oe = d.onEnd; store.set({ dialogue: { ...store.get().dialogue, onEnd: oe } }); }
    return;
  }
  if (id === 'shrine'){
    const done = s.charms.every(Boolean);
    if (done && !s.blessed && s.stage === 0){
      store.set({ blessed: true });
      G.fx.burst = { pos: new THREE.Vector3(0, 1.7, -18.2), age: 0 };
      AudioSys.complete(0.05);
      openDialogue('The Old Shrine', [
        "You offer the three Sakura Charms to the shrine…",
        "A warm wind rises. Petals swirl around you in a slow, bright spiral.",
        "『Well met, kind traveller. The village will remember this spring.』",
        "The shrine's blessing is yours. …Perhaps now Hana would like a word.",
      ]);
    } else if (s.stage >= 4) openDialogue('The Old Shrine', ["The little shrine hums contentedly, warm with the Great Sakura's light."]);
    else openDialogue('The Old Shrine', ["The old shrine stands quiet beneath the mountain.", "Something about the air feels unfinished — as if the valley is holding half a breath."]);
  } else if (id === 'belltower') openDialogue('The Old Bell', [
    "The village bell — silent for many years. The rope hangs frayed and thin.",
    "Something is written below: 'Her elder sister watches from the mountain.'",
  ]);
  else if (id === 'foxshrine') openDialogue('Fox Shrine', [
    "A small shrine to the fox spirit, tucked among the bamboo.",
    "Old offerings rest here: a saucer of sweet sake, a strip of fried tofu, a child's drawing.",
  ]);
  else if (id === 'hotspring') openDialogue('Mountain Hot Spring', [
    "You warm your hands. Steam curls around your fingers, carrying the smell of stone and winter.",
    "For a moment, the whole valley feels like one long exhale.",
  ]);
  else if (id === 'bell') runFinale();
  else if (id.startsWith('charm')){
    const i = +id.slice(5), charms = [...s.charms]; charms[i] = true;
    const c = CHARMS[i];
    G.fx.burst = { pos: new THREE.Vector3(c.x, 1.1, c.z), age: 0 };
    AudioSys.collect();
    if (charms.every(Boolean)){ store.set({ charms, banner: { title: 'Charms Complete', text: 'You gathered all three Sakura Charms.', sub: 'Offer them at the old shrine.' } }); AudioSys.complete(0.45); }
    else store.set({ charms });
    saveGame();
  } else if (id.startsWith('ffly')){
    const i = +id.slice(4);
    G.fireflies[i].caught = true;
    const n = s.firefliesCaught + 1;
    AudioSys.collect();
    G.fx.burst = { pos: new THREE.Vector3(G.fireflies[i].x, 1.2, G.fireflies[i].z), age: 0 };
    if (n >= 7){ awardSigil('dusk'); store.set({ firefliesCaught: n, quests: { ...store.get().quests, fireflies: 'done' } }); }
    else store.set({ firefliesCaught: n });
    saveGame();
  } else if (id === 'kitegrab'){
    store.set({ quests: { ...store.get().quests, kite: 'done' } });
    G.fx.burst = { pos: new THREE.Vector3(KITE.x, 2.8, KITE.z), age: 0 };
    AudioSys.chime();
    awardSigil('grove');
  } else if (id === 'cast') startFishing();
  else if (id.startsWith('cat')){
    const i = +id.slice(3), cats = [...s.cats]; cats[i] = true;
    AudioSys.purr();
    const all = cats.every(Boolean);
    store.set({ cats, catDone: all });
    openDialogue('Yuzu', all ? [
      "*prrrrr* Yuzu stretches, yawns, and decides you are acceptable.",
      "She will follow you now. Cats do not ask permission — from anyone.",
    ] : [
      `Yuzu sleeps here, nose tucked under one paw. She permits exactly one pat. (${cats.filter(Boolean).length}/3 found)`,
      "*prrrrr*",
    ]);
    saveGame();
  }
}
function awardSigil(kind){
  store.set({ sigils: { ...store.get().sigils, [kind]: true }, banner: { title: 'Sigil Received', text: `The ${SIGIL_NAMES[kind]} hums softly in your hand.`, sub: sigilCount() + '/4 sigils gathered' } });
  AudioSys.complete(0.2);
  saveGame();
}
function setStage(n){
  store.set({ stage: n });
  SV.ui.showChapter(n);
  if (n === 3){
    rockslideGroup.visible = false;
    slideColliders.forEach(c => (c.off = true));
    AudioSys.noiseBurst(200, 1.2, 0.4);
    if (store.get().banner) store.set({ banner: null });
  }
  saveGame();
}
function runFinale(){
  AudioSys.gong();
  const flash = SV.ui.els.flash;
  flash.style.opacity = '0.9';
  setTimeout(() => (flash.style.opacity = '0'), 900);
  G.fx.stormT = 60;
  setSakuraBloom(true);
  shiftPetalColors();
  G.fox.mode = 'pet';
  G.fox.pos.set(G.player.pos.x + 1.2, G.player.pos.y, G.player.pos.z + 1);
  setStage(4);
  store.set({ banner: null });
  setTimeout(() => openDialogue('The Great Sakura', [
    "The Great Bell rings — once — then silence…",
    "Then the mountain answers. Pink light pours through the branches like sunrise caught in silk.",
    "『You carried the valley up my mountain, small traveller. Spring will stay a while longer.』",
    "The Fading Spring has ended. The valley is yours to wander — and the fox walks with you now.",
  ]), 1400);
}

/* ================= race ================= */
function startRace(){
  if (store.get().racing) return;
  store.set({ racing: true });
  G.race = { phase: 'count', t: -3.6, cp: 0, lastBeep: 99 };
  raceFlags.forEach(f => (f.grp.visible = true));
  AudioSys.chime();
}
function endRace(finished){
  const s = G.race; G.race = null;
  raceFlags.forEach(f => { f.grp.visible = false; f.ring.visible = false; });
  store.set({ racing: false });
  if (finished){
    const time = s.t, best = store.get().raceBest;
    const isBest = !best || time < best;
    if (isBest) store.set({ raceBest: Math.round(time * 10) / 10 });
    store.set({ banner: { title: isBest ? 'New Best Time!' : 'Race Complete', text: `${time.toFixed(1)} seconds` + (isBest ? '' : ` — best: ${Math.min(best, time).toFixed(1)}s`), sub: 'Talk to Kenta to race again' } });
    AudioSys.complete(0.1);
    saveGame();
  }
}
function updateRace(dt){
  const R = G.race; if (!R) return;
  if (R.phase === 'count'){
    R.t += dt;
    const n = Math.ceil(-R.t);
    if (n !== R.lastBeep && n >= 0){ R.lastBeep = n; AudioSys.beep(n === 0); }
    if (R.t >= 0){ R.phase = 'run'; R.t = 0; }
    return;
  }
  R.t += dt;
  const cp = SV.RACE_CPS[R.cp];
  if (Math.hypot(G.player.pos.x - cp[0], G.player.pos.z - cp[1]) < 3.2){
    R.cp++;
    AudioSys.tick();
    if (R.cp >= SV.RACE_CPS.length) endRace(true);
  }
}

/* ================= fishing ================= */
function pickFish(){
  const night = isNight();
  const pool = FISH_SPECIES.map(f => ({ f, w: night ? f.night : f.day }));
  const tot = pool.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * tot;
  for (const p of pool){ r -= p.w; if (r <= 0) return p.f; }
  return pool[0].f;
}
function startFishing(){
  store.set({ fishing: true, prompt: null });
  G.fish = { phase: 'wait', t: 0, dur: 0.7 + Math.random() * 0.9, species: null, zoneC: 0.5, zoneW: 0.25, speed: 3, mt: 0 };
  bobber.visible = true;
  SV.ui.els.fishUI.style.display = '';
  AudioSys.pluck(300, 0, 0.2, 0.2);
}
function endFishing(){
  G.fish = null;
  bobber.visible = false;
  SV.ui.els.fishUI.style.display = 'none';
  store.set({ fishing: false });
}
function resolveFishStrike(){
  const F = G.fish; if (!F || F.phase !== 'strike') return;
  const pos = 0.5 + 0.5 * Math.sin(F.mt * F.speed);
  if (Math.abs(pos - F.zoneC) < F.zoneW / 2){
    AudioSys.splash();
    splashRing.visible = true; splashRing.position.set(11.5, 0.08, 8.4); splashT = 0;
    const s = store.get();
    const isNew = !s.fishCaught.includes(F.species.n);
    let fishCaught = s.fishCaught;
    if (isNew) fishCaught = [...s.fishCaught, F.species.n];
    const distinct = fishCaught.length;
    if (s.quests.fishing === 'active' && distinct >= 4){
      store.set({ fishCaught, quests: { ...store.get().quests, fishing: 'done' } });
      awardSigil('river');
    } else {
      store.set({ fishCaught, banner: isNew
        ? { title: `Caught a ${F.species.n}!`, text: `A new species for your creel. (${distinct}/4 kinds)`, sub: '' }
        : { title: `Caught a ${F.species.n}!`, text: 'Already in your creel — the river is generous today.', sub: '' } });
    }
    saveGame();
  } else {
    store.set({ banner: { title: 'It got away…', text: 'The river keeps its secrets a little longer.', sub: '' } });
    AudioSys.pluck(180, 0, 0.25, 0.3);
  }
  endFishing();
}
let splashT = 0;
function updateFishing(dt, T){
  const F = G.fish; if (!F) return;
  bobber.position.y = 0.1 + Math.sin(T * 2.5) * 0.03;
  const E = SV.ui.els;
  if (F.phase === 'wait'){
    F.t += dt;
    E.fishLabel.textContent = 'Wait for it…';
    if (F.t >= F.dur){
      F.phase = 'strike'; F.mt = 0;
      F.species = pickFish();
      F.zoneC = 0.25 + Math.random() * 0.5;
      F.zoneW = F.species.w; F.speed = F.species.s;
      AudioSys.pluck(500, 0, 0.25, 0.12);
    }
  } else {
    F.mt += dt;
    const pos = 0.5 + 0.5 * Math.sin(F.mt * F.speed);
    E.fishZone.style.left = ((F.zoneC - F.zoneW / 2) * 280) + 'px';
    E.fishZone.style.width = (F.zoneW * 280) + 'px';
    E.fishMark.style.left = (pos * 280 - 2) + 'px';
    E.fishLabel.textContent = 'STRIKE! ( E )';
    if (F.mt > 4.5){ store.set({ banner: { title: 'It got away…', text: 'Too slow — the river keeps its secrets.', sub: '' } }); endFishing(); }
  }
}

/* ================= interactions ================= */
function currentInteractables(s){
  const P = G.player.pos, list = [];
  const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
  Object.keys(NPCS).forEach(id => { const n = NPCS[id]; if (near(n.x, n.z, 2.7)) list.push({ id, label: 'Talk to ' + n.name, x: n.x, z: n.z }); });
  if (s.stage === 0) CHARMS.forEach((c, i) => { if (!s.charms[i] && near(c.x, c.z, 1.9)) list.push({ id: 'charm' + i, label: 'Take the Sakura Charm', x: c.x, z: c.z }); });
  if (near(0, -17.4, 2.9)) list.push({ id: 'shrine', label: s.charms.every(Boolean) && !s.blessed ? 'Offer the Sakura Charms' : 'Pray at the shrine', x: 0, z: -17.4 });
  if (near(-8, -2.5, 2.6)) list.push({ id: 'belltower', label: 'Read the old bell', x: -8, z: -2.5 });
  if (near(FOX_SHRINE.x, FOX_SHRINE.z + 1.2, 2.8)) list.push({ id: 'foxshrine', label: 'Inspect the fox shrine', x: FOX_SHRINE.x, z: FOX_SHRINE.z + 1.2 });
  if (near(HOTSPRING.x, HOTSPRING.z, 2.6) && P.y > 5) list.push({ id: 'hotspring', label: 'Warm your hands', x: HOTSPRING.x, z: HOTSPRING.z });
  if (s.quests.kite === 'active' && near(KITE.x + 0.6, KITE.z, 1.9) && P.y > 1.6) list.push({ id: 'kitegrab', label: "Grab Kenta's kite", x: KITE.x, z: KITE.z });
  if (s.quests.fireflies === 'active' && isNight()) G.fireflies.forEach((f, i) => { if (!f.caught && near(f.x, f.z, 1.7)) list.push({ id: 'ffly' + i, label: 'Catch the firefly', x: f.x, z: f.z }); });
  if ((s.quests.fishing === 'active' || s.fishCaught.length > 0) && near(FISH_SPOT.x, FISH_SPOT.z, 2.2)) list.push({ id: 'cast', label: 'Cast your line', x: FISH_SPOT.x, z: FISH_SPOT.z });
  if (s.stage === 3 && !s.foxMet && G.fox.mode === 'gate' && near(0, -10.5, 2.6)) list.push({ id: 'fox', label: 'Greet the white fox', x: 0, z: -10.5 });
  if (s.stage >= 3 && s.stage < 4 && near(SUMMIT_BELL.x, SUMMIT_BELL.z, 3.0) && P.y > 13) list.push({ id: 'bell', label: 'Ring the Great Bell', x: SUMMIT_BELL.x, z: SUMMIT_BELL.z });
  SV.CAT_SPOTS.forEach((c, i) => { if (!s.cats[i] && near(c.x, c.z, 1.7)) list.push({ id: 'cat' + i, label: 'Pet Yuzu', x: c.x, z: c.z }); });
  return list;
}
function updateInteraction(){
  const s = store.get();
  let next = null;
  if (s.phase === 'playing' && !s.paused && !s.dialogue && !s.fishing && !G.race){
    // FIX: pick the NEAREST interactable in range (v2 grabbed the first)
    let best = 1e9;
    for (const it of currentInteractables(s)){
      const d = Math.hypot(G.player.pos.x - it.x, G.player.pos.z - it.z);
      if (d < best){ best = d; next = it; }
    }
  }
  const cur = s.prompt;
  const changed = (next && (!cur || cur.id !== next.id || cur.label !== next.label)) || (!next && cur);
  if (changed) store.set({ prompt: next ? { id: next.id, label: next.label } : null });
}

/* ================= game flow ================= */
function requestLock(){
  const c = renderer.domElement;
  try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  setTimeout(() => {
    if (!document.pointerLockElement && store.get().phase === 'playing' && !store.get().paused) store.set({ dragMode: true });
  }, 500);
}
function startGame(){
  store.set({ phase: 'playing' });
  AudioSys.init(); AudioSys.chime(); requestLock();
  SV.ui.showChapter(0);
}
function togglePause(){
  const s = store.get(); if (s.phase !== 'playing') return;
  if (s.paused){ store.set({ paused: false }); requestLock(); }
  else { store.set({ paused: true }); if (document.pointerLockElement) document.exitPointerLock(); }
}
function restartGame(){
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  const P = G.player;
  P.pos.set(SPAWN.x, 0, SPAWN.z); P.vel.set(0, 0, 0); P.grounded = true;
  G.cam.yaw = 0; G.cam.pitch = 0.34; G.cam.distTarget = 6;
  G.fx.burst = null; G.fx.stormT = 0; G.keys.clear();
  G.time.t = 0.34; G.time.tween = null; G.lanternOn = false;
  SV.ent.lanternProp.visible = false; SV.ent.lanternLight.intensity = 0;
  G.fireflies.forEach(f => (f.caught = false));
  clearCrows(); endRace(false); if (G.fish) endFishing();
  G.fox.mode = 'hidden'; G.fox.wp = 0; G.fox.pos.set(0, 0, -10.5);
  setSakuraBloom(false);
  rockslideGroup.visible = true; slideColliders.forEach(c => (c.off = false));
  store.set({
    phase: 'playing', paused: false, dialogue: null, prompt: null, banner: null,
    stage: 0, blessed: false, sigils: { grove: false, field: false, river: false, dusk: false },
    quests: { kite: 'none', crows: 'none', fishing: 'none', fireflies: 'none' },
    firefliesCaught: 0, crowGone: 0, fishCaught: [], jar: false,
    cats: [false, false, false], catDone: false, foxMet: false, raceBest: null,
    charms: [false, false, false], racing: false, fishing: false,
  });
  requestLock(); SV.ui.showChapter(0);
}
function toggleDayNight(){
  const elev = Math.sin((G.time.t - 0.25) * Math.PI * 2);
  G.time.tween = elev > 0 ? 0.95 : 0.42;
  AudioSys.chime();
}
const applyLook = (dx, dy) => {
  G.cam.yaw -= dx * 0.0024;
  G.cam.pitch = THREE.MathUtils.clamp(G.cam.pitch + dy * 0.0021, -0.25, 1.25);
};
function saveGame(){
  const s = store.get();
  if (s.phase !== 'playing') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2, stage: s.stage, blessed: s.blessed, sigils: s.sigils, quests: s.quests,
      firefliesCaught: s.firefliesCaught, crowGone: s.crowGone, fishCaught: s.fishCaught,
      jar: s.jar, cats: s.cats, catDone: s.catDone, foxMet: s.foxMet, raceBest: s.raceBest,
      charms: s.charms, muted: s.muted,
      pos: [G.player.pos.x, G.player.pos.z, G.player.pos.y],   // FIX: height saved too
      t: G.time.t,
    }));
  } catch (e) {}
}
function hasSave(){ try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function continueGame(){
  let sv; try { sv = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return; }
  if (!sv) return;
  G.fireflies.forEach((f, i) => (f.caught = i < (sv.firefliesCaught || 0)));
  store.set({
    phase: 'playing', stage: sv.stage || 0, blessed: !!sv.blessed, sigils: sv.sigils || {},
    quests: sv.quests || {}, firefliesCaught: sv.firefliesCaught || 0, crowGone: sv.crowGone || 0,
    fishCaught: sv.fishCaught || [], jar: !!sv.jar, cats: sv.cats || [false, false, false],
    catDone: !!sv.catDone, foxMet: !!sv.foxMet, raceBest: sv.raceBest ?? null,
    charms: sv.charms || [false, false, false], muted: !!sv.muted,
  });
  const px = sv.pos?.[0] ?? SPAWN.x, pz = sv.pos?.[1] ?? SPAWN.z;
  let py = sv.pos?.[2] ?? 3;
  py = groundHeight(px, pz, Math.max(py, 3));   // FIX: snap to the correct platform (mountain saves respawn correctly)
  G.player.pos.set(px, py, pz);
  G.player.vel.set(0, 0, 0);
  G.time.t = sv.t ?? 0.34;
  if (store.get().foxMet && store.get().stage === 3){
    let best = 0, bd = 1e9;   // FIX: fox rejoins at the waypoint nearest the player
    FOX_WP.forEach((w, i) => { const d = Math.hypot(px - w[0], pz - w[1]); if (d < bd){ bd = d; best = i; } });
    G.fox.mode = 'lead'; G.fox.wp = Math.max(1, best);
    G.fox.pos.set(FOX_WP[best][0], FOX_WP[best][2], FOX_WP[best][1]);
  }
  AudioSys.init(); AudioSys.chime();
  requestLock();
  SV.ui.showChapter(store.get().stage);
}
function applyStoryWorld(){
  const s = store.get();
  charmOuters.forEach((o, i) => (o.visible = !s.charms[i]));
  kiteGroup.visible = s.quests.kite !== 'done';
  if (s.quests.crows === 'active' && !G.crowSpawned && s.stage >= 2) spawnCrows();
  if (s.quests.crows !== 'active' && G.crowSpawned) clearCrows();
  rockslideGroup.visible = s.stage < 3;
  slideColliders.forEach(c => (c.off = s.stage >= 3));
  setSakuraBloom(s.stage >= 4);
  catSpots.forEach((c, i) => (c.group.visible = !s.cats[i]));
  raceFlags.forEach(f => (f.grp.visible = !!G.race));
}

/* ================= crows ================= */
function spawnCrows(){
  G.crows.forEach(c => scene.remove(c.grp.group));
  G.crows = [];
  for (let i = 0; i < 5; i++){
    const t = TERR[1 + (i % 3)];
    const grp = makeCrow();
    const x = -8 + Math.random() * 16, z = t.z0 + 1.5 + Math.random() * (t.z1 - t.z0 - 3);
    grp.group.position.set(x, t.top, z);
    scene.add(grp.group);
    G.crows.push({ grp, x, z, y: t.top, state: 'idle', panics: 0, t: 0, tx: x, tz: z, ty: t.top, hopT: Math.random() * 2 });
  }
  G.crowSpawned = true;
}
function clearCrows(){ G.crows.forEach(c => scene.remove(c.grp.group)); G.crows = []; G.crowSpawned = false; }
function updateCrows(dt, T){
  const s = store.get();
  if (s.quests.crows !== 'active'){ if (G.crowSpawned) clearCrows(); return; }
  const P = G.player.pos;
  for (const c of G.crows){
    if (c.state === 'gone'){
      c.t += dt;
      c.grp.group.position.y += dt * 4;
      c.grp.group.position.z -= dt * 5;
      if (c.t > 2.2) c.grp.group.visible = false;
      continue;
    }
    if (c.state === 'idle'){
      c.hopT -= dt;
      const d = Math.hypot(P.x - c.grp.group.position.x, P.z - c.grp.group.position.z);
      if (d < 2.3 && Math.abs(P.y - c.grp.group.position.y) < 1.4){
        AudioSys.caw();
        c.panics++;
        const n = store.get().crowGone + 1;
        if (c.panics >= 3){
          c.state = 'gone'; c.t = 0;
          if (n >= 5){ store.set({ crowGone: n, quests: { ...store.get().quests, crows: 'done' } }); awardSigil('field'); }
          else store.set({ crowGone: n });
          continue;
        }
        const t = TERR[1 + ((Math.random() * 3) | 0)];
        c.tx = -9 + Math.random() * 18; c.tz = t.z0 + 1.5 + Math.random() * (t.z1 - t.z0 - 3); c.ty = t.top;
        c.state = 'flee'; c.t = 0;
        c.sx = c.grp.group.position.x; c.sz = c.grp.group.position.z; c.sy = c.grp.group.position.y;
        c.flight = 1.6;
      } else if (c.hopT <= 0){
        c.hopT = 1.2 + Math.random() * 2.2;
        const t = TERR[1 + ((Math.random() * 3) | 0)];
        c.tx = -9 + Math.random() * 18; c.tz = t.z0 + 1.5 + Math.random() * (t.z1 - t.z0 - 3); c.ty = t.top;
        c.state = 'flee'; c.t = 0;
        c.sx = c.grp.group.position.x; c.sz = c.grp.group.position.z; c.sy = c.grp.group.position.y;
        c.flight = 1.0;
      } else {
        c.grp.group.rotation.x = Math.sin(T * 6 + c.hopT * 3) * 0.12;
        c.grp.wl.rotation.z = 0.1; c.grp.wr.rotation.z = -0.1;
      }
    }
    if (c.state === 'flee'){
      c.t += dt / c.flight;
      const t = Math.min(1, c.t);
      c.grp.group.position.set(c.sx + (c.tx - c.sx) * t, c.sy + (c.ty - c.sy) * t + Math.sin(Math.PI * t) * 1.4, c.sz + (c.tz - c.sz) * t);
      c.grp.group.rotation.y = Math.atan2(c.tx - c.sx, c.tz - c.sz);
      c.grp.group.rotation.x = -0.25;
      const flap = Math.sin(T * 26) * 1.1;
      c.grp.wl.rotation.z = flap; c.grp.wr.rotation.z = -flap;
      if (c.t >= 1){ c.state = 'idle'; c.grp.group.rotation.x = 0; }
    }
  }
}

/* ================= per-frame updates ================= */
function updateDayNight(dt){
  if (!store.get().paused){
    const T = G.time;
    if (T.tween != null){
      const d = T.tween - T.t;
      const step = Math.sign(d) * dt * 0.28;
      if (Math.abs(d) <= Math.abs(step)){ T.t = T.tween; T.tween = null; } else T.t += step;
    } else T.t = (T.t + dt / 240) % 1;
    if (!G.rain.on && T.t > 0.27 && T.t < 0.29 && Math.random() < 0.004){ G.rain.on = true; G.rain.until = performance.now() + (45 + Math.random() * 30) * 1000; }
  }
  if (G.rain.on && performance.now() > G.rain.until) G.rain.on = false;
  const raining = G.rain.on;
  rainMesh.visible = raining;
  const g = sampleSky(G.time.t);
  const t = G.time.t, ang = (t - 0.25) * Math.PI * 2, elev = Math.sin(ang);
  const dayF = THREE.MathUtils.smoothstep(elev, -0.08, 0.16), nightF = 1 - dayF;
  const k = THREE.MathUtils.smoothstep(elev, -0.14, 0.06);
  if (k > 0.5) sun.position.set(15 + Math.cos(ang) * 90, Math.max(elev, 0.03) * 90, 26);
  else sun.position.set(15 - Math.cos(ang) * 90, Math.max(-elev, 0.06) * 90, -34);
  const rainDim = raining ? 0.65 : 1;
  const moonI = 0.28 * Math.min(1, Math.max(0, -elev * 4));
  sun.intensity = THREE.MathUtils.lerp(moonI, g.sunI, k) * rainDim;
  sun.color.set(0x93a9d8).lerp(g.sun, k);
  hemi.color.copy(g.hemiS); hemi.groundColor.copy(g.hemiG); hemi.intensity = g.hemiI * (raining ? 0.8 : 1);
  SKY.mat.uniforms.uTop.value.copy(g.top);
  SKY.mat.uniforms.uBot.value.copy(g.bot);
  SKY.mat.uniforms.uSunCol.value.copy(g.sun);
  SKY.mat.uniforms.uGlow.value = g.glow * (raining ? 0.25 : 1);
  SKY.mat.uniforms.uSunDir.value.set(Math.cos(ang), Math.sin(ang), 0.38).normalize();
  FOG.color.copy(g.fog);
  FOG.far = raining ? 150 : 240;
  STARS.material.opacity = clamp01((-elev + 0.02) / 0.22) * 0.9 * (raining ? 0.15 : 1);
  STARS.rotation.y += dt * 0.004;
  LANTERN_LIGHTS.forEach(l => (l.intensity = 1.2 + nightF * 9));
  MAT.windowGlow.emissiveIntensity = 0.15 + nightF * 1.7;
  MAT.lanternGlow.emissiveIntensity = 0.25 + nightF * 2.4;
  MAT.charmPetal.emissiveIntensity = 0.4 + nightF * 1.0;
  MAT.charmCore.emissiveIntensity = 0.5 + nightF * 1.2;
  if (AudioSys.ctx && !store.get().muted){
    if (AudioSys.rainGain) AudioSys.rainGain.gain.value = raining ? 0.06 : 0;
    if (AudioSys.riverGain){
      const P = G.player.pos; let d = 1e9;
      for (const p of [RIVER_N, RIVER_S]) for (const q of p) d = Math.min(d, Math.hypot(P.x - q[0], P.z - q[1]));
      d = Math.min(d, Math.hypot(P.x - POND.x, P.z - POND.z) - 6);
      AudioSys.riverGain.gain.value = clamp01(1 - d / 14) * 0.05;
    }
    if (!store.get().paused){
      const A = G.amb;
      A.koto -= dt; A.cricket -= dt; A.frog -= dt;
      if (A.koto <= 0){ AudioSys.pluck(KOTO_SCALE[(Math.random() * KOTO_SCALE.length) | 0], 0, 0.12, 1.6); A.koto = 8 + Math.random() * 14; }
      if (nightF > 0.5 && A.cricket <= 0){ AudioSys.cricket(); A.cricket = 0.5 + Math.random() * 1.4; }
      const P = G.player.pos;
      if (nightF < 0.4 && A.frog <= 0 && Math.abs(P.x) < 22 && P.z > 28 && P.z < 66){ AudioSys.frog(); A.frog = 1.5 + Math.random() * 3; }
      else if (A.frog <= 0) A.frog = 1;
    }
  }
}
function updatePetals(dt, T){
  const D = petalsData, scr = petalsScr;
  const storm = G.fx.stormT > 0 ? 2.6 : 1;
  if (G.fx.stormT > 0) G.fx.stormT -= dt;
  scr.wind = (Math.sin(T * 0.4) * 0.7 + Math.sin(T * 0.17 + 1.3) * 0.5) * (storm > 1 ? 2.2 : 1);
  const s = store.get(), P = G.player.pos;
  const blessed = s.stage >= 4;
  for (let i = 0; i < D.petals.length; i++){
    const pt = D.petals[i];
    if (blessed && i < 30){
      const a = pt.seedA + T * pt.orbS, k = 1 - Math.exp(-2.5 * dt);
      pt.x += (P.x + Math.cos(a) * pt.orbR - pt.x) * k;
      pt.y += (P.y + 0.9 + Math.sin(pt.seed * 3 + T * 1.3) * 0.5 - pt.y) * k;
      pt.z += (P.z + Math.sin(a) * pt.orbR - pt.z) * k;
    } else {
      pt.y -= pt.fall * dt * storm;
      pt.x += (scr.wind + Math.sin(T * pt.sway + pt.seed) * 0.55) * dt * storm;
      pt.z += Math.cos(T * pt.sway * 0.8 + pt.seed * 1.7) * 0.4 * dt;
      if (pt.y < 0.03){ pt.y = 6 + Math.random() * 7; pt.x = P.x + (Math.random() - 0.5) * 34; pt.z = P.z + (Math.random() - 0.5) * 34; }
    }
    pt.rx += pt.rsx * dt; pt.ry += pt.rsy * dt; pt.rz += pt.rsz * dt;
    scr.e.set(pt.rx, pt.ry, pt.rz); scr.q.setFromEuler(scr.e);
    scr.p.set(pt.x, pt.y, pt.z); scr.s.set(1, 1, 1);
    scr.m.compose(scr.p, scr.q, scr.s);
    ambPetals.setMatrixAt(i, scr.m);
  }
  ambPetals.instanceMatrix.needsUpdate = true;
  const b = G.fx.burst;
  if (b){
    petalsScr.zeroed = false;
    b.age += dt;
    const life = 2.6;
    for (let i = 0; i < D.burst.length; i++){
      const sd = D.burst[i], tI = b.age, dist = sd.spd * tI;
      const y = b.pos.y + sd.up * tI * 3.2 - 3.6 * tI * tI, fade = Math.max(0, 1 - tI / life);
      scr.e.set(sd.rs * tI, sd.rs * 0.7 * tI, 0); scr.q.setFromEuler(scr.e);
      scr.p.set(b.pos.x + sd.dx * dist, Math.max(y, 0.05), b.pos.z + sd.dz * dist);
      const sc = 1.3 * fade; scr.s.set(sc, sc, sc);
      scr.m.compose(scr.p, scr.q, scr.s);
      burstPetals.setMatrixAt(i, scr.m);
    }
    burstPetals.instanceMatrix.needsUpdate = true;
    if (b.age > life) G.fx.burst = null;
  } else if (!petalsScr.zeroed){ zeroInstances(burstPetals, 70); petalsScr.zeroed = true; }
  if (G.fx.stormT > 0){
    for (let i = 0; i < D.storm.length; i++){
      const sd = D.storm[i];
      sd.y -= sd.fall * dt;
      if (sd.y < GREAT_SAKURA.y - 1) sd.y = GREAT_SAKURA.y + 14 + Math.random() * 3;
      sd.rx += sd.rs * dt;
      scr.e.set(sd.rx, sd.rx * 0.7, 0); scr.q.setFromEuler(scr.e);
      scr.p.set(GREAT_SAKURA.x + sd.dx, sd.y, GREAT_SAKURA.z + sd.dz);
      scr.s.set(1, 1, 1);
      scr.m.compose(scr.p, scr.q, scr.s);
      stormPetals.setMatrixAt(i, scr.m);
    }
    stormPetals.instanceMatrix.needsUpdate = true;
  }
  if (rainMesh.visible){
    const P = G.player.pos;
    for (let i = 0; i < rainData.length; i++){
      const r = rainData[i];
      r.y -= r.spd * dt;
      if (r.y < 0){ r.y = 12 + Math.random() * 3; r.x = (Math.random() - 0.5) * 34; r.z = (Math.random() - 0.5) * 34; }
      scr.e.set(0.12, 0, 0); scr.q.setFromEuler(scr.e);
      scr.p.set(P.x + r.x, r.y, P.z + r.z); scr.s.set(1, 1, 1);
      scr.m.compose(scr.p, scr.q, scr.s);
      rainMesh.setMatrixAt(i, scr.m);
    }
    rainMesh.instanceMatrix.needsUpdate = true;
  }
  for (const m of steamMeshes){
    m.userData.t += dt * 0.14;
    if (m.userData.t > 1) m.userData.t = 0;
    const tt = m.userData.t;
    m.position.y = SV.HOTSPRING.y + 0.2 + tt * 2.2;
    m.scale.setScalar(0.4 + tt * 1.1);
    m.rotation.y += dt * 0.4;
    m.material.opacity = 0.18 * Math.sin(Math.PI * tt);
    m.lookAt(camera.position);
  }
  if (splashRing.visible){
    splashT += dt;
    const sc = 1 + splashT * 5;
    splashRing.scale.set(sc, sc, 1);
    splashRing.material.opacity = Math.max(0, 0.7 - splashT * 1.4);
    if (splashT > 0.6) splashRing.visible = false;
  }
}
function playerActive(){
  const s = store.get();
  return s.phase === 'playing' && !s.paused && !s.dialogue && !s.fishing && !(G.race && G.race.phase === 'count');
}
function updatePlayer(dt){
  const A = G.playerAnim;
  A.t += dt;
  const s = store.get(), P = G.player;
  const active = playerActive();
  let ix = 0, iz = 0;
  if (active){
    iz = ((G.keys.has('KeyW') || G.keys.has('ArrowUp')) ? 1 : 0) - ((G.keys.has('KeyS') || G.keys.has('ArrowDown')) ? 1 : 0);
    ix = ((G.keys.has('KeyD') || G.keys.has('ArrowRight')) ? 1 : 0) - ((G.keys.has('KeyA') || G.keys.has('ArrowLeft')) ? 1 : 0);
  }
  const yaw = G.cam.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
  let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;
  const dl = Math.hypot(dx, dz);
  const run = active && (G.keys.has('ShiftLeft') || G.keys.has('ShiftRight'));
  const speed = run ? 6.8 : 3.8;
  let tvx = 0, tvz = 0;
  if (dl > 0){ dx /= dl; dz /= dl; tvx = dx * speed; tvz = dz * speed; }
  const kAcc = 1 - Math.exp(-(P.grounded ? 11 : 4.5) * dt);
  P.vel.x += (tvx - P.vel.x) * kAcc;
  P.vel.z += (tvz - P.vel.z) * kAcc;
  if (active && P.grounded && G.keys.has('Space')){ P.vel.y = 8.6; P.grounded = false; }
  P.vel.y -= 22 * dt;
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  collideCircle(P.pos, 0.36, 1.45);
  const ddx = P.pos.x - WORLD_CENTER.x, ddz = P.pos.z - WORLD_CENTER.z, rr = Math.hypot(ddx, ddz);
  if (rr > WORLD_R){ P.pos.x = WORLD_CENTER.x + ddx / rr * WORLD_R; P.pos.z = WORLD_CENTER.z + ddz / rr * WORLD_R; }
  const prevY = P.pos.y;
  P.pos.y += P.vel.y * dt;
  const gh = groundHeight(P.pos.x, P.pos.z, prevY);
  if (P.pos.y <= gh + 0.0001 && P.vel.y <= 0.001){ P.pos.y = gh; P.vel.y = 0; P.grounded = true; }
  else if (P.grounded && P.vel.y <= 0 && P.pos.y - gh < 0.5){ P.pos.y = gh; P.vel.y = 0; }
  else P.grounded = false;
  const hsp = Math.hypot(P.vel.x, P.vel.z);
  P.running = hsp > 4.6 && active;
  if (hsp > 0.4){ const ty = Math.atan2(P.vel.x, P.vel.z); A.facing += shortAngle(ty - A.facing) * (1 - Math.exp(-10 * dt)); }
  const spN = Math.min(1, hsp / 6.8);
  if (hsp > 0.4 && P.grounded) A.phase += dt * (5 + 9 * spN);
  const swing = P.grounded ? Math.min(1, hsp / 3.8) * (0.5 + 0.5 * spN) : 0;
  const rig = playerRig;
  rig.legL.rotation.x = Math.sin(A.phase) * swing;
  rig.legR.rotation.x = -Math.sin(A.phase) * swing;
  rig.armR.rotation.x = Math.sin(A.phase) * swing * 0.9;
  if (G.lanternOn){ rig.armL.rotation.x = -0.55; rig.armL.rotation.z = -0.1; }
  else { rig.armL.rotation.x = -Math.sin(A.phase) * swing * 0.9; rig.armL.rotation.z *= 0.85; }
  if (!P.grounded){ rig.legL.rotation.x = 0.55; rig.legR.rotation.x = -0.35; rig.armR.rotation.z = 0.45; if (!G.lanternOn) rig.armL.rotation.z = -0.45; }
  else rig.armR.rotation.z *= 0.85;
  rig.body.rotation.x = spN * 0.1;
  rig.body.scale.y = 1 + Math.sin(A.t * 2.2) * 0.012;
  playerGrp.position.set(P.pos.x, P.pos.y + (P.grounded ? Math.abs(Math.sin(A.phase)) * 0.045 * Math.min(1, hsp / 3.8) : 0.06), P.pos.z);
  playerGrp.rotation.y = A.facing;
}
function updateNPCs(dt, T){
  const P = G.player.pos;
  for (const key of Object.keys(V)){
    const v = V[key], n = v.def;
    v.grp.position.set(n.x, n.y, n.z);
    const d = Math.hypot(P.x - n.x, P.z - n.z);
    let ty = Math.PI * 0.5;
    if (d < 6 && store.get().phase === 'playing') ty = Math.atan2(P.x - n.x, P.z - n.z);
    v.grp.rotation.y += shortAngle(ty - v.grp.rotation.y) * (1 - Math.exp(-4 * dt));
    v.rig.body.rotation.z = Math.sin(T * 0.9 + n.x) * 0.02;
    v.rig.head.rotation.z = Math.sin(T * 0.7 + n.z) * 0.05;
    v.rig.body.scale.y = 1 + Math.sin(T * 2 + n.x) * 0.012;
    if (key === 'kenta' && d < 4) v.rig.armR.rotation.z = 2.4 + Math.sin(T * 7) * 0.3;
    else if (d < 3.2) v.rig.armR.rotation.z = 2.2 + Math.sin(T * 6) * 0.28;
    else v.rig.armR.rotation.z += (0 - v.rig.armR.rotation.z) * (1 - Math.exp(-6 * dt));
  }
}
function updateFireflies(dt, T){
  const s = store.get();
  const show = s.quests.fireflies === 'active' && isNight() && s.stage >= 2;
  G.fireflies.forEach((f) => {
    const vis = show && !f.caught;
    f.grp.visible = vis;
    if (!vis) return;
    f.grp.position.set(f.x + Math.sin(T * 0.6 + f.seed) * 0.8, 1.1 + Math.sin(T * 1.1 + f.seed * 2) * 0.35, f.z + Math.cos(T * 0.5 + f.seed) * 0.8);
    const p = 0.7 + Math.sin(T * 3 + f.seed) * 0.3;
    f.grp.children[1].scale.setScalar(0.12 + p * 0.12);
  });
}
/* FIX: the fox now actually leads you up the mountain after you greet it,
   hides again if dawn comes before you do, and follows the stone-step trail. */
function updateFox(dt, T){
  const s = store.get();
  const F = G.fox, fg = fox.group;
  let mode = F.mode;
  if (s.stage >= 4) mode = 'pet';
  if (mode === 'hidden'){
    if (s.stage === 3 && !s.foxMet && isNight() && s.phase === 'playing'){ mode = 'gate'; F.pos.set(0, 0, -10.5); F.yaw = -Math.PI / 2; }
  } else if (mode === 'gate'){
    if (s.foxMet) mode = 'lead';
    else if (!isNight()) mode = 'hidden';
  }
  F.mode = mode;
  fg.visible = mode !== 'hidden';
  if (mode === 'hidden') return;
  if (mode === 'gate'){
    F.pos.y = 0;
    fg.position.copy(F.pos);
    F.yaw += shortAngle(-Math.PI / 2 - F.yaw) * Math.min(1, 3 * dt);
    fg.rotation.y = F.yaw;
  } else if (mode === 'lead'){
    const last = FOX_WP.length - 1;
    const wp = FOX_WP[Math.min(F.wp, last)];
    const distP = Math.hypot(G.player.pos.x - F.pos.x, G.player.pos.z - F.pos.z);
    if (distP < 17 || F.wp >= last){
      const dx = wp[0] - F.pos.x, dz = wp[1] - F.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.5){
        if (F.wp < last) F.wp++;
        else { F.mode = 'sit'; }
      } else {
        const sp = Math.min(3.8, 1.2 + d * 1.6);
        F.pos.x += dx / d * sp * dt; F.pos.z += dz / d * sp * dt;
        F.yaw = Math.atan2(dx, dz);
      }
    }
    F.pos.y += (wp[2] - F.pos.y) * Math.min(1, 6 * dt);   // explicit waypoint heights — no clipping through terraces
    fg.position.copy(F.pos);
    fg.rotation.y = F.yaw;
  } else if (mode === 'sit'){
    fg.position.copy(F.pos);
  } else if (mode === 'pet'){
    const P = G.player.pos;
    const offA = G.playerAnim.facing + 2.4;
    const tx = P.x + Math.sin(offA) * 1.3, tz = P.z + Math.cos(offA) * 1.3;
    const k = 1 - Math.exp(-3.5 * dt);
    F.pos.x += (tx - F.pos.x) * k; F.pos.z += (tz - F.pos.z) * k;
    const gy = groundHeight(F.pos.x, F.pos.z, F.pos.y + 0.6);
    F.pos.y += (gy - F.pos.y) * Math.min(1, 8 * dt);
    const moving = Math.hypot(tx - F.pos.x, tz - F.pos.z) > 0.15;
    if (moving) F.yaw += shortAngle(Math.atan2(tx - F.pos.x, tz - F.pos.z) - F.yaw) * Math.min(1, 8 * dt);
    fg.position.copy(F.pos);
    fg.rotation.y = F.yaw;
  }
  fox.tail.rotation.y = Math.sin(T * (mode === 'lead' ? 9 : 2.5)) * 0.35;
}
function updateCat(dt, T){
  const s = store.get();
  catPet.group.visible = s.catDone;
  if (!s.catDone) return;
  const P = G.player.pos;
  const offA = G.playerAnim.facing - 2.4;
  const tx = P.x + Math.sin(offA) * 1.2, tz = P.z + Math.cos(offA) * 1.2;
  const k = 1 - Math.exp(-3 * dt);
  catPet.group.position.x += (tx - catPet.group.position.x) * k;
  catPet.group.position.z += (tz - catPet.group.position.z) * k;
  catPet.group.position.y = groundHeight(catPet.group.position.x, catPet.group.position.z, catPet.group.position.y + 0.5);
  catPet.group.rotation.y += shortAngle(Math.atan2(tx - catPet.group.position.x, tz - catPet.group.position.z) - catPet.group.rotation.y) * Math.min(1, 6 * dt);
  catPet.tail.rotation.z = Math.sin(T * 3) * 0.5;
}
function updateCharms(dt, T){
  charmFloats.forEach((f, i) => {
    f.rotation.y += dt * 0.9;
    f.position.y = 1.05 + Math.sin(T * 1.7 + i * 2.3) * 0.12;
  });
  if (kiteGroup.visible) kiteGroup.rotation.z = Math.sin(T * 1.3) * 0.08;
  raceFlags.forEach((f, i) => {
    const cur = G.race && G.race.cp === i;
    f.ring.visible = !!cur;
    if (cur){ const s2 = 3.4 + Math.sin(T * 5) * 0.5; f.ring.scale.set(s2, s2, 1); }
    f.grp.children[1].rotation.y = Math.sin(T * 3 + i) * 0.3;
  });
}
const camLook = new THREE.Vector3(0, 2, 0);
let titleOrbit = 0;
const camScr = { target: new THREE.Vector3(), dir: new THREE.Vector3(), desired: new THREE.Vector3(), tv: new THREE.Vector3() };
function updateCamera(dt){
  const s = store.get();
  if (s.phase === 'title'){
    titleOrbit += dt * 0.06;
    camScr.tv.set(Math.sin(titleOrbit) * 24, 9.5, Math.cos(titleOrbit) * 24 + 2);
    camera.position.lerp(camScr.tv, 1 - Math.exp(-2.2 * dt));
    camScr.tv.set(0, 1.6, -2);
    camLook.lerp(camScr.tv, 1 - Math.exp(-2.2 * dt));
    camera.lookAt(camLook);
    return;
  }
  const P = G.player.pos;
  camScr.target.set(P.x, P.y + 1.5, P.z);
  const wantD = G.cam.distTarget * (s.dialogue ? 0.62 : 1);
  G.cam.dist += (wantD - G.cam.dist) * (1 - Math.exp(-7 * dt));
  const yaw = G.cam.yaw, pitch = THREE.MathUtils.clamp(G.cam.pitch, -0.25, 1.25);
  camScr.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  let allowed = G.cam.dist;
  for (let i = 1; i <= 9; i++){
    const tt = (i / 9) * G.cam.dist;
    if (pointBlocked(camScr.target.x + camScr.dir.x * tt, camScr.target.y + camScr.dir.y * tt, camScr.target.z + camScr.dir.z * tt)){ allowed = Math.max(1.6, tt - 0.45); break; }
  }
  camScr.desired.set(camScr.target.x + camScr.dir.x * allowed, Math.max(camScr.target.y + camScr.dir.y * allowed, 0.5), camScr.target.z + camScr.dir.z * allowed);
  const k = allowed < camera.position.distanceTo(camScr.target) ? 22 : 12;
  camera.position.lerp(camScr.desired, 1 - Math.exp(-k * dt));
  camLook.lerp(camScr.target, 1 - Math.exp(-18 * dt));
  camera.lookAt(camLook);
  const wantFov = (G.player.running && playerActive()) ? 60 : 55;
  camera.fov += (wantFov - camera.fov) * (1 - Math.exp(-6 * dt));
  camera.updateProjectionMatrix();
}
function questTargets(){
  const s = store.get(), out = [];
  if (s.stage === 0) SV.CHARMS.forEach((c, i) => { if (!s.charms[i]) out.push(c); });
  else if (s.stage === 1) out.push({ x: NPCS.genji.x, z: NPCS.genji.z });
  else if (s.stage === 2){
    if (s.quests.kite === 'active') out.push({ x: KITE.x, z: KITE.z });
    if (s.quests.crows === 'active') out.push({ x: NPCS.aki.x, z: NPCS.aki.z });
    if (s.quests.fishing === 'active') out.push({ x: FISH_SPOT.x, z: FISH_SPOT.z });
    if (s.quests.fireflies === 'active' && isNight()) out.push({ x: SV.FOX_SHRINE.x, z: SV.FOX_SHRINE.z });
    if (!out.length) out.push({ x: NPCS.genji.x, z: NPCS.genji.z });
  } else if (s.stage === 3){
    out.push(s.foxMet ? { x: SUMMIT_BELL.x, z: SUMMIT_BELL.z } : { x: 0, z: -10.5 });
  }
  return out;
}

SV.sys = {
  collideCircle, groundHeight, pointBlocked,
  AudioSys, openDialogue, advanceDialogue, closeDialogue, doInteract,
  awardSigil, sigilCount, setStage, runFinale,
  startRace, endRace, updateRace,
  startFishing, endFishing, resolveFishStrike, updateFishing,
  updateInteraction, currentInteractables,
  requestLock, startGame, togglePause, restartGame, toggleDayNight, applyLook,
  saveGame, hasSave, continueGame, applyStoryWorld,
  spawnCrows, clearCrows,
  updateDayNight, updatePetals, playerActive, updatePlayer, updateNPCs,
  updateCrows, updateFireflies, updateFox, updateCat, updateCharms, updateCamera,
  questTargets,
};
})();