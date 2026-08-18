/* ============================================================
   il dado e' trap - scena 3D
   Fasi: load -> intro (le ante si aprono) -> browse -> focus
   (la scatola esce) -> review (il coperchio si alza, si apre il
   pannello). Il ciclo di rendering non si ferma mai.
   ============================================================ */
(function(){
'use strict';

/* --- misure dell'armadio, in unita' da 10 cm ------------------ */
const CAB = {
  w: 11.4,        // larghezza esterna
  h: 13.2,        // altezza del mobile sopra lo zoccolo
  d: 4.2,         // profondita'
  t: 0.36,        // spessore dei pannelli
  plinth: 0.9,    // zoccolo
  bays: 3         // numero di vani
};
CAB.y0    = CAB.plinth;               // quota del fondo interno
CAB.inX   = CAB.w/2 - CAB.t;          // mezza larghezza interna
CAB.inY   = CAB.h - CAB.t*2;          // altezza interna totale
CAB.bayH  = (CAB.inY - CAB.t*(CAB.bays-1)) / CAB.bays;
CAB.front = CAB.d/2;

// quota del piano d'appoggio del vano i (0 = quello in basso)
function bayFloor(i){ return CAB.y0 + CAB.t + i*(CAB.bayH + CAB.t); }

/* --- scatole -------------------------------------------------- */
const BOX = { w: 3.0, h: 3.0, t: 0.82, lid: 0.54 };

const DOOR_MAX = 1.42;   // ~81 gradi: aperte ma senza coprire i ripiani

/* --- stato ---------------------------------------------------- */
const state = {
  phase: 'load',
  hover: null,
  focused: null,
  doors: 0,
  bayLight: 0,
  focusLight: 0,
  px: 0, py: 0,        // puntatore filtrato, da -1 a 1
  tx: 0, ty: 0,        // puntatore grezzo
  dist: 26,            // distanza della camera in navigazione
  side: true           // vero quando il pannello si apre di lato (schermo largo)
};

const FOV = 38;
const UP = new THREE.Vector3(0,1,0);
const LOOK = new THREE.Vector3(0, 7.3, 0);
const camBase = new THREE.Vector3(0, 7.6, 26);

let renderer, scene, camera, raycaster, pointer;
let doorL, doorR, bayLights = [], focusLight, boxes = [];

/* --- animazioni ------------------------------------------------
   Mini motore di tween: una lista di funzioni che ricevono
   l'avanzamento da 0 a 1. Nessuna libreria.
   --------------------------------------------------------------- */
const anims = [];
function tween(dur, fn, done, delay){
  const a = { t: -(delay || 0), dur: dur, fn: fn, done: done };
  anims.push(a);
  return a;
}
function stepAnims(dt){
  for (let i = anims.length - 1; i >= 0; i--){
    const a = anims[i];
    a.t += dt;
    if (a.t < 0) continue;
    const p = Math.min(1, a.t / a.dur);
    a.fn(p);
    if (p >= 1){ anims.splice(i,1); if (a.done) a.done(); }
  }
}
const easeOut   = p => 1 - Math.pow(1-p, 3);
const easeInOut = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
const lerp      = (a,b,t) => a + (b-a)*t;

/* --- utilita' -------------------------------------------------- */
const q = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));

function setProg(p, msg){
  const bar = q('#bar'); if (bar) bar.style.width = Math.round(p*100) + '%';
  if (msg) q('#load-msg').textContent = msg;
}

/* ===============================================================
   COSTRUZIONE DELLA SCENA
   =============================================================== */

function makeWoodMat(o){
  o = o || {};
  const c = ART.wood(o);
  const map = ART.toTex(c, { repeat: o.repeat, rot: o.rot });
  const bump = ART.toTex(c, { repeat: o.repeat, rot: o.rot });
  return new THREE.MeshStandardMaterial({
    map: map, bumpMap: bump, bumpScale: o.bump === undefined ? .035 : o.bump,
    roughness: o.rough === undefined ? .74 : o.rough, metalness: .04,
    color: o.tint || 0xffffff
  });
}

