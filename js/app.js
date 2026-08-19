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
  sezione: 'collezione',       // 'collezione' (la libreria 3D) o 'catalogo'
  q: '',                       // il testo cercato, '' se non si sta cercando
  presa: null,                 // la scatola che si sta spostando a mano
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
let cabGroup, propGroup, bayLights = [], focusLight, keyLight, alone;
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

  alone = makeAlone();
}

/* Il segnaposto del cubo dove si sta per posare una scatola: una lastra
   ambrata in fondo al vano. Dentro un mobile di legno chiaro un contorno
   luminoso non si legge, una macchia di colore si'.

   `depthWrite:false` perche' e' un velo, non un oggetto: senza, la
   scatola che ci passa davanti veniva ritagliata dal suo z-buffer. */
function makeAlone(){
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(KAL.cell, KAL.cell),
    new THREE.MeshBasicMaterial({ color: 0x9a6a15, transparent: true,
                                  opacity: .24, depthWrite: false })
  );
  m.visible = false;
  scene.add(m);
  return m;
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

  /* Mentre si cerca i cubi vuoti restano vuoti. Riempirli di libri e
     dadi fa sembrare lo scaffale pieno, e i risultati -- che sono il
     motivo per cui si sta guardando -- non si distinguono piu' dal
     contorno. */
  if (!used){ propGroup = g; scene.add(g); return; }

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

/* La lista che vede la scena: ordinata e filtrata insieme. Tutto quello
   che dispone scatole deve passare di qui, se no cercando un gioco la
   posizione sullo scaffale e quella nell'elenco non coincidono piu'. */
function lista(){
  return LIB.list(state.sort, state.q);
}

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
  const list = lista();
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

    // quella che si ha in mano sta dove sta il dito: la casa cambia,
    // ma non si riporta a casa una scatola mentre la si sta spostando
    if (state.presa && state.presa.box === b) return;

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

  buildProps(state.q ? null : used);
  state.scrollTo = clamp(state.scrollTo, 0, maxScroll());
  updateRail();
  updateConta();
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
   SPOSTARE UNA SCATOLA A MANO
   ===============================================================

   Si tiene premuto, non si trascina e basta. La libreria riempie lo
   schermo, quindi quasi ogni gesto comincia sopra una scatola: senza la
   pausa, prendere una scatola e scorrere fra le librerie sarebbero lo
   stesso movimento e non si potrebbe piu' fare ne' l'uno ne' l'altro.
   Un terzo di secondo fermi vuol dire "questa la prendo"; muoversi
   prima vuol dire "sposto la vista".

   Due scatole si SCAMBIANO di posto. In una griglia di cubi e' il gesto
   che si legge: questa la metto li', e quella viene qui. Lasciarla in
   un cubo vuoto invece la manda in fondo, che e' l'altra cosa che si
   vuole fare davvero.

   Spostare a mano ACCENDE l'ordine manuale se non era gia' acceso, e le
   posizioni di partenza sono quelle che c'erano sullo schermo in quel
   momento: passare a "il mio ordine" non rimescola mai niente. */

const PRESA_MS = 330;
const PRESA_Z = KAL.front + 1.8;      // quanto la scatola viene avanti in mano

/* Da un punto sul piano dei cubi al numero di posto. Il conto e'
   l'inverso di cubX/rigaY: nessuna ricerca, nessun raycast sui vani. */
function slotDa(x, y){
  const l = Math.round(x / PASSO_LIB);
  if (l < 0 || l >= state.libs) return -1;
  const c = Math.floor((x - libX(l) + LIB_W/2 - KAL.t) / KAL.passo);
  const r = Math.floor((KAL.topY - KAL.t - y) / KAL.passo);
  if (c < 0 || c >= COLS || r < 0 || r >= RIGHE) return -1;
  return l * PER_LIB + r * COLS + c;
}

/* Dove punta il dito su un piano verticale a quota z. Ne servono due
   piani diversi: la scatola sta su quello davanti, cosi' resta sotto al
   dito senza parallasse, ma il cubo di destinazione si legge su quello
   dei cubi, che e' dove il dito sta davvero indicando. */
const pianoP = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const puntoP = new THREE.Vector3();
function puntoSuZ(z){
  pianoP.constant = -z;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(pianoP, puntoP) ? puntoP : null;
}

/* Cercando, l'ordine sullo schermo e' un sottoinsieme: spostarci dentro
   riordinerebbe solo i risultati e lascerebbe gli altri dove capita. */
function puoiSpostare(){
  return (state.dentro || !AUTH.attivo()) && !state.q
         && !LIB.ospitePresso() && state.phase === 'browse';
}

function iniziaPresa(box){
  const l = lista();
  const da = l.findIndex(function(g){ return g.id === box.userData.id; });
  if (da < 0) return;

  state.presa = { box: box, l: l, da: da, mira: da, mirBox: box };
  state.dragging = false;
  state.hover = null;
  box.userData.busy = true;                 // updateBoxes non ci mette piu' mano
  document.body.classList.add('presa');
  document.body.style.cursor = 'grabbing';

  const s0 = box.scale.x;
  tween(.16, function(p){
    box.scale.setScalar(lerp(s0, 1.12, easeOut(p)));
  });
  box.rotation.set(-.06, .12, .04);
  muoviPresa();
}

function muoviPresa(){
  const p = state.presa;
  if (!p) return;

  const inMano = puntoSuZ(PRESA_Z);
  if (inMano) p.box.position.set(inMano.x, inMano.y, PRESA_Z);

  const suiCubi = puntoSuZ(.2);
  const s = suiCubi ? slotDa(suiCubi.x, suiCubi.y) : -1;
  p.mira = s;
  p.mirBox = null;
  if (s >= 0 && s < p.l.length){
    const id = p.l[s].id;
    p.mirBox = boxes.find(function(b){ return b.userData.id === id; }) || null;
  }
  segnaAlone(s);
}

function segnaAlone(s){
  if (!alone) return;
  if (s < 0 || s >= state.libs * PER_LIB){ alone.visible = false; return; }
  const l = Math.floor(s / PER_LIB), k = s % PER_LIB;
  alone.position.set(cubX(l, k % COLS), rigaY(Math.floor(k / COLS)), -KAL.d/2 + .14);
  alone.visible = true;
}

function posaScatola(p){
  const ids = p.l.map(function(g){ return g.id; });
  if (p.mira < ids.length){
    const t = ids[p.da]; ids[p.da] = ids[p.mira]; ids[p.mira] = t;   // si scambiano
  } else {
    ids.push(ids.splice(p.da, 1)[0]);                                // cubo vuoto: in fondo
  }

  const prima = state.sort;
  p.box.userData.busy = false;          // da qui in poi la muove applyLibrary
  LIB.riordina(ids);

  if (prima !== 'mio'){
    setSort('mio');                     // ridispone da solo
    flash('ordine tuo: da adesso le scatole restano dove le metti');
  } else {
    applyLibrary({ animate: true });
  }
}

