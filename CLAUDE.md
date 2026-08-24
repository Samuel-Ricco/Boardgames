# il dado è trap — note di progetto (ramo `libreria`)

Sito di recensioni di giochi da tavolo. **Il sito è una libreria a cubi in 3D**,
una KALLAX: la camera si avvicina all'avvio, una scatola per cubo, cliccandone
una esce, si apre e mostra la recensione. Niente build, niente dipendenze.

Si lavora sul ramo `libreria`. **`main` punta allo stesso commit** dal
2026-08-20 e serve GitHub Pages: si spinge su tutti e due. L'armadio con le ante
e la scena notturna che `main` aveva una volta non esistono più da nessuna parte
se non nella storia.

Accanto a questo file c'è **`contest_boardgame.md`**: racconta *cosa è successo*
— le decisioni prese e da chi, i difetti trovati verificando, e il racconto lungo
di com'è nato tutto. Questo file racconta *com'è fatto* il sito.

**Se stai ripartendo a freddo, leggi prima «Stato attuale» in fondo a questo
file**: dice a che punto è il sito, com'è messo il database in questo momento, e
cosa non va toccato senza chiedere. Poi torna qui sopra per il resto.

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
js/i18n.js            le due lingue: dizionario, chiavi, selettore
js/config.js          url e chiave pubblica di Supabase
js/auth.js            accesso con Google, e "sono admin?"
js/store.js           la libreria: database, copia locale, ordinamenti, ricerca
js/recensioni.js      le recensioni del sito: pubbliche, lette anche dall'ospite
js/apprezzamenti.js   i cuori sotto la recensione di un amico
js/profilo.js         nick, faccia, codice amico, amicizie
js/partite.js         giocatori salvati e partite giocate
js/stanza.js          luce, colori e arredi scelti da chi ci abita
js/bgg.js             ricerca BGG (passa dal proxy locale)
js/bggdump.js         l'indice di BGG in casa: cerca e classifica, senza rete
js/catalogo.js        tre fonti per le schede: BGG col token, il dump, Wikidata
js/art.js             grafica generata su canvas
js/app.js             scena 3D e interazione
img/                  le copertine vere delle scatole (due: root, scythe)
fonts/                Poppins, cinque pesi, in locale
vendor/                three.js r152 e supabase-js, committati
supabase/migrations/   lo schema del database
dati/bgg.txt           l'indice committato: 106.694 giochi in ordine di classifica
tools/bgg-*.mjs        scarico dati BGG, proxy, e il convertitore dell'indice
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
- **Le modifiche si fanno con sostituzioni verificate, non a occhio.** `js/app.js`
  è sopra le 5.400 righe e `css/style.css` sopra le 2.600: un `sed` cieco su file
  così può colpire tre punti invece di uno e non dirlo. Il modo che ha retto per
  tutta la sessione è uno scriptino usa e getta che, per ogni sostituzione,
  **pretende esattamente un'occorrenza** (`assert s.count(old) == 1`) e a fine
  giro **ricontrolla che il `.js` sia ancora ASCII**. Se il conto non torna,
  fallisce prima di scrivere invece di lasciare un danno silenzioso.
- **Attenzione agli apostrofi nelle stringhe JS**: `'serve l'accesso'` chiude la
  stringa a metà e rompe l'intero file. È già successo. Se il testo ha un
  apostrofo, virgolette doppie — o `l&#39;`.

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

## La testata dice dove sei, l'imbuto dice cosa vedi

La testata e' **fissa e uguale in tutte le sezioni**, e tiene solo quello che
vale ovunque: il marchio, le tre sezioni, **«la mia collezione: N»**, chi sei,
esci. Niente altro.

- Il contatore era un numero nudo: non diceva ne' di cosa fosse ne' che ci si
  potesse cliccare sopra — ed e' la porta dell'elenco. In casa di un amico
  diventa «la sua collezione».
- **Cercare e ordinare non stanno in testata.** Riguardano lo scaffale che si ha
  davanti, e una barra che vale per tutto il sito non e' il posto di un comando
  che vale per una schermata sola. Sono passati sotto l'**imbuto**, in alto a
  sinistra sulla scena, insieme alla scelta del mobile: sono la stessa domanda —
  *cosa vedo su questo scaffale*.
- L'imbuto sta in alto a sinistra e non in basso perche' in basso a sinistra
  c'e' gia' la stanza: due comandi nello stesso angolo si contendono lo spazio.
  Vale la regola di sempre, **un pannello alla volta** (`chiudiPannelli`).
- Il **«+»** e' sceso nell'elenco della collezione: si aggiunge un gioco da dove
  si guarda cos'hai, che e' anche da dove ti accorgi che manca.

## Lo scaffale senza didascalie

- **Via le due velature chiare** in alto e in basso (`#vig` e `header::before`).
  Servivano a staccare testata e suggerimenti dal fondo, ma tagliavano la stanza
  in orizzontale e si leggevano come due bande slavate. In alto c'e' la parete
  chiara: il testo scuro ci si legge sopra da solo.
- **Via il suggerimento** «clicca una scatola» e **via il nome del mobile** dal
  fondo dello schermo. Il nome vive nell'imbuto, che e' anche la porta dei
  mobili — senza, non ci sarebbe piu' modo di crearne un secondo.
- Il mobile **sale nel quadro** di `ALZA` (0.85). Era centrato sull'ingombro
  compresa l'aria sopra la cima e, tolte le didascalie da sotto, restava seduto
  in fondo: il bordo inferiore usciva dal quadro di una trentina di pixel su
  ottocento. Il margine di `layout()` tiene conto dello spostamento, se no
  alzandolo gli si taglia la cima.

### Scorrere fra le librerie

- Il trascinamento era **uno a uno** con la scena: fedele e scomodo, perche' il
  mobile riempie lo schermo e per passare al successivo bisognava trascinare una
  schermata intera. Ora c'e' `TIRO` (2.4): un gesto da pollice basta, e la
  precisione non si perde perche' al rilascio ci si accosta comunque al mobile
  piu' vicino.
