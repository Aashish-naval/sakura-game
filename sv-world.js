/* ============================================================
   SAKURA VILLAGE · 1/5 — config, engine, world construction
   Exposes everything on window.SV for the later files.
   ============================================================ */
(() => {
'use strict';
const THREE = window.THREE;
window.SV = window.SV || {};

/* ---------------- utils ---------------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const pickWith = (rng, arr) => arr[(rng()*arr.length)|0];
const shortAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function distSegPt(x, z, ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az;
  let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/* ---------------- state store ---------------- */
function createStore(init){
  let state = init;
  const subs = new Set();
  return {
    get: () => state,
    set(part){ state = { ...state, ...(typeof part === 'function' ? part(state) : part) }; subs.forEach(fn => fn(state)); },
    subscribe(fn){ subs.add(fn); return () => subs.delete(fn); },
  };
}
const SAVE_KEY = 'sakuraVillage_v2';
const store = createStore({
  phase: 'title', paused: false, dialogue: null, prompt: null, banner: null,
  stage: 0, blessed: false,
  sigils: { grove: false, field: false, river: false, dusk: false },
  quests: { kite: 'none', crows: 'none', fishing: 'none', fireflies: 'none' },
  firefliesCaught: 0, crowGone: 0, fishCaught: [], jar: false,
  cats: [false, false, false], catDone: false,
  foxMet: false, raceBest: null,
  charms: [false, false, false],
  muted: false, locked: false, fishing: false, racing: false, dragMode: false,
});
/* per-frame runtime state — never touches the store */
const G = {
  keys: new Set(),
  player: { pos: new THREE.Vector3(0, 0, 17.5), vel: new THREE.Vector3(), grounded: true, running: false },
  cam: { yaw: 0, pitch: 0.34, dist: 6, distTarget: 6 },
  time: { t: 0.34, tween: null },
  fx: { burst: null, stormT: 0 },
  rain: { on: false, until: 0 },
  race: null, fish: null, uiOpts: false, lanternOn: false,
  playerAnim: { phase: 0, facing: Math.PI, t: 0 },
  fox: { mode: 'hidden', wp: 0, yaw: 0, pos: new THREE.Vector3(0, 0, -10.5) },
  amb: { koto: 6, cricket: 1, frog: 3 },
  fireflies: [], crows: [], crowSpawned: false,
};
const isNight = () => Math.sin((G.time.t - 0.25) * Math.PI * 2) < -0.03;

/* ---------------- world config ---------------- */
const SPAWN = { x: 0, z: 17.5 };
const POND  = { x: 14, z: 8, r: 5.6 };
const PLAZA = { x: 0, z: 3, r: 4.6 };
const LANTERNS = [{ x: -3.2, z: 0.6 }, { x: 3.2, z: 0.6 }, { x: -3.6, z: -14.2 }, { x: 3.6, z: -14.2 }, { x: -2.2, z: -27.5 }, { x: 2.2, z: -27.5 }];
const CHARMS = [ { x: 18.5, z: 12.5 }, { x: 44, z: -10 }, { x: 20, z: -14 } ];
const HOUSE_DEFS = [
  { x: -11,  z: 1,    rot:  0.45, w: 4.2, d: 3.4, wall: '#e9dfc8', roof: '#46505c' },
  { x: -10.5,z: -11,  rot: -0.3,  w: 3.8, d: 3.6, wall: '#a98a68', roof: '#514c46' },
  { x: 12,   z: -7,   rot: -0.55, w: 4.0, d: 3.4, wall: '#e9dfc8', roof: '#46505c' },
  { x: -12,  z: 11.5, rot:  0.2,  w: 3.6, d: 3.2, wall: '#b5906c', roof: '#4a4f45' },
  { x: 8.5,  z: 16,   rot:  0.9,  w: 4.0, d: 3.6, wall: '#e9dfc8', roof: '#51463f' },
];
const TREE_DEFS = [
  [-5.5, 8.5, 0], [5.5, 5.2, 0], [-6.8, -3.5, 0], [7.5, -1.5, 0], [-16.5, 4, 0], [16.8, 1.2, 0],
  [-5.2, -16, 0], [5.6, -16.5, 0],
  [-20.5, 2.5, 0], [-24, 5, 0], [-21.5, 9.5, 0], [-26, 8.8, 0], [-18.5, 6.5, 0],
  [18, 17.5, 0], [-17, -8, 0], [14.5, -14, 0],
  [5, -24, 0], [-7, -25, 0],                       // FIX: base 0 (were floating at 2.8)
  [12, -48, 2.8], [-16, -54, 2.8], [6, -62, 8.4],  // on the mountain terraces
];
const ROCK_DEFS = [
  [9.0, 3.6, 0.8], [19.3, 10.6, 0.9], [17.4, 11.6, 0.6], [19.5, 14.0, 0.7], [16.4, 13.2, 0.5],
  [18.9, -12.9, 1.1], [21.4, -14.8, 1.4], [18.5, -15.8, 0.8], [22.2, -12.2, 0.7],
  [-3.2, 12.5, 0.45], [6.4, 10.8, 0.4], [-14, -2.5, 0.6], [-7.5, -8.5, 0.5],
  [3.4, -3.8, 0.42], [-2.5, -6.5, 0.35], [11, 4.5, 0.5],
];
const FENCE_DEFS = [
  { a: [-2.7, 16.5], b: [-2.7, 9.3] }, { a: [2.7, 16.5], b: [2.7, 9.3] },
  { a: [8.7, 3.0], b: [9.3, 7.3] }, { a: [9.8, 9.5], b: [9.1, 12.9] },
  { a: [-3.0, -6.5], b: [-3.0, -12.5] }, { a: [3.0, -6.5], b: [3.0, -12.5] },
];
const RIVER_N = [[9.5,-30],[10.2,-22],[10.8,-14],[11,-6],[11.6,1]];
const RIVER_S = [[12.5,14],[10,17],[6,20],[2.5,22.5],[1,25.5],[0.5,29],[0,33.5]];
const BRIDGE_A = { x: 10.9, z: -10 };
const BRIDGE_B = { x: 1.6, z: 24 };
const GROVE_PATH = [[17,-10],[24,-8],[30,-6],[38,-4],[46,-2],[54,-4],[62,-2],[68,0]];
const SOUTH_ROAD = [[0,14],[0,20],[1.6,24],[0,28],[-1,31],[-3,35]];
const MOUNT_TRAIL = [[0,-20],[0,-26],[0,-31],[0,-35]];
const FOX_SHRINE = { x: 48, z: 2 };
const KITE = { x: 57.6, z: -7, rocks: [[56.2,-7.2,0.5],[56.9,-6.6,1.05],[57.6,-7.4,1.6],[58.3,-6.7,2.15]] };
const TERR = [ {z0:34,z1:40,top:0.44}, {z0:41,z1:47,top:0.88}, {z0:48,z1:54,top:1.32}, {z0:55,z1:61,top:1.76} ];
const MOUNT = { cx: 0, cz: -58, discs: [
  { r: 22, top: 2.8 },
  { r: 17, top: 5.6, c: [0,-60] },
  { r: 12.5, top: 8.4, c: [0,-62] },
  { r: 8.5, top: 11.2, c: [0,-63] },
  { r: 6, top: 14, c: [0,-64] },
]};
const HOTSPRING = { x: -13, z: -52, y: 5.6 };
const SUMMIT_BELL = { x: 0, z: -66.2, y: 14 };
const GREAT_SAKURA = { x: 1.6, z: -63, y: 14 };
const ROCKSLIDE = { x: 0, z: -31.5 };
const NPCS = {
  hana:  { x: 3.2, z: 7.4,  y: 0.18, name: 'Hana' },
  genji: { x: 1.8, z: -17.2, y: 0.6, name: 'Genji' },
  kenta: { x: 3.6, z: 0.4,  y: 0,    name: 'Kenta' },
  aki:   { x: -6, z: 36,    y: 0.44, name: 'Aki' },
  mizuki:{ x: 8.6, z: 8,    y: 0.42, name: 'Mizuki' },
};
/* FIX: third cat spot was buried inside a terrace — moved onto solid disc-1 ground */
const CAT_SPOTS = [ { x: 7.2, z: 3.4, y: 0 }, { x: 52, z: 6, y: 0 }, { x: -19, z: -50, y: 2.8 } ];
const DOCK = { x0: 6.9, x1: 10.2, z: 8, top: 0.42 };
const FISH_SPOT = { x: 9.6, z: 8 };
const RACE_CPS = [ [0,3],[-8,-2.5],[0,-8],[0,-13.5],[-10.5,-11],[-12,11.5],[3,7.5],[7.8,8],[0,3] ];
/* FIX: fox route now follows the actual stone-step trail, with explicit heights */
const FOX_WP = [
  [0,-10.5,0],[0,-16,0],[0,-26,0],[0,-31.5,0],[0,-35.4,0],
  [0,-36.6,2.8],[0,-40,2.8],[7,-45,2.8],[10,-47,2.8],
  [13.2,-51,5.6],[6,-55,5.6],
  [-11,-59.5,8.4],[-6,-60,8.4],
  [8.2,-61.3,11.2],[2,-62.5,11.2],
  [-4.8,-65.4,14],[0.5,-65.3,14],
];
const FIREFLY_POS = [[38,-14],[44,-2],[52,-12],[58,-4],[62,4],[46,6],[34,-6]];
const FISH_SPECIES = [
  { n: 'Tanago',        day: 0.28, night: 0.12, w: 0.30, s: 2.6 },
  { n: 'Sweetfish',     day: 0.24, night: 0.14, w: 0.26, s: 3.0 },
  { n: 'Red Carp',      day: 0.20, night: 0.20, w: 0.22, s: 3.4 },
  { n: 'River Catfish', day: 0.04, night: 0.28, w: 0.16, s: 3.9 },
  { n: 'Moon Koi',      day: 0.02, night: 0.16, w: 0.11, s: 4.7 },
];
const SIGIL_NAMES = { grove: 'Grove Sigil', field: 'Field Sigil', river: 'River Sigil', dusk: 'Dusk Sigil' };
const SIGIL_KANJI = { grove: '森', field: '田', river: '川', dusk: '夕' };
const CHAPTERS = [
  ['Chapter I · The Charms of Spring', '桜のお守り'],
  ['Chapter II · The Fading Spring', '消えゆく春'],
  ['Chapter III · The Four Sigils', '四つの紋'],
  ["Chapter IV · The Fox's Path", '狐の道'],
  ['Epilogue · The Blooming', '咲く春'],
];
const PINKS = ['#f5b8ce', '#efa6c2', '#f9cbdd', '#f2abcd'];
const DIM_PINKS = ['#d8b4b8', '#cfa9ad', '#e0bcc0', '#d4adb2'];
const BLOOM_PINKS = ['#ffb3d0', '#ff9ec4', '#ffc6dd', '#ffaed0'];
const TUFTGREENS = ['#6f9c4e', '#7fae5b', '#8fbc68', '#5f8f47'];
const PATCHGREENS = ['#7fae5b', '#86b45f', '#79a554'];
const BLOSSOMS = ['#f6f1e7', '#f3b7c9', '#eec2d6'];
const GRAYS = ['#9a958c', '#8f8a81', '#a5a099'];
const WOODS = ['#8a6748', '#7d5c40', '#93704f'];
const HILLGREENS = ['#7ba457', '#6d9a4f', '#83ab5c'];
const DIRTS = ['#cdb489', '#c6ac80', '#d2ba90'];
const REEDGREENS = ['#5c8f4a', '#6da056'];
const PADGREENS = ['#55924d', '#5fa357'];
const PETAL_COLORS = ['#f7c3d6', '#f2abc6', '#fbdce7'];
const BAMBOO_COLS = ['#7fa85a', '#8fb563', '#a3c06b', '#6f9a50'];
const RICE_COLS = ['#8fae4f', '#9cba5b', '#7fa045'];

/* ---------------- renderer / scene / lights ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
const FOG = new THREE.Fog('#dcebe8', 55, 240);
scene.fog = FOG;
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 700);
camera.position.set(14, 9, 20);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -72; sun.shadow.camera.right = 72;    // FIX: widened to cover the rice terraces
sun.shadow.camera.top = 72; sun.shadow.camera.bottom = -72;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 300;
sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.05;
sun.target.position.set(15, 0, -4);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a3a, 0.8);
scene.add(hemi);

/* ---------------- mesh helpers ---------------- */
function M(g, m, o = {}){
  const mesh = new THREE.Mesh(g, m);
  if (o.pos) mesh.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) mesh.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scl !== undefined){ if (Array.isArray(o.scl)) mesh.scale.set(o.scl[0], o.scl[1], o.scl[2]); else mesh.scale.setScalar(o.scl); }
  mesh.castShadow = !!o.cast; mesh.receiveShadow = !!o.recv;
  (o.parent || scene).add(mesh);
  return mesh;
}
function makeInstances(g, m, items, cast = true, receive = false, parent = scene){
  const mesh = new THREE.InstancedMesh(g, m, items.length);
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const c = new THREE.Color(), p = new THREE.Vector3(), s = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
    p.set(it.x || 0, it.y || 0, it.z || 0);
    s.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
    mat.compose(p, q, s);
    mesh.setMatrixAt(i, mat);
    mesh.setColorAt(i, c.set(it.color || '#ffffff'));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

/* ---------------- geometry / materials ---------------- */
const bakeRoof = (g) => { g.rotateY(Math.PI / 4); return g; };
const std = (o) => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, ...o });
function makeSignTexture(){
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    x.fillStyle = '#efe6d0'; x.fillRect(0, 0, 128, 256);
    x.strokeStyle = '#5a4a3a'; x.lineWidth = 5; x.strokeRect(8, 8, 112, 240);
    x.fillStyle = '#2b2521'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '600 56px "Shippori Mincho", serif';
    x.fillText('桜', 64, 56); x.fillText('里', 64, 150);
    x.font = '400 42px "Shippori Mincho", serif'; x.fillText('の', 64, 100);
    x.fillStyle = '#d9788c';
    x.beginPath(); x.ellipse(64, 212, 10, 6, 0.6, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(51, 220, 9, 5, 1.4, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(77, 220, 9, 5, -0.2, 0, Math.PI * 2); x.fill();
  };
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { draw(); tex.needsUpdate = true; });
  return tex;
}
const GEO = {
  ground: new THREE.PlaneGeometry(250, 210),
  groundFar: new THREE.CircleGeometry(420, 48),
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 9),
  petal: new THREE.PlaneGeometry(0.17, 0.13),
  roof: bakeRoof(new THREE.ConeGeometry(1, 1, 4)),
  cap: bakeRoof(new THREE.ConeGeometry(0.3, 0.24, 4)),
  trunk: new THREE.CylinderGeometry(0.13, 0.22, 1, 6),
  bigTrunk: new THREE.CylinderGeometry(0.5, 0.85, 1, 8),
  col: new THREE.CylinderGeometry(0.15, 0.17, 2.2, 7),
  col2: new THREE.CylinderGeometry(0.16, 0.2, 3.1, 7),
  lantP: new THREE.CylinderGeometry(0.09, 0.12, 0.85, 6),
  post: new THREE.CylinderGeometry(0.055, 0.07, 1, 6),
  signPost: new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6),
  blob: new THREE.IcosahedronGeometry(1, 0),
  rock: new THREE.IcosahedronGeometry(1, 0),
  mount: new THREE.ConeGeometry(1, 1, 5),
  tuft: new THREE.ConeGeometry(0.06, 0.36, 4),
  reed: new THREE.ConeGeometry(0.05, 1.25, 4),
  blossom: new THREE.IcosahedronGeometry(0.055, 0),
  patch: new THREE.CylinderGeometry(1, 1, 0.05, 10),
  disc: new THREE.CylinderGeometry(1, 1, 0.06, 9),
  pad: new THREE.CylinderGeometry(1, 1, 0.035, 9),
  rail: new THREE.BoxGeometry(1, 0.07, 0.06),
  hat: new THREE.ConeGeometry(0.36, 0.17, 9),
  bell: new THREE.CylinderGeometry(0.09, 0.13, 0.19, 8),
  bigBell: new THREE.CylinderGeometry(0.32, 0.46, 0.7, 10),
  plaza: new THREE.CylinderGeometry(4.6, 4.75, 0.1, 28),
  pondBed: new THREE.CircleGeometry(5.75, 30),
  pondTop: new THREE.CircleGeometry(5.65, 30),
  pondRing: new THREE.RingGeometry(5.65, 6.45, 34),
  charmRing: new THREE.RingGeometry(0.42, 0.55, 24),   // rotated flat below — FIX
  signPlane: new THREE.PlaneGeometry(0.55, 1.02),
  bamboo: new THREE.CylinderGeometry(0.85, 1, 1, 5),
  leafFan: new THREE.ConeGeometry(0.5, 0.28, 4),
  rice: new THREE.ConeGeometry(0.05, 0.55, 4),
  scareHead: new THREE.SphereGeometry(0.22, 8, 6),
  plane: new THREE.PlaneGeometry(1, 1),                 // vertical use (kite, flags, wings)
  flat: new THREE.PlaneGeometry(1, 1),                  // FIX: horizontal water plane
  streak: new THREE.PlaneGeometry(0.035, 0.65),
  steam: new THREE.PlaneGeometry(0.8, 0.8),
  springPool: new THREE.CircleGeometry(1.9, 20),
  waterSeg: new THREE.PlaneGeometry(1, 1),              // river segments (rotated flat below)
  flagPole: new THREE.CylinderGeometry(0.05, 0.06, 2.1, 5),
};
GEO.ground.rotateX(-Math.PI / 2); GEO.groundFar.rotateX(-Math.PI / 2);
GEO.pondBed.rotateX(-Math.PI / 2); GEO.pondTop.rotateX(-Math.PI / 2); GEO.pondRing.rotateX(-Math.PI / 2);
GEO.springPool.rotateX(-Math.PI / 2); GEO.waterSeg.rotateX(-Math.PI / 2);
GEO.flat.rotateX(-Math.PI / 2); GEO.charmRing.rotateX(-Math.PI / 2);   // FIX: rings & water now lie flat
const MAT = {
  white: std({ color: 0xffffff }),
  grass: std({ color: 0x8cb25e }),
  grassFar: std({ color: 0x7ba050 }),
  wood: std({ color: 0x8a6748 }),
  woodDark: std({ color: 0x5c4531 }),
  plank: std({ color: 0x9a7752 }),
  stone: std({ color: 0xa39d92 }),
  stoneDark: std({ color: 0x7e7970 }),
  plinth: std({ color: 0x8b8578 }),
  door: std({ color: 0x463629 }),
  vermilion: std({ color: 0xc2482f }),
  shrineWood: std({ color: 0x8a3b2e }),
  roofDark: std({ color: 0x3d443f }),
  inkMat: std({ color: 0x33302c }),
  gold: std({ color: 0xc9a34a, roughness: 0.5, metalness: 0.3 }),
  soil: std({ color: 0x9c7a52 }),
  windowGlow: new THREE.MeshStandardMaterial({ color: 0x5a4a33, emissive: 0xffca7a, emissiveIntensity: 0.15 }),
  lanternGlow: new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45e, emissiveIntensity: 0.25 }),
  charmPetal: std({ color: 0xf6a9c3, emissive: 0xff8fb3, emissiveIntensity: 0.5 }),
  charmCore: std({ color: 0xf2cf7e, emissive: 0xffcf5e, emissiveIntensity: 0.6 }),
  petal: new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.92, roughness: 1 }),
  burst: new THREE.MeshBasicMaterial({ color: 0xffd3e2, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  pondBed: std({ color: 0x2e6b8c }),
  pondTop: new THREE.MeshStandardMaterial({ color: 0x63b3d4, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.05 }),
  riverM: new THREE.MeshStandardMaterial({ color: 0x5fadc9, transparent: true, opacity: 0.82, roughness: 0.1 }),
  terraceWater: new THREE.MeshStandardMaterial({ color: 0x7fc4d4, transparent: true, opacity: 0.7, roughness: 0.15 }),
  springWater: new THREE.MeshStandardMaterial({ color: 0x8fd8d8, transparent: true, opacity: 0.85, roughness: 0.1, emissive: 0x2a6b6b, emissiveIntensity: 0.3 }),
  plaza: std({ color: 0xd3bc93 }),
  charmRingM: new THREE.MeshBasicMaterial({ color: 0xf2a7c0, transparent: true, opacity: 0.35 }),
  sign: new THREE.MeshStandardMaterial({ map: makeSignTexture(), roughness: 0.9 }),
  steam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
  firefly: new THREE.MeshBasicMaterial({ color: 0xe8ffa0 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xd8ff9a, transparent: true, opacity: 0.3 }),
  bobber: std({ color: 0xd94f4f }),
  splash: new THREE.MeshBasicMaterial({ color: 0xcfeef7, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  crowBody: std({ color: 0x23211f }),
  crowWing: std({ color: 0x1a1917, side: THREE.DoubleSide }),
  beak: std({ color: 0xd8a03c }),
  foxWhite: std({ color: 0xf5f0e8 }),
  foxRed: std({ color: 0xd8543a }),
  catBody: std({ color: 0x8d8b88 }),
  catPatch: std({ color: 0xf0ece2 }),
  raceFlag: std({ color: 0xc2482f, side: THREE.DoubleSide }),
  rainM: new THREE.MeshBasicMaterial({ color: 0xbfd4e2, transparent: true, opacity: 0.42 }),
  ropeM: std({ color: 0xbfa77e }),
};

/* ---------------- collider grid ---------------- */
const COLLIDERS = [];
const GRID = { cell: 12, map: new Map(), qid: 0 };
function addCollider(c){
  if (c.type === 'cyl'){ c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r; }
  else if (c.type === 'box'){ const rad = Math.hypot(c.hw, c.hd); c.minX = c.x - rad; c.maxX = c.x + rad; c.minZ = c.z - rad; c.maxZ = c.z + rad; }
  else { c.minX = Math.min(c.ax, c.bx) - c.r; c.maxX = Math.max(c.ax, c.bx) + c.r; c.minZ = Math.min(c.az, c.bz) - c.r; c.maxZ = Math.max(c.az, c.bz) + c.r; }
  COLLIDERS.push(c);
  const x0 = Math.floor(c.minX / GRID.cell), x1 = Math.floor(c.maxX / GRID.cell);
  const z0 = Math.floor(c.minZ / GRID.cell), z1 = Math.floor(c.maxZ / GRID.cell);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++){
    const k = cx + ',' + cz;
    let a = GRID.map.get(k); if (!a){ a = []; GRID.map.set(k, a); }
    a.push(c);
  }
  return c;
}
const addWalkBox = (x, z, hw, hd, rot, top, y0 = 0) =>
  addCollider({ type: 'box', x, z, hw, hd, rot, y0, h: top - y0, walk: true, top });
const _qout = [];
function gridQuery(x, z, r){
  _qout.length = 0; GRID.qid++;
  const x0 = Math.floor((x - r) / GRID.cell), x1 = Math.floor((x + r) / GRID.cell);
  const z0 = Math.floor((z - r) / GRID.cell), z1 = Math.floor((z + r) / GRID.cell);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++){
    const a = GRID.map.get(cx + ',' + cz); if (!a) continue;
    for (let i = 0; i < a.length; i++){ const c = a[i]; if (c._q !== GRID.qid && !c.off){ c._q = GRID.qid; _qout.push(c); } }
  }
  return _qout;
}

/* ---------------- scatter helpers ---------------- */
const rngW = mulberry32(9127);
const pick = (arr) => pickWith(rngW, arr);
function openGround(x, z, pad){
  if (Math.abs(x) < 2.6 + pad && z > -14.8 && z < 18.2) return false;
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 1 + pad) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < 6.8 + pad) return false;
  if (Math.hypot(x, z + 18) < 5.8 + pad) return false;
  if (HOUSE_DEFS.some(h => { const dx = x - h.x, dz = z - h.z, c = Math.cos(h.rot), s = Math.sin(h.rot); const lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < h.w / 2 + 0.9 + pad && Math.abs(lz) < h.d / 2 + 0.9 + pad; })) return false;
  if (FENCE_DEFS.some(f => distSegPt(x, z, f.a[0], f.a[1], f.b[0], f.b[1]) < 0.75 + pad)) return false;
  if (TREE_DEFS.some(t => Math.hypot(x - t[0], z - t[1]) < 1.0 + pad)) return false;
  if (LANTERNS.some(l => Math.hypot(x - l.x, z - l.z) < 0.8 + pad)) return false;
  if (Math.hypot(x - 1.9, z - 16.2) < 1.0 + pad) return false;
  for (const p of [RIVER_N, RIVER_S]) for (let i = 0; i < p.length - 1; i++) if (distSegPt(x, z, p[i][0], p[i][1], p[i+1][0], p[i+1][1]) < 2.4 + pad) return false;
  if (Math.abs(x) < 14 + pad && z > 33 - pad && z < 62 + pad) return false;
  if (Math.hypot(x - MOUNT.cx, z - MOUNT.cz) < 24 + pad) return false;
  for (const path of [GROVE_PATH, SOUTH_ROAD, MOUNT_TRAIL]) for (let i = 0; i < path.length - 1; i++) if (distSegPt(x, z, path[i][0], path[i][1], path[i+1][0], path[i+1][1]) < 2 + pad) return false;
  if (Math.hypot(x - FOX_SHRINE.x, z - FOX_SHRINE.z) < 5.5 + pad) return false;
  if (Math.hypot(x - KITE.x, z - KITE.z) < 3.5 + pad) return false;
  if (Math.hypot(x - DOCK.x1, z - DOCK.z) < 2.4 + pad) return false;
  return true;
}
function scatter(n, test){
  const out = []; let guard = n * 120;
  while (out.length < n && guard-- > 0){
    const x = -44 + rngW() * 120, z = -32 + rngW() * 98;
    if (test(x, z)) out.push({ x, z });
  }
  return out;
}

