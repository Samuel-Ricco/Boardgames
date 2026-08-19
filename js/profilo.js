/* ============================================================
   Il profilo e gli amici.

   Il profilo e' la prima cosa del sito che non parla di giochi: parla
   di chi li gioca. Tre dati e basta -- un nick, una faccia, un codice
   -- ma sono quelli che permettono a due persone di trovarsi.

   `nick` e `codice` fanno due mestieri diversi apposta: il nick ti fa
   RICONOSCERE, e lo vede chiunque ti incontri; il codice ti fa TROVARE,
   e lo dai a chi vuoi tu. Per questo il codice non esce mai dal
   profilo di qualcun altro: nelle regole del database la lettura del
   profilo altrui non lo comprende.

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
const CORPI = ['#c1552c', '#9a6a15', '#3f4f63', '#4d5a48', '#6a3a3a',
               '#57406a', '#2c241b', '#a8432a'];
const FONDI = ['#efe3cb', '#e0d2b6', '#d9c9ad', '#e8dcc6'];

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
    codice: r.codice || ''
  };
}

/* --- il mio profilo ---------------------------------------------- */
async function carica(){
  const c = cli();
  if (!c || !AUTH.stato().dentro){ io = null; return null; }
  try {
    const r = await c.from('profili').select('*').eq('id', AUTH.stato().id).single();
    if (r.error) throw r.error;

    /* `select *` su una tabella a cui mancano delle colonne non si
       lamenta: torna le colonne che ci sono. Senza questo controllo il
       sito vedeva un profilo senza nick, lo chiedeva, e il salvataggio
       falliva su una colonna inesistente -- cioe' una finestra che non
       si puo' chiudere. Meglio accorgersene qui e dirlo una volta. */
    const riga = r.data || {};
    if (!('nick' in riga) || !('codice' in riga)){
      io = null;
      guaio = 'manca la migrazione profili_e_amici';
      return io;
    }

    io = normalizza(riga);
    guaio = '';
  } catch(e){
    io = null;
    guaio = (e && (e.code === '42703' || e.code === '42P01'))
      ? 'manca la migrazione profili_e_amici'
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
  if (t.length < 3)  return 'almeno tre caratteri';
  if (t.length > 20) return 'al massimo venti';
  // niente spazi ai lati gia' tolti; dentro si', un nick puo' essere due parole
  if (!/^[\w \-.']+$/.test(t)) return 'lettere, numeri, spazio, trattino e punto';
  return '';
}

async function salvaNick(n){
  const c = cli();
  if (!c || !io) throw new Error('non sei entrato');
  const t = String(n).trim();
  const male = nickValido(t);
  if (male) throw new Error(male);

  const r = await c.from('profili').update({ nick: t }).eq('id', io.id);
  // 23505: violazione di unicita'. E' l'unico errore che ha una
  // spiegazione utile per chi sta scrivendo, quindi la si da'.
  if (r.error){
    if (r.error.code === '23505') throw new Error('"' + t + '" e\' gia\' di qualcun altro');
    throw r.error;
  }
  io.nick = t;
  return io;
}

async function salvaAvatar(av){
  const c = cli();
  if (!c || !io) throw new Error('non sei entrato');
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
      const p = await c.from('profili').select('id,nick,nome,avatar').in('id', altri);
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
    guaio = (e && e.code === '42P01') ? 'manca la migrazione profili_e_amici'
                                      : (e && e.message) || String(e);
  }
  return gente;
}

function amici(){    return gente.filter(function(x){ return x.stato === 'accettata'; }); }
function daAccettare(){ return gente.filter(function(x){ return x.stato === 'in attesa' && x.verso === 'entrata'; }); }
function inAttesa(){ return gente.filter(function(x){ return x.stato === 'in attesa' && x.verso === 'uscita'; }); }

const RISPOSTE = {
  'chiesta':  'richiesta mandata',
  'inviata':  'se quell\'indirizzo ha un account, la richiesta e\' arrivata',
  'nessuno':  'nessun codice cosi\'',
  'gia':      'con questa persona c\'e\' gia\' qualcosa in corso',
  'te stesso':'quello e\' il tuo codice',
  'fuori':    'non sei entrato'
};

async function chiediPerCodice(cod){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  const r = await c.rpc('chiedi_amicizia_codice', { cod: String(cod || '').trim() });
  if (r.error) throw r.error;
  await caricaAmici();
  return { esito: r.data, testo: RISPOSTE[r.data] || r.data };
}

async function chiediPerEmail(mail){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
  const r = await c.rpc('chiedi_amicizia_email', { indirizzo: String(mail || '').trim() });
  if (r.error) throw r.error;
  await caricaAmici();
  return { esito: r.data, testo: RISPOSTE[r.data] || r.data };
}

async function accetta(altro){
  const c = cli();
  if (!c) throw new Error('non sei entrato');
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
  if (!c) throw new Error('non sei entrato');
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
