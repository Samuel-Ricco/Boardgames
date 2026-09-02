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
  nome: '#33352b',
  /* L'ARREDO DELLA SINGOLA CELLA.

     `arredo` vale per tutto il mobile; qui c'e' quello che si e'
     scelto per un cubo solo, e solo per quelli scelti davvero -- una
     chiave assente vuol dire "come dice la libreria", che e' il caso
     normale e non va scritto da nessuna parte.

     La chiave e' `<id della libreria>:<posto>` e NON `<indice>:<posto>`:
     le librerie si riordinano trascinandole, e un indice porterebbe
     l'arredo di una cella addosso a un altro mobile.

     Sta nella stanza e non su `librerie` perche' la stanza e' un jsonb
     e quindi non chiede una migrazione. E' l'unico motivo, e vale la
     pena saperlo: se un giorno le celle diventano una colonna loro,
     questo posto e' quello da svuotare. */
  celle: {}
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
  { v: '#c86a3c', n: 'tinta.terracotta' },
  /* E i neon. Sono l'unica cosa del sito che esce dalla tavolozza, ed
     e' giusto cosi': un LED sotto un ripiano non e' un intonaco e non
     deve andare d'accordo col muro -- deve staccarsene. Sono anche
     l'unico posto in cui una tinta satura non stona, perche' non
     colora una superficie: e' luce, e a luce di stanza piena si vede
     appena. */
  { v: '#ff2f9e', n: 'tinta.neonRosa' },
  { v: '#a24bff', n: 'tinta.neonViola' },
  { v: '#2ee6ff', n: 'tinta.neonCiano' },
  { v: '#39ff88', n: 'tinta.neonVerde' },
  { v: '#ffe93c', n: 'tinta.neonGiallo' },
  { v: '#3b6cff', n: 'tinta.neonBlu' }
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
  { v: 'dadi',    n: 'arredo.dadi' },
  { v: 'piante',  n: 'arredo.piante' },
  { v: 'misto',   n: 'arredo.misto' },
  { v: 'niente',  n: 'arredo.niente' }
];

/* Il minimo era 0.35 e non era buio: era una stanza un po' meno
   accesa. La sera vera arriva molto piu' giu', e il salto fra 0.08 e
   1.6 e' abbastanza ampio da far sembrare due stanze diverse la stessa
   stanza. */
const LUCE_MIN = 0.08;
const LUCE_MAX = 1.60;

/* Quello che una cella puo' essere: i tre arredi, piu' il vuoto
   voluto. Non c'e' `misto` -- una cella sola non ha niente da
   mescolare -- e non c'e' "come la libreria", che si dice togliendo
   la chiave invece di scrivercene una. */
const CELLE = ['libri', 'dadi', 'piante', 'niente'];

/* LE TAVOLOZZE DELLA STANZA SONO LE SEI TINTE DEL SITO, per ruolo.

   Il noce e' il legno, l'oliva e' l'inchiostro tenue, il cotto e'
   l'accento: le liste qui sopra non sono mai state altro che questo,
   scritto a mano. Da quando le tavolozze si cambiano, scritto a mano
   vuol dire che restano quelle di partenza -- e nel pannello si
   sceglieva un marrone caldo per una stanza lilla.

   QUELLO CHE SI SALVA NON CAMBIA. Il valore memorizzato resta
   l'esadecimale della tavolozza di partenza, che qui fa da IDENTIFICATIVO
   e non da colore: `#8e6a4b` vuol dire "il legno", e che legno sia lo
   decide la tavolozza al momento di disegnare. Cosi' una stanza salvata
   non perde niente cambiando tavolozza, e `normalizza` continua a
   validare sulle stesse liste di sempre.

   I FARETTI NON CI SONO, ed e' voluto: la loro tavolozza non sono le
   sei tinte del sito ma le temperature che una luce puo' davvero avere,
   piu' i neon. La temperatura di una lampadina non e' una scelta
   estetica del sito -- e' fisica -- e un neon deve staccarsi dal muro,
   non andarci d'accordo. */
const RUOLI = {
  scaffali:  ['wood', 'legnoScuro', 'inkSoft', 'sage', 'sand', 'accent'],
  muro:      ['bg', 'sand', 'sage', 'inkSoft', 'accent', 'ink'],
  pavimento: ['sand', 'bg', 'sage', 'wood', 'inkSoft', 'accent'],
  nome:      ['ink', 'card', 'accent', 'wood', 'sand', 'inkSoft']
};
const LISTE = { scaffali: LEGNI, muro: MURI, pavimento: PAVIMENTI, nome: NOMI };

