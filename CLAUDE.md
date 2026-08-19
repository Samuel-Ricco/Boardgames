# il dado è trap — note di progetto (ramo `libreria`)

Sito di recensioni di giochi da tavolo. **Il sito è una libreria a cubi in 3D**,
una KALLAX: la camera si avvicina all'avvio, una scatola per cubo, cliccandone
una esce, si apre e mostra la recensione. Niente build, niente dipendenze.

Questo ramo è la variante «libreria» del progetto: su `main` il mobile è un
armadio con le ante e la scena è notturna.

## Dove sta cosa

Due cartelle affiancate, **un solo repository**. Entrambe sotto
`C:/Users/Windows/_Claude/`:

| cartella | ramo | com'è il mobile |
|---|---|---|
| `dado-e-trap` | `main` | armadio con le ante, scena notturna |
| `new_dado-e-trap` | `libreria` | **libreria a cubi, stanza chiara** — si lavora qui |

Remote: <https://github.com/Samuel-Ricco/Boardgames.git>. L'auth passa dal Git
Credential Manager, `gh` non è installato. Pubblicato su GitHub Pages a
<https://samuel-ricco.github.io/Boardgames/>, che serve `main` — quindi online si
vede ancora l'armadio.

Server locale: `python -m http.server 8124 --directory <cartella>`. **La porta
8124 non è casuale**: è l'unica autorizzata nei Redirect URLs di Supabase, e su
altre porte il login parte, va su Google e non riesce a tornare indietro. E non
puo' essere la **8125**, che e' del proxy BGG: si pesterebbero i piedi.

