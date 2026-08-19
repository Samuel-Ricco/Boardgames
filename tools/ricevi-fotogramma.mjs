/* ============================================================
   Ricevitore di fotogrammi, solo per sviluppo.

   Il pannello di anteprima a volte non compone frame: in quel caso
   non si puo' fare uno screenshot, ma la pagina puo' comunque
   leggere i pixel dal contesto WebGL e spedirli qui, che li scrive
   su disco come JPEG.

       node tools/ricevi-fotogramma.mjs

   Dalla pagina:
       fetch('http://localhost:8199/salva?nome=prova',
             { method:'POST', body: dataUrl })

   Non c'entra niente con il sito: e' un attrezzo da banco.
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORTA = 8199;
const DOVE = process.env.FOTOGRAMMI || '.';

http.createServer(function(req, res){
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS'){ res.writeHead(204, cors); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/salva'){ res.writeHead(404, cors); return res.end('no'); }

  let corpo = '';
  req.on('data', function(c){ corpo += c; });
  req.on('end', function(){
    const virgola = corpo.indexOf(',');
    const dati = virgola >= 0 ? corpo.slice(virgola + 1) : corpo;
    const nome = (url.searchParams.get('nome') || 'fotogramma')
      .replace(/[^a-z0-9_-]/gi, '') + '.jpg';
    const file = path.join(DOVE, nome);
    fs.writeFileSync(file, Buffer.from(dati, 'base64'));
    console.log('scritto', file, Math.round(dati.length * 0.75 / 1024) + ' KB');
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain' }, cors));
    res.end(file);
  });
}).listen(PORTA, function(){
  console.log('ricevitore su http://localhost:' + PORTA + ' -> ' + path.resolve(DOVE));
});
