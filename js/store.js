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
/* Le scritture sono ottimiste, quindi ogni tanto una torna indietro. Il
   messaggio da solo non basta: chi ha visto la scatola sparire deve
   anche rivederla comparire, se no la scena e i dati restano in due
   posti diversi fino al ricaricamento. */
let onRipristino = function(){};

/* --- traduzione fra le colonne del database e i campi della scena ---
   Le colonne sono in italiano, i campi della scena no. Meglio dieci
   righe di mappatura che una colonna chiamata "time", che in SQL e'
   anche un tipo. */
const DA_DB = {
  id:'id', titolo:'title', sottotitolo:'sub', bgg:'bgg', anno:'year',
  autore:'designer', editore:'publisher', illustratore:'artist',
  giocatori:'players', durata:'time', eta:'age', peso:'weight',
  voto:'score', tag:'tags', recensione:'review', copertina:'cover',
  arte:'art', wrap:'wrap', ink:'ink', posizione:'pos',
  libreria:'libreria', posto:'posto', preferito:'preferito'
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
   IL FILTRO SUL PROPRIETARIO VA SCRITTO, sempre, anche se sembra
   ridondante. Per un po' non c'era: le regole del database dicevano
   `proprietario = auth.uid()` e bastavano. Poi la lettura si e' aperta
   agli amici -- che e' quello che serviva per andare a guardare le
   loro librerie -- e questa query, che non chiedeva niente, ha
   cominciato a portarsi a casa anche i giochi loro. Dieci giochi
   diventati ventitre, mescolati, nella collezione di chi era entrato.

   La lezione: una query che si affida alle policy per delimitare i
   dati e' corretta finche' le policy non cambiano, e le policy
   cambiano. Chi legge deve dire cosa vuole.

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
    const r = await c.from('giochi').select('*')
      .eq('proprietario', AUTH.stato().id)
      .order('creato', { ascending: true });
    if (r.error) throw r.error;
    /* L'IMMAGINE DECODIFICATA SOPRAVVIVE ALLA RILETTURA.

       `daRiga` costruisce oggetti NUOVI, quindi ogni `sync()` buttava
       via l'`img` che `loadCovers()` aveva attaccato -- e `sync()` non
       si chiama solo all'avvio: lo richiama `mandaAlServer` dopo ogni
       aggiunta, in sottofondo. Da li' in poi le scatole gia' costruite
       tenevano la loro texture, ma la prima cosa che rifaceva la scena
       -- una ricerca, un riordino, un ridimensionamento, un altro
       gioco aggiunto -- le ricostruiva senza copertina e ripiegava
       sull'illustrazione disegnata. Cioe' **le copertine sparivano
       dallo scaffale** e tornavano solo ricaricando la pagina.

       Si riporta solo dove la copertina e' rimasta la stessa: se
       l'indirizzo e' cambiato, quell'immagine non e' piu' sua e
       `loadCovers` la riscarichera'. In memoria e basta -- su disco
       `img` non ci va mai (vedi `salvaLocale`). */
    const prima = {};
    (games || []).forEach(function(g){
      if (g && g.img && g.cover) prima[g.id] = { img: g.img, cover: g.cover };
    });
    games = (r.data || []).map(daRiga);
    games.forEach(function(g){
      const v = prima[g.id];
      if (v && v.cover === g.cover) g.img = v.img;
    });
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

/* --- guardare la libreria di un amico ---------------------------
   Si legge e basta: le regole del database lo permettono (`sono_amico`)
   e le policy di scrittura continuano a chiedere `proprietario =
   auth.uid()`, quindi anche volendo non si potrebbe toccare niente.

   La sua collezione sta in un posto suo invece di sovrascrivere la
   propria: tornare a casa e' immediato e non serve rileggere niente.
   E `salvaLocale()` continua a serializzare `games`, cioe' la tua --
   se guardasse `all()` finirebbe in `localStorage` la libreria di un
   altro, e al giro dopo sarebbe la tua. */
let visitata = null;             // { id, nick, games } oppure null

async function visita(uid, nick){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c) throw new Error(TP('err.nessunoVisitare'));
  const r = await c.from('giochi').select('*').eq('proprietario', uid)
                   .order('creato', { ascending: true });
  if (r.error) throw r.error;
  visitata = { id: uid, nick: nick || '', games: (r.data || []).map(daRiga) };
  await caricaLibrerie(uid);          // i suoi mobili, con i suoi nomi
  await caricaGruppi(uid);            // e le sue etichette
  return visitata;
}

