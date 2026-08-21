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

/* Sopra il mobile non c'e' solo aria: ci sono gli oggetti che poggiano
   sul cielo e la targhetta col nome. Il quadro deve comprenderli, se no
   su schermo largo -- dove a comandare e' l'altezza -- il nome della
   libreria finisce fuori dallo schermo e non serve a niente.
   Costa un mobile un po' piu' piccolo; il nome vale il prezzo. */
const SOPRA = 2.75;
const CIMA_VISTA = KAL.topY + SOPRA;
const CENTRO_Y = (CIMA_VISTA + SUOLO) / 2;
/* La camera guarda un filo piu' in basso del centro geometrico, cosi' il
   mobile sale nel quadro. Prima era centrato sull'ingombro compresa
   l'aria sopra la cima, e con i suggerimenti tolti da sotto restava
   seduto in fondo allo schermo -- il bordo inferiore usciva addirittura
   dal quadro di una trentina di pixel su 800.

   Il margine di `layout()` tiene conto dello spostamento, se no
   alzando il mobile gli si taglia la cima. */
const ALZA = .85;
const VISTA_Y = CENTRO_Y - ALZA;

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
  gruppo: '',                  // l'etichetta con cui si sta filtrando, '' se nessuna
  soloPreferiti: false,        // mostra solo i giochi segnati
  vista: 'gruppi',             // come si guarda l'elenco: 'gruppi' o 'tutti'
  presa: null,                 // la scatola che si sta spostando a mano
  zoom: 1,                     // quanto la camera e' arretrata: 1 = normale
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
let hemiLight, ambLight, fillLight;
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

/* Le ombre non si ridisegnano a ogni fotogramma.

   La mappa e' 2048x2048 e la passata che la riempie costava 316 draw
   call sulle 574 di un frame -- piu' della meta' del lavoro -- per
   rifare sessanta volte al secondo un'ombra identica a quella di
   prima: il mobile sta fermo, gli arredi stanno fermi, e la luce di
   finestra segue `camBase`, che cambia solo scorrendo fra le librerie.
   L'ondeggio della camera col puntatore non la tocca: quello muove
   `camera.position`, non `camBase`.

   Quindi la mappa si rifa' a richiesta. `rifaiOmbre()` prenota DUE
   fotogrammi, non uno: l'ultimo passo di un'animazione porta l'oggetto
   nella posa finale proprio nel frame in cui l'animazione esce dalla
   coda, e con una prenotazione sola quella posa resterebbe con l'ombra
   della posa precedente. */
let ombreDaRifare = 2;
function rifaiOmbre(){ ombreDaRifare = 2; }

const easeOut   = p => 1 - Math.pow(1-p, 3);
const easeInOut = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
const lerp      = (a,b,t) => a + (b-a)*t;
const clamp     = (v,a,b) => v < a ? a : (v > b ? b : v);

/* --- utilita' -------------------------------------------------- */
/* Le icone stanno qui e non nei glifi Unicode: quelli li disegna il
   sistema operativo, quindi una faccia di sole su Windows e su un
   telefono sono due disegni diversi -- ed era la parte piu'
   visibilmente scoordinata dell'interfaccia. Tratto 1.6, estremi
   tondi, riquadro 24: tutte uguali. */
const ICO = {
  /* Tre punti e non tre righe: le tre righe dicono "un elenco", i tre
     punti dicono "altro" -- ed e' altro quello che c'e' dentro. */
  menu:     '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
              '<circle cx="12" cy="5.5" r="1.6" fill="currentColor"/>' +
              '<circle cx="12" cy="12"  r="1.6" fill="currentColor"/>' +
              '<circle cx="12" cy="18.5" r="1.6" fill="currentColor"/></svg>',
  cestino:  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M5 7h14M10 7V5h4v2M6.5 7l.8 12h9.4l.8-12M10.5 10.5v5.5M13.5 10.5v5.5"/></svg>',
  chiudi:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>',
  corona:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.6 9H5.6zM5.6 20h12.8"/></svg>',
  maniglia: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 9h12M6 15h12"/></svg>',
  /* Una libreria a cubi 2x2 con i piedi: e' il soggetto del sito, e
     serve in due posti -- il pannello del mobile e "vai allo
     scaffale". Due comandi che portano allo stesso oggetto portano la
     stessa figura. */
  scaffale: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 3.5h16v16H4zM4 11.5h16M12 3.5v16M7 19.5v2M17 19.5v2"/></svg>',
  /* Una stella sola, vuota. Piena la fa il CSS su `aria-pressed`, come
     per il cuore: due disegni per due stati vorrebbe dire tenerli
     uguali a mano per sempre. */
  stella:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>',
  dentro:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 3.5v9M8.5 9l3.5 3.5L15.5 9M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',
  fuori:    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 12.5v-9M8.5 7l3.5-3.5L15.5 7M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>'
};

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

/* Quello che e' segnato `__comune` NON si butta via: e' condiviso da
   tutti gli arredi (vedi `comune`), e liberarlo qui vorrebbe dire che
   alla prima ricerca -- che ricostruisce il contorno -- i libri e i
   dadi restano senza texture. */
function killGroup(g, deep){
  if (!g) return;
  g.traverse(function(o){
    if (o.geometry && !o.geometry.__comune) o.geometry.dispose();
    if (deep && o.material){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function(m){
        if (!m || m.__comune) return;
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
/* Da una tinta sola alle tre che servono a un legno: la base, la vena
   scura e il riflesso chiaro. Sceglierne tre a mano per ogni essenza
   voleva dire diciotto colori da tenere in accordo; qui la vena e' la
   base scurita e il riflesso e' la base verso il bianco, che e' come
   funziona il legno vero. */
const esa = c => '#' + c.getHexString();

function legno(tinta, o){
  const c = new THREE.Color(tinta);
  return makeWoodMat(Object.assign({
    base:  esa(c),
    dark:  esa(c.clone().multiplyScalar(.74)),
    light: esa(c.clone().lerp(new THREE.Color(0xffffff), .32))
  }, o));
}

/* I materiali sono UNO PER TINTA, non uno solo: da quando ogni mobile
   puo' avere il suo legno, in scena ce ne possono essere due o tre
   diversi insieme. Si tengono in cache perche' le tinte vengono da una
   tavolozza chiusa -- al massimo sei corredi -- e rigenerare tre
   canvas a ogni ricostruzione del mobile si sentirebbe. */
const MATS_PER_TINTA = {};

function matsDi(tinta){
  if (MATS_PER_TINTA[tinta]) return MATS_PER_TINTA[tinta];
  const c = new THREE.Color(tinta);
  MATS_PER_TINTA[tinta] = {
    vert:  legno(tinta, { lines:220, knots:2, rough:.70, bump:.05, rot: Math.PI/2 }),
    // i ripiani un filo piu' chiari dei montanti, e con la vena girata:
    // e' cosi' che si vede su un mobile vero
    orizz: legno(esa(c.clone().lerp(new THREE.Color(0xffffff), .05)),
                 { lines:220, knots:2, rough:.70, bump:.05 }),
    // lo schienale sta in ombra: parte gia' piu' scuro
    fondo: legno(esa(c.clone().multiplyScalar(.88)),
                 { lines:160, knots:1, rough:.86, bump:.02 })
  };
  return MATS_PER_TINTA[tinta];
}

/* Lo stile di un mobile: il suo, se ce l'ha, se no quello della stanza.
   Luce, muro e pavimento restano della stanza -- quelli SONO la stanza,
   e un pavimento diverso sotto ogni libreria sarebbe una stanza diversa
   per ogni libreria. */
function stileLib(l){
  const L = LIB.librerie()[l];
  const s = STANZA.corrente();
  return {
    scaffali: (L && L.scaffali) || s.scaffali,
    arredo:   (L && L.arredo)   || s.arredo
  };
}

function makeMats(){
  MATS = matsDi(STANZA.corrente().scaffali);
}

function legnoPavimento(){
  return legno(STANZA.corrente().pavimento,
               { lines:180, knots:1, repeat:[1,13], rough:.72, bump:.012 });
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
/* Deve restare uguale a --bg nel CSS: e' la stessa tinta a tenere
   insieme il caricamento, il cancello e il mondo dietro. */
const SFONDO = 0xcfccc8;

function buildRoom(){
  scene = new THREE.Scene();
  // il valore vero lo mette applicaLuce(): qui basta non partire da nero
  scene.background = new THREE.Color(SFONDO);
  scene.fog = new THREE.Fog(SFONDO, 40, 120);

  /* Pavimento e parete sono larghi 1 e vengono stirati da stanzaLarga()
     fino a coprire tutta la fila di librerie. La quota invece e' fissa:
     il mobile non si allunga piu' verso il basso, quindi la stanza non
     ha piu' bisogno di scendere con lui. */
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 240), legnoPavimento());
  floorMesh.rotation.x = -Math.PI/2;
  floorMesh.position.y = SUOLO;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // parete quasi a contatto con lo schienale: staccata, l'ombra del
  // mobile ci si stampa sopra come una lastra
  wallMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 400),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(STANZA.corrente().muro),
                                     roughness: .98, metalness: 0 })
  );
  wallMesh.position.set(0, CENTRO_Y, -KAL.d/2 - .06);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);

  // il cielo chiaro sopra e il rimbalzo caldo del pavimento sotto:
  // e' quello che fa sembrare la stanza illuminata da una finestra
  hemiLight = new THREE.HemisphereLight(0xf7f2e8, 0xcbb89a, .52);
  ambLight  = new THREE.AmbientLight(0xfff6e8, .20);
  scene.add(hemiLight, ambLight);

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
  fillLight = new THREE.DirectionalLight(0xffeedd, .22);
  fillLight.position.set(16, 8, 18);
  scene.add(fillLight);

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

/* La luce della stanza.

   Il cursore NON moltiplica tutto per lo stesso numero: sarebbe un
   filtro grigio davanti alla scena, non una stanza piu' buia. Ogni
   sorgente si comporta come si comporta davvero:

   - la finestra (`key`) cala piu' in fretta di tutto: al tramonto e'
     la prima ad andarsene, ed e' quella che fa le ombre;
   - il rimbalzo (`amb`) cala molto piano: una stanza in penombra non
     e' nera, e' piena di luce riflessa dalle pareti;
   - l'esposizione compensa un filo, come fa l'occhio, che si abitua
     ma non del tutto -- se compensasse tutto, muovere il cursore non
     si vedrebbe.

   Sfondo e nebbia sono tinte piatte che nessuna luce tocca: vanno
   scurite a mano, se no la stanza si abbuia e la parete in fondo resta
   accesa come a mezzogiorno. */
function applicaLuce(){
  const l = STANZA.corrente().luce;
  if (hemiLight) hemiLight.intensity = .52 * Math.pow(l, 1.05);
  if (ambLight)  ambLight.intensity  = .20 * Math.pow(l, .60);
  if (keyLight)  keyLight.intensity  = .95 * Math.pow(l, 1.35);
  if (fillLight) fillLight.intensity = .22 * Math.pow(l, 1.10);
  if (renderer)  renderer.toneMappingExposure = .90 * Math.pow(l, -.20);

  /* Lo sfondo scende molto piu' della luce: e' quello che fa la
     differenza fra "stanza in penombra" e "filtro grigio". Con il
     fattore di prima, a luce minima la parete in fondo restava chiara e
     tutto sembrava solo un po' spento. */
  const f = new THREE.Color(STANZA.corrente().muro)
    .multiplyScalar(.10 + .90 * Math.min(1.3, l));
  if (scene){
    scene.background = f;
    if (scene.fog) scene.fog.color = f.clone();
  }
  rifaiOmbre();            // cambiata l'intensita', l'ombra e' un'altra
}

/* Tutto il resto: colori delle superfici e arredi. Ricostruisce
   materiali, mobile e contorno, quindi si chiama a ogni CLIC, non a
   ogni movimento del cursore della luce. */
function applicaStanza(){
  if (!scene) return;
  applicaLuce();
  if (wallMesh) wallMesh.material.color.set(new THREE.Color(STANZA.corrente().muro));
  if (floorMesh){
    const vecchio = floorMesh.material;
    floorMesh.material = legnoPavimento();
    if (vecchio){
      ['map','bumpMap'].forEach(function(k){ if (vecchio[k]) vecchio[k].dispose(); });
      vecchio.dispose();
    }
  }
  makeMats();
  buildCabinet();              // rimette anche scala e ripetizione del pavimento
  applyLibrary({});            // e con essa gli arredi nello stile scelto
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

  // tante librerie quante ne servono, in fila lungo la parete: identiche
  // nella forma, non per forza nel legno
  for (let l = 0; l < state.libs; l++){
    const ox = libX(l);
    const MATS = matsDi(stileLib(l).scaffali);

    // montanti: due esterni e uno per ogni divisione interna
    for (let c = 0; c <= COLS; c++){
      g.add(slab(T, H, D, MATS.vert, ox - W/2 + T/2 + c * KAL.passo, fondo + H/2, 0));
    }

    /* Ripiani: cielo, fondo e uno per ogni divisione. La profondita' e'
       due centesimi in meno di quella dei montanti, cioe' un millimetro
       vero: i ripiani passano DENTRO i montanti, e con le facce davanti
       esattamente sullo stesso piano le due superfici si contendevano i
       pixel. Sui legni chiari non si notava, sul wenge era una
       tramatura sporca lungo ogni incrocio. Un ripiano appena arretrato
       e' anche piu' giusto: e' cosi' su un mobile vero. */
    for (let r = 0; r <= RIGHE; r++){
      g.add(slab(W - T*2, T, D - .02, MATS.orizz, ox, cima - T/2 - r * KAL.passo, 0));
    }

    // schienale sottile e arretrato: senza, i cubi si aprono sulla
    // parete e le scatole perdono il loro sfondo
    g.add(slab(W - T*2, H - T*2, .10, MATS.fondo, ox, fondo + H/2, -D/2 + .07));

    /* Il nome, sopra il mobile. Sulla parete e non su un cartello
       appeso: un cartello vero avrebbe voluto cornice, spessore e
       ombra, e sopra una libreria c'e' gia' abbastanza roba.

       Sta piu' in alto degli oggetti che poggiano sul cielo del mobile,
       se no ci finisce dietro. `MeshBasic` apposta: e' informazione, e
       deve restare leggibile anche con la stanza in penombra. */
    const L = LIB.librerie()[l];
    if (L && L.nome){
      const c = ART.targhetta(L.nome);
      const alt = 1.05, larg = alt * (c.width / c.height);
      const targa = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(larg, W - .6), alt),
        new THREE.MeshBasicMaterial({
          map: ART.toTex(c), transparent: true, depthWrite: false
        })
      );
      targa.position.set(ox, state.yTarga || (KAL.topY + SOPRA - .62), -KAL.d/2 + .02);
      targa.userData.targa = true;      // `allineaComandi` la sposta senza ricostruire
      g.add(targa);
    }
  }

  stanzaLarga(state.libs);
  cabGroup = g;
  scene.add(g);
  rifaiOmbre();
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

  const lid = new THREE.Mesh(geoCoperchio(), [sideV, sideH, cover, dark]);
  lid.scale.set(BOX.w, H, BOX.lid);
  lid.position.z = BOX.t/2 - BOX.lid/2;
  lid.castShadow = true; lid.receiveShadow = true;

  const baseD = BOX.t - BOX.lid;
  const base = new THREE.Mesh(geoFronte(), [card, inMat]);
  base.scale.set(BOX.w*.97, H*.97, baseD);
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
/* I dorsi sono sei tinte in tutto, e a parte la grana -- che e'
   rumore casuale -- due libri della stessa tinta erano gia' identici.
   Quindi sei texture per tutti i libri di tutte le librerie, invece di
   un canvas da 128x384 disegnato e caricato sulla scheda per ogni
   singolo libro, a ogni ricostruzione del contorno. */
function thinSpine(seed){
  const cols = ['#7b4a2e','#4d5a48','#6a3a3a','#3f4a5c','#6d5a2e','#57406a'];
  const i = Math.floor(srnd(seed)*cols.length) % cols.length;
  return comune('dorso' + i, function(){
    const S = 128, cx = ART.cnv(S, S*3), c = cx[0], x = cx[1];
    x.fillStyle = cols[i]; x.fillRect(0,0,S,S*3);
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
  });
}

/* IL MEEPLE, UNA SAGOMA SOLA.

   Il giro parte dal piede sinistro e va in senso orario: gamba su,
   fianco, sotto il braccio, la mano, sopra il braccio, spalla, collo,
   mezzo giro di testa -- e tutto specchiato dall'altra parte -- poi
   giu' per la gamba destra, la pianta, e su per la V fino al cavallo,
   che non arriva mai piu' in alto della vita.

   Tutto in curve, perche' un meeple e' tornito e non ritagliato. Il
   primo tentativo lo aveva fatto in tre pezzi separati e le gambe
   erano un triangolo col taglio in mezzo: a centoventi pixel sembrava
   un birillo.

   Le stesse coordinate stanno in js/art.js: e' lo stesso personaggio, uno
   dipinto su canvas e uno estruso in tre dimensioni, e se divergono si
   vedono due meeple diversi nella stessa schermata. */
function meepleShape(){
  const s = new THREE.Shape();
  s.moveTo(-0.93, -1.00);
  s.bezierCurveTo(-0.97,-0.72, -0.80,-0.34, -0.56,-0.06);
  s.bezierCurveTo(-0.72,-0.06, -0.88,-0.05, -0.96,0.00);
  s.bezierCurveTo(-1.03,0.06, -1.03,0.26, -0.94,0.34);
  s.bezierCurveTo(-0.78,0.46, -0.52,0.56, -0.33,0.59);
  s.bezierCurveTo(-0.34,0.66, -0.34,0.74, -0.32,0.80);
  s.bezierCurveTo(-0.32,1.02, 0.32,1.02, 0.32,0.80);
  s.bezierCurveTo(0.34,0.74, 0.34,0.66, 0.33,0.59);
  s.bezierCurveTo(0.52,0.56, 0.78,0.46, 0.94,0.34);
  s.bezierCurveTo(1.03,0.26, 1.03,0.06, 0.96,0.00);
  s.bezierCurveTo(0.88,-0.05, 0.72,-0.06, 0.56,-0.06);
  s.bezierCurveTo(0.80,-0.34, 0.97,-0.72, 0.93,-1.00);
  s.lineTo(0.26, -1.00);
  s.bezierCurveTo(0.24,-0.80, 0.12,-0.68, 0.00,-0.61);
  s.bezierCurveTo(-0.12,-0.68, -0.24,-0.80, -0.26,-1.00);
  s.lineTo(-0.93, -1.00);
  s.closePath();
  return s;
}
/* L'estrusione del meeple e' la geometria piu' cara del contorno --
   sagoma, smusso, due segmenti -- e ce n'erano due nuove per ogni cubo
   coi dadi. E' sempre lo stesso meeple: la si costruisce una volta e
   la misura la fa `scale`. */
