# il dado è trap — note di progetto (ramo `libreria`)

Sito di recensioni di giochi da tavolo. **Il sito è una libreria a cubi in 3D**,
una KALLAX: la camera si avvicina all'avvio, una scatola per cubo, cliccandone
una esce, si apre e mostra la recensione. Niente build, niente dipendenze.

Questo ramo è la variante «libreria» del progetto: su `main` il mobile è un
armadio con le ante e la scena è notturna.

Accanto a questo file c'è **`contest_boardgame.md`**: racconta *cosa è successo*
— le decisioni prese e da chi, i difetti trovati verificando, lo stato dei dati
e cosa resta aperto. Questo file racconta *com'è fatto* il sito. Si leggono nei
due ordini a seconda di cosa serve, ma dopo un contesto perso conviene questo.

## Dove sta cosa

Due cartelle affiancate, **un solo repository**. Entrambe sotto
`C:/Users/Windows/_Claude/`:

| cartella | ramo | cos'è |
|---|---|---|
| `new_dado-e-trap` | `libreria` | **si lavora qui** |
| `dado-e-trap` | `main` | vecchia copia dell'armadio: è rimasta indietro |

**Dal 2026-08-20 `main` è la libreria a cubi.** Il ramo `libreria` è stato
portato su `main` in avanzamento lineare — non c'era divergenza, `main` non aveva
un solo commit che `libreria` non avesse già — e da allora i due rami puntano
allo stesso commit. L'armadio con le ante e la scena notturna non sono più da
nessuna parte se non nella storia.

La cartella `dado-e-trap` ha ancora la copia vecchia nel suo working tree: se
serve, va aggiornata con un `git pull`. Oppure si butta: non ci lavora nessuno.

Remote: <https://github.com/Samuel-Ricco/Boardgames.git>. L'auth passa dal Git
Credential Manager, `gh` non è installato. Pubblicato su GitHub Pages a
<https://samuel-ricco.github.io/Boardgames/>, che serve `main`.

**Perché online l'accesso con Google può non funzionare:** i Redirect URLs di
Supabase autorizzano `http://localhost:8124`. L'indirizzo di GitHub Pages va
aggiunto lì, se no il login parte, arriva a Google e non riesce a tornare
indietro — esattamente come su una porta sbagliata in locale.

Server locale: `python -m http.server 8124 --directory <cartella>`. **La porta
8124 non è casuale**: è l'unica autorizzata nei Redirect URLs di Supabase. E non
puo' essere la **8125**, che e' del proxy BGG: si pesterebbero i piedi.

