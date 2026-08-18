/* ============================================================
   Proxy locale per la ricerca dell'admin.

       $env:BGG_TOKEN='...'        (PowerShell)
       node tools/bgg-proxy.mjs

   Sta in ascolto su :8125 e fa tre cose che il browser non puo' fare
   da solo: mette l'header Authorization con il token (senza, BGG
   risponde 401), rimette gli header CORS sulle risposte, e rilancia
   l'immagine di copertina, che su cf.geekdo-images.com arriva senza
   CORS e quindi come texture WebGL sarebbe inutilizzabile.

   Serve solo all'admin, e solo mentre aggiunge giochi: il sito
   pubblico non lo chiama mai.
   ============================================================ */

import http from 'node:http';
import { api, parseSearch, parseGame, token } from './bgg-lib.mjs';

const PORT = 8125;

function send(res, code, body, type){
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));

async function schedaDi(id){
  const r = await api('/thing?id=' + encodeURIComponent(id) + '&stats=1');
  if (r.queued) return null;
  return parseGame(r.xml, id);
}

const server = http.createServer(async function(req, res){
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    if (url.pathname === '/ping'){
      return json(res, 200, { ok: true, token: !!token() });
    }

    if (url.pathname === '/search'){
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json(res, 400, { error: 'manca q' });
      const r = await api('/search?type=boardgame&query=' + encodeURIComponent(q));
      if (r.queued) return json(res, 202, { queued: true });
      // BGG non ordina per pertinenza: i titoli che cominciano come la
      // ricerca vengono prima, gli altri dopo, e i piu' recenti in cima.
      const qq = q.toLowerCase();
      const hits = parseSearch(r.xml).sort(function(a, b){
        const ap = a.title.toLowerCase().indexOf(qq) === 0 ? 0 : 1;
        const bp = b.title.toLowerCase().indexOf(qq) === 0 ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return (b.year || 0) - (a.year || 0);
      });
      return json(res, 200, hits.slice(0, 12));
    }

    if (url.pathname === '/game'){
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'manca id' });
      const g = await schedaDi(id);
      if (!g) return json(res, 202, { queued: true });
      return json(res, 200, g);
    }

    if (url.pathname === '/cover'){
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'manca id' });
      const g = await schedaDi(id);
      if (!g || !g.image) return json(res, 404, { error: 'nessuna immagine' });
      const im = await fetch(g.image, {
        headers: { 'User-Agent': 'il-dado-e-trap/1.0 (proxy locale)' }
      });
      if (!im.ok) return json(res, im.status, { error: 'immagine non scaricata' });
      const buf = Buffer.from(await im.arrayBuffer());
      return send(res, 200, buf, im.headers.get('content-type') || 'image/jpeg');
    }

    return json(res, 404, { error: 'niente qui' });

  } catch (e){
    // 401 = token mancante o non approvato: e' il caso piu' probabile,
    // e va detto chiaro invece di finire in un generico "errore".
    const code = e.status === 401 ? 401 : 500;
    return json(res, code, {
      error: e.message,
      hint: code === 401
        ? "BGG rifiuta la richiesta: registra l'applicazione su boardgamegeek.com/applications e metti il token in BGG_TOKEN."
        : undefined
    });
  }
});

server.listen(PORT, function(){
  console.log('proxy BGG su http://localhost:' + PORT);
  console.log(token()
    ? 'token presente.'
    : 'ATTENZIONE: BGG_TOKEN non impostato, BGG rispondera\' 401.');
});