function makeMeeple(col, s){
  const geo = comune('meeple', function(){
    const g = new THREE.ExtrudeGeometry(meepleShape(), {
      depth: .34, bevelEnabled: true, bevelSize: .04, bevelThickness: .04,
      bevelSegments: 2, curveSegments: 8
    });
    g.center();
    return g;
  });
  const m = new THREE.Mesh(geo, matTinta('meeple' + col, { color: col, roughness: .58 }));
  m.scale.setScalar(s || .42);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Riempie i posti vuoti: uno scaffale spoglio sembra un errore, non
// un armadio che aspetta altri giochi.
/* ============================================================
   I CINQUE ARREDI

   Un cubo vuoto e' un buco; un cubo con dentro qualcosa e' uno
   scaffale. Sono cinque stili diversi e si sceglie il proprio dal
   menu della stanza -- piu' il misto, che li mescola come faceva
   prima, e il niente, che non e' un ripiego: chi lascia i vuoti
   apposta non vuole che glieli riempiamo noi.

   Ognuno riceve il gruppo, un seme ripetibile e il punto (x, y) dove
   appoggiare: y e' il piano su cui posare, che sia il fondo di un cubo
   o il cielo del mobile.
   ============================================================ */

/* --- geometrie e materiali in comune ---------------------------

   Gli arredi sono tanti e sono tutti lo stesso oggetto: dieci dadi
   sono lo stesso dado, ogni pianta ha otto foglie che sono la stessa
   foglia, le cornici hanno tutte lo stesso bordo di legno. Costruirne
   una geometria e un materiale per ognuno faceva 152 geometrie e 224
   materiali per 5.800 triangoli -- piu' materiali che mesh -- e ogni
   `buildProps` (cioe' ogni lettera scritta nella ricerca) li rifaceva
   tutti da capo, canvas e texture comprese.

   Qui si costruiscono una volta sola e si riusano. La misura la fa
   `scale` sul mesh, che non costa niente: una scatola 0.4 x 2.2 x 2.5
   e un cubo unitario scalato uguale sono la stessa identica forma, e
   le UV di un box sono per faccia -- quindi anche la texture cade
   esattamente dov'era.

   Chi sta in cache va segnato `__comune`, se no `killGroup` lo butta
   via alla prima ricostruzione e lo porta via a tutti. */
const COMUNI = {};

function marca(v){
  if (Array.isArray(v)){ v.forEach(marca); return v; }
  if (v) v.__comune = true;
  return v;
}

function comune(chiave, fai){
  if (!(chiave in COMUNI)) COMUNI[chiave] = marca(fai());
  return COMUNI[chiave];
}

const geoCubo   = () => comune('cubo',   () => new THREE.BoxGeometry(1, 1, 1));
const geoFoglia = () => comune('foglia', () => new THREE.SphereGeometry(.17, 7, 5));
// il vaso e' alto 1 e viene scalato: la rastremazione resta quella
const geoVaso   = () => comune('vaso',   () => new THREE.CylinderGeometry(.38, .28, 1, 14));
const geoD20    = () => comune('d20',    () => new THREE.IcosahedronGeometry(.62, 0));

/* --- un cubo con le facce raggruppate per materiale --------------

   three.js emette un elemento da disegnare per ogni GRUPPO di una
   geometria, non per ogni materiale: un box a sei gruppi sono sei
   chiamate anche quando quattro facce hanno lo stesso identico
   materiale. Era il caso di tutto quello che ha una faccia diversa
   dalle altre -- cornici, coperchi, fondi delle scatole -- e da solo
   valeva 252 chiamate delle 362 della scena.

   Qui gli indici vengono riordinati per slot, cosi' le facce che
   condividono il materiale finiscono in un gruppo solo. La geometria
   e' identica: cambia l'ordine in cui si disegnano i triangoli, e
   dentro la passata opaca quello lo decide lo z-buffer, non la fila.

   `slot` dice, per ognuna delle sei facce nell'ordine di BoxGeometry
   (+X, -X, +Y, -Y, +Z, -Z), quale materiale dell'array le tocca. */
function cuboRaggruppato(slot){
  const g = new THREE.BoxGeometry(1, 1, 1);
  const idx = g.index.array;                   // 36 indici, sei per faccia
  const ord = [], gruppi = [];
  let quanti = 0;
  for (let i = 0; i < slot.length; i++) if (slot[i] + 1 > quanti) quanti = slot[i] + 1;
  for (let sl = 0; sl < quanti; sl++){
    const da = ord.length;
    for (let f = 0; f < 6; f++){
      if (slot[f] !== sl) continue;
      for (let k = 0; k < 6; k++) ord.push(idx[f*6 + k]);
    }
    if (ord.length > da) gruppi.push([da, ord.length - da, sl]);
  }
  g.setIndex(ord);
  g.clearGroups();
  for (let i = 0; i < gruppi.length; i++) g.addGroup(gruppi[i][0], gruppi[i][1], gruppi[i][2]);
  return g;
}

// cinque facce uguali e il fronte diverso: cornici e fondi delle scatole
const geoFronte = () => comune('cubo5+1', () => cuboRaggruppato([0,0,0,0,1,0]));
// il coperchio: fianchi, teste, copertina, fondello
const geoCoperchio = () => comune('cubo2+2+1+1', () => cuboRaggruppato([0,0,1,1,2,3]));

const matTinta = (chiave, par) =>
  comune(chiave, () => new THREE.MeshStandardMaterial(par));

// le copertine generiche sono cinque disegni in tutto: cinque texture
// per tutte le scatole di contorno di tutte le librerie, non una a testa
const matScatola = i => comune('scat' + i, () => new THREE.MeshStandardMaterial({
  map: ART.toTex(ART.coverGeneric(i)), roughness: .7
}));

/* Un dado costava SEI chiamate, una per faccia, perche' aveva sei
   materiali. Le sei facce vanno in un atlante 3x2 e il dado torna a
   essere un oggetto solo: tre coppie di colori, tre texture, tre
   materiali per tutti i dadi di tutte le librerie.

   Il margine per le mipmap c'e' gia': i pallini stanno a ventidue
   pixel dal bordo della faccia, quindi quello che si mescola fra una
   cella e l'altra rimpicciolendo e' fondo con fondo. */
function atlanteDado(body, pip){
  const S = 128, cx = ART.cnv(S*3, S*2), c = cx[0], x = cx[1];
  const ordine = [3,4,1,6,2,5];       // +X, -X, +Y, -Y, +Z, -Z: opposte a sette
  for (let f = 0; f < 6; f++){
    x.drawImage(ART.dieFace(ordine[f], body, pip), (f % 3) * S, Math.floor(f / 3) * S);
  }
  return c;
}

/* Il cubo con le UV riscritte sulle celle dell'atlante: la faccia
   i-esima legge la cella i-esima. La `v` va contata dal basso perche'
   CanvasTexture capovolge l'immagine al caricamento. */
const geoDado = () => comune('cuboDado', function(){
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++){
    const col = f % 3, riga = Math.floor(f / 3);
    for (let v = 0; v < 4; v++){
      const i = f*4 + v;
      uv.setXY(i, (col + uv.getX(i)) / 3, ((1 - riga) + uv.getY(i)) / 2);
    }
  }
  uv.needsUpdate = true;
  return g;
});

const matDado = i => comune('dado' + i, () => {
  const c = [['#efe3cb','#2a1a0f'], ['#c1552c','#f6e6c8'], ['#3f4f63','#f6e6c8']][i];
  return new THREE.MeshStandardMaterial({
    map: ART.toTex(atlanteDado(c[0], c[1])), roughness: .42, metalness: .02
  });
});