/* `annulla` = non posarla, riportala a casa. `subito` = senza animazione,
   perche' subito dopo la scatola si apre e un tween a meta' litigherebbe
   con quello dell'apertura. */
function finiscePresa(annulla, subito){
  const p = state.presa;
  if (!p) return;
  state.presa = null;
  if (alone) alone.visible = false;
  document.body.classList.remove('presa');
  document.body.style.cursor = '';

  const posabile = !annulla && p.mira >= 0 && p.mira !== p.da;
  if (posabile){ posaScatola(p); return; }

  const u = p.box.userData;
  if (subito){
    p.box.position.copy(u.homePos);
    p.box.rotation.copy(u.homeRot);
    p.box.scale.setScalar(1);
    u.busy = false;
    return;
  }

  const p0 = p.box.position.clone(), s0 = p.box.scale.x;
  const r0 = { x: p.box.rotation.x, y: p.box.rotation.y, z: p.box.rotation.z };
  tween(.34, function(t){
    const e = easeOut(t);
    p.box.position.lerpVectors(p0, u.homePos, e);
    p.box.rotation.set(lerp(r0.x, u.homeRot.x, e),
                       lerp(r0.y, u.homeRot.y, e),
                       lerp(r0.z, u.homeRot.z, e));
    p.box.scale.setScalar(lerp(s0, 1, e));
  }, function(){ u.busy = false; });
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

/* `poi` viene chiamata quando la scatola e' tornata sullo scaffale.
   Serve a chi deve rifare la disposizione -- cambiare ordine, cercare --
   e non puo' farlo mentre una scatola e' fuori posto: la sposterebbe
   sotto i piedi al tween in corso. */
function unfocus(poi){
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
      if (poi) poi();
    });
  }, .12);
}

/* Rifa' la disposizione appena si puo': subito se lo scaffale e' fermo,
   dopo la chiusura se c'e' una scatola aperta. Durante `closing` non si
   fa niente: ci pensa la chiusura gia' avviata. */
function ridisponi(){
  if (state.phase === 'focus' || state.phase === 'review'){
    unfocus(function(){ applyLibrary({ animate: true }); });
    return;
  }
  if (state.phase === 'closing') return;
  applyLibrary({ animate: true });
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
    flash('"' + game.title + '" tolto dalla libreria');
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

  disegnaGiocate(game);

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
  let downAt = 0, downX = 0, downY = 0, lastX = 0, moved = 0, presaT = 0;

  function norm(e){
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  el.addEventListener('pointermove', function(e){
    norm(e);
    pointer.set(state.tx, state.ty);
    if (state.presa){ muoviPresa(); return; }
    // muoversi prima che scatti la presa vuol dire che si sta scorrendo
    if (Math.abs(e.clientX - downX) > 9 || Math.abs(e.clientY - downY) > 9) clearTimeout(presaT);
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

    clearTimeout(presaT);
    if (puoiSpostare()){
      const sopra = pick();
      if (sopra && !sopra.userData.busy){
        presaT = setTimeout(function(){ iniziaPresa(sopra); }, PRESA_MS);
      }
    }
  });

  el.addEventListener('pointerup', function(e){
    clearTimeout(presaT);

    if (state.presa){
      const fermo = Math.abs(e.clientX - downX) <= 9 && Math.abs(e.clientY - downY) <= 9;
      const box = state.presa.box;
      finiscePresa(fermo, fermo);
      state.dragging = false;
      // presa e lasciata senza muoverla: era un clic un po' lungo, e chi
      // lo fa vuole aprire la scatola, non spostarla
      if (fermo && state.phase === 'browse') focusOn(box);
      return;
    }

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

  el.addEventListener('pointercancel', function(){
    clearTimeout(presaT); finiscePresa(true); state.dragging = false;
  });
  el.addEventListener('pointerleave', function(){
    clearTimeout(presaT); finiscePresa(true);
    state.dragging = false; state.tx = 0; state.ty = 0; state.hover = null;
  });

  el.addEventListener('wheel', function(e){
    if (state.phase !== 'browse' || state.presa) return;
    e.preventDefault();
    // la rotella di un mouse da' deltaY, il trackpad di lato da' deltaX:
    // qui muovono la stessa cosa, quindi si prende quello che si muove
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    scrollBy(d * .0022);
  }, { passive: false });

  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ finiscePresa(true); unfocus(); closeAdd(); chiudiPartita(); return; }
    if (e.key === 'Backspace' && LIB.ospitePresso() && state.phase === 'browse'){
      e.preventDefault(); tornaACasa(); return;
    }
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
    '<span aria-hidden="true">&#9003;</span> togli dalla libreria',
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

  /* La ricerca aspetta un attimo prima di rifare lo scaffale: a ogni
     tasto premuto vorrebbe dire ricostruire dodici scatole per lettera. */
  const inp = q('#cerca');
  let ct = 0;
  inp.addEventListener('input', function(){
    clearTimeout(ct);
    ct = setTimeout(function(){ setQuery(inp.value); }, 180);
  });
  inp.addEventListener('keydown', function(e){
    e.stopPropagation();                       // se no Esc chiude anche altro
    if (e.key === 'Escape'){ inp.value = ''; setQuery(''); inp.blur(); }
    if (e.key === 'Enter'){ clearTimeout(ct); setQuery(inp.value); }
  });
  // sullo stretto il campo si prende la testata: vuoto, la restituisce
  inp.addEventListener('blur', function(){
    if (!inp.value.trim()) document.body.classList.remove('cercando');
  });
  q('#cerca-go').addEventListener('click', function(){
    document.body.classList.add('cercando');
    inp.focus();
  });
  q('#cerca-x').addEventListener('click', function(){
    inp.value = ''; setQuery(''); inp.focus();
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

/* Nel menu il nome per esteso, sul pulsante quello corto: la testata e'
   stretta e "ordine di aggiunta" ci stava solo togliendo altro. */
const ETICHETTE = { mio: 'il mio', aggiunta: 'data', nome: 'nome', voto: 'voto' };

function setSort(mode){
  state.sort = mode;
  try { localStorage.setItem('dado-ordine', mode); } catch(e){}
  q('#sort-now').textContent = ETICHETTE[mode] || mode;
  qa('#sortmenu button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sort') === mode);
  });
  q('#sortmenu').classList.remove('on');
  ridisponi();
}

/* --- ricerca ------------------------------------------------------
   Filtrare cambia quali scatole stanno sullo scaffale, non quali sono
   in evidenza: chi cerca "root" vede una libreria con dentro Root, e
   basta. Si torna alla prima libreria, se no restando fermi sulla terza
   ci si ritrova davanti a un mobile vuoto. */
function setQuery(v){
  const nuovo = String(v || '').trim();
  if (nuovo === state.q) return;
  state.q = nuovo;
  document.body.classList.toggle('cerca', !!nuovo);
  state.scrollTo = state.scroll = 0;
  ridisponi();
  if (nuovo && !lista().length) flash('nessun gioco per "' + nuovo + '"');
}

/* Quanti sono. Mentre si cerca dice anche su quanti, se no il numero
   che cala sembra che i giochi siano spariti. */
function updateConta(){
  const tot = LIB.all().length;
  const el = q('#conta');
  if (!el) return;
  el.innerHTML = state.q
    ? '<b>' + lista().length + '</b> <span>di ' + tot + '</span>'
    : '<b>' + tot + '</b> <span>' + (tot === 1 ? 'gioco' : 'giochi') + '</span>';
}

/* --- aggiunta -------------------------------------------------- */
function openAdd(){
  chiudiModifica();
  q('#m-review').value = '';
  q('#m-pub').checked = false;
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
  // gia' pubblicata? la casella dice lo stato, non un desiderio
  q('#m-pub').checked = !!RECE.di(game.bgg);
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
  q('#add-h').innerHTML = 'Aggiungi alla libreria';
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

  /* Il catalogo. Pubblicare vuol dire che quella recensione esce dalla
     collezione di chi l'ha scritta e diventa quella del sito: la legge
     chiunque, anche senza account. Togliere la spunta la ritira.

     Va dopo il salvataggio in libreria, non prima: si pubblica quello
     che si e' scritto, non quello che si sta per scrivere. E se il
     database dice di no il gioco resta comunque sullo scaffale --
     pubblicare e' un'altra cosa dall'averlo. */
  if (game && q('#m-pub')){
    const vuole = q('#m-pub').checked;
    const eraPubblicata = !!RECE.di(game.bgg);
    if (vuole && game.bgg){
      RECE.pubblica(game)
        .then(function(){ flash('recensione pubblicata nel catalogo'); })
        .catch(function(e){ flash('non pubblicata: ' + e.message); });
    } else if (vuole && !game.bgg){
      flash('senza id BGG non si pubblica: e\' la chiave della recensione');
    } else if (!vuole && eraPubblicata){
      RECE.togli(game.bgg)
        .then(function(){ flash('recensione tolta dal catalogo'); })
        .catch(function(e){ flash('non tolta: ' + e.message); });
    }
  }

  inAttesa = null;
  qa('#add-man input[type="text"], #add-man input[type="file"]').forEach(function(i){ i.value = ''; });
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
  const list = lista();
  const i = list.findIndex(function(g){ return g.id === id; });
  if (i < 0) return;
  state.scrollTo = clamp(Math.floor(i / PER_LIB), 0, maxScroll());
}

/* ===============================================================
   IL CATALOGO
   ===============================================================

   Il sito ha due meta'. La prima e' la tua libreria: dodici cubi per
   mobile, in tre dimensioni, una cosa da guardare. La seconda e' il
   catalogo, che sono migliaia di titoli da scorrere -- e per quello un
   elenco piatto batte qualunque mobile. Una riga per gioco: copertina
   a sinistra, scheda a destra, e cliccando si apre la recensione.

   Le due meta' non sono due pagine: sono due modi di guardare, e la
   testata resta la stessa. Il catalogo sta a z2, sopra la scena e
   sotto la barra in alto.

   Le SCHEDE arrivano da fuori (Wikidata oggi, BGG quando ci sara' il
   token). Le RECENSIONI sono nostre e stanno su Supabase, leggibili da
   chiunque: e' quello che rende sensato entrare da ospite. */

const CAT_PAG = 24;
let catVoci = [], catOffset = 0, catFine = false, catCarico = false;

/* Il numero del giro. Le query a Wikidata sono lente -- un paio di
   secondi buoni -- e in quel tempo si fa in fretta a premere "cerca":
   e' il primo gesto di chiunque apra il catalogo e sappia gia' cosa
   vuole. Prima quella ricerca veniva semplicemente ignorata, e il
   catalogo restava li' a mostrare l'elenco di partenza.

   Adesso ogni richiesta prende un numero, e quando una risposta torna
   controlla di essere ancora l'ultima chiesta: se non lo e', si butta
   via da sola senza toccare niente. Una richiesta nuova non aspetta
   quella vecchia, la supera. */
let catGiro = 0;

function catMsg(html, kind){
  const el = q('#cat-msg');
  el.innerHTML = html;
  el.className = kind || '';
}

/* Tre sezioni e due navigazioni che le comandano: quella nella testata
   sugli schermi larghi, quella in basso su quelli stretti, dove arriva
   il pollice. Sono le stesse voci e chiamano la stessa funzione --
   cambia il posto, non il significato. */
function setSezione(s){
  state.sezione = s;
  document.body.classList.toggle('sez-catalogo', s === 'catalogo');
  document.body.classList.toggle('sez-profilo',  s === 'profilo');
  qa('#sezioni button, #tabbar button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sez') === s);
  });
  q('#catalogo').setAttribute('aria-hidden', s === 'catalogo' ? 'false' : 'true');
  q('#profilo').setAttribute('aria-hidden',  s === 'profilo'  ? 'false' : 'true');
  if (s === 'catalogo' && !catVoci.length && !catCarico) catSfoglia(true);
  if (s === 'profilo') apriProfilo();
}

