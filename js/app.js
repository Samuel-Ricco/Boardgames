/* ============================================================
   il dado e' trap - scena 3D

   Fasi: load -> intro (la camera si avvicina) -> browse (una fila
   di cubi per schermata, si scorre) -> focus (la scatola esce) ->
   review (il coperchio si alza e si apre il pannello). Il ciclo di
   rendering non si ferma mai.

   Il mobile e' una libreria a cubi: niente ante, una scatola per
   cubo. Non ha un'altezza fissa -- le file si contano dai giochi in
   collezione e la camera scorre da una all'altra. Aggiungere giochi
   la fa crescere verso il basso.
   ============================================================ */
(function(){
'use strict';

/* --- misure, in unita' da 10 cm ------------------------------- */
/* Una KALLAX vera: cubo da 33 cm, montanti spessi, 39 di profondita'.
   Il cubo da 33 e la scatola da 30 e' il motivo per cui mezzo mondo
   ci tiene i giochi da tavolo: ci entra esatta. */
const KAL = {
  cell: 3.3,      // luce interna del cubo
  t: 0.38,        // spessore di montanti e ripiani
  d: 3.9          // profondita'
};
KAL.front = KAL.d / 2;
KAL.passo = KAL.cell + KAL.t;             // da un cubo al successivo

const BOX = { w: 3.0, h: 3.0, t: 0.84, lid: 0.55 };

/* UNA LIBRERIA E' SEMPRE LA STESSA: tre colonne per quattro file,
   dodici cubi, dodici giochi. Non cambia col formato dello schermo e
   non si allunga con la collezione -- e' un mobile vero, e un mobile
   vero non cresce.

   Quando i dodici posti finiscono si mette accanto un'altra libreria
   identica, e ci si arriva scorrendo in orizzontale. La collezione
   cresce lungo la parete invece che verso il basso, e ogni schermata
   inquadra un mobile intero: niente file tagliate a meta', nessun
   numero di colonne che cambia sotto le mani a chi gira il telefono.

   Tre colonne su schermo verticale hanno un prezzo, ed e' scelto: il
   mobile e' piu' alto che largo (11.4 x 15.1), quindi per far stare la
   larghezza su un telefono la camera arretra e sopra e sotto avanza
   stanza. Meglio quella che una griglia che si riconfigura da sola. */
const COLS = 3;                            // colonne di cubi
const RIGHE = 4;                           // file di cubi
const PER_LIB = COLS * RIGHE;              // dodici giochi per libreria

/* Lo stacco fra un mobile e il successivo. Attaccate sembrerebbero un
   unico mobile lungo e lo scorrimento non si leggerebbe: e' l'aria in
   mezzo a dire "questa e' un'altra libreria". */
const STACCO = 2.6;

const grigliaH = r => r * KAL.cell + (r + 1) * KAL.t;
const grigliaW = c => c * KAL.cell + (c + 1) * KAL.t;

const LIB_W = grigliaW(COLS);              // 11.42: la larghezza di un mobile
const LIB_H = grigliaH(RIGHE);             // 15.10: la sua altezza
const PASSO_LIB = LIB_W + STACCO;          // da una libreria alla successiva

/* La libreria resta ancorata in alto come prima -- il cielo della
   prima fila a quota fissa -- ma ora che le file sono quattro e basta
   non si muove piu' niente: il pavimento sta a zero e ci resta. Con
   questo se n'e' andato tutto il codice che faceva scendere stanza e
   mobile insieme mentre la collezione si allungava. */
KAL.topY = RIGHE * KAL.passo + KAL.t;
const SUOLO = KAL.topY - LIB_H;            // zero, per costruzione
const CENTRO_Y = (KAL.topY + SUOLO) / 2;   // la mezzeria del mobile

// riga 0 = quella in cima; cresce verso il basso
const rigaY = r => KAL.topY - KAL.t - KAL.cell/2 - r * KAL.passo;
// il centro della libreria numero `l`: la prima e' a zero
const libX  = l => l * PASSO_LIB;
// colonna 0 = quella a sinistra, dentro la libreria `l`
const cubX  = (l, c) => libX(l) - LIB_W/2 + KAL.t + KAL.cell/2 + c * KAL.passo;

/* --- stato ---------------------------------------------------- */
const state = {
  phase: 'load',
  mode: 'utente',
  sort: 'aggiunta',
  hover: null,
  focused: null,
  bayLight: 0,
  focusLight: 0,
  px: 0, py: 0, tx: 0, ty: 0,
  libs: 1,                     // quante librerie in fila lungo la parete
  scroll: 0, scrollTo: 0,      // 0 = la prima libreria; si scorre in orizzontale
  dragging: false,
  distShelf: 26, distFar: 42,
  side: true                   // il pannello si apre di lato (schermo largo)
};

const FOV = 38;
const UP = new THREE.Vector3(0, 1, 0);
const camBase = new THREE.Vector3(0, 8, 26);

let renderer, scene, camera, raycaster, pointer;
let cabGroup, propGroup, bayLights = [], focusLight, keyLight;
let floorMesh, wallMesh;
let boxes = [];
let MATS = null;

/* --- animazioni ------------------------------------------------ */
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
const clamp     = (v,a,b) => v < a ? a : (v > b ? b : v);

/* --- utilita' -------------------------------------------------- */
const q  = s => document.querySelector(s);
const qa = s => Array.prototype.slice.call(document.querySelectorAll(s));
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// rumore ripetibile: gli oggetti di contorno devono restare dove sono
// fra un riordino e l'altro, non saltare a ogni ricostruzione
function srnd(n){
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function setProg(p, msg){
  const bar = q('#bar'); if (bar) bar.style.width = Math.round(p*100) + '%';
  if (msg) q('#load-msg').textContent = msg;
}

function killGroup(g, deep){
  if (!g) return;
  g.traverse(function(o){
    if (o.geometry) o.geometry.dispose();
    if (deep && o.material){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function(m){
        ['map','bumpMap','emissiveMap'].forEach(function(k){ if (m[k]) m[k].dispose(); });
        m.dispose();
      });
    }
  });
  if (g.parent) g.parent.remove(g);
}

/* ===============================================================
   COSTRUZIONE DELLA SCENA
   =============================================================== */

function makeWoodMat(o){
  o = o || {};
  const c = ART.wood(o);
  return new THREE.MeshStandardMaterial({
    map: ART.toTex(c, { repeat: o.repeat, rot: o.rot }),
    bumpMap: ART.toTex(c, { repeat: o.repeat, rot: o.rot }),
    bumpScale: o.bump === undefined ? .035 : o.bump,
    roughness: o.rough === undefined ? .74 : o.rough, metalness: .04
  });
}

/* Rovere chiaro, quello delle KALLAX: venatura tenue e poco contrasto,
   se no a questa luminosita' il legno sembra finto invecchiato.
   `orizz` e' per i ripiani, con la venatura girata di 90 gradi: e' cosi'
   che si vede sul mobile vero, e senza si nota che e' tutta uguale. */
function makeMats(){
  MATS = {
    vert: makeWoodMat({ base:'#c9b085', dark:'#9c7f52', light:'#e8d8b6',
                        lines:220, knots:2, rough:.70, bump:.05, rot: Math.PI/2 }),
    orizz: makeWoodMat({ base:'#cdb489', dark:'#a08356', light:'#ebdcba',
                         lines:220, knots:2, rough:.70, bump:.05 }),
    fondo: makeWoodMat({ base:'#bda283', dark:'#94795a', light:'#d8c5a4',
                         lines:160, knots:1, rough:.86, bump:.02 })
  };
}

function slab(w, h, d, mat, x, y, z){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* Stanza chiara, luce diffusa da finestra. Il grosso lo fa l'ambiente e
   non una lampada: una libreria aperta in una stanza luminosa non ha
   ombre nette da nessuna parte, e cercare il faretto d'atmosfera qui
   farebbe solo sporcare i cubi di macchie. */
const SFONDO = 0xe6ddd0;

function buildRoom(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SFONDO);
  scene.fog = new THREE.Fog(SFONDO, 40, 120);

  /* Pavimento e parete sono larghi 1 e vengono stirati da stanzaLarga()
     fino a coprire tutta la fila di librerie. La quota invece e' fissa:
     il mobile non si allunga piu' verso il basso, quindi la stanza non
     ha piu' bisogno di scendere con lui. */
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 240), makeWoodMat({
    base:'#cbbba4', dark:'#a8967c', light:'#e3d7c3',
    lines: 180, knots: 1, repeat:[1,13], rough:.72, bump:.012
  }));
  floorMesh.rotation.x = -Math.PI/2;
  floorMesh.position.y = SUOLO;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // parete quasi a contatto con lo schienale: staccata, l'ombra del
  // mobile ci si stampa sopra come una lastra
  wallMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 400),
    new THREE.MeshStandardMaterial({ color: 0xe9e2d7, roughness: .98, metalness: 0 })
  );
  wallMesh.position.set(0, CENTRO_Y, -KAL.d/2 - .06);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);

  // il cielo chiaro sopra e il rimbalzo caldo del pavimento sotto:
  // e' quello che fa sembrare la stanza illuminata da una finestra
  scene.add(new THREE.HemisphereLight(0xf7f2e8, 0xcbb89a, .52));
  scene.add(new THREE.AmbientLight(0xfff6e8, .20));

  // luce di finestra: larga, morbida, quasi frontale. Di lato
  // allungherebbe l'ombra della libreria sulla parete.
  const key = keyLight = new THREE.DirectionalLight(0xfff4e2, .95);
  key.position.set(-9, 22, 26);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  // riempimento da destra, senza ombre: schiarisce dentro i cubi
  const fill = new THREE.DirectionalLight(0xffeedd, .22);
  fill.position.set(16, 8, 18);
  scene.add(fill);

  focusLight = new THREE.PointLight(0xfff1dd, 0, 26, 1.6);
  scene.add(focusLight);

  /* Una luce per fila, appena davanti al bordo dei cubi: serve poco --
     la stanza e' gia' chiara -- ma e' quello che fa risaltare le
     copertine dentro al cubo, dove la luce di finestra non arriva mai
     del tutto. Sono quattro e SEGUONO LA CAMERA invece di essercene un
     gruppo per ogni libreria: le librerie possono diventare tante, e
     accenderle tutte vorrebbe dire pagare luci che nessuno vede. */
  for (let r = 0; r < RIGHE; r++){
    const l = new THREE.PointLight(0xfff0da, 0, 8, 1.9);
    l.position.set(0, rigaY(r) + KAL.cell * .34, KAL.front + .5);
    bayLights.push(l);
    scene.add(l);
  }
}