function torna(){
  visitata = null;
  caricaLibrerie();                   // e si tornano a leggere i propri
  caricaGruppi();
}
function ospitePresso(){ return visitata; }

/* --- lettura sincrona, quella che usa la scena ------------------- */
function all(){
  if (visitata) return visitata.games;
  if (!games) games = daLocale();
  return games;
}

/* L'ordine manuale e' l'unico che non si calcola: e' DOVE STA la
   scatola, cioe' la coppia (libreria, posto). `pos` resta come criterio
   di scorta per i giochi che un posto non ce l'hanno ancora -- appena
   aggiunti, o arrivati prima che esistessero le librerie.

   I posti sono espliciti e possono avere buchi: un cubo vuoto in mezzo
   allo scaffale e' una scelta di chi lo ha arredato, non un errore da
   compattare. E' la differenza con la numerazione densa di prima. */
function posDi(g){ return (g.pos === null || g.pos === undefined) ? null : g.pos; }

function ordineDiLibreria(id){
  if (!id) return 9999;
  const i = librerie.findIndex(function(L){ return L.id === id; });
  return i < 0 ? 9999 : i;
}

const ORDERS = {
  mio: function(a,b){
    const la = ordineDiLibreria(a.libreria), lb = ordineDiLibreria(b.libreria);
    if (la !== lb) return la - lb;
    const pa = a.posto == null ? 99 : a.posto, pb = b.posto == null ? 99 : b.posto;
    if (pa !== pb) return pa - pb;
    const qa = posDi(a), qb = posDi(b);
    if (qa !== null && qb !== null && qa !== qb) return qa - qb;
    return (a.added||0) - (b.added||0);
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

/* --- il nome di un mobile e' unico ---------------------------------
   Due librerie che si chiamano allo stesso modo sono due librerie che
   non si distinguono: il nome e' l'unica cosa che le separa nel
   pannello, sul binario in basso e nella targhetta dentro la scena --
   e in tutti e tre i posti si legge il nome e basta, non l'id.

   Il confronto e' APPIATTITO: maiuscole, accenti e spazi doppi non
   fanno un mobile diverso, fanno solo due nomi che a leggerli sono lo
   stesso. Il controllo sta qui e non nell'interfaccia perche' qui ci
   passano tutte e due le strade -- creare e rinominare -- e perche'
   `store.js` e' l'unico file che sa quali librerie esistono. */
function nomeLib(s){
  return piatto(s).trim().replace(/\s+/g, ' ');
}

function nomeLibPreso(nome, tranne){
  const n = nomeLib(nome);
  if (!n) return false;
  return librerie.some(function(L){
    return L.id !== tranne && nomeLib(L.nome) === n;
  });
}

function corrisponde(g, q){
  if (!q) return true;
  const testo = piatto([g.title, g.sub, g.designer, g.publisher,
                        g.year, (g.tags || []).join(' ')].join(' '));
  return piatto(q).split(/\s+/).filter(Boolean).every(function(p){
    return testo.indexOf(p) >= 0;
  });
}

function list(order, q, gruppo){
  return all()
    .filter(function(g){
      if (gruppo && gruppiDi(g.id).indexOf(gruppo) < 0) return false;
      return corrisponde(g, q);
    })
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
  if (visitata) return null;         // in casa d'altri si guarda e basta
  const next = all().reduce(function(m, x){ return Math.max(m, x.added || 0); }, 0) + 1;
  const game = Object.assign({
    id: '', sub: '', year: '', designer: '', publisher: '',
    players: '', time: '', age: '', weight: '', score: '',
    tags: [], review: (typeof LOREM !== 'undefined' ? LOREM : ['']),
    art: 'generic', wrap: '#4a4632', ink: '#f1e2bd'
  }, g);
  /* Il titolo si taglia qui e non solo nel campo: dal catalogo
     arrivano nomi lunghissimi -- edizione, sottotitolo ed espansione
     tutto attaccato -- e nessun campo li vede passare. */
  game.title = String(game.title || '').trim().slice(0, TITOLO_MAX);
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
        onErrore(TP('err.copertina', {e: messaggio(e)}));
      }
    }

    const r = await c.from('giochi').insert(riga);
    if (r.error) throw r.error;
    await sync();                             // riallinea creato e ordine col server
  } catch(e){
    annulla(game.id);
    onErrore(TP('err.nonAggiunto', {e: messaggio(e)}));
  }
}