function slab(w, h, d, mat, x, y, z){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function buildRoom(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100d0b);
  scene.fog = new THREE.Fog(0x100d0b, 34, 88);

  // pavimento: assi larghe, molto scure
  const floorMat = makeWoodMat({
    base:'#33200f', dark:'#170d06', light:'#4d301a',
    lines: 200, knots: 2, repeat:[9,9], rough:.62, bump:.02
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140,140), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  scene.add(floor);

  // parete di fondo, intonaco caldo
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 70),
    new THREE.MeshStandardMaterial({ color: 0x35261c, roughness: .96, metalness: 0 })
  );
  // quasi a contatto con lo schienale: se la parete e' staccata, l'ombra
  // dell'armadio ci si stampa sopra come una lastra nera
  wall.position.set(0, 28, -2.35);
  wall.receiveShadow = true;
  scene.add(wall);

  /* --- luci ---
     Una lampada calda da sinistra fa la luce principale e le ombre,
     un rimbalzo da destra riempie, e un filo di luce fredda da dietro
     stacca l'armadio dalla parete. */
  scene.add(new THREE.AmbientLight(0xffdcb4, .34));

  // quasi frontale: piu' la si sposta di lato, piu' l'ombra dell'armadio
  // si allunga sulla parete e diventa una lastra nera
  const key = new THREE.SpotLight(0xffd7a3, 2.1, 96, .82, .62, 1.1);
  key.position.set(-6, 20, 25);
  key.target.position.set(0, 7, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const fill = new THREE.PointLight(0xffa869, .55, 46, 1.4);
  fill.position.set(14, 5.5, 15);
  scene.add(fill);

  // lavaggio della parete: non proietta ombre, quindi schiarisce proprio
  // dentro l'ombra dell'armadio e le toglie il bordo netto
  const wash = new THREE.DirectionalLight(0xffb87a, .2);
  wash.position.set(9, 10, 22);
  scene.add(wash);

  const rim = new THREE.DirectionalLight(0x8fb0cc, .12);
  rim.position.set(16, 14, -8);
  scene.add(rim);

  // luce che segue la scatola quando esce dall'armadio
  focusLight = new THREE.PointLight(0xffd9a8, 0, 24, 1.6);
  scene.add(focusLight);
}