/* La stanza si allunga con le librerie: se pavimento e parete finissero
   prima dell'ultimo mobile si vedrebbe il bordo del mondo. La
   ripetizione della venatura segue la scala, se no il legno si stira. */
function stanzaLarga(libs){
  const corsa = (libs - 1) * PASSO_LIB;      // da centro a centro, primo-ultimo
  const L = Math.max(240, corsa + LIB_W + 160);
  floorMesh.scale.x = L; floorMesh.position.x = corsa / 2;
  wallMesh.scale.x  = L; wallMesh.position.x  = corsa / 2;
  [floorMesh.material.map, floorMesh.material.bumpMap].forEach(function(t){
    if (t) t.repeat.x = L / 18.5;
  });
}

/* --- la libreria a cubi, alta quanto servono le file ------------
   Niente cassa e niente ante: montanti passanti dall'alto in basso e
   ripiani passanti da parte a parte, come si vede sulla KALLAX vera.
   Costruirla come una griglia di scatole separate darebbe gli stessi
   pixel ma con quattro volte i triangoli e le giunzioni visibili. */
function buildCabinet(){
  killGroup(cabGroup, false);

  const W = LIB_W, H = LIB_H, T = KAL.t, D = KAL.d;
  const cima = KAL.topY, fondo = SUOLO;
  const g = new THREE.Group();

  // tante librerie identiche quante ne servono, in fila lungo la parete
  for (let l = 0; l < state.libs; l++){
    const ox = libX(l);

    // montanti: due esterni e uno per ogni divisione interna
    for (let c = 0; c <= COLS; c++){
      g.add(slab(T, H, D, MATS.vert, ox - W/2 + T/2 + c * KAL.passo, fondo + H/2, 0));
    }

    // ripiani: cielo, fondo e uno per ogni divisione
    for (let r = 0; r <= RIGHE; r++){
      g.add(slab(W - T*2, T, D, MATS.orizz, ox, cima - T/2 - r * KAL.passo, 0));
    }

    // schienale sottile e arretrato: senza, i cubi si aprono sulla
    // parete e le scatole perdono il loro sfondo
    g.add(slab(W - T*2, H - T*2, .10, MATS.fondo, ox, fondo + H/2, -D/2 + .07));
  }

  stanzaLarga(state.libs);
  cabGroup = g;
  scene.add(g);
}

/* --- una scatola di gioco -------------------------------------- */
function makeGameBox(game){
  const grp = new THREE.Group();

  let coverTex, aspect;
  if (game.img && game.img.naturalWidth && game.img.naturalHeight){
    coverTex = ART.imgTex(game.img);
    aspect = game.img.naturalWidth / game.img.naturalHeight;
  } else {
    const c = game.art === 'root'   ? ART.coverRoot()
            : game.art === 'scythe' ? ART.coverScythe()
            : ART.coverTitolo(game);
    coverTex = ART.toTex(c);
    aspect = c.width / c.height;
  }
  const H = BOX.w / aspect;

  const cover = new THREE.MeshStandardMaterial({
    map: coverTex, emissiveMap: coverTex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: .58, metalness: .02
  });
  const sideV = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, true)),  roughness: .64 });
  const sideH = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, false)), roughness: .64 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: .95 });
  const card  = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.cardboard('#a5855c'), {repeat:[2,2]}), roughness: .92 });
  const inMat = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.inside()), roughness: .88 });

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(BOX.w, H, BOX.lid),
    [sideV, sideV, sideH, sideH, cover, dark]
  );
  lid.position.z = BOX.t/2 - BOX.lid/2;
  lid.castShadow = true; lid.receiveShadow = true;

  const baseD = BOX.t - BOX.lid;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BOX.w*.97, H*.97, baseD),
    [card, card, card, card, inMat, card]
  );
  base.position.z = BOX.t/2 - BOX.lid - baseD/2;
  base.castShadow = true; base.receiveShadow = true;

  grp.add(lid, base);
  grp.userData = {
    game: game, id: game.id, lid: lid, cover: cover, h: H,
    hover: 0, busy: false,
    homePos: new THREE.Vector3(), homeRot: new THREE.Euler()
  };
  return grp;
}