/* --- correggere un gioco gia' sullo scaffale ---------------------
   Stessa filosofia dell'aggiunta: la scatola cambia subito, la
   richiesta parte dietro, e se il database rifiuta si torna a com'era.
   `patch` contiene solo i campi toccati. */
function update(id, patch){
  if (visitata) return null;
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
        onErrore(TP('err.copertina', {e: messaggio(e)}));
      }
    }

    // lo slug e' unico DENTRO una collezione, non nel mondo: senza il
    // proprietario questa update parla di tutte le righe con quell'id
    const r = await c.from('giochi').update(riga)
      .eq('proprietario', AUTH.stato().id).eq('id', g.id);
    if (r.error) throw r.error;
    salvaLocale();
  } catch(e){
    Object.keys(prima).forEach(function(k){ g[k] = prima[k]; });
    salvaLocale();
    onErrore(TP('err.nonModificato', {e: messaggio(e)}));
  }
}

/* --- preferiti ---------------------------------------------------
   Un voto alto e un preferito non sono la stessa cosa: un gioco puo'
   valere 7 ed essere quello che tiri fuori sempre. */
function preferito(id){
  const g = get(id);
  return !!(g && g.preferito);
}

async function segnaPreferito(id, si){
  const g = get(id);
  if (!g || visitata) return null;
  /* Non `!!g.preferito`: se era undefined va rimesso undefined. Un
     `false` al posto di un undefined viene spedito al server dalla
     modifica successiva, e su una colonna che non c'e' ancora fa
     fallire un salvataggio che non c'entrava niente. */
  const prima = g.preferito;
  g.preferito = !!si;
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || !remota) return g;
  const r = await c.from('giochi').update({ preferito: !!si })
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error){
    g.preferito = prima;
    salvaLocale();
    onErrore(TP('err.nonPreferito', {e: messaggio(r.error)}));
  }
  return g;
}

/* ============================================================
   LE LIBRERIE

   Sono mobili: hanno un nome, si creano a mano, e ogni gioco sta in un
   posto preciso di una di esse. Fino a qui erano CALCOLATE dal numero
   di giochi e le posizioni erano dense -- non c'era modo di dire
   "questo scaffale e' i party games" ne' di lasciare un cubo libero.

   `librerie` e' l'elenco in ordine, ed e' quello che decide da sinistra
   a destra lungo la parete: l'indice nell'array E' il numero del
   mobile.
   ============================================================ */
let librerie = [];

function elencoLibrerie(){ return librerie; }

/* IL FILTRO SUL PROPRIETARIO VA SCRITTO, come per i giochi: la lettura
   e' aperta agli amici, quindi senza `eq` questa query si porterebbe a
   casa anche i mobili loro. */
async function caricaLibrerie(chi){
  const c = AUTH.attivo() ? AUTH.client() : null;
  const di = chi || (AUTH.stato().dentro ? AUTH.stato().id : null);
  if (!c || !di){ librerie = []; return librerie; }
  try {
    const r = await c.from('librerie').select('*').eq('proprietario', di).order('ordine');
    if (r.error) throw r.error;
    librerie = r.data || [];
  } catch(e){
    librerie = [];
    onErrore(TP('err.librerieNonLette', {e: messaggio(e)}));
  }
  return librerie;
}

/* I tetti dei nomi. Non sono capricci: il nome di una libreria si
   dipinge sulla parete dentro la scena 3D -- piu' e' lungo, piu' la
   scritta rimpicciolisce per starci -- e quello di un gioco vive in
   una riga d'elenco larga come uno schermo di telefono. Il limite sta
   QUI e non solo nel `maxlength` del campo: un valore incollato, o
   arrivato dal catalogo, il campo non lo vede passare. */
const NOME_LIB_MAX = 24;
const NOME_GRU_MAX = 30;
const TITOLO_MAX   = 80;

