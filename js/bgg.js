/* ============================================================
   Ricerca su BoardGameGeek.

   Non si puo' chiamare l'API dal browser, e non e' una pigrizia:
   dal 2025 la XML API risponde 401 senza header Authorization, il
   token non si puo' mettere nel JavaScript di una pagina pubblica, e
   le condizioni di BGG dicono di fare le richieste da server. In piu'
   le immagini di cf.geekdo-images.com non mandano header CORS, quindi
   come texture WebGL sono inutilizzabili da un altro dominio.

   Quindi si passa da tools/bgg-proxy.mjs, che gira in locale, tiene
   lui il token e rimette gli header giusti. Se non e' acceso la
   ricerca lo dice e resta il modulo a mano.
   ============================================================ */
const BGG = (function(){
'use strict';

const PROXY = 'http://localhost:8125';

/* Il proxy o c'e' o non c'e', e sta su localhost: se non risponde in
   quattro decimi di secondo non risponde. Senza questo taglio la richiesta a una porta
   chiusa restava appesa un paio di secondi, ed erano un paio di secondi
   prima di vedere qualunque cosa nel catalogo -- prima non si notavano
   perche' la fonte di ripiego era Wikidata, che ce ne metteva altri
   due; adesso che dietro c'e' un file gia' in casa, era l'unica
   attesa rimasta. */
function ping(){
  const stop = new AbortController();
  const t = setTimeout(function(){ stop.abort(); }, 400);
  return fetch(PROXY + '/ping', { cache: 'no-store', signal: stop.signal })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ return j ? { su: true, token: !!j.token } : { su: false }; })
    .catch(function(){ return { su: false }; })
    .finally(function(){ clearTimeout(t); });
}

async function cerca(q){
  const r = await fetch(PROXY + '/search?q=' + encodeURIComponent(q));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function scheda(id){
  const r = await fetch(PROXY + '/game?id=' + encodeURIComponent(id));
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
    const r = await fetch(PROXY + '/thumbs?ids=' + encodeURIComponent(lista.join(',')));
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
  const r = await fetch(PROXY + '/cover?id=' + encodeURIComponent(id));
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
  miniature: miniature, copertina: copertina, PROXY: PROXY };
})();