```
index.html            markup
css/style.css         stile
js/data.js            i giochi committati: il seme della libreria
js/config.js          url e chiave pubblica di Supabase
js/auth.js            accesso con Google, e "sono admin?"
js/store.js           la libreria: database, copia locale, ordinamenti, ricerca
js/recensioni.js      le recensioni del sito: pubbliche, lette anche dall'ospite
js/profilo.js         nick, faccia, codice amico, amicizie
js/partite.js         giocatori salvati e partite giocate
js/stanza.js          luce, colori e arredi scelti da chi ci abita
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

## La libreria è una vetrina, l'elenco è la collezione

`libreria` nulla vuol dire **«ce l'ho ma non è in mostra»**. Sugli scaffali va
solo quello che si sceglie (`listaScaffale()`), e l'elenco resta il posto dove
c'è tutto. È anche l'unica risposta sensata a una collezione da duecento giochi,
che in diciassette mobili non la guarda nessuno.

- **Uscire dallo scaffale e sparire dalla collezione sono due gesti diversi**, e
  nel pannello della recensione hanno due pulsanti: *dallo scaffale* è
  reversibile in un clic dall'elenco e non chiede niente; *elimina* butta via il
  gioco, resta rosso e resta in due tempi. Prima si chiamavano tutti e due
  «togli», cioè il gesto innocuo e quello irreversibile avevano lo stesso nome e
  lo stesso posto.
- Si mette e si toglie anche **dall'elenco**, ed è lì che si sceglie in quale mobile:
  è il senso di avere più librerie. Con un mobile solo non c'è niente da
  scegliere e si fa e basta; con più di uno il pulsante si apre nei nomi, sul
  posto — una finestra di scelta per un gesto da un clic sarebbe sproporzionata.
- I mobili **esistono anche vuoti**: sono mobili, non contenitori che compaiono
  quando servono. Per questo `libs` parte da `librerie.length + 1` anche negli
  ordinamenti calcolati.
- Un gioco appena aggiunto va in vetrina, nel mobile che si sta guardando: si è
  appena scelto di averlo, lo si vuole vedere.

## Rinominare vuole una conferma

Salvare all'uscita dal campo faceva partire una scrittura anche a chi ci
cliccava dentro per sbaglio, e soprattutto **non si capiva se era andata**: il
nome sopra la libreria è l'unica prova, e va aggiornato subito. La spunta si
accende solo se c'è davvero qualcosa da salvare, e dopo il salvataggio si
richiama `buildCabinet()` — la targhetta è dentro il mobile, non nell'interfaccia.

## Trascinare fra due mobili su un telefono

La libreria riempie lo schermo da bordo a bordo: del mobile accanto non si vede
niente, e non c'era modo di portarci una scatola.

- Prendendo una scatola la camera **arretra di un quarto** (`state.zoom`). Poco:
  quello che si sta spostando deve restare grande abbastanza da vedere dove lo
  si mette.
- Avvicinandosi al bordo dello schermo la vista **scorre** verso il mobile
  accanto. Sta nel ciclo di rendering e non in `muoviPresa` perché deve
  continuare **anche a dito fermo**: sul bordo si aspetta, non si sfrega. E
  subito dopo va richiamata `muoviPresa`, perché la scena si è spostata sotto la
  scatola e il cubo mirato non è più quello di un attimo fa.

## Le due viste dell'elenco

`gruppi` divide in cartelle, `tutti i giochi` è l'elenco intero ordinabile con i
soliti criteri. Si passa dall'una all'altra toccando la voce **oppure scorrendo
di lato**, e l'indicatore **segue il dito** invece di saltare alla fine: è quello
che dice che le due viste stanno una accanto all'altra e non sono due schermate
diverse.

- Lo scorrimento si ingaggia **solo quando il movimento è chiaramente
  orizzontale** (|dy| > 10 e maggiore di |dx| annulla tutto): `#mia` scorre in
  verticale, e rubare il gesto a chi sta scendendo nell'elenco è il modo più
  rapido di rendere una pagina inusabile.
- Non si trascina oltre il bordo. Dalla prima vista si va solo verso destra,
  dall'ultima solo verso sinistra: lasciar scorrere dove non c'è niente promette
  una terza schermata che non esiste.
- La soglia è un quinto della larghezza **ma non più di 150 px**: su un monitor
  da 1280 un quinto sono quasi trecento pixel, cioè un gesto che nessuno fa. E un
  **colpo secco** vale comunque, anche se corto — è come si sfoglia col pollice.
- In vista `gruppi` senza nessun gruppo non si mostra un elenco vuoto: si dice
  che da «gestisci gruppi» se ne crea uno.

## Righe compatte, e due aperture invece di una

Nell'elenco una riga mostra **copertina, nome e un tasto a tre righe**, e basta.
Una riga che mostra già tutto obbliga a scorrere per contare i propri giochi.

Le aperture sono **due, distinte**:

- la **riga** apre le informazioni — che gioco è, dove sta, cosa ne pensi, in
  che gruppi è;
- il **tasto a tre righe** apre le azioni — preferito, in libreria, togli, vai
  allo scaffale.

Sono due domande diverse, «che gioco è» e «cosa ci faccio», e mescolarle voleva
dire che per leggere due righe di recensione ti trovavi davanti quattro pulsanti.

- Il contenuto si costruisce **solo quando si apre**: con duecento giochi,
  riempire tutte le schede in anticipo genera duecento blocchi che nessuno
  guarderà.
