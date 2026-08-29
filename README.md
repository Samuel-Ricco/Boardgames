# il dado è trap

Un sito di recensioni di giochi da tavolo che **è** una libreria in 3D. Una
KALLAX: cubi da 33 centimetri, una scatola per cubo, e cliccandone una la scatola
esce dallo scaffale, si apre e mostra la recensione.

Il sito ha quattro sezioni:

- **la mia collezione** — la libreria in tre dimensioni, tua, che si costruisce
  aggiungendo giochi. La stessa collezione si guarda anche come elenco;
- **il catalogo** — centomila titoli in ordine di classifica BGG, da sfogliare e
  cercare, con le recensioni di questo sito. Si legge **anche senza account**.
  Dentro ci sta anche la **wishlist**, che è lo stesso elenco guardato da
  un'altra parte;
- **le partite** — cosa avete giocato, con chi, chi ha vinto e come vai tu;
- **il profilo** — chi sei, la tua faccia, i tuoi amici, i giocatori con cui
  giochi.

Su schermo stretto le quattro sezioni stanno in una barra in basso, dove arriva
il pollice.

Il sito è in **italiano e in inglese**, e la lingua si cambia dal cancello
d'ingresso e dal fondo del profilo.

Niente build, niente bundler, niente dipendenze da installare: si apre con un
server statico qualsiasi.

```
index.html            markup e struttura
css/style.css         stile dell'interfaccia
js/i18n.js            le due lingue: dizionario, chiavi, selettore
js/config.js          url e chiave pubblica di Supabase
js/data.js            i giochi committati: il seme della libreria
js/auth.js            accesso con Google, e la domanda "sono admin?"
js/store.js           la collezione: database, copia locale, ordinamenti, ricerca
js/recensioni.js      le recensioni del sito, pubbliche, lette da chiunque
js/apprezzamenti.js   i cuori sotto la recensione di un amico
js/desideri.js        la wishlist: i giochi che non hai ancora
js/profilo.js         nick, faccia, codice amico, amicizie
js/partite.js         giocatori salvati e partite giocate
js/stanza.js          luce, colori, arredi della stanza e dei singoli cubi
js/bgg.js             BGG: sceglie da sé fra proxy locale e edge function
js/bggdump.js         l'indice di BGG in casa: cerca e classifica, senza rete
js/catalogo.js        tre fonti per le schede: BGG col token, il dump, Wikidata
js/art.js             legno, cartone, dadi, l'interno delle scatole
js/app.js             scena 3D, catalogo, animazioni, interazione
img/                  le copertine committate delle due scatole del seme
fonts/                Poppins in cinque pesi, sottoinsieme latino
vendor/               three.js r152 e supabase-js, committati nel repo
dati/bgg.txt          l'indice BGG: 106.694 giochi in ordine di classifica
supabase/migrations/  lo schema del database
supabase/functions/bgg/  la edge function: il token BGG sul server
tools/bgg-lib.mjs     il poco che serve per parlare con la XML API
tools/bgg-fetch.mjs   scarico una tantum, da riga di comando
tools/bgg-indice.mjs  riduce il dump quotidiano di BGG all'indice committato
tools/bgg-proxy.mjs   proxy locale, la strada di chi sviluppa
```

**Il sito non carica una sola risorsa esterna.** three.js, supabase-js, i font e
le copertine stanno nel repo: staccata la rete, la libreria si apre lo stesso,
con l'ultima copia salvata. È una scelta, non una svista.

L'eccezione è il **catalogo**, e non poteva essere altrimenti: le miniature dei
centomila titoli arrivano da BoardGameGeek. Un catalogo così non si committa, e
senza rete semplicemente non c'è — mentre la tua libreria continua a esserci.

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

Il sito è pubblicato su GitHub Pages a
<https://samuel-ricco.github.io/Boardgames/>, che serve il ramo `main`.

## Com'è fatta la libreria

**Tutte le superfici tranne le copertine sono generate da codice**: legno,
parquet, cartone, dorsi, facce dei dadi, l'interno della scatola sono disegnati
su canvas 2D all'avvio e passati a three.js come texture.

**Le copertine sono quelle vere**, e le prende da BoardGameGeek. Anche le
**misure** della scatola: BGG le tiene sulle edizioni, e da lì escono larghezza,
altezza e spessore veri — Carcassonne è stretta e alta, Gloomhaven è un mattone
da diciannove centimetri, e sullo scaffale si vede. Quello che non entra nel
cubo si rimpicciolisce tenendo le proporzioni. Se una copertina non arriva, la
scatola ripiega sull'illustrazione disegnata e il sito va avanti.