/* Sfogliare: il catalogo si apre su un elenco, non su un campo vuoto.
   Chi arriva senza sapere cosa cercare deve avere qualcosa da
   guardare, se no il catalogo e' una promessa e basta. */
async function catSfoglia(daCapo){
  // "altri giochi" premuto due volte salterebbe una pagina: quello si
  // aspetta, ed e' il motivo per cui il pulsante intanto e' spento
  if (!daCapo && catCarico) return;

  const mio = ++catGiro;
  catCarico = true;
  if (daCapo){ catVoci = []; catOffset = 0; catFine = false; q('#cat-list').innerHTML = ''; }
  q('#cat-piu').disabled = true;
  catMsg(catVoci.length ? 'prendo altri giochi&hellip;' : 'apro il catalogo&hellip;');
  try {
    const voci = await CATALOGO.sfoglia(catOffset, CAT_PAG);
    if (mio !== catGiro) return;          // intanto e' stato chiesto altro
    const da = catVoci.length;
    catOffset += CAT_PAG;
    catFine = voci.length < CAT_PAG;
    catVoci = catVoci.concat(voci);
    disegnaCatalogo(da);
    catNota();
  } catch(e){
    if (mio !== catGiro) return;          // errore di una richiesta superata: non riguarda piu'
    catMsg('Il catalogo non risponde: ' + esc(e.message) +
           '. Wikidata a volte impiega troppo e chiude la richiesta: riprova.', 'warn');
  } finally {
    if (mio === catGiro){
      catCarico = false;
      q('#cat-piu').disabled = false;
    }
  }
}

async function catCerca(){
  const t = q('#cat-q').value.trim();
  if (!t){ catSfoglia(true); return; }

  const mio = ++catGiro;
  catCarico = true;
  catMsg('cerco&hellip;');
  q('#cat-list').innerHTML = '';
  try {
    const voci = await CATALOGO.cerca(t);
    if (mio !== catGiro) return;
    catVoci = voci;
    catFine = true;                       // la ricerca da' quello che da', non si pagina
    disegnaCatalogo(0);
    if (!catVoci.length){
      catMsg('Nessun gioco per <b>' + esc(t) + '</b>. Su Wikidata i giochi da tavolo ' +
             'con un id BGG sono circa 3.400: se e\' recente o poco noto pu&ograve; ' +
             'semplicemente non esserci.');
    } else catNota();
  } catch(e){
    if (mio !== catGiro) return;
    catMsg('Ricerca non riuscita: ' + esc(e.message), 'warn');
  } finally {
    if (mio === catGiro) catCarico = false;
  }
}