```
index.html            markup
css/style.css         stile
js/data.js            i giochi committati: il seme della libreria
js/config.js          url e chiave pubblica di Supabase
js/auth.js            accesso con Google, e "sono admin?"
js/store.js           la libreria: database, copia locale, ordinamenti
js/bgg.js             ricerca BGG (passa dal proxy locale)
js/catalogo.js        due fonti per le schede: BGG col token, Wikidata senza
js/art.js             grafica generata su canvas
js/app.js             scena 3D e interazione
img/                  le copertine vere delle scatole
fonts/                Bebas Neue e Inter in locale
vendor/                three.js r152 e supabase-js, committati
supabase/migrations/   lo schema del database
tools/bgg-*.mjs        scarico dati BGG e proxy per la ricerca admin
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
- il browser dell'anteprima **tiene in cache il CSS e non lo rilegge**, nemmeno
  con `location.reload(true)`: una regola nuova può essere sul disco, essere
  servita dal server, e non essere nel foglio caricato. Se una modifica di stile
  «non fa niente», confrontare `fetch('css/style.css')` con `document.styleSheets`
  prima di cercare il bug altrove;
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

## Libreria a cubi

- Misure di una KALLAX vera: **cubo da 33 cm, montanti da 3.8, profondità 39**.
  Il cubo da 33 e la scatola da 30 è il motivo per cui mezzo mondo ci tiene i
  giochi da tavolo: ci entra esatta, 1.5 cm di aria per lato.
- **Una scatola per cubo, e una libreria è sempre 3 × 4**: dodici cubi, dodici
  giochi (`COLS`, `RIGHE`, `PER_LIB`). Non cambia col formato dello schermo e non
  si allunga con la collezione — è un mobile vero, e un mobile vero non cresce.
- **Finiti i dodici posti si mette accanto un'altra libreria identica**, e ci si
  arriva **scorrendo in orizzontale**. La collezione cresce lungo la parete
  invece che verso il basso, e ogni schermata inquadra un mobile intero: niente
  file tagliate a metà, e nessun numero di colonne che cambia sotto le mani a chi
  gira il telefono.
- Quante librerie: `max(1, ceil((n + 1) / 12))`. Il `+ 1` fa comparire una
  libreria vuota accanto quando l'ultima è piena, così si vede che c'è dove
  mettere il prossimo gioco.
- `PASSO_LIB` = larghezza del mobile (11.42) + `STACCO` (2.6). Attaccate
  sembrerebbero un unico mobile lungo e lo scorrimento non si leggerebbe: è
  l'aria in mezzo a dire «questa è un'altra libreria».
- **Tre colonne su schermo verticale hanno un prezzo, ed è scelto.** Il mobile è
  più alto che largo (11.4 × 15.1): per far stare la larghezza su un telefono la
  camera arretra e sopra e sotto avanza stanza. È il rapporto fra le due misure,
  non un difetto — e vale meno di una griglia che si riconfigura da sola.
- Con **una libreria sola** non c'è niente da scorrere: `state.tuttaVisibile`
  mette `body.ferma`, che nasconde il binario e fa scendere il suggerimento a
  fondo pagina.
- **Il mobile si costruisce a montanti e ripiani passanti**, non a cubi separati:
  stessi pixel, un quarto dei triangoli e nessuna giunzione visibile.
- **Niente ante**: l'ingresso è un solo avvicinamento, dalla stanza alla prima
  libreria.
- Gli oggetti di contorno riempiono i cubi vuoti con un rumore **ripetibile**
  (`srnd`), se no a ogni riordino saltavano da un cubo all'altro. Il seme è
  l'indice **assoluto** del posto, così i cubi vuoti della terza libreria non
  copiano quelli della prima.
- **Le luci seguono la camera.** Le quattro luci di fila e la direzionale si
  spostano in x a ogni frame, invece di essercene un gruppo per libreria: le
  librerie possono diventare tante. Ma soprattutto il riquadro d'ombra della
  direzionale è largo quanto una libreria — lasciato fermo all'origine, dalla
  seconda in poi le ombre sparivano di colpo.
- **La stanza si allunga con le librerie** (`stanzaLarga()`): pavimento e parete
  sono larghi 1 e vengono stirati, con la ripetizione della venatura riscalata di
  conseguenza, se no il legno si stira.

## Cercare e contare

- `LIB.list(ordine, testo)` è l'unico punto in cui si decide **quali** giochi
  esistono e in che ordine. In `app.js` ci passa `lista()`: tutto quello che
  dispone scatole deve chiamare quella, se no la posizione sullo scaffale e
  quella nell'elenco non coincidono più (`goToGame` sbagliava libreria).
- Il testo viene **appiattito** prima del confronto — minuscolo, senza segni
  diacritici — e tutte le parole scritte devono comparire: due parole
  restringono, non allargano.
- **Cercare cambia quali scatole ci sono**, non quali sono in evidenza: una
  ricerca è una libreria con dentro i risultati. Si torna alla prima libreria,
  se no restando fermi sulla terza ci si ritrova davanti a un mobile vuoto.
- **Mentre si cerca i cubi vuoti restano vuoti**: riempirli di libri e dadi fa
  sembrare lo scaffale pieno e i risultati non si distinguono dal contorno.
- Il contatore dice «N di M» mentre si cerca. Solo «N» e il numero che cala
  sembrerebbe che i giochi siano spariti.
- `ridisponi()` esiste perché **non si può rifare la disposizione con una scatola
  aperta**: la si sposterebbe sotto i piedi al tween in corso. Se c'è, chiude e
  ridispone dopo, con il seguito passato a `unfocus(poi)`.

## Luce e colori

La stanza è chiara: emisferica + ambiente fanno il grosso, una direzionale larga
quasi frontale fa la forma e le ombre. **Attenzione a non esagerare**: la prima
versione aveva emisferica 1.15 e ambiente 0.45 e la scena usciva slavata, media
214/255 con tutto fra 205 e 237. Si misura leggendo i pixel, non a occhio.

`--bg` nel CSS deve restare **uguale** a `SFONDO` in `js/app.js`: è la stessa
tinta a tenere insieme caricamento, cancello e mondo dietro.

## Vedere la scena quando l'anteprima non compone

Il pannello a volte non disegna frame: niente screenshot, e senza frame anche le
animazioni restano ferme. Si aggira così:

1. si fa avanzare `frame()` a mano con un orologio finto **monotono**;
2. si leggono i pixel dal contesto WebGL con `gl.readPixels` (capovolti);
3. si spediscono a `tools/ricevi-fotogramma.mjs`, che li scrive su disco.

Serve anche a misurare la luce invece di indovinarla.

## Admin

- **Il ruolo lo decide il database**, non l'interfaccia: `e_admin()` su Postgres.
  Senza backend configurato resta l'interruttore locale di prima, che però non
  protegge niente ed è dichiarato tale nella schermata iniziale.
- Con Supabase le modifiche vanno nel database e le vedono tutti; senza, restano
  in `localStorage` e si pubblicano con `esporta js/data.js`.
- **`crossOrigin='anonymous'` sulle copertine di un altro dominio**, e prima di
  `src`. Quelle caricate stanno su Supabase e finiscono in una texture WebGL:
  senza, l'immagine si carica benissimo in un `<img>` ma la texture resta vuota
  con `SecurityError: ... contains cross-origin data`. Si vedeva **solo uscendo e
  rientrando**, perché appena aggiunto un gioco `cover` è ancora un data URL e il
  problema non esiste. Per verificarlo: disegnare l'immagine su un canvas e
  chiamare `getImageData` — se è contaminata lancia, ed è lo stesso controllo che
  fa WebGL.
- **Mai salvare `img` nella libreria**: è l'immagine decodificata, in JSON diventa
  `{}` e al ricaricamento sembra una copertina valida senza esserlo. Le proporzioni
  della scatola finivano a NaN e le scatole sparivano dalla scena. `save()` lo
  toglie, `loadCovers()` verifica `naturalWidth`.
- Le conferme sono **in due tempi sul bottone**, non `window.confirm`: quello
  blocca il rendering, e una finestra di sistema in mezzo a una scena 3D stona.

## In verticale non si muove più niente

`KAL.topY` è una costante e le file sono quattro e basta, quindi `SUOLO` viene
zero per costruzione e il pavimento ci resta. Con questo se n'è andato tutto il
codice che faceva scendere stanza e mobile insieme mentre la collezione si
allungava: `groundY()`, `FACCIATA`, il `floorMesh.position.y` dentro
`buildCabinet`.

Vale la pena ricordarsi perché c'era. Ancorata **in basso**, com'era all'inizio,
aggiungere giochi allungava la libreria verso l'alto, l'intro doveva allontanarsi
per farcela stare, e il mobile rimpiccioliva a ogni gioco aggiunto. Ancorandola
in alto il problema spariva ma restava il pavimento che scendeva. Col formato
fisso non c'è più né l'uno né l'altro.

## Il responsive è geometrico, non solo CSS

Il mobile **non si adatta più allo schermo**: è lo schermo a farsi indietro
finché i dodici cubi ci stanno tutti. `layout()` calcola `state.distShelf` dal
vincolo più stretto fra altezza e larghezza, con un margine che si stringe sui
formati alti e stretti — lì comanda la larghezza, e ogni decimo di margine si
paga in stanza vuota sopra e sotto il mobile.

Resta responsive quello che deve esserlo: `state.side` (il pannello di lato sopra
gli 880 px, dal basso sotto) e le frazioni di quadro di `focusPose()`.

## Inquadratura (la parte che è costata di più)

Niente numeri fissi: la distanza della camera esce dall'ingombro del mobile e dal
formato dello schermo, e la posizione della scatola in primo piano è espressa in
**frazioni di quadro**.

- La misura si prende sul **fronte del mobile** (`z = KAL.front`), non sul suo
  centro: è quello il piano che deve stare nello schermo.
- La camera si muove **solo in orizzontale**: `camXFor(s) = s * PASSO_LIB`, e la
  quota è la costante `CENTRO_Y`. Anche `focusPose()` lavora in coordinate della
  libreria corrente — se no la scatola usciva davanti alla prima mentre si stava
  guardando la terza.
- `focusPose()` prende il **vincolo più stretto fra altezza e larghezza**: con la
  sola altezza, su una finestra stretta la scatola usciva dal quadro a sinistra.
- **La scatola aperta sta a una z fissa davanti al mobile** (`FOCUS_Z`) ed è la
  **camera ad arretrare** di quanto serve. Prima era il contrario — la scatola
  veniva messa a `camera − distanza` — e con la camera vicina ai cubi quella
  distanza la spingeva *dietro* al fronte: si apriva compenetrata nel ripiano.
- A `resize` con una scatola aperta va richiamato `reposeFocused()`: cambia il
  rapporto d'aspetto e, sotto gli 880 px, anche il lato da cui esce il pannello.
- L'ingombro usato per il calcolo è **più grande della scatola chiusa** (×1.24 e
  ×1.34): il coperchio si alza e viene avanti, quindi occupa più spazio di quanto
  misuri.
- Le frazioni ricalcano il **breakpoint del CSS a 880 px** (`state.side`): sopra,
  il pannello si apre di lato e la scatola sta a sinistra; sotto, il pannello sale
  dal basso e la scatola sta in alto.

## Altre cose imparate a caro prezzo

- **Il coperchio si alza più che avvicinarsi.** Venendo verso la camera ingrandiva
  di colpo e usciva dal quadro: ora fa 0.95 in avanti e 1.05 in su.
- **`crossOrigin='anonymous'` sulle copertine di un altro dominio**, e prima di
  `src`. Quelle caricate stanno su Supabase e finiscono in una texture WebGL:
  senza, l'immagine si carica benissimo in un `<img>` ma la texture resta vuota
  con `SecurityError: contains cross-origin data`. Si vedeva **solo uscendo e
  rientrando**, perché appena aggiunto un gioco `cover` è ancora un data URL.
  Per verificarlo: disegnare l'immagine su un canvas e chiamare `getImageData` —
  se è contaminata lancia, ed è lo stesso controllo che fa WebGL.
- **Le immagini di Wikimedia vanno chieste all'API di Commons** (`imageinfo` con
  `iiurlwidth`), mai da `Special:FilePath`: quello risponde con un **redirect**, e
  in una richiesta CORS ogni passaggio della catena deve avere l'header —
  l'intermedio non ce l'ha e il browser blocca. Con `curl` non si vede, perché
  guarda solo la risposta finale. Le larghezze sono un elenco fisso: 900 dà `400`,
  l'API arrotonda a 960.
- **Mai salvare `img` nella libreria**: è l'immagine decodificata, in JSON diventa
  `{}` e al ricaricamento sembra una copertina valida senza esserlo. Le
  proporzioni della scatola finivano a NaN e le scatole sparivano.
- `#scene` ha **`touch-action:none`**: se no il browser legge il trascinamento
  come scroll e annulla i pointer event.
