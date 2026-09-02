/* ===============================================================
   LE TAVOLOZZE

   Il sito ha sempre avuto SEI TINTE E BASTA, e quella disciplina non
   cambia: cambia quali sono le sei. Una tavolozza e' un ricambio
   completo -- fondo, scheda, inchiostro, le due tinte quiete, il legno
   e l'accento -- e tutto il resto si DERIVA, come `--ink` si derivava
   gia' dall'oliva.

   Derivare invece di elencare non e' pigrizia: i fili, le ombre e il
   velo della testata sono l'inchiostro e la carta a percentuali
   diverse, e se una tavolozza dovesse dichiararli a mano prima o poi
   uno resterebbe indietro e si vedrebbe un'ombra verde su un fondo
   lilla.

   COSA NON CAMBIA:

   - il ROSSO di quello che distrugge. Non e' decorazione, e' un
     segnale, e un rosso "coordinato" con la tavolozza smette di dire
     quello che deve dire.
   - le SCELTE della stanza. Legno, muro, pavimento e faretti stanno sul
     profilo di chi ci abita e non si toccano: quello che cambia con la
     tavolozza e' come vengono DISEGNATE, non quali sono. Sul database
     resta un identificativo -- "il legno" -- e che legno sia lo decide
     la tavolozza.
   - e in casa d'altri decide LA SUA. La tavolozza viaggia dentro
     `profili.stanza`, quindi la libreria di un amico si vede con i
     colori del suo tema: se no sarebbe la tua ridipinta, e il legno che
     ha scelto lui non vorrebbe piu' dire niente. Il sito attorno
     invece resta vestito come piace a te.

   Sta nel `<head>` apposta, e non in fondo al body con gli altri: le
   variabili vanno scritte PRIMA che la pagina si dipinga, se no si
   vede il sito partire di un colore e cambiare un attimo dopo.
   =============================================================== */
