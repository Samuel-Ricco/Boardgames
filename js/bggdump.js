/* ============================================================
   L'INDICE DI BGG, IN CASA

   `dati/bgg.txt` e' il dump dei ranking che BGG pubblica ogni giorno,
   ridotto all'osso da tools/bgg-indice.mjs: 106.694 giochi con id,
   nome, anno e media dei voti, in ordine di classifica.

   E' la risposta a due cose che mancavano da sempre:

   - **cercare fra centomila titoli invece di 3.429.** Wikidata resta
     l'unica fonte aperta per autore, editore e durata, ma come elenco
     di giochi da tavolo e' magra: 3.429 con un id BGG. Qui ci sono
     tutti, e la ricerca non passa dalla rete -- e' un file, gia' in
     memoria, quindi risponde mentre si scrive invece che dopo due
     secondi buoni.
   - **la classifica vera.** Il catalogo si sfogliava in ordine di
     edizioni linguistiche della voce Wikidata, che mette in cima
     scacchi e Monopoly: veri classici, ma non la classifica che un
     sito di recensioni vuole. Adesso l'ordine e' quello di BGG.

   Cosa NON c'e': autore, editore, durata, giocatori, copertine. Quelli
   restano a Wikidata, interrogata per ID BGG quando si sceglie un
   risultato -- vedi `dettagli()` in js/catalogo.js.

   Il file si carica **una volta sola e solo se serve**: 3,76 MB non si
   scaricano a chi apre il sito per guardare la sua libreria. Chi apre
   il catalogo o cerca un gioco se lo prende allora.
   ============================================================ */
