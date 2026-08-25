/* ============================================================
   Ricerca su BoardGameGeek.

   Non si puo' chiamare l'API dal browser, e non e' una pigrizia:
   dal 2025 la XML API risponde 401 senza header Authorization, il
   token non si puo' mettere nel JavaScript di una pagina pubblica, e
   le condizioni di BGG dicono di fare le richieste da server. In piu'
   le immagini di cf.geekdo-images.com non mandano header CORS, quindi
   come texture WebGL sono inutilizzabili da un altro dominio.

   Quindi si passa da un server. Ce ne sono DUE, con gli stessi identici
   endpoint, e il client non deve sapere quale sta usando:

   - `tools/bgg-proxy.mjs`, che gira in locale sulla 8125. E' la strada
     di chi sviluppa: il token sta in `.bgg-token`, non serve nessun
     deploy, e le risposte arrivano in pochi millisecondi.
   - `supabase/functions/bgg`, la edge function. E' la strada di tutti
     gli altri: il token sta nei secrets del progetto, il browser non lo
     vede mai, e funziona da qualunque parte -- anche da GitHub Pages,
     dove il proxy locale ovviamente non c'e'.

   Si prova prima quello locale, con il suo taglio di quattro decimi, e
   se non risponde si passa alla funzione. Se non c'e' nessuno dei due
   la ricerca lo dice e resta il modulo a mano.
   ============================================================ */
const BGG = (function(){
'use strict';

const LOCALE = 'http://localhost:8125';
const REMOTA = (typeof SUPABASE !== 'undefined' && SUPABASE && SUPABASE.url)
  ? String(SUPABASE.url).replace(/\/+$/, '') + '/functions/v1/bgg' : '';

/* Quale dei due si e' rivelato vivo. Si decide una volta per sessione:
   `ping()` la riempie e tutto il resto la legge. Nullo vuol dire
   "non ancora chiesto", stringa vuota "nessuno dei due". */
let base = null;

/* La funzione vuole la chiave pubblica del progetto, come ogni altra
   chiamata a Supabase. Il proxy locale non vuole niente, e mandargliela
   non gli da' fastidio. */
function testa(){
  return (base === REMOTA && typeof SUPABASE !== 'undefined' && SUPABASE.key)
    ? { apikey: SUPABASE.key, Authorization: 'Bearer ' + SUPABASE.key }
    : {};
}

function chiama(path, opt){
  if (!base) return Promise.reject(new Error('nessun server BGG'));
  return fetch(base + path, Object.assign({ headers: testa() }, opt || {}));
}

/* Il proxy o c'e' o non c'e', e sta su localhost: se non risponde in
   quattro decimi di secondo non risponde. Senza questo taglio la richiesta a una porta
   chiusa restava appesa un paio di secondi, ed erano un paio di secondi
   prima di vedere qualunque cosa nel catalogo -- prima non si notavano
   perche' la fonte di ripiego era Wikidata, che ce ne metteva altri
   due; adesso che dietro c'e' un file gia' in casa, era l'unica
   attesa rimasta. */
function provaUno(url, ms, headers){
  const stop = new AbortController();
  const t = setTimeout(function(){ stop.abort(); }, ms);
  return fetch(url + '/ping', { cache: 'no-store', signal: stop.signal, headers: headers || {} })
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; })
    .finally(function(){ clearTimeout(t); });
}

let inCorso = null;
let statoToken = false;

function ping(){
  if (base !== null){
    return Promise.resolve(base ? { su: true, token: statoToken } : { su: false });
  }
  if (inCorso) return inCorso;
  /* Prima il locale, e solo se tace la funzione. Il taglio e' piu'
     lungo per la remota: e' un giro di rete vero, non una porta
     accanto, e la prima chiamata puo' dover svegliare la funzione. */
  const chiaveRemota = (typeof SUPABASE !== 'undefined' && SUPABASE.key)
    ? { apikey: SUPABASE.key, Authorization: 'Bearer ' + SUPABASE.key } : {};
  inCorso = provaUno(LOCALE, 400).then(function(j){
    if (j){ base = LOCALE; statoToken = !!j.token; return { su: true, token: statoToken }; }
    if (!REMOTA){ base = ''; return { su: false }; }
    return provaUno(REMOTA, 6000, chiaveRemota).then(function(k){
      if (k){ base = REMOTA; statoToken = !!k.token; return { su: true, token: statoToken }; }
      base = '';
      return { su: false };
    });
  }).finally(function(){ inCorso = null; });
  return inCorso;
}

async function cerca(q){
  await ping();
  const r = await chiama('/search?q=' + encodeURIComponent(q));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function scheda(id){
  await ping();
  const r = await chiama('/game?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* Le miniature di un blocco di giochi, in una chiamata sola. Se il
   proxy non c'e' o BGG fa i capricci non e' un guasto: l'elenco resta
   con le iniziali, che e' quello che ha sempre fatto. */
async function miniature(ids){
  const lista = (ids || []).filter(Boolean).slice(0, 40);
  if (!lista.length) return {};
  try {
    await ping();
    const r = await chiama('/thumbs?ids=' + encodeURIComponent(lista.join(',')));
    if (!r.ok) return {};
    const o = await r.json();
    return (o && !o.queued) ? o : {};
  } catch(e){ return {}; }
}

/* Le misure della scatola di un blocco di giochi. Come le miniature:
   se il proxy non c'e' non e' un guasto, le scatole restano com'erano. */
async function misure(ids){
  const lista = (ids || []).filter(Boolean).slice(0, 30);
  if (!lista.length) return {};
  try {
    await ping();
    const r = await chiama('/misure?ids=' + encodeURIComponent(lista.join(',')));
    if (!r.ok) return {};
    const o = await r.json();
    return (o && !o.queued) ? o : {};
  } catch(e){ return {}; }
}

/* La copertina arriva dal proxy (che le rimette gli header CORS), viene
   ridisegnata su canvas a larghezza contenuta e salvata come data URL:
   cosi' resta nella libreria anche quando il proxy e' spento, e non
   riempie localStorage con un'immagine da due megapixel. */
async function copertina(id){
  await ping();
  const r = await chiama('/cover?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise(function(res, rej){
      const i = new Image();
      i.onload = function(){ res(i); };
      i.onerror = rej;
      i.src = url;
    });
    const W = Math.min(760, im.naturalWidth);
    const H = Math.round(im.naturalHeight * (W / im.naturalWidth));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(im, 0, 0, W, H);
    return c.toDataURL('image/jpeg', .82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

return { ping: ping, cerca: cerca, scheda: scheda,
  miniature: miniature, misure: misure, copertina: copertina,
  // a che server si e' attaccato: serve solo a chi diagnostica
  dove: function(){ return base; }, LOCALE: LOCALE, REMOTA: REMOTA };
})();