**La copertina si ritaglia, non si stira.** Le immagini di BGG non sono
scansioni del fronte, quindi non possono dettare la forma della scatola: la
forma la dice la scatola, l'immagine dice solo da che parte sta in piedi, e
quello che avanza esce dai bordi come su una scatola vera.

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
| `load` | si sceglie chi sei, rotola il dado, la scena si costruisce a pezzi |
| `intro` | la camera si avvicina dalla stanza alla prima libreria |
| `browse` | si scorre fra le librerie; la scatola sotto il cursore si sporge |
| `focus` | la scatola esce dallo scaffale e viene in primo piano |
| `review` | il coperchio si alza e il pannello si apre di lato |
| `closing` | la scatola torna a posto — e dura **quanto c'è da chiudere** |

Il ciclo di rendering non si ferma mai: le fasi cambiano cosa viene animato, non
se animare. Fuori dalla collezione il ciclo continua a girare ma non disegna,
perché sotto l'elenco non c'è niente da vedere.

**Senza WebGL** il sito resta leggibile: `#flat` mostra le stesse recensioni in
piano, e la costruzione della scena è dentro un `try`.

## Chi entra, e cosa può fare

All'apertura il sito chiede chi sei, e ci sono due strade.

**Entra con Google.** Ogni account ha la sua libreria e la vede solo lui: a
garantirlo sono le regole del database, non l'interfaccia. Chi è entrato comanda
sulla propria collezione — aggiunge, corregge, toglie, riordina. E la schermata
di **scelta dell'account** ricompare ogni volta: uscire invalida la sessione di
Supabase ma non quella di Google, che altrimenti rientrerebbe da sola con
l'unico account collegato senza chiedere niente.

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
via *modifica* e *togli*, e le scatole non si spostano. Anche catalogo, partite
e profilo spariscono dalle due navigazioni: si esce da un posto solo, il cartello
che dice di chi è la libreria.

**L'unica cosa che si tocca in casa d'altri è il cuore.** Apri una scatola, leggi
quello che ne pensa lui, e puoi dire che ti è piaciuto. La chiave è la *copia*,
non il gioco: si apprezza la recensione di quella persona.

A permetterlo sono le regole del database, non l'interfaccia: la lettura di
`giochi` è aperta agli amici, la scrittura continua a chiedere che la riga sia
tua.

## Arredare la stanza, e i cubi

Dal pulsante in basso a sinistra: due cursori — la **luce** della stanza e i
**faretti** sotto i ripiani, con la loro tinta — e tre tavolozze per scaffali,
muro e pavimento, più il colore del nome scritto sulla parete.

Il pannello sta in un angolo e non copre la scena: si sceglie e si vede subito.
Si salva da solo. E la stanza segue il profilo, non il browser: la ritrovi da un
altro dispositivo, e un amico che viene a guardare la tua libreria la vede
com'è da te.

La luce non è un filtro grigio davanti alla scena: la finestra cala più in
fretta della luce riflessa, e l'esposizione compensa solo un poco — come fa
l'occhio, che si abitua ma non del tutto. I faretti invece **non seguono la
stanza**: si spegne il lampadario e la libreria resta accesa da dentro, come in
salotto.

**Gli arredi dei cubi vuoti si scelgono uno per uno**, e non c'è nessun pulsante:
si **tiene premuto un cubo vuoto** e esce una fila di cinque icone — come la
libreria, libri, dadi e meeple, piante, niente. Lo stesso gesto vale sui **tre
posti sopra il mobile**, uno per colonna. «Come la libreria» non è un valore: è
l'assenza di una scelta, così un mobile che cambia stile si porta dietro tutti i
cubi che nessuno ha toccato.

Gli arredi sono **tre** — libri, dadi e meeple, piante — più «un po' di tutto» e
«niente». `niente` non è un ripiego: chi lascia i vuoti apposta non vuole che
glieli riempiamo noi.

## Le partite

Una collezione dice cosa hai; le partite dicono cosa hai giocato, con chi e chi
ha vinto. Si segnano da due posti: dalla scatola aperta, appena finito di
giocare, e dalla sezione **partite**, quando rimetti in ordine.

