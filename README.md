# il dado è trap

Un armadio di giochi da tavolo in 3D. Le ante si aprono da sole all'avvio, le
scatole stanno sulle mensole, e cliccandone una questa esce dall'armadio, si apre
e mostra la recensione.

Niente build, niente bundler, niente dipendenze da installare: si apre con un
server statico qualsiasi.

```
index.html            markup e struttura
css/style.css         stile dell'interfaccia
js/data.js            i giochi committati: il seme della libreria
js/store.js           la libreria viva (localStorage) e l'ordinamento
js/bgg.js             ricerca su BGG, attraverso il proxy locale
js/art.js             legno, cartone, dadi, copertine di ripiego
js/app.js             scena 3D, animazioni, interazione
img/                  le copertine delle scatole
fonts/                Bebas Neue e Inter, sottoinsieme latino
vendor/three.min.js   three.js r152, committato nel repo
tools/bgg-lib.mjs     il poco che serve per parlare con la XML API
tools/bgg-fetch.mjs   scarico una tantum, da riga di comando
tools/bgg-proxy.mjs   proxy locale per la ricerca in modalita' admin
```

**Non c'è una sola risorsa esterna.** three.js, i font e le copertine stanno nel
repo: staccata la rete, il sito continua a funzionare identico. È una scelta, non
una svista — l'unica cosa che va in rete sono i link "scheda su BoardGameGeek",
che sono link e non risorse.

## Farlo girare

Serve un server statico: aprendo `index.html` come file i percorsi relativi
non risolvono.

```bash
python -m http.server 8124
```

Poi `http://localhost:8124`. C'è già un `.claude/launch.json` con la stessa cosa.

## Come è fatto

**Tutte le superfici tranne le copertine sono generate da codice**: legno,
cartone, dorsi, facce dei dadi, l'interno della scatola sono disegnati su canvas
2D all'avvio e passati a three.js come texture.

**Le copertine sono quelle vere**, in `img/`, e da loro escono anche le
proporzioni della scatola: la larghezza è fissa, l'altezza viene dall'aspetto
dell'immagine, così Root resta bassa e larga com'è davvero e l'immagine non va
stirata. Se una copertina non si carica, la scatola ripiega su
un'illustrazione disegnata a mano (`coverRoot`, `coverScythe` in `js/art.js`) e
il sito va avanti lo stesso.

**Le fasi** stanno in `state.phase`:

| fase | cosa succede |
|---|---|
| `load` | si sceglie la modalità, gira il dado, la scena si costruisce a pezzi |
| `intro` | le ante ruotano sui cardini e la camera entra fino a inquadrare uno scaffale |
| `browse` | si scorre fra gli scaffali; la scatola sotto il cursore si sporge |
| `focus` | la scatola esce dall'armadio e viene in primo piano |
| `review` | il coperchio si alza e il pannello si apre come un'anta |

Il ciclo di rendering non si ferma mai: le fasi cambiano cosa viene animato,
non se animare.

**L'armadio non ha un'altezza fissa.** I vani si contano dai giochi in libreria
(tre per scaffale, più uno di scorta) e la camera scorre da uno all'altro con
rotella, trascinamento o frecce, agganciandosi allo scaffale più vicino quando ci
si ferma. Aggiungere giochi lo fa crescere verso il basso; il primo gioco
dell'ordinamento sta sempre in cima.

**L'inquadratura si calcola, non è fissa.** In navigazione la camera sta dentro
il mobile e inquadra le scatole, non i fianchi: tenerli nel quadro vorrebbe dire
stare così lontani da vedere mezzo armadio invece dello scaffale. La posizione
della scatola in primo piano è espressa in frazioni di quadro — a sinistra quando
il pannello si apre di lato, in alto quando sale dal basso — e le frazioni
ricalcano il breakpoint del CSS (880 px), così 3D e interfaccia si muovono
insieme.

**Senza WebGL** il sito resta leggibile: `#flat` mostra le stesse recensioni in
piano, e la costruzione della scena è dentro un `try`.

## Le due modalità

All'apertura il sito chiede chi sei. **Utente** sfoglia e legge. **Admin** può
aggiungere giochi con il `+` in alto a destra e toglierli dal pulsante che compare
nella recensione (due tocchi, il primo arma e il secondo esegue). In alto a destra,
per entrambe le modalità, c'è l'ordinamento: aggiunta, nome, voto.

