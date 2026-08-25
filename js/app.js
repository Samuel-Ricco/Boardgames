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
  qpar: '',                    // il testo cercato FRA LE PARTITE: un'altra domanda
  gruppo: '',                  // l'etichetta con cui si sta filtrando, '' se nessuna
  soloPreferiti: false,        // mostra solo i giochi segnati
  vista: 'gruppi',             // come si guarda l'elenco: 'gruppi' o 'tutti'
  vpar: 'gioco',               // come si guardano le partite: 'gioco', 'data' o 'calendario'
  cal: null,                   // il mese aperto nel calendario, {a, m}
  calGiorno: '',               // il giorno aperto sotto la griglia
  wrAperto: false,             // il winrate gioco per gioco e' aperto?
  presa: null,                 // la scatola che si sta spostando a mano
  zoom: 1,                     // quanto la camera e' arretrata: 1 = normale
  libs: 1,                     // quante librerie in fila lungo la parete
  libsVere: -1,                // quante di quelle esistono davvero (le altre sono la scorta)
  scroll: 0, scrollTo: 0,      // 0 = la prima libreria; si scorre in orizzontale
  dragging: false,
  distShelf: 26, distFar: 42,
  side: true                   // il pannello si apre di lato (schermo largo)
};

const FOV = 38;
/* L'altezza con cui la targa viene COSTRUITA. Non e' quella che si
   vede: `allineaComandi` la scala su quanto spazio c'e' davvero. */
const TARGA_ALT = 1.05;
const UP = new THREE.Vector3(0, 1, 0);
const camBase = new THREE.Vector3(0, 8, 26);

let renderer, scene, camera, raycaster, pointer;
let cabGroup, propGroup, bayLights = [], focusLight, keyLight, alone;
/* Quanto valgono le luci dei vani, a questa luce di stanza. Sta qui e
   non dentro `frame()` perche' cambia solo quando si muove il cursore
   della luce, mentre il ciclo gira sessanta volte al secondo. */
let luceVani = .30;
/* Quanto sono accesi i faretti del mobile, a questa luce di stanza.
   Diversa da `luceVani` in una cosa sola, ed e' quella che conta: i
   vani seguono la stanza e si spengono con lei, i faretti no. La
   stanza si abbassa e il mobile resta acceso da dentro -- che e' quello
   che succede in casa la sera, e il motivo per cui questo cursore
   esiste. */
let luceFari = 0;
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
  fuori:    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 12.5v-9M8.5 7l3.5-3.5L15.5 7M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',
  /* Nel catalogo il gesto e' uno solo -- aggiungilo -- e su una riga
     che si scorre una parola in piu' e' rumore: un "+" lo dice meglio.
     Cosa faccia per esteso resta nel `title`. */
  piu:      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>',
  spunta:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  /* Le due frecce del binario, riusate dal calendario: e' lo stesso
     gesto -- un passo avanti e uno indietro dentro una fila -- e due
     disegni diversi per lo stesso gesto sono due gesti, per chi
     guarda. */
  indietro: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  avanti:   '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
  /* L'attesa fra il "+" e la spunta. Aggiungere un gioco dal catalogo
     fa due giri di rete -- la scheda, poi la copertina -- e finora nel
     frattempo il pulsante restava un "+" spento: chi premeva non
     sapeva se avesse premuto. Il cerchio e' quasi chiuso apposta: e'
     quel pezzo mancante a farlo leggere come qualcosa che gira. */
  rotella:  '<svg class="ico gira" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4"/></svg>',
  /* Una calcolatrice: la cassa, il display, i tasti. Sta accanto al
     campo dei punti di ogni giocatore, ed e' l'unico posto del sito
     dove serve fare un conto. */
  conta:    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="3" width="14" height="18" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8.4 7.4h7.2"/><circle cx="9" cy="12" r="1.05" fill="currentColor"/><circle cx="12" cy="12" r="1.05" fill="currentColor"/><circle cx="15" cy="12" r="1.05" fill="currentColor"/><circle cx="9" cy="16.4" r="1.05" fill="currentColor"/><circle cx="12" cy="16.4" r="1.05" fill="currentColor"/><circle cx="15" cy="16.4" r="1.05" fill="currentColor"/></svg>'
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
  const c = o.parquet ? ART.parquet(o) : ART.wood(o);
  /* Il RILIEVO viene dalla venatura e basta: l'ombra dipinta sopra e'
     luce che manca, non legno che sporge, e messa anche nel bump map
     scaverebbe un fossato lungo ogni bordo. Per questo l'occlusione va
     su una copia, e il bump resta la tavola nuda. */
  const bump = ART.toTex(c, { repeat: o.repeat, rot: o.rot });
  const map = o.ao ? ART.toTex(o.ao(ART.copia(c)), { repeat: o.repeat, rot: o.rot }) : bump.clone();
  if (o.ao) map.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({
    map: map,
    bumpMap: bump,
    bumpScale: o.bump === undefined ? .035 : o.bump,
    roughness: o.rough === undefined ? .74 : o.rough, metalness: .04
  });
  /* I faretti sono una luce DIPINTA, non una lampada: la stessa
     ragione per cui l'occlusione dei cubi sta qui e non in una passata
     di post-produzione. Va nell'`emissiveMap`, che condivide le UV con
     la tavola, e quanto e' accesa la decide `applicaLuce` toccando
     `emissiveIntensity` -- cosi' il cursore non ridipinge niente. */
  if (o.fari){
    m.emissive = new THREE.Color(0xffb877);
    m.emissiveMap = ART.toTex(o.fari(c.width, c.height), { repeat: o.repeat, rot: o.rot });
    m.emissiveIntensity = 0;
    m.__fari = true;
  }
  return m;
}

/* I dodici cubi in frazioni dello schienale. Lo schienale e' largo
   `W - 2T` e alto `H - 2T`, cioe' esattamente l'interno del mobile:
   tre colonne da `cell` separate da un montante da `t`, e quattro file
   uguali. Le frazioni escono dalle stesse costanti che costruiscono il
   mobile, quindi non possono andare fuori registro. */
function celleCubi(){
  const larg = LIB_W - KAL.t * 2, alt = LIB_H - KAL.t * 2, celle = [];
  for (let r = 0; r < RIGHE; r++){
    for (let c = 0; c < COLS; c++){
      celle.push([
        (c * KAL.passo) / larg,               (r * KAL.passo) / alt,
        (c * KAL.passo + KAL.cell) / larg,    (r * KAL.passo + KAL.cell) / alt
      ]);
    }
  }
  return celle;
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
    /* Lo schienale sta in ombra: parte gia' piu' scuro, e sopra ci
       viene dipinta l'occlusione dei dodici cubi. E' lo stesso disegno
       per tutti i mobili -- la griglia e' sempre 3 x 4 -- quindi la
       cache per tinta va bene com'e'. */
    fondo: legno(esa(c.clone().multiplyScalar(.88)),
                 { lines:160, knots:1, rough:.86, bump:.02,
                   ao: function(cv){ return ART.aoCubi(cv, celleCubi()); },
                   fari: function(w, h){ return ART.fariCubi(w, h, celleCubi()); } })
  };
  // un legno appena nato non aspetta il prossimo giro di `applicaLuce`
  sincronizzaFari(MATS_PER_TINTA[tinta].fondo);
  return MATS_PER_TINTA[tinta];
}

/* IL MOBILE DI SCORTA NON E' UN MOBILE.

   In fondo alla fila ce n'e' sempre uno in piu' di quelli che esistono
   (`disposizione` fa `librerie.length + 1`): e' il posto dove si
   trascina una scatola per cominciarne un altro. Disegnato con lo
   stesso legno degli altri era indistinguibile da un mobile vero --
   chi ne aveva uno solo ne vedeva due, e poi il pannello gli diceva
   "nessun mobile qui" e sembrava un guasto. Adesso e' un'ombra di
   mobile: stessa forma, cosi' i cubi restano un bersaglio riconoscibile
   per il trascinamento, ma trasparente e senza venatura.

   Un corredo solo, in cache come tutti gli altri: il fantasma e' uno. */