/* --- oggetti di contorno --------------------------------------- */
function thinSpine(seed){
  const S = 128, cx = ART.cnv(S, S*3), c = cx[0], x = cx[1];
  const cols = ['#7b4a2e','#4d5a48','#6a3a3a','#3f4a5c','#6d5a2e','#57406a'];
  const col = cols[Math.floor(srnd(seed)*cols.length) % cols.length];
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
  s.lineTo(-0.34,-0.05); s.lineTo(-0.95, 0.12); s.lineTo(-0.95, 0.42);
  s.lineTo(-0.40, 0.36); s.lineTo(-0.42, 0.72);
  s.absarc(0, 0.78, 0.42, Math.PI, 0, true);
  s.lineTo( 0.40, 0.36); s.lineTo( 0.95, 0.42); s.lineTo( 0.95, 0.12);
  s.lineTo( 0.34,-0.05); s.lineTo( 0.50,-0.90);
  s.closePath();
  return s;
}
function makeMeeple(col, s){
  const geo = new THREE.ExtrudeGeometry(meepleShape(), {
    depth: .34, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2
  });
  geo.center();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: .58 }));
  m.scale.setScalar(s || .42);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Riempie i posti vuoti: uno scaffale spoglio sembra un errore, non
// un armadio che aspetta altri giochi.
function buildProps(used){
  killGroup(propGroup, true);
  const g = new THREE.Group();

  for (let l = 0; l < state.libs; l++){
    for (let k = 0; k < PER_LIB; k++){
      const posto = l * PER_LIB + k;
      if (used.has(posto)) continue;
      const seed = posto * 17 + 3;
      const r = srnd(seed);
      if (r < .34) continue;                       // qualche posto resta vuoto
      const x = cubX(l, k % COLS);
      const y = rigaY(Math.floor(k / COLS)) - KAL.cell/2;   // il piano del cubo

      if (r < .58){                                // pila di scatole coricate
        const n = 2 + Math.floor(srnd(seed+1)*2);
        for (let i = 0; i < n; i++){
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, .52, 2.5),
            new THREE.MeshStandardMaterial({
              map: ART.toTex(ART.coverGeneric(Math.floor(srnd(seed+i*3)*5))), roughness: .7
            })
          );
          m.position.set(x + (srnd(seed+i)-.5)*.24, y + .26 + i*.52, -.1);
          m.rotation.y = (srnd(seed+i*2)-.5)*.16;
          m.castShadow = true; m.receiveShadow = true;
          g.add(m);
        }
      } else if (r < .84){                         // fila di dorsi
        const n = 4 + Math.floor(srnd(seed+2)*2);
        for (let i = 0; i < n; i++){
          const w = .38 + srnd(seed+i*7)*.16, h = 1.9 + srnd(seed+i*11)*.7;
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.5), thinSpine(seed+i));
          m.position.set(x - 1.15 + i*.56, y + h/2, -.1);
          m.rotation.y = (srnd(seed+i)-.5)*.06;
          m.castShadow = true; m.receiveShadow = true;
          g.add(m);
        }
      } else {                                     // dadi e meeple
        const cols = [['#efe3cb','#2a1a0f'], ['#c1552c','#f6e6c8'], ['#3f4f63','#f6e6c8']];
        for (let i = 0; i < 3; i++){
          const s = .58;
          const d = new THREE.Mesh(new THREE.BoxGeometry(s,s,s), ART.dieMaterials(cols[i][0], cols[i][1]));
          d.position.set(x - .75 + i*.62, y + s/2, .2 + (i%2)*.4);
          d.rotation.y = srnd(seed+i*13) * Math.PI;
          d.castShadow = true; d.receiveShadow = true;
          g.add(d);
        }
        const d20 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(.62, 0),
          new THREE.MeshStandardMaterial({ color: 0xb98a3a, roughness: .38, metalness: .7, flatShading: true })
        );
        d20.position.set(x + .95, y + .52, .35);
        d20.rotation.set(.4, srnd(seed+4)*3, .2);
        d20.castShadow = true; d20.receiveShadow = true;
        g.add(d20);
        const m1 = makeMeeple(0xd8552c, .42), m2 = makeMeeple(0xe8c05f, .36);
        m1.position.set(x + .15, y + .45, .55);
        m2.position.set(x + .55, y + .40, .8); m2.rotation.y = -.5;
        g.add(m1, m2);
      }
    }
  }

  propGroup = g;
  scene.add(g);
}

/* ===============================================================
   LIBRERIA -> SCENA
   =============================================================== */

function homeOf(index, h){
  const l = Math.floor(index / PER_LIB), k = index % PER_LIB;
  // poggiata sul piano del cubo, un filo dentro rispetto al fronte
  return new THREE.Vector3(cubX(l, k % COLS),
                           rigaY(Math.floor(k / COLS)) - KAL.cell/2 + h/2, .2);
}

/* Rifa' la scena a partire dalla libreria. Le scatole gia' presenti
   non si ricreano: scivolano al posto nuovo, cosi' riordinare si vede.
   Se cambia il numero di vani il mobile si ricostruisce. */
function applyLibrary(opts){
  opts = opts || {};
  const list = LIB.list(state.sort);
  /* Quante librerie: quelle che servono, piu' il posto per il gioco
     dopo. Cosi' quando i dodici cubi dell'ultima sono pieni ne compare
     una vuota accanto, e si vede che c'e' dove metterlo. */
  const libs = Math.max(1, Math.ceil((list.length + 1) / PER_LIB));

  if (libs !== state.libs || !cabGroup){
    state.libs = libs;
    buildCabinet();
  }

  const wanted = {};
  list.forEach(function(g, i){ wanted[g.id] = i; });

  // via quelle che non ci sono piu'
  for (let i = boxes.length - 1; i >= 0; i--){
    if (!(boxes[i].userData.id in wanted)){
      killGroup(boxes[i], true);
      boxes.splice(i, 1);
    }
  }

  const used = new Set();
  list.forEach(function(game, i){
    let b = boxes.find(function(x){ return x.userData.id === game.id; });
    const fresh = !b;
    if (fresh){
      b = makeGameBox(game);
      scene.add(b);
      boxes.push(b);
    } else {
      b.userData.game = game;
    }
    used.add(i);

    const home = homeOf(i, b.userData.h);
    b.userData.homePos.copy(home);
    b.userData.homeRot.set(0, (i % 2 ? -.03 : .02), 0);

    if (fresh){
      // entra dall'alto, come se la stessero posando adesso
      b.position.set(home.x, home.y + 3.2, home.z + 1.4);
      b.rotation.copy(b.userData.homeRot);
      b.scale.setScalar(.9);
      b.userData.busy = true;
      tween(.7, function(p){
        const e = easeOut(p);
        b.position.lerpVectors(new THREE.Vector3(home.x, home.y + 3.2, home.z + 1.4), home, e);
        b.scale.setScalar(lerp(.9, 1, e));
      }, function(){ b.userData.busy = false; }, opts.delay || 0);
    } else if (opts.animate){
      const p0 = b.position.clone();
      if (p0.distanceTo(home) > .01){
        b.userData.busy = true;
        tween(.55, function(p){
          const e = easeInOut(p);
          b.position.lerpVectors(p0, home, e);
          b.position.y += Math.sin(Math.PI * p) * .35;   // saltello
        }, function(){ b.userData.busy = false; });
      }
    } else {
      b.position.copy(home);
      b.rotation.copy(b.userData.homeRot);
      b.scale.setScalar(1);
    }
  });

  buildProps(used);
  state.scrollTo = clamp(state.scrollTo, 0, maxScroll());
  updateRail();
}

/* ===============================================================
   INQUADRATURA
   =============================================================== */
