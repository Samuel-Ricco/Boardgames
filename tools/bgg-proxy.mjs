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
import { api, parseSearch, parseGame, parseMisure, token } from './bgg-lib.mjs';

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
      /* BGG non ordina per pertinenza, e lasciarlo fare porta il gioco
         VERO in fondo: cercando "arcs" uscivano prima tre espansioni del
         2027 e Arcs quarto, perche' cominciano tutte per "arcs" e a
         parita' vinceva l'anno piu' recente.

         Stesso ordine dell'indice in casa (`js/bggdump.js`): prima chi
         si chiama esattamente cosi', poi chi comincia cosi', poi il
         resto -- e solo DENTRO ogni gruppo decide l'anno. Chi cerca un
         titolo cerca quel titolo, non la sua ultima espansione. */
      const qq = q.toLowerCase();
      const rango = function(t){
        const p = t.toLowerCase();
        return p === qq ? 0 : (p.indexOf(qq) === 0 ? 1 : 2);
      };
      const hits = parseSearch(r.xml).sort(function(a, b){
        const d = rango(a.title) - rango(b.title);
        if (d) return d;
        return (b.year || 0) - (a.year || 0);
      });
      return json(res, 200, hits.slice(0, 12));
    }

    /* LE MINIATURE PER L'ELENCO, molte in una chiamata sola.

       `/thing` accetta gli id separati da virgola, quindi una pagina di
       catalogo -- ventiquattro giochi -- costa UNA richiesta invece di
       ventiquattro. Misurato: sei giochi in 340 ms.

       Qui torna solo l'indirizzo, non l'immagine: la miniatura finisce
       in un `<img>` e basta, e per quello il browser non ha bisogno ne'
       di CORS ne' del proxy. Rilanciare i byte servirebbe solo alla
       copertina, che invece va letta davvero (vedi `/cover`). */
    if (url.pathname === '/thumbs'){
      const ids = (url.searchParams.get('ids') || '')
        .split(',').map(function(x){ return x.trim(); })
        .filter(function(x){ return /^\d+$/.test(x); }).slice(0, 40);
      if (!ids.length) return json(res, 400, { error: 'mancano gli ids' });
      /* VENTI PER VOLTA: oltre, BGG risponde "Cannot load more than 20
         items" con un 400. Una pagina di catalogo ne ha ventiquattro,
         quindi sono due richieste -- e la divisione la fa il proxy,
         che e' l'unico pezzo che deve sapere come si parla con BGG.

         In fila e non insieme: sono due, e su un'API pubblica il modo
         piu' rapido di prendersi un limite e' chiederle tutte in
         parallelo. */
      const out = {};
      for (let i = 0; i < ids.length; i += 20){
        const r = await api('/thing?id=' + ids.slice(i, i + 20).join(','));
        if (r.queued) continue;             // in coda: si prende quello che c'e'
        const re = /<item[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
        let m;
        while ((m = re.exec(r.xml))){
          const th = m[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/);
          if (th) out[m[1]] = th[1].trim();
        }
      }
      return json(res, 200, out);
    }

    /* LE MISURE DELLA SCATOLA.

       Costano care in banda -- le edizioni di un gioco sono decine, e
       `versions=1` porta 70 KB per gioco -- ma il conto lo paga il
       proxy: al browser tornano tre numeri. Dieci per volta e non
       venti: qui la risposta e' grossa, e mezzo megabyte alla volta
       basta e avanza. */
    if (url.pathname === '/misure'){
      const ids = (url.searchParams.get('ids') || '')
        .split(',').map(function(x){ return x.trim(); })
        .filter(function(x){ return /^\d+$/.test(x); }).slice(0, 30);
      if (!ids.length) return json(res, 400, { error: 'mancano gli ids' });
      const out = {};
      for (let i = 0; i < ids.length; i += 10){
        const r = await api('/thing?id=' + ids.slice(i, i + 10).join(',') + '&versions=1');
        if (r.queued) continue;
        /* UN'ESPANSIONE NON E' `type="boardgame"`.

           E' `boardgameexpansion`, e le accessorie sono
           `boardgameaccessory`. Chiedendo solo `type="boardgame"` le
           espansioni sparivano dal ritaglio, quindi non arrivavano mai a
           `parseMisure` e restavano SENZA MISURE -- e senza misure la
           scatola cade nel ripiego, cioe' larga quanto una scatola
           intera. La mini di Deep Regrets e' 8 x 13,5 cm e finiva
           disegnata 30 x 41.

           Il `(?!version)` e' obbligatorio: anche le EDIZIONI sono
           `<item>`, annidate dentro `<versions>`, e un `boardgame[a-z]*`
           le prenderebbe -- spezzando il ritaglio proprio dove serve
           intero, cioe' attorno alle misure. */
        const GIOCO = '<item[^>]*type="boardgame(?!version)[a-z]*"';
        const re = new RegExp(GIOCO + '[^>]*id="(\\d+)"[^>]*>([\\s\\S]*?)<\\/item>\\s*(?=' + GIOCO + '|<\\/items>)', 'g');
        let m;
        while ((m = re.exec(r.xml))){
          const mis = parseMisure(m[2]);
          if (mis) out[m[1]] = mis;
        }
      }
      return json(res, 200, out);
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