/* Da identificativo salvato a colore da disegnare. Se la tavolozza non
   c'e' -- `tema.js` non caricato -- torna l'identificativo, che e'
   esattamente il colore di sempre: il sito non perde niente. */
/* CON QUALE TAVOLOZZA SI DISEGNA QUESTA STANZA.

   A casa propria, la propria: e' quella scelta adesso, e cambiarla si
   vede subito. In casa di un amico, LA SUA -- se no la sua libreria
   sarebbe la tua ridipinta, e il legno che ha scelto lui non vorrebbe
   piu' dire niente.

   La sua viaggia dentro `profili.stanza`, che e' il jsonb che gli amici
   leggono gia' per luce, muro e pavimento: nessuna migrazione, e la
   tavolozza sta esattamente dove stanno le altre scelte della stanza.
   Quella salvata prima di questa modifica non ce l'ha: si torna alla
   tavolozza di chi guarda, che e' come funzionava un attimo fa. */
function tavolozzaQui(){
  if (typeof TEMA === 'undefined') return null;
  if (!miei && ora.tavolozza && TEMA.esiste(ora.tavolozza)) return ora.tavolozza;
  return null;                     // null = quella corrente
}

function tinta(gruppo, id){
  const lista = LISTE[gruppo], ruoli = RUOLI[gruppo];
  if (!lista || !ruoli || typeof TEMA === 'undefined') return id;
  const tav = tavolozzaQui();
  for (let i = 0; i < lista.length; i++){
    if (lista[i].v === id) return TEMA.ruolo(ruoli[i], tav) || id;
  }
  return id;                       // un valore che non e' nella lista resta se stesso
}

/* La stanza con i colori gia' risolti: e' quella che disegna la scena.
   `corrente()` continua a tornare gli identificativi, ed e' quella che
   si salva -- se le due si scambiassero, sul database finirebbero i
   colori di una tavolozza invece delle scelte di chi ci abita. */
function reso(){
  const o = Object.assign({}, ora);
  o.scaffali  = tinta('scaffali',  o.scaffali);
  o.muro      = tinta('muro',      o.muro);
  o.pavimento = tinta('pavimento', o.pavimento);
  o.nome      = tinta('nome',      o.nome);
  return o;                        // `fariTinta` passa com'e': e' una temperatura
}

/* Una cella non tiene solo COSA c'e' dentro, ma anche QUALE dei suoi:
   le piante sono due specie, i libri e i dadi cambiano con il seme.
   Si scrive tutto in un valore solo -- `piante~1` -- perche' le celle
   vivono dentro il jsonb della stanza e una chiave in piu' per cella
   vorrebbe dire raddoppiare quella mappa per un numero da una cifra.

   Il separatore e' `~` e non `:`, che e' gia' quello fra libreria e
   posto: due significati sullo stesso segno sono un modo sicuro di
   sbagliare uno `split` fra sei mesi. */
const VAR_MAX = 8;
const VAL_CELLA = /^(libri|dadi|piante|niente)(?:~([0-7]))?$/;

