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

async function ping(){
  try {
    const r = await fetch(PROXY + '/ping', { cache: 'no-store' });
    if (!r.ok) return { su: false };
    const j = await r.json();
    return { su: true, token: !!j.token };
  } catch(e){
    return { su: false };
  }
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

return { ping: ping, cerca: cerca, scheda: scheda, copertina: copertina, PROXY: PROXY };
})();