function arrScatole(g, seed, x, y){
  const n = 2 + Math.floor(srnd(seed+1)*2);
  for (let i = 0; i < n; i++){
    const m = new THREE.Mesh(geoCubo(), matScatola(Math.floor(srnd(seed+i*3)*5)));
    m.scale.set(2.5, .52, 2.5);
    m.position.set(x + (srnd(seed+i)-.5)*.24, y + .26 + i*.52, -.1);
    m.rotation.y = (srnd(seed+i*2)-.5)*.16;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
}

function arrLibri(g, seed, x, y){
  const n = 4 + Math.floor(srnd(seed+2)*2);
  for (let i = 0; i < n; i++){
    const w = .38 + srnd(seed+i*7)*.16, h = 1.9 + srnd(seed+i*11)*.7;
    const m = new THREE.Mesh(geoCubo(), thinSpine(seed+i));
    m.scale.set(w, h, 2.5);
    m.position.set(x - 1.15 + i*.56, y + h/2, -.1);
    m.rotation.y = (srnd(seed+i)-.5)*.06;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
}

function arrDadi(g, seed, x, y){
  for (let i = 0; i < 3; i++){
    const s = .58;
    const d = new THREE.Mesh(geoDado(), matDado(i));
    d.scale.setScalar(s);
    d.position.set(x - .75 + i*.62, y + s/2, .2 + (i%2)*.4);
    d.rotation.y = srnd(seed+i*13) * Math.PI;
    d.castShadow = true; d.receiveShadow = true;
    g.add(d);
  }
  const d20 = new THREE.Mesh(geoD20(), matTinta('d20mat',
    { color: 0xb98a3a, roughness: .38, metalness: .7, flatShading: true }));
  d20.position.set(x + .95, y + .52, .35);
  d20.rotation.set(.4, srnd(seed+4)*3, .2);
  d20.castShadow = true; d20.receiveShadow = true;
  g.add(d20);
  const m1 = makeMeeple(0xd8552c, .42), m2 = makeMeeple(0xe8c05f, .36);
  m1.position.set(x + .15, y + .45, .55);
  m2.position.set(x + .55, y + .40, .8); m2.rotation.y = -.5;
  g.add(m1, m2);
}

/* Le foglie sono sfere schiacciate e non un modello vero: a questa
   distanza contano la sagoma e il colore, e una pianta fatta bene
   costerebbe piu' triangoli di tutto il resto del mobile. */
function arrPiante(g, seed, x, y){
  const h = .5 + srnd(seed)*.22;
  const vaso = new THREE.Mesh(geoVaso(), matTinta('vasomat', { color: 0xb2643f, roughness: .88 }));
  vaso.scale.y = h;
  vaso.position.set(x, y + h/2, .05);
  vaso.castShadow = true; vaso.receiveShadow = true;
  g.add(vaso);

  // i verdi sono due: due materiali per tutte le foglie di tutte le piante
  const verde = srnd(seed+9) < .5
    ? matTinta('foglia0', { color: 0x4f7a4a, roughness: .76 })
    : matTinta('foglia1', { color: 0x5f8a52, roughness: .76 });
  const n = 6 + Math.floor(srnd(seed+1)*4);
  for (let i = 0; i < n; i++){
    const lung = .55 + srnd(seed + i*3)*.75;
    const f = new THREE.Mesh(geoFoglia(), verde);
    f.scale.set(.55, lung/.34, .4);
    const ang = (i / n) * Math.PI * 2 + srnd(seed+i)*.7;
    const fuori = .25 + srnd(seed+i*2)*.5;
    f.position.set(x + Math.cos(ang)*fuori*.7, y + h + lung*.42, .05 + Math.sin(ang)*fuori*.5);
    f.rotation.set(Math.sin(ang)*fuori, 0, -Math.cos(ang)*fuori);
    f.castShadow = true;
    g.add(f);
  }
}

function arrCornici(g, seed, x, y){
  const n = 1 + Math.floor(srnd(seed)*2);
  for (let i = 0; i < n; i++){
    const w = .95 + srnd(seed+i)*.5;
    const h = w * (1 + srnd(seed+i*3)*.35);
    /* La tela dipende dal seme e resta una per quadro -- sono diversi
       apposta. Il bordo invece e' sempre lo stesso legno: erano
       cinquanta materiali identici, uno per cornice. */
    const tela  = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.quadro(seed + i*5)), roughness: .72 });
    const bordo = matTinta('bordoq', { color: 0x6b5540, roughness: .74 });
    const m = new THREE.Mesh(geoFronte(), [bordo, tela]);
    m.scale.set(w, h, .08);
    // appoggiate all'indietro, come si appoggia una cornice a un muro
    m.position.set(x - .45 + i*.85 + (srnd(seed+i*11)-.5)*.2, y + h/2, -.55 + i*.4);
    m.rotation.set(-.14, (srnd(seed+i*7)-.5)*.45, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
}

const ARREDI = {
  giochi: arrScatole, libri: arrLibri, dadi: arrDadi,
  piante: arrPiante, cornici: arrCornici
};
const ARREDI_MISTI = ['giochi', 'libri', 'dadi', 'piante', 'cornici'];

function riempiCubo(g, stile, seed, x, y){
  if (stile === 'niente') return;
  const quale = (stile === 'misto')
    ? ARREDI_MISTI[Math.floor(srnd(seed + 91) * ARREDI_MISTI.length) % ARREDI_MISTI.length]
    : stile;
  const fn = ARREDI[quale];
  if (fn) fn(g, seed, x, y);
}

/* Sopra il mobile. Un mobile vero ha sempre qualcosa sopra, ed e'
   anche quello che fa capire dove finisce: senza, il cielo della
   libreria e' solo un bordo netto contro il muro. */
/* Quello che poggia sul cielo del mobile e' piu' piccolo di quello che
   sta nei cubi: sopra un mobile, vicino al soffitto, non ci si mette
   una fila di libri alta come quella dentro. Ed e' anche cio' che
   lascia posto alla targhetta col nome, che sta appena sopra. */
function arrediSopra(g, stile, l){
  if (stile === 'niente') return;
  for (let i = 0; i < COLS; i++){
    const seed = 700 + l * 31 + i * 7;
    if (srnd(seed) < .34) continue;
    // costruito nell'origine e poi messo al suo posto: cosi' la scala
    // rimpicciolisce l'oggetto e non lo trascina verso il centro
    const sopra = new THREE.Group();
    riempiCubo(sopra, stile, seed, 0, 0);
    sopra.scale.setScalar(.6);
    sopra.position.set(cubX(l, i), KAL.topY, 0);
    g.add(sopra);
  }
}

function buildProps(used){
  killGroup(propGroup, true);
  const g = new THREE.Group();

  /* Mentre si cerca i cubi vuoti restano vuoti. Riempirli di libri e
     dadi fa sembrare lo scaffale pieno, e i risultati -- che sono il
     motivo per cui si sta guardando -- non si distinguono piu' dal
     contorno. */
  if (!used){ propGroup = g; scene.add(g); rifaiOmbre(); return; }

  for (let l = 0; l < state.libs; l++){
    const stile = stileLib(l).arredo;        // ogni mobile il suo
    arrediSopra(g, stile, l);
    for (let k = 0; k < PER_LIB; k++){
      const posto = l * PER_LIB + k;
      if (used.has(posto)) continue;
      const seed = posto * 17 + 3;
      if (srnd(seed) < .34) continue;              // qualche posto resta vuoto
      riempiCubo(g, stile, seed,
                 cubX(l, k % COLS),
                 rigaY(Math.floor(k / COLS)) - KAL.cell/2);
    }
  }

  propGroup = g;
  scene.add(g);
  rifaiOmbre();
}

/* ===============================================================
   LIBRERIA -> SCENA
   =============================================================== */

/* La lista che vede la scena: ordinata e filtrata insieme. Tutto quello
   che dispone scatole deve passare di qui, se no cercando un gioco la
   posizione sullo scaffale e quella nell'elenco non coincidono piu'. */
function lista(){
  const l = LIB.list(state.sort, state.q, state.gruppo);
  return state.soloPreferiti ? l.filter(function(g){ return g.preferito; }) : l;
}

/* Quello che sta SUGLI SCAFFALI, che non e' tutta la collezione.

   Da quando si sceglie cosa esporre, `libreria` nulla vuol dire "ce
   l'ho ma non e' in mostra": la libreria diventa una vetrina invece di
   un magazzino, e l'elenco resta il posto dove c'e' tutto. E' anche
   l'unica risposta sensata a una collezione da duecento giochi, che in
   diciassette mobili non la guarda nessuno. */
function listaScaffale(){
  return lista().filter(function(g){ return !!g.libreria; });
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
/* DOVE VA OGNI SCATOLA.

   Due modi, e la differenza e' tutta qui.

   In ORDINE MANUALE la disposizione e' un dato: ogni gioco ha la sua
   libreria e il suo posto (0..11), e i cubi lasciati vuoti restano
   vuoti. E' cosi' che si arreda uno scaffale vero, e senza questo
   "lascia libero il cubo in mezzo" non si poteva nemmeno dire.

   Negli altri ordinamenti -- nome, voto, data -- i posti non contano:
   si riempie in sequenza dal primo mobile in poi. E' una scelta: un
   ordinamento calcolato che rispettasse i buchi non sarebbe piu' un
   ordinamento, e tornando a "il mio ordine" si ritrova tutto com'era.

   Chi non ha ancora un posto -- appena aggiunto, o rimasto orfano
   perche' la sua libreria e' stata tolta -- va nel primo cubo libero.
   Non in fondo: in fondo vuol dire "dopo tutti", e i buchi esistono
   proprio perche' "dopo tutti" non e' l'unico posto possibile. */
function disposizione(list){
  const manuale = state.sort === 'mio' && !state.q && LIB.librerie().length > 0;
  const posti = new Array(list.length).fill(-1);

  if (!manuale){
    for (let i = 0; i < list.length; i++) posti[i] = i;
    return {
      posti: posti,
      // i mobili esistono anche quando sono vuoti: sono mobili, non
      // contenitori che compaiono quando servono
      libs: Math.max(LIB.librerie().length + 1,
                     Math.ceil((list.length + 1) / PER_LIB))
    };
  }

  const ordine = {};
  LIB.librerie().forEach(function(L, i){ ordine[L.id] = i; });

  const presi = new Set();
  list.forEach(function(g, i){
    const l = ordine[g.libreria];
    if (l === undefined || g.posto === null || g.posto === undefined) return;
    const cubo = l * PER_LIB + g.posto;
    if (presi.has(cubo)) return;          // due sullo stesso cubo: il secondo rifluisce
    presi.add(cubo);
    posti[i] = cubo;
  });

  let libero = 0;
  for (let i = 0; i < list.length; i++){
    if (posti[i] >= 0) continue;
    while (presi.has(libero)) libero++;
    presi.add(libero);
    posti[i] = libero;
  }

  const ultimo = posti.reduce(function(m, x){ return Math.max(m, x); }, -1);
  return {
    posti: posti,
    // sempre un mobile in piu' di quelli che servono: e' li' che si
    // trascina una scatola per cominciarne uno nuovo
    libs: Math.max(LIB.librerie().length + 1, Math.floor(ultimo / PER_LIB) + 2)
  };
}

/* Con una libreria sola non c'e' niente da scorrere: via il binario,
   invece di far muovere una barra che non muove niente.

   Sta in una funzione sua perche' `state.libs` cambia in `applyLibrary`,
   mentre `layout()` gira all'avvio e a ogni resize -- cioe' quando il
   numero di mobili puo' ancora essere quello di prima. Deciso solo li',
   il binario restava nascosto su una collezione da tre librerie: si
   vedeva "1 / 3" scritto in un elemento a opacita' zero, e non c'era
   piu' modo di cambiare mobile. */
function segnaFerma(){
  state.tuttaVisibile = state.libs <= 1;
  document.body.classList.toggle('ferma', state.tuttaVisibile);
}

function applyLibrary(opts){
  opts = opts || {};
  const list = listaScaffale();
  const disp = disposizione(list);
  const posti = disp.posti;

  if (disp.libs !== state.libs || !cabGroup){
    state.libs = disp.libs;
    buildCabinet();
  }
  segnaFerma();

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
    const cubo = posti[i];
    used.add(cubo);
    b.userData.cubo = cubo;

    const home = homeOf(cubo, b.userData.h);
    b.userData.homePos.copy(home);
    b.userData.homeRot.set(0, (cubo % 2 ? -.03 : .02), 0);

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
  if (document.body.classList.contains('elenco')) disegnaMia();
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
  const bh = (CIMA_VISTA - SUOLO)/2 + marg + ALZA;
  state.distShelf = KAL.front + Math.max(bh / tan, bw / (tan * aspect));

  segnaFerma();

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

  allineaComandi();
  rifaiOmbre();            // cambiato il quadro, la mappa va rifatta
  reposeFocused();          // una scatola aperta va rimessa a posto sul quadro nuovo
}

/* --- I COMANDI SI ALLINEANO AL MOBILE, NON A UN NUMERO ------------

   L'imbuto e il nome della libreria stanno alla stessa quota, e quella
   quota e' **a meta' fra il bordo della testata e la cima del mobile**.
   La lampada e il binario stanno anche loro alla stessa quota, a meta'
   fra il piede del mobile e la barra in basso.

   Non ci sono pixel scritti a mano: il mobile e' in prospettiva e si
   sposta con lo schermo, quindi la sua cima e il suo piede si
   PROIETTANO, e da quei due numeri escono gli altri. Con una misura
   fissa l'allineamento sarebbe giusto su un telefono e sbagliato su
   tutto il resto.

   La quota della targhetta va anche riportata indietro nel mondo 3D:
   e' li' che sta scritta, e la si sposta sul posto invece di
   ricostruire il mobile per due centimetri. */
const _pv = new THREE.Vector3();

function schermoY(y, z, x){
  _pv.set(x, y, z).project(camera);
  return (-_pv.y * .5 + .5) * window.innerHeight;
}

// l'inverso: che quota nel mondo cade su questa riga dello schermo
function mondoY(sy, z, x){
  const a = schermoY(0, z, x), b = schermoY(1, z, x);
  if (Math.abs(b - a) < 1e-6) return 0;
  return (sy - a) / (b - a);
}

function allineaComandi(){
  if (!camera || !renderer) return;
  /* Solo a camera ferma sullo scaffale. Durante l'intro sta a
     `distFar` e guarda un'altra cosa: la cima del mobile si proietta a
     quattromila pixel, e quel numero restava scritto nella variabile --
     con l'imbuto spedito fuori dallo schermo. */
  if (state.phase !== 'browse') return;
  const testa = q('header');
  const barra = q('#tabbar');
  const hb = testa ? testa.getBoundingClientRect().bottom : 0;
  const bb = (barra && getComputedStyle(barra).display !== 'none')
    ? barra.getBoundingClientRect().top : window.innerHeight;

  const cx = camBase.x;
  const cima  = schermoY(KAL.topY, KAL.front, cx);
  const piede = schermoY(SUOLO,    KAL.front, cx);

  const alto  = (hb + cima) / 2;
  const basso = (piede + bb) / 2;

  const st = document.body.style;
  st.setProperty('--y-alto',  Math.round(alto) + 'px');
  st.setProperty('--y-basso', Math.round(basso) + 'px');

  /* La targhetta e' sulla parete, non sul fronte: la sua z e' quella,
     se no la quota che si calcola non e' la sua. */
  const zT = -KAL.d/2 + .02;
  state.yTarga = mondoY(alto, zT, cx);
  if (cabGroup){
    cabGroup.traverse(function(o){
      if (o.userData && o.userData.targa) o.position.y = state.yTarga;
    });
    rifaiOmbre();
  }
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
    pos: new THREE.Vector3(x + offX * vw, VISTA_Y + offY * vh, FOCUS_Z),
    cam: new THREE.Vector3(x, VISTA_Y, FOCUS_Z + d),
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

  /* La camera arretra un poco. Su un telefono la libreria riempie lo
     schermo da bordo a bordo: senza allargare il quadro, del mobile
     accanto non si vede niente e non c'e' modo di portarci una scatola.
     E' poco -- un quarto -- perche' quello che si sta spostando deve
     restare grande abbastanza da vedere dove lo si mette. */
  const z0 = state.zoom;
  tween(.32, function(p){ state.zoom = lerp(z0, 1.26, easeOut(p)); });
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
  /* Chi c'e' gia' in quel cubo, se c'e'. Si cerca PER CUBO e non per
     indice nella lista: da quando i posti sono espliciti e possono
     avere buchi, il quinto della lista non e' piu' il quinto cubo. */
  p.mirBox = (s < 0) ? null : (boxes.find(function(b){
    return b.userData.cubo === s && b !== p.box;
  }) || null);
  segnaAlone(s);
}

function segnaAlone(s){
  if (!alone) return;
  if (s < 0 || s >= state.libs * PER_LIB){ alone.visible = false; return; }
  const l = Math.floor(s / PER_LIB), k = s % PER_LIB;
  alone.position.set(cubX(l, k % COLS), rigaY(Math.floor(k / COLS)), -KAL.d/2 + .14);
  alone.visible = true;
}

/* Posare la scatola nel cubo mirato.

   Se il cubo e' occupato le due si scambiano; se e' libero la scatola
   ci va e basta, LASCIANDO IL BUCO da cui e' partita. E' la differenza
   con la numerazione densa di prima, ed e' il motivo per cui i posti
   sono espliciti: un cubo vuoto in mezzo allo scaffale e' una scelta.

   Se si sta trascinando mentre l'ordine e' calcolato, si passa
   all'ordine manuale e si fotografa PRIMA la disposizione che si aveva
   sullo schermo: cosi' la mossa parte da quello che si vedeva, non da
   un rimescolamento. */
/* Fotografa la disposizione che si ha sullo schermo dentro (libreria,
   posto): serve a chi passa da un ordine calcolato a quello manuale,
   perche' la mossa parta da quello che si vedeva e non da un
   rimescolamento. Torna le righe toccate, da mandare al server. */
function fissaOrdineCorrente(quali){
  const l = quali || lista();
  const tocchi = l.map(function(g, i){
    const L = LIB.librerie()[Math.floor(i / PER_LIB)];
    return L ? LIB.metti(g.id, L.id, i % PER_LIB) : null;
  }).filter(Boolean);
  LIB.mandaPosti(tocchi);
  return tocchi;
}

/* Dove finisce un gioco APPENA AGGIUNTO.

   Nel mobile che si sta guardando, nel suo primo cubo libero. Prima
   finiva nel primo cubo libero in assoluto -- cioe' sempre nella prima
   libreria -- e chi ne creava una seconda non riusciva a metterci
   dentro niente finche' la prima non era piena: la libreria nuova
   c'era, ma non serviva a nulla.

   Se il mobile che si guarda e' pieno si passa agli altri in ordine,
   invece di rifiutare: meglio un posto qualsiasi che nessun posto. */
/* --- mettere un gioco in vetrina, e toglierlo --------------------
   Dal proprio elenco: e' li' che c'e' tutta la collezione, ed e' li'
   che si decide cosa far vedere. Se le librerie sono piu' d'una si
   sceglie quale, perche' e' il senso di avere piu' mobili. */
function primoLibero(libId, tranne){
  const presi = {};
  LIB.all().forEach(function(g){
    if (g.id !== tranne && g.libreria === libId && g.posto !== null && g.posto !== undefined){
      presi[g.posto] = true;
    }
  });
  for (let i = 0; i < PER_LIB; i++) if (!presi[i]) return i;
  return -1;
}

function mettiSuScaffale(id, libId){
  const p = primoLibero(libId, id);
  if (p < 0){
    flash('quel mobile e\' pieno: dodici cubi, dodici giochi');
    disegnaMia();
    return;
  }
  LIB.metti(id, libId, p);
  LIB.mandaPosti([LIB.get(id)]);
  disegnaMia();
  ridisponi();
  const L = LIB.librerie().find(function(x){ return x.id === libId; });
  flash('"' + (LIB.get(id) || {}).title + '" in ' + ((L && L.nome) || 'libreria'));
}

function togliDaScaffale(id){
  const g = LIB.get(id);
  LIB.metti(id, null, null);
  LIB.mandaPosti([LIB.get(id)]);
  disegnaMia();
  ridisponi();                 // chiude la scatola aperta e rifa' gli scaffali
  flash('"' + ((g && g.title) || 'il gioco') + '" e\' uscito dallo scaffale: ' +
        'resta nella tua collezione');
}

/* Con un mobile solo non c'e' niente da scegliere e si fa e basta. Con
   piu' di uno il pulsante si apre nei nomi delle librerie, sul posto:
   una finestra di scelta per un gesto da un clic sarebbe sproporzionata. */
function scegliLibreria(btn, id){
  const l = LIB.librerie();
  if (!l.length){ flash('crea prima una libreria, dal nome in basso'); return; }
  if (l.length === 1){ mettiSuScaffale(id, l[0].id); return; }

  const box = document.createElement('span');
  box.className = 'scegli-lib';
  box.innerHTML = l.map(function(L){
    const liberi = PER_LIB - LIB.all().filter(function(g){
      return g.libreria === L.id && g.posto !== null && g.posto !== undefined;
    }).length;
    return '<button type="button" data-l="' + esc(L.id) + '"' +
           (liberi <= 0 ? ' disabled title="pieno"' : '') + '>' + esc(L.nome) + '</button>';
  }).join('') + '<button type="button" data-l="" class="lascia">annulla</button>';
  btn.replaceWith(box);
}

function collocaNuovo(game){
  const librerie = LIB.librerie();
  if (!librerie.length || !game) return;

  const occupati = {};
  LIB.all().forEach(function(g){
    if (g.id !== game.id && g.libreria && g.posto !== null && g.posto !== undefined){
      occupati[g.libreria + ':' + g.posto] = true;
    }
  });

  const qui = clamp(Math.round(state.scroll), 0, librerie.length - 1);
  const ordine = [qui];
  for (let i = 0; i < librerie.length; i++) if (i !== qui) ordine.push(i);

  for (let i = 0; i < ordine.length; i++){
    const L = librerie[ordine[i]];
    for (let p = 0; p < PER_LIB; p++){
      if (occupati[L.id + ':' + p]) continue;
      LIB.metti(game.id, L.id, p);
      LIB.mandaPosti([LIB.get(game.id)]);
      return;
    }
  }
}

function posaScatola(p){
  const prima = state.sort;
  if (!LIB.librerie().length){ flash('nessuna libreria: non so dove metterla'); return; }

  const l = Math.floor(p.mira / PER_LIB);
  const posto = p.mira % PER_LIB;
  const mobile = LIB.librerie()[l];
  const mio = p.l[p.da];

  p.box.userData.busy = false;          // da qui in poi la muove applyLibrary

  const fotografa = function(){
    return prima === 'mio' ? [] : fissaOrdineCorrente(p.l);
  };

  const concludi = function(tocchi){
    LIB.mandaPosti(tocchi.filter(Boolean));
    if (prima !== 'mio'){
      setSort('mio');                   // ridispone da solo
      flash('ordine tuo: da adesso le scatole restano dove le metti');
    } else {
      applyLibrary({ animate: true });
    }
  };

  if (!mobile){
    /* Trascinata nel mobile di scorta, quello vuoto in fondo: e' il
       gesto con cui se ne comincia uno nuovo. Chiedere conferma con un
       modulo quando la scatola e' gia' li' sarebbe una domanda a cui si
       ha gia' risposto. */
    const tocchi = fotografa();
    LIB.creaLibreria('').then(function(L){
      tocchi.push(LIB.metti(mio.id, L.id, posto));
      disegnaLibrerie();
      concludi(tocchi);
      flash('libreria nuova: ' + L.nome);
    }).catch(function(e){
      flash('libreria non creata: ' + e.message);
      applyLibrary({ animate: true });
    });
    return;
  }

  const tocchi = fotografa();
  // da dove parte, DOPO la fotografia: e' li' che la scatola si vedeva
  const daLib = mio.libreria, daPosto = mio.posto;
  const altro = p.mirBox ? LIB.get(p.mirBox.userData.id) : null;

  tocchi.push(LIB.metti(mio.id, mobile.id, posto));
  // se il cubo era occupato le due si scambiano; se era libero, quello
  // da cui parte resta vuoto -- ed e' esattamente il punto
  if (altro && altro.id !== mio.id) tocchi.push(LIB.metti(altro.id, daLib, daPosto));

  concludi(tocchi);
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

  const z0 = state.zoom;
  tween(.34, function(p){ state.zoom = lerp(z0, 1, easeInOut(p)); });

  // il cubo di partenza e' quello, non l'indice nella lista
  const partenza = p.box.userData.cubo;
  const posabile = !annulla && p.mira >= 0 && p.mira !== partenza;
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
  const from = new THREE.Vector3(0, VISTA_Y, state.distFar);
  const to   = new THREE.Vector3(0, VISTA_Y, state.distShelf);
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
    const camTo = new THREE.Vector3(camXFor(state.scrollTo), VISTA_Y, state.distShelf);

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
  const camTo = new THREE.Vector3(camXFor(state.scrollTo), VISTA_Y, state.distShelf);
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
/* Da dove deve partire la scheda: il punto in cui la scatola sta sullo
   schermo, in scarto dal centro del pannello.

   `offsetWidth`/`offsetHeight` e non `getBoundingClientRect()`: il
   pannello e' gia' trasformato (parte piccolo e ruotato) e il rect
   restituirebbe l'ingombro della trasformazione, non quello del posto
   in cui deve arrivare. Gli offset le trasformazioni non le vedono. */
function ancoraPannello(box){
  const el = q('#panel');
  if (!el) return;
  if (!box || !camera){ el.style.removeProperty('--da-x'); el.style.removeProperty('--da-y'); return; }

  const p = new THREE.Vector3();
  box.getWorldPosition(p);
  p.project(camera);
  const sx = (p.x * .5 + .5) * window.innerWidth;
  const sy = (-p.y * .5 + .5) * window.innerHeight;

  const cx = el.offsetLeft + el.offsetWidth / 2;
  const cy = el.offsetTop + el.offsetHeight / 2;
  el.style.setProperty('--da-x', Math.round(sx - cx) + 'px');
  el.style.setProperty('--da-y', Math.round(sy - cy) + 'px');
}

/* Il cuore sotto la recensione di un amico. Fuori dalla visita non
   esiste: `body.visita` lo tiene nascosto e qui non c'e' niente da
   disegnare. */
function disegnaCuore(game){
  const b = q('#p-cuore');
  if (!b || !game) return;
  const dove = LIB.ospitePresso();
  if (!dove) return;
  const v = CUORI.di(game.id);
  b.setAttribute('aria-pressed', v.mio ? 'true' : 'false');
  q('#p-cuore-n').textContent = v.n ? String(v.n) : '';
  b.setAttribute('title', v.mio
    ? 'togli il cuore a questa recensione'
    : "questa recensione mi e' piaciuta");
}

function showPanel(game){
  ancoraPannello(state.focused);
  disegnaCuore(game);
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

  // in casa di un amico la recensione non e' tua, e va detto
  const dove = LIB.ospitePresso();
  q('#p-eyebrow').textContent = dove && dove.nick
    ? 'la recensione di ' + dove.nick : 'la recensione';

  const pref = q('#p-pref');
  if (pref){
    const si = !!(game && game.preferito);
    pref.setAttribute('aria-pressed', si ? 'true' : 'false');
    pref.title = si ? 'togli dai preferiti' : 'segnalo fra i preferiti';
  }

  disegnaGruppiScheda(game);
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
let mobileMostrato = -1;                  // quale mobile mostra il pannello aperto

function updateRail(){
  nomeMobileCorrente();                   // il nome sta nell'imbuto, non qui

  /* Col pannello aperto, cambiando mobile cambia tutto quello che il
     pannello dice -- non solo legno e arredi, che erano gli unici a
     rinfrescarsi: il nome nel campo restava su quello di prima.

     Si guarda il numero INTERO del mobile e non `state.scroll`, che
     mentre si accosta cambia a ogni fotogramma: riscrivere il campo
     sessanta volte al secondo cancellerebbe quello che ci si sta
     scrivendo dentro. */
  if (document.body.classList.contains('arreda')
      && Math.round(state.scroll) !== mobileMostrato){
    sincronizzaPannello();
  }

  const max = maxScroll();
  if (!max) return;                       // niente da scorrere: il binario e' nascosto dal CSS
  const n = max + 1;
  q('#rail-txt').textContent = (Math.round(state.scroll) + 1) + ' / ' + n;
  const t = state.scroll / max;
  const bar = q('.rail-bar');
  if (bar){
    bar.setAttribute('aria-valuemax', n);
    bar.setAttribute('aria-valuenow', Math.round(state.scroll) + 1);
  }
  /* Il cursore non arriva mai a filo dei capi della traccia: resta un
     margine uguale ai due lati (`MARG`). Senza, alla prima e all'ultima
     libreria l'arancione andava a sbattere contro il bordo e sembrava
     tagliato -- e non si capiva piu' se fosse arrivato in fondo o
     fosse finito sotto. */
  const MARG = 6;                      // per cento, per lato
  const utile = 100 - MARG * 2;
  const th = q('#rail-thumb');
  th.style.width = (utile / n) + '%';
  th.style.left = (MARG + (state.scroll / n) * utile) + '%';
  th.style.transform = 'none';
}

/* --- la barra in basso si trascina --------------------------------
   Era un indicatore che sembrava un comando. Adesso lo e': si prende
   ovunque sulla barra e la vista ci va dietro, e con le frecce si passa
   di mobile in mobile.

   `setPointerCapture` serve perche' il dito esce quasi subito dalla
   riga -- e' alta due pixel -- e senza, il trascinamento si
   interromperebbe al primo movimento verticale. */
function bindRail(){
  const bar = q('.rail-bar');
  if (!bar) return;
  let preso = false;

  function vaiA(e){
    const max = maxScroll();
    if (!max) return;
    const r = bar.getBoundingClientRect();
    /* Si mira al CENTRO del cursore, e sulla stessa corsa utile che usa
       `updateRail` -- margine compreso. Con la corsa piena il cursore
       si sfilava da sotto il dito proprio ai due capi, che e' dove si
       va a sbattere piu' spesso. */
    const MARG = .06, utile = 1 - MARG * 2, n = max + 1;
    const p = (e.clientX - r.left) / r.width;
    state.scrollTo = clamp(((p - MARG) / utile) * n - .5, 0, max);
    state.scroll = state.scrollTo;       // sotto il dito non si insegue, si sta
    updateRail();
    rifaiOmbre();
  }

  bar.addEventListener('pointerdown', function(e){
    if (state.phase !== 'browse') return;
    preso = true;
    bar.classList.add('presa');
    try { bar.setPointerCapture(e.pointerId); } catch(err){}
    vaiA(e);
    e.preventDefault();
  });
  bar.addEventListener('pointermove', function(e){ if (preso) vaiA(e); });
  function molla(){
    if (!preso) return;
    preso = false;
    bar.classList.remove('presa');
    snapSoon();                          // al rilascio si accosta al mobile
  }
  bar.addEventListener('pointerup', molla);
  bar.addEventListener('pointercancel', molla);

  bar.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft'){ scrollBy(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight'){ scrollBy(1);  e.preventDefault(); }
  });
}

/* --- puntatore -------------------------------------------------- */
/* Quanto rende un pixel di trascinamento. A 1 la scena seguiva il dito
   uno a uno e cambiare mobile costava una schermata piena; a 2 basta un
   gesto da pollice. */
const TIRO = 2;
/* Oltre questa velocita' al rilascio e' un COLPO, non un trascinamento:
   si passa al mobile accanto anche se il dito ha fatto pochi pixel --
   e' come si sfoglia. */
const COLPO = 6;

/* UN GESTO VALE UNA LIBRERIA, MAI DUE.

   Con il tiro alzato, un trascinamento lungo ne attraversava anche tre;
   e il colpo secco, che sommava un mobile a dove il dito era GIA'
   arrivato, ne aggiungeva un altro sopra. Il risultato era una vista
   che partiva e si fermava due mobili piu' in la' di dove volevi --
   cioe' esattamente il modo di non trovare piu' niente.

   Adesso alla pressione si fotografa da quale mobile si parte, e per
   tutto il gesto la vista non puo' uscire da quello accanto: ne' col
   trascinamento, ne' col colpo. Vale anche al contrario -- e' il
   comportamento di qualunque cosa si sfogli. */
let partenzaLib = 0;

function bindInput(){
  const el = renderer.domElement;
  let downAt = 0, downX = 0, downY = 0, lastX = 0, moved = 0, presaT = 0, vx = 0;

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
      vx = dx;                          // per il colpo secco, al rilascio
      /* Quante librerie vale un pixel, a questa distanza di camera --
         moltiplicato per `TIRO`. Uno a uno la scena seguiva il dito
         esattamente, che e' fedele e scomodo: il mobile riempie lo
         schermo, quindi per passare al successivo bisognava trascinare
         una schermata intera, due volte, con la mano che finiva fuori
         dal vetro. */
      const vh = 2 * state.distShelf * Math.tan(THREE.MathUtils.degToRad(FOV)/2);
      const vw = vh * camera.aspect;
      state.scrollTo = clamp(
        state.scrollTo - TIRO * (dx * vw / window.innerWidth) / PASSO_LIB,
        Math.max(0, partenzaLib - 1),
        Math.min(maxScroll(), partenzaLib + 1)
      );
    }
  });

  el.addEventListener('pointerdown', function(e){
    downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    lastX = e.clientX; moved = 0; vx = 0;
    partenzaLib = Math.round(state.scroll);      // da qui non ci si allontana di piu' di uno
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
    if (wasDrag){
      /* Un colpo secco vale UN mobile a partire da dove si e' premuto,
         non uno in piu' di dove il dito e' arrivato: sommarlo alla
         posizione corrente era il secondo salto. */
      if (Math.abs(vx) > COLPO){
        state.scrollTo = clamp(partenzaLib + (vx > 0 ? -1 : 1), 0, maxScroll());
        snapSoon();
      } else snapSoon();
    }

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
    if (e.key === 'Escape'){
      finiscePresa(true); chiudiMia(); chiudiPartita(); chiudiElenco();
      chiudiArreda(); chiudiGestioneGruppi();
      unfocus(); closeAdd(); return;
    }
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

  /* Due gesti diversi che prima erano uno solo.

     "dallo scaffale" toglie la scatola dalla vetrina e la lascia nella
     collezione: e' reversibile, si rimette dall'elenco in un clic, e
     quindi non chiede niente. "elimina" butta via il gioco per sempre,
     resta rosso e resta in due tempi. Chiamarli tutti e due "togli"
     voleva dire che il gesto innocuo e quello irreversibile avevano lo
     stesso nome e lo stesso posto. */
  q('#p-fuori').addEventListener('click', function(e){
    e.stopPropagation();
    const g = state.focused && state.focused.userData.game;
    if (!g) return;
    togliDaScaffale(g.id);
  });

  armaBottone(q('#del'),
    '<span aria-hidden="true">&#9003;</span> elimina',
    'sicuro? sparisce', removeFocused);
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

function setSort(mode){
  state.sort = mode;
  try { localStorage.setItem('dado-ordine', mode); } catch(e){}
  qa('#sortmenu button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sort') === mode);
  });
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
/* "la mia collezione: 10", non "10". Un numero da solo non diceva ne'
   di cosa fosse ne' che ci si potesse cliccare sopra -- ed e' la porta
   dell'elenco. In casa di un amico e' la sua, e lo dice. */