Ci sono **tre modi di guardarle**: *per gioco* (quante volte a Root e chi vince),
*le ultime* (in ordine di tempo) e il **calendario**, una griglia di giorni dove
il ritmo si legge tutto insieme — i mesi pieni, le settimane vuote, le sere in
cui si è giocato più di una partita. Si apre sul mese dell'ultima partita, non su
oggi.

In cima ci sono tre numeri: quante partite, su quanti giochi, e **come vai tu**.
Il winrate è anche un pulsante: dietro c'è lo stesso numero gioco per gioco, con
l'anello che si confronta scorrendo. E compare anche sulla **scheda di un gioco**,
perché è l'unica cosa che la sezione partite non può dirti mentre hai quel gioco
in mano.

**Si cerca per titolo e per persona**: le due domande che si fanno a un archivio
di partite sono «quando abbiamo giocato a questo» e «quando c'era Giulia». Il
filtro vale su tutte e tre le viste, e i tre numeri in cima lo seguono — così si
legge come vai *quando c'è quella persona*.

Una partita si aggancia all'**id BoardGameGeek**, non a una scatola del tuo
scaffale: così si segna anche una serata a casa di un amico su un gioco che non
hai, e togliere un gioco dalla libreria non cancella la storia di quando ci hai
giocato.

I **giocatori** sono nomi salvati, non account: al tavolo c'è quasi sempre
qualcuno che sul sito non c'è. Chi invece è un amico viene proposto da solo, così
non lo si riscrive ogni volta — e tu ci sei sempre, primo nell'elenco.

I **punti** si segnano e si salvano, e le **posizioni si calcolano**: chi segna i
punti non deve anche contare chi è arrivato primo. La corona segue i punti finché
nessuno la tocca; toccandola, comanda la persona. C'è anche una **calcolatrice**,
perché un punteggio è quasi sempre una somma di quattro pezzi e farla a mente col
telefono in mano è il modo più rapido di sbagliare vincitore.

## Cosa sta in libreria

Gli scaffali non mostrano tutta la collezione: mostrano quello che scegli tu.
Dall'elenco dei tuoi giochi metti un gioco in vetrina — scegliendo in quale
libreria — oppure lo togli, e resta comunque tuo. È la differenza fra un
magazzino e una vetrina, e con duecento giochi è anche l'unica cosa sensata.

Nell'elenco una **colonna dice dov'è**: la libreria a cubi è terracotta se il
gioco è esposto e tenue se sta solo in collezione, e il `title` dice in quale
mobile.

## I gruppi

Etichette con il nome che vuoi — *party games*, *strategici*, *da due* — che
attraversano le librerie: un gioco può stare in più gruppi, e un gruppo può
pescare da mobili diversi.

Si mettono dalla riga aperta nell'elenco, dove le pastiglie si accendono col
dito, e **gestisci gruppi** apre creazione, rinomina e l'elenco di chi ci sta
dentro. Toglierne uno non tocca i giochi: sparisce l'etichetta.

## Ordinare, cercare, contare

- **Quattro ordinamenti**: il mio, data di aggiunta, nome, voto.
- **Il mio ordine si fa a mano**: si tiene premuta una scatola per un terzo di
  secondo e la si porta dove si vuole. Su un cubo occupato le due si scambiano;
  su un cubo libero ci va, e quello da cui è partita **resta vuoto** — lasciare
  un buco è una scelta, non un errore da compattare. Trascinandola nel mobile
  vuoto in fondo, una libreria nuova si crea da sola. Serve la pausa perché la
  libreria riempie lo schermo: senza, prendere una scatola e scorrere fra le
  librerie sarebbero lo stesso gesto.
- **Le librerie hanno un nome**, si creano, si rinominano e si riordinano
  trascinandole. Toglierne una non butta via i giochi: restano senza posto e
  rifluiscono nei cubi liberi delle altre. Due mobili non possono chiamarsi allo
  stesso modo — il nome è l'unica cosa che li distingue.
- **La ricerca non evidenzia, ricostruisce**: cercare «root» lascia sullo
  scaffale Root e basta, e i cubi vuoti restano vuoti.
- **Due caselle, un solo stato**: una nell'imbuto sopra la scena e una sopra
  l'elenco. Sono la stessa ricerca, e restano in pari da sole.
- Il **contatore** in alto dice quanti sono, e mentre si cerca «N di M». È anche
  la porta dell'elenco: premendolo si apre, e allora dice dove riporta.

## Aggiungere un gioco

Dal `+` nell'elenco della collezione, o dal `+` su una riga del catalogo.

