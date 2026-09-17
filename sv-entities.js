/* ============================================================
   SAKURA VILLAGE · 2/5 — characters & creatures
   Villagers, the player rig + lantern, fox, cat, crows,
   charms, fireflies, race flags, fishing props.
   ============================================================ */
(() => {
'use strict';
const THREE = window.THREE;
const { GEO, MAT, M, NPCS, CHARMS, FIREFLY_POS, RACE_CPS, CAT_SPOTS, addCollider, scene, G } = SV;

/* ---------------- collectible charms ---------------- */
const charmOuters = [], charmFloats = [];
CHARMS.forEach((c) => {
  const outer = new THREE.Group(); outer.position.set(c.x, 0, c.z);
  const float = new THREE.Group(); float.position.set(0, 1.05, 0);
  M(GEO.blob, MAT.charmCore, { scl: 0.09, parent: float });
  for (let k = 0; k < 5; k++){
    const a = k * Math.PI * 2 / 5;
    M(GEO.sphere, MAT.charmPetal, { pos: [Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14], rot: [0, Math.PI / 2 - a, 0], scl: [0.08, 0.032, 0.16], parent: float });
  }
  M(GEO.charmRing, MAT.charmRingM, { pos: [0, 0.08, 0], parent: outer });
  outer.add(float); scene.add(outer);
  charmOuters.push(outer); charmFloats.push(float);
});

/* ---------------- fireflies ---------------- */
FIREFLY_POS.forEach((p, i) => {
  const g = new THREE.Group(); g.position.set(p[0], 1.2, p[1]); g.visible = false;
  M(GEO.sphere, MAT.firefly, { scl: 0.05, parent: g });
  M(GEO.sphere, MAT.glow, { scl: 0.17, parent: g });
  scene.add(g);
  G.fireflies.push({ grp: g, x: p[0], z: p[1], caught: false, seed: i * 2.3 });
});

/* ---------------- fishing props ---------------- */
const bobber = new THREE.Group(); bobber.position.set(11.5, 0.1, 8.4); bobber.visible = false;
M(GEO.sphere, MAT.bobber, { scl: 0.07, parent: bobber }); scene.add(bobber);
const splashRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 20), MAT.splash);
splashRing.rotation.x = -Math.PI / 2; splashRing.visible = false; scene.add(splashRing);

/* ---------------- race flags ---------------- */
const raceFlags = [];
RACE_CPS.forEach(([x, z], i) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.visible = false;
  M(GEO.flagPole, MAT.woodDark, { pos: [0, 1.05, 0], cast: true, parent: g });
  M(GEO.plane, MAT.raceFlag, { pos: [0.32, 1.85, 0], scl: [0.55, 0.35, 1], parent: g });
  const ring = M(GEO.charmRing, MAT.charmRingM, { pos: [0, 0.06, 0], parent: g });
  ring.scale.set(3.4, 3.4, 1);
  ring.visible = false;
  scene.add(g); raceFlags.push({ grp: g, ring });
});

/* ---------------- cat (Yuzu) ---------------- */
function makeCat(){
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);   // FIX: inner group so the cat faces +Z like everyone else
  body.rotation.y = -Math.PI / 2;
  M(GEO.box, MAT.catBody, { pos: [0, 0.16, 0], scl: [0.42, 0.2, 0.2], cast: true, parent: body });
  M(GEO.sphere, MAT.catBody, { pos: [0.2, 0.26, 0], scl: 0.12, cast: true, parent: body });
  M(GEO.box, MAT.catPatch, { pos: [0.24, 0.33, 0], scl: [0.1, 0.08, 0.08], parent: body });
  M(GEO.box, MAT.catBody, { pos: [0.16, 0.37, -0.06], scl: [0.05, 0.08, 0.04], parent: body });
  M(GEO.box, MAT.catBody, { pos: [0.16, 0.37, 0.06], scl: [0.05, 0.08, 0.04], parent: body });
  const tail = M(GEO.box, MAT.catPatch, { pos: [-0.24, 0.22, 0], scl: [0.22, 0.05, 0.05], parent: body });
  return { group: g, tail };
}
const catSpots = CAT_SPOTS.map(p => { const c = makeCat(); c.group.position.set(p.x, p.y, p.z); c.group.rotation.y = Math.random() * Math.PI * 2; scene.add(c.group); return c; });
const catPet = makeCat(); catPet.group.visible = false; scene.add(catPet.group);

