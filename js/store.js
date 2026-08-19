/* ============================================================
   La libreria: quali giochi ci sono sugli scaffali.

   Tre sorgenti, in ordine di autorita':
     1. Supabase, se configurato e raggiungibile -- e' la verita';
     2. localStorage, copia dell'ultima lettura riuscita, cosi'
        la libreria si apre anche senza rete;
     3. l'array GAMES di js/data.js, committato nel repo, per la
        primissima visita e per quando non c'e' backend.

   Le funzioni che usa la scena (all, list, add, remove) restano
   SINCRONE: i dati stanno in memoria, `sync()` li riempie una volta
   all'avvio, e le modifiche partono in background. Cosi' app.js e
   tutta la parte 3D non sanno nemmeno che esiste un database.
   ============================================================ */
const LIB = (function(){
'use strict';

const KEY = 'dado-libreria-v1';
let games = null;
let remota = false;             // i dati vengono dal database?

// chiamata quando una scrittura non riesce; app.js ci attacca flash()
let onErrore = function(){};

/* --- traduzione fra le colonne del database e i campi della scena ---
   Le colonne sono in italiano, i campi della scena no. Meglio dieci
   righe di mappatura che una colonna chiamata "time", che in SQL e'
   anche un tipo. */
const DA_DB = {
  id:'id', titolo:'title', sottotitolo:'sub', bgg:'bgg', anno:'year',
  autore:'designer', editore:'publisher', illustratore:'artist',
  giocatori:'players', durata:'time', eta:'age', peso:'weight',
  voto:'score', tag:'tags', recensione:'review', copertina:'cover',
  arte:'art', wrap:'wrap', ink:'ink', posizione:'pos'
};
const A_DB = {};
Object.keys(DA_DB).forEach(function(k){ A_DB[DA_DB[k]] = k; });

function daRiga(r){
  const g = {};
  Object.keys(DA_DB).forEach(function(col){
    const v = r[col];
    if (v !== null && v !== undefined) g[DA_DB[col]] = v;
  });
  g.tags = r.tag || [];
  g.review = r.recensione || [];
  g.added = r.creato ? Date.parse(r.creato) : 0;
  return g;
}

function aRiga(g){
  const r = {};
  Object.keys(A_DB).forEach(function(campo){
    const v = g[campo];
    if (v !== undefined && v !== '' && v !== null) r[A_DB[campo]] = v;
  });
  if (r.bgg) r.bgg = parseInt(r.bgg, 10) || null;
  if (r.anno) r.anno = parseInt(r.anno, 10) || null;
  r.tag = g.tags || [];
  r.recensione = g.review || [];
  // `img` e' l'immagine gia' decodificata, attaccata a runtime: non e'
  // un dato, non deve arrivare al database
  delete r.img;
  return r;
}

/* --- sorgenti locali -------------------------------------------- */
function seme(){
  return GAMES.map(function(g, i){
    return Object.assign({}, g, { added: g.added || i + 1 });
  });
}

function daLocale(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw){
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.games) && p.games.length) return p.games;
    }
  } catch(e){}
  return seme();
}

function salvaLocale(){
  // `img` in JSON diventa {} e al ricaricamento sembra una copertina
  // valida senza esserlo: cosi' le proporzioni della scatola finivano
  // a NaN. Va tolta prima di serializzare.
  const pulito = (games || []).map(function(g){
    const c = Object.assign({}, g);
    delete c.img;
    return c;
  });
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, games: pulito })); }
  catch(e){ /* quota piena o storage negato: si continua in memoria */ }
}

/* --- lettura dal database ----------------------------------------
   La collezione e' di chi ha fatto accesso: le regole del database
   filtrano da sole, qui non serve nessun `where`.

   Una collezione **vuota e' una risposta valida**, non un guasto: chi
   entra per la prima volta ha la libreria vuota e va mostrata vuota. Solo
   se la lettura fallisce si ripiega sulla copia locale. Confonderle
   vorrebbe dire far comparire i giochi di esempio nella libreria di uno
   che non ne ha ancora messo nessuno. */