function updateConta(){
  const tot = LIB.all().length;
  const el = q('#conta');
  if (!el) return;
  const chi = LIB.ospitePresso() ? 'la sua collezione' : 'la mia collezione';
  /* Il numero filtrato si vede solo DENTRO l'elenco, che e' dove il
     filtro si e' messo e dove si vede che c'e'. Fuori, il contatore
     torna a dire quanti giochi hai -- restava filtrato anche in
     libreria e nel catalogo, dove nessuno sapeva piu' perche'. */
  const filtrato = document.body.classList.contains('elenco') &&
                   (state.q || state.gruppo || state.soloPreferiti);
  el.innerHTML = filtrato
    ? '<span>' + chi + ':</span> <b>' + lista().length + '</b> <span>di ' + tot + '</span>'
    : '<span>' + chi + ':</span> <b>' + tot + '</b>';
}

/* --- aggiunta -------------------------------------------------- */
function openAdd(){
  chiudiPannelli('add');
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

/* Una riga vuota separa un capoverso: e' il modo in cui si scrive un
   testo, e non serve insegnare niente a chi lo compila. */
function capoversi(testo){
  const t = String(testo || '').trim();
  if (!t) return null;
  const NL = String.fromCharCode(10), CR = String.fromCharCode(13);
  return t.split(CR).join('')                   // fine riga alla Windows
          .split(NL + NL)                       // riga vuota = capoverso nuovo
          .map(function(x){ return x.split(NL).join(' ').trim(); })
          .filter(Boolean);
}

/* --- la tua recensione ------------------------------------------
   Un modulo suo, corto. Scrivere due righe su un gioco non deve voler
   dire aprire quello con dentro anche editore, anno e id BGG -- ed e'
   il testo che i tuoi amici leggono aprendo quel gioco da te. */
function apriMia(){
  const g = state.focused && state.focused.userData.game;
  if (!g || LIB.ospitePresso()) return;
  chiudiPannelli('mia');
  q('#mia-gioco').textContent = g.title;
  q('#mia-voto').value = g.score || '';
  q('#mia-testo').value = (g.review || []).join(String.fromCharCode(10, 10));
  q('#mialayer').classList.add('on');
  q('#mialayer').setAttribute('aria-hidden', 'false');
  setTimeout(function(){ q('#mia-testo').focus(); }, 60);
}

// Escape chiude la finestrella prima di ogni altra cosa: e' l'ultima
// aperta, ed e' quella che ci si aspetta di chiudere per prima
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  if (document.querySelector('.riga-azioni:not([hidden])')) chiudiAzioni(null);
});

/* Chiudendo l'elenco i filtri se ne vanno con lui.

   Restavano accesi: si sceglieva "solo i preferiti", si tornava alla
   libreria, e sugli scaffali c'erano tre scatole invece di trenta senza
   che niente a schermo dicesse perche'. Un filtro che sopravvive alla
   schermata in cui lo si e' messo e' un filtro che non si trova piu'. */
function scordaFiltri(){
  const c1 = state.gruppo, c2 = state.soloPreferiti;
  state.gruppo = '';
  state.soloPreferiti = false;
  if (c1 || c2){ ridisponi(); }
  updateConta();
}

function chiudiMia(){
  q('#mialayer').classList.remove('on');
  q('#mialayer').setAttribute('aria-hidden', 'true');
}

function salvaMia(){
  const box = state.focused;
  const g = box && box.userData.game;
  if (!g) return;
  const patch = { score: q('#mia-voto').value.trim() };
  const testo = capoversi(q('#mia-testo').value);
  if (testo) patch.review = testo;

  const nuovo = LIB.update(g.id, patch);
  chiudiMia();
  if (nuovo){
    box.userData.game = nuovo;
    showPanel(nuovo);              // il pannello dietro mostra subito quello che hai scritto
    flash('recensione salvata');
  }
}

async function addManual(){
  const title = q('#m-title').value.trim();
  if (!title){ q('#m-title').focus(); return; }

  const testi = capoversi(q('#m-review').value);

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
  if (testi) g.review = testi;

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
    collocaNuovo(game);          // nel mobile che si sta guardando
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
  const b = boxes.find(function(x){ return x.userData.id === id; });
  const cubo = b && b.userData.cubo !== undefined ? b.userData.cubo : -1;
  if (cubo < 0) return;
  state.scrollTo = clamp(Math.floor(cubo / PER_LIB), 0, maxScroll());
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
  /* Con una scatola aperta, cambiare sezione la lasciava aperta dietro
     l'elenco: tornando indietro ci si ritrovava un pannello a meta'
     schermo di cui non si ricordava piu' il perche'. */
  if (s !== 'collezione' && (state.phase === 'focus' || state.phase === 'review')) unfocus();
  /* Ogni pannello contestuale appartiene alla schermata da cui si e'
     aperto: restava aperto passando al catalogo o al profilo, sospeso
     su un contenuto che non c'entrava piu' niente. */
  if (s !== 'collezione') chiudiPannelli('');
  state.sezione = s;
  document.body.classList.toggle('sez-collezione', s === 'collezione');
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
    collocaNuovo(messo);
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
   I GRUPPI
   ===============================================================

   Etichette, non contenitori. Una libreria risponde a "dove sta", un
   gruppo a "che cos'e'": Root sta nel mobile del salotto ed e' insieme
   "strategico" e "asimmetrico".

   Per questo non si vedono sullo scaffale ma nella SCHEDA -- dove si
   accendono e si spengono col dito -- e in cima all'ELENCO, dove
   filtrano. Stessa forma nei due posti, perche' sono la stessa cosa. */

function disegnaGruppiScheda(game){
  const el = q('#p-gruppi');
  if (!el) return;
  // in casa d'altri le etichette si leggono, non si spostano
  const suoi = LIB.gruppiDi(game ? game.id : '');
  const altrui = !!LIB.ospitePresso();
  const tutti = LIB.gruppi();

  if (!game || (altrui && !suoi.length)){ el.innerHTML = ''; return; }

  el.innerHTML = tutti
    .filter(function(G){ return !altrui || suoi.indexOf(G.id) >= 0; })
    .map(function(G){
      const on = suoi.indexOf(G.id) >= 0;
      return '<button type="button" data-g="' + esc(G.id) + '"' +
             (on ? ' class="on"' : '') + (altrui ? ' disabled' : '') + '>' +
             esc(G.nome) + '</button>';
    }).join('') +
    (altrui ? '' : '<button type="button" class="nuovo" data-g="+">+ gruppo</button>');
}

/* Creare un gruppo dalla scheda: la pastiglia diventa un campo, sul
   posto. Mandare l'utente in un'altra sezione per scrivere una parola
   e poi farlo tornare qui e' un giro che non serve a niente. */
function nuovoGruppoInLinea(btn, game){
  const li = document.createElement('input');
  li.type = 'text'; li.maxLength = 30; li.placeholder = 'nome del gruppo';
  li.className = 'gruppo-nuovo';
  li.setAttribute('aria-label', 'nome del gruppo nuovo');
  btn.replaceWith(li);
  li.focus();

  const chiudi = function(){ disegnaGruppiScheda(game); };
  li.addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Escape'){ chiudi(); return; }
    if (e.key !== 'Enter') return;
    const nome = li.value.trim();
    if (!nome){ chiudi(); return; }
    li.disabled = true;
    LIB.creaGruppo(nome).then(function(G){
      return LIB.segnaGruppo(game.id, G.id, true);
    }).then(function(){
      disegnaGruppiScheda(game);
      disegnaGruppiFiltro();
      flash('gruppo "' + nome + '" creato');
    }).catch(function(err){
      flash('non creato: ' + err.message);
      chiudi();
    });
  });
  li.addEventListener('blur', function(){ setTimeout(chiudi, 120); });
}

/* La barra dei filtri porta UNA cosa sola: i preferiti, e solo nella
   vista "tutti i giochi".

   Le pastiglie per gruppo non ci sono piu'. Nella vista a gruppi le
   cartelle SONO gia' i gruppi: filtrare per gruppo dentro un elenco
   diviso per gruppi vuol dire dire la stessa cosa due volte, e da li'
   nasceva il difetto -- il filtro restava acceso passando a "tutti i
   giochi", dove contraddice il nome della vista. */
function disegnaGruppiFiltro(){
  const el = q('#mia-gruppi');
  if (!el) return;
  const quanti = LIB.all().filter(function(g){ return g.preferito; }).length;
  el.innerHTML = (state.vista === 'tutti' && quanti)
    ? '<button type="button" data-pref="1"' +
      (state.soloPreferiti ? ' class="on"' : '') + '>&#9733; solo i preferiti</button>'
    : '';
}

let gruppoAperto = null;        // di quale gruppo si stanno scegliendo i giochi

function apriGestioneGruppi(){
  if (LIB.ospitePresso()) return;
  chiudiPannelli('gruppi');
  gruppoAperto = null;
  q('#gru-giochi').hidden = true;
  q('#gru-msg').innerHTML = '';
  disegnaGruppiElenco();
  q('#gruppilayer').classList.add('on');
  q('#gruppilayer').setAttribute('aria-hidden', 'false');
}

/* "fatto" chiude e basta: qui dentro tutto e' gia' salvato mentre lo
   fai. "annulla" butta via l'unica cosa che non lo e' -- il nome del
   gruppo che stavi scrivendo. Un pulsante che promettesse di disfare il
   resto direbbe una bugia. */
function bindPiedeGruppi(){
  const ok = q('#gru-ok');
  if (ok) ok.addEventListener('click', chiudiGestioneGruppi);
  const no = q('#gru-x');
  if (no) no.addEventListener('click', function(){
    const campo = q('#gru-nuovo');
    if (campo) campo.value = '';
    chiudiGestioneGruppi();
  });
}

function chiudiGestioneGruppi(){
  q('#gruppilayer').classList.remove('on');
  q('#gruppilayer').setAttribute('aria-hidden', 'true');
}

/* I giochi di un gruppo, con l'interruttore per ognuno. Tutta la
   collezione e non solo quello che sta in vetrina: un'etichetta vale
   anche per un gioco che al momento non e' sugli scaffali. */
function disegnaGiochiDelGruppo(){
  const box = q('#gru-giochi');
  if (!gruppoAperto){ box.hidden = true; return; }
  const G = LIB.gruppi().find(function(x){ return x.id === gruppoAperto; });
  if (!G){ gruppoAperto = null; box.hidden = true; return; }

  box.hidden = false;
  q('#gru-quale').textContent = 'chi sta in "' + G.nome + '"';
  q('#gru-elenco').innerHTML = LIB.list('nome', '').map(function(g){
    const dentro = LIB.gruppiDi(g.id).indexOf(G.id) >= 0;
    return '<li data-id="' + esc(g.id) + '">' +
      '<span class="nome">' + esc(g.title) + '</span>' +
      '<button type="button"' + (dentro ? ' class="on"' : '') + '>' +
      (dentro ? 'dentro' : 'aggiungi') + '</button></li>';
  }).join('');
}

function disegnaGruppiElenco(){
  const el = q('#pro-gruppi');
  if (!el) return;
  // NON chiamarlo `quanti`: c'e' gia' una funzione con quel nome, e una
  // const locale la copre. La chiamata piu' sotto diventava un
  // TypeError che interrompeva apriProfilo() a meta' -- ed e' il motivo
  // per cui erano vuoti TUTTI i contatori, non solo questo.
  const perGruppo = {};
  LIB.all().forEach(function(g){
    LIB.gruppiDi(g.id).forEach(function(id){ perGruppo[id] = (perGruppo[id] || 0) + 1; });
  });
  const tutti = LIB.gruppi();
  el.innerHTML = tutti.map(function(G){
    const n = perGruppo[G.id] || 0;
    return '<li data-id="' + esc(G.id) + '">' +
      '<span class="chi"><b>' + esc(G.nome) + '</b>' +
      '<span>' + n + ' ' + (n === 1 ? 'gioco' : 'giochi') + '</span></span>' +
      '<span class="fa">' +
        '<button type="button" class="quali" data-fa="quali">' +
        (gruppoAperto === G.id ? 'chiudi' : 'giochi') + '</button>' +
        '<button type="button" class="no" data-fa="via">togli</button>' +
      '</span></li>';
  }).join('');
  disegnaGiochiDelGruppo();
}

function setGruppo(id){
  if (state.gruppo === id) return;
  state.gruppo = id || '';
  disegnaGruppiFiltro();
  state.scrollTo = state.scroll = 0;
  ridisponi();
}

