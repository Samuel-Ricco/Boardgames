# il dado è trap — dove siamo arrivati

Riassunto di una sessione lunga, scritto per essere letto **dopo aver perso il
contesto**. Non sostituisce `CLAUDE.md`: quello racconta *com'è fatto* il sito e
tutte le trappole tecniche, questo racconta *cosa è successo*, cosa è stato
deciso e perché, e cosa resta aperto.

**Leggi prima `CLAUDE.md`.** Poi questo.

---

## 1. Il progetto in tre righe

Sito di recensioni di giochi da tavolo che **è** una libreria KALLAX in 3D
(three.js). Un solo file HTML, nessun build, nessuna dipendenza da installare.
Backend Supabase. Tre sezioni: **la mia collezione** (la scena 3D), **il
catalogo** (elenco piatto, leggibile senza account), **il profilo** (chi sei,
amici, giocatori, partite).

- Cartella di lavoro: `C:\Users\Windows\_Claude\new_dado-e-trap`, ramo `libreria`
- Repo: <https://github.com/Samuel-Ricco/Boardgames.git>
- Online: <https://samuel-ricco.github.io/Boardgames/> (GitHub Pages, serve `main`)
- Server locale: `python -m http.server 8124` — **la porta 8124 è obbligatoria**
  (unica nei Redirect URLs di Supabase). Non la 8125, che è del proxy BGG.

## 2. La fork, e come è finita

Il progetto viveva su due rami:

| ramo | com'era |
|---|---|
| `main` | armadio con le ante, scena notturna — quello che GitHub Pages pubblicava |
| `libreria` | libreria a cubi, stanza chiara — dove si lavorava |

**Il 2026-08-20 `libreria` è stata portata su `main`.** Non è servito nessun
merge: `origin/main` non aveva **un solo commit** che `libreria` non avesse già,
quindi è stato un avanzamento lineare (`027e908` → `026843d`). I due rami ora
puntano allo stesso commit e l'armadio esiste solo nella storia.

Conseguenze pratiche:

- GitHub Pages ha ricostruito da solo: online c'è la libreria. Verificato —
  la pagina contiene la barra a tre sezioni e tutti gli asset rispondono 200.
- I **Redirect URLs di Supabase** sono stati aggiornati dall'utente e ora
  contengono `https://samuel-ricco.github.io/Boardgames/**` oltre a
  `http://localhost:8124/**`. Il Site URL è l'indirizzo di Pages. Senza, il
  login parte, arriva a Google e non torna indietro.
