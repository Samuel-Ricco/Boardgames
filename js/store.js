/* ============================================================
   La libreria: quali giochi ci sono sugli scaffali.

   Tre sorgenti, in ordine di autorita':
     1. Supabase, se configurato e raggiungibile -- e' la verita';
     2. localStorage, copia dell'ultima lettura riuscita, cosi'
        l'armadio si apre anche senza rete;
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
  arte:'art', wrap:'wrap', ink:'ink'
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

/* --- lettura dal database --------------------------------------- */
async function sync(){
  games = daLocale();                       // qualcosa da mostrare subito
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c) return { remota: false };

  try {
    const r = await c.from('giochi').select('*').order('creato', { ascending: true });
    if (r.error) throw r.error;
    games = (r.data || []).map(daRiga);
    remota = true;
    salvaLocale();                          // copia per la prossima volta offline
    return { remota: true, quanti: games.length };
  } catch(e){
    remota = false;
    return { remota: false, errore: e.message || String(e) };
  }
}

/* --- lettura sincrona, quella che usa la scena ------------------- */
function all(){
  if (!games) games = daLocale();
  return games;
}

const ORDERS = {
  aggiunta: function(a,b){ return (a.added||0) - (b.added||0); },
  nome:     function(a,b){ return String(a.title).localeCompare(String(b.title), 'it'); },
  voto:     function(a,b){ return (parseFloat(b.score)||0) - (parseFloat(a.score)||0); }
};

function list(order){
  return all().slice().sort(ORDERS[order] || ORDERS.aggiunta);
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
  if (c && remota){
    c.from('giochi').insert(aRiga(game)).then(function(r){
      if (r.error){
        annulla(game.id);
        onErrore('non sono riuscito ad aggiungerlo: ' + messaggio(r.error));
      } else {
        sync();                            // riallinea creato/ordine col server
      }
    });
  }
  return game;
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
  sync: sync, all: all, list: list, get: get, add: add, remove: remove,
  reset: reset, esporta: esporta, touched: touched,
  eRemota: function(){ return remota; },
  suErrore: function(fn){ onErrore = fn; },
  orders: Object.keys(ORDERS)
};
})();
