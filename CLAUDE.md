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
js/store.js           la libreria: database, copia locale, ordinamenti, ricerca
js/recensioni.js      le recensioni del sito: pubbliche, lette anche dall'ospite
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

## Ordinare a mano

Quattro ordinamenti: **il mio**, data di aggiunta, nome, voto. I primi tre si
calcolano, il quarto no — e infatti è l'unico che ha bisogno di una colonna.

- `posizione` sul database (migrazione `ordine_manuale`), `pos` in memoria: il
  posto sullo scaffale contato da zero, **denso**. Uno scambio fra due scatole
  tocca due righe, non tutta la collezione, ed è il motivo per cui lo scambio è
  stato preferito all'inserimento.
- **Nullo vuol dire «mai spostato»** e va in fondo. Alla prima mossa manuale
  ricevono tutti una posizione, **nell'ordine in cui erano in quel momento sullo
  schermo**: chi sposta una scatola stando in ordine alfabetico non si ritrova la
  libreria rimescolata, si ritrova quello che vedeva più la mossa che ha fatto.
- Un gioco appena aggiunto non ha posizione, quindi in ordine manuale compare in
  fondo. È giusto così: è dove lo si è messo.

### Il gesto

- **Si tiene premuto, non si trascina e basta** (`PRESA_MS`, 330 ms). La libreria
  riempie lo schermo, quindi quasi ogni gesto comincia sopra una scatola: senza
  la pausa, prendere una scatola e scorrere fra le librerie sarebbero lo stesso
  movimento e non si potrebbe più fare né l'uno né l'altro.
- Premere e lasciare **senza muoversi** apre la scatola, anche se la presa era
  già scattata: chi tiene premuto un attimo di troppo voleva aprirla.
- **Due piani, non uno.** La scatola in mano sta su un piano davanti al mobile
  (`PRESA_Z`) così resta sotto al dito senza parallasse; il cubo di destinazione
  si legge invece sul piano dei cubi, che è dove il dito sta davvero indicando.
  Con un piano solo, a bordo schermo la scatola è fuori di quasi un terzo.
- `slotDa(x, y)` è l'inverso di `cubX`/`rigaY`: nessun raycast sui vani.
- **Lasciarla in un cubo vuoto la manda in fondo**, che è l'altra cosa che si
  vuole davvero fare. Il segnaposto ambrato (`alone`) ha `depthWrite:false`: è un
  velo, e senza, la scatola che ci passa davanti veniva ritagliata.
- **Mentre si cerca non si sposta niente**: l'ordine sullo schermo è un
  sottoinsieme, e riordinarlo lascerebbe tutti gli altri dove capita.
- `applyLibrary` salta la scatola in mano. Un `resize` in mezzo a uno spostamento
  gliela riportava a casa da sotto le dita.

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

## Le due sezioni

`state.sezione`: `collezione` (la libreria 3D) o `catalogo`. Non sono due pagine,
sono due modi di guardare: la testata resta la stessa e cambia solo cosa c'è
sotto. Il catalogo sta a **z2** — sopra la scena, sotto la barra in alto.

- Nel catalogo il ciclo di rendering **continua a girare ma non disegna**
  (`if (state.sezione === 'catalogo') return;` dopo `stepAnims`). Il ciclo non si
  è mai fermato e non si ferma adesso; quello che si evita è disegnare una scena
  coperta, e soprattutto fare un raycast per fotogramma mentre l'utente sta
  scorrendo tutt'altro.
- Nel catalogo spariscono gli strumenti della collezione: il campo di ricerca è
  un altro e il contatore conta i giochi tuoi.

## Il catalogo

Un **elenco piatto**, fuori dalla scena 3D apposta. La libreria in tre dimensioni
è la tua collezione, una cosa da guardare; il catalogo sono migliaia di titoli da
scorrere, e per quello un elenco batte qualunque mobile.

- La recensione si apre **dentro la riga**, non in una finestra sopra: in un
  catalogo il posto in cui si era è metà di quello che si sta facendo.
- **Un solo ascoltatore** sull'elenco, con `closest()`: le righe si rifanno a ogni
  pagina e attaccarne uno per riga vorrebbe dire rimetterli ogni volta.
- Le pagine si **aggiungono in coda** (`insertAdjacentHTML`), non si ridisegna
  tutto: rifare l'`innerHTML` fa ricominciare il caricamento di tutte le
  miniature già a schermo.

### Sfogliare, che non è cercare

`CATALOGO.sfoglia(offset, limite)`. Il catalogo si apre su un elenco, non su un
campo vuoto: chi arriva senza sapere cosa cercare deve avere qualcosa da guardare.

- L'ordine è `wikibase:sitelinks`, il numero di edizioni linguistiche della voce:
  è l'unico segnale di notorietà che Wikidata offra. In cima mette i classici —
  scacchi, Monopoly, backgammon — perché è davvero quello che il mondo conosce.
- **L'id BGG (P2339) è richiesto, non opzionale.** Serve a puntare la scheda vera,
  ma soprattutto tiene fuori quello che Wikidata classifica sotto «gioco da
  tavolo» senza esserlo: restano **3.429** titoli sui 4.445.