**La modalità admin non è protetta, ed è una scelta dichiarata**: su un sito
statico non esiste un posto sicuro dove tenere una password, e fingere un login
sarebbe peggio che non averlo. Chiunque può scegliere Admin, ma quello che fa
resta **solo nel suo browser**: la libreria vive in `localStorage`, il sito
pubblico continua a mostrare quella committata in `js/data.js`.

Per pubblicare davvero una modifica: `esporta js/data.js` nella scheda di
aggiunta scarica il file aggiornato, che va messo al posto di `js/data.js` e
committato. `ripristina` butta via le modifiche locali e torna a quella del repo.

## Aggiungere un gioco

Da admin, col `+`. La ricerca su BoardGameGeek passa dal proxy locale (vedi sotto);
senza proxy resta il modulo a mano, che chiede solo il titolo.

A mano nel codice, basta una voce in `GAMES` dentro `js/data.js`. I campi che contano:

- `cover`: percorso dell'immagine della scatola in `img/`. Va bene un'immagine
  qualsiasi purché sia la copertina intera, senza bordi: le proporzioni della
  scatola nella scena escono da lì.
- `artist`: chi ha disegnato la copertina, finisce nel credito sotto al titolo.
- `art`: il ripiego disegnato a mano se l'immagine non c'è.
- `slot`: la posizione sul ripiano di mezzo, da sinistra.
- `wrap` e `ink`: i colori dei bordi della scatola e del titolo sul dorso.
- `review`: un array di capoversi. **Adesso è lorem ipsum**, da sostituire.

Il ripiano di mezzo tiene due scatole grandi. Per metterne di più va allargato
l'armadio (`CAB.w` in `js/app.js`) o aggiunto un secondo ripiano ai giochi.

## I dati da BoardGameGeek

I numeri delle schede (giocatori, durata, età, peso) sono quelli pubblici di BGG,
copiati a mano. **Non vengono chiesti all'API dal browser, ed è voluto.**

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

**Una tantum, da riga di comando.** Stampa la scheda già formattata da incollare
in `js/data.js`:

```bash
node tools/bgg-fetch.mjs 237182 169786
```

**La ricerca in modalità admin**, che ha bisogno di un interlocutore vivo:

```bash
node tools/bgg-proxy.mjs
```

Sta in ascolto su `:8125` e fa le tre cose che il browser non può fare da solo:
mette l'header `Authorization`, rimette gli header CORS sulle risposte, e
rilancia l'immagine di copertina — che su `cf.geekdo-images.com` arriva **senza
CORS**, quindi come texture WebGL da un altro dominio sarebbe inutilizzabile.
La copertina scaricata viene ridisegnata su canvas a larghezza contenuta e
tenuta nella libreria come data URL, così resta anche a proxy spento.

Senza token il proxy parte lo stesso e lo dice; la ricerca risponde `401` e
l'interfaccia lo spiega invece di limitarsi a fallire. Finché il token non c'è,
i giochi si scrivono a mano: sono quattro numeri per gioco.

## Crediti

Le copertine sono degli editori, usate qui per parlare dei giochi:

- *Root* — illustrazioni di Kyle Ferrin, © Leder Games
- *Scythe* — illustrazioni di Jakub Rozalski, © Stonemaier Games

Il credito compare sotto al titolo in ogni recensione. Se un editore chiede di
toglierla, basta cancellare il campo `cover` dalla sua voce in `js/data.js`: la
scatola torna a usare la copertina disegnata e non si rompe niente.

I font sono Bebas Neue e Inter, licenza SIL Open Font. three.js è MIT.

## Rimasto da fare

- le **recensioni vere** al posto del lorem ipsum in `js/data.js`;
- un **token BGG approvato**, senza il quale la ricerca dell'admin resta a 401;
- il logo **"Powered by BGG"** nel piede, obbligatorio quando si usa l'API;
- le copertine dei giochi aggiunti da admin vivono come data URL dentro
  `localStorage`: all'export diventano `img/<id>.jpg`, e l'immagine va salvata
  lì a mano;
- un dominio, se il sito deve andare online.