- La cartella `dado-e-trap` (l'altra copia, su `main`) ha ancora nel working
  tree la vecchia versione dell'armadio: va aggiornata con un `git pull`, o
  buttata — non ci lavora nessuno.

## 3. Le decisioni prese dall'utente

Non sono mie: sono state chieste e scelte, e cambiano l'impianto.

| domanda | scelta |
|---|---|
| Ordine manuale dei giochi | **trascinamento in 3D**, non frecce né lista |
| Presentazione del catalogo | **elenco 2D**, una riga per gioco (non la scena 3D) |
| Da dove si segnano le partite | **da tutti e due**: scatola aperta e profilo |
| A che giochi si aggancia una partita | all'**id BGG**, così vale anche per giochi che non hai |
| Fonte del catalogo senza token BGG | **Wikidata ora**, BGG quando arriva |
| «Recensione personale» | **quella che già c'è**, resa visibile agli amici |
| Gruppi e librerie | **due cose diverse**: librerie = mobili, gruppi = etichette trasversali |
| Ordinamenti calcolati vs librerie con nome | **ignorano librerie e buchi**, riempiono in sequenza |

Una decisione l'ho presa io perché mi è stata delegata: **codice amico e non
ricerca per email**. Cercare qualcuno per indirizzo vuol dire che il server
conferma «sì, questa email ha un account qui» a chiunque provi — enumerazione di
account. L'invito per email c'è, ma passa da una funzione che risponde *sempre*
`inviata`, esista o no l'indirizzo.

## 4. Le undici migrazioni, tutte applicate

Nell'ordine. Le prime tre precedono questa sessione.

```
20260819120018_schema_iniziale.sql          admin, profili, giochi, bucket copertine
20260819123907_copertine_locali.sql         le copertine committate
20260819135317_collezioni_personali.sql     una libreria per account
20260819180000_ordine_manuale.sql           colonna `posizione`
20260819190000_recensioni_pubbliche.sql     recensioni del sito, lette da tutti
20260819200000_profili_e_amici.sql          nick, faccia, codice amico, amicizie
20260819210000_partite.sql                  giocatori, partite, partecipanti
20260819220000_codice_riservato.sql         il codice amico non esce dalla riga
20260820100000_stanza_librerie_gruppi.sql   stanza arredabile, librerie, gruppi
20260820200000_preferiti_e_stile_libreria.sql preferiti, legno e arredi per mobile
20260820230000_apprezzamenti.sql            i cuori sotto la recensione di un amico
```

**Tutte e undici sono applicate**, `apprezzamenti` compresa (applicata
dall'utente il 2026-08-20). Se una funzione dice «manca la migrazione X»,
qualcosa è andato storto: il client è scritto per dirlo per nome.

**Sono tutte applicate al progetto.** Se una funzione dice «manca la migrazione
X», qualcosa è andato storto: il client è scritto per dirlo per nome.

## 5. Cosa è stato costruito, in ordine

Ventidue commit, fino al 2026-08-20 (per quelli dopo vedi il punto 8). Il filo è: da una libreria che si adattava allo schermo a una
stanza arredata con dentro delle persone.

**La geometria.** La libreria era calcolata: quattro colonne in orizzontale, tre
altrimenti, e file che crescevano verso il basso. Ora **una libreria è sempre
3 × 4** — dodici cubi, dodici giochi — e finiti i posti se ne mette accanto
un'altra: si scorre in orizzontale lungo la parete.

**Contatore e ricerca.** La ricerca non evidenzia, **ricostruisce lo scaffale**:
cerchi «root» e sulla libreria c'è Root e basta.

**Ordine manuale.** Si tiene premuta una scatola un terzo di secondo e la si
sposta. Su un cubo occupato le due si scambiano; su un cubo libero ci va e
**quello di partenza resta vuoto**.

**Catalogo e ospite.** Il sito si divide in due metà, poi tre. Il catalogo legge
da Wikidata (3.429 giochi con id BGG) e si sfoglia senza account.

**Profilo, amici, partite.** Nick al primo accesso, faccia a meeple disegnata su
canvas, codice amico. Amicizie con richiesta e accettazione. Giocatori salvati
(nomi, non account: al tavolo c'è sempre qualcuno che sul sito non c'è) e
partite agganciate all'id BGG.

**La libreria di un amico** si apre nella stessa scena 3D, in sola lettura.

**La stanza.** Cursore della luce, tavolozze per muro e pavimento, cinque arredi
per i cubi vuoti e per il ripiano sopra il mobile. Legno e arredi appartengono al
**mobile**; luce, muro e pavimento alla **stanza**.

**Librerie con nome**, create a mano, con i buchi permessi, e il nome dipinto
sopra il mobile.

**Gruppi** come etichette trasversali, gestiti dall'elenco.

**La libreria diventa una vetrina**: sugli scaffali va solo quello che scegli.
`libreria` nulla vuol dire «ce l'ho ma non è in mostra».

**L'elenco** ha righe compatte (copertina, nome, ☰) e due viste — *gruppi* e
*tutti i giochi* — con un indicatore che segue il dito.

## 6. I difetti trovati, e cosa insegnano

Questi sono la parte che vale di più. Tutti trovati **verificando**, non
leggendo il codice.

**Il codice amico era leggibile dagli amici.** Avevo scritto — nel codice, in
`CLAUDE.md` e nel README — che non usciva mai dal profilo altrui «perché lo dice
la policy». Falso: **RLS filtra le righe, non le colonne**. Aprendo la riga di un
amico per prenderne nick e faccia usciva anche il suo codice, e chi se lo prende
può farsi accettare da chiunque lo abbia fra gli amici. I permessi per colonna
stanno nei **GRANT**: `select` sulla tabella tolto e rifatto colonna per colonna,
e il proprio codice arriva da `mio_codice()`.

**La tua libreria si riempiva dei giochi degli amici.** `LIB.sync()` leggeva
`giochi` **senza `where`**, con un commento che spiegava perché non serviva: le
policy dicevano `proprietario = auth.uid()`. Era vero *prima* di aprire la
lettura agli amici. Dieci giochi diventati ventitré, mescolati, e salvati così
anche in `localStorage`. **Una query che si affida alle policy per delimitare i
dati è corretta finché le policy non cambiano, e le policy cambiano.**

**Una variabile locale che copriva una funzione.** `const quanti = {}` dentro una
funzione dove esiste `quanti()`: la chiamata diventava un `TypeError` che
interrompeva l'apertura del profilo a metà, e il sintomo era che *tutti* i
contatori restavano vuoti. Il posto dove si vede il guasto non è quello dove sta.

**I tasti in fondo al pannello.** Non era la lunghezza del testo: su schermo
stretto il pannello arrivava a filo del bordo e **la barra delle sezioni gli
stava sopra** nello z. Inchiodare il piede non bastava.

**Compenetrazioni sui legni scuri.** Ripiani e montanti avevano le facce davanti
sullo stesso identico piano. Due centesimi di profondità in meno ai ripiani.

**Un gioco nuovo finiva sempre nella prima libreria.** Creare una seconda
libreria e non riuscire a metterci niente: andava nel primo cubo libero *in
assoluto*. Ora va nel mobile che si sta guardando.

**Ridisegnare una lista sotto il dito.** Ogni tocco sostituiva il pulsante appena
premuto e il tocco successivo cadeva nel vuoto.

**Un `false` dove c'era `undefined`** viene poi spedito al server dalla modifica
successiva, e fa fallire un salvataggio che non c'entrava niente.

**Non estrarre il nome di una colonna con una regex** dai messaggi d'errore:
Postgres e PostgREST li scrivono in modo diverso.

## 7. Come si verifica (le trappole dell'anteprima)

Il pannello di anteprima **mente**, e mi ha ingannato più volte:

- compone **fotogrammi vecchi**: lo screenshot mostra uno stato che non c'è più;
- a pagina non visibile **`requestAnimationFrame` è sospeso** e i `setTimeout`
  sono strozzati a ~1 s;
- serve **CSS e JS dalla cache** anche dopo un reload;
- ha **azzerato `localStorage`** due volte, e con esso la sessione Google;
- la sua **console accumula errori fra una navigazione e l'altra**: i 400 che si
  vedono possono essere di dieci minuti fa. Per sapere cosa è fallito *in questo
  caricamento* si usa `performance.getEntriesByType('resource')` e si guarda
  `responseStatus`.

Quello che funziona:

1. `fetch(file, {cache:'reload'})` su ogni file cambiato, **poi** ricaricare;
2. esporre un `window.__dbg` temporaneo con `state`, `boxes`, la camera e
   `frame`, **pompare `frame()` a mano con un orologio monotono**, e guidare
   eventi `PointerEvent` sintetici;
3. **togliere il gancio prima di committare**;
4. rileggere sempre **dal server**, non dalla cache del client, con
   `AUTH.client().from(...)`.

Per provare la strada dell'ospite senza sloggare l'utente: si parcheggia la
chiave `sb-<progetto>-auth-token` di `localStorage` in un'altra chiave, si
ricarica, si prova, e poi la si rimette. `AUTH.esci()` no — quello invalida il
refresh token sul server.

## 8. La sessione del 2026-08-20/21: ottimizzazione e rifacimento grafico

Diciotto commit, in tre atti. Tutti su `libreria` e su `main`.

### Atto I — il fotogramma costava troppo (`ddbf827`, `5f7c43e`)

Misurato avvolgendo il contesto WebGL e contando i draw call **divisi per
framebuffer**: 574 a fotogramma per 5.794 triangoli. Dodici triangoli a
chiamata: il collo di bottiglia non è mai stata la geometria, era l'overhead.

- **316 di quei 574 erano la passata d'ombra**, ridisegnata sessanta volte al
  secondo per un'ombra identica a quella di prima. Ora `shadowMap.autoUpdate` è
  spento e la mappa si rifà su prenotazione (`rifaiOmbre`).
- 224 materiali per 152 mesh, niente condiviso, e `buildProps` li rifaceva tutti
  — canvas e texture comprese — **a ogni lettera scritta nella ricerca**.
- Un box con un array di materiali si disegna **una volta per gruppo**: 42
  oggetti costavano 252 chiamate. `cuboRaggruppato` riordina gli indici per
  slot. I dadi sono passati a un **atlante 3×2**: da sei chiamate a una.

Risultato: **574 → 201 elementi da disegnare**, 224 → 98 materiali, 152 → 43
geometrie, e a riposo la passata d'ombra non c'è proprio.

### Atto II — l'interfaccia (`c7f6aa8` → `03d315b`)

Testata fissa e uguale ovunque · imbuto e pannello della libreria · scheda che
esce dalla scatola · finestrella delle azioni · visita ridotta con i cuori ·
**re-skin completo** · modulo della partita rifatto. I dettagli tecnici stanno
tutti in `CLAUDE.md`, sezione per sezione.

Il re-skin è passato **due volte**: prima un serif editoriale su crema
(`87a1130`), poi — su indicazione dell'utente — **un font solo (Poppins) e sei
tinte** (`e6d2f24`). Il secondo è quello buono. Il primo è utile solo come
lezione: le misure dei titoli erano nate su un condensato, e ogni cambio di
faccia le ha dovute riscalare.

### Atto III — i difetti trovati usando il sito (`1a36508`, `eda52df`)

- **`opacity:0` nasconde, non disattiva**: il binario restava cliccabile in
  tutte le schermate.
- **I filtri sopravvivevano alla schermata** in cui li si metteva.
- **Il cestino delle librerie cancellava al primo clic** — ed è costato due
  mobili veri (vedi sotto).

## 9. Stato dei dati (2026-08-21)

- Account principale: `admin@smlrcc.it`, nick **Samuel**, codice `HH67 6BY7`.
- Secondo account di prova: **samuel2**, amicizia accettata.
- Collezione: **35 giochi**, tutti sugli scaffali. **Tre librerie**:
  `Libreria 1`, `Libreria 2`, `Libreria 3`.
- **25 di quei giochi sono i primi 25 della classifica BGG**, inseriti su
  richiesta dell'utente **con il solo nome**: copertina disegnata dal sito,
  nessun altro dato, nessun id BGG. Vedi il punto sulle copertine più sotto.
- Un gruppo: **party game** (3 giochi). Un preferito (RisiKo!).
- **Una partita di prova rimasta**: titolo `pa`, giocatori `s, d, sa`, datata
  20/08/2026. Segnalata all'utente, non cancellata perché non è chiaro di chi
  sia.
- Le recensioni sono ancora **lorem ipsum** sui 10 giochi vecchi; i 25 nuovi
  hanno la recensione vuota.

### Un incidente, e la regola che ne è uscita

Il pannello delle librerie, appena scritto, aveva **un cestino per riga che
cancellava al primo clic**. In un elenco che si trascina è un incidente che
aspetta di capitare: sono spariti **Libreria 1 e Libreria 2**, e con la chiave
esterna `on delete set null` tutti e 35 i giochi sono tornati **senza posto**
insieme.

Il difetto è stato corretto (ora è in due tempi) e i dati ripristinati: le due
librerie ricreate nell'ordine giusto e i 35 giochi ricollocati, verificando dal
server. Ma la regola era **già scritta in `CLAUDE.md`** e non è stata seguita:
*tutto ciò che butta via qualcosa chiede conferma sul pulsante stesso.*

## 10. Le copertine: perché non ci sono, e cosa serve

Provate tutte le strade prima di fermarsi:

| strada | esito |
|---|---|
| `boardgamegeek.com/xmlapi2` | **401** con qualunque user-agent: chiusa dietro token |
| pagina `browse/boardgame` | risponde 200, ma è **HTML da raschiare** e le condizioni di BGG lo vietano |
| Wikidata, la fonte che il sito già usa | misurata su 8 titoli moderni: ne trova 5 e **ha la copertina di uno solo** |

Quindi: i nomi ci sono, le copertine no. Servono, in alternativa, **il token
BGG** (`tools/bgg-fetch.mjs` esiste già) oppure **il campo file** nel modulo di
modifica, che resta la fonte giusta — il press kit dell'editore.

Nota: i 25 nomi li ha **incollati l'utente**, non sono stati raschiati.

## 11. Cosa resta aperto

**Il blocco mai iniziato:**

1. **IT/EN.** Chiesto due volte, mai fatto. Il sito **non ha nessun sistema di
   traduzione**: va costruito da zero e passato su ogni stringa dell'HTML e su
   quelle generate in JS. Il selettore va **nel cancello** e **in fondo al
   profilo**, e sotto di esso, come ultima cosa della pagina, il logout.

**I difetti segnalati dall'utente e non ancora corretti** (elenco interrotto a
metà, potrebbe continuare):

2. **Eliminare una libreria non funziona.** Con due librerie, sulla prima dice
   «l'ultima libreria non si toglie» — ma non è l'ultima; sull'altra l'azione si
   completa ma **non cancella niente**. Da guardare: `togliLibreria` in
   `js/store.js` e i due punti che la chiamano in `js/app.js` (il cestino
   dell'elenco e `#st-meno`).
3. **Amici e Giocatori non hanno la gerarchia delle tendine** applicata a
   partite e gruppi (rientro + filo verticale + peso minore).
4. Il pulsante **copia** del codice amico: solo icona, senza scritta.
5. Nella collezione il **preferito deve essere una stellina cliccabile sulla
   riga**, tolta dal menu; e **icone su tutte le azioni** che le meritano.
6. L'**icona del pannello della libreria** (oggi una lampada) non descrive più
   quel pannello, che adesso gestisce nome, aspetto e ordine di tutti i mobili.

**Da prima di questa sessione:**

7. Le **recensioni vere** al posto del lorem ipsum.
8. **Edge function su Supabase** al posto del proxy locale, e il logo
   **«Powered by BGG»** nel piede quando l'API verrà usata.
9. Le **partite sono private**: gli amici vedono libreria e recensioni, non le
   serate. È il cambio di una policy, se lo si vuole.
10. Su telefono la scatola è **larga 90 px**: si riconosce la copertina, non si
    legge il titolo. È il prezzo delle tre colonne.

## 12. Modo di lavorare

- L'utente scrive in **italiano**; commenti nel codice e testi del sito in
  italiano. I file `.js` restano **solo ASCII** (accenti come entità o senza).
- **Commit e push a ogni passo finito**, senza chiedere. Messaggi in inglese,
  discorsivi: cosa è cambiato e **perché**, comprese le cause dei bug corretti.
- **Verificare sempre su server locale** contro il database vero, e **ripulire i
  dati di prova** a fine verifica.
- `CLAUDE.md` va aggiornato insieme al codice: è il documento che sopravvive.
