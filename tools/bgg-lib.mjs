/* ============================================================
   Il poco che serve per parlare con la XML API di BoardGameGeek.
   Usato sia da bgg-fetch.mjs (una tantum, da riga di comando) sia da
   bgg-proxy.mjs (in ascolto, per la ricerca dell'admin).

   Servono otto campi per gioco: non vale la pena tirarsi dentro un
   parser XML, bastano due espressioni regolari.
   ============================================================ */

const BASE = 'https://boardgamegeek.com/xmlapi2';   // senza www, se no il token non viene letto

export function token(){
  return process.env.BGG_TOKEN || '';
}

export async function api(path){
  const t = token();
  const res = await fetch(BASE + path, {
    headers: t ? { Authorization: 'Bearer ' + t } : {}
  });
  if (res.status === 202) return { queued: true };
  if (!res.ok){
    const err = new Error('BGG ' + res.status + ' ' + res.statusText);
    err.status = res.status;
    err.body = await res.text().catch(() => '');
    throw err;
  }
  return { xml: await res.text() };
}

const unesc = s => String(s)
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function attr(xml, tag, name){
  const m = xml.match(new RegExp('<' + tag + '[^>]*\\b' + name + '="([^"]*)"'));
  return m ? unesc(m[1]) : '';
}

export function links(xml, type){
  const out = [];
  const re = new RegExp('<link[^>]*type="' + type + '"[^>]*value="([^"]*)"', 'g');
  let m;
  while ((m = re.exec(xml))) out.push(unesc(m[1]));
  return out;
}

export function tag(xml, name){
  const m = xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  return m ? unesc(m[1]).trim() : '';
}

/* Elenco dei risultati di ricerca: id, titolo, anno. */
export function parseSearch(xml){
  const out = [];
  const re = /<item[^>]*type="boardgame"[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))){
    const body = m[2];
    const name = body.match(/<name[^>]*value="([^"]*)"/);
    out.push({
      id: Number(m[1]),
      title: name ? unesc(name[1]) : '(senza titolo)',
      year: Number(attr(body, 'yearpublished', 'value')) || null
    });
  }
  return out;
}

/* Una scheda nella forma che usa js/data.js. */
export function parseGame(xml, id){
  const primary = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/);
  const stats = xml.slice(xml.indexOf('<ratings>'));
  const title = primary ? unesc(primary[1]) : String(id);
  const weight = Number(attr(stats, 'averageweight', 'value'));
  const score = Number(attr(stats, 'average', 'value'));

  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    bgg: Number(id),
    title: title,
    sub: '',
    year: Number(attr(xml, 'yearpublished', 'value')) || '',
    designer: links(xml, 'boardgamedesigner')[0] || '',
    publisher: links(xml, 'boardgamepublisher')[0] || '',
    players: attr(xml, 'minplayers', 'value') + '-' + attr(xml, 'maxplayers', 'value'),
    time: attr(xml, 'minplaytime', 'value') + '-' + attr(xml, 'maxplaytime', 'value'),
    age: attr(xml, 'minage', 'value') + '+',
    weight: weight ? weight.toFixed(1) : '',
    score: score ? score.toFixed(1) : '',
    tags: links(xml, 'boardgamemechanic').slice(0, 4).map(s => s.toLowerCase()),
    image: tag(xml, 'image') || tag(xml, 'thumbnail')
  };
}