/* Da dove arrivano le schede e quante recensioni ci sono. Non e' un
   dettaglio da nascondere: con Wikidata i dati sono magri e a volte
   sbagliati, e chi legge ha diritto di sapere cosa sta guardando. */
async function catNota(){
  const f = await CATALOGO.fonte();
  const guaio = RECE.problema();
  const n = RECE.quante();
  const fonte = f === 'bgg'
    ? 'Schede da <b>BoardGameGeek</b>.'
    : 'Schede da <b>Wikidata</b>: circa 3.400 giochi con id BGG, dati pi&ugrave; ' +
      'magri e quasi mai la copertina vera della scatola.';
  catMsg(fonte + ' ' + (guaio
    ? '<b>Le recensioni non si leggono:</b> ' + esc(guaio) + '.'
    : n + (n === 1 ? ' gioco recensito' : ' giochi recensiti') + ' su questo sito.'));
}

function disegnaCatalogo(da){
  const ul = q('#cat-list');
  const html = catVoci.slice(da).map(function(v, k){ return rigaCatalogo(v, da + k); }).join('');
  if (da) ul.insertAdjacentHTML('beforeend', html);
  else ul.innerHTML = html;
  q('.cat-fondo').classList.toggle('finito', catFine);
}

function rigaCatalogo(v, i){
  const rec = RECE.di(v.bgg);
  const img = CATALOGO.miniaturaElenco(v.immagine, 200);
  const gia = !!v.bgg && LIB.all().some(function(g){ return String(g.bgg) === String(v.bgg); });
  const chi = [v.designer, v.publisher].filter(Boolean).map(esc).join(' &middot; ');
  const spec = [[v.players, 'giocatori'], [v.time, 'minuti'], [v.year, 'anno']]
    .filter(function(x){ return x[0]; })
    .map(function(x){ return '<li><b>' + esc(x[0]) + '</b>' + x[1] + '</li>'; }).join('');

  return '<li data-i="' + i + '">' +
    '<div class="cat-cop">' + (img
      ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<span class="senza">?</span>') + '</div>' +
    '<div class="cat-dati">' +
      '<h3>' + esc(v.title) + (rec ? '<i class="bollo">recensito</i>' : '') + '</h3>' +
      (chi  ? '<p class="cat-chi">' + chi + '</p>' : '') +
      (spec ? '<ul class="cat-spec">' + spec + '</ul>' : '') +
    '</div>' +
    '<div class="cat-azioni">' +
      '<button type="button" class="apri">' + (rec ? 'recensione' : 'scheda') + '</button>' +
      '<button type="button" class="metti dentro-only"' + (gia ? ' disabled' : '') + '>' +
        (gia ? 'ce l\'hai' : 'in libreria') + '</button>' +
    '</div>' +
    '<div class="cat-rec"></div>' +
  '</li>';
}

/* La recensione si apre DENTRO la riga. Una finestra sopra un elenco
   fa perdere il posto in cui si era, e in un catalogo il posto in cui
   si era e' meta' di quello che si sta facendo. */
function apriRiga(li){
  const v = catVoci[parseInt(li.getAttribute('data-i'), 10)];
  if (!v) return;
  const rec = RECE.di(v.bgg);
  const aperta = li.classList.toggle('aperta');
  li.querySelector('.apri').textContent =
    aperta ? 'chiudi' : (rec ? 'recensione' : 'scheda');
  if (!aperta) return;

  const link = v.bgg
    ? '<p><a class="bgg" href="https://boardgamegeek.com/boardgame/' + esc(v.bgg) +
      '/" target="_blank" rel="noopener">scheda su BoardGameGeek &#8599;</a></p>'
    : '';
  li.querySelector('.cat-rec').innerHTML = rec
    ? (rec.score ? '<p class="voto">' + esc(rec.score) + '<i>/10</i></p>' : '') +
      (rec.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('') + link
    : '<p class="vuoto">Non ancora recensito qui. La scheda arriva dalla fonte, ' +
      'la recensione la scriviamo noi.</p>' + link;
}

/* Dal catalogo allo scaffale. Passa dalla stessa strada del modulo di
   aggiunta -- scheda completa, poi copertina -- perche' e' la stessa
   cosa: cambia solo da dove si e' partiti. */
async function mettiInLibreria(v, btn){
  btn.disabled = true;
  const prima = btn.textContent;
  try {
    btn.textContent = 'prendo la scheda...';
    const g = await CATALOGO.dettagli(v);
    const gioco = {
      title: g.title, bgg: parseInt(g.bgg, 10) || 0,
      designer: g.designer || '', publisher: g.publisher || '',
      year: g.year || '', players: g.players || '', time: g.time || '',
      score: g.score || '', art: 'generic'
    };
    if (g.immagine){
      btn.textContent = 'scarico la copertina...';
      // se non arriva non e' un errore: si usa la copertina disegnata
      try { gioco.cover = await CATALOGO.copertina(g); } catch(err){}
    }
    const messo = LIB.add(gioco);
    if (cabGroup){                     // un ospite non ha nessuna scena da aggiornare
      await loadCovers(true);
      applyLibrary({ animate: true });
      goToGame(messo.id);
    }
    btn.textContent = 'ce l\'hai';
    flash('"' + messo.title + '" e\' sullo scaffale');
  } catch(e){
    btn.disabled = false;
    btn.textContent = prima;
    flash('non aggiunto: ' + e.message);
  }
}

function bindCatalogo(){
  q('#cat-go').addEventListener('click', catCerca);
  q('#cat-q').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') catCerca();
  });
  q('#cat-tutti').addEventListener('click', function(){
    q('#cat-q').value = '';
    catSfoglia(true);
  });
  q('#cat-piu').addEventListener('click', function(){ catSfoglia(false); });

  // un ascoltatore solo sull'elenco: le righe si rifanno di continuo e
  // attaccarne uno per riga vorrebbe dire rimetterli a ogni pagina
  q('#cat-list').addEventListener('click', function(e){
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const metti = e.target.closest('.metti');
    if (metti){
      mettiInLibreria(catVoci[parseInt(li.getAttribute('data-i'), 10)], metti);
      return;
    }
    apriRiga(li);
  });
}

/* ===============================================================
   IL PROFILO
   ===============================================================

   La prima parte del sito che non parla di giochi, ma di chi li gioca:
   un nick, una faccia, un codice per essere trovati, e delle persone.

   La faccia e' un meeple disegnato su canvas come tutto il resto del
   sito. Niente immagini caricate: nessun bucket, nessuna moderazione,
   e una faccia c'e' fin dal primo secondo. Per un sito con degli amici
   dentro e' una semplificazione, non una rinuncia. */

