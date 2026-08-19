# Supabase: come si monta

Il sito resta su GitHub Pages. Su Supabase vanno solo account, ruoli, libreria
condivisa e copertine caricate. Questa è la parte che **devo fare io a mano**,
perché richiede un account mio.

---

## 1. Il progetto

<https://supabase.com> → nuovo progetto.

- **Region**: `Central EU (Frankfurt)`, la più vicina.
- Segnati la **Database password** da qualche parte: non la si rivede più.

Ci mette un paio di minuti a partire.

## 2. Lo schema

Pannello → **SQL Editor** → New query → incolla tutto `schema.sql` → Run.

Crea le tabelle `giochi`, `profili`, `admin`, le regole di accesso, il bucket
delle copertine, e mette dentro Root e Scythe così l'armadio non è vuoto.

Due avvertenze oneste, perché quello schema **non l'ho potuto eseguire contro un
database vero** — non ho un Postgres qui:

- se l'ultima sezione, quella delle policy su `storage.objects`, dà errore di
  permessi, non è grave: quelle tre regole si rifanno a mano da *Storage →
  Policies*, con lo stesso senso (lettura a tutti, scrittura solo agli admin);
- se qualcos'altro si lamenta, mandami il messaggio e lo correggo. Il resto del
  file è SQL ordinario e le policy sono scritte per essere rilanciabili.

## 3. L'accesso con Google

Servono due pannelli, uno di Google e uno di Supabase, e vanno incastrati.

**Su Google Cloud** (<https://console.cloud.google.com>):

1. Nuovo progetto (o uno esistente).
2. *APIs & Services* → *OAuth consent screen* → tipo **External**, compila nome
   dell'app e email di contatto. Finché resta in "Testing" possono accedere solo
   gli account che aggiungi come tester: per iniziare va benissimo.
3. *Credentials* → *Create credentials* → **OAuth client ID** → tipo **Web
   application**.
4. In **Authorized redirect URIs** incolla esattamente:

   ```
   https://<IL-TUO-REF>.supabase.co/auth/v1/callback
   ```

   Il `<IL-TUO-REF>` lo trovi in Supabase, *Project Settings → API*, è la prima
   parte dell'URL del progetto.
5. Copia **Client ID** e **Client Secret**.

**Su Supabase**:

6. *Authentication* → *Providers* → **Google** → abilita, incolla Client ID e
   Secret, salva.
7. *Authentication* → *URL Configuration*, e qui **attenzione, è il punto dove
   si sbaglia sempre**:
   - **Site URL**: l'indirizzo pubblico del sito
     (`https://samuel-ricco.github.io/Boardgames/` finché non c'è un dominio).
   - **Redirect URLs**: aggiungi *anche* `http://localhost:8124` — se no il
     login funziona online e non funziona mentre sviluppi, e sembra un bug del
     codice.

## 4. Le chiavi da darmi

*Project Settings* → **API**. Mi servono due cose:

- **Project URL** — `https://xxxx.supabase.co`
- **anon public key** — quella lunga marcata `anon` / `public`

**Sono pubbliche per progetto e vanno nel JavaScript**: è il modo in cui
Supabase è pensato per funzionare, e le regole scritte in `schema.sql` sono
quello che davvero protegge i dati. Finiranno in `js/config.js`, committato.

**La chiave `service_role` non me la dare e non deve uscire dal pannello**:
quella scavalca ogni regola. Se per sbaglio finisse in un repo pubblico, va
rigenerata subito.

## 5. Diventare admin

Il primo accesso ti crea l'utente ma non ti dà nessun potere. Poi, a mano:

*Table Editor* → `admin` → *Insert row* → `user_id` = il tuo id, che trovi in
*Authentication → Users*.

Non c'è modo di farlo dal browser, ed è voluto: sulla tabella `admin` non esiste
nessuna regola di scrittura, quindi nessun account può promuovere sé stesso o
altri. Si passa da qui.

---

## Cosa succede dopo, nel codice

Quando mi passi URL e chiave:

- `js/config.js` — le due chiavi, e basta.
- `js/store.js` — resta l'unico file che sa dove vive la libreria. Le funzioni
  che usa la scena (`all`, `list`, `add`, `remove`) restano **sincrone**: i dati
  si scaricano una volta all'avvio in memoria, e le modifiche partono in
  background. Così `app.js` non cambia di una riga.
- `js/auth.js` — accesso con Google, e la domanda "sono admin?" fatta al server.
- La schermata iniziale smette di far scegliere il ruolo e diventa *entra* o
  *guarda e basta*: il ruolo non è più una scelta, è una risposta del database.
- `vendor/supabase.js` — la libreria committata nel repo, come three.js. Il
  progetto non carica niente dalla rete al primo avvio, e questa regola resta.
- `js/data.js` continua a esistere come **copia di sicurezza**: se Supabase non
  risponde, o non è configurato, l'armadio mostra i giochi committati invece di
  una pagina vuota.

## Le cose da sapere prima

- Il piano gratuito **mette in pausa i progetti dopo circa una settimana** senza
  traffico: si riattiva a mano dal pannello.
- Da quel momento conservi indirizzi email di persone vere. Serve una riga di
  informativa e un modo per cancellare l'account.
- Il proxy BGG locale (`tools/bgg-proxy.mjs`) può diventare una *edge function*,
  così il token sta sul server e la ricerca funziona da qualunque browser senza
  accendere niente. Vale la pena farlo, ma dopo: prima la libreria condivisa.