async function sync(){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || !AUTH.stato().dentro){
    games = daLocale();
    remota = false;
    return { remota: false, dentro: false };
  }

  try {
    const r = await c.from('giochi').select('*').order('creato', { ascending: true });
    if (r.error) throw r.error;
    games = (r.data || []).map(daRiga);
    remota = true;
    salvaLocale();                          // copia per quando manca la rete
    return { remota: true, quanti: games.length, vuota: games.length === 0 };
  } catch(e){
    games = daLocale();
    remota = false;
    return { remota: false, errore: e.message || String(e) };
  }
}

// svuota tutto: si esce, e la collezione di prima non deve restare in giro
function scollega(){
  games = [];
  remota = false;
  try { localStorage.removeItem(KEY); } catch(e){}
}

/* --- lettura sincrona, quella che usa la scena ------------------- */
function all(){
  if (!games) games = daLocale();
  return games;
}

/* L'ordine manuale e' l'unico che non si calcola: sta in `pos`, denso e
   contato da zero. Chi non ce l'ha non e' mai stato spostato e va in
   fondo -- e alla prima mossa manuale lo riceve, insieme a tutti gli
   altri, nell'ordine in cui era in quel momento sullo schermo. Cosi'
   passare a "il mio ordine" non rimescola mai niente. */
function posDi(g){ return (g.pos === null || g.pos === undefined) ? null : g.pos; }

const ORDERS = {
  mio: function(a,b){
    const pa = posDi(a), pb = posDi(b);
    if (pa === null && pb === null) return (a.added||0) - (b.added||0);
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pa - pb;
  },
  aggiunta: function(a,b){ return (a.added||0) - (b.added||0); },
  nome:     function(a,b){ return String(a.title).localeCompare(String(b.title), 'it'); },
  voto:     function(a,b){ return (parseFloat(b.score)||0) - (parseFloat(a.score)||0); }
};

/* --- ricerca -----------------------------------------------------
   Guarda tutto quello che si legge sulla scatola e nella scheda:
   titolo, autore, editore, anno, etichette.

   Il testo viene appiattito prima del confronto -- minuscolo e senza
   segni diacritici -- se no chi scrive "citta" non trova "Citta'" e chi
   scrive minuscolo non trova niente.

   Le parole scritte valgono tutte, in qualunque ordine: due parole
   restringono la ricerca invece di allargarla, che e' quello che si
   aspetta chi ne scrive due. */
function piatto(s){
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function corrisponde(g, q){
  if (!q) return true;
  const testo = piatto([g.title, g.sub, g.designer, g.publisher,
                        g.year, (g.tags || []).join(' ')].join(' '));
  return piatto(q).split(/\s+/).filter(Boolean).every(function(p){
    return testo.indexOf(p) >= 0;
  });
}

function list(order, q){
  return all().filter(function(g){ return corrisponde(g, q); })
              .sort(ORDERS[order] || ORDERS.aggiunta);
}

function get(id){
  return all().find(function(g){ return g.id === id; }) || null;
}

function makeId(title){
  const base = String(title).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gioco';
  let id = base, n = 2;
  while (all().some(function(g){ return g.id === id; })) id = base + '-' + (n++);
  return id;
}

/* --- scrittura: ottimista -------------------------------------------
   La scatola compare subito sullo scaffale e la richiesta parte per
   conto suo. Se il database rifiuta -- perche' chi ha premuto non e'
   admin, o perche' non c'e' rete -- la scatola torna indietro e si
   dice perche'. Meglio questo che un'interfaccia che si blocca a ogni
   clic aspettando un giro di rete. */
function add(g){
  const next = all().reduce(function(m, x){ return Math.max(m, x.added || 0); }, 0) + 1;
  const game = Object.assign({
    id: '', sub: '', year: '', designer: '', publisher: '',
    players: '', time: '', age: '', weight: '', score: '',
    tags: [], review: (typeof LOREM !== 'undefined' ? LOREM : ['']),
    art: 'generic', wrap: '#4a4632', ink: '#f1e2bd'
  }, g);
  if (!game.id) game.id = makeId(game.title);
  game.added = next;

  all().push(game);
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota) mandaAlServer(c, game);
  return game;
}