function buildCabinet(){
  const front = makeWoodMat({ base:'#5a3620', dark:'#2b1a10', light:'#8b5730', lines:170, knots:3 });
  const vert  = makeWoodMat({ base:'#54321e', dark:'#28170e', light:'#84512c', lines:170, knots:2, rot: Math.PI/2 });
  const inner = makeWoodMat({ base:'#4a2d1a', dark:'#25150c', light:'#75482a', lines:150, knots:1, rough:.86 });
  const dim   = makeWoodMat({ base:'#3c2415', dark:'#1c1009', light:'#5c3820', lines:140, knots:1, rough:.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9973f, roughness: .32, metalness: .92 });

  const g = new THREE.Group();
  const H = CAB.h, W = CAB.w, D = CAB.d, T = CAB.t, y0 = CAB.y0;

  // zoccolo e cornice
  g.add(slab(W, CAB.plinth, D - .3, dim, 0, CAB.plinth/2, -.15));
  g.add(slab(W + .7, .42, D + .5, front, 0, y0 + H + .21, .1));

  // fianchi, cielo, fondo
  g.add(slab(T, H, D, vert, -W/2 + T/2, y0 + H/2, 0));
  g.add(slab(T, H, D, vert,  W/2 - T/2, y0 + H/2, 0));
  g.add(slab(W - T*2, T, D, front, 0, y0 + H - T/2, 0));
  g.add(slab(W - T*2, T, D, front, 0, y0 + T/2, 0));

  // schienale, arretrato di poco
  g.add(slab(W - T*2, H - T*2, .16, dim, 0, y0 + H/2, -D/2 + .12));

  // ripiani: due, quindi tre vani
  for (let i = 1; i < CAB.bays; i++){
    const y = bayFloor(i) - T/2;
    g.add(slab(W - T*2, T, D - .55, inner, 0, y, -.2));
  }

  // luce dentro ogni vano: alta e avanti, cosi' striscia sulle copertine
  // invece di fare una macchia sul ripiano di sopra
  for (let i = 0; i < CAB.bays; i++){
    const l = new THREE.PointLight(0xffcb92, 0, 9.5, 1.8);
    l.position.set(0, bayFloor(i) + CAB.bayH * .74, 1.2);
    bayLights.push(l);
    g.add(l);
  }

  /* --- ante ---
     Ogni anta e' un gruppo con il perno sul bordo esterno: il pannello
     e' spostato di meta' larghezza, cosi' ruotare il gruppo la fa girare
     sul cardine e non sul centro. */
  const dw = W/2, dh = H - .12, dz = CAB.front + .13;

  function door(sign){
    const grp = new THREE.Group();
    grp.position.set(sign * W/2, y0 + H/2, dz);

    const leaf = slab(dw, dh, .26, front, sign * -dw/2, 0, 0);
    grp.add(leaf);
    // pannello ribassato, come le ante vere
    const inset = slab(dw - 1.3, dh - 1.3, .10, dim, sign * -dw/2, 0, .17);
    grp.add(inset);

    // pomello di ottone vicino al bordo interno
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 14), brass);
    knob.position.set(sign * -dw + sign * .55, 0, .38);
    knob.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.24,10), brass);
    stem.rotation.x = Math.PI/2;
    stem.position.set(knob.position.x, 0, .24);
    grp.add(knob, stem);

    // cardini
    for (let i = -1; i <= 1; i += 2){
      const h = new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.5,8), brass);
      h.position.set(0, i * dh*.34, -.05);
      grp.add(h);
    }
    return grp;
  }

  doorL = door(-1); doorR = door(1);
  g.add(doorL, doorR);

  scene.add(g);
}

/* --- una scatola di gioco -------------------------------------- */
function makeGameBox(game){
  const grp = new THREE.Group();

  const coverCanvas = game.art === 'root' ? ART.coverRoot() : ART.coverScythe();
  const coverTex = ART.toTex(coverCanvas);
  const cover = new THREE.MeshStandardMaterial({
    map: coverTex, emissiveMap: coverTex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: .58, metalness: .02
  });
  const sideV = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, true)),  roughness: .64 });
  const sideH = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, false)), roughness: .64 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: .95 });
  const card  = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.cardboard('#a5855c'), {repeat:[2,2]}), roughness: .92 });
  const inMat = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.inside()), roughness: .88 });

  // coperchio: la meta' davanti, con la copertina sulla faccia +Z
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(BOX.w, BOX.h, BOX.lid),
    [sideV, sideV, sideH, sideH, cover, dark]
  );
  lid.position.z = BOX.t/2 - BOX.lid/2;
  lid.castShadow = true; lid.receiveShadow = true;

  // fondo: un filo piu' piccolo, cosi' il coperchio ci calza sopra
  const baseD = BOX.t - BOX.lid;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BOX.w*.97, BOX.h*.97, baseD),
    [card, card, card, card, inMat, card]
  );
  base.position.z = BOX.t/2 - BOX.lid - baseD/2;
  base.castShadow = true; base.receiveShadow = true;

  grp.add(lid, base);
  grp.userData = {
    game: game, lid: lid, cover: cover,
    hover: 0, busy: false,
    homePos: new THREE.Vector3(), homeRot: new THREE.Euler()
  };
  return grp;
}

