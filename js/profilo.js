/* ============================================================
   Il profilo e gli amici.

   Il profilo e' la prima cosa del sito che non parla di giochi: parla
   di chi li gioca. Tre dati e basta -- un nick, una faccia, un codice
   -- ma sono quelli che permettono a due persone di trovarsi.

   `nick` e `codice` fanno due mestieri diversi apposta: il nick ti fa
   RICONOSCERE, e lo vede chiunque ti incontri; il codice ti fa TROVARE,
   e lo dai a chi vuoi tu.

   Il codice non esce dalla riga del profilo, e non perche' lo dica una
   policy: le policy filtrano le RIGHE, non le colonne. Serve un GRANT
   per colonna (migrazione codice_riservato), e il proprio si legge da
   `mio_codice()`. Nella prima versione questo era sbagliato e il codice
   di un amico si leggeva: chi se lo prendeva poteva farsi accettare da
   chiunque lo avesse fra gli amici.

   Le richieste di amicizia passano da due funzioni sul server e non da
   un insert diretto, perche' tutte e due devono cercare una persona in
   una tabella che chi chiede non ha il diritto di leggere. Quella per
   email risponde sempre allo stesso modo, esista o no l'indirizzo: se
   dicesse la verita' sarebbe un modo per sapere chi e' iscritto.
   ============================================================ */