async function creaLibreria(nome){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  /* Nome e ordine non si contano piu' con `librerie.length`: dopo una
     cancellazione quel numero e' gia' stato usato, e ci si ritrovava
     tre "Libreria 3" tutte con lo stesso `ordine`. Si guarda cosa c'e'
     davvero: l'ordine e' uno piu' del massimo, e il nome sale finche'
     non ne trova uno libero. */
  let ordine = 0, alto = 0;
  librerie.forEach(function(L){
    if ((L.ordine || 0) + 1 > ordine) ordine = (L.ordine || 0) + 1;
    const n = /^Libreria (\d+)$/.exec(String(L.nome || ''));
    if (n && +n[1] > alto) alto = +n[1];
  });
  let scelto = String(nome || '').trim().slice(0, NOME_LIB_MAX);
  if (scelto){
    if (nomeLibPreso(scelto, null)) throw new Error(TP('err.libNomePreso', {n: scelto}));
  } else {
    let k = Math.max(alto, librerie.length) + 1;
    while (nomeLibPreso('Libreria ' + k, null)) k++;
    scelto = 'Libreria ' + k;
  }

  const r = await c.from('librerie').insert({
    proprietario: AUTH.stato().id,
    nome: scelto,
    ordine: ordine
  }).select().single();
  if (r.error) throw r.error;
  librerie.push(r.data);
  return r.data;
}

/* Lo stile di UN mobile: il legno e gli oggetti nei cubi vuoti. Nulli
   vuol dire "come dice la stanza", ed e' il caso di chi non ha mai
   toccato niente. */
async function stileLibreria(id, patch){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const L = librerie.find(function(x){ return x.id === id; });
  if (!L) throw new Error(TP('err.libSconosciuta'));

  const prima = { scaffali: L.scaffali, arredo: L.arredo };
  Object.keys(patch).forEach(function(k){ L[k] = patch[k]; });

  const r = await c.from('librerie').update(patch)
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error){
    L.scaffali = prima.scaffali; L.arredo = prima.arredo;
    if (r.error.code === '42703' || r.error.code === 'PGRST204'){
      throw new Error(TP('err.stileMigr'));
    }
    throw r.error;
  }
  return L;
}

async function rinominaLibreria(id, nome){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const t = String(nome || '').trim().slice(0, NOME_LIB_MAX);
  if (!t) throw new Error(TP('err.serveNome'));
  if (nomeLibPreso(t, id)) throw new Error(TP('err.libNomePreso', {n: t}));
  const r = await c.from('librerie').update({ nome: t })
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error) throw r.error;
  const L = librerie.find(function(x){ return x.id === id; });
  if (L) L.nome = t;
}

/* --- riordinare i MOBILI ------------------------------------------
   `ids` e' l'ordine nuovo, per intero. Vale la stessa regola dei
   giochi: si scrivono solo le righe che cambiano davvero, e la
   scrittura e' ottimista -- i mobili si spostano subito e la richiesta
   parte dietro.

   Cambiare l'ordine dei mobili cambia da che parte stanno lungo la
   parete, quindi tocca anche la posizione delle scatole: chi chiama
   deve rifare la disposizione. */
function riordinaLibrerie(ids){
  if (visitata) return 0;
  const per = {};
  librerie.forEach(function(L){ per[L.id] = L; });

  const cambiati = [];
  ids.forEach(function(id, i){
    const L = per[id];
    if (!L) return;
    if (L.ordine !== i){ L.ordine = i; cambiati.push(L); }
  });
  librerie.sort(function(a, b){ return (a.ordine || 0) - (b.ordine || 0); });

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota && cambiati.length) mandaOrdineLibrerie(c, cambiati);
  return cambiati.length;
}

async function mandaOrdineLibrerie(c, elenco){
  try {
    const esiti = await Promise.all(elenco.map(function(L){
      return c.from('librerie').update({ ordine: L.ordine })
              .eq('proprietario', AUTH.stato().id).eq('id', L.id);
    }));
    const ko = esiti.find(function(r){ return r.error; });
    if (ko) throw ko.error;
  } catch(e){
    onErrore(TP('err.ordineMobili', {e: messaggio(e)}));
  }
}

/* Togliere un mobile non butta via i giochi: la chiave esterna e'
   `on delete set null`, quindi restano senza posto e rifluiscono nei
   cubi liberi delle altre librerie. Cancellare uno scaffale non e'
   cancellare quello che c'era sopra. */
async function togliLibreria(id){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  if (librerie.length <= 1) throw new Error(TP('err.ultimaLib'));
  const r = await c.from('librerie').delete()
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error) throw r.error;
  librerie = librerie.filter(function(x){ return x.id !== id; });
  all().forEach(function(g){
    if (g.libreria === id){ g.libreria = null; g.posto = null; }
  });
  salvaLocale();
}