/* ---------------- build: base + village ---------------- */
M(GEO.groundFar, MAT.grassFar, { pos: [15, -0.06, -14] });
M(GEO.ground, MAT.grass, { pos: [15, 0, -14], recv: true });

const trunks = [], canopies = [], rocks = [], posts = [], rails = [], discs = [], tufts = [], blossoms = [], patches = [];
HOUSE_DEFS.forEach(h => {
  const g = new THREE.Group(); g.position.set(h.x, 0, h.z); g.rotation.y = h.rot;
  M(GEO.box, MAT.plinth, { pos: [0, 0.12, 0], scl: [h.w + 0.3, 0.24, h.d + 0.3], cast: true, recv: true, parent: g });
  M(GEO.box, std({ color: h.wall }), { pos: [0, 1.21, 0], scl: [h.w, 1.98, h.d], cast: true, recv: true, parent: g });
  M(GEO.roof, std({ color: h.roof }), { pos: [0, 2.92, 0], scl: [(h.w / 2 + 0.55) * 1.4145, 1.45, (h.d / 2 + 0.55) * 1.4145], cast: true, parent: g });
  M(GEO.box, MAT.door, { pos: [0, 0.97, h.d / 2 + 0.03], scl: [0.95, 1.5, 0.1], parent: g });
  M(GEO.box, MAT.windowGlow, { pos: [-h.w * 0.28, 1.5, h.d / 2 + 0.02], scl: [0.55, 0.5, 0.08], parent: g });
  M(GEO.box, MAT.windowGlow, { pos: [h.w * 0.28, 1.5, h.d / 2 + 0.02], scl: [0.55, 0.5, 0.08], parent: g });
  scene.add(g);
  addCollider({ type: 'box', x: h.x, z: h.z, hw: h.w / 2, hd: h.d / 2, rot: h.rot, y0: 0, h: 3.7 });
});
TREE_DEFS.forEach(([x, z, y]) => {
  const h = 2.0 + rngW() * 0.9, base = y || 0;
  trunks.push({ x, y: base + h / 2, z, sy: h, color: pick(['#6f4b39', '#7a523e', '#654434']) });
  addCollider({ type: 'cyl', x, z, r: 0.3, y0: base, h: 2.6 });
  for (let k = 0; k < 3; k++) canopies.push({ x: x + (rngW() - 0.5) * 1.5, y: base + h + 0.35 + rngW() * 1.0, z: z + (rngW() - 0.5) * 1.5, s: 0.95 + rngW() * 0.75, ry: rngW() * Math.PI, color: pick(PINKS) });
});
ROCK_DEFS.forEach(([x, z, s]) => {
  addCollider({ type: 'cyl', x, z, r: s * 0.62, y0: 0, h: s * 0.75 });
  rocks.push({ x, y: s * 0.25, z, s, sy: s * 0.72, ry: rngW() * Math.PI, color: pick(GRAYS) });
});
FENCE_DEFS.forEach(f => {
  const [ax, az] = f.a, [bx, bz] = f.b;
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const n = Math.max(2, Math.round(len / 1.25) + 1);
  for (let i = 0; i < n; i++){ const t = i / (n - 1); posts.push({ x: ax + dx * t, y: 0.48, z: az + dz * t, color: pick(WOODS) }); }
  const ry = Math.atan2(-dz, dx), mx = (ax + bx) / 2, mz = (az + bz) / 2;
  rails.push({ x: mx, y: 0.42, z: mz, sx: len + 0.12, ry, color: pick(WOODS) });
  rails.push({ x: mx, y: 0.74, z: mz, sx: len + 0.12, ry, color: pick(WOODS) });
  addCollider({ type: 'seg', ax, az, bx, bz, r: 0.3, y0: 0, h: 1.05 });
});
for (let i = 0; i < 16; i++){   // boundary hills
  const a = i / 16 * Math.PI * 2 + (rngW() - 0.5) * 0.3, rad = 82 + rngW() * 8;
  const x = 15 + Math.cos(a) * rad, z = -12 + Math.sin(a) * rad;
  const sx = 8 + rngW() * 5.5, sy = 4.5 + rngW() * 5, sz = 8 + rngW() * 5.5;
  rocks.push({ x, y: sy * 0.18, z, s: Math.max(sx, sz) * 0.5, sy: sy * 0.55, ry: rngW() * Math.PI, color: pick(HILLGREENS) });
  addCollider({ type: 'cyl', x, z, r: Math.max(sx, sz) * 0.5, y0: 0, h: sy, noCam: true });
}
[ { x: -95, z: -160, sx: 75, sy: 52, color: '#8fa0b6' }, { x: 55, z: -185, sx: 95, sy: 62, color: '#98a8bc' },
  { x: -175, z: -55, sx: 65, sy: 40, color: '#8798ae' }, { x: 160, z: -110, sx: 85, sy: 55, color: '#93a4b8' },
].forEach(m => M(GEO.mount, std({ color: m.color }), { pos: [m.x, m.sy / 2 - 5, m.z], scl: [m.sx, m.sy, m.sx] }));
function pathDiscs(poly){
  for (let i = 0; i < poly.length - 1; i++){
    const [ax, az] = poly[i], [bx, bz] = poly[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.1));
    for (let k = 0; k <= n; k++){
      const t = k / n;
      discs.push({ x: ax + (bx - ax) * t + (rngW() - 0.5) * 0.5, y: 0.01, z: az + (bz - az) * t + (rngW() - 0.5) * 0.5, s: 1.3 + rngW() * 0.5, color: pick(DIRTS) });
    }
  }
}
for (let z = 16.8; z > -14.4; z -= 1.05){ if (Math.hypot(-PLAZA.x, z - PLAZA.z) < 4.1) continue; discs.push({ x: (rngW() - 0.5) * 0.5, y: 0.01, z, s: 1.35 + rngW() * 0.5, color: pick(DIRTS) }); }
pathDiscs(GROVE_PATH); pathDiscs(SOUTH_ROAD); pathDiscs(MOUNT_TRAIL);
scatter(520, (x, z) => openGround(x, z, 0)).forEach(p => tufts.push({ ...p, y: 0.16, ry: rngW() * Math.PI, rx: (rngW() - 0.5) * 0.25, color: pick(TUFTGREENS) }));
scatter(110, (x, z) => openGround(x, z, 0)).forEach(p => blossoms.push({ ...p, y: 0.09, color: pick(BLOSSOMS) }));
scatter(28, (x, z) => openGround(x, z, 0.8)).forEach(p => patches.push({ ...p, y: 0.0, s: 1.6 + rngW() * 3.2, color: pick(PATCHGREENS) }));