const TEMA = (function(){

const CHIAVE = 'dado-tavolozza';     // la base: 'chiaro' o 'scuro'
const CHIAVE_ACC = 'dado-accento';   // l'accento scelto, o vuoto

/* DUE BASI E UN ACCENTO.

   Le tavolozze erano cinque e complete: ognuna cambiava tutte e otto le
   tinte. Erano belle e servivano a poco -- chi apriva quel menu voleva
   due cose, "chiaro o scuro" e "di che colore", e doveva invece
   scegliere fra cinque mondi gia' fatti in cui quelle due domande erano
   impacchettate insieme.

   Adesso la BASE dice solo chiaro o scuro -- e' il fondo, la carta e
   l'inchiostro, cioe' quello che decide se il sito si legge -- e
   l'ACCENTO e' una scelta libera che ci si posa sopra. La stessa
   disciplina di prima resta: otto tinte, e tutto il resto derivato.

   Le tre tavolozze che se ne vanno (vaporwave, bosco, china) non sono
   perse: i loro accenti sono fra i predefiniti qui sotto, ed e' quello
   che di loro si sceglieva davvero. */
const BASI = [
  {
    v: 'chiaro', n: 'tema.chiaro',
    c: { bg:'#cfccc8', card:'#f2f1ed', ink:'#33352b', inkSoft:'#747760',
         sage:'#a6a89c', sand:'#c7af98', wood:'#8e6a4b', accent:'#c86a3c',
         woodDark:'#5c4530' }
  },
  {
    /* Lo scuro non e' il chiaro invertito: e' scelto. `bg` e' la stanza
       -- la piu' scura, perche' e' il fondo su cui tutto poggia -- e
       `card` sono i pannelli, un gradino sopra. Il legno e' schiarito
       quanto basta perche' la carta ci si legga sopra. */
    v: 'scuro', n: 'tema.scuro',
    c: { bg:'#1b1d22', card:'#262a31', ink:'#e8e6e1', inkSoft:'#a4a8b0',
         sage:'#7c8894', sand:'#b09a7c', wood:'#b08c63', accent:'#e08551',
         woodDark:'#6a5238' }
  }
];

/* I predefiniti. Non sono un ripiego per chi non sa usare la ruota:
   sono otto colori che su tutte e due le basi funzionano, e chi non ha
   un colore in mente ne tocca uno e ha finito. Il rosso non c'e' e non
   ci sara': non e' decorazione, e' il segnale di quello che distrugge,
   e un accento rosso lo renderebbe muto. */
const ACCENTI = [
  '#c86a3c', '#2f6b43', '#2a63c4', '#7350a6',
  '#0f7d86', '#bf2f80', '#a8791b', '#4a6b8a'
];

const ESA = /^#[0-9a-fA-F]{6}$/;
const iscritti = [];

/* Le vecchie tavolozze non si buttano via: si traducono. Chi aveva
   `notte` si ritrova la base scura; chi aveva bosco, china o vaporwave
   si ritrova il chiaro -- e il loro accento e' fra i predefiniti,
   quindi non e' andato perso, e' diventato una scelta invece che un
   pacchetto. */
const VECCHIE = {
  stanza:    { b: 'chiaro', a: '' },
  vaporwave: { b: 'chiaro', a: '#bf2f80' },
  bosco:     { b: 'chiaro', a: '#2f6b43' },
  china:     { b: 'chiaro', a: '#2a63c4' },
  notte:     { b: 'scuro',  a: '' }
};

let base = leggiBase();
let accento = leggiAccento();

function leggiBase(){
  let v = '';
  try { v = localStorage.getItem(CHIAVE) || ''; } catch (e) {}
  if (BASI.some(function(t){ return t.v === v; })) return v;
  if (VECCHIE[v]) return VECCHIE[v].b;
  return BASI[0].v;
}

function leggiAccento(){
  let v = '', vecchia = '';
  try {
    v = localStorage.getItem(CHIAVE_ACC) || '';
    vecchia = localStorage.getItem(CHIAVE) || '';
  } catch (e) {}
  if (ESA.test(v)) return v.toLowerCase();
  if (VECCHIE[vecchia]) return VECCHIE[vecchia].a;
  return '';
}

function quale(v){
  for (let i = 0; i < BASI.length; i++) if (BASI[i].v === v) return BASI[i];
  return BASI[0];
}

/* Una tavolozza si scrive in una stringa sola -- `scuro~#2f6b43` --
   perche' e' cosi' che viaggia: dentro `profili.stanza.tavolozza`, che
   e' quello che un amico legge per vedere la tua libreria con i tuoi
   colori. Il separatore e' `~` come per le celle degli arredi, e non
   `:` che qui vorrebbe dire un'altra cosa. */
function componi(b, a){ return a ? (b + '~' + a) : b; }

function scomponi(v){
  const t = String(v || '').split('~');
  const b = BASI.some(function(x){ return x.v === t[0]; }) ? t[0]
          : (VECCHIE[t[0]] ? VECCHIE[t[0]].b : null);
  if (!b) return null;
  const a = ESA.test(t[1] || '') ? t[1].toLowerCase()
          : (VECCHIE[t[0]] ? VECCHIE[t[0]].a : '');
  return { base: b, accento: a };
}

/* Le otto tinte gia' risolte: la base, con l'accento al posto del suo.
   Su fondo scuro un accento scelto per il chiaro diventa fango, quindi
   si schiarisce quanto basta -- non e' un vezzo, e' che l'accento fa
   anche da FONDO per del testo, e sotto un certo contrasto quel testo
   non si legge piu'. */
function tinteDi(b, a){
  const t = quale(b);
  if (!a) return t.c;
  const c = Object.assign({}, t.c);
  c.accent = adattaAccento(a, t.c);
  return c;
}

function adattaAccento(a, c){
  const scuroFondo = lum(c.bg) <= .18;
  let v = a;
  /* Su fondo scuro l'accento deve staccarsi dal fondo; su fondo chiaro
     deve reggere la carta scritta sopra. Due vincoli opposti, un conto
     solo: si tira verso il bianco finche' il contrasto con la carta non
     e' quello che serve. */
  const soglia = scuroFondo ? 3.2 : 2.6;
  for (let i = 0; i < 14 && contrasto(v, c.card) < soglia; i++){
    v = scala(v, scuroFondo ? .07 : -.05);
  }
  return v;
}

function contrasto(a, b){
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

/* --- i conti sui colori ---------------------------------------- */

function rgb(hex){
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function esa(r){
  return '#' + r.map(function(v){
    const n = Math.max(0, Math.min(255, Math.round(v)));
    return (n < 16 ? '0' : '') + n.toString(16);
  }).join('');
}
function tri(hex){ return rgb(hex).join(','); }

/* Verso il nero (q negativo) o verso il bianco: serve per l'accento
   premuto e per il velo, che e' la carta un filo tirata verso il fondo. */
function scala(hex, q){
  const c = rgb(hex);
  const verso = q < 0 ? 0 : 255;
  const p = Math.abs(q);
  return esa(c.map(function(v){ return v + (verso - v) * p; }));
}
/* Luminanza relativa, quella vera di WCAG: serve a sapere se una
   tavolozza e' chiara o scura senza doverglielo chiedere. Una
   bandierina nella tavolozza si potrebbe dimenticare; questa no. */
function lum(hex){
  const c = rgb(hex).map(function(v){
    v /= 255;
    return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
  });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}

function mescola(a, b, p){
  const x = rgb(a), y = rgb(b);
  return esa([0,1,2].map(function(i){ return x[i] + (y[i] - x[i]) * p; }));
}

/* --- applicare --------------------------------------------------- */

function applica(){
  const t = quale(base);
  const c = tinteDi(base, accento);
  const r = document.documentElement;
  const s = r.style;
  const inkT = tri(c.ink);

  s.setProperty('--bg', c.bg);
  s.setProperty('--card', c.card);
  s.setProperty('--ink', c.ink);
  s.setProperty('--ink-soft', c.inkSoft);
  s.setProperty('--sage', c.sage);
  s.setProperty('--sand', c.sand);
  s.setProperty('--wood', c.wood);
  s.setProperty('--accent', c.accent);

  /* I tripli: mezzo foglio di stile scrive l'inchiostro e la carta a
     decine di opacita' diverse, e senza questi resterebbero i numeri
     della tavolozza di partenza -- un filo oliva su un fondo lilla. */
  s.setProperty('--ink-rgb', inkT);
  s.setProperty('--card-rgb', tri(c.card));
  s.setProperty('--bg-rgb', tri(c.bg));

  /* Derivate. `--accent-su` e' l'accento premuto; il velo e' la carta
     tirata di un quinto verso il fondo, che e' esattamente quello che
     era la tinta scritta a mano nella testata. */
  s.setProperty('--accent-su', scala(c.accent, -.12));
  /* Il fondo delle schermate piatte: un terzo di strada dalla carta
     verso la stanza. La frazione non e' scelta a caso -- e' quella che
     ridA' esattamente la tinta che c'era scritta a mano prima. */
  s.setProperty('--fondo', mescola(c.card, c.bg, .33));
  const velo = mescola(c.card, c.bg, .22);
  s.setProperty('--velo', 'rgba(' + tri(velo) + ',.82)');
  s.setProperty('--velo-lieve', 'rgba(' + tri(velo) + ',.55)');
  s.setProperty('--velo-pieno', 'rgba(' + tri(velo) + ',.94)');
  s.setProperty('--line', 'rgba(' + inkT + ',.14)');

  /* LE OMBRE NON SONO L'INCHIOSTRO: SONO IL BUIO.

     Finche' le tavolozze sono state tutte chiare le due cose
     coincidevano, e derivare l'ombra dall'inchiostro era la scorciatoia
     giusta. Su una tavolozza scura no: l'inchiostro e' chiaro, e
     un'ombra chiara e' un alone -- ogni pannello del sito sarebbe
     sembrato retroilluminato.

     Quindi l'ombra si prende dal fondo: e' l'inchiostro finche' il
     fondo e' chiaro, ed e' il nero quando e' scuro. E su scuro serve
     PIU' opaca, perche' un'ombra nera su un fondo gia' nero non si
     vede: quello che stacca un pannello dal fondo li' non e' l'ombra,
     e' il gradino di chiarezza fra `card` e `bg` -- l'ombra serve solo
     a dargli spessore.

     `--line` invece resta l'inchiostro, ed e' giusto: un filo e' un
     segno, e su fondo scuro un segno si fa chiaro. */
  const chiaro = lum(c.bg) > .18;
  const ombT = chiaro ? inkT : '0,0,0';
  const f = chiaro ? 1 : 2.2;
  s.setProperty('--shadow', '0 18px 44px rgba(' + ombT + ',' + (.14 * f).toFixed(3) + ')');
  s.setProperty('--ombra-lieve',
    '0 1px 2px rgba(' + ombT + ',' + (.08 * f).toFixed(3) + '), ' +
    '0 4px 12px rgba(' + ombT + ',' + (.06 * f).toFixed(3) + ')');

  /* La barra del browser sui telefoni: e' la prima cosa che si vede
     accanto al sito, e lasciata indietro stona piu' di qualunque
     dettaglio dentro la pagina. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', c.bg);

  r.setAttribute('data-tema', base);
  iscritti.forEach(function(f){ try { f({ v: base, n: t.n, c: c }); } catch (e) {} });
}

function scegli(v){
  /* Accetta anche la forma composta e le tavolozze vecchie: e' quello
     che arriva da `profili.stanza.tavolozza`. */
  const q = scomponi(v);
  if (!q) return;
  base = q.base;
  if (q.accento) accento = q.accento;
  salva();
  applica();
}

function scegliAccento(v){
  accento = ESA.test(v || '') ? String(v).toLowerCase() : '';
  salva();
  applica();
}

function salva(){
  try {
    localStorage.setItem(CHIAVE, base);
    localStorage.setItem(CHIAVE_ACC, accento);
  } catch (e) {}
}

/* Chi ha gia' disegnato qualcosa con un colore in mano -- la scena 3D,
   i canvas -- si iscrive e si rimette in pari da se'. E' lo stesso
   gancio di `I18N.suCambio`. */
function suCambio(f){ if (typeof f === 'function') iscritti.push(f); }

/* IL SELETTORE SE LO MONTA QUESTO FILE, come fa `js/i18n.js` con quello
   della lingua. Non e' simmetria per il gusto della simmetria: se un
   giorno `app.js` non si aggancia -- ed e' successo -- la tavolozza
   deve restare cambiabile lo stesso.

   Il nome passa da `T()` se c'e', ma questo file gira PRIMA di i18n
   (sta nel `<head>`), quindi si legge al momento di disegnare e non
   prima. Chi tiene una parola se la tiene per sempre. */
function nome(chiave){
  return (typeof T === 'function') ? T(chiave) : chiave;
}

/* IL SELETTORE. Due domande, in quest'ordine: chiaro o scuro -- che e'
   quella che decide se il sito si legge -- e poi di che colore.

   I predefiniti stanno in fila e la RUOTA e' l'ultima, come nel
   pannello della libreria: la stessa forma per la stessa scelta, e chi
   ha capito una volta ha capito. */
function bollino(hex, scelto){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tav-acc' + (scelto ? ' on' : '');
  b.setAttribute('data-acc', hex);
  b.style.background = hex;
  b.setAttribute('aria-pressed', scelto ? 'true' : 'false');
  return b;
}

function disegnaSelettore(){
  const lista = document.getElementById('pro-tema-lista');
  if (!lista) return;
  const t = quale(base);
  const c = tinteDi(base, accento);

  const ora_n = document.getElementById('pro-tema-ora');
  if (ora_n) ora_n.textContent = nome(t.n);
  const mostra = document.getElementById('pro-tema-mostra');
  if (mostra){
    mostra.innerHTML = '';
    const i = document.createElement('i');
    i.style.background = c.accent;
    mostra.appendChild(i);
  }

  lista.innerHTML = '';

  // le due basi
  const basi = document.createElement('div');
  basi.className = 'tav-basi';
  BASI.forEach(function(x){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tav-base' + (x.v === base ? ' on' : '');
    b.setAttribute('data-tav', x.v);
    b.setAttribute('aria-pressed', x.v === base ? 'true' : 'false');
    const p = document.createElement('span');
    p.className = 'tav-prova';
    p.style.background = x.c.bg;
    p.style.color = x.c.ink;
    p.textContent = 'Aa';
    b.appendChild(p);
    const n = document.createElement('span');
    n.className = 'tav-nome';
    n.textContent = nome(x.n);
    b.appendChild(n);
    basi.appendChild(b);
  });
  lista.appendChild(basi);

  // l'accento: i predefiniti, poi la ruota
  const acc = document.createElement('div');
  acc.className = 'tav-accenti';
  const suo = accento || quale(base).c.accent;
  ACCENTI.forEach(function(hex){
    acc.appendChild(bollino(hex, accento === hex));
  });
  const r = document.createElement('input');
  r.type = 'color';
  r.className = 'ruota' + (accento && ACCENTI.indexOf(accento) < 0 ? ' on' : '');
  r.value = suo;
  r.setAttribute('data-acc-ruota', '1');
  const tit = (typeof T === 'function') ? T('stanza.ruota') : 'colore';
  r.title = tit; r.setAttribute('aria-label', tit);
  acc.appendChild(r);
  lista.appendChild(acc);
}

function montaSelettore(){
  const lista = document.getElementById('pro-tema-lista');
  if (!lista) return;
  disegnaSelettore();
  /* Un ascoltatore solo sull'elenco: i pulsanti si rifanno a ogni
     scelta, e attaccarne uno per voce vorrebbe dire rimetterli tutti
     ogni volta. */
  lista.addEventListener('click', function(e){
    const b = e.target.closest('button[data-tav]');
    if (b){ scegli(b.getAttribute('data-tav')); return; }
    const a = e.target.closest('button[data-acc]');
    if (a) scegliAccento(a.getAttribute('data-acc'));
  });
  /* La ruota manda `input` mentre si trascina: qui si vuole vedere il
     sito cambiare colore sotto il cursore, non dopo. E' la stessa
     scelta del meeple, e per lo stesso motivo -- qui non si scrive
     niente sul database, si riscrivono delle variabili CSS. */
  lista.addEventListener('input', function(e){
    const r = e.target.closest('input[data-acc-ruota]');
    if (r) scegliAccento(r.value);
  });
  if (typeof I18N !== 'undefined' && I18N.suCambio) I18N.suCambio(disegnaSelettore);
}

suCambio(disegnaSelettore);
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', montaSelettore);
else montaSelettore();

applica();

/* IL COLORE DI UN RUOLO, per chi non e' un foglio di stile.

   Le tavolozze della STANZA -- legni, muri, pavimenti, colore del nome
   -- non sono mai state altro che le sei tinte del sito messe in un
   altro ordine: il noce e' `wood`, l'oliva e' `inkSoft`, il cotto e'
   `accent`. Scritte a mano restavano quelle di partenza qualunque
   tavolozza si scegliesse, e nel pannello si finiva a scegliere un
   marrone caldo per una stanza lilla.

   `legnoScuro` e' l'unico ruolo derivato, ed e' lo stesso conto che
   dava il `#5c4530` scritto a mano: il legno tirato al buio di un
   terzo abbondante. */
function ruolo(nome, tavolozza){
  /* La tavolozza si puo' chiedere: serve a disegnare la stanza di un
     amico con la SUA, che e' l'unica cosa che rende quella libreria la
     sua invece di una copia della tua ridipinta. */
  const q = tavolozza ? scomponi(tavolozza) : null;
  const c = q ? tinteDi(q.base, q.accento) : tinteDi(base, accento);
  /* Il legno scuro e' SCRITTO, non scalato. Una scalatura del noce da'
     un colore vicinissimo ma non quello: il `#5c4530` di sempre non e'
     una percentuale del `#8e6a4b`, e' una tinta scelta. Derivarlo
     vorrebbe dire che chi non cambia tavolozza si vede lo scaffale
     spostarsi di un paio di unita' -- invisibile, ma per niente. */
  if (nome === 'legnoScuro') return c.woodDark || scala(c.wood, -.35);
  return c[nome] || c.accent;
}

return {
  BASI: BASI, ACCENTI: ACCENTI, ruolo: ruolo,
  /* `corrente()` torna la forma composta: e' quella che si salva, ed e'
     quella che un amico legge. */
  corrente: function(){ return componi(base, accento); },
  base: function(){ return base; },
  accento: function(){ return accento; },
  esiste: function(v){ return !!scomponi(v); },
  tinte: function(){ return tinteDi(base, accento); },
  scegli: scegli, scegliAccento: scegliAccento, suCambio: suCambio
};
})();