function layout(){
  const w = window.innerWidth, h = window.innerHeight;
  if (w < 2 || h < 2) return;                       // il pannello di anteprima a volte da' 0
  const aspect = w / h;
  state.side = w >= 880;

  const half = THREE.MathUtils.degToRad(FOV) / 2, tan = Math.tan(half);

  /* Una schermata, una libreria intera. Il mobile non si adatta piu'
     allo schermo: e' lo schermo a farsi indietro finche' i dodici cubi
     ci stanno tutti, in verticale come in orizzontale.

     Il margine si stringe sui formati alti e stretti: li' comanda la
     larghezza, e ogni decimo di margine si paga in stanza vuota sopra e
     sotto il mobile. */
  const marg = aspect < .8 ? .3 : .9;
  const bw = LIB_W/2 + marg;
  const bh = LIB_H/2 + marg;
  state.distShelf = KAL.front + Math.max(bh / tan, bw / (tan * aspect));

  /* Con una libreria sola non c'e' niente da scorrere: via il binario,
     invece di far muovere una barra che non muove niente. */
  state.tuttaVisibile = state.libs <= 1;
  document.body.classList.toggle('ferma', state.tuttaVisibile);

  /* Intro: si parte abbastanza indietro da vedere la stanza e un pezzo
     della libreria accanto, e ci si avvicina alla prima. Le misure sono
     multipli del mobile, non numeri fissi, cosi' l'avvicinamento e'
     sempre lo stesso su qualunque schermo. */
  const fw = LIB_W * 1.9 / 2, fh = LIB_H * 1.42 / 2;
  state.distFar = KAL.front + Math.max(fh / tan, fw / (tan * aspect));

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);

  if (state.phase === 'browse') camBase.z = state.distShelf;

  reposeFocused();          // una scatola aperta va rimessa a posto sul quadro nuovo
}

/* Dove guarda la camera. In verticale non si muove piu': la libreria e'
   sempre alta quattro file e sta sempre alla stessa quota. In
   orizzontale segue la libreria su cui si e' fermi. */
const camXFor = s => s * PASSO_LIB;

// L'ultima libreria: oltre ci sarebbe solo parete
function maxScroll(){
  return Math.max(0, state.libs - 1);
}

// Quanto davanti al mobile viene tenuta la scatola aperta. Deve stare
// oltre il fronte e oltre lo sventagliamento delle ante, se no il
// coperchio alzato entra nel ripiano.
const FOCUS_Z = KAL.front + 4.2;

/* Dove va la scatola quando esce, in frazioni di quadro: a sinistra se
   il pannello si apre di lato, in alto se sale dal basso.

   La scatola sta a una z fissa DAVANTI all'armadio ed e' la camera ad
   arretrare quanto serve. Prima succedeva il contrario -- la scatola
   veniva messa a `camera - distanza` -- e con la camera dentro il vano
   quella distanza la spingeva dietro al fronte del mobile: la scatola
   si apriva compenetrata nel ripiano. */
function focusPose(box){
  const fw   = state.side ? .48 : .74;
  const fh   = state.side ? .60 : .28;
  const offX = state.side ? -.21 : 0;
  const offY = state.side ? -.04 : .27;
  const scale = 1.1;

  const half = THREE.MathUtils.degToRad(FOV) / 2, tan = Math.tan(half);

  // l'ingombro non e' la scatola chiusa: il coperchio si alza e viene avanti
  const fitW = BOX.w * scale * 1.24;
  const fitH = box.userData.h * scale * 1.34 + BOX.w * .18;
  const d = Math.max(fitH / (2 * fh * tan), fitW / (2 * fw * tan * camera.aspect));

  const vh = 2 * d * tan, vw = vh * camera.aspect;
  // tutto in coordinate della libreria corrente: e' quella che si sta
  // guardando, e la scatola deve uscire davanti a lei
  const x = camXFor(state.scrollTo);
  return {
    pos: new THREE.Vector3(x + offX * vw, CENTRO_Y + offY * vh, FOCUS_Z),
    cam: new THREE.Vector3(x, CENTRO_Y, FOCUS_Z + d),
    rot: new THREE.Euler(-.05, .34, .02),
    scale: scale
  };
}

/* ===============================================================
   INTERAZIONE
   =============================================================== */

/* Senza ante non c'e' niente da aprire: l'ingresso e' un solo
   avvicinamento, dalla libreria intera alla prima fila di cubi. */
function intro(){
  state.phase = 'intro';
  state.scroll = state.scrollTo = 0;
  const from = new THREE.Vector3(0, CENTRO_Y, state.distFar);
  const to   = new THREE.Vector3(0, CENTRO_Y, state.distShelf);
  camBase.copy(from);

  tween(1.4, function(p){ state.bayLight = p; }, null, .9);
  tween(2.3, function(p){
    camBase.lerpVectors(from, to, easeInOut(p));
  }, function(){
    state.phase = 'browse';
    document.body.classList.add('browse');
  }, .5);
}

function focusOn(box){
  if (state.phase !== 'browse' || box.userData.busy) return;
  state.phase = 'focus';
  state.focused = box;
  state.hover = null;
  document.body.classList.remove('browse');

  const u = box.userData;
  u.busy = true;
  const p0 = box.position.clone();
  const r0 = { x: box.rotation.x, y: box.rotation.y, z: box.rotation.z };
  const target = focusPose(box);
  const cam0 = camBase.clone();
  u.pose = target;

  tween(.9, function(p){
    const e = easeInOut(p);
    box.position.lerpVectors(p0, target.pos, e);
    box.rotation.set(
      lerp(r0.x, target.rot.x, e),
      lerp(r0.y, target.rot.y, e),
      lerp(r0.z, target.rot.z, e)
    );
    box.scale.setScalar(lerp(1, target.scale, e));
    camBase.lerpVectors(cam0, target.cam, e);   // la camera arretra per far posto
    state.focusLight = e;
    state.bayLight = 1 - e * .5;
  }, openLid);
}

/* Se la finestra cambia mentre una scatola e' aperta, la posa non vale
   piu': cambia il rapporto d'aspetto e, sotto gli 880 px, anche il lato
   da cui si apre il pannello. Va rifatta, senza rigiocare l'animazione. */
function reposeFocused(){
  const box = state.focused;
  if (!box || (state.phase !== 'focus' && state.phase !== 'review')) return;
  const target = focusPose(box);
  box.userData.pose = target;
  const p0 = box.position.clone(), cam0 = camBase.clone();
  tween(.35, function(p){
    const e = easeInOut(p);
    box.position.lerpVectors(p0, target.pos, e);
    camBase.lerpVectors(cam0, target.cam, e);
  });
}

function openLid(){
  const box = state.focused;
  if (!box) return;
  const lid = box.userData.lid;
  const z0 = BOX.t/2 - BOX.lid/2;

  // si alza piu' che avvicinarsi: venendo avanti ingrandiva di colpo
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
  anims.length = 0;   // se no l'uscita e il rientro si contendono la posizione

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
    const camTo = new THREE.Vector3(camXFor(state.scrollTo), CENTRO_Y, state.distShelf);

    tween(.8, function(p){
      const e = easeInOut(p);
      box.position.lerpVectors(p0, u.homePos, e);
      box.rotation.set(
        lerp(r0.x, u.homeRot.x, e),
        lerp(r0.y, u.homeRot.y, e),
        lerp(r0.z, u.homeRot.z, e)
      );
      box.scale.setScalar(lerp(s0, 1, e));
      camBase.lerpVectors(cam0, camTo, e);   // la camera rientra nello scaffale
      state.focusLight = 1 - e;
      state.bayLight = .5 + e * .5;
    }, function(){
      u.busy = false;
      state.focused = null;
      state.phase = 'browse';
      document.body.classList.add('browse');
    });
  }, .12);
}