/* --- oggetti di contorno --------------------------------------- */
function thinSpine(seed){
  const S = 128, cx = ART.cnv(S, S*3), c = cx[0], x = cx[1];
  const cols = ['#7b4a2e','#4d5a48','#6a3a3a','#3f4a5c','#6d5a2e','#57406a'];
  const col = cols[seed % cols.length];
  x.fillStyle = col; x.fillRect(0,0,S,S*3);
  const g = x.createLinearGradient(0,0,S,0);
  g.addColorStop(0,'rgba(255,255,255,.14)'); g.addColorStop(1,'rgba(0,0,0,.3)');
  x.fillStyle = g; x.fillRect(0,0,S,S*3);
  x.fillStyle = 'rgba(240,225,190,.75)';
  x.fillRect(18, S*0.6, S-36, 10);
  x.fillRect(18, S*0.8, (S-36)*.6, 6);
  x.fillStyle = 'rgba(0,0,0,.3)';
  x.fillRect(0, S*2.2, S, 14);
  ART.grain(x, S, S*3, 12);
  return new THREE.MeshStandardMaterial({ map: ART.toTex(c), roughness: .78 });
}

function meepleShape(){
  const s = new THREE.Shape();
  s.moveTo(-0.50,-0.90);
  s.lineTo(-0.34,-0.05);
  s.lineTo(-0.95, 0.12);
  s.lineTo(-0.95, 0.42);
  s.lineTo(-0.40, 0.36);
  s.lineTo(-0.42, 0.72);
  s.absarc(0, 0.78, 0.42, Math.PI, 0, true);   // la testa
  s.lineTo( 0.40, 0.36);
  s.lineTo( 0.95, 0.42);
  s.lineTo( 0.95, 0.12);
  s.lineTo( 0.34,-0.05);
  s.lineTo( 0.50,-0.90);
  s.closePath();
  return s;
}

function makeMeeple(col){
  const geo = new THREE.ExtrudeGeometry(meepleShape(), {
    depth: .34, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2
  });
  geo.center();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: .58 }));
  m.scale.setScalar(.42);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function buildContents(){
  // i due giochi, sul ripiano di mezzo
  const midY = bayFloor(1);
  const slotX = [-1.65, 1.65];
  for (let i = 0; i < GAMES.length; i++){
    const game = GAMES[i];
    const b = makeGameBox(game);
    b.position.set(slotX[game.slot % slotX.length], midY + BOX.h/2, .35);
    b.rotation.y = (i === 0 ? .02 : -.03);
    b.userData.homePos.copy(b.position);
    b.userData.homeRot.copy(b.rotation);
    scene.add(b);
    boxes.push(b);
  }

  // ai lati dei due giochi, qualcosa che faccia da spalla:
  // una pila bassa a sinistra, tre dorsi a destra
  for (let i = 0; i < 2; i++){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, .5, 2.4),
      new THREE.MeshStandardMaterial({ map: ART.toTex(ART.coverGeneric(i+1)), roughness: .7 })
    );
    m.position.set(-4.25, midY + .25 + i*.5, .1);
    m.rotation.y = .04 - i*.09;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  for (let i = 0; i < 3; i++){
    const w = .46 + Math.random()*.16, h = 2.3 + Math.random()*.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.7), thinSpine(i+3));
    m.position.set(3.7 + i*.72, midY + h/2, .1);
    m.rotation.y = (Math.random()-.5)*.06;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  // scatole di contorno: dorsi in fila sul ripiano basso
  const lowY = bayFloor(0);
  for (let i = 0; i < 7; i++){
    const w = .42 + Math.random()*.22, h = 2.5 + Math.random()*.7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3.1), thinSpine(i));
    m.position.set(-4.6 + i*.78 + Math.random()*.06, lowY + h/2, .1);
    m.rotation.y = (Math.random()-.5)*.05;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  // e due scatole coricate, a fare da fermalibri
  for (let i = 0; i < 2; i++){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, .62, 2.8),
      new THREE.MeshStandardMaterial({ map: ART.toTex(ART.coverGeneric(i+2)), roughness: .7 })
    );
    m.position.set(3.5, lowY + .31 + i*.62, .1);
    m.rotation.y = .06 - i*.12;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  // ripiano alto: dadi, un d20, due meeple e una pila di scatole
  const topY = bayFloor(2);
  const diceCols = [['#efe3cb','#2a1a0f'], ['#c1552c','#f6e6c8'], ['#3f4f63','#f6e6c8']];
  for (let i = 0; i < 3; i++){
    const s = .58;
    const d = new THREE.Mesh(new THREE.BoxGeometry(s,s,s), ART.dieMaterials(diceCols[i][0], diceCols[i][1]));
    d.position.set(-4.4 + i*.85, topY + s/2, .5 + (i%2)*.5);
    d.rotation.y = Math.random()*Math.PI;
    d.castShadow = true; d.receiveShadow = true;
    scene.add(d);
  }
  const d20 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(.62, 0),
    new THREE.MeshStandardMaterial({ color: 0xc9973f, roughness: .34, metalness: .8, flatShading: true })
  );
  d20.position.set(-2.1, topY + .52, .6);
  d20.rotation.set(.4, .8, .2);
  d20.castShadow = true; d20.receiveShadow = true;
  scene.add(d20);

  const mA = makeMeeple(0xd8552c), mB = makeMeeple(0xe8c05f);
  mA.position.set(-.7, topY + .45, .7);
  mB.position.set(-.1, topY + .42, 1.0); mB.rotation.y = -.5; mB.scale.setScalar(.36);
  scene.add(mA, mB);

  for (let i = 0; i < 3; i++){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, .58, 2.9),
      new THREE.MeshStandardMaterial({ map: ART.toTex(ART.coverGeneric(i)), roughness: .7 })
    );
    m.position.set(3.3, topY + .29 + i*.58, .2);
    m.rotation.y = (Math.random()-.5)*.14;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
}

