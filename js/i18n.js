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
  'nav.partite':        'partite',
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
  'stanza.faretti':     'faretti',
  'stanza.farettiAria': 'faretti della libreria',
  'stanza.fariTinta':   'tinta',
  'stanza.nomeAria':    'nome di questa libreria',
  'stanza.salva':       'salva',
  'stanza.modifica':    'modifica libreria',
  'stanza.legnoDi':     'legno e arredi di',
  'stanza.questoMobile':'questo mobile',
  'stanza.nessunMobile':'nessun mobile qui',
  'stanza.scaffali':    'scaffali',
  'stanza.muro':        'muro',
  'stanza.pavimento':   'pavimento',
  'stanza.nomeColore':  'nome',
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
  'rail.prima':         'la libreria prima',
  'rail.dopo':          'la libreria dopo',
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
  'pan.fuori':          'togli dallo scaffale',
  'pan.eliminaTitolo':  'rimuovi il gioco dalla tua collezione, per sempre',
  'pan.elimina':        'rimuovi',
  'pan.eliminaLungo':   'rimuovi',
  'pan.eliminaOk':      'sicuro? sparisce',

  /* --- le sezioni in basso --- */
  'tab.libreria':       'libreria',
  'tab.catalogo':       'catalogo',
  'tab.partite':        'partite',
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
  'mia.torna':          'le mie librerie',
  'mia.tornaSua':       'la sua libreria',
  'mia.tornaTitolo':    'torna agli scaffali',
  'mia.apriTitolo':     'guarda la collezione come elenco',

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
  'pro.esci':           'sign out',
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
  'gate.ultima':        'ultima volta',
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
  'pa.occhiello':       'una partita',
  'pa.h':               'Segna una partita',
  'pa.gioco':           'gioco',
  'pa.giocoPh':         'cerca nella tua collezione o nel catalogo',
  'pa.data':            'data',
  'pa.chiCera':         'chi c&rsquo;era',
  'pa.chiPh':           'scrivi un nome',
  'pa.annulla':         'annulla',
  'pa.salva':           'salva la partita',
  'pa.togli':           'elimina',


  /* --- quello che dice il JS quando qualcosa non va --- */
  'err.senzaBackend':   'Supabase non configurato',
  'err.receNiente':     'senza backend le recensioni del catalogo non ci sono',
  'err.receTabella':    'manca la tabella `recensioni`: applica la migrazione recensioni_pubbliche',
  'err.recePubblica':   'senza backend non si pubblica niente',
  'err.receBgg':        'serve l&rsquo;id BGG: &egrave; la chiave della recensione',
  'err.appreMigrazione':'manca la migrazione apprezzamenti: applicala dal pannello Supabase',
  'err.serveAccesso':   'serve l&rsquo;accesso',
  'err.partiteMigr':    'manca la migrazione partite',
  'err.nonEntrato':     'non sei entrato',
  'err.serveNome':      'serve un nome',
  'err.nomeLungo':      'nome troppo lungo: al massimo {n} caratteri',
  'err.serveGioco':     'serve il gioco',
  'err.serveGiocatore': 'serve almeno un giocatore',
  'err.stanzaMigr':     'manca la migrazione stanza_librerie_gruppi',





  /* --- la scheda aperta --- */
  'pan.cuoreTolto':     'togli il cuore a questa recensione',
  'pan.credito':        'copertina di {a}',
  'spec.giocatori':     'giocatori',
  'spec.minuti':        'minuti',
  'spec.eta':           'et&agrave;',
  'spec.peso':          'peso bgg',
  'spec.anno':          'anno',
  'spec.min':           'min',
  'testa.cambiaMod':    'cambia modalit&agrave;',
  'testa.entraGoogle':  'entra con Google',
  'testa.admin':        'admin',
  'testa.utente':       'utente',

  /* --- il modulo di aggiunta --- */
  'add.ripristinaOk':   'sicuro? si perdono le aggiunte',
  'add.doveRemoto':     'Le modifiche vanno nel database, le vedono tutti.',
  'add.fonteBgg':       'Ricerca su <b>BoardGameGeek</b>, dal proxy locale.',
  'add.fonteWiki':      'Il token BGG non c&rsquo;&egrave; ancora, quindi cerco su <b>Wikidata</b>: circa 4.400 giochi invece di 175.000, e l&rsquo;immagine &egrave; spesso una foto del gioco allestito e non la scatola. <b>Controlla i campi prima di salvare</b> &mdash; l&rsquo;editore &egrave; quello che sbaglia pi&ugrave; spesso.',
  'add.hCorreggi':      'Correggi la scheda',
  'add.salvaModifiche': 'salva le modifiche',
  'add.noteModifica':   'Le modifiche vanno nella <b>tua</b> collezione. Lascia vuoto il campo copertina per tenere quella che c&rsquo;&egrave; gi&agrave;.',
  'add.cerco':          'cerco&hellip;',
  'add.nessunRisultato':'Nessun risultato. Se il gioco &egrave; recente o poco noto pu&ograve; semplicemente non essere su Wikidata: scrivilo a mano qui sotto.',
  'add.scegline':       'Scegline uno: riempie il modulo, non lo mette subito sullo scaffale.',
  'add.ricercaNo':      'Ricerca non riuscita: {e}. Puoi scrivere il gioco a mano qui sotto.',
  'add.prendoScheda':   '<b>prendo la scheda&hellip;</b>',
  'add.schedaDa':       'Scheda da <b>{f}</b>. Correggi quello che serve, poi metti sullo scaffale.',
  'add.immagineDopo':   ' L&rsquo;immagine la scarico al salvataggio.',
  'add.senzaImmagine':  ' Nessuna immagine: user&ograve; la copertina disegnata.',
  'add.schedaNo':       'Non sono riuscito a prendere la scheda: {e}',
  'add.preparoCop':     'preparo la copertina&hellip;',
  'add.scaricoCop':     'scarico la copertina&hellip;',

  /* --- il catalogo --- */
  'cat.prendoAltri':    'prendo altri giochi&hellip;',
  'cat.apro':           'apro il catalogo&hellip;',
  'cat.nonRisponde':    'Il catalogo non risponde: {e}. Wikidata a volte impiega troppo e chiude la richiesta: riprova.',
  'cat.cerco':          'cerco&hellip;',
  'cat.nessunGioco':    'Nessun gioco per <b>{q}</b>. Su Wikidata i giochi da tavolo con un id BGG sono circa 3.400: se &egrave; recente o poco noto pu&ograve; semplicemente non esserci.',
  'cat.ricercaNo':      'Ricerca non riuscita: {e}',
  'cat.fonteBgg':       'Schede da <b>BoardGameGeek</b>.',
  'cat.fonteDump':      'Titoli e classifica da <b>BoardGameGeek</b>: {n} giochi, in ordine di classifica vera. Autore, editore e durata arrivano da Wikidata aprendo la scheda.',
  'add.fonteDump':      'Cerco nell&rsquo;indice di <b>BoardGameGeek</b>, che &egrave; qui e non passa dalla rete. Scegliendone uno provo a completare la scheda da Wikidata: quello che manca si scrive a mano.',
  'cat.fonteWiki':      'Schede da <b>Wikidata</b>: circa 3.400 giochi con id BGG, dati pi&ugrave; magri e quasi mai la copertina vera della scatola.',
  'cat.receGuaio':      '<b>Le recensioni non si leggono:</b> {e}.',
  'cat.receUno':        '{n} gioco recensito su questo sito.',
  'cat.receTanti':      '{n} giochi recensiti su questo sito.',
  'cat.chiudi':         'chiudi',
  'cat.recensione':     'recensione',
  'cat.scheda':         'scheda',
  'cat.nonRecensito':   'Non ancora recensito qui. La scheda arriva dalla fonte, la recensione la scriviamo noi.',
  'cat.ceLHai':         'ce l&rsquo;hai',
  'cat.inLibreria':     'in libreria',
  'cat.aggiungo':       'aggiungo&hellip;',
  'cat.prendoScheda':   'prendo la scheda&hellip;',
  'cat.scaricoCop':     'scarico la copertina&hellip;',

  /* --- i gruppi --- */
  'gru.piuGruppo':      '+ gruppo',
  'gru.nomePh':         'nome del gruppo',
  'gru.nomeAria':       'nome del gruppo nuovo',
  'gru.chiStaIn':       'chi sta in &laquo;{n}&raquo;',
  'gru.dentro':         'dentro',
  'gru.aggiungi':       'aggiungi',
  'calc.per':           'punti di',
  'calc.apriPer':       'fai il conto dei punti di {n}',
  'calc.usa':           'usa il totale',
  'calc.chiudi':        'chiudi la calcolatrice',
  'calc.pulisci':       'pulisci',
  'calc.cancella':      'cancella l&rsquo;ultima cifra',
  'calc.piu':           'piu&rsquo;',
  'calc.meno':          'meno',
  'calc.per_':          'per',
  'gru.unGioco':        'un gioco',
  'gru.nGiochi':        '{n} giochi',
  'gru.quali':          'giochi',
  'gru.chiudiQuali':    'chiudi',
  'gru.togli':          'togli',
  'mia.soloPreferiti':  '&#9733; solo i preferiti',

  /* --- l'elenco della collezione --- */
  'stanza.toccaAncora': 'tocca ancora per eliminare',
  'riga.stellaOff':     'metti fra i preferiti',
  'riga.nonInLib':      'non in libreria',
  'riga.inLib':         'in <b>{n}</b>',
  'riga.nessunaRece':   'Nessuna recensione, per ora.',
  'riga.ospite':        'In casa di un amico si guarda e basta.',
  'riga.vaiScaffale':   'vai allo scaffale',
  'riga.togliLib':      'togli dalla libreria',
  'riga.mettiLib':      'metti in libreria',
  'riga.eliminaGioco':  'elimina il gioco',
  'mia.senzaGruppo':    'senza gruppo',
  'mia.per':            'per <b>{q}</b>',
  'mia.fraPreferiti':   'fra i preferiti',
  'mia.nessunGruppo':   'Nessun gruppo, per ora: da <b>gestisci gruppi</b> se ne crea uno e ci si mettono i giochi dentro.',
  'mia.gioco':          'gioco',
  'mia.giochi':         'giochi',
  'mia.riepilogo':      '<b>{n}</b> {parola}{perche}, <b>{v}</b> sugli scaffali. Tocca una riga per la scheda.',
  'mia.niente':         'Niente {perche}.',
  'mia.vuota':          'La libreria &egrave; vuota.',

  /* --- profilo, amici, giocatori --- */
  'pro.nonDisponibile': 'profilo non disponibile',
  'pro.senzaNome':      'senza nome',
  'ami.accetta':        'accetta',
  'ami.no':             'no',
  'ami.chiedeAmicizia': 'ti ha chiesto l&rsquo;amicizia',
  'ami.suaLibreria':    'la sua libreria',
  'ami.togli':          'togli',
  'ami.ritira':         'ritira',
  'ami.uno':            '<b>{n}</b> amico.',
  'ami.tanti':          '<b>{n}</b> amici.',
  'ami.nessunAmico':    'Nessun amico, per ora. Passagli il tuo codice, o chiedi il loro.',
  'ami.chiedo':         'chiedo&hellip;',
  'ami.nonRiuscito':    'non riuscito: {e}',
  'ami.unAmico':        'un amico',
  'nick.unAttimo':      'un attimo&hellip;',

  /* --- partite e giocatori --- */
  'par.aria':           'le tue partite',
  'par.occhiello':      'le tue partite',
  'par.perGioco':       'per gioco',
  'par.perData':        'le ultime',
  'par.perCalendario': 'calendario',
  /* I dodici mesi e i sette giorni in due chiavi sole, separati da
     virgola: diciannove chiavi per una cosa che si legge come un
     elenco unico sarebbero diciannove righe da tenere in fila a
     mano, e basta che una sia fuori posto perche' il calendario
     dica il giorno sbagliato. */
  'cal.mesi':           'gennaio,febbraio,marzo,aprile,maggio,giugno,luglio,agosto,settembre,ottobre,novembre,dicembre',
  'cal.giorni':         'lun,mar,mer,gio,ven,sab,dom',
  'cal.prima':          'il mese prima',
  'cal.dopo':           'il mese dopo',
  'cal.oggi':           'oggi',
  'cal.giorno':         '{g}: {n}',
  'cal.unaQui':         'una partita',
  'cal.nQui':           '{n} partite',
  'cal.vinta':          ', vinta',
  'cal.nessunaQui':     'Nessuna partita in questo mese.',
  'par.nuova':          '+ segna una partita',
  'par.cercaPh':        'cerca un gioco o una persona&hellip;',
  'par.cercaAria':      'cerca fra le partite',
  'par.nessunaPer':     'nessuna partita per &laquo;{q}&raquo;',
  'riga.suScaffale':    'sullo scaffale, in {n}',
  'riga.fuoriScaffale': 'in collezione, ma non sullo scaffale',
  'par.serata':         'partita',
  'par.serate':         'partite',
  'par.gioco':          'gioco',
  'par.giochi':         'giochi',
  'par.tuePartite':     'le tue partite',
  /* Il winrate: quante ne hai vinte sulle partite in cui c'eri tu. */
  'par.wr':             'il tuo winrate',
  'par.wrSenza':        'nessuna partita a tuo nome',
  'par.wrApri':         'vedi il winrate gioco per gioco',
  'par.wrPerGioco':     'il tuo winrate, gioco per gioco',
  'par.wrTitolo':       'ne hai vinte {v} su {n}',
  'par.wrSu':           '{v} su {n}',
  'par.wrTuoSu':        'il tuo winrate &middot; {v} su {n}',
  'par.wrChiSei':       'Il winrate conta le partite in cui compari col tuo nome, &laquo;{n}&raquo;. Aggiungiti fra chi c&rsquo;era e comincia a contare.',
  'par.wrNick':         'Serve un nick per riconoscerti fra chi c&rsquo;era: si sceglie dal profilo.',
  'par.nessunoStacca':  'nessuno stacca gli altri',
  'par.vince':          'vince {n}',
  'par.vinceN':         'vince {n} ({q})',
  'par.unaPartita':     '{n} partita',
  'par.partite':        '{n} partite',
  'par.nessuna':        'Nessuna partita segnata. Si segna da qui, oppure dalla scatola del gioco appena finito.',
  'gio.amicoSulSito':   'amico sul sito',
  'gio.togli':          'togli',
  'gio.daiTuoiAmici':   'Dai tuoi amici:',
  'pa.hCorreggi':       'Correggi la partita',
  'pa.haVinto':         'ha vinto {n}',
  'pa.punti':           'punti',
  'pa.puntiDi':         'punti di {n}',
  'pa.togliChi':        'togli {n}',
  'pa.giaAlTavolo':     '{n} &egrave; gi&agrave; al tavolo',
  'pa.nonSalvata':      'non salvata: {e}',
  /* le pastigliette accanto ai nomi suggeriti: dicono da dove viene ognuno */
  'pa.tu':              'tu',
  'pa.amicoTag':        'amico',
  'pa.salvatoTag':      'giocatore',
  'pa.nuovoTag':        'nuovo',
  'pa.aggiungiNome':    'aggiungi &laquo;{n}&raquo;',

  /* --- senza WebGL, e il caricamento --- */
  'flat.scatolaDi':     'la scatola di {g}',
  'load.stanza':        'monto la stanza',
  'load.libreria':      'apro la libreria',
  'load.copertine':     'stampo le copertine',
  'load.mensole':       'monto le mensole',
  'load.lampada':       'accendo la luce',

  /* --- il catalogo e le immagini --- */
  'err.miniatura':      'miniatura non trovata',
  'err.nessunaImmagine':'nessuna immagine',
  'err.nessunFile':     'nessun file',
  'err.nonImmagine':    'non &egrave; un&rsquo;immagine',
  'err.immagineNonCar': 'immagine non caricata',
  'err.ceGia':          '&laquo;{n}&raquo; c&rsquo;&egrave; gi&agrave;',

  /* --- i messaggini che passano in basso --- */
  'msg.mobilePieno':    'quel mobile &egrave; pieno: dodici cubi, dodici giochi',
  'msg.messoIn':        '&laquo;{g}&raquo; in {lib}',
  'msg.libGenerica':    'libreria',
  'msg.ilGioco':        'il gioco',
  'msg.uscitoScaffale': '&laquo;{g}&raquo; &egrave; uscito dallo scaffale: resta nella tua collezione',
  'msg.creaPrimaLib':   'crea prima una libreria, dal nome in basso',
  'msg.nessunaLibreria':'nessuna libreria: non so dove metterla',
  'msg.ordineTuo':      'ordine tuo: da adesso le scatole restano dove le metti',
  'msg.libNuova':       'libreria nuova: {n}',
  'msg.libNonCreata':   'libreria non creata: {e}',
  'msg.toltoDaLib':     '&laquo;{g}&raquo; tolto dalla libreria',
  'msg.modAdmin':       'modalit&agrave; admin',
  'msg.modUtente':      'modalit&agrave; utente',
  'msg.accessoNo':      'accesso non riuscito: {e}',
  'msg.dataScaricato':  'data.js scaricato: mettilo in js/ e committa',
  'msg.libRipristinata':'libreria ripristinata',
  'msg.nessunGiocoPer': 'nessun gioco per &laquo;{q}&raquo;',
  'msg.receSalvata':    'recensione salvata',
  'msg.immagineNo':     'immagine non usata: {e}',
  'msg.copertinaNo':    'copertina non presa: uso quella disegnata',
  'msg.copertineRiprese': '{n} copertine riprese da BGG: erano immagini di Wikidata, cio&egrave; foto del gioco sul tavolo',
  'msg.recePubblicata': 'recensione pubblicata nel catalogo',
  'msg.nonPubblicata':  'non pubblicata: {e}',
  'msg.senzaBgg':       'senza id BGG non si pubblica: &egrave; la chiave della recensione',
  'msg.receTolta':      'recensione tolta dal catalogo',
  'msg.nonTolta':       'non tolta: {e}',
  'msg.salvato':        '&laquo;{g}&raquo; salvato',
  'msg.inCollezione':   '&laquo;{g}&raquo; in collezione: dall&rsquo;elenco lo metti sullo scaffale',
  'msg.nonAggiunto':    'non aggiunto: {e}',
  'msg.gruppoCreato':   'gruppo &laquo;{n}&raquo; creato',
  'msg.nonCreato':      'non creato: {e}',
  'msg.nonRiuscito':    'non riuscito: {e}',
  'msg.gruppoTolto':    'gruppo tolto: i giochi restano dove sono',
  'msg.nonTolto':       'non tolto: {e}',
  'msg.libRinominata':  'libreria rinominata',
  'msg.nonRinominata':  'non rinominata: {e}',
  'msg.libRiordinate':  'librerie riordinate',
  'msg.libTolta':       'libreria tolta: i giochi che c&rsquo;erano sono usciti dagli scaffali',
  'msg.libOrdineTuo':   'libreria &laquo;{n}&raquo;: ordine tuo, ora le scatole si spostano',
  'msg.nonCreata':      'non creata: {e}',
  'msg.nonTolta2':      'non tolta: {e}',
  'msg.quiNienteLib':   'qui non c&rsquo;&egrave; nessuna libreria da togliere',
  'msg.ciao':           'ciao, {n}',
  'msg.facciaSalvata':  'faccia salvata',
  'msg.facciaNo':       'faccia non salvata: {e}',
  'msg.selezionato':    'selezionato: copialo tu',
  'msg.giocoEliminato': 'gioco eliminato',
  'msg.aggancioNo':     'una parte dell&rsquo;interfaccia non si e&rsquo; agganciata ({n}): ricarica saltando la cache, con Ctrl+F5',
  'msg.postiRimessi':   '{n} giochi erano in un cubo gi&agrave; occupato o in un mobile che non c&rsquo;&egrave;: rimessi a posto',
  'msg.partitaSegnata': 'partita segnata',
  'msg.partitaSenzaPunti': 'partita segnata, ma i punteggi non sono passati: manca la migrazione punti_partita (o il server non l&rsquo;ha ancora vista)',
  'msg.aproLibDi':      'apro la libreria di {chi}',
  'msg.nonRiescoAprire':'non riesco ad aprirla: {e}',
  'msg.libDiVuota':     'la libreria di {chi} &egrave; ancora vuota',
  'msg.partitaEliminata':'partita eliminata',
  'msg.nonEliminata':   'non eliminata: {e}',
  'msg.collezioneVuota':'la tua collezione &egrave; vuota: premi + per il primo gioco',
  'msg.collezioneOff':  'collezione offline: mostro l&rsquo;ultima copia salvata',

  /* --- il profilo e gli amici --- */
  'err.codiceMigr':     'manca la migrazione codice_riservato: il codice amico non si legge',
  'err.profiliMigr':    'manca la migrazione profili_e_amici',
  'nick.corto':         'almeno tre caratteri',
  'nick.lungo':         'al massimo {n} caratteri',
  'nick.segni':         'lettere, numeri, spazio, trattino e punto',
  'nick.preso':         '&laquo;{n}&raquo; &egrave; gi&agrave; di qualcun altro',
  'ami.chiesta':        'richiesta mandata',
  'ami.inviata':        'se quell&rsquo;indirizzo ha un account, la richiesta &egrave; arrivata',
  'ami.nessuno':        'nessun codice cos&igrave;',
  'ami.gia':            'con questa persona c&rsquo;&egrave; gi&agrave; qualcosa in corso',
  'ami.teStesso':       'quello &egrave; il tuo codice',

  /* --- quello che racconta il database --- */
  'err.nessunoVisitare':'senza backend non c&rsquo;&egrave; nessuno da visitare',
  'err.copertina':      'copertina non caricata: {e}',
  'err.nonAggiunto':    'non sono riuscito ad aggiungerlo: {e}',
  'err.nonModificato':  'modifica non salvata: {e}',
  'err.nonPreferito':   'preferito non salvato: {e}',
  'err.librerieNonLette':'librerie non lette: {e}',
  'err.nonSiPuo':       'non si pu&ograve;',
  'err.libSconosciuta': 'libreria sconosciuta',
  'err.stileMigr':      'manca la migrazione preferiti_e_stile_libreria',
  'err.ordineMobili':   'ordine dei mobili non salvato sul server: {e}',
  'err.ultimaLib':      'l&rsquo;ultima libreria non si toglie',
  'err.libNomePreso':   'c&rsquo;&egrave; gi&agrave; una libreria che si chiama &laquo;{n}&raquo;',
  'err.posizione':      'posizione non salvata: {e}',
  'err.gruppiNonLetti': 'gruppi non letti: {e}',
  'err.ordineGiochi':   'ordine non salvato sul server: {e}',
  'err.nonTolto':       'non sono riuscito a toglierlo: {e}',
  'err.nonToltoZero':   'il database non ha tolto {g}: la riga &egrave; ancora l&igrave;',
  'err.nonAdmin':       'il database dice di no, questo account non &egrave; admin',
  'err.ordineMigr':     'manca la migrazione ordine_manuale',
  'err.colonnaIgnota':  'manca una colonna: controlla le migrazioni non applicate',

  /* --- le tavolozze della stanza --- */
  'tinta.noce':         'noce',
  'tinta.noceScuro':    'noce scuro',
  'tinta.oliva':        'oliva',
  'tinta.carta':        'carta',
  'tinta.olivaScuro':   'oliva scuro',
  'tinta.salvia':       'salvia',
  'tinta.sabbia':       'sabbia',
  'tinta.terracotta':   'terracotta',
  'tinta.grigioCaldo':  'grigio caldo',
  'tinta.cementoChiaro':'cemento chiaro',
  'tinta.cotto':        'cotto',
  'tinta.caldo':        'caldo',
  'tinta.ambra':        'ambra',
  'tinta.biancoCaldo':  'bianco caldo',
  'tinta.biancoFreddo': 'bianco freddo',
  'tinta.azzurro':      'azzurro',
  'tinta.neonRosa':     'neon rosa',
  'tinta.neonViola':    'neon viola',
  'tinta.neonCiano':    'neon ciano',
  'tinta.neonVerde':    'neon verde',
  'tinta.neonGiallo':   'neon giallo',
  'tinta.neonBlu':      'neon blu',
  'arredo.libri':       'libri',
  'arredo.scatole':     'scatole',
  'arredo.dadi':        'dadi e meeple',
  'arredo.piante':      'piante',
  'arredo.cornici':     'cornici',
  'arredo.misto':       'un po&rsquo; di tutto',
  'arredo.niente':      'niente',

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
  'nav.partite':        'plays',
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
  'stanza.faretti':     'shelf lights',
  'stanza.farettiAria': 'lights inside the bookcase',
  'stanza.fariTinta':   'colour',
  'stanza.nomeAria':    'name of this bookcase',
  'stanza.salva':       'save',
  'stanza.modifica':    'edit bookcase',
  'stanza.legnoDi':     'wood and props of',
  'stanza.questoMobile':'this bookcase',
  'stanza.nessunMobile':'no bookcase here',
  'stanza.scaffali':    'shelves',
  'stanza.muro':        'wall',
  'stanza.pavimento':   'floor',
  'stanza.nomeColore':  'name',
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
  'rail.prima':         'the bookcase before',
  'rail.dopo':          'the bookcase after',
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
  'pan.segnaTitolo':    'log a play for this one',
  'pan.segna':          'play',
  'pan.schedaTitolo':   'correct the details',
  'pan.scheda':         'details',
  'pan.fuoriTitolo':    'leave the shelf, stay in your collection',
  'pan.fuori':          'off the shelf',
  'pan.eliminaTitolo':  'remove the game from your collection, for good',
  'pan.elimina':        'remove',
  'pan.eliminaLungo':   'remove',
  'pan.eliminaOk':      'sure? it disappears',

  'tab.libreria':       'shelves',
  'tab.catalogo':       'catalogue',
  'tab.partite':        'plays',
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
  'mia.torna':          'my bookcases',
  'mia.tornaSua':       'their bookcase',
  'mia.tornaTitolo':    'back to the shelves',
  'mia.apriTitolo':     'see the collection as a list',

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
  'pro.esci':           'sign out',
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
  'pro.giocatoriNota':  'The names you use when logging plays. At the table there is almost always someone who is not on the site: they belong here all the same.',
  'pro.giocatorePh':    'a name',
  'pro.giocatoreAria':  'player name',
  'pro.giocatoreAgg':   'add',
  'pro.partite':        'Plays',
  'pro.parNuova':       'log a play',
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
  'gate.ultima':        'last time',
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

  'pa.occhiello':       'a play',
  'pa.h':               'Log a play',
  'pa.gioco':           'game',
  'pa.giocoPh':         'search your collection or the catalogue',
  'pa.data':            'date',
  'pa.chiCera':         'who was there',
  'pa.chiPh':           'type a name',
  'pa.annulla':         'cancel',
  'pa.salva':           'save the play',
  'pa.togli':           'delete',


  'err.senzaBackend':   'Supabase not configured',
  'err.receNiente':     'without a backend there are no catalogue reviews',
  'err.receTabella':    'the `recensioni` table is missing: apply the recensioni_pubbliche migration',
  'err.recePubblica':   'without a backend nothing gets published',
  'err.receBgg':        'the BGG id is needed: it is the key of the review',
  'err.appreMigrazione':'the apprezzamenti migration is missing: apply it from the Supabase panel',
  'err.serveAccesso':   'you need to be signed in',
  'err.partiteMigr':    'the partite migration is missing',
  'err.nonEntrato':     'you are not signed in',
  'err.serveNome':      'a name is needed',
  'err.nomeLungo':      'name too long: {n} characters at most',
  'err.serveGioco':     'the game is needed',
  'err.serveGiocatore': 'at least one player is needed',
  'err.stanzaMigr':     'the stanza_librerie_gruppi migration is missing',





  'pan.cuoreTolto':     'take the heart off this review',
  'pan.credito':        'cover by {a}',
  'spec.giocatori':     'players',
  'spec.minuti':        'minutes',
  'spec.eta':           'age',
  'spec.peso':          'bgg weight',
  'spec.anno':          'year',
  'spec.min':           'min',
  'testa.cambiaMod':    'switch mode',
  'testa.entraGoogle':  'sign in with Google',
  'testa.admin':        'admin',
  'testa.utente':       'user',

  'add.ripristinaOk':   'sure? the additions will be lost',
  'add.doveRemoto':     'Changes go into the database, everyone sees them.',
  'add.fonteBgg':       'Searching <b>BoardGameGeek</b>, through the local proxy.',
  'add.fonteWiki':      'The BGG token has not arrived yet, so this searches <b>Wikidata</b>: about 4,400 games instead of 175,000, and the image is often a photo of the game set up rather than the box. <b>Check the fields before saving</b> &mdash; the publisher is the one that gets it wrong most often.',
  'add.hCorreggi':      'Correct the details',
  'add.salvaModifiche': 'save the changes',
  'add.noteModifica':   'Changes go into <b>your</b> collection. Leave the cover field empty to keep the one that is already there.',
  'add.cerco':          'searching&hellip;',
  'add.nessunRisultato':'No results. If the game is recent or little known it may simply not be on Wikidata: type it in by hand below.',
  'add.scegline':       'Pick one: it fills in the form, it does not put it straight on the shelf.',
  'add.ricercaNo':      'Search failed: {e}. You can type the game in by hand below.',
  'add.prendoScheda':   '<b>fetching the details&hellip;</b>',
  'add.schedaDa':       'Details from <b>{f}</b>. Correct what needs correcting, then put it on the shelf.',
  'add.immagineDopo':   ' The image gets downloaded on save.',
  'add.senzaImmagine':  ' No image: the drawn cover will be used.',
  'add.schedaNo':       'Could not fetch the details: {e}',
  'add.preparoCop':     'preparing the cover&hellip;',
  'add.scaricoCop':     'downloading the cover&hellip;',

  'cat.prendoAltri':    'fetching more games&hellip;',
  'cat.apro':           'opening the catalogue&hellip;',
  'cat.nonRisponde':    'The catalogue is not answering: {e}. Wikidata sometimes takes too long and closes the request: try again.',
  'cat.cerco':          'searching&hellip;',
  'cat.nessunGioco':    'No game for <b>{q}</b>. On Wikidata there are about 3,400 board games with a BGG id: if it is recent or little known it may simply not be there.',
  'cat.ricercaNo':      'Search failed: {e}',
  'cat.fonteBgg':       'Details from <b>BoardGameGeek</b>.',
  'cat.fonteDump':      'Titles and ranking from <b>BoardGameGeek</b>: {n} games, in the real ranking order. Designer, publisher and length come from Wikidata when you open a card.',
  'add.fonteDump':      'Searching the <b>BoardGameGeek</b> index, which is right here and does not go over the network. Pick one and I will try to fill the rest in from Wikidata: whatever is missing you type by hand.',
  'cat.fonteWiki':      'Details from <b>Wikidata</b>: about 3,400 games with a BGG id, thinner data and hardly ever the real box cover.',
  'cat.receGuaio':      '<b>The reviews cannot be read:</b> {e}.',
  'cat.receUno':        '{n} game reviewed on this site.',
  'cat.receTanti':      '{n} games reviewed on this site.',
  'cat.chiudi':         'close',
  'cat.recensione':     'review',
  'cat.scheda':         'details',
  'cat.nonRecensito':   'Not reviewed here yet. The details come from the source, the review we write ourselves.',
  'cat.ceLHai':         'you have it',
  'cat.inLibreria':     'add to collection',
  'cat.aggiungo':       'adding&hellip;',
  'cat.prendoScheda':   'fetching the details&hellip;',
  'cat.scaricoCop':     'downloading the cover&hellip;',

  'gru.piuGruppo':      '+ group',
  'gru.nomePh':         'group name',
  'gru.nomeAria':       'name of the new group',
  'gru.chiStaIn':       'what is in &laquo;{n}&raquo;',
  'gru.dentro':         'in it',
  'gru.aggiungi':       'add',
  'calc.per':           'points for',
  'calc.apriPer':       'add up {n}&rsquo;s points',
  'calc.usa':           'use the total',
  'calc.chiudi':        'close the calculator',
  'calc.pulisci':       'clear',
  'calc.cancella':      'delete the last digit',
  'calc.piu':           'plus',
  'calc.meno':          'minus',
  'calc.per_':          'times',
  'gru.unGioco':        'one game',
  'gru.nGiochi':        '{n} games',
  'gru.quali':          'games',
  'gru.chiudiQuali':    'close',
  'gru.togli':          'remove',
  'mia.soloPreferiti':  '&#9733; favourites only',

  'stanza.toccaAncora': 'tap again to delete',
  'riga.stellaOff':     'mark as a favourite',
  'riga.nonInLib':      'not on a shelf',
  'riga.inLib':         'in <b>{n}</b>',
  'riga.nessunaRece':   'No review yet.',
  'riga.ospite':        'In someone else&rsquo;s home you only look.',
  'riga.vaiScaffale':   'go to the shelf',
  'riga.togliLib':      'take off the shelf',
  'riga.mettiLib':      'put on a shelf',
  'riga.eliminaGioco':  'delete the game',
  'mia.senzaGruppo':    'no group',
  'mia.per':            'for <b>{q}</b>',
  'mia.fraPreferiti':   'among the favourites',
  'mia.nessunGruppo':   'No groups yet: from <b>manage groups</b> you make one and put games in it.',
  'mia.gioco':          'game',
  'mia.giochi':         'games',
  'mia.riepilogo':      '<b>{n}</b> {parola}{perche}, <b>{v}</b> on the shelves. Tap a row for the details.',
  'mia.niente':         'Nothing {perche}.',
  'mia.vuota':          'The collection is empty.',

  'pro.nonDisponibile': 'profile not available',
  'pro.senzaNome':      'no name',
  'ami.accetta':        'accept',
  'ami.no':             'no',
  'ami.chiedeAmicizia': 'asked to be your friend',
  'ami.suaLibreria':    'their collection',
  'ami.togli':          'remove',
  'ami.ritira':         'withdraw',
  'ami.uno':            '<b>{n}</b> friend.',
  'ami.tanti':          '<b>{n}</b> friends.',
  'ami.nessunAmico':    'No friends yet. Pass them your code, or ask for theirs.',
  'ami.chiedo':         'asking&hellip;',
  'ami.nonRiuscito':    'did not work: {e}',
  'ami.unAmico':        'a friend',
  'nick.unAttimo':      'one moment&hellip;',

  'par.aria':           'your plays',
  'par.occhiello':      'your plays',
  'par.perGioco':       'by game',
  'par.perData':        'most recent',
  'par.perCalendario': 'calendar',
  'cal.mesi':           'January,February,March,April,May,June,July,August,September,October,November,December',
  'cal.giorni':         'mon,tue,wed,thu,fri,sat,sun',
  'cal.prima':          'previous month',
  'cal.dopo':           'next month',
  'cal.oggi':           'today',
  'cal.giorno':         '{g}: {n}',
  'cal.unaQui':         'one play',
  'cal.nQui':           '{n} plays',
  'cal.vinta':          ', won',
  'cal.nessunaQui':     'No plays this month.',
  'par.nuova':          '+ log a play',
  'par.cercaPh':        'search a game or a person&hellip;',
  'par.cercaAria':      'search among the plays',
  'par.nessunaPer':     'no plays for &laquo;{q}&raquo;',
  'riga.suScaffale':    'on the shelf, in {n}',
  'riga.fuoriScaffale': 'in the collection, but not on a shelf',
  'par.serata':         'play',
  'par.serate':         'plays',
  'par.gioco':          'game',
  'par.giochi':         'games',
  'par.tuePartite':     'your plays',
  'par.wr':             'your win rate',
  'par.wrSenza':        'no plays under your name',
  'par.wrApri':         'see your win rate game by game',
  'par.wrPerGioco':     'your win rate, game by game',
  'par.wrTitolo':       'you won {v} of {n}',
  'par.wrSu':           '{v} of {n}',
  'par.wrTuoSu':        'your win rate &middot; {v} of {n}',
  'par.wrChiSei':       'The win rate counts the plays where you appear under your own name, &laquo;{n}&raquo;. Add yourself to who was there and it starts counting.',
  'par.wrNick':         'You need a nick so the site can spot you among the players: you pick one in your profile.',
  'par.nessunoStacca':  'nobody is ahead',
  'par.vince':          '{n} wins',
  'par.vinceN':         '{n} wins ({q})',
  'par.unaPartita':     '{n} play',
  'par.partite':        '{n} plays',
  'par.nessuna':        'No plays logged. You log one from here, or from the box of the game you have just finished.',
  'gio.amicoSulSito':   'friend on the site',
  'gio.togli':          'remove',
  'gio.daiTuoiAmici':   'From your friends:',
  'pa.hCorreggi':       'Correct the play',
  'pa.haVinto':         '{n} won',
  'pa.punti':           'points',
  'pa.puntiDi':         'points for {n}',
  'pa.togliChi':        'remove {n}',
  'pa.giaAlTavolo':     '{n} is already at the table',
  'pa.nonSalvata':      'not saved: {e}',
  'pa.tu':              'you',
  'pa.amicoTag':        'friend',
  'pa.salvatoTag':      'player',
  'pa.nuovoTag':        'new',
  'pa.aggiungiNome':    'add &laquo;{n}&raquo;',

  'flat.scatolaDi':     'the box of {g}',
  'load.stanza':        'building the room',
  'load.libreria':      'opening the collection',
  'load.copertine':     'printing the covers',
  'load.mensole':       'fitting the shelves',
  'load.lampada':       'turning the light on',

  'err.miniatura':      'thumbnail not found',
  'err.nessunaImmagine':'no image',
  'err.nessunFile':     'no file',
  'err.nonImmagine':    'that is not an image',
  'err.immagineNonCar': 'image not loaded',
  'err.ceGia':          '&laquo;{n}&raquo; is there already',

  'msg.mobilePieno':    'that bookcase is full: twelve cubes, twelve games',
  'msg.messoIn':        '&laquo;{g}&raquo; in {lib}',
  'msg.libGenerica':    'bookcase',
  'msg.ilGioco':        'the game',
  'msg.uscitoScaffale': '&laquo;{g}&raquo; has left the shelf: it stays in your collection',
  'msg.creaPrimaLib':   'make a bookcase first, from the name at the bottom',
  'msg.nessunaLibreria':'no bookcase: I would not know where to put it',
  'msg.ordineTuo':      'your own order: from now on the boxes stay where you put them',
  'msg.libNuova':       'new bookcase: {n}',
  'msg.libNonCreata':   'bookcase not created: {e}',
  'msg.toltoDaLib':     '&laquo;{g}&raquo; taken off the shelves',
  'msg.modAdmin':       'admin mode',
  'msg.modUtente':      'user mode',
  'msg.accessoNo':      'sign-in failed: {e}',
  'msg.dataScaricato':  'data.js downloaded: put it in js/ and commit it',
  'msg.libRipristinata':'collection restored',
  'msg.nessunGiocoPer': 'no game for &laquo;{q}&raquo;',
  'msg.receSalvata':    'review saved',
  'msg.immagineNo':     'image not used: {e}',
  'msg.copertinaNo':    'cover not taken: using the drawn one',
  'msg.copertineRiprese': '{n} covers fetched again from BGG: they came from Wikidata, which means photos of the game on a table',
  'msg.recePubblicata': 'review published in the catalogue',
  'msg.nonPubblicata':  'not published: {e}',
  'msg.senzaBgg':       'without a BGG id it cannot be published: it is the key of the review',
  'msg.receTolta':      'review withdrawn from the catalogue',
  'msg.nonTolta':       'not withdrawn: {e}',
  'msg.salvato':        '&laquo;{g}&raquo; saved',
  'msg.inCollezione':   '&laquo;{g}&raquo; added: put it on a shelf from the list',
  'msg.nonAggiunto':    'not added: {e}',
  'msg.gruppoCreato':   'group &laquo;{n}&raquo; created',
  'msg.nonCreato':      'not created: {e}',
  'msg.nonRiuscito':    'did not work: {e}',
  'msg.gruppoTolto':    'group removed: the games stay where they are',
  'msg.nonTolto':       'not removed: {e}',
  'msg.libRinominata':  'bookcase renamed',
  'msg.nonRinominata':  'not renamed: {e}',
  'msg.libRiordinate':  'bookcases reordered',
  'msg.libTolta':       'bookcase removed: the games that were on it have left the shelves',
  'msg.libOrdineTuo':   'bookcase &laquo;{n}&raquo;: your own order, now the boxes move',
  'msg.nonCreata':      'not created: {e}',
  'msg.nonTolta2':      'not removed: {e}',
  'msg.quiNienteLib':   'there is no bookcase to remove here',
  'msg.ciao':           'hello, {n}',
  'msg.facciaSalvata':  'face saved',
  'msg.facciaNo':       'face not saved: {e}',
  'msg.selezionato':    'selected: copy it yourself',
  'msg.giocoEliminato': 'game deleted',
  'msg.aggancioNo':     'part of the interface did not bind ({n}): reload bypassing the cache, with Ctrl+F5',
  'msg.postiRimessi':   '{n} games were in a cube already taken, or in a bookcase that is not there: put back',
  'msg.partitaSegnata': 'play logged',
  'msg.partitaSenzaPunti': 'play logged, but the scores did not go through: the punti_partita migration is missing (or the server has not seen it yet)',
  'msg.aproLibDi':      'opening the collection of {chi}',
  'msg.nonRiescoAprire':'cannot open it: {e}',
  'msg.libDiVuota':     'the collection of {chi} is still empty',
  'msg.partitaEliminata':'play deleted',
  'msg.nonEliminata':   'not deleted: {e}',
  'msg.collezioneVuota':'your collection is empty: press + for the first game',
  'msg.collezioneOff':  'collection offline: showing the last saved copy',

  'err.codiceMigr':     'the codice_riservato migration is missing: the friend code cannot be read',
  'err.profiliMigr':    'the profili_e_amici migration is missing',
  'nick.corto':         'at least three characters',
  'nick.lungo':         '{n} characters at most',
  'nick.segni':         'letters, numbers, space, hyphen and full stop',
  'nick.preso':         '&laquo;{n}&raquo; belongs to somebody else already',
  'ami.chiesta':        'request sent',
  'ami.inviata':        'if that address has an account, the request has arrived',
  'ami.nessuno':        'no such code',
  'ami.gia':            'something is already going on with this person',
  'ami.teStesso':       'that is your own code',

  'err.nessunoVisitare':'without a backend there is nobody to visit',
  'err.copertina':      'cover not uploaded: {e}',
  'err.nonAggiunto':    'could not add it: {e}',
  'err.nonModificato':  'change not saved: {e}',
  'err.nonPreferito':   'favourite not saved: {e}',
  'err.librerieNonLette':'bookcases not read: {e}',
  'err.nonSiPuo':       'not allowed',
  'err.libSconosciuta': 'unknown bookcase',
  'err.stileMigr':      'the preferiti_e_stile_libreria migration is missing',
  'err.ordineMobili':   'bookcase order not saved on the server: {e}',
  'err.ultimaLib':      'the last bookcase cannot be removed',
  'err.libNomePreso':   'there is already a bookcase called &laquo;{n}&raquo;',
  'err.posizione':      'position not saved: {e}',
  'err.gruppiNonLetti': 'groups not read: {e}',
  'err.ordineGiochi':   'order not saved on the server: {e}',
  'err.nonTolto':       'could not remove it: {e}',
  'err.nonToltoZero':   'the database did not remove {g}: the row is still there',
  'err.nonAdmin':       'the database says no, this account is not an admin',
  'err.ordineMigr':     'the ordine_manuale migration is missing',
  'err.colonnaIgnota':  'a column is missing: check the migrations not yet applied',

  'tinta.noce':         'walnut',
  'tinta.noceScuro':    'dark walnut',
  'tinta.oliva':        'olive',
  'tinta.carta':        'paper',
  'tinta.olivaScuro':   'dark olive',
  'tinta.salvia':       'sage',
  'tinta.sabbia':       'sand',
  'tinta.terracotta':   'terracotta',
  'tinta.grigioCaldo':  'warm grey',
  'tinta.cementoChiaro':'pale concrete',
  'tinta.cotto':        'terracotta tile',
  'tinta.caldo':        'warm',
  'tinta.ambra':        'amber',
  'tinta.biancoCaldo':  'warm white',
  'tinta.biancoFreddo': 'cool white',
  'tinta.azzurro':      'blue',
  'tinta.neonRosa':     'neon pink',
  'tinta.neonViola':    'neon purple',
  'tinta.neonCiano':    'neon cyan',
  'tinta.neonVerde':    'neon green',
  'tinta.neonGiallo':   'neon yellow',
  'tinta.neonBlu':      'neon blue',
  'arredo.libri':       'books',
  'arredo.scatole':     'boxes',
  'arredo.dadi':        'dice and meeples',
  'arredo.piante':      'plants',
  'arredo.cornici':     'picture frames',
  'arredo.misto':       'a bit of everything',
  'arredo.niente':      'nothing',

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
