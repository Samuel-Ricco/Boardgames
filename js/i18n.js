/* ============================================================
   DUE LINGUE, UN DIZIONARIO

   Il sito non aveva nessun sistema di traduzione: le parole stavano
   dentro il markup e dentro le stringhe del JS, in italiano, e basta.
   Qui c'e' un posto solo che le tiene tutte e due le volte.

   Come funziona:

   - ogni testo ha una CHIAVE puntata (`pro.esci`, `gate.entraT`), e il
     dizionario ha un ramo per lingua. Le chiavi dicono dove sta il
     testo, non cosa dice: `pro.esci` resta `pro.esci` anche quando la
     frase cambia.
   - nel markup si scrive `data-i18n="chiave"` sull'elemento, e
     `data-i18n-ph` / `data-i18n-title` / `data-i18n-aria` per
     segnaposto, titolo ed etichetta. `applica()` gira su tutto il
     documento e riempie.
   - nel JS si chiama `T('chiave')`, che accetta anche dei dati:
     `T('mia.conta', {n: 3})` sostituisce `{n}`.

   Tre scelte che vale la pena spiegare:

   1. **`data-i18n` scrive in `innerHTML`, non in `textContent`.** I
      testi sono nostri e contengono grassetti ed entita'; e' il modo in
      cui il resto del sito scrive gia' nel documento. Per gli attributi
      invece serve testo piano, e ci pensa `piano()`.
   2. **Dove dentro una frase c'e' un pezzo che riempie il JS** -- il
      nome di un amico, il titolo di un gioco -- la frase e' spezzata in
      due chiavi attorno a quel nodo. Con una chiave sola, riapplicare
      la lingua cancellerebbe quello che il JS ci aveva messo.
   3. **Questo file non dipende da niente.** Come il selettore di
      smlrcc, vive fuori da ogni `init()`: se three.js non carica, o se
      non c'e' WebGL, la lingua si cambia lo stesso.

   Il file resta ASCII come tutti gli altri `.js`: gli accenti si
   scrivono con le entita' HTML, che `piano()` scioglie quando servono
   in un attributo.
   ============================================================ */