let MATS_FANTASMA = null;
function matsFantasma(){
  if (MATS_FANTASMA) return MATS_FANTASMA;
  const fai = function(op){
    const m = new THREE.MeshStandardMaterial({
      color: 0x8a8578, roughness: .95, metalness: 0,
      transparent: true, opacity: op, depthWrite: false
    });
    m.__comune = true;            // non lo butta `killGroup`: vedi la nota
    return m;
  };
  /* Abbastanza da vedersi, non tanto da sembrare un mobile. Con valori
     piu' bassi, chi non aveva NESSUNA libreria vedeva una stanza vuota
     e pensava che il sito fosse rotto -- e chi non ha librerie e' chi ha
     piu' bisogno di vedere dove va la prima. */
  MATS_FANTASMA = { vert: fai(.34), orizz: fai(.28), fondo: fai(.16) };
  return MATS_FANTASMA;
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

/* Il pavimento e' a LISTONI, non una tavola sola stirata per tutta la
   stanza. La ripetizione e' 13 sulla profondita' e `stanzaLarga` mette
   la stessa scala in larghezza, quindi un riquadro di texture copre
   circa diciotto unita' per lato -- un quadrato, che e' l'unico modo
   perche' i listoni non escano stirati.

   Il rilievo sale (`bump` da .012 a .05): sulle fughe c'e' davvero uno
   scalino, ed e' quello che le fa leggere da lontano. */
function legnoPavimento(){
  return legno(STANZA.corrente().pavimento,
               { parquet: true, cols: 13, repeat:[1,13], rough:.74, bump:.05 });
}

/* L'OMBRA DI CONTATTO SOTTO UN MOBILE.

   Un piano solo, appena sopra il pavimento, con l'impronta del mobile
   sfocata sopra. Non e' l'ombra della finestra -- quella c'e' gia' e
   dice da che parte viene la luce: questa dice che il mobile TOCCA
   terra, e senza si vede che galleggia.

   Materiale e geometria stanno in cache: sono uguali per tutti i
   mobili, e `killGroup` non li butta via perche' `comune` li segna. */
function geoPiano(){
  return comune('piano', function(){ return new THREE.PlaneGeometry(1, 1); });
}

function matContatto(){
  return comune('contatto', function(){
    return new THREE.MeshBasicMaterial({
      /* Le misure escono dal mobile: il piano e' largo LIB_W + 2.2 e
         profondo KAL.d + 2.6, quindi l'impronta cade a queste frazioni
         del riquadro e il buio comincia esattamente dove finisce il
         legno. Sfocatura in pixel, non in frazione: qui conta quanto e'
         larga la sfumatura per terra, non quanto e' grande la texture. */
      map: ART.toTex(ART.contatto(256, 128, .081, .203, .62, 9)),
      transparent: true, opacity: 1, depthWrite: false,
      color: 0x000000
    });
  });
}

/* Un fantasma non proietta ombra: sarebbe l'ombra di un mobile che non
   c'e', e si vedrebbe benissimo sul pavimento. */
function ombra(mesh, si){
  mesh.castShadow = !!si;
  mesh.receiveShadow = !!si;
  return mesh;
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
  /* 2048 su un monitor, 1024 su un telefono. La passata d'ombra e' la
     scena INTERA ridisegnata dentro quella mappa: a 1024 costa un quarto
     dei pixel, e su uno schermo da cinque pollici il mobile e' alto
     ottocento pixel scarsi -- la differenza non la vede nessuno. Gira
     comunque solo su prenotazione (vedi `rifaiOmbre`), quindi e' un
     risparmio sui fotogrammi in cui qualcosa si muove, che sono quelli
     in cui serve. */
  const piccolo = Math.min(window.innerWidth || 1200, window.innerHeight || 900) < 720;
  key.shadow.mapSize.set(piccolo ? 1024 : 2048, piccolo ? 1024 : 2048);
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

  /* LA LAMPADA DEL FOCUS STA FUORI DALLA SCENA FINCHE' NON SERVE.

     Restava dentro sempre, spenta a intensita' zero. Ma una luce
     spenta non e' una luce gratis: three.js compila lo shader di OGNI
     materiale con il numero di luci che trova, e ogni frammento paga
     il conto di quella lampada anche quando non illumina niente.
     Misurato: le cinque point light sono il 28% del tempo GPU, e
     questa e' una su cinque -- pagata per il 99% del tempo, che e'
     quanto si passa a guardare lo scaffale invece di una scheda. */
  focusLight = new THREE.PointLight(0xfff1dd, 0, 26, 1.6);

  /* Una luce per fila, appena davanti al bordo dei cubi: serve poco --
     la stanza e' gia' chiara -- ma e' quello che fa risaltare le
     copertine dentro al cubo, dove la luce di finestra non arriva mai
     del tutto. Sono quattro e SEGUONO LA CAMERA invece di essercene un
     gruppo per ogni libreria: le librerie possono diventare tante, e
     accenderle tutte vorrebbe dire pagare luci che nessuno vede. */
  /* IL BAGLIORE AL CENTRO, E PERCHE' NON SI TOGLIE SPOSTANDO QUESTE.

     Sono quattro, una per fila, tutte sull'asse del mobile: la colonna
     di mezzo la colpiscono in pieno e le due di fianco di sbieco.
     Misurato su una scena tutta bianca -- cosi' quello che si legge e'
     solo luce e non l'albedo delle copertine -- il centro prendeva
     **3,7 volte** i lati.

     Portarle avanti lo appiattisce davvero (misurato: 1,1 volte), ma
     non si puo' fare: una lampada a cinque unita' dal mobile non e'
     piu' una luce dentro un vano, e' un faro puntato sulla stanza --
     illuminava parete, pavimento e la faccia del mobile, e la penombra
     spariva. E' un baratto che non si vince: distribuzione piatta vuol
     dire portata, e portata vuol dire luce dappertutto.

     Quindi restano dove stanno, e a pesare di meno (la loro quota di
     faretti e' scesa da .62 a .34). La luce che manca alle colonne
     laterali arriva da un'altra parte, che per costruzione non ha
     nessun centro: le copertine si accendono da sole -- vedi
     `updateBoxes`. */
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
/* QUANTO SONO ACCESI I FARETTI, ADESSO.

   Si calcola dalla stanza a ogni chiamata invece di leggere una
   variabile riempita altrove, ed e' tutto il punto: cosi' non dipende
   dall'ordine in cui le cose vengono costruite. Prima dipendeva, e si
   vedeva -- i LED erano spenti all'apertura del sito e si rispegnevano
   cambiando legno o arredi, e bastava sfiorare il cursore per
   rimetterli a posto.

   Il motivo: `applicaStanza()` chiama `applicaLuce()` per PRIMA cosa e
   solo dopo ricostruisce i materiali. Un legno mai usato prima nasce
   in quel momento, con `emissiveIntensity` a zero, e nessuno tornava
   piu' a dirglielo. Lo stesso all'avvio, dove il mobile si costruisce
   prima che qualcuno accenda niente.

   Adesso chi nasce si mette in pari da solo (vedi `matsDi`), e chi c'e'
   gia' lo rimette in pari `applicaLuce`. Due strade, nessun ordine da
   rispettare. */
function fariOra(){
  const st = STANZA.corrente();
  /* I faretti NON seguono la stanza, ma non la ignorano del tutto: a
     mezzogiorno un faretto acceso si nota appena, e tenerlo alla stessa
     forza farebbe sembrare lo schienale luminescente invece che
     illuminato. Cala pianissimo -- fra buio e luce piena c'e' un terzo
     scarso -- contro il crollo di tutto il resto. */
  const cal = Math.min(1.3, Math.pow(Math.min(1.6, Math.max(.25, st.luce)), -.30));
  return { forza: st.faretti * cal, tinta: st.fariTinta };
}

/* Sopra l'unita' apposta: il nucleo della striscia esce dalla scala e
   il tone mapping lo brucia verso il bianco, mentre la coda -- che
   nella mappa vale un quinto -- resta dentro e resta satura. E' quel
   contrasto a far leggere "acceso" invece di "dipinto di chiaro". */
function sincronizzaFari(m){
  if (!m || !m.__fari) return;
  const f = fariOra();
  m.emissive.set(f.tinta);
  m.emissiveIntensity = 1.6 * f.forza;
}

/* LA TESTATA STA SU UNA PARETE CHE SI PUO' SPEGNERE.

   Sulla libreria il velo della testata e' piu' leggero -- 55% invece
   di 82% -- perche' li' dietro non scorre niente e coprire la stanza
   sarebbe un peccato. Ma quell'eccezione non aveva un fondo: con il
   muro scuro, o semplicemente con la luce bassa, dietro la carta c'e'
   il buio e il testo scuro su carta scurita non si legge piu'.

   Non e' un caso raro. Il fattore che scurisce lo sfondo e' `.10 +
   .90*luce`: a luce 0,14 vale 0,23, quindi anche il grigio caldo di
   partenza dietro la testata diventa scuro. Chi tiene la stanza in
   penombra ce l'ha sempre.

   Quindi si misura quanto e' buio davvero, e sotto una soglia la
   testata torna a essere una superficie piena. E' la regola gia'
   scritta -- "la testata e' una superficie, non un velo" -- con il
   fondo che le mancava. */
function lumDietroTestata(){
  const st = STANZA.corrente();
  const h = String(st.muro || '').replace('#', '');
  if (h.length < 6) return 1;
  const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
  const k = .10 + .90 * Math.min(1.3, st.luce);      // com'e' scurito lo sfondo
  return (.2126*r + .7152*g + .0722*b) * k / 255;    // 0..1
}

function testataLeggibile(){
  document.body.classList.toggle('muro-scuro', lumDietroTestata() < .38);
}

function applicaLuce(){
  const l = STANZA.corrente().luce;
  testataLeggibile();
  if (hemiLight) hemiLight.intensity = .52 * Math.pow(l, 1.05);
  if (ambLight)  ambLight.intensity  = .20 * Math.pow(l, .60);
  if (keyLight)  keyLight.intensity  = .95 * Math.pow(l, 1.35);
  if (fillLight) fillLight.intensity = .22 * Math.pow(l, 1.10);
  if (renderer)  renderer.toneMappingExposure = .90 * Math.pow(l, -.20);
  /* Anche le luci dei vani seguono la stanza. Non lo facevano, ed era
     il difetto per cui abbassando la luce **la colonna centrale restava
     accesa**: quelle quattro luci seguono la camera, quindi stanno
     proprio sul mobile che si sta guardando, e restavano al massimo
     mentre tutto il resto si spegneva. */
  luceVani = .30 * Math.pow(l, 1.15);

  /* I faretti NON seguono la stanza, ma non la ignorano del tutto: a
     mezzogiorno un faretto acceso si nota appena, e tenerlo alla stessa
     forza farebbe sembrare lo schienale luminescente invece che
     illuminato. Cala pianissimo -- fra buio e luce piena c'e' un terzo
     scarso -- contro il crollo di tutto il resto. */
  luceFari = fariOra().forza;
  const tintaFari = new THREE.Color(STANZA.corrente().fariTinta);
  Object.keys(MATS_PER_TINTA).forEach(function(t){
    sincronizzaFari(MATS_PER_TINTA[t].fondo);
  });

  /* Le lampade dei vani fanno due mestieri: la luce della stanza dentro
     al cubo, e la quota di faretti che serve a non lasciare al buio la
     copertina. Se i faretti si scelgono azzurri e quella lampada resta
     ambrata, lo schienale e la scatola davanti raccontano due storie
     diverse. Quindi il colore si mescola nella stessa proporzione in cui
     si mescolano le due intensita' -- calcolato qui e non nel ciclo,
     perche' `state.bayLight` e' solo un moltiplicatore comune. */
  const quota = (.34 * luceFari) / Math.max(.0001, luceVani + .34 * luceFari);
  const coloreVani = new THREE.Color(0xfff0da).lerp(tintaFari, Math.min(1, quota));
  bayLights.forEach(function(x){ x.color.copy(coloreVani); });
  // e le copertine gia' in scena: la tinta la scelgono i faretti
  boxes.forEach(function(b){ if (b.userData.cover) b.userData.cover.emissive.copy(tintaFari); });

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
  const quanteVere = LIB.librerie().length;
  for (let l = 0; l < state.libs; l++){
    const ox = libX(l);
    /* L'ultimo della fila, quando e' in piu' di quelli che esistono, e'
       la scorta: si disegna come un'ombra. */
    const fantasma = l >= quanteVere;
    const MATS = fantasma ? matsFantasma() : matsDi(stileLib(l).scaffali);

    // montanti: due esterni e uno per ogni divisione interna
    for (let c = 0; c <= COLS; c++){
      g.add(ombra(slab(T, H, D, MATS.vert, ox - W/2 + T/2 + c * KAL.passo, fondo + H/2, 0), !fantasma));
    }

    /* Ripiani: cielo, fondo e uno per ogni divisione. La profondita' e'
       due centesimi in meno di quella dei montanti, cioe' un millimetro
       vero: i ripiani passano DENTRO i montanti, e con le facce davanti
       esattamente sullo stesso piano le due superfici si contendevano i
       pixel. Sui legni chiari non si notava, sul wenge era una
       tramatura sporca lungo ogni incrocio. Un ripiano appena arretrato
       e' anche piu' giusto: e' cosi' su un mobile vero. */
    for (let r = 0; r <= RIGHE; r++){
      g.add(ombra(slab(W - T*2, T, D - .02, MATS.orizz, ox, cima - T/2 - r * KAL.passo, 0), !fantasma));
    }

    // schienale sottile e arretrato: senza, i cubi si aprono sulla
    // parete e le scatole perdono il loro sfondo
    g.add(ombra(slab(W - T*2, H - T*2, .10, MATS.fondo, ox, fondo + H/2, -D/2 + .07), !fantasma));

    /* Il buio dove il mobile tocca terra. Non ce l'ha il fantasma: un
       mobile che non c'e' non poggia da nessuna parte. */
    if (!fantasma){
      const ct = new THREE.Mesh(geoPiano(), matContatto());
      ct.rotation.x = -Math.PI/2;
      ct.position.set(ox, fondo + .012, .25);
      ct.scale.set(W + 2.2, D + 2.6, 1);
      ct.renderOrder = 1;              // dopo il pavimento, se no non lo vede
      g.add(ct);
    }

    /* Il nome, sopra il mobile. Sulla parete e non su un cartello
       appeso: un cartello vero avrebbe voluto cornice, spessore e
       ombra, e sopra una libreria c'e' gia' abbastanza roba.

       Sta piu' in alto degli oggetti che poggiano sul cielo del mobile,
       se no ci finisce dietro. `MeshBasic` apposta: e' informazione, e
       deve restare leggibile anche con la stanza in penombra. */
    const L = LIB.librerie()[l];
    /* Anche la scorta ha la sua targhetta, ma dice cos'e': senza, in
       fondo alla fila restava un mobile muto e senza nome, che e'
       esattamente com'era prima. */
    const scritta = fantasma ? TP('vista.nuovaLib') : (L && L.nome);
    if (scritta){
      /* La targa si costruisce a una misura di RIFERIMENTO e poi la
         scala `allineaComandi`, che e' l'unico posto che sa quanto
         spazio c'e' fra la testata e la cima del mobile. Prima era una
         misura fissa in scena: su un telefono la camera arretra per far
         stare i dodici cubi, e il nome finiva la meta' di quello che e'
         su un monitor. */
      const c = ART.targhetta(scritta, STANZA.corrente().nome);
      const alt = TARGA_ALT, larg = alt * (c.width / c.height);
      const targa = new THREE.Mesh(
        new THREE.PlaneGeometry(larg, alt),
        new THREE.MeshBasicMaterial({
          map: ART.toTex(c), transparent: true, depthWrite: false,
          opacity: fantasma ? .45 : 1
        })
      );
      targa.position.set(ox, state.yTarga || (KAL.topY + SOPRA - .62), -KAL.d/2 + .02);
      targa.userData.targa = true;      // `allineaComandi` la sposta e la scala
      targa.userData.aspetto = c.width / c.height;
      g.add(targa);

      /* Entra invece di comparire. SOLO l'opacita': la quota e la scala
         le tiene `allineaComandi`, e farle animare qui vorrebbe dire che
         due pezzi di codice scrivono la stessa proprieta' nello stesso
         fotogramma. Era l'unica cosa della scena a spuntare di colpo a
         ogni ricostruzione del mobile. */
      const opFine = fantasma ? .45 : 1;
      targa.material.opacity = 0;
      tween(.42, function(p){
        targa.material.opacity = opFine * easeOut(p);
      }, null, .08 + l * .05);          // una dopo l'altra, come le righe di un elenco
    }
  }

  stanzaLarga(state.libs);
  cabGroup = g;
  scene.add(g);

  /* LA TARGA APPENA FATTA VA SUBITO SCALATA.

     Il piano si costruisce a `TARGA_ALT`, che e' una misura di
     riferimento e non quella che si vede: la misura vera la decide
     `allineaComandi`, che sa quanto spazio c'e' fra la testata e la
     cima del mobile. Senza questa chiamata, il nome restava a scala 1
     -- cioe' alla vecchia misura fissa, molto piu' piccola -- fino al
     primo scorrimento o ridimensionamento.

     Si vedeva **rinominando**: si salvava il nome, il mobile si
     ricostruiva, e la scritta rimpiccioliva di colpo. Vale per ogni
     ricostruzione, non solo per la rinomina: cambiare legno o
     aggiungere una libreria facevano lo stesso. */
  allineaComandi();
  rifaiOmbre();
}

/* --- una scatola di gioco -------------------------------------- */
/* ===============================================================
   LE MISURE VERE DELLA SCATOLA
   ===============================================================

   Fino a qui una scatola era larga sempre uguale (`BOX.w`), alta
   quanto diceva il rapporto della copertina, e spessa sempre 0.84.
   Ma le scatole non sono tutte uguali, e su uno scaffale e' proprio
   quello che si vede: Carcassonne e' una scatola stretta e alta,
   Gloomhaven e' un mattone da diciannove centimetri.

   Le misure le sa BGG, sulle EDIZIONI. Non stanno nel database del
   sito e non ci devono stare: sono fatti sul GIOCO, uguali per tutti,
   non proprieta' della tua copia -- come non ci sta il numero di
   giocatori. Vivono in una cache locale per id BGG, e chi non ha il
   proxy acceso vede le scatole di prima. Il posto definitivo, quando
   ci sara', e' la edge function.

   Un'unita' della scena e' DIECI CENTIMETRI: il cubo interno e' 3.3 e
   una KALLAX ha il vano da 33 cm. Quindi centimetri diviso dieci. */
/* Il `-2` non e' un vezzo: e' una cache da buttare una volta.

   Finche' il ritaglio di `/misure` pretendeva `type="boardgame"`, le
   espansioni non arrivavano mai a `parseMisure` -- ma il danno non si
   fermava li'. Il taglio di un gioco correva fino al successivo di
   tipo `boardgame`, quindi un gioco seguito da un'espansione nella
   stessa richiesta si INGLOBAVA LE EDIZIONI DI QUELLA: Deep Regrets
   contava sette edizioni invece di cinque, e la "faccia piu' comune"
   usciva da una popolazione che non era la sua.

   Quei numeri sono in `localStorage` e nessuno li rilegge mai: senza
   cambiare chiave resterebbero sbagliati per sempre. La vecchia si
   cancella, se no resta li' a occupare spazio per niente. */
const MIS_KEY = 'dado-misure-2';
let MISURE = null;

function misureCache(){
  if (MISURE) return MISURE;
  try {
    MISURE = JSON.parse(localStorage.getItem(MIS_KEY) || '{}') || {};
    localStorage.removeItem('dado-misure');
  }
  catch(e){ MISURE = {}; }
  return MISURE;
}

function salvaMisure(){
  try { localStorage.setItem(MIS_KEY, JSON.stringify(misureCache())); } catch(e){}
}

/* Le misure di una scatola in unita' di scena, o `null` se non si
   sanno. `asp` e' il rapporto della copertina: BGG da' due lati della
   faccia ma non dice come sta in piedi, e a dirlo e' l'immagine. */
function misureDi(game, asp){
  const m = game && game.bgg && misureCache()[String(game.bgg)];
  if (!m || !(m.larghezza > 0) || !(m.lunghezza > 0)) return null;

  const gr = Math.max(m.larghezza, m.lunghezza);
  const pi = Math.min(m.larghezza, m.lunghezza);

  /* COME STA IN PIEDI LA SCATOLA.

     BGG da' due lati della faccia e non dice quale sia in verticale.
     A romperlo e' l'immagine: fra le due sistemazioni possibili si
     prende quella il cui rapporto somiglia di piu' a quello della
     copertina. Se la scatola e' quadrata la domanda non si pone.

     Quello che NON si fa e' lasciare che sia l'immagine a dettare la
     forma: le immagini di BGG non sono scansioni del fronte, sono
     spesso rendering ritagliati in 4:3 o in quadrato. Prendendole alla
     lettera, una scatola quadrata come Terraforming Mars diventava
     4:3 e Gloomhaven si sdraiava. La forma la dice la SCATOLA;
     l'immagine dice solo da che parte sta. */
  let w, h;
  if (gr / pi < 1.06){                 // quadrata: non c'e' niente da girare
    w = gr / 10; h = pi / 10;
  } else {
    const disteso = gr / pi;           // lato lungo orizzontale
    const eretto  = pi / gr;           // lato lungo verticale
    const orizz = Math.abs(Math.log(asp / disteso)) <= Math.abs(Math.log(asp / eretto));
    w = (orizz ? gr : pi) / 10;
    h = (orizz ? pi : gr) / 10;
  }

  // il limite non lo mette piu' questa funzione: lo mette
  // `entraNelCubo`, che vale anche per chi le misure non le ha
  return { w: w, h: h, t: m.spessore > 0 ? m.spessore / 10 : BOX.t };
}

/* NIENTE ESCE DAL CUBO, che le misure vere ci siano o no.

   Il limite stava dentro `misureDi`, cioe' **solo sulla strada di chi
   le misure ce le aveva**. Chi non le aveva finiva nel ripiego --
   larghezza fissa e altezza dal rapporto della copertina -- e quello
   non aveva nessun limite: con una copertina alta e stretta usciva una
   scatola alta piu' del vano che deve contenerla. E' successo con la
   mini espansione di Deep Regrets: rapporto 0,73, quindi 3,0 x 4,09 in
   un cubo che di luce interna ne ha 3,3.

   Adesso ci passano tutte e due le strade, e il limite e' uno solo.
   Gloomhaven, che di suo e' 40,6 cm, continua a rimpicciolirsi
   tenendo le proporzioni: resta la scatola piu' grande dello
   scaffale, che e' l'informazione vera.

   E un rapporto assurdo -- o un NaN arrivato da una divisione per
   zero -- non deve fare una scatola con le coordinate rotte: quelle
   spariscono dalla scena senza che niente lo dica. */
function entraNelCubo(w, h, t){
  if (!(w > 0)) w = BOX.w;
  if (!(h > 0)) h = BOX.h;
  if (!(t > 0)) t = BOX.t;
  const k = Math.min(1, (KAL.cell * .92) / Math.max(w, h));
  return {
    w: w * k,
    h: h * k,
    t: Math.max(.35, Math.min(KAL.d * .55, t * k))
  };
}

/* Le misure che mancano, chieste in una volta sola. Silenziosa: senza
   proxy non fa niente e non dice niente. */
async function caricaMisure(){
  const c = misureCache();
  const ids = [];
  LIB.all().forEach(function(g){
    if (g.bgg && !c[String(g.bgg)] && ids.indexOf(String(g.bgg)) < 0) ids.push(String(g.bgg));
  });
  if (!ids.length) return false;
  let nuove = {};
  try { nuove = await BGG.misure(ids.slice(0, 30)); } catch(e){ return false; }
  const chiavi = Object.keys(nuove || {});
  if (!chiavi.length) return false;
  chiavi.forEach(function(k){ c[k] = nuove[k]; });
  salvaMisure();
  return true;
}

/* ===============================================================
   LE COPERTINE CHE NON SONO COPERTINE
   ===============================================================

   Prima del token le schede venivano da Wikidata, e Wikidata le
   copertine non le ha: le sue immagini stanno su Wikimedia Commons,
   che accetta solo licenze libere, e la grafica di una scatola e'
   protetta. Quello che arrivava era una FOTO DEL GIOCO ALLESTITO SUL
   TAVOLO -- su 4.445 giochi ne aveva una il 13%, e quasi nessuna era
   la scatola.

   E quella foto resta li' per sempre, perche' la copertina si chiede
   una volta sola: quando il gioco entra sullo scaffale. Adesso il
   token c'e' e BGG la copertina ce l'ha per tutti, ma non c'era niente
   che tornasse a chiederla per i giochi gia' in collezione. Dei dati
   storti restano storti finche' qualcuno non li guarda -- e' la stessa
   ragione per cui esiste `riparaPosti()`.

   COME SI SA SE UNA COPERTINA E' GIA' QUELLA GIUSTA, senza scaricare
   niente: si guarda il NOME dell'oggetto nel bucket. Da quando
   `caricaCopertina` ci scrive il marchio, un indirizzo che finisce per
   `-p9156909.jpg` dice da solo di essere l'immagine 9156909 di BGG. E
   il numero con cui confrontarlo arriva dalla MINIATURA, che porta lo
   stesso `picNNNN` dell'immagine grande: una chiamata sola per tutta
   la collezione, e zero figure scaricate per quelle che gia' vanno
   bene.

   Due casi non si toccano, ed e' apposta:

   - `-mano`, il file scelto dall'utente: il modulo di aggiunta dice
     gia' che quello vince sempre, e sarebbe assurdo che il sito
     glielo sostituisse da solo al riavvio dopo;
   - le copertine dentro il repository (`img/root.jpg`), che sono
     quelle vere e stanno li' perche' il sito funzioni a rete
     staccata.

   E NON sta dentro il caricamento, che non e' un dettaglio: ogni
   copertina da riprendere e' un giro su BGG piu' un caricamento nel
   bucket, cioe' qualche secondo a testa. Dentro la barra sarebbero
   stati venti secondi di schermata ferma per una riparazione che non
   ha nessuna fretta. Gira dopo, a scena montata, e quando ha finito
   rifa' le scatole che ha toccato. */
const MARCA_MANO = 'mano';

/* Il numero della figura di BGG dentro un indirizzo: miniatura e
   immagine grande lo portano tutte e due, ed e' lo stesso. */
function picDi(url){
  const m = String(url || '').match(/pic(\d+)/);
  return m ? m[1] : '';
}

/* Il marchio scritto nel nome dell'oggetto nel bucket. Solo due forme
   sono un marchio -- `mano` e `p<numero>` -- se no lo slug di
   `brass-birmingham` si leggerebbe come un marchio "birmingham". */
function marchioDi(url){
  const m = String(url || '').match(/-(mano|p\d+)\.jpg(?:\?|$)/);
  return m ? m[1] : '';
}

/* Torna gli id dei giochi a cui ha cambiato la copertina. Silenziosa
   come `caricaMisure`: senza BGG non fa niente e non dice niente. */
async function riparaCopertine(){
  // in casa d'altri non si tocca niente, e senza database non c'e'
  // nessun posto in cui mettere quello che si scarica
  if (!LIB.eRemota() || LIB.ospitePresso()) return [];

  const candidati = LIB.all().filter(function(g){
    if (!g.bgg || !g.cover) return false;
    if (!/^https?:|^data:/i.test(g.cover)) return false;   // quelle del repo
    return marchioDi(g.cover) !== MARCA_MANO;
  });
  if (!candidati.length) return [];

  // quale figura DOVREBBE avere ognuno, quaranta per chiamata
  const attesa = {};
  for (let i = 0; i < candidati.length; i += 40){
    const ids = candidati.slice(i, i + 40).map(function(g){ return String(g.bgg); });
    let m;
    try { m = await BGG.miniature(ids); } catch(e){ return []; }
    Object.keys(m || {}).forEach(function(k){ attesa[k] = picDi(m[k]); });
  }

  const storti = candidati.filter(function(g){
    const pic = attesa[String(g.bgg)];
    return pic && marchioDi(g.cover) !== 'p' + pic;
  });
  if (!storti.length) return [];

  /* Una per volta e non tutte insieme: su un'API pubblica il modo piu'
     rapido di prendersi un limite e' chiedere tutto in parallelo. E
     una che non risponde non ferma le altre. */
  const fatti = [];
  for (let i = 0; i < storti.length; i++){
    const g = storti[i];
    let dataUrl = '';
    try { dataUrl = await BGG.copertina(g.bgg); } catch(e){ continue; }
    if (!dataUrl) continue;
    LIB.update(g.id, { cover: dataUrl }, 'p' + attesa[String(g.bgg)]);
    fatti.push(g.id);
  }
  return fatti;
}

/* Una scatola gia' in scena non si accorge che la sua copertina e'
   cambiata: `applyLibrary` riusa il mesh che trova e si limita a
   rimetterlo al suo posto. E ridipingerla non basterebbe -- la faccia
   prende le proporzioni della SCATOLA, e da che parte sta in piedi lo
   dice proprio l'immagine -- quindi va rifatta.

   Si buttano via quelle toccate e ci pensa `applyLibrary`. Quella
   aperta e quella in mano si saltano: sotto c'e' un tween in corso, e
   portargli via l'oggetto vuol dire lasciarlo a parlare da solo. */
function rifaiScatole(ids){
  if (!ids || !ids.length) return;
  for (let i = boxes.length - 1; i >= 0; i--){
    const b = boxes[i];
    if (ids.indexOf(b.userData.id) < 0) continue;
    if (state.focused === b || (state.presa && state.presa.box === b)) continue;
    killGroup(b, true);
    boxes.splice(i, 1);
  }
}

function makeGameBox(game){
  const grp = new THREE.Group();

  let coverTex, aspect;
  const copertinaVera = !!(game.img && game.img.naturalWidth && game.img.naturalHeight);
  if (copertinaVera){
    coverTex = ART.imgTex(game.img);
    aspect = game.img.naturalWidth / game.img.naturalHeight;
  } else {
    const c = game.art === 'root'   ? ART.coverRoot()
            : game.art === 'scythe' ? ART.coverScythe()
            : ART.coverTitolo(game);
    coverTex = ART.toTex(c);
    aspect = c.width / c.height;
  }
  /* Le misure vere se ci sono, se no quelle di sempre: larghezza
     fissa e altezza dal rapporto della copertina. In tutti e due i
     casi passano da `entraNelCubo`, che e' l'unico punto in cui si
     decide che una scatola sta nel suo vano. */
  const mis = misureDi(game, aspect);
  const dim = entraNelCubo(mis ? mis.w : BOX.w,
                           mis ? mis.h : BOX.w / aspect,
                           mis ? mis.t : BOX.t);
  const W = dim.w, H = dim.h, T = dim.t;

  /* LA COPERTINA SI RITAGLIA, NON SI STIRA.

     Con le misure vere la faccia ha il rapporto della scatola, e
     l'immagine quasi mai lo stesso. Spalmarla sopra la deforma -- una
     scatola quadrata con una foto 4:3 diventa una scatola schiacciata,
     e si vede subito. Si fa invece quello che fa una scatola vera: la
     grafica copre tutto il fronte e quello che avanza esce dai bordi.

     E' `object-fit: cover`, centrato: si stringe la finestra della
     texture sul lato che abbonda e si sposta di meta' della
     differenza. Niente da ridisegnare, sono due numeri sulla texture. */
  if (mis && aspect > 0){
    const rapp = W / H;
    if (aspect > rapp){                       // immagine piu' larga: si taglia ai lati
      const f = rapp / aspect;
      coverTex.repeat.set(f, 1);
      coverTex.offset.set((1 - f) / 2, 0);
    } else if (aspect < rapp){                // piu' alta: si taglia sopra e sotto
      const f = aspect / rapp;
      coverTex.repeat.set(1, f);
      coverTex.offset.set(0, (1 - f) / 2);
    }
  }
  // il coperchio resta la stessa frazione della scatola che era prima
  const LID = Math.min(T * (BOX.lid / BOX.t), T - .12);

  /* L'`emissive` della copertina serviva solo all'alzata dell'hover,
     bianco. Adesso porta anche la quota di faretti, quindi prende la
     tinta scelta: una copertina che sta sotto una striscia azzurra non
     puo' schiarirsi di bianco. */
  const cover = new THREE.MeshStandardMaterial({
    map: coverTex, emissiveMap: coverTex,
    emissive: new THREE.Color(fariOra().tinta), emissiveIntensity: 0,
    roughness: .58, metalness: .02
  });
  const sideV = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, true)),  roughness: .64 });
  const sideH = new THREE.MeshStandardMaterial({ map: ART.toTex(ART.spine(game, false)), roughness: .64 });

  /* TRE DEI SEI MATERIALI DI UNA SCATOLA SONO UGUALI PER TUTTE.

     Copertina e dorsi sono di quel gioco e restano suoi. Ma il fondello
     scuro del coperchio, il cartone del fondo e l'interno erano
     costruiti da capo dodici volte -- stesso colore, stessi argomenti,
     stesso disegno -- e ognuno si portava dietro un canvas dipinto e
     caricato sulla scheda. Trentasei materiali e ventiquattro texture
     dove ne bastano tre e due.

     L'interno in particolare: e' il dentro di una scatola CHIUSA in
     undici casi su dodici, perche' una sola si apre per volta. Dodici
     interni diversi erano dodici disegni per una cosa che si vede una
     volta sola -- e due qualunque di loro non si distinguono, essendo
     grana casuale sullo stesso cartone.

     E' la stessa cache degli arredi: chi ci sta dentro e' segnato
     `__comune` e `killGroup` non lo butta via. */
  const dark  = comune('scatolaFondello', function(){
    return new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: .95 });
  });
  const card  = comune('scatolaCartone', function(){
    return new THREE.MeshStandardMaterial({ map: ART.toTex(ART.cardboard('#a5855c'), {repeat:[2,2]}), roughness: .92 });
  });
  const inMat = comune('scatolaDentro', function(){
    return new THREE.MeshStandardMaterial({ map: ART.toTex(ART.inside()), roughness: .88 });
  });

  const lid = new THREE.Mesh(geoCoperchio(), [sideV, sideH, cover, dark]);
  lid.scale.set(W, H, LID);
  lid.position.z = T/2 - LID/2;
  lid.castShadow = true; lid.receiveShadow = true;

  const baseD = T - LID;
  const base = new THREE.Mesh(geoFronte(), [card, inMat]);
  base.scale.set(W*.97, H*.97, baseD);
  base.position.z = T/2 - LID - baseD/2;
  base.castShadow = true; base.receiveShadow = true;

  grp.add(lid, base);
  grp.userData = {
    game: game, id: game.id, lid: lid, cover: cover, h: H, w: W, t: T, lidT: LID,
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

  /* Il mobile di scorta non si arreda: e' il posto dove ci sara' una
     libreria, non una libreria. Arredato -- e per giunta attraverso i
     ripiani trasparenti -- sembrava una vetrina piena di roba che
     galleggia, cioe' peggio di prima. */
  const quanteVere = LIB.librerie().length;

  for (let l = 0; l < Math.min(state.libs, quanteVere); l++){
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
  ridisponiDopo = false;             // qualunque richiesta in sospeso e' servita qui
  const list = listaScaffale();
  const disp = disposizione(list);
  const posti = disp.posti;

  /* Si ricostruisce quando cambia il numero di mobili IN FILA oppure
     quello dei mobili VERI. I due non vanno di pari passo: `disposizione`
     restituisce `max(librerie + 1, ceil((giochi + 1) / 12))`, e con
     trentasei giochi il secondo termine e' 4 -- quindi passando da una
     libreria a due il totale resta 4 e non cambia niente.

     Prima non importava, perche' tutti i mobili erano disegnati uguali.
     Da quando quello di scorta e' un'ombra, importa moltissimo: senza
     questo controllo la libreria appena creata restava disegnata come
     la scorta di un attimo prima, cioe' trasparente e vuota. */
  const vere = LIB.librerie().length;
  if (disp.libs !== state.libs || vere !== state.libsVere || !cabGroup){
    state.libs = disp.libs;
    state.libsVere = vere;
    buildCabinet();
  }
  segnaFerma();

  /* Senza prototipo: gli id sono slug che vengono dal titolo, e su un
     oggetto normale `'constructor' in wanted` e' vero anche quando quel
     gioco non c'e' -- cioe' una scatola che non se ne va piu'. */
  const wanted = Object.create(null);
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
  /* Il margine attorno al mobile. Era cosi' stretto sui formati alti
     che la libreria arrivava a toccare i due bordi dello schermo: bella
     da vedere e senza un posto dove mettere niente -- il binario finiva
     addosso al piede del mobile e la targa alla testata. Un filo di
     aria in piu' e le due fasce libere, sopra e sotto, tornano ad
     avere una misura.

     Si paga in mobile piu' piccolo, ed e' il prezzo giusto: e' quello
     che si fa indietreggiando di un passo per guardare uno scaffale. */
  const marg = aspect < .8 ? .62 : 1.0;
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

  /* LA CAMERA VA MESSA DAVVERO AL SUO POSTO PRIMA DI MISURARE.

     `layout()` sposta `camBase`, ma la camera vera la muove `frame()`,
     al fotogramma dopo -- e `allineaComandi` proietta con la camera di
     adesso. Misurando con quella vecchia, le due guide dello schermo e
     la quota della targa uscivano da un quadro che non esisteva piu':
     il nome del mobile finiva novanta pixel sopra i pulsanti che gli
     stanno accanto. Si vedeva solo dopo un RIDIMENSIONAMENTO, mai su
     una pagina appena caricata, perche' li' la camera era gia' ferma
     al suo posto da un pezzo.

     L'ondeggio (`px`/`py`) qui non si applica: e' una parallasse di
     pochi pixel che `frame()` rimette da solo, e mediarla dentro una
     misura la sporcherebbe e basta. */
  camera.position.set(camBase.x, camBase.y, camBase.z);
  camera.lookAt(camBase.x, camBase.y, 0);
  camera.updateMatrixWorld();

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

  /* QUANTO GRANDE. La targa prende una fetta della fascia libera fra la
     testata e la cima del mobile, misurata in PIXEL DI SCHERMO e poi
     riportata in scena: e' l'unico modo perche' il nome pesi uguale su
     un monitor e su un telefono, dove la camera sta molto piu' indietro.
     Il tetto e il pavimento in pixel evitano i due estremi -- un nome
     gigante su uno schermo alto, e uno illeggibile su uno schiacciato. */
  /* La fetta e' piu' generosa sullo schermo stretto. Non e' un capriccio:
     su un telefono la fascia libera e' poca e tutto il resto -- testata,
     pulsanti, barra in basso -- e' proporzionalmente piu' grande, quindi
     un nome misurato con il metro del monitor ci si perde dentro. Su un
     monitor invece la fascia e' larga, e prendersene la meta' vuol dire
     un nome che pesa piu' del mobile di cui parla. */
  /* La fetta e' tarata per rendere la stessa misura che la scritta
     aveva quando era un piano di dimensione fissa: con il peso 600 quel
     corpo si legge, ed e' quello che il mobile chiede. Un filo piu'
     generosa sullo schermo stretto, dove tutto il resto -- testata,
     pulsanti, barra -- e' proporzionalmente piu' grande. */
  const stretto = window.innerWidth < 700;
  const banda = Math.max(24, cima - hb);
  const altaPx = clamp(banda * (stretto ? .27 : .25), 24, 62);
  const altaMondo = Math.abs(mondoY(alto - altaPx / 2, zT, cx) -
                             mondoY(alto + altaPx / 2, zT, cx));

  if (cabGroup){
    cabGroup.traverse(function(o){
      if (!o.userData || !o.userData.targa) return;
      o.position.y = state.yTarga;
      let s = altaMondo / TARGA_ALT;
      // e non piu' larga del mobile: se il nome e' lungo, si stringe tutta
      const largMax = LIB_W - .4;
      const larg = TARGA_ALT * (o.userData.aspetto || 3) * s;
      if (larg > largMax) s *= largMax / larg;
      o.scale.setScalar(s);
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
  const larg = box.userData.w || BOX.w;
  const fitW = larg * scale * 1.24;
  const fitH = box.userData.h * scale * 1.34 + larg * .18;
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
/* NESSUNA SCATOLA IN UN MOBILE CHE NON C'E'.

   Dodici cubi per libreria, e basta. Se i giochi in vetrina erano di
   piu' dei posti, l'eccedenza finiva nel mobile in piu' che si vede in
   fondo alla fila -- la SCORTA -- che sul database non esiste: al
   ricaricamento quelle scatole comparivano altrove, o sparivano. E'
   arrivato come segnalazione, con lo screenshot di due giochi dentro
   "nuova libreria".

   La risposta e' quella che darebbe chiunque: quando lo scaffale e'
   pieno se ne prende un altro. */
async function assicuraMobili(quanti){
  const servono = Math.ceil(quanti / PER_LIB);
  while (LIB.librerie().length < servono){
    const prima = LIB.librerie().length;
    await LIB.creaLibreria('');
    if (LIB.librerie().length <= prima) break;    // non ce l'ha fatta: non si insiste
  }
  return LIB.librerie().length;
}

/* Il primo cubo libero della fila, e se non ce n'e' nessuno **si crea un
   mobile**. Contare prima quanti ne servono non basta: fra il conto e
   l'assegnazione qualcosa puo' cambiare, e restare senza posto qui vuol
   dire che un gioco esce dalla vetrina senza che nessuno l'abbia
   chiesto. Meglio chiedere il posto quando serve. */
async function cuboLibero(presi){
  const cerca = function(){
    const l = LIB.librerie();
    for (let i = 0; i < l.length; i++){
      for (let p = 0; p < PER_LIB; p++){
        if (!presi[l[i].id + ':' + p]) return [l[i].id, p];
      }
    }
    return null;
  };
  let dove = cerca();
  if (dove) return dove;
  const L = await LIB.creaLibreria('');
  return [L.id, 0];
}

/* Rimette in ordine quello che si e' gia' rotto, e si rompe in tre modi:
   due giochi sullo stesso cubo, un `libreria` che punta a un mobile
   cancellato, e piu' giochi in vetrina che cubi. Gira all'avvio, perche'
   dei dati storti restano storti finche' qualcuno non li guarda -- e
   intanto la scena mostra scatole in un mobile che non c'e'. */
async function riparaPosti(){
  if (LIB.ospitePresso() || !LIB.eRemota()) return 0;
  const su = LIB.all().filter(function(g){ return g.libreria; });
  if (!su.length) return 0;

  await assicuraMobili(su.length);

  const vive = Object.create(null);
  LIB.librerie().forEach(function(L){ vive[L.id] = true; });

  const presi = Object.create(null), daSistemare = [];
  su.forEach(function(g){
    const p = g.posto, chiave = g.libreria + ':' + p;
    const buono = vive[g.libreria] && p !== null && p !== undefined &&
                  p >= 0 && p < PER_LIB && !presi[chiave];
    if (buono) presi[chiave] = true; else daSistemare.push(g);
  });
  if (!daSistemare.length) return 0;

  const tocchi = [];
  for (let i = 0; i < daSistemare.length; i++){
    const dove = await cuboLibero(presi);
    presi[dove[0] + ':' + dove[1]] = true;
    tocchi.push(LIB.metti(daSistemare[i].id, dove[0], dove[1]));
  }
  if (tocchi.length) await LIB.mandaPosti(tocchi.filter(Boolean));
  return tocchi.length;
}

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
    // pieno: se ne fa un altro invece di rifiutare
    LIB.creaLibreria('').then(function(L){
      LIB.metti(id, L.id, 0);
      LIB.mandaPosti([LIB.get(id)]);
      disegnaLibrerie(); disegnaMia(); ridisponi();
      flash(TP('msg.messoIn', { g: (LIB.get(id) || {}).title, lib: L.nome }));
    }).catch(function(e){
      flash(TP('msg.libNonCreata', {e: e.message}));
      disegnaMia();
    });
    return;
  }
  LIB.metti(id, libId, p);
  LIB.mandaPosti([LIB.get(id)]);
  disegnaMia();
  ridisponi();
  const L = LIB.librerie().find(function(x){ return x.id === libId; });
  flash(TP('msg.messoIn', { g: (LIB.get(id) || {}).title,
                          lib: (L && L.nome) || TP('msg.libGenerica') }));
}

function togliDaScaffale(id){
  const g = LIB.get(id);
  LIB.metti(id, null, null);
  LIB.mandaPosti([LIB.get(id)]);
  disegnaMia();
  ridisponi();                 // chiude la scatola aperta e rifa' gli scaffali
  flash(TP('msg.uscitoScaffale', { g: (g && g.title) || TP('msg.ilGioco') }));
}

/* Con un mobile solo non c'e' niente da scegliere e si fa e basta. Con
   piu' di uno il pulsante si apre nei nomi delle librerie, sul posto:
   una finestra di scelta per un gesto da un clic sarebbe sproporzionata. */
function scegliLibreria(btn, id){
  const l = LIB.librerie();
  if (!l.length){ flash(TP('msg.creaPrimaLib')); return; }
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

function posaScatola(p){
  const prima = state.sort;
  if (!LIB.librerie().length){ flash(TP('msg.nessunaLibreria')); return; }

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
      flash(TP('msg.ordineTuo'));
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
      flash(TP('msg.libNuova', {n: L.nome}));
    }).catch(function(e){
      flash(TP('msg.libNonCreata', {e: e.message}));
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

/* Aggiungere o togliere una luce cambia il numero di luci, quindi
   three.js ricompila lo shader di tutti i materiali. Lo si fa fare UNA
   volta sola, sul caricamento (vedi `scaldaShader`), dove un
   singhiozzo non lo vede nessuno: da li' in poi i due programmi sono
   in cache e lo scambio non costa niente. */
function accendiFocus(si){
  if (!focusLight || !scene) return;
  if (si){ if (!focusLight.parent) scene.add(focusLight); }
  else if (focusLight.parent) scene.remove(focusLight);
}

/* I due programmi -- con e senza la lampada del focus -- si compilano
   qui, mentre la barra di caricamento e' ancora a schermo. Senza,
   il conto si paga alla prima scatola che si apre: cioe' esattamente
   nel fotogramma in cui comincia a muoversi. */
function scaldaShader(){
  if (!renderer || !scene || !camera) return;
  try {
    accendiFocus(true);  renderer.compile(scene, camera);
    accendiFocus(false); renderer.compile(scene, camera);
  } catch(e){ if (window.console) console.warn('scaldaShader:', e); }
}

function focusOn(box){
  if (state.phase !== 'browse' || box.userData.busy) return;
  state.phase = 'focus';
  state.focused = box;
  state.hover = null;
  document.body.classList.remove('browse');

  accendiFocus(true);
  const u = box.userData;
  u.busy = true;
  const p0 = box.position.clone();
  const r0 = { x: box.rotation.x, y: box.rotation.y, z: box.rotation.z };
  const target = focusPose(box);
  const cam0 = camBase.clone();
  u.pose = target;

  /* Piu' svelta di prima: nove decimi per venire avanti piu' sei per il
     coperchio facevano un secondo e mezzo prima di leggere una riga, e
     una scatola che si apre e' un passaggio, non uno spettacolo. */
  tween(.52, function(p){
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
  const z0 = (box.userData.t || BOX.t)/2 - (box.userData.lidT || BOX.lid)/2;

  // si alza piu' che avvicinarsi: venendo avanti ingrandiva di colpo
  tween(.36, function(p){
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
  const z0 = (box.userData.t || BOX.t)/2 - (box.userData.lidT || BOX.lid)/2;

  /* LA CHIUSURA DURA QUANTO QUELLO CHE C'E' DAVVERO DA CHIUDERE.

     Era fissa: un secondo e mezzo di coperchio che si riabbassa e di
     scatola che torna al suo posto, anche quando si interrompeva
     l'apertura dopo due decimi -- cioe' quando il coperchio non si era
     ancora mosso e la scatola era appena partita. E per tutto quel
     tempo la fase e' `closing`, che non risponde a niente: si clicca
     per annullare e il sito sta zitto per un secondo e mezzo. Letto da
     fuori e' esattamente "e' rimasto congelato ad aspettare la fine
     dell'animazione", ed e' proprio quello che faceva.

     Adesso si misura dove sono le cose ADESSO -- quanto e' alzato il
     coperchio, quanto e' uscita la scatola -- e si torna indietro in
     proporzione. Annullare a due decimi costa tre decimi invece di uno
     e mezzo; chiudere una scheda aperta davvero costa quanto prima.

     I minimi non sono un vezzo: una durata zero fa `0/0` dentro
     `stepAnims`, cioe' `NaN`, cioe' una scatola che sparisce dalla
     scena con le coordinate rotte. */
  const u0 = box.userData;
  const apertura = clamp((lid.position.z - z0) / .95, 0, 1);
  const dTot = (u0.pose && u0.homePos) ? u0.homePos.distanceTo(u0.pose.pos) : 0;
  const fuori = dTot > .001
    ? clamp(box.position.distanceTo(u0.homePos) / dTot, 0, 1) : 1;

  tween(Math.max(.05, .42 * apertura), function(p){
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

    tween(Math.max(.20, .80 * fuori), function(p){
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
      accendiFocus(false);
      document.body.classList.add('browse');
      if (poi) poi();
      ridisponiSeAtteso();
      apriSeAtteso();
    });
  }, .12 * apertura);
}

/* --- una scatola chiesta mentre se ne stava chiudendo un'altra -----

   Durante `closing` il clic non veniva raccolto da nessuno: la fase
   non e' `browse`, quindi `focusOn` esce subito, e non e' `focus` ne'
   `review`, quindi nemmeno `unfocus` la prende. Il gesto spariva nel
   vuoto, e con una chiusura lunga era la meta' dei gesti.

   Adesso si segna, come si segna una richiesta di ridisporre, e si fa
   appena la chiusura ha finito. La scatola va ricontrollata: nel
   frattempo `applyLibrary` puo' averla portata via. */
let apriDopo = null;

function apriSeAtteso(){
  const b = apriDopo;
  apriDopo = null;
  if (b && state.phase === 'browse' && boxes.indexOf(b) >= 0) focusOn(b);
}

/* Rifa' la disposizione appena si puo': subito se lo scaffale e' fermo,
   dopo la chiusura se c'e' una scatola aperta.

   Durante `closing` la richiesta NON si butta via: si segna e si fa
   appena la chiusura ha finito. Buttarla via costava un difetto vero --
   chi eliminava un gioco nel mezzo secondo in cui una scatola si stava
   richiudendo se lo ritrovava sullo scaffale, perche' nessuno rifaceva
   piu' la scena. Ed e' proprio la sequenza di chi elimina: chiude la
   scatola, apre l'elenco, cancella. */
let ridisponiDopo = false;

function ridisponi(){
  if (state.phase === 'focus' || state.phase === 'review'){
    unfocus(function(){ applyLibrary({ animate: true }); });
    return;
  }
  if (state.phase === 'closing'){ ridisponiDopo = true; return; }
  applyLibrary({ animate: true });
}

// La chiama chi finisce una chiusura: se nel frattempo qualcuno ha
// chiesto di ridisporre, adesso si puo'.
function ridisponiSeAtteso(){
  if (ridisponiDopo) applyLibrary({ animate: true });
}

/* --- togli il gioco che si sta guardando -------------------------

   I DATI SE NE VANNO SUBITO, l'animazione viene dopo. Prima era il
   contrario: `LIB.remove` stava dentro il seguito del tween, cioe' la
   cancellazione avveniva solo se l'animazione arrivava in fondo. Ma la
   coda delle animazioni si svuota (`anims.length = 0`) ogni volta che
   una scatola si apre o si chiude, e una cancellazione che dipende da
   un'animazione e' una cancellazione che puo' non avvenire -- senza che
   niente lo dica, con il gioco che resta dov'era.

   Cancellare e' un fatto, non un'animazione. La scatola esce da `boxes`
   nello stesso momento, cosi' un `applyLibrary` che arrivi nel mezzo
   non se la ritrova fra i piedi e non prova a rimandarla a casa. */
function removeFocused(){
  const box = state.focused;
  if (!box || state.phase === 'closing') return;   // niente doppie partenze
  const game = box.userData.game;

  state.phase = 'closing';
  state.focused = null;
  hidePanel();
  anims.length = 0;

  const i = boxes.indexOf(box);
  if (i >= 0) boxes.splice(i, 1);
  LIB.remove(game.id);

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
    state.bayLight = 1;
    applyLibrary({ animate: true });
    state.phase = 'browse';
    accendiFocus(false);     // anche da qui si torna allo scaffale
    document.body.classList.add('browse');
    flash(TP('msg.toltoDaLib', {g: game.title}));
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
  b.setAttribute('title', TP(v.mio ? 'pan.cuoreTolto' : 'pan.cuoreTitolo'));
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
    (game.artist ? '<br><span class="credit">' + T('pan.credito', {a: esc(game.artist)}) +
                   (game.publisher ? ', &copy; ' + esc(game.publisher) : '') + '</span>' : '');

  const specs = [
    [game.players, 'spec.giocatori'], [game.time, 'spec.minuti'],
    [game.age, 'spec.eta'], [game.weight, 'spec.peso']
  ].filter(function(s){ return s[0]; });
  q('#p-specs').innerHTML = specs.map(function(s){
    return '<li><b>' + esc(s[0]) + '</b><span>' + T(s[1]) + '</span></li>';
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
    ? TP('pan.occhielloDi', {chi: dove.nick}) : TP('pan.occhiello');

  const pref = q('#p-pref');
  if (pref){
    const si = !!(game && game.preferito);
    pref.setAttribute('aria-pressed', si ? 'true' : 'false');
    pref.title = TP(si ? 'pan.prefTolto' : 'pan.prefTitolo');
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
function armaBottone(btn, kNormale, kConferma, azione){
  let armed = false, t = 0;
  /* Prende le CHIAVI e non le parole: le scioglie ogni volta che
     riscrive il pulsante, cosi' cambiando lingua cambia anche lui. Con
     le parole catturate alla partenza resterebbe per sempre in quella
     di quel momento -- ed e' proprio quello che succedeva a "esci
     dall'account", l'unica scritta del profilo che non seguiva. */
  function disarma(){
    clearTimeout(t); armed = false;
    btn.classList.remove('armed');
    btn.innerHTML = T(kNormale);
  }
  btn.innerHTML = T(kNormale);
  btn.__disarma = disarma;
  btn.__rilingua = function(){ if (!armed) btn.innerHTML = T(kNormale); };
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    if (!armed){
      armed = true;
      btn.classList.add('armed');
      btn.innerHTML = T(kConferma);
      t = setTimeout(disarma, 4000);
      return;
    }
    disarma();
    azione();
  });
}

/* --- quando cambia la lingua ------------------------------------
   `I18N.applica()` rifa' il markup, ma tutto quello che il JS ha gia'
   disegnato -- l'elenco, il catalogo, il profilo, la scheda aperta --
   lo ha scritto lui e tocca a lui rifarlo. Si ridisegna solo quello che
   e' davvero a schermo: rifare il catalogo mentre si guarda la libreria
   vorrebbe dire rifare centinaia di righe che nessuno sta leggendo. */
function rilingua(){
  qa('[data-fa], button').forEach(function(b){
    if (b.__rilingua) b.__rilingua();
  });
  setMode(AUTH.stato());
  nomeMobileCorrente();
  updateConta();
  buildFlatList();

  if (document.body.classList.contains('arreda')){
    disegnaLibrerie();
    sincronizzaPannello();
  }
  if (document.body.classList.contains('elenco')) disegnaMia();
  if (state.sezione === 'catalogo'){
    disegnaCatalogo(0);
    catNota();
  }
  if (state.sezione === 'profilo'){
    disegnaProfilo(); disegnaAmici(); disegnaGiocatori();
  }
  if (state.sezione === 'partite') disegnaPartite();
  /* `paCorrente` e non `body.partita`: quella classe non esiste da
     nessuna parte del sito, quindi questa riga non e' mai scattata e
     cambiando lingua col modulo aperto il tavolo restava nella lingua
     di prima -- segnaposti, corone e la calcolatrice comprese.
     `paCorrente` invece vale esattamente finche' il modulo e' aperto. */
  if (paCorrente) disegnaTavolo();
  /* La scheda aperta va rifatta con il suo gioco: le specifiche, il
     credito e l'occhiello sono tutti scritti dal JS. */
  const g = state.focused && state.focused.userData && state.focused.userData.game;
  if (g && (state.phase === 'focus' || state.phase === 'review')) showPanel(g);
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
  const dove = Math.round(state.scroll);
  const su = q('#rail-prima'), giu = q('#rail-dopo');
  if (su)  su.disabled  = dove <= 0;
  if (giu) giu.disabled = dove >= max;

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

  /* Le due frecce: un mobile per volta, che e' il gesto piu' semplice
     che ci sia. Ai due capi si spengono invece di non fare niente --
     un pulsante che risponde a vuoto e' peggio di uno spento. */
  const prima = q('#rail-prima'), dopo = q('#rail-dopo');
  if (prima) prima.addEventListener('click', function(){ scrollBy(-1); });
  if (dopo)  dopo.addEventListener('click', function(){ scrollBy(1); });

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
    sporcaMirino();                 // il puntatore si e' spostato: si rimira
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
    norm(e); pointer.set(state.tx, state.ty); sporcaMirino();

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
    } else if (state.phase === 'closing'){
      // si segna e si apre appena la chiusura ha finito: vedi apriSeAtteso
      apriDopo = pick() || null;
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
  /* Il pulsante "scheda" non c'e' piu' nel piede del pannello. La
     funzione resta -- e' quella che corregge autore, editore, anno e
     copertina -- ma da qui dentro non ci arriva piu' nessuno. */
  const bEdit = q('#edit');
  if (bEdit) bEdit.addEventListener('click', function(e){
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

  armaBottone(q('#del'), 'pan.eliminaLungo', 'pan.eliminaOk', removeFocused);
  q('#panel').addEventListener('pointerup', function(e){ e.stopPropagation(); });

  let rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt); rt = setTimeout(layout, 120);
  });
}

/* Il mirino e' "sporco" quando la risposta del raycast puo' essere
   cambiata: chi muove il puntatore, la scena o le scatole lo segna. */
let mirinoSporco = true;
function sporcaMirino(){ mirinoSporco = true; }

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
    chip.title = TP('testa.cambiaMod');
  } else if (st.dentro){
    // il chip dice CHI sei, non fa niente: uscire ha un tasto suo, se no
    // e' un pulsante che cambia significato a seconda dello stato
    chip.textContent = TP(st.admin ? 'testa.admin' : 'testa.utente');
    chip.title = (st.nome || '') + (st.admin ? ' -- admin' : '');
    chip.disabled = true;
  } else {
    chip.textContent = TP('testa.entra');
    chip.title = TP('testa.entraGoogle');
    chip.disabled = false;
  }
}

function bindTools(){
  q('#mode').addEventListener('click', async function(){
    if (!AUTH.attivo()){
      // senza database resta l'interruttore locale di prima
      setMode({ dentro: false, admin: state.mode !== 'admin' });
      flash(TP(state.mode === 'admin' ? 'msg.modAdmin' : 'msg.modUtente'));
      return;
    }
    if (AUTH.stato().dentro) return;     // qui dentro il chip e' solo un'etichetta
    try { await AUTH.entra(); }          // porta su Google e poi torna qui
    catch(e){ flash(TP('msg.accessoNo', {e: e.message})); }
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

  /* Le due caselle della collezione: quella dell'imbuto e quella sopra
     l'elenco. Stesso comportamento perche' sono la stessa ricerca. */
  legaCerca(q('#cerca'), q('#cerca-x'));
  legaCerca(q('#mia-q'), q('#mia-q-x'));
  legaCercaPartite();

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
    flash(TP('msg.dataScaricato'));
  });

  armaBottone(q('#rst'), 'add.ripristina', 'add.ripristinaOk', function(){
    LIB.reset();
    closeAdd();
    loadCovers().then(function(){
      applyLibrary({ animate: true });
      flash(TP('msg.libRipristinata'));
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
  if (document.body.classList.contains('elenco')) disegnaMia();
}

/* --- ricerca ------------------------------------------------------
   Filtrare cambia quali scatole stanno sullo scaffale, non quali sono
   in evidenza: chi cerca "root" vede una libreria con dentro Root, e
   basta. Si torna alla prima libreria, se no restando fermi sulla terza
   ci si ritrova davanti a un mobile vuoto. */
/* LE CASELLE DI RICERCA SONO DUE, LO STATO E' UNO.

   Una sta nell'imbuto e una sopra l'elenco, e chiedono la stessa cosa:
   quali giochi vedo. Quella che ha scritto non si tocca -- riscriverle
   dentro il valore gia' ripulito le sposta il cursore e le mangia lo
   spazio che si sta ancora battendo. */
function sincronizzaCerca(chi){
  [q('#cerca'), q('#mia-q')].forEach(function(el){
    if (el && el !== chi && el.value !== state.q) el.value = state.q;
  });
}

function setQuery(v, chi){
  const nuovo = String(v || '').trim();
  if (nuovo === state.q) return;
  state.q = nuovo;
  sincronizzaCerca(chi);
  document.body.classList.toggle('cerca', !!nuovo);
  state.scrollTo = state.scroll = 0;
  ridisponi();
  // l'imbuto si apre anche sopra l'elenco: li' la ricerca deve rifare
  // l'elenco, non solo lo scaffale che sta sotto
  if (document.body.classList.contains('elenco')){ disegnaMia(); updateConta(); }
  if (nuovo && !lista().length) flash(TP('msg.nessunGiocoPer', {q: nuovo}));
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
  const sua = !!LIB.ospitePresso();
  /* Il numero filtrato si vede solo DENTRO l'elenco, che e' dove il
     filtro si e' messo e dove si vede che c'e'. Fuori, il contatore
     torna a dire quanti giochi hai -- restava filtrato anche in
     libreria e nel catalogo, dove nessuno sapeva piu' perche'. */
  const aperto = document.body.classList.contains('elenco');

  /* IL PULSANTE DICE DOVE PORTA, NON DOVE SEI.

     E' un interruttore fra due modi di guardare la stessa collezione:
     chiuso porta all'elenco e dice quanti giochi hai, aperto riporta
     agli scaffali -- e allora deve dirlo, se no e' un pulsante acceso
     che ripete il nome della schermata in cui ci si trova gia' e non
     promette nessuna via d'uscita. */
  el.innerHTML = aperto
    ? T(sua ? 'mia.tornaSua' : 'mia.torna')
    : T(sua ? 'mia.contaSua' : 'mia.conta', {n: tot});
  el.title = TP(aperto ? 'mia.tornaTitolo' : 'mia.apriTitolo');

  /* E il conto non si sposta da nessuna parte: `#mia-msg`, due righe
     sotto l'occhiello, lo dice gia' -- e lo dice meglio, perche' dice
     anche quanti sono in vetrina ("25 giochi, 12 sugli scaffali", e
     "14 giochi per <<ga>>" quando si cerca). Metterlo anche
     nell'occhiello voleva dire lo stesso numero due volte nella stessa
     schermata. */
}

/* --- aggiunta -------------------------------------------------- */
/* La ricerca aspetta un attimo prima di rifare lo scaffale: a ogni
   tasto premuto vorrebbe dire ricostruire dodici scatole per lettera.
   `Escape` non deve uscire da qui: se no chiude anche quello che c'e'
   sotto. */
function legaCerca(inp, bottoneX){
  if (!inp) return;
  let ct = 0;
  inp.addEventListener('input', function(){
    clearTimeout(ct);
    ct = setTimeout(function(){ setQuery(inp.value, inp); }, 180);
  });
  inp.addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Escape'){ inp.value = ''; setQuery('', inp); inp.blur(); }
    if (e.key === 'Enter'){ clearTimeout(ct); setQuery(inp.value, inp); }
  });
  if (bottoneX) bottoneX.addEventListener('click', function(){
    inp.value = ''; setQuery('', inp); inp.focus();
  });
}

/* La ricerca fra le partite e' un'ALTRA ricerca: filtra le partite, non
   i giochi, e non ha niente a che vedere con quello che c'e' sullo
   scaffale. Stato suo, classe sua sul body, e nessuna sincronia con le
   altre due -- che sarebbe la cosa piu' confusa possibile. */
function legaCercaPartite(){
  const inp = q('#par-q'), x = q('#par-q-x');
  if (!inp) return;
  let ct = 0;
  inp.addEventListener('input', function(){
    clearTimeout(ct);
    ct = setTimeout(function(){ setQueryPartite(inp.value); }, 180);
  });
  inp.addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Escape'){ inp.value = ''; setQueryPartite(''); inp.blur(); }
    if (e.key === 'Enter'){ clearTimeout(ct); setQueryPartite(inp.value); }
  });
  if (x) x.addEventListener('click', function(){
    inp.value = ''; setQueryPartite(''); inp.focus();
  });
}

function setQueryPartite(v){
  const nuovo = String(v || '').trim();
  if (nuovo === state.qpar) return;
  state.qpar = nuovo;
  document.body.classList.toggle('cerca-par', !!nuovo);
  disegnaPartite();
}

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
    dove.textContent = TP('add.doveRemoto');
    esporta.style.display = ripristina.style.display = 'none';
  } else {
    dove.textContent = TP('add.dove');
    esporta.style.display = ripristina.style.display = '';
  }

  CATALOGO.fonte(true).then(function(f){
    if (f === 'bgg'){
      msgAdd(T('add.fonteBgg'), '');
    } else if (f === 'dump'){
      msgAdd(T('add.fonteDump'), '');
    } else {
      msgAdd(T('add.fonteWiki'), 'warn');
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
  q('#add-h').textContent = TP('add.hCorreggi');
  q('#m-go').textContent = TP('add.salvaModifiche');

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
  msgAdd(T('add.noteModifica'), '');
  q('#m-title').focus();
}

function chiudiModifica(){
  inModifica = null;
  q('#addlayer').classList.remove('correzione');
  q('#add-h').innerHTML = T('add.h');
  q('#m-go').textContent = TP('add.metti');
}

async function doSearch(){
  const q0 = q('#add-q').value.trim();
  if (!q0) return;
  msgAdd(T('add.cerco'), '');
  q('#add-res').innerHTML = '';
  try {
    const hits = await CATALOGO.cerca(q0);
    if (!hits.length){
      msgAdd(T('add.nessunRisultato'), '');
      q('#add-man').open = true;
      return;
    }
    msgAdd(T('add.scegline'), '');
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
    msgAdd(T('add.ricercaNo', {e: esc(e.message)}), 'warn');
    q('#add-man').open = true;
  }
}

/* Un risultato non finisce sullo scaffale da solo: riempie il modulo.
   Con Wikidata i dati vanno guardati prima di fidarsi, e anche con BGG
   un controllo prima di salvare non ha mai fatto male. */
async function scegli(voce, btn){
  btn.disabled = true;
  const prima = btn.innerHTML;
  btn.innerHTML = T('add.prendoScheda');
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
    msgAdd(T('add.schedaDa', {f: esc(g.fonte === 'bgg' ? 'BoardGameGeek' : 'Wikidata')}) +
           T(g.immagine ? 'add.immagineDopo' : 'add.senzaImmagine'), '');
    q('#m-title').focus();
  } catch(e){
    msgAdd(T('add.schedaNo', {e: esc(e.message)}), 'warn');
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
    flash(TP('msg.receSalvata'));
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

  let marchio = '';
  if (file){
    b.disabled = true; b.textContent = TP('add.preparoCop');
    try {
      g.cover = await CATALOGO.daFile(file);
      /* Marchiata `mano`: e' la scelta di chi guarda, e da qui in poi
         `riparaCopertine` la salta -- se no gliela rimpiazzerebbe con
         quella di BGG al primo riavvio, che e' esattamente il
         contrario di "il file scelto a mano vince sempre". */
      marchio = MARCA_MANO;
    }
    catch(e){ flash(TP('msg.immagineNo', {e: e.message})); }
    b.disabled = false; b.textContent = prima;
  } else if (inAttesa && inAttesa.immagine && inAttesa.title === title){
    b.disabled = true; b.textContent = TP('add.scaricoCop');
    try {
      g.cover = await CATALOGO.copertina(inAttesa);
      marchio = picDi(inAttesa.immagine) ? 'p' + picDi(inAttesa.immagine) : '';
    }
    catch(e){ flash(TP('msg.copertinaNo')); }
    b.disabled = false; b.textContent = prima;
  }

  let game;
  const inModificaEra = !!inModifica;
  if (inModifica){
    game = LIB.update(inModifica, g, marchio);
    chiudiModifica();
  } else {
    game = LIB.add(g, marchio);
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
        .then(function(){ flash(TP('msg.recePubblicata')); })
        .catch(function(e){ flash(TP('msg.nonPubblicata', {e: e.message})); });
    } else if (vuole && !game.bgg){
      flash(TP('msg.senzaBgg'));
    } else if (!vuole && eraPubblicata){
      RECE.togli(game.bgg)
        .then(function(){ flash(TP('msg.receTolta')); })
        .catch(function(e){ flash(TP('msg.nonTolta', {e: e.message})); });
    }
  }

  inAttesa = null;
  qa('#add-man input[type="text"], #add-man input[type="file"]').forEach(function(i){ i.value = ''; });
  q('#m-review').value = '';
  closeAdd();
  await loadCovers(true);
  await caricaMisure();          // quanto e' grande la scatola: si chiede subito
  applyLibrary({ animate: true });
  if (game){
    if (game.libreria) goToGame(game.id);
    flash(TP(inModificaEra ? 'msg.salvato' : 'msg.inCollezione', {g: game.title}));
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
  /* Solo se si cambia davvero: `setSezione` gira anche all'avvio e
     rientrando sulla stessa voce. */
  if (s !== state.sezione) azzeraSchermata();
  state.sezione = s;
  document.body.classList.toggle('sez-collezione', s === 'collezione');
  document.body.classList.toggle('sez-catalogo', s === 'catalogo');
  document.body.classList.toggle('sez-profilo',  s === 'profilo');
  document.body.classList.toggle('sez-partite',  s === 'partite');
  qa('#sezioni button, #tabbar button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sez') === s);
  });
  q('#catalogo').setAttribute('aria-hidden', s === 'catalogo' ? 'false' : 'true');
  q('#profilo').setAttribute('aria-hidden',  s === 'profilo'  ? 'false' : 'true');
  q('#partite').setAttribute('aria-hidden',  s === 'partite'  ? 'false' : 'true');
  if (s === 'catalogo' && !catVoci.length && !catCarico) catSfoglia(true);
  if (s === 'profilo') apriProfilo();
  if (s === 'partite') apriPartite();
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
  catMsg(T(catVoci.length ? 'cat.prendoAltri' : 'cat.apro'));
  try {
    const voci = await CATALOGO.sfoglia(catOffset, CAT_PAG);
    if (mio !== catGiro) return;          // intanto e' stato chiesto altro
    const da = catVoci.length;
    catOffset += CAT_PAG;
    catFine = voci.length < CAT_PAG;
    catVoci = catVoci.concat(voci);
    disegnaCatalogo(da);
    catNota();
    riempiMiniature(da, mio);          // partono dietro: l'elenco c'e' gia'
  } catch(e){
    if (mio !== catGiro) return;          // errore di una richiesta superata: non riguarda piu'
    catMsg(T('cat.nonRisponde', {e: esc(e.message)}), 'warn');
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
  catMsg(T('cat.cerco'));
  q('#cat-list').innerHTML = '';
  try {
    const voci = await CATALOGO.cerca(t);
    if (mio !== catGiro) return;
    catVoci = voci;
    catFine = true;                       // la ricerca da' quello che da', non si pagina
    disegnaCatalogo(0);
    if (!catVoci.length){
      catMsg(T('cat.nessunGioco', {q: esc(t)}));
    } else { catNota(); riempiMiniature(0, mio); }
  } catch(e){
    if (mio !== catGiro) return;
    catMsg(T('cat.ricercaNo', {e: esc(e.message)}), 'warn');
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
  const fonte = f === 'bgg'  ? T('cat.fonteBgg')
              : f === 'dump' ? T('cat.fonteDump', {n: DUMP.quanti().toLocaleString(I18N.corrente())})
              : T('cat.fonteWiki');
  catMsg(fonte + ' ' + (guaio
    ? T('cat.receGuaio', {e: esc(guaio)})
    : T(n === 1 ? 'cat.receUno' : 'cat.receTanti', {n: n})));
}

function disegnaCatalogo(da){
  const ul = q('#cat-list');
  const html = catVoci.slice(da).map(function(v, k){ return rigaCatalogo(v, da + k); }).join('');
  if (da) ul.insertAdjacentHTML('beforeend', html);
  else ul.innerHTML = html;
  q('.cat-fondo').classList.toggle('finito', catFine);
}

/* LE MINIATURE ARRIVANO DOPO, E SI INFILANO IN POSTO.

   Le righe si disegnano subito con l'iniziale -- un elenco che aspetta
   ventiquattro immagini prima di comparire e' un elenco fermo -- e le
   miniature si chiedono in una richiesta sola mentre l'utente gia'
   scorre. Quando arrivano si sostituisce solo il riquadro della
   copertina, senza rifare le righe: rifare l'elenco sotto il dito e' la
   lezione gia' scritta per l'elenco dei gruppi.

   `mio` e' il giro: se nel frattempo e' stata chiesta un'altra pagina o
   un'altra ricerca, queste immagini non riguardano piu' quello che c'e'
   a schermo e si buttano via da sole. */
async function riempiMiniature(da, mio){
  const fette = catVoci.slice(da);
  if (!fette.length) return;
  let mappa = {};
  try { mappa = await CATALOGO.miniature(fette); } catch(e){ return; }
  if (mio !== catGiro) return;
  Object.keys(mappa).forEach(function(bgg){
    for (let i = da; i < catVoci.length; i++){
      const v = catVoci[i];
      if (!v || String(v.bgg) !== String(bgg) || v.immagine) continue;
      v.immagine = mappa[bgg];
      const li = q('#cat-list li[data-i="' + i + '"]');
      const box = li && li.querySelector('.cat-cop');
      if (box) box.innerHTML = '<img src="' + esc(v.immagine) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    }
  });
}

function rigaCatalogo(v, i){
  const rec = RECE.di(v.bgg);
  const img = CATALOGO.miniaturaElenco(v.immagine, 200);
  const gia = !!v.bgg && LIB.all().some(function(g){ return String(g.bgg) === String(v.bgg); });
  /* Dal dump non arrivano autore ed editore -- non ci sono nel file dei
     ranking -- ma arrivano il posto in classifica e la media dei voti,
     che su un elenco ordinato per classifica sono proprio l'informazione
     che uno cerca. Meglio quelli di una riga vuota. */
  const daBgg = [];
  if (v.rank)     daBgg.push('BGG <b>#' + esc(v.rank) + '</b>');
  if (v.bggScore) daBgg.push('<b>' + esc(v.bggScore) + '</b>/10');
  const chi = [v.designer, v.publisher].filter(Boolean).map(esc).join(' &middot; ') ||
              daBgg.join(' &middot; ');
  const spec = [[v.players, T('spec.giocatori')], [v.time, T('spec.minuti')], [v.year, T('spec.anno')]]
    .filter(function(x){ return x[0]; })
    .map(function(x){ return '<li><b>' + esc(x[0]) + '</b>' + x[1] + '</li>'; }).join('');

  return '<li data-i="' + i + '">' +
    /* Senza miniatura si mette l'INIZIALE, come fa gia' l'elenco della
       collezione. Il punto interrogativo era lo stesso segno per tutti:
       cento righe di catalogo diventavano cento quadrati identici che
       dicevano soltanto "non lo so". L'iniziale almeno appartiene a quel
       gioco, e scorrendo l'occhio ci si aggancia. */
    '<div class="cat-cop">' + (img
      ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<span class="senza">' + esc(String(v.title || '?').trim().slice(0, 1).toUpperCase()) + '</span>') +
    '</div>' +
    '<div class="cat-dati">' +
      '<h3>' + esc(v.title) + (rec ? '<i class="bollo">recensito</i>' : '') + '</h3>' +
      (chi  ? '<p class="cat-chi">' + chi + '</p>' : '') +
      (spec ? '<ul class="cat-spec">' + spec + '</ul>' : '') +
    '</div>' +
    /* Niente pulsante "scheda": la riga si apre cliccandola, e un
       pulsante che fa quello che fa gia' la riga intera ruba larghezza
       al titolo -- che e' la cosa che si sta leggendo. Resta il "+",
       che invece fa un'altra cosa. */
    '<div class="cat-azioni">' +
      '<button type="button" class="metti dentro-only"' + (gia ? ' disabled' : '') +
        ' title="' + esc(TP(gia ? 'cat.ceLHai' : 'cat.inLibreria')) + '"' +
        ' aria-label="' + esc(TP(gia ? 'cat.ceLHai' : 'cat.inLibreria')) + '">' +
        (gia ? ICO.spunta : ICO.piu) + '</button>' +
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
  if (!aperta) return;

  const link = v.bgg
    ? '<p><a class="bgg" href="https://boardgamegeek.com/boardgame/' + esc(v.bgg) +
      '/" target="_blank" rel="noopener">' + T('pan.bgg') + '</a></p>'
    : '';
  /* Il winrate viene prima della recensione: quello che il sito pensa
     di un gioco lo si legge sempre, come vai tu solo se ci hai giocato
     -- e quando c'e' e' la riga che riguarda chi sta leggendo. */
  const wr = (state.dentro && !PARTITE.problema())
    ? bloccoWr(PARTITE.diGioco(v.bgg, v.title)) : '';
  li.querySelector('.cat-rec').innerHTML = wr + (rec
    ? (rec.score ? '<p class="voto">' + esc(rec.score) + '<i>/10</i></p>' : '') +
      (rec.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('') + link
    : '<p class="vuoto">' + T('cat.nonRecensito') + '</p>' + link);
}

/* Dal catalogo allo scaffale. Passa dalla stessa strada del modulo di
   aggiunta -- scheda completa, poi copertina -- perche' e' la stessa
   cosa: cambia solo da dove si e' partiti. */
async function mettiInLibreria(v, btn){
  btn.disabled = true;
  const prima = btn.innerHTML;
  try {
    /* La rotella al posto del "+": i due giri di rete qui sotto
       possono durare qualche secondo, e un pulsante spento che non
       cambia si legge come "non ha funzionato" -- infatti c'e' chi ha
       premuto due volte. Finita l'attesa diventa la spunta di sempre. */
    btn.innerHTML = ICO.rotella;
    btn.title = TP('cat.prendoScheda');
    const g = await CATALOGO.dettagli(v);
    const gioco = {
      title: g.title, bgg: parseInt(g.bgg, 10) || 0,
      designer: g.designer || '', publisher: g.publisher || '',
      year: g.year || '', players: g.players || '', time: g.time || '',
      score: g.score || '', art: 'generic'
    };
    let marchio = '';
    if (g.immagine){
      btn.title = TP('cat.scaricoCop');
      // se non arriva non e' un errore: si usa la copertina disegnata
      try {
        gioco.cover = await CATALOGO.copertina(g);
        // da che figura di BGG viene: serve a `riparaCopertine` per
        // non tornare a chiedere quello che ha gia'
        marchio = picDi(g.immagine) ? 'p' + picDi(g.immagine) : '';
      } catch(err){}
    }
    const messo = LIB.add(gioco, marchio);
    if (cabGroup){                     // un ospite non ha nessuna scena da aggiornare
      await loadCovers(true);
      await caricaMisure();            // e quanto e' grande la sua scatola
      applyLibrary({ animate: true });
    }
    btn.innerHTML = ICO.spunta;
    btn.title = TP('cat.ceLHai');
    flash(TP('msg.inCollezione', {g: messo.title}));
  } catch(e){
    btn.disabled = false;
    btn.innerHTML = prima;
    btn.title = TP('cat.inLibreria');
    flash(TP('msg.nonAggiunto', {e: e.message}));
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
    (altrui ? '' : '<button type="button" class="nuovo" data-g="+">' + T('gru.piuGruppo') + '</button>');
}

/* Creare un gruppo dalla scheda: la pastiglia diventa un campo, sul
   posto. Mandare l'utente in un'altra sezione per scrivere una parola
   e poi farlo tornare qui e' un giro che non serve a niente. */
function nuovoGruppoInLinea(btn, game){
  const li = document.createElement('input');
  li.type = 'text'; li.maxLength = 30; li.placeholder = TP('gru.nomePh');
  li.className = 'gruppo-nuovo';
  li.setAttribute('aria-label', TP('gru.nomeAria'));
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
      flash(TP('msg.gruppoCreato', {n: nome}));
    }).catch(function(err){
      flash(TP('msg.nonCreato', {e: err.message}));
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
      (state.soloPreferiti ? ' class="on"' : '') + '>' + T('mia.soloPreferiti') + '</button>'
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
  q('#gru-quale').textContent = TP('gru.chiStaIn', {n: G.nome});
  q('#gru-elenco').innerHTML = LIB.list('nome', '').map(function(g){
    const dentro = LIB.gruppiDi(g.id).indexOf(G.id) >= 0;
    return '<li data-id="' + esc(g.id) + '">' +
      '<span class="nome">' + esc(g.title) + '</span>' +
      '<button type="button"' + (dentro ? ' class="on"' : '') + '>' +
      T(dentro ? 'gru.dentro' : 'gru.aggiungi') + '</button></li>';
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
      '<span>' + (n === 1 ? T('gru.unGioco') : T('gru.nGiochi', {n: n})) + '</span></span>' +
      '<span class="fa">' +
        '<button type="button" class="quali" data-fa="quali">' +
        T(gruppoAperto === G.id ? 'gru.chiudiQuali' : 'gru.quali') + '</button>' +
        '<button type="button" class="no" data-fa="via">' + T('gru.togli') + '</button>' +
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
  /* I gruppi non stanno piu' nella scheda del gioco: si gestiscono
     dall'elenco, che e' dove si decide cosa sta con cosa. Il pannello
     e' rimasto senza `#p-gruppi`, e questi due ascoltatori senza casa:
     si agganciano solo se l'elemento c'e' ancora. */
  const pg = q('#p-gruppi');
  if (pg) pg.addEventListener('click', function(e){
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
      flash(TP('msg.nonRiuscito', {e: err.message}));
    });
  });
  if (pg) pg.addEventListener('pointerup', function(e){ e.stopPropagation(); });

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
      flash(TP('msg.gruppoTolto'));
    }).catch(function(err){ b.disabled = false; flash(TP('msg.nonTolto', {e: err.message})); });
  });

  // dentro/fuori dal gruppo aperto, un gioco per riga
  q('#gru-elenco').addEventListener('click', function(e){
    const b = e.target.closest('button');
    if (!b || !gruppoAperto) return;
    const id = b.closest('li').getAttribute('data-id');
    const dentro = !b.classList.contains('on');
    b.classList.toggle('on', dentro);
    b.textContent = TP(dentro ? 'gru.dentro' : 'gru.aggiungi');
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
        li.querySelector('.chi span').textContent =
          TP(n === 1 ? 'gru.unGioco' : 'gru.nGiochi', {n: n});
      }
      disegnaGruppiFiltro();
      disegnaMia();
    }).catch(function(err){
      b.classList.toggle('on', !dentro);
      b.textContent = TP(dentro ? 'gru.aggiungi' : 'gru.dentro');
      flash(TP('msg.nonRiuscito', {e: err.message}));
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
        ? '<button type="button" data-fa="via" aria-label="' + esc(TP('stanza.menoTitolo', {nome: L.nome})) + '">' + ICO.cestino + '</button>'
        : '') +
      '<button type="button" class="presa" data-fa="sposta" aria-label="' + esc(TP('stanza.sposta')) + '">' +
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
  inp.placeholder = L ? '' : TP('stanza.nessunMobile');
  inp.setAttribute('aria-invalid', 'false');
  inp.title = '';
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
    flash(TP('msg.libRinominata'));
  }).catch(function(err){
    ok.disabled = false;
    flash(TP('msg.nonRinominata', {e: err.message}));
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
    flash(TP('msg.libRiordinate'));
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
      armato.setAttribute('aria-label', TP('stanza.elimina'));
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
      b.setAttribute('aria-label', TP('stanza.toccaAncora'));
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
      flash(TP('msg.libTolta'));
    }).catch(function(err){ b.disabled = false; flash(TP('msg.nonTolta2', {e: err.message})); });
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
      flash(TP('msg.libOrdineTuo', {n: L.nome}));
    } else {
      applyLibrary({ animate: true });
      flash(TP('msg.libNuova', {n: L.nome}));
    }
    state.scrollTo = clamp(LIB.librerie().length - 1, 0, maxScroll());
    sincronizzaPannello();
  }).catch(function(e){ flash(TP('msg.nonCreata', {e: e.message})); });
}

function bindLibrerie(){
  const inp = q('#st-rinomina'), ok = q('#st-rinomina-ok');
  if (inp){
    inp.addEventListener('input', function(){
      const L = libCorrente();
      const t = inp.value.trim();
      /* Il divieto vero sta in `store.js`, che e' l'unico a sapere quali
         librerie esistono. Qui la spunta si spegne PRIMA del clic e il
         campo dice perche': scoprire di aver sbagliato dopo aver premuto
         salva e' il modo peggiore di dirlo. */
      const preso = !!(t && L && LIB.nomeLibPreso(t, L.id));
      ok.disabled = !t || (L && inp.value === L.nome) || preso;
      inp.setAttribute('aria-invalid', preso ? 'true' : 'false');
      inp.title = preso ? TP('err.libNomePreso', {n: t}) : '';
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
  if (meno) armaBottone(meno, 'stanza.meno', 'stanza.menoOk', function(){
    const L = libCorrente();
    if (!L){ flash(TP('msg.quiNienteLib')); return; }
    LIB.togliLibreria(L.id).then(function(){
      state.scrollTo = state.scroll = clamp(state.scroll, 0, maxScroll());
      buildCabinet();
      applyLibrary({ animate: true });
      updateRail();
      disegnaLibrerie();
      sincronizzaPannello();
      flash(TP('msg.libTolta'));
    }).catch(function(err){ flash(TP('msg.nonTolta2', {e: err.message})); });
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
  q('#st-msg').textContent = TP('stanza.salvando');
  salvaStanzaT = setTimeout(function(){
    STANZA.salva()
      .then(function(){ q('#st-msg').textContent = TP('stanza.salvata'); })
      .catch(function(e){ q('#st-msg').textContent = TP('stanza.nonSalvata', {e: e.message}); });
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
    ? TP('stanza.menoScorta')
    : (quante <= 1 ? TP('stanza.menoUnica') : '');
  meno.disabled = !!motivo;
  meno.title = motivo || TP('stanza.menoTitolo', {nome: L.nome});
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
  q('#st-faretti').value = cur.faretti;
  q('#st-faretti-n').textContent = Math.round(cur.faretti * 100) + '%';
  q('#st-quale').textContent = L ? L.nome : TP('stanza.nessunMobile');

  const gruppo = function(sel, lista, valore, testo){
    q(sel).innerHTML = lista.map(function(x){
      const on = valore === x.v ? ' class="on"' : '';
      const stile = testo ? '' : ' style="background:' + esc(x.v) + '"';
      const nome = TP(x.n);          // `n` e' una chiave, non una parola
      return '<button type="button" data-v="' + esc(x.v) + '" title="' + esc(nome) + '"' +
             on + stile + '>' + (testo ? esc(nome) : '') + '</button>';
    }).join('');
  };
  gruppo('#st-scaffali',  STANZA.LEGNI,     suo.scaffali,   false);
  gruppo('#st-muro',      STANZA.MURI,      cur.muro,       false);
  gruppo('#st-pavimento', STANZA.PAVIMENTI, cur.pavimento,  false);
  gruppo('#st-nome-tinta', STANZA.NOMI,     cur.nome,       false);
  gruppo('#st-fari-tinta', STANZA.FARI,     cur.fariTinta,  false);
  gruppo('#st-arredo',    STANZA.ARREDI,    suo.arredo,     true);
}

/* CLICCANDO FUORI SI CHIUDE.

   I due pannelli che galleggiano sulla scena -- l'imbuto e la libreria
   -- si chiudevano solo con la loro crocetta. Ma sono finestrelle
   ancorate a un pulsante, non schermate: da una finestrella si esce
   guardando altrove, ed e' quello che fa chiunque.

   Si ascolta in CATTURA e su `pointerdown`, cosi' il pannello e' gia'
   chiuso quando il gesto arriva a destinazione -- se no cliccando su una
   scatola si apriva la scheda con l'imbuto ancora aperto sopra.

   I due pulsanti sono ESCLUSI dal controllo: se no il loro pointerdown
   chiuderebbe il pannello e il click subito dopo lo riaprirebbe, e il
   toggle non funzionerebbe mai. */
function bindClicFuori(){
  document.addEventListener('pointerdown', function(e){
    const t = e.target;
    if (!t || !t.closest) return;
    const b = document.body;
    if (b.classList.contains('vista') &&
        !t.closest('#vista') && !t.closest('#vista-apri')) chiudiVista();
    if (b.classList.contains('arreda') &&
        !t.closest('#stanza') && !t.closest('#stanza-apri')) chiudiArreda();
  }, true);
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
  /* L'imbuto e l'elenco NON sono rivali: l'imbuto e' la ricerca e
     l'ordine di quello che l'elenco mostra, e si apre proprio sopra di
     lui. Aprendolo si chiudeva l'elenco sotto, cioe' si buttava via la
     cosa che si stava filtrando. */
  if (tranne !== 'elenco' && tranne !== 'vista') chiudiElenco();
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
  b.textContent = L ? L.nome : TP('vista.nuovaLib');
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
  q('#st-msg').textContent = TP('stanza.siSalva');
}

function chiudiArreda(){
  document.body.classList.remove('arreda');
  q('#stanza').setAttribute('aria-hidden', 'true');
}

function bindStanza(){
  /* Toggle, come l'imbuto: lo stesso gesto che apre richiude. */
  q('#stanza-apri').addEventListener('click', function(){
    if (document.body.classList.contains('arreda')) chiudiArreda();
    else apriArreda();
  });
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

  /* I faretti passano dalla stessa strada della luce, e per la stessa
     ragione: e' un cambio di intensita', non di materiali. Quello che
     si accende e' un `emissiveIntensity` gia' pronto sullo schienale,
     quindi non si ridipinge niente e il trascinamento resta fluido. */
  q('#st-faretti').addEventListener('input', function(){
    STANZA.cambia({ faretti: parseFloat(q('#st-faretti').value) });
    q('#st-faretti-n').textContent = Math.round(STANZA.corrente().faretti * 100) + '%';
    applicaLuce();
    salvaStanzaTraPoco();
  });

  /* La tinta dei faretti passa da `applicaLuce` e non da
     `applicaStanza`: e' un colore di LUCE, non di superficie. Non c'e'
     nessun materiale da rigenerare ne' nessun arredo da ricostruire --
     si scrive un `emissive` e si e' gia' visto. */
  q('#st-fari-tinta').addEventListener('click', function(e){
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    STANZA.cambia({ fariTinta: b.getAttribute('data-v') });
    disegnaStanza();
    applicaLuce();
    salvaStanzaTraPoco();
  });

  // muro e pavimento sono la stanza
  [['#st-muro','muro'], ['#st-pavimento','pavimento'],
   ['#st-nome-tinta','nome']].forEach(function(par){
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
      if (!L){ flash(TP('stanza.nienteArredo')); return; }
      const patch = {};
      patch[par[1]] = b.getAttribute('data-v');
      q('#st-msg').textContent = TP('stanza.salvando');
      LIB.stileLibreria(L.id, patch).then(function(){
        q('#st-msg').textContent = TP('stanza.salvata');
      }).catch(function(err){
        q('#st-msg').textContent = TP('stanza.nonSalvata', {e: err.message});
      });
      disegnaStanza();
      applicaStanza();          // il cambio si vede subito, il salvataggio segue
    });
  });

  armaBottone(q('#st-reset'), 'stanza.comEra', 'stanza.comEraOk', function(){
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
  const che = TP(si ? 'pan.prefTolto' : 'riga.stellaOff');
  return '<button type="button" class="riga-stella" data-fa="stella"' +
         ' aria-pressed="' + (si ? 'true' : 'false') + '"' +
         ' title="' + che + '" aria-label="' + che + '">' + ICO.stella + '</button>';
}

/* SULLO SCAFFALE, O SOLO IN COLLEZIONE.

   La libreria e' una vetrina e l'elenco e' la collezione: `libreria`
   nulla vuol dire "ce l'ho ma non e' in mostra". E' una distinzione che
   il sito fa da sempre, e nell'elenco non si vedeva -- per sapere dove
   stesse un gioco bisognava aprire il menu della sua riga, uno per uno.

   E' un segno e non un comando: mettere e togliere si fa dal menu, che
   e' anche l'unico posto in cui si sceglie IN QUALE mobile quando ce
   n'e' piu' di uno. Il `title` dice il nome del mobile, che e' la cosa
   che si vorrebbe sapere subito dopo. */
function scaffaleRiga(g){
  const L = g.libreria
    ? LIB.librerie().filter(function(x){ return x.id === g.libreria; })[0]
    : null;
  const che = L ? TP('riga.suScaffale', {n: L.nome}) : TP('riga.fuoriScaffale');
  return '<span class="riga-scaffale' + (L ? ' su' : '') + '"' +
         ' title="' + esc(che) + '" aria-label="' + esc(che) + '">' +
         ICO.scaffale + '</span>';
}

function rigaMia(g){
  const cop = g.cover
    ? '<img src="' + esc(g.cover) + '" alt="" loading="lazy">'
    : '<span class="senza">' + esc(String(g.title || '?').slice(0, 1).toUpperCase()) + '</span>';

  return '<li data-id="' + esc(g.id) + '">' +
    '<div class="cat-cop">' + cop + '</div>' +
    /* La stella sta ACCANTO AL NOME e non in fondo alla riga: e' del
       gioco, e a fondo riga si leggeva come un terzo comando in fila
       col menu invece che come un interruttore su quel titolo. */
    '<span class="riga-tit">' +
      '<h3 class="riga-nome">' + esc(g.title) + '</h3>' +
      stellaRiga(g) +
    '</span>' +
    /* Una colonna sua, non un segno accanto al titolo: la si legge
       scorrendo, e scorrendo va trovata sempre nello stesso punto. */
    scaffaleRiga(g) +
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
  const spec = [[g.players, T('spec.giocatori')], [g.time, T('spec.minuti')], [g.year, T('spec.anno')]]
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
         '<p class="cat-dove">' + (L ? T('riga.inLib', {n: esc(L.nome)}) : T('riga.nonInLib')) + '</p>' +
         (g.score ? '<p class="voto">' + esc(g.score) + '<i>/10</i></p>' : '') +
         (testo || '<p class="vuoto">' + T('riga.nessunaRece') + '</p>') +
         chip;
}

function contenutoAzioni(g){
  if (LIB.ospitePresso()) return '<p class="vuoto">' + T('riga.ospite') + '</p>';
  return (g.libreria
           ? '<button type="button" data-fa="scaffale">' + ICO.scaffale + '<span>' + T('riga.vaiScaffale') + '</span></button>' +
             '<button type="button" data-fa="fuori" class="fuori">' + ICO.fuori + '<span>' + T('riga.togliLib') + '</span></button>'
           : '<button type="button" data-fa="dentro" class="dentro">' + ICO.dentro + '<span>' + T('riga.mettiLib') + '</span></button>') +
         /* Uscire dallo scaffale e sparire dalla collezione restano due
            gesti diversi: il primo e' reversibile in un clic, il secondo
            no. Per questo l'ultimo e' rosso e in due tempi. */
         '<button type="button" data-fa="elimina" class="elimina">' + ICO.cestino +
           '<span>' + T('riga.eliminaGioco') + '</span></button>';
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
    ? TP('mia.occhielloDi', {chi: dove.nick}) : TP('mia.occhiello');

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
      /* Chiuse, sempre. Ricordarsele aperte fra una visita e l'altra
         faceva ritrovare la vista a gruppi trasformata nell'elenco
         intero con dei titoli in mezzo, cioe' la vista accanto. */
      const su = false;
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
    html += cartella('__senza', TP('mia.senzaGruppo'),
                     l.filter(function(g){ return !LIB.gruppiDi(g.id).length; }));
    q('#mia-list').innerHTML = html;
  }

  const inVetrina = l.filter(function(g){ return !!g.libreria; }).length;
  const perche = [];
  if (state.q) perche.push(T('mia.per', {q: esc(state.q)}));
  if (state.soloPreferiti) perche.push(T('mia.fraPreferiti'));
  if (state.vista === 'gruppi' && !gruppi.length){
    q('#mia-msg').innerHTML = T('mia.nessunGruppo');
    return;
  }
  q('#mia-msg').innerHTML = l.length
    ? T('mia.riepilogo', {
        n: l.length,
        parola: T(l.length === 1 ? 'mia.gioco' : 'mia.giochi'),
        perche: perche.length ? ' ' + perche.join(', ') : '',
        v: inVetrina
      })
    : (perche.length ? T('mia.niente', {perche: perche.join(', ')}) : T('mia.vuota'));
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
  updateConta();          // il pulsante adesso e' la via del ritorno
}

function chiudiElenco(){
  document.body.classList.remove('elenco');
  q('#mia').setAttribute('aria-hidden', 'true');
  scordaFiltri();          // i filtri non escono dalla schermata in cui si mettono
  updateConta();           // e torna a dire quanti giochi hai
}

/* Dall'elenco allo scaffale: si chiude l'elenco, la camera va alla
   libreria giusta, e SOLO QUANDO E' ARRIVATA la scatola si apre. Se si
   aprisse subito, l'animazione di apertura e quella dello scorrimento
   si contenderebbero l'inquadratura. */
function apriSulloScaffale(id){
  chiudiElenco();
  /* L'elenco si apre da tutte le sezioni, quindi "vai allo scaffale"
     puo' partire dal catalogo o dal profilo -- dove la scena 3D non
     viene nemmeno disegnata. Senza tornare in collezione, la camera si
     spostava dietro una pagina piatta e il gesto non faceva niente. */
  setSezione('collezione');
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
    proMsg('#pro-amici-msg', esc(PROFILO.problema() || TP('pro.nonDisponibile')), true);
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
  q('#pro-nick').textContent = p.nick || p.nome || TP('pro.senzaNome');
  q('#pro-mail').textContent = AUTH.stato().email || p.nome || '';
  // il codice si legge a gruppi di quattro: si detta al telefono
  q('#pro-codice').textContent = p.codice
    ? p.codice.replace(/(.{4})(.{4})/, '$1 $2') : '--';
  disegnaFaccia(q('#pro-avatar'), p.avatar, 160);
  /* La faccia non e' piu' anche l'icona della barra in basso: era
     l'unica delle quattro voci che non poteva accendersi di terracotta
     quando la scegli, perche' e' un'immagine coi suoi colori dentro.
     Adesso li' c'e' una sagoma neutra, come per le altre tre. */
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
        '<span class="chi"><b>' + esc(x.profilo.nick || x.profilo.nome || TP('pro.senzaNome')) + '</b>' +
        (etichetta ? '<span>' + etichetta + '</span>' : '') + '</span>' +
        '<span class="fa">' + azioni + '</span></li>';
    }).join('');
    qa(sel + ' li').forEach(function(li, i){
      disegnaFaccia(li.querySelector('canvas'), gente[i].profilo.avatar, 40);
    });
  };

  elenco('#pro-richieste', PROFILO.daAccettare(),
    '<button type="button" class="si" data-fa="accetta">' + T('ami.accetta') + '</button>' +
    '<button type="button" class="no" data-fa="togli">' + T('ami.no') + '</button>',
    T('ami.chiedeAmicizia'));

  elenco('#pro-amici', PROFILO.amici(),
    '<button type="button" data-fa="libreria">' + T('ami.suaLibreria') + '</button>' +
    '<button type="button" class="no" data-fa="togli">' + T('ami.togli') + '</button>', '');

  elenco('#pro-attesa', PROFILO.inAttesa(),
    '<button type="button" class="no" data-fa="togli">' + T('ami.ritira') + '</button>',
    T('ami.chiesta'));

  const n = PROFILO.amici().length;
  quanti('#conta-amici', n + PROFILO.daAccettare().length);
  if (PROFILO.problema()){ proMsg('#pro-amici-msg', esc(PROFILO.problema()), true); return; }
  proMsg('#pro-amici-msg', n
    ? T(n === 1 ? 'ami.uno' : 'ami.tanti', {n: n})
    : T('ami.nessunAmico'));
}

/* Una casella sola per il codice e per l'email: chi incolla qualcosa
   non vuole prima dichiarare che cosa sta incollando. Se c'e' una
   chiocciola e' un indirizzo, se no e' un codice. */
async function chiediAmico(){
  const v = q('#ami-q').value.trim();
  if (!v) return;
  const b = q('#ami-go');
  b.disabled = true;
  proMsg('#ami-msg', T('ami.chiedo'));
  try {
    const r = v.indexOf('@') > 0 ? await PROFILO.chiediPerEmail(v)
                                 : await PROFILO.chiediPerCodice(v);
    proMsg('#ami-msg', esc(r.testo), r.esito === 'nessuno' || r.esito === 'te stesso');
    if (r.esito === 'chiesta' || r.esito === 'inviata') q('#ami-q').value = '';
    disegnaAmici();
  } catch(e){
    proMsg('#ami-msg', T('ami.nonRiuscito', {e: esc(e.message)}), true);
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
  msg.textContent = TP('nick.unAttimo');
  try {
    await PROFILO.salvaNick(q('#nick-q').value);
    q('#nick').classList.remove('on');
    q('#nick').setAttribute('aria-hidden', 'true');
    disegnaProfilo();
    flash(TP('msg.ciao', {n: PROFILO.mio().nick}));
  } catch(e){
    msg.className = '';
    msg.textContent = e.message;
  }
  b.disabled = false;
}

/* I tre cassetti del profilo. Aperti tutti insieme la pagina diventava
   lunghissima e la cosa che cercavi era sempre in fondo.

   NON si ricordano piu' fra una visita e l'altra: quello che si apre
   appartiene alla volta in cui lo si e' aperto, e ritrovare tre
   cassetti spalancati tornando dal catalogo vuol dire ritrovare una
   pagina che qualcun altro ha lasciato a meta'. Si azzerano cambiando
   schermata -- vedi `azzeraSchermata()`. */
function bindBlocchi(){
  qa('.pro-tit').forEach(function(b){
    const box = document.getElementById(b.getAttribute('aria-controls'));
    if (!box) return;
    const metti = function(v){
      b.setAttribute('aria-expanded', v ? 'true' : 'false');
      box.hidden = !v;
    };
    metti(false);
    b.addEventListener('click', function(){
      metti(b.getAttribute('aria-expanded') !== 'true');
    });
  });
}

/* Cambiando schermata si riparte da capo: cassetti chiusi, cartelle
   chiuse, e l'elenco sulla prima vista. Lasciare tutto com'era vuol
   dire tornare su una pagina che non si riconosce -- e soprattutto
   ritrovare un elenco tagliato da una vista scelta dieci minuti prima,
   senza niente a schermo che lo dica. E' la stessa ragione per cui i
   filtri non escono dalla schermata in cui si mettono. */
function azzeraSchermata(){
  qa('.pro-tit').forEach(function(b){
    const box = document.getElementById(b.getAttribute('aria-controls'));
    b.setAttribute('aria-expanded', 'false');
    if (box) box.hidden = true;
  });
  qa('.gio-gioco[aria-expanded="true"]').forEach(function(b){
    b.setAttribute('aria-expanded', 'false');
    if (b.nextElementSibling) b.nextElementSibling.hidden = true;
  });
  state.vista = 'tutti';
  state.vpar = 'gioco';
  state.cal = null; state.calGiorno = '';   // e il calendario riparte dall'ultima partita
  state.wrAperto = false;
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
    try { await PROFILO.salvaAvatar(av); flash(TP('msg.facciaSalvata')); }
    catch(e){ flash(TP('msg.facciaNo', {e: e.message})); }
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
      flash(TP('msg.selezionato'));
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(cod)
        .then(function(){ flash(TP('pro.copiato')); })
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
      // aperta o chiusa vale per questa volta, non per le prossime
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
        flash(TP('msg.nonRiuscito', {e: err.message}));
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
        flash(TP('msg.giocoEliminato'));
      } else {
        del.classList.add('armed');
        dice.textContent = TP('stanza.menoOk');
        setTimeout(function(){
          if (!del.isConnected) return;
          del.classList.remove('armed');
          dice.textContent = TP('riga.eliminaGioco');
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
      const che = TP(si ? 'pan.prefTolto' : 'riga.stellaOff');
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
  armaBottone(q('#pro-esci'), 'pro.esci', 'pro.esciOk', async function(){
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
        flash(TP('msg.nonRiuscito', {e: err.message}));
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

/* I mesi vengono dal dizionario e non da un array italiano fisso:
   `dataIt` scrive la data di ogni partita, e in inglese diceva
   "23 agosto 2026". Sono in una chiave sola separati da virgole --
   dodici chiavi per una cosa che si legge come un elenco unico si
   tengono in fila a mano, e basta che una sia fuori posto perche' il
   sito dica il mese sbagliato. */
function mesi(){ return TP('cal.mesi').split(','); }

function dataIt(iso){
  const p = String(iso || '').split('-');
  if (p.length !== 3) return '';
  return parseInt(p[2], 10) + ' ' + mesi()[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function oggiIso(){
  const d = new Date();
  const due = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
}

/* Una partita: il gioco e il quando in alto, chi c'era sotto. Il
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

/* Il tuo winrate su QUESTO gioco, li' dove il gioco si sta guardando:
   nel pannello della recensione e dentro la riga aperta del catalogo.
   E' la stessa domanda del riquadro in cima alle partite, ristretta a
   un titolo solo -- e la si fa proprio mentre si ha quel titolo davanti.

   Non compare se non ci hai mai giocato: un anello vuoto si legge come
   "non ne ho vinta nessuna", che e' un'altra cosa. */
function bloccoWr(partite){
  const w = PARTITE.winrate(partite || []);
  if (!w.gioc) return '';
  return '<div class="gioco-wr">' + anelloWr(w.perc) +
    '<b>' + w.perc + '%</b>' +
    '<span>' + T('par.wrTuoSu', {v: w.vinte, n: w.gioc}) + '</span></div>';
}

/* Il tuo winrate su quel gioco, nel pannello della recensione -- e
   nient'altro.

   Sotto ci stava anche l'elenco delle ultime sei partite. Ma la scheda
   di un gioco risponde a "che gioco e' e cosa ne penso", e l'elenco di
   quando ci ho giocato e' un'altra domanda, che ha gia' la sua
   schermata intera: le partite. Qui allungava il pannello di sei righe
   che nessuno stava cercando, e spingeva la recensione -- che e' il
   motivo per cui la scheda si apre -- sotto il bordo.

   Il winrate resta perche' e' un numero solo, e perche' e' l'unica
   cosa che quella schermata non puo' dire mentre hai QUESTO gioco in
   mano. */
function disegnaGiocate(game){
  const el = q('#p-giocate');
  if (!el) return;
  const g = (game && state.dentro && !PARTITE.problema())
    ? PARTITE.diGioco(game.bgg, game.title) : [];
  el.innerHTML = g.length ? bloccoWr(g) : '';
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
  if (ordine.length > 1 && per[ordine[1]] === primo) return TP('par.nessunoStacca');
  return primo > 1 ? TP('par.vinceN', {n: ordine[0], q: primo})
                   : TP('par.vince', {n: ordine[0]});
}

/* Raggruppate per gioco. Un elenco di partite in ordine di data non dice
   niente; "a Root avete giocato tre volte e vince sempre Giulia" e'
   quello che uno vuole sapere aprendo questa sezione. */
/* --- LE PARTITE, NELLA LORO SCHERMATA -----------------------------

   Erano un cassetto in fondo al profilo, sotto amici e giocatori. Ma il
   profilo risponde a "chi sono" e le partite a "cosa abbiamo giocato",
   e di una collezione di giochi da tavolo quella e' la meta' piu'
   interessante -- che da dentro un cassetto non si vedeva mai.

   La forma e' quella dell'elenco della collezione: occhiello, due viste,
   un "+". E' la stessa cosa, un elenco che si scorre, e chi ha capito
   quello ha capito anche questo. */
function apriPartite(){
  PARTITE.carica().then(function(){
    PARTITE.caricaGiocatori();
    disegnaPartite();
  });
  disegnaPartite();                // intanto si mostra quello che c'e' gia'
}

function disegnaVistePartite(){
  qa('#par-viste button').forEach(function(b){
    const sua = b.getAttribute('data-vpar') === state.vpar;
    b.classList.toggle('on', sua);
    b.setAttribute('aria-selected', sua ? 'true' : 'false');
  });
  /* Tre linguette adesso, non due: l'indicatore si sposta di una
     larghezza per posto, e la larghezza gliela da' il CSS. */
  const ordine = ['gioco', 'data', 'calendario'];
  const ind = q('#par-viste .ind');
  if (ind) ind.style.transform =
    'translateX(' + (Math.max(0, ordine.indexOf(state.vpar)) * 100) + '%)';
}

function setVistaPartite(v){
  if (v !== 'gioco' && v !== 'data' && v !== 'calendario') return;
  state.vpar = v;
  disegnaPartite();
}

/* ===============================================================
   IL CALENDARIO
   ===============================================================

   Le altre due viste rispondono a "a cosa abbiamo giocato" e "cosa
   abbiamo giocato per ultimo". Questa risponde a una domanda che
   nessun elenco sa dare bene: QUANDO. Un elenco di date si legge una
   riga per volta; una griglia di giorni si legge tutta insieme, e da
   li' si vede il ritmo -- i mesi pieni, le settimane vuote, le sere in
   cui si e' giocato piu' di una partita.

   Il segno su un giorno parla la lingua che il sito parla gia': il
   fondo tinto vuol dire "qui e' successo qualcosa", la terracotta vuol
   dire "hai vinto tu", e la corona e' la stessa che si tocca al tavolo
   per dire chi ha vinto. Niente simboli nuovi da imparare. */

function isoDi(a, m, g){
  const due = function(n){ return (n < 10 ? '0' : '') + n; };
  return a + '-' + due(m + 1) + '-' + due(g);
}

/* Le partite raccolte per giorno. Le vittorie guardano solo le mie:
   una sera in cui hanno vinto gli altri e' comunque una sera giocata,
   ma la corona non ce l'ha -- e' lo stesso metro del winrate. */
function partitePerGiorno(){
  const per = {};
  PARTITE.tutte().forEach(function(p){
    const d = String(p.giocata_il || '');
    if (d.length !== 10) return;            // senza data non sta da nessuna parte
    (per[d] || (per[d] = [])).push(p);
  });
  return per;
}

/* Il mese da cui partire: quello dell'ultima partita segnata, se no
   oggi. Aprire il calendario su un mese vuoto perche' non si gioca da
   marzo vorrebbe dire chiedere a chi guarda di cercarsi da solo dove
   sono le sue partite. */
function meseIniziale(){
  const d = PARTITE.tutte()
    .map(function(p){ return String(p.giocata_il || ''); })
    .filter(function(x){ return x.length === 10; })
    .sort().pop();
  const base = d || oggiIso();
  return { a: parseInt(base.slice(0, 4), 10), m: parseInt(base.slice(5, 7), 10) - 1 };
}

function calendarioHtml(){
  if (!state.cal) state.cal = meseIniziale();
  const a = state.cal.a, m = state.cal.m;
  const per = partitePerGiorno();
  const oggi = oggiIso();

  // la settimana comincia di lunedi': `getDay()` parte dalla domenica
  const vuoti = (new Date(a, m, 1).getDay() + 6) % 7;
  const quanti = new Date(a, m + 1, 0).getDate();

  let celle = '', nelMese = 0;
  for (let i = 0; i < vuoti; i++) celle += '<span class="cal-g vuoto"></span>';

  for (let g = 1; g <= quanti; g++){
    const iso = isoDi(a, m, g);
    const lista = per[iso] || [];
    const oggiQui = iso === oggi ? ' oggi' : '';
    nelMese += lista.length;
    if (!lista.length){
      celle += '<span class="cal-g' + oggiQui + '"><b>' + g + '</b></span>';
      continue;
    }
    const vinte = PARTITE.winrate(lista).vinte;
    const quante = lista.length === 1 ? TP('cal.unaQui') : TP('cal.nQui', {n: lista.length});
    const titolo = TP('cal.giorno', {g: dataIt(iso), n: quante}) + (vinte ? TP('cal.vinta') : '');
    let punti = '';
    for (let k = 0; k < Math.min(3, lista.length); k++) punti += '<i class="cal-punto"></i>';
    celle += '<button type="button" class="cal-g pieno' + (vinte ? ' vinta' : '') + oggiQui +
             (state.calGiorno === iso ? ' scelto' : '') + '" data-giorno="' + iso + '"' +
             ' title="' + esc(titolo) + '" aria-label="' + esc(titolo) + '">' +
             '<b>' + g + '</b>' +
             '<span class="cal-seg">' + (vinte ? ICO.corona : punti) + '</span>' +
             '</button>';
  }

  const gg = TP('cal.giorni').split(',');
  const scelte = (state.calGiorno && per[state.calGiorno]) || null;
  const stessoMese = isoDi(a, m, 1).slice(0, 7) === oggi.slice(0, 7);

  return '<div class="cal">' +
    '<div class="cal-testa">' +
      '<button type="button" class="cal-passo" data-cal="-1" aria-label="' + esc(TP('cal.prima')) + '">' +
        ICO.indietro + '</button>' +
      '<b>' + esc(mesi()[m]) + ' ' + a + '</b>' +
      '<button type="button" class="cal-passo" data-cal="1" aria-label="' + esc(TP('cal.dopo')) + '">' +
        ICO.avanti + '</button>' +
      // "oggi" compare solo quando serve: su questo mese non porta da nessuna parte
      (stessoMese ? '' : '<button type="button" class="cal-oggi" data-cal="0">' + T('cal.oggi') + '</button>') +
    '</div>' +
    '<div class="cal-gg">' + gg.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
    '<div class="cal-griglia">' + celle + '</div>' +
    (nelMese ? '' : '<p class="cal-vuoto">' + T('cal.nessunaQui') + '</p>') +
    (scelte ? '<ul class="giocate cal-quel-giorno">' +
        scelte.map(function(p){ return rigaGiocata(p, true); }).join('') + '</ul>' : '') +
    '</div>';
}

/* --- l'anello del winrate ----------------------------------------

   Un numero da solo si legge, ma non si CONFRONTA a colpo d'occhio
   mentre si scorre un elenco: la carica di un anello si', ed e' la
   prima cosa che l'occhio prende scendendo lungo una colonna. Il numero
   resta accanto, perche' un anello dice "circa due terzi" e non "67%".

   Il cerchio parte da mezzogiorno: la rotazione la fa il CSS, cosi' qui
   restano solo i numeri. La corsa intera e' la circonferenza, e quanto
   ne resta scoperto e' `dashoffset` -- niente archi da calcolare a mano
   e nessun caso limite a 100%, che con un `path` sarebbe un arco di 360
   gradi, cioe' un arco che non si disegna. */
const WR_R = 8, WR_GIRO = 2 * Math.PI * WR_R;

function anelloWr(perc){
  const v = (perc === null || perc === undefined) ? 0 : clamp(perc, 0, 100);
  return '<svg class="wr-anello" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
    '<circle class="wr-vuoto" cx="10" cy="10" r="' + WR_R + '"/>' +
    '<circle class="wr-carica" cx="10" cy="10" r="' + WR_R + '" ' +
      'stroke-dasharray="' + WR_GIRO.toFixed(2) + '" ' +
      'stroke-dashoffset="' + (WR_GIRO * (1 - v / 100)).toFixed(2) + '"/></svg>';
}

/* Sulla riga di un gioco. Niente anello dove non ho mai giocato io: un
   anello a zero si legge come "non ne ho vinta nessuna", che e' un'altra
   cosa. Ma il POSTO resta occupato da uno span vuoto, se no il chevron
   scivolerebbe addosso al testo e gli anelli delle altre righe non
   sarebbero piu' incolonnati -- ed e' in colonna che si confrontano. */
function chipWr(w){
  if (!w || !w.gioc) return '<span class="wr"></span>';
  return '<span class="wr" title="' + esc(TP('par.wrTitolo', {v: w.vinte, n: w.gioc})) + '">' +
    anelloWr(w.perc) + '<b>' + w.perc + '%</b></span>';
}

/* Il winrate gioco per gioco, sotto la pastiglia che lo apre. Sta qui e
   non in una finestra sopra perche' e' il dettaglio di un numero che si
   sta gia' guardando: si apre sotto, e sotto c'e' ancora l'elenco. */
function disegnaWinratePerGioco(lista){
  const el = q('#par-wr');
  if (!el) return;
  const righe = PARTITE.winratePerGioco(lista);
  el.hidden = !state.wrAperto || !righe.length;
  if (el.hidden){ el.innerHTML = ''; return; }
  el.innerHTML = '<p class="eyebrow">' + T('par.wrPerGioco') + '</p>' +
    '<ul class="wr-lista">' + righe.map(function(g){
      return '<li>' + anelloWr(g.perc) +
        '<b>' + esc(g.titolo) + '</b>' +
        '<span>' + T('par.wrSu', {v: g.vinte, n: g.gioc}) + '</span>' +
        '<i>' + g.perc + '%</i></li>';
    }).join('') + '</ul>';
}

/* Tre numeri in cima: quante partite, su quanti giochi diversi, e come
   stai andando tu. Sono le domande per cui si apre questa schermata, e
   messe prima dell'elenco si leggono in un colpo d'occhio invece che
   contando le righe.

   Il terzo diceva "vince Samuel", cioe' chi sta in testa fra tutti. Ma
   una schermata che si intitola "le tue partite" deve rispondere prima
   di tutto su di te: adesso e' il TUO winrate, ed e' un pulsante --
   dietro c'e' lo stesso numero gioco per gioco, che e' la domanda
   subito successiva. */
function disegnaSommaPartite(tutte, quantiGiochi){
  const el = q('#par-somma');
  if (!el) return;
  if (!tutte.length){ el.innerHTML = ''; return; }
  const voci = [
    [tutte.length, T(tutte.length === 1 ? 'par.serata' : 'par.serate')],
    [quantiGiochi, T(quantiGiochi === 1 ? 'par.gioco' : 'par.giochi')]
  ];
  /* `winrate(tutte)` e non `winrateTotale()`: con la ricerca accesa
     questi tre numeri devono parlare delle partite che si stanno
     guardando. Senza filtro `tutte` E' l'elenco intero, quindi non
     cambia niente. */
  const w = PARTITE.winrate(tutte);
  const io = PARTITE.mioNome();
  /* Senza nessuna partita a proprio nome non si mostra uno zero: zero
     per cento vuol dire "ho giocato e non ho mai vinto", ed e' falso.
     Si dice cosa manca, che e' anche come si rimedia. */
  const muto = w.perc === null;
  const perche = muto ? (io ? TP('par.wrChiSei', {n: io}) : TP('par.wrNick'))
                      : TP('par.wrApri');
  el.innerHTML = voci.map(function(v){
    return '<div class="par-dato"><b>' + v[0] + '</b><span>' + v[1] + '</span></div>';
  }).join('') +
  '<button type="button" id="par-wr-apri" class="par-dato largo par-wr"' +
    (muto ? ' disabled' : '') +
    ' aria-expanded="' + (state.wrAperto && !muto ? 'true' : 'false') + '"' +
    ' aria-controls="par-wr" title="' + esc(perche) + '">' +
    anelloWr(w.perc) +
    '<b>' + (muto ? '&mdash;' : w.perc + '%') + '</b>' +
    '<span>' + T(muto ? 'par.wrSenza' : 'par.wr') + '</span>' +
  '</button>';
  if (muto) state.wrAperto = false;
}

/* Le partite che si stanno guardando: tutte, o quelle che rispondono
   alla ricerca.

   Si cerca nel TITOLO e in CHI C'ERA, perche' le due domande che si
   fanno a un archivio di partite sono "quando abbiamo giocato a questo"
   e "quando c'era Giulia". Un elenco di date non risponde a nessuna
   delle due se non scorrendolo tutto.

   Stessa regola della ricerca sulla collezione: testo appiattito --
   minuscolo, senza segni diacritici -- e tutte le parole scritte devono
   comparire. Due parole restringono, non allargano. */
function partiteViste(){
  const tutte = PARTITE.tutte();
  const parole = piattoNome(state.qpar).split(/\s+/).filter(Boolean);
  if (!parole.length) return tutte;
  return tutte.filter(function(p){
    const testo = piattoNome(String(p.titolo || '') + ' ' +
      (p.chi || []).map(function(x){ return x.nome; }).join(' '));
    return parole.every(function(w){ return testo.indexOf(w) >= 0; });
  });
}

function disegnaPartite(){
  const el = q('#pro-partite');
  if (!el) return;
  /* Il filtro entra QUI e non nelle singole viste: le tre viste sono
     tre modi di guardare le stesse partite, e una ricerca che valesse
     solo per una sarebbe una ricerca che sparisce cambiando vista. */
  const tutte = partiteViste();

  const gruppi = [], per = {};
  tutte.forEach(function(p){
    const k = p.bgg ? 'b' + p.bgg : 't' + p.titolo;
    if (!per[k]){ per[k] = { titolo: p.titolo, partite: [] }; gruppi.push(per[k]); }
    per[k].partite.push(p);
  });

  disegnaVistePartite();
  disegnaSommaPartite(tutte, gruppi.length);
  disegnaWinratePerGioco(tutte);

  if (state.vpar === 'calendario'){
    el.innerHTML = calendarioHtml();
  } else if (state.vpar === 'data'){
    /* In ordine di tempo, la piu' recente in cima: e' la vista di "cosa
       abbiamo giocato l'ultima volta". Qui il titolo del gioco serve su
       ogni riga -- e' l'unica cosa che distingue una partita dall'altra. */
    const ordinate = tutte.slice().sort(function(x, y){
      return String(y.giocata_il || '').localeCompare(String(x.giocata_il || '')) ||
             String(y.ora || '').localeCompare(String(x.ora || ''));
    });
    el.innerHTML = ordinate.length
      ? '<ul class="giocate par-tutte">' +
        ordinate.map(function(p){ return rigaGiocata(p, true); }).join('') + '</ul>'
      : '';
  } else {
    el.innerHTML = gruppi.map(function(g, i){
      const n = g.partite.length;
      const chi = vinceDi(g.partite);
      // il tuo winrate su questo gioco, se ci hai giocato
      const w = PARTITE.winrate(g.partite);
      return '<div class="gio-gruppo">' +
        /* Titolo e didascalia stanno in un involucro loro, e il winrate
           fuori: se no su schermo stretto una didascalia lunga -- "8
           partite . vince Anna" -- spinge la pastiglia a capo, e gli
           anelli si sfilano dalla colonna in cui si confrontano. */
        '<button type="button" class="gio-gioco" aria-expanded="false" data-g="' + i + '">' +
          '<span class="gio-t">' +
            '<b>' + esc(g.titolo) + '</b>' +
            '<span>' + T(n === 1 ? 'par.unaPartita' : 'par.partite', {n: n}) +
            (chi ? ' &middot; <i class="vinto">' + esc(chi) + '</i>' : '') + '</span>' +
          '</span>' +
          chipWr(w) +
        '</button>' +
        '<ul class="giocate" hidden>' +
          g.partite.map(function(p){ return rigaGiocata(p, false); }).join('') +
        '</ul></div>';
    }).join('');
  }

  quanti('#conta-partite', tutte.length);
  if (PARTITE.problema()){ proMsg('#par-msg', esc(PARTITE.problema()), true); return; }
  /* Vuoto perche' non hai giocato e vuoto perche' non c'e' niente che
     corrisponda sono due cose diverse, e la seconda va detta con dentro
     quello che si e' cercato: se no sembra che le partite siano
     sparite. */
  proMsg('#par-msg', tutte.length ? ''
    : (state.qpar ? T('par.nessunaPer', {q: esc(state.qpar)}) : T('par.nessuna')));
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
      (x.amico ? '<span>' + T('gio.amicoSulSito') + '</span>' : '') + '</span>' +
      '<span class="fa"><button type="button" class="no" data-fa="via">' + T('gio.togli') + '</button></span>' +
    '</li>';
  }).join('');

  quanti('#conta-giocatori', g.length);
  if (PARTITE.problema()){ proMsg('#gio-msg', esc(PARTITE.problema()), true); return; }
  // gli amici che non sono ancora al tavolo: proporli evita di riscriverli
  const da = PARTITE.amiciDaAggiungere();
  proMsg('#gio-msg', da.length
    ? T('gio.daiTuoiAmici') + ' ' + da.map(function(a){
        return '<button type="button" class="pro-lin" data-amico="' + esc(a.id) + '">' +
               esc(a.profilo.nick || a.profilo.nome || TP('pro.senzaNome')) + '</button>';
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

  q('#pa-h').textContent = TP(paCorrente.id ? 'pa.hCorreggi' : 'pa.h');
  q('#pa-titolo').value = paCorrente.titolo || '';
  q('#pa-data').value   = paCorrente.giocata_il || '';
  q('#pa-togli').hidden = !paCorrente.id;
  q('#pa-chi-q').value = '';
  chiudiSuggChi();
  leggiNomiNoti();
  /* Adesso i punti si salvano (migrazione `punti_partita`), quindi
     riaprendo una partita il tavolo e' quello di allora e i punti
     tornano a comandare: si corregge un punteggio e il vincitore si
     sposta con lui. Prima questo campo partiva vero se c'era un
     vincitore, e la conseguenza era che modificando i punti la corona
     restava dov'era -- che e' proprio il difetto segnalato. Solo un
     tocco sulla corona, in questa sessione, la passa alle mani. */
  paCorrente.coroneAMano = false;
  q('#pa-msg').textContent = '';

  disegnaTavolo();
  q('#partitalayer').classList.add('on');
  q('#partitalayer').setAttribute('aria-hidden', 'false');
  /* Il fuoco solo dove c'e' una tastiera vera. Su un telefono prendere
     il fuoco vuol dire far salire la tastiera di sistema addosso al
     modulo, prima ancora che si sia visto cosa c'e' dentro: il campo
     lo tocca chi vuole scriverci. */
  if (!paCorrente.titolo && !matchMedia('(pointer:coarse)').matches) q('#pa-titolo').focus();
}

function chiudiPartita(){
  chiudiSugg();
  calcChiudi();          // se no riaprendo il modulo si ritrova aperta su un altro tavolo
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

   La corona segue i punti FINCHE' nessuno la tocca. Ci sono giochi che
   i punti non ce li hanno -- si vince e basta -- e ce ne sono in cui i
   punti li segni solo per qualcuno: in tutti e due i casi il vincitore
   lo si mette a mano, e da quel momento i punti decidono le posizioni
   ma non piu' la corona. Prima toccarla con dei punti a schermo veniva
   rifiutato, cioe' chi non segnava i punti di tutti non poteva dire chi
   aveva vinto. `posizione` puo' restare nulla, che vuol dire
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
    /* Tavolo senza punti e senza corone: si riparte da zero, cosi' i
       punti possono tornare a decidere. Senza questo, chi ha messo una
       corona a mano una volta non poteva piu' tornare indietro. */
    if (!paCorrente.chi.some(function(x){ return x.vincitore; })) paCorrente.coroneAMano = false;
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
    /* Le posizioni vengono sempre dai punti; la corona no, se qualcuno
       l'ha gia' toccata. Chi tocca una corona sta dicendo "il vincitore
       lo decido io", e il modulo gli crede invece di rimettergliela
       sotto le dita al tasto successivo. */
    if (paCorrente.coroneAMano) return;
    x.vincitore = (x.posizione === 1);
    x.daPunti = true;                      // questa corona l'ha decisa la classifica
  });
}

/* ===============================================================
   LA CALCOLATRICE DEL TAVOLO
   ===============================================================

   Un gioco da tavolo si conta sommando pezzi: le carte, gli obiettivi,
   i gettoni, e quasi sempre qualcosa moltiplicato per qualcos'altro --
   tre citta' per due punti l'una. Farlo a mente col telefono in mano
   e' il modo piu' rapido di sbagliare, e sbagliare qui vuol dire un
   vincitore sbagliato.

   E' volutamente piccola: interi, tre operazioni, e un totale sempre
   in vista invece di un tasto "uguale". Non e' una calcolatrice
   scientifica appiccicata a un sito di giochi -- e' la striscia di
   carta su cui si somma a bordo tavolo.

   Il totale non si legge e si ricopia: si scrive nel campo di quella
   persona, che e' la ragione per cui vive dentro questo modulo. */
let calcTok = [];        // ['12','+','3','x','4']
let calcChi = -1;        // la riga a cui va il totale
let calcFresco = false;  // il primo tasto sostituisce, non aggiunge

/* Moltiplicazioni prima, somme dopo. Nessun `eval`: i tasti producono
   solo cifre e tre segni, quindi il parser sta in dieci righe e non
   c'e' niente da sanificare. */
function calcTotale(){
  const t = calcTok.slice();
  if (t.length && /^[+\-x]$/.test(t[t.length - 1])) t.pop();
  if (!t.length) return 0;
  let i = 1;
  while (i < t.length - 1){
    if (t[i] === 'x') t.splice(i - 1, 3, String(Number(t[i - 1]) * Number(t[i + 1])));
    else i += 2;
  }
  let tot = Number(t[0]) || 0;
  for (let j = 1; j < t.length - 1; j += 2){
    tot += (t[j] === '-' ? -1 : 1) * (Number(t[j + 1]) || 0);
  }
  return tot;
}

function calcDisegna(){
  const segno = { x: '&times;', '-': '&minus;', '+': '+' };
  const e = q('#calc-espr');
  e.innerHTML = calcTok.map(function(t){
    return segno[t] || esc(t);
  }).join(' ');
  // il conto puo' diventare lungo: si guarda sempre la coda, che e' il
  // pezzo che si sta scrivendo
  e.scrollLeft = e.scrollWidth;
  q('#calc-tot').textContent = calcTotale();
}

function calcTasto(c){
  const ultimo = calcTok[calcTok.length - 1];
  const eSegno = function(t){ return t === '+' || t === '-' || t === 'x'; };

  if (c === 'C'){ calcTok = []; calcFresco = false; calcDisegna(); return; }
  if (c === 'del'){
    if (!calcTok.length) return;
    if (eSegno(ultimo) || ultimo.length === 1) calcTok.pop();
    else calcTok[calcTok.length - 1] = ultimo.slice(0, -1);
    calcFresco = false;
    calcDisegna();
    return;
  }
  if (c === 'ok'){ calcUsa(); return; }

  if (eSegno(c)){
    if (!calcTok.length) return;             // un segno non apre un conto
    if (eSegno(ultimo)) calcTok[calcTok.length - 1] = c;   // si cambia idea
    else calcTok.push(c);
    calcFresco = false;
    calcDisegna();
    return;
  }

  // una cifra
  if (calcFresco){ calcTok = []; calcFresco = false; }
  if (!calcTok.length || eSegno(calcTok[calcTok.length - 1])) calcTok.push(c);
  else {
    const n = calcTok[calcTok.length - 1];
    if (n.length >= 6) return;               // sei cifre bastano a qualunque partita
    calcTok[calcTok.length - 1] = (n === '0') ? c : n + c;
  }
  calcDisegna();
}

/* Si apre GIA' CARICA di quello che c'e' scritto nel campo: quasi
   sempre si aggiunge a un punteggio, non si riparte da zero. Ma la
   prima cifra lo sostituisce, come su qualunque calcolatrice -- se no
   chi voleva riscrivere il punteggio si ritrovava le cifre in coda. */
function calcApri(i){
  if (!paCorrente || !paCorrente.chi[i]) return;
  calcChi = i;
  const p = paCorrente.chi[i].punti;
  const ce = p !== null && p !== undefined && p !== '';
  calcTok = ce ? [String(p)] : [];
  calcFresco = ce;
  q('#calc-nome').textContent = paCorrente.chi[i].nome;
  const el = q('#calc');
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  calcDisegna();
  if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function calcChiudi(){
  const el = q('#calc');
  if (!el) return;
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  calcChi = -1;
  calcTok = [];
}

function calcUsa(){
  if (!paCorrente || calcChi < 0 || !paCorrente.chi[calcChi]){ calcChiudi(); return; }
  // lo stesso tetto del campo: quattro cifre, segno compreso
  const v = Math.max(-9999, Math.min(9999, calcTotale()));
  paCorrente.chi[calcChi].punti = v;
  ricalcolaPosizioni();
  calcChiudi();
  disegnaTavolo();                 // la calcolatrice sta FUORI da #pa-chi
}

function disegnaTavolo(){
  if (!paCorrente) return;
  q('#pa-chi').innerHTML = paCorrente.chi.map(function(x, i){
    /* La corona sta a DESTRA DEL NOME, attaccata a lui, e si vede solo
       su chi ha vinto: una fila di corone spente davanti a ogni nome
       diceva "qui si preme", che non e' quello che si vuole leggere
       scorrendo un tavolo. Sulle altre righe resta comunque un pulsante,
       appena accennato, e si accende sotto il dito: senza, non ci
       sarebbe piu' modo di dire chi ha vinto quando i punti non ci sono
       o non sono di tutti. */
    return '<li data-i="' + i + '"' + (x.vincitore ? ' class="vince"' : '') + '>' +
      '<span class="chi-nome">' +
        '<span class="nome">' + esc(x.nome) + '</span>' +
        '<button type="button" class="corona' + (x.vincitore ? ' on' : '') + '" data-fa="vince" ' +
          'aria-pressed="' + (x.vincitore ? 'true' : 'false') + '" ' +
          'aria-label="' + esc(TP('pa.haVinto', {n: x.nome})) + '">' + ICO.corona + '</button>' +
      '</span>' +
      (x.posizione ? '<span class="posto">' + x.posizione + '&deg;</span>' : '') +
      '<input class="punti" type="text" inputmode="numeric" maxlength="4" ' +
        'value="' + esc(x.punti == null ? '' : x.punti) + '" ' +
        'placeholder="' + esc(TP('pa.punti')) + '" aria-label="' + esc(TP('pa.puntiDi', {n: x.nome})) + '">' +
      /* La calcolatrice sta ATTACCATA al campo dei punti, non in fondo
         al modulo: e' di quel campo, e il totale ci finisce dentro. */
      '<button type="button" class="conta" data-fa="conta" aria-label="' +
        esc(TP('calc.apriPer', {n: x.nome})) + '">' + ICO.conta + '</button>' +
      '<button type="button" class="via" data-fa="via" aria-label="' + esc(TP('pa.togliChi', {n: x.nome})) + '">' +
        ICO.chiudi + '</button>' +
    '</li>';
  }).join('');

  // i suggerimenti si rifanno con quello che c'e' scritto adesso
  const campo = q('#pa-chi-q');
  if (campo && !document.getElementById('pa-chi-sugg').hidden) suggerisciChi(campo.value);
}

/* --- i nomi che il sito conosce ------------------------------------

   Tu per primo, poi gli amici, poi i giocatori salvati. Stanno INSIEME
   in un elenco solo perche' al tavolo la differenza non conta -- conta
   chi c'era -- e tenerli separati vuol dire cercare due volte. La
   pastiglia accanto dice da dove viene ognuno, che e' l'unico posto in
   cui la differenza serve ancora.

   TU CI SEI SEMPRE: e' la tua collezione e sono le tue partite, e non
   essere fra i nomi proponibili voleva dire riscrivere il proprio nome
   ogni volta -- o, come e' successo, non mettersi mai e ritrovarsi il
   winrate a zero. */
function nomiNoti(){
  const piatti = {};
  (paCorrente ? paCorrente.chi : []).forEach(function(x){ piatti[piattoNome(x.nome)] = true; });

  const fuori = [];
  const metti = function(nome, tipo, id){
    const k = piattoNome(nome);
    if (!nome || piatti[k]) return;
    piatti[k] = true;                          // niente doppioni fra le tre fonti
    fuori.push({ nome: nome, tipo: tipo, id: id || null });
  };

  metti(PARTITE.mioNome(), 'io', null);
  (PARTITE.amiciDaAggiungere ? PARTITE.amiciDaAggiungere() : []).forEach(function(a){
    metti((a.profilo && (a.profilo.nick || a.profilo.nome)) || '', 'amico', null);
  });
  PARTITE.giocatori().forEach(function(g){ metti(g.nome, 'salvato', g.id); });
  return fuori;
}

function piattoNome(s){
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const TAG_CHI = { io: 'pa.tu', amico: 'pa.amicoTag', salvato: 'pa.salvatoTag' };

/* Amici e giocatori salvati li leggeva solo il profilo. Finche' chi
   c'era era una fila di pastiglie dentro la sezione partite non si
   notava; adesso il campo li propone, e il modulo si apre anche dalla
   scatola aperta -- cioe' da un punto del sito dove nessuno li ha
   ancora chiesti. Si chiedono qui, una volta per sessione, e i
   suggerimenti si rifanno da soli quando arrivano. */
let nomiLetti = false;

function leggiNomiNoti(){
  if (nomiLetti) return;
  nomiLetti = true;
  const poi = function(){
    const el = q('#pa-chi-sugg');
    if (paCorrente && el && !el.hidden) suggerisciChi(q('#pa-chi-q').value);
  };
  PARTITE.caricaGiocatori().then(poi).catch(function(){});
  if (typeof PROFILO !== 'undefined' && PROFILO.mio()){
    PROFILO.caricaAmici().then(poi).catch(function(){});
  }
}

/* A campo vuoto si mostrano tutti: e' quello che facevano le pastiglie,
   e per due o tre nomi resta il modo piu' rapido. Scrivendo si
   restringe, e in fondo c'e' sempre la riga per aggiungere il nome
   scritto -- che e' l'unica strada per chi al tavolo c'era ma sul sito
   non c'e'. */
function suggerisciChi(testo){
  const t = String(testo || '').trim();
  const q1 = piattoNome(t);
  const noti = nomiNoti().filter(function(x){
    return !q1 || piattoNome(x.nome).indexOf(q1) >= 0;
  }).slice(0, 8);

  const esatto = noti.some(function(x){ return piattoNome(x.nome) === q1; });
  const righe = noti.map(function(x){
    return { nome: x.nome, id: x.id, tag: TAG_CHI[x.tipo], accento: x.tipo === 'io' };
  });
  if (t && !esatto) righe.push({ nome: t, id: null, tag: 'pa.nuovoTag', nuovo: true });
  mostraSuggChi(righe);
}

function mostraSuggChi(righe){
  const el = q('#pa-chi-sugg'), campo = q('#pa-chi-q');
  if (!el || !campo) return;
  if (!righe.length){ chiudiSuggChi(); return; }
  el.innerHTML = righe.map(function(x){
    return '<li><button type="button" role="option" ' +
      'data-nome="' + esc(x.nome) + '" data-gio="' + esc(x.id || '') + '">' +
      '<b>' + (x.nuovo ? esc(TP('pa.aggiungiNome', {n: x.nome})) : esc(x.nome)) + '</b>' +
      '<span' + (x.accento ? ' class="tu"' : '') + '>' + esc(TP(x.tag)) + '</span>' +
      '</button></li>';
  }).join('');
  el.hidden = false;
  campo.setAttribute('aria-expanded', 'true');
}

function chiudiSuggChi(){
  const el = q('#pa-chi-sugg'), campo = q('#pa-chi-q');
  if (!el) return;
  el.hidden = true; el.innerHTML = '';
  if (campo) campo.setAttribute('aria-expanded', 'false');
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
   che nessuno sa a memoria e che senza nessuno aggancia la partita al
   catalogo. Adesso si cerca, e scegliendo un risultato l'id arriva da
   solo -- e' quello a tenere insieme partite, recensioni e catalogo.

   Si cerca PRIMA nella collezione, che e' dove stanno i giochi a cui si
   gioca davvero, e solo dopo nel catalogo. Chi scrive un titolo che non
   esiste da nessuna parte ha comunque la sua partita, senza aggancio:
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
    .map(function(g){ return { titolo: g.title, bgg: g.bgg || '', dove: 'mia.occhiello' }; });

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
      .map(function(x){ return { titolo: x.title, bgg: x.bgg || '', dove: 'cat.occhiello' }; });
    mostraSugg(mie.concat(dal), false);
  }).catch(function(){});
}

function mostraSugg(elenco){
  const el = q('#pa-sugg'), campo = q('#pa-titolo');
  if (!elenco.length){ el.hidden = true; el.innerHTML = ''; campo.setAttribute('aria-expanded','false'); return; }
  el.innerHTML = elenco.map(function(x, i){
    return '<li><button type="button" role="option" data-i="' + i + '" ' +
      'data-titolo="' + esc(x.titolo) + '" data-bgg="' + esc(x.bgg) + '">' +
      '<b>' + esc(x.titolo) + '</b><span>' + esc(TP(x.dove)) + '</span></button></li>';
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
    q('#pa-msg').textContent = TP('pa.giaAlTavolo', {n: t});
    return;
  }
  paCorrente.chi.push({ nome: t, giocatore: idGiocatore || null,
                        punti: null, posizione: null, vincitore: false });
  q('#pa-msg').textContent = '';
  /* Il campo si svuota e i suggerimenti restano aperti: al tavolo i nomi
     si mettono in fila, e richiudere tutto a ogni nome vorrebbe dire
     ricominciare da capo quattro volte. */
  const campo = q('#pa-chi-q');
  if (campo) campo.value = '';
  disegnaTavolo();          // che rimette anche i suggerimenti, se sono aperti
}

async function salvaPartita(){
  if (!paCorrente) return;
  const b = q('#pa-salva');
  paCorrente.titolo = q('#pa-titolo').value;
  // l'id BGG non si chiede piu': lo mette il suggeritore scegliendo un gioco
  /* L'ora e le note non si chiedono piu': di una partita si ricorda il
     giorno, non il minuto, e le note erano un campo che restava vuoto.
     Quelle gia' scritte non si buttano via -- `paCorrente` se le porta
     dietro e tornano sul database com'erano. */
  paCorrente.giocata_il = q('#pa-data').value || null;

  b.disabled = true;
  try {
    await PARTITE.salva(paCorrente);
    chiudiPartita();
    disegnaPartite();
    disegnaGiocate(state.focused && state.focused.userData.game);
    // se i punteggi non sono passati lo si dice: la partita c'e' lo stesso
    flash(TP(PARTITE.puntiPersi() ? 'msg.partitaSenzaPunti' : 'msg.partitaSegnata'));
  } catch(e){
    q('#pa-msg').textContent = TP('pa.nonSalvata', {e: e.message});
  }
  b.disabled = false;
}

/* --- la libreria di un amico -------------------------------------
   La stessa scena, gli stessi gesti, la stessa recensione che si apre:
   cambia solo che non si tocca niente. Fare una schermata a parte per
   guardare una collezione avrebbe voluto dire rifare da capo l'unica
   cosa che questo sito sa fare bene. */
async function visitaLibreria(id, nick){
  const chi = nick || TP('ami.unAmico');
  // una scatola tua aperta non ha senso davanti allo scaffale di un altro
  if (state.phase === 'focus' || state.phase === 'review') unfocus();
  flash(TP('msg.aproLibDi', {chi: chi}));
  try {
    await LIB.visita(id, nick);
  } catch(e){
    flash(TP('msg.nonRiescoAprire', {e: e.message}));
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
  state.q = ''; sincronizzaCerca(null);
  document.body.classList.remove('cerca');
  state.scrollTo = state.scroll = 0;

  /* Il catalogo, LE PARTITE e il profilo spariscono: di qui in poi il
     sito e' la sua libreria e basta, e si esce da un posto solo -- il
     cartello che dice di chi e'. Portarsi nel proprio catalogo dalla
     libreria di un altro vuol dire uscire da casa sua senza
     accorgersene, e le partite ci erano rimaste per dimenticanza: sono
     tue e restano tue anche mentre sei da lui, quindi entrarci da qui
     e' proprio il giro che questa regola vuole evitare. */
  setSezione('collezione');
  await CUORI.carica(id);          // i cuori della sua collezione, in una lettura
  await loadCovers();
  applyLibrary({});
  if (!LIB.all().length) flash(TP('msg.libDiVuota', {chi: chi}));
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
      flash(CUORI.problema() || TP('msg.nonRiuscito', {e: e.message}));
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

  armaBottone(q('#pa-togli'), 'pa.togli', 'stanza.menoOk', async function(){
    if (!paCorrente || !paCorrente.id) return;
    try {
      await PARTITE.togli(paCorrente.id);
      chiudiPartita();
      disegnaPartite();
      disegnaGiocate(state.focused && state.focused.userData.game);
      flash(TP('msg.partitaEliminata'));
    } catch(e){ flash(TP('msg.nonEliminata', {e: e.message})); }
  });

  /* Chi c'era: un campo, e i nomi che appaiono scrivendo. Un
     ascoltatore solo sull'elenco, che si rifa' a ogni lettera. */
  const chiQ = q('#pa-chi-q');
  chiQ.addEventListener('input', function(){ suggerisciChi(chiQ.value); });
  chiQ.addEventListener('focus', function(){ suggerisciChi(chiQ.value); });
  chiQ.addEventListener('blur', function(){ setTimeout(chiudiSuggChi, 160); });
  chiQ.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ chiudiSuggChi(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    /* Invio mette al tavolo quello che c'e' scritto. Se il nome e' uno
       di quelli noti si porta dietro il suo id di giocatore salvato --
       se no la partita perderebbe il collegamento per una differenza di
       maiuscole. */
    const t = chiQ.value.trim();
    if (!t) return;
    const noto = nomiNoti().filter(function(x){ return piattoNome(x.nome) === piattoNome(t); })[0];
    metteAlTavolo(noto ? noto.nome : t, noto ? noto.id : null);
  });
  q('#pa-chi-sugg').addEventListener('mousedown', function(e){
    // mousedown e non click: il blur del campo chiuderebbe l'elenco prima
    const b = e.target.closest('button[data-nome]');
    if (!b || !paCorrente) return;
    e.preventDefault();
    metteAlTavolo(b.getAttribute('data-nome'), b.getAttribute('data-gio') || null);
  });
  qa('#partitalayer input, #partitalayer textarea').forEach(function(i){
    i.addEventListener('keydown', function(e){ e.stopPropagation(); });
  });

  // il tavolo: un ascoltatore solo, le righe si rifanno di continuo
  q('#pa-chi').addEventListener('click', function(e){
    const b = e.target.closest('button[data-fa]');
    if (!b || !paCorrente) return;
    const i = parseInt(b.closest('li').getAttribute('data-i'), 10);
    if (b.getAttribute('data-fa') === 'conta'){ calcApri(i); return; }
    if (b.getAttribute('data-fa') === 'via'){
      // se si toglie chi si stava contando, la calcolatrice non ha piu'
      // un posto dove scrivere: si chiude invece di puntare a una riga
      // che nel frattempo e' un'altra persona
      if (calcChi >= 0) calcChiudi();
      paCorrente.chi.splice(i, 1);
      ricalcolaPosizioni();
      disegnaTavolo();
      return;
    }
    /* La corona si tocca SEMPRE, anche con dei punti a schermo. Prima
       era rifiutata, e la conseguenza era che chi non segnava i punti di
       tutti -- il caso normale: quasi sempre si ricorda il punteggio di
       due su quattro -- non poteva piu' dire chi aveva vinto. Da qui in
       poi i punti fanno le posizioni e la corona la fa la persona. */
    const riga = paCorrente.chi[i];
    const eraSu = !!riga.vincitore;
    if (!paCorrente.coroneAMano){
      /* Il PRIMO tocco toglie di mezzo le corone che venivano dai punti:
         da qui in poi comanda la persona, e lasciare accesa anche quella
         della classifica vorrebbe dire due vincitori per due motivi
         diversi. Dopo, ogni tocco e' solo un tocco -- due corone insieme
         si possono ancora fare, ma perche' le ha messe qualcuno. */
      paCorrente.chi.forEach(function(x){ if (x.daPunti){ x.vincitore = false; x.daPunti = false; } });
      paCorrente.coroneAMano = true;
    }
    // `eraSu` si legge PRIMA di spegnere: se no toccare la corona che
    // i punti avevano gia' acceso la riaccenderebbe invece di toglierla
    riga.vincitore = !eraSu;
    riga.daPunti = false;                  // questa l'ha messa una persona
    q('#pa-msg').textContent = '';
    disegnaTavolo();
  });
  q('#calc-tasti').addEventListener('click', function(e){
    const b = e.target.closest('button[data-c]');
    if (b) calcTasto(b.getAttribute('data-c'));
  });
  q('#calc-x').addEventListener('click', calcChiudi);

  /* Anche da tastiera. Su un telefono si tocca, ma questo modulo si
     riempie spesso a tavolino con la tastiera sotto le mani, e una
     calcolatrice su cui non si possono battere i numeri e' una
     calcolatrice a meta'. Si ascolta in CATTURA e si ferma l'evento:
     se no lo `Escape` chiuderebbe l'intero modulo invece della sola
     calcolatrice, e i numeri finirebbero nelle scorciatoie della
     scena. */
  document.addEventListener('keydown', function(e){
    const el = q('#calc');
    if (!el || el.hidden) return;
    let c = null;
    if (/^[0-9]$/.test(e.key)) c = e.key;
    else if (e.key === '+') c = '+';
    else if (e.key === '-') c = '-';
    else if (e.key === '*' || e.key === 'x' || e.key === 'X') c = 'x';
    else if (e.key === 'Backspace') c = 'del';
    else if (e.key === 'Enter') c = 'ok';
    else if (e.key === 'Escape'){ e.stopPropagation(); e.preventDefault(); calcChiudi(); return; }
    if (c === null) return;
    e.stopPropagation();
    e.preventDefault();
    calcTasto(c);
  }, true);

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
  q('#par-viste').addEventListener('click', function(e){
    const b = e.target.closest('button[data-vpar]');
    if (b) setVistaPartite(b.getAttribute('data-vpar'));
  });

  /* L'ascoltatore sta sul contenitore e non sul pulsante: la pastiglia
     del winrate si rifa' a ogni `disegnaSommaPartite`, e attaccarglielo
     addosso vorrebbe dire rimetterlo ogni volta. */
  q('#par-somma').addEventListener('click', function(e){
    const b = e.target.closest('#par-wr-apri');
    if (!b || b.disabled) return;
    state.wrAperto = !state.wrAperto;
    b.setAttribute('aria-expanded', state.wrAperto ? 'true' : 'false');
    disegnaWinratePerGioco();
  });

  /* Il calendario: un mese avanti, uno indietro, "oggi", e un giorno
     che si apre sotto. L'ascoltatore sta sul contenitore perche' la
     griglia si rifa' per intero a ogni passo -- attaccarlo ai pulsanti
     vorrebbe dire rimetterlo ogni volta.

     Sta PRIMA di quello che riapre una partita, e ferma l'evento: una
     cella e' un pulsante dentro `#pro-partite`, e senza si aprirebbe
     anche il modulo della partita sotto. */
  q('#pro-partite').addEventListener('click', function(e){
    const passo = e.target.closest('button[data-cal]');
    if (passo){
      e.stopPropagation();
      const d = parseInt(passo.getAttribute('data-cal'), 10);
      if (d === 0) state.cal = { a: parseInt(oggiIso().slice(0,4),10),
                                 m: parseInt(oggiIso().slice(5,7),10) - 1 };
      else {
        const m = state.cal.m + d;
        state.cal = { a: state.cal.a + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
      }
      state.calGiorno = '';        // cambiando mese il giorno aperto non c'e' piu'
      disegnaPartite();
      return;
    }
    const g = e.target.closest('button[data-giorno]');
    if (g){
      e.stopPropagation();
      const iso = g.getAttribute('data-giorno');
      // toccarlo di nuovo lo richiude: e' lo stesso gesto che l'ha aperto
      state.calGiorno = (state.calGiorno === iso) ? '' : iso;
      disegnaPartite();
    }
  });

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
    catch(err){ b.disabled = false; flash(TP('msg.nonTolto', {e: err.message})); return; }
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
/* LA LUCE CHE NON HA UN CENTRO.

   Quattro lampade sull'asse del mobile non possono illuminare allo
   stesso modo tre colonne: quella di mezzo la prendono in faccia e le
   altre di taglio, ed e' geometria, non un valore da tarare. La strada
   che funziona e' non chiedere a loro la luce sulle copertine.

   Ogni copertina si accende un poco da se', della tinta dei faretti e
   in proporzione a quanto sono accesi. Per costruzione e' identica su
   tutte e dodici -- nessun centro, nessun angolo -- e costa zero: e'
   un `emissive` che c'era gia', usato per l'alzata dell'hover.

   Non e' nemmeno una furbata: una scatola sotto una striscia LED
   *rimanda indietro* quella luce, ed e' esattamente quello che si
   vede. */
function updateBoxes(dt){
  let mosso = false;
  const fari = .17 * luceFari;
  for (let i = 0; i < boxes.length; i++){
    const b = boxes[i], u = b.userData;
    if (u.busy){ u.cover.emissiveIntensity = Math.max(.10, fari); continue; }

    // il cubo di destinazione si annuncia alzando la scatola che ci sta
    // gia': e' quella che sta per scambiarsi di posto
    const mirato = !!(state.presa && state.presa.mirBox === b);
    const want = ((state.hover === b && state.phase === 'browse') || mirato) ? 1 : 0;
    u.hover += (want - u.hover) * Math.min(1, dt * 9);
    if (Math.abs(want - u.hover) > .002) mosso = true;

    b.position.set(u.homePos.x, u.homePos.y + u.hover * .10, u.homePos.z + u.hover * .5);
    b.rotation.y = u.homeRot.y + u.hover * .07;
    u.cover.emissiveIntensity = fari + u.hover * .30;
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
      sporcaMirino();        // sotto il puntatore adesso c'e' un'altra scatola
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
    /* Due mestieri sulla stessa lampada: la quota dei vani, che segue
       la stanza, e quella dei faretti, che no. Sommate invece che in
       due gruppi di lampade separati, perche' dodici punti luce nello
       shader di ogni materiale della scena sarebbero il conto piu'
       salato del sito -- e l'effetto sotto il ripiano lo fa gia' la
       luce dipinta sullo schienale. Questa serve solo a non lasciare al
       buio la copertina della scatola. */
    bayLights[i].intensity = state.bayLight * luceVani + .34 * luceFari;
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

  /* Il raycast costava un giro su tutte le scatole a OGNI fotogramma,
     anche con il puntatore fermo e la scena ferma -- cioe' quasi sempre.
     Si rifa' solo se qualcosa e' cambiato sotto: il puntatore che si
     muove, la camera che scorre, o le scatole che si spostano. Sono
     esattamente i casi in cui la risposta puo' essere un'altra. */
  if (state.phase === 'browse' && !state.dragging && !state.presa){
    if (mirinoSporco){
      mirinoSporco = false;
      const hit = pick();
      if (hit !== state.hover){
        state.hover = hit;
        document.body.style.cursor = hit ? 'pointer' : '';
      }
    }
  } else if (state.phase !== 'browse' && document.body.style.cursor){
    document.body.style.cursor = '';
  }

  if (updateBoxes(dt) || anims.length || state.presa){ rifaiOmbre(); sporcaMirino(); }

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
      (g.cover ? '<img src="' + esc(g.cover) + '" alt="' + esc(TP('flat.scatolaDi', {g: g.title})) + '" loading="lazy">' : '') +
      '<h2>' + esc(g.title) + '</h2>' +
      '<p class="byline"><b>' + esc(g.designer) + '</b> &middot; ' + esc(g.publisher) + ' &middot; ' + esc(g.year) +
      ' &middot; ' + esc(g.players) + ' ' + T('spec.giocatori') +
      ' &middot; ' + esc(g.time) + ' ' + T('spec.min') +
      (g.artist ? '<br><span class="credit">' + T('pan.credito', {a: esc(g.artist)}) +
                  ', &copy; ' + esc(g.publisher) + '</span>' : '') + '</p>' +
      (g.review || []).map(function(t){ return '<p>' + esc(t) + '</p>'; }).join('') +
      (g.bgg ? '<p><a class="bgg" href="https://boardgamegeek.com/boardgame/' + g.bgg +
               '/" target="_blank" rel="noopener">' + T('pan.bgg') + '</a></p>' : '') +
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
const PORTA = 'dado-cancello';

function gate(giaDentro){
  /* Quale porta si e' presa l'ultima volta. Non e' un dettaglio: chi
     torna riconosce la sua invece di rileggere due schede. */
  try {
    const scorsa = localStorage.getItem(PORTA);
    const b = scorsa && q('#gate [data-gate="' + scorsa + '"]');
    if (b) b.classList.add('last');
  } catch(e){}

  if (giaDentro){
    q('#gate').classList.add('gone');
    return Promise.resolve('entra');
  }
  return new Promise(function(res){
    qa('#gate [data-gate]').forEach(function(b){
      b.addEventListener('click', async function(){
        const scelta = b.getAttribute('data-gate');
        try { localStorage.setItem(PORTA, scelta); } catch(e){}
        if (scelta === 'entra' && AUTH.attivo()){
          b.disabled = true;
          try {
            await AUTH.entra();      // se ne va su Google: la pagina viene lasciata
            return;
          } catch(e){
            b.disabled = false;
            q('#gate-note').textContent = TP('gate.nonRiuscito', {e: e.message});
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
  state.vista = 'tutti';        // si riparte sempre dalla prima vista
  qa('#sortmenu button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-sort') === state.sort);
  });
  LIB.suErrore(flash);                    // le scritture rifiutate le racconta il flash
  /* ...e le rimette anche a posto: una cancellazione rifiutata dal
     server rimette il gioco nei dati, e la scatola deve tornare sullo
     scaffale. Senza, la scena e i dati restavano in disaccordo fino al
     ricaricamento -- che e' il momento in cui il gioco "ricompariva". */
  LIB.suRipristino(function(){
    ridisponi();
    updateConta();
    if (document.body.classList.contains('elenco')) disegnaMia();
  });
  I18N.suCambio(rilingua);                // quello che disegna il JS lo rifa' il JS
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
    /* MSAA solo dove i pixel sono grossi. Su uno schermo a densita' 2 o
       3 -- cioe' ogni telefono -- il bordo scalettato lo mangia gia' la
       densita', e l'antialiasing costa una passata di risoluzione
       multipla su tutta la scena: e' il conto piu' salato che si possa
       pagare per una cosa che li' non si vede. */
    const denso = (window.devicePixelRatio || 1) >= 2;
    renderer = new THREE.WebGLRenderer({ antialias: !denso, powerPreference: 'high-performance' });
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
  await wait(20); setProg(.28, TP('load.stanza'));
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
  setProg(.40, TP('load.libreria'));
  const lib = await LIB.sync();
  await LIB.caricaLibrerie();     // i mobili prima delle scatole: decidono dove vanno
  await LIB.caricaGruppi();
  /* Prima di disporre: se i dati sono storti la scena mostrerebbe
     scatole dentro un mobile che non esiste. */
  let rimessi = 0;
  try { rimessi = await riparaPosti(); }
  catch(e){ if (window.console) console.error('riparaPosti:', e); }
  if (rimessi) flash(TP('msg.postiRimessi', {n: rimessi}));
  buildFlatList();
  setProg(.56, TP('load.copertine'));
  await loadCovers();
  /* Le misure vere delle scatole, se il proxy e' acceso. Si chiede
     PRIMA di costruire: dopo vorrebbe dire rifare tutte le scatole.
     Il `ping` ha gia' il suo limite di tempo, quindi su un sito senza
     proxy questa riga costa quattrocento millisecondi e non blocca
     niente. */
  try { if ((await BGG.ping()).su) await caricaMisure(); } catch(e){}
  await wait(20); setProg(.72, TP('load.mensole'));
  applyLibrary({});
  await wait(20); setProg(.92, TP('load.lampada'));
  scaldaShader();

  /* UN AGGANCIO CHE SALTA NON SI PORTA VIA GLI ALTRI.

     Erano dieci chiamate in fila: la prima che lanciava un'eccezione
     lasciava scollegate tutte quelle dopo -- e, peggio di tutto, non si
     arrivava nemmeno a `requestAnimationFrame(frame)`, quindi la scena
     restava ferma sul caricamento.

     Non e' un caso di scuola: succede ogni volta che il browser tiene
     in cache un `index.html` e un `js/app.js` di due versioni diverse
     (vedi la nota sulla cache dell'anteprima). Un pulsante tolto dal
     markup e ancora agganciato dal codice vecchio basta: `q('#x')`
     torna nullo, `addEventListener` esplode, e sparisce il pannello
     della libreria -- che sta nove righe piu' sotto e non c'entra
     niente.

     Ognuno per conto suo, quindi, e chi non si aggancia LO DICE: un
     pezzo di interfaccia muto senza spiegazione e' peggio di un pezzo
     rotto che si lamenta. */
  const mancati = [];
  [['input', bindInput], ['strumenti', bindTools], ['vista', bindVista],
   ['binario', bindRail], ['cuore', bindCuore], ['gruppi', bindPiedeGruppi],
   ['stanza', bindStanza], ['clic fuori', bindClicFuori],
   ['librerie', bindLibrerie], ['etichette', bindGruppi]
  ].forEach(function(x){
    try { x[1](); }
    catch(e){ mancati.push(x[0]); if (window.console) console.error('aggancio "' + x[0] + '" fallito:', e); }
  });
  if (mancati.length) flash(TP('msg.aggancioNo', {n: mancati.join(', ')}));

  setSort(state.sort);
  requestAnimationFrame(frame);
  setProg(1, 'ci siamo');

  await wait(Math.max(0, 1400 - (performance.now() - t0)));
  document.body.classList.add('ready');
  /* `state.sezione` nasce a 'collezione', ma la CLASSE sul body la
     mette solo `setSezione`, e sul percorso normale non la chiamava
     nessuno: `body.sez-collezione` compariva al primo clic sulla
     navigazione, e fino a quel momento tutte le regole che ci
     dipendono erano inerti -- la testata cambiava velo da sola appena
     toccavi una voce. Lo stato e la classe partono d'accordo. */
  setSezione('collezione');
  intro();
  disegnaProfilo();

  // Primo accesso: il nick prima di tutto. La scena intanto ha finito
  // di caricare dietro, cosi' chi lo sceglie trova gia' la libreria.
  if (PROFILO.serveNick()) apriNick(false);

  /* Le copertine che non vengono da BGG. Fuori dal caricamento
     apposta: vedi il commento lungo di `riparaCopertine`. Non si
     aspetta -- il sito e' gia' in piedi e usabile -- e quando ha
     finito rifa' le scatole toccate e lo dice, perche' un'immagine
     che cambia da sola senza spiegazione e' peggio di una sbagliata. */
  riparaCopertine().then(function(ids){
    if (!ids.length) return null;
    return loadCovers(true)
      .then(caricaMisure)          // la scatola nuova puo' avere altre misure
      .then(function(){
        rifaiScatole(ids);
        applyLibrary({ animate: true });
        flash(TP('msg.copertineRiprese', {n: ids.length}));
      });
  }).catch(function(e){ if (window.console) console.error('riparaCopertine:', e); });

  // Un armadio vuoto non e' un guasto: e' una collezione appena nata, e
  // va detto, se no sembra che il sito non abbia caricato niente.
  if (lib.vuota){
    flash(TP('msg.collezioneVuota'));
  } else if (AUTH.attivo() && lib.dentro !== false && !lib.remota){
    flash(TP('msg.collezioneOff'));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
