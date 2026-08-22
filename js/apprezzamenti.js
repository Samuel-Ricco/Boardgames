/* ============================================================
   I cuori sotto la recensione di qualcuno.

   Guardando la libreria di un amico si apre una scatola e si legge
   quello che ne pensa lui. Questo e' il modo di rispondergli: la cosa
   piu' piccola e piu' naturale da fare davanti a una frase scritta da
   qualcuno.

   LA CHIAVE E' LA COPIA, NON IL GIOCO -- `(proprietario, gioco)`, non
   l'id BGG. Si apprezza *la recensione di quella persona*, non il gioco
   in generale, e il sito tiene gia' separate le due cose: le recensioni
   pubbliche del catalogo (`js/recensioni.js`) hanno l'id BGG per chiave
   perche' sono del gioco e le legge chiunque; queste sono di chi le ha
   scritte.

   Si legge una collezione per volta: si carica entrando in casa di
   qualcuno e si butta uscendo. `di()` e' sincrona apposta, perche' la
   scena la interroga mentre disegna un pannello.

   Degrada in silenzio come tutto il resto: senza backend, senza tabella
   o senza rete la mappa resta vuota, `di()` risponde zero cuori, e non
   si vede nessun guasto -- si vede un sito senza cuori.
   ============================================================ */
const CUORI = (function(){
'use strict';

let di_chi = null;             // uuid della collezione caricata
let mappa  = {};               // gioco -> { n, mio }
let motivo = '';

function client(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

function vuota(){ di_chi = null; mappa = {}; motivo = ''; }

/* Tutti i cuori di una collezione in una lettura sola. Sono poche righe
   -- un cuore per persona per gioco -- e chiederli uno per scatola
   vorrebbe dire una chiamata per ogni apertura. */
async function carica(proprietario){
  const c = client();
  if (!c || !proprietario){ vuota(); return mappa; }
  if (di_chi === proprietario) return mappa;

  vuota();
  di_chi = proprietario;

  const io = (AUTH.stato() || {}).id || null;
  const r = await c.from('apprezzamenti')
    .select('chi,gioco')
    .eq('proprietario', proprietario);

  if (r.error){
    /* Che la tabella non ci sia si cerca NEL MESSAGGIO, per nome. Il
       codice non basta: Postgres dice `42P01`, PostgREST risponde
       "Could not find the table 'public.apprezzamenti' in the schema
       cache" con un codice suo, e un controllo sul solo codice lascia
       passare il caso piu' probabile -- la migrazione non applicata.
       Ed e' proprio quello che va tradotto in una frase utile: nessuno
       sa cosa farsene di "schema cache". */
    const m = String(r.error.message || '');
    motivo = m.indexOf('apprezzamenti') >= 0
      ? TP('err.appreMigrazione')
      : m;
    return mappa;
  }

  (r.data || []).forEach(function(riga){
    const v = mappa[riga.gioco] || (mappa[riga.gioco] = { n: 0, mio: false });
    v.n++;
    if (io && riga.chi === io) v.mio = true;
  });
  return mappa;
}

function di(gioco){ return mappa[gioco] || { n: 0, mio: false }; }
function problema(){ return motivo; }

/* Ottimista come il resto del sito: il cuore si accende subito, la riga
   parte dietro, e se il database dice di no torna com'era col motivo.

   Un `23505` sull'insert non e' un errore: vuol dire che il cuore
   c'era gia', cioe' esattamente lo stato voluto. */
async function alterna(proprietario, gioco){
  const c = client();
  const io = (AUTH.stato() || {}).id || null;
  if (!c || !io) throw new Error(TP('err.serveAccesso'));

  const v = mappa[gioco] || (mappa[gioco] = { n: 0, mio: false });
  const acceso = !v.mio;

  v.mio = acceso;
  v.n = Math.max(0, v.n + (acceso ? 1 : -1));

  const r = acceso
    ? await c.from('apprezzamenti').insert({ chi: io, proprietario: proprietario, gioco: gioco })
    : await c.from('apprezzamenti').delete()
        .eq('chi', io).eq('proprietario', proprietario).eq('gioco', gioco);

  if (r.error && !(acceso && r.error.code === '23505')){
    v.mio = !acceso;                                 // torna com'era
    v.n = Math.max(0, v.n + (acceso ? -1 : 1));
    throw r.error;
  }
  return v;
}

return { carica: carica, di: di, alterna: alterna, problema: problema, vuota: vuota };
})();