- Cliccando *dentro* un blocco già aperto non si richiude la riga: se no toccare
  una pastiglia di gruppo faceva sparire quello che si stava guardando.
- **Ogni gruppo è una tendina**, e quale sia aperta se lo ricorda. Si parte
  aperte: un elenco di soli titoli chiusi non fa vedere niente al primo colpo.

## Non ridisegnare la lista sotto il dito

Nell'elenco dei giochi di un gruppo, ogni tocco ridisegnava tutto: il pulsante
appena premuto veniva staccato dal documento e il tocco successivo cadeva su un
nodo che non c'era più — segnandone due di fila, il secondo non arrivava. Si
aggiorna **solo il numero, in posto**. Vale per qualunque elenco su cui si
tocchi più volte di seguito.

## I gruppi sono etichette, non contenitori

Una libreria risponde a «dove sta», un gruppo a «che cos'è»: Root sta nel mobile
del salotto ed è insieme «strategico» e «asimmetrico». Un gioco ne ha quanti ne
vuole, e i gruppi attraversano i mobili.

- **Per questo non si vedono sullo scaffale.** Uno scaffale mostra dove stanno le
  cose; le etichette stanno nella **scheda**, nella riga aperta dell'elenco, e in
  cima all'elenco dove filtrano.
- **Si gestiscono dall'elenco, non dal profilo.** Nel profilo erano lontane dal
  loro uso: i gruppi servono mentre si guarda la propria collezione, ed è lì che
  si decide cosa sta con cosa. «Gestisci gruppi» apre creazione, rinomina e
  l'elenco di chi ci sta dentro. Stessa forma nei due posti, perché sono la
  stessa cosa: chi l'ha capita una volta l'ha capita.
- `giochi_gruppi` ripete `proprietario` apposta: serve alla chiave esterna verso
  `giochi`, che ha chiave `(proprietario, id)`.
- **Creare un gruppo dalla scheda non porta via da dove si è**: la pastiglia
  «+ gruppo» diventa un campo sul posto. Mandare qualcuno in un'altra sezione per
  scrivere una parola e poi farlo tornare indietro è un giro che non serve.
- Assegnare è **ottimista** come il resto: la pastiglia si accende subito, la
  riga parte dietro, e se il database rifiuta si spegne di nuovo.
- Su `insert` un `23505` non è un errore: vuol dire che l'etichetta c'era già,
  cioè esattamente lo stato voluto.
- **Togliere un gruppo non tocca i giochi**: sparisce l'etichetta, non quello che
  era etichettato.
- Il filtro vive in `state.gruppo` e passa da `LIB.list(ordine, testo, gruppo)`,
  come la ricerca: tutto quello che decide *quali giochi esistono* sta in un
  posto solo.

**Non chiamare una variabile locale come una funzione che c'è già.** In
`disegnaGruppiProfilo` una `const quanti = {}` copriva la funzione `quanti()`:
la chiamata più sotto diventava un `TypeError` che interrompeva `apriProfilo()`
a metà, e il sintomo era che **tutti** i contatori del profilo restavano vuoti —
non solo quello dei gruppi. Un'eccezione dentro una funzione chiamata in fila si
porta via tutto quello che viene dopo, e il posto dove si vede il guasto non è
quello dove sta. `disegnaMobili` aveva lo stesso nome per la stessa ragione: lì
non esplodeva perché la funzione non veniva chiamata, ma era una trappola armata.

## Le librerie sono mobili, non conteggi

Fino alla migrazione `stanza_librerie_gruppi` le librerie erano **calcolate** dal
numero di giochi (`ceil((n+1)/12)`) e le posizioni erano dense. Adesso sono
righe in `librerie`: hanno un nome, si creano a mano, e ogni gioco ha
`libreria` + `posto` (0..11). **I buchi sono permessi**, ed è tutto il punto:
un cubo vuoto in mezzo allo scaffale è una scelta di chi lo ha arredato.