/* --- admin: togli il gioco che si sta guardando ----------------- */
function removeFocused(){
  const box = state.focused;
  if (!box) return;
  const game = box.userData.game;

  state.phase = 'closing';
  hidePanel();
  anims.length = 0;

  const p0 = box.position.clone();
  const cam0 = camBase.clone();
  const camTo = new THREE.Vector3(camXFor(state.scrollTo), CENTRO_Y, state.distShelf);
  tween(.5, function(p){
    const e = easeInOut(p);
    box.position.set(p0.x, p0.y - e * 2.2, p0.z + e * 1.2);
    box.rotation.z = e * .7;
    box.scale.setScalar(1.1 * (1 - e));
    camBase.lerpVectors(cam0, camTo, e);
    state.focusLight = 1 - e;
  }, function(){
    killGroup(box, true);
    const i = boxes.indexOf(box);
    if (i >= 0) boxes.splice(i, 1);
    state.focused = null;
    LIB.remove(game.id);
    state.bayLight = 1;
    applyLibrary({ animate: true });
    state.phase = 'browse';
    document.body.classList.add('browse');
    flash('"' + game.title + '" tolto dall\'armadio');
  });
}

/* --- pannello -------------------------------------------------- */
function showPanel(game){
  q('#p-title').textContent = game.title;

  const by = [];
  if (game.designer)  by.push('<b>' + esc(game.designer) + '</b>');
  if (game.publisher) by.push(esc(game.publisher));
  if (game.year)      by.push(esc(game.year));
  q('#p-by').innerHTML = by.join(' &middot; ') +
    (game.artist ? '<br><span class="credit">copertina di ' + esc(game.artist) +
                   (game.publisher ? ', &copy; ' + esc(game.publisher) : '') + '</span>' : '');

  const specs = [
    [game.players, 'giocatori'], [game.time, 'minuti'],
    [game.age, 'eta'], [game.weight, 'peso bgg']
  ].filter(function(s){ return s[0]; });
  q('#p-specs').innerHTML = specs.map(function(s){
    return '<li><b>' + esc(s[0]) + '</b><span>' + s[1] + '</span></li>';
  }).join('');

  q('#p-score').textContent = game.score || '--';
  q('#p-body').innerHTML = (game.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('');
  q('#p-tags').innerHTML = (game.tags || []).map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');

  const link = q('#p-bgg');
  if (game.bgg){
    link.href = 'https://boardgamegeek.com/boardgame/' + game.bgg + '/';
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }

  const panel = q('#panel');
  panel.setAttribute('aria-hidden', 'false');
  panel.scrollTop = 0;
  document.body.classList.add('review');
}

function hidePanel(){
  document.body.classList.remove('review');
  q('#panel').setAttribute('aria-hidden', 'true');
  const d = q('#del');
  if (d && d.__disarma) d.__disarma();     // niente conferme rimaste in canna
}

/* Conferma in due tempi sul bottone stesso: window.confirm blocca il
   rendering, e una finestra di sistema in mezzo a una scena 3D stona.
   Il primo clic arma, il secondo esegue, dopo quattro secondi si
   disarma da solo. */
function armaBottone(btn, normale, conferma, azione){
  let armed = false, t = 0;
  function disarma(){
    clearTimeout(t); armed = false;
    btn.classList.remove('armed');
    btn.innerHTML = normale;
  }
  btn.innerHTML = normale;
  btn.__disarma = disarma;
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    if (!armed){
      armed = true;
      btn.classList.add('armed');
      btn.innerHTML = conferma;
      t = setTimeout(disarma, 4000);
      return;
    }
    disarma();
    azione();
  });
}

/* --- messaggino di conferma ------------------------------------ */
let flashT = 0;
function flash(msg){
  let el = q('#flash');
  if (!el){
    el = document.createElement('div');
    el.id = 'flash';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(flashT);
  flashT = setTimeout(function(){ el.classList.remove('on'); }, 2600);
}

/* --- scorrimento fra gli scaffali ------------------------------ */
let snapT = 0;
function snapSoon(){
  clearTimeout(snapT);
  snapT = setTimeout(function(){
    state.scrollTo = clamp(Math.round(state.scrollTo), 0, maxScroll());
  }, 220);
}
function scrollBy(d){
  if (state.phase !== 'browse') return;
  state.scrollTo = clamp(state.scrollTo + d, 0, maxScroll());
  snapSoon();
}
function updateRail(){
  const max = maxScroll();
  if (!max) return;                       // niente da scorrere: il binario e' nascosto dal CSS
  const n = max + 1;
  q('#rail-txt').textContent = (Math.round(state.scroll) + 1) + ' / ' + n;
  const t = state.scroll / max;
  q('#rail-thumb').style.transform = 'translateX(' + (t * (100 * max)) + '%)';
  q('#rail-thumb').style.width = (100 / n) + '%';
}

/* --- puntatore -------------------------------------------------- */
function bindInput(){
  const el = renderer.domElement;
  let downAt = 0, downX = 0, downY = 0, lastX = 0, moved = 0;

  function norm(e){
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  el.addEventListener('pointermove', function(e){
    norm(e);
    pointer.set(state.tx, state.ty);
    if (state.dragging && state.phase === 'browse'){
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      // quante librerie vale un pixel, a questa distanza di camera
      const vh = 2 * state.distShelf * Math.tan(THREE.MathUtils.degToRad(FOV)/2);
      const vw = vh * camera.aspect;
      state.scrollTo = clamp(
        state.scrollTo - (dx * vw / window.innerWidth) / PASSO_LIB,
        0, maxScroll()
      );
    }
  });

  el.addEventListener('pointerdown', function(e){
    downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    lastX = e.clientX; moved = 0;
    state.dragging = true;
    if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch(err){}
    norm(e); pointer.set(state.tx, state.ty);
  });

  el.addEventListener('pointerup', function(e){
    const wasDrag = moved > 9;
    state.dragging = false;
    if (wasDrag) snapSoon();

    const dt = performance.now() - downAt;
    const dx = Math.abs(e.clientX - downX), dy = Math.abs(e.clientY - downY);
    if (dt > 600 || dx > 9 || dy > 9) return;      // era un trascinamento

    if (state.phase === 'browse'){
      const hit = pick();
      if (hit) focusOn(hit);
    } else if (state.phase === 'review' || state.phase === 'focus'){
      unfocus();
    }
  });

  el.addEventListener('pointercancel', function(){ state.dragging = false; });
  el.addEventListener('pointerleave', function(){
    state.dragging = false; state.tx = 0; state.ty = 0; state.hover = null;
  });

  el.addEventListener('wheel', function(e){
    if (state.phase !== 'browse') return;
    e.preventDefault();
    // la rotella di un mouse da' deltaY, il trackpad di lato da' deltaX:
    // qui muovono la stessa cosa, quindi si prende quello che si muove
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    scrollBy(d * .0022);
  }, { passive: false });

  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ unfocus(); closeAdd(); return; }
    if (state.phase !== 'browse') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown'){ e.preventDefault(); scrollBy(1); }
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp'){   e.preventDefault(); scrollBy(-1); }
  });

  q('#close').addEventListener('click', function(e){ e.stopPropagation(); unfocus(); });
  q('#edit').addEventListener('click', function(e){
    e.stopPropagation();
    const g = state.focused && state.focused.userData.game;
    if (!g) return;
    unfocus();                     // la scatola torna a posto e il modulo prende la scena
    apriModifica(g);
  });

  armaBottone(q('#del'),
    '<span aria-hidden="true">&#9003;</span> togli dall\'armadio',
    'sicuro? tocca ancora', removeFocused);
  q('#panel').addEventListener('pointerup', function(e){ e.stopPropagation(); });

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
   INTERFACCIA: modalita', ordinamento, aggiunta
   =============================================================== */

