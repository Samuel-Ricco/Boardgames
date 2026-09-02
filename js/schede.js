/* ============================================================
   Quello che di un gioco e' uguale per tutti.

   La misura della scatola e la sua copertina non sono proprieta' della
   TUA copia: sono fatti sul gioco, come il numero di giocatori. Finche'
   e' stata una persona sola non si notava; con dieci, ognuna se li
   ripagava per conto suo.

   - la copertina stava in `copertine/<uid>/...`, una cartella a testa,
     quindi la stessa figura sul server tante volte quante le persone
     che hanno quel gioco. A 107 KB l'una, il gigabyte del piano
     gratuito bastava per circa 390 persone da 25 giochi;
   - le misure stavano in `localStorage`, cioe' una copia per BROWSER:
     ogni dispositivo nuovo le richiedeva a BGG da capo.

   Adesso stanno nella tabella `schede_bgg`, con chiave l'id BGG -- la
   stessa chiave delle recensioni pubbliche, delle partite e della
   wishlist. La seconda persona che aggiunge Root non interroga BGG e
   non carica niente: legge la riga e punta alla figura che c'e' gia'.

   `di()` E' SINCRONA come `RECE.di` e `CUORI.di`, perche' la scena la
   interroga mentre costruisce le scatole. Si carica in blocco per gli
   id che servono, non riga per riga.

   NON SI LEGGE TUTTA LA TABELLA. Ha una riga per gioco esistente al
   mondo, e a questo sito servono i suoi: si chiedono gli id che ha.

   Degrada in silenzio come tutto il resto: senza backend, senza tabella
   o senza rete resta la copia in `localStorage`, che e' esattamente il
   comportamento di prima.
   ============================================================ */
const SCHEDE = (function(){
'use strict';

const LOCALE = 'dado-schede';

let mappa  = null;      // bgg -> riga
let motivo = '';
let chiesti = null;     // gli id gia' domandati al server, per non ripetersi

const CAMPI = 'bgg,larghezza,lunghezza,spessore,edizione,edizione_anno,edizioni,pic,copertina';

function client(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

/* La copia locale non e' una cache di comodo: e' la strada di chi non
   ha backend e di chi e' senza rete, cioe' lo stesso ruolo che
   `localStorage` ha gia' per la collezione. */
function apri(){
  if (mappa) return mappa;
  mappa = Object.create(null);
  chiesti = Object.create(null);
  try {
    const d = JSON.parse(localStorage.getItem(LOCALE) || '{}') || {};
    for (const k in d) mappa[k] = d[k];
  } catch(e){}
  return mappa;
}

function salvaLocale(){
  try { localStorage.setItem(LOCALE, JSON.stringify(apri())); } catch(e){}
}

function di(bgg){
  if (!bgg) return null;
  return apri()[String(bgg)] || null;
}

function problema(){ return motivo; }

/* Che la tabella non ci sia si cerca NEL MESSAGGIO, per nome: Postgres
   dice `42P01`, PostgREST risponde "Could not find the table
   'public.schede_bgg' in the schema cache" con un codice suo, e
   guardare solo il codice lascia passare il caso piu' probabile, cioe'
   la migrazione non ancora applicata. */
function traduci(e){
  const m = String((e && e.message) || '');
  if (/schede_bgg/.test(m) && /(schema cache|does not exist|relation)/i.test(m)){
    return 'manca la migrazione schede_bgg';
  }
  if (/scheda_bgg_registra/.test(m)) return 'manca la migrazione schede_bgg';
  return m;
}

/* Le righe che servono, in una lettura sola. Gli id gia' domandati non
   si ridomandano: una scheda che il server non ha resta un buco, e
   richiederla a ogni giro sarebbe una chiamata per ogni scatola. */
async function carica(ids){
  const c = client();
  apri();
  if (!c) return mappa;

  const voluti = [];
  (ids || []).forEach(function(x){
    const k = String(parseInt(x, 10) || 0);
    if (k !== '0' && !chiesti[k] && voluti.indexOf(k) < 0) voluti.push(k);
  });
  if (!voluti.length) return mappa;

  const r = await c.from('schede_bgg').select(CAMPI).in('bgg', voluti);
  if (r.error){ motivo = traduci(r.error); return mappa; }

  motivo = '';
  voluti.forEach(function(k){ chiesti[k] = 1; });
  (r.data || []).forEach(function(riga){ mappa[String(riga.bgg)] = riga; });
  salvaLocale();
  return mappa;
}

/* Quello che si e' appena chiesto a BGG, messo dove lo trovano anche
   gli altri. Passa da una funzione `security definer` che riempie solo
   i campi mancanti: una tabella condivisa dove ognuno riscrive quello
   che c'e' e' una tabella dove il primo che sbaglia sbaglia per tutti.

   Non puo' fermare niente: se la scrittura non passa, il gioco entra
   in collezione lo stesso e la scheda resta solo qui in memoria. */
async function registra(d){
  const bgg = parseInt(d && d.bgg, 10) || 0;
  if (!bgg) return null;

  apri();
  const k = String(bgg), prima = mappa[k] || { bgg: bgg };
  // in memoria vale la stessa regola del server: non si cancella
  // quello che c'e' gia' con un campo vuoto
  const dopo = { bgg: bgg };
  ['larghezza','lunghezza','spessore','edizione','edizione_anno','edizioni','pic','copertina']
    .forEach(function(campo){
      dopo[campo] = (prima[campo] === undefined || prima[campo] === null)
        ? (d[campo] === undefined ? null : d[campo])
        : prima[campo];
    });
  mappa[k] = dopo;
  chiesti[k] = 1;
  salvaLocale();

  const c = client();
  if (!c) return dopo;

  const r = await c.rpc('scheda_bgg_registra', {
    p_bgg: bgg,
    p_larghezza: d.larghezza === undefined ? null : d.larghezza,
    p_lunghezza: d.lunghezza === undefined ? null : d.lunghezza,
    p_spessore:  d.spessore  === undefined ? null : d.spessore,
    p_edizione:  d.edizione  === undefined ? null : d.edizione,
    p_edizione_anno: d.edizione_anno === undefined ? null : d.edizione_anno,
    p_edizioni:  d.edizioni  === undefined ? null : d.edizioni,
    p_pic:       d.pic       === undefined ? null : d.pic,
    p_copertina: d.copertina === undefined ? null : d.copertina
  });
  if (r.error){ motivo = traduci(r.error); return dopo; }

  motivo = '';
  if (r.data){ mappa[k] = r.data; salvaLocale(); }
  return mappa[k];
}

/* L'indirizzo pubblico della cartella condivisa. Il nome del file e'
   l'id della figura su BGG, che e' unico al mondo: due persone con lo
   stesso gioco puntano allo stesso oggetto. */
function pathCondiviso(pic){
  return pic ? 'bgg/' + pic + '.jpg' : '';
}

return { carica: carica, di: di, registra: registra,
         pathCondiviso: pathCondiviso, problema: problema };
})();