const I18N = (function(){
'use strict';

const CHIAVE = 'dado-lingua';
const LINGUE = ['it', 'en'];

/* --- il dizionario ------------------------------------------------
   In ordine di schermata, come si incontrano nel markup. */
const DIZ = {

it: {
  /* --- la pagina --- */
  'meta.titolo':        'il dado &egrave; trap &mdash; recensioni di giochi da tavolo',
  'meta.descrizione':   'Una libreria di giochi da tavolo in 3D: scorri gli scaffali, prendi una scatola, leggi la recensione. E un catalogo da sfogliare senza account.',

  /* --- la testata --- */
  'testa.tagline':      'recensioni di giochi da tavolo',
  'nav.aria':           'sezioni del sito',
  'nav.collezione':     'collezione',
  'nav.catalogo':       'catalogo',
  'nav.profilo':        'profilo',
  'testa.contaTitolo':  'vedi la collezione come elenco',
  'testa.entra':        'entra',
  'testa.esci':         'esci',
  'testa.esciTitolo':   'chiudi la sessione',

  /* --- in casa di un amico --- */
  'visita.di':          'la libreria di',
  'visita.torna':       'torna alla tua',

  /* --- l'imbuto: cosa vedi sullo scaffale --- */
  'vista.apriTitolo':   'cerca, ordina, scegli il mobile',
  'vista.apriAria':     'filtri',
  'vista.aria':         'cosa vedi sullo scaffale',
  'vista.occhiello':    'la vista',
  'vista.cercaPh':      'cerca un gioco&hellip;',
  'vista.cercaAria':    'cerca nella collezione',
  'vista.pulisciTitolo':'pulisci la ricerca',
  'vista.pulisciAria':  'pulisci',
  'vista.ordinaPer':    'ordina per',
  'sort.mio':           'il mio ordine',
  'sort.aggiunta':      'data di aggiunta',
  'sort.nome':          'nome',
  'sort.voto':          'voto',
  'vista.ilMobile':     'il mobile',
  'vista.nuovaLib':     'nuova libreria',

  /* --- il pannello della libreria --- */
  'stanza.apriTitolo':  'la libreria: luce, nome, aspetto, ordine',
  'stanza.apriAria':    'la libreria',
  'stanza.aria':        'la tua libreria',
  'stanza.occhiello':   'la libreria',
  'stanza.luce':        'luce',
  'stanza.luceAria':    'luce della stanza',
  'stanza.nomeAria':    'nome di questa libreria',
  'stanza.salva':       'salva',
  'stanza.modifica':    'modifica libreria',
  'stanza.legnoDi':     'legno e arredi di',
  'stanza.questoMobile':'questo mobile',
  'stanza.nessunMobile':'nessun mobile qui',
  'stanza.scaffali':    'scaffali',
  'stanza.muro':        'muro',
  'stanza.pavimento':   'pavimento',
  'stanza.arredi':      'arredi',
  'stanza.dellaStanza': 'luce, muro e pavimento sono della stanza intera',
  'stanza.siSalva':     'si salva da solo',
  'stanza.salvando':    'sto salvando',
  'stanza.salvata':     'salvata',
  'stanza.nonSalvata':  'non salvata: {e}',
  'stanza.comEra':      'com&rsquo;era',
  'stanza.comEraOk':    'sicuro?',
  'stanza.ordina':      'ordina librerie',
  'stanza.ordineParete':'l&rsquo;ordine qui &egrave; l&rsquo;ordine lungo la parete',
  'stanza.piu':         'aggiungi una libreria',
  'stanza.meno':        'elimina questa libreria',
  'stanza.menoOk':      'sicuro? tocca ancora',
  'stanza.menoScorta':  'qui non c&rsquo;&egrave; ancora nessun mobile: trascinaci una scatola, o aggiungine uno',
  'stanza.menoUnica':   'e&rsquo; l&rsquo;unica libreria che hai: prima aggiungine un&rsquo;altra',
  'stanza.menoTitolo':  'elimina {nome}',
  'stanza.elimina':     'elimina',
  'stanza.sposta':      'tieni premuto e trascina per riordinare',
  'stanza.nienteArredo':'nessun mobile da arredare',
  'rail.aria':          'scegli la libreria',

  /* --- il pannello della recensione --- */
  'pan.chiudi':         'chiudi',
  'pan.occhiello':      'la recensione',
  'pan.occhielloDi':    'la recensione di {chi}',
  'pan.voto':           'il voto della<br>ludoteca',
  'pan.bgg':            'scheda su BoardGameGeek &#8599;',
  'pan.prefTitolo':     'segnalo fra i preferiti',
  'pan.prefTolto':      'togli dai preferiti',
  'pan.cuoreTitolo':    'questa recensione mi e&rsquo; piaciuta',
  'pan.miaTitolo':      'scrivi cosa ne pensi tu',
  'pan.mia':            'la tua recensione',
  'pan.segnaTitolo':    'segna una partita a questo gioco',
  'pan.segna':          'partita',
  'pan.schedaTitolo':   'correggi la scheda',
  'pan.scheda':         'scheda',
  'pan.fuoriTitolo':    'lascia lo scaffale, resta nella tua collezione',
  'pan.fuori':          'dallo scaffale',
  'pan.eliminaTitolo':  'elimina il gioco dalla tua collezione, per sempre',
  'pan.elimina':        'elimina',

  /* --- le sezioni in basso --- */
  'tab.libreria':       'libreria',
  'tab.catalogo':       'catalogo',
  'tab.profilo':        'profilo',

  /* --- la collezione come elenco --- */
  'mia.aria':           'la tua libreria come elenco',
  'mia.occhiello':      'la tua collezione',
  'mia.occhielloDi':    'la collezione di {chi}',
  'mia.tutti':          'tutti i giochi',
  'mia.gruppi':         'gruppi',
  'mia.gestisci':       'gestisci gruppi',
  'mia.aggiungi':       '+ aggiungi un gioco',
  'mia.conta':          'la mia collezione: <b>{n}</b>',
  'mia.contaSua':       'la sua collezione: <b>{n}</b>',
  'mia.contaCerca':     'la mia collezione: <b>{n}</b> di {m}',

  /* --- il catalogo --- */
  'cat.aria':           'catalogo dei giochi',
  'cat.occhiello':      'il catalogo',
  'cat.cercaPh':        'cerca un gioco&hellip;',
  'cat.cercaAria':      'cerca nel catalogo',
  'cat.cerca':          'cerca',
  'cat.tutti':          'tutti',
  'cat.piu':            'altri giochi',

  /* --- il profilo --- */
  'pro.aria':           'il tuo profilo',
  'pro.occhiello':      'il tuo profilo',
  'pro.meeple':         'meeple',
  'pro.nick':           'nick',
  'pro.codice':         'codice amico',
  'pro.copia':          'copia il codice',
  'pro.copiato':        'codice copiato',
  'pro.codiceNota':     'Dallo a chi vuoi che ti trovi. Non compare mai nel profilo che vedono gli altri.',
  'pro.esci':           'esci dall&rsquo;account',
  'pro.esciOk':         'sicuro? tocca ancora',
  'pro.facciaH':        'La tua faccia',
  'pro.facciaNota':     'Un meeple, il tuo colore e il tuo fondo.',
  'pro.labMeeple':      'meeple',
  'pro.labFondo':       'fondo',
  'pro.labSalva':       'salva la faccia',
  'pro.labAnnulla':     'lascia perdere',
  'pro.amici':          'Amici',
  'pro.amiciPh':        'codice amico, o email',
  'pro.amiciAria':      'codice amico o email',
  'pro.chiedi':         'chiedi',
  'pro.giocatori':      'Giocatori',
  'pro.giocatoriNota':  'I nomi che usi per segnare le partite. Al tavolo c&rsquo;&egrave; quasi sempre qualcuno che sul sito non c&rsquo;&egrave;: qui ci sta lo stesso.',
  'pro.giocatorePh':    'un nome',
  'pro.giocatoreAria':  'nome del giocatore',
  'pro.giocatoreAgg':   'aggiungi',
  'pro.partite':        'Partite',
  'pro.parNuova':       'segna una partita',
  'pro.lingua':         'lingua',

  /* --- il nick al primo accesso --- */
  'nick.occhiello':     'ancora una cosa',
  'nick.h':             'Come ti chiamiamo?',
  'nick.nota':          'Il nick e&rsquo; come ti vedono gli amici. Si cambia quando vuoi dal profilo.',
  'nick.aria':          'il tuo nick',
  'nick.ok':            'avanti',

  /* --- il cancello --- */
  'gate.q':             'Chi apre la libreria?',
  'gate.entraT':        'Entra con Google',
  'gate.entraD':        'La tua libreria ti aspetta: i giochi che aggiungi restano tuoi e li rivedi da qualsiasi dispositivo.',
  'gate.ospiteT':       'Guarda il catalogo',
  'gate.ospiteD':       'Le recensioni si leggono senza account. Niente libreria, per&ograve;: quella comincia quando entri.',
  'gate.nota':          'Ogni account ha la sua libreria, e la vede solo lui: sono le regole del database a garantirlo, non questa schermata.',
  'gate.nonRiuscito':   'Accesso non riuscito: {e} &mdash; puoi comunque guardare il catalogo.',

  /* --- il caricamento --- */
  'load.dado':          'sto tirando il dado&hellip;',

  /* --- aggiungere un gioco --- */
  'add.chiudi':         'chiudi',
  'add.occhiello':      'nuovo gioco',
  'add.h':              'Aggiungi alla libreria',
  'add.qPh':            'cerca su BoardGameGeek&hellip;',
  'add.go':             'cerca',
  'add.man':            'oppure scrivilo a mano',
  'add.titolo':         'titolo',
  'add.bgg':            'id BGG',
  'add.autore':         'autore',
  'add.editore':        'editore',
  'add.anno':           'anno',
  'add.giocatori':      'giocatori',
  'add.durata':         'durata',
  'add.voto':           'voto',
  'add.recensione':     'recensione',
  'add.recPh':          'Scrivi qui. Una riga vuota separa un capoverso dall&rsquo;altro.',
  'add.pubblica':       'pubblica la recensione nel <b>catalogo</b>, dove la legge chiunque <small>serve l&rsquo;id BGG: &egrave; la chiave con cui il catalogo la ritrova</small>',
  'add.copertina':      'copertina',
  'add.copertinaNota':  'dal press kit dell&rsquo;editore, se ce l&rsquo;hai: Wikidata le copertine non le ha',
  'add.metti':          'metti sullo scaffale',
  'add.dove':           'Le modifiche restano su questo browser.',
  'add.esporta':        'esporta js/data.js',
  'add.ripristina':     'ripristina',

  /* --- i gruppi --- */
  'gru.occhiello':      'etichette',
  'gru.h':              'I tuoi gruppi',
  'gru.nota':           'Un gioco pu&ograve; stare in pi&ugrave; gruppi, e i gruppi attraversano le librerie: rispondono a <b>che cos&rsquo;&egrave;</b>, non a dove sta.',
  'gru.ph':             'party games, strategici&hellip;',
  'gru.aria':           'nome del gruppo',
  'gru.crea':           'crea',
  'gru.annulla':        'annulla',
  'gru.ok':             'fatto',

  /* --- la tua recensione --- */
  'rec.chiudi':         'chiudi',
  'rec.occhiello':      'quello che ne pensi tu',
  'rec.h':              'La tua recensione',
  'rec.nota1':          'La leggono i tuoi amici quando aprono',
  'rec.nota2':          'nella tua libreria. Poche righe bastano.',
  'rec.voto':           'voto',
  'rec.recensione':     'recensione',
  'rec.ph':             'Com&rsquo;&egrave;? A chi lo consiglieresti? Una riga vuota separa un capoverso.',
  'rec.salva':          'salva',

  /* --- segnare una partita --- */
  'pa.occhiello':       'una serata',
  'pa.h':               'Segna una partita',
  'pa.gioco':           'gioco',
  'pa.giocoPh':         'cerca nella tua collezione o nel catalogo',
  'pa.data':            'data',
  'pa.ora':             'ora',
  'pa.chiCera':         'chi c&rsquo;era',
  'pa.vaiGiocatori':    'aggiungi un giocatore',
  'pa.note':            'note',
  'pa.notePh':          'com&rsquo;&egrave; andata, se ti va',
  'pa.annulla':         'annulla',
  'pa.salva':           'salva la partita',
  'pa.togli':           'elimina',

  /* --- senza WebGL --- */
  'flat.lead':          'La libreria in 3D non parte su questo dispositivo, ma le recensioni sono tutte qui.'
},

en: {
  'meta.titolo':        'il dado &egrave; trap &mdash; board game reviews',
  'meta.descrizione':   'A board game collection in 3D: slide along the shelves, take a box down, read the review. Plus a catalogue you can browse without an account.',

  'testa.tagline':      'board game reviews',
  'nav.aria':           'site sections',
  'nav.collezione':     'collection',
  'nav.catalogo':       'catalogue',
  'nav.profilo':        'profile',
  'testa.contaTitolo':  'see the collection as a list',
  'testa.entra':        'sign in',
  'testa.esci':         'sign out',
  'testa.esciTitolo':   'end the session',

  'visita.di':          'the collection of',
  'visita.torna':       'back to yours',

  'vista.apriTitolo':   'search, sort, choose the bookcase',
  'vista.apriAria':     'filters',
  'vista.aria':         'what you see on the shelf',
  'vista.occhiello':    'the view',
  'vista.cercaPh':      'find a game&hellip;',
  'vista.cercaAria':    'search the collection',
  'vista.pulisciTitolo':'clear the search',
  'vista.pulisciAria':  'clear',
  'vista.ordinaPer':    'sort by',
  'sort.mio':           'my own order',
  'sort.aggiunta':      'date added',
  'sort.nome':          'name',
  'sort.voto':          'rating',
  'vista.ilMobile':     'the bookcase',
  'vista.nuovaLib':     'new bookcase',

  'stanza.apriTitolo':  'the bookcase: light, name, look, order',
  'stanza.apriAria':    'the bookcase',
  'stanza.aria':        'your bookcase',
  'stanza.occhiello':   'the bookcase',
  'stanza.luce':        'light',
  'stanza.luceAria':    'light in the room',
  'stanza.nomeAria':    'name of this bookcase',
  'stanza.salva':       'save',
  'stanza.modifica':    'edit bookcase',
  'stanza.legnoDi':     'wood and props of',
  'stanza.questoMobile':'this bookcase',
  'stanza.nessunMobile':'no bookcase here',
  'stanza.scaffali':    'shelves',
  'stanza.muro':        'wall',
  'stanza.pavimento':   'floor',
  'stanza.arredi':      'props',
  'stanza.dellaStanza': 'light, wall and floor belong to the whole room',
  'stanza.siSalva':     'saves itself',
  'stanza.salvando':    'saving',
  'stanza.salvata':     'saved',
  'stanza.nonSalvata':  'not saved: {e}',
  'stanza.comEra':      'as it was',
  'stanza.comEraOk':    'sure?',
  'stanza.ordina':      'order the bookcases',
  'stanza.ordineParete':'the order here is the order along the wall',
  'stanza.piu':         'add a bookcase',
  'stanza.meno':        'delete this bookcase',
  'stanza.menoOk':      'sure? tap again',
  'stanza.menoScorta':  'there is no bookcase here yet: drag a box in, or add one',
  'stanza.menoUnica':   'it is the only bookcase you have: add another one first',
  'stanza.menoTitolo':  'delete {nome}',
  'stanza.elimina':     'delete',
  'stanza.sposta':      'press and drag to reorder',
  'stanza.nienteArredo':'no bookcase to furnish',
  'rail.aria':          'choose the bookcase',

  'pan.chiudi':         'close',
  'pan.occhiello':      'the review',
  'pan.occhielloDi':    'the review by {chi}',
  'pan.voto':           'the library&rsquo;s<br>rating',
  'pan.bgg':            'page on BoardGameGeek &#8599;',
  'pan.prefTitolo':     'mark as a favourite',
  'pan.prefTolto':      'remove from favourites',
  'pan.cuoreTitolo':    'I liked this review',
  'pan.miaTitolo':      'write what you think',
  'pan.mia':            'your review',
  'pan.segnaTitolo':    'log a game night for this one',
  'pan.segna':          'game night',
  'pan.schedaTitolo':   'correct the details',
  'pan.scheda':         'details',
  'pan.fuoriTitolo':    'leave the shelf, stay in your collection',
  'pan.fuori':          'off the shelf',
  'pan.eliminaTitolo':  'delete the game from your collection, for good',
  'pan.elimina':        'delete',

  'tab.libreria':       'shelves',
  'tab.catalogo':       'catalogue',
  'tab.profilo':        'profile',

  'mia.aria':           'your collection as a list',
  'mia.occhiello':      'your collection',
  'mia.occhielloDi':    'the collection of {chi}',
  'mia.tutti':          'all games',
  'mia.gruppi':         'groups',
  'mia.gestisci':       'manage groups',
  'mia.aggiungi':       '+ add a game',
  'mia.conta':          'my collection: <b>{n}</b>',
  'mia.contaSua':       'their collection: <b>{n}</b>',
  'mia.contaCerca':     'my collection: <b>{n}</b> of {m}',

  'cat.aria':           'catalogue of games',
  'cat.occhiello':      'the catalogue',
  'cat.cercaPh':        'find a game&hellip;',
  'cat.cercaAria':      'search the catalogue',
  'cat.cerca':          'search',
  'cat.tutti':          'all',
  'cat.piu':            'more games',

  'pro.aria':           'your profile',
  'pro.occhiello':      'your profile',
  'pro.meeple':         'meeple',
  'pro.nick':           'name',
  'pro.codice':         'friend code',
  'pro.copia':          'copy the code',
  'pro.copiato':        'code copied',
  'pro.codiceNota':     'Give it to whoever you want to be found by. It never shows up in the profile other people see.',
  'pro.esci':           'sign out of the account',
  'pro.esciOk':         'sure? tap again',
  'pro.facciaH':        'Your face',
  'pro.facciaNota':     'A meeple, your colour and your background.',
  'pro.labMeeple':      'meeple',
  'pro.labFondo':       'background',
  'pro.labSalva':       'save the face',
  'pro.labAnnulla':     'never mind',
  'pro.amici':          'Friends',
  'pro.amiciPh':        'friend code, or email',
  'pro.amiciAria':      'friend code or email',
  'pro.chiedi':         'ask',
  'pro.giocatori':      'Players',
  'pro.giocatoriNota':  'The names you use when logging game nights. At the table there is almost always someone who is not on the site: they belong here all the same.',
  'pro.giocatorePh':    'a name',
  'pro.giocatoreAria':  'player name',
  'pro.giocatoreAgg':   'add',
  'pro.partite':        'Game nights',
  'pro.parNuova':       'log a game night',
  'pro.lingua':         'language',

  'nick.occhiello':     'one more thing',
  'nick.h':             'What should we call you?',
  'nick.nota':          'Your name is how friends see you. Change it whenever you like from your profile.',
  'nick.aria':          'your name',
  'nick.ok':            'next',

  'gate.q':             'Who is opening the bookcase?',
  'gate.entraT':        'Sign in with Google',
  'gate.entraD':        'Your collection is waiting: the games you add stay yours, and you see them again from any device.',
  'gate.ospiteT':       'Browse the catalogue',
  'gate.ospiteD':       'The reviews read fine without an account. No collection though: that starts when you sign in.',
  'gate.nota':          'Every account has its own collection and only that account sees it: it is the database rules that guarantee it, not this screen.',
  'gate.nonRiuscito':   'Sign-in failed: {e} &mdash; you can still browse the catalogue.',

  'load.dado':          'rolling the die&hellip;',

  'add.chiudi':         'close',
  'add.occhiello':      'new game',
  'add.h':              'Add to the collection',
  'add.qPh':            'search BoardGameGeek&hellip;',
  'add.go':             'search',
  'add.man':            'or type it in by hand',
  'add.titolo':         'title',
  'add.bgg':            'BGG id',
  'add.autore':         'designer',
  'add.editore':        'publisher',
  'add.anno':           'year',
  'add.giocatori':      'players',
  'add.durata':         'length',
  'add.voto':           'rating',
  'add.recensione':     'review',
  'add.recPh':          'Write here. An empty line separates one paragraph from the next.',
  'add.pubblica':       'publish the review in the <b>catalogue</b>, where anyone can read it <small>needs the BGG id: it is the key the catalogue finds it by</small>',
  'add.copertina':      'cover',
  'add.copertinaNota':  'from the publisher&rsquo;s press kit, if you have it: Wikidata does not carry covers',
  'add.metti':          'put it on the shelf',
  'add.dove':           'Changes stay on this browser.',
  'add.esporta':        'export js/data.js',
  'add.ripristina':     'reset',

  'gru.occhiello':      'labels',
  'gru.h':              'Your groups',
  'gru.nota':           'A game can be in several groups, and groups cut across bookcases: they answer <b>what it is</b>, not where it lives.',
  'gru.ph':             'party games, heavy euros&hellip;',
  'gru.aria':           'group name',
  'gru.crea':           'create',
  'gru.annulla':        'cancel',
  'gru.ok':             'done',

  'rec.chiudi':         'close',
  'rec.occhiello':      'what you think of it',
  'rec.h':              'Your review',
  'rec.nota1':          'Your friends read this when they open',
  'rec.nota2':          'in your collection. A few lines are plenty.',
  'rec.voto':           'rating',
  'rec.recensione':     'review',
  'rec.ph':             'What is it like? Who would you recommend it to? An empty line separates a paragraph.',
  'rec.salva':          'save',

  'pa.occhiello':       'an evening',
  'pa.h':               'Log a game night',
  'pa.gioco':           'game',
  'pa.giocoPh':         'search your collection or the catalogue',
  'pa.data':            'date',
  'pa.ora':             'time',
  'pa.chiCera':         'who was there',
  'pa.vaiGiocatori':    'add a player',
  'pa.note':            'notes',
  'pa.notePh':          'how it went, if you feel like it',
  'pa.annulla':         'cancel',
  'pa.salva':           'save the game night',
  'pa.togli':           'delete',

  'flat.lead':          'The 3D bookcase will not run on this device, but the reviews are all here.'
}

};

/* --- quale lingua ---------------------------------------------------
   Prima quella scelta, poi quella del browser. Italiano solo se il
   browser dice italiano: per tutti gli altri l'inglese e' la scelta
   meno sbagliata. */
let lingua = 'it';

function dedotta(){
  try {
    const salvata = localStorage.getItem(CHIAVE);
    if (LINGUE.indexOf(salvata) >= 0) return salvata;
  } catch(e){}
  let n = '';
  try { n = (navigator.language || (navigator.languages || [])[0] || '').toLowerCase(); } catch(e){}
  return n.indexOf('it') === 0 ? 'it' : 'en';
}

/* --- le traduzioni --------------------------------------------------
   Se una chiave manca, si vede: torna la chiave stessa invece di una
   stringa vuota. Un buco muto in una schermata non lo trova nessuno. */
function T(k, dati){
  const ramo = DIZ[lingua] || DIZ.it;
  let s = ramo[k];
  if (s === undefined) s = (DIZ.it[k] !== undefined ? DIZ.it[k] : k);
  if (dati){
    s = s.replace(/\{(\w+)\}/g, function(tutto, nome){
      return (dati[nome] === undefined || dati[nome] === null) ? tutto : String(dati[nome]);
    });
  }
  return s;
}

/* Testo piano: gli attributi non sciolgono le entita', quindi
   `title="cerca un gioco&hellip;"` scritto a mano mostrerebbe proprio
   quei caratteri. Si passa da un nodo di appoggio. */
const app = document.createElement('div');
function piano(s){
  app.innerHTML = s;
  return app.textContent;
}
function TP(k, dati){ return piano(T(k, dati)); }

/* --- riempire il documento ------------------------------------------ */
function tutti(r, sel){ return Array.prototype.slice.call(r.querySelectorAll(sel)); }

function applica(radice){
  const r = radice || document;
  tutti(r, '[data-i18n]').forEach(function(n){
    n.innerHTML = T(n.getAttribute('data-i18n'));
  });
  tutti(r, '[data-i18n-ph]').forEach(function(n){
    n.placeholder = TP(n.getAttribute('data-i18n-ph'));
  });
  tutti(r, '[data-i18n-title]').forEach(function(n){
    n.title = TP(n.getAttribute('data-i18n-title'));
  });
  tutti(r, '[data-i18n-aria]').forEach(function(n){
    n.setAttribute('aria-label', TP(n.getAttribute('data-i18n-aria')));
  });
  if (!radice){
    document.documentElement.lang = lingua;
    document.title = TP('meta.titolo');
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', TP('meta.descrizione'));
  }
}

/* --- chi vuole sapere che la lingua e' cambiata ----------------------
   Il markup lo rifa' `applica()`, ma tutto quello che il JS ha gia'
   disegnato -- l'elenco dei giochi, il catalogo, il profilo -- va
   ridisegnato da chi lo ha fatto. Si iscrivono loro. */
const ascoltatori = [];
function suCambio(fn){ if (typeof fn === 'function') ascoltatori.push(fn); }

function scegli(l){
  if (LINGUE.indexOf(l) < 0 || l === lingua) return;
  lingua = l;
  try { localStorage.setItem(CHIAVE, l); } catch(e){}
  applica();
  segnaScelte();
  ascoltatori.forEach(function(fn){
    try { fn(l); } catch(e){}
  });
}

/* I due selettori -- nel cancello e in fondo al profilo -- sono lo
   stesso comando in due posti, quindi si accendono insieme. */
function segnaScelte(){
  tutti(document, '[data-lingua]').forEach(function(b){
    const sua = b.getAttribute('data-lingua') === lingua;
    b.classList.toggle('on', sua);
    b.setAttribute('aria-pressed', sua ? 'true' : 'false');
  });
}

function collega(){
  tutti(document, '[data-lingua]').forEach(function(b){
    b.addEventListener('click', function(e){
      e.stopPropagation();
      scegli(b.getAttribute('data-lingua'));
    });
  });
  segnaScelte();
}

/* Parte da solo e subito: la lingua deve essere gia' quella giusta
   quando si vede il cancello, che e' la prima cosa che si legge. E non
   dipende da three.js ne' da `boot()`: se la scena non parte, la lingua
   si cambia lo stesso. */
function avvia(){
  lingua = dedotta();
  applica();
  collega();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
else avvia();

return {
  T: T, TP: TP, applica: applica, scegli: scegli, suCambio: suCambio,
  corrente: function(){ return lingua; }, LINGUE: LINGUE
};
})();

/* Scorciatoia: nel resto del sito si scrive `T('chiave')`. */
const T = I18N.T;
const TP = I18N.TP;