La ricerca cerca su BoardGameGeek quando il token c'è, se no nell'indice in casa,
se no su Wikidata. **Un risultato riempie il modulo, non va dritto sullo
scaffale**: si guarda prima di salvare.

**Un gioco appena aggiunto non va in vetrina.** Entra in collezione e basta, e
sullo scaffale ce lo metti dall'elenco — se no il sito esporrebbe una cosa che
nessuno ha chiesto di esporre, e su un mobile pieno arriverebbe a creare una
libreria da solo per farcela stare.

La **copertina** arriva da BGG, ma il campo file vince sempre: quella scelta a
mano non viene mai sostituita. Il nome dell'oggetto nel bucket dice da dove
viene — `-p9156909` è l'immagine 9156909 di BGG, `-mano` è un file tuo — ed è
così che il sito sa quali copertine sono ancora da riprendere.

## Il catalogo

Un elenco piatto, fuori dalla scena 3D apposta: la libreria in tre dimensioni è
la tua collezione, una cosa da guardare; il catalogo sono centomila titoli da
scorrere, e per quello un elenco batte qualunque mobile. Una riga per gioco,
copertina a sinistra e scheda a destra; cliccando, la recensione si apre **dentro
la riga**, perché una finestra sopra un elenco fa perdere il posto in cui si era.

**Si sfoglia in ordine di classifica BGG.** L'indice sta in casa
(`dati/bgg.txt`, 3,76 MB): 106.694 giochi con id, nome, anno e media, di cui
31.183 in classifica. Da lì vengono l'ordine e la ricerca, che risponde in **5
millisecondi** perché il file è già in memoria — e si scarica solo a chi apre il
catalogo, non a chi apre il sito per guardare la propria libreria.

Il dump e l'API non si escludono: **il dump sa chi esiste e in che ordine, l'API
sa com'è fatto**. Scegliendo un risultato la scheda la dà BGG — autore, editore,
voto, peso e la copertina vera — e Wikidata resta il ripiego per quando il token
non c'è.

**La wishlist** sta qui dentro, come secondo modo di guardare lo stesso elenco:
il cuore su una riga ci mette il gioco. Non è una sezione a parte perché
sarebbe un posto che quasi sempre porta a una lista vuota, e non è una riga della
collezione perché un gioco desiderato non è un gioco che hai. Un gioco che hai
già non ha il cuore.

Le **recensioni** sono nostre: stanno nella tabella `recensioni` su Supabase, la
chiave è l'id BGG, le scrivono gli admin e le legge chiunque. È quello che rende
sensato entrare da ospite.

## I dati da BoardGameGeek

Dal 2025 la XML API di BGG richiede registrazione e autorizzazione: senza header
`Authorization: Bearer <token>` risponde `401 Unauthorized`. Il token si ottiene
registrando l'applicazione su <https://boardgamegeek.com/applications>. Le
condizioni dicono anche che:

- le chiamate vanno fatte **da server, con i risultati in cache**; chiamare
  l'API dal browser degli utenti è motivo di sospensione della licenza;
- mettere il token nel JavaScript della pagina lo espone a chiunque;
- le richieste vanno a `boardgamegeek.com`, **senza `www`**, altrimenti il token
  non viene letto;
- un sito pubblico deve mostrare il logo **"Powered by BGG"** con link a BGG;
- se il sito ha pubblicità o vende qualcosa serve una licenza commerciale, se no
  ne basta una non commerciale, di norma gratuita.

Per questo le chiamate non partono mai dalla pagina. Ci sono **due server con gli
stessi identici endpoint**, e il client non sa quale sta usando: prova prima
quello locale, e se tace passa alla edge function.

**La edge function** (`supabase/functions/bgg/`) è la strada di tutti: il token
sta nei secrets del progetto, il browser non lo vede mai, e funziona da qualunque
parte — anche da GitHub Pages.

```bash
npx supabase secrets set BGG_TOKEN=...
npx supabase functions deploy bgg --no-verify-jwt
```

`--no-verify-jwt` non è una svista: il sito usa una chiave `sb_publishable_`, che
non è un JWT, e con la verifica accesa non passerebbe nemmeno chi è entrato. Lì
dentro non si legge e non si scrive niente di nessuno: si rilancia un'API
pubblica.

**Il proxy locale** è la strada di chi sviluppa — nessun deploy per provare una
modifica, e risposte in pochi millisecondi:

