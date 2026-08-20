# il dado è trap

Un sito di recensioni di giochi da tavolo che **è** una libreria in 3D. Una
KALLAX: cubi da 33 centimetri, una scatola per cubo, e cliccandone una la scatola
esce dallo scaffale, si apre e mostra la recensione.

Il sito ha tre sezioni:

- **la mia collezione** — la libreria in tre dimensioni, tua, che si costruisce
  aggiungendo giochi;
- **il catalogo** — migliaia di titoli in un elenco piatto, da sfogliare e
  cercare, con le recensioni di questo sito. Si legge **anche senza account**;
- **il profilo** — chi sei, la tua faccia, i tuoi amici, i giocatori con cui
  giochi e le partite che avete fatto.

Su schermo stretto le tre sezioni stanno in una barra in basso, dove arriva il
pollice.

Niente build, niente bundler, niente dipendenze da installare: si apre con un
server statico qualsiasi.

```
index.html            markup e struttura
css/style.css         stile dell'interfaccia
js/config.js          url e chiave pubblica di Supabase
js/data.js            i giochi committati: il seme della libreria
js/auth.js            accesso con Google, e la domanda "sono admin?"
js/store.js           la collezione: database, copia locale, ordinamenti, ricerca
js/recensioni.js      le recensioni del sito, pubbliche, lette da chiunque
js/profilo.js         nick, faccia, codice amico, amicizie
js/partite.js         giocatori salvati e partite giocate
js/stanza.js          luce, colori e arredi della stanza
js/bgg.js             ricerca su BGG, attraverso il proxy locale
js/catalogo.js        due fonti per le schede: BGG col token, Wikidata senza
js/art.js             legno, cartone, dadi, copertine di ripiego
js/app.js             scena 3D, catalogo, animazioni, interazione
img/                  le copertine delle scatole
fonts/                Instrument Serif e Inter, sottoinsieme latino
vendor/               three.js r152 e supabase-js, committati nel repo
supabase/migrations/  lo schema del database
tools/bgg-lib.mjs     il poco che serve per parlare con la XML API
tools/bgg-fetch.mjs   scarico una tantum, da riga di comando
tools/bgg-proxy.mjs   proxy locale per la ricerca su BGG
```

**Il sito non carica una sola risorsa esterna.** three.js, supabase-js, i font e
le copertine stanno nel repo: staccata la rete, la libreria si apre lo stesso,
con l'ultima copia salvata. È una scelta, non una svista.

L'eccezione è il **catalogo**, e non poteva essere altrimenti: le schede arrivano
da Wikidata e le miniature da Wikimedia Commons. Un catalogo di migliaia di
giochi non si committa in un repo, e senza rete semplicemente non c'è — mentre la
tua libreria continua a esserci.

## Farlo girare

Serve un server statico: aprendo `index.html` come file i percorsi relativi non
risolvono e tutte le immagini si rompono.

```bash
python -m http.server 8124
```

Poi `http://localhost:8124`. C'è già un `.claude/launch.json` con la stessa cosa.

**La porta 8124 non è casuale**: è l'unica autorizzata nei Redirect URLs del
progetto Supabase, e su un'altra l'accesso con Google parte, arriva a Google e
non riesce a tornare indietro. E non può essere la **8125**, che è del proxy BGG.

## Com'è fatta la libreria

**Tutte le superfici tranne le copertine sono generate da codice**: legno,
cartone, dorsi, facce dei dadi, l'interno della scatola sono disegnati su canvas
2D all'avvio e passati a three.js come texture.

**Le copertine sono quelle vere**, e da loro escono anche le proporzioni della
scatola: la larghezza è fissa, l'altezza viene dall'aspetto dell'immagine, così
Root resta bassa e larga com'è davvero e l'immagine non va stirata. Se una
copertina non arriva, la scatola ripiega sull'illustrazione disegnata e il sito
va avanti.

**Una libreria è sempre 3 × 4.** Dodici cubi, dodici giochi, su qualunque
schermo. Non cambia col formato e non si allunga con la collezione: finiti i
dodici posti se ne mette accanto un'altra identica, e **si scorre in orizzontale**
per andarci — rotella, trascinamento o frecce, con l'aggancio al mobile più
vicino quando ci si ferma.

Tre colonne su uno schermo verticale hanno un prezzo, ed è scelto: il mobile è
più alto che largo, quindi su un telefono sopra e sotto avanza stanza. È il
rapporto fra le due misure, e vale meno di una griglia che si riconfigura da sola
mentre giri il telefono in mano.