function bindGruppi(){
  q('#p-gruppi').addEventListener('click', function(e){
    const b = e.target.closest('button[data-g]');
    if (!b || b.disabled) return;
    e.stopPropagation();
    const game = state.focused && state.focused.userData.game;
    if (!game) return;

    if (b.getAttribute('data-g') === '+'){ nuovoGruppoInLinea(b, game); return; }

    const id = b.getAttribute('data-g');
    const dentro = !b.classList.contains('on');
    b.classList.toggle('on', dentro);          // ottimista: si vede subito
    LIB.segnaGruppo(game.id, id, dentro).then(function(){
      if (state.gruppo) ridisponi();
    }).catch(function(err){
      b.classList.toggle('on', !dentro);
      flash('non riuscito: ' + err.message);
    });
  });
  q('#p-gruppi').addEventListener('pointerup', function(e){ e.stopPropagation(); });

  q('#mia-gruppi').addEventListener('click', function(e){
    const p = e.target.closest('button[data-pref]');
    if (p){
      state.soloPreferiti = !state.soloPreferiti;
      state.scrollTo = state.scroll = 0;
      ridisponi();
      disegnaMia();
      return;
    }
    const b = e.target.closest('button[data-g]');
    if (b) setGruppo(b.getAttribute('data-g'));
  });

  bindViste();
  q('#mia-gestisci').addEventListener('click', apriGestioneGruppi);
  // `#gru-x` lo aggancia bindPiedeGruppi: prima svuota il campo
  q('#gruppilayer').addEventListener('pointerup', function(e){ e.stopPropagation(); });

  q('#gru-piu').addEventListener('click', function(){
    const v = q('#gru-nuovo').value.trim();
    if (!v) return;
    LIB.creaGruppo(v).then(function(G){
      q('#gru-nuovo').value = '';
      proMsg('#gru-msg', '');
      gruppoAperto = G.id;            // appena creato, si sceglie chi ci va
      disegnaGruppiElenco();
      disegnaGruppiFiltro();
      disegnaMia();
    }).catch(function(e){ proMsg('#gru-msg', esc(e.message), true); });
  });
  q('#gru-nuovo').addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') q('#gru-piu').click();
  });

  q('#pro-gruppi').addEventListener('click', function(e){
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.getAttribute('data-id');

    if (e.target.closest('[data-fa="quali"]')){
      gruppoAperto = (gruppoAperto === id) ? null : id;
      disegnaGruppiElenco();
      return;
    }
    const b = e.target.closest('button[data-fa="via"]');
    if (!b) return;
    b.disabled = true;
    LIB.togliGruppo(id).then(function(){
      if (state.gruppo === id) setGruppo('');
      if (gruppoAperto === id) gruppoAperto = null;
      disegnaGruppiElenco();
      disegnaGruppiFiltro();
      disegnaMia();
      flash('gruppo tolto: i giochi restano dove sono');
    }).catch(function(err){ b.disabled = false; flash('non tolto: ' + err.message); });
  });

  // dentro/fuori dal gruppo aperto, un gioco per riga
  q('#gru-elenco').addEventListener('click', function(e){
    const b = e.target.closest('button');
    if (!b || !gruppoAperto) return;
    const id = b.closest('li').getAttribute('data-id');
    const dentro = !b.classList.contains('on');
    b.classList.toggle('on', dentro);
    b.textContent = dentro ? 'dentro' : 'aggiungi';
    const G = gruppoAperto;
    LIB.segnaGruppo(id, G, dentro).then(function(){
      /* NON si ridisegna l'elenco dei giochi. Sostituirlo a ogni tocco
         stacca dal documento il pulsante appena premuto, e il tocco
         successivo cade su un nodo che non c'e' piu': segnandone due di
         fila, il secondo non arrivava. Si aggiorna solo il numero, in
         posto. */
      const li = q('#pro-gruppi li[data-id="' + G + '"]');
      if (li){
        const n = LIB.all().filter(function(x){
          return LIB.gruppiDi(x.id).indexOf(G) >= 0;
        }).length;
        li.querySelector('.chi span').textContent = n + ' ' + (n === 1 ? 'gioco' : 'giochi');
      }
      disegnaGruppiFiltro();
      disegnaMia();
    }).catch(function(err){
      b.classList.toggle('on', !dentro);
      b.textContent = dentro ? 'aggiungi' : 'dentro';
      flash('non riuscito: ' + err.message);
    });
  });
}

/* ===============================================================
   I MOBILI
   ===============================================================

   Una libreria e' un mobile con un nome: si crea, si rinomina, si
   toglie. Toglierla non butta via i giochi -- la chiave esterna e'
   `on delete set null`, quindi restano senza posto e rifluiscono nei
   cubi liberi delle altre. Cancellare uno scaffale non e' cancellare
   quello che c'era sopra.

   Ci si arriva dal NOME in basso, che e' dove uno guarda per sapere in
   che libreria si trova. */

function disegnaLibrerie(){
  const el = q('#st-lista');
  if (!el) return;
  const l = LIB.librerie();
  const perLibreria = {};             // vedi disegnaGruppiElenco: non chiamarlo `quanti`
  LIB.all().forEach(function(g){
    if (g.libreria) perLibreria[g.libreria] = (perLibreria[g.libreria] || 0) + 1;
  });
  const corrente = libCorrente();

  el.innerHTML = l.map(function(L){
    return '<li data-id="' + esc(L.id) + '"' +
        (corrente && corrente.id === L.id ? ' class="qui"' : '') + '>' +
      '<span class="nome">' + esc(L.nome) + '</span>' +
      '<span class="quanti">' + (perLibreria[L.id] || 0) + '</span>' +
      (l.length > 1
        ? '<button type="button" data-fa="via" aria-label="elimina ' + esc(L.nome) + '">' + ICO.cestino + '</button>'
        : '') +
      '<button type="button" class="presa" data-fa="sposta" aria-label="tieni premuto e trascina per riordinare">' +
        ICO.maniglia + '</button>' +
    '</li>';
  }).join('');
}

/* Il nome della libreria che si sta guardando, nel campo in chiaro. Il
   pulsante si accende solo se c'e' davvero qualcosa da salvare: vedi
   la nota sulla rinomina piu' sotto. */
function disegnaNomeCorrente(){
  const inp = q('#st-rinomina'), ok = q('#st-rinomina-ok');
  if (!inp) return;
  const L = libCorrente();
  inp.value = L ? L.nome : '';
  inp.disabled = !L;
  /* Sul mobile di scorta il campo e' spento: dirlo e' meglio che
     lasciarlo vuoto e muto, perche' la scorta si vede come le altre. */
  inp.placeholder = L ? '' : 'nessun mobile qui';
  if (ok) ok.disabled = true;
  segnaGesti();
  mobileMostrato = Math.round(state.scroll);
}

/* Rinominare vuole una conferma esplicita. Salvare all'uscita dal campo
   faceva partire una scrittura anche a chi ci cliccava dentro per
   sbaglio, e soprattutto non si capiva se era andata: il nome sopra la
   libreria e' l'unica prova, e va aggiornato subito -- per questo si
   richiama `buildCabinet`, che la targhetta sta dentro il mobile. */
function confermaNomeCorrente(){
  const inp = q('#st-rinomina'), ok = q('#st-rinomina-ok');
  const L = libCorrente();
  if (!L) return;
  ok.disabled = true;
  LIB.rinominaLibreria(L.id, inp.value).then(function(){
    buildCabinet();
    applyLibrary({});
    updateRail();
    disegnaLibrerie();
    flash('libreria rinominata');
  }).catch(function(err){
    ok.disabled = false;
    flash('non rinominata: ' + err.message);
  });
}

/* --- riordinare i mobili trascinando ------------------------------
   Si prende dalla MANIGLIA e non da tutta la riga: la riga porta anche
   un pulsante che elimina, e un elenco dove ogni punto e' buono per
   trascinare e' un elenco dove ogni tocco rischia di spostare qualcosa.

   Mentre si trascina si riordina il DOM e basta; al rilascio si manda
   l'ordine nuovo, si rifa' il mobile e si ridispongono le scatole --
   cambiare l'ordine dei mobili cambia da che parte stanno lungo la
   parete, quindi le scatole si spostano con loro. */
function bindOrdineLibrerie(){
  const el = q('#st-lista');
  if (!el) return;
  let presa = null;

  el.addEventListener('pointerdown', function(e){
    const man = e.target.closest('[data-fa="sposta"]');
    if (!man) return;
    presa = man.closest('li');
    presa.classList.add('in-mano');
    try { man.setPointerCapture(e.pointerId); } catch(err){}
    e.preventDefault();
  });

  el.addEventListener('pointermove', function(e){
    if (!presa) return;
    // su quale riga sta il dito adesso
    const righe = Array.prototype.slice.call(el.children);
    for (let i = 0; i < righe.length; i++){
      const li = righe[i];
      if (li === presa) continue;
      const r = li.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) continue;
      const meta = r.top + r.height / 2;
      el.insertBefore(presa, e.clientY < meta ? li : li.nextSibling);
      break;
    }
  });

  const molla = function(){
    if (!presa) return;
    presa.classList.remove('in-mano');
    presa = null;
    const ids = Array.prototype.slice.call(el.children)
      .map(function(li){ return li.getAttribute('data-id'); });
    if (!LIB.riordinaLibrerie(ids)) return;     // niente cambiato: niente da rifare
    buildCabinet();
    applyLibrary({ animate: true });
    updateRail();
    disegnaLibrerie();
    sincronizzaPannello();
    flash('librerie riordinate');
  };
  el.addEventListener('pointerup', molla);
  el.addEventListener('pointercancel', molla);

  /* Eliminare una libreria dall'elenco: IN DUE TEMPI.

     Al primo giro era un clic solo, e un clic solo su un cestino in
     mezzo a un elenco che si trascina e' un incidente che aspetta di
     capitare -- infatti e' capitato: due mobili spariti, e con la
     chiave esterna `on delete set null` trentacinque giochi tornati
     senza posto tutti insieme.

     Vale la regola di sempre: quello che butta via qualcosa chiede
     conferma sul pulsante stesso, e si disarma da solo dopo qualche
     secondo. */
  let armato = null, armatoT = 0;
  const disarma = function(){
    clearTimeout(armatoT);
    if (armato && armato.isConnected){
      armato.classList.remove('armed');
      armato.setAttribute('aria-label', 'elimina');
    }
    armato = null;
  };
  el.addEventListener('click', function(e){
    const b = e.target.closest('button[data-fa="via"]');
    if (!b){ disarma(); return; }
    if (armato !== b){
      disarma();
      armato = b;
      b.classList.add('armed');
      b.setAttribute('aria-label', 'tocca ancora per eliminare');
      armatoT = setTimeout(disarma, 4000);
      return;
    }
    disarma();
    const id = b.closest('li').getAttribute('data-id');
    b.disabled = true;
    LIB.togliLibreria(id).then(function(){
      state.scrollTo = state.scroll = clamp(state.scroll, 0, maxScroll());
      buildCabinet();
      applyLibrary({ animate: true });
      updateRail();
      disegnaLibrerie();
      sincronizzaPannello();
      flash('libreria tolta: i giochi che c\'erano sono usciti dagli scaffali');
    }).catch(function(err){ b.disabled = false; flash('non tolta: ' + err.message); });
  });
}

function creaLibreriaNuova(){
  LIB.creaLibreria('').then(function(L){
    disegnaLibrerie();
    /* Una libreria nuova esiste solo nell'ordine manuale: negli altri i
       cubi si riempiono in sequenza e il mobile in piu' resta vuoto
       qualunque cosa si faccia. Creandone una si sta dicendo "voglio
       decidere io dove vanno", quindi ci si passa. */
    if (state.sort !== 'mio'){
      fissaOrdineCorrente();
      setSort('mio');
      flash('libreria "' + L.nome + '": ordine tuo, ora le scatole si spostano');
    } else {
      applyLibrary({ animate: true });
      flash('libreria nuova: ' + L.nome);
    }
    state.scrollTo = clamp(LIB.librerie().length - 1, 0, maxScroll());
    sincronizzaPannello();
  }).catch(function(e){ flash('non creata: ' + e.message); });
}

function bindLibrerie(){
  const inp = q('#st-rinomina'), ok = q('#st-rinomina-ok');
  if (inp){
    inp.addEventListener('input', function(){
      const L = libCorrente();
      ok.disabled = !inp.value.trim() || (L && inp.value === L.nome);
    });
    inp.addEventListener('keydown', function(e){
      e.stopPropagation();                       // se no Esc chiude il pannello
      if (e.key === 'Enter' && !ok.disabled) confermaNomeCorrente();
    });
  }
  if (ok) ok.addEventListener('click', confermaNomeCorrente);

  const piu = q('#st-piu');
  if (piu) piu.addEventListener('click', creaLibreriaNuova);

  /* Eliminare resta in due tempi, come tutto quello che butta via
     qualcosa: una libreria in meno rimanda i suoi giochi fuori dagli
     scaffali, e non e' un gesto da un clic solo. */
  const meno = q('#st-meno');
  if (meno) armaBottone(meno, 'elimina questa libreria', 'sicuro? tocca ancora', function(){
    const L = libCorrente();
    if (!L){ flash('qui non c\u2019e\u2019 nessuna libreria da togliere'); return; }
    LIB.togliLibreria(L.id).then(function(){
      state.scrollTo = state.scroll = clamp(state.scroll, 0, maxScroll());
      buildCabinet();
      applyLibrary({ animate: true });
      updateRail();
      disegnaLibrerie();
      sincronizzaPannello();
      flash('libreria tolta: i giochi che c\'erano sono usciti dagli scaffali');
    }).catch(function(err){ flash('non tolta: ' + err.message); });
  });

  bindOrdineLibrerie();
}

/* ===============================================================
   ARREDARE LA STANZA
   ===============================================================

   Il pannello sta in un angolo e non copre la scena: scegliere un
   colore guardando un'anteprima grande come un francobollo non e'
   scegliere, e' indovinare. Si vede subito quello che si sta facendo.

   Si salva da solo dopo una pausa. Un pulsante "salva" su un pannello
   dove ogni clic si vede gia' applicato e' una domanda a cui l'utente
   ha gia' risposto. */

let salvaStanzaT = 0;

function salvaStanzaTraPoco(){
  clearTimeout(salvaStanzaT);
  q('#st-msg').textContent = 'sto salvando';
  salvaStanzaT = setTimeout(function(){
    STANZA.salva()
      .then(function(){ q('#st-msg').textContent = 'salvata'; })
      .catch(function(e){ q('#st-msg').textContent = 'non salvata: ' + e.message; });
  }, 700);
}

/* Quale mobile si sta guardando: e' quello di cui si cambiano nome,
   legno e arredi. Il resto -- luce, muro, pavimento -- e' la stanza, e
   la stanza e' una sola.

   Puo' rispondere `null`, ed e' tutto il punto. In fondo alla fila c'e'
   sempre un mobile in PIU' di quelli che esistono davvero -- quello di
   scorta, dove si trascina una scatola per cominciarne un altro (vedi
   `disposizione`). Sullo schermo si vede come gli altri, ma una riga in
   `librerie` non ce l'ha.

   Prima qui si accostava all'ultimo mobile vero, e il pannello finiva
   per parlare di un mobile diverso da quello inquadrato: scegliere un
   legno stando sulla scorta ridipingeva quello accanto, e "elimina
   questa libreria" spariva nel nulla. Chi chiede deve poter sapere che
   li' non c'e' niente. */
function libCorrente(){
  return LIB.librerie()[Math.round(state.scroll)] || null;
}

/* Quale riga dell'elenco e' il mobile che si sta guardando. La classe
   si sposta IN POSTO e l'elenco non si rifa': rifarlo mentre si scorre
   staccherebbe la riga che si sta trascinando per riordinare, che e' la
   stessa lezione dell'elenco dei gruppi. */
function segnaQui(){
  const el = q('#st-lista');
  if (!el) return;
  const L = libCorrente();
  Array.prototype.forEach.call(el.children, function(li){
    li.classList.toggle('qui', !!L && li.getAttribute('data-id') === L.id);
  });
}

/* I due gesti in fondo al pannello sanno su cosa stanno per agire.

   `elimina questa libreria` prendeva il mobile all'indice dello scroll
   e usciva in silenzio quando non c'era (la scorta), oppure rispondeva
   "l'ultima libreria non si toglie" a chi sullo schermo ne vedeva due.
   Un comando che non si puo' usare si spegne e dice perche', invece di
   fallire dopo il clic. */
function segnaGesti(){
  const meno = q('#st-meno');
  if (!meno) return;
  const L = libCorrente(), quante = LIB.librerie().length;
  const motivo = !L
    ? 'qui non c\u2019e\u2019 ancora nessun mobile: trascinaci una scatola, o aggiungine uno'
    : (quante <= 1
        ? 'e\u2019 l\u2019unica libreria che hai: prima aggiungine un\u2019altra'
        : '');
  meno.disabled = !!motivo;
  meno.title = motivo || ('elimina ' + L.nome);
  if (motivo && meno.__disarma) meno.__disarma();
}

/* Tutto quello che il pannello dice del mobile inquadrato, in un posto
   solo: legno e arredi, il nome nel campo, la riga "qui" nell'elenco e
   i due gesti in fondo. Prima scorrendo si rinfrescavano solo legno e
   arredi, quindi il campo del nome restava sul mobile di prima. */
function sincronizzaPannello(){
  mobileMostrato = Math.round(state.scroll);
  disegnaStanza();
  disegnaNomeCorrente();
  segnaQui();
}

function disegnaStanza(){
  const cur = STANZA.corrente();
  const L = libCorrente();
  const suo = {
    scaffali: (L && L.scaffali) || cur.scaffali,
    arredo:   (L && L.arredo)   || cur.arredo
  };

  q('#st-luce').value = cur.luce;
  q('#st-luce-n').textContent = Math.round(cur.luce * 100) + '%';
  q('#st-quale').textContent = L ? L.nome : 'nessun mobile qui';

  const gruppo = function(sel, lista, valore, testo){
    q(sel).innerHTML = lista.map(function(x){
      const on = valore === x.v ? ' class="on"' : '';
      const stile = testo ? '' : ' style="background:' + esc(x.v) + '"';
      return '<button type="button" data-v="' + esc(x.v) + '" title="' + esc(x.n) + '"' +
             on + stile + '>' + (testo ? esc(x.n) : '') + '</button>';
    }).join('');
  };
  gruppo('#st-scaffali',  STANZA.LEGNI,     suo.scaffali,   false);
  gruppo('#st-muro',      STANZA.MURI,      cur.muro,       false);
  gruppo('#st-pavimento', STANZA.PAVIMENTI, cur.pavimento,  false);
  gruppo('#st-arredo',    STANZA.ARREDI,    suo.arredo,     true);
}