/* ===============================================================
   INQUADRATURA
   La distanza della camera si ricava dall'ingombro dell'armadio:
   su schermo stretto si allontana da sola invece di tagliare i lati.
   =============================================================== */
function layout(){
  const w = window.innerWidth, h = window.innerHeight;
  if (w < 2 || h < 2) return;                       // il pannello di anteprima a volte da' 0
  const aspect = w / h;
  // stessa soglia del CSS: sopra gli 880 px il pannello sta di lato
  state.side = w >= 880;

  // L'inquadratura si misura sul fronte del mobile, non sul suo centro:
  // e' quello il piano che deve entrare nello schermo.
  // Su schermo verticale i margini si stringono: le ante aperte escono
  // dai lati, ma il mobile riempie il quadro invece di restare un
  // francobollo in mezzo al buio.
  const half = THREE.MathUtils.degToRad(FOV) / 2;
  const tall = aspect < .8;
  const needW = (CAB.w + (tall ? 1.4 : 5.0)) / 2;
  const needH = (CAB.h + CAB.plinth + (tall ? 2.0 : 3.6)) / 2;
  state.dist = CAB.front +
    Math.max(needH / Math.tan(half), needW / (Math.tan(half) * aspect));

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);

  if (state.phase === 'browse' || state.phase === 'load'){
    camBase.set(0, 7.6, state.dist);
  }
}

// Dove va la scatola quando esce dall'armadio: un punto davanti alla
// camera, calcolato in modo che occupi sempre la stessa fetta di
// schermo, a sinistra se c'e' spazio per il pannello, in alto se no.
function focusPose(){
  // Quanta parte dello schermo puo' prendersi la scatola, e dove sta il
  // suo centro: a sinistra se il pannello e' di lato, in alto se il
  // pannello sale dal basso. Le frazioni ricalcano il CSS.
  // Con il pannello di lato la scatola prende la meta' sinistra; con il
  // pannello che sale dal basso le resta solo la fascia in alto.
  const fw   = state.side ? .48 : .74;
  const fh   = state.side ? .64 : .28;
  const offX = state.side ? -.21 : 0;
  const offY = state.side ? -.05 : .27;
  const scale = 1.1;

  const half = THREE.MathUtils.degToRad(FOV) / 2, tan = Math.tan(half);
  const camPos = new THREE.Vector3(0, 7.6, state.dist * .86);

  // La distanza soddisfa il vincolo piu' stretto fra altezza e larghezza.
  // L'ingombro non e' quello della scatola chiusa: il coperchio si alza e
  // viene avanti, quindi occupa piu' spazio di quanto misuri.
  const fitW = BOX.w * scale * 1.24;
  const fitH = BOX.h * scale * 1.34;
  const d = Math.max(
    fitH / (2 * fh * tan),
    fitW / (2 * fw * tan * camera.aspect)
  );

  const dir = LOOK.clone().sub(camPos).normalize();
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const vh = 2 * d * tan, vw = vh * camera.aspect;

  const pos = camPos.clone()
    .addScaledVector(dir, d)
    .addScaledVector(right, offX * vw)
    .addScaledVector(up, offY * vh);

  return { pos: pos, rot: new THREE.Euler(-.05, .34, .02), scale: scale, cam: camPos };
}

