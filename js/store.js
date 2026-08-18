/* ============================================================
   La libreria: quali giochi ci sono sugli scaffali.

   Il seme e' l'array GAMES di data.js, quello committato nel repo.
   Appena l'admin aggiunge o toglie qualcosa la libreria passa in
   localStorage e da li' in poi comanda quella: e' un sito statico,
   non c'e' un database dietro. `esporta()` restituisce il testo di
   js/data.js aggiornato, da committare quando le modifiche vanno
   rese pubbliche.
   ============================================================ */
const LIB = (function(){
'use strict';

const KEY = 'dado-libreria-v1';
let games = null;

function seed(){
  return GAMES.map(function(g, i){
    return Object.assign({}, g, { added: g.added || i + 1 });
  });
}

function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw){
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.games) && p.games.length) return p.games;
    }
  } catch(e){}
  return seed();
}

function save(){
  // `img` e' l'immagine gia' decodificata, attaccata a runtime: in JSON
  // diventa {} e al ricaricamento sembra una copertina valida senza
  // esserlo, cosi' le proporzioni della scatola finivano a NaN.
  const pulito = games.map(function(g){
    const c = Object.assign({}, g);
    delete c.img;
    return c;
  });
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, games: pulito })); }
  catch(e){ /* quota piena o storage negato: si continua in memoria */ }
}

function all(){
  if (!games) games = load();
  return games;
}

// Se e' rimasto solo il seme non c'e' niente da esportare.
function touched(){
  try { return !!localStorage.getItem(KEY); } catch(e){ return false; }
}

const ORDERS = {
  aggiunta: function(a,b){ return (a.added||0) - (b.added||0); },
  nome:     function(a,b){ return String(a.title).localeCompare(String(b.title), 'it'); },
  voto:     function(a,b){ return (parseFloat(b.score)||0) - (parseFloat(a.score)||0); }
};

function list(order){
  const cmp = ORDERS[order] || ORDERS.aggiunta;
  return all().slice().sort(cmp);
}

// Un id stabile e leggibile, senza collisioni con quelli gia' presenti.
function makeId(title){
  let base = String(title).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gioco';
  let id = base, n = 2;
  while (all().some(function(g){ return g.id === id; })) id = base + '-' + (n++);
  return id;
}

function add(g){
  const next = all().reduce(function(m, x){ return Math.max(m, x.added || 0); }, 0) + 1;
  const game = Object.assign({
    id: makeId(g.title), sub: '', year: '', designer: '', publisher: '',
    players: '', time: '', age: '', weight: '', score: '',
    tags: [], review: (typeof LOREM !== 'undefined' ? LOREM : ['']),
    art: 'generic', wrap: '#4a4632', ink: '#f1e2bd'
  }, g, { added: next });

  if (!game.id) game.id = makeId(game.title);
  all().push(game);
  save();
  return game;
}

function remove(id){
  const i = all().findIndex(function(g){ return g.id === id; });
  if (i < 0) return null;
  const out = games.splice(i, 1)[0];
  save();
  return out;
}

function get(id){
  return all().find(function(g){ return g.id === id; }) || null;
}

function reset(){
  try { localStorage.removeItem(KEY); } catch(e){}
  games = seed();
}

// Il testo di js/data.js con la libreria di adesso. Le copertine
// aggiunte dall'admin sono data URL enormi: nell'export diventano un
// commento, l'immagine va salvata in img/ e referenziata da li'.
function esporta(){
  const body = all().map(function(g){
    const c = Object.assign({}, g);
    if (c.cover && c.cover.slice(0,5) === 'data:') c.cover = 'img/' + c.id + '.jpg';
    if (c.review === (typeof LOREM !== 'undefined' ? LOREM : null)) c.review = 'LOREM';
    let s = JSON.stringify(c, null, 4).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:');
    return s.replace(/"LOREM"/, 'LOREM');
  }).join(',\n  ');
  return 'const GAMES = [\n  ' + body + '\n];\n';
}

return {
  all: all, list: list, add: add, remove: remove, get: get,
  reset: reset, esporta: esporta, touched: touched, orders: Object.keys(ORDERS)
};
})();