- `disposizione(list)` decide dove va ogni scatola e ha **due modi**. In ordine
  manuale la disposizione è un *dato*: (libreria, posto), buchi compresi. Negli
  altri ordinamenti si riempie in sequenza e i posti non contano — un
  ordinamento calcolato che rispettasse i buchi non sarebbe più un ordinamento,
  e tornando a «il mio ordine» si ritrova tutto com'era.
- Chi non ha ancora un posto va nel **primo cubo libero**, non in fondo: i buchi
  esistono proprio perché «dopo tutti» non è l'unico posto possibile.
- `state.libs` è sempre **un mobile in più** di quelli che esistono. Quello di
  scorta è il gesto con cui se ne comincia un altro: trascinandoci dentro una
  scatola, la libreria si crea da sola. Chiedere conferma con un modulo quando
  la scatola è già lì sarebbe una domanda a cui si ha già risposto.
- **Il bersaglio del trascinamento si cerca per CUBO, non per indice.** Da quando
  i posti hanno buchi, il quinto della lista non è più il quinto cubo, e
  `b.userData.cubo` è l'unica cosa che sa dove sta davvero una scatola.
- Cubo occupato → le due si **scambiano**; cubo libero → la scatola ci va e
  quello di partenza **resta vuoto**.
- Chi arriva da un ordine calcolato **fotografa** prima la disposizione che
  vedeva sullo schermo, poi applica la mossa: si parte da quello che c'era, non
  da un rimescolamento.
- **Togliere un mobile non butta via i giochi**: la chiave esterna è
  `on delete set null`, restano senza posto e rifluiscono nei cubi liberi.
- Il nome della libreria sta **sul binario in basso**, che è dove uno guarda per
  sapere dove si trova, ed è anche la porta del pannello dei mobili. Con una
  libreria sola sparisce la barra ma **non il nome**: se no non ci sarebbe modo
  di crearne una seconda.

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

## La libreria come elenco

Lo scaffale in 3D è bello da guardare e pessimo da consultare: dodici scatole per
schermata, i titoli piccoli, e per sapere se un gioco ce l'hai già devi scorrere
i mobili. `#mia` è la stessa collezione in una riga per gioco, con le stesse
classi `.righe` del catalogo.

- **Ci si arriva dal contatore**, che diventa un pulsante. È già il posto dove
  uno guarda per sapere quanti sono, e a 390 px la testata non aveva spazio per
  un pulsante in più.
- «Sullo scaffale» chiude l'elenco, porta la camera alla libreria giusta e apre
  la scatola **solo quando è arrivata**: aprendola subito, l'animazione di
  apertura e quella dello scorrimento si contendono l'inquadratura.
- Funziona anche in casa di un amico: l'occhiello dice «la libreria di X».

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
- **Una richiesta nuova supera quella in corso**, non aspetta e non viene
  ignorata (`catGiro`). Le query a Wikidata durano un paio di secondi buoni, e in
  quel tempo si fa in fretta a premere «cerca» — è il primo gesto di chiunque
  apra il catalogo sapendo già cosa vuole. Prima quella ricerca spariva nel
  vuoto. Ogni richiesta prende un numero e la risposta controlla di essere ancora
  l'ultima chiesta, se no si butta via da sola. L'unica eccezione è «altri
  giochi»: due clic salterebbero una pagina, e infatti il pulsante intanto è
  spento.
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

## Profilo e amici

La prima parte del sito che non parla di giochi ma di chi li gioca.

- **`nick` e `codice` fanno due mestieri diversi apposta.** Il nick ti fa
  *riconoscere* e lo vede chiunque ti incontri; il codice ti fa *trovare* e lo
  dai a chi vuoi tu.
- **RLS filtra le righe, non le colonne.** Questo è costato un difetto vero:
  leggere il profilo di un amico — che serve, per il nick e la faccia — apriva
  la riga *intera*, codice compreso, e chi se lo prendeva poteva farsi accettare
  da chiunque lo avesse fra gli amici. In Postgres i permessi sulle colonne
  stanno nei **GRANT**: un `grant select` sulla tabella vale per tutte e non si
  buca, va tolto e rifatto elencando le colonne (migrazione `codice_riservato`).
  Conseguenza permanente: **`select *` su `profili` fallisce**, le colonne si
  elencano, e il proprio codice arriva da `mio_codice()`.
  Vale per ogni colonna futura che debba restare privata dentro una riga
  altrimenti condivisa.