/* ===============================================================
   INTERAZIONE
   =============================================================== */

function intro(){
  state.phase = 'intro';
  const from = new THREE.Vector3(0, 5.6, state.dist * 1.5);
  const to   = new THREE.Vector3(0, 7.6, state.dist);

  tween(2.7, function(p){ camBase.lerpVectors(from, to, easeInOut(p)); },
        function(){ state.phase = 'browse'; document.body.classList.add('browse'); });
  tween(2.1, function(p){ state.doors = easeOut(p) * DOOR_MAX; }, null, .5);
  tween(1.7, function(p){ state.bayLight = p; }, null, 1.0);
}

function focusOn(box){
  if (state.phase !== 'browse') return;
  state.phase = 'focus';
  state.focused = box;
  state.hover = null;
  document.body.classList.remove('browse');

  const u = box.userData;
  u.busy = true;
  const p0 = box.position.clone();
  const r0 = { x: box.rotation.x, y: box.rotation.y, z: box.rotation.z };
  const target = focusPose();
  const cam0 = camBase.clone();

  tween(.95, function(p){
    const e = easeInOut(p);
    box.position.lerpVectors(p0, target.pos, e);
    box.position.z += Math.sin(Math.PI * p) * 1.4;      // prima esce, poi viene avanti
    box.rotation.set(
      lerp(r0.x, target.rot.x, e),
      lerp(r0.y, target.rot.y, e),
      lerp(r0.z, target.rot.z, e)
    );
    box.scale.setScalar(lerp(1, target.scale, e));
    camBase.lerpVectors(cam0, target.cam, e);
    state.focusLight = e;
    state.bayLight = 1 - e * .55;
  }, openLid);
}

function openLid(){
  const box = state.focused;
  if (!box) return;
  const lid = box.userData.lid;
  const z0 = BOX.t/2 - BOX.lid/2;

  // Il coperchio si alza piu' che avvicinarsi: venendo verso la camera
  // ingrandirebbe di brutto e uscirebbe dal quadro.
  tween(.6, function(p){
    const e = easeOut(p);
    lid.position.z = z0 + e * .95;
    lid.position.y = e * 1.05;
    lid.position.x = -e * .30;
    lid.rotation.x = -e * .30;
    lid.rotation.z =  e * .15;
  }, function(){
    state.phase = 'review';
    showPanel(box.userData.game);
  });
}

function unfocus(){
  if (state.phase !== 'focus' && state.phase !== 'review') return;
  const box = state.focused;
  state.phase = 'closing';
  hidePanel();

  const lid = box.userData.lid;
  const l0 = { z: lid.position.z, y: lid.position.y, x: lid.position.x,
               rx: lid.rotation.x, rz: lid.rotation.z };
  const z0 = BOX.t/2 - BOX.lid/2;

  tween(.42, function(p){
    const e = easeInOut(p);
    lid.position.z = lerp(l0.z, z0, e);
    lid.position.y = lerp(l0.y, 0, e);
    lid.position.x = lerp(l0.x, 0, e);
    lid.rotation.x = lerp(l0.rx, 0, e);
    lid.rotation.z = lerp(l0.rz, 0, e);
  }, function(){
    const u = box.userData;
    const p0 = box.position.clone();
    const r0 = { x: box.rotation.x, y: box.rotation.y, z: box.rotation.z };
    const s0 = box.scale.x;
    const cam0 = camBase.clone();
    const camTo = new THREE.Vector3(0, 7.6, state.dist);

    tween(.85, function(p){
      const e = easeInOut(p);
      box.position.lerpVectors(p0, u.homePos, e);
      box.position.z += Math.sin(Math.PI * p) * .9;
      box.rotation.set(
        lerp(r0.x, u.homeRot.x, e),
        lerp(r0.y, u.homeRot.y, e),
        lerp(r0.z, u.homeRot.z, e)
      );
      box.scale.setScalar(lerp(s0, 1, e));
      camBase.lerpVectors(cam0, camTo, e);
      state.focusLight = 1 - e;
      state.bayLight = .45 + e * .55;
    }, function(){
      u.busy = false;
      state.focused = null;
      state.phase = 'browse';
      document.body.classList.add('browse');
    });
  }, .12);
}