let labAvatar = null;              // la faccia in prova nel laboratorio

function disegnaFaccia(el, av, lato){
  if (!el) return;
  const c = ART.avatar(av, lato || 160);
  el.width = c.width; el.height = c.height;
  el.getContext('2d').drawImage(c, 0, 0);
}

function apriProfilo(){
  /* Anche quando il profilo non si carica, i blocchi sotto vanno
     disegnati lo stesso: hanno un guasto loro da raccontare, e tre
     titoli seguiti dal vuoto non spiegano niente a nessuno. */
  PARTITE.caricaGiocatori().then(disegnaGiocatori);
  PARTITE.carica().then(disegnaPartite);

  if (!PROFILO.mio()){
    proMsg('#pro-amici-msg', esc(PROFILO.problema() || 'profilo non disponibile'), true);
    return;
  }
  disegnaProfilo();
  PROFILO.caricaAmici().then(function(){
    disegnaAmici();
    disegnaGiocatori();          // le proposte "dai tuoi amici" arrivano da li'
  });
}

function proMsg(sel, html, male){
  const el = q(sel);
  el.innerHTML = html;
  el.className = 'pro-msg' + (male ? ' warn' : '');
}

function disegnaProfilo(){
  const p = PROFILO.mio();
  if (!p) return;
  q('#pro-nick').textContent = p.nick || p.nome || 'senza nome';
  q('#pro-mail').textContent = AUTH.stato().email || p.nome || '';
  // il codice si legge a gruppi di quattro: si detta al telefono
  q('#pro-codice').textContent = p.codice
    ? p.codice.replace(/(.{4})(.{4})/, '$1 $2') : '--';
  disegnaFaccia(q('#pro-avatar'), p.avatar, 160);
  disegnaFaccia(q('#tab-faccia'), p.avatar, 44);
}

/* --- il laboratorio della faccia ------------------------------- */
function apriLab(){
  const p = PROFILO.mio();
  if (!p) return;
  labAvatar = Object.assign({ corpo: PROFILO.CORPI[0], fondo: PROFILO.FONDI[0], segno: 0 }, p.avatar);
  q('#pro-faccia-lab').hidden = false;
  disegnaPastiglie();
}

function chiudiLab(){
  q('#pro-faccia-lab').hidden = true;
  labAvatar = null;
  disegnaProfilo();                 // torna quella salvata, se la prova non e' piaciuta
}

function disegnaPastiglie(){
  const gruppo = function(sel, valori, campo, testo){
    q(sel).innerHTML = valori.map(function(v){
      const scelto = String(labAvatar[campo]) === String(v) ? ' class="on"' : '';
      const stile = testo ? '' : ' style="background:' + esc(v) + '"';
      return '<button type="button" data-v="' + esc(v) + '"' + scelto + stile + '>' +
             (testo ? (v || '&mdash;') : '') + '</button>';
    }).join('');
    qa(sel + ' button').forEach(function(b){
      b.addEventListener('click', function(){
        const v = b.getAttribute('data-v');
        labAvatar[campo] = testo ? (parseInt(v, 10) || 0) : v;
        disegnaPastiglie();
      });
    });
  };
  gruppo('#lab-corpi', PROFILO.CORPI, 'corpo', false);
  gruppo('#lab-fondi', PROFILO.FONDI, 'fondo', false);
  gruppo('#lab-segni', [0,1,2,3,4,5,6], 'segno', true);
  // l'anteprima e' la faccia grande in cima: si prova sul posto vero
  disegnaFaccia(q('#pro-avatar'), labAvatar, 160);
}

/* --- gli amici -------------------------------------------------- */
function disegnaAmici(){
  const elenco = function(sel, gente, azioni, etichetta){
    q(sel).innerHTML = gente.map(function(x){
      return '<li data-id="' + esc(x.id) + '">' +
        '<canvas width="40" height="40" aria-hidden="true"></canvas>' +
        '<span class="chi"><b>' + esc(x.profilo.nick || x.profilo.nome || 'senza nome') + '</b>' +
        (etichetta ? '<span>' + etichetta + '</span>' : '') + '</span>' +
        '<span class="fa">' + azioni + '</span></li>';
    }).join('');
    qa(sel + ' li').forEach(function(li, i){
      disegnaFaccia(li.querySelector('canvas'), gente[i].profilo.avatar, 40);
    });
  };

  elenco('#pro-richieste', PROFILO.daAccettare(),
    '<button type="button" class="si" data-fa="accetta">accetta</button>' +
    '<button type="button" class="no" data-fa="togli">no</button>',
    'ti ha chiesto l\'amicizia');

  elenco('#pro-amici', PROFILO.amici(),
    '<button type="button" data-fa="libreria">la sua libreria</button>' +
    '<button type="button" class="no" data-fa="togli">togli</button>', '');

  elenco('#pro-attesa', PROFILO.inAttesa(),
    '<button type="button" class="no" data-fa="togli">ritira</button>',
    'richiesta mandata');

  if (PROFILO.problema()){ proMsg('#pro-amici-msg', esc(PROFILO.problema()), true); return; }
  const n = PROFILO.amici().length;
  proMsg('#pro-amici-msg', n
    ? '<b>' + n + '</b> ' + (n === 1 ? 'amico' : 'amici') + '.'
    : 'Nessun amico, per ora. Passagli il tuo codice, o chiedi il loro.');
}

/* Una casella sola per il codice e per l'email: chi incolla qualcosa
   non vuole prima dichiarare che cosa sta incollando. Se c'e' una
   chiocciola e' un indirizzo, se no e' un codice. */
async function chiediAmico(){
  const v = q('#ami-q').value.trim();
  if (!v) return;
  const b = q('#ami-go');
  b.disabled = true;
  proMsg('#ami-msg', 'chiedo&hellip;');
  try {
    const r = v.indexOf('@') > 0 ? await PROFILO.chiediPerEmail(v)
                                 : await PROFILO.chiediPerCodice(v);
    proMsg('#ami-msg', esc(r.testo), r.esito === 'nessuno' || r.esito === 'te stesso');
    if (r.esito === 'chiesta' || r.esito === 'inviata') q('#ami-q').value = '';
    disegnaAmici();
  } catch(e){
    proMsg('#ami-msg', 'non riuscito: ' + esc(e.message), true);
  }
  b.disabled = false;
}

/* --- il nick ----------------------------------------------------
   Si sceglie al primo accesso e prima di tutto il resto: senza nick
   non sei trovabile da nessuno, e il profilo diventa un modulo vuoto
   che nessuno compilerebbe mai. */