**L'inquadratura si calcola, non è fissa.** Una schermata è un mobile intero, e
la distanza della camera esce dall'ingombro della libreria e dal formato dello
schermo. La posizione della scatola in primo piano è espressa in frazioni di
quadro — a sinistra quando il pannello si apre di lato, in alto quando sale dal
basso — e le frazioni ricalcano il breakpoint del CSS (880 px), così 3D e
interfaccia si muovono insieme.

**Le fasi** stanno in `state.phase`:

| fase | cosa succede |
|---|---|
| `load` | si sceglie chi sei, gira il dado, la scena si costruisce a pezzi |
| `intro` | la camera si avvicina dalla stanza alla prima libreria |
| `browse` | si scorre fra le librerie; la scatola sotto il cursore si sporge |
| `focus` | la scatola esce dallo scaffale e viene in primo piano |
| `review` | il coperchio si alza e il pannello si apre di lato |

Il ciclo di rendering non si ferma mai: le fasi cambiano cosa viene animato, non
se animare. Nel catalogo il ciclo continua a girare ma non disegna, perché sotto
l'elenco non c'è niente da vedere.

**Senza WebGL** il sito resta leggibile: `#flat` mostra le stesse recensioni in
piano, e la costruzione della scena è dentro un `try`.

## Chi entra, e cosa può fare

All'apertura il sito chiede chi sei, e ci sono due strade.

**Entra con Google.** Ogni account ha la sua libreria e la vede solo lui: a
garantirlo sono le regole del database, non l'interfaccia. Chi è entrato comanda
sulla propria collezione — aggiunge, corregge, toglie, riordina.

**Guarda il catalogo.** Senza account, senza libreria. Si sfoglia il catalogo e
si leggono le recensioni, che sono pubbliche apposta. La voce «collezione» non
compare nemmeno: sarebbe una promessa che il sito non può mantenere.

**Il profilo** ha un nick, una faccia e un codice amico. Il nick si sceglie al
primo accesso e ti fa riconoscere; il codice ti fa trovare, e lo dai a chi vuoi
tu. Gli altri non lo vedono: la colonna non è leggibile e il proprio si chiede
al server con una funzione apposta — le regole per riga non bastavano, perché
aprono la riga intera. La faccia è un meeple disegnato su canvas: niente immagini
da caricare, e ce n'è una dal primo secondo.

**Gli amici** si chiedono col loro codice, oppure per email. La ricerca per
indirizzo non esiste apposta: confermerebbe a chiunque provi che quell'email ha
un account qui. L'invito per email c'è, ma il sito risponde sempre allo stesso
modo, esista o no l'indirizzo. Chi accetta è solo chi ha ricevuto la richiesta.

**Admin** è una terza cosa, e non si sceglie: si legge. `e_admin()` su Postgres
guarda la tabella `admin`, che è l'unica del progetto senza nessuna regola di
scrittura — quindi nessun account può promuovere sé stesso o altri. Sulla
collezione personale l'admin non ha nessun potere in più; quello che può fare è
**pubblicare una recensione nel catalogo**, che è uno solo e parla per il sito.

## La libreria di un amico

Dal profilo, accanto a ogni amico, c'è **la sua libreria**: si apre nella stessa
scena in tre dimensioni, con gli stessi gesti e le stesse recensioni che si
aprono cliccando una scatola. Cambia solo che non si tocca niente — via il `+`,
via *modifica* e *togli*, e le scatole non si spostano.

A permetterlo sono le regole del database, non l'interfaccia: la lettura di
`giochi` è aperta agli amici, la scrittura continua a chiedere che la riga sia
tua.

## Arredare la stanza

Dal pulsante in basso a sinistra: un cursore per la luce e tre tavolozze per
scaffali, muro e pavimento, piu' cinque stili di arredo per i cubi vuoti e per
il ripiano sopra il mobile — libri, scatole, dadi e meeple, piante, cornici.
Piu' «un po' di tutto» e «niente».

Il pannello sta in un angolo e non copre la scena: si sceglie e si vede subito.
Si salva da solo. E la stanza segue il profilo, non il browser: la ritrovi da un
altro dispositivo, e un amico che viene a guardare la tua libreria la vede
com'e' da te.

La luce non e' un filtro grigio davanti alla scena: la finestra cala piu' in
fretta della luce riflessa, e l'esposizione compensa solo un poco — come fa
l'occhio, che si abitua ma non del tutto.

## Le partite