- **Codice amico, non ricerca per email.** Cercare qualcuno per indirizzo vuol
  dire che il server conferma «sì, questa email ha un account qui» a chiunque
  provi: è enumerazione di account. L'invito per email resta, ma passa da una
  funzione che risponde **sempre** `inviata`, esista o no l'indirizzo — se
  dicesse la verità sarebbe di nuovo lo stesso problema.
- L'alfabeto del codice salta `0/O` e `1/I/L`: un codice si detta e si ricopia a
  mano, e quelle coppie si sbagliano sempre.
- **Le richieste passano da due funzioni `security definer`** e non da un insert
  diretto, perché tutte e due devono cercare una persona in una tabella che chi
  chiede non ha il diritto di leggere.
- `sono_amico()` è `security definer` per un motivo preciso: le policy di
  `amicizie` non possono chiamare una funzione che legge `amicizie` passando
  dalle policy: sarebbe ricorsione, e Postgres se ne accorge solo a runtime.
- **Accetta solo il destinatario** (`with check (destinatario = auth.uid())`): se
  potesse il richiedente, accettarsi da soli sarebbe due righe di codice.
  Rifiutare, ritirare e sciogliere sono lo stesso gesto — la riga sparisce.
- **La faccia è un meeple disegnato su canvas**, come tutto il resto del sito.
  Niente immagini caricate: nessun bucket, nessuna moderazione, e una faccia c'è
  dal primo secondo. Quella di partenza esce dall'uuid, così due persone non si
  ritrovano identiche appena entrate.
- **`select *` su una tabella cui mancano colonne non si lamenta**: torna quelle
  che ci sono. Senza il controllo `'nick' in riga`, il sito vedeva un profilo
  senza nick, lo chiedeva, e il salvataggio falliva su una colonna inesistente —
  cioè una finestra che non si può chiudere. Vale per ogni migrazione futura.

## Giocatori e partite

Una collezione dice cosa hai; le partite dicono cosa hai giocato, con chi e chi
ha vinto — che di un gioco da tavolo è la metà più interessante.

- **La partita si aggancia all'id BGG, non a una riga di `giochi`.** Così si
  segna anche una serata a casa di un amico su un gioco che non hai, e togliere
  una scatola dallo scaffale non cancella la storia di quando ci hai giocato.
  È la stessa chiave delle recensioni del catalogo.
- **`titolo` e `nome` sono copie, non ridondanza da normalizzare via.** Il titolo
  è come si chiamava il gioco quando ci hai giocato e serve anche senza id BGG;
  il nome è chi c'era, e cancellando un giocatore salvato la partita non deve
  dimenticarselo (`giocatore` è `on delete set null`, la chiave è `(partita, nome)`).
- **I giocatori sono nomi, non account**: al tavolo c'è quasi sempre qualcuno che
  sul sito non c'è. Chi è un amico si collega con `amico`, e il profilo lo propone
  da solo così non lo si riscrive.
- `posizione` nulla vuol dire «classifica non registrata», che è il caso normale:
  quasi sempre si ricorda chi ha vinto e nient'altro.
- **Salvare riscrive i partecipanti per intero** invece di calcolare cosa è
  cambiato: sono quattro righe, e il conto costerebbe più codice di quanto valga.
- `mia_partita()` è `security definer` per lo stesso motivo di `sono_amico()`: la
  policy di `partecipanti` deve guardare `partite` senza ripassare dalle policy
  di `partite`.
- Lo **stesso modulo si apre da due posti**: dalla scatola aperta, che è quando
  hai appena finito di giocare, e dal profilo, che è quando rimetti in ordine.
  Cambia solo se il gioco arriva già scritto.
- La classifica conta **sui nomi**, non sui giocatori salvati: se no cancellare
  un giocatore cancellerebbe anche le sue vittorie.