- Un **colpo secco** (`COLPO`, velocita' > 6 px/evento al rilascio) vale un
  mobile intero anche se corto: e' come si sfoglia.
- **La barra in basso si trascina.** Era un indicatore che sembrava un comando.
  Serve `setPointerCapture` perche' la riga e' alta due pixel e il dito ne esce
  subito; l'area cliccabile viene da un bordo trasparente, non dall'altezza
  della riga. Con le frecce si passa di mobile in mobile.

**`ferma` lo decide chi cambia i mobili, non `layout()`.** `state.libs` cambia
in `applyLibrary`, mentre `layout()` gira all'avvio e a ogni resize — cioe'
quando il numero di mobili puo' ancora essere quello di prima. Deciso solo li',
su una collezione da tre librerie il binario restava nascosto: si leggeva
«1 / 3» dentro un elemento a opacita' zero, e non c'era piu' modo di cambiare
mobile. Ora c'e' `segnaFerma()`, chiamata da tutti e due.

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

Nell'elenco una riga mostra **copertina, nome e un tasto a tre punti**, e basta.
Una riga che mostra già tutto obbliga a scorrere per contare i propri giochi.

Tre punti e non tre righe: **le tre righe dicono «un elenco», i tre punti dicono
«altro»** — ed è altro quello che c'è dentro.

Le aperture sono **due, distinte**:

- la **riga** apre le informazioni — che gioco è, dove sta, cosa ne pensi, in
  che gruppi è;
- il **tasto a tre punti** apre le azioni — in libreria, togli, vai allo
  scaffale, **elimina il gioco** — in una **finestrella ancorata al tasto**, non in una fascia
  sotto la riga. Sotto la riga le azioni scivolavano via dal punto in cui si era
  premuto (tanto più con le informazioni già aperte) e allargavano l'elenco a
  ogni tocco, che è il modo migliore di perdere il segno mentre si scorre. Il
  tasto e la finestrella stanno nello stesso involucro (`.riga-menuwrap`), se no
  l'ancoraggio sarebbe alla riga e non al pulsante. Sulle ultime due righe si
  apre verso l'alto. Una alla volta, e si chiude cliccando fuori o con Escape.

Sono due domande diverse, «che gioco è» e «cosa ci faccio», e mescolarle voleva
dire che per leggere due righe di recensione ti trovavi davanti quattro pulsanti.

**Il preferito non sta in nessuna delle due: è una stellina accanto al nome.**
Stava in fondo alla riga, in una colonna sua, e lì si leggeva come un terzo
comando in fila col menu invece che come un interruttore su quel titolo. Ora il
titolo e la stella stanno in una cella sola (`.riga-tit`) e la griglia è passata
da quattro colonne a tre; `min-width:0` perché un titolo lungo deve stringere,
non spingere fuori la stella.
 Dentro
il menu erano due tocchi per accenderlo e un'apertura per sapere se era acceso,
mentre la stella si vede **scorrendo**, che è l'unico momento in cui serve. Si
aggiorna **in posto** — niente `disegnaMia()`: rifare l'elenco staccherebbe dal
documento il pulsante appena premuto, ed è un pulsante su cui si tocca più volte
di fila. In casa di un amico la stella non c'è, ma il posto resta occupato da uno
`<span>` vuoto: le colonne della griglia sono quattro, e una in meno sposterebbe
il tasto del menu sotto la stella delle altre righe.

**Togliere dalla libreria ed eliminare restano due gesti diversi**, e stanno
lontani nel menu: il primo rimette il gioco nella collezione senza posto e si
disfa in un clic, il secondo lo cancella. Per questo l'ultimo è rosso e **in due
tempi sul pulsante stesso** — `window.confirm` bloccherebbe il rendering, e una
finestra di sistema in mezzo a questa pagina stonerebbe.

- Il contenuto si costruisce **solo quando si apre**: con duecento giochi,
  riempire tutte le schede in anticipo genera duecento blocchi che nessuno
  guarderà.
- Cliccando *dentro* un blocco già aperto non si richiude la riga: se no toccare
  una pastiglia di gruppo faceva sparire quello che si stava guardando.
- **Ogni gruppo è una tendina**, e quale sia aperta se lo ricorda. Si parte
  **chiuse** — vedi «Un elenco diviso per gruppi non si filtra anche per
  gruppo». Erano aperte, ma con qualche gruppo la vista diventava l'elenco
  intero con dei titoli in mezzo, cioè la vista accanto più rumore.

## La scheda esce dalla scatola

Prima il pannello della recensione si apriva come un'anta incernierata sul bordo
dello schermo. Bel gesto, ma partiva da un punto che con il gioco non c'entrava
niente: aprivi una scatola a sinistra e la scheda spuntava da destra.

Adesso parte **piccola dal punto in cui la scatola sta sullo schermo** e cresce
fino al suo posto. `ancoraPannello()` proietta la posizione 3D della scatola con
la camera e scrive lo scarto dal centro del pannello in `--da-x` / `--da-y`; il
resto lo fa una transizione CSS.

- Si usano **`offsetLeft`/`offsetWidth`, non `getBoundingClientRect()`**: il
  pannello a riposo è già trasformato (parte piccolo e ruotato) e il rect
  restituirebbe l'ingombro della trasformazione, non quello del posto in cui
  deve arrivare. Gli offset le trasformazioni non le vedono.
- A zero le due variabili valgono zero, quindi **senza JS o senza WebGL** la
  scheda fa comunque una comparsa sensata dal proprio centro.

## `dentro-only` ha un `!important`, e vince su tutto

`.dentro-only` è `display:inline-flex !important`, quindi **qualunque regola che
provi a nascondere un comando "solo in questa schermata" perde contro di lei** se
non è a sua volta `!important`. È costato il pulsante dell'arredo acceso sopra
l'elenco e sopra il catalogo, dove non arreda niente: la regola che lo nascondeva
c'era, scritta e commentata, e non ha mai funzionato.

Vale per ogni comando futuro che porti quella classe.

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

## Cancellare è un fatto, non un'animazione

«Ho eliminato dei giochi e sono rimasti nella libreria.» Il difetto non era uno,
erano quattro, e tutti nascevano dallo stesso errore: **far dipendere una
cancellazione da qualcosa che potrebbe non succedere.**

1. **`LIB.remove` stava dentro il seguito del tween** di `removeFocused`, cioè il
   gioco veniva tolto solo se l'animazione arrivava in fondo. Ma la coda si
   svuota (`anims.length = 0`) ogni volta che una scatola si apre o si chiude:
   basta che qualcosa la svuoti in quel mezzo secondo e il gioco resta dov'era,
   senza che niente lo dica. Adesso **i dati se ne vanno subito** e l'animazione
   viene dopo; la scatola esce da `boxes` nello stesso momento, così un
   `applyLibrary` che arrivi nel mezzo non prova a rimandarla a casa.
2. **`ridisponi()` buttava via la richiesta durante `closing`**, con un commento
   che diceva «ci pensa la chiusura già avviata» — e non ci pensava, perché la
   chiusura richiama `applyLibrary` solo se le è stato passato un seguito. Chi
   eliminava un gioco mentre una scatola si stava richiudendo se lo ritrovava
   sullo scaffale. Adesso la richiesta si **segna** (`ridisponiDopo`) e si fa
   appena la chiusura ha finito.
3. **`wanted` ereditava da `Object.prototype`.** Gli id sono slug che vengono dal
   titolo, e su un oggetto normale `'constructor' in wanted` è vero anche quando
   quel gioco non c'è: la sua scatola non se ne sarebbe andata mai.
   `Object.create(null)` e il caso non esiste più.

### Zero righe cancellate non è un successo

Il quarto, e il più insidioso, stava nel database. `.delete().eq(...)` **senza
`.select()` torna indietro come un successo pulito anche quando non ha toccato
nessuna riga** — è così che risponde PostgREST quando le regole non lasciano
passare quella riga, o quando l'id non è più quello. La scatola spariva dallo
schermo (la scrittura è ottimista), nessuno diceva niente, e **al primo
ricaricamento il gioco era di nuovo lì**: che è esattamente il sintomo
descritto.

Con `.select('id')` la risposta porta le righe cancellate: **se sono zero è un
guasto, e si dice.** Vale per ogni `delete` futuro.

E siccome il rollback rimette il gioco nei dati, la scena va rimessa in pari:
`LIB.suRipristino(fn)` è il gancio. Senza, i dati e lo schermo restavano in
disaccordo fino al ricaricamento — che è il momento in cui il gioco
«ricompariva».

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

## Due librerie non si chiamano allo stesso modo

Il nome è **l'unica cosa che distingue un mobile dall'altro**: si legge nel
pannello, sul binario in basso e sulla targhetta dentro la scena, e in tutti e
tre i posti si legge il nome — non l'id. Due «Libreria 3» sono due mobili che
non si distinguono, e infatti ne erano nate tre.

- Il controllo sta in **`store.js`**, che è l'unico file a sapere quali librerie
  esistono, e copre **tutte e due le strade**: creare e rinominare. Metterlo
  nell'interfaccia avrebbe voluto dire scriverlo due volte e dimenticarlo alla
  terza.
- Il confronto è **appiattito** (`nomeLib`): maiuscole, accenti e spazi doppi non
  fanno un mobile diverso, fanno due nomi che a leggerli sono lo stesso.
- `nomeLibPreso(nome, tranne)` prende un `tranne` perché **rinominare un mobile
  col suo stesso nome non è un doppione** — senza, cambiare solo le maiuscole
  sarebbe stato vietato contro sé stessi.
- L'interfaccia spegne la spunta **prima del clic** e tinge di rosso il campo, col
  perché nel `title`: scoprire di aver sbagliato dopo aver premuto salva è il
  modo peggiore di dirlo. Ma il divieto vero resta quello dello store —
  l'interfaccia è la cortesia, non la regola.
- Il nome automatico (`Libreria N`) sale finché non ne trova uno libero, passando
  dalla stessa funzione: prima usava una mappa sua, e i due controlli potevano
  divergere.

**Sul database non c'è ancora un indice unico su `(proprietario, nome)`**, e non
è una dimenticanza: al momento della modifica la collezione aveva tre «Libreria
3» e la migrazione non sarebbe passata. Adesso i doppioni non ci sono più,
quindi l'indice si può aggiungere quando si vuole — ed è il posto giusto per
una regola come questa.

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

## Il piede della scheda: due righe, e il peso in basso

I sette pulsanti stavano tutti in fila e si equivalevano. Adesso vanno a capo a
metà: **sopra quello che si fa di sfuggita** — la stella, il cuore, «partita»,
«in collezione» — e **sotto le due cose che pesano**, scrivere cosa ne pensi e
toglierlo dalla collezione. Il ritorno a capo è `.pan-acapo`, un elemento largo
quanto la riga e alto zero: il flex va a capo da solo, senza un secondo
contenitore da tenere allineato.

- **«Rimuovi» e non «elimina»**, e sta in **fondo a destra** come l'azione di
  ogni altro piede di pannello del sito. Resta rosso e resta in due tempi.
- **«Dallo scaffale» si chiama «in collezione»**: dice dove va il gioco, non da
  dove esce, ed è lo stesso verso con cui l'elenco dice «in libreria».
- **Il pulsante «scheda» non c'è più.** Va detto chiaro: `apriModifica()` —
  autore, editore, anno, voto, copertina — adesso **non ha più nessuna porta**.
  La funzione è intatta e il listener è scritto per non esplodere se il
  pulsante manca (`const bEdit = q('#edit'); if (bEdit) ...`), ma finché
  qualcuno non gli dà un posto, quei campi si correggono solo dal database. Il
  posto naturale sarebbe il menu a tre punti dell'elenco, dove sta già
  «altro».

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

**La riga si clicca, e basta.** C'era anche un pulsante «scheda» che faceva
esattamente quello che fa la riga intera, e su una riga che si scorre una
pastiglia di testo ruba larghezza al titolo — che e' la cosa che si sta
leggendo. Resta il «+», che invece fa un'altra cosa.

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

### L'indice di BGG in casa

`js/bggdump.js` + `dati/bgg.txt`. BGG pubblica ogni giorno un CSV con tutti i
giochi del database e la loro posizione in classifica, **senza chiedere token**.
`tools/bgg-indice.mjs` lo riduce all'osso e ne esce l'indice che il sito scarica:
**106.694 giochi** (id, nome, anno, media), di cui **31.183 in classifica**,
3,76 MB.

Risolve le due cose che a questo elenco mancavano di piu':

- **cercare fra centomila titoli invece di 3.429.** E senza rete: il file e' gia'
  in memoria, quindi la ricerca risponde in **5 ms** invece dei due secondi buoni
  di una query a Wikidata.
- **la classifica vera.** Il catalogo si sfogliava in ordine di edizioni
  linguistiche della voce Wikidata — scacchi e Monopoly in cima, veri classici ma
  non la classifica che un sito di recensioni vuole. Adesso il primo e' Brass:
  Birmingham, che e' il numero uno di BGG.

Le scelte che vale la pena ricordare:

- **Il dump e Wikidata non si escludono.** Il dump sa *chi esiste* e come si
  chiama; Wikidata sa *com'e' fatto*. Scegliendo un risultato si chiede la scheda
  a Wikidata **per id BGG** (`P2339`), e se non la trova — su centomila giochi
  capita spesso — restano nome, anno e id, che e' comunque piu' di un campo
  vuoto. Wikidata giu' non deve fermare niente: `dettagli()` cattura e tira
  dritto.
- **Il rank non ha una colonna sua.** Le righe sono ordinate: prima le
  classificate in classifica, poi le altre per numero di voti, e l'intestazione
  dice quante sono le prime. Il rank e' la posizione della riga. Sfogliare il
  catalogo diventa "prendi le prime N righe".
- **Si carica una volta sola e solo se serve.** 3,76 MB non si scaricano a chi
  apre il sito per guardare la propria libreria: se li prende chi apre il
  catalogo o cerca un gioco. Verificato: all'avvio il file non viene chiesto.
- **Fuori le espansioni e le schede con zero voti**: 180.226 record diventano
  106.694 giochi. Una scheda che nessuno ha mai votato e' un abbozzo, e chi ha
  davvero un gioco cosi' lo scrive a mano — il modulo lo permette da sempre.
- **I nomi si appiattiscono al caricamento**, non a ogni lettera scritta:
  rifarlo per tasto vorrebbe dire centomila `normalize()` a colpo.
- **L'ordine dei risultati non e' quello del file**: prima chi si chiama
  esattamente cosi', poi chi comincia cosi', poi il resto — e dentro ogni gruppo
  vince chi sta piu' in alto in classifica. Se no cercando «root» usciva prima
  una espansione dimenticata e Root era in fondo.

**Il CSV grezzo non si committa** (11 MB, e si riscarica da BGG): sta in
`dump_bgg/`, che e' in `.gitignore`. Si committa quello che ne esce.

**Il ping al proxy ha preso un limite di tempo.** `BGG.ping()` aspettava una
porta chiusa per un paio di secondi, e con Wikidata dietro non si notava perche'
anche quella ce ne metteva due. Con un file in casa era diventata l'unica attesa
rimasta: adesso sono 400 ms, che su localhost sono gia' larghi.

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
  segna anche una partita a casa di un amico su un gioco che non hai, e togliere
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
- **Di là il sito è una libreria e basta.** Catalogo e profilo spariscono dalle
  due navigazioni: sono tuoi e lo resterebbero anche mentre sei a casa sua,
  quindi entrarci da lì vuol dire uscire da casa di qualcuno senza accorgersene
  — e poi non capire più di chi sia la collezione che si guarda. Si esce da un
  posto solo, il cartello che dice di chi è la libreria.

### Il cuore: l'unica cosa che si tocca in casa d'altri

`js/apprezzamenti.js` + tabella `apprezzamenti` (migrazione
`20260820230000_apprezzamenti`). Apri una scatola, leggi quello che ne pensa
lui, e puoi dire che ti è piaciuto.

- **La chiave è la copia, non il gioco**: `(proprietario, gioco)` e non l'id
  BGG. Si apprezza *la recensione di quella persona*. È la distinzione che il
  sito fa già — le recensioni pubbliche del catalogo hanno l'id BGG per chiave
  perché sono del gioco e le legge chiunque; queste sono di chi le ha scritte.
  La chiave esterna è composta perché `giochi` ha chiave `(proprietario, id)`.
- **Una lettura per collezione**, entrando: sono poche righe e la scena le
  interroga mentre disegna un pannello, quindi `di()` è sincrona come `RECE.di`.
  Uscendo si buttano, se no i cuori di un altro restano addosso.
- Ottimista come il resto: il cuore si accende subito e torna indietro se il
  database rifiuta. Su `insert` un `23505` **non è un errore** — vuol dire che
  il cuore c'era già, cioè lo stato voluto.
- **Niente update, e niente grant di update**: un cuore c'è o non c'è.
- **Che la tabella manchi si cerca nel messaggio, per nome.** Il codice non
  basta: Postgres dice `42P01`, PostgREST risponde «Could not find the table
  'public.apprezzamenti' in the schema cache» con un codice suo, e controllare
  solo il codice lascia passare il caso più probabile — la migrazione non
  ancora applicata. È la stessa lezione dei nomi di colonna, un piano più su.

## Le quattro sezioni

`collezione` | `catalogo` | `partite` | `profilo`, in `state.sezione`. Due navigazioni che
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

## Due lingue, un dizionario

`js/i18n.js`. Il sito non aveva nessun sistema di traduzione: le parole stavano
dentro il markup e dentro le stringhe del JS, in italiano, e basta.

- Ogni testo ha una **chiave puntata** (`pro.esci`, `gate.entraT`) e il dizionario
  ha un ramo per lingua. Le chiavi dicono *dove sta* il testo, non *cosa dice*:
  `pro.esci` resta `pro.esci` anche quando la frase cambia.
- Nel markup si scrive `data-i18n` sull'elemento, e `data-i18n-ph`,
  `data-i18n-title`, `data-i18n-aria` per segnaposto, titolo ed etichetta.
  `applica()` gira sul documento e riempie.
- Nel JS si chiama `T('chiave')`, che accetta dei dati: `T('mia.conta', {n: 3})`
  sostituisce `{n}`.

Le scelte che vale la pena ricordare:

- **`data-i18n` scrive in `innerHTML`.** I testi sono nostri e contengono
  grassetti ed entità, ed è come il resto del sito scrive già nel documento. Gli
  attributi invece vogliono testo piano, e ci pensa `piano()` — se no
  `placeholder="cerca un gioco&hellip;"` mostrerebbe proprio quei caratteri.
- **Dove dentro una frase c'è un pezzo che riempie il JS** — il nome di un
  amico, il titolo di un gioco, il contatore di un cassetto — la frase è
  **spezzata in due chiavi attorno a quel nodo**. Con una chiave sola,
  riapplicare la lingua cancellerebbe quello che il JS ci aveva messo.
- **Il file non dipende da niente**, come il selettore di smlrcc: vive fuori da
  ogni `init()` e parte da sé. Se three.js non carica, la lingua si cambia
  lo stesso.
- **Una chiave che manca torna sé stessa**, non una stringa vuota: un buco muto
  in una schermata non lo trova nessuno.
- **Il file resta ASCII** come tutti gli altri `.js`: gli accenti si scrivono
  con le entità, che `piano()` scioglie quando servono in un attributo.
- Chi ha già disegnato qualcosa col JS — l'elenco, il catalogo, il profilo — si
  iscrive con **`I18N.suCambio(fn)`** e si ridisegna da sé. `applica()` rifà solo
  il markup.

### Chi tiene una parola se la tiene per sempre

Il markup si rifà da solo, ma tutto quello che il JS aveva **catturato** resta
nella lingua di quel momento. Tre posti dove è successo, e la regola che ne esce:
**si tengono le chiavi, si sciolgono al momento di mostrarle.**

- **`armaBottone(btn, chiaveNormale, chiaveConferma, azione)`** prendeva le due
  scritte e le richiudeva dentro la sua closure. Risultato: «esci dall'account»
  era l'unica scritta del profilo che non seguiva la lingua. Ora prende le chiavi
  e le scioglie ogni volta che riscrive il pulsante, e ognuno espone
  `__rilingua()` per rimettersi in pari senza perdere lo stato armato.
- **Le tavolozze di `js/stanza.js`**: `n` non è più la parola ma la chiave
  (`tinta.noce`, `arredo.dadi`), e `disegnaStanza()` fa `TP(x.n)`. Quel file non
  sapeva niente di three.js, e adesso non sa niente nemmeno di italiano.
- **Le risposte del server sulle amicizie**: `RISPOSTE` mappa il codice
  (`chiesta`, `nessuno`, `te stesso`) a una chiave, e `frase()` la scioglie
  quando la mostra. Una mappa di frasi costruita all'avvio sarebbe rimasta
  ferma alla lingua di allora.

`rilingua()` in `app.js` è l'iscritto a `suCambio`, e ridisegna **solo quello che
è davvero a schermo**: rifare il catalogo mentre si guarda la libreria vuol dire
rifare centinaia di righe che nessuno sta leggendo. La scheda aperta invece va
rifatta col suo gioco — occhiello, specifiche e credito all'illustratore li
scrive tutti il JS.

**I messaggi d'errore si traducono dove nascono**, non dove si mostrano: i moduli
fanno `throw new Error(TP('err.qualcosa'))`. Sono messaggi di passaggio, e
tradurli al volo costerebbe un secondo livello di indirezione per niente.

**Il selettore sta in due posti**: nel **cancello**, che è la prima schermata che
si legge e l'unico punto dove serve davvero — chi non legge l'italiano deve
poterla cambiare senza aver capito niente di quello che c'è scritto sopra — e in
**fondo al profilo**, con l'**uscita sotto, ultima cosa della pagina**. Uscire
stava in mezzo, appeso al codice amico, dove sembrava un dettaglio del codice.

**I nomi delle lingue non si traducono**: «Italiano» e «English» restano scritti
nella propria lingua, se no chi cerca la sua non la trova.

**Nel cancello «ultima volta» adesso è vera.** Era un `content:` del CSS su
una classe `last` scritta **fissa nel markup**: diceva «ultima volta» sulla
scheda dell’ospite a chiunque, anche a chi arrivava per la prima volta — e da un
`content:` il dizionario non ci arriva. Ora è un elemento vero con la sua
chiave, e la classe la mette `gate()` leggendo `dado-cancello`, che si scrive
scegliendo — niente salvato, niente pastiglia, che è la risposta giusta per chi
arriva la prima volta. Sta **sopra** il titolo e non accanto: dentro al titolo il
`float` la faceva scendere in mezzo alla descrizione, accanto gli rubava la
larghezza e «Sign in with Google» andava a capo.

**La selezione ha dovuto pareggiare una catena di `:not()`.** Il fondo dei
pulsanti dentro il profilo lo decide
`#profilo button:not(.primario):not(.secondario):not(.distruttivo)`, che pesa un
id, **tre classi** e un elemento. `.lingua button.on` non ci arriva nemmeno
vicino, e nemmeno `#profilo .lingua button.on`: la pastiglia scelta restava
grigia. È la lezione di `.primario` un piano più su — un id batte una classe — con
l'aggiunta che **ogni `:not()` conta come la cosa che contiene**.

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

## Un pulsante che apre resta dov'è, e si accende

I due comandi che galleggiano sulla scena — l'**imbuto** e la **libreria** — si
comportavano in due modi diversi: l'imbuto restava e diventava terracotta, la
libreria **spariva**. La regola d'accento c'era per tutti e due
(`body.arreda #stanza-apri`), ma un `display:none !important` la copriva prima
che si vedesse.

Sparire è la cosa sbagliata: lascia un buco nell'angolo, non si capisce più che
cosa abbia aperto quel pannello, e soprattutto toglie il modo più naturale di
richiuderlo — **lo stesso gesto con cui lo si è aperto**. Ora tutti e due
restano, si accendono, e fanno da interruttore.

**E cliccando fuori si chiudono** (`bindClicFuori`). Sono finestrelle ancorate a
un pulsante, non schermate: da una finestrella si esce guardando altrove. Si
ascolta in **cattura** e su `pointerdown`, così il pannello è già chiuso quando
il gesto arriva a destinazione — se no cliccando una scatola si apriva la scheda
con l'imbuto ancora aperto sopra. I due pulsanti sono **esclusi** dal controllo:
se no il loro `pointerdown` chiuderebbe e il `click` subito dopo riaprirebbe, e
l'interruttore non funzionerebbe mai.

## L'imbuto vale anche sull'elenco

Cercare e ordinare valgono nell'elenco come sugli scaffali, ed è la stessa
domanda: *cosa vedo*. Quindi è lo stesso pannello, non un secondo corredo di
comandi — sparisce solo la riga che parla del mobile in tre dimensioni, che sopra
un elenco non vuol dire niente.

- **L'imbuto e l'elenco non sono rivali.** `chiudiPannelli('vista')` chiudeva
  l'elenco: aprendo il filtro si buttava via la cosa che si stava filtrando. La
  regola «un pannello alla volta» vale fra pannelli che si contendono l'angolo,
  non fra un pannello e la pagina su cui è appoggiato.
- `setQuery` e `setSort` chiamano anche `disegnaMia()` quando l'elenco è aperto:
  prima rifacevano solo lo scaffale, che lì sotto non si vede.

## Cambiando schermata si riparte da capo

Le tendine aperte, le cartelle aperte e la vista scelta **non sopravvivono più al
cambio di sezione** (`azzeraSchermata`). Erano ricordate in `localStorage`, e
l'effetto era tornare su una pagina lasciata a metà da sé stessi dieci minuti
prima: tre cassetti spalancati nel profilo, e l'elenco tagliato da una vista che
nessuno ricordava di aver scelto.

È la stessa ragione per cui **i filtri non escono dalla schermata in cui si
mettono**: uno stato che non si vede e non si ricorda è uno stato che non si
trova più. L'elenco riparte sempre da **tutti i giochi**, che è anche la prima
delle due voci.

## Nascondere non è disattivare

Il binario delle librerie era invisibile fuori dalla libreria — `opacity:0` — ma
**restava cliccabile**. Nel catalogo, nel profilo e sopra l'elenco c'era una
striscia larga mezzo schermo che, presa, faceva scorrere una scena che nessuno
stava guardando: e siccome non si vedeva, sembrava che il sito reagisse da solo.

La regola è scritta al contrario apposta: **niente tocca il binario**, e i
puntatori si riaccendono solo dove il binario si vede davvero. Così una schermata
nuova non se lo porta dietro per dimenticanza. Vale per qualunque cosa venga
nascosta con l'opacità.

## Il modulo della partita

- **Il gioco si cerca, non si scrive.** Prima si digitava il titolo a mano e a
  fianco si chiedeva l'**id BGG**: un numero che nessuno sa a memoria, e senza il
  quale la partita non si aggancia a niente. Ora si cerca e l'id arriva da solo
  scegliendo un risultato. Si cerca **prima nella collezione** — è lì che stanno i
  giochi a cui si gioca davvero — e solo dopo nel catalogo. Chi scrive un titolo
  che non esiste da nessuna parte ha comunque la sua partita, senza aggancio:
  `titolo` e `bgg` sono due colonne diverse apposta.
- Le richieste al catalogo passano dalla rete: **ognuna prende un numero e la
  risposta controlla di essere ancora l'ultima chiesta**, se no si butta via da
  sola. Stessa regola del catalogo vero.
- **Chi c'era si scrive, e i nomi appaiono mentre scrivi.** Erano pastiglie, e
  restano una buona idea per tre nomi: si vedono tutti insieme e si toccano
  quelli giusti. Diventano un muro appena sono venti — ma soprattutto **non
  davano modo di mettere al tavolo qualcuno che sul sito non c'è**, che al
  tavolo è quasi sempre il caso. Ora l'ultima riga dei suggerimenti è sempre
  «aggiungi «Giulia»», e un nome che non risulta a nessuno vale come gli
  altri.
- Resta un **campo di testo, non un `select`**: il selettore del sistema
  operativo continua a non somigliare a niente del resto del sito. A campo vuoto
  si mostrano tutti, che è quello che facevano le pastiglie.
- **Tu ci sei sempre, e sei il primo.** Non essere fra i nomi proponibili voleva
  dire riscrivere il proprio nome ogni volta — o, com'è successo, non
  mettersi mai e ritrovarsi il winrate a zero senza capire perché. La
  pastiglietta accanto dice «tu», in terracotta.
- Amici e giocatori salvati stanno **insieme**: al tavolo la differenza non
  conta, conta chi c'era, e tenerli in due elenchi vuol dire cercare due volte.
  La pastiglietta a destra dice da dove viene ognuno, che è l'unico posto in
  cui la differenza serve ancora.
- **La porta verso i giocatori del profilo non c'è più.** Serviva perché un
  nome nuovo si poteva creare solo lì; adesso lo si scrive e basta, e mandare
  qualcuno in un'altra sezione per una parola sarebbe il giro che il sito evita
  già nei gruppi.
- **Amici e giocatori salvati li leggeva solo il profilo.** Finché erano
  pastiglie dentro la sezione partite non si notava; adesso il campo li propone,
  e il modulo si apre **anche dalla scatola** — cioè da un punto del sito
  dove nessuno li ha ancora chiesti. Si chiedono all'apertura, una volta per
  sessione, e i suggerimenti si rifanno da soli quando arrivano.
- L'ascoltatore dei suggerimenti è su `mousedown` e non su `click`: il `blur`
  del campo chiuderebbe l'elenco prima che il clic arrivi a destinazione.
- **Si chiede solo la data.** L'ora e le note non ci sono piu': di una partita ci
  si ricorda il giorno, non il minuto, e le note erano un campo che restava
  vuoto. Le colonne sul database restano, e quello che c'è già scritto non si
  butta via — `paCorrente` se lo porta dietro e torna sul database com'era.
- **La corona sta a destra del nome, e si vede solo su chi ha vinto.** Era un
  pulsante in testa a ogni riga: una fila di corone spente diceva «qui si
  preme», che non è quello che si vuole leggere scorrendo un tavolo. Sulle
  altre righe il pulsante c'è ancora, appena accennato, e si accende sotto il
  dito: senza, non ci sarebbe più modo di dire chi ha vinto. Il nome e la sua
  corona stanno in un involucro loro (`.chi-nome`), se no la corona finiva
  incolonnata a destra insieme ai comandi invece che attaccata al nome.

### Le posizioni non si scrivono: si calcolano

Chi segna i punti non deve anche contare chi è arrivato primo. Si ordina per
punti e si assegna 1, 2, 3… con i **pari merito** che dividono la posizione — due
a 61 sono primi tutti e due e il successivo è terzo, come si contano le
classifiche ovunque.

- **La corona segue i punti finché nessuno la tocca.** Ci sono giochi che i punti
  non ce li hanno — si vince e basta — e ce ne sono in cui i punti li segni
  solo per qualcuno, che è il caso normale: quasi sempre ti ricordi il punteggio
  di due su quattro. Prima toccare la corona con dei punti a schermo veniva
  **rifiutato**, cioè chi non segnava i punti di tutti non poteva più dire chi
  aveva vinto. Adesso i punti fanno le **posizioni** e la corona la fa la
  **persona**.
- **Il primo tocco spegne le corone che venivano dai punti.** Se no ne restavano
  due accese per due motivi diversi, che è un modulo che si contraddice davvero.
  Dopo, ogni tocco è solo un tocco: due corone insieme si possono ancora fare,
  ma perché le ha messe qualcuno.
- **`eraSu` si legge prima di spegnere.** Toccando la corona che i punti avevano
  già acceso, spegnerle tutte e poi invertire la rimetterebbe su: si guarda com'era
  **prima**, e il gesto toglie invece di riaccendere.
- **Si può tornare indietro.** Tolti tutti i punti e tolte tutte le corone, il
  tavolo riparte da zero e i punti tornano a decidere: senza, chi aveva messo una
  corona a mano una volta non aveva più modo di rimettere la classifica al
  comando.
- **I punti si salvano** (migrazione `punti_partita`). Prima no: erano un aiuto
  del modulo e sparivano alla chiusura, quindi riaprendo una partita i campi
  erano vuoti e non si poteva più correggere un punteggio senza riscrivere
  tutto il tavolo. Da questo nasceva anche il difetto gemello — «cambio il
  punteggio e il vincitore resta quello di prima»: senza punti salvati,
  `coroneAMano` partiva vera per non cancellare un vincitore registrato, e la
  corona non si muoveva più. Adesso il tavolo che si riapre è quello di
  allora, `coroneAMano` parte **falsa**, e i punti tornano a comandare: si
  corregge un punteggio e la corona si sposta con lui.
- **Zero non è nullo.** `parseInt(x) || null` trasformerebbe uno zero in «non
  registrato», e a certi giochi si chiude davvero a zero. C'è un `numero()`
  che distingue i due casi, e vale per `posizione` come per `punti`.
- **Se la migrazione non è applicata la partita si salva lo stesso** — ma lo
  dice. PostgREST su una colonna inesistente butta via l'intera scrittura, quindi
  `salva()` riprova senza `punti`; e siccome un ripiegamento che non si vede è
  peggio di un errore, `puntiPersi()` lo racconta al flash.

### La cache dello schema legge e scrive in due modi diversi

Costato mezz'ora di sconcerto, e vale per **ogni colonna futura**: applicata la
migrazione, `select('*')` restituiva subito `punti`, ma l'insert con quel campo
veniva **rifiutato**. Non è una contraddizione: la lettura la espande il
database, la scrittura la valida la **cache dello schema di PostgREST**, che
dopo un `alter table` resta indietro finché non le arriva un `NOTIFY pgrst`.
Per qualche minuto la colonna esiste per chi legge e non per chi scrive.

Quindi: **una colonna che si legge non è la prova che si possa scrivere**, e un
ripiegamento silenzioso su quel caso fa sparire dei dati veri senza dirlo — che
è esattamente com'è andata la prima volta. Se succede, si aspetta un minuto e
si rifa'.
- **Tolti i punti se ne vanno le corone che venivano dai punti**, non quelle
  messe a mano: per questo ogni riga ricorda `daPunti`. Senza, svuotando i campi
  restava addosso all'ultimo calcolato una corona che nessuno gli aveva messo.
- Scrivendo i punti **la riga non si ridisegna**: si aggiornano numeri e corone
  in posto. Rifare l'elenco sotto il dito staccherebbe il campo in cui si sta
  scrivendo — è la stessa lezione dell'elenco dei gruppi.

## Quello che butta via qualcosa sta SEMPRE in due tempi

Nel primo pannello delle librerie il cestino di ogni riga cancellava **al primo
clic**. Un clic solo su un cestino dentro un elenco che si trascina è un
incidente che aspetta di capitare — ed è capitato: **due mobili spariti**, e con
la chiave esterna `on delete set null` trentacinque giochi tornati senza posto
tutti insieme.

La regola c'era già scritta in queste note e l'ho violata scrivendo quel
pannello. Vale senza eccezioni: **ogni comando che distrugge chiede conferma sul
pulsante stesso** e si disarma da solo dopo qualche secondo.

## I filtri non escono dalla schermata in cui si mettono

Un filtro acceso nell'elenco restava acceso tornando in libreria: sugli scaffali
c'erano tre scatole invece di trenta e niente a schermo diceva perché. E il
contatore in testata continuava a mostrare il numero filtrato nel catalogo e nel
profilo, dove nessuno poteva più risalire al motivo.

- **Chiudendo l'elenco i filtri si azzerano** (`scordaFiltri`).
- **Cambiando vista si azzerano** — «solo i preferiti» è un taglio della vista in
  cui lo si è scelto.
- **Il contatore mostra il numero filtrato solo mentre l'elenco è aperto**, cioè
  dove il filtro si vede.

## Un elenco diviso per gruppi non si filtra anche per gruppo

Le pastiglie che filtravano per gruppo non ci sono più: nella vista a gruppi le
**cartelle sono già i gruppi**, e filtrare dentro un elenco già diviso vuol dire
dire la stessa cosa due volte — da lì nasceva il difetto del filtro che
sopravviveva a «tutti i giochi», dove contraddice il nome della vista.

Resta un filtro solo, **i preferiti**, e sta in «tutti i giochi», che è l'unica
vista dove tagliare l'elenco significa qualcosa.

Le cartelle **partono chiuse**: aperte, con qualche gruppo, la vista a gruppi
diventava l'elenco intero con dei titoli in mezzo — cioè la vista accanto, più
rumore.

## Le partite sono una schermata, non un cassetto

Stavano in fondo al profilo, dentro il terzo cassetto, sotto amici e giocatori.
Ma **il profilo risponde a «chi sono» e le partite a «cosa abbiamo giocato»** — e
di una collezione di giochi da tavolo quella è la metà più interessante, che da
dentro un cassetto chiuso non si vedeva mai.

La composizione è **quella dell'elenco della collezione**: occhiello, due viste,
un «+». Non per pigrizia — è la stessa cosa, un elenco che si scorre, e chi ha
imparato a usare quello sa già usare questo.

- **Due viste, come nell'elenco**: *per gioco* (quante volte a Root, e chi vince)
  e *le ultime* (in ordine di tempo, la più recente in cima). Nella seconda il
  titolo del gioco compare su ogni riga — `rigaGiocata(p, conTitolo)` lo prevedeva
  già — perché lì è l'unica cosa che distingue una partita dall'altra.
- **Tre numeri in cima**: quante partite, su quanti giochi, e **come stai
  andando tu**. Sono le domande per cui si apre questa schermata, e dall'elenco
  si ricavavano solo contando le righe. Le basi del flex li mettono in fila su
  schermo largo e mandano a capo il terzo su un telefono, senza una media query.
- **Si dice «partita», mai «serata».** Erano rimaste tre chiavi a dirlo
  (`pa.occhiello`, `par.serata`, `par.serate`) e mezzo ramo inglese a dire
  «game night». In inglese adesso è **play/plays**, che è anche la parola di
  BGG: «game» da solo si scontrerebbe con i giochi — «12 games on 5 games» non
  si legge.
- Nella vista *le ultime* **non c'è il filo verticale**: le partite sono una fila
  sola, senza un livello di mezzo a cui appartenere, e un rientro che non
  appartiene a niente è solo un rientro.
- `#pro-partite`, `#par-msg` e `#par-nuova` **hanno tenuto il loro id**: il
  markup si è spostato, il codice che ci parlava no.

## Il winrate: «chi vince» e «come vado io» sono due domande

`vinceDi()` risponde alla prima — chi sta in testa fra chi c'era — e resta
sulle righe dei giochi. Ma una schermata intitolata **«le tue partite»** deve
rispondere prima di tutto sulla seconda, e il terzo riquadro in cima diceva
«vince Samuel», cioè una classifica fra altri. Adesso è **il tuo winrate**,
ed è un pulsante: dietro c'è lo stesso numero **gioco per gioco**, che è la
domanda subito dopo.

- **Chi sono io al tavolo è il mio nome, e basta.** I partecipanti sono nomi e
  non account — al tavolo c'è quasi sempre qualcuno che sul sito non c'è, ed
  è una scelta che regge. Il prezzo è che l'unico modo di riconoscersi è il
  nick (o il nome del profilo se il nick manca), confrontato **appiattito**. Chi
  si segna con un altro nome non si trova, **e il sito lo dice** invece di
  inventare un numero.
- **`perc` nulla non è zero per cento.** «Non ho mai giocato a questo» e «ci ho
  giocato e non ho mai vinto» sono due cose diverse: la prima non mostra
  l'anello, la seconda lo mostra vuoto. Senza la distinzione il riquadro in cima
  direbbe 0% a chi non si è mai messo fra i giocatori, che è semplicemente
  falso.
- **Le partite in cui non c'ero non contano**, né sopra né sotto la frazione: se
  no il winrate scenderebbe ogni volta che gli altri giocano senza di me.
- **L'anello, non solo il numero.** Un numero si legge ma non si *confronta*
  scorrendo: la carica di un anello sì, ed è la prima cosa che l'occhio prende
  scendendo lungo una colonna. Il numero resta accanto, perché un anello dice
  «circa due terzi» e non «67%».
- **Il capo del tratto è piatto, non tondo.** A zero per cento un capo tondo
  disegna comunque un puntino, e un puntino si legge come «un pochino» — che è
  esattamente la cosa che non è vera.
- **La rotazione sta nel CSS** (`transform:rotate(-90deg)`), così l'SVG resta due
  cerchi concentrici e la corsa è la circonferenza: niente archi da calcolare, e
  nessun caso limite a 100% — che con un `path` sarebbe un arco di 360 gradi,
  cioè un arco che non si disegna.
- **Il dettaglio si apre sotto**, non in una finestra sopra: è il dettaglio di un
  numero che si sta già guardando, e sotto c'è ancora l'elenco da cui viene. La
  pastiglia resta dov'è e si accende, come l'imbuto e la libreria — è lo stesso
  gesto che la richiude.

**E il winrate si vede anche sul gioco.** Aprendo una scatola dalla libreria o una
riga dal catalogo, sopra la recensione compare l'anello con il tuo winrate su
**quel** titolo. È la stessa domanda del riquadro in cima alle partite,
ristretta a un gioco — e fatta nel momento in cui quel gioco lo si ha davanti,
che è quando interessa. Non compare se non ci hai mai giocato: un anello vuoto
si legge come «non ne ho vinta nessuna», che è un'altra cosa. Un blocco solo
(`bloccoWr`) per i due posti, se no sarebbero due cose che dicono la stessa cosa
in due modi.

**E la riga del gioco non può avvolgersi.** Con `flex-wrap:wrap` sulla riga, una
didascalia lunga («8 partite · vince Anna») non fa *stringere* il titolo: lo
manda a capo, e con lui tutto quello che segue — così la pastiglia finiva sotto
e gli anelli si sfilavano dalla colonna, che è l'unico posto in cui si
confrontano. Titolo e didascalia stanno in un involucro loro (`.gio-t`, che si
avvolge dentro di sé), la riga è `nowrap`, e il winrate resta sulla prima riga
qualunque cosa faccia il testo. Dove non ho mai giocato **il posto resta occupato
da uno `<span>` vuoto**: se no il chevron scivola addosso al testo. È la stessa
ragione della stellina in casa di un amico.

## Le partite hanno tre livelli, e si devono vedere

Sezione → gioco → partita. Erano tre riquadri tinti della stessa misura uno dentro
l'altro: aperta la sezione non si capiva se «Root» fosse un fratello di «Partite»
o un suo figlio.

Si scende di livello in **tre modi insieme**, perché uno solo non basta a farlo
leggere: un **rientro**, un **filo verticale** che dice a chi appartiene quel
rientro, e un **peso di testo** minore. Il fondo tinto resta solo al livello di
mezzo — il gioco — che è quello che si apre e si chiude.

**Vale per tutte le tendine, anche per Amici e Giocatori.** Erano gli unici due
cassetti del profilo in cui il contenuto partiva a filo del titolo: aperto
«Amici», le facce cominciavano esattamente dove comincia la parola Amici, e
niente diceva che stessero dentro. Il rientro va su `#blocco-amici` e
`#blocco-giocatori` e **non su `.pro-dentro`**, che vale per tutti e tre: sotto
Partite aggiungerebbe un livello a una cosa che i suoi livelli ce li ha già
dentro (`.gio-gruppo`, `.giocate`), e la partita finirebbe rientrata quattro
volte. I tre elenchi degli amici — chi ti ha chiesto, chi lo è, chi non ha
ancora risposto — prendono uno stacco fra l'uno e l'altro: attaccati si
leggevano come un elenco solo.

## Un pannello solo per la libreria

Erano due — «la stanza» (luce e colori) e «i tuoi mobili» (nome, crea, togli) —
aperti da due pulsanti diversi. Ma sono la stessa domanda: **com'è fatto quello
che sto guardando**. Adesso è uno, e va dal generale al particolare:

1. la **luce**, che è di tutta la stanza;
2. il **nome** di questo mobile, in chiaro perché è quello che lo distingue
   dagli altri e all'inizio si cambia spesso;
3. `modifica libreria` — legno, muro, pavimento, arredi;
4. `ordina librerie` — l'elenco, che si riordina trascinando;
5. **aggiungi una libreria** / **elimina questa libreria**.

Le due parti lunghe stanno in `<details>` perché **non si guardano insieme**:
chi rinomina non sta scegliendo un legno, e chi riordina non sta facendo né
l'una né l'altra cosa.

- **Si trascina dalla maniglia, non dalla riga.** La riga porta anche un pulsante
  che elimina, e un elenco dove ogni punto è buono per trascinare è un elenco
  dove ogni tocco rischia di spostare qualcosa.
- Mentre si trascina si riordina **solo il DOM**; al rilascio si manda l'ordine
  e si rifà la scena. **Cambiare l'ordine dei mobili sposta anche le scatole**:
  l'ordine è da che parte stanno lungo la parete, quindi `buildCabinet` e
  `applyLibrary` vanno richiamati.
- `LIB.riordinaLibrerie(ids)` è ottimista come quello dei giochi e scrive solo
  le righe che cambiano davvero.
- La porta è una sola: quella dell'imbuto è stata tolta. Due porte per la stessa
  stanza sono una di troppo.

### Il mobile di scorta non è un mobile, e il pannello deve saperlo

In fondo alla fila c'è **sempre un mobile in più** di quelli che esistono
(`disposizione` fa `librerie.length + 1`): è quello dove si trascina una scatola
per cominciarne un altro. Sullo schermo si vede come gli altri, ma una riga in
`librerie` non ce l'ha — e da lì venivano tre difetti che sembravano scollegati:

- **`elimina questa libreria` non funzionava.** Prendeva il mobile all'indice
  dello scroll: sulla scorta era `undefined` e il gesto usciva in silenzio
  («l'azione si completa ma non cancella niente»). E con **una** libreria vera
  sullo schermo se ne vedono **due**, quindi sulla vera arrivava «l'ultima
  libreria non si toglie» a chi non stava guardando l'ultima.
- **`libCorrente()` accostava all'ultimo mobile vero.** Stando sulla scorta,
  scegliere un legno ridipingeva il mobile **accanto**, e il pannello scriveva
  il nome di un mobile che non era quello inquadrato. La guardia
  `if (!L) flash('nessun mobile da arredare')` c'era già, e non poteva mai
  scattare.
- **Scorrendo, il pannello aperto rinfrescava solo legno e arredi**, non il
  campo del nome: si scorreva alla libreria 3 e il campo diceva ancora
  «Libreria 1».

**E adesso si vede anche che non è un mobile.** Restava il difetto più grosso:
in scena la scorta era disegnata **identica** a una libreria vera, stesso legno e
stessi arredi dentro. Chi ne aveva una sola ne vedeva due, e quando il pannello
gli diceva «nessun mobile qui» sembrava un guasto — è arrivato come segnalazione,
in questi termini esatti. Ora è **un'ombra di mobile**: stessa forma, così i cubi
restano un bersaglio riconoscibile per il trascinamento, ma trasparente
(`matsFantasma`), senza ombra propria, **senza arredi dentro** e con la targhetta
che dice «nuova libreria». Gli arredi erano la metà del problema: attraverso i
ripiani trasparenti sembravano galleggiare, e una vetrina piena di roba è peggio
di un mobile finto.

**E il mobile va ricostruito anche quando cambia quante librerie sono VERE**, non
solo quante se ne vedono in fila. I due numeri non vanno di pari passo:
`disposizione()` restituisce `max(librerie + 1, ceil((giochi + 1) / 12))`, e con
trentasei giochi il secondo termine è **4** — quindi passando da una libreria a
due il totale resta 4 e `applyLibrary` non ricostruiva niente. Finché tutti i
mobili erano disegnati uguali non importava; da quando quello di scorta è
un'ombra, la libreria appena creata restava disegnata come la scorta di un
attimo prima — trasparente e vuota. Per questo `state.libsVere` sta accanto a
`state.libs` nella condizione di ricostruzione. È il difetto che si vedeva come
«ho aggiunto una libreria e il primo posto resta vuoto».

**E i nomi non si contano con `librerie.length`.** `creaLibreria` usava quel
numero sia per il nome sia per l'`ordine`: dopo una cancellazione era già stato
usato, e si finiva con tre «Libreria 3» tutte con lo stesso `ordine`. Adesso
l'ordine è uno più del massimo che c'è, e il nome sale finché non ne trova uno
libero.

Adesso `libCorrente()` **può rispondere `null`, ed è il punto**: chi chiede deve
poter sapere che lì non c'è niente. Il campo del nome si spegne con un
segnaposto, `#st-quale` dice «nessun mobile qui», ed `elimina` **si spegne e
spiega perché nel `title`** invece di fallire dopo il clic — vale anche quando è
l'unica libreria rimasta. Il pannello si rimette in pari da `sincronizzaPannello()`,
chiamata da `updateRail()` **solo quando cambia il numero intero** del mobile: su
`state.scroll` girerebbe a ogni fotogramma e cancellerebbe quello che si sta
scrivendo nel campo. E l'elenco dei mobili **non si rifà** per spostare
l'evidenziazione — si sposta la classe in posto, se no si staccherebbe la riga
che si sta trascinando per riordinare.

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

## L'ombra dentro i cubi

Il mobile si leggeva piatto: dodici rettangoli scuri in una griglia, non
dodici vani. Mancava l'occlusione ambientale — la luce che negli angoli non
arriva — e senza, un cubo vuoto e una toppa scura sono la stessa cosa.

Una SSAO vera vorrebbe una passata di post-produzione, cioè l'opposto di
quello che serve qui. Invece **si dipinge**, e si dipinge in un posto solo: lo
**schienale**, che è una tavola unica per tutto il mobile. Una texture, un
materiale, e **zero chiamate di disegno in più**.

- `ART.aoCubi(canvas, celle)` scurisce ogni cella verso i suoi bordi. Il bordo
  **alto è il più scuro** (la luce viene da sopra e il ripiano la ferma), il
  **basso il più chiaro** (il fondo del cubo rimanda su un po' di luce), i lati
  stanno in mezzo. Negli angoli le sfumature si sommano, ed è esattamente dove
  un'occlusione è più fitta.
- **Le celle escono dalle stesse costanti che costruiscono il mobile**
  (`celleCubi()`): lo schienale è largo `LIB_W - 2t` e alto `LIB_H - 2t`, cioè
  esattamente l'interno, quindi tre colonne da `cell` separate da un montante da
  `t` cadono al pixel giusto per costruzione. Verificato: l'ultima cella finisce
  a 1.0000.
- **L'ombra NON va nel bump map.** Il rilievo viene dalla venatura: un'ombra è
  luce che manca, non legno che sporge, e messa anche nel bump scaverebbe un
  fossato lungo ogni bordo. Per questo `makeWoodMat` dipinge su una **copia**
  (`ART.copia`) e il bump resta la tavola nuda.
- Si misura a numeri, non a occhio: dipinta su bianco, il centro di una cella
  resta a **255**, il bordo alto scende a **114**, il basso a **195**, l'angolo
  alto a **70**.

## Quello che costa un fotogramma

Misurato avvolgendo il contesto WebGL e contando i draw call divisi per
framebuffer, non a occhio. Da qui sono nate le due ottimizzazioni sotto.

Com'era: **574 draw call per fotogramma per 5.794 triangoli** — dodici triangoli
a chiamata. Il collo di bottiglia non è mai stata la geometria, era l'overhead:
152 mesh, **224 materiali** (più dei mesh), 152 geometrie, niente condiviso.

Dov'è arrivato, sulla stessa scena: **201 elementi da disegnare per 151 mesh**,
98 materiali, 43 geometrie — e a riposo la passata d'ombra non c'è proprio.

### Le ombre si ridisegnano solo se qualcosa si è mosso

**316 di quei 574 erano la passata d'ombra**: la scena intera ridisegnata una
seconda volta dentro una mappa 2048×2048, sessanta volte al secondo, per
ottenere un'ombra identica a quella del fotogramma prima. Il mobile sta fermo,
gli arredi stanno fermi, e la luce di finestra segue `camBase` — che cambia solo
scorrendo fra le librerie, non con l'ondeggio della camera, che muove
`camera.position`.

Quindi `renderer.shadowMap.autoUpdate = false`, e la mappa si rifà su
prenotazione: `rifaiOmbre()`. A riposo si scende a **265 draw call**, e i pixel
sono **identici** — verificato leggendo il framebuffer con e senza aggiornamento
forzato: scarto 0 su 192 valori.

**Chi muove qualcosa deve chiamare `rifaiOmbre()`**, se no resta con l'ombra
della posa di prima. Oggi lo fanno: le animazioni in coda, la presa, lo
scorrimento, `updateBoxes` (l'alzata dell'hover è smorzata e continua per
qualche frame dopo il puntatore, per questo torna un booleano), e ogni
ricostruzione — `buildCabinet`, `buildProps`, `applicaLuce`, `layout`.

Prenota **due** fotogrammi e non uno: l'ultimo passo di un tween porta l'oggetto
nella posa finale nello stesso frame in cui l'animazione esce dalla coda, e con
una prenotazione sola quella posa resterebbe senza la sua ombra.

### Geometrie e materiali in comune

Dieci dadi sono lo stesso dado, ogni pianta ha otto foglie che sono la stessa
foglia, cinquanta cornici avevano cinquanta materiali identici per il bordo. Ora
c'è `comune(chiave, fai)`: si costruisce una volta e si riusa, e **la misura la
fa `scale`** — un cubo unitario scalato è la stessa identica forma, e le UV di un
box sono per faccia, quindi anche la texture cade dov'era. Da **224 materiali a
113** e da **152 geometrie a 60**, sulla stessa scena.

Vale soprattutto per le texture: i dorsi dei libri sono sei tinte e le copertine
di contorno cinque disegni, ma erano un canvas disegnato e caricato sulla scheda
**per ogni singolo oggetto, a ogni `buildProps`** — cioè a ogni lettera scritta
nella ricerca.

**Trappola, ed è quella che si paga cara:** `killGroup` libera geometrie e
materiali del gruppo che butta via. Quello che è in cache va segnato `__comune`
e saltato, se no la prima ricerca lo porta via *a tutti*. E il guasto non si
vede: three.js ricostruisce da sé quello che gli serve, quindi non compare
niente di rotto — si ricomincia solo a pagare l'upload a ogni fotogramma.

Non è stato tolto niente da quello che si vede: gli arredi continuano a
proiettare ombra, le tele dei quadri restano una per quadro perché sono diverse
apposta, e la luce di focus a intensità zero resta in scena (è quella che si
accende aprendo una scatola, non una luce morta).

### Un box a sei gruppi sono sei chiamate, anche con quattro facce uguali

three.js emette un elemento da disegnare per ogni **gruppo** di una geometria,
non per ogni materiale. Un `BoxGeometry` con un array di materiali ne ha sei, e
li disegna tutti e sei anche quando quattro facce hanno lo stesso identico
oggetto materiale. Erano le cornici (`[bordo ×4, tela, bordo]`), i fondi delle
scatole (`[card ×4, inMat, card]`) e i coperchi: **40 oggetti che costavano 252
chiamate delle 362 della scena.**

`cuboRaggruppato(slot)` riordina gli indici per slot, così le facce che
condividono il materiale finiscono in un gruppo solo. `slot` dice, per ognuna
delle sei facce nell'ordine di `BoxGeometry` (+X, −X, +Y, −Y, +Z, −Z), quale
materiale dell'array le tocca. Ne escono due geometrie condivise: `cubo5+1`
(cinque facce uguali e il fronte diverso) e `cubo2+2+1+1` (il coperchio:
fianchi, teste, copertina, fondello). Quei 40 oggetti ora costano **80**.

La geometria è la stessa — verificato confrontando l'insieme dei triangoli con
un `BoxGeometry` appena costruito — e cambia solo l'ordine in cui si disegnano.
Dentro la passata opaca quell'ordine lo decide lo z-buffer, non la fila.

### Un dado non ha sei materiali

Costava sei chiamate a testa. Le sei facce vanno in un **atlante 3×2**
(`atlanteDado`) e `geoDado` riscrive le UV del cubo perché la faccia *i*-esima
legga la cella *i*-esima. Tre coppie di colori, tre texture, tre materiali per
tutti i dadi di tutte le librerie. La `v` va contata dal basso: `CanvasTexture`
capovolge l'immagine al caricamento.

Il margine per le mipmap c'è già senza doverlo aggiungere: i pallini stanno a
ventidue pixel dal bordo della faccia, quindi rimpicciolendo quello che si
mescola fra una cella e l'altra è **fondo con fondo**.

L'ordine delle facce (`[3,4,1,6,2,5]`, con le opposte che sommano a sette) è
passato da `art.js` ad `app.js`: `ART.dieMaterials` non c'è più.

### Come si verifica che non è cambiato niente

Il conteggio degli elementi da disegnare si legge dal **grafo di scena**, senza
bisogno di un solo fotogramma: materiale singolo → uno, array → uno per gruppo.
Serve quando il pannello non compone (basta agganciare `Object3D.prototype.add`
e far ricostruire gli arredi con una ricerca, che è sincrona).

Per i pixel, invece, **il confronto va tarato sul suo rumore di fondo**:
`ART.grain()` usa `Math.random()`, quindi due caricamenti dello stesso identico
codice non danno mai la stessa immagine. Fra ieri e oggi lo scarto massimo su
una griglia 16×16 è stato **1,29**; fra due caricamenti dello stesso codice
**1,27**. Senza il secondo numero il primo non vuol dire niente.

L'atlante dei dadi si verifica meglio a numeri che a occhio, che su un dado da
venti pixel non arbitra: si controlla che le UV di ogni faccia cadano dentro la
sua cella, e si contano le macchie scure di ogni cella filtrando per area (un
pallino ha raggio 12, cioè circa 450 pixel — sotto quella soglia è grana).
Devono venire `[3,4,1,6,2,5]`.

## Sessanta fotogrammi: dov'erano già, e cosa restava

Misurato prima di toccare niente, che qui è la regola: **160 fps, CPU 0,3 ms
mediana e 0,5 al novantacinquesimo, 80 chiamate di disegno per fotogramma.** Su
questa macchina i sessanta erano già superati di due volte e mezza, e il ciclo
era già magro — le ombre si rifanno su prenotazione, geometrie e materiali
sono in comune, il pixel ratio è già limitato a 2.

Quello che restava riguarda le macchine deboli, non questa:

- **L'antialiasing si spegne dove i pixel sono piccoli.** Su uno schermo a
  densità 2 o 3 — cioè ogni telefono — la scalettatura la mangia già la
  densità, e MSAA costa una passata a risoluzione multipla su tutta la scena.
  È il conto più salato che si possa pagare per una cosa che lì non si vede.
- **La mappa d'ombra scende a 1024 sotto i 720 px** di lato corto. La passata
  d'ombra è la scena intera ridisegnata dentro quella mappa: a metà lato costa
  un quarto dei pixel, e su cinque pollici la differenza non la vede nessuno.
- **Il raycast solo quando serve.** `pick()` girava su tutte le scatole a ogni
  fotogramma, anche con il puntatore fermo e la scena ferma — cioè quasi
  sempre. Ora c'è `mirinoSporco`, che lo segnano il puntatore che si muove, la
  camera che scorre e le scatole che si spostano: sono i soli casi in cui la
  risposta può essere un'altra.

Dopo: **160 fps, 80 chiamate, CPU 0,4 ms mediana e 1,1 di picco.** Sulla
macchina di prova non cambia niente, ed è giusto così: qui non c'era niente da
guadagnare. I tre interventi valgono dove il conto si paga davvero.

## Misurare invece di guardare

Quattro tecniche che in questa sessione hanno cambiato la diagnosi, non solo
confermata. Costano poco e si rifanno.

### Contare i draw call divisi per passata

Si avvolgono `gl.drawElements`, `gl.drawArrays` e **`gl.bindFramebuffer`**: ogni
`bind` apre una passata, e i disegni si contano dentro quella. È così che è
saltato fuori che **la passata d'ombra era il 55% del lavoro** — a occhio non si
sarebbe mai visto.

Attenzione: se la passata non c'è, non c'è nemmeno il `bind`, e una sonda che
conta solo fra un `bind` e l'altro **perde tutto**. Serve anche un totale.

Il numero di elementi da disegnare si può leggere anche dal **grafo di scena**,
senza un solo fotogramma: materiale singolo → uno, array → uno per gruppo. Utile
quando il pannello non compone.

## Un cubo tiene una scatola sola, e il database lo fa rispettare

`giochi_posto_unico` è un indice unico su `(libreria, posto)`. Da questo
discendono due difetti che sembravano scollegati e sono lo stesso.

**Lo scambio di due scatole falliva.** `mandaPosti` mandava gli update **in
parallelo**: in uno scambio le due righe rivendicano per un istante lo stesso
cubo, una arriva prima, e Postgres risponde `23505 duplicate key value violates
unique constraint «giochi_posto_unico»`. Chi trascinava un gioco sopra un altro
vedeva un errore invece di vederli scambiati. Verificato in tutti e due i modi
contro il database vero: in parallelo l'errore c'è, in due tempi no.

Adesso è **in due tempi**: prima si sfilano tutte dall'indice (`posto` nullo,
che l'indice non guarda), poi si scrive dove vanno davvero. Vale per qualunque
scrittura futura su una colonna con un indice unico: **un vincolo non guarda
l'intenzione, guarda lo stato in quell'istante.**

**E una posizione rifiutata non tornava indietro.** Le scritture qui sono
ottimiste, ma questa non aveva rollback: la scatola restava dove l'avevi
trascinata e in memoria due giochi rivendicavano lo stesso cubo — una
situazione che sul **database non può nemmeno esistere**. Da lì in poi la scena
mostrava cose che il server non aveva, e finivano anche in `localStorage`. Ora
`mandaPosti` fotografa il prima e lo rimette, con `onRipristino()` a rimettere in
pari la scena.

## Quando non c'è posto si fa un mobile

Dodici cubi per libreria, e basta. Se i giochi in vetrina erano di piu' dei
posti, l'eccedenza finiva **nel mobile di scorta** — quello in piu' che si vede
sempre in fondo alla fila e che sul database non esiste. È arrivato come
segnalazione, con lo screenshot di due scatole dentro «nuova libreria».

La risposta è quella che darebbe chiunque: **quando lo scaffale è pieno se ne
prende un altro.** Vale in tutti e tre i punti in cui un gioco cerca posto:
`mettiSuScaffale`, `collocaNuovo`, e la riparazione all'avvio.

- `cuboLibero(presi)` cerca il primo cubo libero della fila e, se non ce n'è
  nessuno, **crea un mobile**. Contare prima quanti ne servono non basta: fra il
  conto e l'assegnazione qualcosa può cambiare, e restare senza posto vuol dire
  che un gioco esce dalla vetrina senza che nessuno l'abbia chiesto.
- `riparaPosti()` gira all'avvio e rimette in ordine tre guasti: due giochi sullo
  stesso cubo, un `libreria` che punta a un mobile cancellato, e piu' giochi in
  vetrina che cubi. Dei dati storti restano storti finche' qualcuno non li
  guarda, e intanto la scena mostra scatole in un mobile che non c'è.
- Non può fermare l'avvio: è dentro un `try`. Vedi la regola sugli agganci.

## Le luci dei vani seguono la stanza

Abbassando la luce **la colonna centrale restava accesa**. Le quattro luci di
fila sono deboli e servono a far risaltare le copertine dentro i cubi, ma
**seguono la camera** — quindi stanno sempre sul mobile che si sta guardando —
e `applicaLuce()` le aveva dimenticate: scalava emisferica, ambiente, finestra,
riempimento ed esposizione, non loro. A luce minima erano le uniche accese.

Adesso `luceVani` si calcola in `applicaLuce` (non nel ciclo, che gira sessanta
volte al secondo) e il ciclo la usa. Misurato leggendo i pixel: al minimo la
differenza fra la colonna centrale e le laterali è **6 su 255**.

## Un aggancio che salta non si porta via gli altri

In fondo a `boot()` c'erano dieci chiamate in fila — `bindInput()`,
`bindTools()`, ... — e **la prima che lanciava un'eccezione lasciava
scollegate tutte quelle dopo**. Peggio: non si arrivava nemmeno a
`requestAnimationFrame(frame)`, quindi la scena restava ferma sul
caricamento.

Non è un caso di scuola, ed è arrivato come segnalazione: «non funziona
più il tasto della modifica estetica». Il listener di `#edit` sta dentro
**`bindInput()`**, che gira **per primo**; `bindStanza()` e `bindLibrerie()`
— cioè il pannello che cambia legno, muro e arredi — girano nove righe
piu' sotto. Basta un `index.html` nuovo e un `js/app.js` vecchio in cache
(vedi la nota qui sotto) perche' `q('#edit')` torni nullo, `addEventListener`
esploda, e sparisca un pannello che non c'entra niente.

Adesso ognuno è avvolto per conto suo, e **chi non si aggancia lo dice**
(`msg.aggancioNo`, che suggerisce anche il ricaricamento senza cache): un
pezzo di interfaccia muto senza spiegazione è peggio di un pezzo rotto che
si lamenta. La regola vale per qualunque sequenza di agganci futura.

### Il browser dell'anteprima tiene in cache anche i `.js`

Era già scritto per il CSS; vale **identico per il JavaScript**. `python
http.server` manda solo `Last-Modified`, senza `Cache-Control`, e il browser si
tiene la sua copia per euristica: si modifica un file, si ricarica, e gira
ancora il codice di prima — con l'aggravante che `fetch` dello stesso file
mostra la versione **nuova**, quindi sembra che il problema sia altrove.

Si sblocca così, da console:

```js
Promise.all([...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
  .concat([...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')))
  .map(f => fetch(f, { cache: 'reload' }))).then(() => location.reload());
```

`cache:'reload'` va in rete **e aggiorna la cache HTTP**: al ricaricamento
successivo i `<script>` prendono la versione giusta.

### Tarare un confronto di pixel sul suo rumore di fondo

`ART.grain()` usa `Math.random()`: **due caricamenti dello stesso identico codice
non danno mai la stessa immagine.** Uno scarto di 1,29 su una griglia 16×16 non
vuol dire niente finché non si misura anche quello fra due caricamenti uguali —
che è venuto 1,27. Senza il secondo numero il primo non è una prova.

### Il baricentro dell'inchiostro, non il rettangolo

Per centrare una figura: si disegna nera su bianco e si contano i pixel. Il
meeple aveva l'**ingombro** centrato a 0,494 e il **baricentro** a 0,524 — le
gambe sono piene e la testa è piccola, quindi la massa sta in basso, ed è la
massa che l'occhio legge. Il rettangolo diceva «centrato» mentre non lo era.

### Verificare un atlante a numeri

Su un dado da venti pixel l'occhio non arbitra. Si controlla che le UV di ogni
faccia cadano dentro la sua cella, e si contano le macchie scure per cella
**filtrando per area** (un pallino ha raggio 12, cioè ~450 px: sotto quella
soglia è grana). Devono venire `[3,4,1,6,2,5]`.

## Due trappole del CSS che sono costate tempo

- **`background:` è una scorciatoia e riazzera quello che non nomina**,
  `background-clip` compreso. Se serve toccare solo il colore, `background-color`.
- **`box-sizing:border-box` + bordi grossi = scatola di riempimento a zero.** Una
  riga alta 4 px con 12 px di bordo trasparente per lato non ha spazio interno:
  con `background-clip:padding-box` la traccia semplicemente non esiste. L'area
  da toccare col dito si fa con l'altezza dell'elemento, e la riga sottile con un
  `::before`. Due mestieri, due cose.
- **`.dentro-only` è `display:inline-flex !important`** e vince su qualunque
  regola che provi a nascondere un comando in una schermata sola.
- **Un id batte una classe**: `.primario` su un pulsante che ha già una regola
  `#suo-id` non fa niente. Le classi di livello si dichiarano `button.primario`,
  e dentro i pannelli con id anche `#pannello button.primario`.

## Quello che il pannello di anteprima fa e non si vede

Oltre alle trappole già elencate sopra, in questa sessione:

- **l'intro non finisce.** I frame arrivano col contagocce, i tween non arrivano
  mai a `p >= 1`, e `state.phase` resta `intro` per parecchi minuti: tutto quello
  che gira solo in `browse` non parte. Si sblocca pompando screenshot, oppure —
  se serve una prova pulita — con un gancio `__dbg` temporaneo che salta l'intro.
- **la sessione Supabase può scadere a metà lavoro.** È capitato: le chiavi
  `dado-*` di `localStorage` restano, il token no, e il sito torna al cancello.
  Rientrare tocca all'utente, e da lì in poi si verifica quello che si può senza
  sessione (disegnare su canvas, leggere gli stili calcolati).
- **una prova con eventi sintetici può mentire due volte**: gli elementi presi
  prima di un ridisegno sono **staccati** e non reagiscono più, e i clic
  sintetici non generano i `click` che un `pointerup` vero genera. Se un caso
  «non fa niente», rileggere gli elementi prima di dare la colpa al codice.

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

## Le due fasce libere, e chi ci sta dentro

Sopra il mobile e sotto il mobile restano due fasce, e ci vivono tutti i comandi
che galleggiano: in alto la lampada, la targa col nome e l'imbuto; in basso il
binario. **Stanno centrati sulle due guide** — `--y-alto` e `--y-basso`, che
`allineaComandi()` mette a meta' fra la testata e la cima del mobile, e fra il
piede del mobile e la barra in basso. Centrati su un punto medio vuol dire
equidistanti per costruzione: non c'e' niente da tarare a mano.

Quello che si tara e' **quanto sono larghe quelle fasce**, cioe' il margine
attorno al mobile in `layout()`. Era cosi' stretto sui formati alti (`.3`) che la
libreria toccava i due bordi dello schermo: bella e senza un posto dove mettere
niente, con il binario addosso al piede del mobile. Adesso e' `.62` in verticale
e `1.0` in orizzontale. Si paga in mobile piu' piccolo, ed e' il prezzo giusto:
e' quello che si fa indietreggiando di un passo per guardare uno scaffale.

Misurato dopo: su un telefono **42 px sopra e 42 sotto** i pulsanti in alto,
**29 e 29** attorno al binario; su un monitor 57/57 e 62/61.

### La camera va messa al suo posto PRIMA di misurare

Costato un giro, e si vedeva **solo dopo un ridimensionamento**. `layout()`
sposta `camBase`, ma la camera vera la muove `frame()`, al fotogramma dopo — e
`allineaComandi` proietta con la camera di adesso. Misurando con quella vecchia,
le due guide e la quota della targa uscivano da un quadro che non esisteva piu':
il nome del mobile finiva novanta pixel sopra i pulsanti che gli stanno accanto,
mentre i pulsanti (che leggono le guide dal CSS) restavano dov'erano.

Su una pagina appena caricata non si vedeva mai, perche' li' la camera era ferma
al suo posto da un pezzo. **Chi misura una proiezione deve prima assicurarsi che
la camera sia quella con cui si disegnera'.**

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

### La tavolozza: sei tinte, e basta

`--bg #cfccc8` (grigio caldo, la stanza) · `--card #f2f1ed` (le schede) ·
`--ink-soft #747760` (oliva) · `--sage #a6a89c` · `--sand #c7af98` ·
`--wood #8e6a4b` · `--accent #c86a3c` (terracotta: **tutto quello che si tocca**).

`--ink #33352b` è **l'unica derivata**, e c'è un motivo: l'oliva della tavolozza
sul fondo fa 2,6 a 1 di contrasto, cioè illeggibile per un testo. È lo stesso
colore portato al buio quanto basta — 8,5 a 1 — e resta della stessa famiglia.

`--bg` deve restare **uguale a `SFONDO`** in `js/app.js`. Le tavolozze della
stanza (`js/stanza.js`) escono dalle stesse sei tinte: un mobile di un colore che
non esiste da nessun'altra parte del sito era metà del problema.

### Un font solo

**Poppins**, cinque pesi, in `fonts/`, licenza OFL, committato — niente risorse
esterne, mai. È anche il font disegnato su canvas (`FF` in `js/art.js`), quindi
`document.fonts.ready` va aspettato **prima** di generare le texture.

**La gerarchia la fa il peso, non la famiglia.** Prima ce n'erano due e ogni
schermata sembrava composta da due mani diverse.

Attenzione alle misure: sono nate su Bebas Neue, che era **condensato**. Poppins
è di larghezza normale e agli stessi px occupa molto di più. Le regole che usano
`--ff-display` stanno a **0.72** delle misure originali. Chi ne aggiunge una parta
da lì, non dai numeri vecchi.

### I comandi: un posto solo che decide come è fatto un pulsante

In fondo al foglio c'è la sezione **I COMANDI**. Prima ogni pulsante aveva il suo
bordo da un pixel, il suo maiuscolo e la sua spaziatura: dodici dialetti nella
stessa pagina, ed **è quello — non i colori — che faceva sembrare il sito di
dieci anni fa**.

Tre livelli soli, come sulle piattaforme Apple: **pieno** (terracotta, l'azione
principale), **tinto** (terracotta al 10-18%, le secondarie), **nudo** (solo
testo). Più il rosso, per quello che distrugge, che resta in due tempi.

- **Niente maiuscolo forzato e niente spaziatura larga sui comandi.** Un pulsante
  si legge come una frase. Sono state ripulite 35 regole: il maiuscolo tracciato
  resta solo alle **etichette** di sezione, dove è un'etichetta e non un comando,
  e anche lì la spaziatura è scesa a .07em.
- **Il peso fa la gerarchia, non il bordo.** Un filo attorno a ogni cosa rende
  tutto ugualmente importante, cioè niente.
- **Bersagli da 44 px sul tocco** (`@media (pointer:coarse)`), che è la misura di
  un dito.
- **La pressione si vede**: `scale(.96)`, e il ritorno più lento della partenza.
- Raggi in scala: `--r-s` comandi, `--r-m` schede, `--r-l` il pannello.

**L'icona di un comando descrive il comando, non la sua prima riga.** Il pannello
della libreria si apriva con una **lampadina**, che era giusta quando quel
pannello era «la stanza»: adesso fa luce, nome, aspetto e ordine di tutti i
mobili, e la luce è solo la sua prima riga. Ora è una **libreria a cubi 2×2 con
i piedi** — lo stesso disegno di «vai allo scaffale», perché due comandi che
portano allo stesso oggetto portano la stessa figura.

**Un gesto solo si dice con un segno, non con una parola.** Nel catalogo il
pulsante che aggiunge un gioco era «in libreria»: su una riga che si scorre una
pastiglia di testo ruba larghezza al titolo, che è la cosa che si sta leggendo.
Adesso è un **«+»**, e diventa una **spunta** quando ce l'hai già; cosa faccia
per esteso sta nel `title`.

**Uscire è un'azione importante, e si vede.** Il tasto in fondo al profilo aveva
la faccia di un comando qualunque. Ora è **rosso** come tutto quello che ha
conseguenze e sta in fondo a **destra**, dove il sito mette già l'azione di ogni
piede di pannello — e resta in due tempi.

**Quello che galleggia sulla scena è una superficie, non una tinta.** Un fondo
tinto al 10% funziona dentro una scheda chiara; sopra la stanza, che è già color
crema, sparisce. Imbuto, lampada, contatore e binario sono carta chiara con
sfocatura dietro e ombra leggera.

### Tre livelli con un nome, e niente componenti vecchi in giro

`.primario` (terracotta, l'azione) · `.secondario` (grigio tenue) ·
`.distruttivo` (rosso, in due tempi). Chi aggiunge un pulsante **sceglie che
cos'è** invece di copiare lo stile del vicino.

Vanno scritti `button.primario` e non `.primario`: le regole di contorno tipo
`.add-foot button` pesano una classe più un elemento e vincerebbero. Stesso peso
più la posizione in fondo al foglio, e nessun `!important` — che qui vorrebbe
dire rinunciare a poter fare eccezioni più avanti.

**I componenti vecchi non esistono più**: 55 blocchi di comando e 4 di campo
sono stati ripuliti alla fonte dal bordo da un pixel e rimessi nei raggi. Se ne
trovi ancora uno squadrato, è rimasto indietro — non è una variante.

### Il piede di un pannello, non una croce in un angolo

`annulla` a sinistra, l'azione a destra, la riga in fondo. Vale per i gruppi,
per la partita e per qualunque pannello futuro.

Attenzione a cosa promette «annulla». Nel pannello dei gruppi **tutto è già
salvato mentre lo fai**, quindi lì annulla butta via solo il nome che stavi
scrivendo nel campo del gruppo nuovo: un pulsante che promettesse di disfare il
resto direbbe una bugia. Nella partita invece c'è un modulo vero, e annulla
chiude senza salvare.

### Quello che non si leggeva

Tre cose segnalate insieme, e la stessa lezione dietro due di loro: **un testo
piccolo non può anche essere tenue**.

- **Via il capolettera della recensione.** Era un `::first-letter` in float alto
  trentaquattro pixel, di un altro colore: prendeva il punto in cui si comincia
  a leggere e lo spezzava in due, con le prime righe che giravano attorno. Su
  una recensione di poche righe si mangiava mezzo capoverso. Una recensione è
  un testo da leggere, non un frontespizio.
- **Le etichette dei riquadri** («giocatori», «minuti») stavano a **nove
  pixel**, maiuscole, spaziate e nell'oliva tenue: sul grigio del riquadro fanno
  poco più di tre a uno, sotto la soglia per un corpo così piccolo. Adesso
  sono a 10,5 px, minuscole, poco spaziate e più scure. Stessa correzione su
  `.cat-spec`, che è la stessa cosa nell'elenco e nel catalogo.
- **Il tasto chiudi era finito nel livello «tinto»** insieme agli altri
  comandi, cioè terracotta al 10%. Un fondo al 10% funziona dentro una scheda
  chiara, ma nell'angolo di un pannello che sta già su carta non si vede: e
  chiudere la scheda è la prima cosa che si cerca per uscire. È lo stesso
  principio già scritto per l'imbuto e il binario — **quello che galleggia è
  una superficie, non una tinta** — e vale a maggior ragione per un comando
  appoggiato su un altro pannello. Adesso è pieno, e sta fuori dalle liste del
  livello tinto.

### Il cartello di casa d'altri

Era un rettangolo squadrato con dentro un blocco terracotta grande quanto metà
cartello: su un telefono il pulsante andava a capo — «torna / alla tua» — e
il cartello si sbilanciava. Adesso è **una pastiglia sola**, come tutto quello
che galleggia sulla scena: carta velata con la sfocatura dietro, il testo che si
stringe con l'ellissi se il nick è lungo, e il pulsante che **non si stringe
mai** — è l'uscita, e un'uscita non va a capo.

- Le misure stanno **in fondo al foglio**, dopo la sezione I COMANDI: il livello
  «pieno» arriva dopo il blocco di `#visita` e gli riscriverebbe corpo, peso e
  imbottitura.
- La freccia sta **fuori da `data-i18n`**: quell'attributo scrive in `innerHTML`,
  e con la chiave sul pulsante il disegno sparirebbe al primo cambio di lingua.
  È la stessa lezione di `#p-pref`.

### La pastiglia dice qual e' quella scelta, non che sono pulsanti

Nella barra in basso **ogni** voce aveva il suo fondo grigio con gli angoli
tondi: quattro pastiglie in fila, e fra l'una e l'altra spuntavano gli spigoli
della barra. Il fondo tondo serve a dire **quale** stai guardando, quindi ce
l'ha solo quella — in terracotta, come tutto il resto di quello che conta.
Le altre sono testo su carta.

### Bianco su terracotta a dodici pixel non si legge

Il pulsante per tornare a casa propria faceva **poco piu' di tre a uno**, sotto
la soglia per un testo cosi' piccolo, ed era il motivo per cui restava
illeggibile anche dopo averlo rifatto. Adesso il fondo e' `--ink`: oltre dieci a
uno, e per un'uscita e' anche il tono giusto.

Vale in generale: **`#fff` su `--accent` regge a quattordici pixel in grassetto e
non regge a dodici.** Dove serve un comando piccolo, il fondo va scuro.

### Il nome del mobile e' una scritta, e il colore lo scegli tu

Il nome sta **sulla parete**, e la parete cambia colore: la luce si abbassa
fino a spegnerla quasi del tutto. Ci sono passate tre versioni prima di tornare
al punto di partenza, e vale la pena averle scritte tutte e tre.

1. Testo scuro dipinto sulla parete. Spariva sul muro scuro.
2. Lo stesso testo con un **alone chiaro** dietro. Regge, ma si vede che e' un
   ripiego: si nota l'alone e non si capisce cosa sia.
3. Una **targa** di carta con gli angoli tondi, l'ombra e l'icona della libreria.
   Risolveva la leggibilita' e ne apriva altri tre problemi: e' un'immagine di
   testo accanto a testo vero (e si vede che e' piu' morbida), pesa troppo per la
   riga in cui sta, e l'icona era la stessa del pulsante a cinquanta pixel di
   distanza.

**Il problema non era il fondo, era il colore.** Una scritta che sparisce su un
muro scuro non si aggiusta mettendole un foglio sotto: si aggiusta scrivendola
chiara, che e' quello che si fa in una stanza vera. Quindi la scritta e' tornata
nuda — senza bordo, senza ombra, senza icona — e il colore e' una scelta
nel pannello, accanto a muro e pavimento.

- Sta in `profili.stanza` come luce, muro e pavimento: **e' della stanza, non del
  singolo mobile.** Due nomi di colore diverso sulla stessa parete non si
  leggono come due nomi, si leggono come un errore. E' un jsonb, quindi non
  serve nessuna migrazione.
- La tavolozza non serve a decorare, serve a farsi leggere: il molto scuro e il
  molto chiaro ai due capi — che sono quelli che rispondono ai muri estremi —
  e in mezzo le tinte del sito.

**E qui il peso 600 ci vuole, contro la regola generale.** Il foglio dice da un
pezzo che la spaziatura larga e i pesi alti vengono dai tempi del condensato, e
per i comandi e' vero. Questa scritta pero' e' un caso a parte: sta sul muro,
e' piccola e **non ha niente sotto** — niente targa, niente alone, niente
riquadro. Portata a peso 400 era diventata sottile, e per compensare l'avevo
fatta crescere finche' non pesava piu' del mobile di cui dice il nome.
**Meglio piccola e piena che grande e magra**, e la fetta di schermo e' tarata
per rendere la misura che aveva quando era un piano di dimensione fissa.
- `normalizza()` riempie il valore per chi non l'ha mai scelto, quindi le stanze
  gia' salvate continuano a vedere l'inchiostro di sempre.

**E chi ricostruisce il mobile deve riscalare la targa.** Il piano si costruisce
a `TARGA_ALT`, che e' una misura di riferimento e non quella che si vede: la
misura vera la decide `allineaComandi`. `buildCabinet` non la chiamava, quindi
dopo ogni ricostruzione il nome restava a scala 1 — cioe' alla vecchia misura
fissa, molto piu' piccola — fino al primo scorrimento o ridimensionamento.

Si vedeva **rinominando**: si salvava il nome e la scritta rimpiccioliva di
colpo. Ma valeva per ogni ricostruzione: anche cambiare legno o aggiungere una
libreria. La regola: **chi costruisce a una misura di riferimento deve chiedere
subito la misura vera a chi la sa**, se no il valore di comodo resta a schermo.

### Quello che galleggia su una stanza che si spegne

Il binario e il contatore erano carta al 90%. Va bene su una stanza chiara; con
la luce al minimo la stanza diventa quasi nera e sotto la carta traspariva il
buio. Sono opachi, con la sfocatura dietro e un'ombra piu' decisa.

Il **nome della libreria** invece sta nella scena, dipinto su canvas, e sul muro
scuro spariva: adesso `targhetta()` gli mette dietro un **alone chiaro** (tre
passate di `shadowBlur`, che si sommano). L'alone e' luce, quindi su un muro
chiaro non si vede e su uno scuro fa da foglio sotto le lettere.

### Il lampo azzurro sul tocco

Su un telefono, toccando un punto qualsiasi **tutto lo schermo diventava
azzurro** per un istante. Non era un pannello: era l'evidenziazione di tocco del
browser, dipinta sopra l'elemento toccato — e l'elemento toccato è `#scene`,
che è fisso e grande quanto lo schermo. `-webkit-tap-highlight-color:transparent`
su `html`, e `user-select:none` su quello che si tocca per fare e non per
leggere: qui non si seleziona, si preme.

### Il piede del pannello della libreria sta fuori da quello che scorre

Con le due tendine aperte il pannello ha oltre ottocento pixel di contenuto, e
«elimina questa libreria» finiva sotto il bordo — su un telefono senza
nemmeno una barra di scorrimento a dire che sotto c'era altro. È la stessa
lezione della scheda: `.st-scorre` scorre, `.st-gesti` no.

### Il fuoco non si ruba

Il pannello della vista prendeva da solo il fuoco sul campo di ricerca
all'apertura, e l'anello dell'accento si accendeva senza che nessuno avesse
toccato niente — sembrava un errore, non un invito. Il contorno di fuoco sta su
`:focus-visible`, cioè lo vede solo chi naviga da tastiera.

### La testata è una superficie, non un velo

Era trasparente, e scorrendo una sezione il testo della pagina le passava sotto:
i due si compenetravano. Ora è carta velata con la sfocatura dietro. Sulla
libreria resta più leggera — lì dietro non scorre niente, e coprire la stanza
sarebbe un peccato — e `body.sez-collezione` esiste apposta per distinguere i
due casi.

### Un menu non era trasparente: era coperto

La finestrella delle azioni sembrava semitrasparente. Non lo era: lo sfondo è
opaco, ma **ogni riga ha il suo involucro posizionato**, e chi viene dopo si
disegna sopra a chi viene prima — quindi i pulsanti delle righe sotto passavano
davanti al menu aperto. La riga aperta prende la classe `menu-su` e sale a
`z-index:30`.

È il tipo di difetto che si diagnostica male a occhio: il colore calcolato era
già `rgb(242,241,237)`, cioè pieno. Il numero da guardare era un altro.

### I filtri dei gruppi stanno solo dove i gruppi si vedono

In «tutti i giochi» restavano accesi e filtravano una lista che i gruppi non li
mostra nemmeno: due comandi che dicono cose diverse sulla stessa schermata.
`body.vista-tutti` li toglie.

### Dentro la scatola aperta

Era un fondo marrone piatto con tre sagome appoggiate sopra. Adesso c'e' il
cartone che prende luce dal davanti, **le quattro pareti interne** in trapezio
— sono quelle a far capire che si guarda DENTRO una scatola e non una figurina
stesa — e **ogni oggetto ha la sua ombra a terra**: senza, galleggiavano tutti
sullo stesso piano. Ci sono anche due dadi d'avorio, che di questo sito sono il
soggetto.

E i meeple usano `sagomaMeeple`. Prima ne avevano **una loro, fatta a spezzata**:
era il terzo meeple diverso dentro lo stesso sito, cioe' esattamente quello
contro cui mette in guardia la nota qui sotto.

### Le tendine si aprono, non compaiono

Tutto quello che si apre sotto qualcos'altro — le informazioni di un gioco
nell'elenco, la recensione dentro la riga del catalogo, le partite di un gioco, i
cassetti del profilo, le due tendine del pannello della libreria — compariva di
colpo. Adesso scende, con `apreSotto`.

Serve una **`animation` e non una `transition`**: questi blocchi passano da
`display:none` a visibile, e una transizione su quel salto non parte proprio.
È la stessa ragione delle sezioni, scritta un piano piu' su.

### La schermata di caricamento

Era un fondo piatto con un dado in mezzo. Adesso la luce viene da sopra come
nella stanza che si sta per aprire, cosi' il caricamento e' gia' il sito e non
una sala d'attesa. Il dado e' d'**avorio** e non bianco carta — un dado da
tavolo non e' mai bianco — ha il bordo interno smussato che gli da' lo
spessore, e **i pallini sono scavati**: l'ombra viene da sopra e il riflesso sta
in basso. Prima era il contrario e sembravano appiccicati sopra. Sotto c'e'
un'ombra a terra che si stringe e si allarga col rotolare: e' quella che lo fa
stare in un posto invece che galleggiare.

### Il meeple è una sagoma sola

Il giro parte dal piede sinistro e va in senso orario: gamba, fianco, sotto il
braccio, la mano, sopra il braccio, spalla, collo, mezzo giro di testa —
specchiato dall'altra parte — poi giù per la gamba destra e su per la V, che non
arriva mai più in alto della vita. Tutto in curve: un meeple è tornito, non
ritagliato.

**Le stesse coordinate stanno in `js/art.js` (`sagomaMeeple`, dipinto su canvas)
e in `js/app.js` (`meepleShape`, estruso in 3D).** Se divergono si vedono due
meeple diversi nella stessa schermata. Un primo tentativo lo aveva fatto in tre
pezzi separati e le gambe uscivano come un triangolo col taglio in mezzo.

### Una tinta è un bollino, una voce è una parola

Nel pannello della stanza convivono due tipi di pastiglia: i **bollini** delle
tinte e le **voci** degli arredi. Una regola sola che le rendeva tutte tonde
sembrava innocua, ma su un pulsante di testo un raggio del 50% dà un'**ellisse**
— era quel contorno ovale attorno a «cornici».

I bollini sono tondi e la loro selezione è un **anello staccato**
(`box-shadow` doppio): serve lo stacco, se no su una tinta chiara l'anello ci si
confonde dentro. Le voci sono pastiglie allungate e la loro selezione è il
**pieno**. In nessuno dei due casi è un `outline` che gira attorno alla forma.

### Il meeple del profilo sta dentro un cerchio

Sta a 0.31 del lato e non a 0.40. Non è una questione di gusto: la faccia del
profilo è **ritagliata tonda**, e a 0.40 il meeple arrivava a filo del quadrato
— il cerchio gli tagliava via le mani.

E sta a 0.475 di altezza, cioè **sopra** il centro geometrico. Anche questo
misurato, non a occhio: disegnando il meeple nero su bianco e contando i pixel,
a centro esatto l'ingombro era a 0.494 ma il **baricentro dell'inchiostro**
cadeva a 0.524 — le gambe sono piene e la testa è piccola, quindi la massa sta
in basso, ed è la massa che l'occhio legge. A 0.475 il baricentro torna a 0.509
e l'ingombro resta appena alto, che è esattamente come si legge «centrato» per
una figura con una testa. Zero pixel fuori dal cerchio.

Il **dado in filigrana non si sceglie più**: con il meeple ridisegnato, pieno e
con le braccia che attraversano tutto il quadrato, della filigrana restavano due
angoli, e nel ritaglio tondo nemmeno quelli. Si sceglieva un numero che nessuno
poteva vedere. `filigranaDado` resta in `art.js` perché è un disegno buono, se un
giorno torna un posto dove si veda.

Le tinte sono **sedici meeple e dodici fondi**. Erano otto e quattro, e i quattro
fondi erano quattro sfumature dello stesso beige: non una scelta, l'illusione di
una scelta.

### Le icone

Un corredo solo in SVG: tratto 1.6, estremi tondi, riquadro 24, e prendono il
colore del testo — quindi seguono da sole lo stato del comando che le contiene.

**Per riempirle da accese si mira al `path`, non all'`<svg>`.** Ogni icona porta
`fill="none"` scritto addosso come attributo di presentazione, e un attributo sul
figlio vince su una proprietà ereditata dal padre — mentre una regola CSS, anche
debolissima, batte l'attributo. Scritte sull'`<svg>`, le due regole che
riempivano il cuore e la stella del pannello **non hanno mai riempito niente**:
cambiava solo il colore del contorno, che a occhio sembra «acceso» e infatti non
se n'era accorto nessuno. Vale per ogni icona futura che debba avere due stati.

**E l'SVG non va sovrascritto con un glifo.** `#p-pref` aveva l'icona nel markup
e il JS gli rimetteva `innerHTML = '&#9733;'` a ogni apertura del pannello: il
disegno spariva al primo giro, e con lui la regola che lo riempie. Lo stato si
cambia con `aria-pressed`, il disegno resta dov'è.
Prima erano **glifi Unicode**, che li disegna il sistema operativo: una faccia di
sole su Windows e su un telefono sono due disegni diversi, ed era la parte più
visibilmente scoordinata dell'interfaccia. Le poche stelle rimaste nel JS stanno
*dentro* al testo, dove un SVG in linea scombinerebbe la linea di base.

### Il movimento

Una curva sola (`--ease`): parte decisa e si posa piano. Le cose entrano dal
basso, a scaglioni, e solo le prime dodici righe sono ritardate — ritardare la
duecentesima vuol dire farla comparire tre secondi dopo che ci sei arrivato
sopra. Niente rimbalzi e niente rotazioni: qui si parla di mobili e di carta.

Le sezioni si accendono con `display`, quindi vogliono una **`animation` e non
una `transition`**: una transizione su un elemento che passa da `none` a `block`
non parte proprio. `prefers-reduced-motion` è rispettato.

## Un gesto vale una libreria, mai due

Con il tiro alzato per rendere lo scorrimento più comodo, un trascinamento lungo
ne attraversava anche tre; e il **colpo secco sommava un mobile a dove il dito
era già arrivato**, aggiungendone un altro sopra. La vista partiva e si fermava
due mobili più in là di dove volevi, cioè esattamente il modo di non trovare più
niente.

Alla pressione si fotografa `partenzaLib`, e per tutto il gesto la vista non può
uscire dal mobile accanto: né col trascinamento (il `clamp` è su
`partenza ± 1`), né col colpo (che va a `partenza ± 1` in assoluto, non in
relativo). Verificato: un trascinamento da un bordo all'altro dello schermo
sposta di uno, e un colpo secco pure.

**La traccia del binario non si fa con i bordi.** L'area da prendere col dito
veniva da due bordi trasparenti da dodici pixel attorno a una riga alta quattro.
Con `box-sizing:border-box` — che qui vale per tutto — quei ventiquattro pixel si
mangiano l'altezza dichiarata: **la scatola di riempimento resta alta zero**, e
con `background-clip:padding-box` la traccia non c'è proprio. Si vedeva soltanto
finché una scorciatoia `background:` rimetteva il clip a `border-box` e il grigio
riempiva i bordi — una traccia alta ventotto pixel, per sbaglio. Adesso
l'elemento *è* l'area da prendere e la riga sottile è un `::before` in mezzo.

Da ricordare in generale: **`background:` è una scorciatoia e riazzera quello che
non nomina**, `background-clip` compreso. Quando serve toccare solo il colore si
usa `background-color`.

**Il cursore non arriva mai a filo dei capi** (`MARG`, 6% per lato): alla prima e
all'ultima libreria l'arancione sbatteva contro il bordo e sembrava tagliato. Il
margine vale anche per il **trascinamento**, che mira al centro del cursore sulla
stessa corsa utile — se no ai due capi il cursore si sfilava da sotto il dito,
che è proprio dove ci si va a sbattere più spesso.

**Al centro c'è la barra, non il gruppo.** `#rail` era centrato per intero, testo
compreso: siccome il «1 / 3» sta a sinistra, la barra finiva spostata a destra di
mezza scritta. Il numero è sfilato dal flusso e appeso a sinistra, così l'unica
cosa in fila è la barra — ed è lei quella che l'occhio misura.

**Il binario è una pastiglia sola**, con `flex-wrap:nowrap`: prima erano due
elementi liberi dentro un flex che poteva avvolgere, e su schermo stretto il
«1 / 3» si staccava e finiva sopra la barra.


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

## I faretti sono luce dipinta, non lampade

Abbassando la luce della stanza il mobile spariva col resto: giusto per una
stanza, sbagliato per una libreria — in casa si spegne il lampadario e la
libreria resta accesa da dentro. Adesso c'e' un secondo cursore, **faretti**,
accanto a quello della luce.

**Il punto e' che non seguono la stanza.** La luce cala fino a spegnere il muro,
i faretti no: calano solo pianissimo (`l^-0.30`, un terzo scarso fra buio e luce
piena), perche' a mezzogiorno un faretto acceso si nota appena e tenerlo alla
stessa forza farebbe sembrare lo schienale luminescente invece che illuminato.

- **Non sono lampade, sono un disegno.** `ART.fariCubi` dipinge sotto ogni
  ripiano una sfumatura bianca che scende verso il nero, sullo **schienale** —
  che e' una tavola sola per tutto il mobile, quindi una texture, un materiale,
  **zero chiamate di disegno in piu'**. E' lo stesso ragionamento di
  `ART.aoCubi` un piano sopra: l'occlusione e' luce che manca, questa e' luce
  che c'e'.
- **Dodici punti luce veri erano la strada sbagliata.** Uno per cubo vuol dire
  dodici lampade nello shader di **ogni** materiale della scena, cioe' il conto
  piu' salato del sito per un effetto che a luce piena non si vede. E una
  lampada sola per fila, centrata, riaccenderebbe un difetto gia' pagato una
  volta — la colonna di mezzo accesa e le due di fianco al buio (vedi «Le luci
  dei vani seguono la stanza»). Dipinto, ogni cubo riceve la stessa identica
  luce **per costruzione**.
- Il colore caldo e quanto e' acceso stanno nel materiale (`emissive`,
  `emissiveIntensity`), non nel disegno: cosi' il cursore non ridipinge niente
  e il trascinamento resta fluido, come per la luce.
- Le lampade dei vani portano **una quota di faretti** oltre alla loro
  (`state.bayLight * luceVani + .55 * luceFari`): serve solo a non lasciare al
  buio la copertina della scatola, che e' l'unica cosa davanti allo schienale.
- Sta in `profili.stanza` come luce, muro e pavimento — e' della **stanza**, non
  del singolo mobile — ed e' un jsonb: nessuna migrazione. Il mobile fantasma
  non li ha, e non deve averli: un mobile che non c'e' non ha i faretti accesi.
- **Zero e' un valore vero.** In `normalizza` non si puo' scrivere
  `parseFloat(o.faretti) || DEFAULT`, se no «spenti» diventa «come non scelto»:
  e' lo stesso inciampo dei punti di una partita.

## Chiudere e' un gesto solo, quindi e' un segno solo

Erano tre pulsanti squadrati incollati all'angolo con dentro la parola «chiudi»
e una `&times;` — il cartellino di dieci anni fa — e ognuno con le sue misure:
quello della scheda era gia' stato ritoccato una volta, quelli dei due moduli
erano rimasti indietro. Adesso `#close`, `#add-x` e `#mia-x` sono **lo stesso
cerchio pieno con la x dentro**, staccato dall'angolo.

Resta terracotta e resta **pieno**: vale ancora la nota «il chiudi e' pieno, non
tinto» — un fondo al 10% dentro una scheda gia' chiara non si vede, e chiudere
e' la prima cosa che si cerca per uscire. Sul tocco cresce a 40 px.

## Un'attesa che non si vede sembra un pulsante rotto

Nel catalogo «aggiungi» fa due giri di rete — la scheda, poi la copertina — e il
pulsante restava un «+» spento: chi premeva non sapeva di aver premuto, e
premeva di nuovo. Adesso diventa una **rotella che gira** e, finita l'attesa, la
spunta di sempre.

- Il cerchio e' **quasi** chiuso apposta: e' il pezzo mancante a farlo leggere
  come qualcosa che gira.
- Con `prefers-reduced-motion` **non si ferma**: e' un'attesa, non una
  decorazione, e ferma non direbbe piu' niente. Gira piu' piano.
- Si verifica **nello stesso tick del clic**: `mettiInLibreria` scrive la
  rotella prima del primo `await`, e con il dump in casa l'attesa vera puo'
  durare meno di venticinque millisecondi — un `setInterval` non la vede mai.

## La scheda del gioco dice cosa e' il gioco, non cosa ci hai fatto

Tre cose sono uscite dal pannello della recensione, e per la stessa ragione:
rispondevano a domande che quella schermata non fa.

- **L'elenco delle ultime partite.** Resta il winrate, che e' un numero solo e
  soprattutto e' l'unica cosa che la sezione partite non puo' dire mentre hai
  *questo* gioco in mano. Le sei righe sotto allungavano il pannello e
  spingevano la recensione — che e' il motivo per cui la scheda si apre — verso
  il bordo. Tolto anche il filo di separazione sopra: una pastiglia che ha gia'
  il suo fondo tinto non vuole anche una cornice.
- **I gruppi.** Si gestiscono dall'elenco, che e' dove si decide cosa sta con
  cosa, e averli in due posti voleva dire tenerli d'accordo per sempre. Il
  markup non ha piu' `#p-gruppi`, quindi i due ascoltatori di `bindGruppi` si
  agganciano **solo se l'elemento c'e'** — se no basta un `index.html` nuovo per
  portarsi via mezzo pannello (vedi «Un aggancio che salta»).
- **«in collezione» si chiama «togli dallo scaffale».** Diceva dove va il gioco
  ma si leggeva come «mettilo in collezione», cioe' il contrario. Adesso dice il
  gesto. L'altro pulsante resta «rimuovi», rosso e in due tempi: sono due cose
  diverse e continuano a chiamarsi in due modi diversi.

## In casa d'altri sparivano due sezioni su tre

`body.visita` toglieva catalogo e profilo dalle due navigazioni, **non le
partite**: si poteva uscire da casa di qualcuno senza accorgersene proprio dal
posto in cui il sito dice «le tue partite». Sono tue e restano tue anche mentre
sei da lui — che e' esattamente perche' non si entra da li'. Adesso spariscono
tutte e tre. Attive non lo erano mai: entrando si fa `setSezione('collezione')`.

## Un'icona sola per le partite, e una faccia che non e' un'icona

- **Il dado della barra in basso e' l'icona delle partite, ovunque.** Nel piede
  della scheda ce n'era un'altra — una scatola in assonometria — e due figure
  per la stessa cosa sono due cose diverse, per chi guarda. Vince quella della
  barra, perche' e' quella che si vede sempre.
- **La voce «profilo» non e' piu' la tua faccia.** Era un canvas con dentro il
  meeple e i suoi colori: l'unica delle quattro voci che non poteva accendersi
  di terracotta quando la scegli. Adesso e' una sagoma neutra che prende
  `currentColor`, come le altre tre. La faccia resta dov'e' sua, nel profilo.

## Ogni campo ha un tetto, e il tetto non sta solo nel campo

`maxlength` su ogni casella di testo del sito — dal nick (**dodici**) al titolo
di un gioco (80), passando per il nome di una libreria (24), di un giocatore
(24), di un gruppo (30) e le due recensioni (4000).

Ma **il `maxlength` non e' il limite**: e' la cortesia. Un valore incollato lo
rispetta, uno che arriva dal catalogo o da una vecchia riga del database no — e
dal catalogo arrivano titoli con edizione, sottotitolo ed espansione tutti
attaccati. Quindi il taglio vero sta **dove il dato si scrive**: `store.js`
(`NOME_LIB_MAX`, `NOME_GRU_MAX`, `TITOLO_MAX`), `profilo.js` (`NICK_MAX`),
`partite.js`. E' la stessa regola di «una query che si fida delle policy»: chi
scrive dice cosa vuole.

Dodici per il nick non e' un numero a caso: sta in testata accanto al marchio,
nelle pastiglie dei giocatori e sopra la libreria di chi ospita — posti larghi
una manciata di caratteri, dove piu' in la' non si allarga il posto, si taglia
il nome con dei puntini.

## Il binario e' piu' piccolo

Traccia da 150 px (36vw), alta tre pixel, frecce da 22, numero a undici. Era
gia' stato ristretto una volta per stare nella sua fascia: e' un indicatore che
si puo' trascinare, non un comando da leggere da lontano.

## Annullare deve costare quanto quello che si annulla

«Sto aprendo un gioco, clicco da un'altra parte, e il sito resta congelato
come se aspettasse comunque la fine dell'animazione.» Era vero, ed era
letterale: `unfocus()` rigiocava **sempre** la chiusura per intero — 0,12 di
attesa, 0,42 di coperchio, 0,80 di ritorno = **1,34 s** — anche quando si
interrompeva dopo due decimi, cioè quando il coperchio non si era mosso e la
scatola era appena partita. E per tutto quel tempo la fase è `closing`, che
non risponde a niente.

- **La durata si misura sullo stato, non sulla costante.** Quanto è alzato il
  coperchio si legge da `lid.position.z`, quanto è uscita la scatola dalla
  distanza da `homePos` in frazione di `pose.pos`. Annullare a due decimi
  adesso costa **0,27 s** invece di 1,34; chiudere una scheda davvero aperta
  costa **1,35 s**, cioè quanto prima. Misurato, non stimato.
- **I minimi non sono un vezzo.** Una durata zero fa `0/0` dentro `stepAnims`,
  cioè `NaN`, cioè `lerp` con NaN, cioè una scatola con le coordinate rotte che
  sparisce dalla scena. `Math.max(.05, ...)` e `Math.max(.20, ...)`.
- **Il clic durante `closing` non si butta più via.** Non era `browse` (quindi
  `focusOn` usciva subito) e non era `focus`/`review` (quindi nemmeno
  `unfocus` lo prendeva): spariva nel vuoto. Adesso si **segna**
  (`apriDopo`) e si apre appena la chiusura ha finito, esattamente come
  `ridisponiDopo` fa con le richieste di ridisporre. La scatola va
  ricontrollata prima di aprirla: nel frattempo `applyLibrary` può averla
  portata via.

**E non era un blocco permanente.** Provato interrompendo in quattro punti
diversi e con il cambio di sezione nel mezzo: ogni strada tornava a `browse`,
nessuna scatola restava `busy`. Quello che si vedeva era un secondo e mezzo di
sito sordo, che è una cosa diversa da un guasto e si corregge in un altro modo.

## L'elenco della collezione si apre da dovunque

Il contatore in testata c'è in tutte le sezioni, ma premendolo dal catalogo o
dal profilo non succedeva niente. Non era il pulsante: `#mia`, `#catalogo`,
`#profilo` e `#partite` stanno **tutti a `z-index:2`**, e a parità di livello
decide l'ordine nel documento — le tre sezioni vengono dopo `#mia`, quindi gli
si disegnavano sopra. L'elenco si apriva davvero, sotto la pagina che si stava
guardando.

- `#mia` sale a **3**. È un modo di guardare la propria collezione, e la
  propria collezione la si guarda da dove si è — senza essere teletrasportati
  nella libreria 3D e senza perdere il posto nel catalogo.
- **`vai allo scaffale` deve tornare in collezione.** Da lì la camera si
  muoveva dietro una pagina piatta e il gesto non faceva niente.
- **L'imbuto sopra l'elenco vuole `!important`.** La riga che lo spegne nel
  catalogo e nel profilo ce l'ha, e cercare e ordinare sopra l'elenco servono
  esattamente come sugli scaffali.

### Coprire le sezioni non vuol dire coprire la testata

Alzare `#mia` a `z-index:3` per farlo stare sopra catalogo, partite e profilo
(tutti a 2) lo ha messo **alla pari con la testata**, che sta a 3 — e a parita'
di livello vince chi viene dopo nel markup. Risultato: l'elenco si disegnava
sopra la testata, e con lei sparivano il marchio, le sezioni e soprattutto il
contatore, **che e' l'unico modo di richiudere l'elenco**. Ci si restava
dentro.

La testata sta a **4**: galleggia su tutto quello che copre la pagina, ed e'
la regola giusta invece di un numero scelto per un caso solo. Da ricordare:
**quando si alza qualcosa per superare un vicino, si controlla anche chi si
supera per sbaglio.**

## Il pulsante dice dove porta, non dove sei

Il contatore in testata e' un interruttore fra due modi di guardare la stessa
collezione. Chiuso porta all'elenco e dice quanti giochi hai; **aperto riporta
agli scaffali, e allora dice «le mie librerie»** — se no e' un pulsante acceso
che ripete il nome della schermata in cui ti trovi gia' e non promette nessuna
via d'uscita. In casa di un amico dice «la sua libreria».

**Il conto non si e' spostato da nessuna parte.** Il primo tentativo lo aveva
messo nell'occhiello dell'elenco, per non perderlo quando il pulsante cambia
parola. Ma `#mia-msg`, due righe sotto, lo dice gia' — e lo dice meglio,
perche' dice anche quanti sono in vetrina («25 giochi, 12 sugli scaffali», e
«14 giochi per «ga»» quando si cerca). Sarebbe stato lo stesso numero due volte
nella stessa schermata.

## La calcolatrice del tavolo

Segnare i punti di un gioco da tavolo vuol dire quasi sempre sommare quattro o
cinque pezzi, e spesso moltiplicarne uno — tre città per due punti l'una.
Farlo a mente col telefono in mano è il modo più rapido di sbagliare, e
sbagliare lì vuol dire **un vincitore sbagliato**.

- **Si apre dal campo dei punti di una persona, e il totale ci finisce
  dentro.** È l'unica cosa che la lega a questo modulo invece di renderla un
  aggeggio qualunque appiccicato a un sito di giochi.
- **Niente tasto «uguale»**: il totale sta sempre in vista mentre si digita, e
  l'unico gesto che chiude il conto è quello che lo porta nel campo. Un
  «uguale» in mezzo sarebbe un passo che non decide niente.
- **Si apre già carica** di quello che c'è scritto nel campo — quasi sempre si
  aggiunge a un punteggio — ma la prima cifra lo sostituisce, come su qualunque
  calcolatrice. Se no chi voleva riscrivere si ritrovava le cifre in coda.
- **Interi e tre segni, quindi niente `eval`**: i tasti producono solo cifre,
  `+`, `−` e `×`, e il parser sta in dieci righe — moltiplicazioni prima,
  somme dopo. Non c'è niente da sanificare perché non entra niente da fuori.
- **Anche da tastiera**, in cattura e fermando l'evento: se no `Escape`
  chiuderebbe l'intero modulo invece della sola calcolatrice, e i numeri
  finirebbero nelle scorciatoie della scena.
- **`direction:rtl` non è un modo di guardare la coda di una riga.** Serviva a
  tenere in vista l'ultimo pezzo del conto e invece **ribaltava l'ordine**:
  «7 + 12 + 4» si leggeva «4 + 12 + 7», cioè un conto diverso da quello scritto.
  La coda si tiene in vista con `scrollLeft`, che sposta la vista e basta.
- Due id (`#partitalayer #calc`) per i pulsanti: dentro quel modulo c'è già una
  regola con **tre `:not()`** che decide il fondo di ogni pulsante, e ogni
  `:not()` pesa quanto quello che contiene. È la lezione della pastiglia della
  lingua.

## Il colore dei faretti

Una lampadina non è un intonaco: la tavolozza qui non sono le sei tinte del
sito ma le **temperature che una luce può davvero avere** — dal calduccio
della sera al bianco da vetrina — più l'azzurro, che nelle vetrine si vede
davvero, e la terracotta, che è il colore di casa.

- Sta **attaccato al cursore dei faretti** e non giù con muro e pavimento:
  quanto sono accesi e di che colore sono la stessa domanda.
- Passa da `applicaLuce` e non da `applicaStanza`: è un colore di **luce**, non
  di superficie. Non c'è nessun materiale da rigenerare — si scrive un
  `emissive` e si è già visto.
**E i neon.** Sono l'unica cosa del sito che esce dalla tavolozza, ed e'
giusto cosi': un LED sotto un ripiano non e' un intonaco e non deve andare
d'accordo col muro — deve staccarsene. E' anche l'unico posto in cui una tinta
satura non stona, perche' non colora una superficie: e' **luce**, e a stanza
accesa si vede appena. Sei in piu' — rosa, viola, ciano, verde, giallo, blu —
per dodici bollini in due file.

- **Le lampade dei vani si tingono nella stessa proporzione.** Fanno due
  mestieri (la luce della stanza dentro al cubo e la quota di faretti che serve
  a non lasciare al buio la copertina): scegliendo l'azzurro con quella lampada
  rimasta ambrata, lo schienale e la scatola davanti raccontavano due storie
  diverse. Il colore si mescola con lo stesso peso con cui si mescolano le due
  intensità, calcolato in `applicaLuce` e non nel ciclo — `state.bayLight` è
  solo un moltiplicatore comune.

## `rilingua()` guardava una classe che non esiste

`if (document.body.classList.contains('partita')) disegnaTavolo();` — quella
classe **non esiste in nessun punto del sito**, quindi la riga non è mai
scattata: cambiando lingua col modulo della partita aperto, il tavolo restava
nella lingua di prima, segnaposti e corone comprese. La condizione vera è
`paCorrente`, che vale esattamente finché il modulo è aperto.

Vale in generale: **una condizione basata su una classe si verifica cercando
chi quella classe la mette.** Se non la mette nessuno, il ramo è codice morto
che sembra vivo.

### Quello che era rimasto in italiano

Trovato passando il sito in inglese e rileggendo ogni schermata, non a memoria:

- il **pannello dei gruppi** — «N giochi», «chiudi»/«giochi», «togli»;
- i pulsanti **dentro/aggiungi** dell'elenco di un gruppo, che avevano già le
  loro chiavi (`gru.dentro`, `gru.aggiungi`) e semplicemente non le usavano;
- le **specifiche nella riga aperta dell'elenco** — «giocatori», «minuti»,
  «anno»: il catalogo le traduceva da sempre con `spec.*`, questa copia era
  rimasta indietro.

**Il tasto per uscire dice «sign out» in tutte e due le lingue**, ed è una
scelta esplicita: due parole al posto di quattro in fondo a una pagina dove
l'uscita è l'ultima cosa che si legge. Non porta `data-i18n`: il testo lo
scrive `armaBottone`, che tiene anche lo stato armato — con l'attributo,
`applica()` glielo riscriverebbe sotto e il «sicuro? tocca ancora» sparirebbe
a metà conferma.

### Il pannello di anteprima non dà un solo frame

`document.visibilityState` è `hidden` e `requestAnimationFrame` **non gira
affatto**: misurato, zero frame in un secondo. Quindi l'intro non finisce, le
fasi non avanzano, e ogni prova sulle animazioni sembra un blocco.

Si aggira esponendo `stepAnims` con un gancio temporaneo e chiamandolo a mano
con un passo fisso (`for (let t=0;t<sec;t+=1/60) step(1/60)`). Con quello le
fasi avanzano davvero e si può misurare quanto dura una chiusura.

**E i clic sintetici vanno sul CANVAS, non su `#scene`.** I listener stanno su
`renderer.domElement`, che è figlio di `#scene`: un evento dispatchato sul
padre non arriva al figlio, e la prova «non fa niente» senza dire perché. Le
coordinate poi sono quelle della **pagina** (1184×1270 qui), non quelle dello
screenshot (800×858): lo screenshot è scalato, e mirare con i suoi pixel manca
ogni bersaglio.

## Sessanta fotogrammi: misurati sulla GPU, non sui frame al secondo

**I frame al secondo non dicono niente su questa macchina.** Ogni prova, in
ogni condizione, tornava 160 fps: e' il vsync, non il margine. Con un tetto
fisso davanti, tutto sembra veloce uguale — anche quello che veloce non e'.

Il numero vero lo da' **`EXT_disjoint_timer_query_webgl2`**: si apre una query
`TIME_ELAPSED_EXT` all'inizio del fotogramma e si chiude alla fine, e il
risultato arriva qualche fotogramma dopo. E' il tempo che la GPU passa
davvero a disegnare, e non ha nessun tetto sopra.

Punto di partenza, a 1184x1270: **GPU 0,548 ms mediana, CPU 0,60 ms, 98
chiamate di disegno, 562 triangoli, 86 materiali.** Cioe' poco piu' di un
millisecondo su un budget di 16,7: **quindici volte dentro i sessanta**. Il
lavoro qui non era togliere un collo di bottiglia che non c'e' — era togliere
quello che si paga senza vederlo, perche' e' quello che su un telefono si
sente.

Dov'e' finito: **GPU 0,332 ms (-39%), CPU 0,40 ms (-33%), 53 materiali
(-38%)**, a parita' di pixel sullo schermo.

### Dove stava il costo

Misurato togliendo una cosa per volta e rimettendola:

- **le cinque point light valgono il 28% del tempo GPU.** Sono il conto piu'
  salato della scena, e si paga per frammento su tutto lo schermo;
- **la passata d'ombra vale 0,151 ms**, ma solo quando qualcosa si muove: a
  riposo non c'e' proprio (vedi «Le ombre si ridisegnano solo se qualcosa si
  e' mosso»);
- la geometria non conta niente: **562 triangoli in 98 chiamate** sono dodici
  triangoli a chiamata. Qui non si e' mai trattato di poligoni.

### Una luce spenta non e' una luce gratis

`focusLight` — quella che si accende aprendo una scheda — stava nella scena
**sempre**, a intensita' zero. Ma three.js compila lo shader di **ogni**
materiale con il numero di luci che trova, e ogni frammento paga il conto di
quella lampada anche quando non illumina niente. Una su cinque, per il 99% del
tempo: perche' il tempo si passa a guardare lo scaffale, non una scheda.

Adesso entra in scena con la scatola e ne esce quando la scatola torna a posto
— da tutte e due le uscite, `unfocus` e `removeFocused`.

**E i due shader si scaldano sul caricamento.** Cambiare il numero di luci fa
ricompilare tutti i materiali: senza precauzioni il conto si sarebbe pagato
alla prima scatola aperta, cioe' esattamente nel fotogramma in cui comincia a
muoversi. `scaldaShader()` compila la variante con la lampada e quella senza
mentre la barra di caricamento e' ancora a schermo, e da li' in poi sono tutte
e due in cache. Verificato: il picco di CPU nei primi 120 ms dopo l'apertura e'
**1,6 ms** — se ricompilasse li', sarebbero decine.

### Tre dei sei materiali di una scatola sono uguali per tutte

Copertina e dorsi sono di quel gioco. Ma il **fondello** scuro del coperchio,
il **cartone** del fondo e l'**interno** venivano costruiti da capo dodici
volte, con gli stessi identici argomenti, e ognuno si portava dietro un canvas
dipinto e caricato sulla scheda: trentasei materiali e ventiquattro texture
dove ne bastano tre e due.

L'interno in particolare: e' il dentro di una scatola **chiusa** in undici casi
su dodici, perche' una sola si apre per volta. Dodici interni diversi erano
dodici disegni per una cosa che si vede una volta sola — e due qualunque di
loro non si distinguono, essendo grana casuale sullo stesso cartone.

Passano da `comune()`, la stessa cache degli arredi, quindi sono segnati
`__comune` e `killGroup` non se li porta via alla prima ricostruzione.
Verificato che restino condivisi fra due scatole e che copertine e dorsi
restino distinti.

**Attenzione: condividere i materiali NON toglie chiamate di disegno.** Quelle
le fa il numero di GRUPPI di una geometria, non l'identita' del materiale — la
lezione e' gia' scritta un piano sopra. Restano 98. Quello che si guadagna e'
altrove, ed e' molto: meno canvas dipinti, meno texture caricate sulla scheda,
meno programmi shader da compilare all'avvio, meno memoria. Su un telefono
sono proprio quelli i costi che si sentono.

### Quello che e' stato misurato e NON si e' fatto

Vale la pena scriverlo, se no qualcuno lo rimisura fra sei mesi:

- **PCF al posto di PCFSoft per le ombre: nessun guadagno** (0,55 contro
  0,531, cioe' rumore). Solo `BasicShadowMap` costa davvero meno — 0,389 — ma
  quello si vede, e brutto.
- **Anisotropia da 8 a 1: 0,121 ms.** Sembra tanto, ma il rumore di fondo di
  questa misura e' 0,09 (la stessa configurazione, rimisurata, e' passata da
  0,425 a 0,334). Sotto quella soglia non e' una prova, e non si scambia
  qualita' sul pavimento — che e' la superficie di scorcio, quella dove
  l'anisotropia si vede — per un numero dentro il rumore.
- **Non ridisegnare le ombre per l'alzata dell'hover.** Costerebbe 0,151 ms a
  ogni movimento del mouse. Ma **l'hover esiste solo col mouse**: sarebbe un
  risparmio esattamente sulle macchine che il margine ce l'hanno gia', pagato
  con l'ombra della scatola che non segue piu' la scatola.
- **Ridurre i gruppi del coperchio da quattro a tre**, dando al fondello la
  texture delle teste: dodici chiamate in meno (12%), ma il fondello scuro e'
  quello che disegna la linea d'ombra fra coperchio e fondo, e a scatola
  chiusa e' l'unica cosa che fa leggere due pezzi invece di uno.

### La memoria delle texture, che e' l'altra meta'

**46 MB con le mipmap**, e la fetta grossa sono le copertine vere (8 texture da
720x520 e 3 da 760x570 fanno 22 MB). Non si toccano: su uno scaffale sono
larghe 90 px, ma con una scheda aperta sono larghe 400 e a densita' 2 fanno
800 — la risoluzione la comanda quel caso li', non lo scaffale.

## Il neon si dipinge come si dipinge una luce, non un muro

La prima versione dei faretti era **una sfumatura sola** che partiva forte
sotto il ripiano e scendeva: si leggeva come una parete verniciata di chiaro
in alto, non come qualcosa di acceso.

Una striscia LED vera ha **due parti ben diverse**, ed e' il salto fra le due a
farla leggere come una sorgente:

- **il nucleo** — un filo quasi bianco largo pochissimo (il 4,5% dell'altezza
  del cubo), che e' il LED;
- **la coda** — lunga, satura, che e' la luce sulla parete.

E poi il **rimbalzo dal fondo del cubo**: poco, un settimo del nucleo, ma senza
la luce muore a meta' e il vano sembra profondo il doppio di quello che e'.
Le tre sfumature si sommano (`globalCompositeOperation = 'lighter'`), perche'
sono tre luci sulla stessa parete e non tre strati di vernice.

**Il bianco del nucleo non si dipinge: si lascia bruciare all'esposizione.** La
mappa e' in scala di grigi e viene moltiplicata per il colore scelto, quindi da
li' non si puo' uscire piu' chiari di quel colore. Ma con `emissiveIntensity`
sopra l'unita' (1,6 invece di 0,85) il picco esce dalla scala e il tone mapping
ACES lo porta verso il bianco, mentre la coda — che nella mappa vale un quinto
— resta dentro e resta satura. E' esattamente come si comporta un neon vero
davanti a una macchina fotografica, ed e' per quello che si legge come neon.

Costa **zero**: e' la stessa texture di prima sullo stesso schienale, che e'
una tavola sola per tutto il mobile.

## I faretti erano spenti finche' non li toccavi

Segnalato cosi': «all'apertura dell'app i LED sono spenti e si spengono anche
se modifichi l'estetica della libreria, poi toccando lo slider si sistema
tutto». Tutto vero, e la causa e' un ordine.

`applicaStanza()` chiama `applicaLuce()` **per prima cosa** e solo dopo
ricostruisce i materiali. Un legno mai usato prima nasce in quel momento, con
`emissiveIntensity` a zero, e nessuno tornava piu' a dirglielo — lo stesso
all'avvio, dove il mobile si costruisce prima che qualcuno accenda niente.
Muovere il cursore chiamava `applicaLuce()` di nuovo, questa volta sui
materiali che esistevano davvero, e sembrava una magia.

La regola che ne esce: **uno stato che va applicato non si applica in un punto
solo, si applica da chi nasce e da chi c'e' gia'.**

- `fariOra()` calcola i faretti **dalla stanza a ogni chiamata**, invece di
  leggere una variabile riempita altrove: cosi' non dipende dall'ordine in cui
  le cose vengono costruite;
- `sincronizzaFari(m)` mette in pari un materiale, e la chiamano tutti e due:
  `matsDi()` appena ne crea uno, `applicaLuce()` su quelli in cache.

Due strade, nessun ordine da rispettare.

## Il bagliore al centro non si toglie spostando le lampade

Le quattro lampade dei vani stanno sull'asse del mobile: la colonna di mezzo la
colpiscono in pieno e le due di fianco di sbieco. Misurato **su una scena tutta
bianca** — si sostituiscono tutti i materiali con un MeshStandard bianco, si
rende con e senza quelle lampade e si sottrae, cosi' quello che si legge e'
solo LUCE e non l'albedo delle copertine — il centro prendeva **3,7 volte** i
lati, uguale su tutte e quattro le file.

**Portarle avanti lo appiattisce davvero** (misurato: 1,1 volte) **e non si
puo' fare.** Una lampada a cinque unita' dal mobile non e' piu' una luce dentro
un vano: e' un faro puntato sulla stanza, e illuminava parete, pavimento e la
faccia del mobile finche' la penombra non spariva. Il baratto non si vince —
distribuzione piatta vuol dire portata, e portata vuol dire luce dappertutto.

**La luce che non ha un centro se la fanno le copertine.** Ogni copertina si
accende un poco da se', della tinta dei faretti e in proporzione a quanto sono
accesi: per costruzione e' identica su tutte e dodici, nessun centro e nessun
angolo. Non e' nemmeno una furbata — una scatola sotto una striscia LED rimanda
indietro quella luce, ed e' quello che si vede davvero.

Costa **zero**: e' l'`emissive` che c'era gia' per l'alzata dell'hover. Quello
pero' era bianco, e adesso porta la tinta scelta: una copertina sotto una
striscia azzurra non puo' schiarirsi di bianco. Le lampade restano dove stanno
e pesano meno (la loro quota di faretti da .62 a .34), quindi il poco che resta
del bagliore e' un accento e non un faro.

## Il pavimento e' fatto di pezzi

Era la stessa tavola del mobile, stirata: **una venatura sola lunga tutta la
stanza**, che a terra non esiste da nessuna parte. Un pavimento di legno e'
fatto di pezzi, e sono **le fughe fra i pezzi a dire quanto e' grande la
stanza** — senza, manca il metro con cui si legge la distanza.

`ART.parquet()` disegna listoni in corsa sfalsata:

- **si ripete per costruzione.** I listoni sono alti mezzo riquadro, quindi il
  disegno si richiude su se' stesso in verticale; le colonne sono un numero
  intero, quindi anche in orizzontale.
- **la sfalsatura e' un numero primo di pixel per colonna** (173), cosi' due
  teste non si allineano mai e il motivo non si ripete a occhio.
- **ogni listone ha il suo tono.** Due tavole dello stesso legno non sono mai
  identiche, ed e' proprio quella differenza a farlo leggere come legno posato
  invece che come carta da parati.
- **lo smusso e' un pixel per lato** — chiaro sui due lati da cui viene la
  luce, scuro sugli altri due. Senza, i listoni sono rettangoli colorati; con,
  sono pezzi di legno che stanno uno accanto all'altro.
- il rilievo sale da .012 a **.05**: sulle fughe c'e' davvero uno scalino, ed
  e' quello che le fa leggere da lontano.

**Il riquadro deve restare quadrato.** La ripetizione e' 13 sulla profondita' e
`stanzaLarga` mette la stessa scala in larghezza, quindi un riquadro copre circa
diciotto unita' per lato. Se le due scale divergessero, i listoni uscirebbero
stirati — che e' esattamente il difetto da cui si e' partiti.

## L'occlusione fra il mobile e il pavimento

Sotto un mobile appoggiato a terra la luce non arriva, e quel poco di buio dove
il legno tocca il pavimento e' **l'unica cosa che dice che il mobile ci poggia
sopra** invece di galleggiarci un dito sopra. L'ombra proiettata dalla finestra
non basta: quella dice da che parte viene la luce, non che i due si toccano.

E' **un piano solo** appena sopra il pavimento, con l'impronta del mobile
sfocata sopra — un materiale e una geometria in cache per tutti i mobili, cioe'
**una chiamata di disegno in piu' per libreria**.

- **Due passate di sfocatura, non una.** Una stretta e scura, che e' il
  contatto vero, e una larga e tenue, che e' la luce che manca tutto attorno.
  Con una sola si ottiene o un alone senza contatto o un contatto senza alone,
  e servono tutte e due: e' cosi' che si legge un oggetto appoggiato.
- Il `filter` del canvas fa la sfocatura in una riga. A mano vorrebbe dire una
  sequenza di gradienti attorno a un rettangolo — lo stesso disegno scritto in
  venti righe.
- **Le misure escono dal mobile**, non da numeri a occhio: il piano e' largo
  `LIB_W + 2.2` e profondo `KAL.d + 2.6`, quindi l'impronta cade a frazioni
  note del riquadro e il buio comincia dove finisce il legno.
- **Il fantasma non ce l'ha**, come non ha l'ombra: un mobile che non c'e' non
  poggia da nessuna parte.
- Sta a `y = SUOLO + .012`, cioe' **dentro** il ripiano di fondo. Non e' un
  problema, e' il punto: sotto il mobile il piano e' coperto dal legno e non si
  vede, e quello che resta a vista e' esattamente la frangia — che e' l'ombra
  di contatto.

## La testata sta su una parete che si puo' spegnere

Sulla libreria il velo della testata e' piu' leggero — 55% invece di 82% —
perche' li' dietro non scorre niente e coprire la stanza sarebbe un peccato. Ma
quell'eccezione **non aveva un fondo**: con il muro scuro, o semplicemente con
la luce bassa, dietro la carta c'e' il buio e il testo scuro su carta scurita
non si legge piu'. Misurato: **3,42 a 1**, contro i 4,5 di soglia.

E non e' un caso raro. Il fattore che scurisce lo sfondo e' `.10 + .90*luce`:
gia' a luce 0,14 vale 0,23, quindi **anche il grigio caldo di partenza** dietro
la testata diventa scuro. Chi tiene la stanza in penombra ce l'ha sempre.

Adesso `applicaLuce()` misura quanto e' buio davvero (`lumDietroTestata`) e
sotto la soglia mette `body.muro-scuro`: la testata torna una superficie piena
al 94%, cioe' **9,01 a 1**. E' la regola gia' scritta — «la testata e' una
superficie, non un velo» — con il fondo che le mancava. Con il muro chiaro a
luce piena resta leggera com'era.

### `state.sezione` e la classe sul body partivano in disaccordo

Trovato cercando perche' il velo al 55% non si applicava mai all'avvio:
`state.sezione` nasce a `'collezione'`, ma la **classe** `body.sez-collezione`
la mette solo `setSezione()` — e sul percorso normale non la chiamava nessuno.
Compariva al primo clic sulla navigazione, quindi fino a quel momento tutte le
regole che ci dipendono erano inerti e la testata cambiava velo da sola appena
toccavi una voce.

Vale in generale: **uno stato iniziale scritto in `state` non e' applicato
finche' qualcuno non lo applica.** Il valore di partenza e la funzione che lo
mette in scena devono partire d'accordo, e il posto per farlo e' il boot.

## Il calendario: la domanda a cui un elenco non sa rispondere

Le partite avevano due viste: *per gioco* («a cosa abbiamo giocato») e *le
ultime* («cosa per ultimo»). Ne manca una terza, ed e' **quando**: un elenco di
date si legge una riga per volta, una griglia di giorni si legge tutta insieme
— e da li' si vede il ritmo, i mesi pieni, le settimane vuote, le sere in cui
si e' giocato piu' di una partita.

**Niente segni nuovi da imparare.** Il fondo tinto vuol dire «qui e' successo
qualcosa», la terracotta vuol dire «hai vinto tu», e la corona e' la stessa che
si tocca al tavolo per dire chi ha vinto. Un punto per partita fino a tre:
oltre non si contano piu' a colpo d'occhio, e il numero esatto sta nel `title`
e nel giorno aperto.

- **La corona guarda solo le mie vittorie**, con lo stesso metro del winrate:
  una sera in cui hanno vinto gli altri e' comunque una sera giocata, ma la
  corona non ce l'ha.
- **Si apre sul mese dell'ultima partita**, non su oggi. Aprire il calendario
  su un mese vuoto perche' non si gioca da marzo vorrebbe dire chiedere a chi
  guarda di cercarsi da solo dove sono le sue partite. Il tasto **oggi**
  compare solo quando serve: sul mese corrente non porterebbe da nessuna parte.
- **Il giorno si apre sotto la griglia**, non in una finestra: e' il dettaglio
  di una cosa che si sta gia' guardando, ed e' lo stesso gesto del winrate in
  cima. Toccarlo di nuovo lo richiude.
- **La corona e' PIENA, non di contorno.** A tredici pixel un tratto da 1,6 su
  un fondo gia' terracotta si perde — stessa ragione per cui la corona del
  tavolo si riempie quando e' accesa.
- **Oggi si segna con un anello sottile, non con un fondo**: il fondo dice
  gia' un'altra cosa. Era un trattino sotto il numero, e a quella misura si
  leggeva come un carattere perso li' in mezzo.
- **Il calendario ha una misura sua** (428 px) e non si allarga con la pagina:
  a tutta larghezza le celle diventano quadrati da centoventi pixel, e un mese
  fatto di quadroni si legge vuoto invece che pieno.
- La settimana comincia di **lunedi'**: `getDay()` parte dalla domenica, quindi
  lo scarto e' `(getDay() + 6) % 7`.

**E i mesi non sono piu' italiano fisso.** `MESI` era un array in `app.js`, e
`dataIt()` scrive la data di ogni partita: in inglese diceva «23 agosto 2026».
Adesso vengono dal dizionario, in una chiave sola separata da virgole —
`cal.mesi` e `cal.giorni`. Dodici chiavi per una cosa che si legge come un
elenco unico si tengono in fila a mano, e basta che una sia fuori posto perche'
il sito dica il mese sbagliato.

### Il cancello tiene `boot()` in attesa

Costato un giro di diagnosi: con la sessione scaduta il sito torna al cancello,
e `boot()` resta **sospeso su `await gate(...)`** finche' non si sceglie.
Prima di quel punto non e' agganciato niente — nessun pulsante risponde, e
sembra che il codice nuovo non funzioni. `bindPartite()` invece gira **prima**
del ramo ospite, quindi per provare una vista basta passare il cancello come
ospite: non serve la sessione vera.

Da rimettere a posto dopo: `dado-cancello` in `localStorage` si scrive
scegliendo, e lasciato su `ospite` il sito la prossima volta non chiede piu'.

## Stato attuale

**Aggiornato al 2026-08-23 (quinta sessione).** Questa sezione e la prossima bastano a ripartire a
freddo: cosa c'è, com'è messo il database, e cosa resta da fare. Per il
racconto lungo di com'è nato tutto c'è `contest_boardgame.md`; per il *come
è fatto* c'è tutto il resto di questo file, che è aggiornato.

Il sito ha **quattro sezioni** — collezione (la scena 3D), catalogo, partite,
profilo — **due lingue** con 465 chiavi per ramo, e **tutte e dodici le
migrazioni applicate**, `punti_partita` compresa.

Le misure, per sapere in che cosa si mette le mani: `index.html` 765 righe,
`css/style.css` 3.253, `js/app.js` 6.418.

### La sessione del 2026-08-23

Diciassette commit, tutti su `libreria` e portati anche su `main` (Pages serve
quello). Raggruppati per argomento, non in ordine di tempo:

| argomento | commit | cosa |
|---|---|---|
| il winrate | `5f7e239` `2e9e120` | winrate del profilo al posto di «vince X», con l'anello; poi anche sul singolo gioco, dal pannello e dal catalogo |
| il modulo della partita | `ca4c5a3` `2e9e120` `a029955` | ti proponi fra i nomi, chi c'era si scrive, i punti si salvano, la corona a mano anche senza tutti i punti |
| i difetti dei dati | `1c6cafa` | lo scambio di due scatole, la posizione rifiutata che non tornava indietro, i giochi nel mobile fantasma, la luce che lasciava accesa una colonna |
| la grafica della scena | `4d3e2ae` `bcecaa2` | occlusione ambientale dipinta nei cubi, interno della scatola, dado e caricamento |
| l'estetica dell'interfaccia | `2ac7a29` `147ee2d` | barra in basso, catalogo senza «scheda», leggibilità, tendine che si aprono |
| il nome del mobile | `8bda6b8` `cd0f483` `be2f1f3` `998134a` `a9109cb` `728288f` | quattro giri prima di arrivarci: vedi «Il nome del mobile è una scritta» |
| il quadro | `62fa780` | un passo indietro col mobile, binario piu' piccolo, comandi equidistanti |
| la tenuta | `b831d07` | un aggancio che salta non si porta via gli altri |

**Le lezioni generali** di questa sessione stanno tutte nelle sezioni sopra, e
sono quelle che varra' la pena rileggere prima di toccare le stesse cose:

- «Un cubo tiene una scatola sola, e il database lo fa rispettare»
- «Quando non c'è posto si fa un mobile»
- «La cache dello schema legge e scrive in due modi diversi»
- «Un aggancio che salta non si porta via gli altri»
- «Il browser dell'anteprima tiene in cache anche i `.js`»
- «La camera va messa al suo posto PRIMA di misurare»
- «L'ombra dentro i cubi» e «Sessanta fotogrammi: dov'erano già»

### La sessione del 2026-08-23 (seconda)

Dodici richieste in un colpo, tutte di rifinitura: nessuna migrazione, nessuna
colonna nuova.

| argomento | cosa |
|---|---|
| i faretti | luce dipinta sotto ogni ripiano, con il suo cursore nel pannello: la stanza si spegne e il mobile resta acceso |
| il chiudi | un cerchio solo per la scheda, il modulo di aggiunta e quello della recensione |
| il catalogo | la rotella mentre aggiunge, poi la spunta |
| la scheda del gioco | via l'elenco delle partite (resta il winrate), via i gruppi, «togli dallo scaffale» al posto di «in collezione» |
| in casa d'altri | spariscono anche le partite |
| le icone | un dado solo per le partite; la voce «profilo» diventa neutra e si accende |
| i limiti | `maxlength` ovunque, e il taglio vero nel punto in cui il dato si scrive |
| il binario | piu' piccolo |

I dati di prova sono stati ripuliti: la libreria creata dal collaudo del
catalogo e il gioco aggiunto non ci sono piu', e la collezione e' tornata a
**25 giochi in una libreria sola**.

### La sessione del 2026-08-23 (terza)

Sei richieste. Una era un difetto vero, il resto rifinitura e una funzione
nuova. Nessuna migrazione: il colore dei faretti sta nel jsonb della stanza.

| argomento | cosa |
|---|---|
| annullare l'apertura | la chiusura dura quanto quello che c'è da chiudere (0,27 s invece di 1,34), e il clic durante la chiusura non si butta più via |
| il colore dei faretti | sei temperature di luce, attaccate al loro cursore; anche le lampade dei vani si tingono |
| la mia collezione | l'elenco si apre da tutte le sezioni: era `z-index:2` come le pagine che gli si disegnavano sopra |
| la calcolatrice | dentro il modulo della partita, si apre dal campo dei punti di una persona e ci scrive il totale |
| l'inglese | pannello dei gruppi, dentro/aggiungi, specifiche della riga aperta; e `rilingua()` guardava una classe inesistente |
| esci | «sign out» in tutte e due le lingue |
| i neon | sei tinte di luce in piu' per i faretti, e la testata sale a `z-index:4` perche' l'elenco non le si disegni sopra |
| il contatore | con l'elenco aperto diventa «le mie librerie»: dice dove porta, non dove sei |

I dati di prova sono stati ripuliti: la partita di collaudo è stata annullata
senza salvarla, e la collezione è rimasta **25 giochi, una libreria, una
partita**.

### La sessione del 2026-08-23 (quarta)

Ottimizzazione e neon. Nessuna migrazione, nessuna colonna nuova.

| argomento | cosa |
|---|---|
| la misura | i frame al secondo qui sono bloccati dal vsync e non dicono niente: il numero vero viene da `EXT_disjoint_timer_query_webgl2` |
| il punto di partenza | GPU 0,548 ms, CPU 0,60 ms, 98 chiamate, 86 materiali — cioe' gia' quindici volte dentro i sessanta |
| dove arriva | **GPU 0,332 ms (-39%), CPU 0,40 ms (-33%), 53 materiali (-38%)** |
| la lampada del focus | esce dalla scena quando e' spenta: era una point light su cinque, pagata per il 99% del tempo |
| i materiali delle scatole | fondello, cartone e interno sono uguali per tutte: trentasei materiali e ventiquattro texture diventano tre e due |
| il neon | nucleo quasi bianco piu' coda satura piu' rimbalzo dal fondo del cubo, e il bianco lo fa l'esposizione invece della vernice |

I dati non sono stati toccati: **25 giochi, una libreria, una partita**, e i
faretti sono tornati al caldo a 0,44 dopo le prove con il viola e il ciano.

### La sessione del 2026-08-23 (quinta)

Un difetto, una taratura e due cose nuove sul pavimento. Nessuna migrazione.

| argomento | cosa |
|---|---|
| i LED spenti | erano spenti all'avvio e a ogni cambio d'aspetto: `applicaLuce()` girava prima che i materiali nascessero. Adesso chi nasce si mette in pari da solo |
| il bagliore al centro | misurato 3,7x fra colonna di mezzo e lati. Spostare le lampade lo risolve e illumina la stanza intera, quindi restano dove sono e la luce sulle copertine viene dal loro `emissive` — che per costruzione non ha centro |
| il parquet | listoni in corsa sfalsata, ripetibili per costruzione, ognuno col suo tono e il suo smusso |
| l'ombra di contatto | un piano sfocato sotto ogni mobile vero: una chiamata di disegno in piu' per libreria |
| la testata | illeggibile sulla stanza in penombra (3,42:1): sotto una soglia di buio torna una superficie piena (9,01:1) |
| `sez-collezione` | la classe non veniva messa all'avvio: compariva al primo clic sulla navigazione |

Il conto non e' cambiato: **99 chiamate contro le 98 di partenza, GPU 0,25 ms**
(era 0,548 all'inizio della sessione precedente).

I dati non sono stati toccati: 25 giochi, una libreria, una partita, e la
stanza e' tornata com'era (caldo a 0,44, luce 0,14).

### Lo stato dei dati (riletto dal server, non dalla cache)

- Account `admin@smlrcc.it`, nick **Samuel**, codice `HH67 6BY7`. Secondo account
  di prova **samuel2**, amicizia accettata.
- **25 giochi**, di cui **12 sullo scaffale** e **13 solo in collezione**. Non è
  un guasto: la libreria è una vetrina, l'elenco è la collezione.
- **Una libreria sola**, `Libreria 5` (ordine 4).
- **Una partita**: `Arcs`, con **Samuel** (vincitore) e `samuel2`. La vecchia
  partita di prova `pa` non c'è piu'.
- **Il winrate è 100%** (1 su 1): il nick `Samuel` adesso compare fra chi
  c'era, quindi il riquadro in cima alle partite conta davvero.
- La stanza: luce **0,38**, scaffali noce, muro grigio caldo, pavimento sabbia,
  arredo misto, colore del nome oliva scuro.
- Le recensioni sono ancora **lorem ipsum** sui giochi vecchi; quelli aggiunti
  per nome hanno la recensione vuota.

### Due cose lasciate scoperte apposta

1. **`apriModifica()` non ha piu' nessuna porta.** Togliendo il pulsante
   «scheda» dal piede della scheda, autore, editore, anno, voto e copertina
   non si correggono piu' da nessuna parte del sito. La funzione è intatta e il
   listener è scritto per non esplodere se il pulsante manca; il posto naturale
   dove rimetterla è il menu a tre punti dell'elenco.
2. **Sul database non c'è un indice unico su `(proprietario, nome)`** delle
   librerie. Il divieto dei nomi doppi vive in `store.js`. Quando fu scritto la
   collezione aveva tre «Libreria 3» e la migrazione non sarebbe passata;
   adesso i doppioni non ci sono piu', quindi si puo' aggiungere quando si vuole.

### Come si lavora qui, in quattro righe

Server locale su **8124** (`.claude/launch.json`, `autoPort:false` — la porta è
obbligata dai Redirect URLs di Supabase, e la 8125 è del proxy BGG). Modifiche
con **sostituzioni verificate** (`assert count == 1`) e ricontrollo che i `.js`
siano ancora **ASCII**. Si verifica **sul server locale contro il database vero**,
entrando davvero, e i dati di prova si ripuliscono a fine giro. Commit e push a
ogni passo finito, su **tutti e due i rami**, messaggi in inglese che dicono
*cosa* e *perche'*.

## Stato del backend

Funziona ed è collaudato end-to-end sul progetto vero (2026-08-19): accesso con
Google, ruolo letto dal server, aggiunta, **modifica** (scheda e recensione),
rimozione, copertine caricate nel bucket, **ordine manuale** scritto in
`posizione`, **pubblicazione e ritiro** di una recensione nel catalogo, **nick e
faccia** salvati sul profilo, le due funzioni di **richiesta amicizia**
(codice inesistente, proprio codice, email ignota: nessuna crea righe),
**giocatori salvati** con il rifiuto del doppione, e una **partita** completa di
partecipanti, posizioni e vincitore. **Tutte e dodici le migrazioni sono
applicate**, `punti_partita` compresa (2026-08-22, dall'SQL editor del pannello:
qui non c'è la CLI di Supabase).
Verificato rileggendo il database dall'esterno, non dalla cache del browser.

Collaudato di nuovo il **2026-08-23**, sempre contro il progetto vero: lo
scambio di due scatole sullo scaffale (che prima falliva sull'indice unico), la
cancellazione di un gioco fino alla rilettura dal server dopo un ricaricamento,
il salvataggio dei punti di una partita **zero compreso**, e la riapertura del
modulo con punteggi, posizioni e corona al loro posto. I dati di prova sono
stati ripuliti a fine giro.

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
2. **Il token BGG non è ancora arrivato**, ma dal 2026-08-22 serve molto meno.
   `boardgamegeek.com/xmlapi2` risponde **401 a qualunque user-agent** e la
   pagina `browse` è HTML che le loro condizioni vietano di raschiare — quella
   strada resta chiusa. Ma il **dump dei ranking** è pubblico e scaricabile
   senza chiave, e copre le due cose per cui il token serviva di più: cercare
   fra centomila titoli e sfogliare in classifica. Restano fuori **autore,
   editore, durata e le copertine vere**: per quelli si passa ancora da
   Wikidata, che è magra e a volte sbagliata (l'editore è spesso il distributore
   locale). Per questo un risultato **riempie il modulo** invece di finire
   dritto sullo scaffale.
3. **Wikidata non ha le copertine, e non le avrà mai**: le sue immagini vengono da
   Wikimedia Commons, che accetta solo licenze libere, e la grafica di una scatola
   è protetta. Su 4.445 giochi, 597 hanno una qualche immagine (13%) e sono foto
   di partite sul tavolo. Per le copertine c'è il **campo file** nel modulo, che
   vince sempre sull'immagine della fonte — la fonte giusta è il press kit
   dell'editore.
4. ~~L'ordine del catalogo è quello di Wikidata.~~ **Risolto il 2026-08-22, e
   senza token**: il dump dei ranking che BGG pubblica ogni giorno è in
   `dati/bgg.txt`, e il catalogo si sfoglia nella classifica vera — primo Brass:
   Birmingham. Vedi «L'indice di BGG in casa».
5. Su telefono la scatola è **90 px di larghezza**: si riconosce la copertina ma
   non si legge il titolo. È il prezzo delle tre colonne; se dà fastidio,
   l'alternativa è tornare a due.
6. **Nel catalogo non ci sono più le miniature.** Il dump non ha immagini e
   quelle di Wikidata arrivano solo aprendo una scheda. Le righe mostrano rank e
   media BGG al posto di autore ed editore, che su un elenco in classifica dice
   di più — ma se le miniature servono, si possono chiedere a Wikidata per gli id
   visibili, una passata sola.
7. **Le partite restano private.** Gli amici vedono libreria e recensioni, non le
   partite: è il cambio di una policy, ed è una scelta dell'utente.
8. **La scheda di un gioco non si corregge piu' da nessuna parte.** Autore,
   editore, anno, voto e copertina: `apriModifica()` è intatta ma senza porta,
   da quando il pulsante «scheda» è uscito dal piede della scheda. Vedi
   «Il piede della scheda».
9. **Manca l'indice unico su `(proprietario, nome)`** delle librerie. Il divieto
   dei nomi doppi vive in `store.js` e regge; l'indice sarebbe la garanzia, e
   adesso che i doppioni non ci sono piu' la migrazione passerebbe.

### Quello che è stato chiesto e non si può fare qui

- **Le recensioni vere** sono opinioni dell'utente sui suoi giochi: non si
  inventano.
- **L'edge function per BGG** vuole il token, che non è ancora arrivato.

Prossimi passi già discussi, non ancora fatti:

- **Edge function per BGG** al posto del proxy locale: il token starebbe sul
  server, la ricerca funzionerebbe da qualunque browser senza accendere niente, ed
  è anche ciò che le condizioni di BGG chiedono.
- **App Android/iOS**: la strada è Capacitor, che imbarca questi stessi file. Da
  fare *dopo* i contenuti veri, perché Apple rifiuta le app che sembrano solo un
  sito (linea guida 4.2). Serve anche safe-area (`env(safe-area-inset-*)`, oggi
  non usata), gestione del tasto indietro, e un livello di qualità più leggero.
