# il dado è trap — note di progetto

Sito di recensioni di giochi da tavolo. **Il sito è un armadio in 3D**: si apre
all'avvio, le scatole stanno sulle mensole, cliccandone una esce, si apre e mostra
la recensione. Niente build, niente dipendenze da installare.

```
index.html            markup
css/style.css         stile
js/data.js            i giochi committati: il seme della libreria
js/store.js           libreria viva in localStorage, ordinamenti, export
js/bgg.js             ricerca BGG (passa dal proxy locale)
js/art.js             grafica generata su canvas
js/app.js             scena 3D e interazione
img/                  le copertine vere delle scatole
fonts/                Bebas Neue e Inter in locale
vendor/three.min.js   three.js r152, committato
tools/bgg-*.mjs       scarico dati BGG e proxy per la ricerca admin
```

**Niente risorse esterne, mai.** three.js, font e copertine sono nel repo: il
sito deve funzionare a rete staccata. Prima di aggiungere un `<link>` o un
`src` verso l'esterno, scaricare il file e committarlo.

## Modo di lavorare

- L'utente scrive in italiano. Commenti nel codice e testi del sito in italiano.
- **Verificare sempre su un server locale**, non aprendo il file: il pannello di
  anteprima serve la pagina come `data:` URL e i percorsi relativi non risolvono.
  C'è `.claude/launch.json` pronto (`python -m http.server 8124`).
- I file `.js` sono **solo ASCII**: senza header `charset` sui file esterni le
  lettere accentate si rompono. Nei testi si usano entità HTML o apostrofi dritti.

### Trappole dell'ambiente di anteprima

- il pannello a volte mostra uno **snapshot vecchio** mentre il JS gira su un
  documento nuovo: se i numeri non tornano, verificare prima di credere a un test;
- con la pagina non visibile **`requestAnimationFrame` è sospeso** (zero frame):
  per questo il caricamento avanza con `setTimeout` e non con i frame, se no
  resterebbe fermo per sempre;
- `innerWidth`/`innerHeight` possono valere **0** se il pannello non è disposto:
  `layout()` esce subito se sono minori di 2;
- il riquadro dell'anteprima è **verticale**, quindi non è un buon giudice
  dell'inquadratura su un monitor normale;
- con il pannello non visibile `document.visibilityState` è `hidden`, i frame non
  arrivano e **le animazioni restano congelate a metà**: se una fase sembra
  bloccata, guardare lì prima di cercare il bug. Per verificare senza frame si
  può esporre temporaneamente il `frame()` e chiamarlo a mano con un orologio
  finto — che però deve essere **monotono**, se no `dt` va negativo e le
  animazioni tornano indietro.

## Le fasi

`state.phase`: `load` → `intro` → `browse` → `focus` → `review` → `closing`.
Il ciclo di rendering non si ferma mai; le fasi decidono cosa viene animato.

## Armadio a scaffali

- I vani si contano dai giochi: `max(3, ceil(n/3) + 1)`. Quello di scorta serve a
  far capire che l'armadio continua.
- **Il primo gioco dell'ordinamento sta in cima**: `bay = bays-1-page`. Lo scroll
  si misura in pagine dall'alto, non in vani dal basso.
- `applyLibrary()` non ricrea le scatole che ci sono già: le fa scivolare al posto
  nuovo, così riordinare si vede. Ricostruisce il mobile solo se cambia il numero
  di vani.
- Gli oggetti di contorno riempiono i posti vuoti e usano un rumore **ripetibile**
  (`srnd`), se no a ogni riordino saltavano da un ripiano all'altro.
- In navigazione la camera inquadra **le scatole, non i fianchi**: tenerli nel
  quadro vorrebbe dire stare così lontani da vedere mezzo armadio. E guarda un
  filo sotto il centro del vano, perché le scatole poggiano sul ripiano.
- Lo scroll si aggancia allo scaffale più vicino 220 ms dopo che ci si è fermati.

## Admin

- Non è protetto e non deve fingere di esserlo: su un sito statico non c'è dove
  tenere una password. Sta scritto nella schermata iniziale.
- Le modifiche vivono in `localStorage`; per pubblicarle c'è `esporta js/data.js`.
- **Mai salvare `img` nella libreria**: è l'immagine decodificata, in JSON diventa
  `{}` e al ricaricamento sembra una copertina valida senza esserlo. Le proporzioni
  della scatola finivano a NaN e le scatole sparivano dalla scena. `save()` lo
  toglie, `loadCovers()` verifica `naturalWidth`.
- Le conferme sono **in due tempi sul bottone**, non `window.confirm`: quello
  blocca il rendering, e una finestra di sistema in mezzo a una scena 3D stona.

