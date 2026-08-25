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
/* L'ultimo salvataggio ha dovuto rinunciare ai punteggi? Un
   ripiegamento che non si vede e' peggio di un errore: chi ha scritto
   i punti deve sapere che sul server non sono arrivati. */
let puntiPersi = false;

function cli(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

function spiega(e){
  if (e && (e.code === '42P01' || /partite|giocatori|partecipanti/.test(e.message || ''))){
    return TP('err.partiteMigr');
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
  if (!c) throw new Error(TP('err.nonEntrato'));
  const t = String(nome || '').trim();
  if (!t) throw new Error(TP('err.serveNome'));
  if (t.length > 24) throw new Error(TP('err.nomeLungo', {n: 24}));

  const r = await c.from('giocatori').insert({
    proprietario: AUTH.stato().id, nome: t, amico: amico || null
  }).select().single();
  // 23505: c'e' gia' un giocatore con quel nome. Non e' un guasto, e'
  // esattamente il motivo per cui i nomi sono unici: uno solo per nome.
  if (r.error){
    if (r.error.code === '23505') throw new Error(TP('err.ceGia', {n: t}));
    throw r.error;
  }
  await caricaGiocatori();
  return r.data;
}

async function togliGiocatore(id){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
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
  if (!c) throw new Error(TP('err.nonEntrato'));
  const titolo = String(p.titolo || '').trim();
  if (!titolo) throw new Error(TP('err.serveGioco'));

  const chi = (p.chi || [])
    .map(function(x){ return Object.assign({}, x, { nome: String(x.nome || '').trim() }); })
    .filter(function(x){ return x.nome; });
  if (!chi.length) throw new Error(TP('err.serveGiocatore'));

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

  const righe = chi.map(function(x){
    return {
      partita: id, nome: x.nome, giocatore: x.giocatore || null,
      posizione: numero(x.posizione),
      punti: numero(x.punti),
      vincitore: !!x.vincitore
    };
  });

  puntiPersi = false;
  let r = await c.from('partecipanti').insert(righe);
  /* Senza la migrazione `punti_partita` la colonna non c'e' e PostgREST
     butta via l'intera scrittura. Meglio salvare la partita senza i
     punti che non salvarla: si riprova senza.

     MA LO SI DICE. Un ripiegamento silenzioso qui e' esattamente il
     guasto muto che questo progetto non vuole: e' successo davvero
     appena applicata la migrazione, quando la CACHE DELLO SCHEMA di
     PostgREST era ancora indietro -- la colonna c'era, `select('*')` la
     leggeva (la lettura la espande il database), ma la scrittura la
     valida la cache e veniva rifiutata. I punti sparivano e nessuno lo
     diceva. Ora chi salva se ne accorge, e sa se aspettare un minuto e
     rifarlo o applicare la migrazione. */
  if (r.error && mancaPunti(r.error)){
    puntiPersi = true;
    r = await c.from('partecipanti').insert(righe.map(function(x){
      const y = Object.assign({}, x); delete y.punti; return y;
    }));
  }
  if (r.error) throw r.error;

  await carica();
  return id;
}

/* Un numero, o nullo se non e' stato scritto niente. NON si scrive
   `parseInt(x) || null`: lo zero e' un punteggio vero -- si puo'
   chiudere una partita a zero -- e quel `||` lo trasformerebbe in "non
   registrato", che e' un'altra cosa. */
function numero(x){
  if (x === '' || x === null || x === undefined) return null;
  const n = parseInt(x, 10);
  return isNaN(n) ? null : n;
}

function mancaPunti(e){
  const m = (e && (e.message || '')) + ' ' + (e && (e.details || ''));
  return (e && (e.code === '42703' || e.code === 'PGRST204')) || m.indexOf('punti') >= 0;
}

async function togli(id){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
  // i partecipanti se ne vanno da soli: on delete cascade
  const r = await c.from('partite').delete().eq('id', id);
  if (r.error) throw r.error;
  await carica();
}

/* --- il winrate ----------------------------------------------------

   "Chi vince di piu'" e' una classifica fra chi c'era; il winrate
   invece parla di UNA persona sola, e quella persona sei tu. E' la
   domanda diversa: non "chi e' il piu' forte del tavolo" ma "come sto
   andando io", che e' la sola a cui una schermata intitolata "le tue
   partite" dovrebbe rispondere per prima.

   CHI SONO IO AL TAVOLO. I partecipanti sono nomi, non account: al
   tavolo c'e' quasi sempre qualcuno che sul sito non c'e', ed e' una
   scelta che regge. Il prezzo e' che l'unico modo di riconoscersi in
   una partita e' il proprio nome -- il nick, o il nome del profilo se
   il nick non c'e'. Chi al tavolo si segna con un altro nome non si
   trova, e il sito lo dice invece di inventare un numero. */
function mioNome(){
  if (typeof PROFILO === 'undefined') return '';
  const p = PROFILO.mio();
  return (p && (p.nick || p.nome)) || '';
}

/* Appiattito, come ogni confronto di testo del sito: "Samuel" e
   "samuel" al tavolo sono la stessa persona. */
function piattoNome(s){
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/* Contate solo le partite in cui ci sono io: una serata a cui non ho
   giocato non entra ne' al numeratore ne' al denominatore, se no il
   winrate scenderebbe ogni volta che gli altri giocano senza di me.

   `perc` nulla vuol dire "non ho mai giocato a questo", che non e' zero
   per cento -- e va detto in modo diverso. */
function winrate(lista){
  const io = piattoNome(mioNome());
  let gioc = 0, vinte = 0;
  if (io){
    (lista || []).forEach(function(p){
      const mia = (p.chi || []).filter(function(x){ return piattoNome(x.nome) === io; })[0];
      if (!mia) return;
      gioc++;
      if (mia.vincitore) vinte++;
    });
  }
  return { gioc: gioc, vinte: vinte,
           perc: gioc ? Math.round(vinte * 100 / gioc) : null };
}

function winrateTotale(){ return winrate(elenco); }

/* Un winrate per gioco, in ordine di quanto vai forte -- e a parita' di
   percentuale prima quello a cui hai giocato di piu', perche' 100% su
   una partita sola dice meno di 70% su dieci. Fuori i giochi a cui non
   ho mai giocato io: l'elenco risponde a "come vado", e una riga senza
   winrate non risponde. */
/* `lista` serve alla ricerca nelle partite: con un filtro acceso questo
   elenco deve parlare di quello che si sta guardando, se no in cima
   alla schermata ci sono tre numeri filtrati e sotto il dettaglio di
   tutt'altro. Senza argomento resta quello che era, cioe' tutte. */
function winratePerGioco(lista){
  const per = {}, ordine = [];
  (lista || elenco).forEach(function(p){
    const k = p.bgg ? 'b' + p.bgg : 't' + p.titolo;
    if (!per[k]){ per[k] = { titolo: p.titolo, bgg: p.bgg || null, partite: [] }; ordine.push(per[k]); }
    per[k].partite.push(p);
  });
  return ordine.map(function(g){
    const w = winrate(g.partite);
    return { titolo: g.titolo, bgg: g.bgg, gioc: w.gioc, vinte: w.vinte, perc: w.perc };
  }).filter(function(g){ return g.gioc > 0; })
    .sort(function(a, b){ return b.perc - a.perc || b.gioc - a.gioc ||
                                 String(a.titolo).localeCompare(String(b.titolo), 'it'); });
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
  salva: salva, togli: togli, classifica: classifica,
  puntiPersi: function(){ return puntiPersi; },
  mioNome: mioNome, winrate: winrate,
  winrateTotale: winrateTotale, winratePerGioco: winratePerGioco
};
})();