```bash
node tools/bgg-proxy.mjs
```

Sta in ascolto su `:8125`, legge il token da `BGG_TOKEN` o dal file `.bgg-token`
accanto al repo (che è in `.gitignore` e non ci entra mai), e fa le tre cose che
il browser non può fare da solo: mette l'header `Authorization`, rimette gli
header CORS sulle risposte, e rilancia l'immagine di copertina — che su
`cf.geekdo-images.com` arriva **senza CORS**, quindi come texture WebGL da un
altro dominio sarebbe inutilizzabile.

**L'indice** si rifà dal dump quotidiano di BGG, che invece non chiede token:

```bash
node tools/bgg-indice.mjs
```

Il CSV grezzo (11 MB) non si committa: si committa quello che ne esce.

## Il database

Supabase. URL e chiave **publishable** stanno committati in `js/config.js`: sono
pubbliche per progetto, e a proteggere i dati sono le regole in
`supabase/migrations/`. La chiave `sb_secret_` non deve mai entrare nel repo.

```
20260819120018_schema_iniziale.sql            admin, profili, giochi, bucket copertine
20260819123907_copertine_locali.sql           le copertine committate
20260819135317_collezioni_personali.sql       una libreria per account
20260819180000_ordine_manuale.sql             la colonna `posizione`
20260819190000_recensioni_pubbliche.sql       le recensioni del sito, lette da tutti
20260819200000_profili_e_amici.sql            nick, faccia, codice amico, amicizie
20260819210000_partite.sql                    giocatori salvati, partite, partecipanti
20260819220000_codice_riservato.sql           il codice amico non esce dalla riga
20260820100000_stanza_librerie_gruppi.sql     stanza arredabile, librerie con nome, gruppi
20260820200000_preferiti_e_stile_libreria.sql preferiti, legno e arredi per mobile
20260820230000_apprezzamenti.sql              il cuore sulla recensione di un amico
20260822120000_punti_partita.sql              i punti di ogni partecipante
20260825120000_wishlist.sql                   i giochi che vorresti
```

**`GRANT` e RLS sono due cose diverse** e servono entrambe: il primo dice se un
ruolo può rivolgersi alla tabella, la seconda quali righe ottiene. Ogni tabella
nuova vuole il suo `grant`, se no torna `permission denied` e sembra un errore di
policy.

Qui non c'è la CLI di Supabase: le migrazioni si applicano incollandole
nell'**SQL editor** del pannello.

Il piano gratuito **mette in pausa il progetto** dopo circa una settimana senza
traffico, e si riattiva a mano dal pannello.

## Crediti

Le copertine sono degli editori, usate qui per parlare dei giochi. Quelle dei
due giochi committati:

- *Root* — illustrazioni di Kyle Ferrin, © Leder Games
- *Scythe* — illustrazioni di Jakub Rozalski, © Stonemaier Games

Il credito compare sotto al titolo in ogni recensione. Se un editore chiede di
toglierla, basta cancellare il campo `cover` dalla sua voce: la scatola torna a
usare la copertina disegnata e non si rompe niente.

Il font è Poppins, licenza SIL Open Font. three.js è MIT.

## Rimasto da fare

- le **recensioni vere** al posto del lorem ipsum: sono opinioni di chi ci gioca,
  e non le può scrivere nessun altro;
- la **scheda di un gioco non si corregge da nessuna parte**. `apriModifica()`
  — autore, editore, anno, voto, copertina — è intatta ma senza porta da quando
  il pulsante «scheda» è uscito dal piede della recensione. Col token quei campi
  si riempiono da soli all'aggiunta, quindi fa meno male di prima; il posto
  naturale è il menu a tre punti dell'elenco;
- il logo **"Powered by BGG"** nel piede, obbligatorio quando si usa l'API;
- manca l'**indice unico su `(proprietario, nome)`** delle librerie: il divieto
  dei nomi doppi vive in `store.js` e regge, ma la garanzia sarebbe quella;
- le **partite restano private**: gli amici vedono libreria e recensioni, non le
  partite. È il cambio di una policy, ed è una scelta di chi ci abita;
- le **misure delle scatole stanno in `localStorage`**, non sul database. Sono
  fatti sul gioco e uguali per tutti, quindi la cache per id BGG è il posto
  giusto finché è una sola persona a usarlo;
- su telefono la scatola è larga 90 px: si riconosce la copertina, non si legge
  il titolo. È il prezzo delle tre colonne.