/* Il ruolo non si sceglie: si legge. `admin` arriva da e_admin() sul
   database, e i pulsanti compaiono di conseguenza. Se anche comparissero
   a chi non ha diritto, a rifiutare sarebbe comunque Postgres: qui si
   decide cosa mostrare, non cosa e' permesso. */
/* Chi e' entrato comanda sulla PROPRIA collezione, admin o no: sono le
   regole del database a garantirlo, riga per riga. `admin` non da'
   nessun potere in piu', resta solo come etichetta per vedere come si
   comporta l'accesso. */
function setMode(st){
  state.mode = st.admin ? 'admin' : 'utente';
  state.dentro = !!st.dentro;
  document.body.classList.toggle('admin', !!st.admin);
  document.body.classList.toggle('dentro', !!st.dentro || !AUTH.attivo());
  const chip = q('#mode');
  if (!AUTH.attivo()){
    chip.textContent = state.mode;          // senza backend resta l'interruttore locale
    chip.title = 'cambia modalita';
  } else if (st.dentro){
    // il chip dice CHI sei, non fa niente: uscire ha un tasto suo, se no
    // e' un pulsante che cambia significato a seconda dello stato
    chip.textContent = st.admin ? 'admin' : 'utente';
    chip.title = (st.nome || '') + (st.admin ? ' -- admin' : '');
    chip.disabled = true;
  } else {
    chip.textContent = 'entra';
    chip.title = 'entra con Google';
    chip.disabled = false;
  }
}

function bindTools(){
  q('#mode').addEventListener('click', async function(){
    if (!AUTH.attivo()){
      // senza database resta l'interruttore locale di prima
      setMode({ dentro: false, admin: state.mode !== 'admin' });
      flash(state.mode === 'admin' ? 'modalita admin' : 'modalita utente');
      return;
    }
    if (AUTH.stato().dentro) return;     // qui dentro il chip e' solo un'etichetta
    try { await AUTH.entra(); }          // porta su Google e poi torna qui
    catch(e){ flash('accesso non riuscito: ' + e.message); }
  });

  // Uscire non e' cambiare un'etichetta: la collezione di prima non e'
  // piu' tua, e la schermata da cui si riparte e' l'accesso.
  q('#esci').addEventListener('click', async function(){
    await AUTH.esci();
    LIB.scollega();
    location.reload();
  });

  const menu = q('#sortmenu'), btn = q('#sort');
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    const open = menu.classList.toggle('on');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function(){
    menu.classList.remove('on'); btn.setAttribute('aria-expanded','false');
  });
  qa('#sortmenu button').forEach(function(b){
    b.addEventListener('click', function(){
      setSort(b.getAttribute('data-sort'));
    });
  });

  q('#add').addEventListener('click', openAdd);
  q('#add-x').addEventListener('click', closeAdd);
  q('#add-go').addEventListener('click', doSearch);
  q('#add-q').addEventListener('keydown', function(e){ if (e.key === 'Enter') doSearch(); });
  q('#m-go').addEventListener('click', addManual);

  // Senza export le modifiche dell'admin non escono mai da questo
  // browser: il file scaricato va messo al posto di js/data.js.
  q('#exp').addEventListener('click', function(){
    const blob = new Blob([LIB.esporta()], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
    flash('data.js scaricato: mettilo in js/ e committa');
  });

  armaBottone(q('#rst'), 'ripristina', 'sicuro? si perdono le aggiunte', function(){
    LIB.reset();
    closeAdd();
    loadCovers().then(function(){
      applyLibrary({ animate: true });
      flash('libreria ripristinata');
    });
  });
}

function setSort(mode){
  state.sort = mode;
  try { localStorage.setItem('dado-ordine', mode); } catch(e){}
  q('#sort-now').textContent = mode;
  qa('#sortmenu button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sort') === mode);
  });
  q('#sortmenu').classList.remove('on');
  // in qualunque fase tranne quelle in cui una scatola e' fuori posto:
  // li' spostarla sotto i piedi al tween in corso farebbe pasticci
  const ferma = state.phase === 'focus' || state.phase === 'review' || state.phase === 'closing';
  if (!ferma) applyLibrary({ animate: true });
}

/* --- aggiunta -------------------------------------------------- */
function openAdd(){
  chiudiModifica();
  q('#m-review').value = '';
  q('#addlayer').classList.add('on');
  q('#addlayer').setAttribute('aria-hidden','false');
  q('#add-q').focus();

  // dove finiscono le modifiche cambia se c'e' il database dietro
  const dove = q('#add-dove'), esporta = q('#exp'), ripristina = q('#rst');
  if (LIB.eRemota()){
    dove.textContent = 'Le modifiche vanno nel database, le vedono tutti.';
    esporta.style.display = ripristina.style.display = 'none';
  } else {
    dove.textContent = 'Le modifiche restano su questo browser.';
    esporta.style.display = ripristina.style.display = '';
  }

  CATALOGO.fonte(true).then(function(f){
    if (f === 'bgg'){
      msgAdd('Ricerca su <b>BoardGameGeek</b>, dal proxy locale.', '');
    } else {
      msgAdd('Il token BGG non c&#39;&egrave; ancora, quindi cerco su <b>Wikidata</b>: ' +
             'circa 4.400 giochi invece di 175.000, e l&#39;immagine &egrave; spesso una foto ' +
             'del gioco allestito e non la scatola. <b>Controlla i campi prima di salvare</b> ' +
             '&mdash; l&#39;editore &egrave; quello che sbaglia pi&ugrave; spesso.', 'warn');
    }
  });
}
function closeAdd(){
  q('#addlayer').classList.remove('on');
  q('#addlayer').setAttribute('aria-hidden','true');
  chiudiModifica();
}
function msgAdd(html, kind){
  const el = q('#add-msg');
  el.innerHTML = html;
  el.className = 'add-msg' + (kind ? ' ' + kind : '');
}

// la voce scelta dalla ricerca, in attesa di essere confermata
let inAttesa = null;
// se valorizzato, il modulo sta correggendo quel gioco invece di crearne uno
let inModifica = null;

/* Apre il modulo gia' pieno su un gioco che c'e' gia'. La ricerca resta
   nascosta: qui non si cerca niente, si corregge quello che si ha. */
function apriModifica(game){
  inModifica = game.id;
  inAttesa = null;
  q('#addlayer').classList.add('on', 'correzione');
  q('#addlayer').classList.add('correzione');
  q('#addlayer').setAttribute('aria-hidden','false');
  q('#add-h').textContent = 'Correggi la scheda';
  q('#m-go').textContent = 'salva le modifiche';

  const set = function(sel, v){ q(sel).value = v == null ? '' : String(v); };
  set('#m-title', game.title);       set('#m-bgg', game.bgg);
  set('#m-designer', game.designer); set('#m-publisher', game.publisher);
  set('#m-year', game.year);         set('#m-players', game.players);
  set('#m-time', game.time);         set('#m-score', game.score);
  set('#m-review', (game.review || []).join(String.fromCharCode(10,10)));
  q('#m-file').value = '';
  q('#add-man').open = true;
  q('#add-res').innerHTML = '';
  msgAdd('Le modifiche vanno nella <b>tua</b> collezione. Lascia vuoto il campo ' +
         'copertina per tenere quella che c&#39;&egrave; gi&agrave;.', '');
  q('#m-title').focus();
}