Una collezione dice cosa hai; le partite dicono cosa hai giocato, con chi e chi
ha vinto. Si segnano da due posti: dalla scatola aperta, appena finito di
giocare, e dal profilo, quando rimetti in ordine.

Una partita si aggancia all'**id BoardGameGeek**, non a una scatola del tuo
scaffale: così si segna anche una serata a casa di un amico su un gioco che non
hai, e togliere un gioco dalla libreria non cancella la storia di quando ci hai
giocato.

I **giocatori** sono nomi salvati, non account: al tavolo c'è quasi sempre
qualcuno che sul sito non c'è. Chi invece è un amico viene proposto da solo, così
non lo si riscrive ogni volta.

## Cosa sta in libreria

Gli scaffali non mostrano tutta la collezione: mostrano quello che scegli tu.
Dall'elenco dei tuoi giochi metti un gioco in vetrina — scegliendo in quale
libreria — oppure lo togli, e resta comunque tuo. È la differenza fra un
magazzino e una vetrina, e con duecento giochi è anche l'unica cosa sensata.

## I gruppi

Etichette con il nome che vuoi — *party games*, *strategici*, *da due* — che
attraversano le librerie: un gioco può stare in più gruppi, e un gruppo può
pescare da mobili diversi.

Si mettono dalla scheda del gioco e dalla riga aperta nell'elenco, dove le
pastiglie si accendono col dito. In cima all'elenco le stesse pastiglie filtrano,
e **gestisci gruppi** apre creazione, rinomina e l'elenco di chi ci sta dentro.
Toglierne uno non tocca i giochi: sparisce l'etichetta.

## Ordinare, cercare, contare

- **Quattro ordinamenti**: il mio, data di aggiunta, nome, voto.
- **Il mio ordine si fa a mano**: si tiene premuta una scatola per un terzo di
  secondo e la si porta dove si vuole. Su un cubo occupato le due si scambiano;
  su un cubo libero ci va, e quello da cui è partita **resta vuoto** — lasciare
  un buco è una scelta, non un errore da compattare. Trascinandola nel mobile
  vuoto in fondo, una libreria nuova si crea da sola. Serve la pausa perché la
  libreria riempie lo schermo: senza, prendere una scatola e scorrere fra le
  librerie sarebbero lo stesso gesto.
- **Le librerie hanno un nome**, si creano e si tolgono dal nome in basso.
  Toglierne una non butta via i giochi: restano senza posto e rifluiscono nei
  cubi liberi delle altre.
- **La ricerca non evidenzia, ricostruisce**: cercare «root» lascia sullo
  scaffale Root e basta, e i cubi vuoti restano vuoti.
- Il **contatore** in alto dice quanti sono, e mentre si cerca «N di M».

## Aggiungere un gioco

Dal `+` in alto, o dal pulsante **in libreria** su una riga del catalogo.

La ricerca cerca su BoardGameGeek se il proxy locale è acceso e ha un token, se
no su Wikidata. In tutti e due i casi **un risultato riempie il modulo, non va
dritto sullo scaffale**: con Wikidata i dati vanno guardati prima di fidarsi —
l'editore è spesso il distributore locale.

La **copertina** si sceglie con il campo file, e vince sempre su quella della
fonte. È quasi sempre necessario: Wikimedia Commons accetta solo licenze libere e
la grafica di una scatola è protetta, quindi su 4.445 giochi solo 597 hanno
un'immagine, e sono foto di partite sul tavolo. La fonte giusta è il press kit
dell'editore.

## Il catalogo

Un elenco piatto, fuori dalla scena 3D apposta: la libreria in tre dimensioni è
la tua collezione, una cosa da guardare; il catalogo sono migliaia di titoli da
scorrere, e per quello un elenco batte qualunque mobile. Una riga per gioco,
copertina a sinistra e scheda a destra; cliccando, la recensione si apre **dentro
la riga**, perché una finestra sopra un elenco fa perdere il posto in cui si era.

Le **schede** arrivano da fuori. Oggi da Wikidata: circa 3.400 giochi da tavolo
con un id BoardGameGeek, ordinati per numero di edizioni linguistiche della voce,
che è l'unico segnale di notorietà che Wikidata offra. Quando arriverà il token
BGG la classifica diventerà la sua, e nell'interfaccia non cambierà niente.

Le **recensioni** invece sono nostre: stanno nella tabella `recensioni` su
Supabase, la chiave è l'id BGG, le scrivono gli admin e le legge chiunque. È
quello che rende sensato entrare da ospite.