/* UN PANNELLO CONTESTUALE ALLA VOLTA.

   Due pannelli aperti insieme si contendono lo stesso angolo di
   schermo, e nessuno dei due dice piu' a cosa si riferisce: si poteva
   aprire il menu della stanza mentre era aperta la scheda delle
   librerie, e le due finestre si accavallavano. Aprirne uno chiude
   tutti gli altri, sempre. */
function chiudiPannelli(tranne){
  if (tranne !== 'vista')   chiudiVista();
  if (tranne !== 'arreda')  chiudiArreda();
  if (tranne !== 'elenco')  chiudiElenco();
  if (tranne !== 'mia')     chiudiMia();
  if (tranne !== 'partita') chiudiPartita();
  if (tranne !== 'add')     closeAdd();
  if (tranne !== 'gruppi')  chiudiGestioneGruppi();
}

/* --- l'imbuto: cosa vedi sullo scaffale ---------------------------
   Cercare, ordinare e scegliere il mobile sono la stessa domanda, e
   stanno sotto lo stesso pulsante. Un pannello alla volta come tutti
   gli altri: due aperti insieme si contendono l'angolo e nessuno dei
   due dice piu' a cosa si riferisce. */
function apriVista(){
  chiudiPannelli('vista');
  document.body.classList.add('vista');
  q('#vista').setAttribute('aria-hidden', 'false');
  q('#vista-apri').setAttribute('aria-expanded', 'true');
  nomeMobileCorrente();
  /* Non si ruba il fuoco all'apertura. Lo faceva, e il campo si
     accendeva del suo contorno senza che nessuno avesse toccato niente:
     sembrava un errore, non un invito. Chi vuole cercare ci clicca. */
}

function chiudiVista(){
  document.body.classList.remove('vista');
  q('#vista').setAttribute('aria-hidden', 'true');
  q('#vista-apri').setAttribute('aria-expanded', 'false');
}

// il nome del mobile che si sta guardando, sul pulsante che li apre
function nomeMobileCorrente(){
  const b = q('#vista-mobili');
  if (!b) return;
  const L = libCorrente();
  b.textContent = L ? L.nome : 'nuova libreria';
}

function bindVista(){
  q('#vista-apri').addEventListener('click', function(){
    if (document.body.classList.contains('vista')) chiudiVista();
    else apriVista();
  });
  q('#vista-x').addEventListener('click', chiudiVista);
  /* La porta dei mobili non sta piu' qui: il pannello della libreria
     -- quello con lo scaffale disegnato sopra -- fa gia' luce, nome,
     aspetto e ordine, e due porte per la stessa stanza sono una di
     troppo. */
}

function apriArreda(){
  if (LIB.ospitePresso()) return;          // in casa d'altri non si arreda
  chiudiPannelli('arreda');
  disegnaLibrerie();
  sincronizzaPannello();
  document.body.classList.add('arreda');
  q('#stanza').setAttribute('aria-hidden', 'false');
  q('#st-msg').textContent = 'si salva da solo';
}

function chiudiArreda(){
  document.body.classList.remove('arreda');
  q('#stanza').setAttribute('aria-hidden', 'true');
}

function bindStanza(){
  q('#stanza-apri').addEventListener('click', apriArreda);
  q('#stanza-x').addEventListener('click', chiudiArreda);

  /* Il cursore della luce chiama solo applicaLuce(): e' un cambio di
     intensita', non di materiali, e ricostruire il mobile a ogni
     pixel di trascinamento lo farebbe singhiozzare. */
  q('#st-luce').addEventListener('input', function(){
    STANZA.cambia({ luce: parseFloat(q('#st-luce').value) });
    q('#st-luce-n').textContent = Math.round(STANZA.corrente().luce * 100) + '%';
    applicaLuce();
    salvaStanzaTraPoco();
  });

  // muro e pavimento sono la stanza
  [['#st-muro','muro'], ['#st-pavimento','pavimento']].forEach(function(par){
    q(par[0]).addEventListener('click', function(e){
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const patch = {};
      patch[par[1]] = b.getAttribute('data-v');
      STANZA.cambia(patch);
      disegnaStanza();
      applicaStanza();
      salvaStanzaTraPoco();
    });
  });

  /* Legno e arredi sono del MOBILE che si sta guardando. Due librerie
     in una stanza vera non sono per forza dello stesso legno, e chi
     divide i giochi per scaffale vuole distinguerli anche da lontano. */
  [['#st-scaffali','scaffali'], ['#st-arredo','arredo']].forEach(function(par){
    q(par[0]).addEventListener('click', function(e){
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const L = libCorrente();
      if (!L){ flash('nessun mobile da arredare'); return; }
      const patch = {};
      patch[par[1]] = b.getAttribute('data-v');
      q('#st-msg').textContent = 'sto salvando';
      LIB.stileLibreria(L.id, patch).then(function(){
        q('#st-msg').textContent = 'salvata';
      }).catch(function(err){
        q('#st-msg').textContent = 'non salvata: ' + err.message;
      });
      disegnaStanza();
      applicaStanza();          // il cambio si vede subito, il salvataggio segue
    });
  });

  armaBottone(q('#st-reset'), 'com\u2019era', 'sicuro?', function(){
    STANZA.cambia(STANZA.DEFAULT);
    disegnaStanza();
    applicaStanza();
    salvaStanzaTraPoco();
  });
}

/* ===============================================================
   LA MIA LIBRERIA COME ELENCO
   ===============================================================

   Lo scaffale in tre dimensioni e' bello da guardare e pessimo da
   consultare: dodici scatole per schermata, i titoli piccoli, e per
   sapere se un gioco ce l'hai gia' devi scorrere i mobili. L'elenco e'
   la stessa collezione in una riga per gioco.

   Ci si arriva dal CONTATORE, che e' gia' il posto dove uno guarda per
   sapere quanti sono: non serviva un altro pulsante in una testata che
   a 390 px e' gia' piena. */

/* La riga: copertina, nome, e il tasto a tre righe. Niente altro.

   Una riga che mostra gia' tutto obbliga a scorrere per contare i
   propri giochi. Qui l'elenco si legge a colpo d'occhio e si apre solo
   quello che interessa -- e sono due aperture diverse, non una:

   - la RIGA apre le informazioni: che gioco e', dove sta, cosa ne
     pensi, in che gruppi e';
   - il TASTO A TRE RIGHE apre le azioni: in libreria, togli, vai allo
     scaffale, elimina.

   Il preferito non e' piu' li' dentro: e' una stellina sulla riga. E'
   un interruttore da un tocco, e metterlo in un menu voleva dire due
   tocchi per accenderlo e un'apertura per sapere se era acceso --
   mentre la stella si vede scorrendo, che e' quando serve.

   Sono due domande distinte, "che gioco e'" e "cosa ci faccio", e
   mescolarle voleva dire che per leggere due righe di recensione ti
   trovavi davanti quattro pulsanti. */
/* La stellina del preferito. In casa di un amico non c'e' -- li' non si
   tocca niente -- ma il posto resta occupato da uno spazio vuoto: le
   colonne della griglia sono quelle, e una riga in meno di elementi
   sposterebbe il tasto del menu sotto la stella delle altre. */
function stellaRiga(g){
  if (LIB.ospitePresso()) return '<span class="riga-stella-vuota"></span>';
  const si = !!g.preferito;
  const che = si ? 'togli dai preferiti' : 'metti fra i preferiti';
  return '<button type="button" class="riga-stella" data-fa="stella"' +
         ' aria-pressed="' + (si ? 'true' : 'false') + '"' +
         ' title="' + che + '" aria-label="' + che + '">' + ICO.stella + '</button>';
}

function rigaMia(g){
  const cop = g.cover
    ? '<img src="' + esc(g.cover) + '" alt="" loading="lazy">'
    : '<span class="senza">' + esc(String(g.title || '?').slice(0, 1).toUpperCase()) + '</span>';

  return '<li data-id="' + esc(g.id) + '">' +
    '<div class="cat-cop">' + cop + '</div>' +
    '<h3 class="riga-nome">' + esc(g.title) + '</h3>' +
    stellaRiga(g) +
    /* Il tasto e le sue azioni stanno nello stesso involucro: la
       finestrella si ancora al PULSANTE, non alla riga -- se no, con le
       informazioni aperte sotto, uscirebbe mezzo schermo piu' in giu'
       di dove si e' premuto. */
    '<div class="riga-menuwrap">' +
      '<button type="button" class="riga-menu" data-fa="menu" aria-expanded="false" ' +
        'aria-label="cosa posso farci">' + ICO.menu + '</button>' +
      '<div class="riga-azioni" hidden></div>' +
    '</div>' +
    '<div class="riga-info" hidden></div>' +
  '</li>';
}

/* Le informazioni, costruite solo quando si aprono: con duecento giochi
   nell'elenco, riempire tutte le schede in anticipo vuol dire generare
   duecento blocchi che nessuno guardera'. */
function contenutoInfo(g){
  const L = g.libreria && LIB.librerie().find(function(x){ return x.id === g.libreria; });
  const chi = [g.designer, g.publisher].filter(Boolean).map(esc).join(' &middot; ');
  const spec = [[g.players, 'giocatori'], [g.time, 'minuti'], [g.year, 'anno']]
    .filter(function(x){ return x[0]; })
    .map(function(x){ return '<li><b>' + esc(x[0]) + '</b>' + x[1] + '</li>'; }).join('');
  const testo = (g.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('');

  const tutti = LIB.gruppi();
  const suoi = LIB.gruppiDi(g.id);
  const chip = (LIB.ospitePresso() || !tutti.length) ? '' :
    '<div class="gruppi riga-gruppi">' + tutti.map(function(G){
      return '<button type="button" data-g="' + esc(G.id) + '"' +
             (suoi.indexOf(G.id) >= 0 ? ' class="on"' : '') + '>' + esc(G.nome) + '</button>';
    }).join('') + '</div>';

  return (chi  ? '<p class="cat-chi">' + chi + '</p>' : '') +
         (spec ? '<ul class="cat-spec">' + spec + '</ul>' : '') +
         '<p class="cat-dove">' + (L ? 'in <b>' + esc(L.nome) + '</b>' : 'non in libreria') + '</p>' +
         (g.score ? '<p class="voto">' + esc(g.score) + '<i>/10</i></p>' : '') +
         (testo || '<p class="vuoto">Nessuna recensione, per ora.</p>') +
         chip;
}

function contenutoAzioni(g){
  if (LIB.ospitePresso()) return '<p class="vuoto">In casa di un amico si guarda e basta.</p>';
  return (g.libreria
           ? '<button type="button" data-fa="scaffale">' + ICO.scaffale + '<span>vai allo scaffale</span></button>' +
             '<button type="button" data-fa="fuori" class="fuori">' + ICO.fuori + '<span>togli dalla libreria</span></button>'
           : '<button type="button" data-fa="dentro" class="dentro">' + ICO.dentro + '<span>metti in libreria</span></button>') +
         /* Uscire dallo scaffale e sparire dalla collezione restano due
            gesti diversi: il primo e' reversibile in un clic, il secondo
            no. Per questo l'ultimo e' rosso e in due tempi. */
         '<button type="button" data-fa="elimina" class="elimina">' + ICO.cestino +
           '<span>elimina il gioco</span></button>';
}

/* L'elenco si divide in CARTELLE quando non si sta filtrando su un
   gruppo solo: un'intestazione per gruppo, e in fondo quelli che non ne
   hanno nessuno. Scegliendo un gruppo dalle pastiglie si vede solo
   quello, che e' l'altra meta' della stessa domanda.

   Un gioco che sta in due gruppi compare sotto tutti e due. Non e' un
   errore da correggere: e' cosa vuol dire mettere delle etichette, ed
   e' anche la differenza con i mobili, dove una scatola sta in un posto
   solo perche' e' un posto fisico. */
function disegnaMia(){
  segnaVista();
  disegnaGruppiFiltro();
  const l = lista();
  const dove = LIB.ospitePresso();
  q('#mia-eyebrow').textContent = dove && dove.nick
    ? 'la collezione di ' + dove.nick : 'la tua collezione';

  const gruppi = LIB.gruppi();
  const aCartelle = state.vista === 'gruppi' && !state.gruppo && gruppi.length > 0;
  disegnaViste();

  if (!aCartelle){
    q('#mia-list').innerHTML = l.map(rigaMia).join('');
  } else {
    /* Ogni gruppo e' una tendina, e quale sia aperta se lo ricorda:
       aperte tutte, con qualche gruppo, si torna a un elenco lungo come
       prima. Si parte aperte pero': un elenco di soli titoli chiusi non
       fa vedere niente al primo colpo. */
    /* Le cartelle partono CHIUSE. Aperte, con qualche gruppo, la vista
       a gruppi diventava l'elenco intero con dei titoli in mezzo -- cioe'
       la vista accanto, piu' rumore. Chiuse si legge subito quali gruppi
       ci sono e quanti giochi hanno, che e' la domanda per cui uno apre
       questa vista. Quale si e' aperta se lo ricorda. */
    const cartella = function(id, nome, dentro){
      if (!dentro.length) return '';
      let su = false;
      try { su = localStorage.getItem('dado-cartella-' + id) === '1'; } catch(e){}
      return '<div class="cartella" data-c="' + esc(id) + '">' +
        '<button type="button" class="cartella-tit" aria-expanded="' + (su ? 'true' : 'false') + '">' +
          esc(nome) + '<span>' + dentro.length + '</span></button>' +
        '<ol class="righe compatta"' + (su ? '' : ' hidden') + '>' +
          dentro.map(rigaMia).join('') +
        '</ol></div>';
    };

    let html = gruppi.map(function(G){
      return cartella(G.id, G.nome, l.filter(function(g){
        return LIB.gruppiDi(g.id).indexOf(G.id) >= 0;
      }));
    }).join('');
    html += cartella('__senza', 'senza gruppo',
                     l.filter(function(g){ return !LIB.gruppiDi(g.id).length; }));
    q('#mia-list').innerHTML = html;
  }

  const inVetrina = l.filter(function(g){ return !!g.libreria; }).length;
  const perche = [];
  if (state.q) perche.push('per <b>' + esc(state.q) + '</b>');
  if (state.soloPreferiti) perche.push('fra i preferiti');
  if (state.vista === 'gruppi' && !gruppi.length){
    q('#mia-msg').innerHTML = 'Nessun gruppo, per ora: da <b>gestisci gruppi</b> ' +
      'se ne crea uno e ci si mettono i giochi dentro.';
    return;
  }
  q('#mia-msg').innerHTML = l.length
    ? '<b>' + l.length + '</b> ' + (l.length === 1 ? 'gioco' : 'giochi') +
      (perche.length ? ' ' + perche.join(', ') : '') +
      ', <b>' + inVetrina + '</b> sugli scaffali. Tocca una riga per la scheda.'
    : (perche.length ? 'Niente ' + perche.join(', ') + '.' : 'La libreria e\' vuota.');
}

/* --- le due viste ------------------------------------------------
   `gruppi` divide in cartelle, `tutti` e' l'elenco intero ordinabile.
   Si passa dall'una all'altra toccando la voce oppure scorrendo di
   lato, e l'indicatore segue il dito invece di saltare alla fine: e'
   quello che dice che le due viste stanno una accanto all'altra. */
function disegnaViste(){
  qa('#viste button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-vista') === state.vista);
    b.setAttribute('aria-selected', b.getAttribute('data-vista') === state.vista ? 'true' : 'false');
  });
  /* L'indicatore segue l'ORDINE delle voci, che si e' invertito: prima
     "tutti i giochi", poi "gruppi". Era rimasto indietro e restava
     sotto la prima voce mentre l'accesa era la seconda. */
  const ind = q('#viste .ind');
  if (ind) ind.style.transform = 'translateX(' + (state.vista === 'gruppi' ? 100 : 0) + '%)';
}

/* I filtri per gruppo appartengono alla vista a cartelle. Nell'elenco
   intero restavano accesi e filtravano una lista che i gruppi non li
   mostra nemmeno: due comandi che dicono cose diverse sulla stessa
   schermata. */
function segnaVista(){
  document.body.classList.toggle('vista-tutti', state.vista === 'tutti');
}

function setVista(v){
  if (v !== 'gruppi' && v !== 'tutti') return;
  if (v === state.vista){ disegnaViste(); return; }
  state.vista = v;
  try { localStorage.setItem('dado-vista', v); } catch(e){}
  /* Passando di vista i filtri si azzerano: "solo i preferiti" e' un
     taglio della vista in cui lo si e' scelto, e trovarselo acceso
     nell'altra vuol dire vedere un elenco corto senza sapere perche'. */
  state.gruppo = '';
  state.soloPreferiti = false;
  segnaVista();
  disegnaMia();
  // l'elenco entra dal lato da cui si e' arrivati
  const lista = q('#mia-list');
  if (lista){
    lista.style.transition = 'none';
    lista.style.transform = 'translateX(' + (v === 'tutti' ? 26 : -26) + 'px)';
    lista.style.opacity = '0';
    requestAnimationFrame(function(){
      lista.style.transition = '';
      lista.style.transform = '';
      lista.style.opacity = '';
    });
  }
}

/* Lo scorrimento di lato. Si ingaggia solo quando il movimento e'
   chiaramente orizzontale: `#mia` scorre in verticale, e rubare il
   gesto a chi sta scendendo nell'elenco sarebbe il modo piu' rapido di
   rendere la pagina inusabile. */