function suggerisciNick(p){
  const n = (p && p.nome) || '';
  return n.split(' ')[0].replace(/[^\w \-.']/g, '').slice(0, 20);
}

function apriNick(cambio){
  const p = PROFILO.mio();
  if (!p) return;
  q('#nick-q').value = cambio ? (p.nick || '') : suggerisciNick(p);
  q('#nick-msg').textContent = '';
  q('#nick').classList.add('on');
  q('#nick').setAttribute('aria-hidden', 'false');
  setTimeout(function(){ q('#nick-q').focus(); q('#nick-q').select(); }, 60);
}

async function salvaNickDaModulo(){
  const msg = q('#nick-msg'), b = q('#nick-ok');
  b.disabled = true;
  msg.className = 'ok';
  msg.textContent = 'un attimo\u2026';
  try {
    await PROFILO.salvaNick(q('#nick-q').value);
    q('#nick').classList.remove('on');
    q('#nick').setAttribute('aria-hidden', 'true');
    disegnaProfilo();
    flash('ciao, ' + PROFILO.mio().nick);
  } catch(e){
    msg.className = '';
    msg.textContent = e.message;
  }
  b.disabled = false;
}

function bindProfilo(){
  qa('#sezioni button, #tabbar button').forEach(function(b){
    b.addEventListener('click', function(){ setSezione(b.getAttribute('data-sez')); });
  });

  q('#pro-cambia').addEventListener('click', apriLab);
  q('#lab-annulla').addEventListener('click', chiudiLab);
  q('#lab-salva').addEventListener('click', async function(){
    const av = labAvatar;
    try { await PROFILO.salvaAvatar(av); flash('faccia salvata'); }
    catch(e){ flash('faccia non salvata: ' + e.message); }
    chiudiLab();
  });

  q('#pro-copia').addEventListener('click', function(){
    const cod = (PROFILO.mio() || {}).codice || '';
    if (!cod) return;
    const aMano = function(){
      // senza appunti resta selezionarlo: copiare e' un gesto che
      // l'utente sa fare, trovare il testo da copiare e' il problema
      const r = document.createRange();
      r.selectNodeContents(q('#pro-codice'));
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
      flash('selezionato: copialo tu');
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(cod)
        .then(function(){ flash('codice copiato'); })
        .catch(aMano);
    } else aMano();
  });

  q('#pro-rinomina').addEventListener('click', function(){ apriNick(true); });
  q('#vis-torna').addEventListener('click', tornaACasa);

  /* Uscire sta anche qui perche' su schermo stretto la testata non ha
     piu' posto per dirlo. E' lo stesso gesto del pulsante in alto: la
     collezione di prima non e' piu' tua e si riparte dall'accesso. */
  armaBottone(q('#pro-esci'), 'esci dall\u2019account', 'sicuro? tocca ancora', async function(){
    await AUTH.esci();
    LIB.scollega();
    location.reload();
  });

  q('#ami-go').addEventListener('click', chiediAmico);
  q('#ami-q').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') chiediAmico();
  });

  q('#nick-ok').addEventListener('click', salvaNickDaModulo);
  q('#nick-q').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') salvaNickDaModulo();
  });

  // un ascoltatore per elenco: le righe si rifanno a ogni cambiamento
  ['#pro-richieste', '#pro-amici', '#pro-attesa'].forEach(function(sel){
    q(sel).addEventListener('click', async function(e){
      const b = e.target.closest('button[data-fa]');
      if (!b) return;
      const id = b.closest('li').getAttribute('data-id');
      const fa = b.getAttribute('data-fa');
      b.disabled = true;
      try {
        if (fa === 'libreria'){
          const a = PROFILO.amici().find(function(x){ return x.id === id; });
          b.disabled = false;
          await visitaLibreria(id, a && (a.profilo.nick || a.profilo.nome));
          return;
        }
        if (fa === 'accetta') await PROFILO.accetta(id);
        if (fa === 'togli')   await PROFILO.togli(id);
        disegnaAmici();
      } catch(err){
        b.disabled = false;
        flash('non riuscito: ' + err.message);
      }
    });
  });
}

/* ===============================================================
   GIOCATORI E PARTITE
   ===============================================================

   Lo stesso modulo si apre da due posti: dalla scatola aperta, che e'
   il momento in cui hai appena finito di giocare, e dal profilo, che
   e' quando rimetti in ordine. Cambia solo se il gioco arriva gia'
   scritto o va scelto. */

let paCorrente = null;             // la partita in lavorazione

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
              'luglio','agosto','settembre','ottobre','novembre','dicembre'];