## Una query che si fida delle policy è corretta finché le policy non cambiano

`LIB.sync()` leggeva `giochi` **senza `where`**, con un commento che spiegava
perché non serviva: le regole del database dicevano `proprietario = auth.uid()`.
Era vero. Poi la lettura si è aperta agli amici — che è esattamente ciò che
serviva per andare a guardare le loro librerie — e quella query ha cominciato a
portarsi a casa anche i giochi loro: dieci diventati ventitré, mescolati nella
collezione di chi era entrato, e salvati così anche in `localStorage`.

**Chi legge deve dire cosa vuole.** Ora `sync()` filtra sul proprietario, e per
lo stesso motivo `update` e `delete` dicono `proprietario` oltre a `id`: lo slug
è unico dentro una collezione, non nel mondo, e due persone possono avere tutte
e due `root`. Le policy li fermerebbero comunque — ma una query che dipende da
una policy per essere giusta è una trappola armata per la prossima migrazione.

## In casa di un amico

Guardare la libreria di un amico è **la stessa scena**, gli stessi gesti, la
stessa recensione che si apre: cambia solo che non si tocca niente. Farne una
schermata a parte avrebbe voluto dire rifare da capo l'unica cosa che questo
sito sa fare bene.

- `LIB.visita(uid)` tiene la sua collezione in un posto suo (`visitata`) invece
  di sovrascrivere la tua: tornare a casa è immediato e non serve rileggere.
- **`salvaLocale()` continua a serializzare `games`, non `all()`.** Se guardasse
  `all()` finirebbe in `localStorage` la libreria di un altro, e al giro dopo
  sarebbe la tua.
- `add`, `update`, `remove`, `riordina` escono subito se si è in visita. Non
  servirebbe — le policy di scrittura chiedono comunque `proprietario =
  auth.uid()` — ma un'interfaccia che ci prova e poi si scusa è peggio di una
  che non ci prova.
- `body.visita` toglie `+`, *modifica*, *togli* e *segna una partita*, e
  `puoiSpostare()` diventa falsa: in casa d'altri si guarda e basta.
- Il cartello scende **sotto** la testata (84 px, 80 su schermo stretto): a
  390 px, centrato in alto, finiva sopra gli strumenti.

## Le tre sezioni

`collezione` | `catalogo` | `profilo`, in `state.sezione`. Due navigazioni che
comandano le stesse voci: nella testata sugli schermi larghi, **in basso** sotto
gli 880 px, dove arriva il pollice.

- Fuori dalla libreria il ciclo di rendering continua ma **non disegna** e non fa
  raycast: `if (state.sezione !== 'collezione') return;`.
- Sotto gli 880 px **chi sei ed esci spariscono dalla testata** e vivono nel
  profilo: a 390 px il marchio andava a capo su quattro righe per far posto a due
  etichette. `.brand b` ha `white-space:nowrap` perché è meglio che stringa
  piuttosto che spezzarsi.

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

## Cose imparate arredando

- **Un menu contestuale alla volta** (`chiudiPannelli`). Due pannelli aperti
  insieme si contendono lo stesso angolo di schermo e nessuno dei due dice più a
  cosa si riferisce: si poteva aprire il menu della stanza sopra la scheda delle
  librerie.
- **Le facce complanari si contendono i pixel.** I ripiani passano dentro i
  montanti e le due facce davanti stavano esattamente sullo stesso piano: sui
  legni chiari non si notava, sul wenge era una tramatura sporca lungo ogni
  incrocio. I ripiani sono profondi `D - .02`, cioè un millimetro vero in meno,
  che è anche come sono su un mobile fatto bene.
- **Il quadro deve comprendere quello che sta sopra il mobile**: gli oggetti sul
  cielo e la targhetta col nome. Senza, su schermo largo — dove a comandare è
  l'altezza — il nome finiva fuori. Costa un mobile più piccolo, e il nome vale
  il prezzo (`SOPRA`, `CIMA_VISTA`).
