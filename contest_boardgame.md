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

## 4. Le dieci migrazioni, tutte applicate

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
```

**Sono tutte applicate al progetto.** Se una funzione dice «manca la migrazione
X», qualcosa è andato storto: il client è scritto per dirlo per nome.

## 5. Cosa è stato costruito, in ordine

Ventidue commit. Il filo è: da una libreria che si adattava allo schermo a una
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

## 8. Stato dei dati (2026-08-20)

- Account principale: `admin@smlrcc.it`, nick **Samuel**, codice `HH67 6BY7`.
- Secondo account di prova: **samuel2**, amicizia accettata. Serve per provare
  la visita alla libreria di un amico.
- Collezione: **10 giochi**, tutti in vetrina. Due librerie: `Libreria 1` (con i
  giochi) e `Libreria 2` (vuota, creata dall'utente).
- I posti hanno dei buchi (7 e 10 liberi, `ark4` all'11): **non è un errore**, è
  la funzione che fa il suo lavoro.
- Zero gruppi, zero partite, zero giocatori, zero preferiti: tutti i dati di
  prova sono stati cancellati a fine verifica.
- Le recensioni sono ancora **lorem ipsum**, accorciato a due capoversi.

## 9. Cosa resta aperto

1. **Le recensioni vere** al posto del lorem ipsum. Si scrivono dal sito, dal
   tasto *la tua recensione* nella scatola aperta, e da lì si pubblicano nel
   catalogo con la casella in fondo al modulo di modifica.
2. **Il token BGG.** Finché non c'è, il catalogo resta su Wikidata: dati più
   magri, editore spesso sbagliato, e quasi mai la copertina vera.
3. **Edge function su Supabase** al posto del proxy locale `tools/bgg-proxy.mjs`:
   il token starebbe sul server, la ricerca funzionerebbe da qualunque browser,
   ed è anche ciò che le condizioni di BGG chiedono.
4. **Logo «Powered by BGG»** nel piede, obbligatorio quando si usa l'API.
5. **Le partite sono private.** Gli amici vedono libreria e recensioni, non le
   serate. È il cambio di una policy, se lo si vuole.
6. Su telefono la scatola è **larga 90 px**: si riconosce la copertina, non si
   legge il titolo. È il prezzo delle tre colonne.

## 10. Modo di lavorare

- L'utente scrive in **italiano**; commenti nel codice e testi del sito in
  italiano. I file `.js` restano **solo ASCII** (accenti come entità o senza).
- **Commit e push a ogni passo finito**, senza chiedere. Messaggi in inglese,
  discorsivi: cosa è cambiato e **perché**, comprese le cause dei bug corretti.
- **Verificare sempre su server locale** contro il database vero, e **ripulire i
  dati di prova** a fine verifica.
- `CLAUDE.md` va aggiornato insieme al codice: è il documento che sopravvive.