function chiudiModifica(){
  inModifica = null;
  q('#addlayer').classList.remove('correzione');
  q('#add-h').innerHTML = 'Aggiungi all&rsquo;armadio';
  q('#m-go').textContent = 'metti sullo scaffale';
}

async function doSearch(){
  const q0 = q('#add-q').value.trim();
  if (!q0) return;
  msgAdd('cerco&hellip;', '');
  q('#add-res').innerHTML = '';
  try {
    const hits = await CATALOGO.cerca(q0);
    if (!hits.length){
      msgAdd('Nessun risultato. Se il gioco &egrave; recente o poco noto pu&ograve; ' +
             'semplicemente non essere su Wikidata: scrivilo a mano qui sotto.', '');
      q('#add-man').open = true;
      return;
    }
    msgAdd('Scegline uno: riempie il modulo, non lo mette subito sullo scaffale.', '');
    q('#add-res').innerHTML = hits.map(function(h, i){
      return '<li><button type="button" data-i="' + i + '">' +
             '<b>' + esc(h.title) + '</b>' +
             '<span>' + esc([h.year, h.designer].filter(Boolean).join(' &middot; ')) + '</span>' +
             '</button></li>';
    }).join('');
    qa('#add-res button').forEach(function(b){
      b.addEventListener('click', function(){
        scegli(hits[parseInt(b.getAttribute('data-i'), 10)], b);
      });
    });
  } catch(e){
    msgAdd('Ricerca non riuscita: ' + esc(e.message) +
           '. Puoi scrivere il gioco a mano qui sotto.', 'warn');
    q('#add-man').open = true;
  }
}

/* Un risultato non finisce sullo scaffale da solo: riempie il modulo.
   Con Wikidata i dati vanno guardati prima di fidarsi, e anche con BGG
   un controllo prima di salvare non ha mai fatto male. */
async function scegli(voce, btn){
  btn.disabled = true;
  const prima = btn.innerHTML;
  btn.innerHTML = '<b>prendo la scheda&hellip;</b>';
  try {
    const g = await CATALOGO.dettagli(voce);
    inAttesa = g;
    const set = function(sel, v){ q(sel).value = v == null ? '' : String(v); };
    set('#m-title', g.title);      set('#m-bgg', g.bgg);
    set('#m-designer', g.designer); set('#m-publisher', g.publisher);
    set('#m-year', g.year);        set('#m-players', g.players);
    set('#m-time', g.time);        set('#m-score', g.score);
    q('#add-man').open = true;
    q('#add-res').innerHTML = '';
    msgAdd('Scheda da <b>' + esc(g.fonte === 'bgg' ? 'BoardGameGeek' : 'Wikidata') + '</b>. ' +
           'Correggi quello che serve, poi metti sullo scaffale.' +
           (g.immagine ? ' L&#39;immagine la scarico al salvataggio.'
                       : ' Nessuna immagine: user&ograve; la copertina disegnata.'), '');
    q('#m-title').focus();
  } catch(e){
    msgAdd('Non sono riuscito a prendere la scheda: ' + esc(e.message), 'warn');
  } finally {
    btn.disabled = false; btn.innerHTML = prima;
  }
}

async function addManual(){
  const title = q('#m-title').value.trim();
  if (!title){ q('#m-title').focus(); return; }

  // una riga vuota separa un capoverso: e' il modo in cui si scrive un
  // testo, non serve insegnare niente a chi lo compila
  const testo = q('#m-review').value.trim();
  const NL = String.fromCharCode(10), CR = String.fromCharCode(13);
  const capoversi = testo
    ? testo.split(CR).join('')                  // fine riga alla Windows
           .split(NL + NL)                      // riga vuota = capoverso nuovo
           .map(function(t){ return t.split(NL).join(' ').trim(); })
           .filter(Boolean)
    : null;

  const g = {
    title: title,
    bgg: parseInt(q('#m-bgg').value, 10) || 0,
    designer: q('#m-designer').value.trim(),
    publisher: q('#m-publisher').value.trim(),
    year: q('#m-year').value.trim(),
    players: q('#m-players').value.trim(),
    time: q('#m-time').value.trim(),
    score: q('#m-score').value.trim(),
    art: 'generic'
  };
  if (capoversi) g.review = capoversi;

  /* La copertina: prima il file scelto a mano, che vince sempre --
     e' quello che l'admin ha voluto. Se non c'e', quella della fonte.
     Si scarica solo adesso: cambiando idea a meta' ricerca non si e'
     scaricato niente per niente. */
  const b = q('#m-go'), prima = b.textContent;
  const file = q('#m-file').files[0];

  if (file){
    b.disabled = true; b.textContent = 'preparo la copertina...';
    try { g.cover = await CATALOGO.daFile(file); }
    catch(e){ flash('immagine non usata: ' + e.message); }
    b.disabled = false; b.textContent = prima;
  } else if (inAttesa && inAttesa.immagine && inAttesa.title === title){
    b.disabled = true; b.textContent = 'scarico la copertina...';
    try { g.cover = await CATALOGO.copertina(inAttesa); }
    catch(e){ flash('copertina non presa: uso quella disegnata'); }
    b.disabled = false; b.textContent = prima;
  }

  let game;
  if (inModifica){
    game = LIB.update(inModifica, g);
    chiudiModifica();
  } else {
    game = LIB.add(g);
  }

  inAttesa = null;
  qa('#add-man input').forEach(function(i){ i.value = ''; });   // svuota anche il file
  q('#m-review').value = '';
  closeAdd();
  await loadCovers(true);
  applyLibrary({ animate: true });
  if (game){
    goToGame(game.id);
    flash('"' + game.title + '" salvato');
  }
}

// porta lo scaffale del gioco al centro dello schermo
function goToGame(id){
  const list = LIB.list(state.sort);
  const i = list.findIndex(function(g){ return g.id === id; });
  if (i < 0) return;
  state.scrollTo = clamp(Math.floor(i / PER_LIB), 0, maxScroll());
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
  // il passo va tenuto positivo e corto: un dt negativo manderebbe le
  // animazioni all'indietro, uno lungo (scheda tornata in primo piano)
  // le farebbe saltare alla fine di colpo
  const dt = last ? Math.max(0, Math.min(.05, (now - last) / 1000)) : .016;
  last = now;

  stepAnims(dt);

  if (state.phase === 'browse'){
    const before = Math.round(state.scroll);
    state.scroll += (state.scrollTo - state.scroll) * Math.min(1, dt * 7);
    camBase.set(camXFor(state.scroll), CENTRO_Y, state.distShelf);
    if (Math.abs(state.scrollTo - state.scroll) > .0005 || before !== Math.round(state.scroll)) updateRail();
  }

  const damp = Math.min(1, dt * 5);
  state.px += (state.tx - state.px) * damp;
  state.py += (state.ty - state.py) * damp;
  const sway = state.phase === 'review' ? .3 : (state.dragging ? .2 : 1);
  camera.position.set(
    camBase.x + state.px * 1.1 * sway,
    camBase.y + state.py * .5 * sway,
    camBase.z
  );
  camera.lookAt(camBase.x, camBase.y, 0);

  /* Luci al seguito. Le librerie possono essere tante e tenerne accese e
     ombreggiate anche quelle fuori dal quadro si paga senza vedersi; ma
     soprattutto il riquadro d'ombra della direzionale e' largo quanto
     una libreria e basta -- lasciato fermo all'origine, dalla seconda in
     poi le ombre sparivano di colpo. */
  for (let i = 0; i < bayLights.length; i++){
    bayLights[i].intensity = state.bayLight * .30;
    bayLights[i].position.x = camBase.x;
  }
  if (keyLight){
    keyLight.position.x = camBase.x - 9;
    keyLight.target.position.x = camBase.x;
    keyLight.target.updateMatrixWorld();
  }

  if (state.focused) focusLight.position.copy(state.focused.position).add(new THREE.Vector3(1.2, 2.2, 3.4));
  focusLight.intensity = state.focusLight * 1.1;

  if (state.phase === 'browse' && !state.dragging){
    const hit = pick();
    if (hit !== state.hover){
      state.hover = hit;
      document.body.style.cursor = hit ? 'pointer' : '';
    }
  } else if (state.phase !== 'browse' && document.body.style.cursor){
    document.body.style.cursor = '';
  }

  updateBoxes(dt);
  renderer.render(scene, camera);
}