function dataIt(iso){
  const p = String(iso || '').split('-');
  if (p.length !== 3) return '';
  return parseInt(p[2], 10) + ' ' + MESI[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function oggiIso(){
  const d = new Date();
  const due = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
}

/* Una serata: il gioco e il quando in alto, chi c'era sotto. Il
   vincitore in ocra, che nel resto del sito e' gia' il colore di cio'
   che conta. */
function rigaGiocata(p, conTitolo){
  const quando = p.giocata_il ? dataIt(p.giocata_il) : '';
  const ora = p.ora ? String(p.ora).slice(0, 5) : '';
  const chi = (p.chi || []).map(function(x){
    return '<i class="' + (x.vincitore ? 'vince' : '') + '">' + esc(x.nome) + '</i>';
  }).join(', ');
  return '<li data-id="' + esc(p.id) + '">' +
    '<span class="gio-testa">' +
      (conTitolo ? '<b>' + esc(p.titolo) + '</b>' : '') +
      (quando ? '<span>' + esc(quando) + (ora ? ' &middot; ' + esc(ora) : '') + '</span>' : '') +
    '</span>' +
    (chi ? '<p class="gio-chi">' + chi + '</p>' : '') +
  '</li>';
}

// le partite di quel gioco, nel pannello della recensione
function disegnaGiocate(game){
  const el = q('#p-giocate');
  if (!el) return;
  const g = (game && state.dentro && !PARTITE.problema())
    ? PARTITE.diGioco(game.bgg, game.title) : [];
  el.innerHTML = g.length
    ? '<p class="eyebrow">le tue partite</p><ul class="giocate">' +
      g.slice(0, 6).map(function(p){ return rigaGiocata(p, false); }).join('') + '</ul>'
    : '';
}

function disegnaPartite(){
  const el = q('#pro-partite');
  if (!el) return;
  const tutte = PARTITE.tutte();
  el.innerHTML = tutte.map(function(p){ return rigaGiocata(p, true); }).join('');

  if (PARTITE.problema()){ proMsg('#par-msg', esc(PARTITE.problema()), true); return; }
  if (!tutte.length){
    proMsg('#par-msg', 'Nessuna partita segnata. Si segna da qui, oppure dalla scatola ' +
                       'del gioco appena finito.');
    return;
  }
  // chi vince di piu': due righe, non una classifica intera
  const cl = PARTITE.classifica().slice(0, 3).map(function(x){
    return '<b>' + esc(x.nome) + '</b> ' + x.vinte + '/' + x.partite;
  }).join(' &middot; ');
  proMsg('#par-msg', tutte.length + (tutte.length === 1 ? ' partita' : ' partite') +
                     '. ' + cl);
}

function disegnaGiocatori(){
  const el = q('#pro-giocatori');
  if (!el) return;
  const g = PARTITE.giocatori();
  el.innerHTML = g.map(function(x){
    return '<li data-id="' + esc(x.id) + '">' +
      '<span class="chi"><b>' + esc(x.nome) + '</b>' +
      (x.amico ? '<span>amico sul sito</span>' : '') + '</span>' +
      '<span class="fa"><button type="button" class="no" data-fa="via">togli</button></span>' +
    '</li>';
  }).join('');

  if (PARTITE.problema()){ proMsg('#gio-msg', esc(PARTITE.problema()), true); return; }
  // gli amici che non sono ancora al tavolo: proporli evita di riscriverli
  const da = PARTITE.amiciDaAggiungere();
  proMsg('#gio-msg', da.length
    ? 'Dai tuoi amici: ' + da.map(function(a){
        return '<button type="button" class="pro-lin" data-amico="' + esc(a.id) + '">' +
               esc(a.profilo.nick || a.profilo.nome || 'senza nome') + '</button>';
      }).join(' ')
    : '');
}

/* --- l'editor --------------------------------------------------- */
function apriPartita(dati){
  if (PARTITE.problema()){ flash(PARTITE.problema()); return; }
  paCorrente = Object.assign({ id: null, bgg: '', titolo: '', giocata_il: oggiIso(),
                               ora: '', note: '', chi: [] }, dati || {});
  paCorrente.chi = (paCorrente.chi || []).map(function(x){ return Object.assign({}, x); });

  q('#pa-h').textContent = paCorrente.id ? 'Correggi la partita' : 'Segna una partita';
  q('#pa-titolo').value = paCorrente.titolo || '';
  q('#pa-bgg').value    = paCorrente.bgg || '';
  q('#pa-data').value   = paCorrente.giocata_il || '';
  q('#pa-ora').value    = paCorrente.ora ? String(paCorrente.ora).slice(0, 5) : '';
  q('#pa-note').value   = paCorrente.note || '';
  q('#pa-togli').hidden = !paCorrente.id;
  q('#pa-msg').textContent = '';

  disegnaTavolo();
  q('#partitalayer').classList.add('on');
  q('#partitalayer').setAttribute('aria-hidden', 'false');
  if (!paCorrente.titolo) q('#pa-titolo').focus();
}

function chiudiPartita(){
  q('#partitalayer').classList.remove('on');
  q('#partitalayer').setAttribute('aria-hidden', 'true');
  paCorrente = null;
}

function disegnaTavolo(){
  if (!paCorrente) return;
  q('#pa-chi').innerHTML = paCorrente.chi.map(function(x, i){
    return '<li data-i="' + i + '">' +
      '<span class="nome">' + esc(x.nome) + '</span>' +
      '<input class="pos" type="text" inputmode="numeric" maxlength="2" ' +
        'value="' + esc(x.posizione == null ? '' : x.posizione) + '" ' +
        'placeholder="&ndash;" aria-label="posizione di ' + esc(x.nome) + '">' +
      '<button type="button" class="vince' + (x.vincitore ? ' on' : '') +
        '" data-fa="vince">vince</button>' +
      '<button type="button" class="via" data-fa="via" aria-label="togli">&times;</button>' +
    '</li>';
  }).join('');

  // i salvati che non sono gia' al tavolo
  const alTavolo = {};
  paCorrente.chi.forEach(function(x){ alTavolo[x.nome] = true; });
  const liberi = PARTITE.giocatori().filter(function(g){ return !alTavolo[g.nome]; });
  q('#pa-scelta').innerHTML = '<option value="">dai salvati&hellip;</option>' +
    liberi.map(function(g){
      return '<option value="' + esc(g.id) + '">' + esc(g.nome) + '</option>';
    }).join('');
}

function metteAlTavolo(nome, idGiocatore){
  const t = String(nome || '').trim();
  if (!t) return;
  if (paCorrente.chi.some(function(x){ return x.nome === t; })){
    q('#pa-msg').textContent = t + ' e\' gia\' al tavolo';
    return;
  }
  paCorrente.chi.push({ nome: t, giocatore: idGiocatore || null,
                        posizione: null, vincitore: false });
  q('#pa-msg').textContent = '';
  disegnaTavolo();
}

async function salvaPartita(){
  if (!paCorrente) return;
  const b = q('#pa-salva');
  paCorrente.titolo = q('#pa-titolo').value;
  paCorrente.bgg    = q('#pa-bgg').value;
  paCorrente.giocata_il = q('#pa-data').value || null;
  paCorrente.ora    = q('#pa-ora').value || null;
  paCorrente.note   = q('#pa-note').value.trim() || null;

  b.disabled = true;
  try {
    await PARTITE.salva(paCorrente);
    chiudiPartita();
    disegnaPartite();
    disegnaGiocate(state.focused && state.focused.userData.game);
    flash('partita segnata');
  } catch(e){
    q('#pa-msg').textContent = 'non salvata: ' + e.message;
  }
  b.disabled = false;
}

/* --- la libreria di un amico -------------------------------------
   La stessa scena, gli stessi gesti, la stessa recensione che si apre:
   cambia solo che non si tocca niente. Fare una schermata a parte per
   guardare una collezione avrebbe voluto dire rifare da capo l'unica
   cosa che questo sito sa fare bene. */
async function visitaLibreria(id, nick){
  const chi = nick || 'un amico';
  flash('apro la libreria di ' + chi);
  try {
    await LIB.visita(id, nick);
  } catch(e){
    flash('non riesco ad aprirla: ' + e.message);
    return;
  }
  document.body.classList.add('visita');
  q('#vis-chi').textContent = chi;
  q('#visita').setAttribute('aria-hidden', 'false');

  // la ricerca era sulla tua libreria: qui non vuol dire piu' niente
  state.q = ''; q('#cerca').value = '';
  document.body.classList.remove('cerca');
  state.scrollTo = state.scroll = 0;

  setSezione('collezione');
  await loadCovers();
  applyLibrary({});
  if (!LIB.all().length) flash('la libreria di ' + chi + ' e\' ancora vuota');
}

async function tornaACasa(){
  if (!LIB.ospitePresso()) return;
  LIB.torna();
  document.body.classList.remove('visita');
  q('#visita').setAttribute('aria-hidden', 'true');
  state.scrollTo = state.scroll = 0;
  await loadCovers();
  applyLibrary({});
}

function bindPartite(){
  q('#pa-x').addEventListener('click', chiudiPartita);
  q('#pa-salva').addEventListener('click', salvaPartita);

  armaBottone(q('#pa-togli'), 'elimina', 'sicuro? tocca ancora', async function(){
    if (!paCorrente || !paCorrente.id) return;
    try {
      await PARTITE.togli(paCorrente.id);
      chiudiPartita();
      disegnaPartite();
      disegnaGiocate(state.focused && state.focused.userData.game);
      flash('partita eliminata');
    } catch(e){ flash('non eliminata: ' + e.message); }
  });

  q('#pa-piu').addEventListener('click', function(){
    const sel = q('#pa-scelta');
    if (sel.value){
      const g = PARTITE.giocatori().find(function(x){ return x.id === sel.value; });
      if (g) metteAlTavolo(g.nome, g.id);
      sel.value = '';
      return;
    }
    metteAlTavolo(q('#pa-nuovo').value, null);
    q('#pa-nuovo').value = '';
  });
  q('#pa-nuovo').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') q('#pa-piu').click();
  });
  qa('#partitalayer input, #partitalayer textarea').forEach(function(i){
    i.addEventListener('keydown', function(e){ e.stopPropagation(); });
  });

  // il tavolo: un ascoltatore solo, le righe si rifanno di continuo
  q('#pa-chi').addEventListener('click', function(e){
    const b = e.target.closest('button[data-fa]');
    if (!b || !paCorrente) return;
    const i = parseInt(b.closest('li').getAttribute('data-i'), 10);
    if (b.getAttribute('data-fa') === 'via') paCorrente.chi.splice(i, 1);
    else paCorrente.chi[i].vincitore = !paCorrente.chi[i].vincitore;
    disegnaTavolo();
  });
  q('#pa-chi').addEventListener('input', function(e){
    if (!e.target.classList.contains('pos') || !paCorrente) return;
    const i = parseInt(e.target.closest('li').getAttribute('data-i'), 10);
    const v = e.target.value.trim();
    paCorrente.chi[i].posizione = v === '' ? null : (parseInt(v, 10) || null);
  });

  /* Dalla scatola aperta: il gioco arriva gia' scritto, ed e' il punto
     -- appena finito di giocare non si ha voglia di ricercarlo. */
  q('#p-segna').addEventListener('click', function(e){
    e.stopPropagation();
    const g = state.focused && state.focused.userData.game;
    if (!g) return;
    apriPartita({ bgg: g.bgg || '', titolo: g.title });
  });
  q('#par-nuova').addEventListener('click', function(){ apriPartita(null); });

  // riaprire una partita gia' segnata, da tutti e due gli elenchi
  ['#pro-partite', '#p-giocate'].forEach(function(sel){
    q(sel).addEventListener('click', function(e){
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      e.stopPropagation();
      const p = PARTITE.tutte().find(function(x){ return x.id === li.getAttribute('data-id'); });
      if (p) apriPartita(p);
    });
  });

  q('#gio-piu').addEventListener('click', async function(){
    const v = q('#gio-nuovo').value;
    if (!v.trim()) return;
    try { await PARTITE.aggiungiGiocatore(v, null); q('#gio-nuovo').value = ''; }
    catch(e){ proMsg('#gio-msg', esc(e.message), true); return; }
    disegnaGiocatori();
  });
  q('#gio-nuovo').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') q('#gio-piu').click();
  });

  q('#pro-giocatori').addEventListener('click', async function(e){
    const b = e.target.closest('button[data-fa="via"]');
    if (!b) return;
    b.disabled = true;
    try { await PARTITE.togliGiocatore(b.closest('li').getAttribute('data-id')); }
    catch(err){ b.disabled = false; flash('non tolto: ' + err.message); return; }
    disegnaGiocatori();
  });

  // "dai tuoi amici: Tizio Caio" -- un clic e sono giocatori salvati
  q('#gio-msg').addEventListener('click', async function(e){
    const b = e.target.closest('button[data-amico]');
    if (!b) return;
    b.disabled = true;
    try { await PARTITE.aggiungiGiocatore(b.textContent, b.getAttribute('data-amico')); }
    catch(err){ proMsg('#gio-msg', esc(err.message), true); return; }
    disegnaGiocatori();
  });
}

