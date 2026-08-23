/* ============================================================
   La stanza: luce, colori, arredi.

   Sta nel profilo e non in `localStorage` per due motivi: te la porti
   da un dispositivo all'altro, e un amico che viene a guardare la tua
   libreria la vede com'e' da te. Una stanza arredata e' una cosa che
   si mostra.

   Qui dentro ci sono solo i VALORI e le tavolozze. Chi li traduce in
   luci e materiali e' `app.js`: questo file non sa niente di three.js,
   e cosi' si puo' leggere la stanza anche senza WebGL.

   Le tavolozze sono chiuse apposta. Un selettore di colore libero
   avrebbe dato scaffali fucsia su muri verde acido: sono sei tinte per
   superficie, scelte per stare insieme, e ognuna e' un legno o un
   intonaco che esiste davvero.
   ============================================================ */
const STANZA = (function(){
'use strict';

/* --- i valori di partenza: la stanza com'era prima di poterla
       cambiare, cosi' chi non tocca niente non vede niente cambiare */
const DEFAULT = {
  luce: 1,
  /* I faretti dentro la libreria. Sono una cosa diversa dalla luce
     della stanza, e apposta: quella si abbassa fino a spegnere il
     muro, questi restano dove sono. E' quello che succede in casa la
     sera -- si spegne il lampadario e la libreria resta accesa da
     dentro. A luce piena non si notano quasi, come i faretti veri a
     mezzogiorno. */
  faretti: 0.4,
  fariTinta: '#ffb877',
  scaffali: '#8e6a4b',
  muro: '#cfccc8',
  pavimento: '#c7af98',
  arredo: 'misto',
  nome: '#33352b'
};

/* I legni tirati verso l'oliva. Un mobile scuro contro una parete
   color crema e' l'immagine che il sito vuole dare, e il rovere
   sbiancato di prima -- chiaro su chiaro -- la annullava: la libreria
   spariva nel muro invece di stagliarcisi contro. Restano essenze
   vere, e chi vuole il chiaro ce l'ha ancora. */
/* Le tinte vengono dalla tavolozza del sito, non da un campionario di
   essenze: sono le stesse sei che stanno nel CSS, piu' due gradazioni
   dello stesso marrone. Un mobile di un colore che non esiste da
   nessun'altra parte del sito era meta' del problema. */
/* `n` non e' la parola ma la CHIAVE del dizionario: la tavolozza si
   traduce quando viene disegnata, non quando viene dichiarata, cosi'
   cambiando lingua col pannello aperto le pastiglie cambiano insieme al
   resto. Questo file non sa niente di three.js, e ora nemmeno di
   italiano. */
const LEGNI = [
  { v: '#8e6a4b', n: 'tinta.noce' },
  { v: '#5c4530', n: 'tinta.noceScuro' },
  { v: '#747760', n: 'tinta.oliva' },
  { v: '#a6a89c', n: 'tinta.salvia' },
  { v: '#c7af98', n: 'tinta.sabbia' },
  { v: '#c86a3c', n: 'tinta.terracotta' }
];

/* Le prime tinte erano tutte a mezzo passo dal bianco: sul muro, sotto
   una luce diffusa, si leggevano tutte uguali. Adesso hanno un colore
   vero -- restano intonaci, non fluorescenze, ma si distinguono. */
const MURI = [
  { v: '#cfccc8', n: 'tinta.grigioCaldo' },
  { v: '#c7af98', n: 'tinta.sabbia' },
  { v: '#a6a89c', n: 'tinta.salvia' },
  { v: '#747760', n: 'tinta.oliva' },
  { v: '#c86a3c', n: 'tinta.terracotta' },
  { v: '#33352b', n: 'tinta.olivaScuro' }
];

/* Il colore del NOME della libreria, quello scritto sulla parete.
   E' una scelta della stanza e non del singolo mobile: due nomi di
   colore diverso sulla stessa parete si leggerebbero come due cose che
   non c'entrano fra loro.

   La tavolozza qui non serve a decorare, serve a farsi leggere: ci sono
   il molto scuro e il molto chiaro ai due capi -- che sono quelli che
   rispondono ai muri estremi -- e in mezzo le tinte del sito. */
const NOMI = [
  { v: '#33352b', n: 'tinta.olivaScuro' },
  { v: '#f2f1ed', n: 'tinta.carta' },
  { v: '#c86a3c', n: 'tinta.terracotta' },
  { v: '#8e6a4b', n: 'tinta.noce' },
  { v: '#c7af98', n: 'tinta.sabbia' },
  { v: '#747760', n: 'tinta.oliva' }
];

/* Il COLORE dei faretti. Una lampadina non e' un intonaco: qui la
   tavolozza non sono le sei tinte del sito ma le temperature che una
   luce puo' davvero avere -- dal calduccio della sera al bianco da
   vetrina, piu' l'azzurro che nelle vetrine si vede davvero e la
   terracotta, che e' il colore di casa. Restano sei, e restano
   chiuse: un selettore libero qui dava scaffali al neon fucsia. */
const FARI = [
  { v: '#ffb877', n: 'tinta.caldo' },
  { v: '#ff8a3d', n: 'tinta.ambra' },
  { v: '#fff1dc', n: 'tinta.biancoCaldo' },
  { v: '#e6eeff', n: 'tinta.biancoFreddo' },
  { v: '#a9c8ff', n: 'tinta.azzurro' },
  { v: '#c86a3c', n: 'tinta.terracotta' }
];

const PAVIMENTI = [
  { v: '#c7af98', n: 'tinta.sabbia' },
  { v: '#cfccc8', n: 'tinta.cementoChiaro' },
  { v: '#a6a89c', n: 'tinta.salvia' },
  { v: '#8e6a4b', n: 'tinta.noce' },
  { v: '#747760', n: 'tinta.oliva' },
  { v: '#c86a3c', n: 'tinta.cotto' }
];

/* I cinque arredi, piu' il misto di prima e il niente. "Niente" non e'
   un ripiego: uno scaffale con dei vuoti veri e' una scelta di stile,
   e chi lascia i buchi apposta non vuole che glieli riempiamo noi. */
const ARREDI = [
  { v: 'libri',   n: 'arredo.libri' },
  { v: 'giochi',  n: 'arredo.scatole' },
  { v: 'dadi',    n: 'arredo.dadi' },
  { v: 'piante',  n: 'arredo.piante' },
  { v: 'cornici', n: 'arredo.cornici' },
  { v: 'misto',   n: 'arredo.misto' },
  { v: 'niente',  n: 'arredo.niente' }
];

/* Il minimo era 0.35 e non era buio: era una stanza un po' meno
   accesa. La sera vera arriva molto piu' giu', e il salto fra 0.08 e
   1.6 e' abbastanza ampio da far sembrare due stanze diverse la stessa
   stanza. */
const LUCE_MIN = 0.08;
const LUCE_MAX = 1.60;

let ora = Object.assign({}, DEFAULT);
let miei = true;              // stiamo guardando la propria stanza?

function normalizza(s){
  const o = Object.assign({}, DEFAULT, s || {});
  o.luce = Math.max(LUCE_MIN, Math.min(LUCE_MAX, parseFloat(o.luce) || 1));
  /* Zero e' un valore vero -- "spenti" -- quindi non si puo' usare
     `|| DEFAULT`: si controlla che sia un numero, non che sia diverso
     da zero. E' lo stesso inciampo dei punti di una partita. */
  const f = parseFloat(o.faretti);
  o.faretti = Math.max(0, Math.min(1, isFinite(f) ? f : DEFAULT.faretti));
  const dentro = function(lista, v, d){
    return lista.some(function(x){ return x.v === v; }) ? v : d;
  };
  o.scaffali  = dentro(LEGNI,     o.scaffali,  DEFAULT.scaffali);
  o.muro      = dentro(MURI,      o.muro,      DEFAULT.muro);
  o.pavimento = dentro(PAVIMENTI, o.pavimento, DEFAULT.pavimento);
  o.arredo    = dentro(ARREDI,    o.arredo,    DEFAULT.arredo);
  o.nome      = dentro(NOMI,      o.nome,      DEFAULT.nome);
  o.fariTinta = dentro(FARI,      o.fariTinta, DEFAULT.fariTinta);
  return o;
}

function corrente(){ return ora; }
function miaStanza(){ return miei; }

// la propria, dal profilo gia' caricato
function daProfilo(){
  const p = (typeof PROFILO !== 'undefined') ? PROFILO.mio() : null;
  ora = normalizza(p && p.stanza);
  miei = true;
  return ora;
}

/* Quella di un amico. Arriva insieme al suo profilo: la colonna
   `stanza` e' fra quelle che gli amici possono leggere. */
function daAltri(stanza){
  ora = normalizza(stanza);
  miei = false;
  return ora;
}

function cambia(patch){
  if (!miei) return ora;              // in casa d'altri non si sposta niente
  ora = normalizza(Object.assign({}, ora, patch));
  return ora;
}

async function salva(){
  if (!miei) return;
  const c = (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
  if (!c || !AUTH.stato().dentro) return;
  const r = await c.from('profili').update({ stanza: ora }).eq('id', AUTH.stato().id);
  if (r.error){
    // 42703 / PGRST204: la colonna non c'e' ancora. Il messaggio di
    // PostgREST e' in inglese e parla di schema cache: qui serve sapere
    // quale migrazione manca, non come si chiama la cache.
    if (r.error.code === '42703' || r.error.code === 'PGRST204' ||
        /stanza/.test(r.error.message || '')){
      throw new Error(TP('err.stanzaMigr'));
    }
    throw r.error;
  }
  const p = PROFILO.mio();
  if (p) p.stanza = ora;
}

function aiValori(){ return { LEGNI: LEGNI, MURI: MURI, PAVIMENTI: PAVIMENTI, ARREDI: ARREDI, NOMI: NOMI, FARI: FARI }; }

return {
  DEFAULT: DEFAULT, LEGNI: LEGNI, MURI: MURI, PAVIMENTI: PAVIMENTI, ARREDI: ARREDI, NOMI: NOMI,
  FARI: FARI,
  LUCE_MIN: LUCE_MIN, LUCE_MAX: LUCE_MAX,
  corrente: corrente, miaStanza: miaStanza, normalizza: normalizza,
  daProfilo: daProfilo, daAltri: daAltri, cambia: cambia, salva: salva,
  tavolozze: aiValori
};
})();