const PROFILO = (function(){
'use strict';

let io = null;              // il mio profilo, o null
let gente = [];             // amici e richieste, con dentro il profilo dell'altro
let guaio = '';

function cli(){
  return (typeof AUTH !== 'undefined' && AUTH.attivo()) ? AUTH.client() : null;
}

/* Le tinte disponibili stanno qui e non nell'interfaccia: il profilo sa
   di che colori e' fatta una faccia, e chi la disegna glieli chiede.
   Sono le stesse con cui avatarDa() sceglie quella di partenza. */
/* Sedici colori di meeple e dodici di fondo. Erano otto e quattro, e i
   quattro fondi si distinguevano appena l'uno dall'altro: quattro
   sfumature dello stesso beige non sono una scelta, sono un'illusione
   di scelta.

   Sono le tinte dei meeple veri -- rosso, blu, giallo, verde, viola,
   nero, bianco -- portate un passo verso il basso, cosi' stanno insieme
   al resto del sito senza diventare fluorescenti. */
const CORPI = [
  '#c1552c', '#a8341f', '#d08a3a', '#c9a227',
  '#6a7f3f', '#3f6b4a', '#2f7d72', '#2f6690',
  '#3f4f63', '#54487f', '#7b3f6b', '#8e6a4b',
  '#6a3a3a', '#33352b', '#8d8d84', '#efe9dd'
];
const FONDI = [
  '#f2f1ed', '#efe3cb', '#e6dcc3', '#dcd6c4',
  '#cfccc8', '#c7af98', '#cbbfae', '#bfc4b4',
  '#a6a89c', '#b9c2c6', '#c9b6b0', '#8e8e83'
];

/* La faccia predefinita. Non e' casuale davvero: viene dall'uuid, cosi'
   due persone diverse partono quasi sempre da un meeple diverso e
   nessuno si ritrova identico al vicino appena entrato. */
function avatarDa(id){
  let n = 0;
  String(id || '').split('').forEach(function(c, i){ n += c.charCodeAt(0) * (i + 1); });
  return { corpo: CORPI[n % CORPI.length], fondo: FONDI[(n >> 3) % FONDI.length], segno: 0 };
}

function normalizza(r){
  if (!r) return null;
  return {
    id: r.id,
    nick: r.nick || '',
    nome: r.nome || '',
    avatar: r.avatar || avatarDa(r.id),
    stanza: r.stanza || null,
    codice: r.codice || ''
  };
}

/* --- il mio profilo ---------------------------------------------- */
async function carica(){
  const c = cli();
  if (!c || !AUTH.stato().dentro){ io = null; return null; }
  try {
    /* Le colonne si elencano, non si chiede `*`. Due motivi, e tutti e
       due si sono fatti sentire:

       - `codice` non e' piu' leggibile da `authenticated` (migrazione
         codice_riservato), quindi `select *` fallirebbe per tutti;
       - `select *` su una tabella a cui mancano delle colonne non si
         lamenta, torna quelle che ci sono. Il sito vedeva un profilo
         senza nick, lo chiedeva, e il salvataggio falliva su una
         colonna inesistente: una finestra che non si poteva chiudere. */
    /* Si chiede tutto, e se una colonna non c'e' ancora si richiede
       senza. PostgREST su una colonna inesistente risponde 42703 e
       butta via l'intera lettura: senza questo, aggiungere una colonna
       in una migrazione non ancora applicata spegne il profilo per
       intero invece di togliergli una riga. Vale per ogni colonna che
       verra' dopo. */
    let r = await c.from('profili').select('id,nome,nick,avatar,stanza,creato')
                   .eq('id', AUTH.stato().id).single();
    if (r.error && r.error.code === '42703'){
      r = await c.from('profili').select('id,nome,nick,avatar,creato')
                 .eq('id', AUTH.stato().id).single();
    }
    if (r.error) throw r.error;

    io = normalizza(r.data || {});
    guaio = '';

    /* Il proprio codice arriva da una funzione, non dalla riga: dalla
       riga non uscirebbe piu' -- ed e' esattamente quello che si vuole,
       perche' dalla riga di un AMICO usciva.

       Se la funzione non c'e' ancora, il profilo resta buono lo stesso:
       manca il codice e si dice quello. Buttare via nick e faccia
       perche' manca un codice sarebbe sproporzionato. */
    try {
      const cod = await c.rpc('mio_codice');
      if (cod.error) throw cod.error;
      io.codice = cod.data || '';
    } catch(e2){
      io.codice = '';
      guaio = TP('err.codiceMigr');
    }
  } catch(e){
    io = null;
    guaio = (e && (e.code === '42703' || e.code === '42P01'))
      ? TP('err.profiliMigr')
      : (e && e.message) || String(e);
  }
  return io;
}

function mio(){ return io; }
function problema(){ return guaio; }

// Finche' il nick non c'e', il sito lo chiede: e' quello che ti rende
// trovabile, e senza non ha senso avere amici.
function serveNick(){ return !!io && !io.nick; }

function nickValido(n){
  const t = String(n || '').trim();
  if (t.length < 3)  return TP('nick.corto');
  if (t.length > 20) return TP('nick.lungo');
  // niente spazi ai lati gia' tolti; dentro si', un nick puo' essere due parole
  if (!/^[\w \-.']+$/.test(t)) return TP('nick.segni');
  return '';
}

async function salvaNick(n){
  const c = cli();
  if (!c || !io) throw new Error(TP('err.nonEntrato'));
  const t = String(n).trim();
  const male = nickValido(t);
  if (male) throw new Error(male);

  const r = await c.from('profili').update({ nick: t }).eq('id', io.id);
  // 23505: violazione di unicita'. E' l'unico errore che ha una
  // spiegazione utile per chi sta scrivendo, quindi la si da'.
  if (r.error){
    if (r.error.code === '23505') throw new Error(TP('nick.preso', {n: t}));
    throw r.error;
  }
  io.nick = t;
  return io;
}

async function salvaAvatar(av){
  const c = cli();
  if (!c || !io) throw new Error(TP('err.nonEntrato'));
  const r = await c.from('profili').update({ avatar: av }).eq('id', io.id);
  if (r.error) throw r.error;
  io.avatar = av;
  return io;
}

/* --- amici ------------------------------------------------------
   Due letture invece di una join: le regole del database filtrano
   `amicizie` per me e `profili` per chi mi riguarda, e chiedere una
   join attraverso due policy diverse e' il modo piu' rapido di
   scrivere una query che funziona finche' non cambia una policy. */
async function caricaAmici(){
  const c = cli();
  if (!c || !io){ gente = []; return gente; }
  try {
    const r = await c.from('amicizie').select('*');
    if (r.error) throw r.error;

    const righe = r.data || [];
    const altri = righe.map(function(x){
      return x.richiedente === io.id ? x.destinatario : x.richiedente;
    });
    let per = {};
    if (altri.length){
      // `stanza` serve a far vedere la libreria di un amico com'e' da lui;
      // se la colonna non c'e' ancora, se ne fa a meno
      let p = await c.from('profili').select('id,nick,nome,avatar,stanza').in('id', altri);
      if (p.error && p.error.code === '42703'){
        p = await c.from('profili').select('id,nick,nome,avatar').in('id', altri);
      }
      if (p.error) throw p.error;
      (p.data || []).forEach(function(x){ per[x.id] = normalizza(x); });
    }

    gente = righe.map(function(x){
      const altro = x.richiedente === io.id ? x.destinatario : x.richiedente;
      return {
        id: altro,
        profilo: per[altro] || { id: altro, nick: '', nome: '', avatar: avatarDa(altro) },
        stato: x.stato,
        // 'uscita' = l'ho chiesta io e aspetto; 'entrata' = tocca a me rispondere
        verso: x.richiedente === io.id ? 'uscita' : 'entrata'
      };
    });
  } catch(e){
    gente = [];
    guaio = (e && e.code === '42P01') ? TP('err.profiliMigr')
                                      : (e && e.message) || String(e);
  }
  return gente;
}

function amici(){    return gente.filter(function(x){ return x.stato === 'accettata'; }); }
function daAccettare(){ return gente.filter(function(x){ return x.stato === 'in attesa' && x.verso === 'entrata'; }); }
function inAttesa(){ return gente.filter(function(x){ return x.stato === 'in attesa' && x.verso === 'uscita'; }); }

/* Il server risponde con un CODICE, non con una frase, e la frase si
   cerca quando si MOSTRA: una mappa di testi costruita all'avvio
   resterebbe per sempre nella lingua di quel momento. */
const RISPOSTE = {
  'chiesta':  'ami.chiesta',
  'inviata':  'ami.inviata',
  'nessuno':  'ami.nessuno',
  'gia':      'ami.gia',
  'te stesso':'ami.teStesso',
  'fuori':    'err.nonEntrato'
};
function frase(codice){
  return RISPOSTE[codice] ? TP(RISPOSTE[codice]) : codice;
}

async function chiediPerCodice(cod){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
  const r = await c.rpc('chiedi_amicizia_codice', { cod: String(cod || '').trim() });
  if (r.error) throw r.error;
  await caricaAmici();
  return { esito: r.data, testo: frase(r.data) };
}

async function chiediPerEmail(mail){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
  const r = await c.rpc('chiedi_amicizia_email', { indirizzo: String(mail || '').trim() });
  if (r.error) throw r.error;
  await caricaAmici();
  return { esito: r.data, testo: frase(r.data) };
}

async function accetta(altro){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
  // solo il destinatario puo' accettare, e il destinatario sono io
  const r = await c.from('amicizie').update({ stato: 'accettata' })
                   .eq('richiedente', altro).eq('destinatario', io.id);
  if (r.error) throw r.error;
  await caricaAmici();
}

/* Rifiutare, ritirare e sciogliere sono lo stesso gesto per il
   database: la riga sparisce. Cambia solo come si chiama nel posto in
   cui la si preme. */
async function togli(altro){
  const c = cli();
  if (!c) throw new Error(TP('err.nonEntrato'));
  const r = await c.from('amicizie').delete()
    .or('and(richiedente.eq.' + altro + ',destinatario.eq.' + io.id + '),' +
        'and(richiedente.eq.' + io.id + ',destinatario.eq.' + altro + ')');
  if (r.error) throw r.error;
  await caricaAmici();
}

return {
  CORPI: CORPI, FONDI: FONDI,
  carica: carica, mio: mio, problema: problema,
  serveNick: serveNick, nickValido: nickValido,
  salvaNick: salvaNick, salvaAvatar: salvaAvatar, avatarDa: avatarDa,
  caricaAmici: caricaAmici, amici: amici,
  daAccettare: daAccettare, inAttesa: inAttesa,
  chiediPerCodice: chiediPerCodice, chiediPerEmail: chiediPerEmail,
  accetta: accetta, togli: togli
};
})();