function bindViste(){
  qa('#viste button').forEach(function(b){
    b.addEventListener('click', function(){ setVista(b.getAttribute('data-vista')); });
  });

  const mia = q('#mia'), viste = q('#viste'), lista = q('#mia-list');
  let x0 = 0, y0 = 0, attivo = false, deciso = false, largo = 1;

  let t0 = 0;
  mia.addEventListener('pointerdown', function(e){
    if (e.target.closest('button, input, a')) return;
    x0 = e.clientX; y0 = e.clientY; t0 = performance.now();
    attivo = true; deciso = false;
    largo = mia.clientWidth || 1;
  });

  mia.addEventListener('pointermove', function(e){
    if (!attivo) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;

    if (!deciso){
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)){ attivo = false; return; }
      if (Math.abs(dx) < 12) return;
      deciso = true;
      viste.classList.add('trascina');
      mia.classList.add('trascina');
    }

    /* Non si scorre oltre il bordo: dalla prima vista si va solo verso
       destra, dall'ultima solo verso sinistra. Lasciar trascinare dove
       non c'e' niente promette una terza schermata che non esiste. */
    /* L'ordine delle due viste si e' invertito: prima "tutti i giochi",
       poi "gruppi". Da qui dipendono il verso in cui si puo' trascinare
       e da che parte parte l'indicatore -- lasciarli com'erano vorrebbe
       dire un indicatore che va dalla parte sbagliata. */
    const utile = state.vista === 'tutti' ? Math.min(0, dx) : Math.max(0, dx);
    const frazione = Math.max(-1, Math.min(1, utile / largo));
    const base = state.vista === 'gruppi' ? 100 : 0;

    q('#viste .ind').style.transform = 'translateX(' + (base - frazione * 100) + '%)';
    lista.style.transform = 'translateX(' + (frazione * largo * .25) + 'px)';
    lista.style.opacity = String(1 - Math.abs(frazione) * .55);
  });

  const finito = function(e){
    if (!attivo) return;
    const dx = e.clientX - x0;
    attivo = false;
    viste.classList.remove('trascina');
    mia.classList.remove('trascina');
    lista.style.transform = '';
    lista.style.opacity = '';

    /* La soglia e' un quinto della larghezza ma non piu' di 150 px: su
       un monitor da 1280 un quinto sono quasi trecento pixel, cioe' un
       gesto che nessuno fa. E un colpo secco vale comunque, anche se
       corto: e' il modo in cui si sfoglia con il pollice. */
    const soglia = Math.min(largo * .2, 150);
    const secco = Math.abs(dx) > 45 && (performance.now() - t0) < 300;

    if (deciso && (Math.abs(dx) > soglia || secco)){
      setVista(dx < 0 ? 'gruppi' : 'tutti');
    } else {
      disegnaViste();
    }
    deciso = false;
  };
  mia.addEventListener('pointerup', finito);
  mia.addEventListener('pointercancel', function(){
    attivo = false; deciso = false;
    viste.classList.remove('trascina');
    mia.classList.remove('trascina');
    lista.style.transform = ''; lista.style.opacity = '';
    disegnaViste();
  });
}

function apriElenco(){
  chiudiPannelli('elenco');
  if (state.phase === 'focus' || state.phase === 'review') unfocus();
  document.body.classList.add('elenco');
  q('#mia').setAttribute('aria-hidden', 'false');
  disegnaMia();
}

function chiudiElenco(){
  document.body.classList.remove('elenco');
  q('#mia').setAttribute('aria-hidden', 'true');
  scordaFiltri();          // i filtri non escono dalla schermata in cui si mettono
}

/* Dall'elenco allo scaffale: si chiude l'elenco, la camera va alla
   libreria giusta, e SOLO QUANDO E' ARRIVATA la scatola si apre. Se si
   aprisse subito, l'animazione di apertura e quella dello scorrimento
   si contenderebbero l'inquadratura. */
function apriSulloScaffale(id){
  chiudiElenco();
  goToGame(id);
  setTimeout(function(){
    const b = boxes.find(function(x){ return x.userData.id === id; });
    if (b && state.phase === 'browse') focusOn(b);
  }, 430);
}

function apriRigaMia(li){
  const g = LIB.get(li.getAttribute('data-id'));
  if (!g) return;
  const box = li.querySelector('.riga-info');
  const su = box.hidden;
  if (su) box.innerHTML = contenutoInfo(g);
  box.hidden = !su;
}

/* Una finestrella alla volta. Aperte in due si contendono lo stesso
   angolo e non si capisce piu' di quale riga siano -- e' la stessa
   ragione per cui i pannelli grandi hanno `chiudiPannelli`. */
