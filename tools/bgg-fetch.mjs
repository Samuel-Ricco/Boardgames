/* ============================================================
   Scarica da BoardGameGeek i dati di un gioco e ne stampa la
   scheda gia' pronta da incollare in js/data.js.

   Serve un token: dal 2025 la XML API vuole registrazione e
   header Authorization (vedi README).

       set BGG_TOKEN=...            (PowerShell: $env:BGG_TOKEN='...')
       node tools/bgg-fetch.mjs 237182 169786

   Le chiamate si fanno da qui, a mano, e il risultato finisce nel
   file: BGG chiede esplicitamente di non interrogare l'API dal
   browser degli utenti. Per la ricerca interattiva dell'admin c'e'
   invece bgg-proxy.mjs.
   ============================================================ */

import { api, parseGame, token } from './bgg-lib.mjs';

const ids = process.argv.slice(2);

if (!token()){
  console.error('Manca BGG_TOKEN. Registra l\'applicazione su');
  console.error('https://boardgamegeek.com/applications e genera un token.');
  process.exit(1);
}
if (!ids.length){
  console.error('Uso: node tools/bgg-fetch.mjs <id> [<id> ...]');
  process.exit(1);
}

for (const id of ids){
  let r;
  try {
    r = await api('/thing?id=' + id + '&stats=1');
  } catch (e){
    console.error(id + ': ' + e.message);
    if (e.status === 401) console.error('  token mancante, sbagliato o non ancora approvato.');
    continue;
  }
  if (r.queued){
    console.error(id + ': la richiesta e\' in coda, riprova fra qualche secondo.');
    continue;
  }

  const g = parseGame(r.xml, id);
  const image = g.image;
  delete g.image;

  Object.assign(g, {
    review: 'LOREM', art: 'generic', slot: 0,
    wrap: '#4a4632', ink: '#f1e2bd'
  });

  console.log(
    JSON.stringify(g, null, 2)
      .replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:')
      .replace('"LOREM"', 'LOREM') + ','
  );
  if (image) console.error('  copertina: ' + image);
}