## I dati da BoardGameGeek

Dal 2025 la XML API di BGG richiede registrazione e autorizzazione: senza header
`Authorization: Bearer <token>` risponde `401 Unauthorized`. Il token si ottiene
registrando l'applicazione su <https://boardgamegeek.com/applications>, e la
risposta può richiedere una settimana o più. Le condizioni dicono anche che:

- le chiamate andrebbero fatte **da server, con i risultati in cache**; chiamare
  l'API dal browser degli utenti è motivo di sospensione della licenza;
- mettere il token nel JavaScript della pagina lo espone a chiunque;
- le richieste vanno a `boardgamegeek.com`, **senza `www`**, altrimenti il token
  non viene letto;
- un sito pubblico deve mostrare il logo **"Powered by BGG"** con link a BGG;
- se il sito ha pubblicità o vende qualcosa serve una licenza commerciale, se no
  ne basta una non commerciale, di norma gratuita.

Per questo le chiamate non partono mai dalla pagina pubblica. Ci sono due strade,
tutte e due locali e tutte e due con il token solo in `BGG_TOKEN`.

**Una tantum, da riga di comando.** Stampa la scheda già formattata:

```bash
node tools/bgg-fetch.mjs 237182 169786
```

**Il proxy, per la ricerca dal sito:**

```bash
node tools/bgg-proxy.mjs
```

Sta in ascolto su `:8125` e fa le tre cose che il browser non può fare da solo:
mette l'header `Authorization`, rimette gli header CORS sulle risposte, e
rilancia l'immagine di copertina — che su `cf.geekdo-images.com` arriva **senza
CORS**, quindi come texture WebGL da un altro dominio sarebbe inutilizzabile.

Senza token il proxy parte lo stesso e lo dice; la ricerca cade su Wikidata e
l'interfaccia spiega cosa si sta guardando, invece di limitarsi a funzionare
peggio.

## Il database

Supabase. URL e chiave **publishable** stanno committati in `js/config.js`: sono
pubbliche per progetto, e a proteggere i dati sono le regole in
`supabase/migrations/`. La chiave `sb_secret_` non deve mai entrare nel repo.

```
20260819120018_schema_iniziale.sql        admin, profili, giochi, bucket copertine
20260819123907_copertine_locali.sql       le copertine committate
20260819135317_collezioni_personali.sql   una libreria per account
20260819180000_ordine_manuale.sql         la colonna `posizione`
20260819190000_recensioni_pubbliche.sql   le recensioni del sito, lette da tutti
20260819200000_profili_e_amici.sql        nick, faccia, codice amico, amicizie
20260819210000_partite.sql                giocatori salvati, partite, partecipanti
20260819220000_codice_riservato.sql       il codice amico non esce dalla riga
20260820100000_stanza_librerie_gruppi.sql stanza arredabile, librerie con nome, gruppi
20260820200000_preferiti_e_stile_libreria.sql preferiti, legno e arredi per mobile
```

**`GRANT` e RLS sono due cose diverse** e servono entrambe: il primo dice se un
ruolo può rivolgersi alla tabella, la seconda quali righe ottiene. Ogni tabella
nuova vuole il suo `grant`, se no torna `permission denied` e sembra un errore di
policy.

Il piano gratuito **mette in pausa il progetto** dopo circa una settimana senza
traffico, e si riattiva a mano dal pannello.

## Crediti

Le copertine sono degli editori, usate qui per parlare dei giochi:

- *Root* — illustrazioni di Kyle Ferrin, © Leder Games
- *Scythe* — illustrazioni di Jakub Rozalski, © Stonemaier Games

Il credito compare sotto al titolo in ogni recensione. Se un editore chiede di
toglierla, basta cancellare il campo `cover` dalla sua voce: la scatola torna a
usare la copertina disegnata e non si rompe niente.

I font sono Instrument Serif e Inter, licenza SIL Open Font. three.js è MIT.

## Rimasto da fare

- le **recensioni vere** al posto del lorem ipsum;
- un **token BGG approvato**, senza il quale il catalogo resta su Wikidata;
- una **edge function** su Supabase al posto del proxy locale: il token starebbe
  sul server, la ricerca funzionerebbe da qualunque browser senza accendere
  niente, ed è anche ciò che le condizioni di BGG chiedono;
- il logo **"Powered by BGG"** nel piede, obbligatorio quando si usa l'API;
- su telefono la scatola è larga 90 px: si riconosce la copertina, non si legge
  il titolo. È il prezzo delle tre colonne.