M(GEO.pondBed, MAT.pondBed, { pos: [POND.x, 0.012, POND.z] });
M(GEO.pondTop, MAT.pondTop, { pos: [POND.x, 0.05, POND.z] });
M(GEO.pondRing, std({ color: 0xcdb98d }), { pos: [POND.x, 0.053, POND.z] });
addCollider({ type: 'cyl', x: POND.x, z: POND.z, r: 5.45, y0: 0, h: 0.35 });
{
  const reeds = [], pads = [];
  for (let i = 0; i < 16; i++){ const a = rngW() * Math.PI * 2, r = 6.1 + rngW() * 0.5; reeds.push({ x: POND.x + Math.cos(a) * r, y: 0.6, z: POND.z + Math.sin(a) * r, rx: (rngW() - 0.5) * 0.2, color: pick(REEDGREENS) }); }
  for (let i = 0; i < 5; i++){ const a = rngW() * Math.PI * 2, r = rngW() * 3.4; pads.push({ x: POND.x + Math.cos(a) * r, y: 0.075, z: POND.z + Math.sin(a) * r, s: 0.28 + rngW() * 0.22, color: pick(PADGREENS) }); }
  makeInstances(GEO.reed, MAT.white, reeds, false); makeInstances(GEO.pad, MAT.white, pads, false);
}
M(GEO.plaza, MAT.plaza, { pos: [PLAZA.x, 0, PLAZA.z], recv: true });
M(GEO.col2, MAT.vermilion, { pos: [-1.6, 1.55, -8], cast: true });
M(GEO.col2, MAT.vermilion, { pos: [1.6, 1.55, -8], cast: true });
M(GEO.box, MAT.vermilion, { pos: [0, 3.18, -8], scl: [4.7, 0.3, 0.36], cast: true });
M(GEO.box, MAT.inkMat, { pos: [0, 3.42, -8], scl: [4.95, 0.14, 0.44], cast: true });
M(GEO.box, MAT.vermilion, { pos: [0, 2.45, -8], scl: [3.8, 0.22, 0.24] });
addCollider({ type: 'cyl', x: -1.6, z: -8, r: 0.24, y0: 0, h: 3.1 });
addCollider({ type: 'cyl', x: 1.6, z: -8, r: 0.24, y0: 0, h: 3.1 });
M(GEO.box, MAT.stone, { pos: [0, 0.3, -18], scl: [6.4, 0.6, 5], cast: true, recv: true });
M(GEO.box, MAT.stone, { pos: [0, 0.1, -14.5], scl: [2.8, 0.2, 0.66], recv: true });
M(GEO.box, MAT.stone, { pos: [0, 0.2, -15.15], scl: [2.8, 0.4, 0.66], recv: true });
addWalkBox(0, -18, 3.2, 2.5, 0, 0.6); addWalkBox(0, -14.5, 1.4, 0.36, 0, 0.2); addWalkBox(0, -15.15, 1.4, 0.36, 0, 0.4);
[[-2.3, -16.3], [2.3, -16.3], [-2.3, -19.7], [2.3, -19.7]].forEach(([x, z]) => { M(GEO.col, MAT.shrineWood, { pos: [x, 1.7, z], cast: true }); addCollider({ type: 'cyl', x, z, r: 0.2, y0: 0.6, h: 2.2 }); });
M(GEO.box, MAT.shrineWood, { pos: [0, 2.72, -16.3], scl: [4.9, 0.22, 0.26], cast: true });
M(GEO.box, MAT.shrineWood, { pos: [0, 2.72, -19.7], scl: [4.9, 0.22, 0.26], cast: true });
M(GEO.roof, MAT.roofDark, { pos: [0, 3.68, -18], scl: [5.32, 1.7, 4.46], cast: true });
M(GEO.box, MAT.gold, { pos: [0, 4.62, -18], scl: [0.85, 0.2, 0.6] });
M(GEO.box, MAT.woodDark, { pos: [0, 1.1, -19.15], scl: [1.3, 1.0, 0.9], cast: true });
addCollider({ type: 'box', x: 0, z: -19.15, hw: 0.68, hd: 0.48, rot: 0, y0: 0.6, h: 1.1 });
LANTERNS.forEach(l => {
  const g = new THREE.Group(); g.position.set(l.x, 0, l.z);
  M(GEO.box, MAT.stoneDark, { pos: [0, 0.1, 0], scl: [0.5, 0.2, 0.5], parent: g });
  M(GEO.lantP, MAT.stone, { pos: [0, 0.62, 0], cast: true, parent: g });
  M(GEO.box, MAT.lanternGlow, { pos: [0, 1.2, 0], scl: [0.36, 0.32, 0.36], parent: g });
  M(GEO.cap, MAT.stoneDark, { pos: [0, 1.47, 0], cast: true, parent: g });
  scene.add(g);
  addCollider({ type: 'cyl', x: l.x, z: l.z, r: 0.32, y0: 0, h: 1.65 });
});
{
  const g = new THREE.Group(); g.position.set(1.9, 0, 16.2); g.rotation.y = -0.4;
  M(GEO.signPost, MAT.woodDark, { pos: [0, 0.95, 0], cast: true, parent: g });
  M(GEO.box, MAT.wood, { pos: [0, 1.42, 0], scl: [0.62, 1.12, 0.07], cast: true, parent: g });
  M(GEO.signPlane, MAT.sign, { pos: [0, 1.42, 0.045], parent: g });
  scene.add(g);
  addCollider({ type: 'cyl', x: 1.9, z: 16.2, r: 0.18, y0: 0, h: 1.9 });
}
/* tea house */
{
  const g = new THREE.Group(); g.position.set(5.6, 0, 6.2); g.rotation.y = -0.55;
  M(GEO.box, MAT.plinth, { pos: [0, 0.12, -0.8], scl: [4.6, 0.24, 3.4], cast: true, recv: true, parent: g });
  M(GEO.box, std({ color: '#e9dfc8' }), { pos: [0, 1.3, -0.8], scl: [4.2, 2.1, 3.0], cast: true, parent: g });
  M(GEO.roof, std({ color: '#46505c' }), { pos: [0, 3.1, -0.8], scl: [4.4, 1.4, 3.8], cast: true, parent: g });
  M(GEO.box, MAT.windowGlow, { pos: [0, 1.4, 0.72], scl: [2.6, 0.7, 0.08], parent: g });
  M(GEO.box, MAT.plank, { pos: [0, 0.09, 1.2], scl: [4.0, 0.18, 1.6], recv: true, parent: g });
  M(GEO.box, MAT.lanternGlow, { pos: [1.9, 2.1, 0.8], scl: [0.2, 0.26, 0.2], parent: g });
  scene.add(g);
  addCollider({ type: 'box', x: 5.6, z: 5.75, hw: 2.1, hd: 1.5, rot: -0.55, y0: 0, h: 3.4 });
  addWalkBox(4.75, 7.35, 2.0, 0.8, -0.55, 0.18);
}
/* bell tower */
{
  const g = new THREE.Group(); g.position.set(-8, 0, -2.5);
  [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(([x, z]) => M(GEO.col2, MAT.woodDark, { pos: [x, 2.2, z], scl: 0.8, cast: true, parent: g }));
  M(GEO.roof, MAT.roofDark, { pos: [0, 4.9, 0], scl: [3.4, 1.3, 3.4], cast: true, parent: g });
  M(GEO.bigBell, MAT.gold, { pos: [0, 3.6, 0], cast: true, parent: g });
  M(GEO.box, MAT.ropeM, { pos: [0, 2.4, 0.4], scl: [0.05, 1.6, 0.05], parent: g });
  scene.add(g);
  addCollider({ type: 'box', x: -8, z: -2.5, hw: 1.25, hd: 1.25, rot: 0, y0: 0, h: 4.6 });
}

/* ---------------- build: river, bridges, dock ---------------- */
function buildRiver(pts, w){
  for (let i = 0; i < pts.length - 1; i++){
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const yaw = Math.atan2(bx - ax, bz - az);   // FIX: correct yaw for a +Z-length segment
    M(GEO.waterSeg, MAT.riverM, { pos: [mx, 0.045, mz], rot: [0, yaw, 0], scl: [w, 1, len + 0.3] });  // FIX: length on z
    addCollider({ type: 'seg', ax, az, bx, bz, r: w / 2 - 0.2, y0: 0, h: 0.35 });
  }
}
buildRiver(RIVER_N, 3.4); buildRiver(RIVER_S, 3.2);
function buildBridge(cx, cz){
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  const n = 13, len = 13;
  for (let i = 0; i < n; i++){
    const t = (i + 0.5) / n, top = 1.55 * Math.sin(Math.PI * t) + 0.42;
    const x = -len / 2 + t * len;
    addWalkBox(cx + x, cz, 0.62, 1.25, 0, top);
    M(GEO.box, MAT.plank, { pos: [x, top - 0.06, 0], scl: [1.15, 0.12, 2.4], cast: true, parent: g });
    if (i % 3 === 1){
      M(GEO.post, MAT.woodDark, { pos: [x, top + 0.45, -1.15], scl: 1.9, parent: g });
      M(GEO.post, MAT.woodDark, { pos: [x, top + 0.45, 1.15], scl: 1.9, parent: g });
    }
  }
  M(GEO.rail, MAT.woodDark, { pos: [0, 1.35, -1.15], scl: [len, 1, 1], parent: g });
  M(GEO.rail, MAT.woodDark, { pos: [0, 1.35, 1.15], scl: [len, 1, 1], parent: g });
  scene.add(g);
}
buildBridge(BRIDGE_A.x, BRIDGE_A.z); buildBridge(BRIDGE_B.x, BRIDGE_B.z);
{
  const g = new THREE.Group();
  const len = DOCK.x1 - DOCK.x0, mx = (DOCK.x0 + DOCK.x1) / 2;
  M(GEO.box, MAT.plank, { pos: [mx, DOCK.top - 0.05, DOCK.z], scl: [len, 0.14, 1.7], cast: true, recv: true, parent: g });
  for (let i = 0; i < 3; i++){
    M(GEO.post, MAT.woodDark, { pos: [DOCK.x0 + 0.4 + i * (len - 0.8) / 2, 0.2, DOCK.z - 0.75], scl: 1.4, parent: g });
    M(GEO.post, MAT.woodDark, { pos: [DOCK.x0 + 0.4 + i * (len - 0.8) / 2, 0.2, DOCK.z + 0.75], scl: 1.4, parent: g });
  }
  scene.add(g);
  addWalkBox(mx, DOCK.z, len / 2, 0.85, 0, DOCK.top);
}

/* ---------------- build: bamboo grove + fox shrine ---------------- */
{
  const bamboo = [], leaves = [];
  const inGrovePath = (x, z) => [GROVE_PATH, [[16,-10],[4,-10]]].some(p => { for (let i = 0; i < p.length - 1; i++) if (distSegPt(x, z, p[i][0], p[i][1], p[i+1][0], p[i+1][1]) < 2.2) return true; return false; });
  let guard = 4000;
  while (bamboo.length < 240 && guard-- > 0){
    const x = 30 + rngW() * 40, z = -22 + rngW() * 32;
    if (Math.hypot(x - FOX_SHRINE.x, z - FOX_SHRINE.z) < 5.5) continue;
    if (Math.hypot(x - KITE.x, z - KITE.z) < 3.5) continue;
    if (inGrovePath(x, z)) continue;
    const h = 4.2 + rngW() * 2.6;
    bamboo.push({ x, y: h / 2, z, sy: h, sx: 0.11 + rngW() * 0.05, sz: 0.11 + rngW() * 0.05, ry: rngW() * Math.PI, rx: (rngW() - 0.5) * 0.06, color: pick(BAMBOO_COLS) });
    for (let k = 0; k < 2; k++) leaves.push({ x: x + (rngW() - 0.5) * 0.7, y: h - 0.3 - rngW() * 1.2, z: z + (rngW() - 0.5) * 0.7, s: 0.6 + rngW() * 0.5, ry: rngW() * Math.PI, rz: rngW() * Math.PI, color: pick(BAMBOO_COLS) });
    addCollider({ type: 'cyl', x, z, r: 0.22, y0: 0, h: 4, noCam: true });
  }
  makeInstances(GEO.bamboo, MAT.white, bamboo);
  makeInstances(GEO.leafFan, MAT.white, leaves, false);
  const g = new THREE.Group(); g.position.set(FOX_SHRINE.x, 0, FOX_SHRINE.z);
  for (let i = 0; i < 5; i++){
    const t = i / 4, x = -3.2 + t * 6.4, s = 1 - t * 0.25;
    const tg = new THREE.Group(); tg.position.set(x, 0, -1.2 + t * 2.6); tg.scale.setScalar(s);
    M(GEO.col, MAT.vermilion, { pos: [-0.7, 0.85, 0], scl: 0.75, cast: true, parent: tg });
    M(GEO.col, MAT.vermilion, { pos: [0.7, 0.85, 0], scl: 0.75, cast: true, parent: tg });
    M(GEO.box, MAT.vermilion, { pos: [0, 1.75, 0], scl: [2.1, 0.14, 0.2], parent: tg });
    M(GEO.box, MAT.inkMat, { pos: [0, 1.88, 0], scl: [2.2, 0.08, 0.24], parent: tg });
    g.add(tg);
  }
  M(GEO.box, MAT.wood, { pos: [0, 0.5, 0.4], scl: [0.9, 0.7, 0.7], cast: true, parent: g });
  const fx = new THREE.Group(); fx.position.set(0, 0.75, 1.8);
  M(GEO.box, MAT.gold, { pos: [0, 0.1, 0], scl: [0.45, 0.5, 0.3], cast: true, parent: fx });
  M(GEO.box, MAT.gold, { pos: [0, 0.5, 0.12], scl: [0.32, 0.3, 0.3], parent: fx });
  M(GEO.box, MAT.gold, { pos: [0, 0.42, 0.32], scl: [0.14, 0.12, 0.2], parent: fx });
  M(GEO.box, MAT.gold, { pos: [-0.1, 0.72, 0.08], scl: [0.1, 0.2, 0.05], parent: fx });
  M(GEO.box, MAT.gold, { pos: [0.1, 0.72, 0.08], scl: [0.1, 0.2, 0.05], parent: fx });
  M(GEO.box, MAT.gold, { pos: [0, 0.05, -0.35], scl: [0.16, 0.5, 0.16], rot: [0.7, 0, 0], parent: fx });
  g.add(fx);
  scene.add(g);
  addCollider({ type: 'cyl', x: FOX_SHRINE.x, z: FOX_SHRINE.z + 1.8, r: 0.5, y0: 0, h: 1.3 });
  addCollider({ type: 'box', x: FOX_SHRINE.x, z: FOX_SHRINE.z + 0.4, hw: 0.45, hd: 0.35, rot: 0, y0: 0, h: 0.85 });
}

/* ---------------- build: rice terraces ---------------- */
{
  const rice = [];
  TERR.forEach((t, ti) => {
    const mz = (t.z0 + t.z1) / 2;
    M(GEO.box, MAT.soil, { pos: [0, t.top / 2 - 0.02, mz], scl: [26, t.top, t.z1 - t.z0 + 0.6], cast: true, recv: true });
    addWalkBox(0, mz, 13, (t.z1 - t.z0) / 2 + 0.3, 0, t.top);
    M(GEO.flat, MAT.terraceWater, { pos: [0, t.top + 0.02, mz], scl: [23.5, 1, t.z1 - t.z0 - 1.6] });  // FIX: flat + z-length
    for (let rx = -10.5; rx <= 10.5; rx += 1.1) for (let rz = t.z0 + 1.4; rz <= t.z1 - 1.4; rz += 1.25){
      if (rngW() < 0.18) continue;
      rice.push({ x: rx + (rngW() - 0.5) * 0.5, y: t.top + 0.28, z: rz + (rngW() - 0.5) * 0.5, color: pick(RICE_COLS), rx: (rngW() - 0.5) * 0.25 });
    }
    if (ti === 0) addWalkBox(0, t.z0 - 0.5, 1.6, 0.5, 0, t.top);
  });
  makeInstances(GEO.rice, MAT.white, rice, false);
  const t2 = TERR[1];
  const g = new THREE.Group(); g.position.set(5, t2.top, 44);
  M(GEO.post, MAT.woodDark, { pos: [0, 1.1, 0], scl: 2.4, cast: true, parent: g });
  M(GEO.box, MAT.woodDark, { pos: [0, 1.7, 0], scl: [1.7, 0.1, 0.1], parent: g });
  M(GEO.box, std({ color: 0xa65b4a }), { pos: [0, 1.35, 0], scl: [0.8, 0.7, 0.4], cast: true, parent: g });
  M(GEO.scareHead, std({ color: 0xd9c48e }), { pos: [0, 1.95, 0], cast: true, parent: g });
  M(GEO.hat, std({ color: 0xc9a96a }), { pos: [0, 2.12, 0], scl: 1.2, cast: true, parent: g });
  scene.add(g);
  addCollider({ type: 'cyl', x: 5, z: 44, r: 0.3, y0: t2.top, h: 2.2 });
}

/* ---------------- build: kite rocks + kite ---------------- */
const kiteGroup = new THREE.Group();
{
  KITE.rocks.forEach(([x, z, top]) => {
    rocks.push({ x, y: top * 0.4, z, s: 0.85, sy: top * 0.75, ry: rngW() * Math.PI, color: '#a8766a' });
    addCollider({ type: 'cyl', x, z, r: 0.8, y0: 0, h: top, walk: true, top });
  });
  const k = new THREE.Group(); k.position.set(KITE.x + 0.3, 3.15, KITE.z + 0.3);
  M(GEO.plane, std({ color: 0xc94f43, side: THREE.DoubleSide }), { pos: [0, 0, 0], rot: [0.3, 0.5, 0.78], scl: [0.85, 0.85, 1], cast: true, parent: k });
  M(GEO.box, MAT.woodDark, { pos: [0, 0, 0.01], rot: [0.3, 0.5, 0.78], scl: [1.1, 0.04, 0.04], parent: k });
  M(GEO.box, MAT.woodDark, { pos: [0, 0, 0.01], rot: [0.3, 0.5, 0.78 + Math.PI / 2], scl: [1.1, 0.04, 0.04], parent: k });
  for (let i = 0; i < 3; i++) M(GEO.plane, std({ color: 0xe8d9b0, side: THREE.DoubleSide }), { pos: [-0.15 - i * 0.12, -0.55 - i * 0.3, 0.1 + i * 0.05], rot: [0.4, 0.4, 0.9], scl: [0.18, 0.14, 1], parent: k });
  kiteGroup.add(k); scene.add(kiteGroup);
}

/* ---------------- build: the mountain ---------------- */
const rockslideGroup = new THREE.Group();
let slideColliders = [];
{
  /* FIX: the old giant cone buried all five terraces inside the mountain.
     The terraces themselves are the mountain now; a low skirt cone grounds them. */
  M(GEO.mount, std({ color: 0x8a927e }), { pos: [0, 2, -60], scl: [30, 7, 30] });
  MOUNT.discs.forEach((d, i) => {
    const c = d.c || [MOUNT.cx, MOUNT.cz];
    M(new THREE.CylinderGeometry(d.r, d.r + 1.4, d.top, 26), std({ color: i === 4 ? 0xa39d92 : 0x8f8a7c }), { pos: [c[0], d.top / 2, c[1]], cast: true, recv: true });
    addCollider({ type: 'cyl', x: c[0], z: c[1], r: d.r, y0: 0, h: d.top, walk: true, top: d.top });
  });
  function steps(sx, sz, ex, ez, y0, y1){
    const n = Math.ceil((y1 - y0) / 0.4);
    for (let i = 1; i <= n; i++){
      const top = y0 + (y1 - y0) * (i / n);
      const x = sx + (ex - sx) * (i - 0.5) / n, z = sz + (ez - sz) * (i - 0.5) / n;
      const ry = Math.atan2(-(ez - sz), ex - sx);
      addWalkBox(x, z, 0.85, 0.85, ry, top, y0);
      M(GEO.box, MAT.stone, { pos: [x, (y0 + top) / 2, z], rot: [0, ry, 0], scl: [1.7, top - y0 + 0.08, 1.5], cast: true, recv: true });
    }
  }
  steps(0, -34.6, 0, -36.2, 0, 2.8);
  steps(14, -49, 12.2, -52.9, 2.8, 5.6);
  steps(-13.5, -55, -11.6, -57.5, 5.6, 8.4);
  steps(9, -59.5, 7.5, -62, 8.4, 11.2);
  steps(-7, -60, -4.2, -66.2, 11.2, 14);
  M(GEO.springPool, MAT.springWater, { pos: [HOTSPRING.x, HOTSPRING.y + 0.03, HOTSPRING.z] });
  for (let i = 0; i < 9; i++){
    const a = i / 9 * Math.PI * 2;
    M(GEO.rock, MAT.stoneDark, { pos: [HOTSPRING.x + Math.cos(a) * 2.1, HOTSPRING.y + 0.12, HOTSPRING.z + Math.sin(a) * 2.1], scl: [0.35, 0.28, 0.35], ry: rngW() * Math.PI, cast: true });
  }
  addCollider({ type: 'cyl', x: HOTSPRING.x, z: HOTSPRING.z, r: 1.9, y0: HOTSPRING.y, h: 0.3 });
  const g = new THREE.Group(); g.position.set(SUMMIT_BELL.x, SUMMIT_BELL.y, SUMMIT_BELL.z);
  M(GEO.box, MAT.stone, { pos: [0, 0.08, 0], scl: [3.2, 0.16, 2.2], recv: true, parent: g });
  M(GEO.col2, MAT.vermilion, { pos: [-1.1, 1.4, 0], scl: 0.9, cast: true, parent: g });
  M(GEO.col2, MAT.vermilion, { pos: [1.1, 1.4, 0], scl: 0.9, cast: true, parent: g });
  M(GEO.box, MAT.inkMat, { pos: [0, 2.6, 0], scl: [3.1, 0.22, 0.4], cast: true, parent: g });
  M(GEO.bigBell, MAT.gold, { pos: [0, 2.1, 0], scl: 1.25, cast: true, parent: g });
  M(GEO.box, MAT.ropeM, { pos: [0, 0.9, 0.5], scl: [0.06, 1.8, 0.06], parent: g });
  scene.add(g);
  addCollider({ type: 'cyl', x: SUMMIT_BELL.x, z: SUMMIT_BELL.z, r: 0.7, y0: SUMMIT_BELL.y, h: 2.6 });
  const rg = rockslideGroup; rg.position.set(ROCKSLIDE.x, 0, ROCKSLIDE.z);
  for (let i = 0; i < 7; i++){
    const x = -2.6 + rngW() * 5.2, z = -1 + rngW() * 2;
    M(GEO.rock, MAT.stoneDark, { pos: [x, 0.5 + rngW() * 0.5, z], scl: [0.9 + rngW() * 0.7, 0.8 + rngW() * 0.5, 0.9 + rngW() * 0.7], ry: rngW() * Math.PI, cast: true, parent: rg });
  }
  scene.add(rg);
  slideColliders = [
    addCollider({ type: 'seg', ax: -3.4, az: ROCKSLIDE.z, bx: 3.4, bz: ROCKSLIDE.z, r: 1.1, y0: 0, h: 2.2 }),
    addCollider({ type: 'seg', ax: -3.0, az: ROCKSLIDE.z - 1, bx: 3.0, bz: ROCKSLIDE.z - 1, r: 0.9, y0: 0, h: 1.8 }),
  ];
}
/* great sakura (blooms at the finale) */
const GS = { data: [], mesh: null };
{
  M(GEO.bigTrunk, std({ color: 0x6f4b39 }), { pos: [GREAT_SAKURA.x, GREAT_SAKURA.y + 3, GREAT_SAKURA.z], scl: [1, 6, 1], cast: true });  // FIX: was 1m tall
  addCollider({ type: 'cyl', x: GREAT_SAKURA.x, z: GREAT_SAKURA.z, r: 1.0, y0: GREAT_SAKURA.y, h: 6 });
  const rng = mulberry32(313);
  for (let i = 0; i < 12; i++){
    const a = i / 12 * Math.PI * 2, rr = 1.4 + rng() * 2.6;
    GS.data.push({ x: GREAT_SAKURA.x + Math.cos(a) * rr, y: GREAT_SAKURA.y + 5.6 + rng() * 2.2, z: GREAT_SAKURA.z + Math.sin(a) * rr, s: 1.7 + rng() * 1.3, ry: rng() * Math.PI });
  }
  GS.data.push({ x: GREAT_SAKURA.x, y: GREAT_SAKURA.y + 8.4, z: GREAT_SAKURA.z, s: 2.4, ry: 0 });
  GS.mesh = makeInstances(GEO.blob, MAT.white, GS.data.map(d => ({ ...d, color: '#d8b4b8' })));
}
function setSakuraBloom(on){
  const c = new THREE.Color(), src = on ? BLOOM_PINKS : DIM_PINKS;
  GS.data.forEach((d, i) => GS.mesh.setColorAt(i, c.set(src[i % src.length])));
  GS.mesh.instanceColor.needsUpdate = true;
}
/* final scatter instances */
makeInstances(GEO.patch, MAT.white, patches, false);
makeInstances(GEO.disc, MAT.white, discs, false);
makeInstances(GEO.tuft, MAT.white, tufts, false);
makeInstances(GEO.blossom, MAT.white, blossoms, false);
makeInstances(GEO.trunk, MAT.white, trunks);
makeInstances(GEO.blob, MAT.white, canopies);
makeInstances(GEO.rock, MAT.white, rocks);
makeInstances(GEO.post, MAT.white, posts, false);
makeInstances(GEO.rail, MAT.white, rails, false);

/* ---------------- sky / stars / lights ---------------- */
const SKY = {
  geo: new THREE.SphereGeometry(380, 24, 12),
  mat: new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#5f9ede') }, uBot: { value: new THREE.Color('#d8ecf4') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff4dd') },
      uGlow: { value: 0.3 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uGlow;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uBot, uTop, pow(h, 0.62));
        float s = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
        col += uSunCol * (pow(s, 180.0) * 1.1 + pow(s, 7.0) * 0.22) * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
};
const skyMesh = new THREE.Mesh(SKY.geo, SKY.mat); skyMesh.frustumCulled = false; skyMesh.renderOrder = -1;
scene.add(skyMesh);
const STARS = (() => {
  const r = mulberry32(4242), pos = [];
  for (let i = 0; i < 420; i++){
    const a = r() * Math.PI * 2, y = 0.06 + r() * 0.94, rr = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * rr * 330, y * 330, Math.sin(a) * rr * 330);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
})();
scene.add(STARS);
const LANTERN_LIGHTS = [[-3.2, 2.2, 0.6], [3.2, 2.2, 0.6], [0, 2.5, -18], [-2.2, 2.0, -27.5], [2.2, 2.0, -27.5], [FOX_SHRINE.x, 1.6, FOX_SHRINE.z - 1]].map(p => {
  const l = new THREE.PointLight(0xffb45e, 0, 15, 2); l.position.set(p[0], p[1], p[2]); scene.add(l); return l;
});

/* ---------------- day/night keyframes ---------------- */
const SKY_STOPS = [
  { t: 0.00, top: '#0a102c', bot: '#1e2650', sun: '#aebbff', sunI: 0.0,  hemiS: '#2b3560', hemiG: '#151d30', hemiI: 0.42, fog: '#141b38', glow: 0.0 },
  { t: 0.21, top: '#101840', bot: '#33325e', sun: '#ff9d7a', sunI: 0.0,  hemiS: '#3a3f6c', hemiG: '#20263c', hemiI: 0.45, fog: '#232a4e', glow: 0.15 },
  { t: 0.27, top: '#3d4d8a', bot: '#ef9d84', sun: '#ff9d6b', sunI: 1.25, hemiS: '#8f86ac', hemiG: '#58505c', hemiI: 0.6,  fog: '#c78f8c', glow: 1.0 },
  { t: 0.34, top: '#6ea3dd', bot: '#ffd9b3', sun: '#ffdca8', sunI: 2.1,  hemiS: '#a8c6e2', hemiG: '#6f805f', hemiI: 0.8,  fog: '#e4ccae', glow: 0.5 },
  { t: 0.50, top: '#5f9ede', bot: '#d8ecf4', sun: '#fff4dd', sunI: 2.7,  hemiS: '#bedaeb', hemiG: '#748a62', hemiI: 0.9,  fog: '#dcebe8', glow: 0.28 },
  { t: 0.66, top: '#6395d2', bot: '#ffe2bd', sun: '#ffe3b0', sunI: 2.1,  hemiS: '#b2c8e0', hemiG: '#70825f', hemiI: 0.8,  fog: '#e6cfae', glow: 0.45 },
  { t: 0.73, top: '#57537f', bot: '#ff9c7d', sun: '#ff8f5e', sunI: 1.3,  hemiS: '#92809f', hemiG: '#5f574f', hemiI: 0.6,  fog: '#d89a88', glow: 1.0 },
  { t: 0.79, top: '#20264e', bot: '#74506f', sun: '#e07a5f', sunI: 0.18, hemiS: '#4b4f7c', hemiG: '#2e2e46', hemiI: 0.5,  fog: '#4f4766', glow: 0.3 },
  { t: 0.85, top: '#0d1234', bot: '#262e5a', sun: '#aebbff', sunI: 0.0,  hemiS: '#2e3862', hemiG: '#172032', hemiI: 0.44, fog: '#181f3c', glow: 0.05 },
  { t: 1.00, top: '#0a102c', bot: '#1e2650', sun: '#aebbff', sunI: 0.0,  hemiS: '#2b3560', hemiG: '#151d30', hemiI: 0.42, fog: '#141b38', glow: 0.0 },
];
SKY_STOPS.forEach(s => ['top', 'bot', 'sun', 'hemiS', 'hemiG', 'fog'].forEach(k => (s[k] = new THREE.Color(s[k]))));
const SKY_SAMPLE = { top: new THREE.Color(), bot: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), sunI: 0, hemiI: 0, glow: 0 };
const BLOOM_PINK = new THREE.Color('#ffd9e4'), BLOOM_WARM = new THREE.Color('#f2c9c2');
function sampleSky(t){
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < SKY_STOPS.length - 2 && t > SKY_STOPS[i + 1].t) i++;
  const a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
  let u = THREE.MathUtils.clamp((t - a.t) / Math.max(1e-5, b.t - a.t), 0, 1);
  u = u * u * (3 - 2 * u);
  SKY_SAMPLE.top.lerpColors(a.top, b.top, u);
  SKY_SAMPLE.bot.lerpColors(a.bot, b.bot, u);
  SKY_SAMPLE.sun.lerpColors(a.sun, b.sun, u);
  SKY_SAMPLE.fog.lerpColors(a.fog, b.fog, u);
  SKY_SAMPLE.hemiS.lerpColors(a.hemiS, b.hemiS, u);
  SKY_SAMPLE.hemiG.lerpColors(a.hemiG, b.hemiG, u);
  SKY_SAMPLE.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, u);
  SKY_SAMPLE.hemiI = THREE.MathUtils.lerp(a.hemiI, b.hemiI, u);
  SKY_SAMPLE.glow = THREE.MathUtils.lerp(a.glow, b.glow, u);
  if (store.get().stage >= 4){ SKY_SAMPLE.bot.lerp(BLOOM_PINK, 0.22); SKY_SAMPLE.fog.lerp(BLOOM_WARM, 0.15); }
  return SKY_SAMPLE;
}

