/* ============================================================
   Da dove arrivano le schede dei giochi.

   Due fonti, scelte da sole:

   - BGG, attraverso tools/bgg-proxy.mjs, quando il proxy e' acceso e
     ha un token approvato. E' la fonte buona: 175.000 titoli, dati
     curati, copertine vere delle scatole.
   - Wikidata, altrimenti. Aperta, gratis, senza chiave e con gli
     header CORS a posto, quindi la si interroga dal browser senza
     niente in mezzo. Ma sono circa 4.400 giochi invece di 175.000, i
     dati sono piu' magri e a volte sbagliati (l'editore e' spesso il
     distributore locale) e l'immagine e' quasi sempre una FOTO DEL
     GIOCO ALLESTITO, non la copertina.

   Per questo un risultato non viene mai messo sullo scaffale al volo:
   riempie il modulo, e chi lo aggiunge controlla prima di salvare.
   Quando arrivera' il token non c'e' niente da cambiare: il proxy
   risponde, e la fonte passa a BGG da sola.
   ============================================================ */
const CATALOGO = (function(){
'use strict';

const SPARQL = 'https://query.wikidata.org/sparql';
const GIOCO_DA_TAVOLO = 'wd:Q131436';

let fonteScelta = null;

/* --- quale fonte usare ----------------------------------------- */
async function fonte(rileggi){
  if (fonteScelta && !rileggi) return fonteScelta;
  const s = await BGG.ping();
  fonteScelta = (s.su && s.token) ? 'bgg' : 'wikidata';
  return fonteScelta;
}

/* --- Wikidata --------------------------------------------------- */
function query(sparql){
  const url = SPARQL + '?query=' + encodeURIComponent(sparql) + '&format=json';
  return fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } })
    .then(function(r){
      if (!r.ok) throw new Error('Wikidata HTTP ' + r.status);
      return r.json();
    });
}

const val = (b, k) => (b[k] && b[k].value) || '';

/* Una sola chiamata: il servizio di ricerca di Wikidata trova i
   candidati, e la stessa query li filtra tenendo solo quelli che sono
   giochi da tavolo e ne prende i campi. */