/* La copertina di un gioco aggiunto arriva dal proxy come data URL: un
   centinaio di kilobyte di base64. In localStorage andava bene, in una
   libreria condivisa no -- gonfierebbe la riga e ogni visitatore se la
   scaricherebbe dentro il JSON. Va nel bucket `copertine`, e nella
   colonna ci finisce l'indirizzo.

   Niente upsert: le regole dello storage concedono agli admin insert e
   delete, non update. Se l'oggetto c'e' gia' si riusa quello che c'e'. */
async function caricaCopertina(c, id, dataUrl){
  // una cartella a testa: con le collezioni separate due persone che
  // aggiungono Root scriverebbero tutte e due su root.jpg
  const path = (AUTH.stato().id || 'anonimo') + '/' + id + '.jpg';
  const pubblico = function(){
    return c.storage.from('copertine').getPublicUrl(path).data.publicUrl;
  };
  const blob = await (await fetch(dataUrl)).blob();
  const r = await c.storage.from('copertine')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error && !/exists/i.test(r.error.message || '')) throw r.error;
  return pubblico();
}

async function mandaAlServer(c, game){
  try {
    const riga = aRiga(game);

    // di chi e' la riga: senza questo le regole rifiutano l'inserimento,
    // e giustamente -- una riga senza proprietario non e' di nessuno
    const io = AUTH.stato();
    if (io.id){ riga.proprietario = io.id; riga.aggiunto_da = io.id; }

    if (riga.copertina && riga.copertina.slice(0,5) === 'data:'){
      try {
        riga.copertina = await caricaCopertina(c, game.id, riga.copertina);
        game.cover = riga.copertina;          // anche in memoria, per il prossimo giro
      } catch(e){
        // senza copertina il gioco entra lo stesso, con quella disegnata
        delete riga.copertina;
        onErrore('copertina non caricata: ' + messaggio(e));
      }
    }

    const r = await c.from('giochi').insert(riga);
    if (r.error) throw r.error;
    await sync();                             // riallinea creato e ordine col server
  } catch(e){
    annulla(game.id);
    onErrore('non sono riuscito ad aggiungerlo: ' + messaggio(e));
  }
}

/* --- correggere un gioco gia' sullo scaffale ---------------------
   Stessa filosofia dell'aggiunta: la scatola cambia subito, la
   richiesta parte dietro, e se il database rifiuta si torna a com'era.
   `patch` contiene solo i campi toccati. */
function update(id, patch){
  const g = get(id);
  if (!g) return null;
  const prima = Object.assign({}, g);

  Object.keys(patch).forEach(function(k){
    if (patch[k] !== undefined) g[k] = patch[k];
  });
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota) mandaModifica(c, g, prima);
  return g;
}

async function mandaModifica(c, g, prima){
  try {
    const riga = aRiga(g);
    delete riga.id;                     // la chiave non si tocca
    delete riga.proprietario;

    if (riga.copertina && riga.copertina.slice(0,5) === 'data:'){
      try {
        riga.copertina = await caricaCopertina(c, g.id, riga.copertina);
        g.cover = riga.copertina;
      } catch(e){
        delete riga.copertina;
        onErrore('copertina non caricata: ' + messaggio(e));
      }
    }

    const r = await c.from('giochi').update(riga).eq('id', g.id);
    if (r.error) throw r.error;
    salvaLocale();
  } catch(e){
    Object.keys(prima).forEach(function(k){ g[k] = prima[k]; });
    salvaLocale();
    onErrore('modifica non salvata: ' + messaggio(e));
  }
}