/* ---------------- petals / rain / steam ---------------- */
const petalsData = (() => {
  const rand = mulberry32(777), petals = [], burst = [], storm = [];
  for (let i = 0; i < 260; i++){
    petals.push({
      x: SPAWN.x + (rand() - 0.5) * 30, y: rand() * 12, z: SPAWN.z + (rand() - 0.5) * 30,
      fall: 0.55 + rand() * 0.7, sway: 0.5 + rand() * 1.4, seed: rand() * 10,
      rx: rand() * Math.PI, ry: rand() * Math.PI, rz: rand() * Math.PI,
      rsx: (rand() - 0.5) * 3, rsy: (rand() - 0.5) * 3, rsz: (rand() - 0.5) * 3,
      color: PETAL_COLORS[(rand() * PETAL_COLORS.length) | 0],
      orbR: 1.1 + rand() * 1.3, orbS: 0.35 + rand() * 0.5, seedA: rand() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 70; i++){ const a = rand() * Math.PI * 2; burst.push({ dx: Math.cos(a), dz: Math.sin(a), spd: 1.2 + rand() * 2.6, up: 0.35 + rand() * 0.75, rs: (rand() - 0.5) * 10 }); }
  for (let i = 0; i < 160; i++){ const a = rand() * Math.PI * 2, r = rand() * 13; storm.push({ dx: Math.cos(a) * r, dz: Math.sin(a) * r, y: rand() * 16, fall: 2.2 + rand() * 2, rx: rand() * 7, rs: (rand() - 0.5) * 6 }); }
  return { petals, burst, storm };
})();
const petalsScr = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), wind: 0, zeroed: false };
const ambPetals = new THREE.InstancedMesh(GEO.petal, MAT.petal, 260);
const burstPetals = new THREE.InstancedMesh(GEO.petal, MAT.burst, 70);
const stormPetals = new THREE.InstancedMesh(GEO.petal, MAT.burst, 160);
[ambPetals, burstPetals, stormPetals].forEach(m => { m.frustumCulled = false; scene.add(m); });
{
  const c = new THREE.Color();
  petalsData.petals.forEach((pt, i) => ambPetals.setColorAt(i, c.set(pt.color)));
  for (let i = 0; i < 70; i++) burstPetals.setColorAt(i, c.set('#ffd6e3'));
  for (let i = 0; i < 160; i++) stormPetals.setColorAt(i, c.set(pickWith(mulberry32(5), PETAL_COLORS)));
  [ambPetals, burstPetals, stormPetals].forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
}
function zeroInstances(mesh, n){
  const m = new THREE.Matrix4().makeScale(0, 0, 0); m.setPosition(0, -30, 0);
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
}
zeroInstances(burstPetals, 70); zeroInstances(stormPetals, 160);
function shiftPetalColors(){
  const c = new THREE.Color(), cur = new THREE.Color(), tgt = new THREE.Color('#ffd7e6');
  petalsData.petals.forEach((pt, i) => { ambPetals.getColorAt(i, cur); c.copy(cur).lerp(tgt, 0.4); ambPetals.setColorAt(i, c); });
  ambPetals.instanceColor.needsUpdate = true;
}
const rainData = (() => { const r = mulberry32(88), a = []; for (let i = 0; i < 220; i++) a.push({ x: (r() - 0.5) * 34, z: (r() - 0.5) * 34, y: r() * 15, spd: 14 + r() * 6 }); return a; })();
const rainMesh = new THREE.InstancedMesh(GEO.streak, MAT.rainM, 220);
rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
/* FIX: steam puffs share look but each gets its own material so they drift independently */
const steamMeshes = [];
for (let i = 0; i < 12; i++){
  const m = new THREE.Mesh(GEO.steam, MAT.steam.clone());
  m.position.set(HOTSPRING.x + (Math.random() - 0.5) * 2.6, 0, HOTSPRING.z + (Math.random() - 0.5) * 2.6);
  m.userData = { t: Math.random() }; scene.add(m); steamMeshes.push(m);
}