/* --- pannello -------------------------------------------------- */
function showPanel(game){
  q('#p-title').textContent = game.title;
  q('#p-by').innerHTML = '<b>' + game.designer + '</b> &middot; ' + game.publisher + ' &middot; ' + game.year;

  const specs = [
    [game.players, 'giocatori'], [game.time, 'minuti'],
    [game.age, 'eta'], [game.weight, 'peso bgg']
  ];
  q('#p-specs').innerHTML = specs.map(function(s){
    return '<li><b>' + s[0] + '</b><span>' + s[1] + '</span></li>';
  }).join('');

  q('#p-score').textContent = game.score;
  q('#p-body').innerHTML = game.review.map(function(t){ return '<p>' + t + '</p>'; }).join('');
  q('#p-tags').innerHTML = game.tags.map(function(t){ return '<span>' + t + '</span>'; }).join('');
  const link = q('#p-bgg');
  link.href = 'https://boardgamegeek.com/boardgame/' + game.bgg + '/';

  const panel = q('#panel');
  panel.setAttribute('aria-hidden', 'false');
  panel.scrollTop = 0;
  document.body.classList.add('review');
}

function hidePanel(){
  document.body.classList.remove('review');
  q('#panel').setAttribute('aria-hidden', 'true');
}

/* --- puntatore -------------------------------------------------- */
function bindInput(){
  const el = renderer.domElement;
  let downAt = 0, downX = 0, downY = 0;

  function norm(e){
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  el.addEventListener('pointermove', function(e){
    norm(e);
    pointer.set(state.tx, state.ty);
  });

  el.addEventListener('pointerdown', function(e){
    downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    norm(e); pointer.set(state.tx, state.ty);
  });

  el.addEventListener('pointerup', function(e){
    const dt = performance.now() - downAt;
    const dx = Math.abs(e.clientX - downX), dy = Math.abs(e.clientY - downY);
    if (dt > 600 || dx > 9 || dy > 9) return;        // era un trascinamento

    if (state.phase === 'browse'){
      const hit = pick();
      if (hit) focusOn(hit);
    } else if (state.phase === 'review' || state.phase === 'focus'){
      unfocus();                                     // un tap fuori richiude
    }
  });

  el.addEventListener('pointerleave', function(){
    state.tx = 0; state.ty = 0; state.hover = null;
  });

  q('#close').addEventListener('click', function(e){ e.stopPropagation(); unfocus(); });
  q('#panel').addEventListener('pointerup', function(e){ e.stopPropagation(); });

  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape') unfocus();
  });

  let rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt); rt = setTimeout(layout, 120);
  });
}

function pick(){
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boxes, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.game) o = o.parent;
  return o || null;
}

/* ===============================================================
   CICLO DI RENDERING
   =============================================================== */
function updateBoxes(dt){
  for (let i = 0; i < boxes.length; i++){
    const b = boxes[i], u = b.userData;
    if (u.busy){ u.cover.emissiveIntensity = .10; continue; }

    const want = (state.hover === b && state.phase === 'browse') ? 1 : 0;
    u.hover += (want - u.hover) * Math.min(1, dt * 9);

    b.position.set(u.homePos.x, u.homePos.y + u.hover * .10, u.homePos.z + u.hover * .5);
    b.rotation.y = u.homeRot.y + u.hover * .07;
    u.cover.emissiveIntensity = u.hover * .30;
  }
}

