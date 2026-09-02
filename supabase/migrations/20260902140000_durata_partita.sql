-- ============================================================
--  QUANTO E' DURATA
-- ============================================================
--
--  Di una partita si segnava il giorno, chi c'era e chi ha vinto. Non
--  quanto e' durata -- ed e' il numero da cui nasce la domanda che la
--  sezione partite non sapeva ancora rispondere: **quante ore abbiamo
--  giocato**.
--
--  E' in MINUTI, non un intervallo: si scrive a mano, e chi lo scrive
--  ha in mente "un'ora e mezza", non un tipo di Postgres. La conversione
--  in ore la fa chi mostra il totale, che e' l'unico posto in cui serve.
--
--  E' OPZIONALE, e resta tale. Di molte partite non ci si ricorda, e un
--  campo obbligatorio qui vorrebbe dire o un numero inventato o una
--  partita non segnata -- e fra le due, la seconda e' la perdita vera.
--  Nullo vuol dire "non registrata", come per `posizione`: le partite
--  senza durata non entrano nel conto delle ore, ne' al numeratore ne'
--  al denominatore.
--
--  `partite` ha grant a livello di TABELLA, quindi la colonna nuova le
--  eredita: non c'e' niente da rifare.
-- ------------------------------------------------------------

alter table public.partite
  add column if not exists minuti integer;

comment on column public.partite.minuti is
  'quanto e'' durata, in minuti; nullo = non registrata';