/* ---------------- exports ---------------- */
Object.assign(SV, {
  THREE, store, G, SAVE_KEY, isNight,
  mulberry32, pickWith, shortAngle, clamp01, distSegPt,
  SPAWN, POND, PLAZA, LANTERNS, CHARMS, HOUSE_DEFS, TREE_DEFS, ROCK_DEFS, FENCE_DEFS,
  RIVER_N, RIVER_S, BRIDGE_A, BRIDGE_B, GROVE_PATH, SOUTH_ROAD, MOUNT_TRAIL,
  FOX_SHRINE, KITE, TERR, MOUNT, HOTSPRING, SUMMIT_BELL, GREAT_SAKURA, ROCKSLIDE,
  NPCS, CAT_SPOTS, DOCK, FISH_SPOT, RACE_CPS, FOX_WP, FIREFLY_POS, FISH_SPECIES,
  SIGIL_NAMES, SIGIL_KANJI, CHAPTERS,
  renderer, scene, camera, sun, hemi, FOG, SKY, STARS, LANTERN_LIGHTS,
  GEO, MAT, M, makeInstances,
  addCollider, addWalkBox, gridQuery, COLLIDERS,
  sampleSky, setSakuraBloom, zeroInstances, shiftPetalColors,
  petalsData, petalsScr, ambPetals, burstPetals, stormPetals,
  rainData, rainMesh, steamMeshes,
  rockslideGroup, slideColliders, kiteGroup,
  WORLD_CENTER: { x: 15, z: -12 }, WORLD_R: 80,
});
})();