/* Mettere una scatola in un cubo preciso. `posto` nullo vuol dire
   "toglila dallo scaffale e lasciala rifluire": serve a chi viene
   spostato via da uno scambio. */
function metti(id, libreriaId, posto){
  if (visitata) return null;
  const g = get(id);
  if (!g) return null;
  g.libreria = libreriaId || null;
  g.posto = (posto === null || posto === undefined) ? null : posto;
  salvaLocale();
  return g;
}

/* IN DUE TEMPI, e non e' pignoleria.

   Sul database c'e' un indice unico su `(libreria, posto)` -- un cubo
   tiene una scatola sola -- e uno SCAMBIO scrive due righe che per un
   istante rivendicano lo stesso cubo. Mandate in parallelo, una delle
   due arriva prima e il server rifiuta: chi trascinava un gioco sopra
   un altro vedeva un errore invece di vederli scambiati.

   Quindi prima si sfilano tutte dall'indice (posto nullo, che l'indice
   non guarda), poi si scrive dove vanno davvero. Se il secondo tempo
   fallisce restano senza posto, e lo si dice: `riparaPosti` le rimette
   sullo scaffale al giro dopo. */
async function mandaPosti(giochi){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || !remota || visitata) return;
  const lista = (giochi || []).filter(Boolean);
  if (!lista.length) return;
  /* Com'era PRIMA. Le scritture qui sono ottimiste come tutte le altre,
     ma questa non tornava indietro quando il server diceva di no: la
     scatola restava dov'era stata trascinata, e in memoria due giochi
     rivendicavano lo stesso cubo -- una situazione che sul database non
     puo' nemmeno esistere, perche' c'e' un indice unico a vietarla. Da
     li' in poi la scena mostrava cose che il server non aveva. */
  const prima = lista.map(function(g){
    return { id: g.id, libreria: g.libreria, posto: g.posto };
  });
  try {
    const via = await c.from('giochi').update({ posto: null })
      .eq('proprietario', AUTH.stato().id)
      .in('id', lista.map(function(g){ return g.id; }));
    if (via.error) throw via.error;

    /* E SI LIBERA ANCHE IL CUBO DI DESTINAZIONE.

       Sfilare solo le scatole che si stanno spostando basta per uno
       scambio, dove le due destinazioni sono le due partenze. Non basta
       quando il cubo dove si va e' occupato da qualcun ALTRO sul
       server: li' la seconda fase sbatte contro `giochi_posto_unico` e
       la posizione non si salva.

       E' facilissimo che succeda mettendo in vetrina un gioco dopo
       l'altro: `mandaAlServer` richiama `sync()` dopo ogni inserimento,
       la rilettura azzera la posizione che questa funzione sta ancora
       scrivendo, e il gioco successivo trova "libero" un cubo che
       libero non e'. Da fuori si vede come "posizione non salvata:
       duplicate key value violates unique constraint".

       Un cubo per volta, e solo quelli veri: un `posto` nullo non sta
       nell'indice e non da' fastidio a nessuno. Chi viene sfrattato
       resta senza posto, che e' uno stato legittimo -- `riparaPosti()`
       lo rimette sullo scaffale al giro dopo. */
    const dest = [];
    lista.forEach(function(g){
      if (!g.libreria || g.posto === null || g.posto === undefined) return;
      const k = g.libreria + '#' + g.posto;
      if (dest.indexOf(k) < 0) dest.push(k);
    });
    const ids = lista.map(function(g){ return g.id; });
    for (let i = 0; i < dest.length; i++){
      const pezzi = dest[i].split('#');
      const libero = await c.from('giochi').update({ posto: null })
        .eq('proprietario', AUTH.stato().id)
        .eq('libreria', pezzi[0]).eq('posto', Number(pezzi[1]))
        .not('id', 'in', '(' + ids.map(function(x){ return '"' + x + '"'; }).join(',') + ')');
      if (libero.error) throw libero.error;
    }

    const esiti = await Promise.all(lista.map(function(g){
      return c.from('giochi')
        .update({ libreria: g.libreria, posto: g.posto })
        .eq('proprietario', AUTH.stato().id).eq('id', g.id);
    }));
    const ko = esiti.find(function(r){ return r.error; });
    if (ko) throw ko.error;
  } catch(e){
    prima.forEach(function(v){
      const g = get(v.id);
      if (g){ g.libreria = v.libreria; g.posto = v.posto; }
    });
    salvaLocale();
    onRipristino();                 // e la scena torna in pari con i dati
    onErrore(TP('err.posizione', {e: messaggio(e)}));
  }
}

