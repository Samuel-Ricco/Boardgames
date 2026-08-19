/* ============================================================
   Giocatori salvati e partite.

   Una collezione dice cosa hai; le partite dicono cosa hai giocato,
   con chi, e chi ha vinto -- che di un gioco da tavolo e' la meta'
   piu' interessante.

   Una partita si aggancia all'ID BGG, non a una riga della tua
   collezione: cosi' si segna anche una serata a casa di un amico su un
   gioco che non hai, e togliere una scatola dallo scaffale non
   cancella la storia di quando ci hai giocato. `titolo` viaggia
   insieme come copia, perche' non tutti i giochi hanno un id BGG e
   perche' un titolo scritto e' leggibile anche fra dieci anni.

   I giocatori sono NOMI, non account: al tavolo c'e' quasi sempre
   qualcuno che sul sito non c'e'. Chi invece e' un amico si collega,
   e da li' si prende la sua faccia.
   ============================================================ */
const PARTITE = (function(){
'use strict';

let gioca = [];        // i giocatori salvati
let elenco = [];       // le partite, con dentro i partecipanti
let guaio = '';

function cli(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

function spiega(e){
  if (e && (e.code === '42P01' || /partite|giocatori|partecipanti/.test(e.message || ''))){
    return 'manca la migrazione partite';
  }
  return (e && e.message) || String(e);
}

function problema(){ return guaio; }

/* --- giocatori salvati -------------------------------------------- */
async function caricaGiocatori(){
  const c = cli();
  if (!c || !AUTH.stato().dentro){ gioca = []; return gioca; }
  try {
    const r = await c.from('giocatori').select('*').order('nome');
    if (r.error) throw r.error;
    gioca = r.data || [];
    guaio = '';
  } catch(e){
    gioca = [];
    guaio = spiega(e);
  }
  return gioca;
}

function giocatori(){ return gioca; }

async function aggiungiGiocatore(nome, amico){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  const t = String(nome || '').trim();
  if (!t) throw new Error('serve un nome');
  if (t.length > 40) throw new Error('nome troppo lungo');

  const r = await c.from('giocatori').insert({
    proprietario: AUTH.stato().id, nome: t, amico: amico || null
  }).select().single();
  // 23505: c'e' gia' un giocatore con quel nome. Non e' un guasto, e'
  // esattamente il motivo per cui i nomi sono unici: uno solo per nome.
  if (r.error){
    if (r.error.code === '23505') throw new Error('"' + t + '" c\'e\' gia\'');
    throw r.error;
  }
  await caricaGiocatori();
  return r.data;
}

async function togliGiocatore(id){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  const r = await c.from('giocatori').delete().eq('id', id);
  if (r.error) throw r.error;
  await caricaGiocatori();
}

/* Gli amici che non sono ancora fra i giocatori salvati. Serve a
   proporli: chi ha un amico sul sito non deve riscriverne il nome. */
function amiciDaAggiungere(){
  if (typeof PROFILO === 'undefined') return [];
  const gia = {};
  gioca.forEach(function(g){ if (g.amico) gia[g.amico] = true; });
  return PROFILO.amici().filter(function(a){ return !gia[a.id]; });
}

/* --- partite ------------------------------------------------------
   Due letture invece di una join annidata: PostgREST la saprebbe fare,
   ma la forma che torna cambia con la versione della libreria e qui si
   preferisce una struttura che si sa com'e' fatta. */
async function carica(){
  const c = cli();
  if (!c || !AUTH.stato().dentro){ elenco = []; return elenco; }
  try {
    const r = await c.from('partite').select('*')
      .order('giocata_il', { ascending: false, nullsFirst: false })
      .order('creato', { ascending: false });
    if (r.error) throw r.error;

    const righe = r.data || [];
    let per = {};
    if (righe.length){
      const p = await c.from('partecipanti').select('*')
        .in('partita', righe.map(function(x){ return x.id; }));
      if (p.error) throw p.error;
      (p.data || []).forEach(function(x){
        (per[x.partita] = per[x.partita] || []).push(x);
      });
    }

    elenco = righe.map(function(x){
      const chi = (per[x.id] || []).slice().sort(function(a, b){
        // prima i vincitori, poi la classifica, poi in ordine di nome
        if (a.vincitore !== b.vincitore) return a.vincitore ? -1 : 1;
        const pa = a.posizione === null ? 99 : a.posizione;
        const pb = b.posizione === null ? 99 : b.posizione;
        if (pa !== pb) return pa - pb;
        return String(a.nome).localeCompare(String(b.nome), 'it');
      });
      return Object.assign({}, x, { chi: chi });
    });
    guaio = '';
  } catch(e){
    elenco = [];
    guaio = spiega(e);
  }
  return elenco;
}

function tutte(){ return elenco; }

// le partite di un gioco: per il pannello della recensione
function diGioco(bgg, titolo){
  return elenco.filter(function(p){
    if (bgg && p.bgg) return String(p.bgg) === String(bgg);
    return titolo && p.titolo === titolo;
  });
}

/* Salva una partita intera: la riga e i partecipanti insieme. Se una
   partita esiste gia' si riscrive per intero -- e' un oggetto piccolo,
   e calcolare quali partecipanti sono cambiati costerebbe piu' codice
   di quanto valga. */
async function salva(p){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  const titolo = String(p.titolo || '').trim();
  if (!titolo) throw new Error('serve il gioco');

  const chi = (p.chi || [])
    .map(function(x){ return Object.assign({}, x, { nome: String(x.nome || '').trim() }); })
    .filter(function(x){ return x.nome; });
  if (!chi.length) throw new Error('serve almeno un giocatore');

  const riga = {
    proprietario: AUTH.stato().id,
    bgg: parseInt(p.bgg, 10) || null,
    titolo: titolo,
    giocata_il: p.giocata_il || null,
    ora: p.ora || null,
    note: p.note || null
  };

  let id = p.id;
  if (id){
    const u = await c.from('partite').update(riga).eq('id', id);
    if (u.error) throw u.error;
    const d = await c.from('partecipanti').delete().eq('partita', id);
    if (d.error) throw d.error;
  } else {
    const i = await c.from('partite').insert(riga).select().single();
    if (i.error) throw i.error;
    id = i.data.id;
  }

  const r = await c.from('partecipanti').insert(chi.map(function(x){
    return {
      partita: id, nome: x.nome, giocatore: x.giocatore || null,
      posizione: x.posizione === '' || x.posizione === undefined ? null
                                                                : (parseInt(x.posizione, 10) || null),
      vincitore: !!x.vincitore
    };
  }));
  if (r.error) throw r.error;

  await carica();
  return id;
}

async function togli(id){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  // i partecipanti se ne vanno da soli: on delete cascade
  const r = await c.from('partite').delete().eq('id', id);
  if (r.error) throw r.error;
  await carica();
}

/* Chi vince di piu'. Il conto e' sui NOMI e non sui giocatori salvati,
   se no cancellare un giocatore cancellerebbe anche le sue vittorie. */
function classifica(){
  const per = {};
  elenco.forEach(function(p){
    (p.chi || []).forEach(function(x){
      const v = per[x.nome] || (per[x.nome] = { nome: x.nome, partite: 0, vinte: 0 });
      v.partite++;
      if (x.vincitore) v.vinte++;
    });
  });
  return Object.keys(per).map(function(k){ return per[k]; })
    .sort(function(a, b){ return b.vinte - a.vinte || b.partite - a.partite; });
}

return {
  problema: problema,
  caricaGiocatori: caricaGiocatori, giocatori: giocatori,
  aggiungiGiocatore: aggiungiGiocatore, togliGiocatore: togliGiocatore,
  amiciDaAggiungere: amiciDaAggiungere,
  carica: carica, tutte: tutte, diGioco: diGioco,
  salva: salva, togli: togli, classifica: classifica
};
})();