- Un **clic** è un `pointerup` entro 600 ms e 9 px dal `pointerdown`: senza questo
  controllo, trascinare per guardarsi intorno apriva una scatola.
- Il passo delle animazioni è **forzato positivo e corto**: un `dt` negativo le
  farebbe girare all'indietro, uno lungo le farebbe saltare alla fine.

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

## Il backend (Supabase)

Progetto `stslddkkzqonauavgxuy`, URL e chiave **publishable** committati in
`js/config.js` — sono pubbliche per progetto, a proteggere i dati sono le regole
in `supabase/migrations/`. La chiave `sb_secret_` non deve mai entrare nel repo.

- **Il ruolo lo decide il database.** `AUTH.eAdmin()` chiama `e_admin()` su
  Postgres, che guarda la tabella `admin` — l'unica senza policy di scrittura,
  quindi nessuno può promuoversi. Si aggiunge un admin solo dal Table Editor.
- **`js/store.js` resta l'unico file che sa dove vivono i dati.** `all/list/add/
  remove` sono rimaste **sincrone**: `sync()` riempie la cache una volta
  all'avvio e le scritture partono in background, così la scena 3D non sa nemmeno
  che esiste un database.
- **Scritture ottimiste**: la scatola compare subito, e se Postgres rifiuta torna
  indietro con il motivo. Un `42501` non è un guasto, è RLS che fa il suo lavoro.
- **`GRANT` e RLS sono due cose diverse** e servono entrambe: il primo dice se un
  ruolo può rivolgersi alla tabella, la seconda quali righe ottiene. Le tabelle
  nuove in `public` non sono più esposte in automatico, quindi ogni tabella nuova
  vuole il suo `grant`, se no torna `permission denied` e sembra un errore di
  policy.
- **Le copertine caricate vanno nel bucket `copertine`**, non nella colonna come
  data URL: in una libreria condivisa gonfierebbero la riga per tutti. Niente
  `upsert`, perché sullo storage gli admin hanno insert e delete ma non update.
- **Tre sorgenti in ordine**: database → copia in `localStorage` → `js/data.js`.
  L'armadio si apre anche a rete staccata.

## Supabase, in concreto

Progetto `stslddkkzqonauavgxuy`. URL e chiave **publishable** stanno committati in
`js/config.js`: sono pubbliche per progetto, a proteggere i dati sono le regole in
`supabase/migrations/`. La chiave `sb_secret_` non deve **mai** entrare nel repo.

Cos'è già fatto e verificato:

- tre migrazioni applicate: schema iniziale, percorsi delle copertine locali,
  **collezioni personali**;
- accesso con Google configurato su entrambi i pannelli (client OAuth sotto
  l'account `admin@smlrcc.it`), Site URL e Redirect URLs a posto;
- l'admin è nella tabella `admin`, UID `c33cca27-b28b-48b6-9384-cd126932b653`.

Per aggiungere un admin **si passa solo dal Table Editor**: sulla tabella `admin`
non esiste nessuna regola di scrittura, quindi nessun account può promuovere sé
stesso o altri. Non è una scomodità, è la garanzia.

Da sapere: il piano gratuito **mette in pausa il progetto** dopo circa una
settimana senza traffico, e si riattiva a mano dal pannello.

## Stato attuale

Funziona ed è collaudato end-to-end sul progetto vero (2026-08-19): accesso con
Google, ruolo letto dal server, aggiunta, **modifica** (scheda e recensione),
rimozione, copertine caricate nel bucket. Verificato rileggendo il database
dall'esterno, non dalla cache del browser.

Cosa manca, in ordine di fastidio:

1. **Le recensioni sono lorem ipsum.** Ora si scrivono dal sito, con *modifica*.
2. **Il token BGG non è ancora arrivato.** Finché non c'è, la ricerca cade su
   Wikidata: ~4.400 giochi contro 175.000, dati più magri e a volte sbagliati
   (l'editore è spesso il distributore locale). Per questo un risultato **riempie
   il modulo** invece di finire dritto sullo scaffale.
3. **Wikidata non ha le copertine, e non le avrà mai**: le sue immagini vengono da
   Wikimedia Commons, che accetta solo licenze libere, e la grafica di una scatola
   è protetta. Su 4.445 giochi, 597 hanno una qualche immagine (13%) e sono foto
   di partite sul tavolo. Per le copertine c'è il **campo file** nel modulo, che
   vince sempre sull'immagine della fonte — la fonte giusta è il press kit
   dell'editore.
4. **L'ingresso come ospite è stato tolto**: tornerà quando avrà i giochi del
   momento da mostrare. Oggi il sito è un muro di login per chi non ha un account.
5. Su telefono la scatola è **90 px di larghezza**: si riconosce la copertina ma
   non si legge il titolo. È il prezzo delle tre colonne; se dà fastidio,
   l'alternativa è tornare a due.

Prossimi passi già discussi, non ancora fatti:

- **Edge function per BGG** al posto del proxy locale: il token starebbe sul
  server, la ricerca funzionerebbe da qualunque browser senza accendere niente, ed
  è anche ciò che le condizioni di BGG chiedono.
- **App Android/iOS**: la strada è Capacitor, che imbarca questi stessi file. Da
  fare *dopo* i contenuti veri, perché Apple rifiuta le app che sembrano solo un
  sito (linea guida 4.2). Serve anche safe-area (`env(safe-area-inset-*)`, oggi
  non usata), gestione del tasto indietro, e un livello di qualità più leggero.