function chiudiAzioni(tranne){
  qa('.riga-azioni').forEach(function(b){
    if (b === tranne) return;
    b.hidden = true;
    const btn = b.parentNode && b.parentNode.querySelector('.riga-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    const li = b.closest('li');
    if (li) li.classList.remove('menu-su');
  });
}

function apriAzioni(li){
  const g = LIB.get(li.getAttribute('data-id'));
  if (!g) return;
  const box = li.querySelector('.riga-azioni');
  const btn = li.querySelector('.riga-menu');
  const su = box.hidden;
  chiudiAzioni(su ? box : null);
  if (su) box.innerHTML = contenutoAzioni(g);
  box.hidden = !su;
  btn.setAttribute('aria-expanded', su ? 'true' : 'false');
  /* La riga aperta sale sopra tutte. Ogni riga ha il suo involucro
     posizionato, e chi viene dopo si disegna sopra a chi viene prima:
     senza questo, i pulsanti delle righe sotto passavano DAVANTI al
     menu aperto, che sembrava trasparente e non lo era. */
  li.classList.toggle('menu-su', su);
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
  // il dado in filigrana non si sceglie piu': non si vedeva
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

  const n = PROFILO.amici().length;
  quanti('#conta-amici', n + PROFILO.daAccettare().length);
  if (PROFILO.problema()){ proMsg('#pro-amici-msg', esc(PROFILO.problema()), true); return; }
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

/* I tre cassetti del profilo. Aperti tutti insieme la pagina diventava
   lunghissima e la cosa che cercavi era sempre in fondo; quale sia
   aperto se lo ricorda, se no ogni giro ricomincia da chiuso. */
function bindBlocchi(){
  qa('.pro-tit').forEach(function(b){
    const box = document.getElementById(b.getAttribute('aria-controls'));
    if (!box) return;
    const chiave = 'dado-cassetto-' + box.id;
    let aperto = false;
    try { aperto = localStorage.getItem(chiave) === '1'; } catch(e){}

    const metti = function(v){
      aperto = v;
      b.setAttribute('aria-expanded', v ? 'true' : 'false');
      box.hidden = !v;
      try { localStorage.setItem(chiave, v ? '1' : '0'); } catch(e){}
    };
    metti(aperto);
    b.addEventListener('click', function(){ metti(!aperto); });
  });
}

function bindProfilo(){
  bindBlocchi();
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

  q('#conta').addEventListener('click', function(){
    if (document.body.classList.contains('elenco')) chiudiElenco();
    else apriElenco();
  });

  q('#mia-list').addEventListener('click', function(e){
    // le tendine dei gruppi
    const tit = e.target.closest('.cartella-tit');
    if (tit){
      const su = tit.getAttribute('aria-expanded') === 'true';
      tit.setAttribute('aria-expanded', su ? 'false' : 'true');
      const ol = tit.nextElementSibling;
      if (ol) ol.hidden = su;
      const c = tit.closest('.cartella').getAttribute('data-c');
      try { localStorage.setItem('dado-cartella-' + c, su ? '0' : '1'); } catch(err){}
      return;
    }

    const li = e.target.closest('li[data-id]');
    // fuori da una riga: se c'era una finestrella aperta, si chiude
    if (!li){ chiudiAzioni(null); return; }
    const id = li.getAttribute('data-id');

    if (e.target.closest('[data-fa="menu"]')){ apriAzioni(li); return; }
    // dentro un'altra riga, ma non nella sua finestrella: quella aperta va via
    if (!e.target.closest('.riga-azioni')) chiudiAzioni(null);

    if (e.target.closest('[data-fa="scaffale"]')){ apriSulloScaffale(id); return; }
    const dentro = e.target.closest('[data-fa="dentro"]');
    if (dentro){ scegliLibreria(dentro, id); return; }
    if (e.target.closest('[data-fa="fuori"]')){ togliDaScaffale(id); return; }
    // le pastiglie dei gruppi dentro la riga aperta
    const chip = e.target.closest('.riga-gruppi button[data-g]');
    if (chip){
      const gid = chip.getAttribute('data-g');
      const dentro = !chip.classList.contains('on');
      chip.classList.toggle('on', dentro);
      LIB.segnaGruppo(id, gid, dentro).then(function(){
        disegnaGruppiFiltro();
      }).catch(function(err){
        chip.classList.toggle('on', !dentro);
        flash('non riuscito: ' + err.message);
      });
      return;
    }
    const scelto = e.target.closest('.scegli-lib button[data-l]');
    if (scelto){
      const v = scelto.getAttribute('data-l');
      if (v) mettiSuScaffale(id, v); else disegnaMia();
      return;
    }
    /* Eliminare e' l'unico gesto qui dentro che non si disfa: resta in
       due tempi sul pulsante stesso, come tutti gli altri del sito.
       `window.confirm` bloccherebbe il rendering, e una finestra di
       sistema in mezzo a questa pagina stonerebbe. */
    const del = e.target.closest('[data-fa="elimina"]');
    if (del){
      const dice = del.querySelector('span') || del;
      if (del.classList.contains('armed')){
        LIB.remove(id);
        chiudiAzioni(null);
        disegnaMia();
        updateConta();
        ridisponi();
        flash('gioco eliminato');
      } else {
        del.classList.add('armed');
        dice.textContent = 'sicuro? tocca ancora';
        setTimeout(function(){
          if (!del.isConnected) return;
          del.classList.remove('armed');
          dice.textContent = 'elimina il gioco';
        }, 3500);
      }
      return;
    }
    /* La stellina si aggiorna in posto e l'elenco non si rifa'.
       Rifarlo staccherebbe dal documento il pulsante appena premuto e
       il tocco successivo cadrebbe su un nodo che non c'e' piu': e' la
       lezione dell'elenco dei gruppi, e qui conta di piu' perche' la
       stella sta sulla riga e ci si tocca sopra piu' volte di fila. */
    const st = e.target.closest('[data-fa="stella"]');
    if (st){
      const g = LIB.get(id);
      if (!g) return;
      const si = !g.preferito;
      LIB.segnaPreferito(id, si);
      st.setAttribute('aria-pressed', si ? 'true' : 'false');
      const che = si ? 'togli dai preferiti' : 'metti fra i preferiti';
      st.title = che;
      st.setAttribute('aria-label', che);
      /* La pastiglia "solo i preferiti" compare solo se ce n'e'
         almeno uno, e sta fuori dall'elenco: quella si puo' rifare. */
      disegnaGruppiFiltro();
      return;
    }
    // dentro un blocco gia' aperto non si apre e chiude a ogni clic
    if (e.target.closest('.riga-info') || e.target.closest('.riga-azioni')) return;
    apriRigaMia(li);
  });

  // le tendine per gioco nelle partite
  q('#pro-partite').addEventListener('click', function(e){
    const b = e.target.closest('.gio-gioco');
    if (!b) return;
    const su = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', su ? 'false' : 'true');
    const ul = b.nextElementSibling;
    if (ul) ul.hidden = su;
  });

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

/* Chi vince di piu' in questo gruppo di partite. A parita' non si
   nomina nessuno: dire "vince Tizio" quando hanno vinto in due sarebbe
   semplicemente falso. */
function vinceDi(partite){
  const per = {};
  partite.forEach(function(p){
    (p.chi || []).forEach(function(x){
      if (x.vincitore) per[x.nome] = (per[x.nome] || 0) + 1;
    });
  });
  const ordine = Object.keys(per).sort(function(a, b){ return per[b] - per[a]; });
  if (!ordine.length) return '';
  const primo = per[ordine[0]];
  if (ordine.length > 1 && per[ordine[1]] === primo) return 'nessuno stacca gli altri';
  return 'vince ' + ordine[0] + (primo > 1 ? ' (' + primo + ')' : '');
}

/* Raggruppate per gioco. Un elenco di serate in ordine di data non dice
   niente; "a Root avete giocato tre volte e vince sempre Giulia" e'
   quello che uno vuole sapere aprendo questa sezione. */
function disegnaPartite(){
  const el = q('#pro-partite');
  if (!el) return;
  const tutte = PARTITE.tutte();

  const gruppi = [], per = {};
  tutte.forEach(function(p){
    const k = p.bgg ? 'b' + p.bgg : 't' + p.titolo;
    if (!per[k]){ per[k] = { titolo: p.titolo, partite: [] }; gruppi.push(per[k]); }
    per[k].partite.push(p);
  });

  el.innerHTML = gruppi.map(function(g, i){
    const n = g.partite.length;
    const chi = vinceDi(g.partite);
    return '<div class="gio-gruppo">' +
      '<button type="button" class="gio-gioco" aria-expanded="false" data-g="' + i + '">' +
        '<b>' + esc(g.titolo) + '</b>' +
        '<span>' + n + (n === 1 ? ' partita' : ' partite') +
        (chi ? ' &middot; <i class="vinto">' + esc(chi) + '</i>' : '') + '</span>' +
      '</button>' +
      '<ul class="giocate" hidden>' +
        g.partite.map(function(p){ return rigaGiocata(p, false); }).join('') +
      '</ul></div>';
  }).join('');

  quanti('#conta-partite', tutte.length);
  if (PARTITE.problema()){ proMsg('#par-msg', esc(PARTITE.problema()), true); return; }
  proMsg('#par-msg', tutte.length ? ''
    : 'Nessuna partita segnata. Si segna da qui, oppure dalla scatola del gioco ' +
      'appena finito.');
}

/* Il numero accanto al titolo del cassetto: quello che si vuole sapere
   senza aprirlo. */
function quanti(sel, n){
  const el = q(sel);
  if (el) el.textContent = n ? String(n) : '';
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

  quanti('#conta-giocatori', g.length);
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
  chiudiPannelli('partita');
  paCorrente = Object.assign({ id: null, bgg: '', titolo: '', giocata_il: oggiIso(),
                               ora: '', note: '', chi: [] }, dati || {});
  paCorrente.chi = (paCorrente.chi || []).map(function(x){ return Object.assign({}, x); });

  q('#pa-h').textContent = paCorrente.id ? 'Correggi la partita' : 'Segna una partita';
  q('#pa-titolo').value = paCorrente.titolo || '';
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
  chiudiSugg();
  q('#partitalayer').classList.remove('on');
  q('#partitalayer').setAttribute('aria-hidden', 'true');
  paCorrente = null;
}

/* --- dai punti alle posizioni -------------------------------------

   Chi ha segnato i punti non deve anche contare chi e' arrivato primo:
   lo fa il sito. Si ordina per punti e si assegna 1, 2, 3... con i
   PARI MERITO che dividono la posizione -- due a 40 punti sono primi
   tutti e due, e il successivo e' terzo, che e' come si contano le
   classifiche ovunque.

   La corona segue i punti solo se i punti ci sono. Ci sono giochi che
   non ne hanno -- si vince e basta -- e li' la corona la si mette a
   mano: per questo `posizione` puo' restare nulla, che vuol dire
   "classifica non registrata" ed e' il caso normale. */
function ricalcolaPosizioni(){
  if (!paCorrente) return;
  const conPunti = paCorrente.chi.filter(function(x){ return x.punti !== null && x.punti !== undefined && x.punti !== ''; });
  if (!conPunti.length){
    /* Tolti i punti, si tolgono anche le corone CHE VENIVANO DAI PUNTI.
       Senza questo, svuotando i campi restava addosso all'ultimo
       calcolato una corona che nessuno gli aveva messo -- e da li' in
       poi il modulo diceva una cosa che non era vera. Una corona messa
       a mano invece resta: non l'ha decisa la classifica. */
    paCorrente.chi.forEach(function(x){
      x.posizione = null;
      if (x.daPunti){ x.vincitore = false; x.daPunti = false; }
    });
    return;                                   // niente punti: comanda la corona
  }
  const ordinati = paCorrente.chi.slice().sort(function(a, b){
    const pa = a.punti === '' || a.punti == null ? -Infinity : Number(a.punti);
    const pb = b.punti === '' || b.punti == null ? -Infinity : Number(b.punti);
    return pb - pa;
  });
  let pos = 0, visti = 0, ultimo = null;
  ordinati.forEach(function(x){
    const v = (x.punti === '' || x.punti == null) ? null : Number(x.punti);
    visti++;
    if (v !== ultimo){ pos = visti; ultimo = v; }
    x.posizione = v === null ? null : pos;
    x.vincitore = (x.posizione === 1);
    x.daPunti = true;                      // questa corona l'ha decisa la classifica
  });
}

function disegnaTavolo(){
  if (!paCorrente) return;
  q('#pa-chi').innerHTML = paCorrente.chi.map(function(x, i){
    return '<li data-i="' + i + '"' + (x.vincitore ? ' class="vince"' : '') + '>' +
      '<button type="button" class="corona' + (x.vincitore ? ' on' : '') + '" data-fa="vince" ' +
        'aria-pressed="' + (x.vincitore ? 'true' : 'false') + '" ' +
        'aria-label="ha vinto ' + esc(x.nome) + '">' + ICO.corona + '</button>' +
      '<span class="nome">' + esc(x.nome) + '</span>' +
      (x.posizione ? '<span class="posto">' + x.posizione + '&deg;</span>' : '') +
      '<input class="punti" type="text" inputmode="numeric" maxlength="4" ' +
        'value="' + esc(x.punti == null ? '' : x.punti) + '" ' +
        'placeholder="punti" aria-label="punti di ' + esc(x.nome) + '">' +
      '<button type="button" class="via" data-fa="via" aria-label="togli ' + esc(x.nome) + '">' +
        ICO.chiudi + '</button>' +
    '</li>';
  }).join('');

  /* Nella tendina stanno INSIEME i giocatori salvati e gli amici che non
     lo sono ancora: al tavolo la differenza non conta -- conta chi
     c'era -- e tenerli in due elenchi vuol dire cercare due volte. */
  const alTavolo = {};
  paCorrente.chi.forEach(function(x){ alTavolo[x.nome] = true; });
  const liberi = PARTITE.giocatori().filter(function(g){ return !alTavolo[g.nome]; });
  const amici = (PARTITE.amiciDaAggiungere ? PARTITE.amiciDaAggiungere() : [])
    .map(function(a){ return (a.profilo && (a.profilo.nick || a.profilo.nome)) || ''; })
    .filter(function(n){ return n && !alTavolo[n]; });
  const pastiglia = function(valore, nome, amico){
    return '<button type="button" class="pa-tocca' + (amico ? ' amico' : '') + '" ' +
      'data-chi="' + esc(valore) + '">' + esc(nome) + '</button>';
  };
  const tutte = amici.map(function(n){ return pastiglia('amico:' + n, n, true); })
    .concat(liberi.map(function(g){ return pastiglia(g.id, g.nome, false); }));

  q('#pa-scelta').innerHTML = tutte.length
    ? tutte.join('')
    : '<p class="pa-vuoto">Nessuno da mettere al tavolo: aggiungi un giocatore, ' +
      'oppure fatti dare il codice amico da chi ha giocato con te.</p>';
}

/* Aggiorna posizioni e corone SENZA rifare l'elenco: chi sta scrivendo
   i punti non deve vedersi il campo staccato da sotto le dita. */
function aggiornaTavoloInPosto(){
  qa('#pa-chi li').forEach(function(li){
    const i = parseInt(li.getAttribute('data-i'), 10);
    const x = paCorrente.chi[i];
    if (!x) return;
    li.classList.toggle('vince', !!x.vincitore);
    const c = li.querySelector('.corona');
    if (c){ c.classList.toggle('on', !!x.vincitore); c.setAttribute('aria-pressed', x.vincitore ? 'true' : 'false'); }
    let p = li.querySelector('.posto');
    if (x.posizione){
      if (!p){ p = document.createElement('span'); p.className = 'posto';
               li.insertBefore(p, li.querySelector('.punti')); }
      p.textContent = x.posizione + '\u00b0';
    } else if (p) p.remove();
  });
}

/* --- il gioco si cerca -------------------------------------------

   Prima si scriveva a mano il titolo e, a fianco, l'id BGG: un numero
   che nessuno sa a memoria e che senza nessuno aggancia la serata al
   catalogo. Adesso si cerca, e scegliendo un risultato l'id arriva da
   solo -- e' quello a tenere insieme partite, recensioni e catalogo.

   Si cerca PRIMA nella collezione, che e' dove stanno i giochi a cui si
   gioca davvero, e solo dopo nel catalogo. Chi scrive un titolo che non
   esiste da nessuna parte ha comunque la sua serata, senza aggancio:
   `titolo` e `bgg` sono due colonne diverse apposta. */
let paGiro = 0;

function suggerisciGioco(testo){
  const el = q('#pa-sugg'), campo = q('#pa-titolo');
  const t = String(testo || '').trim();
  if (t.length < 2){ el.hidden = true; el.innerHTML = ''; campo.setAttribute('aria-expanded','false'); return; }

  const piatto = function(x){
    return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };
  const q1 = piatto(t);
  const mie = LIB.all().filter(function(g){ return piatto(g.title).indexOf(q1) >= 0; })
    .slice(0, 6)
    .map(function(g){ return { titolo: g.title, bgg: g.bgg || '', dove: 'la tua collezione' }; });

  mostraSugg(mie, false);

  /* Il catalogo passa dalla rete e ci mette un paio di secondi: ogni
     richiesta prende un numero e la risposta controlla di essere ancora
     l'ultima chiesta, se no si butta via da sola. Stessa regola del
     catalogo vero, e per lo stesso motivo. */
  const mio = ++paGiro;
  if (typeof CATALOGO === 'undefined' || !CATALOGO.cerca) return;
  Promise.resolve(CATALOGO.cerca(t)).then(function(r){
    if (mio !== paGiro || !paCorrente) return;
    const g = (r && (r.giochi || r)) || [];
    const gia = {};
    mie.forEach(function(x){ gia[piatto(x.titolo)] = true; });
    const dal = g.filter(function(x){ return !gia[piatto(x.title)]; }).slice(0, 6)
      .map(function(x){ return { titolo: x.title, bgg: x.bgg || '', dove: 'catalogo' }; });
    mostraSugg(mie.concat(dal), false);
  }).catch(function(){});
}

function mostraSugg(elenco){
  const el = q('#pa-sugg'), campo = q('#pa-titolo');
  if (!elenco.length){ el.hidden = true; el.innerHTML = ''; campo.setAttribute('aria-expanded','false'); return; }
  el.innerHTML = elenco.map(function(x, i){
    return '<li><button type="button" role="option" data-i="' + i + '" ' +
      'data-titolo="' + esc(x.titolo) + '" data-bgg="' + esc(x.bgg) + '">' +
      '<b>' + esc(x.titolo) + '</b><span>' + esc(x.dove) + '</span></button></li>';
  }).join('');
  el.hidden = false;
  campo.setAttribute('aria-expanded', 'true');
}

function chiudiSugg(){
  const el = q('#pa-sugg');
  if (!el) return;
  el.hidden = true; el.innerHTML = '';
  q('#pa-titolo').setAttribute('aria-expanded', 'false');
}

function metteAlTavolo(nome, idGiocatore){
  const t = String(nome || '').trim();
  if (!t) return;
  if (paCorrente.chi.some(function(x){ return x.nome === t; })){
    q('#pa-msg').textContent = t + ' e\' gia\' al tavolo';
    return;
  }
  paCorrente.chi.push({ nome: t, giocatore: idGiocatore || null,
                        punti: null, posizione: null, vincitore: false });
  q('#pa-msg').textContent = '';
  disegnaTavolo();
}

async function salvaPartita(){
  if (!paCorrente) return;
  const b = q('#pa-salva');
  paCorrente.titolo = q('#pa-titolo').value;
  // l'id BGG non si chiede piu': lo mette il suggeritore scegliendo un gioco
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
  // una scatola tua aperta non ha senso davanti allo scaffale di un altro
  if (state.phase === 'focus' || state.phase === 'review') unfocus();
  flash('apro la libreria di ' + chi);
  try {
    await LIB.visita(id, nick);
  } catch(e){
    flash('non riesco ad aprirla: ' + e.message);
    return;
  }
  document.body.classList.add('visita');
  chiudiArreda();
  q('#vis-chi').textContent = chi;
  q('#visita').setAttribute('aria-hidden', 'false');

  /* La sua stanza, non la tua: una collezione si guarda com'e' a casa
     di chi ce l'ha. `stanza` e' fra le colonne che gli amici leggono. */
  const suo = PROFILO.amici().find(function(x){ return x.id === id; });
  STANZA.daAltri(suo && suo.profilo ? suo.profilo.stanza : null);
  applicaStanza();

  // la ricerca era sulla tua libreria: qui non vuol dire piu' niente
  state.q = ''; q('#cerca').value = '';
  document.body.classList.remove('cerca');
  state.scrollTo = state.scroll = 0;

  /* Il catalogo e il profilo spariscono: di qui in poi il sito e' la
     sua libreria e basta, e si esce da un posto solo -- il cartello che
     dice di chi e'. Portarsi nel proprio catalogo dalla libreria di un
     altro vuol dire uscire da casa sua senza accorgersene. */
  setSezione('collezione');
  await CUORI.carica(id);          // i cuori della sua collezione, in una lettura
  await loadCovers();
  applyLibrary({});
  if (!LIB.all().length) flash('la libreria di ' + chi + ' e\' ancora vuota');
}

async function tornaACasa(){
  if (!LIB.ospitePresso()) return;
  /* Il pannello restava aperto su un gioco che un attimo dopo non era
     piu' sullo scaffale: si tornava a casa con addosso la recensione di
     qualcun altro. */
  if (state.phase === 'focus' || state.phase === 'review') unfocus();
  LIB.torna();
  CUORI.vuota();                   // i suoi cuori non c'entrano piu' niente
  document.body.classList.remove('visita');
  q('#visita').setAttribute('aria-hidden', 'true');
  STANZA.daProfilo();
  applicaStanza();
  disegnaLibrerie();
  disegnaGruppiFiltro();
  state.scrollTo = state.scroll = 0;
  await loadCovers();
  applyLibrary({});
}

function bindCuore(){
  const b = q('#p-cuore');
  if (!b) return;
  b.addEventListener('click', async function(){
    const dove = LIB.ospitePresso();
    const g = state.focused && state.focused.userData.game;
    if (!dove || !g) return;
    try {
      await CUORI.alterna(dove.id, g.id);
    } catch(e){
      flash(CUORI.problema() || ('non riuscito: ' + e.message));
    }
    disegnaCuore(g);           // ridisegna comunque: se ha fallito e' tornato com'era
  });
}

function bindPartite(){
  q('#pa-x').addEventListener('click', chiudiPartita);
  q('#pa-salva').addEventListener('click', salvaPartita);

  const tit = q('#pa-titolo');
  let paT = 0;
  tit.addEventListener('input', function(){
    if (paCorrente){ paCorrente.titolo = tit.value; paCorrente.bgg = ''; }
    clearTimeout(paT);
    paT = setTimeout(function(){ suggerisciGioco(tit.value); }, 180);
  });
  tit.addEventListener('blur', function(){ setTimeout(chiudiSugg, 160); });
  q('#pa-sugg').addEventListener('click', function(e){
    const b = e.target.closest('button[data-titolo]');
    if (!b || !paCorrente) return;
    paCorrente.titolo = b.getAttribute('data-titolo');
    paCorrente.bgg = b.getAttribute('data-bgg') || '';
    tit.value = paCorrente.titolo;
    chiudiSugg();
  });

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

  /* Un ascoltatore solo: le pastiglie si rifanno a ogni aggiunta, e
     attaccarne uno per pastiglia vorrebbe dire rimetterli ogni volta. */
  q('#pa-scelta').addEventListener('click', function(e){
    const b = e.target.closest('button[data-chi]');
    if (!b) return;
    const v = b.getAttribute('data-chi');
    if (v.slice(0, 6) === 'amico:'){
      // un amico che non e' ancora un giocatore salvato: entra col nome
      metteAlTavolo(v.slice(6), null);
    } else {
      const g = PARTITE.giocatori().find(function(x){ return x.id === v; });
      if (g) metteAlTavolo(g.nome, g.id);
    }
  });

  /* Un giocatore nuovo si crea nella SUA sezione. Qui c'e' la porta:
     si chiude la partita, si apre il profilo con il cassetto dei
     giocatori gia' aperto e il campo pronto. Crearlo di sfuggita dentro
     un modulo vuol dire ritrovarselo dopo senza sapere da dove esca. */
  q('#pa-vai-giocatori').addEventListener('click', function(){
    chiudiPartita();
    setSezione('profilo');
    const tit = q('[aria-controls="blocco-giocatori"]');
    const blocco = q('#blocco-giocatori');
    if (blocco && blocco.hidden && tit) tit.click();
    const campo = q('#gio-nuovo');
    if (campo) setTimeout(function(){ campo.focus(); }, 120);
  });
  qa('#partitalayer input, #partitalayer textarea').forEach(function(i){
    i.addEventListener('keydown', function(e){ e.stopPropagation(); });
  });

  // il tavolo: un ascoltatore solo, le righe si rifanno di continuo
  q('#pa-chi').addEventListener('click', function(e){
    const b = e.target.closest('button[data-fa]');
    if (!b || !paCorrente) return;
    const i = parseInt(b.closest('li').getAttribute('data-i'), 10);
    if (b.getAttribute('data-fa') === 'via'){
      paCorrente.chi.splice(i, 1);
      ricalcolaPosizioni();
      disegnaTavolo();
      return;
    }
    /* Con i punti la corona la decide la classifica, e toccarla a mano
       vorrebbe dire dire due cose diverse nello stesso modulo. Senza
       punti -- e ci sono giochi che non ne hanno -- si mette a mano. */
    const conPunti = paCorrente.chi.some(function(x){ return x.punti != null && x.punti !== ''; });
    if (conPunti){
      q('#pa-msg').textContent = 'con i punti il primo lo decide la classifica';
      return;
    }
    paCorrente.chi[i].vincitore = !paCorrente.chi[i].vincitore;
    paCorrente.chi[i].daPunti = false;     // questa l'ha messa una persona
    disegnaTavolo();
  });
  /* I punti ricalcolano le posizioni a ogni tasto, ma la riga NON si
     ridisegna: rifare l'elenco sotto il dito sposterebbe il campo in
     cui si sta scrivendo -- e' la stessa lezione dell'elenco dei
     gruppi. Si aggiornano solo i numeri e le corone, in posto. */
  q('#pa-chi').addEventListener('input', function(e){
    if (!e.target.classList.contains('punti') || !paCorrente) return;
    const i = parseInt(e.target.closest('li').getAttribute('data-i'), 10);
    const v = e.target.value.trim();
    paCorrente.chi[i].punti = v === '' ? null : (parseInt(v, 10) || 0);
    ricalcolaPosizioni();
    aggiornaTavoloInPosto();
  });

  /* Dalla scatola aperta: il gioco arriva gia' scritto, ed e' il punto
     -- appena finito di giocare non si ha voglia di ricercarlo. */
  q('#p-pref').addEventListener('click', function(e){
    e.stopPropagation();
    const g = state.focused && state.focused.userData.game;
    if (!g) return;
    const si = !g.preferito;
    LIB.segnaPreferito(g.id, si);
    // ottimista: la stella si riempie subito, la riga parte dietro
    e.currentTarget.setAttribute('aria-pressed', si ? 'true' : 'false');
    if (document.body.classList.contains('elenco')) disegnaMia();
  });

  q('#p-mia').addEventListener('click', function(e){
    e.stopPropagation();
    apriMia();
  });
  q('#mia-x').addEventListener('click', chiudiMia);
  q('#mia-salva').addEventListener('click', salvaMia);
  qa('#mialayer input, #mialayer textarea').forEach(function(i){
    i.addEventListener('keydown', function(e){ e.stopPropagation(); });
  });
  q('#mialayer').addEventListener('pointerup', function(e){ e.stopPropagation(); });

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
/* Torna vero se qualche scatola si sta ancora muovendo: l'alzata
   dell'hover e' smorzata, quindi continua per qualche frame dopo che
   il puntatore si e' fermato -- e finche' si muove l'ombra cambia. */
function updateBoxes(dt){
  let mosso = false;
  for (let i = 0; i < boxes.length; i++){
    const b = boxes[i], u = b.userData;
    if (u.busy){ u.cover.emissiveIntensity = .10; continue; }

    // il cubo di destinazione si annuncia alzando la scatola che ci sta
    // gia': e' quella che sta per scambiarsi di posto
    const mirato = !!(state.presa && state.presa.mirBox === b);
    const want = ((state.hover === b && state.phase === 'browse') || mirato) ? 1 : 0;
    u.hover += (want - u.hover) * Math.min(1, dt * 9);
    if (Math.abs(want - u.hover) > .002) mosso = true;

    b.position.set(u.homePos.x, u.homePos.y + u.hover * .10, u.homePos.z + u.hover * .5);
    b.rotation.y = u.homeRot.y + u.hover * .07;
    u.cover.emissiveIntensity = u.hover * .30;
  }
  return mosso;
}

let last = 0;
let faseIeri = '';
function frame(now){
  requestAnimationFrame(frame);
  // il passo va tenuto positivo e corto: un dt negativo manderebbe le
  // animazioni all'indietro, uno lungo (scheda tornata in primo piano)
  // le farebbe saltare alla fine di colpo
  const dt = last ? Math.max(0, Math.min(.05, (now - last) / 1000)) : .016;
  last = now;

  stepAnims(dt);

  /* Entrando in `browse` la camera e' finalmente al suo posto: e' li'
     che le quote proiettate diventano vere. Si guarda il CAMBIO di
     fase e non i tre punti in cui qualcuno la scrive, se no il
     quarto se lo dimentica. */
  if (state.phase !== faseIeri){
    faseIeri = state.phase;
    if (state.phase === 'browse') allineaComandi();
  }

  /* Fuori dalla libreria la scena e' coperta da una pagina piatta. Il
     ciclo non si ferma -- non si e' mai fermato -- ma non si disegna
     quello che nessuno vede, e soprattutto non si fa un raycast per
     fotogramma mentre l'utente sta scorrendo tutt'altro. */
  if (state.sezione !== 'collezione') return;

  if (state.phase === 'browse'){
    const before = Math.round(state.scroll);
    state.scroll += (state.scrollTo - state.scroll) * Math.min(1, dt * 7);
    camBase.set(camXFor(state.scroll), VISTA_Y, state.distShelf * state.zoom);
    if (Math.abs(state.scrollTo - state.scroll) > .0005 || before !== Math.round(state.scroll)){
      updateRail();
      allineaComandi();      // la camera si e' spostata: la proiezione e' un'altra
      rifaiOmbre();          // la luce di finestra segue camBase: l'ombra si sposta
    }
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

  /* Con una scatola in mano, avvicinandosi al bordo dello schermo la
     vista scorre verso il mobile accanto -- come quando si trascina un
     file sul bordo di una finestra. Sta qui e non in `muoviPresa`
     perche' deve continuare anche a dito fermo: sul bordo si aspetta,
     non si sfrega.

     Dopo, `muoviPresa` va richiamata: la scena si e' spostata sotto la
     scatola, quindi il cubo mirato non e' piu' quello di un attimo fa. */
  if (state.presa && state.phase === 'browse'){
    const bordo = .70;
    const fuori = Math.abs(state.px) - bordo;
    if (fuori > 0){
      const verso = state.px > 0 ? 1 : -1;
      state.scrollTo = clamp(
        state.scrollTo + verso * (fuori / (1 - bordo)) * dt * 2.2, 0, maxScroll());
    }
    muoviPresa();
  }

  if (state.phase === 'browse' && !state.dragging && !state.presa){
    const hit = pick();
    if (hit !== state.hover){
      state.hover = hit;
      document.body.style.cursor = hit ? 'pointer' : '';
    }
  } else if (state.phase !== 'browse' && document.body.style.cursor){
    document.body.style.cursor = '';
  }

  if (updateBoxes(dt) || anims.length || state.presa) rifaiOmbre();

  // la mappa d'ombra solo quando serve davvero: vedi `rifaiOmbre`
  renderer.shadowMap.needsUpdate = ombreDaRifare > 0;
  if (ombreDaRifare > 0) ombreDaRifare--;

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
  try { state.vista = localStorage.getItem('dado-vista') || 'gruppi'; } catch(e){}
  qa('#sortmenu button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sort') === state.sort);
  });
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
  // testo su canvas, e senza Instrument Serif escono con il ripiego.
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
  // le ombre le programma `rifaiOmbre`, non il renderer a ogni frame
  renderer.shadowMap.autoUpdate = false;
  q('#scene').appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2(0, 0);

  // Un passo per volta con una pausa in mezzo, cosi' la barra si muove.
  // setTimeout e non requestAnimationFrame: a pagina nascosta i frame
  // non arrivano affatto e il caricamento resterebbe li'.
  await wait(20); setProg(.28, 'monto la stanza');
  // luce e colori PRIMA dei materiali: se no si costruisce il mobile due
  // volte, una con le tinte di serie e una con le tue
  STANZA.daProfilo();
  makeMats();
  buildRoom();
  applicaLuce();
  // prima le misure dello schermo: decidono quante scatole per scaffale,
  // e quindi quanto viene alto l'armadio che sto per costruire
  layout();
  // la libreria vera, prima delle copertine: sono le schede a dire
  // quali immagini servono
  setProg(.40, 'apro la libreria');
  const lib = await LIB.sync();
  await LIB.caricaLibrerie();     // i mobili prima delle scatole: decidono dove vanno
  await LIB.caricaGruppi();
  buildFlatList();
  setProg(.56, 'stampo le copertine');
  await loadCovers();
  await wait(20); setProg(.72, 'monto le mensole');
  applyLibrary({});
  await wait(20); setProg(.92, 'accendo la lampada');

  bindInput();
  bindTools();
  bindVista();
  bindRail();
  bindCuore();
  bindPiedeGruppi();
  bindStanza();
  bindLibrerie();
  bindGruppi();
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
