/* ============================================================
   Il poco che serve per parlare con la XML API di BoardGameGeek.
   Usato sia da bgg-fetch.mjs (una tantum, da riga di comando) sia da
   bgg-proxy.mjs (in ascolto, per la ricerca dell'admin).

   Servono otto campi per gioco: non vale la pena tirarsi dentro un
   parser XML, bastano due espressioni regolari.
   ============================================================ */

import { readFileSync } from 'node:fs';

const BASE = 'https://boardgamegeek.com/xmlapi2';   // senza www, se no il token non viene letto

/* Il token: prima la variabile d'ambiente, poi il file `.bgg-token`
   accanto al repo -- che e' in `.gitignore` e non ci entra mai, come la
   chiave `sb_secret_` di Supabase.

   Il file esiste per comodita' di una macchina di sviluppo: senza,
   ogni finestra nuova va aperta con `$env:BGG_TOKEN='...'` e prima o
   poi ci si dimentica. Il posto giusto per davvero resta una edge
   function, dove il token sta sul server e il browser non lo vede. */
let letto = null;

export function token(){
  if (process.env.BGG_TOKEN) return process.env.BGG_TOKEN;
  if (letto === null){
    try {
      letto = readFileSync(new URL('../.bgg-token', import.meta.url), 'utf8').trim();
    } catch(e){ letto = ''; }
  }
  return letto;
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

/* LE MISURE DELLA SCATOLA.

   BGG le tiene sulle EDIZIONI, non sul gioco: `<width>`, `<length>` e
   `<depth>` in pollici dentro ogni `<item type="boardgameversion">`.
   Un gioco ne ha parecchie -- Brass: Birmingham ne ha settantaquattro
   -- e non sono tutte uguali: cambiano le ristampe, le scatole
   deluxe, i formati da viaggio.

   Si prende la FACCIA PIU' COMUNE, cioe' la coppia larghezza-lunghezza
   che ricorre di piu': le ristampe condividono lo stampo, quindi la
   moda e' l'edizione "normale" e le stranezze restano fuori da sole.
   Lo spessore e' la mediana fra le edizioni con quella faccia -- li'
   la variazione e' vera (una deluxe e' piu' alta) e la mediana e' il
   valore che rappresenta il grosso.

   Torna centimetri: i pollici non li usa nessuno qui dentro. */
export function parseMisure(xml){
  const versioni = [];
  const re = /<item[^>]*type="boardgameversion"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))){
    const b = m[1];
    const n = function(tag){ return Number(attr(b, tag, 'value')) || 0; };
    const w = n('width'), l = n('length'), d = n('depth');
    // fuori le misure assurde: una scatola da mezzo pollice o da un
    // metro e' un dato sbagliato, non una scatola
    if (w < 1 || l < 1 || w > 30 || l > 30) continue;
    versioni.push({ w: w, l: l, d: d > 0 && d < 20 ? d : 0 });
  }
  if (!versioni.length) return null;

  const chiave = function(v){ return v.w.toFixed(2) + 'x' + v.l.toFixed(2); };
  const conta = {};
  versioni.forEach(function(v){ conta[chiave(v)] = (conta[chiave(v)] || 0) + 1; });
  let migliore = null, quante = -1;
  Object.keys(conta).forEach(function(k){
    if (conta[k] > quante){ quante = conta[k]; migliore = k; }
  });

  const gruppo = versioni.filter(function(v){ return chiave(v) === migliore; });
  const spessori = gruppo.map(function(v){ return v.d; }).filter(Boolean).sort(function(a, b){ return a - b; });
  const pollici = 2.54;
  return {
    larghezza: +(gruppo[0].w * pollici).toFixed(1),
    lunghezza: +(gruppo[0].l * pollici).toFixed(1),
    spessore: spessori.length ? +(spessori[Math.floor(spessori.length / 2)] * pollici).toFixed(1) : 0,
    edizioni: versioni.length,
    concordi: gruppo.length
  };
}

/* Una scheda nella forma che usa js/data.js. */
export function parseGame(xml, id){
  const primary = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/);
  /* `<ratings>` NON si cerca con la parentesi chiusa: BGG lo scrive
     `<ratings >`, con uno spazio prima, e `indexOf` tornava -1. Uno
     `slice(-1)` e' l'ultimo carattere della stringa, quindi voto e peso
     uscivano vuoti da sempre -- non si era mai visto perche' fino al
     token questa strada non era raggiungibile. */
  const i = xml.indexOf('<ratings');
  const stats = i < 0 ? '' : xml.slice(i);
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