/* ---------------- fox spirit ---------------- */
function makeFox(){
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);   // FIX: inner group so the fox faces +Z
  body.rotation.y = -Math.PI / 2;
  M(GEO.box, MAT.foxWhite, { pos: [0, 0.34, 0], scl: [0.72, 0.28, 0.3], cast: true, parent: body });
  M(GEO.box, MAT.foxWhite, { pos: [0.4, 0.5, 0], scl: [0.26, 0.22, 0.24], cast: true, parent: body });
  M(GEO.box, MAT.foxWhite, { pos: [0.55, 0.46, 0], scl: [0.16, 0.1, 0.12], parent: body });
  M(GEO.box, MAT.foxWhite, { pos: [0.32, 0.66, -0.08], scl: [0.07, 0.16, 0.05], parent: body });
  M(GEO.box, MAT.foxWhite, { pos: [0.32, 0.66, 0.08], scl: [0.07, 0.16, 0.05], parent: body });
  [[0.24, -0.1], [0.24, 0.1], [-0.24, -0.1], [-0.24, 0.1]].forEach(([x, z]) => M(GEO.box, MAT.foxWhite, { pos: [x, 0.12, z], scl: [0.09, 0.24, 0.09], parent: body }));
  const tail = M(GEO.box, MAT.foxWhite, { pos: [-0.48, 0.44, 0], scl: [0.5, 0.18, 0.18], cast: true, parent: body });
  M(GEO.box, MAT.foxRed, { pos: [-0.7, 0.44, 0], scl: [0.12, 0.16, 0.16], parent: body });
  return { group: g, tail };
}
const fox = makeFox(); fox.group.visible = false; scene.add(fox.group);

/* ---------------- crows ---------------- */
function makeCrow(){
  const g = new THREE.Group();
  M(GEO.sphere, MAT.crowBody, { pos: [0, 0.18, 0], scl: [0.13, 0.11, 0.2], cast: true, parent: g });
  M(GEO.sphere, MAT.crowBody, { pos: [0, 0.28, 0.12], scl: 0.075, parent: g });
  M(GEO.box, MAT.beak, { pos: [0, 0.27, 0.22], scl: [0.05, 0.04, 0.1], parent: g });
  M(GEO.box, MAT.crowBody, { pos: [0, 0.2, -0.2], scl: [0.12, 0.03, 0.16], parent: g });
  const wl = M(GEO.plane, MAT.crowWing, { pos: [-0.12, 0.22, 0], rot: [0, Math.PI / 2, 0], scl: [0.26, 0.12, 1], parent: g });
  const wr = M(GEO.plane, MAT.crowWing, { pos: [0.12, 0.22, 0], rot: [0, Math.PI / 2, 0], scl: [0.26, 0.12, 1], parent: g });
  return { group: g, wl, wr };
}

