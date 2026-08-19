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
  scaffali: '#c9b085',
  muro: '#e9e2d7',
  pavimento: '#cbbba4',
  arredo: 'misto'
};

const LEGNI = [
  { v: '#c9b085', n: 'rovere chiaro' },
  { v: '#ddc9a3', n: 'betulla' },
  { v: '#a8713c', n: 'ciliegio' },
  { v: '#8a6642', n: 'noce' },
  { v: '#5a4636', n: 'wenge' },
  { v: '#e6e0d6', n: 'laccato' }
];

const MURI = [
  { v: '#e9e2d7', n: 'calce' },
  { v: '#e8dcc9', n: 'sabbia' },
  { v: '#d8ded8', n: 'salvia' },
  { v: '#cfd7dd', n: 'cenere azzurra' },
  { v: '#dcd6e4', n: 'glicine' },
  { v: '#3b3531', n: 'notte' }
];

const PAVIMENTI = [
  { v: '#cbbba4', n: 'rovere sbiancato' },
  { v: '#b9a689', n: 'castagno' },
  { v: '#8d6f4e', n: 'parquet scuro' },
  { v: '#c9c4bc', n: 'cemento' },
  { v: '#9aa39a', n: 'verde scuro' },
  { v: '#6e5544', n: 'cotto' }
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

let ora = Object.assign({}, DEFAULT);
let miei = true;              // stiamo guardando la propria stanza?

function normalizza(s){
  const o = Object.assign({}, DEFAULT, s || {});
  o.luce = Math.max(0.35, Math.min(1.5, parseFloat(o.luce) || 1));
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
  corrente: corrente, miaStanza: miaStanza, normalizza: normalizza,
  daProfilo: daProfilo, daAltri: daAltri, cambia: cambia, salva: salva,
  tavolozze: aiValori
};
})();