/* --- riordinare a mano ------------------------------------------
   `ids` e' l'ordine nuovo, per intero. Si scrivono solo le righe che
   cambiano davvero: uno scambio fra due scatole ne tocca due, e non ha
   senso rispedire al database quaranta posizioni identiche.

   Come per le altre scritture e' ottimista: le scatole si spostano
   subito e la richiesta parte dietro. Se il database rifiuta, l'ordine
   resta comunque quello sullo schermo e in `localStorage` -- tornare
   indietro qui vorrebbe dire far saltare le scatole sotto gli occhi di
   chi le ha appena messe a posto, per un errore che quasi sempre e'
   solo mancanza di rete. Lo si dice e basta. */
function riordina(ids){
  const per = {};
  all().forEach(function(g){ per[g.id] = g; });

  const cambiati = [];
  ids.forEach(function(id, i){
    const g = per[id];
    if (!g) return;
    if (g.pos !== i){ g.pos = i; cambiati.push(g); }
  });
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota && cambiati.length) mandaOrdine(c, cambiati);
  return cambiati.length;
}

async function mandaOrdine(c, giochi){
  try {
    const esiti = await Promise.all(giochi.map(function(g){
      return c.from('giochi').update({ posizione: g.pos }).eq('id', g.id);
    }));
    const ko = esiti.find(function(r){ return r.error; });
    if (ko) throw ko.error;
  } catch(e){
    onErrore('ordine non salvato sul server: ' + messaggio(e));
  }
}

function remove(id){
  const i = all().findIndex(function(g){ return g.id === id; });
  if (i < 0) return null;
  const out = games.splice(i, 1)[0];
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota){
    c.from('giochi').delete().eq('id', id).then(function(r){
      if (r.error){
        all().push(out);
        salvaLocale();
        onErrore('non sono riuscito a toglierlo: ' + messaggio(r.error));
        return;
      }
      // via anche l'immagine, se stava nel bucket: se no resta li' a
      // occupare spazio per un gioco che non c'e' piu'
      if (out.cover && out.cover.indexOf('/copertine/') >= 0){
        c.storage.from('copertine').remove([(AUTH.stato().id || 'anonimo') + '/' + out.id + '.jpg']);
      }
    });
  }
  return out;
}

function annulla(id){
  const i = all().findIndex(function(g){ return g.id === id; });
  if (i >= 0) games.splice(i, 1);
  salvaLocale();
}

// Il 42501 di Postgres e' il caso normale, non un guasto: vuol dire
// che le regole hanno fatto il loro mestiere.
function messaggio(err){
  const m = (err && (err.message || err.msg)) || String(err);
  if (err && (err.code === '42501' || /row-level security/i.test(m))){
    return 'il database dice di no, questo account non e\' admin';
  }
  // 42703: colonna inesistente. Capita una volta sola, quando una
  // migrazione e' nel repo ma non e' ancora stata applicata al progetto.
  if (err && (err.code === '42703' || /posizione/.test(m))){
    return 'manca la colonna `posizione`: applica la migrazione ordine_manuale';
  }
  return m;
}

function reset(){
  try { localStorage.removeItem(KEY); } catch(e){}
  games = seme();
}

function esporta(){
  const body = all().map(function(g){
    const c = Object.assign({}, g);
    delete c.img;
    if (c.cover && c.cover.slice(0,5) === 'data:') c.cover = 'img/' + c.id + '.jpg';
    if (c.review === (typeof LOREM !== 'undefined' ? LOREM : null)) c.review = 'LOREM';
    const s = JSON.stringify(c, null, 4).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:');
    return s.replace(/"LOREM"/, 'LOREM');
  }).join(',\n  ');
  return 'const GAMES = [\n  ' + body + '\n];\n';
}

function touched(){
  try { return !!localStorage.getItem(KEY); } catch(e){ return false; }
}

return {
  sync: sync, all: all, list: list, get: get,
  add: add, update: update, remove: remove, riordina: riordina,
  scollega: scollega, reset: reset, esporta: esporta, touched: touched,
  eRemota: function(){ return remota; },
  suErrore: function(fn){ onErrore = fn; },
  orders: Object.keys(ORDERS)
};
})();