let ora = Object.assign({}, DEFAULT, { celle: {} });
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
  /* LE TAVOLOZZE ERANO CHIUSE, E ADESSO NON PIU' -- per il legno.

     La regola di prima diceva che un selettore libero dava scaffali
     fucsia su muri verde acido, ed era vera. Ma il legno del mobile e'
     stato chiesto libero, e la differenza con il muro e' che il mobile
     e' UNO: si accorda con la stanza chi lo sceglie, non il sito.

     Muro, pavimento, colore del nome e temperatura dei faretti restano
     chiusi: quelli sono la stanza, e sono anche il fondo su cui il
     testo del sito deve restare leggibile. */
  const ESA = /^#[0-9a-fA-F]{6}$/;
  const dentroOTinta = function(lista, v, d){
    if (lista.some(function(x){ return x.v === v; })) return v;
    return ESA.test(v) ? String(v).toLowerCase() : d;
  };
  o.scaffali  = dentroOTinta(LEGNI, o.scaffali, DEFAULT.scaffali);
  o.muro      = dentro(MURI,      o.muro,      DEFAULT.muro);
  o.pavimento = dentro(PAVIMENTI, o.pavimento, DEFAULT.pavimento);
  o.arredo    = dentro(ARREDI,    o.arredo,    DEFAULT.arredo);
  o.nome      = dentro(NOMI,      o.nome,      DEFAULT.nome);
  o.fariTinta = dentro(FARI,      o.fariTinta, DEFAULT.fariTinta);
  /* La tavolozza con cui la stanza va disegnata. Un nome che non esiste
     -- dato vecchio, o una tavolozza tolta -- vale come non scelto. */
  o.tavolozza = (typeof TEMA !== 'undefined' && TEMA.esiste(o.tavolozza))
    ? o.tavolozza : null;

  /* Le celle si ripuliscono a ogni lettura: e' roba che arriva dal
     database, e una chiave storta o un valore che non esiste piu' --
     `cornici`, per dirne uno che c'era fino a ieri -- non deve poter
     mandare in scena un arredo che non c'e'.

     Il tetto e' generoso ma c'e': quattordici mobili pieni di celle
     scelte a mano sono gia' piu' di quanto chiunque ne scelga, e una
     mappa senza fondo dentro un jsonb condiviso e' un modo lento di
     farsi male. */
  const dentroCelle = {};
  const sorgente = (o.celle && typeof o.celle === 'object') ? o.celle : {};
  let quante = 0;
  Object.keys(sorgente).forEach(function(k){
    if (quante >= 168) return;
    /* I dodici cubi sono 0..11; `s0`, `s1`, `s2` sono i tre posti
       SOPRA il mobile, uno per colonna. Un mobile vero ha sempre
       qualcosa sopra, e adesso si sceglie anche quello. */
    if (!/^[0-9a-f-]{6,40}:(?:[0-9]|10|11|s[0-2])$/i.test(k)) return;
    const v = sorgente[k];
    if (typeof v !== 'string' || !VAL_CELLA.test(v)) return;
    dentroCelle[k] = v;
    quante++;
  });
  o.celle = dentroCelle;
  return o;
}

function chiaveCella(libId, posto){
  return String(libId || '') + ':' + posto;
}

/* Cosa si e' scelto per quel cubo, o '' se non si e' scelto niente.
   Torna lo STILE e basta: tutti i posti che chiedono "cosa c'e' qui"
   continuano a leggere quello che leggevano prima, e chi ha bisogno di
   sapere quale dei suoi chiama `variante()`. */
function cella(libId, posto){
  const v = (ora.celle && ora.celle[chiaveCella(libId, posto)]) || '';
  const m = VAL_CELLA.exec(v);
  return m ? m[1] : '';
}

/* Quale variante di quello stile: 0 se non si e' mai girato. */
function variante(libId, posto){
  const v = (ora.celle && ora.celle[chiaveCella(libId, posto)]) || '';
  const m = VAL_CELLA.exec(v);
  return m && m[2] ? (parseInt(m[2], 10) || 0) : 0;
}

/* Un valore vuoto toglie la chiave: "come la libreria" e' l'assenza di
   una scelta, non una scelta che si chiama cosi'. */
function setCella(libId, posto, v, vr){
  if (!ora.celle) ora.celle = {};
  const k = chiaveCella(libId, posto);
  const n = Math.max(0, Math.min(VAR_MAX - 1, parseInt(vr, 10) || 0));
  if (v && CELLE.indexOf(v) >= 0) ora.celle[k] = v + (n ? '~' + n : '');
  else delete ora.celle[k];
  return ora.celle;
}

/* Una libreria cancellata lascia le sue celle orfane dentro il jsonb:
   non fanno danno -- nessuno le legge piu' -- ma nemmeno restano li'
   per sempre. */
function scordaCelle(libId){
  if (!ora.celle) return;
  const p = String(libId) + ':';
  Object.keys(ora.celle).forEach(function(k){
    if (k.indexOf(p) === 0) delete ora.celle[k];
  });
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
  /* La propria stanza porta sempre la propria tavolozza: e' quello che
     la rende riconoscibile a chi viene a guardarla. */
  if (typeof TEMA !== 'undefined') ora.tavolozza = TEMA.corrente();
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
  CELLE: CELLE, cella: cella, variante: variante,
  tinta: tinta, reso: reso,
  setCella: setCella, scordaCelle: scordaCelle,
  FARI: FARI,
  LUCE_MIN: LUCE_MIN, LUCE_MAX: LUCE_MAX,
  corrente: corrente, miaStanza: miaStanza, normalizza: normalizza,
  daProfilo: daProfilo, daAltri: daAltri, cambia: cambia, salva: salva,
  tavolozze: aiValori
};
})();
