/* ============================================================
   Dal dump dei ranking di BGG all'indice che il sito si scarica.

   BGG pubblica ogni giorno un CSV con tutti i giochi del database e la
   loro posizione in classifica. Non ha bisogno di token, e da qui
   arrivano le due cose che a questo sito mancavano di piu': un elenco
   di CENTOMILA titoli su cui cercare invece dei 3.429 di Wikidata, e
   soprattutto la CLASSIFICA VERA, che e' l'ordine che un sito di
   recensioni vuole -- non i classici in cima perche' hanno tante
   edizioni linguistiche.

   Cosa NON c'e' nel dump: autore, editore, durata, numero di giocatori
   e copertine. Per quelli continua a rispondere Wikidata, interrogata
   per id BGG quando si sceglie un risultato.

   Uso:
     node tools/bgg-indice.mjs dump_bgg/boardgames_ranks.csv dati/bgg.txt

   Il CSV grezzo (11 MB) non si committa: si committa quello che esce
   di qui. Quando BGG ne pubblica uno nuovo si riscarica e si rilancia.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , ingresso, uscita] = process.argv;
if (!ingresso || !uscita){
  console.error('uso: node tools/bgg-indice.mjs <ranks.csv> <indice.txt>');
  process.exit(1);
}

/* Un CSV vero: i nomi hanno virgole e virgolette doppie raddoppiate.
   Niente librerie -- e' un parser da venti righe e il formato e' noto. */
function campi(riga){
  const out = [];
  let cur = '', dentro = false;
  for (let i = 0; i < riga.length; i++){
    const c = riga[i];
    if (dentro){
      if (c === '"'){
        if (riga[i + 1] === '"'){ cur += '"'; i++; }
        else dentro = false;
      } else cur += c;
    } else if (c === '"'){
      dentro = true;
    } else if (c === ','){
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const testo = readFileSync(ingresso, 'utf8');
const righe = testo.split(/\r?\n/).filter(function(r){ return r.length; });
const intestazione = campi(righe[0]);
const col = {};
intestazione.forEach(function(nome, i){ col[nome] = i; });

for (const serve of ['id', 'name', 'yearpublished', 'rank', 'average', 'usersrated', 'is_expansion']){
  if (col[serve] === undefined){
    console.error('manca la colonna "' + serve + '" nel CSV');
    process.exit(1);
  }
}

const intero = function(v){ const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const reale  = function(v){ const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const voci = [];
for (let i = 1; i < righe.length; i++){
  const c = campi(righe[i]);
  if (intero(c[col.is_expansion]) === 1) continue;      // le espansioni non sono giochi
  const voti = intero(c[col.usersrated]);
  if (voti < 1) continue;                                // zero voti = una scheda vuota
  const id = intero(c[col.id]);
  if (!id) continue;
  /* Un nome su centomila contiene una tabulazione, e il formato a righe
     ci morirebbe sopra: si appiattisce ogni spazio bianco in uno solo. */
  const nome = String(c[col.name] || '').replace(/\s+/g, ' ').trim();
  if (!nome) continue;
  voci.push({
    id: id,
    nome: nome,
    anno: intero(c[col.yearpublished]),
    rank: intero(c[col.rank]),
    media: reale(c[col.average]),
    voti: voti
  });
}

/* Prima i classificati, in classifica; poi tutti gli altri per numero
   di voti. Cosi' il rank non ha bisogno di una colonna sua: per le
   prime `quantiRank` righe e' la posizione della riga, per le altre non
   c'e'. Sfogliare il catalogo diventa "prendi le prime N righe". */
const classificati = voci.filter(function(v){ return v.rank > 0; })
                         .sort(function(a, b){ return a.rank - b.rank; });
const resto = voci.filter(function(v){ return !v.rank; })
                  .sort(function(a, b){ return b.voti - a.voti; });
const tutte = classificati.concat(resto);

const corpo = tutte.map(function(v){
  return [v.id, v.nome, v.anno || '', v.media ? v.media.toFixed(2) : ''].join('\t');
}).join('\n');

/* La prima riga dice quante voci ci sono e quante sono classificate:
   il resto del file non ha bisogno di altre intestazioni. */
const testa = '# dado-bgg 1 ' + tutte.length + ' ' + classificati.length;

mkdirSync(dirname(uscita), { recursive: true });
writeFileSync(uscita, testa + '\n' + corpo + '\n', 'utf8');

const mb = function(s){ return (Buffer.byteLength(s, 'utf8') / 1048576).toFixed(2); };
console.log('letti      ' + (righe.length - 1) + ' record');
console.log('scritti    ' + tutte.length + ' giochi (' + classificati.length + ' in classifica)');
console.log('scartati   espansioni e schede senza nemmeno un voto');
console.log('uscita     ' + uscita + '  ' + mb(testa + corpo) + ' MB');