## Inquadratura (la parte che è costata di più)

Niente numeri fissi: la distanza della camera esce dall'ingombro dell'armadio e
dal formato dello schermo, e la posizione della scatola in primo piano è espressa
in **frazioni di quadro**.

- La misura si prende sul **fronte del mobile** (`z = CAB.front`), non sul suo
  centro: è quello il piano che deve stare nello schermo.
- Su schermo **verticale** (aspect < 0.8) i margini si stringono, se no l'armadio
  resta un francobollo in mezzo al buio.
- `focusPose()` prende il **vincolo più stretto fra altezza e larghezza**: con la
  sola altezza, su una finestra stretta la scatola usciva dal quadro a sinistra.
- L'ingombro usato per il calcolo è **più grande della scatola chiusa** (×1.24 e
  ×1.34): il coperchio si alza e viene avanti, quindi occupa più spazio di quanto
  misuri.
- Le frazioni ricalcano il **breakpoint del CSS a 880 px** (`state.side`): sopra,
  il pannello si apre di lato e la scatola sta a sinistra; sotto, il pannello sale
  dal basso e la scatola sta in alto.

## Altre cose imparate a caro prezzo

- **Il coperchio si alza più che avvicinarsi.** Venendo verso la camera ingrandiva
  di colpo e usciva dal quadro: ora fa 0.95 in avanti e 1.05 in su.
- **La luce principale è quasi frontale.** Spostata di lato, l'ombra dell'armadio
  si stampava sulla parete come una lastra nera con i bordi netti. Aiutano anche
  la parete quasi a contatto con lo schienale e un *wash* che non proietta ombre,
  quindi schiarisce proprio dentro l'ombra.
- **Le luci dei vani stanno alte e avanti** (74% dell'altezza del vano, z 1.2):
  attaccate al ripiano di sopra facevano una macchia tonda sul legno.
- Le ante si aprono a **1.42 rad (~81°)**: più aperte cominciano a coprire i
  ripiani, a 90° spariscono perché si vedono di taglio.
- `#scene` ha **`touch-action:none`**: se no il browser legge il trascinamento
  come scroll e annulla i pointer event.
- Un **clic** è un `pointerup` entro 600 ms e 9 px dal `pointerdown`: senza questo
  controllo, trascinare per guardarsi intorno apriva una scatola.

## Le scatole

- **La scatola prende le proporzioni dalla sua copertina**: `BOX.w` è fisso,
  l'altezza è `BOX.w / aspetto dell'immagine`. Root è bassa e larga davvero, e
  così l'immagine non viene stirata. L'altezza finisce in `userData.h` e la usano
  sia il posizionamento sul ripiano sia `focusPose()`.
- Le immagini vanno caricate **prima** di costruire le scatole (`loadCovers()` in
  `boot()`), se no la geometria non sa che proporzioni avere.
- Se una copertina manca, `makeGameBox` ripiega sull'illustrazione disegnata e
  usa aspetto 1: non è un errore, il sito continua.
- Il credito all'illustratore compare sotto al titolo nel pannello. Le copertine
  sono degli editori: vedi la sezione Crediti nel README.

## Estetica (vincoli fissi)

- Legno caldo, luce da lampada, ottone. `--void #100d0b`, `--ink #f6ecdd`,
  `--amber #e8b25f` (interattivi), `--rust #c2562f` (etichette).
- Font: **Bebas Neue** per titoli e numeri, **Inter** per il testo. Sono anche i
  font disegnati su canvas, quindi `document.fonts.ready` va aspettato **prima**
  di generare le texture, se no i titoli escono con il ripiego. Stanno in
  `fonts/`, dichiarati con `@font-face` in cima al CSS.

## Stato attuale

- Le **recensioni sono lorem ipsum**, in `js/data.js`. Da riempire.
- Nel repo ci sono due giochi, Root e Scythe, con le copertine vere. Tre per
  scaffale; l'armadio cresce da solo aggiungendone.
- **L'API di BGG non si chiama dal browser**, ed è una scelta: dal 2025 richiede
  registrazione, token `Authorization: Bearer` (senza, è `401` secco) e le
  condizioni dicono di chiamarla da server. Passa tutto da `tools/bgg-proxy.mjs`,
  che gira in locale e tiene lui il token. **Un token approvato ancora non c'è**:
  finché non arriva, la ricerca risponde 401 e resta il modulo a mano.
- Remote: `https://github.com/Samuel-Ricco/Boardgames.git`, branch `main`.
  L'auth passa dal Git Credential Manager, `gh` non è installato.
