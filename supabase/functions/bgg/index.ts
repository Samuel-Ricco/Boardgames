/* ============================================================
   BGG, dal server.

   E' il gemello di `tools/bgg-proxy.mjs`, con gli stessi identici
   endpoint -- e per questo il client non deve sapere quale dei due sta
   usando: prova prima quello locale, e se non c'e' viene qui.

   Perche' esiste: il token di BGG non puo' stare nel JavaScript di una
   pagina pubblica, e le condizioni di BGG dicono di fare le richieste
   da server. Finche' il token stava solo su `.bgg-token`, tutto quello
   che ci passa -- schede, miniature, misure delle scatole, copertine
   vere -- funzionava sulla macchina di sviluppo e su GitHub Pages no.
   Qui il token sta nei secrets del progetto e il browser non lo vede
   mai.

   Deploy:
       supabase secrets set BGG_TOKEN=...
       supabase functions deploy bgg --no-verify-jwt

   `--no-verify-jwt` perche' il sito usa una chiave `sb_publishable_`,
   che non e' un JWT: con la verifica accesa nemmeno chi e' entrato
   passerebbe. Non e' un buco: qui dentro non si legge e non si scrive
   niente di nessuno, si rilancia un'API pubblica. Chi vuole stringere
   metta `BGG_ORIGINI` con gli indirizzi ammessi, separati da virgola.
   ============================================================ */

const BASE = 'https://boardgamegeek.com/xmlapi2';

const token = () => Deno.env.get('BGG_TOKEN') || '';

/* Gli indirizzi ammessi. Vuoto vuol dire "chiunque": non e' vera
   sicurezza -- l'header `Origin` lo scrive il browser e un client che
   browser non e' scrive quello che vuole -- ma toglie di mezzo il riuso
   distratto da un altro sito. */
function corsPer(origin: string | null): Record<string, string> {
  const ammessi = (Deno.env.get('BGG_ORIGINI') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !ammessi.length || (origin !== null && ammessi.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

async function api(path: string): Promise<{ queued?: boolean; xml?: string }> {
  const t = token();
  const res = await fetch(BASE + path, {
    headers: t ? { Authorization: 'Bearer ' + t } : {},
  });
  if (res.status === 202) return { queued: true };          // BGG mette in coda
  if (!res.ok) throw new Error('BGG ' + res.status + ' ' + res.statusText);
  return { xml: await res.text() };
}

/* --- il poco di XML che serve ------------------------------------
   Otto campi per gioco: non vale la pena tirarsi dentro un parser,
   bastano due espressioni regolari. E' lo stesso codice di
   `tools/bgg-lib.mjs`: se cambia uno deve cambiare l'altro. */

const unesc = (s: string) =>
  String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function attr(xml: string, tag: string, name: string): string {
  const m = xml.match(new RegExp('<' + tag + '[^>]*\\b' + name + '="([^"]*)"'));
  return m ? unesc(m[1]) : '';
}

function links(xml: string, type: string): string[] {
  const out: string[] = [];
  const re = new RegExp('<link[^>]*type="' + type + '"[^>]*value="([^"]*)"', 'g');
  let m;
  while ((m = re.exec(xml))) out.push(unesc(m[1]));
  return out;
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  return m ? unesc(m[1]).trim() : '';
}

function parseSearch(xml: string) {
  const out: Array<{ id: number; title: string; year: number | null }> = [];
  const re = /<item[^>]*type="boardgame"[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[2];
    const name = body.match(/<name[^>]*value="([^"]*)"/);
    out.push({
      id: Number(m[1]),
      title: name ? unesc(name[1]) : '(senza titolo)',
      year: Number(attr(body, 'yearpublished', 'value')) || null,
    });
  }
  return out;
}

function parseGame(xml: string, id: string) {
  const primary = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/);
  /* `<ratings>` non si cerca con la parentesi chiusa: BGG lo scrive
     `<ratings >`, con uno spazio, e `indexOf` tornerebbe -1. */
  const i = xml.indexOf('<ratings');
  const stats = i < 0 ? '' : xml.slice(i);
  const title = primary ? unesc(primary[1]) : String(id);
  const weight = Number(attr(stats, 'averageweight', 'value'));
  const score = Number(attr(stats, 'average', 'value'));

  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    bgg: Number(id),
    title,
    sub: '',
    year: Number(attr(xml, 'yearpublished', 'value')) || '',
    designer: links(xml, 'boardgamedesigner')[0] || '',
    publisher: links(xml, 'boardgamepublisher')[0] || '',
    players: attr(xml, 'minplayers', 'value') + '-' + attr(xml, 'maxplayers', 'value'),
    time: attr(xml, 'minplaytime', 'value') + '-' + attr(xml, 'maxplaytime', 'value'),
    age: attr(xml, 'minage', 'value') + '+',
    weight: weight ? weight.toFixed(1) : '',
    score: score ? score.toFixed(1) : '',
    tags: links(xml, 'boardgamemechanic').slice(0, 4).map((s) => s.toLowerCase()),
    image: tag(xml, 'image') || tag(xml, 'thumbnail'),
  };
}

/* Le misure stanno sulle EDIZIONI. Si prende la faccia piu' comune --
   le ristampe condividono lo stampo, quindi la moda e' l'edizione
   normale -- e la mediana degli spessori fra quelle. In centimetri. */