- Gli oggetti sul cielo sono **scalati a 0.6**: sopra un mobile, vicino al
  soffitto, non ci si mette una fila di libri alta come quella dentro — e così
  resta posto per la targhetta.
- **Un gioco nuovo va nel mobile che si sta guardando**, non nel primo cubo
  libero in assoluto. Prima finiva sempre nella prima libreria, e chi ne creava
  una seconda non riusciva a metterci niente finché la prima non era piena: la
  libreria nuova c'era e non serviva a nulla (`collocaNuovo`).
- **Creare una libreria porta all'ordine manuale.** Negli ordinamenti calcolati i
  cubi si riempiono in sequenza e un mobile in più resta vuoto qualunque cosa si
  faccia: chi ne crea uno sta dicendo «voglio decidere io dove vanno».
- **Le tinte tenui sul muro si leggono tutte uguali.** Le prime erano a mezzo
  passo dal bianco; sotto una luce diffusa non si distingueva la salvia dal
  glicine. Restano intonaci, ma con un colore vero.
- **La luce minima era una stanza un po' spenta, non il buio.** Adesso scende a
  0.08, e soprattutto lo *sfondo* scende molto più in fretta della luce: era
  quello a far sembrare tutto un filtro grigio.
- **Non estrarre il nome di una colonna con una regex** dai messaggi d'errore:
  Postgres dice `column giochi.preferito does not exist`, PostgREST dice
  `Could not find the 'preferito' column of 'giochi'`, e un'unica espressione
  che li prenda tutti e due prendeva la lettera sbagliata. Si cerca il nome che
  si conosce dentro il messaggio.
- **Un `false` dove c'era `undefined` viene spedito al server.** Il rollback di
  `segnaPreferito` faceva `!!g.preferito`, quindi dopo un errore il campo
  restava `false` e la modifica successiva provava a scriverlo su una colonna che
  non c'era ancora, facendo fallire un salvataggio che non c'entrava niente.

## Lo stile appartiene al mobile, la stanza alla stanza

Legno e arredi stanno su `librerie.scaffali` e `librerie.arredo`; luce, muro e
pavimento restano in `profili.stanza`. Due librerie in una stanza vera non sono
per forza dello stesso legno, ma un pavimento diverso sotto ognuna sarebbe una
stanza diversa per ognuna.

- I materiali sono **uno per tinta** (`matsDi`, in cache): in scena possono
  esserci due o tre legni insieme, e la tavolozza è chiusa, quindi al massimo sei
  corredi.
- Nulli entrambi vuol dire «come dice la stanza»: chi non tocca niente vede tutti
  i mobili uguali, com'era.
- Il pannello parla del **mobile che si sta guardando** (`libCorrente`), e
  scorrendo si aggiorna da solo.

## Arredare la stanza

`profili.stanza` (jsonb): luce, tre colori, uno stile di arredo. Sta nel profilo
e non in `localStorage` perche' te la porti fra dispositivi e perche' **un amico
che viene a guardare la tua libreria la vede com'e' da te** — `stanza` e' fra le
colonne che gli amici leggono.

- **`js/stanza.js` non sa niente di three.js**: tiene i valori e le tavolozze,
  li traduce `app.js`. Cosi' la stanza si legge anche senza WebGL.
- **Le tavolozze sono chiuse.** Un selettore di colore libero dava scaffali
  fucsia su muri verde acido: sei tinte per superficie, che stanno insieme, e
  ognuna e' un legno o un intonaco che esiste.
- **Da una tinta sola escono le tre di un legno** (`legno()`): la base, la vena
  scurita, il riflesso verso il bianco. Sceglierne tre a mano per essenza voleva
  dire diciotto colori da tenere in accordo.
- **Il cursore della luce non moltiplica tutto per lo stesso numero**, che
  sarebbe un filtro grigio davanti alla scena. La finestra cala piu' in fretta
  (`l^1.35`) perche' al buio e' la prima ad andarsene ed e' quella che fa le
  ombre; il rimbalzo cala piano (`l^0.60`) perche' una stanza in penombra non e'
  nera; l'esposizione compensa **un filo** (`l^-0.20`) come fa l'occhio — se
  compensasse tutto, muovere il cursore non si vedrebbe.