/* ---------------- villagers ---------------- */
function makeVillager({ hat, kimono, obi, hair, skin = 0xf0c8a4, bun }){
  const g = new THREE.Group();
  const mm = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
  const mSkin = mm(skin), mKim = mm(kimono), mObi = mm(obi), mHair = mm(hair), mDark = mm(0x3a2f28);
  const box = (w, h, d, mat, x, y, z, parent) => {
    const b = new THREE.Mesh(GEO.box, mat);
    b.scale.set(w, h, d); b.position.set(x, y, z); b.castShadow = true;
    (parent || g).add(b); return b;
  };
  const legL = new THREE.Group(); legL.position.set(0.095, 0.46, 0); g.add(legL);
  box(0.13, 0.44, 0.14, mDark, 0, -0.22, 0, legL);
  const legR = new THREE.Group(); legR.position.set(-0.095, 0.46, 0); g.add(legR);
  box(0.13, 0.44, 0.14, mDark, 0, -0.22, 0, legR);
  const body = new THREE.Group(); body.position.y = 0.46; g.add(body);
  box(0.42, 0.5, 0.26, mKim, 0, 0.25, 0, body);
  box(0.44, 0.11, 0.28, mObi, 0, 0.17, 0, body);
  const armL = new THREE.Group(); armL.position.set(-0.27, 0.44, 0); body.add(armL);
  box(0.11, 0.38, 0.12, mKim, 0, -0.16, 0, armL);
  const armR = new THREE.Group(); armR.position.set(0.27, 0.44, 0); body.add(armR);
  box(0.11, 0.38, 0.12, mKim, 0, -0.16, 0, armR);
  const head = new THREE.Group(); head.position.y = 0.62; body.add(head);
  const hm = new THREE.Mesh(GEO.sphere, mSkin); hm.scale.setScalar(0.165); hm.position.y = 0.12; hm.castShadow = true; head.add(hm);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), mHair);
  hairCap.scale.setScalar(0.175); hairCap.position.set(0, 0.135, -0.012); head.add(hairCap);
  [-0.055, 0.055].forEach(ex => { const eye = new THREE.Mesh(GEO.sphere, mDark); eye.scale.setScalar(0.02); eye.position.set(ex, 0.115, 0.16); head.add(eye); });
  if (bun){ const b = new THREE.Mesh(GEO.sphere, mHair); b.scale.setScalar(0.075); b.position.set(0, 0.3, -0.03); head.add(b); }
  if (hat){ const h = new THREE.Mesh(GEO.hat, mm(0xd9b36c)); h.position.y = 0.3; h.castShadow = true; head.add(h); }
  return { group: g, legL, legR, armL, armR, body, head };
}
const V = {
  hana:   { rig: makeVillager({ hat: false, kimono: 0xc96f80, obi: 0x4a4a5c, hair: 0x33262b, bun: true }), def: NPCS.hana },
  genji:  { rig: makeVillager({ hat: false, kimono: 0x6b5a44, obi: 0x3a3228, hair: 0xb9b3a8 }), def: NPCS.genji },
  kenta:  { rig: makeVillager({ hat: true, kimono: 0x5f8f5a, obi: 0x4a4a5c, hair: 0x2c2630 }), def: NPCS.kenta, scale: 0.62 },
  aki:    { rig: makeVillager({ hat: true, kimono: 0x7a8f4f, obi: 0x8a5a3c, hair: 0x4a3826 }), def: NPCS.aki },
  mizuki: { rig: makeVillager({ hat: false, kimono: 0x4f6b8f, obi: 0xb54a55, hair: 0x26202a, bun: true }), def: NPCS.mizuki },
};
Object.values(V).forEach(v => {
  v.grp = new THREE.Group(); v.grp.add(v.rig.group);
  if (v.scale) v.grp.scale.setScalar(v.scale);
  scene.add(v.grp);
  addCollider({ type: 'cyl', x: v.def.x, z: v.def.z, r: 0.42, y0: v.def.y, h: 1.5 });
});

/* ---------------- player + lantern ---------------- */
const playerRig = makeVillager({ hat: true, kimono: 0x41597a, obi: 0xb54a55, hair: 0x2c2630 });
const playerGrp = new THREE.Group(); playerGrp.add(playerRig.group); scene.add(playerGrp);
const lanternProp = new THREE.Group();
M(GEO.box, MAT.woodDark, { pos: [0, -0.16, 0], scl: [0.14, 0.2, 0.14], parent: lanternProp });
M(GEO.box, MAT.lanternGlow, { pos: [0, -0.02, 0], scl: [0.11, 0.13, 0.11], parent: lanternProp });
M(GEO.box, MAT.roofDark, { pos: [0, 0.07, 0], scl: [0.15, 0.04, 0.15], parent: lanternProp });
lanternProp.position.set(0, -0.34, 0.06);
playerRig.armL.add(lanternProp);
lanternProp.visible = false;
const lanternLight = new THREE.PointLight(0xffb45e, 0, 11, 1.6);
lanternLight.position.set(0.4, 1.3, 0.3);
playerGrp.add(lanternLight);

SV.ent = { V, playerRig, playerGrp, lanternProp, lanternLight, charmOuters, charmFloats, bobber, splashRing, raceFlags, catSpots, catPet, fox, makeCrow };
})();