/* ===============================================================
   CICLO DI RENDERING
   =============================================================== */
function updateBoxes(dt){
  for (let i = 0; i < boxes.length; i++){
    const b = boxes[i], u = b.userData;
    if (u.busy){ u.cover.emissiveIntensity = .10; continue; }

    // il cubo di destinazione si annuncia alzando la scatola che ci sta
    // gia': e' quella che sta per scambiarsi di posto
    const mirato = !!(state.presa && state.presa.mirBox === b);
    const want = ((state.hover === b && state.phase === 'browse') || mirato) ? 1 : 0;
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

  /* Fuori dalla libreria la scena e' coperta da una pagina piatta. Il
     ciclo non si ferma -- non si e' mai fermato -- ma non si disegna
     quello che nessuno vede, e soprattutto non si fa un raycast per
     fotogramma mentre l'utente sta scorrendo tutt'altro. */
  if (state.sezione !== 'collezione') return;

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

  if (state.phase === 'browse' && !state.dragging && !state.presa){
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
/* Risponde con la scelta: 'entra' o 'ospite'. Serve a boot(), perche'
   le due strade sono diverse davvero -- un ospite non ha nessuna
   libreria, quindi non c'e' nessuna scena 3D da costruire. */
function gate(giaDentro){
  if (giaDentro){
    q('#gate').classList.add('gone');
    return Promise.resolve('entra');
  }
  return new Promise(function(res){
    qa('#gate [data-gate]').forEach(function(b){
      b.addEventListener('click', async function(){
        const scelta = b.getAttribute('data-gate');
        if (scelta === 'entra' && AUTH.attivo()){
          b.disabled = true;
          try {
            await AUTH.entra();      // se ne va su Google: la pagina viene lasciata
            return;
          } catch(e){
            b.disabled = false;
            q('#gate-note').textContent = 'Accesso non riuscito: ' + e.message +
              ' -- puoi comunque guardare il catalogo.';
            return;
          }
        }
        q('#gate').classList.add('gone');
        res(scelta);
      });
    });
  });
}

async function boot(){
  try { state.sort = localStorage.getItem('dado-ordine') || 'aggiunta'; } catch(e){}
  q('#sort-now').textContent = ETICHETTE[state.sort] || state.sort;
  LIB.suErrore(flash);                    // le scritture rifiutate le racconta il flash
  buildFlatList();

  // Chi torna da Google ha gia' la sessione: si salta il cancello.
  const chi = await AUTH.init();
  const scelta = await gate(chi.dentro);
  const t0 = performance.now();
  setMode(chi);
  bindCatalogo();
  bindProfilo();            // e' anche chi collega le due navigazioni
  bindPartite();
  RECE.carica();            // parte per conto suo: la aspetta solo il catalogo
  await PROFILO.carica();   // questo invece serve subito: puo' chiedere il nick
  // le partite servono al pannello della recensione, che si apre presto
  PARTITE.carica().then(function(){ PARTITE.caricaGiocatori(); });

  /* L'ospite va dritto al catalogo. Non e' una scorciatoia: non ha
     nessuna collezione, quindi non c'e' niente da costruire in tre
     dimensioni. Montare la scena per coprirla subito dopo sarebbe
     mezzo secondo di lavoro buttato, e un mobile che non e' di
     nessuno in mezzo allo schermo. */
  if (scelta === 'ospite'){
    document.body.classList.add('ospite');
    LIB.scollega();
    bindTools();
    setSezione('catalogo');
    setProg(1, 'ci siamo');
    document.body.classList.add('ready');
    return;
  }

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
  disegnaProfilo();

  // Primo accesso: il nick prima di tutto. La scena intanto ha finito
  // di caricare dietro, cosi' chi lo sceglie trova gia' la libreria.
  if (PROFILO.serveNick()) apriNick(false);

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
