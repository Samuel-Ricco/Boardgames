# il dado è trap

Un armadio di giochi da tavolo in 3D. Le ante si aprono da sole all'avvio, le
scatole stanno sulle mensole, e cliccandone una questa esce dall'armadio, si apre
e mostra la recensione.

Niente build, niente bundler, niente dipendenze da installare: si apre con un
server statico qualsiasi.

```
index.html            markup e struttura
css/style.css         stile dell'interfaccia
js/data.js            i giochi e le recensioni  <- si tocca solo questo per aggiungerne
js/art.js             copertine, legno, dadi: tutto disegnato su canvas a runtime
js/app.js             scena 3D, animazioni, interazione
vendor/three.min.js   three.js r152, committato nel repo
tools/bgg-fetch.mjs   script per scaricare i dati da BoardGameGeek
```

## Farlo girare

Serve un server statico: aprendo `index.html` come file i percorsi relativi
non risolvono.

```bash
python -m http.server 8124
```

Poi `http://localhost:8124`. C'è già un `.claude/launch.json` con la stessa cosa.

## Come è fatto

**Tutta la grafica è generata da codice.** Non c'è nemmeno un'immagine nel repo:
le copertine, il legno, il cartone, le facce dei dadi sono disegnati su canvas 2D
all'avvio e passati a three.js come texture. Le copertine di Root e Scythe sono
illustrazioni originali ispirate al tema dei giochi, non riproduzioni delle
scatole vere.

**Le fasi** stanno in `state.phase`:

| fase | cosa succede |
|---|---|
| `load` | gira il dado del caricamento, la scena si costruisce a pezzi |
| `intro` | la camera si avvicina, le ante ruotano sui cardini, le luci dei vani salgono |
| `browse` | si passa sopra le scatole, quella sotto il cursore si sporge |
| `focus` | la scatola esce dall'armadio e viene in primo piano |
| `review` | il coperchio si alza e il pannello si apre come un'anta |

Il ciclo di rendering non si ferma mai: le fasi cambiano cosa viene animato,
non se animare.

**L'inquadratura si calcola, non è fissa.** La distanza della camera esce
dall'ingombro dell'armadio e dal formato dello schermo, e la posizione della
scatola in primo piano è espressa in frazioni di quadro: a sinistra quando il
pannello si apre di lato, in alto quando sale dal basso. Le frazioni ricalcano
il breakpoint del CSS (880 px), quindi 3D e interfaccia si muovono insieme.

**Senza WebGL** il sito resta leggibile: `#flat` mostra le stesse recensioni in
piano, e la costruzione della scena è dentro un `try`.

## Aggiungere un gioco

Basta una voce in `GAMES` dentro `js/data.js`. I campi che contano:

- `art`: quale copertina disegnare. Le funzioni stanno in `js/art.js`
  (`coverRoot`, `coverScythe`); per un gioco nuovo se ne aggiunge una e la si
  aggancia in `makeGameBox()`.
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

Per questo lo scarico è uno script da lanciare a mano, che stampa la scheda già
formattata da incollare in `js/data.js`:

```bash
node tools/bgg-fetch.mjs 237182 169786
```

con `BGG_TOKEN` nell'ambiente. Finché non c'è un token approvato, i dati si
scrivono a mano: sono quattro numeri per gioco.

## Rimasto da fare

- le **recensioni vere** al posto del lorem ipsum in `js/data.js`;
- il logo **"Powered by BGG"** nel piede, se e quando si usa l'API;
- un dominio, se il sito deve andare online.