- **Sfondo e nebbia sono tinte piatte che nessuna luce tocca**: vanno scurite a
  mano insieme al resto, se no la stanza si abbuia e la parete in fondo resta
  accesa come a mezzogiorno.
- Il cursore chiama solo `applicaLuce()`; colori e arredi chiamano
  `applicaStanza()`, che rifa' materiali, mobile e contorno. Ricostruire a ogni
  pixel di trascinamento farebbe singhiozzare tutto.
- **Il pannello sta in un angolo e non copre la scena**: scegliere un colore
  guardando un'anteprima grande come un francobollo e' indovinare. E si salva da
  solo dopo una pausa: un pulsante «salva» dove ogni clic si vede gia' applicato
  e' una domanda a cui l'utente ha gia' risposto.

## I cinque arredi

`arrLibri`, `arrScatole`, `arrDadi`, `arrPiante`, `arrCornici`, piu' `misto` e
`niente`. Ognuno riceve gruppo, seme ripetibile e il punto `(x, y)` su cui
appoggiare — che sia il fondo di un cubo o **il cielo del mobile**: un mobile
vero ha sempre qualcosa sopra, ed e' anche quello che fa capire dove finisce.

- Le foglie delle piante sono sfere schiacciate, non un modello: a quella
  distanza contano sagoma e colore, e una pianta fatta bene costerebbe piu'
  triangoli di tutto il mobile.
- I quadri nelle cornici sono astratti apposta (`ART.quadro`): qualunque
  soggetto riconoscibile, a quattro centimetri sullo schermo, e' una macchia.
- `niente` non e' un ripiego: chi lascia i vuoti apposta non vuole che glieli
  riempiamo noi.

## Aggiungere una colonna a `profili` e' un'operazione in tre punti

Costata due volte nella stessa sessione, e la seconda con la lezione gia' scritta:

1. la migrazione deve **rifare i GRANT per colonna** — dopo `codice_riservato` i
   permessi su `profili` sono per colonna, e una colonna nuova senza grant non
   si legge e non si scrive senza che nessuno lo dica;
2. il client deve **chiedere la colonna e sapersene fare a meno**: PostgREST su
   una colonna inesistente risponde `42703` e butta via l'intera lettura, quindi
   una migrazione non ancora applicata spegne il profilo per intero invece di
   togliergli una riga. `carica()` riprova senza;
3. il messaggio d'errore va **tradotto in quale migrazione manca**: «could not
   find the 'stanza' column in the schema cache» non dice a nessuno cosa fare.

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
rimozione, copertine caricate nel bucket, **ordine manuale** scritto in
`posizione`, **pubblicazione e ritiro** di una recensione nel catalogo, **nick e
faccia** salvati sul profilo, le due funzioni di **richiesta amicizia**
(codice inesistente, proprio codice, email ignota: nessuna crea righe),
**giocatori salvati** con il rifiuto del doppione, e una **partita** completa di
partecipanti, posizioni e vincitore. Tutte e sette le migrazioni sono applicate.
Verificato rileggendo il database dall'esterno, non dalla cache del browser.

Provato anche **con due account veri** (2026-08-20): amicizia accettata, la
libreria dell'amico che si apre in scena con le sue recensioni, tutti i comandi
di modifica spariti, e la scrittura su una sua riga che tocca **zero righe** —
rifiutata dal server, non solo dall'interfaccia. La collezione di un estraneo
torna zero righe.

Dopo la migrazione `codice_riservato`: il proprio codice si legge (`mio_codice()`),
quello di un amico **no** — `42501 permission denied` — e nemmeno il proprio per
la via diretta. `select *` su `profili` è rifiutato, come previsto. Salvataggio
di nick e faccia, elenco amici e richiesta per codice continuano a funzionare:
la funzione di ricerca è `security definer` e legge la colonna che il client non
può leggere.

Cosa manca, in ordine di fastidio:

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