function parseMisure(xml: string) {
  const versioni: Array<{ w: number; l: number; d: number }> = [];
  const re = /<item[^>]*type="boardgameversion"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const n = (t: string) => Number(attr(b, t, 'value')) || 0;
    const w = n('width'), l = n('length'), d = n('depth');
    if (w < 1 || l < 1 || w > 30 || l > 30) continue;
    versioni.push({ w, l, d: d > 0 && d < 20 ? d : 0 });
  }
  if (!versioni.length) return null;

  const chiave = (v: { w: number; l: number }) => v.w.toFixed(2) + 'x' + v.l.toFixed(2);
  const conta: Record<string, number> = {};
  versioni.forEach((v) => { conta[chiave(v)] = (conta[chiave(v)] || 0) + 1; });
  let migliore = '', quante = -1;
  for (const k of Object.keys(conta)) if (conta[k] > quante) { quante = conta[k]; migliore = k; }

  const gruppo = versioni.filter((v) => chiave(v) === migliore);
  const spessori = gruppo.map((v) => v.d).filter(Boolean).sort((a, b) => a - b);
  const P = 2.54;
  return {
    larghezza: +(gruppo[0].w * P).toFixed(1),
    lunghezza: +(gruppo[0].l * P).toFixed(1),
    spessore: spessori.length ? +(spessori[Math.floor(spessori.length / 2)] * P).toFixed(1) : 0,
    edizioni: versioni.length,
    concordi: gruppo.length,
  };
}

/* --- gli endpoint ------------------------------------------------ */

function idsDa(url: URL, max: number): string[] {
  return (url.searchParams.get('ids') || '')
    .split(',').map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x)).slice(0, max);
}

async function schedaDi(id: string) {
  const r = await api('/thing?id=' + encodeURIComponent(id) + '&stats=1');
  if (r.queued) return null;
  return parseGame(r.xml!, id);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = corsPer(origin);
  const json = (code: number, obj: unknown) =>
    new Response(JSON.stringify(obj), {
      status: code,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);
  // su Supabase la funzione vive sotto /functions/v1/bgg: conta l'ultimo pezzo
  const parti = url.pathname.split('/').filter(Boolean);
  const dove = parti[parti.length - 1] === 'bgg' ? 'ping' : parti[parti.length - 1];

  try {
    if (dove === 'ping') return json(200, { ok: true, token: !!token() });

    if (dove === 'search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json(400, { error: 'manca q' });
      const r = await api('/search?type=boardgame&query=' + encodeURIComponent(q));
      if (r.queued) return json(202, { queued: true });
      /* BGG non ordina per pertinenza: prima chi si chiama esattamente
         cosi', poi chi comincia cosi', poi il resto -- e solo dentro
         ogni gruppo decide l'anno. Se no cercando "arcs" uscivano tre
         espansioni del 2027 e Arcs quarto. */
      const qq = q.toLowerCase();
      const rango = (t: string) => {
        const p = t.toLowerCase();
        return p === qq ? 0 : (p.indexOf(qq) === 0 ? 1 : 2);
      };
      const hits = parseSearch(r.xml!).sort((a, b) => {
        const d = rango(a.title) - rango(b.title);
        return d ? d : (b.year || 0) - (a.year || 0);
      });
      return json(200, hits.slice(0, 12));
    }

    if (dove === 'game') {
      const id = url.searchParams.get('id');
      if (!id) return json(400, { error: 'manca id' });
      const g = await schedaDi(id);
      return g ? json(200, g) : json(202, { queued: true });
    }

    /* Venti per volta: oltre, BGG risponde "Cannot load more than 20
       items" con un 400. In fila e non insieme -- su un'API pubblica il
       modo piu' rapido di prendersi un limite e' chiedere tutto in
       parallelo. */
    if (dove === 'thumbs') {
      const ids = idsDa(url, 40);
      if (!ids.length) return json(400, { error: 'mancano gli ids' });
      const out: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 20) {
        const r = await api('/thing?id=' + ids.slice(i, i + 20).join(','));
        if (r.queued) continue;
        const re = /<item[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
        let m;
        while ((m = re.exec(r.xml!))) {
          const th = m[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/);
          if (th) out[m[1]] = th[1].trim();
        }
      }
      return json(200, out);
    }

    /* Le misure costano care in banda -- `versions=1` porta 70 KB per
       gioco -- ma il conto lo paga il server: al browser tornano tre
       numeri. Dieci per volta, che la risposta e' grossa. */
    if (dove === 'misure') {
      const ids = idsDa(url, 30);
      if (!ids.length) return json(400, { error: 'mancano gli ids' });
      const out: Record<string, unknown> = {};
      for (let i = 0; i < ids.length; i += 10) {
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
        while ((m = re.exec(r.xml!))) {
          const mis = parseMisure(m[2]);
          if (mis) out[m[1]] = mis;
        }
      }
      return json(200, out);
    }

    /* La copertina si rilancia BYTE PER BYTE, non come indirizzo: le
       immagini di cf.geekdo-images.com non mandano header CORS, e una
       texture WebGL da un dominio senza CORS resta vuota. Le miniature
       invece finiscono in un <img> e per quelle basta l'indirizzo. */
    if (dove === 'cover') {
      const id = url.searchParams.get('id');
      if (!id) return json(400, { error: 'manca id' });
      const g = await schedaDi(id);
      if (!g || !g.image) return json(404, { error: 'nessuna immagine' });
      const im = await fetch(g.image, {
        headers: { 'User-Agent': 'il-dado-e-trap/1.0 (edge function)' },
      });
      if (!im.ok) return json(502, { error: 'immagine ' + im.status });
      return new Response(im.body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': im.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return json(404, { error: 'endpoint sconosciuto: ' + dove });
  } catch (e) {
    return json(502, { error: String((e as Error).message || e) });
  }
});