function sparqlCerca(q){
  const testo = String(q).replace(/["\\]/g, ' ');
  return [
    'SELECT ?g ?nome ?anno ?bgg',
    '  (SAMPLE(?autoreL) AS ?autore)',
    '  (GROUP_CONCAT(DISTINCT ?editoreL; separator=" / ") AS ?editori)',
    '  (SAMPLE(?min) AS ?minp) (SAMPLE(?max) AS ?maxp)',
    '  (SAMPLE(?dur) AS ?durata) (SAMPLE(?img) AS ?immagine)',
    'WHERE {',
    '  SERVICE wikibase:mwapi {',
    '    bd:serviceParam wikibase:api "EntitySearch" ; wikibase:endpoint "www.wikidata.org" ;',
    '                    mwapi:search "' + testo + '" ; mwapi:language "en" ; mwapi:limit "50" .',
    '    ?g wikibase:apiOutputItem mwapi:item .',
    '  }',
    '  ?g wdt:P31/wdt:P279* ' + GIOCO_DA_TAVOLO + ' .',
    '  ?g rdfs:label ?nome . FILTER(LANG(?nome) = "en")',
    '  OPTIONAL { ?g wdt:P577 ?d . BIND(YEAR(?d) AS ?anno) }',
    '  OPTIONAL { ?g wdt:P178 ?a . ?a rdfs:label ?autoreL . FILTER(LANG(?autoreL) = "en") }',
    '  OPTIONAL { ?g wdt:P123 ?e . ?e rdfs:label ?editoreL . FILTER(LANG(?editoreL) = "en") }',
    '  OPTIONAL { ?g wdt:P1872 ?min }',
    '  OPTIONAL { ?g wdt:P1873 ?max }',
    '  OPTIONAL { ?g wdt:P2047 ?dur }',
    '  OPTIONAL { ?g wdt:P18 ?img }',
    '  OPTIONAL { ?g wdt:P2339 ?bgg }',
    '} GROUP BY ?g ?nome ?anno ?bgg LIMIT 12'
  ].join('\n');
}

function daWikidata(b){
  const min = val(b,'minp'), max = val(b,'maxp'), dur = val(b,'durata');
  const editori = val(b,'editori');
  return {
    fonte: 'wikidata',
    id: val(b,'g').split('/').pop(),          // il codice Q
    title: val(b,'nome'),
    year: val(b,'anno'),
    designer: val(b,'autore'),
    // Wikidata elenca anche i distributori locali: si tiene il primo e
    // si lascia correggere a mano, e' il campo meno affidabile di tutti
    publisher: editori ? editori.split(' / ')[0] : '',
    players: (min && max) ? (min + '-' + max) : (min || max || ''),
    time: dur ? String(Math.round(parseFloat(dur))) : '',
    bgg: val(b,'bgg'),
    immagine: val(b,'immagine')
  };
}

async function cercaWikidata(q){
  const r = await query(sparqlCerca(q));
  return (r.results.bindings || []).map(daWikidata);
}

/* --- ricerca, qualunque sia la fonte ---------------------------- */
async function cerca(q){
  const f = await fonte();
  if (f === 'bgg'){
    const hits = await BGG.cerca(q);
    return hits.map(function(h){
      return { fonte: 'bgg', id: String(h.id), title: h.title, year: h.year || '', bgg: h.id };
    });
  }
  return cercaWikidata(q);
}

/* La scheda completa. Da Wikidata ce l'abbiamo gia' dalla ricerca; da
   BGG serve una seconda chiamata al proxy. */
async function dettagli(voce){
  if (voce.fonte !== 'bgg') return voce;
  const g = await BGG.scheda(voce.id);
  return {
    fonte: 'bgg', id: String(voce.id), title: g.title, year: g.year,
    designer: g.designer, publisher: g.publisher, players: g.players,
    time: g.time, age: g.age, weight: g.weight, score: g.score,
    tags: g.tags, bgg: g.bgg, immagine: g.image
  };
}

/* --- la copertina ----------------------------------------------
   Ridisegnata su canvas a larghezza contenuta e restituita come data
   URL: da li' store.js la carica nel bucket. Le immagini di Wikimedia
   mandano gli header CORS, quindi si possono leggere davvero -- e non
   e' scontato: quelle di BGG no, ed e' il motivo per cui da quella
   parte serve il proxy. */
/* L'indirizzo diretto della miniatura, chiesto all'API di Commons.

   Non si costruisce a mano e non si usa Special:FilePath, per due
   motivi che si scoprono solo provando dal browser:

   - Special:FilePath risponde con un redirect verso upload.wikimedia.org,
     e in una richiesta CORS *ogni* passaggio della catena deve avere
     l'header: quello intermedio non ce l'ha, e il browser blocca. Con
     curl non si vede, perche' curl guarda solo la risposta finale.
   - le larghezze delle miniature sono un elenco fisso: chiederne una
     fuori elenco (900) restituisce 400. L'API la arrotonda da sola. */
async function miniatura(fileUrl){
  const nome = decodeURIComponent(String(fileUrl).split('/').pop());
  const api = 'https://commons.wikimedia.org/w/api.php' +
    '?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=900' +
    '&titles=' + encodeURIComponent('File:' + nome);
  const r = await fetch(api);
  if (!r.ok) throw new Error('Commons HTTP ' + r.status);
  const d = await r.json();
  const pagine = (d.query && d.query.pages) || {};
  for (const k in pagine){
    const ii = (pagine[k].imageinfo || [])[0];
    if (ii && ii.thumburl) return ii.thumburl;
    if (ii && ii.url) return ii.url;
  }
  throw new Error('miniatura non trovata');
}

async function copertina(voce){
  if (voce.fonte === 'bgg') return BGG.copertina(voce.id);
  if (!voce.immagine) throw new Error('nessuna immagine');

  const url = await miniatura(voce.immagine);
  const im = await new Promise(function(res, rej){
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = function(){ res(i); };
    i.onerror = function(){ rej(new Error('immagine non caricata')); };
    i.src = url;
  });

  const W = Math.min(760, im.naturalWidth);
  const H = Math.round(im.naturalHeight * (W / im.naturalWidth));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(im, 0, 0, W, H);
  return c.toDataURL('image/jpeg', .82);
}

return { fonte: fonte, cerca: cerca, dettagli: dettagli, copertina: copertina };
})();