- **Due query, non una.** Prendere elenco ordinato e dettagli insieme vuol dire
  mettere dieci `OPTIONAL` dentro una `ORDER BY` su migliaia di righe: il servizio
  ci mette troppo o va in timeout. Prima gli identificativi (~1,2 s), poi i
  dettagli di quei ventiquattro.
- `ORDER BY DESC(?n) ?g`, con lo spareggio. Senza, a parità di sitelinks l'ordine
  non è garantito e sfogliando una pagina dopo l'altra gli stessi giochi
  ricomparivano.
- **Un ritentativo sui 5xx, e uno solo.** WDQS è pubblico e sotto carico chiude
  con 502 anche query che un secondo dopo funzionano — è capitato in prova.
  Insistere di più non aiuta, e in un elenco che si sfoglia aspettare mezzo
  minuto per un errore è peggio che leggerlo subito.

### Le miniature sono un caso diverso dalle copertine

Nell'elenco l'immagine finisce in un `<img>` e basta, quindi **`Special:FilePath`
va benissimo**: il redirect non dà fastidio perché non è una richiesta CORS e non
deve entrare in nessuna texture. Il giro dall'API di Commons serve solo quando
l'immagine va *letta* davvero, cioè quando il gioco entra in libreria — ed è
quello che continua a fare `copertina()`.

È anche l'unica deroga a «niente risorse esterne, mai», ed è dichiarata nel
README: un catalogo di migliaia di giochi non si committa, e senza rete non c'è —
mentre la libreria continua a esserci.

## Le recensioni sono del gioco, non della tua copia

`js/recensioni.js` + tabella `recensioni`. Prima la recensione era una colonna
della riga in `giochi`, cioè una proprietà della **copia** di quel gioco dentro
una collezione personale. Va bene per gli appunti; non va bene per un sito di
recensioni, dove la recensione è del gioco e la legge chiunque — anche chi non ha
account e non ha nessuna collezione.

- **La chiave è l'id BGG.** È l'unico identificativo di un gioco da tavolo su cui
  il mondo si sia messo d'accordo, ed è quel numero a tenere insieme il catalogo
  (che viene da fuori) e le recensioni (che sono nostre). Un gioco senza id BGG
  non si pubblica, e l'interfaccia lo dice.
- **Non si copia la scheda del gioco.** Autore, editore, durata arrivano dalla
  fonte quando la riga viene mostrata: copiarli vorrebbe dire tenerli aggiornati
  a mano per sempre.
- **Una lettura sola per sessione**, in una mappa `bgg -> recensione`, perché il
  catalogo le interroga una riga per volta mentre scorre. `di()` è sincrona
  apposta.
- Qui `admin` conta **davvero**: sulle collezioni personali non dà nessun potere
  in più (ognuno comanda sulla sua), ma il catalogo è uno solo e le recensioni
  sono la voce del sito.
- Si pubblica dalla casella nel modulo di modifica, **dopo** il salvataggio in
  libreria: si pubblica quello che si è scritto, non quello che si sta per
  scrivere. Se il database dice di no il gioco resta comunque sullo scaffale —
  pubblicare è un'altra cosa dall'averlo.
- Tutto degrada in silenzio: senza tabella, `di()` risponde `null` e il catalogo
  dice «non ancora recensito», che è vero e non è un guasto.

## L'ospite

Il cancello risponde `'entra'` o `'ospite'`, e `boot()` prende due strade diverse
davvero: **per l'ospite non si costruisce nessuna scena 3D**. Non è una
scorciatoia — non ha nessuna collezione, quindi non c'è niente da costruire, e
montare la libreria per coprirla subito dopo sarebbe mezzo secondo di lavoro
buttato e un mobile che non è di nessuno in mezzo allo schermo.

`body.ospite` nasconde la voce «collezione» dalla navigazione: portare a una
libreria vuota sarebbe una promessa che il sito non può mantenere. Il chip in
alto a destra dice «entra» e funziona.

Per **provare la strada dell'ospite senza sloggare l'utente**: si parcheggia la
chiave `sb-<progetto>-auth-token` di `localStorage` in un'altra chiave, si
ricarica, si prova, e poi la si rimette. `AUTH.esci()` no — quello invalida il
refresh token sul server e tocca rifare l'accesso da Google.

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

0. **Due migrazioni sono nel repo ma non applicate al progetto.** Sono l'unica
   cosa che separa quello che si vede dal funzionare per intero:
   - `ordine_manuale` → finché manca, l'ordine manuale funziona sullo schermo e
     resta in `localStorage`, ma il server lo rifiuta con «manca la colonna
     posizione», e da un altro dispositivo si vede l'ordine di prima;
   - `recensioni_pubbliche` → finché manca, il catalogo si sfoglia e si cerca ma
     **nessuna recensione si legge**, e il messaggio in cima lo dice.

   Si applicano dallo SQL Editor del progetto, in ordine di nome. Entrambe sono
   idempotenti (`if not exists`, `drop policy if exists`).
1. **Le recensioni sono lorem ipsum.** Ora si scrivono dal sito con *modifica*, e
   da lì si pubblicano nel catalogo con la casella in fondo al modulo.
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
4. **L'ordine del catalogo è quello di Wikidata**, cioè i classici in cima:
   scacchi, backgammon, Monopoly. Non è la classifica che un sito di recensioni
   vuole — quella è la lista di BGG, e arriva col token.
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