let last = 0;
function frame(now){
  requestAnimationFrame(frame);
  const dt = last ? Math.min(.05, (now - last) / 1000) : .016;
  last = now;

  stepAnims(dt);

  // il puntatore muove la camera di pochissimo: basta a dare volume
  const damp = Math.min(1, dt * 5);
  state.px += (state.tx - state.px) * damp;
  state.py += (state.ty - state.py) * damp;
  const sway = state.phase === 'review' ? .3 : 1;
  camera.position.set(
    camBase.x + state.px * 1.6 * sway,
    camBase.y + state.py * .9 * sway,
    camBase.z
  );
  camera.lookAt(LOOK);

  doorL.rotation.y = -state.doors;
  doorR.rotation.y =  state.doors;
  for (let i = 0; i < bayLights.length; i++) bayLights[i].intensity = state.bayLight * .62;

  if (state.focused){
    focusLight.position.copy(state.focused.position).add(new THREE.Vector3(1.2, 2.2, 3.4));
    focusLight.intensity = state.focusLight * 2.2;
  } else {
    focusLight.intensity = state.focusLight * 2.2;
  }

  if (state.phase === 'browse'){
    const hit = pick();
    if (hit !== state.hover){
      state.hover = hit;
      document.body.style.cursor = hit ? 'pointer' : '';
    }
  } else if (document.body.style.cursor && state.phase !== 'browse'){
    document.body.style.cursor = '';
  }

  updateBoxes(dt);
  renderer.render(scene, camera);
}

/* ===============================================================
   AVVIO
   =============================================================== */
function fallbackFlat(){
  document.body.classList.add('no3d', 'ready');
}

function buildFlatList(){
  const html = GAMES.map(function(g){
    return '<article>' +
      '<h2>' + g.title + '</h2>' +
      '<p class="byline"><b>' + g.designer + '</b> &middot; ' + g.publisher + ' &middot; ' + g.year +
      ' &middot; ' + g.players + ' giocatori &middot; ' + g.time + ' min</p>' +
      g.review.map(function(t){ return '<p>' + t + '</p>'; }).join('') +
      '<p><a class="bgg" href="https://boardgamegeek.com/boardgame/' + g.bgg + '/" target="_blank" rel="noopener">scheda su BoardGameGeek &#8599;</a></p>' +
      '</article>';
  }).join('');
  q('#flat-list').innerHTML = html;
}

async function boot(){
  const t0 = performance.now();
  buildFlatList();

  if (typeof THREE === 'undefined'){ fallbackFlat(); return; }

  // I font servono gia' al primo disegno: i titoli delle copertine
  // sono testo su canvas, e senza Bebas escono con il ripiego.
  setProg(.15, 'preparo i caratteri');
  try { await document.fonts.ready; } catch(e){}

  try {
    camera = new THREE.PerspectiveCamera(FOV, 16/9, .1, 260);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch(e){
    fallbackFlat(); return;
  }
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  q('#scene').appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2(0, 0);

  // Un passo per volta, con una pausa in mezzo: la barra si muove
  // davvero. setTimeout e non requestAnimationFrame, perche' a pagina
  // nascosta i frame non arrivano affatto e il caricamento resterebbe li'.
  await wait(20); setProg(.34, 'monto la stanza');
  buildRoom();
  await wait(20); setProg(.55, 'monto le mensole');
  buildCabinet();
  await wait(20); setProg(.78, 'carico le scatole');
  buildContents();
  await wait(20); setProg(.94, 'accendo la lampada');

  layout();
  bindInput();
  requestAnimationFrame(frame);
  setProg(1, 'ci siamo');

  await wait(Math.max(0, 1500 - (performance.now() - t0)));
  document.body.classList.add('ready');
  intro();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