/* ============================================================
   I GRUPPI

   Etichette, non contenitori. Una libreria risponde a "dove sta", un
   gruppo a "che cos'e'": Root sta nel mobile del salotto ed e' insieme
   "strategico" e "asimmetrico". Per questo un gioco ne ha quanti ne
   vuole, e per questo i gruppi non si vedono sullo scaffale -- si
   vedono nella scheda e nell'elenco, che e' dove uno cerca per
   categoria.
   ============================================================ */
let gruppi = [];             // [{id, nome, colore}]
let appartiene = {};         // id del gioco -> [id dei gruppi]

function elencoGruppi(){ return gruppi; }
function gruppiDi(id){ return appartiene[id] || []; }

async function caricaGruppi(chi){
  const c = AUTH.attivo() ? AUTH.client() : null;
  const di = chi || (AUTH.stato().dentro ? AUTH.stato().id : null);
  if (!c || !di){ gruppi = []; appartiene = {}; return gruppi; }
  try {
    // il filtro sul proprietario si scrive: la lettura e' aperta agli amici
    const g = await c.from('gruppi').select('*').eq('proprietario', di).order('nome');
    if (g.error) throw g.error;
    const m = await c.from('giochi_gruppi').select('gruppo,gioco').eq('proprietario', di);
    if (m.error) throw m.error;

    gruppi = g.data || [];
    appartiene = {};
    (m.data || []).forEach(function(x){
      (appartiene[x.gioco] = appartiene[x.gioco] || []).push(x.gruppo);
    });
  } catch(e){
    gruppi = []; appartiene = {};
    onErrore(TP('err.gruppiNonLetti', {e: messaggio(e)}));
  }
  return gruppi;
}

async function creaGruppo(nome){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const t = String(nome || '').trim().slice(0, NOME_GRU_MAX);
  if (!t) throw new Error(TP('err.serveNome'));
  const r = await c.from('gruppi')
    .insert({ proprietario: AUTH.stato().id, nome: t }).select().single();
  if (r.error){
    if (r.error.code === '23505') throw new Error(TP('err.ceGia', {n: t}));
    throw r.error;
  }
  gruppi.push(r.data);
  gruppi.sort(function(a,b){ return String(a.nome).localeCompare(String(b.nome), 'it'); });
  return r.data;
}

async function rinominaGruppo(id, nome){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const t = String(nome || '').trim().slice(0, NOME_GRU_MAX);
  if (!t) throw new Error(TP('err.serveNome'));
  const r = await c.from('gruppi').update({ nome: t })
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error){
    if (r.error.code === '23505') throw new Error(TP('err.ceGia', {n: t}));
    throw r.error;
  }
  const G = gruppi.find(function(x){ return x.id === id; });
  if (G) G.nome = t;
}

/* Togliere un gruppo non tocca i giochi: sparisce l'etichetta, non
   quello che era etichettato. Le righe di `giochi_gruppi` se ne vanno
   in cascata. */
async function togliGruppo(id){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const r = await c.from('gruppi').delete()
    .eq('proprietario', AUTH.stato().id).eq('id', id);
  if (r.error) throw r.error;
  gruppi = gruppi.filter(function(x){ return x.id !== id; });
  Object.keys(appartiene).forEach(function(k){
    appartiene[k] = appartiene[k].filter(function(x){ return x !== id; });
  });
}

/* Mettere e togliere un gioco da un gruppo. Ottimista come il resto:
   l'etichetta compare subito e la riga parte dietro. */