/* ===============================================================
   AVVIO
   =============================================================== */
function buildFlatList(){
  q('#flat-list').innerHTML = LIB.list(state.sort).map(function(g){
    return '<article>' +
      (g.cover ? '<img src="' + esc(g.cover) + '" alt="la scatola di ' + esc(g.title) + '" loading="lazy">' : '') +
      '<h2>' + esc(g.title) + '</h2>' +
      '<p class="byline"><b>' + esc(g.designer) + '</b> &middot; ' + esc(g.publisher) + ' &middot; ' + esc(g.year) +
      ' &middot; ' + esc(g.players) + ' giocatori &middot; ' + esc(g.time) + ' min' +
      (g.artist ? '<br><span class="credit">copertina di ' + esc(g.artist) +
                  ', &copy; ' + esc(g.publisher) + '</span>' : '') + '</p>' +
      (g.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('') +
      (g.bgg ? '<p><a class="bgg" href="https://boardgamegeek.com/boardgame/' + g.bgg +
               '/" target="_blank" rel="noopener">scheda su BoardGameGeek &#8599;</a></p>' : '') +
      '</article>';
  }).join('');
}

// Le copertine. Se una non arriva non e' un errore: la scatola usa
// quella disegnata e il sito va avanti.
function loadCovers(forza){
  return Promise.all(LIB.all().map(function(g){
    return new Promise(function(done){
      // `forza` serve dopo una modifica: la copertina puo' essere
      // cambiata e quella vecchia e' ancora attaccata al gioco
      if (forza && g.img && g.img.src !== g.cover) g.img = null;
      // non basta che `img` esista: da una libreria vecchia puo' arrivare
      // un oggetto vuoto, e va ricaricata l'immagine per davvero
      if (!g.cover || (g.img && g.img.naturalWidth)) return done();
      const im = new Image();

      /* Le copertine caricate stanno su Supabase, cioe' su un altro
         dominio, e finiscono in una texture WebGL: senza crossOrigin
         l'immagine si carica benissimo in un <img> ma la texture resta
         vuota, perche' il contesto la considera contaminata.

         Si notava solo uscendo e rientrando: appena aggiunto un gioco
         `cover` e' ancora un data URL e il problema non esiste, mentre
         al rientro torna dal database come indirizzo esterno.

         Va messo PRIMA di src, se no non conta piu' niente. */
      if (/^https?:\/\//.test(g.cover) && g.cover.indexOf(location.origin + '/') !== 0){
        im.crossOrigin = 'anonymous';
      }

      im.onload = function(){ if (im.naturalWidth) g.img = im; done(); };
      im.onerror = function(){ done(); };
      im.src = g.cover;
    });
  }));
}

function fallbackFlat(){
  document.body.classList.add('no3d', 'ready');
  q('#gate').classList.add('gone');
}

/* Il cancello viene prima di tutto. Chi torna da Google ha gia' una
   sessione: in quel caso non si richiede niente e si tira dritto, se no
   il giro dell'accesso ricomincerebbe a ogni ritorno. */
function gate(giaDentro){
  if (giaDentro){
    q('#gate').classList.add('gone');
    return Promise.resolve();
  }
  return new Promise(function(res){
    qa('#gate [data-gate]').forEach(function(b){
      b.addEventListener('click', async function(){
        if (b.getAttribute('data-gate') === 'entra' && AUTH.attivo()){
          b.disabled = true;
          try {
            await AUTH.entra();      // se ne va su Google: la pagina viene lasciata
            return;
          } catch(e){
            b.disabled = false;
            q('#gate-note').textContent = 'Accesso non riuscito: ' + e.message +
              ' -- puoi comunque guardare senza account.';
            return;
          }
        }
        q('#gate').classList.add('gone');
        res();
      });
    });
  });
}

async function boot(){
  try { state.sort = localStorage.getItem('dado-ordine') || 'aggiunta'; } catch(e){}
  q('#sort-now').textContent = state.sort;
  LIB.suErrore(flash);                    // le scritture rifiutate le racconta il flash
  buildFlatList();

  // Chi torna da Google ha gia' la sessione: si salta il cancello.
  const chi = await AUTH.init();
  await gate(chi.dentro);
  const t0 = performance.now();
  setMode(chi);

  if (typeof THREE === 'undefined'){ fallbackFlat(); return; }

  // I font servono gia' al primo disegno: i titoli sui dorsi sono
  // testo su canvas, e senza Bebas escono con il ripiego.
  setProg(.12, 'preparo i caratteri');
  try { await document.fonts.ready; } catch(e){}

  try {
    camera = new THREE.PerspectiveCamera(FOV, 16/9, .1, 300);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch(e){
    fallbackFlat(); return;
  }
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  q('#scene').appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2(0, 0);

  // Un passo per volta con una pausa in mezzo, cosi' la barra si muove.
  // setTimeout e non requestAnimationFrame: a pagina nascosta i frame
  // non arrivano affatto e il caricamento resterebbe li'.
  await wait(20); setProg(.28, 'monto la stanza');
  makeMats();
  buildRoom();
  // prima le misure dello schermo: decidono quante scatole per scaffale,
  // e quindi quanto viene alto l'armadio che sto per costruire
  layout();
  // la libreria vera, prima delle copertine: sono le schede a dire
  // quali immagini servono
  setProg(.40, 'apro la libreria');
  const lib = await LIB.sync();
  buildFlatList();
  setProg(.56, 'stampo le copertine');
  await loadCovers();
  await wait(20); setProg(.72, 'monto le mensole');
  applyLibrary({});
  await wait(20); setProg(.92, 'accendo la lampada');

  bindInput();
  bindTools();
  setSort(state.sort);
  requestAnimationFrame(frame);
  setProg(1, 'ci siamo');

  await wait(Math.max(0, 1400 - (performance.now() - t0)));
  document.body.classList.add('ready');
  intro();

  // Un armadio vuoto non e' un guasto: e' una collezione appena nata, e
  // va detto, se no sembra che il sito non abbia caricato niente.
  if (lib.vuota){
    flash('la tua collezione e vuota: premi + per il primo gioco');
  } else if (AUTH.attivo() && lib.dentro !== false && !lib.remota){
    flash('collezione offline: mostro l\'ultima copia salvata');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
