/* ============================================================
   Le recensioni del sito.

   Sono una cosa diversa dalla collezione. Una collezione e' di chi ha
   fatto accesso e la vede solo lui; una recensione e' del gioco, la
   scrive un admin e la legge chiunque -- anche l'ospite, che non ha
   nessuna libreria. E' quello che rende sensato l'ingresso da ospite.

   La chiave e' l'id BoardGameGeek, l'unico identificativo di un gioco
   da tavolo su cui il mondo si sia messo d'accordo. Un gioco senza id
   BGG qui non si recensisce: e' quel numero a tenere insieme il
   catalogo (che viene da fuori) e le recensioni (che sono nostre).

   Qui NON si copia la scheda del gioco. Autore, editore, durata
   arrivano dalla fonte quando la riga viene mostrata: copiarli
   vorrebbe dire tenerli aggiornati a mano per sempre.

   Tutto degrada in silenzio. Senza backend, senza tabella o senza
   rete, `di()` risponde null e il catalogo dice "non ancora
   recensito" -- che e' vero, non e' un guasto.
   ============================================================ */
const RECE = (function(){
'use strict';

let per = null;              // bgg -> recensione, null finche' non si carica
let caricando = null;        // la promessa in corso, per non chiedere due volte
let motivo = '';             // perche' non ce ne sono, se non ce ne sono

function daRiga(r){
  return {
    bgg: r.bgg,
    title: r.titolo,
    score: r.voto || '',
    review: r.testo || [],
    cover: r.copertina || '',
    da: r.scritta_da || null,
    quando: r.aggiornata || r.creato || null
  };
}

/* Una lettura sola per sessione: le recensioni sono poche e cambiano
   di rado, e il catalogo le interroga una riga per volta mentre
   scorre. Chiederle al database dodici volte a pagina sarebbe assurdo. */
function carica(rileggi){
  if (per && !rileggi) return Promise.resolve(per);
  if (caricando && !rileggi) return caricando;

  const c = (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
  if (!c){
    per = {};
    motivo = 'senza backend le recensioni del catalogo non ci sono';
    return Promise.resolve(per);
  }

  caricando = c.from('recensioni').select('*').then(function(r){
    if (r.error) throw r.error;
    const m = {};
    (r.data || []).forEach(function(x){ m[x.bgg] = daRiga(x); });
    per = m;
    motivo = '';
    return per;
  }).catch(function(e){
    per = {};
    // 42P01: la tabella non c'e'. Capita una volta sola, quando la
    // migrazione e' nel repo ma non e' ancora stata applicata.
    motivo = (e && (e.code === '42P01' || /recensioni/.test(e.message || '')))
      ? 'manca la tabella `recensioni`: applica la migrazione recensioni_pubbliche'
      : (e && e.message) || String(e);
    return per;
  }).then(function(m){ caricando = null; return m; });

  return caricando;
}

// sincrona: il catalogo disegna una riga per volta e non puo' aspettare
function di(bgg){
  if (!per || !bgg) return null;
  return per[parseInt(bgg, 10)] || null;
}

function quante(){ return per ? Object.keys(per).length : 0; }
function problema(){ return motivo; }

/* Pubblicare: la recensione scritta su un gioco della propria
   collezione diventa quella del catalogo. Il gioco deve avere un id
   BGG -- senza, non c'e' niente a cui attaccarla.

   `upsert` e non insert: si ripubblica la stessa recensione ogni volta
   che la si corregge, ed e' la stessa riga. Qui si puo', al contrario
   che sulle copertine nello storage: li' gli admin hanno insert e
   delete ma non update, e un upsert fallirebbe. */
async function pubblica(game){
  const c = (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
  if (!c) throw new Error('senza backend non si pubblica niente');
  const bgg = parseInt(game.bgg, 10);
  if (!bgg) throw new Error('serve l\'id BGG: e\' la chiave della recensione');

  const io = AUTH.stato();
  const riga = {
    bgg: bgg,
    titolo: game.title,
    voto: game.score || null,
    testo: game.review || [],
    // la copertina si porta dietro solo se sta gia' su un indirizzo
    // vero: un data URL qui gonfierebbe la riga per tutti i lettori
    copertina: (game.cover && game.cover.slice(0,5) !== 'data:') ? game.cover : null,
    scritta_da: io.id || null,
    aggiornata: new Date().toISOString()
  };

  const r = await c.from('recensioni').upsert(riga, { onConflict: 'bgg' });
  if (r.error) throw r.error;
  if (per) per[bgg] = daRiga(riga);
  return riga;
}

async function togli(bgg){
  const c = (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
  if (!c) return;
  const n = parseInt(bgg, 10);
  const r = await c.from('recensioni').delete().eq('bgg', n);
  if (r.error) throw r.error;
  if (per) delete per[n];
}

return { carica: carica, di: di, quante: quante, problema: problema,
         pubblica: pubblica, togli: togli };
})();