async function segnaGruppo(gioco, gruppo, dentro){
  const c = AUTH.attivo() ? AUTH.client() : null;
  if (!c || visitata) throw new Error(TP('err.nonSiPuo'));
  const ora = appartiene[gioco] || (appartiene[gioco] = []);

  if (dentro){
    if (ora.indexOf(gruppo) < 0) ora.push(gruppo);
    const r = await c.from('giochi_gruppi').insert({
      gruppo: gruppo, proprietario: AUTH.stato().id, gioco: gioco
    });
    // 23505: c'era gia'. Non e' un errore, e' lo stesso stato voluto.
    if (r.error && r.error.code !== '23505'){
      appartiene[gioco] = ora.filter(function(x){ return x !== gruppo; });
      throw r.error;
    }
  } else {
    appartiene[gioco] = ora.filter(function(x){ return x !== gruppo; });
    const r = await c.from('giochi_gruppi').delete()
      .eq('proprietario', AUTH.stato().id).eq('gruppo', gruppo).eq('gioco', gioco);
    if (r.error){ ora.push(gruppo); throw r.error; }
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
  if (visitata) return 0;
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
      return c.from('giochi').update({ posizione: g.pos })
              .eq('proprietario', AUTH.stato().id).eq('id', g.id);
    }));
    const ko = esiti.find(function(r){ return r.error; });
    if (ko) throw ko.error;
  } catch(e){
    onErrore(TP('err.ordineGiochi', {e: messaggio(e)}));
  }
}

function remove(id){
  if (visitata) return null;
  const i = all().findIndex(function(g){ return g.id === id; });
  if (i < 0) return null;
  const out = games.splice(i, 1)[0];
  salvaLocale();

  const c = AUTH.attivo() ? AUTH.client() : null;
  if (c && remota){
    /* `.select()` non e' un vezzo: senza, una cancellazione che non
       tocca NESSUNA riga torna indietro come un successo pulito -- e'
       cosi' che risponde PostgREST quando le regole non lasciano
       passare quella riga, o quando l'id non e' piu' quello. Il gioco
       spariva dallo scaffale, nessuno diceva niente, e al primo
       ricaricamento era di nuovo li'. Con il `select` la risposta porta
       le righe cancellate: se sono zero e' un guasto, e si dice. */
    c.from('giochi').delete()
      .eq('proprietario', AUTH.stato().id).eq('id', id)
      .select('id').then(function(r){
      if (r.error || !(r.data && r.data.length)){
        all().push(out);
        salvaLocale();
        onErrore(r.error ? TP('err.nonTolto', {e: messaggio(r.error)})
                         : TP('err.nonToltoZero', {g: out.title || id}));
        onRipristino();
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
    return TP('err.nonAdmin');
  }
  /* Colonna inesistente: succede una volta sola, quando una migrazione
     e' nel repo ma non e' ancora applicata al progetto. Il messaggio di
     Postgres dice quale colonna manca; qui si dice quale MIGRAZIONE, che
     e' l'unica cosa su cui si possa agire. */
  if (err && (err.code === '42703' || err.code === 'PGRST204')){
    /* Non si estrae il nome della colonna con una regex: Postgres dice
       `column giochi.preferito does not exist` e PostgREST dice
       `Could not find the 'preferito' column of 'giochi'`, e un'unica
       espressione che le prenda tutte e due prendeva la lettera
       sbagliata. Si cerca il nome che si conosce dentro il messaggio,
       che e' l'unica cosa che funziona con tutti e due. */
    if (/posizione/.test(m)) return TP('err.ordineMigr');
    if (/preferito|scaffali|arredo/.test(m)) return TP('err.stileMigr');
    if (/libreria|posto|stanza/.test(m)) return TP('err.stanzaMigr');
    return TP('err.colonnaIgnota');
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
  preferito: preferito, segnaPreferito: segnaPreferito,
  stileLibreria: stileLibreria,
  visita: visita, torna: torna, ospitePresso: ospitePresso,
  librerie: elencoLibrerie, caricaLibrerie: caricaLibrerie,
  creaLibreria: creaLibreria, rinominaLibreria: rinominaLibreria,
  togliLibreria: togliLibreria, riordinaLibrerie: riordinaLibrerie, metti: metti, mandaPosti: mandaPosti,
  gruppi: elencoGruppi, gruppiDi: gruppiDi, caricaGruppi: caricaGruppi,
  creaGruppo: creaGruppo, rinominaGruppo: rinominaGruppo,
  togliGruppo: togliGruppo, segnaGruppo: segnaGruppo,
  eRemota: function(){ return remota; },
  suErrore: function(fn){ onErrore = fn; },
  suRipristino: function(fn){ onRipristino = fn; },
  nomeLibPreso: nomeLibPreso,
  orders: Object.keys(ORDERS)
};
})();
