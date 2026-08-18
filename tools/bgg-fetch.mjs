/* ============================================================
   Scarica da BoardGameGeek i dati di un gioco e ne stampa la
   scheda gia' pronta da incollare in js/data.js.

   Serve un token: dal 2025 la XML API vuole registrazione e
   header Authorization (vedi README).

       set BGG_TOKEN=...            (PowerShell: $env:BGG_TOKEN='...')
       node tools/bgg-fetch.mjs 237182 169786

   Le chiamate si fanno da qui, a mano, e il risultato finisce nel
   file: BGG chiede esplicitamente di non interrogare l'API dal
   browser degli utenti.
   ============================================================ */

const TOKEN = process.env.BGG_TOKEN;
const ids = process.argv.slice(2);

if (!TOKEN){
  console.error('Manca BGG_TOKEN. Registra l\'applicazione su');
  console.error('https://boardgamegeek.com/applications e genera un token.');
  process.exit(1);
}
if (!ids.length){
  console.error('Uso: node tools/bgg-fetch.mjs <id> [<id> ...]');
  process.exit(1);
}

// Estrazioni minime: servono otto campi, non vale la pena tirarsi
// dentro un parser XML.
const attr = (xml, tag, name) => {
  const m = xml.match(new RegExp('<' + tag + '[^>]*\\b' + name + '="([^"]*)"'));
  return m ? m[1] : '';
};
const links = (xml, type) => {
  const out = [];
  const re = new RegExp('<link[^>]*type="' + type + '"[^>]*value="([^"]*)"', 'g');
  let m;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
};

for (const id of ids){
  // niente www davanti al dominio, se no il token non viene letto
  const url = 'https://boardgamegeek.com/xmlapi2/thing?id=' + id + '&stats=1';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });

  if (res.status === 202){
    console.error(id + ': la richiesta e\' in coda, riprova fra qualche secondo.');
    continue;
  }
  if (!res.ok){
    console.error(id + ': HTTP ' + res.status + ' ' + res.statusText);
    console.error(await res.text());
    continue;
  }

  const xml = await res.text();
  const primary = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/);
  const stats = xml.slice(xml.indexOf('<ratings>'));

  const game = {
    id: (primary ? primary[1] : id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    bgg: Number(id),
    title: primary ? primary[1] : '?',
    sub: '',
    year: Number(attr(xml, 'yearpublished', 'value')),
    designer: links(xml, 'boardgamedesigner')[0] || '',
    publisher: links(xml, 'boardgamepublisher')[0] || '',
    players: attr(xml, 'minplayers', 'value') + '-' + attr(xml, 'maxplayers', 'value'),
    time: attr(xml, 'minplaytime', 'value') + '-' + attr(xml, 'maxplaytime', 'value'),
    age: attr(xml, 'minage', 'value') + '+',
    weight: Number(attr(stats, 'averageweight', 'value')).toFixed(1),
    score: Number(attr(stats, 'average', 'value')).toFixed(1),
    tags: links(xml, 'boardgamemechanic').slice(0, 4).map(s => s.toLowerCase()),
    review: ['...'],
    art: 'generic',
    slot: 0,
    wrap: '#4a4632',
    ink: '#f1e2bd'
  };

  console.log(JSON.stringify(game, null, 2).replace(/"([a-z]+)":/g, '$1:') + ',');
}
