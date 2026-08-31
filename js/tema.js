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
   - la STANZA. Legno, muro, pavimento e faretti sono scelte di chi ci
     abita, stanno sul suo profilo e un amico che viene a trovarlo le
     vede com'erano. La tavolozza veste il sito, non arreda casa
     d'altri.

   Sta nel `<head>` apposta, e non in fondo al body con gli altri: le
   variabili vanno scritte PRIMA che la pagina si dipinga, se no si
   vede il sito partire di un colore e cambiare un attimo dopo.
   =============================================================== */
const TEMA = (function(){

const CHIAVE = 'dado-tavolozza';

/* Otto tinte per tavolozza, nello stesso ordine e con lo stesso
   mestiere: chi ne aggiunge una riempie queste otto e basta. */
const TAVOLOZZE = [
  {
    v: 'stanza', n: 'tema.stanza',
    c: { bg:'#cfccc8', card:'#f2f1ed', ink:'#33352b', inkSoft:'#747760',
         sage:'#a6a89c', sand:'#c7af98', wood:'#8e6a4b', accent:'#c86a3c',
         woodDark:'#5c4530' }
  },
  {
    /* Vaporwave. Non la versione notturna al neon -- questo sito e'
       fatto di superfici chiare, e rovesciarlo vorrebbe dire riscrivere
       ogni regola che da' per scontata la carta sotto il testo. E'
       l'altra meta' del vaporwave, quella pastello: lilla, magenta e
       ciano. Il magenta e' scurito quanto basta perche' la scritta
       sopra si legga: un accento e' anche un fondo per del testo. */
    v: 'vaporwave', n: 'tema.vaporwave',
    c: { bg:'#d6cde6', card:'#f7f1fb', ink:'#2c2040', inkSoft:'#6a5788',
         sage:'#9fc2d6', sand:'#e6b4d2', wood:'#7350a6', accent:'#bf2f80',
         woodDark:'#4b346c' }
  },
  {
    /* Bosco. La tavolozza di partenza guarda al legno; questa guarda a
       quello che c'era prima del legno. */
    v: 'bosco', n: 'tema.bosco',
    c: { bg:'#d1d6cb', card:'#f1f4ed', ink:'#222e1e', inkSoft:'#586551',
         sage:'#9aab93', sand:'#c9bd9a', wood:'#6d583d', accent:'#2f6b43',
         woodDark:'#473928' }
  },
  {
    /* Carta e china. Tutta l'altra meta' del cerchio: dove la stanza e'
       calda questa e' fredda, e l'accento e' un blu da penna invece di
       una terracotta. */
    v: 'china', n: 'tema.china',
    c: { bg:'#ced2d7', card:'#f3f5f7', ink:'#1f242b', inkSoft:'#5c6570',
         sage:'#a2acb6', sand:'#b8c1cb', wood:'#4c5967', accent:'#2a63c4',
         woodDark:'#313a43' }
  }
];

let ora = leggi();
const iscritti = [];

function leggi(){
  try {
    const v = localStorage.getItem(CHIAVE);
    return TAVOLOZZE.some(function(t){ return t.v === v; }) ? v : TAVOLOZZE[0].v;
  } catch (e) { return TAVOLOZZE[0].v; }
}

function quale(v){
  for (let i = 0; i < TAVOLOZZE.length; i++) if (TAVOLOZZE[i].v === v) return TAVOLOZZE[i];
  return TAVOLOZZE[0];
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
function mescola(a, b, p){
  const x = rgb(a), y = rgb(b);
  return esa([0,1,2].map(function(i){ return x[i] + (y[i] - x[i]) * p; }));
}

/* --- applicare --------------------------------------------------- */

function applica(){
  const t = quale(ora);
  const c = t.c;
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
  s.setProperty('--shadow', '0 18px 44px rgba(' + inkT + ',.14)');
  s.setProperty('--ombra-lieve',
    '0 1px 2px rgba(' + inkT + ',.08), 0 4px 12px rgba(' + inkT + ',.06)');

  /* La barra del browser sui telefoni: e' la prima cosa che si vede
     accanto al sito, e lasciata indietro stona piu' di qualunque
     dettaglio dentro la pagina. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', c.bg);

  r.setAttribute('data-tema', ora);
  iscritti.forEach(function(f){ try { f(t); } catch (e) {} });
}

function scegli(v){
  if (!TAVOLOZZE.some(function(t){ return t.v === v; })) return;
  ora = v;
  try { localStorage.setItem(CHIAVE, v); } catch (e) {}
  applica();
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

function striscia(c){
  const s = document.createElement('span');
  s.className = 'tav-mostra';
  s.setAttribute('aria-hidden', 'true');
  ['bg','card','ink','inkSoft','sage','sand','wood','accent'].forEach(function(k){
    const i = document.createElement('i');
    i.style.background = c[k];
    s.appendChild(i);
  });
  return s;
}

function disegnaSelettore(){
  const lista = document.getElementById('pro-tema-lista');
  if (!lista) return;
  const t = quale(ora);

  const ora_n = document.getElementById('pro-tema-ora');
  if (ora_n) ora_n.textContent = nome(t.n);
  const mostra = document.getElementById('pro-tema-mostra');
  if (mostra){ mostra.innerHTML = ''; mostra.appendChild(striscia(t.c)); }

  lista.innerHTML = '';
  TAVOLOZZE.forEach(function(x){
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-tav', x.v);
    b.setAttribute('aria-pressed', x.v === ora ? 'true' : 'false');
    const n = document.createElement('span');
    n.className = 'tav-nome';
    n.textContent = nome(x.n);
    b.appendChild(n);
    b.appendChild(striscia(x.c));
    lista.appendChild(b);
  });
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
    if (b) scegli(b.getAttribute('data-tav'));
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
function ruolo(nome){
  const c = quale(ora).c;
  /* Il legno scuro e' SCRITTO, non scalato. Una scalatura del noce da'
     un colore vicinissimo ma non quello: il `#5c4530` di sempre non e'
     una percentuale del `#8e6a4b`, e' una tinta scelta. Derivarlo
     vorrebbe dire che chi non cambia tavolozza si vede lo scaffale
     spostarsi di un paio di unita' -- invisibile, ma per niente. */
  if (nome === 'legnoScuro') return c.woodDark || scala(c.wood, -.35);
  return c[nome] || c.accent;
}

return {
  TAVOLOZZE: TAVOLOZZE, ruolo: ruolo,
  corrente: function(){ return ora; },
  tinte: function(){ return quale(ora).c; },
  scegli: scegli, suCambio: suCambio
};
})();
