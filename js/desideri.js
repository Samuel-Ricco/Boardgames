/* ============================================================
   LA WISHLIST: i giochi che non hai (ancora).

   La collezione dice cosa hai, le partite cosa hai giocato. Questa
   dice cosa vorresti -- che di chi scorre un catalogo da centomila
   titoli e' la domanda piu' frequente, e finora non aveva nessun posto
   dove finire.

   LA CHIAVE E' L'ID BGG, come per le recensioni pubbliche e per le
   partite: e' l'unico identificativo di un gioco da tavolo su cui il
   mondo si sia messo d'accordo, ed e' quel numero a tenere insieme il
   catalogo -- che viene da fuori -- e quello che e' nostro. Un gioco
   senza id BGG non si desidera: non ci sarebbe modo di ritrovarlo, e
   il cuore infatti non compare.

   IL TITOLO E' UNA COPIA, e non e' ridondanza da normalizzare via:
   e' la stessa scelta di `partite.titolo`. La wishlist si disegna
   senza chiedere niente a nessuno, e senza il titolo qui dentro
   aprirla vorrebbe dire un giro su BGG per riga solo per sapere come
   si chiamano. Il RESTO della scheda -- autore, editore, durata --
   non si copia: arriva dalla fonte quando serve.

   UNA LETTURA SOLA PER SESSIONE, in una mappa `bgg -> riga`, perche' il
   catalogo la interroga UNA RIGA PER VOLTA mentre si scorre: `c_e()` e'
   sincrona apposta, come `RECE.di` e `CUORI.di`.

   Degrada in silenzio come tutto il resto: senza backend, senza tabella
   o senza rete la mappa resta vuota, il cuore non si accende e non si
   vede nessun guasto -- si vede un sito senza wishlist.
   ============================================================ */
const WISH = (function(){
'use strict';

/* Il taglio vero sta DOVE IL DATO SI SCRIVE, non nel campo: dal
   catalogo arrivano titoli con edizione, sottotitolo ed espansione
   tutto attaccato, e qui non c'e' nessun campo che li veda passare. */
const TITOLO_WISH = 80;

let mappa = {};                // bgg -> { bgg, titolo, anno, creato }
let letta = false;
let motivo = '';

function client(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

function vuota(){ mappa = {}; letta = false; motivo = ''; }

function chiave(bgg){
  const n = parseInt(bgg, 10);
  return n > 0 ? String(n) : '';
}

/* Si chiede una volta e poi si tiene. Chi entra e non apre mai il
   catalogo non la scarica affatto: la chiama chi ne ha bisogno. */
async function carica(rileggi){
  const c = client();
  if (!c || !(AUTH.stato() || {}).id){ vuota(); return mappa; }
  if (letta && !rileggi) return mappa;

  const r = await c.from('desideri')
    .select('bgg,titolo,anno,creato')
    .eq('chi', AUTH.stato().id);

  if (r.error){
    /* Che la tabella non ci sia si cerca NEL MESSAGGIO, per nome. Il
       codice non basta: Postgres dice `42P01`, PostgREST risponde
       "Could not find the table 'public.desideri' in the schema cache"
       con un codice suo, e controllare solo il codice lascia passare il
       caso piu' probabile -- la migrazione non ancora applicata. Ed e'
       proprio quello che va tradotto in una frase utile: nessuno sa
       cosa farsene di "schema cache". */
    const m = String(r.error.message || '');
    motivo = m.indexOf('desideri') >= 0 ? TP('err.wishMigrazione') : m;
    return mappa;
  }

  motivo = '';
  mappa = {};
  (r.data || []).forEach(function(riga){
    mappa[chiave(riga.bgg)] = {
      bgg: riga.bgg, titolo: riga.titolo || '',
      anno: riga.anno || '', creato: riga.creato || ''
    };
  });
  letta = true;
  return mappa;
}

function c_e(bgg){ return !!mappa[chiave(bgg)]; }
function quanti(){ return Object.keys(mappa).length; }
function problema(){ return motivo; }

/* L'ultimo desiderato in cima: e' quello a cui si stava pensando, ed e'
   anche l'ordine in cui si e' costruita la lista. */
function tutti(){
  return Object.keys(mappa).map(function(k){ return mappa[k]; })
    .sort(function(a, b){
      return String(b.creato || '').localeCompare(String(a.creato || '')) ||
             String(a.titolo || '').localeCompare(String(b.titolo || ''), 'it');
    });
}

/* Ottimista come il resto del sito: il cuore si accende subito, la riga
   parte dietro, e se il database dice di no torna com'era col motivo.

   Un `23505` sull'insert NON e' un errore: vuol dire che il desiderio
   c'era gia', cioe' esattamente lo stato voluto. E' la stessa lezione
   dei cuori e delle etichette dei gruppi. */
async function alterna(voce){
  const c = client();
  const io = (AUTH.stato() || {}).id || null;
  if (!c || !io) throw new Error(TP('err.serveAccesso'));

  const k = chiave(voce && voce.bgg);
  if (!k) throw new Error(TP('err.senzaBggWish'));

  const c_era = !!mappa[k];
  const riga = {
    bgg: parseInt(voce.bgg, 10),
    titolo: String(voce.title || voce.titolo || '').slice(0, TITOLO_WISH),
    anno: parseInt(voce.year || voce.anno, 10) || null
  };

  if (c_era) delete mappa[k];
  else mappa[k] = { bgg: riga.bgg, titolo: riga.titolo, anno: riga.anno || '',
                    creato: new Date().toISOString() };

  const r = c_era
    ? await c.from('desideri').delete().eq('chi', io).eq('bgg', riga.bgg)
    : await c.from('desideri').insert(Object.assign({ chi: io }, riga));

  if (r.error && !(!c_era && r.error.code === '23505')){
    // torna com'era: i dati e lo schermo non devono restare in disaccordo
    if (c_era) mappa[k] = { bgg: riga.bgg, titolo: riga.titolo,
                            anno: riga.anno || '', creato: '' };
    else delete mappa[k];
    throw r.error;
  }
  return !c_era;
}

return { carica: carica, c_e: c_e, tutti: tutti, quanti: quanti,
         alterna: alterna, problema: problema, vuota: vuota };
})();
