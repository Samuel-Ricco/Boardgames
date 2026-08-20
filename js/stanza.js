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
  scaffali: '#8e6a4b',
  muro: '#cfccc8',
  pavimento: '#c7af98',
  arredo: 'misto'
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
const LEGNI = [
  { v: '#8e6a4b', n: 'noce' },
  { v: '#5c4530', n: 'noce scuro' },
  { v: '#747760', n: 'oliva' },
  { v: '#a6a89c', n: 'salvia' },
  { v: '#c7af98', n: 'sabbia' },
  { v: '#c86a3c', n: 'terracotta' }
];

/* Le prime tinte erano tutte a mezzo passo dal bianco: sul muro, sotto
   una luce diffusa, si leggevano tutte uguali. Adesso hanno un colore
   vero -- restano intonaci, non fluorescenze, ma si distinguono. */
const MURI = [
  { v: '#cfccc8', n: 'grigio caldo' },
  { v: '#c7af98', n: 'sabbia' },
  { v: '#a6a89c', n: 'salvia' },
  { v: '#747760', n: 'oliva' },
  { v: '#c86a3c', n: 'terracotta' },
  { v: '#33352b', n: 'oliva scuro' }
];

const PAVIMENTI = [
  { v: '#c7af98', n: 'sabbia' },
  { v: '#cfccc8', n: 'cemento chiaro' },
  { v: '#a6a89c', n: 'salvia' },
  { v: '#8e6a4b', n: 'noce' },
  { v: '#747760', n: 'oliva' },
  { v: '#c86a3c', n: 'cotto' }
];

/* I cinque arredi, piu' il misto di prima e il niente. "Niente" non e'
   un ripiego: uno scaffale con dei vuoti veri e' una scelta di stile,
   e chi lascia i buchi apposta non vuole che glieli riempiamo noi. */
const ARREDI = [
  { v: 'libri',   n: 'libri' },
  { v: 'giochi',  n: 'scatole' },
  { v: 'dadi',    n: 'dadi e meeple' },
  { v: 'piante',  n: 'piante' },
  { v: 'cornici', n: 'cornici' },
  { v: 'misto',   n: 'un po\' di tutto' },
  { v: 'niente',  n: 'niente' }
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
  const dentro = function(lista, v, d){
    return lista.some(function(x){ return x.v === v; }) ? v : d;
  };
  o.scaffali  = dentro(LEGNI,     o.scaffali,  DEFAULT.scaffali);
  o.muro      = dentro(MURI,      o.muro,      DEFAULT.muro);
  o.pavimento = dentro(PAVIMENTI, o.pavimento, DEFAULT.pavimento);
  o.arredo    = dentro(ARREDI,    o.arredo,    DEFAULT.arredo);
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
      throw new Error('manca la migrazione stanza_librerie_gruppi');
    }
    throw r.error;
  }
  const p = PROFILO.mio();
  if (p) p.stanza = ora;
}

function aiValori(){ return { LEGNI: LEGNI, MURI: MURI, PAVIMENTI: PAVIMENTI, ARREDI: ARREDI }; }

return {
  DEFAULT: DEFAULT, LEGNI: LEGNI, MURI: MURI, PAVIMENTI: PAVIMENTI, ARREDI: ARREDI,
  LUCE_MIN: LUCE_MIN, LUCE_MAX: LUCE_MAX,
  corrente: corrente, miaStanza: miaStanza, normalizza: normalizza,
  daProfilo: daProfilo, daAltri: daAltri, cambia: cambia, salva: salva,
  tavolozze: aiValori
};
})();