const DUMP = (function(){
'use strict';

const FILE = 'dati/bgg.txt';

let ids = null, nomi = null, anni = null, medie = null;
let piatti = null;               // i nomi appiattiti, stesso indice
let quantiRank = 0;              // quante righe, in testa, hanno un rank
let inCorso = null;              // la promessa del caricamento, per non farne due
let esiste = null;               // c'e' il file? null = non ancora chiesto

/* Lo stesso appiattimento della ricerca nella collezione: minuscolo e
   senza segni diacritici, cosi' "Wurfel" trova "Wurfel" e "W&uuml;rfel".
   Si calcola UNA VOLTA al caricamento: rifarlo a ogni lettera scritta
   vorrebbe dire centomila `normalize()` per tasto. */
function piatto(s){
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* --- c'e' il file? ----------------------------------------------
   Una HEAD, che costa niente: serve a `fonte()` per scegliere, e la
   risposta si tiene. Senza file il sito torna a Wikidata e non se ne
   accorge nessuno. */
async function c_e(){
  if (esiste !== null) return esiste;
  try {
    const r = await fetch(FILE, { method: 'HEAD' });
    esiste = r.ok;
  } catch(e){
    esiste = false;
  }
  return esiste;
}

async function carica(){
  if (ids) return true;
  if (inCorso) return inCorso;
  inCorso = (async function(){
    const r = await fetch(FILE);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const testo = await r.text();
    const righe = testo.split('\n');

    /* La prima riga dice quante voci e quante classificate. Il rank non
       ha una colonna sua: per le prime `quantiRank` righe e' la
       posizione della riga, per le altre non c'e'. */
    const testa = (righe[0] || '').split(' ');
    if (testa[0] !== '#' || testa[1] !== 'dado-bgg'){
      throw new Error('dati/bgg.txt non ha l\u2019intestazione che mi aspetto');
    }
    quantiRank = parseInt(testa[4], 10) || 0;
    const n = righe.length - 1;

    ids    = new Int32Array(n);
    anni   = new Int16Array(n);
    medie  = new Float32Array(n);
    nomi   = new Array(n);
    piatti = new Array(n);

    let k = 0;
    for (let i = 1; i < righe.length; i++){
      const riga = righe[i];
      if (!riga) continue;
      const a = riga.indexOf('\t');
      const b = riga.indexOf('\t', a + 1);
      const c = riga.indexOf('\t', b + 1);
      if (a < 0 || b < 0 || c < 0) continue;
      ids[k]    = +riga.slice(0, a);
      nomi[k]   = riga.slice(a + 1, b);
      anni[k]   = +riga.slice(b + 1, c) || 0;
      medie[k]  = +riga.slice(c + 1) || 0;
      piatti[k] = piatto(nomi[k]);
      k++;
    }
    if (k < n){                       // righe vuote in coda: si accorcia
      ids = ids.slice(0, k); anni = anni.slice(0, k); medie = medie.slice(0, k);
      nomi.length = k; piatti.length = k;
    }
    return true;
  })();
  try {
    return await inCorso;
  } catch(e){
    inCorso = null; ids = null; esiste = false;
    throw e;
  }
}

/* La voce nella forma che il resto del sito si aspetta da una fonte.
   `fonte: 'dump'` serve a `dettagli()` per sapere che i campi grossi
   mancano e vanno chiesti a Wikidata. */
function voce(i){
  return {
    fonte: 'dump',
    id: String(ids[i]),
    bgg: ids[i],
    title: nomi[i],
    year: anni[i] ? String(anni[i]) : '',
    rank: i < quantiRank ? (i + 1) : 0,
    bggScore: medie[i] ? medie[i].toFixed(1) : '',
    designer: '', publisher: '', players: '', time: '', immagine: ''
  };
}

/* --- sfogliare: le prime N della classifica --------------------- */
async function sfoglia(offset, limite){
  await carica();
  const da = offset || 0, quante = limite || 24;
  const out = [];
  for (let i = da; i < Math.min(da + quante, ids.length); i++) out.push(voce(i));
  return out;
}

/* --- cercare -----------------------------------------------------
   Tutte le parole scritte devono comparire: due parole restringono, non
   allargano. E' la stessa regola della ricerca nella collezione, e chi
   l'ha capita una volta l'ha capita.

   L'ordine dei risultati non e' quello del file: prima chi si chiama
   esattamente cosi', poi chi comincia cosi', poi il resto. Dentro ogni
   gruppo vince chi sta piu' in alto nel file, che vuol dire piu' in
   alto in classifica -- se no cercando "root" usciva prima una qualche
   espansione dimenticata e Root era in fondo.

   Il terzo gruppo si ferma presto: "a" comparirebbe in decine di
   migliaia di titoli, e siccome il file e' in ordine di classifica i
   primi che si incontrano sono gia' i piu' noti. */
async function cerca(testo, limite){
  await carica();
  const q = piatto(testo).trim();
  if (!q) return [];
  const parole = q.split(/\s+/);
  const quante = limite || 40;

  const esatti = [], inizio = [], dentro = [];
  const bastano = quante * 3;

  for (let i = 0; i < piatti.length; i++){
    const p = piatti[i];
    let ok = true;
    for (let w = 0; w < parole.length; w++){
      if (p.indexOf(parole[w]) < 0){ ok = false; break; }
    }
    if (!ok) continue;
    if (p === q) esatti.push(i);
    else if (p.indexOf(q) === 0) inizio.push(i);
    else if (dentro.length < bastano) dentro.push(i);
    else if (esatti.length + inizio.length >= quante) break;
  }

  return esatti.concat(inizio, dentro).slice(0, quante).map(voce);
}

/* Un gioco per id BGG: serve a dire "questo ce l'hai gia'" e a
   ritrovare il nome giusto partendo da una recensione. */
async function di(bgg){
  await carica();
  const n = parseInt(bgg, 10);
  if (!n) return null;
  for (let i = 0; i < ids.length; i++) if (ids[i] === n) return voce(i);
  return null;
}

function quanti(){ return ids ? ids.length : 0; }
function caricato(){ return !!ids; }

return { c_e: c_e, carica: carica, cerca: cerca, sfoglia: sfoglia,
         di: di, quanti: quanti, caricato: caricato, FILE: FILE };
})();
